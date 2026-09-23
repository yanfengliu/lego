import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views.ts";

export const REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT = 211 as const;
export const REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH = "recipes/6651557.pdf" as const;
export const REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST =
  "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const;
export const REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION =
  "Review only this public directory. Do not open or inspect any parent or sibling directory, including withheld evidence, until both blinded disposition lanes and the full-resolution closure are committed.\n";

export type RealBuildPrefix50Step44BlindId = `B${string}`;
export type RealBuildPrefix50Step44ReviewOutcome = "same" | "different" | "not-observable";

export const REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA = deepFreeze([
  {
    id: "long-axis-direction",
    question:
      "Does the returned subbuild run in the same visible long-axis direction as physical PDF page 45?",
  },
  {
    id: "rear-top-edge-side",
    question:
      "Is the returned subbuild on the same visible rear/top-edge side of the parent build as physical PDF page 45?",
  },
  {
    id: "vertical-seating",
    question:
      "Does the returned subbuild have the same visible vertical seating relative to the parent build as physical PDF page 45?",
  },
  {
    id: "longitudinal-registration-to-adjacent-bridge-landmarks",
    question:
      "Does the returned subbuild have the same visible longitudinal registration to adjacent bridge landmarks as physical PDF page 45?",
  },
  {
    id: "cyan-face-hand-orientation",
    question: "Does the cyan face/hand have the same visible orientation as physical PDF page 45?",
  },
  {
    id: "white-canopy-location-projection",
    question:
      "Does the white canopy have the same visible location and projection as physical PDF page 45?",
  },
] as const);

export type RealBuildPrefix50Step44Page45CriterionId =
  (typeof REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA)[number]["id"];

export const REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step44-page45-review-source-policy/1" as const,
  sourceSetId: "6651557" as const,
  sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  physicalPageNumber: 45 as const,
  densityDpi: 180 as const,
  sourcePageDimensions: { width: 1_914 as const, height: 1_361 as const },
  panelCrop: {
    x: 850 as const,
    y: 350 as const,
    width: 720 as const,
    height: 470 as const,
  },
  allowedSources: [
    "physical-pdf-page-45-panel-crop",
    "blinded-candidate-page45-matched-after-capture",
    "blinded-candidate-fixed-camera-step43-to-step44-delta",
    "blinded-candidate-raw-canonical-seven-view-captures",
  ] as const,
  forbiddenSources: [
    "printed-step-45",
    "physical-pdf-page-46",
    "later-printed-steps-or-pages",
    "candidate-key-document-hash-operation-or-roster-identity",
  ] as const,
  criteria: REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA,
});

export const REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT = canonicalDigest(
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
);

export const REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS = deepFreeze([
  {
    fixtureKey: "page45MatchedAfter",
    canonicalViewName: "page45-matched-after",
    width: 720,
    height: 470,
  },
  ...REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(({ fixtureKey, canonicalViewName }) => ({
    fixtureKey,
    canonicalViewName,
    width: 640,
    height: 480,
  })),
] as const);

export interface RealBuildPrefix50Step44BlindSourceCell {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly fixtureKey: string;
  readonly canonicalViewName: string;
  readonly artifactPath: string;
  readonly sourcePngDigest: `sha256:${string}`;
  readonly sourcePixelDigest: `sha256:${string}`;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly cameraCommitment: `sha256:${string}`;
  readonly sourceBindingCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindFixedCameraEvidence {
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineCommitment: `sha256:${string}`;
  readonly baselinePngDigest: `sha256:${string}`;
  readonly baselinePixelDigest: `sha256:${string}`;
  readonly fixedCameraAfterCommitment: `sha256:${string}`;
  readonly afterPngDigest: `sha256:${string}`;
  readonly afterPixelDigest: `sha256:${string}`;
  readonly fixedCameraDeltaCommitment: `sha256:${string}`;
  readonly fixedCameraDeltaArtifactCommitment: `sha256:${string}`;
  readonly deltaArtifactPath: string;
  readonly deltaPngDigest: `sha256:${string}`;
  readonly deltaPixelDigest: `sha256:${string}`;
  readonly deltaWidth: 720;
  readonly deltaHeight: 470;
  readonly changedPixelCount: number;
  readonly changedPixelBounds: Readonly<{
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
    readonly width: number;
    readonly height: number;
  }> | null;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindReferenceReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-reference/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly sourcePdfArtifactPath: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
  readonly sourcePdfDigest: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST;
  readonly pageNumber: 45;
  readonly renderer: "poppler-pdftoppm";
  readonly rendererVersion: string;
  readonly densityDpi: 180;
  readonly sourcePagePngDigest: `sha256:${string}`;
  readonly sourcePagePixelDigest: `sha256:${string}`;
  readonly x: 850;
  readonly y: 350;
  readonly width: 720;
  readonly height: 470;
  readonly artifactFile: "real-build-prefix50-step44-reference-page45-crop.png";
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindContactSheetPage {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-contact-sheet-page/1";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly pageNumber: number;
  readonly pageCount: number;
  readonly firstBlindId: RealBuildPrefix50Step44BlindId;
  readonly rowCount: number;
  readonly cellRoster: typeof REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS;
  readonly width: number;
  readonly height: number;
  readonly artifactFile: string;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly rows: readonly {
    readonly blindId: RealBuildPrefix50Step44BlindId;
    readonly cells: readonly RealBuildPrefix50Step44BlindSourceCell[];
    readonly fixedCameraEvidence: RealBuildPrefix50Step44BlindFixedCameraEvidence;
    readonly commitment: `sha256:${string}`;
  }[];
  readonly referenceCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindFixedCameraBaseline {
  readonly schemaVersion: "lego.real-build-prefix50-step43-blind-fixed-camera-baseline/1";
  readonly authority: "none";
  readonly sourceSetId: "6651557";
  readonly scene: "model-only";
  readonly completedPrintedStep: 43;
  readonly artifactPath: "real-build-prefix50-step43-page45-fixed-camera-baseline.png";
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly cameraCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineArtifactCommitment: `sha256:${string}`;
  readonly width: 720;
  readonly height: 470;
  readonly pngByteLength: number;
  readonly pngDigest: `sha256:${string}`;
  readonly pixelDigest: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindReviewPacket {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-review-packet/1";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly reviewIsolationInstructionFile: "REVIEW-INSTRUCTIONS.txt";
  readonly reviewIsolationInstructionDigest: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly blindIds: readonly RealBuildPrefix50Step44BlindId[];
  readonly page45SourcePolicy: typeof REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly publicPacketCoreCommitment: `sha256:${string}`;
  readonly withheldUnblindingMapCommitment: `sha256:${string}`;
  readonly reference: RealBuildPrefix50Step44BlindReferenceReceipt;
  readonly fixedCameraBaseline: RealBuildPrefix50Step44BlindFixedCameraBaseline;
  readonly rowsPerPage: number;
  readonly pageCount: number;
  readonly pages: readonly RealBuildPrefix50Step44BlindContactSheetPage[];
  readonly finishedSheetVerifications: readonly {
    readonly artifactFile: string;
    readonly pageCommitment: `sha256:${string}`;
    readonly pngDigest: `sha256:${string}`;
    readonly pixelDigest: `sha256:${string}`;
    readonly width: number;
    readonly height: number;
    readonly commitment: `sha256:${string}`;
  }[];
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindPublicManifest {
  readonly schemaVersion: "lego.real-build-prefix50-step44-public-blind-batch/1";
  readonly authority: "none";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly sourcePdfArtifactPath: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
  readonly sourcePdfDigest: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly blindIds: readonly RealBuildPrefix50Step44BlindId[];
  readonly reviewIsolationInstructionFile: "REVIEW-INSTRUCTIONS.txt";
  readonly reviewIsolationInstructionDigest: `sha256:${string}`;
  readonly referenceArtifactFile: "real-build-prefix50-step44-reference-page45-crop.png";
  readonly referenceCommitment: `sha256:${string}`;
  readonly blindReviewPacketFile: "real-build-prefix50-step44-blind-review-packet.json";
  readonly blindReviewPacketByteDigest: `sha256:${string}`;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly withheldUnblindingMapCommitment: `sha256:${string}`;
  readonly contactSheetPageCommitments: readonly `sha256:${string}`[];
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindPublicHarnessSuccess {
  readonly schemaVersion: "lego.real-build-prefix50-step44-public-harness-success/1";
  readonly authority: "none";
  readonly status: "complete";
  readonly selectionAuthority: false;
  readonly fixturePromotionAuthority: false;
  readonly sourceSetId: "6651557";
  readonly sourcePdfArtifactPath: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
  readonly sourcePdfDigest: typeof REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly capturedCandidateCount: 211;
  readonly publicManifestFile: "real-build-prefix50-step44-public-batch-manifest.json";
  readonly publicManifestByteDigest: `sha256:${string}`;
  readonly publicManifestCommitment: `sha256:${string}`;
  readonly withheldManifestFile: "real-build-prefix50-step44-withheld-batch-capture-manifest.json";
  readonly withheldManifestByteDigest: `sha256:${string}`;
  readonly withheldManifestCommitment: `sha256:${string}`;
  readonly blindReviewPacketFile: "real-build-prefix50-step44-blind-review-packet.json";
  readonly blindReviewPacketByteDigest: `sha256:${string}`;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly cleanup: Readonly<{
    readonly browserClosed: true;
    readonly browserProcessTreeClosed: true;
    readonly serverClosed: true;
  }>;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindCriterionDisposition {
  readonly criterionId: RealBuildPrefix50Step44Page45CriterionId;
  readonly outcome: RealBuildPrefix50Step44ReviewOutcome;
  readonly note: string;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindDispositionRow {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly criteria: readonly RealBuildPrefix50Step44BlindCriterionDisposition[];
  readonly shortlisted: boolean;
  readonly shortlistNote: string;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindDispositionLane {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-disposition-lane/1";
  readonly authority: "none";
  readonly lane: "lane-a" | "lane-b";
  readonly reviewerAttestation: Readonly<{
    readonly reviewerId: string;
    readonly reviewSessionId: string;
    readonly statement: "I independently reviewed every blinded row using only the committed page-45 source policy.";
    readonly commitment: `sha256:${string}`;
  }>;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly rows: readonly RealBuildPrefix50Step44BlindDispositionRow[];
  readonly shortlist: readonly RealBuildPrefix50Step44BlindId[];
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44FullResolutionReviewRow {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly reviewedCellCommitments: readonly `sha256:${string}`[];
  readonly reviewedFixedCameraEvidenceCommitment: `sha256:${string}`;
  readonly criteria: readonly RealBuildPrefix50Step44BlindCriterionDisposition[];
  readonly survives: boolean;
  readonly note: string;
  readonly commitment: `sha256:${string}`;
}

export const REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT =
  "The public packet, two distinct lane files, full-resolution outcome, and closure are stored in distinct sibling output directories. This records procedural separation and distinct reviewer/session records only; it claims neither cryptographic reviewer authentication nor operating-system access-control isolation." as const;

export interface RealBuildPrefix50Step44FullResolutionOutcome {
  readonly schemaVersion: "lego.real-build-prefix50-step44-full-resolution-outcome/1";
  readonly authority: "none";
  readonly fixturePromotionAuthority: false;
  readonly storageStatement: typeof REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly laneCommitments: readonly [`sha256:${string}`, `sha256:${string}`];
  readonly unionShortlist: readonly RealBuildPrefix50Step44BlindId[];
  readonly fullResolutionReviews: readonly RealBuildPrefix50Step44FullResolutionReviewRow[];
  readonly disposition:
    | Readonly<{
        readonly kind: "selected-one";
        readonly blindId: RealBuildPrefix50Step44BlindId;
        readonly note: string;
      }>
    | Readonly<{ readonly kind: "refused"; readonly reason: string }>;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindReviewClosure {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-review-closure/2";
  readonly authority: "none";
  readonly fixturePromotionAuthority: false;
  readonly storageStatement: typeof REAL_BUILD_PREFIX50_STEP44_REVIEW_STORAGE_STATEMENT;
  readonly blindReviewPacketCommitment: `sha256:${string}`;
  readonly page45SourcePolicyCommitment: `sha256:${string}`;
  readonly laneCommitments: readonly [`sha256:${string}`, `sha256:${string}`];
  readonly fullResolutionOutcomeCommitment: `sha256:${string}`;
  readonly publicHarnessSuccessCommitment: `sha256:${string}`;
  readonly publicPixelVerificationCommitment: `sha256:${string}`;
  readonly unionShortlist: readonly RealBuildPrefix50Step44BlindId[];
  readonly disposition: RealBuildPrefix50Step44FullResolutionOutcome["disposition"];
  readonly commitment: `sha256:${string}`;
}
