import { describe, expect, it } from "vitest";

import {
  parseRealBuildExactFiveBrokerConsumptionExchangeV1,
  validateRealBuildExactFiveBrokerConsumptionExchangeV1,
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
  seal: { algorithm: "Ed25519", keyId: "broker-key-1", keyEpoch: 1, signature: "A".repeat(86) },
} satisfies RealBuildExactFiveBrokerConsumptionReceiptV1;

describe("real-build exact-five broker diagnostics", () => {
  it("does not narrow caller storage after validating only a detached clone", () => {
    let reads = 0;
    const callerOwned = {
      challenge,
      receipt,
      get observedAtUnixMs(): number | string {
        reads += 1;
        return reads === 1 ? receipt.consumedAtUnixMs : "not-a-number";
      },
    };
    expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1(callerOwned)).toBe(true);
    expect(reads).toBe(1);
    expect(callerOwned.observedAtUnixMs).toBe("not-a-number");
  });

  it("explains final-line aliases instead of exposing Ajv's generic not error", () => {
    for (const [exchange, path] of [
      [
        {
          challenge: { ...challenge, requestDigest: `${challenge.requestDigest}\n` },
          receipt,
          observedAtUnixMs: receipt.consumedAtUnixMs,
        },
        "/challenge/requestDigest",
      ],
      [
        {
          challenge,
          receipt: { ...receipt, audience: `${receipt.audience}\u0085` },
          observedAtUnixMs: receipt.consumedAtUnixMs,
        },
        "/receipt/audience",
      ],
    ] as const) {
      expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1(exchange)).toBe(false);
      expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors?.[0]?.instancePath).toBe(
        path,
      );
      expect(() => parseRealBuildExactFiveBrokerConsumptionExchangeV1(exchange)).toThrow(
        new RegExp(
          `failed at ${path}: must use one uninterrupted ASCII wire spelling with no CR, LF, vertical tab, form feed, NEL, Unicode line separator, or Unicode paragraph separator\\.`,
          "u",
        ),
      );
    }
  });

  it("bounds and escapes hostile unsupported property names", () => {
    for (const additionalProperty of ["evil\nfield", "x".repeat(1_000)]) {
      const exchange = {
        challenge: { ...challenge, [additionalProperty]: true },
        receipt,
        observedAtUnixMs: receipt.consumedAtUnixMs,
      };
      expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1(exchange)).toBe(false);
      try {
        parseRealBuildExactFiveBrokerConsumptionExchangeV1(exchange);
        throw new Error("Expected an unsupported challenge property to be refused.");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        const message = (error as TypeError).message;
        expect(message).toContain("must not contain unsupported property");
        expect(message).not.toContain("\n");
        expect(message.length).toBeLessThan(768);
      }
    }
  });

  it("describes invalid observed time types without multiline or unbounded output", () => {
    const longString = "x".repeat(1_000);
    for (const [observedAtUnixMs, expected] of [
      [Number.NaN, /NaN/u],
      [-1, /-1/u],
      [Number.MAX_SAFE_INTEGER + 1, /9007199254740992/u],
      [receipt.consumedAtUnixMs + 0.5, /1777000001000\.5/u],
      ["12\n34", /"12\\u000a34"/u],
      [longString, /truncated from 1000 code units/u],
      [{}, /an object value/u],
      [[], /an array value/u],
      [1n, /a bigint value/u],
      [undefined, /undefined/u],
    ] as const) {
      const exchange = { challenge, receipt, observedAtUnixMs };
      expect(validateRealBuildExactFiveBrokerConsumptionExchangeV1(exchange)).toBe(false);
      const diagnostic = validateRealBuildExactFiveBrokerConsumptionExchangeV1.errors?.[0];
      expect(diagnostic).toMatchObject({ instancePath: "/observedAtUnixMs" });
      const message = diagnostic?.message;
      if (message === undefined) throw new Error("Expected one exact-five clock diagnostic.");
      expect(message).toMatch(expected);
      expect(message).not.toContain("\n");
      expect(message.length).toBeLessThan(512);
      try {
        parseRealBuildExactFiveBrokerConsumptionExchangeV1(exchange);
        throw new Error("Expected the invalid observed time to be refused.");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect((error as TypeError).message).toMatch(expected);
        expect((error as TypeError).message).not.toContain("\n");
        expect((error as TypeError).message.length).toBeLessThan(768);
      }
    }
  });
});

function cloneFirstValidatorsDoNotNarrow(value: unknown): void {
  if (validateRealBuildExactFiveBrokerConsumptionExchangeV1(value)) {
    // @ts-expect-error A boolean clone-first check cannot narrow unvalidated caller storage.
    void value.observedAtUnixMs;
  }
  if (validateRealBuildExactFiveBrokerConsumptionTimelineV1(value)) {
    // @ts-expect-error A boolean clone-first check cannot narrow unvalidated caller storage.
    void value.issuedAtUnixMs;
  }
  if (validateRealBuildExactFiveBrokerMonotonicTimelineV1(value)) {
    // @ts-expect-error A boolean clone-first check cannot narrow unvalidated caller storage.
    void value.issuedAtMonotonicMs;
  }
}
void cloneFirstValidatorsDoNotNarrow;
