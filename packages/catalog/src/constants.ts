import type {
  ConnectorArticulation,
  ConnectorAxisMatching,
  ConnectorGender,
  ConnectorGeometryRole,
  ConnectorKind,
  ConnectorRotation,
  SourceProvenance,
  UprightOrientation,
} from "./types.ts";

/**
 * /2 grew the palette to the full solid set; /3 added tiles and the larger brick
 * and plate sizes; /4 added the long and wide plates and bricks the sample
 * booklet needs, and the first two families whose studs do not fill their
 * footprint — jumper plates and grille tiles; /5 added the first parts whose
 * solid is not one prism — arches, curved slopes, cheese slopes and corner
 * plates, each a union of boxes measured out of its own LDraw file.
 */
export const BUILTIN_CATALOG_VERSION = "builtin.basic-parts/5" as const;
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

/**
 * What may join what, and how.
 *
 * One row per pair, so mutuality is structural rather than something to keep in
 * step: there is no way to say a stud accepts a clutch without also saying a
 * clutch accepts a stud, because it is the same row.
 *
 * Articulation and rotation live here and not on a connector, because they are
 * properties of the pair. The same axle is rigid in an axle hole, whose cross
 * section it cannot slip round in, and free in a pin hole, which is round.
 */
export interface ConnectorPairRule {
  readonly male: ConnectorKind;
  readonly female: ConnectorKind;
  readonly allowedRotation: ConnectorRotation;
  readonly articulation: ConnectorArticulation;
  readonly axisMatching: ConnectorAxisMatching;
}

export const CONNECTOR_PAIR_RULES: readonly ConnectorPairRule[] = Object.freeze([
  {
    male: "stud",
    female: "undersideClutch",
    allowedRotation: "quarterTurns",
    articulation: "rigid",
    axisMatching: "opposed",
  },
  {
    male: "axle",
    female: "axleHole",
    allowedRotation: "quarterTurns",
    articulation: "rigid",
    axisMatching: "collinear",
  },
  // Round hole, cross shaft: it fits and it spins. This is how a wheel turns on
  // an axle that is itself locked into the chassis.
  {
    male: "axle",
    female: "pinHole",
    allowedRotation: "continuous",
    articulation: "revolute",
    axisMatching: "collinear",
  },
  {
    male: "pin",
    female: "pinHole",
    allowedRotation: "continuous",
    articulation: "revolute",
    axisMatching: "collinear",
  },
  {
    male: "bar",
    female: "clip",
    allowedRotation: "continuous",
    articulation: "revolute",
    axisMatching: "collinear",
  },
  {
    male: "hinge",
    female: "hingeSocket",
    allowedRotation: "continuous",
    articulation: "revolute",
    axisMatching: "opposed",
  },
]);

/** What a connector is, independent of what it happens to be joined to. */
export interface ConnectorKindRule {
  readonly gender: ConnectorGender;
  readonly geometryRole: ConnectorGeometryRole;
  readonly profileId: string;
}

export const CONNECTOR_KIND_RULES: Readonly<Record<ConnectorKind, ConnectorKindRule>> =
  Object.freeze({
    stud: { gender: "male", geometryRole: "stud", profileId: "stud-tube/1" },
    undersideClutch: { gender: "female", geometryRole: "tubeSeat", profileId: "stud-tube/1" },
    axle: { gender: "male", geometryRole: "axleShaft", profileId: "axle-cross/1" },
    axleHole: { gender: "female", geometryRole: "axleBore", profileId: "axle-cross/1" },
    pin: { gender: "male", geometryRole: "pinShaft", profileId: "pin-round/1" },
    pinHole: { gender: "female", geometryRole: "pinBore", profileId: "pin-round/1" },
    bar: { gender: "male", geometryRole: "barShaft", profileId: "bar-round/1" },
    clip: { gender: "female", geometryRole: "clipJaw", profileId: "bar-round/1" },
    hinge: { gender: "male", geometryRole: "hingePin", profileId: "hinge/1" },
    hingeSocket: { gender: "female", geometryRole: "hingeCup", profileId: "hinge/1" },
  });

/** Every kind this one may join, derived from the pair table. */
export const connectorAccepts = (kind: ConnectorKind): readonly ConnectorKind[] =>
  CONNECTOR_PAIR_RULES.filter((rule) => rule.male === kind || rule.female === kind).map((rule) =>
    rule.male === kind ? rule.female : rule.male,
  );

/** How a given pair behaves, or undefined if the two cannot join at all. */
export const connectorPairRule = (
  left: ConnectorKind,
  right: ConnectorKind,
): ConnectorPairRule | undefined =>
  CONNECTOR_PAIR_RULES.find(
    (rule) =>
      (rule.male === left && rule.female === right) ||
      (rule.male === right && rule.female === left),
  );
