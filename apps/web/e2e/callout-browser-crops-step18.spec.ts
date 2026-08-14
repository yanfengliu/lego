import { expect, test } from "@playwright/test";

import { selectEvidenceAwareCrop } from "./callout-benchmark";
import { renderCalloutCropsInPage } from "./callout-browser-runner";
import { CALLOUT_RECOVERY_FIXTURE } from "./callout-recovery-fixture";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import type { CalloutTarget } from "./callout-types";

const SHARED_BOX = {
  minXPt: 14.672900199890137,
  minYPt: 482.3388671875,
  maxXPt: 166.74398803710938,
  maxYPt: 529.578857421875,
};

const TARGETS: readonly CalloutTarget[] = [
  {
    identity: "p22|q1|x57.695|y495.055",
    pageNumber: 22,
    stepNumber: 18,
    quantity: 1,
    xPt: 57.6953,
    yPt: 495.05469,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: SHARED_BOX,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
  },
  {
    identity: "p22|q2|x109.082|y495.055",
    pageNumber: 22,
    stepNumber: 18,
    quantity: 2,
    xPt: 109.0817,
    yPt: 495.05469,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: SHARED_BOX,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
  },
];

test("keeps distinct step-18 part art bound to each printed quantity label", async ({ page }) => {
  test.skip(!hasSampleBooklet, "no sample booklet");
  await page.goto("/");
  const results = await renderCalloutCropsInPage(page, {
    ...bookletProbeUrls(),
    pageNumber: 22,
    expectedSourceHash: CALLOUT_RECOVERY_FIXTURE.sourceHash,
    targets: TARGETS,
  });
  expect(results).toHaveLength(2);
  await expect(
    renderCalloutCropsInPage(page, {
      ...bookletProbeUrls(),
      pageNumber: 22,
      expectedSourceHash: `sha256:${"0".repeat(64)}`,
      targets: TARGETS,
    }),
  ).rejects.toThrow(/Refuse mixed-source crop evidence/);
  const selected = results.map(selectEvidenceAwareCrop);
  expect(selected.every((crop) => crop !== null)).toBe(true);
  expect(
    selected.map((crop) => ({
      strategy: crop!.strategy,
      contamination: crop!.contamination,
      foregroundPixels: crop!.foregroundPixels,
      cropRectPx: crop!.cropRectPx,
      sourceComponent: crop!.sourceComponent,
    })),
  ).toEqual([
    {
      strategy: "ranked-component",
      contamination: [],
      foregroundPixels: 12_615,
      cropRectPx: { left: 456, top: 209, right: 650, bottom: 332 },
      sourceComponent: {
        rasterScale: 8,
        boundsPx: { left: 461, top: 214, right: 645, bottom: 327 },
        foregroundPixels: 12_615,
        rawComponentCount: 1,
        absoluteForegroundSha256:
          "sha256:d39033e5087a29dd6ddee53bf9fc6fa087c5371ea3cb8b4a73b99cedebf64cd7",
      },
    },
    {
      strategy: "ranked-component",
      contamination: [],
      foregroundPixels: 5_134,
      cropRectPx: { left: 868, top: 259, right: 994, bottom: 338 },
      sourceComponent: {
        rasterScale: 8,
        boundsPx: { left: 873, top: 264, right: 989, bottom: 333 },
        foregroundPixels: 5_134,
        rawComponentCount: 1,
        absoluteForegroundSha256:
          "sha256:3b1bd25148adc6b9d7a0eec82bad4fb5b6f161cfa90220837ee2ff1ca65ceaa0",
      },
    },
  ]);
});
