import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  admitRealBuildPanelCameraBranches,
  type RealBuildPanelCameraBranch,
} from "./real-build-panel-camera-branches";
import {
  createRealBuildPanelCameraBranchBudgetLedger,
  type RealBuildPanelCameraBranchBudgetFailure,
  type RealBuildPanelCameraBranchBudgetLedger,
} from "./real-build-panel-camera-branch-budget";
import { createRealBuildPanelCameraRegistration } from "./real-build-panel-camera-registration";
import {
  describePanelCameraValue as describe,
  hasExactPanelCameraKeys as hasExactKeys,
  isPanelCameraRecord as isRecord,
  PANEL_CAMERA_ANGULAR_HYPOTHESES as ANGULAR_HYPOTHESES,
  PANEL_CAMERA_DIGEST_PATTERN,
  realBuildPanelCameraLineageId,
  realBuildStableDocumentCandidateId as stableCandidateId,
  requireCoherentPanelCameraLedger as requireCoherentLedger,
  samePanelCameraLedger as sameLedger,
  snapshotPanelCameraDocument as snapshotDocument,
  snapshotPanelCameraLedger as snapshotLedger,
  UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME as physicalFrameDecision,
  type RealBuildPanelCameraDocument as CameraDocument,
} from "./real-build-panel-camera-resolver-boundary";
import {
  anchorStepCameraLatticeFrame,
  type StepCameraLatticeAttempt,
  type StepCameraLatticeHypothesis,
} from "./real-build-step-camera";
import type { StepFailure } from "./real-build-safety";

const INPUT_KEYS = [
  "builtMask",
  "excludedMask",
  "hashDocument",
  "heightPx",
  "ledger",
  "prefix",
  "registrationPanelStepNumber",
  "renderModelMask",
  "widthPx",
] as const;
const PREFIX_KEYS = ["document", "documentHash", "parentLineageId", "throughStepNumber"] as const;
const MAX_CAMERA_PIXELS = 16_777_216;
const LINEAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;

export interface RealBuildPanelCameraPrefixInput<D extends CameraDocument> {
  readonly throughStepNumber: number;
  readonly parentLineageId: string | null;
  readonly document: D;
  readonly documentHash: Sha256Digest;
}

export interface RealBuildPanelCameraAngularSeed<D> {
  readonly candidateId: string;
  readonly lineageId: string;
  readonly parentLineageId: string | null;
  readonly throughStepNumber: 0;
  readonly document: D;
  readonly registrationPanelStepNumber: number;
  readonly latticeHand: StepCameraLatticeHypothesis["latticeHand"];
  readonly latticeDeterminant: 1 | -1;
  readonly turnDegrees: StepCameraLatticeHypothesis["turnDegrees"];
  readonly registrationStatus: "unregistered";
  readonly observationId: null;
  readonly shiftPx: null;
}

export interface RealBuildResolvedPanelCameraObservation<D> extends RealBuildPanelCameraBranch<D> {
  readonly lineageId: string;
  readonly parentLineageId: string | null;
}

export interface RealBuildPanelCameraResolution<D> {
  readonly status: "seeded" | "observed" | "unresolved" | "failed" | "budget-refused";
  readonly candidateId: string;
  readonly parentLineageId: string | null;
  readonly documentHash: Sha256Digest;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly seeds: readonly RealBuildPanelCameraAngularSeed<D>[];
  readonly attempts: readonly StepCameraLatticeAttempt[];
  readonly observations: readonly RealBuildResolvedPanelCameraObservation<D>[];
  readonly selectedObservationId: string | null;
  readonly failure: StepFailure | null;
  readonly reservation: {
    readonly budget: number;
    readonly reservedBefore: number;
    readonly requested: number;
    readonly reservedAfter: number;
    readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
  };
  readonly physicalFrameDecision: {
    readonly status: "unresolved";
    readonly authorizedTransform: null;
    readonly reason: "panel-camera-silhouette-is-not-physical-transform-authority";
  };
}

export function resolveRealBuildPanelCameraBranches<D extends CameraDocument>(input: {
  readonly prefix: RealBuildPanelCameraPrefixInput<D>;
  readonly registrationPanelStepNumber: number;
  readonly renderModelMask: (input: {
    readonly candidateId: string;
    readonly parentLineageId: string | null;
    readonly document: D;
    readonly hypothesis: StepCameraLatticeHypothesis;
  }) => Uint8Array;
  readonly builtMask: Uint8Array;
  readonly excludedMask: Uint8Array | null;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly ledger: RealBuildPanelCameraBranchBudgetLedger;
  readonly hashDocument: (document: D) => Sha256Digest;
}): RealBuildPanelCameraResolution<D> {
  if (!isRecord(input) || !hasExactKeys(input, INPUT_KEYS)) {
    throw new TypeError(
      `Panel-camera resolver input must contain exactly ${INPUT_KEYS.join(", ")}; received ${describe(input)}.`,
    );
  }
  const {
    prefix: suppliedPrefix,
    registrationPanelStepNumber,
    renderModelMask,
    builtMask,
    excludedMask,
    widthPx,
    heightPx,
    ledger,
    hashDocument,
  } = input;
  if (!isRecord(suppliedPrefix) || !hasExactKeys(suppliedPrefix, PREFIX_KEYS)) {
    throw new TypeError(
      `Panel-camera prefix must contain exactly ${PREFIX_KEYS.join(", ")}; received ${describe(suppliedPrefix)}.`,
    );
  }
  const { throughStepNumber, parentLineageId, document, documentHash } = suppliedPrefix;
  if (!Number.isSafeInteger(throughStepNumber) || throughStepNumber < 0) {
    throw new RangeError(
      `Panel-camera prefix throughStepNumber must be a non-negative safe integer; received ${describe(throughStepNumber)}.`,
    );
  }
  if (
    parentLineageId !== null &&
    (typeof parentLineageId !== "string" || !LINEAGE_ID_PATTERN.test(parentLineageId))
  ) {
    throw new TypeError(
      `Panel-camera prefix parentLineageId must be null or a 1-256 character ASCII lineage id using letters, digits, dot, underscore, colon, at, or hyphen; received ${describe(parentLineageId)}.`,
    );
  }
  if (typeof documentHash !== "string" || !PANEL_CAMERA_DIGEST_PATTERN.test(documentHash)) {
    throw new TypeError(
      `Panel-camera prefix documentHash must be a lowercase sha256 digest; received ${describe(documentHash)}.`,
    );
  }
  if (!Number.isSafeInteger(registrationPanelStepNumber) || registrationPanelStepNumber < 1) {
    throw new RangeError(
      `Panel-camera registrationPanelStepNumber must be a positive safe integer; received ${describe(registrationPanelStepNumber)}.`,
    );
  }
  if (registrationPanelStepNumber <= throughStepNumber) {
    throw new RangeError(
      `Panel-camera registration panel ${registrationPanelStepNumber} is not later than prefix step ${throughStepNumber}; observation panels must move lineage strictly forward.`,
    );
  }
  if (typeof renderModelMask !== "function" || typeof hashDocument !== "function") {
    throw new TypeError(
      `Panel-camera renderModelMask and hashDocument must both be functions; received ${describe({ renderModelMask, hashDocument })}.`,
    );
  }
  if (!isRecord(ledger)) {
    throw new TypeError(
      `Panel-camera ledger must expose an atomic tryReserve function and readable budget state; received ${describe(ledger)}.`,
    );
  }
  const tryReserve = ledger.tryReserve;
  if (typeof tryReserve !== "function") {
    throw new TypeError(
      `Panel-camera ledger tryReserve must be a function; received ${describe(tryReserve)}.`,
    );
  }
  if (
    !Number.isSafeInteger(widthPx) ||
    widthPx < 1 ||
    !Number.isSafeInteger(heightPx) ||
    heightPx < 1 ||
    widthPx * heightPx > MAX_CAMERA_PIXELS
  ) {
    throw new RangeError(
      `Panel-camera raster ${describe(widthPx)}x${describe(heightPx)} must have positive safe dimensions and at most ${MAX_CAMERA_PIXELS} pixels.`,
    );
  }
  const pixelCount = widthPx * heightPx;
  if (!(builtMask instanceof Uint8Array) || builtMask.length !== pixelCount) {
    throw new RangeError(
      `Panel-camera builtMask must be a Uint8Array of exactly ${pixelCount} pixels; received ${describe(builtMask)}.`,
    );
  }
  if (
    excludedMask !== null &&
    (!(excludedMask instanceof Uint8Array) || excludedMask.length !== pixelCount)
  ) {
    throw new RangeError(
      `Panel-camera excludedMask must be null or a Uint8Array of exactly ${pixelCount} pixels; received ${describe(excludedMask)}.`,
    );
  }
  const builtMaskSnapshot = new Uint8Array(builtMask);
  const excludedMaskSnapshot = excludedMask === null ? null : new Uint8Array(excludedMask);

  const detachedDocument = snapshotDocument<D>(document);
  const partCount = detachedDocument.parts.length;
  if ((partCount === 0) !== (throughStepNumber === 0)) {
    throw new TypeError(
      `Panel-camera prefix step/part state is inconsistent: step ${throughStepNumber} retains ${partCount} parts; only the step-0 root may be empty.`,
    );
  }
  if (throughStepNumber === 0 && parentLineageId !== null) {
    throw new TypeError(
      `Panel-camera step-0 root parentLineageId must be null; received ${describe(parentLineageId)}.`,
    );
  }
  if (throughStepNumber > 0 && parentLineageId === null) {
    throw new TypeError(
      `Panel-camera non-root prefix through step ${throughStepNumber} requires a parentLineageId; received null.`,
    );
  }
  const candidateId = stableCandidateId(documentHash);
  const ledgerBeforeHash = snapshotLedger(ledger);
  requireCoherentLedger(ledgerBeforeHash);
  let measuredHash: unknown;
  let hashError: unknown = null;
  try {
    measuredHash = hashDocument(detachedDocument);
  } catch (error) {
    hashError = error;
  }
  const ledgerAfterHash = snapshotLedger(ledger);
  if (!sameLedger(ledgerBeforeHash, ledgerAfterHash)) {
    throw new TypeError(
      `Panel-camera hashDocument changed the shared ledger from ${describe(ledgerBeforeHash)} to ${describe(ledgerAfterHash)} while hashing ${JSON.stringify(candidateId)}; discard the mutated ledger.`,
      ...(hashError === null ? [] : [{ cause: hashError }]),
    );
  }
  if (hashError !== null) {
    throw new TypeError(
      `Panel-camera prefix ${JSON.stringify(candidateId)} hash verification failed before budget or rendering. ${hashError instanceof Error ? hashError.message : String(hashError)}`,
      { cause: hashError },
    );
  }
  if (typeof measuredHash !== "string" || !PANEL_CAMERA_DIGEST_PATTERN.test(measuredHash)) {
    throw new TypeError(
      `Panel-camera hashDocument returned ${describe(measuredHash)} for ${JSON.stringify(candidateId)}; required a lowercase sha256 digest before budget or rendering.`,
    );
  }
  if (measuredHash !== documentHash) {
    throw new TypeError(
      `Panel-camera prefix claims documentHash ${JSON.stringify(documentHash)}, but its detached document hashes to ${describe(measuredHash)}; no budget was reserved and no render ran.`,
    );
  }

  const base = {
    candidateId,
    parentLineageId,
    documentHash,
    throughStepNumber,
    registrationPanelStepNumber,
    physicalFrameDecision,
  };
  const requested = ANGULAR_HYPOTHESES.length;
  let reservationAnswer: unknown;
  let reservationError: unknown = null;
  try {
    reservationAnswer = tryReserve.call(ledger, requested);
  } catch (error) {
    reservationError = error;
  }
  const ledgerAfterReservation = snapshotLedger(ledger);
  if (reservationError !== null) {
    throw new TypeError(
      `Panel-camera ledger tryReserve(${requested}) threw after changing state from ${describe(ledgerBeforeHash)} to ${describe(ledgerAfterReservation)}; no render ran and the ledger must be discarded. ${reservationError instanceof Error ? reservationError.message : String(reservationError)}`,
      { cause: reservationError },
    );
  }
  if (typeof reservationAnswer !== "boolean") {
    throw new TypeError(
      `Panel-camera ledger tryReserve(${requested}) returned ${describe(reservationAnswer)}; required true or false. State before was ${describe(ledgerBeforeHash)} and state after was ${describe(ledgerAfterReservation)}; no render ran and the invalid ledger must be discarded.`,
    );
  }
  const reserved = reservationAnswer;
  const fitsBudget = requested <= ledgerBeforeHash.budget - ledgerBeforeHash.reserved;
  const coherentRefusal =
    ledgerAfterReservation.failure !== null &&
    ledgerAfterReservation.failure.budget === ledgerBeforeHash.budget &&
    ledgerAfterReservation.failure.reservedBefore === ledgerBeforeHash.reserved &&
    ledgerAfterReservation.failure.requested === requested;
  if (
    ledgerAfterReservation.budget !== ledgerBeforeHash.budget ||
    ledgerAfterReservation.reserved !==
      (reserved ? ledgerBeforeHash.reserved + requested : ledgerBeforeHash.reserved) ||
    reserved !== fitsBudget ||
    (reserved && (ledgerAfterReservation.refused || ledgerAfterReservation.failure !== null)) ||
    (!reserved && (!ledgerAfterReservation.refused || !coherentRefusal))
  ) {
    throw new TypeError(
      `Panel-camera ledger recorded a non-atomic ${reserved ? "acceptance" : "refusal"} for ${requested} angular branches; received ${describe(ledgerAfterReservation)}. No render ran and the ledger must be discarded.`,
    );
  }
  const reservation = Object.freeze({
    budget: ledgerBeforeHash.budget,
    reservedBefore: ledgerBeforeHash.reserved,
    requested,
    reservedAfter: ledgerAfterReservation.reserved,
    failure: ledgerAfterReservation.failure,
  });
  if (!reserved) {
    const failure = Object.freeze({
      code: "resource-budget-exhausted" as const,
      stage: "budget" as const,
      stepNumber: registrationPanelStepNumber,
      message:
        `Panel ${registrationPanelStepNumber} could not retain eight camera branches for the prefix through step ${throughStepNumber}: ` +
        `reservation ${ledgerBeforeHash.reserved}+${requested} exceeds budget ${ledgerBeforeHash.budget}; no render callback ran and no seed or observation was admitted.`,
    });
    return Object.freeze({
      ...base,
      status: "budget-refused" as const,
      seeds: Object.freeze([]),
      attempts: Object.freeze([]),
      observations: Object.freeze([]),
      selectedObservationId: null,
      failure,
      reservation,
    });
  }
  if (partCount === 0) {
    const seeds = Object.freeze(
      ANGULAR_HYPOTHESES.map((hypothesis) =>
        Object.freeze({
          candidateId,
          lineageId: realBuildPanelCameraLineageId({
            parentLineageId: null,
            localIdentity:
              `${candidateId}:panel-camera-seed:p${String(registrationPanelStepNumber).padStart(3, "0")}:` +
              `${hypothesis.latticeHand}:d${hypothesis.latticeDeterminant}:q${String(hypothesis.turnDegrees).padStart(3, "0")}`,
          }),
          parentLineageId: null,
          throughStepNumber: 0 as const,
          document: detachedDocument,
          registrationPanelStepNumber,
          ...hypothesis,
          registrationStatus: "unregistered" as const,
          observationId: null,
          shiftPx: null,
        }),
      ),
    );
    return Object.freeze({
      ...base,
      status: "seeded" as const,
      seeds,
      attempts: Object.freeze([]),
      observations: Object.freeze([]),
      selectedObservationId: null,
      failure: null,
      reservation,
    });
  }

  const renderFailures: string[] = [];
  const registration = anchorStepCameraLatticeFrame({
    stepNumber: registrationPanelStepNumber,
    builtMask: builtMaskSnapshot,
    excludedMask: excludedMaskSnapshot,
    widthPx,
    heightPx,
    renderModelMask(hypothesis) {
      const callbackInput = Object.freeze({
        candidateId,
        parentLineageId,
        document: detachedDocument,
        hypothesis,
      });
      let mask: unknown;
      let callbackError: unknown = null;
      try {
        mask = renderModelMask(callbackInput);
      } catch (error) {
        callbackError = error;
      }
      const ledgerAfterRender = snapshotLedger(ledger);
      if (!sameLedger(ledgerAfterReservation, ledgerAfterRender)) {
        throw new TypeError(
          `Panel-camera renderModelMask changed the shared ledger while rendering ${hypothesis.latticeHand} turn ${hypothesis.turnDegrees}; discard the mutated ledger.`,
          ...(callbackError === null ? [] : [{ cause: callbackError }]),
        );
      }
      if (callbackError !== null) {
        renderFailures.push(
          `${hypothesis.latticeHand} turn ${hypothesis.turnDegrees} threw ${callbackError instanceof Error ? callbackError.message : String(callbackError)}`,
        );
        return new Uint8Array(pixelCount);
      }
      if (!(mask instanceof Uint8Array) || mask.length !== pixelCount) {
        renderFailures.push(
          `${hypothesis.latticeHand} turn ${hypothesis.turnDegrees} returned ${describe(mask)}; required Uint8Array(${pixelCount})`,
        );
        return new Uint8Array(pixelCount);
      }
      return mask;
    },
  });

  const rows = registration.rankedHypotheses
    .filter(
      (attempt): attempt is Extract<StepCameraLatticeAttempt, { readonly status: "scored" }> =>
        attempt.status === "scored",
    )
    .map((attempt) => ({
      candidateId,
      throughStepNumber,
      document: detachedDocument,
      documentHash,
      registration: createRealBuildPanelCameraRegistration({
        latticeHand: attempt.latticeHand,
        latticeDeterminant: attempt.latticeDeterminant,
        registrationPanelStepNumber,
        turnDegrees: attempt.turnDegrees,
        shiftPx: attempt.shiftPx,
      }),
      silhouetteIou: attempt.iou,
    }));
  const admitted =
    rows.length === 0
      ? null
      : admitRealBuildPanelCameraBranches({
          rows,
          ledger: createRealBuildPanelCameraBranchBudgetLedger(rows.length),
          hashDocument: () => documentHash,
        });
  if (admitted !== null && admitted.status !== "admitted") {
    throw new TypeError(
      `Panel-camera resolver's exact-capacity internal admission refused ${rows.length} prepared observations; this is an implementation error.`,
    );
  }
  const observations = Object.freeze(
    (admitted?.branches ?? []).map((branch) =>
      Object.freeze({
        ...branch,
        lineageId: realBuildPanelCameraLineageId({
          parentLineageId,
          localIdentity: branch.observationId,
        }),
        parentLineageId,
      }),
    ),
  );
  const selectedObservationId =
    registration.selected === null
      ? null
      : (observations.find(
          ({ registration: value }) =>
            value.latticeHand === registration.selected!.latticeHand &&
            value.turnDegrees === registration.selected!.turnDegrees,
        )?.observationId ?? null);
  const renderFailure: StepFailure | null =
    renderFailures.length === 0
      ? null
      : Object.freeze({
          code: "rendering-error" as const,
          stage: "rendering" as const,
          stepNumber: registrationPanelStepNumber,
          message:
            `Panel ${registrationPanelStepNumber} could not complete all eight camera observations for the prefix through step ${throughStepNumber}: ` +
            `${renderFailures.join("; ")}. All eight attempts and every successful observation were retained as counterevidence, but the incomplete batch authorizes no selection.`,
        });
  const failure = renderFailure ?? registration.failure;
  const status =
    renderFailure !== null || registration.failure?.code === "camera-anchor-failed"
      ? ("failed" as const)
      : registration.failure?.code === "camera-handedness-unresolved"
        ? ("unresolved" as const)
        : ("observed" as const);
  return Object.freeze({
    ...base,
    status,
    seeds: Object.freeze([]),
    attempts: registration.rankedHypotheses,
    observations,
    selectedObservationId: renderFailure === null ? selectedObservationId : null,
    failure,
    reservation,
  });
}
