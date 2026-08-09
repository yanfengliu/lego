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
 * plates, each a union of boxes measured out of its own LDraw file; /6 added six
 * booklet parts, including the first analytic circular plan features and their
 * conservative convex-prism collision decomposition; /7 is the first production
 * admission from measured source — five set 6651557 parts whose render mesh is
 * bundled LDraw geometry, whose collision is that surface's per-column height
 * field, whose connectors are LEGO Builder's authored field carried through a
 * pinned per-part frame, and whose extents are the exact LDraw closure; /8 adds
 * three parts the Builder pack has no record of at all, whose female connectors
 * come from the LDCad shadow library instead — 30357, 2450 and 79491, each of
 * which LDraw alone leaves with studs and zero clutch cells; /9 is the first
 * part drawn as the shell it is rather than as a filled block — `plate-2x4`
 * gains the ceiling and four walls `3020.dat` actually models, so the cavity its
 * eight clutches need is real geometry in the render and in the collision at the
 * same moment. No part is added or removed and no connector moves.
 */
export const BUILTIN_CATALOG_VERSION = "builtin.basic-parts/9" as const;
export const CONNECTOR_TAXONOMY_VERSION = "stud-tube/1" as const;
export const COLLISION_MODEL_VERSION = "rectilinear-stud-clearance/2" as const;
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

export const PROJECT_PLAN_GEOMETRY_PROVENANCE: SourceProvenance = Object.freeze({
  ...PROJECT_CATALOG_PROVENANCE,
  sourceId: "lego-studio:parametric-plan-feature-part-generator",
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
  sourceVersion: "reviewed-2026-08-02",
  licenseExpression: "LicenseRef-LDraw-Identifiers",
  attribution:
    "LDraw.org identifier compatibility; this layer bundles no geometry. Bundled LDraw meshes carry their own per-file CC BY 4.0 provenance.",
  runtimeRole: "interchange-identifier-only",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
});

/**
 * Real LDraw part geometry, bundled as the render layer.
 *
 * The owner decided this on 2026-08-04 and it was a licensing choice, not a
 * technical one: every claimed-built step is compared against its printed
 * booklet panel, so a generated approximation of a curve fails the measurement
 * the goal is scored by. What the choice obliges is here — per-file authorship
 * and licence are preserved in `ldraw-bundled-sources-6651557.ts`, and reuse is
 * still not permission to train, which stays a separate and unheld right.
 */
export const LDRAW_BUNDLED_GEOMETRY_PROVENANCE: SourceProvenance = Object.freeze({
  sourceId: "ldraw:official-library:bundled-part-geometry",
  sourceType: "external-bundled-geometry",
  sourceVersion:
    "ldraw-complete-2026-07 archive sha256 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
  licenseExpression: "CC-BY-4.0",
  attribution:
    "LDraw part geometry (c) its named authors and LDraw.org contributors, used under CC BY 4.0. Per-file authorship, licence and content hash are preserved in ldraw-bundled-sources-6651557.ts.",
  runtimeRole: "render-mesh-asset",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: true,
});

/**
 * Catalog truth for a part declared from measured source rather than from
 * parameters. The declaration is ours; every number in it was measured, and the
 * mesh, connector and frame sources are named on the part itself.
 */
export const MEASURED_PART_CATALOG_PROVENANCE: SourceProvenance = Object.freeze({
  ...PROJECT_CATALOG_PROVENANCE,
  sourceId: "lego-studio:measured-part-admission",
  sourceVersion: "set-6651557/1",
  attribution:
    "Copyright (c) 2026 Yanfeng Liu. Extents and collision measured from the official LDraw closure; connectors from the LEGO Builder authored field through a pinned per-part frame.",
});

/**
 * Catalog truth for a measured part whose female connectors the LDCad shadow
 * library authored, because the LEGO Builder pack has no record of the design.
 *
 * The library is CC BY-SA 4.0, and the owner directed on 2026-08-05 that licence
 * must not block this private, noncommercial work. What that decision does not
 * waive is recorded rather than dropped: attribution travels with the derived
 * connector data, ShareAlike would attach to it if it were ever redistributed —
 * the licence's sui generis database-rights clause reaches an extracted database
 * too — and permission to read and share is still not permission to train, which
 * stays an unheld right. `docs/dependency-data-bom.md` holds the full finding.
 */
export const LDCAD_SHADOW_CONNECTOR_PROVENANCE: SourceProvenance = Object.freeze({
  sourceId: "lego-studio:ldcad-shadow-measured-part-admission",
  sourceType: "external-connector-metadata",
  sourceVersion:
    "set-6651557/1; LDCadShadowLibrary commit 15aa1e718b6a8da37d24fc7af5e52e262c041bfb; whole-tree manifest sha256 668bc047a45e5560ff0fbbd69e9eb5adafab127781720bcb069a1554cb3f0c0f; composed by ldcad-shadow-composed-over-ldraw-tree/1",
  licenseExpression: "MIT AND CC-BY-SA-4.0",
  attribution:
    "Copyright (c) 2026 Yanfeng Liu. Underside clutch cells derived from the LDCad Shadow Library by Roland Melkert and its per-file !HISTORY contributors, CC BY-SA 4.0; ShareAlike attaches to this derived connector data on redistribution. Extents, collision and render mesh are the official LDraw closure named on the part.",
  runtimeRole: "catalog-truth",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
});

export const LDRAW_91988_FRAME_PROVENANCE: SourceProvenance = Object.freeze({
  sourceId: "ldraw:official:91988.dat",
  sourceType: "interoperability-mapping",
  sourceVersion: "UPDATE-2012-02;measured-2026-08-02",
  licenseExpression: "CC-BY-2.0",
  attribution:
    "91988.dat authored by Owen Burgoyne [C3POwen] for LDraw.org; frame measured without bundling geometry.",
  runtimeRole: "interchange-frame-measurement",
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
