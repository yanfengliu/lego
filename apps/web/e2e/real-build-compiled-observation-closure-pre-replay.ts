import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-digest";
import type { RealBuildCompiledObservationClosure } from "./real-build-compiled-observation-closure-types";

type Source = RealBuildCompiledObservationClosure["sources"][number];
type Camera = RealBuildCompiledObservationClosure["cameras"][number];

function requirePreReplayRowShape(
  row: RealBuildCompiledObservationClosure["observations"][number],
  index: number,
): void {
  if (row.status === "failed") {
    if (
      row.sourceId !== null ||
      row.cameraId !== null ||
      row.shiftPx !== null ||
      row.score !== null ||
      row.outcome === null ||
      row.outcome === "source-mask-empty"
    ) {
      throw new TypeError(
        `Closure observation ${index} failed rows require null source/camera/shift/score and one typed failure.`,
      );
    }
  } else if (row.status === "not-observable") {
    if (
      row.sourceId === null ||
      row.cameraId !== null ||
      row.shiftPx !== null ||
      row.score !== null ||
      row.outcome !== "source-mask-empty"
    ) {
      throw new TypeError(
        `Closure observation ${index} not-observable row has invalid raw-source-empty fields.`,
      );
    }
  } else if (
    row.sourceId === null ||
    row.cameraId === null ||
    row.shiftPx === null ||
    row.score === null ||
    row.outcome !== null
  ) {
    throw new TypeError(
      `Closure observation ${index} scored row requires source, camera, shift, score, and null outcome.`,
    );
  }
}

/** Rejects internally orphaned closure tables before any lineage/compiler replay. */
export function requireRealBuildCompiledObservationClosurePreReplayRows(
  closure: RealBuildCompiledObservationClosure,
): void {
  const sources = new Map<string, Source>();
  for (const [index, source] of closure.sources.entries()) {
    const { sourceId, ...committed } = source;
    if (
      sources.has(sourceId) ||
      sourceId !== deriveRealBuildCompiledObservationSourceId(committed)
    ) {
      throw new TypeError(
        `Closure source IDs must uniquely commit exact descriptors; row ${index} supplied ${JSON.stringify(sourceId)} before replay.`,
      );
    }
    sources.set(sourceId, source);
  }
  const cameras = new Map<string, Camera>();
  for (const [index, camera] of closure.cameras.entries()) {
    const { cameraId, ...committed } = camera;
    if (
      cameras.has(cameraId) ||
      cameraId !== deriveRealBuildCompiledObservationCameraId(committed)
    ) {
      throw new TypeError(
        `Closure camera IDs must uniquely commit exact descriptors; row ${index} supplied ${JSON.stringify(cameraId)} before replay.`,
      );
    }
    if (!sources.has(camera.sourceId)) {
      throw new TypeError(
        `Closure camera row ${index} references sourceId ${JSON.stringify(camera.sourceId)}; expected one committed source row with that ID before replay.`,
      );
    }
    cameras.set(cameraId, camera);
  }
  const usedSources = new Set<string>();
  const usedCameras = new Set<string>();
  for (const [index, row] of closure.observations.entries()) {
    requirePreReplayRowShape(row, index);
    if (row.status === "failed") continue;
    const sourceId = row.sourceId!;
    if (!sources.has(sourceId)) {
      throw new TypeError(
        `Closure observation row ${index} references sourceId ${JSON.stringify(sourceId)}; expected one committed source row with that ID before replay.`,
      );
    }
    usedSources.add(sourceId);
    if (row.status === "not-observable") continue;
    const cameraId = row.cameraId!;
    const camera = cameras.get(cameraId);
    if (camera === undefined) {
      throw new TypeError(
        `Closure observation row ${index} references cameraId ${JSON.stringify(cameraId)}; expected one committed camera row with that ID before replay.`,
      );
    }
    if (camera.sourceId !== sourceId) {
      throw new TypeError(
        `Closure observation row ${index} binds sourceId ${JSON.stringify(sourceId)} but camera ${JSON.stringify(cameraId)} binds ${JSON.stringify(camera.sourceId)}; expected the same source before replay.`,
      );
    }
    usedCameras.add(cameraId);
  }
  const orphanSource = closure.sources.find((source) => !usedSources.has(source.sourceId));
  if (orphanSource !== undefined) {
    throw new TypeError(
      `Closure source and camera tables cannot retain orphan entries: orphan source ${JSON.stringify(orphanSource.sourceId)} is unused; remove the orphan source before replay.`,
    );
  }
  const orphanCamera = closure.cameras.find((camera) => !usedCameras.has(camera.cameraId));
  if (orphanCamera !== undefined) {
    throw new TypeError(
      `Closure source and camera tables cannot retain orphan entries: orphan camera ${JSON.stringify(orphanCamera.cameraId)} is unused; remove the orphan camera before replay.`,
    );
  }
}
