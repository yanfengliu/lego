import type { SourceProvenance, UprightOrientation } from "./types.ts";

export const BUILTIN_CATALOG_VERSION = "builtin.basic-parts/1" as const;
export const CONNECTOR_TAXONOMY_VERSION = "stud-tube/1" as const;
export const COLLISION_MODEL_VERSION = "rectilinear-stud-clearance/1" as const;
export const TRANSFORM_POLICY_VERSION = "upright-quarter-turns-negative-y-up/1" as const;

export const STUD_PITCH_LDU = 20 as const;
export const BRICK_HEIGHT_LDU = 24 as const;
export const PLATE_HEIGHT_LDU = 8 as const;
export const STUD_RADIUS_LDU = 6 as const;
export const STUD_HEIGHT_LDU = 4 as const;

export const PROJECT_CATALOG_PROVENANCE: SourceProvenance = Object.freeze({
  sourceId: "lego-studio:starter-catalog",
  sourceType: "project-authored",
  sourceVersion: BUILTIN_CATALOG_VERSION,
  licenseExpression: "MIT",
  attribution: "Copyright (c) 2026 Yanfeng Liu",
  runtimeRole: "catalog-truth",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
});

export const PROJECT_GEOMETRY_PROVENANCE: SourceProvenance = Object.freeze({
  ...PROJECT_CATALOG_PROVENANCE,
  sourceId: "lego-studio:parametric-rectilinear-part-generator",
  sourceVersion: "1",
  runtimeRole: "parametric-runtime-geometry",
});

export const PROJECT_COLOR_PROVENANCE: SourceProvenance = Object.freeze({
  ...PROJECT_CATALOG_PROVENANCE,
  sourceId: "lego-studio:starter-display-colors",
  sourceVersion: "1",
  runtimeRole: "display-color",
});

export const LDRAW_IDENTIFIER_PROVENANCE: SourceProvenance = Object.freeze({
  sourceId: "ldraw:interchange-identifiers",
  sourceType: "interoperability-mapping",
  sourceVersion: "reviewed-2026-07-09",
  licenseExpression: "LicenseRef-LDraw-Identifiers",
  attribution: "LDraw.org identifier compatibility; no LDraw geometry is bundled.",
  runtimeRole: "interchange-identifier-only",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
});

export const UPRIGHT_ORIENTATIONS: readonly UprightOrientation[] = Object.freeze([
  Object.freeze({
    id: "upright-yaw-0",
    quarterTurns: 0,
    matrix: Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1] as const),
    upAxis: Object.freeze([0, -1, 0] as const),
  }),
  Object.freeze({
    id: "upright-yaw-90",
    quarterTurns: 1,
    matrix: Object.freeze([0, 0, 1, 0, 1, 0, -1, 0, 0] as const),
    upAxis: Object.freeze([0, -1, 0] as const),
  }),
  Object.freeze({
    id: "upright-yaw-180",
    quarterTurns: 2,
    matrix: Object.freeze([-1, 0, 0, 0, 1, 0, 0, 0, -1] as const),
    upAxis: Object.freeze([0, -1, 0] as const),
  }),
  Object.freeze({
    id: "upright-yaw-270",
    quarterTurns: 3,
    matrix: Object.freeze([0, 0, -1, 0, 1, 0, 1, 0, 0] as const),
    upAxis: Object.freeze([0, -1, 0] as const),
  }),
]);
