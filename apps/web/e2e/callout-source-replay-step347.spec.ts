import { expect, test } from "@playwright/test";

import { renderCalloutCropsInPage } from "./callout-browser-runner";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import type { CalloutTarget } from "./callout-types";
import type { SourceReplayInput, SourceReplayResult } from "./callout-source-replay-types";

const SOURCE_SHA256 = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";

// Direct page-214 PDF text transforms and shared vector parts-bin bounds; no
// generated callout-manifest field is read by this independent replay.
const STEP_347_SOURCE = {
  pageNumber: 214,
  scale: 8 as const,
  box: {
    minXPt: 14.672929763793945,
    minYPt: 376.7579650878906,
    maxXPt: 166.7440643310547,
    maxYPt: 429.566162109375,
  },
  targets: [
    {
      key: "left",
      identity: "p214|q1|x46.175|y385.298",
      expectedLabel: "1x",
      quantity: 1,
      xPt: 46.1753,
      yPt: 385.29779,
      heightPt: 8,
    },
    {
      key: "right",
      identity: "p214|q1|x106.202|y385.298",
      expectedLabel: "1x",
      quantity: 1,
      xPt: 106.2017,
      yPt: 385.29779,
      heightPt: 8,
    },
  ],
} as const;

const EXPECTED_COMPONENTS = [
  {
    targetKey: "left",
    label: "1x",
    labelTransformPt: [46.1753, 385.29779],
    boundsPx: { left: 369, top: 981, right: 622, bottom: 1_211 },
    foregroundPixels: 32_648,
    recordBytes: 32_648 * 8,
    coalescedRawComponents: 2,
    rgbaMismatchedPixelsInComponent: 0,
    absoluteForegroundSha256:
      "sha256:0ad7daa3e337d76c44e53a5d7dd21d2dd299dae65515f77aea7d068c75d06bf2",
  },
  {
    targetKey: "right",
    label: "1x",
    labelTransformPt: [106.2017, 385.29779],
    boundsPx: { left: 849, top: 1_054, right: 1_081, bottom: 1_211 },
    foregroundPixels: 21_135,
    recordBytes: 21_135 * 8,
    coalescedRawComponents: 1,
    rgbaMismatchedPixelsInComponent: 0,
    absoluteForegroundSha256:
      "sha256:d974a7fc020330fb98cc0e180fcd69a025b6014402b9c55f8536d00508af6206",
  },
] as const;

test("coalesces only the left page-214 inner detail and replays step 347 exactly", async ({
  page,
}) => {
  test.skip(!hasSampleBooklet, "no sample booklet");
  await page.goto("/");
  const urls = bookletProbeUrls();
  const input: SourceReplayInput = {
    ...urls,
    expectedPdfSha256: SOURCE_SHA256,
    expectedPdfBytes: urls.expectedSourceBytes,
    ...STEP_347_SOURCE,
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
  expect({ page: independent.pageNumber, scale: independent.scale }).toEqual({
    page: 214,
    scale: 8,
  });
  expect({ width: independent.pageWidthPx, height: independent.pageHeightPx }).toEqual({
    width: 6_123,
    height: 4_355,
  });
  expect(independent.pagePixels).toBe(26_665_665);
  expect(independent.pagePixels).toBeLessThanOrEqual(32_000_000);
  expect(independent.sourceBoxPx).toEqual({ left: 117, top: 917, right: 1_334, bottom: 1_340 });
  expect(independent.sourceBoxPixels).toBe(516_432);
  expect(independent.sourceBoxPixels).toBeLessThanOrEqual(4_000_000);
  expect(independent.clipRenderBoxPx).toEqual({
    left: 0,
    top: 789,
    right: 1_462,
    bottom: 1_468,
  });
  expect(independent.clipRenderPixels).toBe(994_840);
  expect(independent.clipRenderPixels).toBeLessThanOrEqual(4_000_000);
  expect({
    raw: independent.rawComponentCount,
    coalesced: independent.coalescedComponentCount,
  }).toEqual({
    raw: 3,
    coalesced: 2,
  });
  expect(independent.sourceBoxRgbaBytes).toBe(independent.sourceBoxPixels * 4);
  expect(independent.exactRgbaParity).toBe(true);
  expect(independent.rgbaMismatch).toBeNull();
  expect(independent.clippedRgbaSha256).toBe(
    "sha256:24cf169c6f857b5d6dbc62d2da0a26d5d9115be0d2136d1d828fa1be0815f0c4",
  );
  expect(independent.fullPageSliceRgbaSha256).toBe(independent.clippedRgbaSha256);
  expect(independent.components).toEqual(EXPECTED_COMPONENTS);
  expect(independent.components[0]!.foregroundPixels).toBe(31_481 + 1_167);

  const currentTargets: readonly CalloutTarget[] = STEP_347_SOURCE.targets.map((target) => ({
    identity: target.identity,
    pageNumber: STEP_347_SOURCE.pageNumber,
    stepNumber: 347,
    quantity: target.quantity,
    xPt: target.xPt,
    yPt: target.yPt,
    heightPt: target.heightPt,
    boxMethod: "vector-smallest",
    box: STEP_347_SOURCE.box,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
  }));
  const current = await renderCalloutCropsInPage(page, {
    ...bookletProbeUrls(),
    pageNumber: STEP_347_SOURCE.pageNumber,
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
    STEP_347_SOURCE.targets.map((target, index) => ({
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
