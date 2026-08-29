export const PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_SCHEMA =
  "lego.prefix50-official-ldraw-world-proposal/2";
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
    bytes: 317_152,
    digest: "sha256:5fbab00b90c6ffbe6c9b09727819e0b3a964cebbd88138232bd2418df6100fb6",
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
  catalogVersion: "builtin.basic-parts/29",
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
    projectableActionRows: 320,
    quarantinedActionRows: 0,
    properSourceWorldRows: 320,
    properCatalogWorldRows: 320,
    halfLduSourceWorldRows: 3,
    semanticColorMatches: 291,
    ldrawColorsWithoutCatalogMapping: 29,
    semanticColorContradictions: 0,
  }),
  expectedArtifact: Object.freeze({
    bytes: 764_234,
    digest: "sha256:24c10640f118d2961dd297cff608b6978bd54eab85a37cf0c314f4711612f960",
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

export const PREFIX50_OFFICIAL_LDRAW_RETIRED_QUARANTINES = Object.freeze([
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

const occurrenceBinding = (basis, row) =>
  Object.freeze({
    ...row,
    occurrenceScoped: true,
    identityBasis: basis,
  });

const resolvedCatalogPartBinding = (row) =>
  occurrenceBinding("exact-source-root-after-reviewed-catalog-part-correction", {
    ...row,
    bindingKind: "resolved-catalog-part-correction",
    movedRootProofId: null,
  });

const identityMovedRootBinding = (row) =>
  occurrenceBinding("official-archive-identity-moved-root-same-hand", {
    ...row,
    bindingKind: "identity-moved-root",
    movedRootProofId: `${row.ldrawFilename}->${row.catalogLdrawFilename}`,
  });

export const PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS = Object.freeze([
  identityMovedRootBinding({
    sourceBuilderIdentityOrdinal: 25,
    stepNumber: 11,
    phaseSequence: 13,
    builderBrickRef: "d506ff3e-39af-4218-a8c4-982398353f55",
    calloutIdentity: "p15|q1|x151.951|y418.502",
    designRevision: "41769;G",
    publishedCatalogPartId: "builtin:wedge-plate-2x4-right",
    catalogPartId: "builtin:wedge-plate-2x4-right",
    ldrawFilename: "41769.dat",
    catalogLdrawFilename: "41769a.dat",
    priorQuarantineBasis: "exact-xml-ldraw-but-catalog-41769a-frame-unpinned",
  }),
  identityMovedRootBinding({
    sourceBuilderIdentityOrdinal: 39,
    stepNumber: 17,
    phaseSequence: 23,
    builderBrickRef: "9787b6ad-5ca2-4434-a0e7-8a4b00b4c300",
    calloutIdentity: "p21|q1|x100.711|y471.631",
    designRevision: "41770;H",
    publishedCatalogPartId: "builtin:wedge-plate-2x4-left",
    catalogPartId: "builtin:wedge-plate-2x4-left",
    ldrawFilename: "41770.dat",
    catalogLdrawFilename: "41770a.dat",
    priorQuarantineBasis: "exact-xml-ldraw-but-catalog-41770a-frame-unpinned",
  }),
  resolvedCatalogPartBinding({
    sourceBuilderIdentityOrdinal: 139,
    stepNumber: 26,
    phaseSequence: 35,
    builderBrickRef: "c704f1d8-7fca-4c68-8762-a717a7b1d12e",
    calloutIdentity: "p30|q2|x84.228|y407.699",
    designRevision: "10201;H",
    publishedCatalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
    catalogPartId: "builtin:bracket-1x2-1x4-rounded-corners",
    ldrawFilename: "10201.dat",
    catalogLdrawFilename: "10201.dat",
    priorQuarantineBasis: "identity-contradiction-10201-versus-28802",
  }),
  resolvedCatalogPartBinding({
    sourceBuilderIdentityOrdinal: 147,
    stepNumber: 26,
    phaseSequence: 35,
    builderBrickRef: "a4fdc5b5-c9c9-403e-a391-d087780e6d62",
    calloutIdentity: "p30|q2|x84.228|y407.699",
    designRevision: "10201;H",
    publishedCatalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
    catalogPartId: "builtin:bracket-1x2-1x4-rounded-corners",
    ldrawFilename: "10201.dat",
    catalogLdrawFilename: "10201.dat",
    priorQuarantineBasis: "identity-contradiction-10201-versus-28802",
  }),
  ...[
    [178, 30, 47, "428de5ab-416a-48cc-8318-8a6766351cef", "p34|q1|x62.389|y468.271"],
    [183, 31, 50, "6438031d-7bbf-478c-88a1-859dda79cc69", "p35|q2|x147.987|y481.711"],
    [185, 31, 51, "76a45aa0-0f2b-4dfd-8657-9c04ab5c050e", "p35|q2|x147.987|y481.711"],
    [190, 32, 54, "ff6bb41d-d274-4a17-ae13-0d8eb3ad335e", "p36|q4|x83.269|y421.615"],
    [191, 32, 54, "6a950dd5-c977-485c-8b38-330ebf78331b", "p36|q4|x83.269|y421.615"],
    [192, 32, 54, "010ee885-f433-46e6-93eb-ef085515c191", "p36|q4|x83.269|y421.615"],
    [193, 32, 54, "7cfba936-449c-415f-a034-2b5583f449b8", "p36|q4|x83.269|y421.615"],
  ].map(
    ([sourceBuilderIdentityOrdinal, stepNumber, phaseSequence, builderBrickRef, calloutIdentity]) =>
      resolvedCatalogPartBinding({
        sourceBuilderIdentityOrdinal,
        stepNumber,
        phaseSequence,
        builderBrickRef,
        calloutIdentity,
        designRevision: "3245;M",
        publishedCatalogPartId: "builtin:brick-1x2x2-without-understud",
        catalogPartId: "builtin:brick-1x2x2-inside-axle-holder",
        ldrawFilename: "3245b.dat",
        catalogLdrawFilename: "3245b.dat",
        priorQuarantineBasis: "non-interchangeable-3245b-versus-3245c",
      }),
  ),
]);
