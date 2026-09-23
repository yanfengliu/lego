import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { PanelFace } from "../src/assembly/panel-face.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";

export const REAL_BUILD_PREFIX50_STEP44_PAGE45_WIDTH = 1_914;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_HEIGHT = 1_361;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_X = 850;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_Y = 350;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH = 720;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT = 470;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_RENDERER_VERSION = "26.05.0";
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_PNG_DIGEST =
  "sha256:dbb3dc98452f84c6f5adcd2934c6d108152910f7b924847b8bdbff0568533741" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_PIXEL_DIGEST =
  "sha256:5a4b34e1c4ef8d72e20116174083195c53651f7d5c28deed7aa423303e8d640f" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_RASTER_COMMITMENT =
  "sha256:37b6d6fe3de55cbf91e878f891d052146ecf10911d981e5df7ec3db4cf5027e2" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_PANEL_PIXEL_DIGEST =
  "sha256:47be1ae02c05b155e94ae3ed3a4fe2cb91d0f6f16b9636d9b528ca370dc7d422" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_PANEL_CROP_COMMITMENT =
  "sha256:d9e8f5f390ecd5ff695373b30dcc2a0278787de375b9cc238cb2e9fabd0a35af" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_FACE_PREFIX_COMMITMENT =
  "sha256:e0053f532df1d943c30a9c4efc450a6d710c45f6be2ad92e6dce441155748ec0" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_PARENT_REGION_COMMITMENT =
  "sha256:6f5714a4a4afeac29cf54b4edc543358afbd0aff66478905336138082ce405b3" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_LATTICE_FIT_COMMITMENT =
  "sha256:3c69b7de6267c2676affa6069d0bec62b88d5bdc2d6b3e9a94adbd2ef79700cb" as const;
export const REAL_BUILD_PREFIX50_STEP44_PAGE45_EXCLUSION_ROW_SPANS_COMMITMENT =
  "sha256:289768870f922675c840fa4b61fb3f81c3e857d9abba6783215d15ce27e1f234" as const;

export interface RealBuildPrefix50Step44SourcePageRasterBinding {
  readonly rendererVersion: string;
  readonly sourcePagePngDigest: `sha256:${string}`;
  readonly sourcePagePixelDigest: `sha256:${string}`;
  readonly panelFacePrefixEvidenceCommitment: `sha256:${string}`;
  readonly expectedPanelFace: PanelFace;
}

export function commitRealBuildPrefix50Step44SourcePageRaster(
  input: RealBuildPrefix50Step44SourcePageRasterBinding,
): `sha256:${string}` {
  return canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-camera-source-page-raster/1",
    renderer: "poppler-pdftoppm",
    rendererVersion: input.rendererVersion,
    densityDpi: 180,
    pageNumber: 45,
    width: REAL_BUILD_PREFIX50_STEP44_PAGE45_WIDTH,
    height: REAL_BUILD_PREFIX50_STEP44_PAGE45_HEIGHT,
    pngDigest: input.sourcePagePngDigest,
    pixelDigest: input.sourcePagePixelDigest,
    panelFacePrefixEvidenceCommitment: input.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: input.expectedPanelFace,
  });
}

export interface RealBuildPrefix50Step44PanelCropBinding {
  readonly sourcePageRasterCommitment: `sha256:${string}`;
  readonly panelPixelDigest: `sha256:${string}`;
  readonly parentOnlyRegionCommitment: `sha256:${string}`;
  readonly panelFacePrefixEvidenceCommitment: `sha256:${string}`;
  readonly expectedPanelFace: PanelFace;
}

export function commitRealBuildPrefix50Step44PanelCrop(
  input: RealBuildPrefix50Step44PanelCropBinding,
): `sha256:${string}` {
  return canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-camera-source-panel-crop/1",
    sourcePageRasterCommitment: input.sourcePageRasterCommitment,
    x: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_X,
    y: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_Y,
    width: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
    height: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
    pixelDigest: input.panelPixelDigest,
    parentOnlyRegionCommitment: input.parentOnlyRegionCommitment,
    panelFacePrefixEvidenceCommitment: input.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: input.expectedPanelFace,
  });
}

export interface RealBuildPrefix50Step44MutableSourceBinding
  extends RealBuildPrefix50Step44SourcePageRasterBinding, RealBuildPrefix50Step44PanelCropBinding {
  readonly panelCropCommitment: `sha256:${string}`;
  readonly parentOnlyRegion: Readonly<{
    readonly eligibleMaskDigest: `sha256:${string}`;
    readonly parentOnlyForegroundMaskDigest: `sha256:${string}`;
    readonly highlightedChildExclusionMaskDigest: `sha256:${string}`;
  }>;
  readonly rgba: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyForegroundMask: Uint8Array;
  readonly highlightedChildExclusionMask: Uint8Array;
}

export function verifyRealBuildPrefix50Step44MutableSourceBinding(
  source: RealBuildPrefix50Step44MutableSourceBinding,
): void {
  if (
    source.panelPixelDigest !== sha256RealBuildPrefix50Step44ReviewBytes(source.rgba) ||
    source.parentOnlyRegion.eligibleMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(source.eligibleMask) ||
    source.parentOnlyRegion.parentOnlyForegroundMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(source.parentOnlyForegroundMask) ||
    source.parentOnlyRegion.highlightedChildExclusionMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(source.highlightedChildExclusionMask) ||
    source.sourcePageRasterCommitment !== commitRealBuildPrefix50Step44SourcePageRaster(source) ||
    source.panelCropCommitment !== commitRealBuildPrefix50Step44PanelCrop(source)
  )
    throw new TypeError(
      "Step-44 camera source pixels, masks, or PDF/face commitments drifted after branding.",
    );
}

function independentChebyshevDilationOne(mask: Uint8Array): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH;
    const y = Math.floor(index / REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH);
    for (
      let nextY = Math.max(0, y - 1);
      nextY <= Math.min(REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT - 1, y + 1);
      nextY += 1
    )
      for (
        let nextX = Math.max(0, x - 1);
        nextX <= Math.min(REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH - 1, x + 1);
        nextX += 1
      )
        result[nextY * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH + nextX] = 1;
  }
  return result;
}

export function verifyRealBuildPrefix50Step44RepositoryPage45ExactSourceControl(input: {
  readonly rendererVersion: string;
  readonly sourcePagePngDigest: `sha256:${string}`;
  readonly sourcePagePixelDigest: `sha256:${string}`;
  readonly sourcePageRasterCommitment: `sha256:${string}`;
  readonly panelPixelDigest: `sha256:${string}`;
  readonly panelCropCommitment: `sha256:${string}`;
  readonly panelFacePrefixEvidenceCommitment: `sha256:${string}`;
  readonly parentOnlyRegion: Readonly<{
    readonly commitment: `sha256:${string}`;
    readonly highlightMaskDigest: `sha256:${string}`;
    readonly filledHighlightMaskDigest: `sha256:${string}`;
    readonly highlightedChildExclusionMaskDigest: `sha256:${string}`;
    readonly eligibleMaskDigest: `sha256:${string}`;
    readonly parentOnlyForegroundMaskDigest: `sha256:${string}`;
    readonly highlightedChildExclusionPixelCount: number;
  }>;
  readonly latticeFit: unknown;
  readonly highlightMask: Uint8Array;
  readonly filledHighlightMask: Uint8Array;
  readonly highlightedChildExclusionMask: Uint8Array;
  readonly eligibleMask: Uint8Array;
  readonly parentOnlyForegroundMask: Uint8Array;
}): void {
  const pixelCount =
    REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT;
  for (const [label, mask] of [
    ["highlight", input.highlightMask],
    ["filled highlight", input.filledHighlightMask],
    ["child exclusion", input.highlightedChildExclusionMask],
    ["eligible", input.eligibleMask],
    ["parent foreground", input.parentOnlyForegroundMask],
  ] as const)
    if (
      !(mask instanceof Uint8Array) ||
      mask.byteLength !== pixelCount ||
      mask.some((value) => value !== 0 && value !== 1)
    )
      throw new TypeError(
        `Step-44 repository page-45 ${label} control must be exact binary 720x470 pixels.`,
      );
  const independentDilation = independentChebyshevDilationOne(input.filledHighlightMask);
  const rowSpans = Array.from({ length: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT }, (_, y) => {
    let minX = REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH;
    let maxX = -1;
    let count = 0;
    for (let x = 0; x < REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH; x += 1)
      if (
        input.highlightedChildExclusionMask[
          y * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH + x
        ] === 1
      ) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        count += 1;
      }
    return count === 0 ? null : { y, minX, maxX, count };
  }).filter((row) => row !== null);
  const underExcluded = input.highlightMask.some(
    (value, index) =>
      value === 1 &&
      (input.filledHighlightMask[index] !== 1 || input.highlightedChildExclusionMask[index] !== 1),
  );
  if (
    underExcluded ||
    sha256RealBuildPrefix50Step44ReviewBytes(independentDilation) !==
      sha256RealBuildPrefix50Step44ReviewBytes(input.highlightedChildExclusionMask) ||
    canonicalDigest(rowSpans) !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_EXCLUSION_ROW_SPANS_COMMITMENT ||
    rowSpans.length !== 224 ||
    canonicalDigest(rowSpans[0]) !== canonicalDigest({ y: 131, minX: 167, maxX: 173, count: 7 }) ||
    canonicalDigest(rowSpans.at(-1)) !==
      canonicalDigest({ y: 354, minX: 540, maxX: 544, count: 5 }) ||
    input.rendererVersion !== REAL_BUILD_PREFIX50_STEP44_PAGE45_RENDERER_VERSION ||
    input.sourcePagePngDigest !== REAL_BUILD_PREFIX50_STEP44_PAGE45_PNG_DIGEST ||
    input.sourcePagePixelDigest !== REAL_BUILD_PREFIX50_STEP44_PAGE45_PIXEL_DIGEST ||
    input.sourcePageRasterCommitment !== REAL_BUILD_PREFIX50_STEP44_PAGE45_RASTER_COMMITMENT ||
    input.panelPixelDigest !== REAL_BUILD_PREFIX50_STEP44_PAGE45_PANEL_PIXEL_DIGEST ||
    input.panelCropCommitment !== REAL_BUILD_PREFIX50_STEP44_PAGE45_PANEL_CROP_COMMITMENT ||
    input.panelFacePrefixEvidenceCommitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_FACE_PREFIX_COMMITMENT ||
    input.parentOnlyRegion.commitment !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_PARENT_REGION_COMMITMENT ||
    canonicalDigest(input.latticeFit) !==
      REAL_BUILD_PREFIX50_STEP44_PAGE45_LATTICE_FIT_COMMITMENT ||
    input.parentOnlyRegion.highlightMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(input.highlightMask) ||
    input.parentOnlyRegion.filledHighlightMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(input.filledHighlightMask) ||
    input.parentOnlyRegion.highlightedChildExclusionMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(input.highlightedChildExclusionMask) ||
    input.parentOnlyRegion.eligibleMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(input.eligibleMask) ||
    input.parentOnlyRegion.parentOnlyForegroundMaskDigest !==
      sha256RealBuildPrefix50Step44ReviewBytes(input.parentOnlyForegroundMask) ||
    input.parentOnlyRegion.highlightedChildExclusionPixelCount !== 48_781
  )
    throw new TypeError(
      "Step-44 repository page-45 full raster, panel, lattice, or independent convex-hull over/under-exclusion control drifted.",
    );
}
