import {
  callProofJsonBytes as proofBytes,
  callProofSha256 as sha256,
} from "./part-identification-call-proof-digest.mjs";
import { partIdentificationEvidenceContent } from "./part-identification-mcp-server.mjs";
import {
  exactOwnKeys,
  isArray,
  isOrdinaryObject,
  ownKeys,
  sameOrderedStrings,
} from "./part-identification-safe-shape.mjs";
import {
  assertPartIdentificationTransportContract,
  PART_IDENTIFICATION_CLAUDE_BINARY_BYTES,
  PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST,
  PART_IDENTIFICATION_CLAUDE_CLI_VERSION,
  PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT,
} from "./part-identification-transport-contract.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;

export class PartIdentificationCallProofError extends Error {
  constructor(message) {
    super(message);
    this.name = "PartIdentificationCallProofError";
  }
}

export function exactProofKeys(value, keys, label) {
  if (!exactOwnKeys(value, keys)) {
    const actual = ownKeys(value);
    throw new PartIdentificationCallProofError(
      `${label} does not carry its exact required fields; received ${actual.length} own string keys.`,
    );
  }
}

export function proofDigest(value, label) {
  if (!SHA256.test(value ?? "")) {
    throw new PartIdentificationCallProofError(`${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

export function expectedPartIdentificationCliArgv(request) {
  return [
    "-p",
    `<instruction:${request.instruction.digest}>`,
    "--model",
    request.modelIdentity.requestedModelId,
    "--tools=",
    "--allowedTools",
    PART_IDENTIFICATION_TRANSPORT_CONTRACT.allowedTool,
    "--permission-mode",
    "dontAsk",
    "--setting-sources=",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--no-chrome",
    "--safe-mode",
    "--system-prompt",
    PART_IDENTIFICATION_TRANSPORT_CONTRACT.systemPrompt,
    "--mcp-config",
    "<TASK_ROOT>/mcp.json",
    "--strict-mcp-config",
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-turns",
    "2",
    "--max-budget-usd",
    (PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxCostMicrousd / 1_000_000).toFixed(6),
  ];
}

export function verifyCliEvidence(cliContract, request) {
  if (!isOrdinaryObject(cliContract)) {
    throw new PartIdentificationCallProofError("Call proof cliContract must be an exact object.");
  }
  const { environmentKeys, binary, argv, argvDigest, ...contract } = cliContract;
  assertPartIdentificationTransportContract(contract, "call proof cliContract");
  if (!isArray(environmentKeys)) {
    throw new PartIdentificationCallProofError(
      "Call proof environmentKeys must be a sorted unique array from the fixed provider allowlist.",
    );
  }
  let forced = false;
  for (let index = 0; index < environmentKeys.length; index += 1) {
    const key = environmentKeys[index];
    let allowed = false;
    for (
      let allowIndex = 0;
      allowIndex < PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST.length;
      allowIndex += 1
    ) {
      if (key === PART_IDENTIFICATION_PROVIDER_ENV_ALLOWLIST[allowIndex]) allowed = true;
    }
    if (typeof key !== "string" || !allowed || (index > 0 && environmentKeys[index - 1] >= key)) {
      throw new PartIdentificationCallProofError(
        "Call proof environmentKeys must be sorted, unique, and drawn only from the fixed provider allowlist.",
      );
    }
    if (key === "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC") forced = true;
  }
  if (!forced) {
    throw new PartIdentificationCallProofError(
      "Call proof environmentKeys omit the forced nonessential-traffic disable key.",
    );
  }
  exactProofKeys(binary, ["version", "byteLength", "digest"], "call proof Claude binary");
  if (
    binary.version !== PART_IDENTIFICATION_CLAUDE_CLI_VERSION ||
    binary.byteLength !== PART_IDENTIFICATION_CLAUDE_BINARY_BYTES ||
    binary.digest !== PART_IDENTIFICATION_CLAUDE_BINARY_DIGEST
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof Claude binary evidence does not reproduce the pinned version, byte length, and digest.",
    );
  }
  const expectedArgv = expectedPartIdentificationCliArgv(request);
  if (
    !sameOrderedStrings(argv, expectedArgv) ||
    proofDigest(argvDigest, "call proof argvDigest") !== sha256(proofBytes(expectedArgv))
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof argv must exactly reproduce the normalized strict MCP invocation and digest.",
    );
  }
}

export function verifyExactToolContent(expected, observed) {
  if (!isArray(observed) || observed.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = observed[index];
    if (left.type === "text") {
      if (
        !exactOwnKeys(right, ["type", "text"]) ||
        right.type !== "text" ||
        right.text !== left.text
      ) {
        return false;
      }
    } else if (
      !exactOwnKeys(right, ["type", "data", "mimeType"]) ||
      right.type !== "image" ||
      right.data !== left.data ||
      right.mimeType !== "image/png"
    ) {
      return false;
    }
  }
  return true;
}

export function verifySanitizedEventSkeleton(rawStream, tool, terminal, request) {
  const events = rawStream.events;
  if (!isArray(events) || events.length !== rawStream.eventCount) {
    throw new PartIdentificationCallProofError(
      "Call proof rawStream events must be the exact bounded sanitized skeleton.",
    );
  }
  if (events.length !== 5) {
    throw new PartIdentificationCallProofError(
      "Sanitized event skeleton must contain init, one tool use/result, final text, and terminal result.",
    );
  }
  exactProofKeys(
    events[0],
    [
      "type",
      "subtype",
      "cwdRole",
      "model",
      "permissionMode",
      "claudeCodeVersion",
      "tools",
      "mcpServers",
    ],
    "sanitized system event",
  );
  if (
    events[0].type !== "system" ||
    events[0].subtype !== "init" ||
    events[0].cwdRole !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.cwd ||
    events[0].model !== request.model ||
    events[0].permissionMode !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.permissionMode ||
    events[0].claudeCodeVersion !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.claudeCliVersion ||
    !sameOrderedStrings(events[0].tools, [PART_IDENTIFICATION_TRANSPORT_CONTRACT.allowedTool]) ||
    !isArray(events[0].mcpServers) ||
    events[0].mcpServers.length !== 1 ||
    !exactOwnKeys(events[0].mcpServers[0], ["name", "status"]) ||
    events[0].mcpServers[0].name !== "bound_part_identification" ||
    events[0].mcpServers[0].status !== "connected"
  ) {
    throw new PartIdentificationCallProofError(
      "Sanitized system event does not prove the one exact bound MCP capability.",
    );
  }
  const call = events[1];
  const result = events[2];
  const text = events[3];
  const last = events[4];
  exactProofKeys(
    call,
    ["type", "contentType", "toolName", "toolIdDigest"],
    "sanitized tool-use event",
  );
  exactProofKeys(
    result,
    ["type", "contentType", "toolIdDigest", "isError", "contentDigest"],
    "sanitized tool-result event",
  );
  exactProofKeys(text, ["type", "contentType", "textDigest", "byteLength"], "sanitized text event");
  exactProofKeys(last, ["type", "subtype", "isError", "resultDigest"], "sanitized result event");
  const expectedContentDigest = sha256(proofBytes(partIdentificationEvidenceContent(request)));
  if (
    call.type !== "assistant" ||
    call.contentType !== "tool_use" ||
    call.toolName !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.allowedTool ||
    !SHA256.test(call.toolIdDigest ?? "") ||
    result.type !== "user" ||
    result.contentType !== "tool_result" ||
    result.toolIdDigest !== call.toolIdDigest ||
    result.isError !== false ||
    result.contentDigest !== expectedContentDigest ||
    text.type !== "assistant" ||
    text.contentType !== "text" ||
    text.textDigest !== terminal.resultDigest ||
    text.byteLength !== Buffer.byteLength(terminal.result, "utf8") ||
    last.type !== "result" ||
    last.subtype !== "success" ||
    last.isError !== false ||
    last.resultDigest !== terminal.resultDigest ||
    tool.callEventIndex !== 1 ||
    tool.resultEventIndex !== 2 ||
    terminal.eventIndex !== 4
  ) {
    throw new PartIdentificationCallProofError(
      "Sanitized event skeleton does not replay the one linked tool boundary and final result.",
    );
  }
}
