export type BuilderFramePoint = readonly [number, number, number];

export interface BuilderTriangleSlicePin {
  readonly format: "lego.builder-shell-triangles-f32le/1" | "lego.ldraw-expanded-triangles-f32le/1";
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly digest: `sha256:${string}`;
  readonly triangleCount: number;
}

export interface BuilderDesignSourcePin {
  readonly designRevision: string;
  readonly catalogPartId: string;
  readonly sourceIdentity: {
    readonly bundleSha256: `sha256:${string}`;
    readonly manifestMd5: `md5:${string}`;
    readonly primitiveXmlSha256: `sha256:${string}`;
    readonly shellPathId: string;
    readonly shellCanonicalSha256: `sha256:${string}`;
    readonly shellVertexCount: number;
    readonly shellTriangleCount: number;
    readonly ldrawOfficialArchiveSha256: `sha256:${string}`;
    readonly ldrawUnofficialArchiveSha256: `sha256:${string}`;
    readonly ldrawClosureSha256: `sha256:${string}`;
  };
  readonly builderGeometry: BuilderTriangleSlicePin;
  readonly ldrawReferenceGeometry: BuilderTriangleSlicePin;
  readonly ldrawToCatalogLocalTransform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
  readonly builderStudCentersLdu: readonly BuilderFramePoint[];
  readonly builderStudCentersDigest: `sha256:${string}`;
  readonly uniqueBuilderVertexCount: number;
  readonly expectedCatalogDefinitionDigest: `sha256:${string}`;
  readonly expectedCatalogGeometryDigest: `sha256:${string}`;
  readonly expectedCatalogConnectorDigest: `sha256:${string}`;
  readonly expectedCatalogCollisionDigest: `sha256:${string}`;
}

export interface BuilderCalibrationCasePin {
  readonly brickRef: string;
  readonly builderTransformationDigest: `sha256:${string}`;
  readonly expectedTransform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
}

export const BUILDER_STEP1_OFFICIAL_MODEL_DIGEST =
  "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922" as const;

export const BUILDER_STEP1_GEOMETRY_BUNDLE = {
  format: "lego.builder-shell-and-ldraw-triangles-f32le/2",
  byteLength: 122_688,
  digest: "sha256:4c03dc3f534e7eab78da7e9c61bf3a539de064a01aa829b18023ac86340f8450",
} as const;

const LDRAW_OFFICIAL_ARCHIVE =
  "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae" as const;
const LDRAW_UNOFFICIAL_ARCHIVE =
  "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4" as const;
export const BUILDER_STEP1_LDRAW_CLOSURE_DIGEST =
  "sha256:588e47260fc03cdc0fc2fea3bf8a0c5eef62818b0b41dd028aea859031af3fa6" as const;
export const BUILDER_STEP1_DESIGN_SOURCES = [
  {
    designRevision: "30565;E",
    catalogPartId: "builtin:corner-plate-4x4-round",
    sourceIdentity: {
      bundleSha256: "sha256:955ce425a8ddf4b12d320260d627df3f3fb46c52fedaf70f1d562b0e1efa7c93",
      manifestMd5: "md5:a586e0381c918e42b21b0360cdfe94cc",
      primitiveXmlSha256: "sha256:ecbaf1354eeb1fb7f001508869228ba19f44268ca8aaab7bd6312f57e3db6578",
      shellPathId: "-2382827459408350605",
      shellCanonicalSha256:
        "sha256:8b41bc4bed4f2e9ee8ddd49b6ed74b52035c1b4f86507d838db56bb55deec8b2",
      shellVertexCount: 294,
      shellTriangleCount: 236,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 0,
      byteLength: 8_496,
      digest: "sha256:e6f4de945ace46a977e9b250ad3c10398415d1240c6524182a95fbb45cc6cb3a",
      triangleCount: 236,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 37_440,
      byteLength: 49_248,
      digest: "sha256:46aa56e00a305b75690fcaf8493e296d999648053f28953c5572fd8a638ec64d",
      triangleCount: 1_368,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-0",
    },
    builderStudCentersLdu: [
      [0, -8, -60],
      [0, -8, -40],
      [0, -8, -20],
      [0, -8, 0],
      [20, -8, -40],
      [20, -8, -20],
      [20, -8, 0],
      [40, -8, -40],
      [40, -8, -20],
      [40, -8, 0],
      [60, -8, 0],
    ],
    builderStudCentersDigest:
      "sha256:7533437f380d7a9f23d1150ca08a8ee58fa1608c96108f2279ea5db7e524b59f",
    uniqueBuilderVertexCount: 127,
    expectedCatalogDefinitionDigest:
      "sha256:298bb0f4b2a107a521c3569b05b0c6a0ed18f627e5f2bc41f97ff3fd364b5e0b",
    expectedCatalogGeometryDigest:
      "sha256:8f1673f6e9d8d8cd605ae0523477a7fb315d267e2ca139f3cf11a77aeb4fac58",
    expectedCatalogConnectorDigest:
      "sha256:e1c23184c8a3ae2dc50a4d0b71fae3bf4fee414d2c041490ae60436d735bb86a",
    expectedCatalogCollisionDigest:
      "sha256:a220fecc8192e1b28018a732b89047ca24c0ebd101f32ac4f4ee239f6c8f05d8",
  },
  {
    designRevision: "80015;E",
    catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
    sourceIdentity: {
      bundleSha256: "sha256:f3a11d40f9de9fa54670bdd87db0a87e034896d87b56e64e9f382c3ef0098c75",
      manifestMd5: "md5:bb72d5b5609e411392df36903c8c5daa",
      primitiveXmlSha256: "sha256:ad9aca4ca7275358e2f680ad154b5f577f8fc79b87a8ea1c60aea4558a0a23bc",
      shellPathId: "3328116897400514273",
      shellCanonicalSha256:
        "sha256:946c5c5782c36a44883200cc57e150c43bef2f4b8e8444257cfcb49952327723",
      shellVertexCount: 928,
      shellTriangleCount: 804,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 8_496,
      byteLength: 28_944,
      digest: "sha256:130309ee4bf88b886982d6c81f79584a55b161e165220f2b0328e1d3a1529b33",
      triangleCount: 804,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 86_688,
      byteLength: 36_000,
      digest: "sha256:685a8ad17a0882dc5fc8493abd7280c7962956f88c6c662859c80957bd1ed463",
      triangleCount: 1_000,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-0",
    },
    builderStudCentersLdu: [
      [-80, -8, 80],
      [-60, -8, 80],
      [-20, -8, 60],
      [0, -8, 0],
      [0, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:fcb9e7ebe34ecd586ea7e2ce826005bf22b0227b892261173263c49ae3e30f2f",
    uniqueBuilderVertexCount: 430,
    expectedCatalogDefinitionDigest:
      "sha256:d3ba651ebe38373e51bd8819185b65a67ee422b90a2a86a0c3dd3320f9aaf40c",
    expectedCatalogGeometryDigest:
      "sha256:219faec905cef376d05b5769ef055041875ba1a01ae8ebec81b864f24c9664e4",
    expectedCatalogConnectorDigest:
      "sha256:e63591f952a84357a7c4fd2462ee1828d9b1510bc02e799292be1d879fcb8b97",
    expectedCatalogCollisionDigest:
      "sha256:26bcf626f81a915874df281b8a4bb1f586c322ae23e27990cc184caf27f85950",
  },
] as const satisfies readonly BuilderDesignSourcePin[];

export const BUILDER_STEP1_CALIBRATION_CASES = [
  {
    brickRef: "a12d1753-e853-4589-bc67-e1cb4e784fa7",
    builderTransformationDigest:
      "sha256:ba9b5cb293247b9222b123c4d95b66e4ba7d6752fc60de74feb35d31aeef34ad",
    expectedTransform: { positionLdu: [270, -16, 244], orientationId: "upright-yaw-0" },
  },
  {
    brickRef: "da6a6d03-1c34-43ff-97e9-5939ccf26777",
    builderTransformationDigest:
      "sha256:6e6e61a4b108dde4eadc59ecff258a2c87658727a9117af2a9d8db1d2160c1d2",
    expectedTransform: { positionLdu: [270, -580, 104], orientationId: "upright-yaw-90" },
  },
  {
    brickRef: "d63813bf-f3b6-4059-b5de-6605e8baf320",
    builderTransformationDigest:
      "sha256:65d39c9641261db0a54ce361f501594ba6d0f1fc660be10ed5ed5869430d61ec",
    expectedTransform: { positionLdu: [390, -572, 104], orientationId: "upright-yaw-180" },
  },
  {
    brickRef: "55506c77-f293-40f5-8aa7-ea85501f07f1",
    builderTransformationDigest:
      "sha256:aa2a689c493fc4d244e55c72eb122791350195c40fc252a6adaf4d38138aa25b",
    expectedTransform: { positionLdu: [410, -580, 104], orientationId: "upright-yaw-270" },
  },
] as const satisfies readonly BuilderCalibrationCasePin[];

export const BUILDER_STEP1_ORIGIN_POLICY = {
  protocol: "first-ordered-direct-empty-enumeration/1",
  anchorBrickRef: "76092bf0-3d72-474a-baf3-06b837082f6a",
  anchorBuilderTransformationDigest:
    "sha256:b17eb49ceb81e036753fd1bc9a1a4d0cf60c945cf8a98311c589e6e981dd7f82",
  expectedComposedTransform: {
    positionLdu: [540, -4, 194],
    orientationId: "upright-yaw-180",
  },
  expectedEmptyEnumerationTransform: {
    positionLdu: [0, 8, 0],
    orientationId: "upright-yaw-180",
  },
} as const;
