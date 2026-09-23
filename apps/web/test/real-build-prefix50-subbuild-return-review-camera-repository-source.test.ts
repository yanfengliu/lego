import { existsSync } from "node:fs";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock(
  "../e2e/real-build-prefix50-step44-later-source-authority.ts",
  () => import("./real-build-prefix50-step44-later-source-authority-test-seam.ts"),
);

import { renderRealBuildPrefix50Step44CameraMask } from "../e2e/real-build-prefix50-subbuild-return-review-camera-mask-render.ts";
import { deriveRealBuildPrefix50Step44InteriorFeatureSource } from "../e2e/real-build-prefix50-subbuild-return-review-camera-interior.ts";
import {
  loadRealBuildPrefix50Step44RepositoryPage45CameraSource,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-source.ts";
import {
  commitRealBuildPrefix50Step44PanelCrop,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_X,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_Y,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_WIDTH,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-source-commitments.ts";
import {
  verifyRealBuildPrefix50Step44PersistedCameraSourceBinding,
  verifyRealBuildPrefix50Step44PersistedParentOnlyRegion,
} from "../e2e/real-build-prefix50-subbuild-return-review-contact-sheet-camera.ts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest } from "./real-build-prefix50-step44-later-source-authority-test-seam.ts";
import { pinCurrentToolchainPopplerForStep44Test } from "./real-build-prefix50-subbuild-return-review-poppler-test-support.ts";

let restorePopplerEnvironment = (): void => undefined;

beforeAll(() => {
  restorePopplerEnvironment = pinCurrentToolchainPopplerForStep44Test();
});

afterAll(() => {
  restorePopplerEnvironment();
});

function repositorySourceCapabilities() {
  const common = {
    repositoryRoot: process.cwd(),
    sourcePdfArtifactPath: "recipes/6651557.pdf",
    sourcePdfDigest:
      "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
    maximumSourceBytes: 80 * 1024 * 1024,
    physicalPageNumber: 45 as const,
  };
  return {
    panelFaceCapability: issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
      ...common,
      purpose: "page45-step44-vector",
    }),
    rasterCapability: issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
      ...common,
      purpose: "page45-camera-raster",
    }),
  };
}

describe.runIf(existsSync("recipes/6651557.pdf"))(
  "prefix-50 Step-44 exact repository page-45 camera source",
  () => {
    it("pins the PDF, face-prefix authority, and measured highlight before minting its runtime source brand", async () => {
      const source = await loadRealBuildPrefix50Step44RepositoryPage45CameraSource(
        repositorySourceCapabilities(),
      );
      expect(source.sourcePdfDigest).toBe(
        "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
      );
      expect(source.parentOnlyRegion).toMatchObject({
        schemaVersion: "lego.real-build-prefix50-step44-parent-only-region/2",
        strategy:
          "yellow-highlight-convex-hull-plus-one-pixel-chebyshev-dilation-and-pre-highlight-annotation-band",
        componentSelection: {
          connectivity: 8,
          strategy: "unique-spanning-component-plus-contained-thin-fragments",
          minimumFragmentPixels: 16,
          maximumFragmentThicknessPx: 8,
          maximumFragmentToPrimaryPixelRatioDenominator: 16,
        },
        fillStrategy: "integer-pixel-center-convex-hull-inclusive",
        childExclusionDilation: { metric: "chebyshev", radiusPx: 1 },
        thresholdHighlightPixelCount: 2_233,
        highlightComponentCount: 3,
        selectedHighlightComponentCount: 3,
        ignoredHighlightPixelCount: 0,
        primaryHighlightComponentPixelCount: 2_076,
        primaryHighlightComponentMaskDigest:
          "sha256:b94b30934f3f435669a881d349ed09c9aa533852d9a613f9c3f7dc22dfbcf0bf",
        highlightPixelCount: 2_233,
        highlightBounds: { minXPx: 120, minYPx: 132, maxXPx: 567, maxYPx: 353 },
        filledHighlightPixelCount: 47_437,
        highlightedChildExclusionPixelCount: 48_781,
        highlightedChildExclusionBounds: {
          minXPx: 119,
          minYPx: 131,
          maxXPx: 568,
          maxYPx: 354,
        },
        eligiblePixelCount: 194_586,
        parentOnlyForegroundPixelCount: 114_151,
        highlightMaskDigest:
          "sha256:6f9129de40b02310534aa62b48d0b35e1a2a98d9ebe7e5e6a92828b613bbb9b5",
        filledHighlightMaskDigest:
          "sha256:c6beb95f9e706cf361df2c2b8920b7980f406fe86dd329574cd7e100aa15b860",
        highlightedChildExclusionMaskDigest:
          "sha256:2dc180846346b3131bb127629d5900d0549cd187bbcc010265e6c896f888edbe",
        eligibleMaskDigest:
          "sha256:32411548c15722900677001439ac8d7a28e3a979517ec3363e1aa26e2c4cda60",
        parentOnlyForegroundMaskDigest:
          "sha256:1cf0f286631b2f9f8731adef7c3274e4437a0a3bf50363588dde1ad1d8228792",
      });
      let rescuedPixels = 0;
      for (let y = 112; y <= 373; y += 1)
        for (let x = 100; x <= 587; x += 1)
          rescuedPixels +=
            source.parentOnlyForegroundMask[y * REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH + x]!;
      expect(rescuedPixels).toBe(32_810);
      const interior = deriveRealBuildPrefix50Step44InteriorFeatureSource({
        width: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
        height: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
        sourceRgba: source.rgba,
        eligibleMask: source.eligibleMask,
      });
      expect(interior.evidence).toMatchObject({
        eligiblePixelCount: 194_586,
        supportPixelCount: 106_499,
        sourceFeaturePixelCount: 4_952,
        supportMaskDigest:
          "sha256:17187c3c1b8bb1d934faaa274a3a6f4cd4221c194025a73729eb8067bff8f000",
        sourceBlueCyanFeatureMaskDigest:
          "sha256:080fef3afa5c5c2719d5748b1771cc62413968251f0dd9970ab40e5ac6afe905",
      });
      expect(source.latticeFit.coherence).toBeGreaterThanOrEqual(
        source.latticeFit.thresholds.minimumCoherence,
      );
      expect(source.panelFacePrefixEvidence).toMatchObject({
        authority: "repository-pdf-vector",
        coveredPageCeiling: 45,
        expectedPanelFace: "studs-up",
        rows: { length: 44 },
      });
      expect(source.panelFacePrefixEvidenceCommitment).toBe(
        source.panelFacePrefixEvidence.commitment,
      );
      expect(source.expectedPanelFace).toBe("studs-up");
      expect(source.sourcePageRasterCommitment).toBe(
        canonicalDigest({
          schemaVersion: "lego.real-build-prefix50-step44-camera-source-page-raster/1",
          renderer: "poppler-pdftoppm",
          rendererVersion: source.rendererVersion,
          densityDpi: 180,
          pageNumber: 45,
          width: REAL_BUILD_PREFIX50_STEP44_PAGE45_WIDTH,
          height: REAL_BUILD_PREFIX50_STEP44_PAGE45_HEIGHT,
          pngDigest: source.sourcePagePngDigest,
          pixelDigest: source.sourcePagePixelDigest,
          panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
          expectedPanelFace: source.expectedPanelFace,
        }),
      );
      expect(source.panelCropCommitment).toBe(
        canonicalDigest({
          schemaVersion: "lego.real-build-prefix50-step44-camera-source-panel-crop/1",
          sourcePageRasterCommitment: source.sourcePageRasterCommitment,
          x: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_X,
          y: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_Y,
          width: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_WIDTH,
          height: REAL_BUILD_PREFIX50_STEP44_PAGE45_CROP_HEIGHT,
          pixelDigest: source.panelPixelDigest,
          parentOnlyRegionCommitment: source.parentOnlyRegion.commitment,
          panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
          expectedPanelFace: source.expectedPanelFace,
        }),
      );
      const persistedBinding = {
        sourceKind: "repository-runtime" as const,
        sourcePdfArtifactPath: source.sourcePdfArtifactPath,
        sourcePdfDigest: source.sourcePdfDigest,
        rendererVersion: source.rendererVersion,
        sourcePagePngDigest: source.sourcePagePngDigest,
        sourcePagePixelDigest: source.sourcePagePixelDigest,
        sourcePageRasterCommitment: source.sourcePageRasterCommitment,
        panelPixelDigest: source.panelPixelDigest,
        panelCropCommitment: source.panelCropCommitment,
        parentOnlyRegion: source.parentOnlyRegion,
        panelFacePrefixEvidence: source.panelFacePrefixEvidence,
        panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
        expectedPanelFace: source.expectedPanelFace,
      };
      expect(() =>
        verifyRealBuildPrefix50Step44PersistedCameraSourceBinding(persistedBinding),
      ).not.toThrow();
      const eligibleMaskRgba = renderRealBuildPrefix50Step44CameraMask(
        source.eligibleMask,
        "eligible-parent-region",
      );
      const parentOnlyMaskRgba = renderRealBuildPrefix50Step44CameraMask(
        source.parentOnlyForegroundMask,
        "parent-only-target",
      );
      expect(() =>
        verifyRealBuildPrefix50Step44PersistedParentOnlyRegion({
          parentOnlyRegion: source.parentOnlyRegion,
          page45CropRgba: source.rgba,
          eligibleParentRegionMaskRgba: eligibleMaskRgba,
          parentOnlyTargetMaskRgba: parentOnlyMaskRgba,
        }),
      ).not.toThrow();
      const substitutedPageCommitment = canonicalDigest({
        substitutedSourcePage: source.sourcePageRasterCommitment,
      });
      const coordinatedBody = {
        ...persistedBinding,
        sourcePageRasterCommitment: substitutedPageCommitment,
        panelCropCommitment: commitRealBuildPrefix50Step44PanelCrop({
          sourcePageRasterCommitment: substitutedPageCommitment,
          panelPixelDigest: source.panelPixelDigest,
          parentOnlyRegionCommitment: source.parentOnlyRegion.commitment,
          panelFacePrefixEvidenceCommitment: source.panelFacePrefixEvidenceCommitment,
          expectedPanelFace: source.expectedPanelFace,
        }),
      };
      expect(() =>
        verifyRealBuildPrefix50Step44PersistedCameraSourceBinding(coordinatedBody),
      ).toThrow(/did not reproduce its exact PDF face, page-raster, and panel-crop/u);
      const { commitment: regionCommitment, ...regionBody } = source.parentOnlyRegion;
      expect(regionCommitment).toBe(canonicalDigest(regionBody));
      const substitutedRegionBody = {
        ...regionBody,
        eligiblePixelCount: regionBody.eligiblePixelCount - 1,
      };
      const substitutedRegion = {
        ...substitutedRegionBody,
        commitment: canonicalDigest(substitutedRegionBody),
      };
      const nestedCloneBody = {
        ...persistedBinding,
        parentOnlyRegion: substitutedRegion,
        panelCropCommitment: commitRealBuildPrefix50Step44PanelCrop({
          sourcePageRasterCommitment: persistedBinding.sourcePageRasterCommitment,
          panelPixelDigest: persistedBinding.panelPixelDigest,
          parentOnlyRegionCommitment: substitutedRegion.commitment,
          panelFacePrefixEvidenceCommitment: persistedBinding.panelFacePrefixEvidenceCommitment,
          expectedPanelFace: persistedBinding.expectedPanelFace,
        }),
        measurementCommitment: canonicalDigest({
          parentOnlyRegionCommitment: substitutedRegion.commitment,
          panelFacePrefixEvidenceCommitment: persistedBinding.panelFacePrefixEvidenceCommitment,
          expectedPanelFace: persistedBinding.expectedPanelFace,
        }),
      };
      const nestedClone = {
        ...nestedCloneBody,
        commitment: canonicalDigest(nestedCloneBody),
      };
      expect(() =>
        verifyRealBuildPrefix50Step44PersistedCameraSourceBinding(nestedClone),
      ).not.toThrow();
      expect(() =>
        verifyRealBuildPrefix50Step44PersistedParentOnlyRegion({
          parentOnlyRegion: nestedClone.parentOnlyRegion,
          page45CropRgba: source.rgba,
          eligibleParentRegionMaskRgba: eligibleMaskRgba,
          parentOnlyTargetMaskRgba: parentOnlyMaskRgba,
        }),
      ).toThrow(/must rederive from the exact page-45 crop pixels/u);
      expect(REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX).toBe(0x899093);
    }, 120_000);
  },
);
