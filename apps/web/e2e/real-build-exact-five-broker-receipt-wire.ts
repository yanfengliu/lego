import {
  assertProtocolValue,
  validateRealBuildExactFiveBrokerConsumptionReceiptV1,
  type RealBuildExactFiveBrokerConsumptionReceiptV1,
} from "@lego-studio/protocol";
import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";

export const MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_BYTES = 16 * 1024;
export const REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_SIGNATURE_DOMAIN =
  "lego.real-build-exact-five-broker-consumption-receipt-signature/1" as const;
export const REAL_BUILD_EXACT_FIVE_BROKER_CONSUMPTION_EVENT_DOMAIN =
  "lego.real-build-exact-five-broker-consumption-event/1" as const;
export const REAL_BUILD_EXACT_FIVE_BROKER_LEDGER_ROOT_DOMAIN =
  "lego.real-build-exact-five-broker-ledger-root/1" as const;

const SIGNATURE_DOMAIN_BYTES = new TextEncoder().encode(
  `${REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_SIGNATURE_DOMAIN}\0`,
);
const TEXT_ENCODER = new TextEncoder();
const TEXT_ENCODER_ENCODE = TextEncoder.prototype.encode;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const TEXT_DECODER_DECODE = TextDecoder.prototype.decode;
const STRING_CHAR_CODE_AT = String.prototype.charCodeAt;
const JSON_PARSE = JSON.parse;
const REFLECT_APPLY = Reflect.apply;
const UINT8_ARRAY = Uint8Array;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export type RealBuildExactFiveBrokerConsumptionReceiptCore = Omit<
  RealBuildExactFiveBrokerConsumptionReceiptV1,
  "seal"
>;

export type RealBuildExactFiveBrokerConsumptionEventInput = Omit<
  RealBuildExactFiveBrokerConsumptionReceiptCore,
  "consumptionEventHash" | "resultingLedgerRoot"
>;

export interface RealBuildExactFiveBrokerReceiptSignatureHeader {
  readonly algorithm: "Ed25519";
  readonly keyId: string;
  readonly keyEpoch: number;
}

function apply<T>(fn: (...args: never[]) => T, receiver: unknown, args: unknown[]): T {
  return REFLECT_APPLY(fn, receiver, args) as T;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new UINT8_ARRAY(left.byteLength + right.byteLength);
  apply<void>(UINT8_ARRAY_SET, combined, [left, 0]);
  apply<void>(UINT8_ARRAY_SET, combined, [right, left.byteLength]);
  return combined;
}

function encodeText(value: string): Uint8Array {
  return apply<Uint8Array>(TEXT_ENCODER_ENCODE, TEXT_ENCODER, [value]);
}

function exactDigest(value: unknown, path: string): Sha256Digest {
  const match = typeof value === "string" ? /^sha256:[0-9a-f]{64}/u.exec(value) : null;
  if (match === null || match[0] !== value) {
    throw new TypeError(`${path} must be one lowercase sha256:<64 hex> digest.`);
  }
  return value as Sha256Digest;
}

function exactInteger(value: unknown, minimum: number, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new TypeError(`${path} must be a safe integer no smaller than ${minimum}.`);
  }
  return value as number;
}

export function decodeRealBuildExactFiveBrokerSignature(
  value: string,
  expectedBytes: number,
): Uint8Array {
  const output = new UINT8_ARRAY(expectedBytes);
  let accumulator = 0;
  let bitCount = 0;
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    let digit = -1;
    for (let alphabetIndex = 0; alphabetIndex < BASE64URL.length; alphabetIndex += 1) {
      if (BASE64URL.charCodeAt(alphabetIndex) === code) {
        digit = alphabetIndex;
        break;
      }
    }
    if (digit < 0) throw new TypeError("Exact-five broker signature must use unpadded base64url.");
    accumulator = (accumulator << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      if (outputIndex >= expectedBytes) {
        throw new TypeError("Exact-five broker signature has too many decoded bytes.");
      }
      output[outputIndex] = (accumulator >> bitCount) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << bitCount) - 1;
    }
  }
  if (outputIndex !== expectedBytes || accumulator !== 0) {
    throw new TypeError("Exact-five broker signature has non-canonical length or padding bits.");
  }
  return output;
}

function preflightJsonText(text: string): void {
  let depth = 0;
  let structures = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (inString) {
      if (escaped) escaped = false;
      else if (code === 0x5c) escaped = true;
      else if (code === 0x22) inString = false;
      continue;
    }
    if (code === 0x22) inString = true;
    else if (code === 0x7b || code === 0x5b) {
      depth += 1;
      structures += 1;
      if (depth > 16 || structures > 128) {
        throw new RangeError("Exact-five broker receipt exceeds bounded JSON complexity.");
      }
    } else if (code === 0x7d || code === 0x5d) {
      depth -= 1;
      if (depth < 0) throw new TypeError("Exact-five broker receipt has malformed JSON.");
    }
  }
  if (depth !== 0 || inString || escaped) {
    throw new TypeError("Exact-five broker receipt has malformed JSON.");
  }
}

export function parseRealBuildExactFiveBrokerConsumptionReceipt(
  rawReceiptBytes: unknown,
): RealBuildExactFiveBrokerConsumptionReceiptV1 {
  const bytes = snapshotHostileUint8Array(rawReceiptBytes, {
    maximumBytes: MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_BYTES,
    typeError: "Exact-five broker receipt must be an intrinsic non-shared Uint8Array.",
    oversizeError: (length) =>
      `Exact-five broker receipt has ${length} bytes; maximum is ${MAXIMUM_REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_BYTES}.`,
    sharedError: "Exact-five broker receipt must not use SharedArrayBuffer storage.",
    copyError: "Exact-five broker receipt bytes could not be snapshotted.",
  });
  let text: string;
  try {
    text = apply<string>(TEXT_DECODER_DECODE, TEXT_DECODER, [bytes]);
  } catch {
    throw new TypeError("Exact-five broker receipt must be fatal UTF-8 JSON.");
  }
  if (text.length > 0 && apply<number>(STRING_CHAR_CODE_AT, text, [0]) === 0xfeff) {
    throw new TypeError("Exact-five broker receipt must not contain a UTF-8 byte-order mark.");
  }
  preflightJsonText(text);
  let parsed: unknown;
  try {
    parsed = apply<unknown>(JSON_PARSE, JSON, [text]);
  } catch {
    throw new TypeError("Exact-five broker receipt must contain one complete JSON value.");
  }
  if (canonicalStringify(parsed) !== text) {
    throw new TypeError("Exact-five broker receipt must use exact canonical JSON bytes.");
  }
  assertProtocolValue(
    validateRealBuildExactFiveBrokerConsumptionReceiptV1,
    parsed,
    "Exact-five broker receipt",
  );
  return parsed;
}

export function snapshotRealBuildExactFiveBrokerReceiptCore(
  receipt: RealBuildExactFiveBrokerConsumptionReceiptV1,
): RealBuildExactFiveBrokerConsumptionReceiptCore {
  return intrinsicRealBuildFreeze({
    schemaVersion: receipt.schemaVersion,
    signatureDomain: receipt.signatureDomain,
    namespace: receipt.namespace,
    purpose: receipt.purpose,
    scope: receipt.scope,
    requestDigest: receipt.requestDigest,
    challengeNonce: receipt.challengeNonce,
    audience: receipt.audience,
    stableOrigin: receipt.stableOrigin,
    pairedDeviceId: receipt.pairedDeviceId,
    brokerInstallId: receipt.brokerInstallId,
    decision: receipt.decision,
    reviewPresentationDigest: receipt.reviewPresentationDigest,
    brokerReleaseId: receipt.brokerReleaseId,
    brokerEventId: receipt.brokerEventId,
    consumedAtUnixMs: receipt.consumedAtUnixMs,
    ledgerSequence: receipt.ledgerSequence,
    previousLedgerRoot: receipt.previousLedgerRoot,
    consumptionEventHash: receipt.consumptionEventHash,
    resultingLedgerRoot: receipt.resultingLedgerRoot,
  });
}

function consumptionEventInput(
  value: RealBuildExactFiveBrokerConsumptionEventInput,
): RealBuildExactFiveBrokerConsumptionEventInput {
  return intrinsicRealBuildFreeze({
    schemaVersion: value.schemaVersion,
    signatureDomain: value.signatureDomain,
    namespace: value.namespace,
    purpose: value.purpose,
    scope: value.scope,
    requestDigest: value.requestDigest,
    challengeNonce: value.challengeNonce,
    audience: value.audience,
    stableOrigin: value.stableOrigin,
    pairedDeviceId: value.pairedDeviceId,
    brokerInstallId: value.brokerInstallId,
    decision: value.decision,
    reviewPresentationDigest: value.reviewPresentationDigest,
    brokerReleaseId: value.brokerReleaseId,
    brokerEventId: value.brokerEventId,
    consumedAtUnixMs: value.consumedAtUnixMs,
    ledgerSequence: value.ledgerSequence,
    previousLedgerRoot: value.previousLedgerRoot,
  });
}

export function deriveRealBuildExactFiveBrokerConsumptionEventHash(
  input: RealBuildExactFiveBrokerConsumptionEventInput,
): Sha256Digest {
  return canonicalDigest({
    schemaVersion: REAL_BUILD_EXACT_FIVE_BROKER_CONSUMPTION_EVENT_DOMAIN,
    event: consumptionEventInput(input),
  });
}

export function deriveRealBuildExactFiveBrokerResultingLedgerRoot(input: {
  readonly previousLedgerRoot: Sha256Digest;
  readonly consumptionEventHash: Sha256Digest;
  readonly ledgerSequence: number;
}): Sha256Digest {
  return canonicalDigest({
    schemaVersion: REAL_BUILD_EXACT_FIVE_BROKER_LEDGER_ROOT_DOMAIN,
    previousLedgerRoot: exactDigest(
      input.previousLedgerRoot,
      "Exact-five broker ledger transition previousLedgerRoot",
    ),
    consumptionEventHash: exactDigest(
      input.consumptionEventHash,
      "Exact-five broker ledger transition consumptionEventHash",
    ),
    ledgerSequence: exactInteger(
      input.ledgerSequence,
      1,
      "Exact-five broker ledger transition ledgerSequence",
    ),
  });
}

export function encodeRealBuildExactFiveBrokerReceiptSigningBytes(
  core: RealBuildExactFiveBrokerConsumptionReceiptCore,
  header: RealBuildExactFiveBrokerReceiptSignatureHeader,
): Uint8Array {
  if (core.signatureDomain !== REAL_BUILD_EXACT_FIVE_BROKER_RECEIPT_SIGNATURE_DOMAIN) {
    throw new TypeError("Exact-five broker receipt has the wrong signature domain.");
  }
  return concatBytes(
    SIGNATURE_DOMAIN_BYTES,
    encodeText(canonicalStringify({ receipt: core, seal: header })),
  );
}
