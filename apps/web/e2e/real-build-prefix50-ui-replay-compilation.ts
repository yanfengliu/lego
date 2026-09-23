import { dirname, resolve } from "node:path";

import {
  compileRealBuildPrefix50ExactProjection,
  diagnoseRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50DiagnosticObservation,
  type RealBuildPrefix50ExactCompilation,
} from "./real-build-prefix50-exact-compiler";
import { RealBuildPrefix50Step44ReviewRequiredError } from "./real-build-prefix50-exact-loop";
import { compileRealBuildPrefix50Step45RelationalTransition } from "./real-build-prefix50-step45-relational-compilation.ts";
import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot.ts";
import type { RealBuildPrefix50Occurrence30SourceRepairProof } from "./real-build-prefix50-occurrence30-source-repair.ts";
import type { RealBuildPrefix50VerifiedProjectionReader } from "./real-build-prefix50-projection.ts";
import type { RealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair-contract.ts";
import type { RealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair-contract.ts";
import type { RealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair-contract.ts";
import {
  readRealBuildPrefix50OfflineFinalizedPromotion,
  type RealBuildPrefix50OfflineFinalizedPromotionInput,
  type RealBuildPrefix50OfflineFinalizedPromotionSelection,
} from "./real-build-prefix50-offline-finalized-promotion-selector.ts";
import type { RealBuildPrefix50Step44BlindReviewOutputLayout } from "./real-build-prefix50-subbuild-return-review-blind-persisted";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "./real-build-prefix50-subbuild-return-review-harness-input";
import {
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  selectOfflineFinalizedRealBuildPrefix50SubBuildReturn,
  type RealBuildPrefix50SelectedSubBuildReturn,
  type RealBuildPrefix50SubBuildReturnResult,
  type RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return";
import { requireRealBuildPrefix50ExactKeys } from "./real-build-prefix50-subbuild-return-validation-primitives";

export const REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_REVIEW_ROOT" as const;

const INPUT_KEYS = [
  "documentSnapshot",
  "occurrence30SourceRepairProof",
  "projectionReader",
  "qualificationOutputPath",
  "repositoryRoot",
  "reviewRoot",
  "step41SourceRepairProof",
  "step42SourceRepairProof",
  "step42_43SourceRepairProof",
] as const;

export interface RealBuildPrefix50UiReplayCompilationInput {
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly occurrence30SourceRepairProof: RealBuildPrefix50Occurrence30SourceRepairProof;
  readonly projectionReader: RealBuildPrefix50VerifiedProjectionReader;
  readonly qualificationOutputPath: string;
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
  readonly step41SourceRepairProof: RealBuildPrefix50Step41SourceRepairProof;
  readonly step42SourceRepairProof: RealBuildPrefix50Step42SourceRepairProof;
  readonly step42_43SourceRepairProof: RealBuildPrefix50Step42_43SourceRepairProof;
}

interface RealBuildPrefix50UiReplayCompilationDependencies {
  readonly diagnose: (input: unknown) => RealBuildPrefix50DiagnosticObservation;
  readonly createBatch: (
    result: RealBuildPrefix50SubBuildReturnResult,
  ) => RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly readFinalized: (
    input: RealBuildPrefix50OfflineFinalizedPromotionInput,
  ) => Promise<RealBuildPrefix50OfflineFinalizedPromotionSelection>;
  readonly selectFinalized: (
    result: RealBuildPrefix50SubBuildReturnResult,
    selection: RealBuildPrefix50OfflineFinalizedPromotionSelection,
  ) => RealBuildPrefix50SelectedSubBuildReturn;
  readonly compile: (input: unknown) => RealBuildPrefix50ExactCompilation;
}

function compilerInput(input: RealBuildPrefix50UiReplayCompilationInput): Readonly<{
  documentSnapshot: RealBuildCandidateDocumentSnapshot;
  occurrence30SourceRepairProof: RealBuildPrefix50Occurrence30SourceRepairProof;
  projectionReader: RealBuildPrefix50VerifiedProjectionReader;
  step41SourceRepairProof: RealBuildPrefix50Step41SourceRepairProof;
  step42SourceRepairProof: RealBuildPrefix50Step42SourceRepairProof;
  step42_43SourceRepairProof: RealBuildPrefix50Step42_43SourceRepairProof;
}> {
  return {
    documentSnapshot: input.documentSnapshot,
    occurrence30SourceRepairProof: input.occurrence30SourceRepairProof,
    projectionReader: input.projectionReader,
    step41SourceRepairProof: input.step41SourceRepairProof,
    step42SourceRepairProof: input.step42SourceRepairProof,
    step42_43SourceRepairProof: input.step42_43SourceRepairProof,
  };
}

function requireReviewRoot(value: unknown): string {
  if (typeof value !== "string" || value.length === 0)
    throw new TypeError(
      `Exact prefix-50 UI replay requires ${REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV} to name one persisted Step-44 review root.`,
    );
  const reviewRoot = resolve(value);
  if (dirname(reviewRoot) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT)
    throw new TypeError(
      `Exact prefix-50 UI replay review root must be one direct child of ${REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT}.`,
    );
  return reviewRoot;
}

function layoutFromReviewRoot(
  reviewRootValue: unknown,
): RealBuildPrefix50Step44BlindReviewOutputLayout {
  const reviewRoot = requireReviewRoot(reviewRootValue);
  return {
    reviewRoot,
    publicRoot: resolve(reviewRoot, "public"),
    laneARoot: resolve(reviewRoot, "lane-a"),
    laneBRoot: resolve(reviewRoot, "lane-b"),
    fullResolutionRoot: resolve(reviewRoot, "full-resolution"),
    closureRoot: resolve(reviewRoot, "closure"),
    promotionRoot: resolve(reviewRoot, "promotion"),
  };
}

async function compileWithDependencies(
  input: RealBuildPrefix50UiReplayCompilationInput,
  dependencies: RealBuildPrefix50UiReplayCompilationDependencies,
): Promise<RealBuildPrefix50ExactCompilation> {
  requireRealBuildPrefix50ExactKeys(input, INPUT_KEYS, "Exact prefix-50 UI replay input");
  const baseInput = compilerInput(input);
  const repositoryRoot = resolve(input.repositoryRoot);
  if (repositoryRoot !== resolve("."))
    throw new TypeError("Exact prefix-50 UI replay must run from the explicit repository root.");
  const layout = layoutFromReviewRoot(input.reviewRoot);
  let returnResult: RealBuildPrefix50SubBuildReturnResult;
  try {
    const diagnostic = dependencies.diagnose(baseInput);
    throw new TypeError(
      `Exact prefix-50 UI replay did not stop at the Step-44 review boundary; observed ${JSON.stringify(diagnostic)}.`,
    );
  } catch (error) {
    if (!(error instanceof RealBuildPrefix50Step44ReviewRequiredError)) throw error;
    returnResult = error.result;
  }
  const batch = dependencies.createBatch(returnResult);
  const finalizedPromotion = await dependencies.readFinalized({
    repositoryRoot,
    reviewLayout: layout,
    qualificationOutputPath: input.qualificationOutputPath,
    reviewBatch: batch,
    returnResult,
  });
  const selectedSubBuildReturn = dependencies.selectFinalized(returnResult, finalizedPromotion);
  return dependencies.compile({ ...baseInput, selectedSubBuildReturn });
}

const PRODUCTION_DEPENDENCIES: RealBuildPrefix50UiReplayCompilationDependencies = {
  diagnose: diagnoseRealBuildPrefix50VerifiedProjection,
  createBatch: createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  readFinalized: readRealBuildPrefix50OfflineFinalizedPromotion,
  selectFinalized: selectOfflineFinalizedRealBuildPrefix50SubBuildReturn,
  compile: (input) =>
    compileRealBuildPrefix50ExactProjection(
      input,
      compileRealBuildPrefix50Step45RelationalTransition,
    ),
};

export function requireRealBuildPrefix50UiReplayReviewRootFromEnvironment(): string {
  return requireReviewRoot(process.env[REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV]);
}

export function compileRealBuildPrefix50UiReplayFromPersistedPromotion(
  input: RealBuildPrefix50UiReplayCompilationInput,
): Promise<RealBuildPrefix50ExactCompilation> {
  return compileWithDependencies(input, PRODUCTION_DEPENDENCIES);
}

export interface RealBuildPrefix50UiReplayCompilationTestHooks {
  readonly compileWithDependencies: typeof compileWithDependencies;
  readonly layoutFromReviewRoot: typeof layoutFromReviewRoot;
  readonly requireReviewRoot: typeof requireReviewRoot;
}

export const realBuildPrefix50UiReplayCompilationTestOnly: Readonly<
  Partial<RealBuildPrefix50UiReplayCompilationTestHooks>
> =
  typeof process !== "undefined" && process.env.NODE_ENV === "test"
    ? Object.freeze({ compileWithDependencies, layoutFromReviewRoot, requireReviewRoot })
    : Object.freeze({});
