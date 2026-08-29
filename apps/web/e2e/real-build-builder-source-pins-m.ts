import type { BuilderDesignSourcePin } from "./real-build-builder-source-contract";

export const BUILDER_PREFIX50_DESIGN_SOURCES_M = [
  {
    designRevision: "2453;I",
    catalogPartId: "builtin:brick-1x1x5-solid-stud",
    opaqueIdentityRoute: {
      routeId: "builder-2453-I-6595205-to-2453b/1",
      itemNo: "6595205",
      exactLdrawId: "2453b.dat",
      builderToCatalogLocalMatrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
      builderToCatalogLocalTranslationLdu: [0, 60, 0],
      proofDigest: "sha256:75ba323b5ce28509ee2041c62ff8f3fabec4450cbd679c7f48fe600b9a608bb5",
    },
    sourceIdentity: {
      bundleSha256: "sha256:a14c214b69dc57b3123c96e4e15b92f5bd4541d5b8eccfc3885e0bcb5d30a955",
      manifestMd5: "md5:d424b52bf93cb9c1a8e887348ef221a5",
      primitiveXmlSha256: "sha256:9a41181ed911c743fdcccce3bafe03f3e253f4eebd4a0e43811840a70063ba10",
      shellPathId: "-4781304290267089130",
      shellCanonicalSha256:
        "sha256:af1699d04608e04162287e11c0a1c50220f7c7a266bdc494570e0691294a9de6",
      shellVertexCount: 126,
      shellTriangleCount: 92,
      ldrawOfficialArchiveSha256:
        "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
      ldrawUnofficialArchiveSha256:
        "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4",
      ldrawClosureSha256: "sha256:72ca520b68934fdaa384e9bbc961090538f0b4ee1269773675db1adcf3cc7fdd",
    },
    builderGeometry: {
      format: "lego.builder-shell-triangles-f32le/1",
      byteOffset: 1_814_364,
      byteLength: 3_312,
      digest: "sha256:190efe96af552c5b1e931f2391f5ceb150886cc94be5e9d6203d768808cab25f",
      triangleCount: 92,
    },
    ldrawReferenceGeometry: {
      format: "lego.ldraw-expanded-triangles-f32le/1",
      byteOffset: 1_817_676,
      byteLength: 2_736,
      digest: "sha256:7efcfe7287d8fca9c199ca53ce38a63643510b432bd2c6beb0e4d1739d8ffffb",
      triangleCount: 76,
    },
    ldrawToCatalogLocalTransform: {
      positionLdu: [0, -60, 0],
      orientationId: "upright-yaw-0",
    },
    builderAnchorRole: "top-field-to-catalog-stud",
    builderAnchorCentersLdu: [[0, -120, 0]],
    builderAnchorCentersDigest:
      "sha256:37f442650ea056093e53171d91a467f44dd184bfba7cc6c348097a3da4e46333",
    uniqueBuilderVertexCount: 48,
    expectedCatalogDefinitionDigest:
      "sha256:816328e2461c13689ae7db17a5de45d38ac4fbdf5669271639bf4300c0a54fe7",
    expectedCatalogGeometryDigest:
      "sha256:0aba2e1c0c3c9412772a0bc2072dbda2b577e923bdd2f4f7c3f8fe7af7d28619",
    expectedCatalogConnectorDigest:
      "sha256:6e5d4b3587e2652cedb73e7f12a6087486c864ea6ce26971893abaeb78349ce8",
    expectedCatalogCollisionDigest:
      "sha256:4b746b109f8bc6ce309a9057603e7bae25fc21d875335ea0545e29874e2a591e",
  },
] as const satisfies readonly BuilderDesignSourcePin[];

const MODULE_OWNED_OPAQUE_IDENTITY_SOURCES = new WeakSet<object>(BUILDER_PREFIX50_DESIGN_SOURCES_M);

/** Structured clones and caller-shaped lookalikes cannot carry the module's source identity. */
export function isModuleOwnedBuilderOpaqueIdentitySource(source: object): boolean {
  return MODULE_OWNED_OPAQUE_IDENTITY_SOURCES.has(source);
}
