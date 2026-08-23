import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import type { RealBuildExactFiveBrokerConsumptionReceiptV1 } from "@lego-studio/protocol";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createRealBuildExactFiveBrokerChallenge,
  deriveRealBuildExactFiveBrokerConsumptionEventHash,
  deriveRealBuildExactFiveBrokerResultingLedgerRoot,
  encodeRealBuildExactFiveBrokerReceiptSigningBytes,
  inspectRealBuildExactFiveBrokerConsumptionReceipt,
  MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_BYTES,
  REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS,
  type RealBuildExactFiveBrokerConsumptionReceiptCore,
  type RealBuildExactFiveBrokerConsumptionEventInput,
  type RealBuildExactFiveBrokerTrustPin,
  type RealBuildExactFiveBrokerReceiptSignatureHeader,
} from "../e2e/real-build-exact-five-broker-receipt";
import { consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent } from "../e2e/real-build-browser-output-v4-exact-five-user-event";

const ENCODER = new TextEncoder();
const PRESENTATION_HASH = `sha256:${"4".repeat(64)}` as Sha256Digest;

let privateKey: CryptoKey;
let publicKey: Uint8Array;

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  privateKey = pair.privateKey;
  publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
});

function digest(value: string): Sha256Digest {
  return `sha256:${sha256Hex(value)}`;
}

function trustPin(
  patch: Partial<RealBuildExactFiveBrokerTrustPin> = {},
): RealBuildExactFiveBrokerTrustPin {
  return {
    namespace: "test",
    keyStatus: "active",
    keyId: "test-broker-key",
    keyEpoch: 7,
    publicKey: new Uint8Array(publicKey),
    audience: "test-paired-web-client",
    stableOrigin: "http://127.0.0.1:5173",
    pairedDeviceId: "test-paired-device",
    brokerInstallId: "test-broker-install",
    brokerReleaseId: "test-broker-release",
    ledgerSequence: 41,
    ledgerRoot: digest(`test-root-${crypto.randomUUID()}`),
    ...patch,
  };
}

function coreFor(
  challenge: ReturnType<typeof createRealBuildExactFiveBrokerChallenge>,
  trust: RealBuildExactFiveBrokerTrustPin,
  brokerEventId = `test-event-${crypto.randomUUID()}`,
): RealBuildExactFiveBrokerConsumptionReceiptCore {
  const consumedAtUnixMs = challenge.issuedAtUnixMs;
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
    brokerEventId,
    consumedAtUnixMs,
    ledgerSequence: trust.ledgerSequence + 1,
    previousLedgerRoot: trust.ledgerRoot,
  };
  const consumptionEventHash = deriveRealBuildExactFiveBrokerConsumptionEventHash(event);
  return {
    ...event,
    consumptionEventHash,
    resultingLedgerRoot: deriveRealBuildExactFiveBrokerResultingLedgerRoot({
      previousLedgerRoot: event.previousLedgerRoot as Sha256Digest,
      consumptionEventHash,
      ledgerSequence: event.ledgerSequence,
    }),
  };
}

async function receiptBytes(
  core: RealBuildExactFiveBrokerConsumptionReceiptCore,
  signatureCore: RealBuildExactFiveBrokerConsumptionReceiptCore = core,
  header: RealBuildExactFiveBrokerReceiptSignatureHeader = {
    algorithm: "Ed25519",
    keyId: "test-broker-key",
    keyEpoch: 7,
  },
): Promise<Uint8Array> {
  const signingBytes = encodeRealBuildExactFiveBrokerReceiptSigningBytes(signatureCore, header);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, privateKey, signingBytes.buffer as ArrayBuffer),
  );
  const receipt: RealBuildExactFiveBrokerConsumptionReceiptV1 = {
    ...core,
    seal: {
      ...header,
      signature: Buffer.from(signature).toString("base64url"),
    },
  };
  return ENCODER.encode(canonicalStringify(receipt));
}

async function fixture(trustPatch: Partial<RealBuildExactFiveBrokerTrustPin> = {}) {
  const trust = trustPin(trustPatch);
  const challenge = createRealBuildExactFiveBrokerChallenge({
    requestDigest: digest(`request-${crypto.randomUUID()}`),
    reviewPresentationDigest: PRESENTATION_HASH,
    trustPin: trust,
  });
  const core = coreFor(challenge, trust);
  return { challenge, core, bytes: await receiptBytes(core), trust };
}

function rederiveCore(
  core: RealBuildExactFiveBrokerConsumptionReceiptCore,
  patch: Partial<RealBuildExactFiveBrokerConsumptionEventInput>,
): RealBuildExactFiveBrokerConsumptionReceiptCore {
  const { consumptionEventHash: _eventHash, resultingLedgerRoot: _root, ...baseline } = core;
  void _eventHash;
  void _root;
  const event = { ...baseline, ...patch } as RealBuildExactFiveBrokerConsumptionEventInput;
  const consumptionEventHash = deriveRealBuildExactFiveBrokerConsumptionEventHash(event);
  return {
    ...event,
    consumptionEventHash,
    resultingLedgerRoot: deriveRealBuildExactFiveBrokerResultingLedgerRoot({
      previousLedgerRoot: event.previousLedgerRoot as Sha256Digest,
      consumptionEventHash,
      ledgerSequence: event.ledgerSequence,
    }),
  };
}

function mutateSignedField(
  core: RealBuildExactFiveBrokerConsumptionReceiptCore,
  key: keyof RealBuildExactFiveBrokerConsumptionReceiptCore,
): RealBuildExactFiveBrokerConsumptionReceiptCore {
  const changed = { ...core } as Record<string, unknown>;
  const value = changed[key];
  if (typeof value === "number") changed[key] = value + 1;
  else if (key === "namespace") changed[key] = "production";
  else if (key === "schemaVersion") changed[key] = `${String(value)}/drift`;
  else if (key === "signatureDomain") changed[key] = `${String(value)}/drift`;
  else if (key === "purpose") changed[key] = "different-purpose";
  else if (key === "scope") changed[key] = "different-scope";
  else if (key === "decision") changed[key] = "denied";
  else if (typeof value === "string" && value.startsWith("sha256:")) {
    changed[key] = digest(`changed-${String(key)}`);
  } else if (key === "challengeNonce") changed[key] = "f".repeat(64);
  else changed[key] = `${String(value)}-changed`;
  return changed as unknown as RealBuildExactFiveBrokerConsumptionReceiptCore;
}

describe("exact-five broker consumption receipt", () => {
  it("verifies a canonical Ed25519 receipt against one fresh local challenge", async () => {
    const { challenge, core, bytes } = await fixture();
    const inspection = await inspectRealBuildExactFiveBrokerConsumptionReceipt({
      receiptBytes: bytes,
      challenge,
    });
    expect(inspection).toEqual({
      schemaVersion: "lego.real-build-exact-five-broker-receipt-inspection/1",
      status: "signature-and-issued-challenge-verified",
      authority: "absent",
      trustBasis: "caller-supplied-pin-bound-before-challenge-issuance",
      oneUseAuthority: "requires-released-broker-durable-ledger",
      ledgerAuthority: "transition-recomputed-without-durable-checkpoint-authority",
      namespace: "test",
      requestDigest: challenge.requestDigest,
      challengeNonce: challenge.challengeNonce,
      eventIdentityDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      brokerEventId: core.brokerEventId,
      reviewPresentationDigest: PRESENTATION_HASH,
      consumedAtUnixMs: expect.any(Number),
      nextLedgerCheckpoint: { sequence: 42, root: core.resultingLedgerRoot },
    });
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.nextLedgerCheckpoint)).toBe(true);
    await expect(
      consumeRealBuildBrowserOutputV4ExactFiveTrustedUserEvent(inspection, {
        schemaVersion: "lego.real-build-browser-output-v4-exact-five-user-event-request/1",
        namespace: "production",
        purpose: "admit-exact-five-official-frame-equivalence",
        scope: "exact-five-source-parity-calibration-panels-only",
        requestDigest: inspection.requestDigest,
        reviewPresentationDigest: inspection.reviewPresentationDigest,
      }),
    ).rejects.toThrow(/no external authenticated one-use trusted-user event consumer/u);
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: bytes,
        challenge,
      }),
    ).rejects.toThrow(/challenge was already consumed/u);
  });

  it("changes signing bytes for every mutable core/header field and reaches Ed25519 on valid drift", async () => {
    const baseline = await fixture();
    const fields = Object.keys(
      baseline.core,
    ) as (keyof RealBuildExactFiveBrokerConsumptionReceiptCore)[];
    expect(fields).toHaveLength(20);
    for (const field of fields) {
      const changed = mutateSignedField(baseline.core, field);
      if (field === "signatureDomain") {
        expect(() =>
          encodeRealBuildExactFiveBrokerReceiptSigningBytes(changed, {
            algorithm: "Ed25519",
            keyId: "test-broker-key",
            keyEpoch: 7,
          }),
        ).toThrow(/wrong signature domain/u);
      } else {
        expect(
          Array.from(
            encodeRealBuildExactFiveBrokerReceiptSigningBytes(changed, {
              algorithm: "Ed25519",
              keyId: "test-broker-key",
              keyEpoch: 7,
            }),
          ),
          field,
        ).not.toEqual(
          Array.from(
            encodeRealBuildExactFiveBrokerReceiptSigningBytes(baseline.core, {
              algorithm: "Ed25519",
              keyId: "test-broker-key",
              keyEpoch: 7,
            }),
          ),
        );
      }
    }
    const baselineHeader = { algorithm: "Ed25519" as const, keyId: "test-broker-key", keyEpoch: 7 };
    for (const header of [
      { ...baselineHeader, keyId: "test-broker-key-2" },
      { ...baselineHeader, keyEpoch: 8 },
    ]) {
      expect(
        Array.from(encodeRealBuildExactFiveBrokerReceiptSigningBytes(baseline.core, header)),
      ).not.toEqual(
        Array.from(
          encodeRealBuildExactFiveBrokerReceiptSigningBytes(baseline.core, baselineHeader),
        ),
      );
    }
    const validDrift = await fixture();
    const changed = rederiveCore(validDrift.core, {
      brokerEventId: `changed-event-${crypto.randomUUID()}`,
    });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes(changed, validDrift.core),
        challenge: validDrift.challenge,
      }),
    ).rejects.toThrow(/Ed25519 signature is invalid/u);
    const retry = await fixture({
      ledgerSequence: validDrift.trust.ledgerSequence,
      ledgerRoot: validDrift.trust.ledgerRoot,
    });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: retry.bytes,
        challenge: retry.challenge,
      }),
    ).resolves.toMatchObject({ authority: "absent" });
  });

  it("snapshots supplied trust before issuance and rejects mismatched, inactive, or stale state", async () => {
    for (const keyStatus of ["retired", "revoked"] as const) {
      expect(() =>
        createRealBuildExactFiveBrokerChallenge({
          requestDigest: digest(`inactive-${keyStatus}`),
          reviewPresentationDigest: PRESENTATION_HASH,
          trustPin: trustPin({ keyStatus }),
        }),
      ).toThrow(/no challenge was issued/u);
    }
    expect(() =>
      createRealBuildExactFiveBrokerChallenge({
        requestDigest: digest("bad-port"),
        reviewPresentationDigest: PRESENTATION_HASH,
        trustPin: trustPin({ stableOrigin: "http://127.0.0.1:65536" }),
      }),
    ).toThrow(/numeric loopback origin/u);
    for (const [patch, message] of [
      [{ keyId: "test-broker-key\n" }, /bounded protocol identifier/u],
      [{ stableOrigin: "http://127.0.0.1:5173\n" }, /numeric loopback origin/u],
      [{ ledgerRoot: `${digest("newline-ledger")}\n` as Sha256Digest }, /lowercase sha256/u],
    ] as const) {
      expect(() =>
        createRealBuildExactFiveBrokerChallenge({
          requestDigest: digest("line-terminator-trust"),
          reviewPresentationDigest: PRESENTATION_HASH,
          trustPin: trustPin(patch),
        }),
      ).toThrow(message);
    }
    expect(() =>
      createRealBuildExactFiveBrokerChallenge({
        requestDigest: `${digest("newline-request")}\n` as Sha256Digest,
        reviewPresentationDigest: PRESENTATION_HASH,
        trustPin: trustPin(),
      }),
    ).toThrow(/lowercase sha256/u);
    expect(() =>
      createRealBuildExactFiveBrokerChallenge({
        requestDigest: digest("bad-key"),
        reviewPresentationDigest: PRESENTATION_HASH,
        trustPin: trustPin({ publicKey: new Uint8Array(31) }),
      }),
    ).toThrow(/exactly 32 bytes/u);

    const snapshotted = await fixture();
    (snapshotted.trust as unknown as { audience: string }).audience = "mutated-after-issuance";
    snapshotted.trust.publicKey.fill(0);
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: snapshotted.bytes,
        challenge: snapshotted.challenge,
      }),
    ).resolves.toMatchObject({ authority: "absent" });

    const mismatches: ReadonlyArray<Partial<RealBuildExactFiveBrokerConsumptionEventInput>> = [
      { namespace: "production" },
      { requestDigest: digest("other-request") },
      { challengeNonce: "f".repeat(64) },
      { reviewPresentationDigest: digest("other-review-presentation") },
      { audience: "other-audience" },
      { stableOrigin: "http://127.0.0.1:5174" },
      { pairedDeviceId: "other-paired-device" },
      { brokerInstallId: "other-broker-install" },
      { brokerReleaseId: "other-broker-release" },
    ];
    for (const patch of mismatches) {
      const mismatch = await fixture();
      const mismatchedCore = rederiveCore(mismatch.core, patch);
      await expect(
        inspectRealBuildExactFiveBrokerConsumptionReceipt({
          receiptBytes: await receiptBytes(mismatchedCore),
          challenge: mismatch.challenge,
        }),
        JSON.stringify(patch),
      ).rejects.toThrow(/does not equal (?:the )?live challenge|does not bind the pinned/u);
    }
    for (const header of [
      { algorithm: "Ed25519" as const, keyId: "other-key", keyEpoch: 7 },
      { algorithm: "Ed25519" as const, keyId: "test-broker-key", keyEpoch: 8 },
    ]) {
      const mismatch = await fixture();
      await expect(
        inspectRealBuildExactFiveBrokerConsumptionReceipt({
          receiptBytes: await receiptBytes(mismatch.core, mismatch.core, header),
          challenge: mismatch.challenge,
        }),
      ).rejects.toThrow(/does not bind the pinned/u);
    }

    const stale = await fixture();
    const staleCore = rederiveCore(stale.core, { ledgerSequence: 41 });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes(staleCore),
        challenge: stale.challenge,
      }),
    ).rejects.toThrow(/not the exact next transition/u);

    const wrongKey = await fixture({ publicKey: new Uint8Array(32) });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: wrongKey.bytes,
        challenge: wrongKey.challenge,
      }),
    ).rejects.toThrow(/Ed25519 signature is invalid/u);

    const selfSelectedProduction = await fixture({ namespace: "production" });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: selfSelectedProduction.bytes,
        challenge: selfSelectedProduction.challenge,
      }),
    ).resolves.toMatchObject({ namespace: "production", authority: "absent" });
  });

  it("recomputes the event/root transition, rejects future consumption, and gates event reuse", async () => {
    const badEventHash = await fixture();
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes({
          ...badEventHash.core,
          consumptionEventHash: digest("arbitrary-event-hash"),
        }),
        challenge: badEventHash.challenge,
      }),
    ).rejects.toThrow(/consumptionEventHash must recompute/u);

    const badRoot = await fixture();
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes({
          ...badRoot.core,
          resultingLedgerRoot: digest("arbitrary-resulting-root"),
        }),
        challenge: badRoot.challenge,
      }),
    ).rejects.toThrow(/resultingLedgerRoot must recompute/u);

    const preIssued = await fixture();
    const preIssuedCore = rederiveCore(preIssued.core, {
      consumedAtUnixMs: preIssued.challenge.issuedAtUnixMs - 1,
    });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes(preIssuedCore),
        challenge: preIssued.challenge,
      }),
    ).rejects.toThrow(/consumedAtUnixMs .* precedes issuedAtUnixMs/u);
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: preIssued.bytes,
        challenge: preIssued.challenge,
      }),
    ).rejects.toThrow(/already consumed/u);

    const beyondWindow = await fixture();
    const beyondWindowCore = rederiveCore(beyondWindow.core, {
      consumedAtUnixMs:
        beyondWindow.challenge.issuedAtUnixMs +
        REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS +
        1,
    });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes(beyondWindowCore),
        challenge: beyondWindow.challenge,
      }),
    ).rejects.toThrow(/observedAtUnixMs .* precedes receipt consumedAtUnixMs/u);

    const future = await fixture();
    const futureCore = rederiveCore(future.core, { consumedAtUnixMs: Date.now() + 30_000 });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes(futureCore),
        challenge: future.challenge,
      }),
    ).rejects.toThrow(/observedAtUnixMs .* precedes receipt consumedAtUnixMs/u);

    const first = await fixture();
    await inspectRealBuildExactFiveBrokerConsumptionReceipt({
      receiptBytes: first.bytes,
      challenge: first.challenge,
    });
    const reused = await fixture();
    const reusedCore = rederiveCore(reused.core, { brokerEventId: first.core.brokerEventId });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: await receiptBytes(reusedCore),
        challenge: reused.challenge,
      }),
    ).rejects.toThrow(/already in flight or verified/u);

    const branchOne = await fixture();
    await inspectRealBuildExactFiveBrokerConsumptionReceipt({
      receiptBytes: branchOne.bytes,
      challenge: branchOne.challenge,
    });
    const branchTwo = await fixture({
      ledgerSequence: branchOne.trust.ledgerSequence,
      ledgerRoot: branchOne.trust.ledgerRoot,
    });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: branchTwo.bytes,
        challenge: branchTwo.challenge,
      }),
    ).rejects.toThrow(/second next event would fork the pinned checkpoint/u);
  });

  it("fails closed before a sixty-fifth concurrent receipt can reach crypto", async () => {
    const fixtures = await Promise.all(Array.from({ length: 65 }, () => fixture()));
    const pending = fixtures
      .slice(0, 64)
      .map(({ bytes, challenge }) =>
        inspectRealBuildExactFiveBrokerConsumptionReceipt({ receiptBytes: bytes, challenge }),
      );
    const overflow = fixtures[64]!;
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: overflow.bytes,
        challenge: overflow.challenge,
      }),
    ).rejects.toThrow(/64 in-flight receipts/u);
    await expect(Promise.all(pending)).resolves.toHaveLength(64);
  });

  it("rejects forged challenges and hostile or noncanonical receipt wires", async () => {
    const clone = await fixture();
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: clone.bytes,
        challenge: { ...clone.challenge },
      }),
    ).rejects.toThrow(/exact locally issued live challenge object/u);

    const noncanonical = await fixture();
    const text = new TextDecoder().decode(noncanonical.bytes);
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: ENCODER.encode(`${text} `),
        challenge: noncanonical.challenge,
      }),
    ).rejects.toThrow(/exact canonical JSON bytes/u);

    const invalidUtf8 = await fixture();
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: new Uint8Array([0xff, 0xfe]),
        challenge: invalidUtf8.challenge,
      }),
    ).rejects.toThrow(/fatal UTF-8/u);

    const marked = await fixture();
    const byteOrderMarked = new Uint8Array(marked.bytes.byteLength + 3);
    byteOrderMarked.set([0xef, 0xbb, 0xbf]);
    byteOrderMarked.set(marked.bytes, 3);
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: byteOrderMarked,
        challenge: marked.challenge,
      }),
    ).rejects.toThrow(/byte-order mark/u);

    const oversized = await fixture();
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: new Uint8Array(MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_BYTES + 1),
        challenge: oversized.challenge,
      }),
    ).rejects.toThrow(/maximum is/u);

    const proxied = await fixture();
    let traps = 0;
    const proxy = new Proxy(proxied.bytes, {
      get() {
        traps += 1;
        throw new Error("must not read proxy bytes");
      },
    });
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: proxy,
        challenge: proxied.challenge,
      }),
    ).rejects.toThrow(/intrinsic non-shared Uint8Array/u);
    expect(traps).toBe(0);
  });

  it("rejects signature encoding drift and event-embedded key material", async () => {
    const encoding = await fixture();
    const parsed = JSON.parse(new TextDecoder().decode(encoding.bytes)) as Record<string, unknown>;
    const seal = parsed.seal as Record<string, unknown>;
    seal.signature = `${String(seal.signature).slice(0, -1)}B`;
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: ENCODER.encode(canonicalStringify(parsed)),
        challenge: encoding.challenge,
      }),
    ).rejects.toThrow(/protocol schema|non-canonical length or padding bits/u);

    const embedded = await fixture();
    const withKey = JSON.parse(new TextDecoder().decode(embedded.bytes)) as Record<string, unknown>;
    withKey.publicKey = "caller-supplied";
    await expect(
      inspectRealBuildExactFiveBrokerConsumptionReceipt({
        receiptBytes: ENCODER.encode(canonicalStringify(withKey)),
        challenge: embedded.challenge,
      }),
    ).rejects.toThrow(/protocol schema/u);
  });
});
