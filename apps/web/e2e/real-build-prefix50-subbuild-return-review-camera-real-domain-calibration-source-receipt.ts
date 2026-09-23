import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { deriveRealBuildPrefix50Step44InteriorFeatureSource } from "./real-build-prefix50-subbuild-return-review-camera-interior.ts";
import {
  deriveRealBuildPrefix50Step44RealDomainLatticeDiagnostic,
  deriveRealBuildPrefix50Step44SharedOrientationAnchor,
  realBuildPrefix50Step44LatticeInputRgba,
  SharedOrientationAnchorRefusal,
  type SharedOrientationAnchorRefusalTelemetry,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-lattice.ts";
import { deriveRealBuildPrefix50Step44RealDomainSourceCropPixels } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source-crop-pixels.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

const WIDTH = 720;
const HEIGHT = 470;

export interface RealBuildPrefix50Step44CalibrationSourceReceiptInput {
  readonly panelStep: 41 | 42;
  readonly crop: Readonly<{ x: number; y: number; width: 720; height: 470 }>;
  readonly rgba: Uint8Array;
}

export function deriveRealBuildPrefix50Step44CalibrationSourceReceipt(
  inputs: readonly [
    RealBuildPrefix50Step44CalibrationSourceReceiptInput,
    RealBuildPrefix50Step44CalibrationSourceReceiptInput,
  ],
) {
  if (inputs[0].panelStep !== 41 || inputs[1].panelStep !== 42)
    throw new TypeError("Calibration source receipt requires exact ordered Steps 41 and 42.");
  const measurements = inputs.map((input) => {
    const pixels = deriveRealBuildPrefix50Step44RealDomainSourceCropPixels(input.rgba);
    const interior = deriveRealBuildPrefix50Step44InteriorFeatureSource({
      width: WIDTH,
      height: HEIGHT,
      sourceRgba: pixels.rgba,
      eligibleMask: pixels.eligibleMask,
    });
    const latticeInput = realBuildPrefix50Step44LatticeInputRgba(pixels.rgba, pixels.eligibleMask);
    const lattice = deriveRealBuildPrefix50Step44RealDomainLatticeDiagnostic(latticeInput);
    const latticeFitCommitment = canonicalDigest(lattice.latticeFit);
    const latticeCounterevidenceBody = {
      latticeFitCommitment,
      qualified: lattice.qualified,
      failure: lattice.failure,
      residualFraction: lattice.latticeFit.residualFraction,
      supportArtPixels: lattice.latticeFit.control.artPixels,
      supportSites: lattice.latticeFit.residuals.sites,
    };
    return {
      receipt: {
        panelStep: input.panelStep,
        crop: {
          ...input.crop,
          pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(
            encodeCanonicalRealBuildPrefix50Step44ReviewPng({
              width: WIDTH,
              height: HEIGHT,
              rgba: pixels.rgba,
            }),
          ),
          pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(pixels.rgba),
        },
        yellowComponents: pixels.yellowComponents,
        exclusions: pixels.exclusions,
        eligiblePixelCount: pixels.accounting.eligiblePixelCount,
        eligibleMaskDigest: pixels.accounting.eligibleMaskDigest,
        parentOnlyForegroundPixelCount: pixels.accounting.parentOnlyForegroundPixelCount,
        parentOnlyForegroundMaskDigest: pixels.accounting.parentOnlyForegroundMaskDigest,
        interiorFeatureSourceCommitment: interior.evidence.commitment,
        sourceFeaturePixelCount: interior.evidence.sourceFeaturePixelCount,
        sourceHogUsedCellCount: interior.evidence.sourceHogUsedCellCount,
        perPanelLatticeFitCommitment: latticeFitCommitment,
        perPanelLatticeCounterevidenceCommitment: canonicalDigest(latticeCounterevidenceBody),
        perPanelLatticeResidualFraction: lattice.latticeFit.residualFraction,
        perPanelLatticeSupportArtPixels: lattice.latticeFit.control.artPixels,
        perPanelLatticeSupportSites: lattice.latticeFit.residuals.sites,
      },
      latticeInput,
    };
  });
  let sharedOrientationAnchor: ReturnType<
    typeof deriveRealBuildPrefix50Step44SharedOrientationAnchor
  > | null = null;
  let sharedOrientationAnchorFailure: string | null = null;
  let sharedOrientationAnchorRefusalTelemetry: SharedOrientationAnchorRefusalTelemetry | null =
    null;
  try {
    sharedOrientationAnchor = deriveRealBuildPrefix50Step44SharedOrientationAnchor([
      measurements[0]!.latticeInput,
      measurements[1]!.latticeInput,
    ] as readonly [
      ReturnType<typeof realBuildPrefix50Step44LatticeInputRgba>,
      ReturnType<typeof realBuildPrefix50Step44LatticeInputRgba>,
    ]);
  } catch (error) {
    sharedOrientationAnchorFailure = error instanceof Error ? error.message : String(error);
    sharedOrientationAnchorRefusalTelemetry =
      error instanceof SharedOrientationAnchorRefusal ? error.telemetry : null;
  }
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-calibration-source-receipt/1" as const,
    authority: "crop-only-production-algorithm-regeneration" as const,
    selectionAuthority: false as const,
    panelSteps: [41, 42] as const,
    cases: [measurements[0]!.receipt, measurements[1]!.receipt] as const,
    sharedOrientationAnchor:
      sharedOrientationAnchor === null
        ? {
            status: "refused" as const,
            failure: sharedOrientationAnchorFailure,
            failureCommitment:
              sharedOrientationAnchorFailure === null
                ? null
                : canonicalDigest({ failure: sharedOrientationAnchorFailure }),
            refusalTelemetry: sharedOrientationAnchorRefusalTelemetry,
            refusalTelemetryCommitment:
              sharedOrientationAnchorRefusalTelemetry === null
                ? null
                : canonicalDigest(sharedOrientationAnchorRefusalTelemetry),
            anchorCommitment: null,
            latticeFitCommitment: null,
          }
        : {
            status: "qualified" as const,
            failure: null,
            failureCommitment: null,
            refusalTelemetry: null,
            refusalTelemetryCommitment: null,
            anchorCommitment: sharedOrientationAnchor.commitment,
            latticeFitCommitment: sharedOrientationAnchor.latticeFitCommitment,
          },
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
