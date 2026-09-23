import type { BuilderDesignSourcePin } from "./real-build-builder-source-contract";

export const BUILDER_PREFIX50_DESIGN_SOURCES_N = [
  {
    designRevision: "15573;L",
    catalogPartId: "builtin:jumper-plate-1x2",
    sourceIdentity: {
      bundleSha256: "sha256:7cdc39f80ce8dc9322000597ddc57c4a3cbd33dfa85b3c5ee3af8ceb148e2d02",
      manifestMd5: "md5:d2be5deef33e7fce3026cc78660ad7fc",
      primitiveXmlSha256: "sha256:2c59ed60ba5fd1f601ffb3d8b0d139dea2465d4b968e92b4381b2e79556b5fd3",
      shellPathId: "-7822767774549832177",
      shellCanonicalSha256:
        "sha256:851d5d693c99cae81326e83ca95de78950cde377e9ff9c237cf6a7f49c7086e9",
      shellVertexCount: 228,
      shellTriangleCount: 160,
      ldrawOfficialArchiveSha256:
        "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
      ldrawUnofficialArchiveSha256:
        "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4",
      ldrawClosureSha256: "sha256:ffe99f465ae9e045d649750d9290043fd6947e5d740d6576980da42fc365fb63",
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 1_820_412,
      byteLength: 5_760,
      digest: "sha256:573dba20603de68a77ffa4b4b06c409df4e77b1d699f19f8268e536277a237c3",
      triangleCount: 160,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 1_826_172,
      byteLength: 7_920,
      digest: "sha256:720b4a02b9e2fb1916d6c218c6737182e81121ab054644dc55a08ff7b6221793",
      triangleCount: 220,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -4, 0],
      orientationId: "upright-yaw-90",
    },
    builderAnchorRole: "underside-field-to-catalog-clutch",
    builderAnchorCentersLdu: [
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ],
    builderAnchorCentersDigest:
      "sha256:55176e86f3d9b260727752050b0959f70f9d0733ade1f54fc881f3ca8d6daeaa",
    uniqueBuilderVertexCount: 84,
    expectedCatalogDefinitionDigest:
      "sha256:146138411aabe22489ed132cc639fd489e70f2abb897b274889d9c05a353bbf5",
    expectedCatalogGeometryDigest:
      "sha256:9250636449d5e0938f43539cd361c41ce8e14695b36abe3bfaa27eca5d790672",
    expectedCatalogConnectorDigest:
      "sha256:a27d167f929d4ccae46d16da9f372c89e5cb985e683e502466167ca03623cff1",
    expectedCatalogCollisionDigest:
      "sha256:3b342a3b04328db6dc3ac5482a91a024fadd810c1f6818968c810534a4337756",
  },
] as const satisfies readonly BuilderDesignSourcePin[];
