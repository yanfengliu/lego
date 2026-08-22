import { createHash } from "node:crypto";

import type { Sha256Digest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  deriveRealBuildExactFiveBrokerConsumptionEventHash,
  deriveRealBuildExactFiveBrokerResultingLedgerRoot,
  encodeRealBuildExactFiveBrokerReceiptSigningBytes,
  type RealBuildExactFiveBrokerConsumptionReceiptCore,
} from "../e2e/real-build-exact-five-broker-receipt";

// Generated independently with a standalone canonical JSON implementation and
// Node's standard Ed25519 implementation; no repository receipt helper was used.
const EVENT_HASH =
  "sha256:4e09b552d62cfad76c260a91176b4523ee0003be22035885699b3d9174855e53" as Sha256Digest;
const RESULTING_ROOT =
  "sha256:1338c2a4561e3a4f4eaeca3e9352004f5ea2bd8472d12c1a33f62d0ba85f5063" as Sha256Digest;
const SIGNING_BYTES_SHA256 = "990bcf295c3fa4c0cbb0bb1b93b741c698db997a174e6f4c64eecb4ec9a88d8c";
const PUBLIC_KEY_HEX = "03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8";
const SIGNATURE_BASE64URL =
  "Cc6ghB1QbaH4Q7OmYio1yvlb0U3waTJ-Uzf2bdoQ8k7qEpIFtGU-2jrtK5hwUFxgofUZB7fxoRckf5yAF-sfAA";

const CORE = {
  schemaVersion: "lego.real-build-exact-five-broker-consumption-receipt/1",
  signatureDomain: "lego.real-build-exact-five-broker-consumption-receipt-signature/1",
  namespace: "test",
  purpose: "admit-exact-five-official-frame-equivalence",
  scope: "exact-five-source-parity-calibration-panels-only",
  requestDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  challengeNonce: "1111111111111111111111111111111111111111111111111111111111111111",
  audience: "paired-web-client",
  stableOrigin: "http://127.0.0.1:5173",
  pairedDeviceId: "paired-device-1",
  brokerInstallId: "broker-install-1",
  decision: "approved",
  reviewPresentationDigest:
    "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  brokerReleaseId: "broker-release-1",
  brokerEventId: "event-1",
  consumedAtUnixMs: 1_777_000_000_123,
  ledgerSequence: 42,
  previousLedgerRoot: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
  consumptionEventHash: EVENT_HASH,
  resultingLedgerRoot: RESULTING_ROOT,
} satisfies RealBuildExactFiveBrokerConsumptionReceiptCore;

const HEADER = { algorithm: "Ed25519" as const, keyId: "golden-key-1", keyEpoch: 3 };

describe("exact-five broker receipt independent golden vector", () => {
  it("pins event hashing, ledger derivation, signing bytes, public key, and signature", async () => {
    expect(deriveRealBuildExactFiveBrokerConsumptionEventHash(CORE)).toBe(EVENT_HASH);
    expect(
      deriveRealBuildExactFiveBrokerResultingLedgerRoot({
        previousLedgerRoot: CORE.previousLedgerRoot as Sha256Digest,
        consumptionEventHash: CORE.consumptionEventHash as Sha256Digest,
        ledgerSequence: CORE.ledgerSequence,
      }),
    ).toBe(RESULTING_ROOT);

    const signingBytes = encodeRealBuildExactFiveBrokerReceiptSigningBytes(CORE, HEADER);
    expect(createHash("sha256").update(signingBytes).digest("hex")).toBe(SIGNING_BYTES_SHA256);
    const publicKey = await crypto.subtle.importKey(
      "raw",
      Buffer.from(PUBLIC_KEY_HEX, "hex"),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    await expect(
      crypto.subtle.verify(
        { name: "Ed25519" },
        publicKey,
        Buffer.from(SIGNATURE_BASE64URL, "base64url"),
        signingBytes.buffer as ArrayBuffer,
      ),
    ).resolves.toBe(true);
  });
});
