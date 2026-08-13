import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPanelCameraBranch } from "./real-build-panel-camera-branches";
import { type RealBuildPanelCameraBranchBudgetLedger } from "./real-build-panel-camera-branch-budget";
import {
  createRealBuildPanelCameraRegistration,
  realBuildPanelCameraObservationId,
} from "./real-build-panel-camera-registration";
import {
  describePanelCameraBoundaryFailure,
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
  snapshotPanelCameraBinaryMask as snapshotBinaryMask,
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
import type {
  RealBuildPanelCameraPrefixInput,
  RealBuildPanelCameraResolution,
} from "./real-build-panel-camera-resolver-types";

export type {
  RealBuildPanelCameraAngularSeed,
  RealBuildPanelCameraPrefixInput,
  RealBuildPanelCameraResolution,
  RealBuildResolvedPanelCameraObservation,
} from "./real-build-panel-camera-resolver-types";

const TRUSTED_PANEL_CAMERA_RESOLUTIONS = new WeakSet<object>();
function sealPanelCameraResolution<D>(
  value: RealBuildPanelCameraResolution<D>,
): RealBuildPanelCameraResolution<D> {
  TRUSTED_PANEL_CAMERA_RESOLUTIONS.add(value);
  return value;
}
/** Nonforgeable in-process boundary for composition adapters. */
export function requireTrustedRealBuildPanelCameraResolution(
  value: unknown,
): RealBuildPanelCameraResolution<unknown> {
  if (value === null || typeof value !== "object" || !TRUSTED_PANEL_CAMERA_RESOLUTIONS.has(value)) {
    throw new TypeError(
      "Panel-camera lineage composition requires the exact immutable result returned by resolveRealBuildPanelCameraBranches.",
    );
  }
  return value as RealBuildPanelCameraResolution<unknown>;
}

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
  const builtMaskSnapshot = snapshotBinaryMask(builtMask, pixelCount, "Panel-camera builtMask");
  const excludedMaskSnapshot =
    excludedMask === null
      ? null
      : snapshotBinaryMask(excludedMask, pixelCount, "Panel-camera excludedMask");
  const rasterMeasurement = Object.freeze({
    widthPx,
    heightPx,
    builtMaskDigest: `sha256:${sha256Hex(builtMaskSnapshot)}`,
    excludedMaskDigest:
      excludedMaskSnapshot === null ? null : `sha256:${sha256Hex(excludedMaskSnapshot)}`,
  });

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
  let hashCallbackThrew = false;
  try {
    measuredHash = hashDocument(detachedDocument);
  } catch {
    hashCallbackThrew = true;
  }
  const ledgerAfterHash = snapshotLedger(ledger);
  if (!sameLedger(ledgerBeforeHash, ledgerAfterHash)) {
    throw new TypeError(
      `Panel-camera hashDocument changed the shared ledger from ${describe(ledgerBeforeHash)} to ${describe(ledgerAfterHash)} while hashing ${JSON.stringify(candidateId)}; discard the mutated ledger.${hashCallbackThrew ? " The callback also threw an untrusted value that was discarded." : ""}`,
    );
  }
  if (hashCallbackThrew) {
    throw new TypeError(
      `Panel-camera prefix ${JSON.stringify(candidateId)} hashDocument threw an untrusted value before budget or rendering; the thrown value was discarded.`,
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
    rasterMeasurement,
  };
  const requested = ANGULAR_HYPOTHESES.length;
  let reservationAnswer: unknown;
  let reservationCallbackThrew = false;
  try {
    reservationAnswer = tryReserve.call(ledger, requested);
  } catch {
    reservationCallbackThrew = true;
  }
  const ledgerAfterReservation = snapshotLedger(ledger);
  if (reservationCallbackThrew) {
    throw new TypeError(
      `Panel-camera ledger tryReserve(${requested}) threw an untrusted value after state changed from ${describe(ledgerBeforeHash)} to ${describe(ledgerAfterReservation)}; no render ran, the thrown value was discarded, and the ledger must be discarded.`,
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
    return sealPanelCameraResolution(
      Object.freeze({
        ...base,
        status: "budget-refused" as const,
        seeds: Object.freeze([]),
        attempts: Object.freeze([]),
        renderMaskDigests: Object.freeze([]),
        observations: Object.freeze([]),
        selectedObservationId: null,
        failure,
        reservation,
      }),
    );
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
    return sealPanelCameraResolution(
      Object.freeze({
        ...base,
        status: "seeded" as const,
        seeds,
        attempts: Object.freeze([]),
        renderMaskDigests: Object.freeze([]),
        observations: Object.freeze([]),
        selectedObservationId: null,
        failure: null,
        reservation,
      }),
    );
  }

  const renderFailures: string[] = [];
  const renderMaskDigestByHypothesis = new Map<string, string | null>();
  const hypothesisKey = (hypothesis: StepCameraLatticeHypothesis): string =>
    `${hypothesis.latticeHand}:${hypothesis.turnDegrees}`;
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
      let renderCallbackThrew = false;
      try {
        mask = renderModelMask(callbackInput);
      } catch {
        renderCallbackThrew = true;
      }
      const ledgerAfterRender = snapshotLedger(ledger);
      if (!sameLedger(ledgerAfterReservation, ledgerAfterRender)) {
        throw new TypeError(
          `Panel-camera renderModelMask changed the shared ledger while rendering ${hypothesis.latticeHand} turn ${hypothesis.turnDegrees}; discard the mutated ledger.${renderCallbackThrew ? " The callback also threw an untrusted value that was discarded." : ""}`,
        );
      }
      if (renderCallbackThrew) {
        renderMaskDigestByHypothesis.set(hypothesisKey(hypothesis), null);
        renderFailures.push(
          `${hypothesis.latticeHand} turn ${hypothesis.turnDegrees} threw an untrusted value that was discarded`,
        );
        return new Uint8Array(pixelCount);
      }
      try {
        const snapshot = snapshotBinaryMask(
          mask,
          pixelCount,
          `The ${hypothesis.latticeHand} turn-${hypothesis.turnDegrees} model mask`,
        );
        renderMaskDigestByHypothesis.set(
          hypothesisKey(hypothesis),
          `sha256:${sha256Hex(snapshot)}`,
        );
        return snapshot;
      } catch (caught) {
        renderMaskDigestByHypothesis.set(hypothesisKey(hypothesis), null);
        const localFailure = describePanelCameraBoundaryFailure(caught);
        renderFailures.push(
          localFailure === null
            ? `${hypothesis.latticeHand} turn ${hypothesis.turnDegrees} returned malformed raster evidence because an untrusted value was thrown; the thrown value was discarded`
            : `${hypothesis.latticeHand} turn ${hypothesis.turnDegrees} returned malformed raster evidence: ${localFailure}`,
        );
        return new Uint8Array(pixelCount);
      }
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
  const observations = Object.freeze(
    rows.map((row) => {
      const observationId = realBuildPanelCameraObservationId({
        candidateId: row.candidateId,
        registration: row.registration,
      });
      const branch: RealBuildPanelCameraBranch<D> = Object.freeze({
        candidateId: row.candidateId,
        observationId,
        throughStepNumber: row.throughStepNumber,
        document: row.document,
        documentHash: row.documentHash,
        registration: row.registration,
        silhouetteRegistration: Object.freeze({
          authority: "binary-silhouette-registration" as const,
          iou: row.silhouetteIou,
        }),
      });
      return Object.freeze({
        ...branch,
        lineageId: realBuildPanelCameraLineageId({
          parentLineageId,
          localIdentity: branch.observationId,
        }),
        parentLineageId,
      });
    }),
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
  return sealPanelCameraResolution(
    Object.freeze({
      ...base,
      status,
      seeds: Object.freeze([]),
      attempts: registration.rankedHypotheses,
      renderMaskDigests: Object.freeze(
        registration.rankedHypotheses.map(
          (attempt) => renderMaskDigestByHypothesis.get(hypothesisKey(attempt)) ?? null,
        ),
      ),
      observations,
      selectedObservationId: renderFailure === null ? selectedObservationId : null,
      failure,
      reservation,
    }),
  );
}
