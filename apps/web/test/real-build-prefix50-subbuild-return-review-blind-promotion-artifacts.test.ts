import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readRealBuildPrefix50Step44PersistedPromotion,
  writeRealBuildPrefix50Step44PromotionArtifacts,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-artifacts";
import { createRealBuildPrefix50Step44ProductionPromotionAuthority } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-authority";
import { createRealBuildPrefix50SubBuildReturnBrands } from "../e2e/real-build-prefix50-subbuild-return-brands";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  requireRealBuildPrefix50SubBuildReturnResult,
} from "../e2e/real-build-prefix50-subbuild-return";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-result";

describe("prefix-50 Step-44 persisted promotion authority", () => {
  it("refuses synthetic review receipts and unbranded writer/reader inputs", async () => {
    const result = createStep44ReviewTestResult(211);
    createRealBuildPrefix50SubBuildReturnBrands().brandRealBuildPrefix50SubBuildReturnResult(
      result,
    );
    expect(() => requireRealBuildPrefix50SubBuildReturnResult(result)).toThrow(
      /runtime-branded enumeration receipt/u,
    );
    const brand = __testOnly.brandReturnResultForReviewTests;
    if (brand === undefined) throw new Error("Step-44 synthetic review brand is unavailable.");
    brand(result);
    const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
    expect(() =>
      createRealBuildPrefix50Step44ProductionPromotionAuthority({
        result,
        batch,
        evidence: {} as never,
        map: {} as never,
        publicationComplete: {} as never,
        productionChain: {} as never,
      }),
    ).toThrow(/live finalization capability/u);

    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-promotion-refusal-"));
    const promotionRoot = resolve(root, "promotion");
    await mkdir(promotionRoot);
    try {
      await expect(
        writeRealBuildPrefix50Step44PromotionArtifacts({
          promotionRoot,
          authority: {} as never,
        }),
      ).rejects.toThrow(/requires a live capability/u);
      expect(await readdir(promotionRoot)).toEqual([]);
      expect(() =>
        readRealBuildPrefix50Step44PersistedPromotion(promotionRoot, {} as never),
      ).toThrow(/requires a live capability/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
