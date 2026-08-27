const deepFreeze = (value) => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const BUILDER_2453_IDENTITY_SCHEMA = "lego.part-identification-2453-builder-identity/1";
export const BUILDER_2453_IDENTITY_ROUTE = "builder-2453-I-6595205-to-2453b/1";

export const CURRENT_BUILDER_2453_IDENTITY_PINS = deepFreeze({
  officialModel: {
    path: "output/official-model/vx1087034_21066_a.xml",
    bytes: 1_903_169,
    digest: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  },
  builderManifest: {
    path: "C:/tmp/lego-21066-vx1087034-a-android-manifest.json",
    bytes: 18_766,
    digest: "sha256:3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
    generated: "2026-08-02T21:37:24.5936412+00:00",
    brickCount: 175,
    decorationCount: 2,
  },
  builderBundle: {
    path: "C:/tmp/lego-21066-builder-assets/2453-I-android.bundle",
    bytes: 82_073,
    digest: "sha256:a14c214b69dc57b3123c96e4e15b92f5bd4541d5b8eccfc3885e0bcb5d30a955",
  },
  builderBundleProof: {
    path: "output/real-build/part-identification-2453-builder-bundle-proof.json",
    bytes: 2_603,
    digest: "sha256:86196d880b405b1fc4516cbdfba1d7fbedd6746d2d7a56079b927d718f036f11",
    schemaVersion: "lego.part-identification-2453-builder-bundle-proof/1",
    environmentContractSha256:
      "sha256:c4cc3cf7e9e066258688bc9fcace54e0b5c32d39f01956f07d1aff9c25dba80b",
    unityPyVersion: "1.25.3",
    primitivePathId: "-6688524684917211877",
    partinfoPathId: "-5616863914101638823",
    shellPathId: "-4781304290267089130",
    roster: [
      {
        pathId: "-8850176407552686250",
        type: "Mesh",
        serializedBytes: 1_044,
        name: "VME_11002453_LEG_Front_1",
        locators: ["assets/geometry/2453/2453.fbx"],
      },
      {
        pathId: "-6688524684917211877",
        type: "TextAsset",
        serializedBytes: 3_092,
        name: "2453",
        locators: ["assets/geometry/2453/2453.xml"],
      },
      {
        pathId: "-5616863914101638823",
        type: "TextAsset",
        serializedBytes: 104,
        name: "partinfo",
        locators: ["assets/geometry/2453/partinfo.json"],
      },
      {
        pathId: "-4781304290267089130",
        type: "Mesh",
        serializedBytes: 6_980,
        name: "Shell",
        locators: ["assets/geometry/2453/2453.fbx"],
      },
    ],
  },
  nativePack: {
    path: "C:/tmp/lego-21066-builder-native-part-pack.json",
    bytes: 2_069_952,
    digest: "sha256:e5bb745faa79c5e7cb525eb0a11a8443815a0c4805c85644204b26c462ac636d",
    schemaVersion: "lego.builder-native-mesh-pack/1",
    frameId: "lego-builder-native-to-catalog-ldu/1",
    partCount: 107,
    binaryBytes: 971_868,
    binarySha256: "76830eb4832492e5416ad6920ab4f8167b6cf55725641cce162ac8f9f215b6c7",
    sourceAuditSha256: "ab85e95fa94267b19dd16a160d270e48bf752926697c893db01b0597e7a8f4c4",
    sourceCacheReportSha256: "bf853ffadc349f43f13cf24c2f790a9bc556103c1c96fb24ad064aa502e475d8",
    sourceCoverageSha256: "129099bc1e69bab95d70a46d414b61bde8d51fe67f8057a41e380a589101f4bd",
    sourceManifestSha256: "3e57aa4df4ab5327c5b8408912d056ba73b93cd98e769e41d6aabaf6cb0618a6",
  },
  officialLdraw: {
    archive: {
      path: "C:/tmp/ldraw-complete-2026-07.zip",
      bytes: 144_722_356,
      digest: "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
    },
    solidRoot: {
      path: "ldraw/parts/2453b.dat",
      bytes: 801,
      digest: "sha256:3c7caddd91a2467243cf3f3bd0bdd8ee8fa1cbd5435591a6491841ee1ca49b01",
    },
    hollowRoot: {
      path: "ldraw/parts/2453a.dat",
      bytes: 1_517,
      digest: "sha256:457ff62a325babfceea10b02c7933d09ca422a0479fa51e9b1623b56f543a0c3",
    },
    solidStud: {
      path: "ldraw/p/stud.dat",
      bytes: 698,
      digest: "sha256:db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4",
    },
    hollowStud: {
      path: "ldraw/p/stud2a.dat",
      bytes: 866,
      digest: "sha256:61fbed54b085a30490045309778d1e2a6d95485e6558996b12674f848028d557",
    },
  },
  ldcadShadow: {
    commit: "15aa1e718b6a8da37d24fc7af5e52e262c041bfb",
    manifestSha256: "sha256:668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f",
    solidRoot: {
      path: "parts/2453b.dat",
      bytes: 278,
      digest: "sha256:6df3667f18160745afcac6f654164726b7d151e16ee154b281c61292c094a9e4",
    },
    hollowRoot: {
      path: "parts/2453a.dat",
      bytes: 279,
      digest: "sha256:166da63fe9a3df61bb67930814ce3544a898e3b3830434ca9a8e04799da2a712",
    },
    solidStud: {
      path: "p/stud.dat",
      bytes: 242,
      digest: "sha256:15baeb9414a00fac4d1614f97abdc5c6350df7c8a22a2daa4c369f66e611d4db",
    },
    hollowStud: {
      path: "p/stud2a.dat",
      bytes: 582,
      digest: "sha256:d316e281be1503e4b98cba6274f3974841851686d11c779da1397583bd0efb79",
    },
  },
  builderScope: {
    designId: "2453",
    designRevision: "2453;I",
    itemNo: "6595205",
    materialId: "140",
    brickRecords: [
      {
        brickRef: "0696eec0-5ee4-4f0a-952b-e49796d7ce91",
        partRef: "30611ae3-a5d2-4a32-b5cb-25accc948813",
        boneRef: "4c1518e2-99b1-46a0-a1f6-35ba65de62c9",
      },
      {
        brickRef: "4d39f87c-2c3c-4669-91cf-7f8b086901fe",
        partRef: "1d51da6f-5311-4693-851d-a24516f49d9f",
        boneRef: "960d1c21-ef85-4959-b952-d8a778449104",
      },
      {
        brickRef: "4e4a144a-9cbc-4a4e-a027-4ece957da974",
        partRef: "e2353be1-8d56-4a00-baa0-731622c61221",
        boneRef: "0fef2c71-d29e-46eb-9c64-2a0acf1c400f",
      },
      {
        brickRef: "8c0bff46-045f-47bc-b09b-e77b208dee1f",
        partRef: "e4e82d9d-aaf1-49f2-84c6-4bfe6f55c3ec",
        boneRef: "5ad8f0bb-035f-4e84-9c99-0ecd0bb1ae95",
      },
      {
        brickRef: "cf359e97-0527-4524-84a3-3df5f65a049c",
        partRef: "09ef8afa-3787-4459-8dd2-7b6aaf54cd27",
        boneRef: "29741f0e-af8c-4d38-99d2-8fcc19aad6ba",
      },
      {
        brickRef: "d413dd99-d11a-454e-ad6e-20e03b7a1a2a",
        partRef: "fa9ee8e9-7ba9-45a5-bc50-1fad4aa3bfb9",
        boneRef: "4c1d20db-a912-4fd4-b4e1-922263e48fac",
      },
    ],
  },
  nativeRecord: {
    id: "2453",
    revision: "I",
    itemId: "VX0002453",
    name: "11002453",
    superDesign: "11002453",
    platform: "Android",
    sourceUrl: "https://api.prod.dbix.i.lego.com/api/v1/Bricks/2453?Revision=I&Platform=Android",
    positionByteOffset: 13_236,
    positionCount: 126,
    indexByteOffset: 14_748,
    indexCount: 276,
    manifestMd5: "d424b52bf93cb9c1a8e887348ef221a5",
    primitiveXmlSha256: "9a41181ed911c743fdcccce3bafe03f3e253f4eebd4a0e43811840a70063ba10",
    bundleSha256: "a14c214b69dc57b3123c96e4e15b92f5bd4541d5b8eccfc3885e0bcb5d30a955",
    meshCanonicalSha256: "af1699d04608e04162287e11c0a1c50220f7c7a266bdc494570e0691294a9de6",
    recordSha256: "1d6bb19c25445871fa29393fba06bafa7299f05cc381dfc94c243c749df7ae71",
    boundsLdu: {
      min: [-10, -120.00000762939453, -10.000000953674316],
      max: [10.000000953674316, 0, 10],
    },
  },
  catalog: {
    version: "builtin.basic-parts/28",
    partId: "builtin:brick-1x1x5-solid-stud",
    ldrawId: "2453b.dat",
    assetId: "ldraw:official:2453b.dat",
    geometryContentHash: "sha256:a7902342c7724f702fa9eeb106c518c3e1f20a05b041c967aef020e580c3d2c3",
    closureBytes: 7_370,
    closureManifestSha256:
      "sha256:28333adba88bce3f02b75f74ee3b16e320580ff837c08c5067091e22c6ebb1f9",
    vertexCount: 97,
    triangleCount: 76,
    assetToCatalogFrame: {
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, -60, 0],
    },
  },
  frame: {
    orientationId: "upright-yaw-0",
    assetToCatalogMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    builderToLdrawMatrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
    builderToLdrawTranslationLdu: [0, 120, 0],
    expectedBuilderToCatalogMatrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
    expectedBuilderToCatalogTranslationLdu: [0, 60, 0],
    normalizedOrientation: [1, 0, 0, 0, -1, 0, 0, 0, -1],
    determinant: 15_625,
    normalizedDeterminant: 1,
    builderSolidStudCenter: [0, 4.8, 0],
    builderClutchCenter: [0, 0, 0],
    catalogStud: { positionLdu: [0, -60, 0], normal: [0, -1, 0] },
    catalogClutch: { positionLdu: [0, 60, 0], normal: [0, 1, 0] },
  },
  expectedArtifact: {
    bytes: 6_730,
    digest: "sha256:087a8f0308bdf83a7a585196acb4f695409350367e311b38dbb7920038d1f5d4",
  },
});

export const BUILDER_2453_IDENTITY_AUTHORITY = deepFreeze({
  identityAdjudication: true,
  localPartFrameRoute: true,
  sourceExecution: false,
  preparedRun: false,
  productionAssignment: false,
  printedIdentity: false,
  physicalFrame: false,
  action: false,
  placement: false,
  documentMutation: false,
  replay: false,
  acceptance: false,
  completion: false,
});
