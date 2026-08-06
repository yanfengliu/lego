import type { PanelBounds } from "../src/instructions/step-panels";

export type EvidenceKind = "part-art" | "subassembly-repeat" | "assembly-action";
export type BoxMethod = "vector-smallest" | "panel-neighbor-cell";
export type CropStrategy =
  "legacy-seed" | "adaptive-seed" | "ranked-component" | "semantic-action-region";
export type RegionKind = "isolated-component" | "vector-box-full" | "panel-neighbor-action";
export type MaskKind = "all-pdf-text" | "quantity-label";

export interface QuantityLabel {
  readonly identity: string;
  readonly pageNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly heightPt: number;
}

export interface CalloutTarget extends QuantityLabel {
  readonly stepNumber: number;
  readonly box: PanelBounds;
  readonly boxMethod: BoxMethod;
  readonly evidenceKind: EvidenceKind;
  readonly regionKind: RegionKind;
}

export interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface PixelClearance {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface BrowserCrop {
  readonly url: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly strategy: CropStrategy;
  readonly evidenceKind: EvidenceKind;
  readonly regionKind: RegionKind;
  readonly masksApplied: readonly MaskKind[];
  readonly contamination: readonly string[];
  readonly foregroundPixels: number;
  readonly sourceTextGlyphPixels: number;
  readonly sourceQuantityGlyphPixels: number;
  readonly textGlyphOverlapPixels: number;
  readonly quantityGlyphOverlapPixels: number;
  readonly quantityGlyphPixelsMasked: number;
  readonly cropRectPx: PixelBounds;
  readonly boundaryClearancePx: PixelClearance;
}

export interface BrowserResult {
  readonly identity: string;
  readonly targetEvidenceKind: EvidenceKind;
  readonly legacy: BrowserCrop | null;
  readonly adaptive: BrowserCrop | null;
  readonly ranked: BrowserCrop | null;
  readonly action: BrowserCrop | null;
}

export interface RetainedFailure extends QuantityLabel {
  readonly stage: "box" | "panel" | "crop";
  readonly code: string;
  readonly message: string;
}

export interface RecoveryFixtureCase {
  readonly identity: string;
  readonly evidenceKind: EvidenceKind;
  readonly regionKind: RegionKind;
  readonly requiredMasks: readonly MaskKind[];
  readonly minimumWidthPx: number;
  readonly minimumHeightPx: number;
  readonly minimumForegroundPixels: number;
  readonly minimumBoundaryClearancePx: number;
}

export interface StrategyScore {
  readonly strategy: "adaptive-seed" | "ranked-component" | "evidence-aware";
  readonly valid: number;
  readonly recovered: number;
  readonly kindCorrect: number;
  readonly regionCorrect: number;
  readonly masksCorrect: number;
  readonly uncontaminated: number;
  readonly invalidIdentities: readonly string[];
  readonly points: number;
}

export interface RecoveryBenchmark {
  readonly schemaVersion: "lego.callout-recovery-benchmark-result/1";
  readonly fixtureSourceHash: string;
  readonly fixedFailureClassSize: number;
  readonly observedLegacyFailureIdentities: readonly string[];
  readonly scores: readonly StrategyScore[];
  readonly selected: "evidence-aware";
  readonly winner: "adaptive-seed" | "ranked-component" | "evidence-aware";
  readonly winningMargin: number;
}

export interface PublishedCallout {
  readonly identity: string;
  readonly fileName: string;
  readonly pageNumber: number;
  readonly stepNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  /** The printed type size of the Nx label, which is what separates a parts-bin quantity from a multiplier. */
  readonly heightPt: number;
  readonly boxMethod: BoxMethod;
  readonly box: PanelBounds;
  readonly evidenceKind: EvidenceKind;
  readonly regionKind: RegionKind;
  readonly cropStrategy: CropStrategy;
  readonly masksApplied: readonly MaskKind[];
  readonly contamination: readonly string[];
  readonly sha256: string;
  readonly byteLength: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly foregroundPixels: number;
  readonly sourceTextGlyphPixels: number;
  readonly sourceQuantityGlyphPixels: number;
  readonly textGlyphOverlapPixels: number;
  readonly quantityGlyphOverlapPixels: number;
  readonly quantityGlyphPixelsMasked: number;
  readonly cropRectPx: PixelBounds;
  readonly boundaryClearancePx: PixelClearance;
}

export interface CalloutManifest {
  readonly schemaVersion: "lego.callout-thumbnails/5";
  readonly sourceHash: string;
  readonly pageSelection: "full booklet" | readonly number[];
  readonly pagesCropped: number;
  readonly calloutCount: number;
  readonly accounting: {
    readonly rawNxIdentityCount: number;
    readonly rawNxQuantityTotal: number;
    readonly physicalPartArtIdentityCount: number;
    readonly physicalPartArtQuantityTotal: number;
    readonly semanticIdentityCount: number;
    readonly semanticQuantityTotal: number;
  };
  readonly recoveryBenchmark: RecoveryBenchmark;
  readonly conservation: Record<string, number | string>;
  readonly failures: readonly RetainedFailure[];
  readonly callouts: readonly (Omit<PublishedCallout, "fileName"> & { readonly file: string })[];
}
