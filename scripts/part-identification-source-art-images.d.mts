export const PDF_EMBEDDED_SOURCE_ART_MEASUREMENT_SCHEMA: "lego.pdf-embedded-source-art-measurement/1";

export interface EmbeddedSourceArtBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface EmbeddedSourceArtWitness {
  readonly key: string;
  readonly identity: string;
  readonly pageNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly expectedOperatorIndex: number;
  readonly componentBoundsPxAtScale8: EmbeddedSourceArtBounds;
}

export interface MeasuredEmbeddedSourceArtWitness {
  readonly componentBoundsPxAtScale8: EmbeddedSourceArtBounds;
  readonly decodedBytes: number;
  readonly decodedPixelSha256: `sha256:${string}`;
  readonly embeddedSourceArtSha256: `sha256:${string}`;
  readonly height: number;
  readonly identity: string;
  readonly key: string;
  readonly kind: 2;
  readonly label: string;
  readonly labelTransformPt: readonly [number, number];
  readonly operatorIndex: number;
  readonly pageNumber: number;
  readonly projectedBoundsPxAtScale8: EmbeddedSourceArtBounds;
  readonly transform: readonly [number, number, number, number, number, number];
  readonly width: number;
}

export function measurePdfSourceArtImages(input: {
  readonly pdfBytes: Uint8Array;
  readonly expectedPdfSha256: `sha256:${string}`;
  readonly witnesses: readonly EmbeddedSourceArtWitness[];
}): Promise<{
  readonly admissionAuthority: "none";
  readonly claim: "embedded-source-art-only";
  readonly observedPdfSha256: `sha256:${string}`;
  readonly pageNumberConvention: "pdf-one-based";
  readonly pdfjsVersion: "5.4.149";
  readonly schemaVersion: "lego.pdf-embedded-source-art-measurement/1";
  readonly semanticIdentityClaimed: false;
  readonly witnesses: readonly MeasuredEmbeddedSourceArtWitness[];
}>;
