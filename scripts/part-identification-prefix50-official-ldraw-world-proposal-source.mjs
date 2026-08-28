export const PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_SCHEMA =
  "lego.prefix50-official-ldraw-world-proposal/1";
export const PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH =
  "output/real-build/prefix50-official-ldraw-world-proposal.json";
export const PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;

export const PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_AUTHORITY = Object.freeze({
  kind: "local-diagnostic-proposal",
  semanticIdentity: true,
  officialXmlLdrawCorrespondence: true,
  worldTransformProposal: true,
  authenticated: false,
  sourceExecution: false,
  preparedRun: false,
  productionActionLedger: false,
  physicalFrame: false,
  assignmentAuthority: false,
  actionAuthority: false,
  documentOrientationLegality: false,
  placement: false,
  documentMutation: false,
  replay: false,
  acceptedDocument: false,
  completion: false,
});

export const PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS = Object.freeze({
  kind: "module-owned-current-pins",
  actionPreparation: Object.freeze({
    schemaVersion: "lego.real-build-action-preparation/1",
    bytes: 317_116,
    digest: "sha256:edd2096efe55e6e68385dc7f5b735222a9cdf01ae5625528dae2d1edde0fcbbc",
  }),
  officialXml: Object.freeze({
    path: "output/official-model/vx1087034_21066_a.xml",
    bytes: 1_903_169,
    digest: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  }),
  officialLdraw: Object.freeze({
    path: "output/official-model/vx1087034_21066_a.ldr",
    bytes: 139_649,
    digest: "sha256:096b78037ef1ee15a6dcff90b38f00f09465d0f5a246cb6f5f08fac087dd7bc2",
  }),
  catalogVersion: "builtin.basic-parts/28",
  expectedAccounting: Object.freeze({
    xmlBrickRows: 1_465,
    topLevelLdrawRows: 1_465,
    compositeXmlRow: 1_440,
    compositeTopLevelLdrawRow: 1_465,
    compositeLeafRows: 5,
    flattenedLeafRows: 1_469,
    identityGroups: 175,
    colorBindings: 14,
    actionRows: 320,
    projectableActionRows: 309,
    quarantinedActionRows: 11,
    properSourceWorldRows: 320,
    properCatalogWorldRows: 309,
    halfLduSourceWorldRows: 3,
    semanticColorMatches: 291,
    ldrawColorsWithoutCatalogMapping: 29,
    semanticColorContradictions: 0,
  }),
  expectedArtifact: Object.freeze({
    bytes: 500_895,
    digest: "sha256:7b76ef27bbad99f9014fd6543b0fdb47c1fdcfd789d0d9629e16df54a4889da7",
  }),
});

export const PREFIX50_OFFICIAL_LDRAW_LOCAL_INVARIANCE_TOLERANCE = 1e-9;
export const PREFIX50_OFFICIAL_LDRAW_WORLD_ORIENTATION_TOLERANCE = 1e-6;
export const PREFIX50_OFFICIAL_LDRAW_HALF_LDU_TOLERANCE = 0.00002;

export const PREFIX50_OFFICIAL_LDRAW_COLOR_BINDINGS = Object.freeze([
  Object.freeze({ xmlMaterialId: "1", ldrawColorCode: 15, count: 508 }),
  Object.freeze({ xmlMaterialId: "21", ldrawColorCode: 4, count: 14 }),
  Object.freeze({ xmlMaterialId: "23", ldrawColorCode: 1, count: 13 }),
  Object.freeze({ xmlMaterialId: "24", ldrawColorCode: 14, count: 11 }),
  Object.freeze({ xmlMaterialId: "26", ldrawColorCode: 0, count: 457 }),
  Object.freeze({ xmlMaterialId: "28", ldrawColorCode: 2, count: 3 }),
  Object.freeze({ xmlMaterialId: "40", ldrawColorCode: 47, count: 30 }),
  Object.freeze({ xmlMaterialId: "106", ldrawColorCode: 25, count: 1 }),
  Object.freeze({ xmlMaterialId: "135", ldrawColorCode: 379, count: 55 }),
  Object.freeze({ xmlMaterialId: "140", ldrawColorCode: 272, count: 63 }),
  Object.freeze({ xmlMaterialId: "194", ldrawColorCode: 71, count: 182 }),
  Object.freeze({ xmlMaterialId: "199", ldrawColorCode: 72, count: 116 }),
  Object.freeze({ xmlMaterialId: "321", ldrawColorCode: 321, count: 6 }),
  Object.freeze({ xmlMaterialId: "322", ldrawColorCode: 322, count: 10 }),
]);

export const PREFIX50_OFFICIAL_LDRAW_EXACT_IDENTITY_ALIASES = Object.freeze([
  Object.freeze({ xmlDesignId: "2412", ldrawFilename: "2412b.dat", count: 54 }),
  Object.freeze({ xmlDesignId: "2453", ldrawFilename: "2453b.dat", count: 9 }),
  Object.freeze({ xmlDesignId: "3023", ldrawFilename: "3023b.dat", count: 73 }),
  Object.freeze({ xmlDesignId: "3040", ldrawFilename: "3040b.dat", count: 6 }),
  Object.freeze({ xmlDesignId: "3044", ldrawFilename: "3044c.dat", count: 2 }),
  Object.freeze({ xmlDesignId: "3068", ldrawFilename: "3068b.dat", count: 28 }),
  Object.freeze({ xmlDesignId: "3069", ldrawFilename: "3069b.dat", count: 64 }),
  Object.freeze({ xmlDesignId: "3070", ldrawFilename: "3070b.dat", count: 51 }),
  Object.freeze({ xmlDesignId: "32064", ldrawFilename: "32064a.dat", count: 2 }),
  Object.freeze({ xmlDesignId: "3245", ldrawFilename: "3245b.dat", count: 10 }),
  Object.freeze({ xmlDesignId: "3626", ldrawFilename: "3626c.dat", count: 1 }),
  Object.freeze({ xmlDesignId: "3814", ldrawFilename: "973.dat", count: 1 }),
  Object.freeze({ xmlDesignId: "4032", ldrawFilename: "4032a.dat", count: 1 }),
  Object.freeze({ xmlDesignId: "50746", ldrawFilename: "54200.dat", count: 28 }),
  Object.freeze({ xmlDesignId: "60481", ldrawFilename: "60481b.dat", count: 4 }),
  Object.freeze({ xmlDesignId: "61406", ldrawFilename: "61406p07.dat", count: 1 }),
  Object.freeze({ xmlDesignId: "63965", ldrawFilename: "63965a.dat", count: 1 }),
]);

export const PREFIX50_OFFICIAL_LDRAW_QUARANTINES = Object.freeze([
  Object.freeze({
    designRevision: "10201;H",
    ldrawFilename: "10201.dat",
    catalogLdrawFilename: "28802.dat",
    count: 2,
    reason: "identity-contradiction-10201-versus-28802",
    evidence: Object.freeze({
      xmlLdrawIdentity: "exact-10201.dat",
      catalogIdentity: "28802.dat",
      catalogVariantFramePinned: false,
    }),
  }),
  Object.freeze({
    designRevision: "3245;M",
    ldrawFilename: "3245b.dat",
    catalogLdrawFilename: "3245c.dat",
    count: 7,
    reason: "non-interchangeable-3245b-versus-3245c",
    evidence: Object.freeze({
      officialTopLevelLdrawFilename: "3245b.dat",
      catalogIdentity: "3245c.dat",
      catalogVariantFramePinned: false,
    }),
  }),
  Object.freeze({
    designRevision: "41769;G",
    ldrawFilename: "41769.dat",
    catalogLdrawFilename: "41769a.dat",
    count: 1,
    reason: "exact-xml-ldraw-but-catalog-41769a-frame-unpinned",
    evidence: Object.freeze({
      xmlLdrawIdentity: "exact-41769.dat",
      catalogIdentity: "41769a.dat",
      builderCalibrationStatus: "checksum-mismatch-not-consumed-here",
      catalogVariantFramePinned: false,
    }),
  }),
  Object.freeze({
    designRevision: "41770;H",
    ldrawFilename: "41770.dat",
    catalogLdrawFilename: "41770a.dat",
    count: 1,
    reason: "exact-xml-ldraw-but-catalog-41770a-frame-unpinned",
    evidence: Object.freeze({
      xmlLdrawIdentity: "exact-41770.dat",
      catalogIdentity: "41770a.dat",
      builderCalibrationStatus: "checksum-mismatch-not-consumed-here",
      catalogVariantFramePinned: false,
    }),
  }),
]);
