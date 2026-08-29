const deepFreeze = (value) => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const PREFIX50_LDRAW_CATALOG_FRAMES_SCHEMA = "lego.prefix50-ldraw-catalog-frames/2";
export const PREFIX50_LDRAW_CATALOG_FRAMES_OUTPUT_PATH =
  "output/real-build/prefix50-ldraw-catalog-frames.json";
export const PREFIX50_LDRAW_CATALOG_FRAMES_MAX_ARTIFACT_BYTES = 512 * 1024;

export const PREFIX50_LDRAW_CATALOG_FRAMES_AUTHORITY = deepFreeze({
  kind: "authority-absent-local-frame-registry",
  exactFirst50AliasRoster: true,
  exactCatalogFrames: true,
  occurrenceScopedIdentityMovedRoots: true,
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

export const PREFIX50_LDRAW_CATALOG_MOVED_ROOT_EXPECTATIONS = deepFreeze([
  {
    proofId: "41769.dat->41769a.dat",
    designRevision: "41769;G",
    sourceBuilderIdentityOrdinal: 25,
    catalogPartId: "builtin:wedge-plate-2x4-right",
    sourceRoot: {
      filename: "41769.dat",
      bytes: 309,
      digest: "sha256:013622de3227767ed31ce3c87edbd8cc07c02fa3fb0f00adfc0d2ae242e7ccfa",
      closureFileCount: 40,
      closureDigest: "sha256:d02eca28d1fd574ca872f587f87a9f0395e5d9b4818f7b88c7cbc404f866a08f",
    },
    targetRoot: {
      filename: "41769a.dat",
      bytes: 1006,
      digest: "sha256:0b069ab042f2cc8297a52e76b49a06e504cd4e9a51f02d6aea8c63f686c28ff8",
      closureFileCount: 39,
      closureDigest: "sha256:8e62476711dc3f903f7891400902f86148a9de79f1f6c4f1c20ec1999b4a801f",
    },
    expandedTriangleCount: 521,
    expandedGeometryDigest:
      "sha256:605e7996fcdd9bb59aef246a422fa55f93991fda51cf1ff8e52d85ebf6424cbc",
    bounds: { min: [-20, -4, -40], max: [20, 8, 40] },
  },
  {
    proofId: "41770.dat->41770a.dat",
    designRevision: "41770;H",
    sourceBuilderIdentityOrdinal: 39,
    catalogPartId: "builtin:wedge-plate-2x4-left",
    sourceRoot: {
      filename: "41770.dat",
      bytes: 308,
      digest: "sha256:8bd7294d3c547f23ac5233e834fd3a14225b6389c8e5b61e6685ba939f28c0cb",
      closureFileCount: 40,
      closureDigest: "sha256:1438291699693eab29be989a48176e384c628bce4a2bde4b70cccaea18c45546",
    },
    targetRoot: {
      filename: "41770a.dat",
      bytes: 1055,
      digest: "sha256:59648c2ca07a51d82fdc9aabf4edb65f4942760dc9df3b64946d13fd82b0303d",
      closureFileCount: 39,
      closureDigest: "sha256:5271682d89e3d5dd2f77e1c0a80d26401a965d93dfe38327f1e066f3838b1339",
    },
    expandedTriangleCount: 521,
    expandedGeometryDigest:
      "sha256:3481be5e26f44eddccf2fb579c70becd7fcdee31217ed4e787b41a72c7bde8a1",
    bounds: { min: [-20, -4, -40], max: [20, 8, 40] },
  },
]);

export const PREFIX50_LDRAW_CATALOG_FRAMES_PINS = deepFreeze({
  officialWorldProposal: {
    schemaVersion: "lego.prefix50-official-ldraw-world-proposal/2",
    bytes: 764_234,
    digest: "sha256:24c10640f118d2961dd297cff608b6978bd54eab85a37cf0c314f4711612f960",
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
  catalogVersion: "builtin.basic-parts/29",
  expectedAccounting: {
    proposalAliasGroups: 66,
    proposalOccurrences: 320,
    frameAliases: 66,
    framedProposalOccurrences: 320,
    excludedQuarantineAliases: 0,
    excludedQuarantineOccurrences: 0,
    meshAssetFrames: 31,
    archiveGeometryFrames: 35,
    existingParametricFrames: 30,
    newlyDerivedParametricFrames: 5,
    newlyDerivedCandidateSelfSymmetryClasses: 5,
    occurrenceScopedIdentityMovedRootFrames: 2,
    occurrenceScopedIdentityMovedRootOccurrences: 2,
  },
  expectedArtifact: {
    bytes: 330_415,
    digest: "sha256:bcf9702150b73cab1bd70d7ecd0bf33b3b3917522ce4f0ca892be56424b861a1",
  },
});
