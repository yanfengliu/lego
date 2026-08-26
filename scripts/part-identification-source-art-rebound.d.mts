export const PART_IDENTIFICATION_SOURCE_ART_REBOUND_SCHEMA: "lego.part-identification-source-art-rebound/1";

declare const verifiedSourceArtReboundBrand: unique symbol;

export interface VerifiedPartIdentificationSourceArtRebound {
  readonly [verifiedSourceArtReboundBrand]: never;
}

export interface SourceArtReboundRelationRow {
  readonly cropSha256: `sha256:${string}`;
  readonly decodedPixelSha256: `sha256:${string}`;
  readonly identity: string;
  readonly normalizedProgramSha256: `sha256:${string}` | null;
  readonly pageNumber: number;
  readonly quantity: number;
  readonly stepNumber: number;
  readonly sourceComponent: Readonly<Record<string, unknown>>;
  readonly renderProof: Readonly<Record<string, unknown>> | null;
}

export interface InspectedPartIdentificationSourceArtRebound {
  readonly artifactSha256: `sha256:${string}`;
  readonly authority: {
    readonly catalogAdmission: "absent";
    readonly completion: "absent";
    readonly placement: "absent";
    readonly semanticIdentity: "absent";
  };
  readonly authorizedThroughStep: 50;
  readonly calloutCount: 881;
  readonly classDigest: `sha256:${string}`;
  readonly counterevidence: readonly SourceArtReboundRelationRow[];
  readonly expectedPrintedSteps: 359;
  readonly fixedGeometryRows: 7;
  readonly genericContainmentAmbiguities: 18;
  readonly inputDigests: {
    readonly manifestSha256: `sha256:${string}`;
    readonly pdfSha256: `sha256:${string}`;
  };
  readonly members: readonly SourceArtReboundRelationRow[];
  readonly outcomeDigest: `sha256:${string}`;
  readonly physicalRowsScanned: 859;
  readonly reference: SourceArtReboundRelationRow;
  readonly schemaVersion: "lego.part-identification-source-art-rebound/1";
  readonly semanticRowsPreservedAsCounterevidence: 22;
}

export function compilePartIdentificationSourceArtRebound(input: {
  readonly pdfBytes: Uint8Array;
  readonly manifestBytes: Uint8Array;
}): Promise<Uint8Array>;

export function verifyPartIdentificationSourceArtReboundClosure(input: {
  readonly artifactBytes: Uint8Array;
  readonly pdfBytes: Uint8Array;
  readonly manifestBytes: Uint8Array;
}): Promise<VerifiedPartIdentificationSourceArtRebound>;

export function inspectVerifiedPartIdentificationSourceArtRebound(
  verified: VerifiedPartIdentificationSourceArtRebound,
): InspectedPartIdentificationSourceArtRebound;

export function assertVerifiedPartIdentificationSourceArtReboundClosure(
  verified: VerifiedPartIdentificationSourceArtRebound,
  input: {
    readonly artifactBytes: Uint8Array;
    readonly pdfBytes: Uint8Array;
    readonly manifestBytes: Uint8Array;
  },
): InspectedPartIdentificationSourceArtRebound;
