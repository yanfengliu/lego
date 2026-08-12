import type { RealBuildPanelCameraFrontierResolution } from "./real-build-panel-camera-frontier";
import {
  createRealBuildPanelCameraMeasurementEvidence,
  committedObservationIdForAttempt,
  type RealBuildPanelCameraEvidenceMeasurementContext,
} from "./real-build-panel-camera-evidence-measurement";
import { parseRealBuildPanelCameraEvidence } from "./real-build-panel-camera-evidence-parser";
import {
  REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION,
  realBuildPanelCameraEvidenceMaximumEntries,
  type RealBuildPanelCameraAttemptEvidence,
  type RealBuildPanelCameraCandidateEvidence,
  type RealBuildPanelCameraEvidence,
  type RealBuildPanelCameraFailureEvidence,
  type RealBuildPanelCameraMeasurementEvidence,
  type RealBuildPanelCameraObservationEvidence,
} from "./real-build-panel-camera-evidence-types";
import { realBuildPanelCameraLineageId } from "./real-build-panel-camera-resolver-boundary";
import type {
  RealBuildPanelCameraResolution,
  RealBuildResolvedPanelCameraObservation,
} from "./real-build-panel-camera-resolver";
import type { StepCameraLatticeAttempt } from "./real-build-step-camera";
import type { StepFailure } from "./real-build-safety";

type CameraDocument = { readonly parts: readonly unknown[] };
type RuntimeObservation<D> = RealBuildResolvedPanelCameraObservation<D>;

function projectFailure(value: StepFailure | null): RealBuildPanelCameraFailureEvidence | null {
  if (value === null) return null;
  return {
    code: value.code as RealBuildPanelCameraFailureEvidence["code"],
    stage: value.stage as RealBuildPanelCameraFailureEvidence["stage"],
    stepNumber: value.stepNumber ?? null,
    message: value.message,
  };
}

function projectAttempt(
  attempt: StepCameraLatticeAttempt,
  renderMaskDigest: string | null,
): RealBuildPanelCameraAttemptEvidence {
  return attempt.status === "empty"
    ? {
        latticeHand: attempt.latticeHand,
        latticeDeterminant: attempt.latticeDeterminant,
        turnDegrees: attempt.turnDegrees,
        status: "empty",
        silhouetteIou: null,
        shiftPx: null,
        centrePx: null,
        renderMaskDigest,
      }
    : {
        latticeHand: attempt.latticeHand,
        latticeDeterminant: attempt.latticeDeterminant,
        turnDegrees: attempt.turnDegrees,
        status: "scored",
        silhouetteIou: attempt.iou,
        shiftPx: attempt.shiftPx,
        centrePx: attempt.centrePx,
        renderMaskDigest,
      };
}

function measurementFor(
  attempts: readonly unknown[],
  context: RealBuildPanelCameraEvidenceMeasurementContext | undefined,
  raster: RealBuildPanelCameraResolution<CameraDocument>["rasterMeasurement"],
): RealBuildPanelCameraMeasurementEvidence | null {
  if (attempts.length === 0) return null;
  if (context === undefined) {
    throw new TypeError(
      "Observed panel-camera evidence requires exact PDF/page/crop, panel/build capture, face, and camera measurement context.",
    );
  }
  return createRealBuildPanelCameraMeasurementEvidence(context, raster);
}

function committedId(
  candidateId: string,
  registrationPanelStepNumber: number,
  attempt: RealBuildPanelCameraAttemptEvidence,
  measurement: RealBuildPanelCameraMeasurementEvidence,
): string {
  return committedObservationIdForAttempt({
    candidateId,
    registrationPanelStepNumber,
    attempt,
    measurement,
  });
}

function matchingAttempt(
  attempts: readonly RealBuildPanelCameraAttemptEvidence[],
  observation: RuntimeObservation<unknown>,
): RealBuildPanelCameraAttemptEvidence {
  const found = attempts.find(
    ({ latticeHand, turnDegrees }) =>
      latticeHand === observation.registration.latticeHand &&
      turnDegrees === observation.registration.turnDegrees,
  );
  if (found === undefined || found.status !== "scored") {
    throw new TypeError("A runtime panel-camera observation has no complete scored attempt.");
  }
  return found;
}

function projectCommittedObservation<D>(
  observation: RuntimeObservation<D>,
  attempts: readonly RealBuildPanelCameraAttemptEvidence[],
  measurement: RealBuildPanelCameraMeasurementEvidence,
): RealBuildPanelCameraObservationEvidence {
  const attempt = matchingAttempt(attempts, observation as RuntimeObservation<unknown>);
  const observationId = committedId(
    observation.candidateId,
    observation.registration.registrationPanelStepNumber,
    attempt,
    measurement,
  );
  return {
    candidateId: observation.candidateId,
    lineageId: realBuildPanelCameraLineageId({
      parentLineageId: observation.parentLineageId,
      localIdentity: observationId,
    }),
    parentLineageId: observation.parentLineageId,
    observationId,
    registration: {
      latticeHand: observation.registration.latticeHand,
      latticeDeterminant: observation.registration.latticeDeterminant,
      registrationPanelStepNumber: observation.registration.registrationPanelStepNumber,
      turnDegrees: observation.registration.turnDegrees,
      shiftPx: observation.registration.shiftPx,
    },
    silhouetteIou: observation.silhouetteRegistration.iou,
  };
}

function projectReservation(value: RealBuildPanelCameraResolution<unknown>["reservation"]) {
  return {
    budget: value.budget,
    reservedBefore: value.reservedBefore,
    requested: value.requested,
    reservedAfter: value.reservedAfter,
    failure:
      value.failure === null
        ? null
        : {
            budget: value.failure.budget,
            reservedBefore: value.failure.reservedBefore,
            requested: value.failure.requested,
          },
  };
}

function finish(value: RealBuildPanelCameraEvidence): RealBuildPanelCameraEvidence {
  return parseRealBuildPanelCameraEvidence(
    value,
    realBuildPanelCameraEvidenceMaximumEntries(value.reservation.budget),
  );
}

export function projectRealBuildPanelCameraResolutionEvidence<D extends CameraDocument>(
  result: RealBuildPanelCameraResolution<D>,
  context?: RealBuildPanelCameraEvidenceMeasurementContext,
): RealBuildPanelCameraEvidence {
  const measurement = measurementFor(result.attempts, context, result.rasterMeasurement);
  if (result.status === "budget-refused") {
    return finish({
      schemaVersion: REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION,
      status: result.status,
      throughStepNumber: result.throughStepNumber,
      registrationPanelStepNumber: result.registrationPanelStepNumber,
      measurement: null,
      candidates: [],
      observations: [],
      reservation: projectReservation(result.reservation),
      failure: projectFailure(result.failure),
      physicalFrameDecision: result.physicalFrameDecision,
    });
  }
  const seed = result.status === "seeded";
  const attempts: RealBuildPanelCameraAttemptEvidence[] = seed
    ? result.seeds.map((row) => ({
        latticeHand: row.latticeHand,
        latticeDeterminant: row.latticeDeterminant,
        turnDegrees: row.turnDegrees,
        status: "unregistered",
        silhouetteIou: null,
        shiftPx: null,
        centrePx: null,
        renderMaskDigest: null,
      }))
    : result.attempts.map((attempt, index) =>
        projectAttempt(attempt, result.renderMaskDigests[index] ?? null),
      );
  const observations: RealBuildPanelCameraObservationEvidence[] = seed
    ? result.seeds.map((row) => ({
        candidateId: row.candidateId,
        lineageId: row.lineageId,
        parentLineageId: null,
        observationId: null,
        registration: {
          latticeHand: row.latticeHand,
          latticeDeterminant: row.latticeDeterminant,
          registrationPanelStepNumber: row.registrationPanelStepNumber,
          turnDegrees: row.turnDegrees,
          shiftPx: null,
        },
        silhouetteIou: null,
      }))
    : result.observations.map((row) => projectCommittedObservation(row, attempts, measurement!));
  const observationIds = attempts.flatMap((attempt) =>
    attempt.status === "scored"
      ? [committedId(result.candidateId, result.registrationPanelStepNumber, attempt, measurement!)]
      : [],
  );
  const selectedRuntime = result.observations.find(
    ({ observationId }) => observationId === result.selectedObservationId,
  );
  const selectedObservationId =
    selectedRuntime === undefined
      ? null
      : projectCommittedObservation(selectedRuntime, attempts, measurement!).observationId;
  const selectedLineageIds =
    selectedObservationId === null
      ? []
      : observations
          .filter(({ observationId }) => observationId === selectedObservationId)
          .map(({ parentLineageId, lineageId }) => ({
            parentLineageId: parentLineageId!,
            lineageId,
          }));
  const candidate: RealBuildPanelCameraCandidateEvidence = {
    candidateId: result.candidateId,
    documentHash: result.documentHash,
    status: result.status,
    parentLineageIds: result.parentLineageId === null ? [] : [result.parentLineageId],
    attempts,
    observationIds: seed ? [] : observationIds,
    selectedObservationId,
    selectedLineageIds,
    failure: projectFailure(result.failure),
  };
  return finish({
    schemaVersion: REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION,
    status: result.status,
    throughStepNumber: result.throughStepNumber,
    registrationPanelStepNumber: result.registrationPanelStepNumber,
    measurement,
    candidates: [candidate],
    observations,
    reservation: projectReservation(result.reservation),
    failure: projectFailure(result.failure),
    physicalFrameDecision: result.physicalFrameDecision,
  });
}

export function projectRealBuildPanelCameraFrontierEvidence<D extends CameraDocument>(
  result: RealBuildPanelCameraFrontierResolution<D>,
  context?: RealBuildPanelCameraEvidenceMeasurementContext,
): RealBuildPanelCameraEvidence {
  const attempted = result.candidates.flatMap(({ attempts }) => attempts);
  const measurement = measurementFor(attempted, context, result.rasterMeasurement);
  const attemptsByCandidate = new Map(
    result.candidates.map((candidate) => [
      candidate.candidateId,
      candidate.attempts.map((attempt, index) =>
        projectAttempt(attempt, candidate.renderMaskDigests[index] ?? null),
      ),
    ]),
  );
  const observations = result.observations.map((row) =>
    projectCommittedObservation(row, attemptsByCandidate.get(row.candidateId)!, measurement!),
  );
  return finish({
    schemaVersion: REAL_BUILD_PANEL_CAMERA_EVIDENCE_SCHEMA_VERSION,
    status: result.status,
    throughStepNumber: result.throughStepNumber,
    registrationPanelStepNumber: result.registrationPanelStepNumber,
    measurement,
    candidates: result.candidates.map((candidate) => {
      const attempts = attemptsByCandidate.get(candidate.candidateId)!;
      const observationIds = attempts.flatMap((attempt) =>
        attempt.status === "scored"
          ? [
              committedId(
                candidate.candidateId,
                result.registrationPanelStepNumber,
                attempt,
                measurement!,
              ),
            ]
          : [],
      );
      const runtimeWinner = result.observations.find(
        ({ candidateId, observationId }) =>
          candidateId === candidate.candidateId &&
          observationId === candidate.selectedObservationId,
      );
      const selectedObservationId =
        runtimeWinner === undefined
          ? null
          : projectCommittedObservation(runtimeWinner, attempts, measurement!).observationId;
      return {
        candidateId: candidate.candidateId,
        documentHash: candidate.documentHash,
        status: candidate.status,
        parentLineageIds: candidate.parentLineageIds,
        attempts,
        observationIds,
        selectedObservationId,
        selectedLineageIds: observations
          .filter(
            (row) =>
              row.candidateId === candidate.candidateId &&
              row.observationId === selectedObservationId,
          )
          .map(({ parentLineageId, lineageId }) => ({
            parentLineageId: parentLineageId!,
            lineageId,
          })),
        failure: projectFailure(candidate.failure),
      };
    }),
    observations,
    reservation: projectReservation(result.reservation),
    failure: projectFailure(result.failure),
    physicalFrameDecision: result.physicalFrameDecision,
  });
}
