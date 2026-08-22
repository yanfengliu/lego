import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import { PartIdentificationClaudeTransportError } from "./part-identification-claude-error.mjs";
import {
  partIdentificationEvidenceContent,
  verifyPartIdentificationMcpRequest,
} from "./part-identification-mcp-server.mjs";
import { responseModelIdentity } from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { exactOwnKeys, isArray, isOrdinaryObject, own } from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_MAX_COST_MICROUSD,
  PART_IDENTIFICATION_MAX_EVENTS,
  PART_IDENTIFICATION_MAX_RESULT_BYTES,
  PART_IDENTIFICATION_MAX_STDOUT_BYTES,
  PART_IDENTIFICATION_MCP_SERVER,
  PART_IDENTIFICATION_PROOF_SCHEMA,
} from "./part-identification-transport-contract.mjs";

const fatalUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const stringify = JSON.stringify;
const stringCharCodeAt = Function.call.bind(String.prototype.charCodeAt);
const stringSlice = Function.call.bind(String.prototype.slice);
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function exactContent(observed, expected) {
  if (!isArray(observed) || observed.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const actual = observed[index];
    const wanted = expected[index];
    if (wanted.type === "text") {
      if (
        !exactOwnKeys(actual, ["type", "text"]) ||
        actual.type !== "text" ||
        actual.text !== wanted.text
      ) {
        return false;
      }
    } else if (
      !exactOwnKeys(actual, ["type", "data", "mimeType"]) ||
      actual.type !== "image" ||
      actual.mimeType !== "image/png" ||
      actual.data !== wanted.data
    ) {
      return false;
    }
  }
  return true;
}

function whole(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PartIdentificationClaudeTransportError(
      `Claude terminal ${label} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function usageEvidence(terminal) {
  const usage = terminal.usage;
  if (!isOrdinaryObject(usage)) {
    throw new PartIdentificationClaudeTransportError("Claude terminal omitted its usage object.");
  }
  for (const key of [
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "output_tokens",
  ]) {
    if (!own(usage, key)) {
      throw new PartIdentificationClaudeTransportError(
        `Claude terminal usage omitted required ${key}; aggregate accounting cannot infer zero.`,
      );
    }
  }
  const inputTokens =
    whole(usage.input_tokens, "input_tokens") +
    whole(usage.cache_creation_input_tokens, "cache_creation_input_tokens") +
    whole(usage.cache_read_input_tokens, "cache_read_input_tokens");
  const outputTokens = whole(usage.output_tokens, "output_tokens");
  if (
    typeof terminal.total_cost_usd !== "number" ||
    !Number.isFinite(terminal.total_cost_usd) ||
    terminal.total_cost_usd < 0
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude terminal omitted a finite non-negative total_cost_usd.",
    );
  }
  const costMicrousd = Math.ceil(terminal.total_cost_usd * 1_000_000);
  if (costMicrousd > PART_IDENTIFICATION_MAX_COST_MICROUSD) {
    throw new PartIdentificationClaudeTransportError(
      `Claude terminal cost ${costMicrousd} microusd exceeds ${PART_IDENTIFICATION_MAX_COST_MICROUSD}.`,
    );
  }
  return { inputTokens, outputTokens, costMicrousd };
}

function parseEvents(raw) {
  let text;
  try {
    text = fatalUtf8.decode(raw);
  } catch (cause) {
    throw new PartIdentificationClaudeTransportError(
      `Claude stream is not exact UTF-8: ${cause.message}.`,
    );
  }
  const events = [];
  let lineStart = 0;
  let lineNumber = 1;
  for (let cursor = 0; cursor <= text.length; cursor += 1) {
    if (cursor < text.length && stringCharCodeAt(text, cursor) !== 0x0a) continue;
    let hasJson = false;
    for (let index = lineStart; index < cursor; index += 1) {
      const code = stringCharCodeAt(text, index);
      if (code !== 0x20 && code !== 0x09 && code !== 0x0d) {
        hasJson = true;
        break;
      }
    }
    if (!hasJson) {
      lineStart = cursor + 1;
      lineNumber += 1;
      continue;
    }
    if (events.length >= PART_IDENTIFICATION_MAX_EVENTS) {
      throw new PartIdentificationClaudeTransportError(
        `Claude stream contains more than ${PART_IDENTIFICATION_MAX_EVENTS} events.`,
      );
    }
    try {
      events[events.length] = parseStrictJsonBytes(
        Buffer.from(stringSlice(text, lineStart, cursor), "utf8"),
      );
    } catch (cause) {
      throw new PartIdentificationClaudeTransportError(
        `Claude stream line ${lineNumber} is not strict JSON: ${cause.message}.`,
      );
    }
    lineStart = cursor + 1;
    lineNumber += 1;
  }
  return events;
}

function assertSystemInit(event, request, expectedTaskRoot) {
  if (!isOrdinaryObject(event) || event.type !== "system" || event.subtype !== "init") {
    throw new PartIdentificationClaudeTransportError("Claude system event must be one init event.");
  }
  if (
    typeof expectedTaskRoot !== "string" ||
    expectedTaskRoot.length < 1 ||
    event.cwd !== expectedTaskRoot ||
    event.model !== request.model ||
    event.permissionMode !== "dontAsk" ||
    event.claude_code_version !== PART_IDENTIFICATION_CLAUDE_CLI_VERSION
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude init did not reproduce the exact task root, pinned model, dontAsk mode, and CLI version.",
    );
  }
  const customizationKeys = ["plugins", "skills", "slash_commands", "agents", "hooks", "commands"];
  for (let index = 0; index < customizationKeys.length; index += 1) {
    const key = customizationKeys[index];
    if (own(event, key) && (!isArray(event[key]) || event[key].length !== 0)) {
      throw new PartIdentificationClaudeTransportError(
        `Claude system init exposed non-empty ${key}; customizations are disabled for this transport.`,
      );
    }
  }
  if (
    !isArray(event.tools) ||
    event.tools.length !== 1 ||
    event.tools[0] !== PART_IDENTIFICATION_CLAUDE_TOOL
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude system init did not expose exactly the one bound MCP tool.",
    );
  }
  if (!isArray(event.mcp_servers) || event.mcp_servers.length !== 1) {
    throw new PartIdentificationClaudeTransportError(
      "Claude system init did not expose one MCP server.",
    );
  }
  const server = event.mcp_servers[0];
  if (
    !isOrdinaryObject(server) ||
    server.name !== PART_IDENTIFICATION_MCP_SERVER ||
    server.status !== "connected"
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude system init exposed an unexpected or disconnected MCP server.",
    );
  }
  return {
    type: "system",
    subtype: "init",
    cwdRole: "task-owned-temporary-root",
    model: request.model,
    permissionMode: "dontAsk",
    claudeCodeVersion: PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
    tools: [PART_IDENTIFICATION_CLAUDE_TOOL],
    mcpServers: [{ name: PART_IDENTIFICATION_MCP_SERVER, status: "connected" }],
  };
}

function messageContent(event, type) {
  if (!isOrdinaryObject(event) || event.type !== type || !isOrdinaryObject(event.message)) {
    throw new PartIdentificationClaudeTransportError(`Claude expected one ${type} message event.`);
  }
  if (own(event.message, "role") && event.message.role !== type) {
    throw new PartIdentificationClaudeTransportError(
      `Claude ${type} message carries the wrong role.`,
    );
  }
  if (!isArray(event.message.content) || event.message.content.length !== 1) {
    throw new PartIdentificationClaudeTransportError(
      `Claude ${type} message must contain exactly one modeled content block.`,
    );
  }
  return event.message.content[0];
}

function orderedCards(request) {
  const held = new Array(request.cards.length);
  for (let index = 0; index < request.cards.length; index += 1) {
    const card = request.cards[index];
    held[index] = { cardId: card.cardId, byteLength: card.byteLength, digest: card.digest };
  }
  return held;
}

/** Exact structural stream replay retaining no raw session/config metadata. */
export function parsePartIdentificationClaudeStream(traceBytes, requestInput, expectedTaskRoot) {
  const request = verifyPartIdentificationMcpRequest(requestInput);
  const raw = Buffer.from(traceBytes);
  if (raw.length < 1 || raw.length > PART_IDENTIFICATION_MAX_STDOUT_BYTES) {
    throw new PartIdentificationClaudeTransportError(
      `Claude stream uses ${raw.length} bytes outside 1..${PART_IDENTIFICATION_MAX_STDOUT_BYTES}.`,
    );
  }
  const events = parseEvents(raw);
  const skeleton = [];
  if (events.length !== 5) {
    throw new PartIdentificationClaudeTransportError(
      "Claude stream must contain exactly init, tool-use, tool-result, final-text, and terminal events.",
    );
  }
  skeleton[skeleton.length] = assertSystemInit(events[0], request, expectedTaskRoot);
  const offset = 1;
  const toolUse = messageContent(events[offset], "assistant");
  if (
    !exactOwnKeys(toolUse, ["type", "id", "name", "input"]) ||
    toolUse.type !== "tool_use" ||
    toolUse.name !== PART_IDENTIFICATION_CLAUDE_TOOL ||
    typeof toolUse.id !== "string" ||
    toolUse.id.length < 1 ||
    toolUse.id.length > 256 ||
    !exactOwnKeys(toolUse.input, [])
  ) {
    throw new PartIdentificationClaudeTransportError(
      `Claude must call exactly ${PART_IDENTIFICATION_CLAUDE_TOOL} once with exact empty input.`,
    );
  }
  const toolIdDigest = sha256(Buffer.from(toolUse.id, "utf8"));
  skeleton[skeleton.length] = {
    type: "assistant",
    contentType: "tool_use",
    toolName: toolUse.name,
    toolIdDigest,
  };
  const toolResult = messageContent(events[offset + 1], "user");
  const expectedContent = partIdentificationEvidenceContent(request);
  if (
    !exactOwnKeys(toolResult, ["type", "tool_use_id", "is_error", "content"]) ||
    toolResult.type !== "tool_result" ||
    toolResult.tool_use_id !== toolUse.id ||
    toolResult.is_error !== false ||
    !exactContent(toolResult.content, expectedContent)
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude tool result must link to the one call and reproduce the exact ordered labels and image bytes.",
    );
  }
  const contentDigest = sha256(Buffer.from(stringify(expectedContent), "utf8"));
  skeleton[skeleton.length] = {
    type: "user",
    contentType: "tool_result",
    toolIdDigest,
    isError: false,
    contentDigest,
  };
  const finalText = messageContent(events[offset + 2], "assistant");
  if (
    !exactOwnKeys(finalText, ["type", "text"]) ||
    finalText.type !== "text" ||
    typeof finalText.text !== "string"
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude final assistant event must contain exactly one modeled text block.",
    );
  }
  const terminal = events[offset + 3];
  if (
    !isOrdinaryObject(terminal) ||
    terminal.type !== "result" ||
    terminal.subtype !== "success" ||
    terminal.is_error !== false ||
    terminal.result !== finalText.text
  ) {
    throw new PartIdentificationClaudeTransportError(
      "Claude terminal must be the final success event and exactly repeat the final assistant text.",
    );
  }
  const modelIdentity = responseModelIdentity(terminal, request.model);
  const resultBytes = Buffer.from(terminal.result, "utf8");
  if (resultBytes.length < 1 || resultBytes.length > PART_IDENTIFICATION_MAX_RESULT_BYTES) {
    throw new PartIdentificationClaudeTransportError(
      `Claude terminal result uses ${resultBytes.length} bytes outside 1..${PART_IDENTIFICATION_MAX_RESULT_BYTES}.`,
    );
  }
  const resultDigest = sha256(resultBytes);
  skeleton[skeleton.length] = {
    type: "assistant",
    contentType: "text",
    textDigest: resultDigest,
    byteLength: resultBytes.length,
  };
  skeleton[skeleton.length] = { type: "result", subtype: "success", isError: false, resultDigest };
  return {
    terminalResult: terminal.result,
    modelIdentity,
    proof: {
      schemaVersion: PART_IDENTIFICATION_PROOF_SCHEMA,
      request: {
        requestDigest: request.requestDigest,
        modelIdentity,
        cardsDigest: request.cardsDigest,
        promptDigest: request.promptDigest,
        instruction: request.instruction,
        orderedCards: orderedCards(request),
      },
      rawStream: {
        digest: sha256(raw),
        byteLength: raw.length,
        eventCount: events.length,
        replayLevel: "sanitized-downstream",
        events: skeleton,
      },
      tool: {
        name: PART_IDENTIFICATION_CLAUDE_TOOL,
        input: {},
        callEventIndex: offset,
        resultEventIndex: offset + 1,
        content: expectedContent,
      },
      terminal: {
        eventIndex: offset + 3,
        modelIdentity,
        result: terminal.result,
        resultDigest,
        usage: usageEvidence(terminal),
      },
    },
  };
}
