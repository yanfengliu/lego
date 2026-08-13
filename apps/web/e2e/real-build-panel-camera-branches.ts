import { canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  createRealBuildPanelCameraRegistration,
  realBuildPanelCameraObservationId,
  type RealBuildPanelCameraRegistration,
} from "./real-build-panel-camera-registration";
import type {
  RealBuildPanelCameraBranchBudgetFailure,
  RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";
import { reservePanelCameraAdmission } from "./real-build-panel-camera-admission-reservation";

export {
  createRealBuildPanelCameraBranchBudgetLedger,
  type RealBuildPanelCameraBranchBudgetFailure,
  type RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";

const ROW_KEYS = [
  "candidateId",
  "document",
  "documentHash",
  "registration",
  "silhouetteIou",
  "throughStepNumber",
] as const;
const INPUT_KEYS = ["hashDocument", "ledger", "rows"] as const;
const FAILURE_KEYS = ["budget", "requested", "reservedBefore"] as const;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildPanelCameraBranchInput<D> {
  readonly candidateId: string;
  readonly throughStepNumber: number;
  readonly document: D;
  readonly documentHash: Sha256Digest;
  readonly registration: RealBuildPanelCameraRegistration;
  /** Binary silhouette registration evidence; never physical-transform authority. */
  readonly silhouetteIou: number;
}

export interface RealBuildPanelCameraBranch<D> {
  /** Stable document-node identity; later panel observations must retain it. */
  readonly candidateId: string;
  /** Panel-local registration identity; N+1 and K observations intentionally differ. */
  readonly observationId: string;
  readonly throughStepNumber: number;
  readonly document: D;
  readonly documentHash: Sha256Digest;
  readonly registration: RealBuildPanelCameraRegistration;
  readonly silhouetteRegistration: {
    readonly authority: "binary-silhouette-registration";
    readonly iou: number;
  };
}

export interface RealBuildPanelCameraDocumentGroup<D> {
  readonly candidateId: string;
  readonly documentHash: Sha256Digest;
  /** Distinct observations remain distinct when document bytes are equal. */
  readonly branches: readonly RealBuildPanelCameraBranch<D>[];
}

export interface RealBuildPanelCameraCrossHandTie {
  readonly candidateId: string;
  readonly throughStepNumber: number;
  readonly documentHash: Sha256Digest;
  readonly silhouetteIou: number;
  readonly observationIds: readonly string[];
}

export interface RealBuildPanelCameraBranchAdmission<D> {
  readonly status: "admitted" | "budget-refused";
  readonly branches: readonly RealBuildPanelCameraBranch<D>[];
  readonly documentGroups: readonly RealBuildPanelCameraDocumentGroup<D>[];
  readonly crossHandTies: readonly RealBuildPanelCameraCrossHandTie[];
  readonly handDecision: {
    readonly status: "unresolved";
    readonly selectedLatticeHand: null;
    readonly reason: "silhouette-registration-is-not-physical-frame-authority";
  };
  readonly reservation: {
    readonly budget: number;
    readonly reservedBefore: number;
    readonly requested: number;
    readonly reservedAfter: number;
    readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
  };
}

type PreparedBranch<D> = RealBuildPanelCameraBranch<D>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function describe(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  if (typeof value === "bigint" || typeof value === "symbol") return String(value);
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  const required = new Set(expected);
  return actual.length === required.size && actual.every((key) => required.has(key));
}

function freezeRecursively(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const property of Reflect.ownKeys(value))
    freezeRecursively(Reflect.get(value, property), seen);
  Object.freeze(value);
}

function detachedDocument<D>(document: unknown, rowIndex: number): D {
  if (!isRecord(document)) {
    throw new TypeError(
      `Panel-camera branch row ${rowIndex} document must be an object; received ${describe(document)}.`,
    );
  }
  try {
    const detached = structuredClone(document) as D;
    canonicalStringify(detached);
    freezeRecursively(detached);
    return detached;
  } catch {
    throw new TypeError(
      `Panel-camera branch row ${rowIndex} document could not be detached as immutable evidence; required canonical plain JSON document data and the internal thrown value was discarded.`,
    );
  }
}

function snapshotFailure(
  supplied: RealBuildPanelCameraBranchBudgetFailure | null,
): RealBuildPanelCameraBranchBudgetFailure | null {
  if (supplied === null) return null;
  if (!isRecord(supplied) || !hasExactKeys(supplied, FAILURE_KEYS)) {
    throw new TypeError(
      `Panel-camera branch ledger failure must contain exactly ${FAILURE_KEYS.join(", ")}; received ${describe(supplied)}.`,
    );
  }
  const { budget, requested, reservedBefore } = supplied;
  if (![budget, requested, reservedBefore].every(Number.isSafeInteger)) {
    throw new TypeError(
      `Panel-camera branch ledger failure values must be safe integers; received ${describe({ budget, requested, reservedBefore })}.`,
    );
  }
  return Object.freeze({
    budget: budget as number,
    requested: requested as number,
    reservedBefore: reservedBefore as number,
  });
}

interface LedgerState {
  readonly budget: number;
  readonly reserved: number;
  readonly refused: boolean;
  readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
}

function snapshotLedgerState(ledger: RealBuildPanelCameraBranchBudgetLedger): LedgerState {
  const budget = ledger.budget;
  const reserved = ledger.reserved;
  const refused = ledger.refusedReservation;
  const failure = snapshotFailure(ledger.failedReservation);
  return { budget, reserved, refused, failure };
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

/** Unicode scalar-value ordering, independent of locale and UTF-16 surrogate order. */
export function compareRealBuildPanelCameraObservationIds(left: string, right: string): number {
  const leftIterator = left[Symbol.iterator]();
  const rightIterator = right[Symbol.iterator]();
  for (;;) {
    const leftNext = leftIterator.next();
    const rightNext = rightIterator.next();
    if (leftNext.done || rightNext.done) {
      return leftNext.done === rightNext.done ? 0 : leftNext.done ? -1 : 1;
    }
    const difference = leftNext.value.codePointAt(0)! - rightNext.value.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
}

/** Phase one: detach every caller-owned row before invoking any callback or touching the ledger. */
function snapshotRows<D>(
  suppliedRows: readonly RealBuildPanelCameraBranchInput<D>[],
): PreparedBranch<D>[] {
  if (!Array.isArray(suppliedRows) || suppliedRows.length === 0) {
    throw new RangeError(
      `Panel-camera branch rows must be a non-empty dense array; received ${describe(suppliedRows)}.`,
    );
  }
  const prepared: PreparedBranch<D>[] = [];
  for (let index = 0; index < suppliedRows.length; index += 1) {
    if (!Object.hasOwn(suppliedRows, index)) {
      throw new TypeError(
        `Panel-camera branch rows contain a hole at index ${index}; required a dense array.`,
      );
    }
    const supplied = suppliedRows[index] as unknown;
    if (!isRecord(supplied) || !hasExactKeys(supplied, ROW_KEYS)) {
      throw new TypeError(
        `Panel-camera branch row ${index} must contain exactly ${ROW_KEYS.join(", ")}; received ${describe(supplied)}.`,
      );
    }
    const { candidateId, throughStepNumber, document, documentHash, registration, silhouetteIou } =
      supplied;
    if (!Number.isSafeInteger(throughStepNumber) || (throughStepNumber as number) < 0) {
      throw new RangeError(
        `Panel-camera branch row ${index} throughStepNumber must be a non-negative safe integer; received ${describe(throughStepNumber)}.`,
      );
    }
    if (typeof documentHash !== "string" || !DIGEST_PATTERN.test(documentHash)) {
      throw new TypeError(
        `Panel-camera branch row ${index} documentHash must be a lowercase sha256 digest; received ${describe(documentHash)}.`,
      );
    }
    if (
      typeof silhouetteIou !== "number" ||
      !Number.isFinite(silhouetteIou) ||
      silhouetteIou < 0 ||
      silhouetteIou > 1
    ) {
      throw new RangeError(
        `Panel-camera branch row ${index} silhouetteIou must be finite from 0 through 1; received ${describe(silhouetteIou)}.`,
      );
    }
    const step = throughStepNumber as number;
    const digest = documentHash as Sha256Digest;
    const copiedRegistration = createRealBuildPanelCameraRegistration(registration);
    const observationId = realBuildPanelCameraObservationId({
      candidateId: candidateId as string,
      registration: copiedRegistration,
    });
    if (!(candidateId as string).endsWith(digest)) {
      throw new TypeError(
        `Panel-camera branch row ${index} candidateId ${JSON.stringify(candidateId)} does not bind documentHash ${JSON.stringify(digest)}; stable identity and retained document bytes must agree.`,
      );
    }
    prepared.push(
      Object.freeze({
        candidateId: candidateId as string,
        observationId,
        throughStepNumber: step,
        document: detachedDocument<D>(document, index),
        documentHash: digest,
        registration: copiedRegistration,
        silhouetteRegistration: Object.freeze({
          authority: "binary-silhouette-registration" as const,
          iou: silhouetteIou === 0 ? 0 : silhouetteIou,
        }),
      }),
    );
  }
  return prepared;
}

/** Phase two: hash only the complete frozen snapshot and reject callback side effects. */
function verifyHashes<D>(
  prepared: readonly PreparedBranch<D>[],
  hashDocument: (document: D) => Sha256Digest,
  ledger: RealBuildPanelCameraBranchBudgetLedger,
  ledgerBefore: LedgerState,
): void {
  for (const branch of prepared) {
    let measuredHash: unknown;
    let hashCallbackThrew = false;
    try {
      measuredHash = hashDocument(branch.document);
    } catch {
      hashCallbackThrew = true;
    }
    const ledgerAfterCallback = snapshotLedgerState(ledger);
    if (
      ledgerAfterCallback.budget !== ledgerBefore.budget ||
      ledgerAfterCallback.reserved !== ledgerBefore.reserved ||
      ledgerAfterCallback.refused !== ledgerBefore.refused ||
      !sameFailure(ledgerAfterCallback.failure, ledgerBefore.failure)
    ) {
      throw new TypeError(
        `Panel-camera hashDocument changed the shared budget ledger from ${describe(ledgerBefore)} to ${describe(ledgerAfterCallback)} while hashing observation ${JSON.stringify(branch.observationId)}; hashing must be pure, admission stopped before its own reservation, and the mutated ledger must be discarded.${hashCallbackThrew ? " The callback also threw an untrusted value that was discarded." : ""}`,
      );
    }
    if (hashCallbackThrew) {
      throw new TypeError(
        `Panel-camera observation ${JSON.stringify(branch.observationId)} hashDocument threw an untrusted value; required the deterministic structural hash of the detached document and the thrown value was discarded.`,
      );
    }
    if (typeof measuredHash !== "string" || !DIGEST_PATTERN.test(measuredHash)) {
      throw new TypeError(
        `Panel-camera observation ${JSON.stringify(branch.observationId)} hashDocument returned ${describe(measuredHash)}; required a lowercase sha256 digest.`,
      );
    }
    if (measuredHash !== branch.documentHash) {
      throw new TypeError(
        `Panel-camera observation ${JSON.stringify(branch.observationId)} claims documentHash ${JSON.stringify(branch.documentHash)}, but the detached document hashes to ${JSON.stringify(measuredHash)}; recompute identity from the exact retained document bytes.`,
      );
    }
  }
}

function orderedUnique<D>(prepared: readonly PreparedBranch<D>[]): PreparedBranch<D>[] {
  const ordered = [...prepared].sort((left, right) =>
    compareRealBuildPanelCameraObservationIds(left.observationId, right.observationId),
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1]!.observationId === ordered[index]!.observationId) {
      throw new TypeError(
        `Panel-camera rows duplicate observation ${JSON.stringify(ordered[index]!.observationId)}; each panel-local document registration must appear once.`,
      );
    }
  }
  return ordered;
}

function groupDocuments<D>(
  branches: readonly PreparedBranch<D>[],
): RealBuildPanelCameraDocumentGroup<D>[] {
  const grouped = new Map<string, PreparedBranch<D>[]>();
  for (const branch of branches) {
    const group = grouped.get(branch.candidateId);
    if (group === undefined) grouped.set(branch.candidateId, [branch]);
    else group.push(branch);
  }
  return [...grouped]
    .sort(([left], [right]) => compareRealBuildPanelCameraObservationIds(left, right))
    .map(([stableCandidateId, observations]) =>
      Object.freeze({
        candidateId: stableCandidateId,
        documentHash: observations[0]!.documentHash,
        branches: Object.freeze([...observations]),
      }),
    );
}

function crossHandTies<D>(
  branches: readonly PreparedBranch<D>[],
): RealBuildPanelCameraCrossHandTie[] {
  const groups = new Map<string, PreparedBranch<D>[]>();
  for (const branch of branches) {
    const key = JSON.stringify([
      branch.candidateId,
      branch.registration.registrationPanelStepNumber,
      branch.silhouetteRegistration.iou,
    ]);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [branch]);
    else group.push(branch);
  }
  return [...groups.values()]
    .filter((group) => new Set(group.map(({ registration }) => registration.latticeHand)).size > 1)
    .map((group) => {
      const first = group[0]!;
      return Object.freeze({
        candidateId: first.candidateId,
        throughStepNumber: first.throughStepNumber,
        documentHash: first.documentHash,
        silhouetteIou: first.silhouetteRegistration.iou,
        observationIds: Object.freeze(group.map(({ observationId }) => observationId)),
      });
    })
    .sort((left, right) =>
      compareRealBuildPanelCameraObservationIds(left.observationIds[0]!, right.observationIds[0]!),
    );
}

export function admitRealBuildPanelCameraBranches<D>(input: {
  readonly rows: readonly RealBuildPanelCameraBranchInput<D>[];
  readonly ledger: RealBuildPanelCameraBranchBudgetLedger;
  readonly hashDocument: (document: D) => Sha256Digest;
}): RealBuildPanelCameraBranchAdmission<D> {
  if (!isRecord(input) || !hasExactKeys(input, INPUT_KEYS)) {
    throw new TypeError(
      `Panel-camera branch admission must contain exactly ${INPUT_KEYS.join(", ")}; received ${describe(input)}.`,
    );
  }
  const { rows, ledger, hashDocument } = input;
  if (typeof hashDocument !== "function") {
    throw new TypeError(
      `Panel-camera hashDocument must be a deterministic structural-hash function; received ${describe(hashDocument)}.`,
    );
  }
  if (!isRecord(ledger)) {
    throw new TypeError(
      `Panel-camera branch ledger must be an object with atomic reservation state; received ${describe(ledger)}.`,
    );
  }
  const tryReserve = ledger.tryReserve;
  if (typeof tryReserve !== "function") {
    throw new TypeError(
      `Panel-camera branch ledger tryReserve must be a function; received ${describe(tryReserve)}.`,
    );
  }
  const prepared = snapshotRows(rows);
  const ledgerBefore = snapshotLedgerState(ledger);
  if (
    !Number.isSafeInteger(ledgerBefore.budget) ||
    ledgerBefore.budget < 0 ||
    !Number.isSafeInteger(ledgerBefore.reserved) ||
    ledgerBefore.reserved < 0 ||
    ledgerBefore.reserved > ledgerBefore.budget ||
    ledgerBefore.refused ||
    ledgerBefore.failure !== null
  ) {
    throw new TypeError(
      `Panel-camera branch ledger must be coherent and nonterminal before admission; received ${describe(ledgerBefore)}.`,
    );
  }
  verifyHashes(prepared, hashDocument, ledger, ledgerBefore);
  const ordered = orderedUnique(prepared);
  const requested = ordered.length;
  const { admitted, after: ledgerAfter } = reservePanelCameraAdmission({
    tryReserve,
    ledger,
    before: ledgerBefore,
    requested,
    snapshot: snapshotLedgerState,
    describe,
  });
  const handDecision = Object.freeze({
    status: "unresolved" as const,
    selectedLatticeHand: null,
    reason: "silhouette-registration-is-not-physical-frame-authority" as const,
  });
  const reservation = Object.freeze({
    budget: ledgerBefore.budget,
    reservedBefore: ledgerBefore.reserved,
    requested,
    reservedAfter: ledgerAfter.reserved,
    failure: ledgerAfter.failure,
  });
  if (!admitted) {
    return Object.freeze({
      status: "budget-refused" as const,
      branches: Object.freeze([]),
      documentGroups: Object.freeze([]),
      crossHandTies: Object.freeze([]),
      handDecision,
      reservation,
    });
  }
  return Object.freeze({
    status: "admitted" as const,
    branches: Object.freeze(ordered),
    documentGroups: Object.freeze(groupDocuments(ordered)),
    crossHandTies: Object.freeze(crossHandTies(ordered)),
    handDecision,
    reservation,
  });
}
