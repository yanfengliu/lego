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
  byteLength: 1_091_772,
  digest: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
} as const;

const LDRAW_OFFICIAL_ARCHIVE =
  "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae" as const;
const LDRAW_UNOFFICIAL_ARCHIVE =
  "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4" as const;
/** The 102-file official closure of all fifteen roots; `builder_calibration_sources.py` holds it. */
export const BUILDER_STEP1_LDRAW_CLOSURE_DIGEST =
  "sha256:8674c2d085b3ddd3690cec5832e4c14f5e9705ddbeccc3a9249b4a41e50d8823" as const;
/**
 * Every design revision the set 6651557 build places whose Builder frame is pinned.
 *
 * A row is a *source* pin, not a result: the exact Builder bundle and decoded
 * Shell it came from, the two byte slices it owns in the geometry bundle, its
 * authored type-23 stud lattice, and the catalog digests it was reviewed
 * against. The catalog-to-Builder frame is derived from these on every run and
 * is deliberately absent here, so a wrong frame cannot be pinned into existence.
 *
 * `ldrawToCatalogLocalTransform` is the one measured choice a row carries. It is
 * derived once from the LDraw-measured stud centres against the same catalog
 * stud connectors, and every run re-checks it: Builder's own Shell vertices must
 * land within 2 LDU of the LDraw surface it places, which a wrong quarter turn
 * misses by tens of LDU.
 *
 * 41769;G is absent and that is a measurement, not an omission. The 175-brick
 * Builder manifest lists it at revision G with md5 cab7c4020d384b66e079c5c86bb40f03,
 * but the local 159-bundle capture does not hold it, so there is no Shell mesh to
 * corroborate a frame with and no type-23 field to derive one from. Its catalog
 * part `builtin:wedge-plate-2x4-right` already exists; only the source is missing.
 */
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
      byteLength: 8496,
      digest: "sha256:e6f4de945ace46a977e9b250ad3c10398415d1240c6524182a95fbb45cc6cb3a",
      triangleCount: 236,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 72000,
      byteLength: 49248,
      digest: "sha256:46aa56e00a305b75690fcaf8493e296d999648053f28953c5572fd8a638ec64d",
      triangleCount: 1368,
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
      "sha256:f09a14102082295135c4a651124e782462dbd6f22ec516c9673ea7554b745ee1",
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
      byteOffset: 8496,
      byteLength: 28944,
      digest: "sha256:130309ee4bf88b886982d6c81f79584a55b161e165220f2b0328e1d3a1529b33",
      triangleCount: 804,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 121248,
      byteLength: 36000,
      digest: "sha256:685a8ad17a0882dc5fc8493abd7280c7962956f88c6c662859c80957bd1ed463",
      triangleCount: 1000,
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
      "sha256:0766097c26275cbd477c0088ed9b6be15d9872cae8e422731c10b33bb3bb8857",
    expectedCatalogGeometryDigest:
      "sha256:219faec905cef376d05b5769ef055041875ba1a01ae8ebec81b864f24c9664e4",
    expectedCatalogConnectorDigest:
      "sha256:e63591f952a84357a7c4fd2462ee1828d9b1510bc02e799292be1d879fcb8b97",
    expectedCatalogCollisionDigest:
      "sha256:26bcf626f81a915874df281b8a4bb1f586c322ae23e27990cc184caf27f85950",
  },
  {
    designRevision: "3020;L",
    catalogPartId: "builtin:plate-2x4",
    sourceIdentity: {
      bundleSha256: "sha256:a0bee312fc74b5f7f054c255b020933d9afb43a9feac6f12012749b6f659a030",
      manifestMd5: "md5:e94e8489ac5f11afd887ba07ab754f21",
      primitiveXmlSha256: "sha256:53708ef9472a1fe21e9fb6d2c2272cc9b891690cf3cfe7021169d8e108f04c59",
      shellPathId: "-3965320204972781753",
      shellCanonicalSha256:
        "sha256:3fa58d39e1ec1038e12ecbcdc57c0da0089324716b82140345590089fbbb3163",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 37440,
      byteLength: 1008,
      digest: "sha256:360596e152a3693e6f891859f7dca62b04a64b36f31df38e7b09ed5c8c78194f",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 157248,
      byteLength: 25200,
      digest: "sha256:21a0b912516255248a4e94c6fd697eba22c32f874858f79b7f07ae18f2927293",
      triangleCount: 700,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [20, -8, 0],
      [20, -8, 20],
      [40, -8, 0],
      [40, -8, 20],
      [60, -8, 0],
      [60, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:bce3a4b7c27d844d355de67159ece54babc6262e0abb5d674022465183c52d69",
    uniqueBuilderVertexCount: 16,
    expectedCatalogDefinitionDigest:
      "sha256:0e0fab9dce1736620ca9e77d288c2dcd36580b25c3c0428b022e6095cf668048",
    expectedCatalogGeometryDigest:
      "sha256:0c0b5933e2a22909740156e3c8c48b507ac3b4d84dffc8fc7021c5c4308cfa61",
    expectedCatalogConnectorDigest:
      "sha256:1603c98cb725564e9a55f3632d57d9246395b4930ef9204cb0527acff6845960",
    expectedCatalogCollisionDigest:
      "sha256:6f68aae320d103826ab4f103847129e9ff4f7946056004b15d514e0a25dcc517",
  },
  {
    designRevision: "3032;F",
    catalogPartId: "builtin:plate-4x6",
    sourceIdentity: {
      bundleSha256: "sha256:a771edd53c9739b178ea7915cf8f284834de230572ed63f5ce88ac392f4f25dc",
      manifestMd5: "md5:fb597adab7652d1a96d19795de97545e",
      primitiveXmlSha256: "sha256:3c3c76eb36d1f6ed49c0b2c5c1af9619f6ece30542230af644f346f2980a7e22",
      shellPathId: "-6153107707984632065",
      shellCanonicalSha256:
        "sha256:c2649659638ea67820eea88811d38a742189e9a87cec2878fda4a6baea967da4",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 38448,
      byteLength: 1008,
      digest: "sha256:21bbef26d0c5d88afc20c29c835db4849c91e2f3a05cddc32c6a00420c2f4781",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 182448,
      byteLength: 94320,
      digest: "sha256:b344f62b81992a79e2167e592c59095bedbaaa77df60485f4c41cd7c86fc779d",
      triangleCount: 2620,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [0, -8, 40],
      [0, -8, 60],
      [20, -8, 0],
      [20, -8, 20],
      [20, -8, 40],
      [20, -8, 60],
      [40, -8, 0],
      [40, -8, 20],
      [40, -8, 40],
      [40, -8, 60],
      [60, -8, 0],
      [60, -8, 20],
      [60, -8, 40],
      [60, -8, 60],
      [80, -8, 0],
      [80, -8, 20],
      [80, -8, 40],
      [80, -8, 60],
      [100, -8, 0],
      [100, -8, 20],
      [100, -8, 40],
      [100, -8, 60],
    ],
    builderStudCentersDigest:
      "sha256:2b373e6aed0904355cfb215e88d7f26a42f4be7c4c63b891e0002fa43a588354",
    uniqueBuilderVertexCount: 16,
    expectedCatalogDefinitionDigest:
      "sha256:7ed880b4494bd6298aab6d282a886f4af1355eed65673e39d13185eda9905bf1",
    expectedCatalogGeometryDigest:
      "sha256:8f528dd598b8d2474cfe9efd6cce283fc57062ed0813b26a2275259f49648e03",
    expectedCatalogConnectorDigest:
      "sha256:7bdb6685d7e9b0b6f33dc3761cd3ffdbf7ebb4b3038b2aed6559a425bacf5466",
    expectedCatalogCollisionDigest:
      "sha256:efd32dd96fd15f1f0c4631ab03f965c06246b7eae2dc6f5e71f2ca776f0325b3",
  },
  {
    designRevision: "3034;J",
    catalogPartId: "builtin:plate-2x8",
    sourceIdentity: {
      bundleSha256: "sha256:0f04e02b9340cca5be83af43e1b767f49125916c272cf6351d2952dff4c90b06",
      manifestMd5: "md5:4437cadcf615b381b85ff21ad92eafed",
      primitiveXmlSha256: "sha256:05f84da04c57a0019233b91389de0b78c2d10f2f9d5a0e1db9ba7e4ff68fdc58",
      shellPathId: "3859792364607955227",
      shellCanonicalSha256:
        "sha256:15d430abff3cf43b61fac344cc70f64f460b821b5fc9640f2e06a4b4b6e268d4",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 39456,
      byteLength: 1008,
      digest: "sha256:aeefe66eec91f955b603bf00e0bf887ffddaabd7f8b96b8ca8c7a006c60220e6",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 276768,
      byteLength: 52848,
      digest: "sha256:f6c828a66e2db69bbb501c7e648597a50322c2fcb2e4c8355b4b7076d41502b2",
      triangleCount: 1468,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [20, -8, 0],
      [20, -8, 20],
      [40, -8, 0],
      [40, -8, 20],
      [60, -8, 0],
      [60, -8, 20],
      [80, -8, 0],
      [80, -8, 20],
      [100, -8, 0],
      [100, -8, 20],
      [120, -8, 0],
      [120, -8, 20],
      [140, -8, 0],
      [140, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:3182b79c00b7cbfdedc29aa8fa853b9653b774b66ef2a183b90da0a651951f57",
    uniqueBuilderVertexCount: 20,
    expectedCatalogDefinitionDigest:
      "sha256:2c8a97ae88cdf0067600708ca28810bef5191b5c52e44dda219be8c076350ac8",
    expectedCatalogGeometryDigest:
      "sha256:33a3403020653ff144d39be49161528a3017aeeade6a5e98af87b1ea8837dacb",
    expectedCatalogConnectorDigest:
      "sha256:e125fef68f4d83c7f58c31dbd70a2dca6540443124551b81ca9ca4cdf59940f1",
    expectedCatalogCollisionDigest:
      "sha256:9bba4b94b848d95d5527f14d8c63521d0dcb9000f6ee30aa5cc9ff170201a1f5",
  },
  {
    designRevision: "3460;N",
    catalogPartId: "builtin:plate-1x8",
    sourceIdentity: {
      bundleSha256: "sha256:65a1b563ac9b1eae6dd061596e098d452e10dba61adb7b993242aa0c3be3366f",
      manifestMd5: "md5:91de0a11eaf6382628b21df9315db47c",
      primitiveXmlSha256: "sha256:9234ac62260e0294c71288a9fb10960e58eb7db4638f75675e1f796a0696312d",
      shellPathId: "-5167410168576913850",
      shellCanonicalSha256:
        "sha256:343b54d4f5304c69c463a29667d5018dc325e22f2426de384395aac37784011b",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 40464,
      byteLength: 1008,
      digest: "sha256:7a345910847ea54ec37e5549062c1d1a90260f01dceda32cecbbf9fc6570f1c1",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 329616,
      byteLength: 26928,
      digest: "sha256:fcb9df98cc230d8068f4db80767da78f4e562ba946fa7e14d4554b85bc519616",
      triangleCount: 748,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [20, -8, 0],
      [40, -8, 0],
      [60, -8, 0],
      [80, -8, 0],
      [100, -8, 0],
      [120, -8, 0],
      [140, -8, 0],
    ],
    builderStudCentersDigest:
      "sha256:f8599418717dc565b5003d8fec802b17fbee7b7f61e568205721380f0c665efc",
    uniqueBuilderVertexCount: 20,
    expectedCatalogDefinitionDigest:
      "sha256:2e3b4db2f7a4b8c215e80330be2e2a83ad44306675514c3f31a743777d89c1a3",
    expectedCatalogGeometryDigest:
      "sha256:f895726dbc35db4259d7529be827c9ee957e539927096119652497fbab64335f",
    expectedCatalogConnectorDigest:
      "sha256:6f53826b93e57a053c30dfefb01b32b73038402c6091920066edaf304ef37ecf",
    expectedCatalogCollisionDigest:
      "sha256:6e6698c92819bc2ae7c3480717f6cbb7032ff99c5901fd6b06d6653e9833c3ed",
  },
  {
    designRevision: "3795;I",
    catalogPartId: "builtin:plate-2x6",
    sourceIdentity: {
      bundleSha256: "sha256:b7e896b1d881d51fb6195095e41127b30cee5ab64d56c20d77de4049a881cbd2",
      manifestMd5: "md5:556f571c51499e6c64393b1f9011d9f7",
      primitiveXmlSha256: "sha256:107fa36c4b2ef06a729a96ec5cb1670aa74de39aecf0fb98657d8ed50c281324",
      shellPathId: "4098456159558082482",
      shellCanonicalSha256:
        "sha256:6663280aa115d666032144f5131ccf188c24e8ff4cafc197893d29f2681eba2b",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 41472,
      byteLength: 1008,
      digest: "sha256:ecf4447f852680ab14c09d19a9e604840cc5974d8140d6102e8820653f29f3ca",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 356544,
      byteLength: 39024,
      digest: "sha256:49e89a57ae6a6ddefa0026e506d231c178c46128ad64a04a1bc4c89dee644bfd",
      triangleCount: 1084,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [20, -8, 0],
      [20, -8, 20],
      [40, -8, 0],
      [40, -8, 20],
      [60, -8, 0],
      [60, -8, 20],
      [80, -8, 0],
      [80, -8, 20],
      [100, -8, 0],
      [100, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:561b7e584adfa2905a2c6d6b76238e59522aee78f3b007cad03e78555741eeda",
    uniqueBuilderVertexCount: 19,
    expectedCatalogDefinitionDigest:
      "sha256:4ee35c4939b3e0bd0a108c88b16ac9160a39e39c4db829e1605f165e67dd8f05",
    expectedCatalogGeometryDigest:
      "sha256:a9988c28dd1665f9de1acf1d11f03d4aa986d4b5abee65d11c1af9385007ee9a",
    expectedCatalogConnectorDigest:
      "sha256:b1752554ca3ea0fbcd2a004f3408c722ca24498c58bd7ae7aa85e8bb28a74f4e",
    expectedCatalogCollisionDigest:
      "sha256:31272bfe129df5bfa10371e2239fd9d4a9f0e512ac85cb72c1beb7d9ecf04548",
  },
  {
    designRevision: "3832;G",
    catalogPartId: "builtin:plate-2x10",
    sourceIdentity: {
      bundleSha256: "sha256:a44e58c707b0b898dffd8580923eb70331a548467fcf721944f9fec1602ad3cb",
      manifestMd5: "md5:a69966d6083600a66d120eb83927c738",
      primitiveXmlSha256: "sha256:c8db860533b38997b09eb0a3800106f98eb3260879d2425b4cbc0bb9fd7977d8",
      shellPathId: "-1247914159549873248",
      shellCanonicalSha256:
        "sha256:a2a3f114c8a5463b9a38926b83ef10963a55e50b35a47f0611ef60de1f2b8c53",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 42480,
      byteLength: 1008,
      digest: "sha256:edf6c5e6d346682473f4068cdbf16db1f694e976b7bcdabffdb94ef53a0d30fe",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 395568,
      byteLength: 66672,
      digest: "sha256:fe4e8041fe6f6f71d1f908aa4a65acc82d7b51ea8fceac98e5bb0ef2301877af",
      triangleCount: 1852,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [20, -8, 0],
      [20, -8, 20],
      [40, -8, 0],
      [40, -8, 20],
      [60, -8, 0],
      [60, -8, 20],
      [80, -8, 0],
      [80, -8, 20],
      [100, -8, 0],
      [100, -8, 20],
      [120, -8, 0],
      [120, -8, 20],
      [140, -8, 0],
      [140, -8, 20],
      [160, -8, 0],
      [160, -8, 20],
      [180, -8, 0],
      [180, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:3415eaf1ae0c7c37af2acdc7e5a020d14337a16ddf7f9bf00a72442a9dd1d052",
    uniqueBuilderVertexCount: 18,
    expectedCatalogDefinitionDigest:
      "sha256:0ed70ec127fa8e5a48f7b2f320444dd4b756b7c08cff61fca03894e998abbb03",
    expectedCatalogGeometryDigest:
      "sha256:95a065b2613d1cca85281908ad564ec45d829a1a50b434e4fe87d65437e1709f",
    expectedCatalogConnectorDigest:
      "sha256:4006960f9bea35701680a7f34acf7ef1f6b0a57f8b84d69c2734e63439cc2574",
    expectedCatalogCollisionDigest:
      "sha256:3429d2bac233eff15b4a5852f1eed7ea58bdfaffa5f7dbd10e8a87b3c8f35e16",
  },
  {
    designRevision: "6106;D",
    catalogPartId: "builtin:wedge-plate-6x6-cut-corner",
    sourceIdentity: {
      bundleSha256: "sha256:000c995217c337e466bae51d8a1f91aff43407bef73b616f54179501b0f0bf4c",
      manifestMd5: "md5:558d0992b0857f4e4c5930418904f586",
      primitiveXmlSha256: "sha256:b86f157b310443435732975028f97b5c6d255805c23a0b82f16ab14f7f41c249",
      shellPathId: "-3386435689471635927",
      shellCanonicalSha256:
        "sha256:ab71f6fa24770ba594816ece8d3838183108dc8a9678fac0ef33800531fd7a26",
      shellVertexCount: 244,
      shellTriangleCount: 144,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 43488,
      byteLength: 5184,
      digest: "sha256:0631695c148f79c48783abb495ac139baf43a90d1342120291bbc93be43b6956",
      triangleCount: 144,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 462240,
      byteLength: 114804,
      digest: "sha256:e6d55f3bf6504265cfd25f4fb0c265e9589cae033489a35a25932bfe2f76e199",
      triangleCount: 3189,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-0",
    },
    builderStudCentersLdu: [
      [0, -8, -100],
      [0, -8, -80],
      [0, -8, -60],
      [0, -8, -40],
      [0, -8, -20],
      [0, -8, 0],
      [20, -8, -100],
      [20, -8, -80],
      [20, -8, -60],
      [20, -8, -40],
      [20, -8, -20],
      [20, -8, 0],
      [40, -8, -80],
      [40, -8, -60],
      [40, -8, -40],
      [40, -8, -20],
      [40, -8, 0],
      [60, -8, -60],
      [60, -8, -40],
      [60, -8, -20],
      [60, -8, 0],
      [80, -8, -40],
      [80, -8, -20],
      [80, -8, 0],
      [100, -8, -20],
      [100, -8, 0],
    ],
    builderStudCentersDigest:
      "sha256:e8268470d20ae4866d39bfdd1aab11dcd847d5930a9b480506be55ab96f3442b",
    uniqueBuilderVertexCount: 100,
    expectedCatalogDefinitionDigest:
      "sha256:51789c3b1ab3ea4bb164de1893036b1f60fe76aff90ef17d9204b093e9f9578d",
    expectedCatalogGeometryDigest:
      "sha256:69f5ff06dcdc2e8f2dd36c7ecde3de981a7a52860cdb5009ee77c9717dfcd074",
    expectedCatalogConnectorDigest:
      "sha256:06fe9c60500d4a8dcba55a658cff233603e99d407c7fb0f6e31c639a654df80a",
    expectedCatalogCollisionDigest:
      "sha256:b0b6ecd2a5a854d2566ed6ba7a96e044e9c09aa3ccee578e0b1fab558db46ab3",
  },
  {
    designRevision: "30503;F",
    catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
    sourceIdentity: {
      bundleSha256: "sha256:dd4ccd984224bd8305a31666780955e1738c5ddfff0352b118a65239beea7ba9",
      manifestMd5: "md5:ca07e8485681ac31be9b5df772ab9479",
      primitiveXmlSha256: "sha256:a23e93d720a860da7098ff517f1ddd5758f36eca090d29e897ebbc9f8f0dd4c9",
      shellPathId: "7133946934050365661",
      shellCanonicalSha256:
        "sha256:d2e698f1fc253fef56b93354dc9221bfd118314272cb46879c31f038c2f4a33e",
      shellVertexCount: 190,
      shellTriangleCount: 120,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 48672,
      byteLength: 4320,
      digest: "sha256:1d1325129f22e067d23651c0b0dbfcfaaba51c6a423b28330ecfad78e2e42161",
      triangleCount: 120,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 577044,
      byteLength: 41544,
      digest: "sha256:927bd8018cb4ea7b25754ed6e7eccc2bfa7e661517d910b924e8ece126ad93df",
      triangleCount: 1154,
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
      [40, -8, -20],
      [40, -8, 0],
      [60, -8, 0],
    ],
    builderStudCentersDigest:
      "sha256:11b074b3b7c74c366d70d7df60a703137465468859ec555f158269a0a27e2f5b",
    uniqueBuilderVertexCount: 62,
    expectedCatalogDefinitionDigest:
      "sha256:0501333380d7aae216e17293e233793f22b166c9061f2435a4f279319db1883d",
    expectedCatalogGeometryDigest:
      "sha256:f53319c22f9abfd0a9073a18d9ce9d65547b363bf9d5225750ce1f3c718f7743",
    expectedCatalogConnectorDigest:
      "sha256:06dc5ba9eb7a87e9ca5d20c6ff2e640ba221cbcac55c39fcf36bf8191350d5c8",
    expectedCatalogCollisionDigest:
      "sha256:5feac0ed14caad277905a9a4e1b61d85fbd62d55e61f0c581054d38b66d4cf68",
  },
  {
    designRevision: "41539;F",
    catalogPartId: "builtin:plate-8x8",
    sourceIdentity: {
      bundleSha256: "sha256:baccf7cfe24530c8585e58e98141d92c64fb58d6b9a19e1fbd39c41f45e51f47",
      manifestMd5: "md5:952fa110071d370e050a57610267ed5d",
      primitiveXmlSha256: "sha256:da6baeaffe3de5c4d404f3615d5aec7c8403f885cf3ee5403b3b7185408395b6",
      shellPathId: "-1097953145414435942",
      shellCanonicalSha256:
        "sha256:a6f406444faa2d5dbc4a41aef59bae41f929929f793b570eb6ee0a779aa152a9",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 52992,
      byteLength: 1008,
      digest: "sha256:bfcc21ff0214ce0f49e1c4b61f754fcde82598245f4f6c53a7758fa1286b989e",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 618588,
      byteLength: 280944,
      digest: "sha256:41d0ef2d34d33c4a8fec051b00aaff35cb5b37ea4ab925b2e1c04a16987681ae",
      triangleCount: 7804,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-0",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [0, -8, 40],
      [0, -8, 60],
      [0, -8, 80],
      [0, -8, 100],
      [0, -8, 120],
      [0, -8, 140],
      [20, -8, 0],
      [20, -8, 20],
      [20, -8, 40],
      [20, -8, 60],
      [20, -8, 80],
      [20, -8, 100],
      [20, -8, 120],
      [20, -8, 140],
      [40, -8, 0],
      [40, -8, 20],
      [40, -8, 40],
      [40, -8, 60],
      [40, -8, 80],
      [40, -8, 100],
      [40, -8, 120],
      [40, -8, 140],
      [60, -8, 0],
      [60, -8, 20],
      [60, -8, 40],
      [60, -8, 60],
      [60, -8, 80],
      [60, -8, 100],
      [60, -8, 120],
      [60, -8, 140],
      [80, -8, 0],
      [80, -8, 20],
      [80, -8, 40],
      [80, -8, 60],
      [80, -8, 80],
      [80, -8, 100],
      [80, -8, 120],
      [80, -8, 140],
      [100, -8, 0],
      [100, -8, 20],
      [100, -8, 40],
      [100, -8, 60],
      [100, -8, 80],
      [100, -8, 100],
      [100, -8, 120],
      [100, -8, 140],
      [120, -8, 0],
      [120, -8, 20],
      [120, -8, 40],
      [120, -8, 60],
      [120, -8, 80],
      [120, -8, 100],
      [120, -8, 120],
      [120, -8, 140],
      [140, -8, 0],
      [140, -8, 20],
      [140, -8, 40],
      [140, -8, 60],
      [140, -8, 80],
      [140, -8, 100],
      [140, -8, 120],
      [140, -8, 140],
    ],
    builderStudCentersDigest:
      "sha256:8f58e5415f2192d3fab6785fe839e9c1fb794ac6149baf79523eaf87fa4d0dd8",
    uniqueBuilderVertexCount: 20,
    expectedCatalogDefinitionDigest:
      "sha256:941d454a58556524c9eb6eb2d4f9f33eb8ad1ad6b33345c716ac08a7859addb1",
    expectedCatalogGeometryDigest:
      "sha256:9877367d0aec6d66395072b15991d26544f6799723cd0077648d4b2c7568207e",
    expectedCatalogConnectorDigest:
      "sha256:2b58066fc91a38b40abbd273caf81ab7b9b6409b99914cccb78004cd8b8a1718",
    expectedCatalogCollisionDigest:
      "sha256:cfdfd46e8ae0d3fa7bbf6938f3693e4f8f2de39c62ed79b43336725ae9036256",
  },
  {
    designRevision: "51739;H",
    catalogPartId: "builtin:wedge-plate-2x4-wing",
    sourceIdentity: {
      bundleSha256: "sha256:6966c3d9308749f36d20efbb900ac79aeb95db3b7b7ed05bfadd04ebca158938",
      manifestMd5: "md5:4a65cee564aa436a310d4481b67f390d",
      primitiveXmlSha256: "sha256:8e64be1bd55e80ded78a7145ac65e1dcf5c91e9eae7347871ecb02bc7ed03f23",
      shellPathId: "3375856213334120950",
      shellCanonicalSha256:
        "sha256:a6f64c3bdfa5762334877f2361c347c4ff6a340b0695a6abafea0ef3f61b4f4a",
      shellVertexCount: 268,
      shellTriangleCount: 220,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 54000,
      byteLength: 7920,
      digest: "sha256:9c2df61afa93f24be48987d2330c77e5821ea05d84465f436023d033e254affe",
      triangleCount: 220,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 899532,
      byteLength: 15264,
      digest: "sha256:26f291fd904b5f0dbc1041100b99b288bdf9ef44b98160c98782a18769f00cb5",
      triangleCount: 424,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [20, -8, -20],
      [20, -8, 0],
      [40, -8, -20],
      [40, -8, 0],
    ],
    builderStudCentersDigest:
      "sha256:6b78c4e78e0acc17e2df3d2ccf69aabc36df5a785d3f028a31163cdedfbf56b6",
    uniqueBuilderVertexCount: 112,
    expectedCatalogDefinitionDigest:
      "sha256:e7c413fcacfa00b067d439fed6ccb214eb257ae2e20615ef06e96195dc861adb",
    expectedCatalogGeometryDigest:
      "sha256:fe2610ac0119e0d3d15394ec4707f9ca4851b8ace99c10df051fc8fd07dc2429",
    expectedCatalogConnectorDigest:
      "sha256:cffa9006c1022c90a64fa183129016e390b6372a384c59120d92c5a0fa8d2fbd",
    expectedCatalogCollisionDigest:
      "sha256:a72589223f9893a13b85aa4a81a064be4896d868487bee40bda3788e13ca9777",
  },
  {
    designRevision: "54383;F",
    catalogPartId: "builtin:wedge-plate-3x6-right",
    sourceIdentity: {
      bundleSha256: "sha256:b4302061dc1c661a4e7ef0fe38cb88bb9ae69968c2cd49a0c7de1be489f61b89",
      manifestMd5: "md5:deb5424438a634f0a0ad6e05b9d2689a",
      primitiveXmlSha256: "sha256:170874efb1edc03a3d5b2947776fd2c72ae2b2d715bf6ff8b8bf9847d7fce2bc",
      shellPathId: "-8116910261973647149",
      shellCanonicalSha256:
        "sha256:27b302a1c3980b34de12f0c6c83e87ac1966fd1d440cac911bc001f4bf3c0e49",
      shellVertexCount: 300,
      shellTriangleCount: 224,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 61920,
      byteLength: 8064,
      digest: "sha256:351ee326c6cc7b9a441cf7e12a6ae97b77c6ff4fe601cc7992a487678ae258d0",
      triangleCount: 224,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 914796,
      byteLength: 41904,
      digest: "sha256:a7beecdadb78be0e7b51ba8740fc2c8d109cc807eb761f5e2374510b748e2e00",
      triangleCount: 1164,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-0",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [20, -8, 0],
      [40, -8, 0],
      [60, -8, 0],
      [60, -8, 20],
      [80, -8, 0],
      [80, -8, 20],
      [100, -8, 0],
      [100, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:1447d2ef86bd2bd0ea8674b41b9e203b16921c2ad4c5b9d44e5d11d77357bf11",
    uniqueBuilderVertexCount: 158,
    expectedCatalogDefinitionDigest:
      "sha256:660f46cf61652eb5ee98d13163580d7930f8ed7d9871b6e5e60483f9894157e0",
    expectedCatalogGeometryDigest:
      "sha256:a9d2aea3a08d1d84068de410a503f55f1fff6808e388cf62bc0e94d6c5757138",
    expectedCatalogConnectorDigest:
      "sha256:6bd1ad1ea453311bc6436c8d5b37a5fc129b721117c1a8ed25d7b06e874c81ba",
    expectedCatalogCollisionDigest:
      "sha256:98e3cd3c3ac4ac85ef76f175acdebcc5a8ffc2a34c93d1c3f987b7b95c70b4e4",
  },
  {
    designRevision: "60479;F",
    catalogPartId: "builtin:plate-1x12",
    sourceIdentity: {
      bundleSha256: "sha256:edf1c2ab46b1fec3c96e2470aed6861cef83c202696f68f251b7d724973f2073",
      manifestMd5: "md5:968840e2eb6f2e8710c9fa7e392dd8af",
      primitiveXmlSha256: "sha256:efa1e418d1e5471ac1a2f7133b60b9f1fd749f166a09fcaefb566e17f3889d49",
      shellPathId: "6568512417183503593",
      shellCanonicalSha256:
        "sha256:8a93898ee1f2d287c8e5152f9dcb52fb5ab049954daa92f8cb7a719bd855eb23",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 69984,
      byteLength: 1008,
      digest: "sha256:dd0b16d4c313b301b9fb0e7d33af9949986cbdac71f16c2c6f125ad6dfe785ed",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 956700,
      byteLength: 40752,
      digest: "sha256:d26b12f67ea0b6559c5c12058de6e1344054a771ae6927a105150fbde2c5e5c3",
      triangleCount: 1132,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [20, -8, 0],
      [40, -8, 0],
      [60, -8, 0],
      [80, -8, 0],
      [100, -8, 0],
      [120, -8, 0],
      [140, -8, 0],
      [160, -8, 0],
      [180, -8, 0],
      [200, -8, 0],
      [220, -8, 0],
    ],
    builderStudCentersDigest:
      "sha256:61a7c44034d7644c49dbae31b0fc4a0142bef7e5916275033613c8910ef653fe",
    uniqueBuilderVertexCount: 18,
    expectedCatalogDefinitionDigest:
      "sha256:14d17884bb70d59c4ba084fd37b7b10b851fc99dc6528fed7ef26fe593592903",
    expectedCatalogGeometryDigest:
      "sha256:c5ba11395de82f14dd2d08251704b374e83cf7dfa147dd020bb3f8c0565183e9",
    expectedCatalogConnectorDigest:
      "sha256:cb09b1192815500ccb833bdf65ba23a6fb116b05d3eb4c00fefee1348922aba9",
    expectedCatalogCollisionDigest:
      "sha256:9ba03a933cd82e503cb90c471e22da3b8ab4225f5c75ccffa4495e8b6e992cb2",
  },
  {
    designRevision: "91988;F",
    catalogPartId: "builtin:plate-2x14",
    sourceIdentity: {
      bundleSha256: "sha256:6c7e38460cf7306b820336e2c59853913bfda9d89abd7ea72d1fcaedbcf6a7a7",
      manifestMd5: "md5:184b887c4ee945f464c363e5a2bbede7",
      primitiveXmlSha256: "sha256:7216c771f78e7cf37986b74ac88fa1194dcc47d09955d873308a459f941cbe66",
      shellPathId: "-1297394108001815733",
      shellCanonicalSha256:
        "sha256:596b7b194d82e742f292148d1a577f92f10e995cc4fcabd6bde412698ec3f7c9",
      shellVertexCount: 48,
      shellTriangleCount: 28,
      ldrawOfficialArchiveSha256: LDRAW_OFFICIAL_ARCHIVE,
      ldrawUnofficialArchiveSha256: LDRAW_UNOFFICIAL_ARCHIVE,
      ldrawClosureSha256: BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 70992,
      byteLength: 1008,
      digest: "sha256:88a0258f5cb93ef1b8bf66d98dd84401443892c4fc5efec0f1a44a235a99bf87",
      triangleCount: 28,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 997452,
      byteLength: 94320,
      digest: "sha256:dfaf2ec3c405080f38c2ce59517de2d7a8621c44ae642c0998fc2fc3726f9dc4",
      triangleCount: 2620,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderStudCentersLdu: [
      [0, -8, 0],
      [0, -8, 20],
      [20, -8, 0],
      [20, -8, 20],
      [40, -8, 0],
      [40, -8, 20],
      [60, -8, 0],
      [60, -8, 20],
      [80, -8, 0],
      [80, -8, 20],
      [100, -8, 0],
      [100, -8, 20],
      [120, -8, 0],
      [120, -8, 20],
      [140, -8, 0],
      [140, -8, 20],
      [160, -8, 0],
      [160, -8, 20],
      [180, -8, 0],
      [180, -8, 20],
      [200, -8, 0],
      [200, -8, 20],
      [220, -8, 0],
      [220, -8, 20],
      [240, -8, 0],
      [240, -8, 20],
      [260, -8, 0],
      [260, -8, 20],
    ],
    builderStudCentersDigest:
      "sha256:8759be69637f09efa275ee3b9a11e7c8779d964a5c9bf6bcb2e4ed1f942934f5",
    uniqueBuilderVertexCount: 18,
    expectedCatalogDefinitionDigest:
      "sha256:0daf92c42b4fb1a0f94d01d9b0dba5498cd3092ebf85e21b41349ad6c273c535",
    expectedCatalogGeometryDigest:
      "sha256:15baeee4bef68269bee10a7a25aba974df49e974f24b70f128c3c5bdbe04b58e",
    expectedCatalogConnectorDigest:
      "sha256:c9a7e2431e2fc26198060fd130d02ff2d182ed8da21b4a777bc271d5271a31ad",
    expectedCatalogCollisionDigest:
      "sha256:10ac4de2795dfbf5b73c9cd9a9ba8968739ab108cf768ee1d404431283c20e13",
  },
] as const satisfies readonly BuilderDesignSourcePin[];

/**
 * Four reviewed Bone readings, one per quarter turn, at the corrected
 * `diag(1,-1,-1)` LXFML-to-LDraw basis. Every `positionLdu` z is the negation of
 * what this table held before, and the two quarter turns exchange: conjugating a
 * yaw by the extra z flip inverts it, so a Bone that read `upright-yaw-90` now
 * reads `upright-yaw-270` and vice versa, while `yaw-0` and `yaw-180` are fixed
 * points and cannot witness the change at all. Case 1 is therefore the position
 * witness and cases 2 and 4 are the rotation witnesses; a change that moved only
 * one half of the basis would leave one of them wrong.
 */
export const BUILDER_STEP1_CALIBRATION_CASES = [
  {
    brickRef: "a12d1753-e853-4589-bc67-e1cb4e784fa7",
    builderTransformationDigest:
      "sha256:ba9b5cb293247b9222b123c4d95b66e4ba7d6752fc60de74feb35d31aeef34ad",
    expectedTransform: { positionLdu: [270, -16, -244], orientationId: "upright-yaw-0" },
  },
  {
    brickRef: "da6a6d03-1c34-43ff-97e9-5939ccf26777",
    builderTransformationDigest:
      "sha256:6e6e61a4b108dde4eadc59ecff258a2c87658727a9117af2a9d8db1d2160c1d2",
    expectedTransform: { positionLdu: [270, -580, -104], orientationId: "upright-yaw-270" },
  },
  {
    brickRef: "d63813bf-f3b6-4059-b5de-6605e8baf320",
    builderTransformationDigest:
      "sha256:65d39c9641261db0a54ce361f501594ba6d0f1fc660be10ed5ed5869430d61ec",
    expectedTransform: { positionLdu: [390, -572, -104], orientationId: "upright-yaw-180" },
  },
  {
    brickRef: "55506c77-f293-40f5-8aa7-ea85501f07f1",
    builderTransformationDigest:
      "sha256:aa2a689c493fc4d244e55c72eb122791350195c40fc252a6adaf4d38138aa25b",
    expectedTransform: { positionLdu: [410, -580, -104], orientationId: "upright-yaw-90" },
  },
] as const satisfies readonly BuilderCalibrationCasePin[];

export const BUILDER_STEP1_ORIGIN_POLICY = {
  protocol: "first-ordered-direct-empty-enumeration/1",
  anchorBrickRef: "76092bf0-3d72-474a-baf3-06b837082f6a",
  anchorBuilderTransformationDigest:
    "sha256:b17eb49ceb81e036753fd1bc9a1a4d0cf60c945cf8a98311c589e6e981dd7f82",
  expectedComposedTransform: {
    positionLdu: [560, -4, -194],
    orientationId: "upright-yaw-0",
  },
  expectedEmptyEnumerationTransform: {
    positionLdu: [0, 8, 0],
    orientationId: "upright-yaw-0",
  },
} as const;
