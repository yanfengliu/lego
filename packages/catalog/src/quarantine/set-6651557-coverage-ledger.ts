import { deepFreeze } from "../freeze.ts";
import { assertSet6651557CoverageLedgerShape } from "./set-6651557-coverage-ledger-schema.ts";
import { SET_6651557_NATIVE_RECORD_DIGESTS } from "./set-6651557-native-record-digests.ts";

const designIds = (source: string): readonly string[] => source.trim().split(/\s+/);

const builderSourceUrl = (designId: string, revision: string): string =>
  `https://api.prod.dbix.i.lego.com/api/v1/Bricks/${designId}?Revision=${revision}&Platform=Android`;

const BASELINE_COVERED_TOP_LEVEL_DESIGN_IDS = designIds(`
  2412 2420 2431 2445 3002 3003 3004 3005 3008 3009 3010 3020 3021 3022 3023 3024
  3029 3030 3031 3032 3033 3034 3035 3068 3069 3070 3460 3622 3623 3659 3666 3710
  3795 3832 3958 4162 4477 6106 6636 15573 30503 30565 34103 41539 41769 41770 54383
  60479 63864 80015 85984 87079 87580 91988
`);

const NATIVE_PACK_DESIGN_IDS = designIds(`
  2310 2449 2453 2877 3039 3040 3044 3386 3573 3626 4032 4070 4216 4304 4519 4585
  4733 4740 5092 6019 6141 6143 6254 6801 7236 7302 7324 7562 8172 10201 11090 11211
  11212 11253 11610 13547 14716 14719 15254 15571 15706 18654 18674 20482 23443 24482
  25269 26603 26604 28192 30136 30162 30374 30414 31510 32028 32064 32828 32952 33909
  35395 35464 35480 35787 36036 36840 36841 37846 38583 38585 43898 44728 49307 50746
  51739 52394 58176 59900 60478 60481 61406 63868 63965 64644 64647 67095 67329 73109
  73230 73825 73831 77844 77850 78258 78329 78443 78444 86876 86996 87087 87994 89680
  93273 93274 98283 99207 99780
`);

const UNRESOLVED_BUILDER_LEAVES = [
  {
    designId: "2450",
    revision: "G",
    expectedManifestMd5: "fe8d2a3176dc41e8ccd5a18b2bff7966",
    observedMd5: "7add7323690efbcc3657777952b36586",
    observedBundleSha256: "sha256:9d2d881fa0a484ad494795b2ea616d71a95aa9bed399693b0cfa892de0ddd872",
    observedBundleBytes: 124_311,
  },
  {
    designId: "3245",
    revision: "M",
    expectedManifestMd5: "a679d0929e777a86573469a63ce841dd",
    observedMd5: "bdce3745e99adf9c3bfb0708161c6875",
    observedBundleSha256: "sha256:1aa4e8333df9914191a4d941a7ce0f95460311eabd8f159f9e4a9b1e5c1c9534",
    observedBundleBytes: 85_098,
  },
  {
    designId: "4569",
    revision: "D",
    expectedManifestMd5: "7c6db5b47373aa0e001fedeea63bbac9",
    observedMd5: "a8b76b378ff423be03b4be15cdb43e80",
    observedBundleSha256: "sha256:c8d653858b194c08eaca540dd957077be3d6e1d1c85b70ec32696d2a04c59b66",
    observedBundleBytes: 146_109,
  },
  {
    designId: "7126",
    revision: "B",
    expectedManifestMd5: "a2e8a7caf4f34fa587f23c5cd042eefc",
    observedMd5: "4fa68b3e3a4cf3adf42947ec69a4f3c9",
    observedBundleSha256: "sha256:bf048d95d93316fd6afdc67483076533a19a9d3f6e551d4fbf5cb3e69176fdcf",
    observedBundleBytes: 80_749,
  },
  {
    designId: "30357",
    revision: "H",
    expectedManifestMd5: "0fd1016956301561257579bea0aeffe7",
    observedMd5: "af5f0484ef9dba006dcbac53dfc24ba2",
    observedBundleSha256: "sha256:c1ecbf0be1616ea8663889adbcf3a87d0612010ac15c8f45222085773a7d7108",
    observedBundleBytes: 88_073,
  },
  {
    designId: "41682",
    revision: "H",
    expectedManifestMd5: "84dbe02510271203fd135ed068015ca6",
    observedMd5: "f6f2026ba39b2a180cb93c56aa7bd058",
    observedBundleSha256: "sha256:0e6bf66424365cb0cb09c4c7f8b3d207319177387be751f7a3a95964d5086eb0",
    observedBundleBytes: 81_491,
  },
  {
    designId: "44237",
    revision: "H",
    expectedManifestMd5: "6ac85b42225446d80899c3fa5c2ed3cd",
    observedMd5: "92c50410aca4068c2ade9e04b1283ea5",
    observedBundleSha256: "sha256:fb04e3d1ac9cd04035e1640267ccfc5b0920baa21ba474ae75c49c7d88f21541",
    observedBundleBytes: 125_098,
  },
  {
    designId: "79491",
    revision: "D",
    expectedManifestMd5: "51b6359dd99797c9736f89edcc3e64ec",
    observedMd5: "49bfea2e3aadc4688d892af62e273935",
    observedBundleSha256: "sha256:b1a4b23280988bfa29d73795541f145d47924983f722839b479c9e129ed23914",
    observedBundleBytes: 95_981,
  },
  {
    designId: "93888",
    revision: "H",
    expectedManifestMd5: "65300b936efeb05bfdc636359317df74",
    observedMd5: "6cf19bd7ffa93e9bbdaef757565b33b9",
    observedBundleSha256: "sha256:fd84c1b0ac40232bf5eec9c8effbc6e63347d227ff13023b1653fa01bda71c61",
    observedBundleBytes: 142_439,
  },
  {
    designId: "99563",
    revision: "G",
    expectedManifestMd5: "234d10e8ad4d582406b3182ab9f3e1ee",
    observedMd5: "5510b362efe4a000dde02c496677fc78",
    observedBundleSha256: "sha256:b0064e6bed808e9502fb5a2229a73ba4019acbcd8ec8f3cd9d55c85771099213",
    observedBundleBytes: 76_400,
  },
].map((evidence) => ({
  ...evidence,
  state: "unresolved-builder-integrity" as const,
  reason: "manifest-checksum-mismatch" as const,
  catalogAdmissionAtBaseline: "unadmitted" as const,
  sourceUrl: builderSourceUrl(evidence.designId, evidence.revision),
}));

const COMPOSITE_COMPONENT_LEAVES = [
  {
    designId: "3814",
    revision: "X",
    itemId: "VX0003814",
    name: "MINI UPPER PART",
    manifestMd5: "b9b96df8fc4c92bbcdc0215521033dc0",
    bundleSha256: "sha256:564298449f97c977e0539c7ae1064f7fcbe32f33f2625b24937364481c77c687",
    bundleBytes: 107_381,
    primitiveXmlSha256: "sha256:b03542e9c7ad85c51970e4590b164afd6df5ac85b380f620004f8144b14c0842",
    shellCanonicalSha256: "sha256:a93ce7c3ec3e86ae4ca0e406c33561b0cc7dd0cae9ab863b2a9df56b78b07cde",
    shellVertexCount: 1_135,
    shellTriangleCount: 1_212,
    packedBinaryBytes: 28_164,
    collisionBoxCount: 14,
    connectorPrimitiveCounts: { Axel: 1, Custom2DField: 3, Fixed: 4, Hinge: 2, Slider: 0 },
  },
  {
    designId: "3818",
    revision: "P",
    itemId: "VX0003818",
    name: "MINI ARM, RIGHT",
    manifestMd5: "6c8308c5958e99a05d1563184a43864b",
    bundleSha256: "sha256:61a733a42da80dac24adbcee50e50baef0e832f0464ab16034d73dacd6f2e405",
    bundleBytes: 55_173,
    primitiveXmlSha256: "sha256:487f10d4bbc3e080ecad958a197dc6ff47d42236de799b0bf8517b7c3161ebb1",
    shellCanonicalSha256: "sha256:186f3d855b7cc9bfb494d6a0eb8f13ed58c58aa2730370a0f58da43432226664",
    shellVertexCount: 353,
    shellTriangleCount: 418,
    packedBinaryBytes: 9_252,
    collisionBoxCount: 2,
    connectorPrimitiveCounts: { Axel: 0, Custom2DField: 0, Fixed: 0, Hinge: 3, Slider: 0 },
  },
  {
    designId: "3819",
    revision: "R",
    itemId: "VX0003819",
    name: "MINI ARM, LEFT",
    manifestMd5: "dab11f7d65356b3c0491dfd329a65793",
    bundleSha256: "sha256:566fa3d083fbc5af52ccebcee1886306eb173af6fabf9069529808d505b84896",
    bundleBytes: 58_249,
    primitiveXmlSha256: "sha256:45a4f09e34db40620dd254bcf80eaa04b31b7a1c0b48f7ddc8f378c1f192e843",
    shellCanonicalSha256: "sha256:c51bb3c394bcc331705592c206feb683635a367a092a3ef2908529921e4afa63",
    shellVertexCount: 353,
    shellTriangleCount: 418,
    packedBinaryBytes: 9_252,
    collisionBoxCount: 2,
    connectorPrimitiveCounts: { Axel: 0, Custom2DField: 0, Fixed: 0, Hinge: 3, Slider: 0 },
  },
  {
    designId: "3820",
    revision: "G",
    itemId: "VX0003820",
    name: "11003820",
    manifestMd5: "3666080c3f58c1a5e91a9fafba336086",
    bundleSha256: "sha256:389fcff59bd2c4399a520281a766bd48f9d3fec87f393f749f56d2053d2be6ad",
    bundleBytes: 28_680,
    primitiveXmlSha256: "sha256:e154509bae0457601f7d9a8e6652c8f6b93b53780a7bd6f7b17e7caeac925480",
    shellCanonicalSha256: "sha256:aa24b3210bad2f40fd54feee71b6f817c763701f0d385145d1cb001b2511b335",
    shellVertexCount: 373,
    shellTriangleCount: 332,
    packedBinaryBytes: 8_460,
    collisionBoxCount: 6,
    connectorPrimitiveCounts: { Axel: 1, Custom2DField: 1, Fixed: 0, Hinge: 1, Slider: 1 },
  },
].map((evidence) => ({
  ...evidence,
  state: "builder-source-integrity-verified" as const,
  evidenceKind: "verified-component-bundle" as const,
  componentOnly: true as const,
  catalogAdmissionAtBaseline: "unadmitted" as const,
  sourceUrl: builderSourceUrl(evidence.designId, evidence.revision),
}));

const nativeRecordDigestByDesignId = new Map(
  SET_6651557_NATIVE_RECORD_DIGESTS.map((record) => [record.designId, record.recordSha256]),
);
if (
  nativeRecordDigestByDesignId.size !== NATIVE_PACK_DESIGN_IDS.length ||
  SET_6651557_NATIVE_RECORD_DIGESTS.some(
    ({ designId }) => !NATIVE_PACK_DESIGN_IDS.includes(designId),
  )
) {
  throw new Error(
    "Native record digest manifest must cover exactly the 107 precursor-pack designs.",
  );
}

const NATIVE_PACK_LEAVES = NATIVE_PACK_DESIGN_IDS.map((designId) => ({
  designId,
  state: "builder-source-integrity-verified" as const,
  evidenceKind: "native-pack-record" as const,
  evidenceArtifactId: "builder-native-pack-107" as const,
  recordKey: designId,
  recordSha256: nativeRecordDigestByDesignId.get(designId)!,
  componentOnly: false as const,
  catalogAdmissionAtBaseline: "unadmitted" as const,
}));

const REQUIRED_LEAVES = [
  ...NATIVE_PACK_LEAVES,
  ...COMPOSITE_COMPONENT_LEAVES,
  ...UNRESOLVED_BUILDER_LEAVES,
].sort((left, right) => Number(left.designId) - Number(right.designId));

const MISSING_TOP_LEVEL_ROUTES = [
  ...NATIVE_PACK_DESIGN_IDS.map((designId) => ({
    designId,
    route: "direct-native-pack-leaf" as const,
    leafDesignId: designId,
  })),
  ...UNRESOLVED_BUILDER_LEAVES.map(({ designId }) => ({
    designId,
    route: "direct-unresolved-leaf" as const,
    leafDesignId: designId,
  })),
  { designId: "76382", route: "composite" as const, compositeId: "76382;AO" },
].sort((left, right) => Number(left.designId) - Number(right.designId));

const SET_6651557_COVERAGE_LEDGER_DRAFT = {
  schemaVersion: "lego.set-catalog-coverage-ledger/1" as const,
  authority: {
    kind: "source-inventory-only" as const,
    catalogAdmitted: false,
    structuralValidityClaimed: false,
    physicalValidityClaimed: false,
    compositeTransformsClaimed: false,
    sourceIntegritySelfCertifiesCatalogTruth: false,
    admissionRequirements: [
      "independent part identity and catalog-frame verification",
      "reviewed source-attributed geometry and project-owned catalog, connector, collision, and provenance declarations",
      "catalog version and migration report",
      "catalog digest/run-pin update and executable regression coverage",
    ],
    rawPayloadPolicy: {
      repository: "excluded",
      distributablePackage: "excluded",
      modelTraining: "not-authorized",
      runtimeFetch: "forbidden",
    },
  },
  set: {
    instructionDocumentId: "6651557",
    modelSetId: "21066",
    sourceTopLevelPieceCount: 1_465,
    separatorTopLevelPieceCount: 1,
    assembledTopLevelPieceCount: 1_464,
    sourceLeafPartInstanceCount: 1_469,
    assembledLeafPartInstanceCount: 1_468,
    topLevelDesignCount: 172,
  },
  baselineCatalog: {
    version: "builtin.basic-parts/6",
    truthHash: "sha256:590a94c9b9498faace4b29b74c4c9ba8352d644365585d9aeb96b4a7c53bdb7f",
    identityNormalization:
      "numeric LDraw design ID after removing the optional trailing variant letter before .dat",
    coveredTopLevelDesignCount: 54,
    coveredTopLevelDesignIds: BASELINE_COVERED_TOP_LEVEL_DESIGN_IDS,
  },
  sourceArtifacts: {
    instructionBooklet: {
      logicalLocator: "recipes/6651557.pdf",
      bytes: 70_238_655,
      sha256: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
      role: "private reconstruction instructions",
    },
    officialModelXml: {
      logicalLocator: "output/official-model/vx1087034_21066_a.xml",
      bytes: 1_903_169,
      sha256: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
      role: "top-level and leaf inventory plus composite membership evidence",
    },
    officialModelLdr: {
      logicalLocator: "output/official-model/vx1087034_21066_a.ldr",
      bytes: 139_649,
      sha256: "sha256:096b78037ef1ee15a6dcff90b38f00f09465d0f5a246cb6f5f08fac087dd7bc2",
      role: "derived import cross-check only",
    },
    designDistribution: {
      logicalLocator: "output/official-model/design-distribution.tsv",
      bytes: 2_238,
      sha256: "sha256:997dbd0d5255950741f6fa690f08f0c3a06521597317cee74c1e3aa57664d94d",
      role: "derived top-level inventory cross-check only",
    },
    elementResolution: {
      logicalLocator: "output/part-identification/element-resolution.json",
      bytes: 34_042,
      sha256: "sha256:9fb2abe8f764f3381135b378c7940f63b69a77ed0f6db8a8f28ba2d8224b3a30",
      role: "element-to-design diagnostic cross-check only",
    },
    builderManifest: {
      logicalLocator: "lego-21066-vx1087034-a-android-manifest.json",
      bytes: 18_766,
      sha256: "sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
      role: "Builder revision and declared checksum identity",
    },
    builderCacheReport: {
      logicalLocator: "lego-21066-builder-assets/cache-report.json",
      bytes: 93_314,
      sha256: "sha256:bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8",
      role: "observed bundle checksum and byte-count evidence",
    },
    builderMissingAudit: {
      logicalLocator: "lego-21066-builder-audit/audit-report.json",
      bytes: 275_118,
      sha256: "sha256:c66a6ab711186f228234a4d70f7c0dabebc6d893895900c3bb672c01c501196f",
      role: "exact 118-missing-design extraction partition",
    },
    builderAllAudit: {
      logicalLocator: "lego-21066-builder-audit-all/audit-report.json",
      bytes: 1_881_665,
      sha256: "sha256:ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4",
      role: "all-requested Builder extraction cross-check",
    },
    builderNativePack: {
      logicalLocator: "lego-21066-builder-native-part-pack.json",
      bytes: 2_069_952,
      sha256: "sha256:e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d",
      role: "external precursor pack integrity envelope; not catalog truth",
    },
  },
  nativePack: {
    artifactId: "builder-native-pack-107",
    schemaVersion: "lego.builder-native-mesh-pack/1",
    frameId: "lego-builder-native-to-catalog-ldu/1",
    sourceManifestSha256: "sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
    sourceAuditSha256: "sha256:ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4",
    sourceCacheReportSha256:
      "sha256:bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8",
    packDeclaredCoverageSha256:
      "sha256:129099bc1e69bab95d70a46d414b61bde8d51fe67f8057a41e380a589101f4bd",
    packDeclaredCoverageBytesRetained: false,
    partCount: 107,
    vertexCount: 42_440,
    triangleCount: 38_549,
    binaryBytes: 971_868,
    binarySha256: "sha256:76830eb4832492e5416ad6920ab4f8167b6cf55725641cce162ac8f9f215b6c7",
    collisionBoxCount: 1_471,
    connectorPrimitiveCounts: { Axel: 80, Custom2DField: 239, Fixed: 19, Hinge: 9, Slider: 31 },
    recordBinding: {
      sourceArtifactKey: "builderNativePack" as const,
      wholeArtifactSha256:
        "sha256:e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d",
      collection: "parts" as const,
      keyField: "id" as const,
      requireExactUniqueDesignIdSet: true,
      verifyWholeArtifactBeforeUse: true,
      recordDigestProtocol: "lego.builder-native-mesh-pack/1 recordSha256" as const,
      recomputeRecordDigest: true,
    },
    recordDigestManifestSha256:
      "sha256:3d39f460a900f8b8689949807714def7afcd92a8295846215b7c95d7160e1cf1",
    recordDigests: SET_6651557_NATIVE_RECORD_DIGESTS,
    designIds: NATIVE_PACK_DESIGN_IDS,
  },
  compositeComponentLeaves: COMPOSITE_COMPONENT_LEAVES,
  unresolvedBuilderLeaves: UNRESOLVED_BUILDER_LEAVES,
  composites: [
    {
      topLevelDesignId: "76382",
      sourceDesignId: "76382;AO",
      topLevelOccurrenceCount: 1,
      sourceLeafInstanceCount: 5,
      elementId: "6313021",
      publishedPartNum: "973c27h27",
      publishedName: "Torso, White Arms and Hands [Plain]",
      state: "composite-source-identified" as const,
      catalogAdmissionAtBaseline: "unadmitted" as const,
      scope: "coverage membership only; relative catalog transforms are not claimed",
      membershipEvidenceArtifactKey: "officialModelXml" as const,
      elementIdentityEvidenceArtifactKey: "elementResolution" as const,
      sourceParentBrickUuid: "2d36f089-87da-44d0-b2c6-85a3bcd459b8",
      membershipSha256: "sha256:4c4203739e250eaecca3b065885834bb155853f24a5da595a8eca9192fadb2fd",
      components: [
        { designId: "3814", revision: "X", quantity: 1 },
        { designId: "3818", revision: "P", quantity: 1 },
        { designId: "3819", revision: "R", quantity: 1 },
        { designId: "3820", revision: "G", quantity: 2 },
      ],
    },
  ],
  missingTopLevelRoutes: MISSING_TOP_LEVEL_ROUTES,
  requiredLeaves: REQUIRED_LEAVES,
  counts: {
    missingTopLevelDesigns: 118,
    directNativePackLeaves: 107,
    compositeComponentDesigns: 4,
    sourceIntegrityVerifiedLeaves: 111,
    unresolvedBuilderLeaves: 10,
    requiredNewLeafDesigns: 121,
    compositeComponentInstances: 5,
    sourceIntegrityBoundRawVertexCount: 44_654,
    sourceIntegrityBoundRawTriangleCount: 40_929,
    sourceIntegrityBoundPackedBinaryBytes: 1_026_996,
    sourceIntegrityBoundRawCollisionBoxCount: 1_495,
    sourceIntegrityBoundRawConnectorPrimitiveCounts: {
      Axel: 82,
      Custom2DField: 243,
      Fixed: 23,
      Hinge: 18,
      Slider: 32,
    },
  },
  setDigests: {
    algorithm: "sha256 of UTF-8 JSON.stringify([...designIds].sort())",
    coveredTopLevel54: "sha256:80db55eb5ae033410bc3746b1df1a6286cb822777e2f0200ec547a7679e4a788",
    topLevel172: "sha256:74efdad045d1e5d2c453eb564d34b0eea47760557a7f767a17e12edfc15f2dfe",
    nativePack107: "sha256:29205325da10fc62545ae0fe01a5e3109cf6971e2ab5edd85f69df68bed888e2",
    unresolved10: "sha256:35d1512c815740676494ff476575bd2deb28936ee2acbde805f98ef9a0ceaa83",
    compositeComponents4: "sha256:2c35c8d24217d639fe336e494554443f2f008061e97b68738d2e241351fc284f",
    missingTopLevel118: "sha256:80e33daef66dc3164c9a1d087a19b2c709a16eb60659ce87ef6c213492a7e33e",
    requiredLeaves121: "sha256:6d4b2f1bbff91928da9f8315c77ae757d8f138842ac974b9a017099b54a16e49",
  },
};

assertSet6651557CoverageLedgerShape(SET_6651557_COVERAGE_LEDGER_DRAFT);

export const SET_6651557_COVERAGE_LEDGER = deepFreeze(SET_6651557_COVERAGE_LEDGER_DRAFT);
