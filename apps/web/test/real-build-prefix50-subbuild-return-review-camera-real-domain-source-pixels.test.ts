import { describe, expect, it } from "vitest";

import {
  hashRealBuildPrefix50Step44ReviewArtifact,
  sha256RealBuildPrefix50Step44ReviewBytes,
} from "../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  deriveRealBuildPrefix50Step44RealDomainSourcePixels,
  deriveUnsealedRealBuildPrefix50Step44SourcePixelsForTest,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-pixels.ts";
import { rerenderRealBuildPrefix50Step44CalibrationSourceCrop } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";

const WIDTH = 720;
const HEIGHT = 470;
const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const INK = [0x1a, 0x1d, 0x1b, 0xff] as const;
const YELLOW = [0xff, 0xd8, 0x00, 0xff] as const;
const WHITE = [0xff, 0xff, 0xff, 0xff] as const;

function blank(): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) rgba.set(BACKGROUND, index * 4);
  return rgba;
}

function rectangle(
  rgba: Uint8Array,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) rgba.set(color, (y * WIDTH + x) * 4);
}

function outlinedChild(
  rgba: Uint8Array,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  rectangle(rgba, minX, minY, maxX, maxY, INK);
  rectangle(rgba, minX, minY, maxX, minY + 2, YELLOW);
  rectangle(rgba, minX, maxY - 2, maxX, maxY, YELLOW);
  rectangle(rgba, minX, minY, minX + 2, maxY, YELLOW);
  rectangle(rgba, maxX - 2, minY, maxX, maxY, YELLOW);
}

function openChild(rgba: Uint8Array, minX: number, minY: number, maxX: number, maxY: number): void {
  rectangle(rgba, minX, minY, maxX, maxY, INK);
  rectangle(rgba, minX, minY, maxX, minY + 2, YELLOW);
  rectangle(rgba, minX, maxY - 2, maxX, maxY, YELLOW);
  rectangle(rgba, minX, minY, minX + 2, maxY, YELLOW);
}

function maskEvidence(mask: Uint8Array) {
  let pixelCount = 0,
    minX = WIDTH,
    minY = HEIGHT,
    maxX = -1,
    maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    pixelCount += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    pixelCount,
    maskDigest: sha256RealBuildPrefix50Step44ReviewBytes(mask),
    bounds: pixelCount === 0 ? null : { minX, minY, maxX, maxY },
  };
}

function derive(rgba: Uint8Array) {
  return deriveUnsealedRealBuildPrefix50Step44SourcePixelsForTest({
    pageRgba: rgba,
    pageWidth: WIDTH,
    crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
}

function forgedDerive(rgba: Uint8Array, forged: Readonly<Record<string, unknown>>) {
  return deriveUnsealedRealBuildPrefix50Step44SourcePixelsForTest({
    pageRgba: rgba,
    pageWidth: WIDTH,
    crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    ...forged,
  });
}

function deriveInput(input: unknown) {
  return deriveUnsealedRealBuildPrefix50Step44SourcePixelsForTest(
    input as Parameters<typeof deriveUnsealedRealBuildPrefix50Step44SourcePixelsForTest>[0],
  );
}

describe("prefix-50 Step-44 real-domain source pixels", () => {
  it("floods closed contours while retaining same-color nearby and shared-parent art", () => {
    const rgba = blank();
    rectangle(rgba, 50, 310, 650, 360, INK);
    outlinedChild(rgba, 150, 190, 250, 260);
    outlinedChild(rgba, 400, 200, 500, 270);
    rectangle(rgba, 135, 275, 145, 285, INK);
    rectangle(rgba, 505, 285, 515, 295, INK);

    const source = derive(rgba);
    const firstChildInterior = 225 * WIDTH + 200;
    const secondChildInterior = 235 * WIDTH + 450;
    const firstNearbyParent = 280 * WIDTH + 140;
    const secondNearbyParent = 290 * WIDTH + 510;
    const sharedParentBar = 330 * WIDTH + 300;

    expect(source.yellowComponents).toHaveLength(2);
    expect(source.contours.map(({ route }) => route)).toEqual(["closed-flood", "closed-flood"]);
    expect(source.eligibleMask[firstChildInterior]).toBe(0);
    expect(source.eligibleMask[secondChildInterior]).toBe(0);
    expect(source.parentOnlyForegroundMask[firstChildInterior]).toBe(0);
    expect(source.parentOnlyForegroundMask[secondChildInterior]).toBe(0);
    expect(source.eligibleMask[firstNearbyParent]).toBe(1);
    expect(source.eligibleMask[secondNearbyParent]).toBe(1);
    expect(source.parentOnlyForegroundMask[firstNearbyParent]).toBe(1);
    expect(source.parentOnlyForegroundMask[secondNearbyParent]).toBe(1);
    expect(source.parentOnlyForegroundMask[sharedParentBar]).toBe(1);
    expect(source.accounting.foregroundPixelCount).toBe(
      source.accounting.childForegroundPixelCount +
        source.accounting.edgeClutterPixelCount +
        source.accounting.parentOnlyForegroundPixelCount,
    );
    expect(source.accounting.edgeClutterPixelCount).toBe(0);
    for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
      expect(
        source.childExclusionMask[index]! + source.edgeClutterMask[index]!,
      ).toBeLessThanOrEqual(1);
      if (source.parentOnlyForegroundMask[index] === 1) {
        expect(source.childExclusionMask[index]).toBe(0);
        expect(source.edgeClutterMask[index]).toBe(0);
      }
    }
  });

  it("rejects mixed closed/open topology and caller-authored open semantics", () => {
    const mixed = blank();
    outlinedChild(mixed, 100, 100, 240, 240);
    openChild(mixed, 238, 140, 400, 300);
    expect(() => derive(mixed)).toThrow(/mixes a closed boundary with an unsealed open branch/u);

    const concave = blank();
    rectangle(concave, 120, 120, 400, 122, YELLOW);
    rectangle(concave, 120, 120, 122, 300, YELLOW);
    rectangle(concave, 120, 298, 250, 300, YELLOW);
    expect(() =>
      forgedDerive(concave, {
        certifiedConvexOpenContours: [{ reviewedAs: "convex-open-highlighted-addition" }],
      }),
    ).toThrow(/has no module-owned sealed route/u);
  });

  it("requires a module seal when one through four missing pixels close only after dilation", () => {
    for (const gap of [1, 2, 3, 4]) {
      const rgba = blank();
      outlinedChild(rgba, 180, 140, 360, 260);
      rectangle(rgba, 260, 140, 260 + gap - 1, 142, INK);
      expect(() => derive(rgba), `gap ${gap}`).toThrow(
        /Dilation-created closure .* requires a module-owned sealed route/u,
      );
    }
  });

  it("refuses an unsealed one-pixel spur before it can consume adjacent parent ink", () => {
    const rgba = blank();
    outlinedChild(rgba, 180, 140, 360, 260);
    rectangle(rgba, 361, 198, 361, 200, YELLOW);
    rectangle(rgba, 363, 199, 363, 199, INK);
    expect(() =>
      deriveRealBuildPrefix50Step44RealDomainSourcePixels({
        pageRgba: rgba,
        pageWidth: WIDTH,
        crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      }),
    ).toThrow(/no module-owned sealed final masks/u);
  });

  it("rejects forged edge-clutter authority and unclassified yellow", () => {
    const edgeModel = blank();
    outlinedChild(edgeModel, 200, 160, 360, 260);
    rectangle(edgeModel, 0, 300, 40, 330, WHITE);
    expect(() =>
      forgedDerive(edgeModel, {
        certifiedEdgeConnectedClutter: [{ reviewedAs: "non-model-crop-edge-clutter" }],
      }),
    ).toThrow(/no module-owned sealed clutter identity/u);

    const yellowSpeck = blank();
    outlinedChild(yellowSpeck, 200, 160, 360, 260);
    rectangle(yellowSpeck, 500, 100, 501, 101, YELLOW);
    expect(() => derive(yellowSpeck)).toThrow(/Unclassified yellow source pixels: 4/u);
  });

  it("rejects fractional, non-finite, and out-of-range page/crop geometry before slicing", () => {
    const pageRgba = blank();
    const base = {
      pageRgba,
      pageWidth: WIDTH,
      crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    };
    for (const pageWidth of [Number.NaN, Number.POSITIVE_INFINITY, WIDTH + 0.5])
      expect(() => deriveInput({ ...base, pageWidth })).toThrow(/page width must be an integer/u);
    for (const [field, value] of [
      ["x", 0.5],
      ["y", Number.NaN],
      ["width", WIDTH + 0.5],
      ["height", Number.POSITIVE_INFINITY],
    ] as const)
      expect(() => deriveInput({ ...base, crop: { ...base.crop, [field]: value } })).toThrow(
        /crop must be a non-negative exact 720x470 rectangle/u,
      );
    expect(() => deriveInput({ ...base, pageWidth: WIDTH + 1 })).toThrow(/exceeds its exact RGBA/u);
  });

  it("reproduces branch-blind native page-44 Step-41/42 masks from the pinned PDF", async () => {
    const repositoryRoot = process.cwd();
    expect(
      hashRealBuildPrefix50Step44ReviewArtifact(
        repositoryRoot,
        "recipes/6651557.pdf",
        80 * 1024 * 1024,
        "native page-44 source-mask test PDF",
      ),
    ).toBe("sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27");
    const step41Raster = await rerenderRealBuildPrefix50Step44CalibrationSourceCrop({
      repositoryRoot,
      spec: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[0]!,
    });
    const step41SourceDigest =
      "sha256:ade43c2e8a605216af03f0a3aeec6cfc7fa2329516936da2ea3df51f713df1c9" as const;
    const step41 = deriveRealBuildPrefix50Step44RealDomainSourcePixels({
      pageRgba: step41Raster.rgba,
      pageWidth: WIDTH,
      crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    expect(
      step41.contours.map(({ route, childExclusionPixelCount }) => [
        route,
        childExclusionPixelCount,
      ]),
    ).toEqual([
      ["source-sealed-convex-hull", 3823],
      ["source-sealed-convex-hull", 3883],
      ["source-sealed-convex-hull", 4015],
      ["closed-flood", 4175],
    ]);
    expect(maskEvidence(step41.childExclusionMask)).toEqual({
      pixelCount: 15896,
      maskDigest: "sha256:0b8f32de293630db3761dda3496795331b867bd2f43e1950046af169f9f61ffd",
      bounds: { minX: 134, minY: 164, maxX: 548, maxY: 362 },
    });
    expect(maskEvidence(step41.edgeClutterMask)).toEqual({
      pixelCount: 0,
      maskDigest: "sha256:49cb81064db1f07ba6a242e0e3b76b239803fe32c379228ba7bd3a23d46e01ad",
      bounds: null,
    });
    expect(maskEvidence(step41.eligibleMask).maskDigest).toBe(
      "sha256:6ccf7e2de388390fbed7914c7303b658874cd7d45969b9603ad99ecde0480978",
    );
    expect(maskEvidence(step41.parentOnlyForegroundMask).maskDigest).toBe(
      "sha256:9cfcabc1cd58424761271055b60a6e2fa04aae11be684d0accb409f6a83ece07",
    );
    expect(step41.accounting).toMatchObject({
      sourceCropPixelDigest: step41SourceDigest,
      highlightPixelCount: 2641,
      ignoredHighlightPixelCount: 0,
      childExclusionPixelCount: 15896,
      childExclusionMaskDigest:
        "sha256:0b8f32de293630db3761dda3496795331b867bd2f43e1950046af169f9f61ffd",
      foregroundPixelCount: 42316,
      childForegroundPixelCount: 15818,
      edgeClutterPixelCount: 0,
      eligiblePixelCount: 322504,
      eligibleMaskDigest: "sha256:6ccf7e2de388390fbed7914c7303b658874cd7d45969b9603ad99ecde0480978",
      parentOnlyForegroundPixelCount: 26498,
      parentOnlyForegroundMaskDigest:
        "sha256:9cfcabc1cd58424761271055b60a6e2fa04aae11be684d0accb409f6a83ece07",
    });

    const step42SourceDigest =
      "sha256:d99e7b1cc959810d9f4d32dfa5eb2d28e2edeeb6ae600e962e15011070fbab1d" as const;
    const step42Raster = await rerenderRealBuildPrefix50Step44CalibrationSourceCrop({
      repositoryRoot,
      spec: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[1]!,
    });
    const step42 = deriveRealBuildPrefix50Step44RealDomainSourcePixels({
      pageRgba: step42Raster.rgba,
      pageWidth: WIDTH,
      crop: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
    expect(
      step42.contours.map(({ route, childExclusionPixelCount }) => [
        route,
        childExclusionPixelCount,
      ]),
    ).toEqual([["source-sealed-open-remainder", 22391]]);
    expect(maskEvidence(step42.childExclusionMask)).toEqual({
      pixelCount: 22391,
      maskDigest: "sha256:9412e658821d7d176efd0567f8fcb2b0f7889e7e554d205be4e17995273c8acb",
      bounds: { minX: 126, minY: 132, maxX: 556, maxY: 332 },
    });
    expect(maskEvidence(step42.edgeClutterMask)).toEqual({
      pixelCount: 600,
      maskDigest: "sha256:8edabcf513158714f6ad7f8a47c7afa2fd6bea4da7857cca4a2a730768711b67",
      bounds: { minX: 0, minY: 0, maxX: 297, maxY: 3 },
    });
    expect(maskEvidence(step42.eligibleMask).maskDigest).toBe(
      "sha256:faf52f1a43fdacdcb3b01952daf37a636d9dfbe0e7fe4bdf782b66846cdc7231",
    );
    expect(maskEvidence(step42.parentOnlyForegroundMask).maskDigest).toBe(
      "sha256:c204a09f68fe86e30fc0869d1412764c01d67055b8f9e1541db9109fee17c809",
    );
    expect(step42.accounting).toMatchObject({
      sourceCropPixelDigest: step42SourceDigest,
      highlightPixelCount: 3538,
      ignoredHighlightPixelCount: 0,
      childExclusionPixelCount: 22391,
      childExclusionMaskDigest:
        "sha256:9412e658821d7d176efd0567f8fcb2b0f7889e7e554d205be4e17995273c8acb",
      foregroundPixelCount: 44723,
      childForegroundPixelCount: 21813,
      edgeClutterPixelCount: 600,
      edgeClutterMaskDigest:
        "sha256:8edabcf513158714f6ad7f8a47c7afa2fd6bea4da7857cca4a2a730768711b67",
      eligiblePixelCount: 315409,
      eligibleMaskDigest: "sha256:faf52f1a43fdacdcb3b01952daf37a636d9dfbe0e7fe4bdf782b66846cdc7231",
      parentOnlyForegroundPixelCount: 22310,
      parentOnlyForegroundMaskDigest:
        "sha256:c204a09f68fe86e30fc0869d1412764c01d67055b8f9e1541db9109fee17c809",
    });
  }, 120_000);
});
