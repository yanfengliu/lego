import { deepFreeze } from "./freeze.ts";
import { MEASURED_PART_DEFINITIONS } from "./measured-part-factory.ts";
import { SET_6651557_RENDER_ONLY_BLUEPRINTS } from "./part-blueprints-6651557-render-only.ts";
import type { RenderOnlyPartBlueprint } from "./measured-part-types.ts";
import { promoteRenderOnlyPart } from "./render-only-part-factory.ts";
import type { ParametricPartDefinition, PartDefinition } from "./types.ts";

const MEASURED_RENDER_PROMOTION_IDS = new Set([
  "builtin:wedge-plate-4x4-cut-corner",
  "builtin:wedge-plate-6x6-cut-corner",
  "builtin:corner-plate-4x4-round",
  "builtin:corner-plate-5x5-quarter-ring",
]);

/**
 * Existing catalog slots whose complete physical definition is deliberately
 * replaced by one source-measured declaration.
 *
 * This is separate from the render-only promotion set: an id here opts into
 * measured connectors, allowances and collision as well as measured pixels.
 * Keeping the set closed prevents a newly generated duplicate from silently
 * displacing a reviewed parametric definition.
 */
export const MEASURED_PHYSICAL_PROMOTION_IDS = new Set(["builtin:jumper-plate-1x2"]);

const promoteMeasuredPhysicalDefinition = (
  parametric: ParametricPartDefinition,
  measured: PartDefinition,
): PartDefinition => {
  const identityFields: readonly (readonly [string, unknown, unknown])[] = [
    ["id", parametric.id, measured.id],
    ["family", parametric.family, measured.family],
    ["displayName", parametric.displayName, measured.displayName],
    ["aliases", parametric.aliases, measured.aliases],
    ["dimensions", parametric.dimensions, measured.dimensions],
    [
      "connectorGridCenterLdu",
      parametric.geometry.connectorGridCenterLdu ?? ([0, 0] as const),
      measured.connectorGridCenterLdu ?? ([0, 0] as const),
    ],
    ["legalOrientationIds", parametric.legalOrientationIds, measured.legalOrientationIds],
    ["availableColorIds", parametric.availableColorIds, measured.availableColorIds],
    ["substitutionGroupId", parametric.substitutionGroupId, measured.substitutionGroupId],
    ["inventory", parametric.inventory, measured.inventory],
  ];
  const mismatches = identityFields.filter(
    ([, expected, received]) => JSON.stringify(expected) !== JSON.stringify(received),
  );
  if (mismatches.length > 0) {
    throw new Error(
      `Measured physical promotion ${measured.id} does not match its preceding catalog identity: ${mismatches.map(([field, expected, received]) => `${field} expected ${JSON.stringify(expected)}, received ${JSON.stringify(received)}`).join("; ")}. A physical promotion may replace geometry and physical semantics, not identity, palette or inventory semantics.`,
    );
  }
  if (measured.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
    throw new Error(
      `Measured physical promotion ${measured.id} must provide a preloaded mesh recipe; received ${measured.geometry.generatorId}`,
    );
  }
  return measured;
};

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

function renderOnlyDefinitionsById(
  measuredById: ReadonlyMap<string, PartDefinition>,
): Map<string, RenderOnlyPartBlueprint> {
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
  return renderOnlyById;
}

function validateLookupOwnership(definitions: readonly PartDefinition[]): void {
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
}

/** Compose the stable catalog order and reject every unreviewed authority collision. */
export function composePartDefinitions(
  parametricDefinitions: readonly ParametricPartDefinition[],
): readonly PartDefinition[] {
  const measuredById = new Map<string, PartDefinition>();
  for (const measured of MEASURED_PART_DEFINITIONS) {
    if (measuredById.has(measured.id)) {
      throw new Error(`Measured catalog declares duplicate part id ${measured.id}`);
    }
    measuredById.set(measured.id, measured);
  }
  const renderOnlyById = renderOnlyDefinitionsById(measuredById);
  const consumedRenderPromotions = new Set<string>();
  const consumedPhysicalPromotions = new Set<string>();
  const consumedRenderOnlyPromotions = new Set<string>();
  const definitions: PartDefinition[] = parametricDefinitions.map((parametric) => {
    const renderOnly = renderOnlyById.get(parametric.id);
    if (renderOnly !== undefined) {
      consumedRenderOnlyPromotions.add(parametric.id);
      return promoteRenderOnlyPart(parametric, renderOnly);
    }
    const measured = measuredById.get(parametric.id);
    if (measured === undefined) return parametric;
    if (MEASURED_PHYSICAL_PROMOTION_IDS.has(parametric.id)) {
      consumedPhysicalPromotions.add(parametric.id);
      return promoteMeasuredPhysicalDefinition(parametric, measured);
    }
    if (!MEASURED_RENDER_PROMOTION_IDS.has(parametric.id)) {
      throw new Error(
        `Measured part ${parametric.id} collides with a parametric definition without an explicit physical or render promotion`,
      );
    }
    consumedRenderPromotions.add(parametric.id);
    return promoteMeasuredRenderGeometry(parametric, measured);
  });

  for (const promotionId of MEASURED_RENDER_PROMOTION_IDS) {
    if (!consumedRenderPromotions.has(promotionId)) {
      throw new Error(
        `Measured render promotion ${promotionId} did not replace a parametric definition`,
      );
    }
  }
  for (const promotionId of MEASURED_PHYSICAL_PROMOTION_IDS) {
    if (!consumedPhysicalPromotions.has(promotionId)) {
      throw new Error(
        `Measured physical promotion ${promotionId} did not replace a parametric definition`,
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
  definitions.push(
    ...MEASURED_PART_DEFINITIONS.filter(
      ({ id }) => !consumedRenderPromotions.has(id) && !consumedPhysicalPromotions.has(id),
    ),
  );
  validateLookupOwnership(definitions);
  return deepFreeze(definitions);
}
