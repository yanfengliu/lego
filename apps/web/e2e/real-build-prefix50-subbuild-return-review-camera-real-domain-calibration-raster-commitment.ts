import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "./real-build-prefix50-source-pdf-pins.ts";

interface BoundedCalibrationRaster {
  readonly rendererVersion: string;
  readonly popplerToolchainCommitment: Sha256Digest;
  readonly pngDigest: Sha256Digest;
  readonly pixelDigest: Sha256Digest;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export function deriveRealBuildPrefix50Step44CalibrationRasterCommitment(input: {
  readonly sourceLockCommitment: Sha256Digest;
  readonly rasters: readonly [BoundedCalibrationRaster, BoundedCalibrationRaster];
}): Sha256Digest {
  const rendererVersions = new Set(input.rasters.map(({ rendererVersion }) => rendererVersion));
  if (rendererVersions.size !== 1)
    throw new TypeError("Steps-41/42 bounded Poppler crops used different renderer versions.");
  if (
    input.rasters.some(
      ({ popplerToolchainCommitment }) =>
        popplerToolchainCommitment !== REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
    )
  )
    throw new TypeError("Steps-41/42 bounded crops did not use the qualified Poppler toolchain.");
  const cases = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases;
  if (cases.length !== input.rasters.length)
    throw new TypeError("Bounded calibration raster set must contain exact Steps 41 and 42.");
  const crops = cases.map((spec, index) => {
    const rendered = input.rasters[index]!;
    const canonicalPngDigest = sha256RealBuildPrefix50Step44ReviewBytes(
      encodeCanonicalRealBuildPrefix50Step44ReviewPng({
        width: rendered.width,
        height: rendered.height,
        rgba: rendered.rgba,
      }),
    );
    if (
      rendered.width !== spec.crop.width ||
      rendered.height !== spec.crop.height ||
      rendered.pixelDigest !== spec.crop.pixelDigest ||
      canonicalPngDigest !== spec.crop.pngDigest
    )
      throw new TypeError(
        `Pre-unlock Step-${spec.panelStep} crop did not reproduce its exact sealed dimensions and pixels.`,
      );
    return {
      panelStep: spec.panelStep,
      crop: {
        x: spec.crop.x,
        y: spec.crop.y,
        width: rendered.width,
        height: rendered.height,
        rendererPngDigest: rendered.pngDigest,
        canonicalPngDigest,
        pixelDigest: rendered.pixelDigest,
      },
    };
  });
  return canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-step44-bounded-calibration-crop-set/1",
    kind: "bounded-calibration-crop-set",
    sourceLockCommitment: input.sourceLockCommitment,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    rendererVersion: input.rasters[0].rendererVersion,
    popplerToolchainCommitment: input.rasters[0].popplerToolchainCommitment,
    densityDpi: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi,
    pageNumber: 44,
    crops,
  });
}
