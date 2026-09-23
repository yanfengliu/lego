import { deepFreeze } from "@lego-studio/brick-kernel";

/** Reviewed booklet evidence; it narrows source repair but grants no placement authority. */
export const REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-step41-panel-face-fixture/1" as const,
  sourceSetId: "6651557" as const,
  sourcePdfDigest:
    "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  pageNumber: 44 as const,
  cropDigest: "sha256:e9dbd7576685871145b9e6278d217fce619bd55d0def81f8438f401e65761072" as const,
  calloutIdentity: "p44|q4|x80.989|y495.535" as const,
  printedStepNumber: 41 as const,
  quantity: 4 as const,
  candidateCatalogPartId: "builtin:plate-1x2-round-end" as const,
  receiverCatalogPartId: "builtin:bracket-2x2-1x2-vertical-studs" as const,
  reviewedAttachment: "four-35480-undersides-on-four-41682-panel-face-stud-pairs" as const,
  receiverCandidatePairs: [
    [267, 270],
    [266, 271],
    [269, 272],
    [268, 273],
  ] as const,
  /** Proper +90-degree source-to-panel-face turn about X, in row-major order. */
  sourceLongAxisToPanelFaceQuarterTurn: [1, 0, 0, 0, 0, -1, 0, 1, 0] as const,
  canonicalOrientationId: "proper-m-00n0n0n00" as const,
  equivalentOrientationId: "proper-m-00p0n0p00" as const,
  reviewDisposition: "reviewed-panel-face-attachment" as const,
});

export type RealBuildPrefix50Step41PanelFaceFixture =
  typeof REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE;
