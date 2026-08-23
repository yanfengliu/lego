import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const boundaries = vi.hoisted(() => ({ proof: null, proofReservation: 2_088_511 }));
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
    estimatePartIdentificationProofReservation: () => boundaries.proofReservation,
  };
});
vi.mock("./part-identification-call-proof.mjs", () => ({
  inspectFinalizedPartIdentificationCallProof(value) {
    if (value !== boundaries.proof) throw new Error("production-branded finalized proof required");
    return value.metadata;
  },
}));

import {
  assertPartIdentificationGate0AdmissionCapability,
  claimPartIdentificationGate0Launch,
  consumePartIdentificationGate0Admission,
  settlePartIdentificationGate0Launch,
  __testOnly,
} from "./part-identification-gate0-store.mjs";
import {
  GATE0_TEST_NOW as NOW,
  gate0TestDigest as fixtureDigest,
  gate0TestFixture as fixture,
} from "./part-identification-gate0-test-fixture.mjs";

const roots = [];
const openPartIdentificationGate0Admission = __testOnly.openRaw;
const reservePartIdentificationGate0Admission = __testOnly.reserveRaw;

afterEach(() => {
  boundaries.proof = null;
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

function stateRoot() {
  const root = join(tmpdir(), `lego-gate0-store-${process.pid}-${Date.now()}-${roots.length}`);
  mkdirSync(root);
  roots.push(root);
  return root;
}

function admissionInput(records) {
  return {
    request: records.request,
    proposal: records.proposal,
    authorization: records.authorization,
    reservationNonceDigest: fixtureDigest("reservation-a"),
  };
}

function testOptions(root, clock) {
  return __testOnly.clockOptions(root, clock);
}

describe("Gate-0 local admission store", () => {
  it("persists one conservative launch and a launch-bound terminal failure", () => {
    const root = stateRoot();
    const records = fixture();
    let now = NOW + 2_000;
    const options = testOptions(root, () => now);
    const capability = reservePartIdentificationGate0Admission(admissionInput(records), options);
    expect(Reflect.ownKeys(capability)).toEqual([]);
    expect(() => assertPartIdentificationGate0AdmissionCapability(capability)).toThrow(
      /rejects test-root or raw capabilities/u,
    );
    expect(() => reservePartIdentificationGate0Admission(admissionInput(records), options)).toThrow(
      /already exists/u,
    );

    const paths = __testOnly.statePaths(
      records.authorization.authorizationDigest,
      records.proposal.request.artifactDigest,
    );
    expect(existsSync(join(root, paths.request))).toBe(true);
    expect(existsSync(join(root, paths.reservation))).toBe(true);
    expect(existsSync(join(root, paths.launch))).toBe(false);

    const reopened = openPartIdentificationGate0Admission(
      { authorizationDigest: records.authorization.authorizationDigest },
      options,
    );
    const ticket = consumePartIdentificationGate0Admission(reopened);
    expect(existsSync(join(root, paths.launch))).toBe(true);
    expect(() => consumePartIdentificationGate0Admission(reopened)).toThrow(/already consumed/u);
    const claimed = claimPartIdentificationGate0Launch(ticket);
    expect(claimed.launch).toMatchObject({
      launchOrdinal: 1,
      providerExecutionState: "unknown-conservatively-charged-after-durable-claim",
    });
    expect(claimed.launch.conservativeCharges.costMicrousd).toBe(2_000_000);
    expect(() => claimPartIdentificationGate0Launch(ticket)).toThrow(/already claimed/u);

    now = NOW + 4_000;
    const terminal = settlePartIdentificationGate0Launch(ticket, {
      status: "failure",
      evidence: "provider-launch",
    });
    expect(terminal.launchDigest).toBe(claimed.launch.launchDigest);
    expect(terminal.consumedAtMs).toBe(claimed.launch.consumedAtMs);
    expect(terminal.launchOrdinal).toBe(1);
    expect(terminal.settlement.failure.failureDigest).toBe(terminal.evidence.digest);
    expect(existsSync(join(root, paths.evidence))).toBe(true);
    expect(existsSync(join(root, paths.settlement))).toBe(true);
    expect(() =>
      settlePartIdentificationGate0Launch(ticket, {
        status: "failure",
        evidence: "provider-launch",
      }),
    ).toThrow(/already has a terminal/u);

    expect(() => consumePartIdentificationGate0Admission(capability)).toThrow(/already exists/u);
  });

  it("derives a success only from the opaque finalized-proof boundary", () => {
    const root = stateRoot();
    const records = fixture();
    let now = NOW + 2_000;
    const options = testOptions(root, () => now);
    const capability = reservePartIdentificationGate0Admission(admissionInput(records), options);
    const ticket = consumePartIdentificationGate0Admission(capability);
    claimPartIdentificationGate0Launch(ticket);
    expect(() =>
      settlePartIdentificationGate0Launch(ticket, { status: "success", evidence: {} }),
    ).toThrow(/production-branded/u);

    const bytes = Buffer.from('{"sanitized":"proof"}', "utf8");
    const proofDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    boundaries.proof = {
      metadata: {
        bytes,
        byteLength: bytes.length,
        digest: proofDigest,
        request: {
          requestDigest: records.proposal.request.requestDigest,
          cardsDigest: records.proposal.request.cardsDigest,
          promptDigest: records.proposal.request.promptDigest,
          instruction: records.proposal.request.instruction,
          orderedCards: records.proposal.request.orderedCards,
          modelIdentity: records.proposal.model,
        },
        usage: { inputTokens: 4_000, outputTokens: 800, costMicrousd: 123_456 },
        elapsedMs: 1_500,
        providerTurns: 2,
      },
    };
    now = NOW + 4_000;
    const terminal = settlePartIdentificationGate0Launch(ticket, {
      status: "success",
      evidence: boundaries.proof,
    });
    expect(terminal.settlement.success).toMatchObject({
      proofDigest,
      proofByteLength: bytes.length,
      inputTokens: 4_000,
      outputTokens: 800,
      costMicrousd: 123_456,
    });
  });

  it("uses its own current clock and rejects caller backdating", () => {
    const root = stateRoot();
    const records = fixture();
    const options = testOptions(root, () => NOW + 6 * 60_000);
    expect(() => reservePartIdentificationGate0Admission(admissionInput(records), options)).toThrow(
      /window/u,
    );
    expect(existsSync(join(root, "reservations"))).toBe(false);
  });

  it("detects retained-lineage tampering before publishing launch-start", () => {
    const root = stateRoot();
    const records = fixture();
    const options = testOptions(root, () => NOW + 2_000);
    const capability = reservePartIdentificationGate0Admission(admissionInput(records), options);
    const paths = __testOnly.statePaths(
      records.authorization.authorizationDigest,
      records.proposal.request.artifactDigest,
    );
    writeFileSync(join(root, paths.reservation), "tampered");
    expect(() => consumePartIdentificationGate0Admission(capability)).toThrow(
      /exact canonical retained bytes/u,
    );
    expect(existsSync(join(root, paths.launch))).toBe(false);
  });

  it("rejects a copied reservation bundle under an authorization-digest alias", () => {
    const root = stateRoot();
    const records = fixture();
    const options = testOptions(root, () => NOW + 2_000);
    reservePartIdentificationGate0Admission(admissionInput(records), options);
    const sourcePaths = __testOnly.statePaths(
      records.authorization.authorizationDigest,
      records.proposal.request.artifactDigest,
    );
    const aliasDigest = fixtureDigest("authorization-alias");
    const aliasPaths = __testOnly.statePaths(aliasDigest, records.proposal.request.artifactDigest);
    writeFileSync(
      join(root, aliasPaths.reservation),
      readFileSync(join(root, sourcePaths.reservation)),
      { flag: "wx" },
    );

    expect(() =>
      openPartIdentificationGate0Admission({ authorizationDigest: aliasDigest }, options),
    ).toThrow(/path digest does not equal the verified authorization digest/u);
    expect(existsSync(join(root, aliasPaths.launch))).toBe(false);
  });

  it("has no direct provider execution path", () => {
    const source = readFileSync(
      new URL("./part-identification-gate0-store.mjs", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/runPartIdentificationClaudeTransport|runBoundedChild/u);
  });
});
