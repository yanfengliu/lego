import { spawnSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

const mcpBoundary = vi.hoisted(() => ({ proofReservation: 2_088_511 }));
vi.mock("./part-identification-mcp-server.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifyPartIdentificationMcpRequest: (value) => value,
    partIdentificationMcpVerifiedRequestArtifact: (value) => ({
      bytes: Buffer.from(JSON.stringify(value), "utf8"),
      byteLength: 1_810_180,
      digest: "sha256:8984c336ad8b8afa39bf929fe4239ae17433190fb8560fd65375c08d6c4f23ec",
    }),
  };
});
vi.mock("./part-identification-proof-reservation.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    estimatePartIdentificationProofReservation() {
      return mcpBoundary.proofReservation;
    },
  };
});

import {
  createPartIdentificationGate0PilotProposal,
  createPartIdentificationGate0Settlement,
  parsePartIdentificationGate0Authorization,
  partIdentificationGate0Digest,
  PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT,
  PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS,
  PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES,
  PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
  PART_IDENTIFICATION_GATE0_POLICY_SOURCES,
  PART_IDENTIFICATION_GATE0_PURPOSE,
  PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT,
  verifyPartIdentificationGate0Authorization,
  verifyPartIdentificationGate0LaunchReservation,
  verifyPartIdentificationGate0PilotProposal,
  verifyPartIdentificationGate0Settlement,
} from "./part-identification-gate0.mjs";
import {
  GATE0_TEST_NOW as NOW,
  gate0TestAuthorization as authorizationFor,
  gate0TestBudgets as budgets,
  gate0TestDigest as fixtureDigest,
  gate0TestFixture as fixture,
  gate0TestPolicyReview as policyReview,
  gate0TestProposal as proposalFor,
  gate0TestRequest as requestWith,
  gate0TestReservation as reservationFor,
  reversedGate0TestRecord as reversedRecord,
} from "./part-identification-gate0-test-fixture.mjs";

describe("part-identification Gate-0 contracts", () => {
  it("derives the exact crop-only six-card proposal without circular record digests", () => {
    const { request, proposal, authorization, reservation } = fixture();
    const settlement = createPartIdentificationGate0Settlement({
      proposal,
      authorization,
      reservation,
      request,
      settledAtMs: NOW + 4_000,
      result: {
        status: "success",
        proofDigest: fixtureDigest("final-proof"),
        proofByteLength: 100_000,
        providerTurns: 2,
        inputTokens: 4_000,
        outputTokens: 800,
        costMicrousd: 123_456,
        elapsedMs: 1_500,
      },
    });
    const reorderedReview = reversedRecord(policyReview());
    reorderedReview.sources = reorderedReview.sources.map(reversedRecord);
    const reorderedProposal = createPartIdentificationGate0PilotProposal({
      request,
      purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
      proposedAtMs: NOW,
      policyReview: reorderedReview,
      budgets: reversedRecord(budgets(request)),
    });
    const reorderedAuthorization = authorizationFor(
      proposal,
      {
        exposureAcknowledgement: reversedRecord(PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT),
      },
      request,
    );

    expect(proposal.request.orderedCards.map((card) => card.cardId)).toEqual(
      PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
    );
    expect(proposal.dataScope).toMatchObject({
      cardCount: 6,
      aggregateCardBytes: PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES,
      userReferenceCropsIncluded: true,
      otherUserDocumentsIncluded: false,
      fullBookletIncluded: false,
      consumerAccountPrivacyState: "unknown",
      consumerAccountPrivacyTreatment: "worst-case-training-retention-safety-review-exposure",
    });
    expect(proposal.authority).toEqual({
      providerExecutionAuthenticated: false,
      repositoryOwnerIdentityAuthenticated: false,
    });
    expect(settlement.success.proofDigest).toBe(fixtureDigest("final-proof"));
    expect(reorderedProposal.proposalDigest).toBe(proposal.proposalDigest);
    expect(reorderedAuthorization.authorizationDigest).toBe(authorization.authorizationDigest);
    const substitutedCore = {
      ...proposal,
      request: { ...proposal.request, artifactDigest: fixtureDigest("substituted-artifact") },
    };
    delete substitutedCore.proposalDigest;
    expect(() =>
      verifyPartIdentificationGate0PilotProposal(
        {
          ...substitutedCore,
          proposalDigest: partIdentificationGate0Digest(substitutedCore),
        },
        { request },
      ),
    ).toThrow(/exact retained request artifact/u);
    expect(settlement.charges).toEqual({
      modelLaunches: proposal.budgets.maxModelLaunches,
      executablePreflights: proposal.budgets.maxExecutablePreflights,
      cards: proposal.budgets.maxCards,
      providerTurns: proposal.budgets.maxProviderTurns,
      inputTokens: proposal.budgets.maxInputTokens,
      outputTokens: proposal.budgets.maxOutputTokens,
      costMicrousd: proposal.budgets.maxCostMicrousd,
      elapsedMs: proposal.budgets.maxElapsedMs,
      proofBytes: proposal.budgets.maxProofBytes,
    });
    for (const [record, digestKey] of [
      [proposal, "proposalDigest"],
      [authorization, "authorizationDigest"],
      [reservation, "reservationDigest"],
      [settlement, "settlementDigest"],
    ]) {
      const { [digestKey]: observed, ...core } = record;
      expect(observed).toBe(partIdentificationGate0Digest(core));
      expect(Object.isFrozen(record)).toBe(true);
    }
    expect(Object.keys(authorization)).not.toContain("proposal");
    expect(Object.keys(reservation)).not.toContain("authorization");
    expect(Object.keys(settlement)).not.toContain("proof");
    expect(
      verifyPartIdentificationGate0Settlement(settlement, {
        proposal,
        authorization,
        reservation,
        request,
      }),
    ).toEqual(settlement);
  });

  it("refuses non-pilot MCP packets, stale policy evidence, and hostile proposal shapes", () => {
    const fiveCardRequest = requestWith({
      cardIds: PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS.slice(0, 5),
    });
    expect(() => proposalFor(fiveCardRequest)).toThrow(/must contain 6 entries/u);

    const wrongSizes = PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS.map(
      () => PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES / 6,
    );
    wrongSizes[5] -= 1;
    expect(() => proposalFor(requestWith({ sizes: wrongSizes }))).toThrow(/exact measured/u);
    expect(() => proposalFor(requestWith({ substituteCardIndex: 0 }))).toThrow(/exact measured/u);

    const request = requestWith();
    for (const [field, value] of [
      ["maxInputTokens", 999_999],
      ["maxOutputTokens", 127_999],
      ["maxCostMicrousd", 1_999_999],
      ["maxElapsedMs", 299_999],
    ]) {
      expect(() =>
        createPartIdentificationGate0PilotProposal({
          request,
          purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
          proposedAtMs: NOW,
          policyReview: policyReview(),
          budgets: { ...budgets(request), [field]: value },
        }),
      ).toThrow(/must equal the fixed Opus 5 capacity reservation/u);
    }
    expect(() =>
      createPartIdentificationGate0PilotProposal({
        request,
        purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
        proposedAtMs: NOW,
        policyReview: policyReview(NOW - 24 * 60 * 60_000 - 1),
        budgets: budgets(request),
      }),
    ).toThrow(/current within 24 hours/u);

    const arbitraryPolicyPath = policyReview();
    arbitraryPolicyPath.sources[0].officialUrl = `${PART_IDENTIFICATION_GATE0_POLICY_SOURCES[0].officialUrl}?unreviewed=1`;
    expect(() =>
      createPartIdentificationGate0PilotProposal({
        request,
        purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
        proposedAtMs: NOW,
        policyReview: arbitraryPolicyPath,
        budgets: budgets(request),
      }),
    ).toThrow(/exact consumer-training evidence URL/u);

    const proposal = proposalFor(request);
    const forgedCore = {
      ...proposal,
      request: {
        ...proposal.request,
        requestDigest: `sha256:${"0".repeat(64)}`,
        cardsDigest: `sha256:${"0".repeat(64)}`,
        promptDigest: `sha256:${"0".repeat(64)}`,
        instruction: { byteLength: 1, digest: `sha256:${"0".repeat(64)}` },
        orderedCards: proposal.request.orderedCards.map((card, index) => ({
          ...card,
          digest: `sha256:${String(index).repeat(64)}`,
        })),
      },
      budgets: { ...proposal.budgets, maxProofBytes: 1 },
    };
    delete forgedCore.proposalDigest;
    const forgedProposal = {
      ...forgedCore,
      proposalDigest: partIdentificationGate0Digest(forgedCore),
    };
    expect(() => verifyPartIdentificationGate0PilotProposal(forgedProposal)).toThrow(
      /fixed pilot|exact fixed|proof budget/iu,
    );
    expect(() =>
      verifyPartIdentificationGate0PilotProposal({ ...proposal, extra: true }, { request }),
    ).toThrow(/not exact/u);
    let getterCalled = false;
    const accessor = { ...proposal };
    Object.defineProperty(accessor, "purpose", {
      enumerable: true,
      get() {
        getterCalled = true;
        return PART_IDENTIFICATION_GATE0_PURPOSE;
      },
    });
    expect(() => verifyPartIdentificationGate0PilotProposal(accessor, { request })).toThrow(
      /enumerable data property/u,
    );
    expect(getterCalled).toBe(false);
  });

  it("creates and fatally parses only explicit current worst-case authorization", () => {
    const request = requestWith();
    const proposal = proposalFor(request);
    const authorization = authorizationFor(proposal, {}, request);
    const bytes = Buffer.from(JSON.stringify(authorization), "utf8");

    expect(
      parsePartIdentificationGate0Authorization(bytes, {
        proposal,
        request,
        nowMs: NOW + 2_000,
      }),
    ).toEqual(authorization);
    expect(() => authorizationFor(proposal, { decision: "denied" })).toThrow(
      /exact approved trusted-local-caller assertion/u,
    );
    expect(() =>
      authorizationFor(proposal, { repositoryOwnerIdentityAuthenticated: true }),
    ).toThrow(/identity authentication absent/u);
    expect(() =>
      authorizationFor(proposal, {
        exposureAcknowledgement: {
          ...PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT,
          consumerTraining: "not-accepted",
        },
      }),
    ).toThrow(/all three worst-case/u);
    expect(() =>
      authorizationFor(proposal, {
        notAfterMs: NOW + PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS + 1,
      }),
    ).toThrow(/short current/u);
    const lateAuthorization = NOW + PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS;
    expect(() =>
      authorizationFor(proposal, {
        authorizedAtMs: lateAuthorization,
        notBeforeMs: lateAuthorization,
        notAfterMs: lateAuthorization + PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS,
        nowMs: lateAuthorization,
      }),
    ).toThrow(/short current/u);
    expect(() =>
      verifyPartIdentificationGate0Authorization(authorization, {
        proposal,
        request,
        nowMs: authorization.notAfterMs + 1,
      }),
    ).toThrow(/short current/u);

    const duplicate = Buffer.from(
      JSON.stringify(authorization).replace(
        '"decision":"approved"',
        '"decision":"approved","decision":"approved"',
      ),
      "utf8",
    );
    expect(() =>
      parsePartIdentificationGate0Authorization(duplicate, {
        proposal,
        request,
        nowMs: NOW + 2_000,
      }),
    ).toThrow(/fatal strict/u);
    expect(() =>
      parsePartIdentificationGate0Authorization(Buffer.from([0xff]), {
        proposal,
        request,
        nowMs: NOW + 2_000,
      }),
    ).toThrow(/fatal strict/u);

    const inheritedToJson = Object.getOwnPropertyDescriptor(Object.prototype, "toJSON");
    try {
      Object.defineProperty(Object.prototype, "toJSON", {
        configurable: true,
        value: () => "prototype-poison",
      });
      expect(() =>
        authorizationFor(
          proposal,
          {
            exposureAcknowledgement: {
              consumerTraining: "not-accepted",
              consumerRetention: "not-accepted",
              consumerSafetyReview: "not-accepted",
            },
          },
          request,
        ),
      ).toThrow(/all three worst-case/u);
    } finally {
      if (inheritedToJson === undefined) delete Object.prototype.toJSON;
      else Object.defineProperty(Object.prototype, "toJSON", inheritedToJson);
    }
  });

  it("binds reservations and settlements to one exact request lineage", () => {
    const { request, proposal, authorization, reservation } = fixture();
    const otherRequest = requestWith({ instruction: "a different verified request" });
    expect(() =>
      verifyPartIdentificationGate0LaunchReservation(reservation, {
        proposal,
        authorization,
        request: otherRequest,
      }),
    ).toThrow(/exact measured|proposal|authorization|bind/iu);

    const otherReservation = reservationFor(request, proposal, authorization, "reservation-b");
    const settlement = createPartIdentificationGate0Settlement({
      proposal,
      authorization,
      reservation,
      request,
      settledAtMs: NOW + 365 * 24 * 60 * 60_000,
      result: {
        status: "failure",
        category: "provider-stream",
        failureDigest: fixtureDigest("bounded-failure"),
        failureByteLength: 128,
      },
    });
    expect(settlement.failure).toEqual({
      category: "provider-stream",
      failureDigest: fixtureDigest("bounded-failure"),
      failureByteLength: 128,
      providerExecutionState: "unknown-conservatively-charged",
    });
    expect(settlement.settledAtMs).toBeGreaterThan(
      reservation.reservedAtMs + proposal.budgets.maxElapsedMs,
    );
    expect(() =>
      verifyPartIdentificationGate0Settlement(settlement, {
        proposal,
        authorization,
        reservation: otherReservation,
        request,
      }),
    ).toThrow(/reservation|lineage/u);
    expect(() =>
      verifyPartIdentificationGate0LaunchReservation(
        {
          ...reservation,
          budgets: {
            ...reservation.budgets,
            maxCostMicrousd: reservation.budgets.maxCostMicrousd - 1,
          },
        },
        { proposal, authorization, request },
      ),
    ).toThrow(/bind|digest|budgets/u);
  });

  it("bounds both settlement branches and rejects accessor-backed results without reading them", () => {
    const { request, proposal, authorization, reservation } = fixture();
    const base = { proposal, authorization, reservation, request, settledAtMs: NOW + 4_000 };
    expect(() =>
      createPartIdentificationGate0Settlement({
        ...base,
        result: {
          status: "success",
          proofDigest: fixtureDigest("proof"),
          proofByteLength: proposal.budgets.maxProofBytes + 1,
          providerTurns: 1,
          inputTokens: 1,
          outputTokens: 1,
          costMicrousd: 1,
          elapsedMs: 1,
        },
      }),
    ).toThrow(/proofByteLength/u);
    expect(() =>
      createPartIdentificationGate0Settlement({
        ...base,
        result: {
          status: "failure",
          category: "unbounded-arbitrary-category",
          failureDigest: fixtureDigest("failure"),
          failureByteLength: 1,
        },
      }),
    ).toThrow(/category/u);

    let getterCalled = false;
    const hostileResult = {};
    Object.defineProperty(hostileResult, "status", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "failure";
      },
    });
    expect(() =>
      createPartIdentificationGate0Settlement({ ...base, result: hostileResult }),
    ).toThrow(/enumerable data property/u);
    expect(getterCalled).toBe(false);
  });

  it("keeps verification deterministic after ambient prototype poisoning", () => {
    const proposal = proposalFor();
    const standaloneCore = {
      ...proposal,
      request: {
        ...proposal.request,
        artifactDigest: PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.digest,
        artifactByteLength: PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.byteLength,
      },
    };
    delete standaloneCore.proposalDigest;
    const standaloneProposal = {
      ...standaloneCore,
      proposalDigest: partIdentificationGate0Digest(standaloneCore),
    };
    const moduleUrl = new URL("./part-identification-gate0.mjs", import.meta.url).href;
    const encoded = Buffer.from(JSON.stringify(standaloneProposal), "utf8").toString("base64");
    const script = `
      const gate0 = await import(process.argv[1]);
      const { createHash } = await import("node:crypto");
      const poison = () => { throw new Error("poisoned primordial"); };
      for (const name of ["map", "some", "reduce", "includes"])
        Object.defineProperty(Array.prototype, name, { value: poison });
      Object.defineProperty(Object, "keys", { value: poison });
      Object.defineProperty(Object.prototype, "toJSON", { value: poison });
      Object.defineProperty(Array.prototype, "toJSON", { value: poison });
      Object.defineProperty(String.prototype, "endsWith", { value: poison });
      Object.defineProperty(Set.prototype, "has", { value: poison });
      Object.defineProperty(Object.getPrototypeOf(createHash("sha256")), "digest", { value: poison });
      gate0.verifyPartIdentificationGate0PilotProposal(
        JSON.parse(Buffer.from(process.argv[2], "base64").toString("utf8")),
      );
    `;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, moduleUrl, encoded],
      {
        encoding: "utf8",
      },
    );
    expect(child.status, child.stderr).toBe(0);
  });
});
