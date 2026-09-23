export const VERSION_30_NOMINAL_STUD_PROFILE_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: [
    "builtin:wedge-plate-3x3-cut-corner",
    "builtin:corner-plate-2x2-round",
    "builtin:bracket-1x2-1x4-rounded-bottom",
    "builtin:arch-1x6-thin-top",
    "builtin:bracket-2x2-1x2-vertical-studs",
    "builtin:brick-1x2-grille",
    "builtin:technic-brick-1x2-axle-hole",
  ],
  changedFields: ["connector-semantics", "collision-semantics"],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_JUMPER_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: ["builtin:jumper-plate-1x2"],
  changedFields: [
    "render-geometry",
    "construction-semantics",
    "connector-semantics",
    "collision-semantics",
  ],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_ROUND_END_PLATE_ORIENTATION_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: ["builtin:plate-1x2-round-end"],
  changedFields: ["placement-orientation-semantics"],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_TILE_1X6_ORIENTATION_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: ["builtin:tile-1x6"],
  changedFields: ["placement-orientation-semantics"],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_TILE_1X2_ORIENTATION_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: ["builtin:tile-1x2"],
  changedFields: ["placement-orientation-semantics"],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_PLATE_1X4_ORIENTATION_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: ["builtin:plate-1x4"],
  changedFields: ["placement-orientation-semantics"],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_SLOPE_1X2_ORIENTATION_INTERPRETATION_CHANGE = {
  affectedCatalogPartIds: ["builtin:slope-1x2-45"],
  changedFields: ["placement-orientation-semantics"],
  fromCatalogVersion: "builtin.basic-parts/29",
  toCatalogVersion: "builtin.basic-parts/30",
} as const;

export const VERSION_30_INTERPRETATION_CHANGES = [
  VERSION_30_NOMINAL_STUD_PROFILE_INTERPRETATION_CHANGE,
  VERSION_30_JUMPER_INTERPRETATION_CHANGE,
  VERSION_30_ROUND_END_PLATE_ORIENTATION_INTERPRETATION_CHANGE,
  VERSION_30_TILE_1X6_ORIENTATION_INTERPRETATION_CHANGE,
  VERSION_30_TILE_1X2_ORIENTATION_INTERPRETATION_CHANGE,
  VERSION_30_PLATE_1X4_ORIENTATION_INTERPRETATION_CHANGE,
  VERSION_30_SLOPE_1X2_ORIENTATION_INTERPRETATION_CHANGE,
] as const;

const VERSION_30_PROFILE_ADMISSION_VERSION_BY_PART_ID = {
  "builtin:wedge-plate-3x3-cut-corner": 8,
  "builtin:corner-plate-2x2-round": 8,
  "builtin:bracket-1x2-1x4-rounded-bottom": 15,
  "builtin:arch-1x6-thin-top": 18,
  "builtin:bracket-2x2-1x2-vertical-studs": 19,
  "builtin:brick-1x2-grille": 20,
  "builtin:technic-brick-1x2-axle-hole": 23,
} as const;

const VERSION_30_ORIENTATION_INTERPRETATION_CHANGES = [
  [7, VERSION_30_ROUND_END_PLATE_ORIENTATION_INTERPRETATION_CHANGE],
  [3, VERSION_30_TILE_1X6_ORIENTATION_INTERPRETATION_CHANGE],
  [3, VERSION_30_TILE_1X2_ORIENTATION_INTERPRETATION_CHANGE],
  [1, VERSION_30_PLATE_1X4_ORIENTATION_INTERPRETATION_CHANGE],
  [21, VERSION_30_SLOPE_1X2_ORIENTATION_INTERPRETATION_CHANGE],
] as const;

export function version30InterpretationChangesForSourceCatalogVersion(
  sourceCatalogVersion: number,
) {
  const affectedCatalogPartIds =
    VERSION_30_NOMINAL_STUD_PROFILE_INTERPRETATION_CHANGE.affectedCatalogPartIds.filter(
      (partId) => VERSION_30_PROFILE_ADMISSION_VERSION_BY_PART_ID[partId] <= sourceCatalogVersion,
    );
  const orientationChanges = VERSION_30_ORIENTATION_INTERPRETATION_CHANGES.filter(
    ([admissionVersion]) => admissionVersion <= sourceCatalogVersion,
  ).map(([, change]) => change);
  return [
    {
      ...VERSION_30_NOMINAL_STUD_PROFILE_INTERPRETATION_CHANGE,
      affectedCatalogPartIds,
    },
    VERSION_30_JUMPER_INTERPRETATION_CHANGE,
    ...orientationChanges,
  ] as const;
}
