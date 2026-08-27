export type BuilderFramePoint = readonly [number, number, number];

export type BuilderFrameAnchorRole =
  | "top-field-to-catalog-stud"
  | "underside-field-to-catalog-clutch"
  | "builder-shell-to-catalog-ldraw-surface";

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
  byteLength: 1_814_364,
  digest: "sha256:d3636d02dca8a5bec1b1c759cd38cae705547cf0af9f57e6377325cb57d86d0f",
} as const;

export const LDRAW_OFFICIAL_ARCHIVE =
  "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae" as const;
export const LDRAW_UNOFFICIAL_ARCHIVE =
  "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4" as const;
/** The 102-file official closure of all fifteen roots; `builder_calibration_sources.py` holds it. */
export const BUILDER_STEP1_LDRAW_CLOSURE_DIGEST =
  "sha256:8674c2d085b3ddd3690cec5832e4c14f5e9705ddbeccc3a9249b4a41e50d8823" as const;
