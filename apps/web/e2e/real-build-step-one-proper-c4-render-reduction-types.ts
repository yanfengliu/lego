import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildCompiledObservationSourceId } from "./real-build-compiled-observation-closure";
import type { RealBuildCompiledSearchReservation } from "./real-build-compiled-placement-lineage-types";
import type { RealBuildPanelCameraBranchBudgetFailure } from "./real-build-panel-camera-branch-budget";
import type { RealBuildPreparedSearchLedgerSnapshot } from "./real-build-prepared-search-ledger";
import type { RealBuildStepOneCompiledCameraMetrics } from "./real-build-step-one-compiled-camera-diagnostic";
import type { RealBuildStepOneProperC4RendererEquivarianceInspection } from "./real-build-step-one-proper-c4-render-equivariance";
import type { RealBuildStepOneProperC4PopulationEquivarianceInspection } from "./real-build-step-one-proper-c4-population-equivariance";
import type {
  RealBuildStepOneProperC4GlobalAggregationInspection,
  RealBuildStepOneProperC4RepresentativeCameraScoreRow,
} from "./real-build-step-one-proper-c4-global-aggregation";

export interface RealBuildStepOneProperC4ClosureInspection {
  readonly schemaVersion: "lego.real-build-step-one-proper-c4-render-closure/1";
  readonly closureIndex: number;
  readonly orbitIndices: readonly number[];
  readonly quotientDigest: Sha256Digest;
  readonly rendererConfigurationDigest: Sha256Digest;
  readonly sourceBindingDigest: Sha256Digest;
  readonly sourceId: RealBuildCompiledObservationSourceId;
  readonly compiledLineageBytesDigest: Sha256Digest;
  readonly closureBytesDigest: Sha256Digest;
  readonly roleBytes: number;
  readonly roleDigest: Sha256Digest;
  readonly logicalAssociationsDigest: Sha256Digest;
  readonly representativeRows: readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[];
  readonly representativeRowsDigest: Sha256Digest;
  readonly metrics: RealBuildStepOneCompiledCameraMetrics;
  readonly searchReservation: RealBuildCompiledSearchReservation;
  readonly cameraReservation: Readonly<{
    budget: number;
    reservedBefore: number;
    requested: number;
    reservedAfter: number;
    failure: RealBuildPanelCameraBranchBudgetFailure | null;
  }>;
  readonly accounting: Readonly<{
    representatives: 5;
    compiledLineageEdges: 40;
    physicalTransitions: 5;
    physicalRenders: 40;
    representativeCameraScores: 40;
    logicalCameraBranches: 320;
  }>;
  readonly closureDigest: Sha256Digest;
  readonly localSelectionStatus: "unresolved";
  readonly localSelectedCameraId: null;
  readonly localSelectedCandidateId: null;
  readonly localSelectedLineageIds: readonly [];
  readonly acceptedTransition: null;
  readonly acceptedDocument: null;
  readonly physicalFrameAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly authority: "absent";
}

export interface RealBuildStepOneProperC4RenderReductionInspection {
  readonly schemaVersion: "lego.real-build-step-one-proper-c4-render-reduction/1";
  readonly quotientDigest: Sha256Digest;
  readonly rendererConfigurationDigest: Sha256Digest;
  readonly rendererEquivariance: RealBuildStepOneProperC4RendererEquivarianceInspection;
  readonly rendererPopulationEquivariance: RealBuildStepOneProperC4PopulationEquivarianceInspection;
  readonly sourceBindingDigest: Sha256Digest;
  readonly closures: readonly RealBuildStepOneProperC4ClosureInspection[];
  readonly closureDigestsDigest: Sha256Digest;
  readonly searchLedger: RealBuildPreparedSearchLedgerSnapshot;
  readonly cameraLedger: Readonly<{
    budget: 8_192;
    reserved: 6_400;
    refusedReservation: false;
    failedReservation: null;
  }>;
  readonly globalAggregation: RealBuildStepOneProperC4GlobalAggregationInspection;
  readonly accounting: Readonly<{
    closureCount: 20;
    representatives: 100;
    rawCandidates: 400;
    compiledLineageEdges: 800;
    uniquePhysicalTransitions: 100;
    physicalRenderBaseline: 3_200;
    physicalRenderCalls: 800;
    representativeCameraScores: 800;
    inverseExpandedRawCameraScores: 3_200;
    rawLogicalCameraBranches: 25_600;
    quotientLogicalCameraBranches: 6_400;
    reductionNumerator: 3;
    reductionDenominator: 4;
  }>;
  readonly integrationDigest: Sha256Digest;
  readonly acceptedTransition: null;
  readonly acceptedDocument: null;
  readonly physicalFrameAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly authority: "absent";
}
