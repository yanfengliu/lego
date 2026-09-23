import { deepFreeze } from "@lego-studio/brick-kernel";

/** Reviewed booklet evidence narrows one source-frame repair and grants no placement authority. */
export const REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step42-panel-face-fixture/1" as const,
  sourceSetId: "6651557" as const,
  sourcePdfDigest:
    "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  pageNumber: 44 as const,
  cropDigest: "sha256:66fda118c6cbad71c6058ac3cf7b4f5e69161fd0ad026a19389edf96687bc888" as const,
  calloutIdentity: "p44|q1|x101.684|y227.599" as const,
  printedStepNumber: 42 as const,
  quantity: 1 as const,
  candidateOrdinal: 274 as const,
  candidateCatalogPartId: "builtin:tile-1x6" as const,
  receiverCatalogPartId: "builtin:plate-1x2-round-end" as const,
  receiverOrdinals: [270, 273] as const,
  reviewedPanelFace: "studs-up" as const,
  reviewedVisibleEvidence: "long-6636-smooth-lit-top-spans-repaired-35480-studs" as const,
  sourcePivotXPreservedLdu: 400 as const,
  rawOrientationId: "proper-m-00nn000p0" as const,
  olderRefusedOrientationId: "proper-m-00pp000p0" as const,
  canonicalOrientationId: "proper-m-00n0n0n00" as const,
  equivalentOrientationId: "proper-m-00p0n0p00" as const,
  canonicalOrientationBasis: "raw-local-positive-length-axis-preserved" as const,
  lookaheadPageNumber: 45 as const,
  lookaheadDisposition: "step-44-rigid-return-does-not-contradict-top-face-seat" as const,
  reviewDisposition: "reviewed-occurrence-scoped-source-frame-repair-not-authority" as const,
});

export type RealBuildPrefix50Step42PanelFaceFixture =
  typeof REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE;
