export type BuilderFramePoint = readonly [number, number, number];

export type BuilderFrameAnchorRole =
  | "top-field-to-catalog-stud"
  | "underside-field-to-catalog-clutch"
  | "builder-shell-to-catalog-ldraw-surface";

export interface BuilderOpaqueIdentityRoutePin {
  readonly routeId: "builder-2453-I-6595205-to-2453b/1";
  readonly itemNo: "6595205";
  readonly exactLdrawId: "2453b.dat";
  readonly builderToCatalogLocalMatrix: readonly [25, 0, 0, 0, -25, 0, 0, 0, -25];
  readonly builderToCatalogLocalTranslationLdu: readonly [0, 60, 0];
  readonly proofDigest: "sha256:75ba323b5ce28509ee2041c62ff8f3fabec4450cbd679c7f48fe600b9a608bb5";
}

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
  /** Present only when a module-owned opaque adjudication capability admitted this exact identity route. */
  readonly opaqueIdentityRoute?: BuilderOpaqueIdentityRoutePin;
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
  /** Legacy exact type-23 representation retained byte-for-byte for the original fifteen rows. */
  readonly builderStudCentersLdu?: readonly BuilderFramePoint[];
  readonly builderStudCentersDigest?: `sha256:${string}`;
  /** Additive prefix-50 representation; the role fixes which independent catalog surface it binds. */
  readonly builderAnchorRole?: BuilderFrameAnchorRole;
  readonly builderAnchorCentersLdu?: readonly BuilderFramePoint[];
  readonly builderAnchorCentersDigest?: `sha256:${string}`;
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
  byteLength: 1_820_412,
  digest: "sha256:7e91e1402f2ab609fee6e502336f86ee74fb3a94d970e9b0b75acf07f925a76f",
} as const;

export const LDRAW_OFFICIAL_ARCHIVE =
  "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae" as const;
export const LDRAW_UNOFFICIAL_ARCHIVE =
  "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4" as const;
/** The exact official closure of the current diagnostic roots; `builder_calibration_sources.py` holds it. */
export const BUILDER_STEP1_LDRAW_CLOSURE_DIGEST =
  "sha256:72ca520b68934fdaa384e9bbc961090538f0b4ee1269773675db1adcf3cc7fdd" as const;
