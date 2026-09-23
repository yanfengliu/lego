import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50Step44ReviewFixtureKey,
  RealBuildPrefix50Step44ReviewedRenderView,
} from "./real-build-prefix50-subbuild-return-review-views";

interface RealBuildPrefix50Step44ReturnReviewSource {
  readonly logicalPath: "recipes/6651557.pdf";
  readonly digest: `sha256:${string}`;
  readonly pageNumber: 45;
  readonly structuralEventSequence: 8;
  readonly structuralEventDigest: `sha256:${string}`;
  readonly precedingPhaseSequence: 71;
  readonly followingPhaseSequence: 72;
  readonly firstChildOccurrenceOrdinal: 258;
  readonly lastChildOccurrenceOrdinal: 280;
}

interface RealBuildPrefix50Step44UnreviewedReturnFixture {
  readonly schemaVersion: "lego.real-build-prefix50-step44-return-review-fixture/1";
  readonly reviewStatus: "unreviewed";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly source: RealBuildPrefix50Step44ReturnReviewSource;
  readonly missingEvidence: readonly [
    "exact-return-envelope-and-receipt-commitments",
    "exact-selected-candidate-and-document-hash",
    "verified-pdf-page-raster-and-panel-crop-bytes",
    "reviewed-seven-canonical-render-commitments",
  ];
  readonly reason: string;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ReviewedSourcePageRaster {
  readonly artifactPath: string;
  readonly sourcePdfDigest: `sha256:${string}`;
  readonly pageNumber: 45;
  readonly renderer: "poppler-pdftoppm";
  readonly rendererVersion: string;
  readonly densityDpi: number;
  readonly width: number;
  readonly height: number;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ReviewedPanelCrop {
  readonly artifactPath: string;
  readonly renderer: "poppler-pdftoppm";
  readonly rendererVersion: string;
  readonly densityDpi: number;
  readonly sourcePageRasterCommitment: `sha256:${string}`;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ReviewedRender {
  readonly view: RealBuildPrefix50Step44ReviewedRenderView;
  readonly canonicalViewName:
    "isometric" | "front" | "back" | "left" | "right" | "top" | "underside";
  readonly artifactPath: string;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly outcome: "same" | "different" | "not-observable";
  readonly reviewNote: string;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ReviewedCaptureManifest {
  readonly artifactPath: string;
  readonly byteDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
  readonly viewPacketCommitment: `sha256:${string}`;
  readonly renderPacketCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44ReviewedReturnFixture {
  readonly schemaVersion: "lego.real-build-prefix50-step44-return-review-fixture/1";
  readonly reviewStatus: "reviewed";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly source: RealBuildPrefix50Step44ReturnReviewSource;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly projectionCommitment: `sha256:${string}`;
  readonly childSubBuildWindowCommitment: `sha256:${string}`;
  readonly sourceMemberRowsCommitment: `sha256:${string}`;
  readonly detachedStateCommitment: `sha256:${string}`;
  readonly step42_43RepairCommitment: `sha256:${string}`;
  readonly step43PredecessorCommitment: `sha256:${string}`;
  readonly sourceDocumentHash: `sha256:${string}`;
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly artifactVerificationCommitment: `sha256:${string}`;
  readonly sourcePageRaster: RealBuildPrefix50Step44ReviewedSourcePageRaster;
  readonly panelCrop: RealBuildPrefix50Step44ReviewedPanelCrop;
  readonly captureManifest: RealBuildPrefix50Step44ReviewedCaptureManifest;
  readonly canonicalCapturePolicy: "lego.canonical-capture/1";
  readonly canonicalCapturePolicyHash: `sha256:${string}`;
  readonly renderReviews: Readonly<
    Record<RealBuildPrefix50Step44ReviewFixtureKey, RealBuildPrefix50Step44ReviewedRender>
  >;
  readonly reviewDisposition: "reviewed-page-45-subbuild-return";
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step44ReturnReviewFixture =
  RealBuildPrefix50Step44UnreviewedReturnFixture | RealBuildPrefix50Step44ReviewedReturnFixture;

const source = deepFreeze({
  logicalPath: "recipes/6651557.pdf" as const,
  digest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  pageNumber: 45 as const,
  structuralEventSequence: 8 as const,
  structuralEventDigest:
    "sha256:4a4a56a9a4a802601d2fff37d8cc788cfd479e5573bf68d9013bf2aecca9f9ad" as const,
  precedingPhaseSequence: 71 as const,
  followingPhaseSequence: 72 as const,
  firstChildOccurrenceOrdinal: 258 as const,
  lastChildOccurrenceOrdinal: 280 as const,
});

const body = {
  schemaVersion: "lego.real-build-prefix50-step44-return-review-fixture/1" as const,
  reviewStatus: "unreviewed" as const,
  authority: "none" as const,
  sourceSetId: "6651557" as const,
  source,
  missingEvidence: [
    "exact-return-envelope-and-receipt-commitments",
    "exact-selected-candidate-and-document-hash",
    "verified-pdf-page-raster-and-panel-crop-bytes",
    "reviewed-seven-canonical-render-commitments",
  ] as const,
  reason:
    "The exact Step 44 return has not yet been rendered and reviewed against physical PDF page 45; no production visual binding may be minted.",
};

/** Repository-owned evidence state. Unreviewed is an intentional fail-closed value. */
export const REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE: RealBuildPrefix50Step44ReturnReviewFixture =
  deepFreeze({ ...body, commitment: canonicalDigest(body) });
