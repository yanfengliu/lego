import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { RealBuildPrefix50Step44ReviewRequiredError } from "../e2e/real-build-prefix50-exact-loop";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input";
import type {
  RealBuildPrefix50SelectedSubBuildReturn,
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import type { RealBuildPrefix50OfflineFinalizedPromotionSelection } from "../e2e/real-build-prefix50-offline-finalized-promotion-selector.ts";
import {
  REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV,
  realBuildPrefix50UiReplayCompilationTestOnly,
  type RealBuildPrefix50UiReplayCompilationInput,
} from "../e2e/real-build-prefix50-ui-replay-compilation";
import type { RealBuildPrefix50ExactCompilation } from "../e2e/real-build-prefix50-exact-compiler";

function hooks() {
  const { compileWithDependencies, layoutFromReviewRoot, requireReviewRoot } =
    realBuildPrefix50UiReplayCompilationTestOnly;
  if (
    compileWithDependencies === undefined ||
    layoutFromReviewRoot === undefined ||
    requireReviewRoot === undefined
  )
    throw new Error("Prefix-50 UI replay compilation test hooks are unavailable.");
  return { compileWithDependencies, layoutFromReviewRoot, requireReviewRoot };
}

function input(): RealBuildPrefix50UiReplayCompilationInput {
  return {
    documentSnapshot: Object.freeze({ kind: "snapshot" }) as never,
    occurrence30SourceRepairProof: Object.freeze({ kind: "occurrence-30" }) as never,
    projectionReader: Object.freeze({ kind: "reader" }) as never,
    qualificationOutputPath: `${resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      "sealed-run",
    )}.page44-real-domain-calibration`,
    repositoryRoot: resolve("."),
    reviewRoot: resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "sealed-run"),
    step41SourceRepairProof: Object.freeze({ kind: "step-41" }) as never,
    step42SourceRepairProof: Object.freeze({ kind: "step-42" }) as never,
    step42_43SourceRepairProof: Object.freeze({ kind: "step-42-43" }) as never,
  };
}

describe("prefix-50 persisted-promotion UI compilation bridge", () => {
  it("derives only the exact named persisted-review sibling topology", () => {
    const { layoutFromReviewRoot, requireReviewRoot } = hooks();
    const reviewRoot = input().reviewRoot;
    expect(layoutFromReviewRoot(reviewRoot)).toEqual({
      reviewRoot,
      publicRoot: resolve(reviewRoot, "public"),
      laneARoot: resolve(reviewRoot, "lane-a"),
      laneBRoot: resolve(reviewRoot, "lane-b"),
      fullResolutionRoot: resolve(reviewRoot, "full-resolution"),
      closureRoot: resolve(reviewRoot, "closure"),
      promotionRoot: resolve(reviewRoot, "promotion"),
    });
    expect(() => requireReviewRoot(undefined)).toThrow(
      new RegExp(REAL_BUILD_PREFIX50_UI_REPLAY_REVIEW_ROOT_ENV, "u"),
    );
    expect(() =>
      requireReviewRoot(resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "nested/run")),
    ).toThrow(/one direct child/u);
  });

  it("uses the same runtime result for batch construction and persisted selection", async () => {
    const { compileWithDependencies } = hooks();
    const returnResult = Object.freeze({
      marker: "same-result",
    }) as unknown as RealBuildPrefix50SubBuildReturnResult;
    const batch = Object.freeze({
      marker: "same-batch",
    }) as unknown as RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
    const selected = Object.freeze({
      marker: "selected",
    }) as unknown as RealBuildPrefix50SelectedSubBuildReturn;
    const finalized = Object.freeze({
      marker: "finalized",
    }) as unknown as RealBuildPrefix50OfflineFinalizedPromotionSelection;
    const compilation = Object.freeze({
      marker: "compiled",
    }) as unknown as RealBuildPrefix50ExactCompilation;
    const compile = vi.fn((compilerInput: unknown) => {
      void compilerInput;
      return compilation;
    });
    const createBatch = vi.fn((observed: RealBuildPrefix50SubBuildReturnResult) => {
      expect(observed).toBe(returnResult);
      return batch;
    });
    const readFinalized = vi.fn(async (selectionInput) => {
      expect(selectionInput.returnResult).toBe(returnResult);
      expect(selectionInput.reviewBatch).toBe(batch);
      expect(selectionInput.reviewLayout.promotionRoot).toBe(
        resolve(input().reviewRoot, "promotion"),
      );
      expect(selectionInput.qualificationOutputPath).toBe(input().qualificationOutputPath);
      expect(selectionInput).not.toHaveProperty("capability");
      expect(selectionInput).not.toHaveProperty("rawInputRoot");
      return finalized;
    });
    const selectFinalized = vi.fn((observedResult, observedFinalized) => {
      expect(observedResult).toBe(returnResult);
      expect(observedFinalized).toBe(finalized);
      return selected;
    });

    await expect(
      compileWithDependencies(input(), {
        diagnose() {
          throw new RealBuildPrefix50Step44ReviewRequiredError(
            "expected review boundary",
            returnResult,
          );
        },
        createBatch,
        readFinalized,
        selectFinalized,
        compile,
      }),
    ).resolves.toBe(compilation);
    expect(createBatch).toHaveBeenCalledTimes(1);
    expect(readFinalized).toHaveBeenCalledTimes(1);
    expect(selectFinalized).toHaveBeenCalledTimes(1);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(compile.mock.calls[0]?.[0]).toMatchObject({ selectedSubBuildReturn: selected });
    expect(compile.mock.calls[0]?.[0]).not.toHaveProperty("reviewRoot");
    expect(compile.mock.calls[0]?.[0]).not.toHaveProperty("repositoryRoot");
  });

  it("rethrows a wrong diagnostic error and refuses a returned diagnostic", async () => {
    const { compileWithDependencies } = hooks();
    const wrongError = new RangeError("wrong boundary");
    const unused = vi.fn();
    await expect(
      compileWithDependencies(input(), {
        diagnose() {
          throw wrongError;
        },
        createBatch: unused,
        readFinalized: unused,
        selectFinalized: unused,
        compile: unused,
      } as never),
    ).rejects.toBe(wrongError);
    expect(unused).not.toHaveBeenCalled();

    await expect(
      compileWithDependencies(input(), {
        diagnose: () => ({ outcome: "unexpected-return" }) as never,
        createBatch: unused,
        readFinalized: unused,
        selectFinalized: unused,
        compile: unused,
      } as never),
    ).rejects.toThrow(/did not stop at the Step-44 review boundary/u);
    expect(unused).not.toHaveBeenCalled();
  });

  it("rejects caller-shaped selection fields before the diagnostic runs", async () => {
    const { compileWithDependencies } = hooks();
    const unused = vi.fn();
    await expect(
      compileWithDependencies(
        { ...input(), selectedSubBuildReturn: Object.freeze({}) } as never,
        {
          diagnose: unused,
          createBatch: unused,
          readFinalized: unused,
          selectFinalized: unused,
          compile: unused,
        } as never,
      ),
    ).rejects.toThrow(/must contain exactly/u);
    expect(unused).not.toHaveBeenCalled();
  });
});
