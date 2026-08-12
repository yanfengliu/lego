import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPanelCameraBranch } from "./real-build-panel-camera-branches";
import type { RealBuildPanelCameraBranchBudgetFailure } from "./real-build-panel-camera-branch-budget";
import type { RealBuildPanelCameraDocument } from "./real-build-panel-camera-resolver-boundary";
import type {
  StepCameraLatticeAttempt,
  StepCameraLatticeHypothesis,
} from "./real-build-step-camera";
import type { StepFailure } from "./real-build-safety";

export interface RealBuildPanelCameraPrefixInput<D extends RealBuildPanelCameraDocument> {
  readonly throughStepNumber: number;
  readonly parentLineageId: string | null;
  readonly document: D;
  readonly documentHash: Sha256Digest;
}

export interface RealBuildPanelCameraAngularSeed<D> {
  readonly candidateId: string;
  readonly lineageId: string;
  readonly parentLineageId: string | null;
  readonly throughStepNumber: 0;
  readonly document: D;
  readonly registrationPanelStepNumber: number;
  readonly latticeHand: StepCameraLatticeHypothesis["latticeHand"];
  readonly latticeDeterminant: 1 | -1;
  readonly turnDegrees: StepCameraLatticeHypothesis["turnDegrees"];
  readonly registrationStatus: "unregistered";
  readonly observationId: null;
  readonly shiftPx: null;
}

export interface RealBuildResolvedPanelCameraObservation<D> extends RealBuildPanelCameraBranch<D> {
  readonly lineageId: string;
  readonly parentLineageId: string | null;
}

export interface RealBuildPanelCameraResolution<D> {
  readonly status: "seeded" | "observed" | "unresolved" | "failed" | "budget-refused";
  readonly candidateId: string;
  readonly parentLineageId: string | null;
  readonly documentHash: Sha256Digest;
  readonly throughStepNumber: number;
  readonly registrationPanelStepNumber: number;
  readonly seeds: readonly RealBuildPanelCameraAngularSeed<D>[];
  readonly attempts: readonly StepCameraLatticeAttempt[];
  readonly renderMaskDigests: readonly (string | null)[];
  readonly rasterMeasurement: {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly builtMaskDigest: string;
    readonly excludedMaskDigest: string | null;
  };
  readonly observations: readonly RealBuildResolvedPanelCameraObservation<D>[];
  readonly selectedObservationId: string | null;
  readonly failure: StepFailure | null;
  readonly reservation: {
    readonly budget: number;
    readonly reservedBefore: number;
    readonly requested: number;
    readonly reservedAfter: number;
    readonly failure: RealBuildPanelCameraBranchBudgetFailure | null;
  };
  readonly physicalFrameDecision: {
    readonly status: "unresolved";
    readonly authorizedTransform: null;
    readonly reason: "panel-camera-silhouette-is-not-physical-transform-authority";
  };
}
