import { canonicalStringify, sha256Hex } from "@lego-studio/brick-kernel";

import type {
  RealBuildPanelCameraBranchBudgetFailure,
  RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";
import {
  snapshotPanelCameraCanonicalDocument,
  type PanelCameraCanonicalDocumentLimits,
  type PanelCameraCanonicalDocumentSnapshot,
} from "./real-build-panel-camera-json-snapshot";

export const PANEL_CAMERA_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const PANEL_CAMERA_ANGULAR_HYPOTHESES: readonly StepCameraLatticeHypothesis[] =
  Object.freeze(
    (["as-fitted", "x-reflected"] as const).flatMap((latticeHand) =>
      ([0, 90, 180, 270] as const).map((turnDegrees) =>
        Object.freeze({
          latticeHand,
          latticeDeterminant: latticeHand === "as-fitted" ? (1 as const) : (-1 as const),
          turnDegrees,
        }),
      ),
    ),
  );
export const UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME = Object.freeze({
  status: "unresolved" as const,
  authorizedTransform: null,
  reason: "panel-camera-silhouette-is-not-physical-transform-authority" as const,
});

export function realBuildStableDocumentCandidateId(documentHash: string): string {
  return `document:${documentHash}`;
}

export function realBuildPanelCameraLineageId(input: {
  readonly parentLineageId: string | null;
  readonly localIdentity: string;
}): string {
  return `panel-camera-lineage:${sha256Hex(canonicalStringify(input))}`;
}
const MAX_DOCUMENT_PARTS = 100_000;

export type RealBuildPanelCameraDocument = { readonly parts: readonly unknown[] };
const TYPED_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  "length",
)?.get;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  Symbol.toStringTag,
)?.get;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  "buffer",
)?.get;
const SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;

export interface RealBuildPanelCameraLedgerSnapshot {
  readonly budget: number;
  readonly reserved: number;
  readonly refused: boolean;
  readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
}

export const isPanelCameraRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function describePanelCameraValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    const preview = value.length <= 256 ? value : `${value.slice(0, 253)}...`;
    return `${JSON.stringify(preview)}${value.length <= 256 ? "" : ` (${value.length} characters)`}`;
  }
  if (typeof value === "bigint" || typeof value === "symbol") return String(value);
  if (typeof value === "function") return "<function>";
  try {
    if (Array.isArray(value)) {
      const length = Object.getOwnPropertyDescriptor(value, "length");
      return `<array length=${String(length?.value ?? "unknown")}>`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return "<non-plain object>";
    const keys = Reflect.ownKeys(value);
    if (keys.length > 16 || keys.some((key) => typeof key !== "string")) {
      return `<object keys=${keys.length}>`;
    }
    const fragments: string[] = [];
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return "<object with non-data properties>";
      }
      const described = describePanelCameraRecordValue(descriptor.value, 2);
      fragments.push(`${JSON.stringify(key)}:${described}`);
    }
    const encoded = `{${fragments.join(",")}}`;
    return encoded.length <= 2_048 ? encoded : `<object description exceeds 2048 characters>`;
  } catch {
    return "<hostile object>";
  }
}

function describePanelCameraRecordValue(value: unknown, depth: number): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return describePanelCameraValue(value);
  }
  if (typeof value === "string") return describePanelCameraValue(value);
  if (depth <= 0) return "<object>";
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return describePanelCameraValue(value);
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length > 16 ||
      keys.some((key) => typeof key !== "string")
    ) {
      return describePanelCameraValue(value);
    }
    const fragments: string[] = [];
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return "<object with non-data properties>";
      }
      fragments.push(
        `${JSON.stringify(key)}:${describePanelCameraRecordValue(descriptor.value, depth - 1)}`,
      );
    }
    return `{${fragments.join(",")}}`;
  } catch {
    return "<hostile object>";
  }
}

export function describePanelCameraThrown(value: unknown): string {
  if (value !== null && (typeof value === "object" || typeof value === "function")) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, "message");
      if (
        descriptor !== undefined &&
        "value" in descriptor &&
        typeof descriptor.value === "string"
      ) {
        const message = descriptor.value;
        return message.length <= 512 ? message : `${message.slice(0, 509)}...`;
      }
    } catch {
      return "a hostile thrown object whose message could not be inspected";
    }
  }
  return describePanelCameraValue(value);
}

export function hasExactPanelCameraKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value);
  const required = new Set(expected);
  return actual.length === required.size && actual.every((key) => required.has(key));
}

export function snapshotPanelCameraDocument<D extends RealBuildPanelCameraDocument>(
  document: unknown,
): D {
  try {
    return snapshotPanelCameraCanonicalDocument<D>(document, {
      maximumParts: MAX_DOCUMENT_PARTS,
    }).document;
  } catch (error) {
    throw new TypeError(
      `Panel-camera prefix document could not be detached as bounded immutable canonical JSON. ${describePanelCameraThrown(error)}`,
      { cause: error },
    );
  }
}

export function snapshotPanelCameraDocumentWithCanonical<D extends RealBuildPanelCameraDocument>(
  document: unknown,
  limits: PanelCameraCanonicalDocumentLimits,
): PanelCameraCanonicalDocumentSnapshot<D> {
  return snapshotPanelCameraCanonicalDocument<D>(document, limits);
}

export function snapshotPanelCameraBinaryMask(
  value: unknown,
  expectedLength: number,
  label: string,
): Uint8Array {
  let length: number;
  let buffer: ArrayBufferLike;
  try {
    if (
      TYPED_ARRAY_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_TAG_GETTER === undefined ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_TAG_GETTER.call(value) !== "Uint8Array"
    ) {
      throw new TypeError("missing typed-array intrinsics");
    }
    length = TYPED_ARRAY_LENGTH_GETTER.call(value) as number;
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(value) as ArrayBufferLike;
  } catch {
    throw new TypeError(
      `${label} must be a genuine Uint8Array of exactly ${expectedLength} binary pixels; received ${describePanelCameraValue(value)}.`,
    );
  }
  if (length !== expectedLength) {
    throw new RangeError(
      `${label} must contain exactly ${expectedLength} pixels; received ${length}. No raster copy was allocated.`,
    );
  }
  if (SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER !== undefined) {
    let shared = false;
    try {
      SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(buffer);
      shared = true;
    } catch {
      // The SharedArrayBuffer intrinsic rejects private ArrayBuffer storage.
    }
    if (shared)
      throw new TypeError(
        `${label} uses SharedArrayBuffer storage that can change during evidence capture; required a private ArrayBuffer-backed Uint8Array for one reproducible snapshot.`,
      );
  }
  let snapshot: Uint8Array;
  try {
    snapshot = new Uint8Array(expectedLength);
    Uint8Array.prototype.set.call(snapshot, value as Uint8Array);
  } catch {
    throw new TypeError(
      `${label} changed or detached while its ${expectedLength} pixels were copied; required one stable private Uint8Array snapshot.`,
    );
  }
  for (let index = 0; index < snapshot.length; index += 1) {
    if (snapshot[index] !== 0 && snapshot[index] !== 1) {
      throw new RangeError(
        `${label} pixel ${index} is ${snapshot[index]}; required binary byte 0 or 1.`,
      );
    }
  }
  return snapshot;
}

function snapshotFailure(value: unknown): RealBuildPanelCameraBranchBudgetFailure | null {
  if (value === null) return null;
  if (
    !isPanelCameraRecord(value) ||
    !hasExactPanelCameraKeys(value, ["budget", "requested", "reservedBefore"])
  ) {
    throw new TypeError(
      `Panel-camera ledger failure must be null or contain exactly budget, requested, reservedBefore; received ${describePanelCameraValue(value)}.`,
    );
  }
  const { budget, requested, reservedBefore } = value;
  if (![budget, requested, reservedBefore].every(Number.isSafeInteger)) {
    throw new TypeError(
      `Panel-camera ledger failure must contain safe integer values; received ${describePanelCameraValue(value)}.`,
    );
  }
  return Object.freeze({
    budget,
    requested,
    reservedBefore,
  } as RealBuildPanelCameraBranchBudgetFailure);
}

export function snapshotPanelCameraLedger(
  ledger: RealBuildPanelCameraBranchBudgetLedger,
): RealBuildPanelCameraLedgerSnapshot {
  return {
    budget: ledger.budget,
    reserved: ledger.reserved,
    refused: ledger.refusedReservation,
    failure: snapshotFailure(ledger.failedReservation),
  };
}

function sameFailure(
  left: RealBuildPanelCameraBranchBudgetFailure | null,
  right: RealBuildPanelCameraBranchBudgetFailure | null,
): boolean {
  return left === null || right === null
    ? left === right
    : left.budget === right.budget &&
        left.requested === right.requested &&
        left.reservedBefore === right.reservedBefore;
}

export function samePanelCameraLedger(
  left: RealBuildPanelCameraLedgerSnapshot,
  right: RealBuildPanelCameraLedgerSnapshot,
): boolean {
  return (
    left.budget === right.budget &&
    left.reserved === right.reserved &&
    left.refused === right.refused &&
    sameFailure(left.failure, right.failure)
  );
}

export function requireCoherentPanelCameraLedger(state: RealBuildPanelCameraLedgerSnapshot): void {
  if (
    !Number.isSafeInteger(state.budget) ||
    state.budget < 0 ||
    !Number.isSafeInteger(state.reserved) ||
    state.reserved < 0 ||
    state.reserved > state.budget ||
    typeof state.refused !== "boolean" ||
    state.refused ||
    state.failure !== null
  ) {
    throw new TypeError(
      `Panel-camera resolver ledger must be coherent and nonterminal; received ${describePanelCameraValue(state)}.`,
    );
  }
}
