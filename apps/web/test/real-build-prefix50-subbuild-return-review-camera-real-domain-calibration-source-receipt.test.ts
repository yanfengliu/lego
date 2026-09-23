import { describe, expect, it } from "vitest";

import { rerenderRealBuildPrefix50Step44CalibrationSourceCrops } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts";
import { deriveRealBuildPrefix50Step44CalibrationSourceReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-source-receipt.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";

describe("crop-only Step-41/42 calibration source receipt", () => {
  it("regenerates every source-spec mask, feature, and lattice commitment without Step 43", async () => {
    const rasters = await rerenderRealBuildPrefix50Step44CalibrationSourceCrops({
      repositoryRoot: process.cwd(),
    });
    const receipt = deriveRealBuildPrefix50Step44CalibrationSourceReceipt([
      {
        panelStep: 41,
        crop: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[0]!.crop,
        rgba: rasters[0].rgba,
      },
      {
        panelStep: 42,
        crop: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[1]!.crop,
        rgba: rasters[1].rgba,
      },
    ]);
    expect(receipt.panelSteps).toEqual([41, 42]);
    for (const [index, actual] of receipt.cases.entries()) {
      const { splitRole: _splitRole, ...expected } =
        REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[index]!;
      void _splitRole;
      expect(actual).toEqual(expected);
    }
    expect(receipt.sharedOrientationAnchor).toEqual({
      status: "refused",
      failure: expect.stringContaining("0 peak pairs were tried"),
      failureCommitment:
        REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sharedOrientationAnchor
          .failureCommitment,
      refusalTelemetry: {
        schemaVersion: "lego.real-build-prefix50-page44-orientation-anchor-refusal/1",
        pooledQualified: false,
        pooledFailure: expect.stringContaining("0 peak pairs were tried"),
        ...REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sharedOrientationAnchor
          .refusalTelemetrySummary,
      },
      refusalTelemetryCommitment:
        REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sharedOrientationAnchor
          .refusalTelemetryCommitment,
      anchorCommitment: null,
      latticeFitCommitment: null,
    });
    expect(receipt.commitment).toBe(
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.sharedOrientationAnchor
        .calibrationSourceReceiptCommitment,
    );
  }, 120_000);
});
