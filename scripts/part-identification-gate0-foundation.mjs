import { createHash } from "node:crypto";
import {
  partIdentificationMcpVerifiedRequestArtifact,
  verifyPartIdentificationMcpRequest,
} from "./part-identification-mcp-server.mjs";
import {
  partIdentificationGate0CanonicalJsonBytes,
  samePartIdentificationGate0CanonicalValue,
} from "./part-identification-gate0-json.mjs";
import { exactOwnKeys, isArray, isOrdinaryObject } from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

export const PART_IDENTIFICATION_GATE0_PROPOSAL_SCHEMA =
  "lego.part-identification-gate0-pilot-proposal/1";
export const PART_IDENTIFICATION_GATE0_AUTHORIZATION_SCHEMA =
  "lego.part-identification-gate0-authorization/1";
export const PART_IDENTIFICATION_GATE0_RESERVATION_SCHEMA =
  "lego.part-identification-gate0-launch-reservation/1";
export const PART_IDENTIFICATION_GATE0_SETTLEMENT_SCHEMA =
  "lego.part-identification-gate0-launch-settlement/1";
export const PART_IDENTIFICATION_GATE0_POLICY_SCHEMA =
  "lego.part-identification-gate0-official-policy-review/1";
export const PART_IDENTIFICATION_GATE0_PURPOSE =
  "isolated-six-card-consumer-policy-privacy-pilot/1";
export const PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS =
  "trusted-local-caller-assertion/not-user-event-or-identity-authenticated";
export const PART_IDENTIFICATION_GATE0_REQUEST_DIGEST =
  "sha256:89b84bd3d8d2c7c542aaae6d24ec90c8fd3b711731bd72ed5b20631ed5ebba64";
export const PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT = Object.freeze({
  byteLength: 1_810_180,
  digest: "sha256:8984c336ad8b8afa39bf929fe4239ae17433190fb8560fd65375c08d6c4f23ec",
});
export const PART_IDENTIFICATION_GATE0_CARDS_DIGEST =
  "sha256:1f6c740a865bc14fd43ba727edc5e034279095a3da0504eca617672e367c2ad5";
export const PART_IDENTIFICATION_GATE0_PROMPT_DIGEST =
  "sha256:41e3633b128827a2cef83ef918838ee02204239444448d1b2412ce183b9cee7a";
export const PART_IDENTIFICATION_GATE0_INSTRUCTION = Object.freeze({
  byteLength: 5_647,
  digest: "sha256:0fb74d21d0aacb86e5d87b314c99488307da448b187b9385290e82ce645de33b",
});
export const PART_IDENTIFICATION_GATE0_PILOT_CARDS = Object.freeze([
  Object.freeze({
    cardId: "card-0000",
    byteLength: 240_052,
    digest: "sha256:d9a1bab1f816b3d821117918d240b08439c256447e00cb0a6fffccfe09d59a1c",
  }),
  Object.freeze({
    cardId: "card-0001",
    byteLength: 266_154,
    digest: "sha256:0f9f982fd4fcd451caeb14d8fa627749101ef846e6e296322deaffc810d4c166",
  }),
  Object.freeze({
    cardId: "card-0002",
    byteLength: 238_612,
    digest: "sha256:6ec9e86659d5c6b533a00c057914059c25d3b889b0c6095efd9ac2990ae30e04",
  }),
  Object.freeze({
    cardId: "card-0003",
    byteLength: 173_453,
    digest: "sha256:a63ec347176aeff006a4bba8319d6daee7cd27bea1db41b29918ec420610ee33",
  }),
  Object.freeze({
    cardId: "card-0004",
    byteLength: 205_014,
    digest: "sha256:f8c9d60c6e2f2624461641a6ec1d2152774692430e11f290bb073072afe49e4b",
  }),
  Object.freeze({
    cardId: "card-0005",
    byteLength: 233_291,
    digest: "sha256:8ce136b62be1c4554ee0b5b1bb56a79d85aba5fed89f81682875bf2b194e08b8",
  }),
]);
export const PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS = Object.freeze([
  "card-0000",
  "card-0001",
  "card-0002",
  "card-0003",
  "card-0004",
  "card-0005",
]);
export const PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES = 1_356_576;
export const PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS = 15 * 60 * 1_000;
export const PART_IDENTIFICATION_GATE0_MAX_POLICY_AGE_MS = 24 * 60 * 60 * 1_000;
export const PART_IDENTIFICATION_GATE0_MAX_INPUT_TOKENS = 1_000_000;
export const PART_IDENTIFICATION_GATE0_MAX_OUTPUT_TOKENS = 128_000;
export const PART_IDENTIFICATION_GATE0_PROOF_RESERVATION_BYTES = 2_088_511;
export const PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT = Object.freeze({
  consumerTraining: "accepted-worst-case-training-use",
  consumerRetention: "accepted-worst-case-indefinite-retention",
  consumerSafetyReview: "accepted-worst-case-human-or-automated-review",
});
export const PART_IDENTIFICATION_GATE0_POLICY_SOURCES = Object.freeze([
  Object.freeze({
    topic: "consumer-training",
    officialUrl:
      "https://privacy.claude.com/en/articles/10023580-is-my-data-used-for-model-training",
  }),
  Object.freeze({
    topic: "consumer-retention",
    officialUrl: "https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data",
  }),
  Object.freeze({
    topic: "consumer-safety-review",
    officialUrl:
      "https://privacy.claude.com/en/articles/10458704-how-does-anthropic-protect-the-personal-data-of-claude-users",
  }),
]);

export const GATE0_MAX_RECORD_BYTES = 64 * 1024;
export const GATE0_MAX_FAILURE_BYTES = 64 * 1024;
export const GATE0_MAX_TIMESTAMP_MS = 8_640_000_000_000_000;

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const getDescriptors = Object.getOwnPropertyDescriptors;
const reflectOwnKeys = Reflect.ownKeys;
const freeze = Object.freeze;
const arrayIncludes = Function.call.bind(Array.prototype.includes);
const arrayJoin = Function.call.bind(Array.prototype.join);
const arrayMap = Function.call.bind(Array.prototype.map);
const arrayReduce = Function.call.bind(Array.prototype.reduce);
const arraySome = Function.call.bind(Array.prototype.some);
const objectKeys = Object.keys;
const hashPrototype = Object.getPrototypeOf(createHash("sha256"));
const hashUpdate = Function.call.bind(hashPrototype.update);
const hashDigest = Function.call.bind(hashPrototype.digest);

export const gate0ArrayMap = (value, callback) => arrayMap(value, callback);
export const gate0ObjectKeys = (value) => objectKeys(value);

export class PartIdentificationGate0Error extends Error {
  constructor(message) {
    super(message);
    this.name = "PartIdentificationGate0Error";
  }
}

export const failGate0 = (message) => {
  throw new PartIdentificationGate0Error(message);
};
const sha256 = (bytes) => {
  const hash = createHash("sha256");
  hashUpdate(hash, bytes);
  return `sha256:${hashDigest(hash, "hex")}`;
};
export const partIdentificationGate0JsonBytes = (value) =>
  partIdentificationGate0CanonicalJsonBytes(value);
export const partIdentificationGate0BytesDigest = (bytes) => sha256(bytes);
export const partIdentificationGate0Digest = (value) =>
  sha256(partIdentificationGate0JsonBytes(value));

export function exactGate0Object(value, keys, label) {
  try {
    if (!isOrdinaryObject(value) || !exactOwnKeys(value, keys)) failGate0(`${label} is not exact.`);
    const ownKeys = reflectOwnKeys(value);
    const descriptors = getDescriptors(value);
    if (ownKeys.length !== keys.length) failGate0(`${label} has symbol or hidden fields.`);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        failGate0(`${label}.${key} must be an enumerable data property.`);
      }
    }
    return value;
  } catch (error) {
    if (error instanceof PartIdentificationGate0Error) throw error;
    failGate0(`${label} rejected hostile object structure.`);
  }
}

export function exactGate0Array(value, length, label) {
  try {
    if (!isArray(value) || value.length !== length)
      failGate0(`${label} must contain ${length} entries.`);
    const keys = reflectOwnKeys(value);
    const descriptors = getDescriptors(value);
    if (keys.length !== length + 1 || !arrayIncludes(keys, "length"))
      failGate0(`${label} has extra fields.`);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        failGate0(`${label}[${index}] must be an enumerable data entry.`);
      }
    }
    return value;
  } catch (error) {
    if (error instanceof PartIdentificationGate0Error) throw error;
    failGate0(`${label} rejected hostile array structure.`);
  }
}

export function gate0Integer(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    failGate0(`${label} must be a safe integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

export function gate0Digest(value, label) {
  if (typeof value !== "string" || !SHA256.test(value))
    failGate0(`${label} must be lowercase SHA-256.`);
  return value;
}

export function deeplyFreezeGate0(value) {
  if (isArray(value)) {
    for (let index = 0; index < value.length; index += 1) deeplyFreezeGate0(value[index]);
  } else if (isOrdinaryObject(value)) {
    const keys = objectKeys(value);
    for (let index = 0; index < keys.length; index += 1) deeplyFreezeGate0(value[keys[index]]);
  }
  return freeze(value);
}

export function sameGate0Value(left, right) {
  return samePartIdentificationGate0CanonicalValue(left, right);
}

export function snapshotGate0Request(requestInput) {
  exactGate0Object(
    requestInput,
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
    "MCP request",
  );
  exactGate0Object(requestInput.instruction, ["byteLength", "digest"], "MCP instruction");
  exactGate0Array(requestInput.cards, 6, "MCP cards");
  for (let index = 0; index < 6; index += 1) {
    exactGate0Object(
      requestInput.cards[index],
      ["cardId", "byteLength", "digest", "base64"],
      `MCP card ${index}`,
    );
  }
  const request = verifyPartIdentificationMcpRequest(requestInput);
  const cards = arrayMap(request.cards, (card) => ({
    cardId: card.cardId,
    byteLength: card.byteLength,
    digest: card.digest,
    base64: card.base64,
  }));
  const aggregateBytes = arrayReduce(cards, (total, card) => total + card.byteLength, 0);
  if (
    aggregateBytes !== PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES ||
    request.requestDigest !== PART_IDENTIFICATION_GATE0_REQUEST_DIGEST ||
    request.cardsDigest !== PART_IDENTIFICATION_GATE0_CARDS_DIGEST ||
    request.promptDigest !== PART_IDENTIFICATION_GATE0_PROMPT_DIGEST ||
    !sameGate0Value(request.instruction, PART_IDENTIFICATION_GATE0_INSTRUCTION) ||
    arraySome(
      cards,
      (card, index) =>
        !sameGate0Value(
          { cardId: card.cardId, byteLength: card.byteLength, digest: card.digest },
          PART_IDENTIFICATION_GATE0_PILOT_CARDS[index],
        ),
    )
  ) {
    failGate0(
      `Gate-0 pilot requires the exact measured ${arrayJoin(PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS, ", ")} packet, request, cards, prompt, and instruction digests.`,
    );
  }
  const canonical = {
    schemaVersion: request.schemaVersion,
    model: request.model,
    cardsDigest: request.cardsDigest,
    promptDigest: request.promptDigest,
    transportContractDigest: request.transportContractDigest,
    instruction: {
      byteLength: request.instruction.byteLength,
      digest: request.instruction.digest,
    },
    cards,
    requestDigest: request.requestDigest,
  };
  const artifact = partIdentificationMcpVerifiedRequestArtifact(canonical);
  if (
    artifact.byteLength !== PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.byteLength ||
    artifact.digest !== PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.digest
  ) {
    failGate0("Gate-0 request does not reproduce the exact retained request artifact bytes.");
  }
  return {
    canonical,
    binding: {
      schemaVersion: canonical.schemaVersion,
      requestDigest: canonical.requestDigest,
      artifactDigest: artifact.digest,
      artifactByteLength: artifact.byteLength,
      cardsDigest: canonical.cardsDigest,
      promptDigest: canonical.promptDigest,
      instruction: {
        byteLength: canonical.instruction.byteLength,
        digest: canonical.instruction.digest,
      },
      orderedCards: arrayMap(cards, ({ cardId, byteLength: length, digest: cardDigest }) => ({
        cardId,
        byteLength: length,
        digest: cardDigest,
      })),
    },
    aggregateBytes,
  };
}

export function gate0PolicyReview(value, proposedAtMs) {
  exactGate0Object(
    value,
    ["schemaVersion", "evidenceBasis", "sourceAuthentication", "reviewedAtMs", "sources"],
    "Policy review",
  );
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_POLICY_SCHEMA ||
    value.evidenceBasis !== "official-provider-published-consumer-policy" ||
    value.sourceAuthentication !== "url-and-content-digest/not-authenticated-by-contract"
  ) {
    failGate0(
      "Policy review does not state the exact official-source and unauthenticated evidence basis.",
    );
  }
  gate0Integer(value.reviewedAtMs, 0, GATE0_MAX_TIMESTAMP_MS, "Policy reviewedAtMs");
  if (
    value.reviewedAtMs > proposedAtMs ||
    proposedAtMs - value.reviewedAtMs > PART_IDENTIFICATION_GATE0_MAX_POLICY_AGE_MS
  ) {
    failGate0("Policy review must be current within 24 hours before the proposal.");
  }
  exactGate0Array(value.sources, 3, "Policy sources");
  const sources = arrayMap(value.sources, (source, index) => {
    exactGate0Object(
      source,
      ["topic", "officialUrl", "contentDigest", "retrievedAtMs"],
      `Policy source ${index}`,
    );
    gate0Integer(
      source.retrievedAtMs,
      0,
      value.reviewedAtMs,
      `Policy source ${index} retrievedAtMs`,
    );
    const expected = PART_IDENTIFICATION_GATE0_POLICY_SOURCES[index];
    if (
      source.topic !== expected.topic ||
      source.officialUrl !== expected.officialUrl ||
      value.reviewedAtMs - source.retrievedAtMs > 60 * 60 * 1_000 ||
      proposedAtMs - source.retrievedAtMs > PART_IDENTIFICATION_GATE0_MAX_POLICY_AGE_MS
    )
      failGate0(`Policy source ${index} must be the fresh exact ${expected.topic} evidence URL.`);
    gate0Digest(source.contentDigest, `Policy source ${index} contentDigest`);
    return {
      topic: source.topic,
      officialUrl: source.officialUrl,
      contentDigest: source.contentDigest,
      retrievedAtMs: source.retrievedAtMs,
    };
  });
  return {
    schemaVersion: value.schemaVersion,
    evidenceBasis: value.evidenceBasis,
    sourceAuthentication: value.sourceAuthentication,
    reviewedAtMs: value.reviewedAtMs,
    sources,
  };
}

export function gate0Budgets(value, expectedProofBytes = null) {
  exactGate0Object(
    value,
    [
      "maxModelLaunches",
      "maxExecutablePreflights",
      "maxCards",
      "maxProviderTurns",
      "maxInputTokens",
      "maxOutputTokens",
      "maxCostMicrousd",
      "maxElapsedMs",
      "maxProofBytes",
    ],
    "Gate-0 budgets",
  );
  if (
    value.maxModelLaunches !== 1 ||
    value.maxExecutablePreflights !== 1 ||
    value.maxCards !== 6 ||
    value.maxProviderTurns !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxTurns
  )
    failGate0(
      "Gate-0 budgets must reserve one model launch, one local executable preflight, six cards, and the exact transport turn ceiling.",
    );
  gate0Integer(value.maxInputTokens, 1, Number.MAX_SAFE_INTEGER, "maxInputTokens");
  gate0Integer(value.maxOutputTokens, 1, Number.MAX_SAFE_INTEGER, "maxOutputTokens");
  gate0Integer(value.maxCostMicrousd, 0, Number.MAX_SAFE_INTEGER, "maxCostMicrousd");
  gate0Integer(value.maxElapsedMs, 1, Number.MAX_SAFE_INTEGER, "maxElapsedMs");
  gate0Integer(value.maxProofBytes, 1, PART_IDENTIFICATION_MAX_PROOF_BYTES, "maxProofBytes");
  if (expectedProofBytes !== null && value.maxProofBytes !== expectedProofBytes)
    failGate0("Gate-0 proof budget must equal the exact MCP proof reservation.");
  if (
    value.maxInputTokens !== PART_IDENTIFICATION_GATE0_MAX_INPUT_TOKENS ||
    value.maxOutputTokens !== PART_IDENTIFICATION_GATE0_MAX_OUTPUT_TOKENS ||
    value.maxCostMicrousd !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxCostMicrousd ||
    value.maxElapsedMs !== PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxWallTimeMs
  ) {
    failGate0(
      "Gate-0 budgets must equal the fixed Opus 5 capacity reservation and the executable cost/time ceilings.",
    );
  }
  return {
    maxModelLaunches: value.maxModelLaunches,
    maxExecutablePreflights: value.maxExecutablePreflights,
    maxCards: value.maxCards,
    maxProviderTurns: value.maxProviderTurns,
    maxInputTokens: value.maxInputTokens,
    maxOutputTokens: value.maxOutputTokens,
    maxCostMicrousd: value.maxCostMicrousd,
    maxElapsedMs: value.maxElapsedMs,
    maxProofBytes: value.maxProofBytes,
  };
}

export function gate0TransportBinding() {
  return {
    schemaVersion: PART_IDENTIFICATION_TRANSPORT_CONTRACT.schemaVersion,
    contractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
    providerExecutionAuthenticated: false,
    executableReplay: false,
  };
}

export function gate0AuthorityAbsence() {
  return { providerExecutionAuthenticated: false, repositoryOwnerIdentityAuthenticated: false };
}

export function gate0Scope(binding, aggregateCardBytes) {
  return {
    schemaVersion: "lego.part-identification-gate0-crop-scope/1",
    content: "six-source-bound-query-card-png-crops-only",
    cardCount: binding.orderedCards.length,
    aggregateCardBytes,
    fullBookletIncluded: false,
    fullPagesIncluded: false,
    repositoryFilesIncluded: false,
    credentialsIncluded: false,
    sessionMaterialIncluded: false,
    userReferenceCropsIncluded: true,
    otherUserDocumentsIncluded: false,
    consumerAccountPrivacyState: "unknown",
    consumerAccountPrivacyTreatment: "worst-case-training-retention-safety-review-exposure",
  };
}
