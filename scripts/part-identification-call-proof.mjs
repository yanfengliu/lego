import { MAX_JSON_ARTIFACT_BYTES, readContainedFile } from "./part-identification-io.mjs";
import {
  answerRecordDigest,
  callProofJsonBytes as proofBytes,
  callProofSha256 as sha256,
} from "./part-identification-call-proof-digest.mjs";
import {
  exactProofKeys as exactKeys,
  PartIdentificationCallProofError,
  proofDigest as digest,
  verifyCliEvidence,
  verifyExactToolContent,
  verifySanitizedEventSkeleton,
} from "./part-identification-call-proof-contract.mjs";
import { assertProductionPartIdentificationTransport } from "./part-identification-claude-transport.mjs";
import { parsePartIdentificationAnswerLines } from "./part-identification-answer-lines.mjs";
import {
  partIdentificationInstructionBytes,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-instruction.mjs";
import { publishImmutableContainedBytes } from "./part-identification-immutable-cas.mjs";
import {
  partIdentificationEvidenceContent,
  verifyPartIdentificationMcpRequest,
} from "./part-identification-mcp-server.mjs";
import { isPinnedModelIdentity } from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { exactOwnKeys, isArray, isOrdinaryObject, own } from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
  PART_IDENTIFICATION_PROOF_SCHEMA,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const CARD_ID = /^card-\d{4}$/u;
const FINALIZED_PROOF = Symbol("finalized-production-part-identification-proof");

export { PartIdentificationCallProofError };

function reconstructRequest(proof) {
  const orderedCards = proof.request.orderedCards;
  const content = proof.tool.content;
  if (!isArray(orderedCards) || !isArray(content) || content.length !== orderedCards.length * 2) {
    throw new PartIdentificationCallProofError(
      "Call proof must retain exactly one label/image pair for every ordered request card.",
    );
  }
  const cards = [];
  for (let index = 0; index < orderedCards.length; index += 1) {
    const card = orderedCards[index];
    exactKeys(card, ["cardId", "byteLength", "digest"], `Call proof card ${index}`);
    const text = content[index * 2];
    const image = content[index * 2 + 1];
    exactKeys(text, ["type", "text"], `Call proof text block ${index}`);
    exactKeys(image, ["type", "data", "mimeType"], `Call proof image block ${index}`);
    if (
      !CARD_ID.test(card.cardId) ||
      text?.type !== "text" ||
      text.text !==
        `${card.cardId} exact query card; digest ${card.digest}; byteLength ${card.byteLength}` ||
      image?.type !== "image" ||
      image.mimeType !== "image/png" ||
      typeof image.data !== "string"
    ) {
      throw new PartIdentificationCallProofError(
        `Call proof content ${index} does not reproduce its exact ordered card label and PNG block.`,
      );
    }
    cards.push({
      cardId: card.cardId,
      byteLength: card.byteLength,
      digest: card.digest,
      base64: image.data,
    });
  }
  const cardIds = new Array(cards.length);
  for (let index = 0; index < cards.length; index += 1) cardIds[index] = cards[index].cardId;
  const instruction = partIdentificationInstructionBytes(cardIds);
  if (
    proof.request.promptDigest !== PART_IDENTIFICATION_PROMPT_DIGEST ||
    proof.request.instruction.byteLength !== instruction.length ||
    proof.request.instruction.digest !== sha256(instruction)
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof instruction does not reproduce the exported canonical prompt and exact ordered card IDs.",
    );
  }
  return verifyPartIdentificationMcpRequest({
    schemaVersion: "lego.part-identification-mcp-request/1",
    model: proof.request.modelIdentity.requestedModelId,
    cardsDigest: proof.request.cardsDigest,
    promptDigest: proof.request.promptDigest,
    transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
    instruction: proof.request.instruction,
    cards,
    requestDigest: proof.request.requestDigest,
  });
}

export function verifyPartIdentificationCallProof(value) {
  exactKeys(
    value,
    [
      "schemaVersion",
      "transportContractDigest",
      "cliContract",
      "request",
      "rawStream",
      "tool",
      "terminal",
      "parsedAnswers",
    ],
    "Part-identification call proof",
  );
  if (
    value.schemaVersion !== PART_IDENTIFICATION_PROOF_SCHEMA ||
    value.transportContractDigest !== PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST
  ) {
    throw new PartIdentificationCallProofError(
      `Call proof must bind ${PART_IDENTIFICATION_PROOF_SCHEMA} and transport ${PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST}.`,
    );
  }
  exactKeys(
    value.request,
    [
      "requestDigest",
      "modelIdentity",
      "cardsDigest",
      "promptDigest",
      "instruction",
      "orderedCards",
    ],
    "Call proof request",
  );
  if (
    !isPinnedModelIdentity(
      value.request.modelIdentity,
      value.request.modelIdentity?.requestedModelId,
    )
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof request does not retain the pinned model identity.",
    );
  }
  verifyCliEvidence(value.cliContract, value.request);
  const request = reconstructRequest(value);
  if (!verifyExactToolContent(partIdentificationEvidenceContent(request), value.tool.content)) {
    throw new PartIdentificationCallProofError(
      "Call proof tool content does not exactly reproduce the verified request.",
    );
  }
  exactKeys(
    value.rawStream,
    ["digest", "byteLength", "eventCount", "replayLevel", "events"],
    "rawStream",
  );
  if (
    !SHA256.test(value.rawStream.digest ?? "") ||
    !Number.isSafeInteger(value.rawStream.byteLength) ||
    value.rawStream.byteLength < 1 ||
    value.rawStream.byteLength > PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxStdoutBytes ||
    !Number.isSafeInteger(value.rawStream.eventCount) ||
    value.rawStream.eventCount < 5 ||
    value.rawStream.eventCount > PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxEvents ||
    value.rawStream.replayLevel !== "sanitized-downstream"
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof rawStream must retain a bounded digest/length/event count and sanitized-downstream level.",
    );
  }
  exactKeys(
    value.tool,
    ["name", "input", "callEventIndex", "resultEventIndex", "content"],
    "Call proof tool",
  );
  if (
    value.tool.name !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.allowedTool ||
    !exactOwnKeys(value.tool.input, []) ||
    !Number.isSafeInteger(value.tool.callEventIndex) ||
    !Number.isSafeInteger(value.tool.resultEventIndex) ||
    value.tool.callEventIndex < 0 ||
    value.tool.resultEventIndex <= value.tool.callEventIndex ||
    value.tool.resultEventIndex >= value.rawStream.eventCount - 1
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof must retain one empty-input allowed tool call/result before the terminal event.",
    );
  }
  exactKeys(
    value.terminal,
    ["eventIndex", "modelIdentity", "result", "resultDigest", "usage", "elapsedMs"],
    "terminal",
  );
  if (
    value.terminal.eventIndex !== value.rawStream.eventCount - 1 ||
    !isPinnedModelIdentity(
      value.terminal.modelIdentity,
      value.request.modelIdentity.requestedModelId,
    ) ||
    !Number.isSafeInteger(value.terminal.elapsedMs) ||
    value.terminal.elapsedMs < 0 ||
    value.terminal.elapsedMs > PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxWallTimeMs ||
    typeof value.terminal.result !== "string" ||
    Buffer.byteLength(value.terminal.result) >
      PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxResultBytes ||
    digest(value.terminal.resultDigest, "terminal resultDigest") !==
      sha256(Buffer.from(value.terminal.result, "utf8"))
  ) {
    throw new PartIdentificationCallProofError(
      "Call proof terminal must be final and bind the pinned identity plus exact bounded result bytes.",
    );
  }
  exactKeys(
    value.terminal.usage,
    ["inputTokens", "outputTokens", "costMicrousd"],
    "terminal usage",
  );
  for (const field of ["inputTokens", "outputTokens", "costMicrousd"]) {
    if (!Number.isSafeInteger(value.terminal.usage[field]) || value.terminal.usage[field] < 0) {
      throw new PartIdentificationCallProofError(`Call proof terminal ${field} is not bounded.`);
    }
  }
  if (value.terminal.usage.costMicrousd > PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxCostMicrousd) {
    throw new PartIdentificationCallProofError("Call proof terminal cost exceeds its contract.");
  }
  verifySanitizedEventSkeleton(value.rawStream, value.tool, value.terminal, request);
  if (!isArray(value.parsedAnswers) || value.parsedAnswers.length !== request.cards.length) {
    throw new PartIdentificationCallProofError(
      "Call proof parsedAnswers must contain one ordered record per bound card.",
    );
  }
  for (let index = 0; index < value.parsedAnswers.length; index += 1) {
    const answer = value.parsedAnswers[index];
    exactKeys(answer, ["cardId", "outcome", "answer", "answerDigest"], `parsedAnswers ${index}`);
    if (
      answer.cardId !== request.cards[index].cardId ||
      (answer.outcome !== "usable" && answer.outcome !== "no-usable-reply") ||
      (answer.outcome === "usable") !== (answer.answer !== null) ||
      digest(answer.answerDigest, `parsedAnswers ${index} answerDigest`) !==
        sha256(proofBytes(answer.answer))
    ) {
      throw new PartIdentificationCallProofError(
        `Call proof parsed answer ${index} does not bind its ordered card, outcome, and exact answer bytes.`,
      );
    }
  }
  const replayCardIds = new Array(request.cards.length);
  for (let index = 0; index < request.cards.length; index += 1) {
    replayCardIds[index] = request.cards[index].cardId;
  }
  const replayed = parsePartIdentificationAnswerLines(
    value.terminal.result,
    replayCardIds,
  ).parsedAnswers;
  for (let index = 0; index < replayed.length; index += 1) {
    const observed = value.parsedAnswers[index];
    const expected = replayed[index];
    if (
      observed.cardId !== expected.cardId ||
      observed.outcome !== expected.outcome ||
      observed.answerDigest !== expected.answerDigest ||
      !proofBytes(observed.answer).equals(proofBytes(expected.answer))
    ) {
      throw new PartIdentificationCallProofError(
        `Call proof parsed answer ${index} does not replay from the exact terminal result under the production parser.`,
      );
    }
  }
  return value;
}

export function finalizePartIdentificationCallProof(transport, parsedAnswers) {
  assertProductionPartIdentificationTransport(transport);
  const value = verifyPartIdentificationCallProof({
    ...transport.proof,
    parsedAnswers,
  });
  const bytes = proofBytes(value);
  if (
    bytes.length > transport.proofReservation ||
    bytes.length > PART_IDENTIFICATION_MAX_PROOF_BYTES
  ) {
    throw new PartIdentificationCallProofError(
      `Sanitized call proof uses ${bytes.length} bytes above its ${transport.proofReservation}-byte reservation or ${PART_IDENTIFICATION_MAX_PROOF_BYTES}-byte hard limit. No checkpoint may be published.`,
    );
  }
  const finalized = { value, bytes, digest: sha256(bytes) };
  Object.defineProperty(finalized, FINALIZED_PROOF, { value: true });
  return finalized;
}

/** Reopens only the opaque result minted by the production transport/finalizer chain. */
export function inspectFinalizedPartIdentificationCallProof(finalized) {
  if (finalized?.[FINALIZED_PROOF] !== true) {
    throw new PartIdentificationCallProofError(
      "Gate-0 settlement requires a production-branded finalized call proof.",
    );
  }
  const value = verifyPartIdentificationCallProof(finalized.value);
  const bytes = proofBytes(value);
  const observedDigest = sha256(bytes);
  if (
    !Buffer.isBuffer(finalized.bytes) ||
    !bytes.equals(finalized.bytes) ||
    finalized.digest !== observedDigest
  ) {
    throw new PartIdentificationCallProofError(
      "Finalized call proof bytes and digest no longer reproduce the verified proof.",
    );
  }
  return Object.freeze({
    bytes,
    byteLength: bytes.length,
    digest: observedDigest,
    request: Object.freeze({
      requestDigest: value.request.requestDigest,
      cardsDigest: value.request.cardsDigest,
      promptDigest: value.request.promptDigest,
      instruction: value.request.instruction,
      orderedCards: value.request.orderedCards,
      modelIdentity: value.request.modelIdentity,
    }),
    usage: value.terminal.usage,
    elapsedMs: value.terminal.elapsedMs,
    providerTurns: PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxTurns,
  });
}

export function publishPartIdentificationCallProof(out, proof) {
  if (proof?.[FINALIZED_PROOF] !== true) {
    throw new PartIdentificationCallProofError(
      "Only a production-branded finalized call proof can be published into a /5 checkpoint.",
    );
  }
  const digestHex = proof.digest.slice("sha256:".length);
  const path = `call-proofs/sha256/${digestHex}.json`;
  publishImmutableContainedBytes(out, path, proof.bytes, {
    label: "Sanitized part-identification call proof",
    pathLabel: "Call-proof path",
    maxBytes: PART_IDENTIFICATION_MAX_PROOF_BYTES,
  });
  const retained = readContainedFile(out, path, {
    label: "Retained sanitized part-identification call proof",
    pathLabel: "Call-proof path",
    maxBytes: PART_IDENTIFICATION_MAX_PROOF_BYTES,
  });
  if (!retained.equals(proof.bytes) || sha256(retained) !== proof.digest) {
    throw new PartIdentificationCallProofError(
      "Published call proof did not reopen as the exact verified bytes; no answer checkpoint may advance.",
    );
  }
  verifyPartIdentificationCallProof(parseStrictJsonBytes(retained));
  return { path, byteLength: retained.length, digest: proof.digest };
}

export function readPartIdentificationCallProof(out, reference, traceArtifacts = null) {
  exactKeys(reference, ["path", "byteLength", "digest"], "Call-proof reference");
  const expectedPath = `call-proofs/sha256/${String(reference.digest).slice("sha256:".length)}.json`;
  if (
    !SHA256.test(reference.digest ?? "") ||
    reference.path !== expectedPath ||
    !Number.isSafeInteger(reference.byteLength) ||
    reference.byteLength < 1 ||
    reference.byteLength > Math.min(PART_IDENTIFICATION_MAX_PROOF_BYTES, MAX_JSON_ARTIFACT_BYTES)
  ) {
    throw new PartIdentificationCallProofError(
      "Call-proof reference must bind its canonical digest-derived path and bounded byte length.",
    );
  }
  const bytes =
    isOrdinaryObject(traceArtifacts) && own(traceArtifacts, reference.path)
      ? Buffer.from(traceArtifacts[reference.path])
      : readContainedFile(out, reference.path, {
          label: "Sanitized part-identification call proof",
          pathLabel: "Call-proof path",
          maxBytes: PART_IDENTIFICATION_MAX_PROOF_BYTES,
        });
  if (bytes.length !== reference.byteLength || sha256(bytes) !== reference.digest) {
    throw new PartIdentificationCallProofError(
      "Call-proof reference does not reproduce its retained bytes, byte length, and digest.",
    );
  }
  return verifyPartIdentificationCallProof(parseStrictJsonBytes(bytes));
}

export { answerRecordDigest };
