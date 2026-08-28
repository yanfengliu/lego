const deepFreeze = (value) => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const PREFIX50_LDRAW_CATALOG_FRAMES_SCHEMA = "lego.prefix50-ldraw-catalog-frames/1";
export const PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH =
  "output/real-build/prefix50-ldraw-catalog-frames.json";
export const PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES = 512 * 1024;

export const PREFIX50_LDRAW_CATALOG_FRAMES_AUTHORITY = deepFreeze({
  kind: "authority-absent-local-frame-registry",
  exactFirst50AliasRoster: true,
  exactCatalogFrames: true,
  authenticated: false,
  sourceExecution: false,
  identityEquivalence: false,
  physicalWorldFrame: false,
  assignmentAuthority: false,
  actionAuthority: false,
  documentOrientationLegality: false,
  placement: false,
  documentMutation: false,
  replay: false,
  acceptedDocument: false,
  completion: false,
});

export const PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS = deepFreeze([
  {
    designRevision: "15573;L",
    catalogPartId: "builtin:jumper-plate-1x2",
    ldrawFilename: "15573.dat",
    catalogLdrawFilename: "15573.dat",
    occurrenceCount: 33,
    frame: { orientationId: "upright-yaw-90", translationLdu: [0, -4, 0] },
    archive: {
      closureFileCount: 11,
      expandedTriangleCount: 220,
      bounds: { min: [-20, -4, -10], max: [20, 8, 10] },
    },
    candidateCount: 2,
    candidateSelfSymmetryClassCount: 1,
  },
  {
    designRevision: "3003;S",
    catalogPartId: "builtin:brick-2x2",
    ldrawFilename: "3003.dat",
    catalogLdrawFilename: "3003.dat",
    occurrenceCount: 1,
    frame: { orientationId: "upright-yaw-0", translationLdu: [0, -12, 0] },
    archive: {
      closureFileCount: 12,
      expandedTriangleCount: 316,
      bounds: { min: [-20, -4, -20], max: [20, 24, 20] },
    },
    candidateCount: 4,
    candidateSelfSymmetryClassCount: 1,
  },
  {
    designRevision: "3024;N",
    catalogPartId: "builtin:plate-1x1",
    ldrawFilename: "3024.dat",
    catalogLdrawFilename: "3024.dat",
    occurrenceCount: 2,
    frame: { orientationId: "upright-yaw-0", translationLdu: [0, -4, 0] },
    archive: {
      closureFileCount: 8,
      expandedTriangleCount: 76,
      bounds: { min: [-10, -4, -10], max: [10, 8, 10] },
    },
    candidateCount: 4,
    candidateSelfSymmetryClassCount: 1,
  },
  {
    designRevision: "3069;Q",
    catalogPartId: "builtin:tile-1x2",
    ldrawFilename: "3069b.dat",
    catalogLdrawFilename: "3069b.dat",
    occurrenceCount: 33,
    frame: { orientationId: "upright-yaw-90", translationLdu: [0, -4, 0] },
    archive: {
      closureFileCount: 4,
      expandedTriangleCount: 44,
      bounds: { min: [-20, 0, -10], max: [20, 8, 10] },
    },
    candidateCount: 2,
    candidateSelfSymmetryClassCount: 1,
  },
  {
    designRevision: "3622;J",
    catalogPartId: "builtin:brick-1x3",
    ldrawFilename: "3622.dat",
    catalogLdrawFilename: "3622.dat",
    occurrenceCount: 5,
    frame: { orientationId: "upright-yaw-90", translationLdu: [0, -12, 0] },
    archive: {
      closureFileCount: 11,
      expandedTriangleCount: 268,
      bounds: { min: [-30, -4, -10], max: [30, 24, 10] },
    },
    candidateCount: 2,
    candidateSelfSymmetryClassCount: 1,
  },
]);

export const PREFIX50_LDRAW_CATALOG_FRAMES_PINS = deepFreeze({
  officialWorldProposal: {
    schemaVersion: "lego.prefix50-official-ldraw-world-proposal/1",
    bytes: 500_895,
    digest: "sha256:7b76ef27bbad99f9014fd6543b0fdb47c1fdcfd789d0d9629e16df54a4889da7",
  },
  officialArchive: {
    path: "C:/tmp/ldraw-complete-2026-07.zip",
    bytes: 144_722_356,
    digest: "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
    logicalName: "ldraw-complete-2026-07.zip",
    expectedEntries: 36_896,
  },
  builderGeometry: {
    path: "output/real-build/builder-shell-geometry.bin",
    bytes: 1_820_412,
    digest: "sha256:7e91e1402f2ab609fee6e502336f86ee74fb3a94d970e9b0b75acf07f925a76f",
    format: "lego.builder-shell-and-ldraw-triangles-f32le/2",
  },
  catalogVersion: "builtin.basic-parts/28",
  expectedAccounting: {
    proposalAliasGroups: 66,
    proposalOccurrences: 320,
    frameAliases: 62,
    framedProposalOccurrences: 309,
    excludedQuarantineAliases: 4,
    excludedQuarantineOccurrences: 11,
    meshAssetFrames: 27,
    archiveGeometryFrames: 35,
    existingParametricFrames: 30,
    newlyDerivedParametricFrames: 5,
    newlyDerivedCandidateSelfSymmetryClasses: 5,
  },
  expectedArtifact: {
    bytes: 98_383,
    digest: "sha256:16a76321d1cbd8bb1308dff9c58ee61507f67c0139b17aa50a5d8415c789e2f2",
  },
});
