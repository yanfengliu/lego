import type {
  RealBuildPrefix50Step44BlindFixedCameraEvidence,
  RealBuildPrefix50Step44BlindSourceCell,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import type { RealBuildPrefix50Step44CandidateCaptureSummary } from "./real-build-prefix50-subbuild-return-review-capture.ts";
import type { RealBuildPrefix50Step43FixedCameraBaselineArtifact } from "./real-build-prefix50-subbuild-return-review-fixed-camera.ts";

export interface RealBuildPrefix50Step44BatchCaptureRow extends RealBuildPrefix50Step44CandidateCaptureSummary {
  readonly blindId: `B${string}`;
  readonly batchIndex: number;
  readonly artifactDirectory: string;
  readonly rosterIndex: number;
  readonly operationsCommitment: `sha256:${string}`;
  readonly compactCandidateCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44VerifiedCaptureRow {
  readonly binding: RealBuildPrefix50Step44BatchCaptureRow & {
    readonly sourceRowCommitment: `sha256:${string}`;
  };
  readonly cells: readonly RealBuildPrefix50Step44BlindSourceCell[];
  readonly fixedCameraEvidence: RealBuildPrefix50Step44BlindFixedCameraEvidence;
  readonly fixedCameraBaselineArtifact: RealBuildPrefix50Step43FixedCameraBaselineArtifact;
}
