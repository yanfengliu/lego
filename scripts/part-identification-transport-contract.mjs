import { createHash } from "node:crypto";

import { exactOwnKeys } from "./part-identification-safe-shape.mjs";

const stringify = JSON.stringify;

export const PART_IDENTIFICATION_MCP_SERVER = "bound_part_identification";
export const PART_IDENTIFICATION_MCP_TOOL = "get_bound_identification_cards";
export const PART_IDENTIFICATION_CLAUDE_TOOL = `mcp__${PART_IDENTIFICATION_MCP_SERVER}__${PART_IDENTIFICATION_MCP_TOOL}`;

export const PART_IDENTIFICATION_SYSTEM_PROMPT =
  "You are a closed part-identification rater. Call the one supplied MCP image tool exactly once, use only its ordered labeled cards, and return only the requested card-tagged JSON lines. You have no filesystem, shell, web, memory, skill, session, configuration, or document authority.";

export const PART_IDENTIFICATION_PROOF_SCHEMA = "lego.part-identification-sanitized-call-proof/1";
export const PART_IDENTIFICATION_MAX_BATCH_CARDS = 6;
export const PART_IDENTIFICATION_MAX_CARD_BYTES_PER_CALL = 12 * 1024 * 1024;
export const PART_IDENTIFICATION_MAX_STDOUT_BYTES = 24 * 1024 * 1024;
export const PART_IDENTIFICATION_MAX_STDERR_BYTES = 256 * 1024;
export const PART_IDENTIFICATION_MAX_PROOF_BYTES = 24 * 1024 * 1024;
export const PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES = 96 * 1024 * 1024;
export const PART_IDENTIFICATION_MAX_CALLS = 96;
export const PART_IDENTIFICATION_MAX_ATTEMPTS = 576;
export const PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD = 2;
export const PART_IDENTIFICATION_MAX_EVENTS = 64;
export const PART_IDENTIFICATION_MAX_RESULT_BYTES = 16 * 1024;
export const PART_IDENTIFICATION_MAX_COST_MICROUSD = 2_000_000;
export const PART_IDENTIFICATION_MAX_WALL_TIME_MS = 5 * 60 * 1_000;
export const PART_IDENTIFICATION_CLAUDE_CLI_VERSION = "2.1.232 (Claude Code)";
export const PART_IDENTIFICATION_CLAUDE_BINARY_BYTES = 319_026_336;
export const PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST =
  "sha256:ec9e32479bc887809003c91384c6c3a26e7691856d1916f72f6f6d21800f3bd6";
export const PART_IDENTIFICATION_ENV_ALLOWLIST = Object.freeze([
  "APPDATA",
  "ComSpec",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
]);
const ENV_ALLOWLIST_DIGEST = `sha256:${createHash("sha256")
  .update(stringify(PART_IDENTIFICATION_ENV_ALLOWLIST))
  .digest("hex")}`;

export const PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST = Object.freeze(
  (() => {
    const held = [];
    for (let index = 0; index < PART_IDENTIFICATION_ENV_ALLOWLIST.length; index += 1) {
      const key = PART_IDENTIFICATION_ENV_ALLOWLIST[index];
      if (key !== "PATH" && key !== "PATHEXT" && key !== "SHELL" && key !== "ComSpec") {
        held.push(key);
      }
    }
    held.push("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC");
    return held;
  })(),
);

export const PART_IDENTIFICATION_TRANSPORT_CONTRACT = Object.freeze({
  schemaVersion: "lego.part-identification-claude-mcp-transport/1",
  imageTransport: "one-shot-bound-mcp-content",
  builtInTools: "disabled",
  allowedTool: PART_IDENTIFICATION_CLAUDE_TOOL,
  settingSources: "disabled",
  permissionMode: "dontAsk",
  sessionPersistence: false,
  slashCommands: false,
  chrome: false,
  safeMode: true,
  strictMcpConfig: true,
  cwd: "task-owned-temporary-root",
  environmentPolicy: "bounded-allowlist/1",
  environmentAllowlistDigest: ENV_ALLOWLIST_DIGEST,
  writeBoundary: "one-model-tool/no-model-write+exact-final-task-root",
  maxTurns: 2,
  outputFormat: "stream-json",
  proofSchema: PART_IDENTIFICATION_PROOF_SCHEMA,
  evidenceLevel: "local-diagnostic/sanitized-downstream",
  providerExecutionAuthenticated: false,
  executableReplay: false,
  parserContract: "bounded-strict-json-lines+one-exact-tool-result/2",
  systemPrompt: PART_IDENTIFICATION_SYSTEM_PROMPT,
  maxBatchCards: PART_IDENTIFICATION_MAX_BATCH_CARDS,
  maxCardBytesPerCall: PART_IDENTIFICATION_MAX_CARD_BYTES_PER_CALL,
  maxStdoutBytes: PART_IDENTIFICATION_MAX_STDOUT_BYTES,
  maxStderrBytes: PART_IDENTIFICATION_MAX_STDERR_BYTES,
  maxProofBytes: PART_IDENTIFICATION_MAX_PROOF_BYTES,
  maxAggregateProofBytes: PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES,
  maxCalls: PART_IDENTIFICATION_MAX_CALLS,
  maxAttempts: PART_IDENTIFICATION_MAX_ATTEMPTS,
  maxAttemptsPerCard: PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD,
  maxEvents: PART_IDENTIFICATION_MAX_EVENTS,
  maxResultBytes: PART_IDENTIFICATION_MAX_RESULT_BYTES,
  maxCostMicrousd: PART_IDENTIFICATION_MAX_COST_MICROUSD,
  maxWallTimeMs: PART_IDENTIFICATION_MAX_WALL_TIME_MS,
  claudeCliVersion: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  claudeBinaryByteLength: PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  claudeBinaryDigest: PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
});

const CONTRACT_JSON = stringify(PART_IDENTIFICATION_TRANSPORT_CONTRACT);
export const PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST = `sha256:${createHash("sha256").update(CONTRACT_JSON).digest("hex")}`;

const CONTRACT_KEYS = Object.freeze([
  "schemaVersion",
  "imageTransport",
  "builtInTools",
  "allowedTool",
  "settingSources",
  "permissionMode",
  "sessionPersistence",
  "slashCommands",
  "chrome",
  "safeMode",
  "strictMcpConfig",
  "cwd",
  "environmentPolicy",
  "environmentAllowlistDigest",
  "writeBoundary",
  "maxTurns",
  "outputFormat",
  "proofSchema",
  "evidenceLevel",
  "providerExecutionAuthenticated",
  "executableReplay",
  "parserContract",
  "systemPrompt",
  "maxBatchCards",
  "maxCardBytesPerCall",
  "maxStdoutBytes",
  "maxStderrBytes",
  "maxProofBytes",
  "maxAggregateProofBytes",
  "maxCalls",
  "maxAttempts",
  "maxAttemptsPerCard",
  "maxEvents",
  "maxResultBytes",
  "maxCostMicrousd",
  "maxWallTimeMs",
  "claudeCliVersion",
  "claudeBinaryByteLength",
  "claudeBinaryDigest",
]);

export function assertPartIdentificationTransportContract(value, label = "transportContract") {
  if (typeof value !== "object" || value === null || !exactOwnKeys(value, CONTRACT_KEYS)) {
    throw new Error(
      `${label} must exactly reproduce ${PART_IDENTIFICATION_TRANSPORT_CONTRACT.schemaVersion}; legacy local-path Read answers cannot resume inside the strict MCP transport generation.`,
    );
  }
  for (let index = 0; index < CONTRACT_KEYS.length; index += 1) {
    const key = CONTRACT_KEYS[index];
    if (value[key] !== PART_IDENTIFICATION_TRANSPORT_CONTRACT[key]) {
      throw new Error(
        `${label} must exactly reproduce ${PART_IDENTIFICATION_TRANSPORT_CONTRACT.schemaVersion}; legacy local-path Read answers cannot resume inside the strict MCP transport generation.`,
      );
    }
  }
  return value;
}
