import {
  closureCandidateId,
  closureDigest,
  closureInteger,
  closureMaskReference,
  closureRecord,
  closureSourceId,
} from "./real-build-compiled-observation-closure-primitives";
import {
  REAL_BUILD_COMPILED_OBSERVATION_METRIC,
  type RealBuildCompiledObservationCameraCommitment,
  type RealBuildCompiledObservationSourceCommitment,
} from "./real-build-compiled-observation-closure-types";

export function parseClosureSource(
  value: unknown,
  index: number,
): RealBuildCompiledObservationSourceCommitment {
  const path = `compiledObservationClosure.sources[${index}]`;
  const row = closureRecord(value, path, [
    "sourceId",
    "preparedRunInputDigest",
    "preparedStepIdentity",
    "provisionalStepIdentity",
    "observationMode",
    "compiledThroughStepNumber",
    "registrationPanelStepNumber",
    "pageNumber",
    "panelDigest",
    "cropDigest",
    "sourceDescriptorDigest",
    "exclusionDescriptorDigest",
    "metric",
    "measure",
    "sourceMask",
    "excludedMask",
  ]);
  if (row.observationMode !== "own-panel" && row.observationMode !== "lookahead") {
    throw new TypeError(`${path}.observationMode must be own-panel or lookahead.`);
  }
  if (row.metric !== REAL_BUILD_COMPILED_OBSERVATION_METRIC) {
    throw new TypeError(`${path}.metric must be the fixed compiled-observation metric.`);
  }
  if (row.measure !== "iou" && row.measure !== "containment") {
    throw new TypeError(`${path}.measure must be iou or containment.`);
  }
  const compiledThroughStepNumber = closureInteger(
    row.compiledThroughStepNumber,
    `${path}.compiledThroughStepNumber`,
    1,
    359,
  );
  const registrationPanelStepNumber = closureInteger(
    row.registrationPanelStepNumber,
    `${path}.registrationPanelStepNumber`,
    1,
    359,
  );
  if (
    (row.observationMode === "own-panel" &&
      registrationPanelStepNumber !== compiledThroughStepNumber) ||
    (row.observationMode === "lookahead" &&
      registrationPanelStepNumber <= compiledThroughStepNumber)
  ) {
    throw new TypeError(
      `${path} own-panel mode requires equality while lookahead mode requires a later panel.`,
    );
  }
  const sourceMask = closureMaskReference(row.sourceMask, `${path}.sourceMask`);
  const excludedMask = closureMaskReference(row.excludedMask, `${path}.excludedMask`);
  if (
    sourceMask.widthPx !== excludedMask.widthPx ||
    sourceMask.heightPx !== excludedMask.heightPx
  ) {
    throw new TypeError(`${path} source and exclusion masks must share one exact raster.`);
  }
  return Object.freeze({
    sourceId: closureSourceId(row.sourceId, `${path}.sourceId`),
    preparedRunInputDigest: closureDigest(
      row.preparedRunInputDigest,
      `${path}.preparedRunInputDigest`,
    ),
    preparedStepIdentity: closureDigest(row.preparedStepIdentity, `${path}.preparedStepIdentity`),
    provisionalStepIdentity: closureDigest(
      row.provisionalStepIdentity,
      `${path}.provisionalStepIdentity`,
    ),
    observationMode: row.observationMode,
    compiledThroughStepNumber,
    registrationPanelStepNumber,
    pageNumber: closureInteger(row.pageNumber, `${path}.pageNumber`, 1, 10_000),
    panelDigest: closureDigest(row.panelDigest, `${path}.panelDigest`),
    cropDigest: closureDigest(row.cropDigest, `${path}.cropDigest`),
    sourceDescriptorDigest: closureDigest(
      row.sourceDescriptorDigest,
      `${path}.sourceDescriptorDigest`,
    ),
    exclusionDescriptorDigest: closureDigest(
      row.exclusionDescriptorDigest,
      `${path}.exclusionDescriptorDigest`,
    ),
    metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
    measure: row.measure,
    sourceMask,
    excludedMask,
  });
}

export function parseClosureCamera(
  value: unknown,
  index: number,
): RealBuildCompiledObservationCameraCommitment {
  const path = `compiledObservationClosure.cameras[${index}]`;
  const row = closureRecord(value, path, [
    "cameraId",
    "sourceId",
    "candidateId",
    "documentHash",
    "d4CameraRecipeDigest",
    "rendererSnapshotDigest",
    "candidateMask",
  ]);
  if (
    typeof row.cameraId !== "string" ||
    !/^compiled-observation-camera:sha256:[0-9a-f]{64}$/u.test(row.cameraId)
  ) {
    throw new TypeError(`${path}.cameraId must be a compiled-observation-camera:sha256 ID.`);
  }
  return Object.freeze({
    cameraId: row.cameraId as RealBuildCompiledObservationCameraCommitment["cameraId"],
    sourceId: closureSourceId(row.sourceId, `${path}.sourceId`),
    candidateId: closureCandidateId(row.candidateId, `${path}.candidateId`),
    documentHash: closureDigest(row.documentHash, `${path}.documentHash`),
    d4CameraRecipeDigest: closureDigest(row.d4CameraRecipeDigest, `${path}.d4CameraRecipeDigest`),
    rendererSnapshotDigest: closureDigest(
      row.rendererSnapshotDigest,
      `${path}.rendererSnapshotDigest`,
    ),
    candidateMask: closureMaskReference(row.candidateMask, `${path}.candidateMask`),
  });
}
