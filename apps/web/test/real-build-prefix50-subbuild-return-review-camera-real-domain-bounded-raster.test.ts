import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  hashRealBuildPrefix50Step44ReviewArtifact,
  sha256RealBuildPrefix50Step44ReviewBytes,
} from "../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { rerenderRealBuildPrefix50Step44CalibrationSourceCrops } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts";
import { deriveRealBuildPrefix50Step44CalibrationRasterCommitment } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster-commitment.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_HELD_OUT_SOURCE_CASE,
  rerenderRealBuildPrefix50Step44HeldOutSourceCrop,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-heldout-raster.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import type { RealBuildPrefix50Step44HeldOutUnlockCapability } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "../e2e/real-build-prefix50-source-pdf-pins.ts";

const REPOSITORY_ROOT = resolve(process.cwd());

function canonicalCropPngDigest(rgba: Uint8Array): `sha256:${string}` {
  return sha256RealBuildPrefix50Step44ReviewBytes(
    encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width: 720, height: 470, rgba }),
  );
}

describe("real-domain bounded source rasters", () => {
  it("reproduces only the exact sealed Step-41/42 calibration crops before unlock", async () => {
    const renderedCrops = await rerenderRealBuildPrefix50Step44CalibrationSourceCrops({
      repositoryRoot: REPOSITORY_ROOT,
    });
    for (const [
      index,
      spec,
    ] of REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.entries()) {
      const rendered = renderedCrops[index]!;
      expect([rendered.width, rendered.height]).toEqual([spec.crop.width, spec.crop.height]);
      expect(rendered.pixelDigest).toBe(spec.crop.pixelDigest);
      expect(canonicalCropPngDigest(rendered.rgba)).toBe(spec.crop.pngDigest);
    }
    const sourceLockCommitment = canonicalDigest({ fixture: "bounded-calibration-source-lock" });
    const commitment = deriveRealBuildPrefix50Step44CalibrationRasterCommitment({
      sourceLockCommitment,
      rasters: renderedCrops,
    });
    expect(commitment).toBe(
      canonicalDigest({
        schemaVersion: "lego.real-build-prefix50-step44-bounded-calibration-crop-set/1",
        kind: "bounded-calibration-crop-set",
        sourceLockCommitment,
        sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
        sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
        rendererVersion: renderedCrops[0].rendererVersion,
        densityDpi: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi,
        pageNumber: 44,
        crops: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.map((spec, index) => ({
          panelStep: spec.panelStep,
          crop: {
            x: spec.crop.x,
            y: spec.crop.y,
            width: renderedCrops[index]!.width,
            height: renderedCrops[index]!.height,
            rendererPngDigest: renderedCrops[index]!.pngDigest,
            canonicalPngDigest: spec.crop.pngDigest,
            pixelDigest: renderedCrops[index]!.pixelDigest,
          },
        })),
      }),
    );
    const changedRendererBytes = [
      { ...renderedCrops[0], pngDigest: canonicalDigest({ changed: "renderer bytes" }) },
      renderedCrops[1],
    ] as const;
    expect(
      deriveRealBuildPrefix50Step44CalibrationRasterCommitment({
        sourceLockCommitment,
        rasters: changedRendererBytes,
      }),
    ).not.toBe(commitment);
  }, 120_000);

  it("refuses the exact Step-43 crop without an opaque consumed-session capability", async () => {
    expect(
      hashRealBuildPrefix50Step44ReviewArtifact(
        REPOSITORY_ROOT,
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
        "post-unlock Step-43 regression PDF",
      ),
    ).toBe(REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST);
    const forgedCapability = Object.freeze({
      calibrationSessionCommitment: canonicalDigest({ forged: "session" }),
      sourceSequenceCommitment: canonicalDigest({ forged: "source" }),
      predecessorSequenceCommitment: canonicalDigest({ forged: "predecessor" }),
      commitment: canonicalDigest({ forged: "capability" }),
    }) as RealBuildPrefix50Step44HeldOutUnlockCapability;
    await expect(
      rerenderRealBuildPrefix50Step44HeldOutSourceCrop({
        repositoryRoot: REPOSITORY_ROOT,
        sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
        sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
        maximumSourceBytes: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
        densityDpi: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi,
        capability: forgedCapability,
      }),
    ).rejects.toThrow("requires the consumed calibration-session capability");
    expect(REAL_BUILD_PREFIX50_STEP44_HELD_OUT_SOURCE_CASE.panelStep).toBe(43);
  }, 120_000);
});
