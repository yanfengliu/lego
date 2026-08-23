import {
  assertRealBuildExactFiveBrokerConsumptionTimelineV1,
  assertRealBuildExactFiveBrokerMonotonicTimelineV1,
  assertProtocolValue,
  parseRealBuildExactFiveBrokerConsumptionExchangeV1,
  REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS,
  validateRealBuildExactFiveBrokerChallengeV1,
  type RealBuildExactFiveBrokerChallengeV1,
} from "@lego-studio/protocol";
import { canonicalDigest, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  decodeRealBuildExactFiveBrokerSignature,
  deriveRealBuildExactFiveBrokerConsumptionEventHash,
  deriveRealBuildExactFiveBrokerResultingLedgerRoot,
  encodeRealBuildExactFiveBrokerReceiptSigningBytes,
  parseRealBuildExactFiveBrokerConsumptionReceipt,
  snapshotRealBuildExactFiveBrokerReceiptCore,
} from "./real-build-exact-five-broker-receipt-wire";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";

export {
  deriveRealBuildExactFiveBrokerConsumptionEventHash,
  deriveRealBuildExactFiveBrokerResultingLedgerRoot,
  encodeRealBuildExactFiveBrokerReceiptSigningBytes,
  MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_BYTES,
  REAL_BUILD_EXACT_FIVE_BROKER_CONSUMPTION_EVENT_DOMAIN,
  REAL_BUILD_EXACT_FIVE_BROKER_LEDGER_ROOT_DOMAIN,
  REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_SIGNATURE_DOMAIN,
  type RealBuildExactFiveBrokerConsumptionEventInput,
  type RealBuildExactFiveBrokerConsumptionReceiptCore,
  type RealBuildExactFiveBrokerReceiptSignatureHeader,
} from "./real-build-exact-five-broker-receipt-wire";

export { REAL_BUILD_EXACT_FIVE_BROKER_CHALLENGE_LIFETIME_MS };
export const MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_IN_FLIGHT_RECEIPTS = 64;
export const MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_VERIFIED_RECEIPTS = 4_096;
const DATE_NOW = Date.now;
const PERFORMANCE = globalThis.performance;
const PERFORMANCE_NOW = Performance.prototype.now;
const CRYPTO = globalThis.crypto;
const GET_RANDOM_VALUES = Crypto.prototype.getRandomValues;
const SUBTLE = CRYPTO.subtle;
const SUBTLE_IMPORT_KEY = SubtleCrypto.prototype.importKey;
const SUBTLE_VERIFY = SubtleCrypto.prototype.verify;
const REFLECT_APPLY = Reflect.apply;
const UINT8_ARRAY = Uint8Array;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const SET_ADD = Set.prototype.add;
const SET_DELETE = Set.prototype.delete;
const SET_HAS = Set.prototype.has;
const WEAK_MAP_GET = WeakMap.prototype.get;
const WEAK_MAP_SET = WeakMap.prototype.set;
const WEAK_SET_ADD = WeakSet.prototype.add;
const WEAK_SET_HAS = WeakSet.prototype.has;
const HEX = "0123456789abcdef";
const consumedChallenges = new WeakSet<object>();
const inFlightBrokerEventIds = new Set<Sha256Digest>();
const verifiedBrokerEventIds = new Set<Sha256Digest>();
const inFlightLedgerTransitions = new Set<Sha256Digest>();
const verifiedLedgerTransitions = new Set<Sha256Digest>();
let inFlightReceiptCount = 0;
let verifiedReceiptCount = 0;

export interface RealBuildExactFiveBrokerTrustPin {
  readonly namespace: "production" | "test";
  readonly keyStatus: "active" | "retired" | "revoked";
  readonly keyId: string;
  readonly keyEpoch: number;
  readonly publicKey: Uint8Array;
  readonly audience: string;
  readonly stableOrigin: string;
  readonly pairedDeviceId: string;
  readonly brokerInstallId: string;
  readonly brokerReleaseId: string;
  readonly ledgerSequence: number;
  readonly ledgerRoot: Sha256Digest;
}

export interface RealBuildExactFiveBrokerReceiptInspection {
  readonly schemaVersion: "lego.real-build-exact-five-broker-receipt-inspection/1";
  readonly status: "signature-and-issued-challenge-verified";
  readonly authority: "absent";
  readonly trustBasis: "caller-supplied-pin-bound-before-challenge-issuance";
  readonly oneUseAuthority: "requires-released-broker-durable-ledger";
  readonly ledgerAuthority: "transition-recomputed-without-durable-checkpoint-authority";
  readonly namespace: "production" | "test";
  readonly requestDigest: Sha256Digest;
  readonly challengeNonce: string;
  readonly eventIdentityDigest: Sha256Digest;
  readonly brokerEventId: string;
  readonly reviewPresentationDigest: Sha256Digest;
  readonly consumedAtUnixMs: number;
  readonly nextLedgerCheckpoint: {
    readonly sequence: number;
    readonly root: Sha256Digest;
  };
}

type SnapshottedRealBuildExactFiveBrokerTrustPin = Readonly<{
  pin: Readonly<Omit<RealBuildExactFiveBrokerTrustPin, "publicKey">>;
  publicKey: Uint8Array;
}>;

interface IssuedRealBuildExactFiveBrokerChallenge {
  readonly challenge: RealBuildExactFiveBrokerChallengeV1;
  readonly trust: SnapshottedRealBuildExactFiveBrokerTrustPin;
  readonly issuedMonotonicMs: number;
}

const issuedChallenges = new WeakMap<object, IssuedRealBuildExactFiveBrokerChallenge>();

function apply<T>(fn: (...args: never[]) => T, receiver: unknown, args: unknown[]): T {
  return REFLECT_APPLY(fn, receiver, args) as T;
}

function monotonicNow(): number {
  return apply<number>(PERFORMANCE_NOW, PERFORMANCE, []);
}

function setAdd<T>(set: Set<T>, value: T): void {
  apply<Set<T>>(SET_ADD, set, [value]);
}

function setDelete<T>(set: Set<T>, value: T): void {
  apply<boolean>(SET_DELETE, set, [value]);
}

function setHas<T>(set: Set<T>, value: T): boolean {
  return apply<boolean>(SET_HAS, set, [value]);
}

function weakMapGet<K extends object, V>(map: WeakMap<K, V>, key: K): V | undefined {
  return apply<V | undefined>(WEAK_MAP_GET, map, [key]);
}

function weakMapSet<K extends object, V>(map: WeakMap<K, V>, key: K, value: V): void {
  apply<WeakMap<K, V>>(WEAK_MAP_SET, map, [key, value]);
}

function weakSetAdd<T extends object>(set: WeakSet<T>, value: T): void {
  apply<WeakSet<T>>(WEAK_SET_ADD, set, [value]);
}

function weakSetHas<T extends object>(set: WeakSet<T>, value: T): boolean {
  return apply<boolean>(WEAK_SET_HAS, set, [value]);
}

function copyBytes(source: Uint8Array): Uint8Array {
  const copy = new UINT8_ARRAY(source.byteLength);
  apply<void>(UINT8_ARRAY_SET, copy, [source]);
  return copy;
}

function exactDigest(value: unknown, path: string): Sha256Digest {
  const match = typeof value === "string" ? /^sha256:[0-9a-f]{64}/u.exec(value) : null;
  if (match === null || match[0] !== value) {
    throw new TypeError(`${path} must be one lowercase sha256:<64 hex> digest.`);
  }
  return value as Sha256Digest;
}

function exactIdentifier(value: unknown, path: string): string {
  const match =
    typeof value === "string" ? /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}/u.exec(value) : null;
  if (match === null || match[0] !== value) {
    throw new TypeError(`${path} must be one bounded protocol identifier.`);
  }
  return value;
}

function exactInteger(value: unknown, minimum: number, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new TypeError(`${path} must be a safe integer no smaller than ${minimum}.`);
  }
  return value as number;
}

function snapshotTrustPin(
  raw: RealBuildExactFiveBrokerTrustPin,
): SnapshottedRealBuildExactFiveBrokerTrustPin {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TypeError("Exact-five broker trust pin must be one data object.");
  }
  const namespace = raw.namespace;
  if (namespace !== "production" && namespace !== "test") {
    throw new TypeError("Exact-five broker trust pin namespace must be production or test.");
  }
  const keyStatus = raw.keyStatus;
  if (keyStatus !== "active" && keyStatus !== "retired" && keyStatus !== "revoked") {
    throw new TypeError("Exact-five broker trust pin must declare an exact key status.");
  }
  const stableOrigin = raw.stableOrigin;
  const stableOriginMatch =
    typeof stableOrigin === "string"
      ? /^https?:\/\/(?:127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})/u.exec(stableOrigin)
      : null;
  if (
    stableOriginMatch === null ||
    stableOriginMatch[0] !== stableOrigin ||
    Number(stableOriginMatch[1]) > 65_535
  ) {
    throw new TypeError("Exact-five broker trust pin requires one numeric loopback origin.");
  }
  const publicKey = snapshotHostileUint8Array(raw.publicKey, {
    maximumBytes: 32,
    typeError: "Exact-five broker trust pin public key must be an intrinsic Uint8Array.",
    oversizeError: (length) =>
      `Exact-five broker trust pin public key has ${length} bytes; Ed25519 requires exactly 32.`,
    sharedError: "Exact-five broker trust pin public key must not use SharedArrayBuffer storage.",
    copyError: "Exact-five broker trust pin public key could not be snapshotted.",
  });
  if (publicKey.byteLength !== 32) {
    throw new TypeError("Exact-five broker trust pin public key must contain exactly 32 bytes.");
  }
  return intrinsicRealBuildFreeze({
    pin: intrinsicRealBuildFreeze({
      namespace,
      keyStatus,
      keyId: exactIdentifier(raw.keyId, "Exact-five broker trust pin keyId"),
      keyEpoch: exactInteger(raw.keyEpoch, 0, "Exact-five broker trust pin keyEpoch"),
      audience: exactIdentifier(raw.audience, "Exact-five broker trust pin audience"),
      stableOrigin,
      pairedDeviceId: exactIdentifier(
        raw.pairedDeviceId,
        "Exact-five broker trust pin pairedDeviceId",
      ),
      brokerInstallId: exactIdentifier(
        raw.brokerInstallId,
        "Exact-five broker trust pin brokerInstallId",
      ),
      brokerReleaseId: exactIdentifier(
        raw.brokerReleaseId,
        "Exact-five broker trust pin brokerReleaseId",
      ),
      ledgerSequence: exactInteger(
        raw.ledgerSequence,
        0,
        "Exact-five broker trust pin ledgerSequence",
      ),
      ledgerRoot: exactDigest(raw.ledgerRoot, "Exact-five broker trust pin ledgerRoot"),
    }),
    publicKey,
  });
}

function trustBindingDigest(trust: SnapshottedRealBuildExactFiveBrokerTrustPin): Sha256Digest {
  return canonicalDigest({
    schemaVersion: "lego.real-build-exact-five-broker-trust-binding/1",
    ...trust.pin,
    publicKeyDigest: `sha256:${sha256Hex(trust.publicKey)}`,
  });
}

export function createRealBuildExactFiveBrokerChallenge(input: {
  readonly requestDigest: Sha256Digest;
  readonly reviewPresentationDigest: Sha256Digest;
  readonly trustPin: RealBuildExactFiveBrokerTrustPin;
}): RealBuildExactFiveBrokerChallengeV1 {
  const trust = snapshotTrustPin(input.trustPin);
  if (trust.pin.keyStatus !== "active") {
    throw new TypeError(
      `Exact-five broker trust key ${trust.pin.keyId} is ${trust.pin.keyStatus}; no challenge was issued.`,
    );
  }
  const nonceBytes = new UINT8_ARRAY(32);
  apply<Uint8Array>(GET_RANDOM_VALUES, CRYPTO, [nonceBytes]);
  let challengeNonce = "";
  for (let index = 0; index < nonceBytes.length; index += 1) {
    const byte = nonceBytes[index]!;
    challengeNonce += HEX[(byte >>> 4) & 0xf]! + HEX[byte & 0xf]!;
  }
  const issuedMilliseconds = apply<number>(DATE_NOW, Date, []);
  const issuedMonotonicMs = monotonicNow();
  const challenge = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-exact-five-broker-challenge/1" as const,
    namespace: trust.pin.namespace,
    purpose: "admit-exact-five-official-frame-equivalence" as const,
    scope: "exact-five-source-parity-calibration-panels-only" as const,
    requestDigest: exactDigest(input.requestDigest, "Exact-five broker challenge requestDigest"),
    reviewPresentationDigest: exactDigest(
      input.reviewPresentationDigest,
      "Exact-five broker challenge reviewPresentationDigest",
    ),
    trustBindingDigest: trustBindingDigest(trust),
    challengeNonce,
    issuedAtUnixMs: issuedMilliseconds,
  });
  assertProtocolValue(
    validateRealBuildExactFiveBrokerChallengeV1,
    challenge,
    "Exact-five broker challenge",
  );
  weakMapSet(
    issuedChallenges,
    challenge,
    intrinsicRealBuildFreeze({
      challenge,
      trust,
      issuedMonotonicMs,
    }),
  );
  return challenge;
}

export async function inspectRealBuildExactFiveBrokerConsumptionReceipt(input: {
  readonly receiptBytes: unknown;
  readonly challenge: RealBuildExactFiveBrokerChallengeV1;
}): Promise<RealBuildExactFiveBrokerReceiptInspection> {
  const challenge = input.challenge;
  const issued =
    challenge !== null && typeof challenge === "object"
      ? weakMapGet(issuedChallenges, challenge as object)
      : undefined;
  if (issued === undefined) {
    throw new TypeError(
      "Exact-five broker receipt requires the exact locally issued live challenge object.",
    );
  }
  const issuedChallenge = issued.challenge;
  if (weakSetHas(consumedChallenges, challenge as object)) {
    throw new TypeError("Exact-five broker challenge was already consumed; replay is forbidden.");
  }
  weakSetAdd(consumedChallenges, challenge as object);
  const inspectionStartedMonotonicMs = monotonicNow();
  assertRealBuildExactFiveBrokerMonotonicTimelineV1({
    issuedAtMonotonicMs: issued.issuedMonotonicMs,
    inspectionStartedAtMonotonicMs: inspectionStartedMonotonicMs,
    inspectionFinishedAtMonotonicMs: inspectionStartedMonotonicMs,
  });
  const parsedReceipt = parseRealBuildExactFiveBrokerConsumptionReceipt(input.receiptBytes);
  const now = apply<number>(DATE_NOW, Date, []);
  const { receipt } = parseRealBuildExactFiveBrokerConsumptionExchangeV1({
    challenge: issuedChallenge,
    receipt: parsedReceipt,
    observedAtUnixMs: now,
  });
  const { pin, publicKey } = issued.trust;
  if (
    receipt.namespace !== pin.namespace ||
    receipt.audience !== pin.audience ||
    receipt.stableOrigin !== pin.stableOrigin ||
    receipt.pairedDeviceId !== pin.pairedDeviceId ||
    receipt.brokerInstallId !== pin.brokerInstallId ||
    receipt.brokerReleaseId !== pin.brokerReleaseId ||
    receipt.seal.keyId !== pin.keyId ||
    receipt.seal.keyEpoch !== pin.keyEpoch
  ) {
    throw new TypeError(
      "Exact-five broker receipt does not bind the pinned audience, origin, pairing, install, release, and signing key.",
    );
  }
  if (
    receipt.ledgerSequence !== pin.ledgerSequence + 1 ||
    receipt.previousLedgerRoot !== pin.ledgerRoot
  ) {
    throw new TypeError(
      "Exact-five broker receipt is not the exact next transition from the pinned ledger checkpoint.",
    );
  }
  const core = snapshotRealBuildExactFiveBrokerReceiptCore(receipt);
  const expectedConsumptionEventHash = deriveRealBuildExactFiveBrokerConsumptionEventHash(core);
  if (receipt.consumptionEventHash !== expectedConsumptionEventHash) {
    throw new TypeError(
      `Exact-five broker receipt consumptionEventHash must recompute as ${expectedConsumptionEventHash}.`,
    );
  }
  const expectedResultingLedgerRoot = deriveRealBuildExactFiveBrokerResultingLedgerRoot({
    previousLedgerRoot: receipt.previousLedgerRoot as Sha256Digest,
    consumptionEventHash: expectedConsumptionEventHash,
    ledgerSequence: receipt.ledgerSequence,
  });
  if (receipt.resultingLedgerRoot !== expectedResultingLedgerRoot) {
    throw new TypeError(
      `Exact-five broker receipt resultingLedgerRoot must recompute as ${expectedResultingLedgerRoot}.`,
    );
  }
  const signatureHeader = intrinsicRealBuildFreeze({
    algorithm: receipt.seal.algorithm,
    keyId: receipt.seal.keyId,
    keyEpoch: receipt.seal.keyEpoch,
  });
  const signature = decodeRealBuildExactFiveBrokerSignature(receipt.seal.signature, 64);
  const scopedBrokerEventId = canonicalDigest({
    schemaVersion: "lego.real-build-exact-five-broker-scoped-event-id/1",
    namespace: pin.namespace,
    pairedDeviceId: pin.pairedDeviceId,
    brokerInstallId: pin.brokerInstallId,
    brokerReleaseId: pin.brokerReleaseId,
    brokerEventId: receipt.brokerEventId,
  });
  const ledgerTransitionSlot = canonicalDigest({
    schemaVersion: "lego.real-build-exact-five-broker-ledger-transition-slot/1",
    namespace: pin.namespace,
    pairedDeviceId: pin.pairedDeviceId,
    brokerInstallId: pin.brokerInstallId,
    ledgerSequence: receipt.ledgerSequence,
    previousLedgerRoot: receipt.previousLedgerRoot,
  });
  if (
    setHas(inFlightBrokerEventIds, scopedBrokerEventId) ||
    setHas(verifiedBrokerEventIds, scopedBrokerEventId)
  ) {
    throw new TypeError(
      `Exact-five broker event ${receipt.brokerEventId} is already in flight or verified; reuse is forbidden.`,
    );
  }
  if (
    setHas(inFlightLedgerTransitions, ledgerTransitionSlot) ||
    setHas(verifiedLedgerTransitions, ledgerTransitionSlot)
  ) {
    throw new TypeError(
      `Exact-five broker ledger transition slot ${ledgerTransitionSlot} is already in flight or verified; a second next event would fork the pinned checkpoint.`,
    );
  }
  if (inFlightReceiptCount >= MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_IN_FLIGHT_RECEIPTS) {
    throw new RangeError(
      `Exact-five broker receipt inspection already has ${inFlightReceiptCount} in-flight receipts; maximum is ${MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_IN_FLIGHT_RECEIPTS}.`,
    );
  }
  if (
    verifiedReceiptCount + inFlightReceiptCount >=
    MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_VERIFIED_RECEIPTS
  ) {
    throw new RangeError(
      `Exact-five broker receipt inspection retained or reserved ${verifiedReceiptCount + inFlightReceiptCount} receipts; maximum is ${MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_VERIFIED_RECEIPTS} for this process session.`,
    );
  }
  setAdd(inFlightBrokerEventIds, scopedBrokerEventId);
  setAdd(inFlightLedgerTransitions, ledgerTransitionSlot);
  inFlightReceiptCount += 1;
  try {
    const verificationKey = await apply<Promise<CryptoKey>>(SUBTLE_IMPORT_KEY, SUBTLE, [
      "raw",
      copyBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    ]);
    const valid = await apply<Promise<boolean>>(SUBTLE_VERIFY, SUBTLE, [
      { name: "Ed25519" },
      verificationKey,
      signature,
      encodeRealBuildExactFiveBrokerReceiptSigningBytes(core, signatureHeader),
    ]);
    if (!valid) throw new TypeError("Exact-five broker receipt Ed25519 signature is invalid.");
    const verifiedAt = apply<number>(DATE_NOW, Date, []);
    assertRealBuildExactFiveBrokerConsumptionTimelineV1({
      issuedAtUnixMs: issuedChallenge.issuedAtUnixMs,
      consumedAtUnixMs: receipt.consumedAtUnixMs,
      inspectionStartedAtUnixMs: now,
      inspectionFinishedAtUnixMs: verifiedAt,
    });
    assertRealBuildExactFiveBrokerMonotonicTimelineV1({
      issuedAtMonotonicMs: issued.issuedMonotonicMs,
      inspectionStartedAtMonotonicMs: inspectionStartedMonotonicMs,
      inspectionFinishedAtMonotonicMs: monotonicNow(),
    });
    setAdd(verifiedBrokerEventIds, scopedBrokerEventId);
    setAdd(verifiedLedgerTransitions, ledgerTransitionSlot);
    verifiedReceiptCount += 1;
  } finally {
    setDelete(inFlightBrokerEventIds, scopedBrokerEventId);
    setDelete(inFlightLedgerTransitions, ledgerTransitionSlot);
    inFlightReceiptCount -= 1;
  }
  return intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-exact-five-broker-receipt-inspection/1" as const,
    status: "signature-and-issued-challenge-verified" as const,
    authority: "absent" as const,
    trustBasis: "caller-supplied-pin-bound-before-challenge-issuance" as const,
    oneUseAuthority: "requires-released-broker-durable-ledger" as const,
    ledgerAuthority: "transition-recomputed-without-durable-checkpoint-authority" as const,
    namespace: receipt.namespace,
    requestDigest: receipt.requestDigest as Sha256Digest,
    challengeNonce: receipt.challengeNonce,
    eventIdentityDigest: canonicalDigest({ receipt: core, seal: signatureHeader }),
    brokerEventId: receipt.brokerEventId,
    reviewPresentationDigest: receipt.reviewPresentationDigest as Sha256Digest,
    consumedAtUnixMs: receipt.consumedAtUnixMs,
    nextLedgerCheckpoint: intrinsicRealBuildFreeze({
      sequence: receipt.ledgerSequence,
      root: receipt.resultingLedgerRoot as Sha256Digest,
    }),
  });
}
