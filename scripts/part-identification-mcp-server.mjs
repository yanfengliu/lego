import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { MAX_IMAGE_ARTIFACT_BYTES, readBoundedFile } from "./part-identification-io.mjs";
import { requirePinnedPartIdentificationModel } from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { exactOwnKeys, isArray, own, ownKeys } from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_MAX_BATCH_CARDS,
  PART_IDENTIFICATION_MAX_CARD_BYTES_PER_CALL,
  PART_IDENTIFICATION_MCP_SERVER,
  PART_IDENTIFICATION_MCP_TOOL,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

export const PART_IDENTIFICATION_MCP_SCHEMA = "lego.part-identification-mcp-request/1";
export {
  PART_IDENTIFICATION_CLAUDE_TOOL,
  PART_IDENTIFICATION_MCP_SERVER,
  PART_IDENTIFICATION_MCP_TOOL,
};
export const MAX_PART_IDENTIFICATION_MCP_MESSAGES = 64;
export const MAX_PART_IDENTIFICATION_MCP_LINE_BYTES = 256 * 1024;
export const MAX_PART_IDENTIFICATION_REQUEST_BYTES = 24 * 1024 * 1024;
export const MAX_PART_IDENTIFICATION_INSTRUCTION_BYTES = 512 * 1024;

const MAX_STDIN_BYTES =
  MAX_PART_IDENTIFICATION_MCP_MESSAGES * MAX_PART_IDENTIFICATION_MCP_LINE_BYTES;
const CARD_ID = /^card-\d{4}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const bufferFrom = Buffer.from;
const bufferToString = Function.call.bind(Buffer.prototype.toString);
const bufferSubarray = Function.call.bind(Buffer.prototype.subarray);
const bufferEquals = Function.call.bind(Buffer.prototype.equals);
const PNG_SIGNATURE = bufferFrom("89504e470d0a1a0a", "hex");
const stringify = JSON.stringify;
const arrayJoin = Function.call.bind(Array.prototype.join);
const stringSlice = Function.call.bind(String.prototype.slice);
const hashPrototype = Object.getPrototypeOf(createHash("sha256"));
const hashUpdate = Function.call.bind(hashPrototype.update);
const hashDigest = Function.call.bind(hashPrototype.digest);
const NativeMap = Map;
const mapGet = Function.call.bind(Map.prototype.get);

const sha256 = (bytes) => {
  const hash = createHash("sha256");
  hashUpdate(hash, bytes);
  return `sha256:${hashDigest(hash, "hex")}`;
};
const encodedString = (value) => stringify(value);
const encodedInteger = (value) => stringify(value);

function instructionJson(value) {
  return `{"byteLength":${encodedInteger(value.byteLength)},"digest":${encodedString(value.digest)}}`;
}

function cardJson(value) {
  return (
    `{"cardId":${encodedString(value.cardId)},"byteLength":${encodedInteger(value.byteLength)},` +
    `"digest":${encodedString(value.digest)},"base64":${encodedString(value.base64)}}`
  );
}

function orderedCardsJson(cards) {
  const held = new Array(cards.length);
  for (let index = 0; index < cards.length; index += 1) held[index] = cardJson(cards[index]);
  return `[${arrayJoin(held, ",")}]`;
}

function requestCoreJson(request) {
  return (
    `{"schemaVersion":${encodedString(request.schemaVersion)},"model":${encodedString(request.model)},` +
    `"cardsDigest":${encodedString(request.cardsDigest)},"promptDigest":${encodedString(request.promptDigest)},` +
    `"transportContractDigest":${encodedString(request.transportContractDigest)},` +
    `"instruction":${instructionJson(request.instruction)},"cards":${orderedCardsJson(request.cards)}}`
  );
}

function requestArtifactJson(request) {
  const core = requestCoreJson(request);
  return `${stringSlice(core, 0, -1)},"requestDigest":${encodedString(request.requestDigest)}}`;
}

const requestCoreBytes = (value) => bufferFrom(requestCoreJson(value), "utf8");
const requestArtifactBytes = (value) => bufferFrom(requestArtifactJson(value), "utf8");

function duplicateStringBefore(values, index) {
  for (let prior = 0; prior < index; prior += 1) {
    if (values[prior]?.cardId === values[index]?.cardId) return true;
  }
  return false;
}

function duplicateCardIdBefore(cardIds, index) {
  for (let prior = 0; prior < index; prior += 1) {
    if (cardIds[prior] === cardIds[index]) return true;
  }
  return false;
}

export class PartIdentificationMcpError extends Error {
  constructor(message) {
    super(message);
    this.name = "PartIdentificationMcpError";
  }
}

function exactKeys(value, expected, label) {
  if (!exactOwnKeys(value, expected)) {
    const observed = ownKeys(value);
    throw new PartIdentificationMcpError(
      `${label} does not carry its exact required fields; received ${observed.length} own string keys.`,
    );
  }
}

function verifiedBase64(value, byteLength, digest, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 12 * 1024 * 1024) {
    throw new PartIdentificationMcpError(`${label} base64 is missing or exceeds its bound.`);
  }
  const bytes = bufferFrom(value, "base64");
  if (
    bufferToString(bytes, "base64") !== value ||
    !Number.isSafeInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > MAX_IMAGE_ARTIFACT_BYTES ||
    bytes.length !== byteLength ||
    !SHA256.test(digest ?? "") ||
    sha256(bytes) !== digest
  ) {
    throw new PartIdentificationMcpError(
      `${label} base64, byteLength, and SHA-256 digest do not describe the same bounded bytes.`,
    );
  }
  if (
    bytes.length < PNG_SIGNATURE.length ||
    !bufferEquals(bufferSubarray(bytes, 0, 8), PNG_SIGNATURE)
  ) {
    throw new PartIdentificationMcpError(`${label} is not a PNG byte stream.`);
  }
  return bytes;
}

function requestCore(request) {
  const cards = new Array(request.cards.length);
  for (let index = 0; index < request.cards.length; index += 1) {
    const card = request.cards[index];
    cards[index] = {
      cardId: card.cardId,
      byteLength: card.byteLength,
      digest: card.digest,
      base64: card.base64,
    };
  }
  return {
    schemaVersion: request.schemaVersion,
    model: request.model,
    cardsDigest: request.cardsDigest,
    promptDigest: request.promptDigest,
    transportContractDigest: request.transportContractDigest,
    instruction: request.instruction,
    cards,
  };
}

export function verifyPartIdentificationMcpRequest(value) {
  exactKeys(
    value,
    [
      "schemaVersion",
      "model",
      "cardsDigest",
      "promptDigest",
      "transportContractDigest",
      "instruction",
      "cards",
      "requestDigest",
    ],
    "Part-identification MCP request",
  );
  if (value.schemaVersion !== PART_IDENTIFICATION_MCP_SCHEMA) {
    throw new PartIdentificationMcpError(
      `Part-identification MCP request requires ${PART_IDENTIFICATION_MCP_SCHEMA}; received ${JSON.stringify(value.schemaVersion)}.`,
    );
  }
  requirePinnedPartIdentificationModel(value.model);
  for (const [field, expected] of [
    ["cardsDigest", null],
    ["promptDigest", null],
    ["transportContractDigest", PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST],
  ]) {
    if (!SHA256.test(value[field] ?? "") || (expected !== null && value[field] !== expected)) {
      throw new PartIdentificationMcpError(
        `Part-identification MCP ${field} must ${expected === null ? "be a lowercase SHA-256 digest" : `equal ${expected}`}; received ${JSON.stringify(value[field])}.`,
      );
    }
  }
  exactKeys(value.instruction, ["byteLength", "digest"], "MCP instruction binding");
  if (
    !Number.isSafeInteger(value.instruction.byteLength) ||
    value.instruction.byteLength < 1 ||
    value.instruction.byteLength > MAX_PART_IDENTIFICATION_INSTRUCTION_BYTES ||
    !SHA256.test(value.instruction.digest ?? "")
  ) {
    throw new PartIdentificationMcpError(
      "MCP instruction binding must carry a positive bounded byteLength and SHA-256 digest.",
    );
  }
  if (
    !isArray(value.cards) ||
    value.cards.length < 1 ||
    value.cards.length > PART_IDENTIFICATION_MAX_BATCH_CARDS
  ) {
    throw new PartIdentificationMcpError(
      `Part-identification MCP request requires 1 through ${PART_IDENTIFICATION_MAX_BATCH_CARDS} cards; received ${isArray(value.cards) ? value.cards.length : typeof value.cards}.`,
    );
  }
  let aggregateCardBytes = 0;
  for (let index = 0; index < value.cards.length; index += 1) {
    const card = value.cards[index];
    exactKeys(card, ["cardId", "byteLength", "digest", "base64"], `MCP card ${index}`);
    if (!CARD_ID.test(card.cardId) || duplicateStringBefore(value.cards, index)) {
      throw new PartIdentificationMcpError(
        `MCP card ${index} must have a unique canonical card-NNNN id; received ${JSON.stringify(card.cardId)}.`,
      );
    }
    verifiedBase64(card.base64, card.byteLength, card.digest, `MCP card ${card.cardId}`);
    aggregateCardBytes += card.byteLength;
    if (aggregateCardBytes > PART_IDENTIFICATION_MAX_CARD_BYTES_PER_CALL) {
      throw new PartIdentificationMcpError(
        `Part-identification MCP cards use ${aggregateCardBytes} bytes above the ${PART_IDENTIFICATION_MAX_CARD_BYTES_PER_CALL}-byte per-call limit.`,
      );
    }
  }
  const observedDigest = sha256(requestCoreBytes(requestCore(value)));
  if (value.requestDigest !== observedDigest) {
    throw new PartIdentificationMcpError(
      `Part-identification MCP request digest is ${JSON.stringify(value.requestDigest)}, but its exact ordered instruction/card core hashes to ${observedDigest}.`,
    );
  }
  return value;
}

/** Exact fixed-field request bytes, immune to inherited toJSON and key insertion order. */
export function partIdentificationMcpVerifiedRequestArtifact(verifiedRequest) {
  const bytes = requestArtifactBytes(verifiedRequest);
  return Object.freeze({ bytes, byteLength: bytes.length, digest: sha256(bytes) });
}

function sourceBytes(images, digests, cardId) {
  const bytes = images instanceof NativeMap ? mapGet(images, cardId) : null;
  const digest =
    digests instanceof NativeMap
      ? mapGet(digests, cardId)
      : own(digests, cardId)
        ? digests[cardId]
        : null;
  if (!(bytes instanceof Uint8Array) || !SHA256.test(digest ?? "")) {
    throw new PartIdentificationMcpError(
      `No authenticated retained PNG bytes and manifest digest were supplied for ${cardId}.`,
    );
  }
  const held = bufferFrom(bytes);
  if (
    held.length < 1 ||
    held.length > MAX_IMAGE_ARTIFACT_BYTES ||
    sha256(held) !== digest ||
    held.length < 8 ||
    !bufferEquals(bufferSubarray(held, 0, 8), PNG_SIGNATURE)
  ) {
    throw new PartIdentificationMcpError(
      `Authenticated retained bytes for ${cardId} do not reproduce its bounded PNG and manifest digest.`,
    );
  }
  return { cardId, byteLength: held.length, digest, base64: bufferToString(held, "base64") };
}

export function createPartIdentificationMcpRequest({
  cardIds,
  images,
  digests,
  model,
  cardsDigest,
  promptDigest,
  instructionBytes,
}) {
  requirePinnedPartIdentificationModel(model);
  if (
    !isArray(cardIds) ||
    cardIds.length < 1 ||
    cardIds.length > PART_IDENTIFICATION_MAX_BATCH_CARDS
  ) {
    throw new PartIdentificationMcpError(
      `Part-identification MCP transport requires 1 through ${PART_IDENTIFICATION_MAX_BATCH_CARDS} unique canonical card-NNNN ids; received ${JSON.stringify(cardIds)}.`,
    );
  }
  for (let index = 0; index < cardIds.length; index += 1) {
    if (!CARD_ID.test(cardIds[index]) || duplicateCardIdBefore(cardIds, index)) {
      throw new PartIdentificationMcpError(
        `Part-identification MCP transport card ${index} is not a unique canonical card-NNNN id.`,
      );
    }
  }
  const instruction = bufferFrom(instructionBytes ?? []);
  if (instruction.length < 1 || instruction.length > MAX_PART_IDENTIFICATION_INSTRUCTION_BYTES) {
    throw new PartIdentificationMcpError(
      `Part-identification instruction requires 1 through ${MAX_PART_IDENTIFICATION_INSTRUCTION_BYTES} bytes; received ${instruction.length}.`,
    );
  }
  const core = {
    schemaVersion: PART_IDENTIFICATION_MCP_SCHEMA,
    model,
    cardsDigest,
    promptDigest,
    transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
    instruction: { byteLength: instruction.length, digest: sha256(instruction) },
    cards: (() => {
      const cards = new Array(cardIds.length);
      for (let index = 0; index < cardIds.length; index += 1) {
        cards[index] = sourceBytes(images, digests, cardIds[index]);
      }
      return cards;
    })(),
  };
  return verifyPartIdentificationMcpRequest({
    ...core,
    requestDigest: sha256(requestCoreBytes(core)),
  });
}

export function partIdentificationEvidenceContent(requestInput) {
  const request = verifyPartIdentificationMcpRequest(requestInput);
  const content = new Array(request.cards.length * 2);
  for (let index = 0; index < request.cards.length; index += 1) {
    const card = request.cards[index];
    content[index * 2] = {
      type: "text",
      text: `${card.cardId} exact query card; digest ${card.digest}; byteLength ${card.byteLength}`,
    };
    content[index * 2 + 1] = { type: "image", data: card.base64, mimeType: "image/png" };
  }
  return content;
}

const TOOL = Object.freeze({
  name: PART_IDENTIFICATION_MCP_TOOL,
  description:
    "Return the exact ordered part-identification card PNGs already bound to this one call. Call once. No paths, files, prompts, resources, or other tools are exposed.",
  inputSchema: Object.freeze({
    type: "object",
    properties: Object.freeze({}),
    additionalProperties: false,
  }),
});

const response = (id, result) => ({ jsonrpc: "2.0", id, result });
const errorResponse = (id, code, message) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});
const noArguments = (value) => exactOwnKeys(value, []);

export function createPartIdentificationMcpHandler(requestInput) {
  const request = verifyPartIdentificationMcpRequest(requestInput);
  let called = false;
  return (message) => {
    const id = message?.id ?? null;
    if (message?.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return errorResponse(id, -32600, "Expected one JSON-RPC 2.0 request object.");
    }
    if (message.method.startsWith("notifications/")) return null;
    if (message.method === "initialize") {
      return response(id, {
        protocolVersion: message.params?.protocolVersion ?? "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "lego-bound-part-identification", version: "1" },
      });
    }
    if (message.method === "ping") return response(id, {});
    if (message.method === "tools/list") return response(id, { tools: [TOOL] });
    if (message.method !== "tools/call") {
      return errorResponse(id, -32601, `Method ${JSON.stringify(message.method)} is not exposed.`);
    }
    if (
      message.params?.name !== PART_IDENTIFICATION_MCP_TOOL ||
      !noArguments(message.params?.arguments)
    ) {
      return errorResponse(
        id,
        -32602,
        `${PART_IDENTIFICATION_MCP_TOOL} is the only tool and requires exactly an empty object.`,
      );
    }
    if (called) {
      return errorResponse(
        id,
        -32000,
        "The bound identification cards were already returned once.",
      );
    }
    called = true;
    return response(id, { content: partIdentificationEvidenceContent(request), isError: false });
  };
}

export function loadPartIdentificationMcpRequest(bundlePath) {
  const bytes = readBoundedFile(bundlePath, {
    label: "Bound part-identification MCP request",
    maxBytes: MAX_PART_IDENTIFICATION_REQUEST_BYTES,
  });
  try {
    return verifyPartIdentificationMcpRequest(parseStrictJsonBytes(bytes));
  } catch (cause) {
    throw new PartIdentificationMcpError(
      `Bound part-identification MCP request is invalid: ${cause instanceof Error ? cause.message : String(cause)}.`,
    );
  }
}

function bundleArgument(argv) {
  if (argv.length !== 2 || argv[0] !== "--bundle" || typeof argv[1] !== "string") {
    throw new PartIdentificationMcpError(
      "Part-identification MCP server requires exactly --bundle <prevalidated-request.json>.",
    );
  }
  return argv[1];
}

export async function* boundedPartIdentificationMcpLines(input) {
  const pending = Buffer.allocUnsafe(MAX_PART_IDENTIFICATION_MCP_LINE_BYTES);
  let pendingBytes = 0;
  let totalBytes = 0;
  for await (const chunk of input) {
    const held = Buffer.from(chunk);
    totalBytes += held.length;
    if (totalBytes > MAX_STDIN_BYTES) {
      throw new PartIdentificationMcpError(`MCP stdin exceeded ${MAX_STDIN_BYTES} bytes.`);
    }
    let offset = 0;
    while (offset < held.length) {
      const newline = held.indexOf(0x0a, offset);
      const end = newline === -1 ? held.length : newline;
      const fragmentBytes = end - offset;
      if (pendingBytes + fragmentBytes > MAX_PART_IDENTIFICATION_MCP_LINE_BYTES) {
        throw new PartIdentificationMcpError(
          `MCP JSON line exceeded ${MAX_PART_IDENTIFICATION_MCP_LINE_BYTES} bytes.`,
        );
      }
      if (fragmentBytes > 0) {
        held.copy(pending, pendingBytes, offset, end);
        pendingBytes += fragmentBytes;
      }
      if (newline === -1) break;
      yield Buffer.from(pending.subarray(0, pendingBytes));
      pendingBytes = 0;
      offset = newline + 1;
    }
  }
  if (pendingBytes > 0) yield Buffer.from(pending.subarray(0, pendingBytes));
}

export async function main(argv = process.argv.slice(2)) {
  const handler = createPartIdentificationMcpHandler(
    loadPartIdentificationMcpRequest(bundleArgument(argv)),
  );
  let messages = 0;
  for await (const line of boundedPartIdentificationMcpLines(process.stdin)) {
    if (line.toString("utf8").trim().length === 0) continue;
    messages += 1;
    if (messages > MAX_PART_IDENTIFICATION_MCP_MESSAGES) {
      throw new PartIdentificationMcpError(
        `MCP received more than ${MAX_PART_IDENTIFICATION_MCP_MESSAGES} messages.`,
      );
    }
    let message;
    try {
      message = parseStrictJsonBytes(line);
    } catch (cause) {
      process.stdout.write(
        `${JSON.stringify(errorResponse(null, -32700, `Invalid JSON: ${cause.message}.`))}\n`,
      );
      continue;
    }
    const held = handler(message);
    if (held !== null) process.stdout.write(`${JSON.stringify(held)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
