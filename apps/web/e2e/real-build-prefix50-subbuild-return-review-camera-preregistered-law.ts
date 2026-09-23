import { deepFreeze } from "@lego-studio/brick-kernel";
import type {
  AxonometricSolution,
  FoldedStudShape,
  LatticeBasisPx,
  LatticeSiteResiduals,
  OrthographicViewParameters,
  PixelBoxPx,
} from "@lego-studio/rendering";

import {
  preHandPanelFace,
  viewForLatticeHand,
  viewForPanelFace,
} from "../src/assembly/panel-face.ts";
import type { RealBuildPrefix50Step44CameraBranchKey } from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";

/** Frozen camera law shared by page-44 qualification and later page-45 use. */
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH = 720 as const;
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT = 470 as const;
export const REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX = 0x899093 as const;

export interface RealBuildPrefix50Step44CameraLatticeThresholds {
  readonly minimumArtPixels: 5_000;
  readonly minimumPeakCount: 4;
  readonly minimumCandidateCount: 1;
  readonly minimumCoherence: 0.15;
  readonly maximumResidualFraction: 0.02;
  readonly minimumResidualSites: 12;
  readonly minimumResidualHitRate: 0.1;
  readonly minimumInkOverAntiPhase: 1.02;
}

export const REAL_BUILD_PREFIX50_STEP44_CAMERA_LATTICE_THRESHOLDS = deepFreeze({
  minimumArtPixels: 5_000,
  minimumPeakCount: 4,
  minimumCandidateCount: 1,
  minimumCoherence: 0.15,
  maximumResidualFraction: 0.02,
  minimumResidualSites: 12,
  minimumResidualHitRate: 0.1,
  minimumInkOverAntiPhase: 1.02,
} satisfies RealBuildPrefix50Step44CameraLatticeThresholds);

export interface RealBuildPrefix50Step44TypedLatticeFit {
  readonly basis: LatticeBasisPx;
  readonly solution: AxonometricSolution;
  readonly coherence: number;
  readonly residualFraction: number;
  readonly phase: FoldedStudShape;
  readonly residuals: LatticeSiteResiduals;
  readonly control: {
    readonly artPixels: number;
    readonly artBounds: PixelBoxPx;
    readonly peakCount: number;
    readonly candidateCount: number;
    readonly explainedCandidateCount: number;
  };
  readonly thresholds: RealBuildPrefix50Step44CameraLatticeThresholds;
}

export function deriveRealBuildPrefix50Step44PreregisteredCameraBranches(
  solution: AxonometricSolution,
): readonly Readonly<{
  readonly branchKey: RealBuildPrefix50Step44CameraBranchKey;
  readonly parameters: OrthographicViewParameters;
}>[] {
  const branches: {
    branchKey: RealBuildPrefix50Step44CameraBranchKey;
    parameters: OrthographicViewParameters;
  }[] = [];
  for (const face of ["studs-up", "underside"] as const)
    for (const hand of ["as-fitted", "x-reflected"] as const)
      for (const turn of [0, 1, 2, 3] as const) {
        const faced = viewForPanelFace(solution, preHandPanelFace(face, hand));
        const handed = viewForLatticeHand(
          { ...faced, azimuthDegrees: faced.azimuthDegrees + turn * 90 },
          hand,
        );
        if ((face === "studs-up") !== handed.elevationDegrees > 0)
          throw new TypeError(
            `Step-44 camera branch ${face}/${hand}/${turn} crossed onto the labelled face's opposite physical side.`,
          );
        branches.push({
          branchKey: `face:${face}/hand:${hand}/turn:${turn}`,
          parameters: deepFreeze({
            ...handed,
            centerXPx: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH / 2,
            centerYPx: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT / 2,
          }),
        });
      }
  if (branches.length !== 16 || new Set(branches.map(({ branchKey }) => branchKey)).size !== 16)
    throw new TypeError("Preregistered camera law did not derive its exact 16-branch roster.");
  return deepFreeze(branches);
}
