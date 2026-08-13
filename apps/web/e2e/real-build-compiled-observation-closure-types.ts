import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildDocumentCandidateId,
  RealBuildLineageId,
} from "./real-build-candidate-lineage-identity";
import type { RealBuildCompiledTransitionId } from "./real-build-compiled-placement-lineage-types";

export const REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION =
  "lego.real-build-compiled-observation-closure/1" as const;
export const REAL_BUILD_COMPILED_OBSERVATION_METRIC =
  "shifted-binary-silhouette-agreement-after-excluded/1" as const;
export const MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS = 1_048_576;
/** Admits eight independent 1000x500 registrations while refusing eight maximum rasters. */
export const MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS = 128 * 1024 * 1024;

export type RealBuildCompiledObservationSourceId = `compiled-observation-source:sha256:${string}`;
export type RealBuildCompiledObservationCameraId = `compiled-observation-camera:sha256:${string}`;
export type RealBuildCompiledObservationId = `compiled-observation:sha256:${string}`;

export interface RealBuildCompiledObservationMaskReference {
  readonly role: "branch-observation-bytes";
  readonly offset: number;
  readonly bytes: number;
  readonly digest: Sha256Digest;
  readonly encoding: "packed-binary-mask-msb/1";
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface RealBuildCompiledObservationSourceCommitment {
  readonly sourceId: RealBuildCompiledObservationSourceId;
  readonly preparedRunInputDigest: Sha256Digest;
  readonly preparedStepIdentity: Sha256Digest;
  readonly provisionalStepIdentity: Sha256Digest;
  readonly observationMode: "own-panel" | "lookahead";
  readonly compiledThroughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly pageNumber: number;
  /** Opaque exact commitment; browser-output /4 must rederive it from prepared PDF panel facts. */
  readonly panelDigest: Sha256Digest;
  /** Opaque exact commitment; browser-output /4 must cross-bind its page crop descriptor. */
  readonly cropDigest: Sha256Digest;
  /** Opaque exact commitment; this sidecar does not establish source-raster provenance. */
  readonly sourceDescriptorDigest: Sha256Digest;
  /** Opaque exact commitment; browser-output /4 must rederive the exclusion descriptor. */
  readonly exclusionDescriptorDigest: Sha256Digest;
  readonly metric: typeof REAL_BUILD_COMPILED_OBSERVATION_METRIC;
  readonly measure: "iou" | "containment";
  readonly sourceMask: RealBuildCompiledObservationMaskReference;
  readonly excludedMask: RealBuildCompiledObservationMaskReference;
}

export interface RealBuildCompiledObservationCameraCommitment {
  readonly cameraId: RealBuildCompiledObservationCameraId;
  readonly sourceId: RealBuildCompiledObservationSourceId;
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  /** Opaque exact recipe commitment; this sidecar does not establish its browser provenance. */
  readonly d4CameraRecipeDigest: Sha256Digest;
  /** Opaque exact renderer commitment; browser-output /4 must cross-bind it later. */
  readonly rendererSnapshotDigest: Sha256Digest;
  readonly candidateMask: RealBuildCompiledObservationMaskReference;
}

export interface RealBuildCompiledObservationFailure {
  readonly schemaVersion: "lego.real-build-compiled-observation-failure/1";
  readonly code:
    | "source-mask-unavailable"
    | "camera-evidence-unavailable"
    | "candidate-render-failed"
    | "mask-extraction-failed"
    | "resource-budget-exhausted";
  readonly stage: "source" | "camera" | "rendering" | "masking" | "budget";
  readonly reason: string;
}

export interface RealBuildCompiledObservation {
  readonly observationId: RealBuildCompiledObservationId;
  readonly lineageId: RealBuildLineageId;
  readonly sourceId: RealBuildCompiledObservationSourceId | null;
  readonly cameraId: RealBuildCompiledObservationCameraId | null;
  readonly status: "scored" | "not-observable" | "failed";
  readonly shiftPx: readonly [number, number] | null;
  readonly score: number | null;
  readonly outcome: "source-mask-empty" | RealBuildCompiledObservationFailure | null;
}

export interface RealBuildCompiledObservationSelection {
  readonly status: "selected" | "unresolved" | "unverified-failure";
  readonly decisionSourceId: RealBuildCompiledObservationSourceId | null;
  readonly selectedCameraId: RealBuildCompiledObservationCameraId | null;
  readonly selectedCandidateId: RealBuildDocumentCandidateId | null;
  readonly selectedLineageIds: readonly RealBuildLineageId[];
  readonly bestScore: number | null;
  readonly runnerUpScore: number | null;
  readonly margin: number | null;
}

export interface RealBuildCompiledObservationAcceptedTransition {
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly lineageIds: readonly RealBuildLineageId[];
  readonly transitionIds: readonly RealBuildCompiledTransitionId[];
  readonly canonicalStepId: string;
  readonly placedPieces: number;
}

export interface RealBuildCompiledObservationClosure {
  readonly schemaVersion: typeof REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION;
  readonly compiledLineageBytesDigest: Sha256Digest;
  readonly roleBytes: number;
  readonly roleDigest: Sha256Digest | null;
  readonly sources: readonly RealBuildCompiledObservationSourceCommitment[];
  readonly cameras: readonly RealBuildCompiledObservationCameraCommitment[];
  readonly observations: readonly RealBuildCompiledObservation[];
  readonly selection: RealBuildCompiledObservationSelection;
  readonly acceptedTransition: RealBuildCompiledObservationAcceptedTransition | null;
  readonly completionAuthority: {
    readonly status: "absent";
    readonly authorized: false;
    readonly reason: "compiled-observation-closure-is-inspection-only";
  };
}

export interface RealBuildCompiledObservationClosureInspection {
  readonly closure: RealBuildCompiledObservationClosure;
  readonly reproducible: boolean;
  readonly failedObservationIds: readonly RealBuildCompiledObservationId[];
  /** Browser /4 must cross-bind the closure's opaque source/camera commitments. */
  readonly provenanceAuthority: "absent";
  readonly authority: "absent";
}
