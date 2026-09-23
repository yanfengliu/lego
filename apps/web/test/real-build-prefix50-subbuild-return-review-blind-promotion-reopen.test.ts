import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readRealBuildPrefix50Step44PersistedPromotion,
  writeRealBuildPrefix50Step44PromotionArtifacts,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-artifacts";
import type { RealBuildPrefix50Step44ProductionPromotionAuthority } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-authority";
import type { RealBuildPrefix50Step44SourceLockCapability } from "../e2e/real-build-prefix50-subbuild-return-review-source-lock";

describe("prefix-50 Step-44 persisted promotion reopen", () => {
  it("cannot publish or reopen through the legacy route without a real live capability", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-promotion-capability-"));
    const promotionRoot = resolve(root, "promotion");
    const authority = {} as RealBuildPrefix50Step44ProductionPromotionAuthority;
    const forged = { binding: {} } as RealBuildPrefix50Step44SourceLockCapability;
    await mkdir(promotionRoot);
    try {
      await expect(
        writeRealBuildPrefix50Step44PromotionArtifacts({ promotionRoot, authority }),
      ).rejects.toThrow(/requires a live capability/u);
      await expect(
        writeRealBuildPrefix50Step44PromotionArtifacts({
          promotionRoot,
          authority,
          capability: forged,
        }),
      ).rejects.toThrow(/opaque live bootstrap source-lock capability/u);
      expect(() =>
        readRealBuildPrefix50Step44PersistedPromotion(promotionRoot, authority, forged),
      ).toThrow(/opaque live bootstrap source-lock capability/u);
      expect(await readdir(promotionRoot)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
