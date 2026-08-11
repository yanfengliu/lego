import {
  COLLISION_MODEL_VERSION,
  PROJECT_CATALOG_PROVENANCE,
  PROJECT_GEOMETRY_PROVENANCE,
  PROJECT_PLAN_GEOMETRY_PROVENANCE,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import type {
  CollisionPrimitive,
  ExactLduBounds,
  LduBounds,
  ParametricPartDefinition,
  PartDefinition,
} from "./types.ts";

import { arcCollisionPrimitives } from "./arc-plan.ts";
import { AVAILABLE_COLOR_IDS } from "./colors.ts";
import {
  buildConnectorFeatures,
  validatePartialOverhangClutchEvidence,
} from "./connector-backing-policy.ts";
import {
  assertNumericBoundsContainExact,
  exactLduBoundsToNumbers,
  exactLduFromNumber,
  formatExactLduBounds,
  parseExactLduBounds,
  subtractExactLdu,
} from "./exact-ldu.ts";
import { deepFreeze } from "./freeze.ts";
import { MEASURED_PART_DEFINITIONS } from "./measured-part-factory.ts";
import { SET_6651557_RENDER_ONLY_BLUEPRINTS } from "./part-blueprints-6651557-render-only.ts";
import { PART_BLUEPRINTS } from "./part-blueprints.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import type { RenderOnlyPartBlueprint } from "./measured-part-types.ts";
import { promoteRenderOnlyPart } from "./render-only-part-factory.ts";
import {
  deriveShellBody,
  SHELL_CEILING_THICKNESS_LDU,
  SHELL_WALL_THICKNESS_LDU,
  TUBE_INNER_RADIUS_LDU,
  TUBE_OUTER_RADIUS_LDU,
} from "./part-shell.ts";
import {
  familyHeightLdu,
  FAMILY_DISPLAY_NAMES,
  isStudded,
  LEGAL_ORIENTATION_IDS,
  makeAliases,
  makeGeometryDigestInput,
  studCellCentersLdu,
  studModeFor,
  undersideModeFor,
  unionOfBoxes,
  WHEEL_DIAMETER_LDU,
} from "./part-factory-support.ts";

/** Internal deterministic compiler exported for adversarial blueprint tests. */
export const makePartDefinition = (blueprint: PartBlueprint): ParametricPartDefinition => {
  const {
    family,
    widthStuds,
    lengthStuds,
    studOffsetsLdu,
    clutchOffsetsLdu,
    partialOverhangClutchEvidence,
    bodyWedge,
    bodyBoxesLdu,
    bodyArc,
    exactBodyBoundsLdu: exactBodyBoundsDeclaration,
  } = blueprint;
  if ([bodyWedge, bodyBoxesLdu, bodyArc].filter((feature) => feature !== undefined).length > 1) {
    throw new Error(`${blueprint.ldrawId} declares more than one body source feature`);
  }
  if (exactBodyBoundsDeclaration !== undefined && blueprint.bodyBoundsLdu !== undefined) {
    throw new Error(
      `${blueprint.ldrawId} declares body extents twice, as bodyBoundsLdu ${JSON.stringify(blueprint.bodyBoundsLdu)} and as exactBodyBoundsLdu ${JSON.stringify(exactBodyBoundsDeclaration)}; a part states its body extents once, so keep the exact decimal declaration and drop the float64 one.`,
    );
  }
  if (
    bodyArc !== undefined &&
    blueprint.bodyBoundsLdu === undefined &&
    exactBodyBoundsDeclaration === undefined
  ) {
    throw new Error(
      `${blueprint.ldrawId} bodyArc requires explicit measured bodyBoundsLdu or exactBodyBoundsLdu`,
    );
  }
  validatePartialOverhangClutchEvidence(blueprint);
  if (
    blueprint.ldrawFrame !== undefined &&
    !UPRIGHT_ORIENTATIONS.some(({ id }) => id === blueprint.ldrawFrame?.ldrawToCatalogOrientationId)
  ) {
    throw new Error(
      `${blueprint.ldrawId} names unknown LDraw-to-catalog orientation ${blueprint.ldrawFrame.ldrawToCatalogOrientationId}`,
    );
  }

  const studded = isStudded(family);
  const heightLdu = blueprint.heightLdu ?? familyHeightLdu(family);
  const widthLdu = widthStuds * STUD_PITCH_LDU;
  const lengthLdu = lengthStuds * STUD_PITCH_LDU;
  const topY = -heightLdu / 2;
  const bottomY = heightLdu / 2;
  const variantSuffix = blueprint.variant === undefined ? "" : `-${blueprint.variant}`;
  const displayName =
    `${FAMILY_DISPLAY_NAMES[family]} ${widthStuds} x ${lengthStuds}` +
    (blueprint.variant === undefined
      ? ""
      : ` ${blueprint.variant[0]!.toUpperCase()}${blueprint.variant.slice(1)}`);
  const id = `builtin:${family}-${widthStuds}x${lengthStuds}${variantSuffix}`;

  // A union of boxes reports the box that contains them all, so a part whose
  // solid is an L or an arch still has one honest bounding box to select,
  // highlight and frame by.
  const unionBoundsLdu = bodyBoxesLdu === undefined ? undefined : unionOfBoxes(bodyBoxesLdu);
  // A part whose measured extents are not a float64 declares them exactly, and
  // the float64 pair is projected from that record rather than authored beside
  // it, so every existing consumer keeps reading the field it always read and
  // the two cannot disagree.
  const exactBodyBounds: ExactLduBounds | undefined =
    exactBodyBoundsDeclaration === undefined
      ? undefined
      : parseExactLduBounds(exactBodyBoundsDeclaration, `${blueprint.ldrawId} exactBodyBoundsLdu`);
  // The body plus whatever stands proud of it. Derived from the body rather
  // than from the stud footprint, so a part that declares its own extents does
  // not report a bounding box belonging to a different shape.
  const exactBounds: ExactLduBounds | undefined =
    exactBodyBounds === undefined
      ? undefined
      : {
          min: [
            exactBodyBounds.min[0],
            subtractExactLdu(
              exactBodyBounds.min[1],
              exactLduFromNumber(
                studded ? STUD_HEIGHT_LDU : 0,
                `${blueprint.ldrawId} stud overhang`,
              ),
              `${blueprint.ldrawId} visual bounds min y`,
            ),
            exactBodyBounds.min[2],
          ],
          max: exactBodyBounds.max,
        };
  const bodyBoundsLdu: LduBounds =
    exactBodyBounds === undefined
      ? (blueprint.bodyBoundsLdu ??
        unionBoundsLdu ?? {
          min: [-widthLdu / 2, topY, -lengthLdu / 2],
          max: [widthLdu / 2, bottomY, lengthLdu / 2],
        })
      : exactLduBoundsToNumbers(exactBodyBounds);
  const boundsLdu: LduBounds =
    exactBounds === undefined
      ? {
          min: [
            bodyBoundsLdu.min[0],
            studded ? bodyBoundsLdu.min[1] - STUD_HEIGHT_LDU : bodyBoundsLdu.min[1],
            bodyBoundsLdu.min[2],
          ],
          max: bodyBoundsLdu.max,
        }
      : exactLduBoundsToNumbers(exactBounds);
  if (exactBodyBounds !== undefined && exactBounds !== undefined) {
    assertNumericBoundsContainExact(
      bodyBoundsLdu,
      exactBodyBounds,
      `${blueprint.ldrawId} bodyBoundsLdu`,
    );
    assertNumericBoundsContainExact(boundsLdu, exactBounds, `${blueprint.ldrawId} boundsLdu`);
  }

  /**
   * The underside, derived from this part's own footprint.
   *
   * `undefined` for a body that is not a uniform-height prism — an arch, a
   * slope, a wedge, an arc — and for a part with no underside at all. Where it
   * is defined it replaces the filled footprint entirely: the shell's union is
   * the same solid minus the cavity, so `bodyBoundsLdu` above is unaffected and
   * every stud keeps the ceiling under it.
   */
  const shell =
    bodyWedge === undefined && bodyArc === undefined && blueprint.withoutClutches !== true
      ? deriveShellBody({
          ldrawId: blueprint.ldrawId,
          family,
          footprintBoxes: blueprint.bodyBoxesLdu ?? [bodyBoundsLdu],
          topY: bodyBoundsLdu.min[1],
          bottomY: bodyBoundsLdu.max[1],
          cellCentersXZLdu: studCellCentersLdu(blueprint),
        })
      : undefined;
  const drawnBoxesLdu = shell?.bodyBoxesLdu ?? bodyBoxesLdu;
  const bodyTubes =
    shell === undefined || shell.tubeCentersXZLdu.length === 0
      ? undefined
      : {
          innerRadiusLdu: TUBE_INNER_RADIUS_LDU,
          outerRadiusLdu: TUBE_OUTER_RADIUS_LDU,
          heightLdu: bodyBoundsLdu.max[1] - bodyBoundsLdu.min[1] - SHELL_CEILING_THICKNESS_LDU,
          centersXZLdu: shell.tubeCentersXZLdu,
        };
  // A part whose solid is one prism keeps the single primitive named "body", so
  // growing the model did not re-hash the sixty-five parts that came before a
  // union existed. A union numbers its boxes instead.
  const bodyPrimitives: CollisionPrimitive[] = bodyArc
    ? [...arcCollisionPrimitives(bodyArc, bodyBoundsLdu)]
    : drawnBoxesLdu
      ? drawnBoxesLdu.map((box, index) => ({
          id: `body:${index}`,
          kind: "box",
          tag: "body",
          minLdu: box.min,
          maxLdu: box.max,
        }))
      : [
          family === "wheel"
            ? {
                id: "body",
                kind: "cylinder",
                tag: "body",
                // A wheel lies on its side, turning about the axle it rides.
                axis: "x",
                centerLdu: [0, 0, 0],
                radiusLdu: WHEEL_DIAMETER_LDU / 2,
                heightLdu: bodyBoundsLdu.max[0] - bodyBoundsLdu.min[0],
              }
            : bodyWedge
              ? {
                  id: "body",
                  kind: "wedge",
                  tag: "body",
                  minLdu: bodyBoundsLdu.min,
                  maxLdu: bodyBoundsLdu.max,
                  cutNormalXZ: bodyWedge.cutNormalXZ,
                  cutOffsetLdu: bodyWedge.cutOffsetLdu,
                }
              : {
                  id: "body",
                  kind: "box",
                  tag: "body",
                  minLdu: bodyBoundsLdu.min,
                  maxLdu: bodyBoundsLdu.max,
                },
        ];
  if (bodyTubes !== undefined) {
    /**
     * The tube as collision sees it: the largest axis-aligned box inside its own
     * circle, half-side `outerRadius / sqrt(2)`.
     *
     * A `cylinder` here would be wrong, and measurably so. `collisions.ts` gives
     * a body cylinder its *bounding box* — right for a wheel, which stands alone
     * — and a tube does not stand alone: it sits at the centre of a 2 x 2 block
     * with four studs at its corners. The bounding box reaches 8 LDU along each
     * axis, so its nearest point to a stud centre 10 * sqrt(2) LDU away is only
     * 2.83 LDU off, well inside the stud's 6, and every exactly seated stack of
     * two 2-wide parts reported `PART_STUD_BODY_COLLISION` against its own
     * tubes.
     *
     * The inscribed box puts its four corners exactly on the tube circle in the
     * four diagonal directions the studs occupy, so the clearance it reports to
     * a seated stud is the tube's own — 10 * sqrt(2) - 8 - 6 = 0.142 LDU, the
     * same `TUBE_LATTICE_CLEARANCE_LDU` the backing policy grips by. It gives
     * that up only along the two axes, where it claims 5.657 LDU rather than 8.
     *
     * That shortfall costs nothing that can be authored. A transform's position
     * is integer LDU by schema, and sweeping one stud across every integer
     * position under a 2x4 plate, a 4x4 plate and a 2x4 brick — 9,801 positions
     * each — admits none whose drawn annulus overlaps it. Tubes stand on a 20
     * LDU pitch, so a position this box lets slip is inside its neighbour.
     */
    const halfSide = bodyTubes.outerRadiusLdu / Math.SQRT2;
    const tubeTopY = bodyBoundsLdu.max[1] - bodyTubes.heightLdu;
    for (const [index, [x, z]] of bodyTubes.centersXZLdu.entries()) {
      bodyPrimitives.push({
        id: `tube:${index}`,
        kind: "box",
        tag: "body",
        minLdu: [x - halfSide, tubeTopY, z - halfSide],
        maxLdu: [x + halfSide, bodyBoundsLdu.max[1], z + halfSide],
      });
    }
  }
  const { connectors, primitives, allowances, undersideIsModelled } = buildConnectorFeatures({
    blueprint,
    studded,
    topY,
    bottomY,
    bodyPrimitives,
    bodyBoxesLdu: drawnBoxesLdu,
    bodyTubes,
  });
  const undersideMode = undersideModeFor(blueprint, undersideIsModelled);

  return deepFreeze({
    id,
    family,
    displayName,
    aliases: makeAliases(displayName, blueprint.ldrawId),
    ...(blueprint.ldrawFrame === undefined ? {} : { ldrawFrame: blueprint.ldrawFrame }),
    dimensions: { widthStuds, lengthStuds, widthLdu, lengthLdu, heightLdu },
    bodyBoundsLdu,
    boundsLdu,
    ...(exactBodyBounds === undefined || exactBounds === undefined
      ? {}
      : { exactBodyBoundsLdu: exactBodyBounds, exactBoundsLdu: exactBounds }),
    geometry: {
      generatorId:
        bodyArc === undefined
          ? "builtin:parametric-rectilinear-part/1"
          : "builtin:parametric-plan-feature-part/1",
      digestInput: makeGeometryDigestInput(
        blueprint,
        heightLdu,
        exactBodyBounds === undefined ? undefined : formatExactLduBounds(exactBodyBounds),
        undersideMode,
        drawnBoxesLdu,
        bodyTubes,
      ),
      contentHash: `sha256:${blueprint.geometrySha256}`,
      bodyMode:
        bodyArc !== undefined
          ? "arc-prism"
          : bodyWedge || drawnBoxesLdu
            ? "compound"
            : "rectangular-prism",
      studMode: studModeFor(family, studOffsetsLdu),
      ...(studOffsetsLdu === undefined ? {} : { studOffsetsLdu }),
      ...(clutchOffsetsLdu === undefined ? {} : { clutchOffsetsLdu }),
      ...(partialOverhangClutchEvidence === undefined ? {} : { partialOverhangClutchEvidence }),
      ...(blueprint.connectorGridCenterLdu === undefined
        ? {}
        : { connectorGridCenterLdu: blueprint.connectorGridCenterLdu }),
      undersideMode,
      ...(blueprint.bodyBoundsLdu === undefined ? {} : { bodyBoundsLdu: blueprint.bodyBoundsLdu }),
      ...(exactBodyBounds === undefined ? {} : { exactBodyBoundsLdu: exactBodyBounds }),
      ...(drawnBoxesLdu === undefined ? {} : { bodyBoxesLdu: drawnBoxesLdu }),
      ...(shell === undefined
        ? {}
        : {
            shellCavity: {
              wallThicknessLdu: SHELL_WALL_THICKNESS_LDU,
              ceilingThicknessLdu: SHELL_CEILING_THICKNESS_LDU,
            },
          }),
      ...(bodyTubes === undefined ? {} : { bodyTubes }),
      ...(bodyArc === undefined ? {} : { bodyArc }),
      ...(blueprint.extraConnectors === undefined
        ? {}
        : { extraConnectors: blueprint.extraConnectors }),
      studRadiusLdu: STUD_RADIUS_LDU,
      studHeightLdu: STUD_HEIGHT_LDU,
      provenance:
        bodyArc === undefined ? PROJECT_GEOMETRY_PROVENANCE : PROJECT_PLAN_GEOMETRY_PROVENANCE,
    },
    connectors,
    legalOrientationIds: LEGAL_ORIENTATION_IDS,
    collision: { modelVersion: COLLISION_MODEL_VERSION, primitives, allowances },
    availableColorIds: AVAILABLE_COLOR_IDS,
    substitutionGroupId: `${family}:${widthStuds}x${lengthStuds}${variantSuffix}`,
    inventory: {
      availability: "builtin-unlimited",
      knownMassGrams: null,
      physicalAvailabilityClaimed: false,
    },
    provenance: PROJECT_CATALOG_PROVENANCE,
  });
};

const MEASURED_RENDER_PROMOTION_IDS = new Set([
  "builtin:wedge-plate-4x4-cut-corner",
  "builtin:wedge-plate-6x6-cut-corner",
  "builtin:corner-plate-4x4-round",
  "builtin:corner-plate-5x5-quarter-ring",
]);

/**
 * Promote exact source surfaces without silently replacing physical semantics.
 *
 * The measured-part generator's column collision is deliberately conservative:
 * one min-to-max interval per X/Z cell contains the LDraw surface but fills its
 * cavities. These four parts therefore take the measured mesh and its exact
 * visual bounds while their already-reviewed connectors, allowances and
 * collision recipes remain authoritative until hollow collision receives its
 * own proof.
 */
const promoteMeasuredRenderGeometry = (
  parametric: ParametricPartDefinition,
  measured: PartDefinition,
): PartDefinition => {
  const identityMismatches = [
    ["id", parametric.id, measured.id],
    ["family", parametric.family, measured.family],
    ["widthStuds", parametric.dimensions.widthStuds, measured.dimensions.widthStuds],
    ["lengthStuds", parametric.dimensions.lengthStuds, measured.dimensions.lengthStuds],
    ["heightLdu", parametric.dimensions.heightLdu, measured.dimensions.heightLdu],
  ].filter(([, expected, received]) => expected !== received);
  if (identityMismatches.length > 0) {
    throw new Error(
      `Measured render promotion ${measured.id} does not match its preceding catalog definition: ${identityMismatches.map(([field, expected, received]) => `${field} expected ${JSON.stringify(expected)}, received ${JSON.stringify(received)}`).join("; ")}. A render-only promotion must keep identity, family, width, length, and height unchanged.`,
    );
  }
  if (measured.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
    throw new Error(
      `Measured render promotion ${measured.id} must provide a preloaded mesh recipe; received ${measured.geometry.generatorId}`,
    );
  }
  const oldConnectorGridCenterLdu = parametric.geometry.connectorGridCenterLdu ?? ([0, 0] as const);
  const measuredConnectorGridCenterLdu = measured.connectorGridCenterLdu ?? ([0, 0] as const);
  if (
    JSON.stringify(oldConnectorGridCenterLdu) !== JSON.stringify(measuredConnectorGridCenterLdu)
  ) {
    throw new Error(
      `Measured render promotion ${measured.id} moves connector-grid center ${JSON.stringify(oldConnectorGridCenterLdu)} to ${JSON.stringify(measuredConnectorGridCenterLdu)}; a render-only promotion must retain the preceding catalog center`,
    );
  }
  const oldPartialOverhangEvidence = parametric.geometry.partialOverhangClutchEvidence;
  if (
    JSON.stringify(oldPartialOverhangEvidence) !==
    JSON.stringify(measured.geometry.partialOverhangClutchEvidence)
  ) {
    throw new Error(
      `Measured render promotion ${measured.id} changes partial-overhang clutch evidence; a render-only promotion must reproduce the preceding catalog evidence exactly`,
    );
  }
  const { geometry: oldGeometry, ...semanticDefinition } = parametric;
  void oldGeometry;
  return deepFreeze({
    ...semanticDefinition,
    connectorGridCenterLdu: oldConnectorGridCenterLdu,
    bodyBoundsLdu: measured.bodyBoundsLdu,
    boundsLdu: measured.boundsLdu,
    ...(measured.exactBodyBoundsLdu === undefined || measured.exactBoundsLdu === undefined
      ? {}
      : {
          exactBodyBoundsLdu: measured.exactBodyBoundsLdu,
          exactBoundsLdu: measured.exactBoundsLdu,
        }),
    geometry: deepFreeze({
      ...measured.geometry,
      collisionMode: "preserved-catalog-recipe",
      ...(oldPartialOverhangEvidence === undefined
        ? {}
        : { partialOverhangClutchEvidence: oldPartialOverhangEvidence }),
    }),
  });
};

const composePartDefinitions = (): readonly PartDefinition[] => {
  const measuredById = new Map<string, PartDefinition>();
  for (const measured of MEASURED_PART_DEFINITIONS) {
    if (measuredById.has(measured.id)) {
      throw new Error(`Measured catalog declares duplicate part id ${measured.id}`);
    }
    measuredById.set(measured.id, measured);
  }

  const renderOnlyById = new Map<string, RenderOnlyPartBlueprint>();
  for (const row of SET_6651557_RENDER_ONLY_BLUEPRINTS) {
    const blueprint: RenderOnlyPartBlueprint = row;
    const variantSuffix = blueprint.variant === undefined ? "" : `-${blueprint.variant}`;
    const id = `builtin:${blueprint.family}-${blueprint.widthStuds}x${blueprint.lengthStuds}${variantSuffix}`;
    if (renderOnlyById.has(id)) {
      throw new Error(`Render-only catalog declares duplicate part id ${id}`);
    }
    if (measuredById.has(id)) {
      throw new Error(
        `Part ${id} is declared by both full measured and render-only generation; one admission cannot have two authorities`,
      );
    }
    renderOnlyById.set(id, blueprint);
  }

  const consumedPromotions = new Set<string>();
  const consumedRenderOnlyPromotions = new Set<string>();
  const definitions: PartDefinition[] = PART_BLUEPRINTS.map(makePartDefinition).map(
    (parametric) => {
      const renderOnly = renderOnlyById.get(parametric.id);
      if (renderOnly !== undefined) {
        consumedRenderOnlyPromotions.add(parametric.id);
        return promoteRenderOnlyPart(parametric, renderOnly);
      }
      const measured = measuredById.get(parametric.id);
      if (measured === undefined) return parametric;
      if (!MEASURED_RENDER_PROMOTION_IDS.has(parametric.id)) {
        throw new Error(
          `Measured part ${parametric.id} collides with a parametric definition without an explicit render promotion`,
        );
      }
      consumedPromotions.add(parametric.id);
      return promoteMeasuredRenderGeometry(parametric, measured);
    },
  );

  for (const promotionId of MEASURED_RENDER_PROMOTION_IDS) {
    if (!consumedPromotions.has(promotionId)) {
      throw new Error(
        `Measured render promotion ${promotionId} did not replace a parametric definition`,
      );
    }
  }
  for (const promotionId of renderOnlyById.keys()) {
    if (!consumedRenderOnlyPromotions.has(promotionId)) {
      throw new Error(
        `Generated render-only promotion ${promotionId} did not replace a parametric definition`,
      );
    }
  }
  definitions.push(...MEASURED_PART_DEFINITIONS.filter(({ id }) => !consumedPromotions.has(id)));

  const idOwners = new Set<string>();
  const lookupOwners = new Map<string, string>();
  const claimLookupKey = (raw: string, owner: string): void => {
    const key = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*x\s*/g, "x");
    const previous = lookupOwners.get(key);
    if (previous !== undefined && previous !== owner) {
      throw new Error(
        `Catalog lookup key ${JSON.stringify(raw)} belongs to both ${previous} and ${owner}`,
      );
    }
    lookupOwners.set(key, owner);
  };
  for (const part of definitions) {
    if (idOwners.has(part.id)) throw new Error(`Catalog declares duplicate part id ${part.id}`);
    idOwners.add(part.id);
    claimLookupKey(part.id, part.id);
    for (const alias of part.aliases) {
      claimLookupKey(alias.value, part.id);
      claimLookupKey(alias.qualifiedValue, part.id);
    }
  }
  return deepFreeze(definitions);
};

/** Stable catalog order with explicit in-place measured render promotions. */
export const PART_DEFINITIONS: readonly PartDefinition[] = composePartDefinitions();
