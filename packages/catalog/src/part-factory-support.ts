import {
  BRICK_HEIGHT_LDU,
  LDRAW_IDENTIFIER_PROVENANCE,
  PLATE_HEIGHT_LDU,
  PROJECT_CATALOG_PROVENANCE,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import type { CatalogAlias, LduBounds, PartFamily } from "./types.ts";

import { deepFreeze } from "./freeze.ts";
import { CHEESE_SLOPE_HEIGHT_LDU } from "./part-blueprints-special.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";

export const LEGAL_ORIENTATION_IDS: readonly string[] = deepFreeze(
  UPRIGHT_ORIENTATIONS.map(({ id }) => id),
);

export const makeAliases = (
  displayName: string,
  ldrawId: `${string}.dat`,
): readonly CatalogAlias[] =>
  deepFreeze([
    {
      namespace: "human",
      value: displayName,
      qualifiedValue: `human:${displayName}`,
      provenance: PROJECT_CATALOG_PROVENANCE,
    },
    {
      namespace: "ldraw",
      value: ldrawId,
      qualifiedValue: `ldraw:${ldrawId}`,
      provenance: LDRAW_IDENTIFIER_PROVENANCE,
    },
  ]);

/** Tiles and grille tiles are plate-height but present a smooth top, so they carry no studs. */
const SMOOTH_TOP_FAMILIES = new Set<PartFamily>([
  "tile",
  "grille-tile",
  "axle",
  "wheel",
  "curved-slope",
  "cheese-slope",
]);

export const isStudded = (family: PartFamily): boolean => !SMOOTH_TOP_FAMILIES.has(family);

/** An axle is 12 LDU across, which no count of stud pitches describes. */
const AXLE_THICKNESS_LDU = 12;
/**
 * Tyre 7/56 x 17 is 62 LDU across the tread, from LDraw 3483.
 *
 * The first wheel here was a 36 LDU one, and it left a cart four LDU off the
 * ground: a bearing's hole sits 14 above its own base, so ground clearance is
 * the wheel's radius minus 14 and a small wheel has almost none. This one is
 * also narrower, so it still clears a two-stud-wide chassis.
 */
export const WHEEL_DIAMETER_LDU = 62;

/** The one box that contains them all. */
export const unionOfBoxes = (boxes: readonly LduBounds[]): LduBounds => ({
  min: [
    Math.min(...boxes.map(({ min }) => min[0])),
    Math.min(...boxes.map(({ min }) => min[1])),
    Math.min(...boxes.map(({ min }) => min[2])),
  ],
  max: [
    Math.max(...boxes.map(({ max }) => max[0])),
    Math.max(...boxes.map(({ max }) => max[1])),
    Math.max(...boxes.map(({ max }) => max[2])),
  ],
});

export const familyHeightLdu = (family: PartFamily): number => {
  if (family === "brick" || family === "technic-brick") return BRICK_HEIGHT_LDU;
  if (family === "arch" || family === "curved-slope") return BRICK_HEIGHT_LDU;
  if (family === "cheese-slope") return CHEESE_SLOPE_HEIGHT_LDU;
  if (family === "axle") return AXLE_THICKNESS_LDU;
  if (family === "wheel") return WHEEL_DIAMETER_LDU;
  return PLATE_HEIGHT_LDU;
};

export const FAMILY_DISPLAY_NAMES: Readonly<Record<PartFamily, string>> = Object.freeze({
  brick: "Brick",
  plate: "Plate",
  tile: "Tile",
  "jumper-plate": "Jumper plate",
  "grille-tile": "Grille tile",
  "wedge-plate": "Wedge plate",
  "technic-brick": "Technic brick",
  axle: "Axle",
  wheel: "Wheel",
  arch: "Arch",
  "curved-slope": "Curved slope",
  "cheese-slope": "Cheese slope",
  "corner-plate": "Corner plate",
});

export const studModeFor = (
  family: PartFamily,
  studOffsetsLdu: readonly (readonly [number, number])[] | undefined,
): "cylinder-grid" | "cylinder-offsets" | "none" => {
  if (!isStudded(family)) return "none";
  return studOffsetsLdu === undefined ? "cylinder-grid" : "cylinder-offsets";
};

/**
 * A part with no explicit stud offsets hashes exactly as it did before offsets
 * existed, so adding them did not re-hash the thirty-two parts before it.
 */
export const makeGeometryDigestInput = (
  family: PartFamily,
  widthStuds: number,
  lengthStuds: number,
  heightLdu: number,
  studOffsetsLdu: readonly (readonly [number, number])[] | undefined,
  bodyWedge: PartBlueprint["bodyWedge"],
  bodyBoundsLdu: PartBlueprint["bodyBoundsLdu"],
  bodyBoxesLdu: PartBlueprint["bodyBoxesLdu"],
  bodyArc: PartBlueprint["bodyArc"],
  extraConnectors: PartBlueprint["extraConnectors"],
  clutchOffsetsLdu: PartBlueprint["clutchOffsetsLdu"],
  partialOverhangClutchEvidence: PartBlueprint["partialOverhangClutchEvidence"],
  connectorGridCenterLdu: PartBlueprint["connectorGridCenterLdu"],
  withoutClutches: boolean,
): string => {
  const generatorId =
    bodyArc === undefined
      ? "builtin:parametric-rectilinear-part/1"
      : "builtin:parametric-plan-feature-part/1";
  return JSON.stringify({
    generatorId,
    family,
    widthStuds,
    lengthStuds,
    heightLdu,
    studPitchLdu: STUD_PITCH_LDU,
    studRadiusLdu: STUD_RADIUS_LDU,
    studHeightLdu: STUD_HEIGHT_LDU,
    studMode: studModeFor(family, studOffsetsLdu),
    undersideMode: withoutClutches
      ? "none"
      : clutchOffsetsLdu === undefined
        ? "semantic-tube-seat-grid"
        : "semantic-tube-seat-offsets",
    ...(studOffsetsLdu === undefined ? {} : { studOffsetsLdu }),
    ...(bodyWedge === undefined ? {} : { bodyMode: "wedge-prism", bodyWedge }),
    ...(bodyBoxesLdu === undefined ? {} : { bodyMode: "box-union", bodyBoxesLdu }),
    ...(bodyArc === undefined ? {} : { bodyMode: "arc-prism", bodyArc }),
    ...(bodyBoundsLdu === undefined ? {} : { bodyBoundsLdu }),
    ...(extraConnectors === undefined ? {} : { extraConnectors }),
    ...(clutchOffsetsLdu === undefined ? {} : { clutchOffsetsLdu }),
    ...(partialOverhangClutchEvidence === undefined ? {} : { partialOverhangClutchEvidence }),
    ...(connectorGridCenterLdu === undefined ? {} : { connectorGridCenterLdu }),
  });
};
