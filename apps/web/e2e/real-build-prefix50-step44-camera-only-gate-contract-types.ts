import type {
  RealBuildPrefix50Step44CameraBranchKey,
  RealBuildPrefix50Step44CameraSearchRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";

export interface RealBuildPrefix50Step44CameraOnlyRefusalSummary {
  readonly status: "refused";
  readonly searchAttemptCommitment: string;
  readonly refusalReasons: readonly RealBuildPrefix50Step44CameraSearchRefusal[];
  readonly selectedBranchKey: RealBuildPrefix50Step44CameraBranchKey | null;
  readonly geometryPassed: boolean;
  readonly featurePassed: boolean;
  readonly beautyRestorationPassed: boolean;
  readonly renderCount: number;
  readonly semanticRenderCount: 16;
  readonly restorationControlRenderCount: 1;
  readonly totalCaptureCount: number;
}
