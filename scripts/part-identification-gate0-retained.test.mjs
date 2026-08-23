import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { estimatePartIdentificationProofReservation } from "./part-identification-proof-reservation.mjs";
import {
  createPartIdentificationGate0PilotProposal,
  PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES,
  PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
  PART_IDENTIFICATION_GATE0_POLICY_SOURCES,
  PART_IDENTIFICATION_GATE0_PURPOSE,
  PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT,
  PART_IDENTIFICATION_GATE0_REQUEST_DIGEST,
  verifyPartIdentificationGate0PilotProposal,
} from "./part-identification-gate0.mjs";
import { reconstructRetainedPartIdentificationGate0Request } from "./part-identification-gate0-request.mjs";

const retained = process.env.LEGO_PART_IDENTIFICATION_GATE0_RETAINED === "1" ? it : it.skip;
const sha256 = (value) =>
  `sha256:${createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex")}`;

retained(
  "reconstructs the exact unmocked retained six-card Gate-0 request",
  () => {
    const request = reconstructRetainedPartIdentificationGate0Request();
    const proposedAtMs = Date.now();
    const proposal = createPartIdentificationGate0PilotProposal({
      request,
      purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
      proposedAtMs,
      policyReview: {
        schemaVersion: PART_IDENTIFICATION_GATE0_POLICY_SCHEMA,
        evidenceBasis: "official-provider-published-consumer-policy",
        sourceAuthentication: "url-and-content-digest/not-authenticated-by-contract",
        reviewedAtMs: proposedAtMs,
        sources: PART_IDENTIFICATION_GATE0_POLICY_SOURCES.map((source, index) => ({
          ...source,
          contentDigest: sha256(`retained-test-policy-${index}`),
          retrievedAtMs: proposedAtMs,
        })),
      },
      budgets: {
        maxModelLaunches: 1,
        maxExecutablePreflights: 1,
        maxCards: 6,
        maxProviderTurns: 2,
        maxInputTokens: 1_000_000,
        maxOutputTokens: 128_000,
        maxCostMicrousd: 2_000_000,
        maxElapsedMs: 5 * 60_000,
        maxProofBytes: estimatePartIdentificationProofReservation(request),
      },
    });

    expect(request.requestDigest).toBe(PART_IDENTIFICATION_GATE0_REQUEST_DIGEST);
    expect(proposal.request.artifactDigest).toBe(PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.digest);
    expect(proposal.request.artifactByteLength).toBe(
      PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.byteLength,
    );
    expect(proposal.dataScope.aggregateCardBytes).toBe(PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES);
    expect(() => verifyPartIdentificationGate0PilotProposal(proposal)).not.toThrow();
  },
  30_000,
);
