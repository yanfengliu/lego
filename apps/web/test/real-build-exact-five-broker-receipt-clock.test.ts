import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import type { RealBuildExactFiveBrokerConsumptionReceiptV1 } from "@lego-studio/protocol";
import { describe, expect, it, vi } from "vitest";

import type {
  RealBuildExactFiveBrokerConsumptionEventInput,
  RealBuildExactFiveBrokerConsumptionReceiptCore,
  RealBuildExactFiveBrokerReceiptSignatureHeader,
  RealBuildExactFiveBrokerTrustPin,
} from "../e2e/real-build-exact-five-broker-receipt";

type ReceiptModule = typeof import("../e2e/real-build-exact-five-broker-receipt");

const ENCODER = new TextEncoder();

function digest(value: string): Sha256Digest {
  return `sha256:${sha256Hex(value)}`;
}

async function signedFixture(api: ReceiptModule) {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const trust: RealBuildExactFiveBrokerTrustPin = {
    namespace: "test",
    keyStatus: "active",
    keyId: "clock-test-key",
    keyEpoch: 1,
    publicKey: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
    audience: "clock-test-client",
    stableOrigin: "http://127.0.0.1:5173",
    pairedDeviceId: "clock-test-device",
    brokerInstallId: "clock-test-install",
    brokerReleaseId: "clock-test-release",
    ledgerSequence: 3,
    ledgerRoot: digest(`clock-root-${crypto.randomUUID()}`),
  };
  const challenge = api.createRealBuildExactFiveBrokerChallenge({
    requestDigest: digest(`clock-request-${crypto.randomUUID()}`),
    reviewPresentationDigest: digest(`clock-presentation-${crypto.randomUUID()}`),
    trustPin: trust,
  });
  const event: RealBuildExactFiveBrokerConsumptionEventInput = {
    schemaVersion: "lego.real-build-exact-five-broker-consumption-receipt/1",
    signatureDomain: "lego.real-build-exact-five-broker-consumption-receipt-signature/1",
    namespace: trust.namespace,
    purpose: challenge.purpose,
    scope: challenge.scope,
    requestDigest: challenge.requestDigest,
    challengeNonce: challenge.challengeNonce,
    audience: trust.audience,
    stableOrigin: trust.stableOrigin,
    pairedDeviceId: trust.pairedDeviceId,
    brokerInstallId: trust.brokerInstallId,
    decision: "approved",
    reviewPresentationDigest: challenge.reviewPresentationDigest,
    brokerReleaseId: trust.brokerReleaseId,
    brokerEventId: `clock-event-${crypto.randomUUID()}`,
    consumedAtUnixMs: challenge.issuedAtUnixMs,
    ledgerSequence: trust.ledgerSequence + 1,
    previousLedgerRoot: trust.ledgerRoot,
  };
  const consumptionEventHash = api.deriveRealBuildExactFiveBrokerConsumptionEventHash(event);
  const core: RealBuildExactFiveBrokerConsumptionReceiptCore = {
    ...event,
    consumptionEventHash,
    resultingLedgerRoot: api.deriveRealBuildExactFiveBrokerResultingLedgerRoot({
      previousLedgerRoot: event.previousLedgerRoot as Sha256Digest,
      consumptionEventHash,
      ledgerSequence: event.ledgerSequence,
    }),
  };
  const header: RealBuildExactFiveBrokerReceiptSignatureHeader = {
    algorithm: "Ed25519",
    keyId: trust.keyId,
    keyEpoch: trust.keyEpoch,
  };
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      pair.privateKey,
      api.encodeRealBuildExactFiveBrokerReceiptSigningBytes(core, header).buffer as ArrayBuffer,
    ),
  );
  const receipt: RealBuildExactFiveBrokerConsumptionReceiptV1 = {
    ...core,
    seal: { ...header, signature: Buffer.from(signature).toString("base64url") },
  };
  return { challenge, receiptBytes: ENCODER.encode(canonicalStringify(receipt)) };
}

describe("real-build exact-five receipt inspector clock boundaries", () => {
  it("samples monotonic time again after asynchronous signature verification", async () => {
    vi.resetModules();
    let monotonicMs = 100;
    const nowSpy = vi.spyOn(Performance.prototype, "now").mockImplementation(() => monotonicMs);
    const originalVerify = SubtleCrypto.prototype.verify;
    const verifySpy = vi
      .spyOn(SubtleCrypto.prototype, "verify")
      .mockImplementation(async (algorithm, key, signature, data) => {
        const valid = await originalVerify.call(crypto.subtle, algorithm, key, signature, data);
        monotonicMs += 120_001;
        return valid;
      });
    try {
      const api = await import("../e2e/real-build-exact-five-broker-receipt");
      const fixture = await signedFixture(api);
      await expect(api.inspectRealBuildExactFiveBrokerConsumptionReceipt(fixture)).rejects.toThrow(
        /monotonic inspection elapsed 120001 ms/u,
      );
      expect(verifySpy).toHaveBeenCalledOnce();
    } finally {
      verifySpy.mockRestore();
      nowSpy.mockRestore();
      vi.resetModules();
    }
  });

  it("samples wall time again after asynchronous signature verification", async () => {
    vi.resetModules();
    let wallUnixMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => wallUnixMs);
    const originalVerify = SubtleCrypto.prototype.verify;
    const verifySpy = vi
      .spyOn(SubtleCrypto.prototype, "verify")
      .mockImplementation(async (algorithm, key, signature, data) => {
        const valid = await originalVerify.call(crypto.subtle, algorithm, key, signature, data);
        wallUnixMs += 120_001;
        return valid;
      });
    try {
      const api = await import("../e2e/real-build-exact-five-broker-receipt");
      const fixture = await signedFixture(api);
      await expect(api.inspectRealBuildExactFiveBrokerConsumptionReceipt(fixture)).rejects.toThrow(
        /inspectionFinishedAtUnixMs 1120001 exceeds challenge expiry 1120000/u,
      );
      expect(verifySpy).toHaveBeenCalledOnce();
    } finally {
      verifySpy.mockRestore();
      nowSpy.mockRestore();
      vi.resetModules();
    }
  });
});
