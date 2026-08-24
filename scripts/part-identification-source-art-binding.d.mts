import type {
  EmbeddedSourceArtBounds,
  MeasuredEmbeddedSourceArtWitness,
} from "./part-identification-source-art-images.mjs";

export const CALLOUT_SOURCE_ART_BINDING_SCHEMA: "lego.callout-source-art-binding/1";

export interface SourceArtBindingComponent {
  readonly rasterScale: 8;
  readonly boundsPx: EmbeddedSourceArtBounds;
  readonly foregroundPixels: number;
  readonly rawComponentCount: number;
  readonly absoluteForegroundSha256: `sha256:${string}`;
}

export interface SourceArtBindingRow {
  readonly key: string;
  readonly identity: string;
  readonly pageNumber: number;
  readonly stepNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly heightPt: number;
  readonly expectedOperatorIndex: number;
  readonly expectedCropSha256: `sha256:${string}`;
  readonly sourceComponent: SourceArtBindingComponent;
}

interface BoundInputComponent {
  readonly rasterScale: number;
  readonly boundsPx: EmbeddedSourceArtBounds;
  readonly foregroundPixels: number;
  readonly rawComponentCount: number;
  readonly absoluteForegroundSha256: string;
}

interface BoundCalloutCrop {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly strategy: string;
  readonly evidenceKind: string;
  readonly regionKind: string;
  readonly foregroundPixels: number;
  readonly sourceComponent: BoundInputComponent | null;
}

interface BoundManifestCallout {
  readonly identity: string;
  readonly pageNumber: number;
  readonly stepNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly heightPt: number;
  readonly cropStrategy: string;
  readonly evidenceKind: string;
  readonly regionKind: string;
  readonly sha256: `sha256:${string}`;
  readonly foregroundPixels: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly sourceComponent: BoundInputComponent | null;
}

export function bindCalloutSourceArtMeasurement(input: {
  readonly rows: readonly SourceArtBindingRow[];
  readonly measurement: {
    readonly admissionAuthority: "none";
    readonly claim: "embedded-source-art-only";
    readonly observedPdfSha256: `sha256:${string}`;
    readonly pageNumberConvention: "pdf-one-based";
    readonly pdfjsVersion: string;
    readonly schemaVersion: "lego.pdf-embedded-source-art-measurement/1";
    readonly semanticIdentityClaimed: false;
    readonly witnesses: readonly MeasuredEmbeddedSourceArtWitness[];
  };
  readonly manifestCallouts: readonly BoundManifestCallout[];
  readonly renderedCrops: readonly {
    readonly identity: string;
    readonly sha256: `sha256:${string}`;
    readonly crop: BoundCalloutCrop;
  }[];
}): {
  readonly admissionAuthority: "none";
  readonly coverageTrustGranted: false;
  readonly rows: readonly {
    readonly cropSha256: `sha256:${string}`;
    readonly decodedPixelSha256: `sha256:${string}`;
    readonly embeddedSourceArtSha256: `sha256:${string}`;
    readonly heightPx: number;
    readonly identity: string;
    readonly key: string;
    readonly operatorIndex: number;
    readonly pageNumber: number;
    readonly quantity: number;
    readonly sourceComponent: SourceArtBindingComponent;
    readonly stepNumber: number;
    readonly widthPx: number;
  }[];
  readonly schemaVersion: "lego.callout-source-art-binding/1";
  readonly semanticIdentityClaimed: false;
};
