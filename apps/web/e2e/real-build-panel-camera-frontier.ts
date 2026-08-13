import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { reservePanelCameraAdmission } from "./real-build-panel-camera-admission-reservation";
import {
  createRealBuildPanelCameraBranchBudgetLedger,
  type RealBuildPanelCameraBranchBudgetFailure,
  type RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";
import {
  describePanelCameraValue as describe,
  hasExactPanelCameraKeys as hasExactKeys,
  isPanelCameraRecord as isRecord,
  PANEL_CAMERA_ANGULAR_HYPOTHESES,
  PANEL_CAMERA_DIGEST_PATTERN,
  realBuildPanelCameraLineageId,
  requireCoherentPanelCameraLedger,
  samePanelCameraLedger,
  snapshotPanelCameraLedger,
  snapshotPanelCameraBinaryMask,
  UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
  type RealBuildPanelCameraDocument,
  type RealBuildPanelCameraLedgerSnapshot,
} from "./real-build-panel-camera-resolver-boundary";
import {
  describePanelCameraFrontierPreparationFailure,
  preparePanelCameraFrontierCandidates,
  snapshotPanelCameraFrontierPrefixHeaders,
  type PreparedPanelCameraFrontierCandidate,
} from "./real-build-panel-camera-frontier-input";
import {
  resolveRealBuildPanelCameraBranches,
  type RealBuildPanelCameraPrefixInput,
  type RealBuildResolvedPanelCameraObservation,
} from "./real-build-panel-camera-resolver";
import type {
  StepCameraLatticeAttempt,
  StepCameraLatticeHypothesis,
} from "./real-build-step-camera";
import type { StepFailure } from "./real-build-safety";

const INPUT_KEYS =
  "builtMask,excludedMask,hashDocument,heightPx,ledger,prefixes,registrationPanelStepNumber,renderModelMask,widthPx".split(
    ",",
  );
const MAX_CAMERA_PIXELS = 16_777_216;
const TRUSTED_PANEL_CAMERA_FRONTIER_RESOLUTIONS = new WeakSet<object>();
export interface RealBuildPanelCameraFrontierCandidate<D> {
  readonly status: "observed" | "unresolved" | "failed";
  readonly candidateId: string;
  readonly throughStepNumber: number;
  readonly document: D;
  readonly documentHash: Sha256Digest;
  readonly parentLineageIds: readonly string[];
  readonly attempts: readonly StepCameraLatticeAttempt[];
  readonly renderMaskDigests: readonly (string | null)[];
  readonly observationIds: readonly string[];
  readonly selectedObservationId: string | null;
  readonly selectedLineageIds: readonly {
    readonly parentLineageId: string;
    readonly lineageId: string;
  }[];
  readonly failure: StepFailure | null;
}

export interface RealBuildPanelCameraFrontierResolution<D> {
  readonly status: "observed" | "unresolved" | "failed" | "budget-refused";
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly candidates: readonly RealBuildPanelCameraFrontierCandidate<D>[];
  readonly observations: readonly RealBuildResolvedPanelCameraObservation<D>[];
  readonly failure: StepFailure | null;
  readonly reservation: {
    readonly budget: number;
    readonly reservedBefore: number;
    readonly requested: number;
    readonly reservedAfter: number;
    readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
  };
  readonly physicalFrameDecision: typeof UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME;
  readonly rasterMeasurement: {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly builtMaskDigest: string;
    readonly excludedMaskDigest: string | null;
  };
}

function sealPanelCameraFrontierResolution<D>(
  value: RealBuildPanelCameraFrontierResolution<D>,
): RealBuildPanelCameraFrontierResolution<D> {
  TRUSTED_PANEL_CAMERA_FRONTIER_RESOLUTIONS.add(value);
  return value;
}

/** Nonforgeable in-process boundary for central lineage composition. */
export function requireTrustedRealBuildPanelCameraFrontierResolution(
  value: unknown,
): RealBuildPanelCameraFrontierResolution<unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    !TRUSTED_PANEL_CAMERA_FRONTIER_RESOLUTIONS.has(value)
  ) {
    throw new TypeError(
      "Panel-camera frontier lineage composition requires the exact immutable result returned by resolveRealBuildPanelCameraFrontier.",
    );
  }
  return value as RealBuildPanelCameraFrontierResolution<unknown>;
}

function snapshotExternalLedger(
  ledger: RealBuildPanelCameraBranchBudgetLedger,
): RealBuildPanelCameraLedgerSnapshot {
  const state = snapshotPanelCameraLedger(ledger);
  requireCoherentPanelCameraLedger(state);
  return state;
}

function requireUnchangedExternalLedger(
  expected: RealBuildPanelCameraLedgerSnapshot,
  ledger: RealBuildPanelCameraBranchBudgetLedger,
  context: string,
  callbackThrew = false,
): void {
  const actual = snapshotPanelCameraLedger(ledger);
  if (!samePanelCameraLedger(expected, actual)) {
    throw new TypeError(
      `Panel-camera frontier ${context} changed the external branch ledger from ${describe(expected)} to ${describe(actual)}; finish no admission and discard the mutated ledger.${callbackThrew ? " The callback also threw an untrusted value that was discarded." : ""}`,
    );
  }
}

function snapshotStepFailure(failure: StepFailure | null): StepFailure | null {
  return failure === null ? null : Object.freeze(structuredClone(failure));
}

export function resolveRealBuildPanelCameraFrontier<
  D extends RealBuildPanelCameraDocument,
>(suppliedInput: {
  readonly prefixes: readonly RealBuildPanelCameraPrefixInput<D>[];
  readonly registrationPanelStepNumber: number;
  readonly renderModelMask: (input: {
    readonly candidateId: string;
    readonly document: D;
    readonly hypothesis: StepCameraLatticeHypothesis;
  }) => Uint8Array;
  readonly builtMask: Uint8Array;
  readonly excludedMask: Uint8Array | null;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly ledger: RealBuildPanelCameraBranchBudgetLedger;
  readonly hashDocument: (document: D) => Sha256Digest;
}): RealBuildPanelCameraFrontierResolution<D> {
  if (!isRecord(suppliedInput) || !hasExactKeys(suppliedInput, INPUT_KEYS)) {
    throw new TypeError(
      `Panel-camera frontier input must contain exactly ${INPUT_KEYS.join(", ")}; received ${describe(suppliedInput)}.`,
    );
  }
  const input = Object.freeze({ ...suppliedInput });
  if (
    !Number.isSafeInteger(input.registrationPanelStepNumber) ||
    input.registrationPanelStepNumber < 1
  ) {
    throw new RangeError(
      `Panel-camera frontier registrationPanelStepNumber must be a positive safe integer; received ${describe(input.registrationPanelStepNumber)}.`,
    );
  }
  if (typeof input.renderModelMask !== "function" || typeof input.hashDocument !== "function") {
    throw new TypeError(
      `Panel-camera frontier renderModelMask and hashDocument must both be functions; received ${describe({ renderModelMask: input.renderModelMask, hashDocument: input.hashDocument })}.`,
    );
  }
  const tryReserve = isRecord(input.ledger) ? input.ledger.tryReserve : null;
  if (typeof tryReserve !== "function") {
    throw new TypeError(
      `Panel-camera frontier ledger must expose an atomic tryReserve function and readable budget state; received ${describe(input.ledger)}.`,
    );
  }
  if (
    !Number.isSafeInteger(input.widthPx) ||
    input.widthPx < 1 ||
    !Number.isSafeInteger(input.heightPx) ||
    input.heightPx < 1 ||
    input.widthPx * input.heightPx > MAX_CAMERA_PIXELS
  ) {
    throw new RangeError(
      `Panel-camera frontier raster ${describe(input.widthPx)}x${describe(input.heightPx)} must have positive safe dimensions and at most ${MAX_CAMERA_PIXELS} pixels.`,
    );
  }
  const pixelCount = input.widthPx * input.heightPx;
  const builtMask = snapshotPanelCameraBinaryMask(
    input.builtMask,
    pixelCount,
    "Panel-camera frontier builtMask",
  );
  const excludedMask =
    input.excludedMask === null
      ? null
      : snapshotPanelCameraBinaryMask(
          input.excludedMask,
          pixelCount,
          "Panel-camera frontier excludedMask",
        );
  const rasterMeasurement = Object.freeze({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    builtMaskDigest: `sha256:${sha256Hex(builtMask)}`,
    excludedMaskDigest: excludedMask === null ? null : `sha256:${sha256Hex(excludedMask)}`,
  });
  const ledgerBefore = snapshotExternalLedger(input.ledger);
  const headers = snapshotPanelCameraFrontierPrefixHeaders({
    prefixes: input.prefixes,
    registrationPanelStepNumber: input.registrationPanelStepNumber,
  });
  const requested = headers.length * PANEL_CAMERA_ANGULAR_HYPOTHESES.length;
  const throughStepNumber = headers[0]!.throughStepNumber;
  if (!Number.isSafeInteger(requested)) {
    throw new RangeError(
      `Panel-camera frontier ${headers.length} prefixes require an unsafe reservation count; no budget was reserved.`,
    );
  }
  const reserved = reservePanelCameraAdmission({
    tryReserve,
    ledger: input.ledger,
    before: ledgerBefore,
    requested,
    snapshot: snapshotPanelCameraLedger,
    describe,
  });
  const reservation = Object.freeze({
    budget: ledgerBefore.budget,
    reservedBefore: ledgerBefore.reserved,
    requested,
    reservedAfter: reserved.after.reserved,
    failure: reserved.after.failure,
  });
  if (!reserved.admitted) {
    const failure = Object.freeze({
      code: "resource-budget-exhausted" as const,
      stage: "budget" as const,
      stepNumber: input.registrationPanelStepNumber,
      message:
        `Panel ${input.registrationPanelStepNumber} could not retain ${headers.length} complete eight-branch camera prefixes: ` +
        `reservation ${ledgerBefore.reserved}+${requested} exceeds budget ${ledgerBefore.budget}; no document was cloned or hashed, no render callback ran, and no observation was admitted.`,
    });
    return sealPanelCameraFrontierResolution(
      Object.freeze({
        status: "budget-refused" as const,
        throughStepNumber,
        registrationPanelStepNumber: input.registrationPanelStepNumber,
        candidates: Object.freeze([]),
        observations: Object.freeze([]),
        failure,
        reservation,
        physicalFrameDecision: UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
        rasterMeasurement,
      }),
    );
  }

  const ledgerAfterReservation = reserved.after;
  let groups: readonly PreparedPanelCameraFrontierCandidate<D>[] = [];
  let preparationFailed = false;
  let preparationFailureMessage: string | null = null;
  try {
    groups = preparePanelCameraFrontierCandidates(headers);
  } catch (caught) {
    preparationFailed = true;
    preparationFailureMessage = describePanelCameraFrontierPreparationFailure(caught);
  }
  requireUnchangedExternalLedger(
    ledgerAfterReservation,
    input.ledger,
    "document preparation after reservation",
    preparationFailed,
  );
  if (preparationFailed) {
    throw new TypeError(
      preparationFailureMessage === null
        ? `Panel-camera frontier document preparation threw an untrusted value after reserving ${requested} branches; no hash or render ran, the thrown value was discarded, and the ledger must be discarded.`
        : `${preparationFailureMessage} No hash or render ran after reserving ${requested} branches.`,
    );
  }
  for (const group of groups) {
    let measured: unknown;
    let hashCallbackThrew = false;
    try {
      measured = input.hashDocument(group.document);
    } catch {
      hashCallbackThrew = true;
    }
    requireUnchangedExternalLedger(
      ledgerAfterReservation,
      input.ledger,
      `hash callback for ${JSON.stringify(group.candidateId)}`,
      hashCallbackThrew,
    );
    if (hashCallbackThrew) {
      throw new TypeError(
        `Panel-camera frontier candidate ${JSON.stringify(group.candidateId)} hashDocument threw an untrusted value after reservation; no render ran, the thrown value was discarded, and the ledger must be discarded.`,
      );
    }
    if (typeof measured !== "string" || !PANEL_CAMERA_DIGEST_PATTERN.test(measured)) {
      throw new TypeError(
        `Panel-camera frontier hashDocument returned ${describe(measured)} for ${JSON.stringify(group.candidateId)} after reservation; required a lowercase sha256 digest, no render ran, and the ledger must be discarded.`,
      );
    }
    if (measured !== group.documentHash) {
      throw new TypeError(
        `Panel-camera frontier candidate ${JSON.stringify(group.candidateId)} claims ${JSON.stringify(group.documentHash)}, but its detached document hashes to ${JSON.stringify(measured)} after reservation; no render ran and the ledger must be discarded.`,
      );
    }
  }
  let externalLedgerDefect: string | null = null;
  const candidateResults: RealBuildPanelCameraFrontierCandidate<D>[] = [];
  const observations: RealBuildResolvedPanelCameraObservation<D>[] = [];
  const lineageIds = new Set<string>();
  for (const group of groups) {
    const selectedLineageIds: { readonly parentLineageId: string; readonly lineageId: string }[] =
      [];
    const scalar = resolveRealBuildPanelCameraBranches({
      prefix: {
        throughStepNumber: group.throughStepNumber,
        parentLineageId: group.parentLineageIds[0]!,
        document: group.document,
        documentHash: group.documentHash,
      },
      registrationPanelStepNumber: input.registrationPanelStepNumber,
      renderModelMask: ({ document, hypothesis }) => {
        const before = snapshotPanelCameraLedger(input.ledger);
        if (!samePanelCameraLedger(ledgerAfterReservation, before)) {
          externalLedgerDefect ??= `before rendering ${group.candidateId}/${hypothesis.latticeHand}/${hypothesis.turnDegrees}, state was ${describe(before)}`;
          throw new TypeError("the external frontier branch ledger was already mutated");
        }
        let rendered: unknown;
        let renderCallbackThrew = false;
        try {
          rendered = input.renderModelMask(
            Object.freeze({ candidateId: group.candidateId, document, hypothesis }),
          );
        } catch {
          renderCallbackThrew = true;
        }
        const after = snapshotPanelCameraLedger(input.ledger);
        if (!samePanelCameraLedger(ledgerAfterReservation, after)) {
          externalLedgerDefect ??= `rendering ${group.candidateId}/${hypothesis.latticeHand}/${hypothesis.turnDegrees} changed state to ${describe(after)}`;
          throw new TypeError(
            `the render callback mutated the external frontier branch ledger${renderCallbackThrew ? " and also threw an untrusted value that was discarded" : ""}`,
          );
        }
        if (renderCallbackThrew) {
          throw new TypeError("the render callback threw an untrusted value that was discarded");
        }
        return rendered as Uint8Array;
      },
      builtMask,
      excludedMask,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
      hashDocument: () => group.documentHash,
    });
    const candidateStatus =
      scalar.status === "observed" || scalar.status === "unresolved" || scalar.status === "failed"
        ? scalar.status
        : (() => {
            throw new TypeError(
              `Panel-camera frontier private exact-capacity resolver returned ${JSON.stringify(scalar.status)} for nonempty candidate ${JSON.stringify(group.candidateId)}.`,
            );
          })();
    const candidateFailure = snapshotStepFailure(scalar.failure);
    for (const observation of scalar.observations) {
      for (const parentLineageId of group.parentLineageIds) {
        const lineageId = realBuildPanelCameraLineageId({
          parentLineageId,
          localIdentity: observation.observationId,
        });
        if (lineageIds.has(lineageId)) {
          throw new TypeError(
            `Panel-camera frontier generated duplicate lineage ${JSON.stringify(lineageId)}; parent and observation identities must be unique.`,
          );
        }
        lineageIds.add(lineageId);
        observations.push(Object.freeze({ ...observation, lineageId, parentLineageId }));
        if (observation.observationId === scalar.selectedObservationId) {
          selectedLineageIds.push(Object.freeze({ parentLineageId, lineageId }));
        }
      }
    }
    candidateResults.push(
      Object.freeze({
        status: candidateStatus,
        candidateId: group.candidateId,
        throughStepNumber: group.throughStepNumber,
        document: scalar.observations[0]?.document ?? group.document,
        documentHash: group.documentHash,
        parentLineageIds: Object.freeze([...group.parentLineageIds]),
        attempts: scalar.attempts,
        renderMaskDigests: scalar.renderMaskDigests,
        observationIds: Object.freeze(
          scalar.observations.map(({ observationId }) => observationId),
        ),
        selectedObservationId: scalar.selectedObservationId,
        selectedLineageIds: Object.freeze(selectedLineageIds),
        failure: candidateFailure,
      }),
    );
  }
  const finalLedger = snapshotPanelCameraLedger(input.ledger);
  if (
    externalLedgerDefect !== null ||
    !samePanelCameraLedger(ledgerAfterReservation, finalLedger)
  ) {
    throw new TypeError(
      `Panel-camera frontier render callbacks changed the external branch ledger after its one atomic reservation: ${externalLedgerDefect ?? describe(finalLedger)}. All unique candidate/hypothesis attempts finished, but no result may be admitted; discard the mutated ledger.`,
    );
  }
  const status = candidateResults.some(({ status: value }) => value === "failed")
    ? ("failed" as const)
    : candidateResults.some(({ status: value }) => value === "unresolved")
      ? ("unresolved" as const)
      : ("observed" as const);
  const failure = snapshotStepFailure(
    status === "observed"
      ? null
      : (candidateResults.find(({ status: candidateStatus }) => candidateStatus === status)
          ?.failure ?? null),
  );
  return sealPanelCameraFrontierResolution(
    Object.freeze({
      status,
      throughStepNumber,
      registrationPanelStepNumber: input.registrationPanelStepNumber,
      candidates: Object.freeze(candidateResults),
      observations: Object.freeze(observations),
      failure,
      reservation,
      physicalFrameDecision: UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
      rasterMeasurement,
    }),
  );
}
