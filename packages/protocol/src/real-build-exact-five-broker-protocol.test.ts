import { readFileSync } from "node:fs";

import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import {
  parseRealBuildExactFiveBrokerConsumptionExchangeV1,
  REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS,
  SCHEMA_IDS,
  validateRealBuildExactFiveBrokerChallengeStructureV1,
  validateRealBuildExactFiveBrokerChallengeV1,
  validateRealBuildExactFiveBrokerConsumptionExchangeV1,
  validateRealBuildExactFiveBrokerConsumptionReceiptStructureV1,
  validateRealBuildExactFiveBrokerConsumptionReceiptV1,
  validateRealBuildExactFiveBrokerConsumptionTimelineV1,
  validateRealBuildExactFiveBrokerMonotonicTimelineV1,
  type RealBuildExactFiveBrokerChallengeV1,
  type RealBuildExactFiveBrokerConsumptionReceiptV1,
} from "./index.js";

const HASH = `sha256:${"a".repeat(64)}` as const;

const challenge = {
  schemaVersion: "lego.real-build-exact-five-broker-challenge/1",
  namespace: "test",
  purpose: "admit-exact-five-official-frame-equivalence",
  scope: "exact-five-source-parity-calibration-panels-only",
  requestDigest: HASH,
  reviewPresentationDigest: HASH,
  trustBindingDigest: HASH,
  challengeNonce: "b".repeat(64),
  issuedAtUnixMs: 1_777_000_000_000,
} satisfies RealBuildExactFiveBrokerChallengeV1;

const receipt = {
  schemaVersion: "lego.real-build-exact-five-broker-consumption-receipt/1",
  signatureDomain: "lego.real-build-exact-five-broker-consumption-receipt-signature/1",
  namespace: "test",
  purpose: challenge.purpose,
  scope: challenge.scope,
  requestDigest: challenge.requestDigest,
  challengeNonce: challenge.challengeNonce,
  audience: "paired-web-client",
  stableOrigin: "http://127.0.0.1:5173",
  pairedDeviceId: "paired-device-1",
  brokerInstallId: "broker-install-1",
  decision: "approved",
  reviewPresentationDigest: HASH,
  brokerReleaseId: "broker-release-1",
  brokerEventId: "event-1",
  consumedAtUnixMs: challenge.issuedAtUnixMs + 1_000,
  ledgerSequence: 1,
  previousLedgerRoot: HASH,
  consumptionEventHash: HASH,
  resultingLedgerRoot: HASH,
  seal: {
    algorithm: "Ed25519",
    keyId: "broker-key-1",
    keyEpoch: 1,
    signature: "A".repeat(86),
  },
} satisfies RealBuildExactFiveBrokerConsumptionReceiptV1;

describe("real-build exact-five broker protocol", () => {
  it("exports strict roots for a challenge and post-consumption receipt", () => {
    const exportedSchema = JSON.parse(
      readFileSync(new URL(import.meta.resolve("@lego-studio/protocol/schema")), "utf8"),
    ) as object;
    const externalAjv = new Ajv({ strict: true });
    externalAjv.addSchema(exportedSchema);
    for (const [name, schemaId] of Object.entries(SCHEMA_IDS)) {
      expect(externalAjv.getSchema(schemaId), name).toBeTypeOf("function");
    }
    const externalReceipt = externalAjv.getSchema(
      SCHEMA_IDS.realBuildExactFiveBrokerConsumptionReceiptV1,
    )!;
    expect(validateRealBuildExactFiveBrokerChallengeV1(challenge)).toBe(true);
    expect(validateRealBuildExactFiveBrokerConsumptionReceiptV1(receipt)).toBe(true);
    expect(
      externalReceipt({
        ...receipt,
        seal: { ...receipt.seal, signature: `${"A".repeat(86)}\n` },
      }),
    ).toBe(false);
    const lineTerminatorPatches: Array<Record<string, string>> = [
      { requestDigest: `${receipt.requestDigest}\n` },
      { challengeNonce: `${receipt.challengeNonce}\n` },
    ];
    for (const terminator of ["\n", "\r", "\u000b", "\u000c", "\u0085", "\u2028", "\u2029"]) {
      lineTerminatorPatches.push(
        { audience: `${receipt.audience}${terminator}` },
        { stableOrigin: `${receipt.stableOrigin}${terminator}` },
      );
    }
    for (const patch of lineTerminatorPatches) {
      expect(validateRealBuildExactFiveBrokerConsumptionReceiptV1({ ...receipt, ...patch })).toBe(
        false,
      );
      expect(externalReceipt({ ...receipt, ...patch })).toBe(false);
    }
  });

  it("rejects namespace, nonce, scope, and unknown-field drift", () => {
    expect(
      validateRealBuildExactFiveBrokerChallengeV1({ ...challenge, namespace: "evaluation" }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerChallengeV1({ ...challenge, challengeNonce: "b".repeat(63) }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerChallengeV1({
        ...challenge,
        issuedAtUnixMs: -1,
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        scope: "all-359-panels",
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        purpose: "admit-all-panels",
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        decision: "denied",
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        embeddedPublicKey: "caller-controlled",
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        stableOrigin: "http://127.0.0.1:65535",
      }),
    ).toBe(true);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        stableOrigin: "http://127.0.0.1:65536",
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        consumedAtUnixMs: -1,
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        seal: { ...receipt.seal, signature: `${"A".repeat(85)}B` },
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        seal: { ...receipt.seal, signature: `${"A".repeat(86)}\n` },
      }),
    ).toBe(false);
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        seal: { ...receipt.seal, algorithm: "ECDSA" },
      }),
    ).toBe(false);

    const { namespace, ...withoutNamespace } = receipt;
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1(
        Object.assign(Object.create({ namespace }), withoutNamespace),
      ),
    ).toBe(false);
    const { algorithm, ...withoutAlgorithm } = receipt.seal;
    expect(
      validateRealBuildExactFiveBrokerConsumptionReceiptV1({
        ...receipt,
        seal: Object.assign(Object.create({ algorithm }), withoutAlgorithm),
      }),
    ).toBe(false);
  });

  it("labels standalone schema checks as structural and requires paired exchange semantics", () => {
    const beforeIssue = { ...receipt, consumedAtUnixMs: challenge.issuedAtUnixMs - 100_000 };
    expect(validateRealBuildExactFiveBrokerChallengeStructureV1(challenge)).toBe(true);
    expect(validateRealBuildExactFiveBrokerConsumptionReceiptStructureV1(beforeIssue)).toBe(true);
    expect(validateRealBuildExactFiveBrokerChallengeV1).toBe(
      validateRealBuildExactFiveBrokerChallengeStructureV1,
    );
    expect(validateRealBuildExactFiveBrokerConsumptionReceiptV1).toBe(
      validateRealBuildExactFiveBrokerConsumptionReceiptStructureV1,
    );
    expect(
      validateRealBuildExactFiveBrokerConsumptionExchangeV1({
        challenge,
        receipt: beforeIssue,
        observedAtUnixMs: challenge.issuedAtUnixMs,
      }),
    ).toBe(false);
  });

  it("enforces inclusive two-minute exchange boundaries and every clock ordering", () => {
    const issuedAtUnixMs = challenge.issuedAtUnixMs;
    const expiresAtUnixMs = issuedAtUnixMs + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS;
    for (const [consumedAtUnixMs, observedAtUnixMs] of [
      [issuedAtUnixMs, issuedAtUnixMs],
      [expiresAtUnixMs, expiresAtUnixMs],
    ]) {
      expect(
        validateRealBuildExactFiveBrokerConsumptionExchangeV1({
          challenge,
          receipt: { ...receipt, consumedAtUnixMs },
          observedAtUnixMs,
        }),
      ).toBe(true);
    }
    for (const [issued, consumed, observed] of [
      [issuedAtUnixMs, issuedAtUnixMs - 1, issuedAtUnixMs],
      [issuedAtUnixMs, expiresAtUnixMs + 1, expiresAtUnixMs + 1],
      [issuedAtUnixMs, issuedAtUnixMs + 1, issuedAtUnixMs],
      [issuedAtUnixMs, issuedAtUnixMs, expiresAtUnixMs + 1],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      [issuedAtUnixMs, issuedAtUnixMs, Number.NaN],
    ]) {
      expect(
        validateRealBuildExactFiveBrokerConsumptionExchangeV1({
          challenge: { ...challenge, issuedAtUnixMs: issued },
          receipt: { ...receipt, consumedAtUnixMs: consumed },
          observedAtUnixMs: observed,
        }),
      ).toBe(false);
    }
  });

  it("cross-binds every challenge field represented in the receipt", () => {
    for (const [patch, path, expectedFragments] of [
      [{ namespace: "production" }, "/receipt/namespace", ['"production"', '"test"']],
      [{ purpose: "different-purpose" }, "/receipt/purpose", [challenge.purpose]],
      [{ scope: "different-scope" }, "/receipt/scope", [challenge.scope]],
      [
        { requestDigest: `sha256:${"c".repeat(64)}` },
        "/receipt/requestDigest",
        [`sha256:${"c".repeat(64)}`, challenge.requestDigest],
      ],
      [
        { challengeNonce: "c".repeat(64) },
        "/receipt/challengeNonce",
        ["must reproduce the held 64-hex nonce exactly"],
      ],
      [
        { reviewPresentationDigest: `sha256:${"d".repeat(64)}` },
        "/receipt/reviewPresentationDigest",
        [`sha256:${"d".repeat(64)}`, challenge.reviewPresentationDigest],
      ],
    ] as const) {
      const exchange = {
        challenge,
        receipt: { ...receipt, ...patch },
        observedAtUnixMs: receipt.consumedAtUnixMs,
      };
      expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1(exchange)).toBe(false);
      expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors?.[0]?.instancePath).toBe(
        path,
      );
      try {
        parseRealBuildExactFiveBrokerConsumptionExchangeV1(exchange);
        throw new Error("Expected exact-five exchange parsing to refuse mismatched binding.");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        const message = (error as TypeError).message;
        expect(message).toContain(`failed at ${path}:`);
        for (const fragment of expectedFragments) expect(message).toContain(fragment);
      }
    }
  });

  it("returns a detached frozen exchange instead of narrowing caller-owned storage", () => {
    const mutable = structuredClone({
      challenge,
      receipt,
      observedAtUnixMs: receipt.consumedAtUnixMs,
    });
    const parsed = parseRealBuildExactFiveBrokerConsumptionExchangeV1(mutable);
    mutable.receipt.consumedAtUnixMs += 1;
    expect(parsed.receipt.consumedAtUnixMs).toBe(receipt.consumedAtUnixMs);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.challenge)).toBe(true);
    expect(Object.isFrozen(parsed.receipt)).toBe(true);
    expect(Object.isFrozen(parsed.receipt.seal)).toBe(true);
    expect(() =>
      parseRealBuildExactFiveBrokerConsumptionExchangeV1(new Proxy(mutable, {})),
    ).toThrow(/structured-cloneable/u);
    expect(() =>
      parseRealBuildExactFiveBrokerConsumptionExchangeV1({
        ...mutable,
        challenge: { ...mutable.challenge, namespace: "evaluation" },
      }),
    ).toThrow(/failed at \/challenge\/namespace: must be one of "production", "test"/u);
  });

  it("keeps detachment and timeline refusal after ambient primordial replacement", () => {
    const originalStructuredClone = globalThis.structuredClone;
    const originalObjectEntries = Object.entries;
    const originalObjectFreeze = Object.freeze;
    const originalSafeInteger = Number.isSafeInteger;
    const originalFinite = Number.isFinite;
    try {
      globalThis.structuredClone = ((value: unknown) => value) as typeof structuredClone;
      Object.entries = (() => []) as typeof Object.entries;
      Object.freeze = ((value: unknown) => value) as typeof Object.freeze;
      Number.isSafeInteger = () => true;
      Number.isFinite = () => true;

      expect(
        validateRealBuildExactFiveBrokerConsumptionTimelineV1({
          issuedAtUnixMs: challenge.issuedAtUnixMs,
          consumedAtUnixMs: challenge.issuedAtUnixMs,
          inspectionStartedAtUnixMs: challenge.issuedAtUnixMs,
          inspectionFinishedAtUnixMs:
            challenge.issuedAtUnixMs + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS + 1,
        }),
      ).toBe(false);
      expect(
        validateRealBuildExactFiveBrokerMonotonicTimelineV1({
          issuedAtMonotonicMs: 1,
          inspectionStartedAtMonotonicMs: 2,
          inspectionFinishedAtMonotonicMs: Number.NaN,
        }),
      ).toBe(false);

      const mutable = structuredClone({
        challenge,
        receipt,
        observedAtUnixMs: receipt.consumedAtUnixMs,
      });
      const parsed = parseRealBuildExactFiveBrokerConsumptionExchangeV1(mutable);
      expect(parsed).not.toBe(mutable);
      expect(Object.isFrozen(mutable)).toBe(false);
      expect(Object.isFrozen(parsed)).toBe(true);
    } finally {
      globalThis.structuredClone = originalStructuredClone;
      Object.entries = originalObjectEntries;
      Object.freeze = originalObjectFreeze;
      Number.isSafeInteger = originalSafeInteger;
      Number.isFinite = originalFinite;
    }
  });

  it("shares one four-sample timeline contract with pre- and post-verification consumers", () => {
    const issuedAtUnixMs = challenge.issuedAtUnixMs;
    const expiresAtUnixMs = issuedAtUnixMs + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS;
    expect(
      validateRealBuildExactFiveBrokerConsumptionTimelineV1({
        issuedAtUnixMs,
        consumedAtUnixMs: issuedAtUnixMs,
        inspectionStartedAtUnixMs: issuedAtUnixMs,
        inspectionFinishedAtUnixMs: expiresAtUnixMs,
      }),
    ).toBe(true);
    for (const [timeline, path, message] of [
      [
        {
          issuedAtUnixMs,
          consumedAtUnixMs: issuedAtUnixMs - 1,
          inspectionStartedAtUnixMs: issuedAtUnixMs,
          inspectionFinishedAtUnixMs: issuedAtUnixMs,
        },
        "/consumedAtUnixMs",
        /precedes issuedAtUnixMs/u,
      ],
      [
        {
          issuedAtUnixMs,
          consumedAtUnixMs: issuedAtUnixMs + 2,
          inspectionStartedAtUnixMs: issuedAtUnixMs + 1,
          inspectionFinishedAtUnixMs: issuedAtUnixMs + 2,
        },
        "/inspectionStartedAtUnixMs",
        /precedes consumedAtUnixMs/u,
      ],
      [
        {
          issuedAtUnixMs,
          consumedAtUnixMs: issuedAtUnixMs,
          inspectionStartedAtUnixMs: issuedAtUnixMs + 2,
          inspectionFinishedAtUnixMs: issuedAtUnixMs + 1,
        },
        "/inspectionFinishedAtUnixMs",
        /precedes inspectionStartedAtUnixMs/u,
      ],
      [
        {
          issuedAtUnixMs,
          consumedAtUnixMs: issuedAtUnixMs,
          inspectionStartedAtUnixMs: issuedAtUnixMs,
          inspectionFinishedAtUnixMs: expiresAtUnixMs + 1,
        },
        "/inspectionFinishedAtUnixMs",
        /exceeds challenge expiry/u,
      ],
      [
        {
          issuedAtUnixMs: Number.MAX_SAFE_INTEGER,
          consumedAtUnixMs: Number.MAX_SAFE_INTEGER,
          inspectionStartedAtUnixMs: Number.MAX_SAFE_INTEGER,
          inspectionFinishedAtUnixMs: Number.MAX_SAFE_INTEGER,
        },
        "/issuedAtUnixMs",
        /cannot form a safe two-minute expiry/u,
      ],
    ] as const) {
      expect(validateRealBuildExactFiveBrokerConsumptionTimelineV1(timeline)).toBe(false);
      expect(validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors?.[0]?.instancePath).toBe(
        path,
      );
      expect(validateRealBuildExactFiveBrokerConsumptionTimelineV1.errors?.[0]?.message).toMatch(
        message,
      );
    }
  });

  it("enforces monotonic elapsed time independently of wall-clock movement", () => {
    expect(
      validateRealBuildExactFiveBrokerMonotonicTimelineV1({
        issuedAtMonotonicMs: 1.25,
        inspectionStartedAtMonotonicMs: 2.5,
        inspectionFinishedAtMonotonicMs: 1.25 + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS,
      }),
    ).toBe(true);
    for (const [timeline, path, message] of [
      [
        {
          issuedAtMonotonicMs: 2,
          inspectionStartedAtMonotonicMs: 1,
          inspectionFinishedAtMonotonicMs: 2,
        },
        "/inspectionStartedAtMonotonicMs",
        /precedes issuedAtMonotonicMs/u,
      ],
      [
        {
          issuedAtMonotonicMs: 1,
          inspectionStartedAtMonotonicMs: 3,
          inspectionFinishedAtMonotonicMs: 2,
        },
        "/inspectionFinishedAtMonotonicMs",
        /precedes inspectionStartedAtMonotonicMs/u,
      ],
      [
        {
          issuedAtMonotonicMs: 1,
          inspectionStartedAtMonotonicMs: 2,
          inspectionFinishedAtMonotonicMs:
            1 + REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS + 0.001,
        },
        "/inspectionFinishedAtMonotonicMs",
        /must finish within 120000 ms/u,
      ],
      [
        {
          issuedAtMonotonicMs: 1,
          inspectionStartedAtMonotonicMs: 2,
          inspectionFinishedAtMonotonicMs: Number.NaN,
        },
        "/inspectionFinishedAtMonotonicMs",
        /finite non-negative/u,
      ],
    ] as const) {
      expect(validateRealBuildExactFiveBrokerMonotonicTimelineV1(timeline)).toBe(false);
      expect(validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors?.[0]?.instancePath).toBe(
        path,
      );
      expect(validateRealBuildExactFiveBrokerMonotonicTimelineV1.errors?.[0]?.message).toMatch(
        message,
      );
    }
  });
});
