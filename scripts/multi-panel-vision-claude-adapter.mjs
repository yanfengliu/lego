import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import { MAX_CHILD_STDERR_BYTES, runBoundedChild } from "./part-identification-io.mjs";
import { responseModelIdentity } from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import {
  MultiPanelVisionError,
  boundBytes,
  canonicalJsonBytes,
  parseMultiPanelAnswer,
  verifiedBytes,
  verifyMultiPanelRequest,
} from "./multi-panel-vision-contract.mjs";
import {
  BOUND_VISION_CLAUDE_TOOL,
  BOUND_VISION_MCP_SERVER,
  boundVisionEvidenceContent,
} from "./multi-panel-vision-mcp-server.mjs";

export const BOUND_VISION_SYSTEM_PROMPT =
  "You are a closed visual comparison rater. Use only the one supplied MCP image tool, call it exactly once, and return only the requested one-line JSON verdict. You have no filesystem, shell, web, memory, skill, or document authority.";

const SERVER_PATH = fileURLToPath(new URL("./multi-panel-vision-mcp-server.mjs", import.meta.url));
const fatalUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const CLAUDE_CHILD_ENV_ALLOWLIST = Object.freeze([
  "ALL_PROXY",
  "APPDATA",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CONFIG_DIR",
  "ComSpec",
  "HOME",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "NODE_EXTRA_CA_CERTS",
  "NO_PROXY",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SystemRoot",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "WINDIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
]);

export class ClaudeBoundVisionError extends MultiPanelVisionError {
  constructor(message, transportTraceBytes = null) {
    super(message);
    this.name = "ClaudeBoundVisionError";
    this.transportTraceBytes = transportTraceBytes;
  }
}

function visit(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((entry) => visit(entry, visitor));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  visitor(value);
  Object.values(value).forEach((entry) => visit(entry, visitor));
}

function integerUsage(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ClaudeBoundVisionError(`Claude result ${label} must be a non-negative safe integer.`);
  }
  return value;
}

function boundedClaudeEnvironment(source) {
  const env = {};
  for (const key of CLAUDE_CHILD_ENV_ALLOWLIST) {
    const value = source[key];
    if (typeof value === "string" && value.length <= 32_768 && !value.includes("\0")) {
      env[key] = value;
    }
  }
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  return env;
}

/** Validate one complete stream-json transcript, including the MCP call/result pair. */
export function parseClaudeBoundVisionStream(traceBytes, requestInput, elapsedMs) {
  const request = verifyMultiPanelRequest(requestInput);
  const requestedModelId = request.requestedModelIdentity.requestedModelId;
  let text;
  try {
    text = fatalUtf8.decode(Buffer.from(traceBytes));
  } catch (cause) {
    throw new ClaudeBoundVisionError(`Claude stream is not exact UTF-8: ${cause.message}.`);
  }
  const events = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (line.trim().length === 0) continue;
    try {
      events.push(parseStrictJsonBytes(Buffer.from(line, "utf8")));
    } catch (cause) {
      throw new ClaudeBoundVisionError(
        `Claude stream line ${index + 1} is not strict JSON: ${cause.message}.`,
      );
    }
  }
  const results = events.filter(({ type }) => type === "result");
  if (results.length !== 1) {
    throw new ClaudeBoundVisionError(
      `Claude stream must contain exactly one terminal result event; received ${results.length}.`,
    );
  }
  const toolUses = [];
  const toolResults = [];
  for (const [eventIndex, event] of events.entries()) {
    visit(event, (value) => {
      if (value.type === "tool_use") toolUses.push({ eventIndex, value });
      if (value.type === "tool_result") toolResults.push({ eventIndex, value });
    });
  }
  if (
    toolUses.length !== 1 ||
    toolUses[0].value.name !== BOUND_VISION_CLAUDE_TOOL ||
    typeof toolUses[0].value.id !== "string" ||
    typeof toolUses[0].value.input !== "object" ||
    toolUses[0].value.input === null ||
    Array.isArray(toolUses[0].value.input) ||
    Object.keys(toolUses[0].value.input).length !== 0
  ) {
    throw new ClaudeBoundVisionError(
      `Claude must call exactly ${BOUND_VISION_CLAUDE_TOOL} once with empty input; observed ${toolUses.map(({ value }) => value.name).join(", ") || "no tool use"}.`,
    );
  }
  const matchingResults = toolResults.filter(
    ({ value }) => value.tool_use_id === toolUses[0].value.id,
  );
  if (
    toolResults.length !== 1 ||
    matchingResults.length !== 1 ||
    matchingResults[0].value.is_error !== false
  ) {
    throw new ClaudeBoundVisionError(
      `Claude stream must retain one successful tool_result for ${toolUses[0].value.id}; received ${toolResults.length}.`,
    );
  }
  const terminal = results[0];
  const terminalIndex = events.indexOf(terminal);
  if (
    terminal.subtype !== "success" ||
    terminalIndex !== events.length - 1 ||
    toolUses[0].eventIndex >= matchingResults[0].eventIndex ||
    matchingResults[0].eventIndex >= terminalIndex
  ) {
    throw new ClaudeBoundVisionError(
      "Claude stream must order one tool use, its successful exact result, and one final success event with no trailing events.",
    );
  }
  const expectedContent = boundVisionEvidenceContent(request);
  if (
    canonicalJsonBytes(matchingResults[0].value.content).compare(
      canonicalJsonBytes(expectedContent),
    ) !== 0
  ) {
    throw new ClaudeBoundVisionError(
      "Claude tool_result does not reproduce the exact bound source/render image and label blocks for this request.",
    );
  }
  let modelIdentity;
  try {
    modelIdentity = responseModelIdentity(terminal, requestedModelId);
  } catch (cause) {
    throw new ClaudeBoundVisionError(
      `Claude stream did not prove the pinned model: ${cause.message}.`,
    );
  }
  const rawResponseBytes = Buffer.from(terminal.result, "utf8");
  try {
    parseMultiPanelAnswer(rawResponseBytes);
  } catch (cause) {
    throw new ClaudeBoundVisionError(`Claude terminal answer was refused: ${cause.message}.`);
  }
  const usage = terminal.usage;
  if (typeof usage !== "object" || usage === null || Array.isArray(usage)) {
    throw new ClaudeBoundVisionError("Claude terminal result omitted its token usage object.");
  }
  const inputTokens = [
    usage.input_tokens ?? 0,
    usage.cache_creation_input_tokens ?? 0,
    usage.cache_read_input_tokens ?? 0,
  ].reduce((total, amount, index) => total + integerUsage(amount, `input token field ${index}`), 0);
  const outputTokens = integerUsage(usage.output_tokens, "output_tokens");
  if (
    typeof terminal.total_cost_usd !== "number" ||
    !Number.isFinite(terminal.total_cost_usd) ||
    terminal.total_cost_usd < 0
  ) {
    throw new ClaudeBoundVisionError(
      "Claude terminal result omitted a finite non-negative total_cost_usd.",
    );
  }
  return {
    modelIdentity,
    rawResponseBytes,
    usage: {
      inputTokens,
      outputTokens,
      costMicrousd: Math.ceil(terminal.total_cost_usd * 1_000_000),
      elapsedMs: integerUsage(elapsedMs, "measured elapsedMs"),
    },
  };
}

function transportTrace(call, stdout, stderr, exitCode, cliContract) {
  const stdoutBlob = boundBytes(stdout, "text/plain; charset=utf-8", "Claude stream-json trace");
  const stderrBytes = Buffer.from(stderr);
  return canonicalJsonBytes({
    schemaVersion: "lego.multi-panel-claude-transport/1",
    attemptId: call.attemptId,
    requestDigest: call.requestDigest,
    instructionDigest: call.request.instruction.digest,
    systemPrompt: BOUND_VISION_SYSTEM_PROMPT,
    toolName: BOUND_VISION_CLAUDE_TOOL,
    cliContract,
    exitCode,
    stdout: stdoutBlob,
    stderr: {
      byteLength: stderrBytes.length,
      digest: `sha256:${createHash("sha256").update(stderrBytes).digest("hex")}`,
    },
  });
}

function safeCleanup(root) {
  const temporaryRoot = resolve(tmpdir());
  const target = resolve(root);
  const fromTemporary = relative(temporaryRoot, target);
  if (
    !basename(target).startsWith("lego-bound-vision-") ||
    fromTemporary === "" ||
    fromTemporary === ".." ||
    fromTemporary.startsWith(`..${sep}`)
  ) {
    throw new ClaudeBoundVisionError(
      `Refusing to clean non-task temporary root ${JSON.stringify(target)}.`,
    );
  }
  rmSync(target, { recursive: true, force: true });
  if (existsSync(target)) {
    throw new ClaudeBoundVisionError(
      `Task-owned vision root ${JSON.stringify(target)} still exists after recursive cleanup.`,
    );
  }
}

function assertCallBindsRequest(call) {
  const request = verifyMultiPanelRequest(call.request);
  if (
    call.attemptId !== request.attemptId ||
    call.requestDigest !== request.requestDigest ||
    canonicalJsonBytes(call.modelIdentity).compare(
      canonicalJsonBytes(request.requestedModelIdentity),
    ) !== 0
  ) {
    throw new ClaudeBoundVisionError(
      "Adapter call attemptId, requestDigest, or modelIdentity does not reproduce its verified request.",
    );
  }
  if (
    !Buffer.from(call.instructionBytes).equals(
      verifiedBytes(request.instruction, "adapter instruction"),
    )
  ) {
    throw new ClaudeBoundVisionError(
      "Adapter instruction bytes do not reproduce the bound request.",
    );
  }
  return request;
}

/**
 * Subscription-CLI adapter with no built-in tools and one strict stdio MCP image tool.
 * Tests inject `runChild`; ordinary verification never contacts a provider.
 */
export function createClaudeBoundVisionAdapter(options = {}) {
  const runChild = options.runChild ?? runBoundedChild;
  return async (call) => {
    const request = assertCallBindsRequest(call);
    const root = mkdtempSync(join(tmpdir(), "lego-bound-vision-"));
    let failure = null;
    let result = null;
    try {
      const bundlePath = join(root, "request.json");
      const configPath = join(root, "mcp.json");
      writeFileSync(bundlePath, canonicalJsonBytes(call.request), { flag: "wx", mode: 0o600 });
      writeFileSync(
        configPath,
        canonicalJsonBytes({
          mcpServers: {
            [BOUND_VISION_MCP_SERVER]: {
              command: process.execPath,
              args: [SERVER_PATH, "--bundle", bundlePath],
            },
          },
        }),
        { flag: "wx", mode: 0o600 },
      );
      const childEnvironment = boundedClaudeEnvironment(options.environment ?? process.env);
      const cliContract = {
        builtInTools: "disabled",
        settingSources: "disabled",
        strictMcpConfig: true,
        allowedTool: BOUND_VISION_CLAUDE_TOOL,
        permissionMode: "dontAsk",
        sessionPersistence: false,
        slashCommands: false,
        chrome: false,
        outputFormat: "stream-json",
        maxTurns: 2,
        safeMode: true,
        cwd: "task-owned-temporary-root",
        environmentKeys: Object.freeze(Object.keys(childEnvironment).sort()),
      };
      const args = [
        "-p",
        fatalUtf8.decode(Buffer.from(call.instructionBytes)),
        "--model",
        call.modelIdentity.requestedModelId,
        "--tools=",
        "--allowedTools",
        BOUND_VISION_CLAUDE_TOOL,
        "--permission-mode",
        "dontAsk",
        "--setting-sources=",
        "--disable-slash-commands",
        "--no-session-persistence",
        "--no-chrome",
        "--safe-mode",
        "--system-prompt",
        BOUND_VISION_SYSTEM_PROMPT,
        "--mcp-config",
        configPath,
        "--strict-mcp-config",
        "--output-format",
        "stream-json",
        "--verbose",
        "--max-turns",
        "2",
        "--max-budget-usd",
        (request.budgets.maxCostMicrousd / 1_000_000).toFixed(6),
      ];
      const startedAt = process.hrtime.bigint();
      const traceOverheadBytes = 64 * 1024;
      const maxStdoutBytes = Math.max(
        1,
        Math.floor(((request.budgets.maxTransportTraceBytes - traceOverheadBytes) * 3) / 4),
      );
      const minimumImageResultBytes =
        canonicalJsonBytes(boundVisionEvidenceContent(request)).byteLength + 4 * 1024;
      if (maxStdoutBytes < minimumImageResultBytes) {
        throw new ClaudeBoundVisionError(
          `Bound Claude trace can retain at most ${maxStdoutBytes} stdout bytes after base64 overhead, below the ${minimumImageResultBytes}-byte minimum for this exact image result. Raise the narrowed transport budget within its hard maximum or reduce the image packet before calling a model.`,
        );
      }
      const child = await runChild(options.command ?? process.env.CLAUDE_CLI ?? "claude", args, {
        label: `Bound Claude vision call ${call.attemptId}`,
        cwd: root,
        timeoutMs: request.budgets.maxWallTimeMs,
        maxStdoutBytes,
        maxStderrBytes: MAX_CHILD_STDERR_BYTES,
        env: childEnvironment,
      });
      const elapsedMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      const stdout = Buffer.from(child.stdout, "utf8");
      const stderr = Buffer.from(child.stderr, "utf8");
      const trace = transportTrace(call, stdout, stderr, child.code, cliContract);
      if (child.code !== 0) {
        throw new ClaudeBoundVisionError(
          `Bound Claude vision call exited ${child.code}; stderr: ${child.stderr.trim() || "empty"}.`,
          trace,
        );
      }
      const parsed = parseClaudeBoundVisionStream(stdout, request, elapsedMs);
      result = { ...parsed, transportTraceBytes: trace };
    } catch (error) {
      failure = error;
    }
    let cleanupFailure = null;
    try {
      (options.cleanup ?? safeCleanup)(root);
      if (existsSync(root)) {
        throw new ClaudeBoundVisionError(
          `Task-owned vision root ${JSON.stringify(root)} still exists after cleanup returned.`,
        );
      }
    } catch (error) {
      cleanupFailure = error;
      try {
        safeCleanup(root);
      } catch (fallbackError) {
        cleanupFailure = new AggregateError(
          [cleanupFailure, fallbackError],
          `Primary and fallback cleanup both failed for exact task root ${JSON.stringify(root)}.`,
        );
      }
    }
    if (failure !== null && cleanupFailure !== null) {
      const combined = new ClaudeBoundVisionError(
        `Bound Claude vision call failed and its exact task-root cleanup also failed. Primary: ${failure.message} Cleanup: ${cleanupFailure.message}`,
        failure.transportTraceBytes ?? null,
      );
      combined.cause = new AggregateError([failure, cleanupFailure]);
      throw combined;
    }
    if (failure !== null) throw failure;
    if (cleanupFailure !== null) throw cleanupFailure;
    return result;
  };
}

export function readTransportTraceBytes(attempt) {
  return verifiedBytes(attempt.response.transportTrace, "retained Claude transport trace");
}
