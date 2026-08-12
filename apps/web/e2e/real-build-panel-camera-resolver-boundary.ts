import { canonicalStringify, sha256Hex } from "@lego-studio/brick-kernel";

import type {
  RealBuildPanelCameraBranchBudgetFailure,
  RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";

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

export interface RealBuildPanelCameraLedgerSnapshot {
  readonly budget: number;
  readonly reserved: number;
  readonly refused: boolean;
  readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
}

export const isPanelCameraRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function describePanelCameraValue(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function hasExactPanelCameraKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value);
  const required = new Set(expected);
  return actual.length === required.size && actual.every((key) => required.has(key));
}

function freezeRecursively(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freezeRecursively(Reflect.get(value, key), seen);
  Object.freeze(value);
}

export function snapshotPanelCameraDocument<D extends RealBuildPanelCameraDocument>(
  document: unknown,
): D {
  if (!isPanelCameraRecord(document)) {
    throw new TypeError(
      `Panel-camera prefix document must be an object; received ${describePanelCameraValue(document)}.`,
    );
  }
  try {
    const detached = structuredClone(document) as D;
    canonicalStringify(detached);
    if (!Array.isArray(detached.parts)) {
      throw new TypeError(
        `document.parts is ${describePanelCameraValue(detached.parts)}; required an array.`,
      );
    }
    if (detached.parts.length > MAX_DOCUMENT_PARTS) {
      throw new RangeError(
        `document.parts contains ${detached.parts.length} entries; the resolver limit is ${MAX_DOCUMENT_PARTS}.`,
      );
    }
    for (let index = 0; index < detached.parts.length; index += 1) {
      if (!Object.hasOwn(detached.parts, index)) {
        throw new TypeError(
          `document.parts contains a hole at index ${index}; required a dense array.`,
        );
      }
    }
    freezeRecursively(detached);
    return detached;
  } catch (error) {
    throw new TypeError(
      `Panel-camera prefix document could not be detached as immutable canonical JSON. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
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
