import { expect, test } from "@playwright/test";

import { renderCalloutCropsInPage } from "./callout-browser-runner";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import type { CalloutTarget } from "./callout-types";
import type { SourceReplayInput, SourceReplayResult } from "./callout-source-replay-types";

const SOURCE_SHA256 = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";

// Independent source witness: page-22 PDF text transforms and their shared
// vector parts-bin bounds, measured directly from 6651557.pdf rather than read
// from a generated callout manifest.
const STEP_18_SOURCE = {
  pageNumber: 22,
  scale: 8 as const,
  box: {
    minXPt: 14.672900199890137,
    minYPt: 482.3388671875,
    maxXPt: 166.74398803710938,
    maxYPt: 529.578857421875,
  },
  targets: [
    {
      key: "q1",
      identity: "p22|q1|x57.695|y495.055",
      expectedLabel: "1x",
      quantity: 1,
      xPt: 57.6953,
      yPt: 495.05469,
      heightPt: 8,
    },
    {
      key: "q2",
      identity: "p22|q2|x109.082|y495.055",
      expectedLabel: "2x",
      quantity: 2,
      xPt: 109.0817,
      yPt: 495.05469,
      heightPt: 8,
    },
  ],
} as const;

const EXPECTED_COMPONENTS = [
  {
    targetKey: "q1",
    label: "1x",
    labelTransformPt: [57.6953, 495.05469],
    boundsPx: { left: 461, top: 214, right: 645, bottom: 327 },
    foregroundPixels: 12_615,
    recordBytes: 12_615 * 8,
    coalescedRawComponents: 1,
    rgbaMismatchedPixelsInComponent: 0,
    absoluteForegroundSha256:
      "sha256:d39033e5087a29dd6ddee53bf9fc6fa087c5371ea3cb8b4a73b99cedebf64cd7",
  },
  {
    targetKey: "q2",
    label: "2x",
    labelTransformPt: [109.0817, 495.05469],
    boundsPx: { left: 873, top: 264, right: 989, bottom: 333 },
    foregroundPixels: 5_134,
    recordBytes: 5_134 * 8,
    coalescedRawComponents: 1,
    rgbaMismatchedPixelsInComponent: 0,
    absoluteForegroundSha256:
      "sha256:3b1bd25148adc6b9d7a0eec82bad4fb5b6f161cfa90220837ee2ff1ca65ceaa0",
  },
] as const;

test("records the exact step-18 clip mismatch without weakening component parity", async ({
  page,
}) => {
  test.skip(!hasSampleBooklet, "no sample booklet");
  await page.goto("/");
  const urls = bookletProbeUrls();
  const input: SourceReplayInput = {
    ...urls,
    expectedPdfSha256: SOURCE_SHA256,
    expectedPdfBytes: urls.expectedSourceBytes,
    pageNumber: STEP_18_SOURCE.pageNumber,
    scale: STEP_18_SOURCE.scale,
    box: STEP_18_SOURCE.box,
    targets: STEP_18_SOURCE.targets,
  };
  const independent = await page.evaluate(
    async ({ moduleUrl, replayInput }) => {
      const module = (await import(/* @vite-ignore */ moduleUrl)) as {
        replayStepSourceComponents(value: SourceReplayInput): Promise<SourceReplayResult>;
      };
      return module.replayStepSourceComponents(replayInput);
    },
    { moduleUrl: "/e2e/callout-source-replay-proof.ts", replayInput: input },
  );

  expect(independent.observedPdfSha256).toBe(SOURCE_SHA256);
  expect(independent.pageNumber).toBe(22);
  expect(independent.scale).toBe(8);
  expect({ width: independent.pageWidthPx, height: independent.pageHeightPx }).toEqual({
    width: 6_123,
    height: 4_355,
  });
  expect(independent.pagePixels).toBe(26_665_665);
  expect(independent.pagePixels).toBeLessThanOrEqual(32_000_000);
  expect(independent.sourceBoxPx).toEqual({ left: 117, top: 117, right: 1334, bottom: 495 });
  expect(independent.sourceBoxPixels).toBe(461_622);
  expect(independent.sourceBoxPixels).toBeLessThanOrEqual(4_000_000);
  expect(independent.clipRenderBoxPx).toEqual({ left: 0, top: 0, right: 1462, bottom: 623 });
  expect(independent.clipRenderPixels).toBe(912_912);
  expect(independent.clipRenderPixels).toBeLessThanOrEqual(4_000_000);
  expect({
    raw: independent.rawComponentCount,
    coalesced: independent.coalescedComponentCount,
  }).toEqual({
    raw: 2,
    coalesced: 2,
  });
  expect(independent.sourceBoxRgbaBytes).toBe(independent.sourceBoxPixels * 4);
  expect(independent.exactRgbaParity).toBe(false);
  expect(independent.rgbaMismatch).toEqual({
    mismatchedBytes: 154,
    mismatchedPixels: 91,
    maximumChannelDelta: 2,
    firstByte: 1_182_060,
    firstPixel: 295_515,
    absoluteX: 876,
    absoluteY: 359,
    channel: 0,
    clippedValue: 198,
    fullPageValue: 197,
    mismatchBoundsPx: { left: 875, top: 359, right: 941, bottom: 391 },
  });
  expect(independent.clippedRgbaSha256).toBe(
    "sha256:f2d56d04bf713ce220d82f1ac4c52e5a0ac527bef9b264bfef7aa7f0234a4abf",
  );
  expect(independent.fullPageSliceRgbaSha256).toBe(
    "sha256:89e66bf615cdbaf38aa23d0327af9ca4016092f1efe2045bd0d15cbac117281d",
  );
  expect(independent.components).toEqual(EXPECTED_COMPONENTS);

  const currentTargets: readonly CalloutTarget[] = STEP_18_SOURCE.targets.map((target) => ({
    identity: target.identity,
    pageNumber: STEP_18_SOURCE.pageNumber,
    stepNumber: 18,
    quantity: target.quantity,
    xPt: target.xPt,
    yPt: target.yPt,
    heightPt: target.heightPt,
    boxMethod: "vector-smallest",
    box: STEP_18_SOURCE.box,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
  }));
  const current = await renderCalloutCropsInPage(page, {
    ...urls,
    pageNumber: STEP_18_SOURCE.pageNumber,
    expectedSourceHash: SOURCE_SHA256,
    targets: currentTargets,
  });
  expect(
    current.map(({ identity, ranked, rankedFailure }) => ({
      identity,
      rankedFailure,
      sourceComponent: ranked?.sourceComponent ?? null,
    })),
  ).toEqual(
    STEP_18_SOURCE.targets.map((target, index) => ({
      identity: target.identity,
      rankedFailure: null,
      sourceComponent: {
        rasterScale: 8,
        rawComponentCount: independent.components[index]!.coalescedRawComponents,
        boundsPx: independent.components[index]!.boundsPx,
        foregroundPixels: independent.components[index]!.foregroundPixels,
        absoluteForegroundSha256: independent.components[index]!.absoluteForegroundSha256,
      },
    })),
  );
});
