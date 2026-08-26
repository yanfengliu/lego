import type {
  ConnectorArticulation,
  ConnectorAxisMatching,
  ConnectorGender,
  ConnectorGeometryRole,
  ConnectorKind,
  ConnectorRotation,
  ProperOrientation,
  SourceProvenance,
  UprightOrientation,
} from "./types.ts";
import { deepFreeze } from "./freeze.ts";
import { GENERATED_NON_UPRIGHT_PROPER_ORIENTATIONS } from "./proper-orientations.generated.ts";

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
 *
 * /10 generalises that one shell to every part shaped like it. Fifty-eight parts
 * — every brick, plate, tile, jumper plate, grille tile, technic brick and the
 * corner plate, wherever the body is a uniform-height prism — now draw the
 * ceiling, walls and underside tubes their own LDraw files model, derived from
 * each part's own footprint rather than authored per part. `part-shell.ts` holds
 * the measurements and the file and line behind each. No part is added or
 * removed and no connector moves: every clutch that existed at /9 still exists,
 * held by a cavity wall or by the tubes rather than by solid backing.
 *
 * /11 gives the eight parts admitted through the mesh route the three modes the
 * generated parts declare, so `part-standard` can hold both routes to one rule
 * instead of reporting a bundled surface as unverifiable. Nothing they draw
 * changes: the modes are measured off the mesh by `mesh-underside.ts`, which
 * finds the lowest horizontal surface over each declared clutch and answers
 * recessed, open or flat. No part is added or removed, no connector moves, and
 * no collision primitive moves — the only field that changes is what those
 * eight parts now say about themselves.
 *
 * /12 promotes the four special plates visible in the first underside booklet
 * witness — 30503, 6106, 30565 and 80015 — to their exact bundled LDraw render
 * meshes in place. Their already-reviewed connectors, allowances and collision
 * recipes remain byte-identical; `preserved-catalog-recipe` states explicitly
 * that those conservative collision solids are independent of the render mesh
 * and may extend beyond or fill voids in it. No part is added, removed or moved.
 *
 * /13 promotes the remaining twelve approximate catalog drawings to their
 * official LDraw render meshes and stores source-faithful normals for all 24
 * bundled assets. Migration reports render-geometry and normal changes for all
 * 24 appearances and body/visual-bound changes for the twelve new promotions.
 * No connector, allowance, collision recipe, or part identity moves.
 *
 * /14 adds the first one-stud quarter-round tile, `25269.dat`, as one complete
 * source-declared part. Its exact render surface is the bundled official LDraw
 * closure, its single centre clutch is authored by the LDCad shadow subpart,
 * and its conservative collision columns are measured from that same closure.
 * No existing part, connector, allowance, collision recipe, or identity moves.
 *
 * /15 adds distinct bracket `28802.dat` with its exact official LDraw mesh,
 * outward-normal stud frames and LDCad-authored clutch cells, plus conservative
 * collision input measured from that closure. The upright transform policy is
 * unchanged: the horizontal stud frames are represented and validated, but an
 * upright clutch cannot be rotated onto them by this catalog release.
 *
 * /16 adds triangular tile `35787.dat` as one complete measured definition. Its
 * exact official closure owns its canonical diagonal mesh and conservative
 * collision input; the exact LDCad subpart owns three underside clutch cells.
 * The native Builder record's unframed connector field remains counterevidence,
 * not a merged source.
 *
 * /17 adds minifig roller skate `11253.dat` as one complete measured definition.
 * Its exact official closure supplies the irregular footwear-and-roller surface
 * and conservative collision input; the LDCad shadow walk owns its one underside
 * clutch. The unframed native Builder record remains count-only counterevidence.
 *
 * /18 adds thin-top arch `15254.dat` as one complete measured definition. Its
 * exact official closure supplies the shell, six studs, and conservative
 * collision input; the checksum-pinned Builder revision-J field supplies two
 * end clutches through one exact, symmetry-canonicalized per-part frame.
 *
 * /19 adds bracket `41682.dat` as one complete measured definition. Its exact
 * official closure supplies the horizontal plate, vertical wall, two side
 * studs, and conservative collision input; the pinned LDCad shadow walk owns
 * those two directional stud frames and the four underside clutch cells.
 *
 * /20 adds grille brick `2877.dat` as one complete measured definition. Its
 * exact official closure supplies the asymmetric grille shell, two top studs,
 * and conservative collision input; the checksum-pinned Builder revision-E
 * field supplies two underside clutches through the shell-selected exact frame.
 *
 * /21 adds straight slope `3040.dat` as one complete measured definition. Its
 * moved-to official closure supplies the 45-degree shell, one top stud, and
 * conservative collision input; a checksum-pinned underside tube plus that stud
 * establishes the exact Builder revision-F frame that supplies two clutches.
 *
 * /22 adds `4519.dat`, the three-module Technic axle, as one complete measured
 * definition. Its exact official closure supplies the shaft surface and
 * conservative collision field. The pinned LDCad shadow's one centred,
 * sliding, capless male A6x60 segment exclusively authors three discrete axle
 * seats through the existing axle taxonomy. No preceding definition changes.
 *
 * /23 adds `32064.dat`, the 1 x 2 Technic brick with one axle hole, as one
 * complete measured definition. Its moved-to official closure supplies the
 * open-sided shell, two studs, and conservative collision field. The pinned
 * LDCad shadow's one capless, sliding, female A6x1 segment exclusively authors
 * the transverse axle-hole endpoint. No preceding definition changes.
 *
 * /24 adds `11212.dat`, the regular 3 x 3 plate, as one complete measured
 * definition. Its exact official closure supplies the shell, nine visible
 * studs, and conservative collision field. The pinned LDCad shadow authors the
 * matching regular 3 x 3 grid of nine underside clutches. No preceding
 * definition changes.
 *
 * /25 adds `33909.dat`, the 2 x 2 plate with two studs on one edge, as one
 * complete measured definition. Its exact official closure supplies the
 * asymmetric stud surface and conservative collision field. The pinned LDCad
 * shadow authors the matching two stud frames and four regular underside
 * clutches. No preceding definition changes.
 *
 * /26 adds `78329.dat`, the regular 1 x 5 plate, as one complete measured
 * definition. Its exact official closure supplies the shell, five visible
 * studs, and conservative collision field. The pinned LDCad shadow authors the
 * matching five-stud and five-clutch line after the source frame's quarter turn.
 * No preceding definition changes.
 *
 * /27 appends four complete measured definitions in printed-prefix admission
 * order: chamfered tile `99563.dat`, 1 x 1 axle-hole Technic brick `73230.dat`,
 * double 45-degree slope `35464.dat`, and outside-bow curved slope `49307.dat`.
 * Their pinned official closures supply exact render geometry and conservative
 * collision fields, while their reviewed source routes supply connector rows.
 * No preceding definition changes interpretation.
 *
 * /28 appends exact suffixed definitions `3245c.dat` and `2453b.dat`. Their
 * official roots supply geometry while exact LDCad routes supply connector
 * rows; no bare or cross-suffix alias is admitted and no printed frame follows.
 */
export const BUILTIN_CATALOG_VERSION = "builtin.basic-parts/28" as const;
export const CONNECTOR_TAXONOMY_VERSION = "stud-tube/1" as const;
export const COLLISION_MODEL_VERSION = "rectilinear-stud-clearance/3" as const;
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
 * Catalog truth for a measured part whose connector rows the LDCad shadow
 * library authored. Designs 30357, 2450 and 79491 have no LEGO Builder record.
 * Builder metadata also names 25269, 35787 and 11253, but these connector
 * admissions do not use those unframed fields: the exact shadow walks directly
 * author their clutch cells. The distinct 28802 admission likewise keeps its
 * reviewed LDCad route exclusive rather than merging a contradictory Builder
 * identity.
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

/** Additive axle attribution; older LDCad-backed definitions retain their exact bytes. */
export const LDCAD_SHADOW_AXLE_CONNECTOR_PROVENANCE: SourceProvenance = Object.freeze({
  ...LDCAD_SHADOW_CONNECTOR_PROVENANCE,
  attribution:
    "Copyright (c) 2026 Yanfeng Liu. Axle seats derived from the LDCad Shadow Library by Roland Melkert and its per-file !HISTORY contributors, CC BY-SA 4.0; this part uses the exact capless, centred, sliding A6x60 shaft projection. ShareAlike attaches to this derived connector data on redistribution. Extents, collision and render mesh are the official LDraw closure named on the part.",
});

/** Additive axle-hole attribution; every older LDCad-backed definition retains its exact bytes. */
export const LDCAD_SHADOW_AXLE_HOLE_CONNECTOR_PROVENANCE: SourceProvenance = Object.freeze({
  ...LDCAD_SHADOW_CONNECTOR_PROVENANCE,
  attribution:
    "Copyright (c) 2026 Yanfeng Liu. Axle-hole seats derived from the LDCad Shadow Library by Roland Melkert and its per-file !HISTORY contributors, CC BY-SA 4.0; this part uses the exact capless, sliding, YOnly-scaled female A6 segment midpoint projection. ShareAlike attaches to this derived connector data on redistribution. Extents, collision and render mesh are the official LDraw closure named on the part.",
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
 * Source/catalog-frame vocabulary. Placement legality remains the four-row
 * `UPRIGHT_ORIENTATIONS` subset carried by every current part definition.
 */
export const PROPER_ORIENTATIONS: readonly ProperOrientation[] = Object.freeze([
  ...UPRIGHT_ORIENTATIONS,
  ...GENERATED_NON_UPRIGHT_PROPER_ORIENTATIONS,
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

export const CONNECTOR_PAIR_RULES: readonly ConnectorPairRule[] = deepFreeze([
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
