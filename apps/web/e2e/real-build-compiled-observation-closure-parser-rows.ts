import {
  closureArray,
  closureCameraId,
  closureCandidateId,
  closureDigest,
  closureLineageId,
  closureObservationId,
  closureRecord,
  closureScore,
  closureSourceId,
  closureString,
  closureTransitionId,
} from "./real-build-compiled-observation-closure-primitives";
import type {
  RealBuildCompiledObservation,
  RealBuildCompiledObservationAcceptedTransition,
  RealBuildCompiledObservationFailure,
  RealBuildCompiledObservationSelection,
} from "./real-build-compiled-observation-closure-types";

function parseShift(value: unknown, path: string): readonly [number, number] | null {
  if (value === null) return null;
  const pair = closureArray(value, path, 2, 2);
  return Object.freeze(
    pair.map((component, index) => {
      if (!Number.isSafeInteger(component)) {
        throw new RangeError(`${path}[${index}] must be a safe integer.`);
      }
      return Object.is(component, -0) ? 0 : (component as number);
    }),
  ) as readonly [number, number];
}

function parseFailure(value: unknown, path: string): RealBuildCompiledObservationFailure {
  const row = closureRecord(value, path, ["schemaVersion", "code", "stage", "reason"]);
  if (row.schemaVersion !== "lego.real-build-compiled-observation-failure/1") {
    throw new TypeError(`${path}.schemaVersion must be compiled-observation-failure/1.`);
  }
  if (
    row.code !== "source-mask-unavailable" &&
    row.code !== "camera-evidence-unavailable" &&
    row.code !== "candidate-render-failed" &&
    row.code !== "mask-extraction-failed" &&
    row.code !== "resource-budget-exhausted"
  ) {
    throw new TypeError(`${path}.code is not a closed compiled-observation failure code.`);
  }
  const expectedStage =
    row.code === "source-mask-unavailable"
      ? "source"
      : row.code === "camera-evidence-unavailable"
        ? "camera"
        : row.code === "candidate-render-failed"
          ? "rendering"
          : row.code === "mask-extraction-failed"
            ? "masking"
            : "budget";
  if (row.stage !== expectedStage) {
    throw new TypeError(`${path} code and stage must be coherent.`);
  }
  return Object.freeze({
    schemaVersion: "lego.real-build-compiled-observation-failure/1",
    code: row.code,
    stage: expectedStage,
    reason: closureString(row.reason, `${path}.reason`),
  });
}

export function parseClosureObservation(
  value: unknown,
  index: number,
): RealBuildCompiledObservation {
  const path = `compiledObservationClosure.observations[${index}]`;
  const row = closureRecord(value, path, [
    "observationId",
    "lineageId",
    "sourceId",
    "cameraId",
    "status",
    "shiftPx",
    "score",
    "outcome",
  ]);
  if (row.status !== "scored" && row.status !== "not-observable" && row.status !== "failed") {
    throw new TypeError(`${path}.status must be scored, not-observable, or failed.`);
  }
  const outcome =
    row.outcome === null || row.outcome === "source-mask-empty"
      ? row.outcome
      : parseFailure(row.outcome, `${path}.outcome`);
  return Object.freeze({
    observationId: closureObservationId(row.observationId, `${path}.observationId`),
    lineageId: closureLineageId(row.lineageId, `${path}.lineageId`),
    sourceId: row.sourceId === null ? null : closureSourceId(row.sourceId, `${path}.sourceId`),
    cameraId: row.cameraId === null ? null : closureCameraId(row.cameraId, `${path}.cameraId`),
    status: row.status,
    shiftPx: parseShift(row.shiftPx, `${path}.shiftPx`),
    score: closureScore(row.score, `${path}.score`),
    outcome,
  });
}

export function parseClosureSelection(value: unknown): RealBuildCompiledObservationSelection {
  const path = "compiledObservationClosure.selection";
  const row = closureRecord(value, path, [
    "status",
    "decisionSourceId",
    "selectedCameraId",
    "selectedCandidateId",
    "selectedLineageIds",
    "bestScore",
    "runnerUpScore",
    "margin",
  ]);
  if (
    row.status !== "selected" &&
    row.status !== "unresolved" &&
    row.status !== "unverified-failure"
  ) {
    throw new TypeError(`${path}.status must be selected, unresolved, or unverified-failure.`);
  }
  return Object.freeze({
    status: row.status,
    decisionSourceId:
      row.decisionSourceId === null
        ? null
        : closureSourceId(row.decisionSourceId, `${path}.decisionSourceId`),
    selectedCameraId:
      row.selectedCameraId === null
        ? null
        : closureCameraId(row.selectedCameraId, `${path}.selectedCameraId`),
    selectedCandidateId:
      row.selectedCandidateId === null
        ? null
        : closureCandidateId(row.selectedCandidateId, `${path}.selectedCandidateId`),
    selectedLineageIds: Object.freeze(
      closureArray(row.selectedLineageIds, `${path}.selectedLineageIds`, 8_192).map((id, index) =>
        closureLineageId(id, `${path}.selectedLineageIds[${index}]`),
      ),
    ),
    bestScore: closureScore(row.bestScore, `${path}.bestScore`),
    runnerUpScore: closureScore(row.runnerUpScore, `${path}.runnerUpScore`),
    margin: closureScore(row.margin, `${path}.margin`),
  });
}

export function parseClosureAcceptedTransition(
  value: unknown,
): RealBuildCompiledObservationAcceptedTransition | null {
  if (value === null) return null;
  const path = "compiledObservationClosure.acceptedTransition";
  const row = closureRecord(value, path, [
    "candidateId",
    "documentHash",
    "lineageIds",
    "transitionIds",
    "canonicalStepId",
    "placedPieces",
  ]);
  return Object.freeze({
    candidateId: closureCandidateId(row.candidateId, `${path}.candidateId`),
    documentHash: closureDigest(row.documentHash, `${path}.documentHash`),
    lineageIds: Object.freeze(
      closureArray(row.lineageIds, `${path}.lineageIds`, 8_192, 1).map((id, index) =>
        closureLineageId(id, `${path}.lineageIds[${index}]`),
      ),
    ),
    transitionIds: Object.freeze(
      closureArray(row.transitionIds, `${path}.transitionIds`, 8_192, 1).map((id, index) =>
        closureTransitionId(id, `${path}.transitionIds[${index}]`),
      ),
    ),
    canonicalStepId: closureString(row.canonicalStepId, `${path}.canonicalStepId`),
    placedPieces:
      typeof row.placedPieces === "number" &&
      Number.isSafeInteger(row.placedPieces) &&
      row.placedPieces >= 0
        ? row.placedPieces
        : (() => {
            throw new RangeError(`${path}.placedPieces must be a non-negative safe integer.`);
          })(),
  });
}
