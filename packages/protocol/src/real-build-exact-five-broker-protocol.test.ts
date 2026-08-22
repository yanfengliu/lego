import { readFileSync } from "node:fs";

import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import {
  SCHEMA_IDS,
  validateRealBuildExactFiveBrokerChallengeV1,
  validateRealBuildExactFiveBrokerConsumptionReceiptV1,
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
    expect(validateRealBuildExactFiveBrokerChallengeV1(challenge)).toBe(true);
    expect(validateRealBuildExactFiveBrokerConsumptionReceiptV1(receipt)).toBe(true);
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
});
