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
import type { CatalogAlias, LduBounds, PartFamily, PartTubeFeature } from "./types.ts";

import { EXACT_LDU_SCALE_EXPONENT, type ExactLduBoundsDeclaration } from "./exact-ldu.ts";
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

/**
 * Every stud-cell centre of a blueprint's footprint, on the same lattice the
 * connector builder walks. Flat rather than indexed because the shell asks a
 * question about neighbours — is this cell one corner of a complete 2 x 2 block
 * — that cell indices would only obscure.
 */
export const studCellCentersLdu = (
  blueprint: PartBlueprint,
): readonly (readonly [x: number, z: number])[] => {
  const [centerX, centerZ] = blueprint.connectorGridCenterLdu ?? [0, 0];
  const cells: (readonly [number, number])[] = [];
  for (let xIndex = 0; xIndex < blueprint.widthStuds; xIndex += 1) {
    for (let zIndex = 0; zIndex < blueprint.lengthStuds; zIndex += 1) {
      cells.push([
        centerX + (xIndex - (blueprint.widthStuds - 1) / 2) * STUD_PITCH_LDU,
        centerZ + (zIndex - (blueprint.lengthStuds - 1) / 2) * STUD_PITCH_LDU,
      ]);
    }
  }
  return cells;
};

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
 * The one place the underside mode is named.
 *
 * It used to be spelled out twice — once for the definition and once for the
 * digest input — which is a drift waiting to happen: the digest would keep
 * saying "semantic" while the definition said something else, and the hash would
 * bind the wrong claim. `undersideIsModelled` comes from the connector builder,
 * which derives it from the body union's own geometry, so this is a report of
 * what the part draws rather than a declaration about it.
 */
export const undersideModeFor = (
  blueprint: PartBlueprint,
  undersideIsModelled: boolean,
): "semantic-tube-seat-grid" | "semantic-tube-seat-offsets" | "modelled-shell-cavity" | "none" => {
  if (blueprint.withoutClutches === true) return "none";
  if (undersideIsModelled) return "modelled-shell-cavity";
  return blueprint.clutchOffsetsLdu === undefined
    ? "semantic-tube-seat-grid"
    : "semantic-tube-seat-offsets";
};

/**
 * A part with no explicit stud offsets hashes exactly as it did before offsets
 * existed, so adding them did not re-hash the thirty-two parts before it. The
 * same rule holds for exact bounds: a part that does not declare them emits the
 * same digest text it always did.
 */
export const makeGeometryDigestInput = (
  blueprint: PartBlueprint,
  heightLdu: number,
  exactBodyBoundsLdu: ExactLduBoundsDeclaration | undefined,
  undersideMode: ReturnType<typeof undersideModeFor>,
  /**
   * The boxes actually drawn: the blueprint's own for a filled part, and the
   * derived shell for a part that models its cavity. The digest binds what is
   * drawn rather than what was declared, so a change to the shell rule shows up
   * as a changed hash on every part it touches.
   */
  drawnBoxesLdu: readonly LduBounds[] | undefined,
  bodyTubes: PartTubeFeature | undefined,
): string => {
  const {
    family,
    widthStuds,
    lengthStuds,
    studOffsetsLdu,
    bodyWedge,
    bodyArc,
    extraConnectors,
    clutchOffsetsLdu,
    partialOverhangClutchEvidence,
    connectorGridCenterLdu,
  } = blueprint;
  const bodyBoundsLdu = blueprint.bodyBoundsLdu;
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
    undersideMode,
    ...(studOffsetsLdu === undefined ? {} : { studOffsetsLdu }),
    ...(bodyWedge === undefined ? {} : { bodyMode: "wedge-prism", bodyWedge }),
    ...(drawnBoxesLdu === undefined ? {} : { bodyMode: "box-union", bodyBoxesLdu: drawnBoxesLdu }),
    ...(bodyTubes === undefined ? {} : { bodyTubes }),
    ...(bodyArc === undefined ? {} : { bodyMode: "arc-prism", bodyArc }),
    ...(bodyBoundsLdu === undefined ? {} : { bodyBoundsLdu }),
    // Exact bounds enter the digest as their canonical decimal text, so the
    // hash binds the measured value rather than the double it projects to.
    ...(exactBodyBoundsLdu === undefined
      ? {}
      : {
          bodyBoundsMode: `exact-decimal/${EXACT_LDU_SCALE_EXPONENT}`,
          exactBodyBoundsLdu,
        }),
    ...(extraConnectors === undefined ? {} : { extraConnectors }),
    ...(clutchOffsetsLdu === undefined ? {} : { clutchOffsetsLdu }),
    ...(partialOverhangClutchEvidence === undefined ? {} : { partialOverhangClutchEvidence }),
    ...(connectorGridCenterLdu === undefined ? {} : { connectorGridCenterLdu }),
  });
};
