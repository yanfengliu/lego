export const REAL_BUILD_SOURCE_PARITY_CLASSES = [
  "assembly",
  "own-panel-source",
  "own-panel-exclusion",
  "built",
  "exclusion",
] as const;
export type RealBuildSourceParityClass = (typeof REAL_BUILD_SOURCE_PARITY_CLASSES)[number];

export const REAL_BUILD_SOURCE_PARITY_CALIBRATION_STEPS = [90, 101, 346, 358, 359] as const;

export interface RealBuildSourceParityBounds {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface RealBuildSourceParityProbePanel extends RealBuildSourceParityBounds {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly calloutBoxes: readonly RealBuildSourceParityBounds[];
  readonly panelEvidenceDigest: string;
}

export interface RealBuildSourceParityMismatchBounds {
  readonly minXPx: number;
  readonly minYPx: number;
  readonly maxXPxExclusive: number;
  readonly maxYPxExclusive: number;
}

export interface RealBuildSourceParityMaskComparison {
  readonly sourceClass: RealBuildSourceParityClass;
  readonly productionArea: number;
  readonly candidateArea: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly mismatchPixels: number;
  readonly iou: number;
  readonly productionMaskDigest: string;
  readonly candidateMaskDigest: string;
  readonly xorMaskDigest: string;
  readonly mismatchBounds: RealBuildSourceParityMismatchBounds | null;
  readonly diagnosticCaptureDigest: string | null;
  readonly xorEvidencePackedDigest: string | null;
  readonly productionEvidencePackedDigest: string;
}

export interface RealBuildSourceParityAggregate {
  readonly sourceClass: RealBuildSourceParityClass;
  readonly panels: number;
  readonly panelsDiffering: number;
  readonly totalPixels: number;
  readonly productionArea: number;
  readonly candidateArea: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly mismatchPixels: number;
  readonly iou: number;
  readonly meanIou: number;
  readonly minimumIou: number;
}

export interface RealBuildSourceParityCapture {
  readonly digest: string;
  readonly width: number;
  readonly height: number;
  readonly png: string;
}

export interface RealBuildSourceParityPackedEvidence {
  readonly packedDigest: string;
  readonly pixelCount: number;
  readonly byteLength: number;
  readonly lowPaddingBits: number;
  readonly base64: string;
}

export interface RealBuildSourceParityBrowserResult {
  readonly pdfDigest: string;
  readonly pdfBytes: number;
  readonly preparedPanelsDigest: string;
  readonly steps: readonly (RealBuildSourceParityProbePanel & {
    readonly width: number;
    readonly height: number;
    readonly workRgbaBrowserCommitmentDigest: string;
    readonly candidatePolicyBrowserCommitmentDigest: string;
    readonly candidateDerivationBrowserCommitmentDigest: string;
    readonly comparisons: readonly RealBuildSourceParityMaskComparison[];
  })[];
  readonly aggregate: readonly RealBuildSourceParityAggregate[];
  readonly captures: readonly RealBuildSourceParityCapture[];
  readonly packedEvidence: readonly RealBuildSourceParityPackedEvidence[];
}

export interface RealBuildSourceParitySourceSnapshot {
  readonly state: "authenticated-bootstrap-and-execution-mirror-locks-held-before-and-after-measurement";
  readonly bootstrapManifestDigest: string;
  readonly bootstrapManifestEvidenceDigest: string;
  readonly sourceRootsPolicyDigest: string;
  readonly bootstrapLockManifestDigest: string;
  readonly bootstrapLockedFiles: number;
  readonly bootstrapLockedBytes: number;
  readonly bootstrapLockCoversInstructionPdf: false;
  readonly executionMirrorManifestDigest: string;
  readonly executionMirrorFiles: number;
  readonly executionMirrorBytes: number;
  readonly executionMirrorCoversInstructionPdf: true;
  readonly servedResponseManifestDigest: string;
  readonly servedResponseFiles: number;
  readonly servedResponseBytes: number;
  readonly servedSourceBundleManifestDigest: string;
  readonly servedSourceBundleDigest: string;
  readonly servedSourceFiles: number;
  readonly servedSourceUniqueBytes: number;
  readonly browserResultDigest: string;
  readonly browserResultBytes: number;
  readonly preparedPanelsDigest: string;
  readonly environmentDigest: string;
}

export interface RealBuildSourceParityProvenanceRole {
  readonly role: string;
  readonly digest: string;
  readonly bytes: Uint8Array;
}

export interface RealBuildSourceParityProbeResult extends RealBuildSourceParityBrowserResult {
  readonly sourceSnapshot: RealBuildSourceParitySourceSnapshot;
}

export const REAL_BUILD_SOURCE_PARITY_BROWSER_ASSERTED_DERIVATION_STAGES = Object.freeze({
  evidencePurpose: "calibration-only-no-source-truth-authority/1",
  productionAssembly: "full-resolution-key-furniture-callout-clear-isolate-then-downsample/1",
  productionHighlight: "work-rgba-highlight-extraction/1",
  productionBuilt: "work-isolation-minus-dilated-highlight-and-highlight-fill/1",
  productionExclusion: "work-highlight-fill-or-undilated-stroke/1",
  candidateAssembly: "work-rgba-key-furniture-callout-clear-isolate/1",
  candidateHighlight: "work-rgba-highlight-extraction/1",
  candidateBuilt: "work-isolation-minus-dilated-highlight-and-highlight-fill/1",
  candidateExclusion: "work-highlight-fill-or-undilated-stroke/1",
});
