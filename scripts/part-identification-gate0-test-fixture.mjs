import { createHash } from "node:crypto";

import { estimatePartIdentificationProofReservation } from "./part-identification-proof-reservation.mjs";
import {
  createPartIdentificationGate0Authorization,
  createPartIdentificationGate0LaunchReservation,
  createPartIdentificationGate0PilotProposal,
  PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS,
  PART_IDENTIFICATION_GATE0_CARDS_DIGEST,
  PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT,
  PART_IDENTIFICATION_GATE0_INSTRUCTION,
  PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
  PART_IDENTIFICATION_GATE0_PILOT_CARDS,
  PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
  PART_IDENTIFICATION_GATE0_POLICY_SOURCES,
  PART_IDENTIFICATION_GATE0_PROMPT_DIGEST,
  PART_IDENTIFICATION_GATE0_PURPOSE,
  PART_IDENTIFICATION_GATE0_REQUEST_DIGEST,
} from "./part-identification-gate0.mjs";
import { PART_IDENTIFICATION_MCP_SCHEMA } from "./part-identification-mcp-server.mjs";
import { PART_IDENTIFICATION_MODEL_ID } from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST } from "./part-identification-transport-contract.mjs";

export const GATE0_TEST_NOW = 1_800_000_000_000;
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export const gate0TestDigest = (label) => sha256(Buffer.from(label, "utf8"));
export const reversedGate0TestRecord = (value) =>
  Object.fromEntries(Object.entries(value).reverse());

export function gate0TestRequest({
  cardIds = PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
  sizes,
  instruction = null,
  substituteCardIndex = null,
} = {}) {
  const isExact =
    sizes === undefined &&
    instruction === null &&
    substituteCardIndex === null &&
    cardIds.length === 6;
  const cards = cardIds.map((cardId, index) => {
    const expected = PART_IDENTIFICATION_GATE0_PILOT_CARDS[index];
    const byteLength = sizes?.[index] ?? expected.byteLength;
    return {
      cardId,
      byteLength,
      digest:
        cardId === expected.cardId &&
        byteLength === expected.byteLength &&
        index !== substituteCardIndex
          ? expected.digest
          : gate0TestDigest(`substitute-${index}-${byteLength}`),
      base64: Buffer.alloc(byteLength, index + 1).toString("base64"),
    };
  });
  return {
    schemaVersion: PART_IDENTIFICATION_MCP_SCHEMA,
    model: PART_IDENTIFICATION_MODEL_ID,
    cardsDigest: isExact ? PART_IDENTIFICATION_GATE0_CARDS_DIGEST : gate0TestDigest("other-cards"),
    promptDigest: PART_IDENTIFICATION_GATE0_PROMPT_DIGEST,
    transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
    instruction:
      instruction === null
        ? { ...PART_IDENTIFICATION_GATE0_INSTRUCTION }
        : { byteLength: Buffer.byteLength(instruction), digest: gate0TestDigest(instruction) },
    cards,
    requestDigest: isExact
      ? PART_IDENTIFICATION_GATE0_REQUEST_DIGEST
      : gate0TestDigest("other-request"),
  };
}

export function gate0TestPolicyReview(reviewedAtMs = GATE0_TEST_NOW) {
  return {
    schemaVersion: PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
    evidenceBasis: "official-provider-published-consumer-policy",
    sourceAuthentication: "url-and-content-digest/not-authenticated-by-contract",
    reviewedAtMs,
    sources: PART_IDENTIFICATION_GATE0_POLICY_SOURCES.map((source, index) => ({
      topic: source.topic,
      officialUrl: source.officialUrl,
      contentDigest: gate0TestDigest(`policy-${index}`),
      retrievedAtMs: reviewedAtMs,
    })),
  };
}

export function gate0TestBudgets(request) {
  return {
    maxModelLaunches: 1,
    maxExecutablePreflights: 1,
    maxCards: 6,
    maxProviderTurns: 2,
    maxInputTokens: 1_000_000,
    maxOutputTokens: 128_000,
    maxCostMicrousd: 2_000_000,
    maxElapsedMs: 5 * 60_000,
    maxProofBytes: estimatePartIdentificationProofReservation(request),
  };
}

export function gate0TestProposal(request = gate0TestRequest()) {
  return createPartIdentificationGate0PilotProposal({
    request,
    purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
    proposedAtMs: GATE0_TEST_NOW,
    policyReview: gate0TestPolicyReview(),
    budgets: gate0TestBudgets(request),
  });
}

export function gate0TestAuthorization(proposal, overrides = {}, request = gate0TestRequest()) {
  return createPartIdentificationGate0Authorization({
    proposal,
    request,
    decision: "approved",
    authorizationBasis: PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS,
    repositoryOwnerIdentityAuthenticated: false,
    exposureAcknowledgement: { ...PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT },
    authorizedAtMs: GATE0_TEST_NOW + 1_000,
    notBeforeMs: GATE0_TEST_NOW,
    notAfterMs: GATE0_TEST_NOW + 5 * 60_000,
    nowMs: GATE0_TEST_NOW + 1_000,
    ...overrides,
  });
}

export function gate0TestReservation(request, proposal, authorization, nonce = "reservation-a") {
  return createPartIdentificationGate0LaunchReservation({
    proposal,
    authorization,
    request,
    reservationNonceDigest: gate0TestDigest(nonce),
    reservedAtMs: GATE0_TEST_NOW + 2_000,
  });
}

export function gate0TestFixture() {
  const request = gate0TestRequest();
  const proposal = gate0TestProposal(request);
  const authorization = gate0TestAuthorization(proposal, {}, request);
  const reservation = gate0TestReservation(request, proposal, authorization);
  return { request, proposal, authorization, reservation };
}
