import {
  BUILDER_STEP1_LDRAW_CLOSURE_DIGEST,
  LDRAW_OFFICIAL_ARCHIVE,
  LDRAW_UNOFFICIAL_ARCHIVE,
  type BuilderDesignSourcePin,
} from "./real-build-builder-source-contract";

export const BUILDER_STEP1_DESIGN_SOURCES_A = [
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
    ldrawToCatalogLocalTransform: { positionLdu: [0, -4, 0], orientationId: "upright-yaw-0" },
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
      "sha256:667495b2c88c5c246aa11723f2419156d56ea789cd301dea81e188c62a876c77",
    expectedCatalogGeometryDigest:
      "sha256:53ce1139f72127b4d469412a208953a3cb164122495c519ab3294b77aae24d3d",
    expectedCatalogConnectorDigest:
      "sha256:e1c23184c8a3ae2dc50a4d0b71fae3bf4fee414d2c041490ae60436d735bb86a",
    expectedCatalogCollisionDigest:
      "sha256:249abeef07793df84c8bdedd8ce91cad81eddcc4e5bdffacc98966439dd9ad78",
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
    ldrawToCatalogLocalTransform: { positionLdu: [0, -4, 0], orientationId: "upright-yaw-0" },
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
      "sha256:eb159e8ecfa4e116c33465d28d2a5b5c200c0e45140c50673e9415dc1decd164",
    expectedCatalogGeometryDigest:
      "sha256:910b4a47c020a47d8a2f798aeadb10c4b91b6d0779f72e5b7ed2f33321e48867",
    expectedCatalogConnectorDigest:
      "sha256:e63591f952a84357a7c4fd2462ee1828d9b1510bc02e799292be1d879fcb8b97",
    expectedCatalogCollisionDigest:
      "sha256:3c854fb2e31a5d3aaf7c86ab70123fc35e5f06ef649878f581ce8ba124d34706",
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
    ldrawToCatalogLocalTransform: { positionLdu: [0, -4, 0], orientationId: "upright-yaw-90" },
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
      "sha256:7053d96d393f09625dcf3555682b89504268010988ad968f9d79f59a52860d62",
    expectedCatalogGeometryDigest:
      "sha256:7dee83a99259a46836102055fc12a4824178378820a0283c05b54056d1727778",
    expectedCatalogConnectorDigest:
      "sha256:1603c98cb725564e9a55f3632d57d9246395b4930ef9204cb0527acff6845960",
    expectedCatalogCollisionDigest:
      "sha256:314cc22546cfb80ecd80ee9d3feda163b2c48f688beadab327d825abe66833e6",
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
    ldrawToCatalogLocalTransform: { positionLdu: [0, -4, 0], orientationId: "upright-yaw-90" },
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
      "sha256:2b5fda8e70ff153127a2bc55d0c690302dc8c815ade8d78ccb9b49134f6f94ca",
    expectedCatalogGeometryDigest:
      "sha256:5871a9005812efae752a06226204c4b895ae8bf3e8678b871465384b99675326",
    expectedCatalogConnectorDigest:
      "sha256:7bdb6685d7e9b0b6f33dc3761cd3ffdbf7ebb4b3038b2aed6559a425bacf5466",
    expectedCatalogCollisionDigest:
      "sha256:1a940233da4c4ceff40312c9989abb9451265bc9761ef0a8b5d38ca05ff465c1",
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
    ldrawToCatalogLocalTransform: { positionLdu: [0, -4, 0], orientationId: "upright-yaw-90" },
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
      "sha256:4be6bd6acd17be3519ffce5bbc7166d4adeae20d21d9f630fc164e870a5751da",
    expectedCatalogGeometryDigest:
      "sha256:31c276676b7f0e9885ebba9ac8640bbf3d3364ab239be2abe26d65281579e9e5",
    expectedCatalogConnectorDigest:
      "sha256:e125fef68f4d83c7f58c31dbd70a2dca6540443124551b81ca9ca4cdf59940f1",
    expectedCatalogCollisionDigest:
      "sha256:8f00daaf920db0a1c959ff082fa8aebb7f30fa02106adec7f36ca3fb373b5e24",
  },
] as const satisfies readonly BuilderDesignSourcePin[];
