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
import { PART_BLUEPRINTS } from "./part-blueprints.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import {
  familyHeightLdu,
  FAMILY_DISPLAY_NAMES,
  isStudded,
  LEGAL_ORIENTATION_IDS,
  makeAliases,
  makeGeometryDigestInput,
  studModeFor,
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

  // A part whose solid is one prism keeps the single primitive named "body", so
  // growing the model did not re-hash the sixty-five parts that came before a
  // union existed. A union numbers its boxes instead.
  const bodyPrimitives: CollisionPrimitive[] = bodyArc
    ? [...arcCollisionPrimitives(bodyArc, bodyBoundsLdu)]
    : bodyBoxesLdu
      ? bodyBoxesLdu.map((box, index) => ({
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
  const { connectors, primitives, allowances } = buildConnectorFeatures({
    blueprint,
    studded,
    topY,
    bottomY,
    bodyPrimitives,
  });

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
      ),
      contentHash: `sha256:${blueprint.geometrySha256}`,
      bodyMode:
        bodyArc !== undefined
          ? "arc-prism"
          : bodyWedge || bodyBoxesLdu
            ? "compound"
            : "rectangular-prism",
      studMode: studModeFor(family, studOffsetsLdu),
      ...(studOffsetsLdu === undefined ? {} : { studOffsetsLdu }),
      ...(clutchOffsetsLdu === undefined ? {} : { clutchOffsetsLdu }),
      ...(partialOverhangClutchEvidence === undefined ? {} : { partialOverhangClutchEvidence }),
      ...(blueprint.connectorGridCenterLdu === undefined
        ? {}
        : { connectorGridCenterLdu: blueprint.connectorGridCenterLdu }),
      undersideMode:
        blueprint.withoutClutches === true
          ? "none"
          : clutchOffsetsLdu === undefined
            ? "semantic-tube-seat-grid"
            : "semantic-tube-seat-offsets",
      ...(blueprint.bodyBoundsLdu === undefined ? {} : { bodyBoundsLdu: blueprint.bodyBoundsLdu }),
      ...(exactBodyBounds === undefined ? {} : { exactBodyBoundsLdu: exactBodyBounds }),
      ...(bodyBoxesLdu === undefined ? {} : { bodyBoxesLdu }),
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

export const PART_DEFINITIONS: readonly ParametricPartDefinition[] = deepFreeze(
  PART_BLUEPRINTS.map(makePartDefinition),
);
