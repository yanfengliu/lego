import { deepFreeze } from "@lego-studio/brick-kernel";

import { hashRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { rerenderRealBuildPrefix50Step44PdfCrop } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts";
import type { RealBuildPrefix50Step44RealDomainPrivateSourceCaseSpec } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import type { RealBuildPrefix50Step44HeldOutUnlockCapability } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";

export const REAL_BUILD_PREFIX50_STEP44_HELD_OUT_SOURCE_CASE: RealBuildPrefix50Step44RealDomainPrivateSourceCaseSpec =
  deepFreeze({
    panelStep: 43,
    splitRole: "held-out-validation",
    crop: {
      x: 1040,
      y: 620,
      width: 720,
      height: 470,
      pngDigest: "sha256:c970ccd2d2da4a4eae0435a63237ef5550dcdde236f9f0b1e07c59546af4e075",
      pixelDigest: "sha256:3199976a49fb817ddd3cb40541b4ec5545be91893c7fd0d87ef391d3a62f6901",
    },
    yellowComponents: [{ pixels: 1419, minX: 335, minY: 112, maxX: 498, maxY: 245 }],
    exclusions: [{ minX: 315, minY: 92, maxX: 518, maxY: 265 }],
    eligiblePixelCount: 302_904,
    eligibleMaskDigest: "sha256:89a1dc6cde088ae03ab4006564fc205f1b715cf441421ec92a6f5d79317261ed",
    parentOnlyForegroundPixelCount: 27_835,
    parentOnlyForegroundMaskDigest:
      "sha256:a8c272d94651911464638e987b7166fa25fb1e6ec57fa8206d797280fd36b486",
    interiorFeatureSourceCommitment:
      "sha256:787f8024de2076ecab04943e40b995974687625ad9b390c950620155156ba555",
    sourceFeaturePixelCount: 6492,
    sourceHogUsedCellCount: 17,
  });

export async function rerenderRealBuildPrefix50Step44HeldOutSourceCrop(input: {
  readonly repositoryRoot: string;
  readonly sourcePdfArtifactPath: string;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly maximumSourceBytes: number;
  readonly densityDpi: number;
  readonly capability: RealBuildPrefix50Step44HeldOutUnlockCapability;
}) {
  const requirePinnedPdf = (phase: "before" | "after"): void => {
    const actualDigest = hashRealBuildPrefix50Step44ReviewArtifact(
      input.repositoryRoot,
      input.sourcePdfArtifactPath,
      input.maximumSourceBytes,
      `post-unlock held-out source PDF ${phase} crop`,
    );
    if (actualDigest !== input.sourcePdfDigest)
      throw new TypeError(
        `Post-unlock held-out source PDF digest changed ${phase} crop: ${actualDigest} != ${input.sourcePdfDigest}.`,
      );
  };
  requirePinnedPdf("before");
  const crop = await rerenderRealBuildPrefix50Step44PdfCrop({
    repositoryRoot: input.repositoryRoot,
    sourcePdfArtifactPath: input.sourcePdfArtifactPath,
    sourcePdfDigest: input.sourcePdfDigest,
    maximumSourceBytes: input.maximumSourceBytes,
    pageNumber: 44,
    densityDpi: input.densityDpi,
    crop: REAL_BUILD_PREFIX50_STEP44_HELD_OUT_SOURCE_CASE.crop,
    label: "post-unlock Step-43 held-out source",
    authorization: { kind: "held-out-one-shot", capability: input.capability },
  });
  requirePinnedPdf("after");
  return crop;
}
