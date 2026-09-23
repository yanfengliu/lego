import { canonicalDigest } from "@lego-studio/brick-kernel";

import { hashRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC,
  type RealBuildPrefix50Step44RealDomainSourceCaseSpec,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import { rerenderRealBuildPrefix50Step44PdfCrop } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "./real-build-prefix50-source-pdf-pins.ts";

export async function rerenderRealBuildPrefix50Step44CalibrationSourceCrop(input: {
  readonly repositoryRoot: string;
  readonly spec: RealBuildPrefix50Step44RealDomainSourceCaseSpec;
}) {
  const sealed = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases.find(
    ({ panelStep }) => panelStep === input.spec.panelStep,
  );
  if (
    sealed === undefined ||
    (input.spec.panelStep !== 41 && input.spec.panelStep !== 42) ||
    canonicalDigest(input.spec) !== canonicalDigest(sealed)
  )
    throw new TypeError("Pre-unlock source raster admits only exact sealed Step-41/42 crops.");
  const rendered = await rerenderRealBuildPrefix50Step44PdfCrop({
    repositoryRoot: input.repositoryRoot,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    maximumSourceBytes: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
    pageNumber: 44,
    densityDpi: REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.densityDpi,
    crop: sealed.crop,
    label: `pre-unlock Step-${sealed.panelStep} calibration source`,
    authorization: { kind: "sealed-calibration", spec: sealed },
  });
  if (
    rendered.width !== sealed.crop.width ||
    rendered.height !== sealed.crop.height ||
    rendered.pixelDigest !== sealed.crop.pixelDigest
  )
    throw new TypeError(
      `Pre-unlock Step-${sealed.panelStep} crop did not reproduce its exact sealed pixels.`,
    );
  return rendered;
}

export async function rerenderRealBuildPrefix50Step44CalibrationSourceCrops(input: {
  readonly repositoryRoot: string;
}) {
  const requirePinnedPdf = (phase: "before" | "after"): void => {
    const actualDigest = hashRealBuildPrefix50Step44ReviewArtifact(
      input.repositoryRoot,
      REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
      REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
      `pre-unlock Steps-41/42 calibration source PDF ${phase} crop set`,
    );
    if (actualDigest !== REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST)
      throw new TypeError(
        `Pre-unlock calibration source PDF digest changed ${phase} crop set: ${actualDigest} != ${REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST}.`,
      );
  };
  requirePinnedPdf("before");
  const [step41, step42] = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases;
  if (step41 === undefined || step42 === undefined)
    throw new TypeError("Pre-unlock source spec must contain exact Step-41/42 calibration cases.");
  const render = (spec: RealBuildPrefix50Step44RealDomainSourceCaseSpec) =>
    rerenderRealBuildPrefix50Step44CalibrationSourceCrop({
      repositoryRoot: input.repositoryRoot,
      spec,
    });
  const crops = [await render(step41), await render(step42)] as const;
  requirePinnedPdf("after");
  return crops;
}
