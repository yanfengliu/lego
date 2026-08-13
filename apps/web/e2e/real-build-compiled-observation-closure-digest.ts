import { canonicalDigest } from "@lego-studio/brick-kernel";

import type {
  RealBuildCompiledObservation,
  RealBuildCompiledObservationCameraCommitment,
  RealBuildCompiledObservationCameraId,
  RealBuildCompiledObservationId,
  RealBuildCompiledObservationSourceCommitment,
  RealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-types";

export function deriveRealBuildCompiledObservationSourceId(
  commitment: Omit<RealBuildCompiledObservationSourceCommitment, "sourceId">,
): RealBuildCompiledObservationSourceId {
  return `compiled-observation-source:${canonicalDigest({
    schemaVersion: "lego.real-build-compiled-observation-source/1",
    commitment,
  })}` as RealBuildCompiledObservationSourceId;
}

export function deriveRealBuildCompiledObservationCameraId(
  commitment: Omit<RealBuildCompiledObservationCameraCommitment, "cameraId">,
): RealBuildCompiledObservationCameraId {
  return `compiled-observation-camera:${canonicalDigest({
    schemaVersion: "lego.real-build-compiled-observation-camera/1",
    commitment,
  })}` as RealBuildCompiledObservationCameraId;
}

export function deriveRealBuildCompiledObservationId(
  observation: Omit<RealBuildCompiledObservation, "observationId">,
): RealBuildCompiledObservationId {
  return `compiled-observation:${canonicalDigest({
    schemaVersion: "lego.real-build-compiled-observation/1",
    observation,
  })}` as RealBuildCompiledObservationId;
}
