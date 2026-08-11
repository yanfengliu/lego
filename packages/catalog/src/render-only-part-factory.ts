import { STUD_HEIGHT_LDU, STUD_PITCH_LDU, UPRIGHT_ORIENTATIONS } from "./constants.ts";
import { deepFreeze } from "./freeze.ts";
import {
  assertNumericBoundsContainExact,
  compareNumberToExactLdu,
  exactLduBoundsToNumbers,
  parseExactLduBounds,
} from "./exact-ldu.ts";
import type { RenderOnlyPartBlueprint } from "./measured-part-types.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import { meshAssetContentHash, resolvePreloadedMeshAsset } from "./mesh-assets.ts";
import { meshClutchUndersides } from "./mesh-underside.ts";
import type {
  LduVector3,
  MeshReferenceGeometryRecipe,
  ParametricPartDefinition,
  PartDefinition,
  SourceProvenance,
} from "./types.ts";
import type { ExactLduBounds, LduBounds } from "./types.ts";

function fail(blueprint: RenderOnlyPartBlueprint, message: string): never {
  throw new Error(`Render-only part ${blueprint.designId} (${blueprint.ldrawId}) ${message}`);
}

function sortedVectors(rows: readonly LduVector3[]): readonly LduVector3[] {
  return [...rows].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2],
  );
}

function recipeConnectorGridCenter(
  geometry: ParametricPartDefinition["geometry"] | PartDefinition["geometry"],
): readonly [number, number] | undefined {
  return "connectorGridCenterLdu" in geometry ? geometry.connectorGridCenterLdu : undefined;
}

/** Canonical bytes of every physical-semantics field a render promotion must preserve. */
export function renderPromotionStructuralBytes(part: PartDefinition): string {
  return JSON.stringify({
    connectors: part.connectors,
    collision: part.collision,
    connectorGridCenterLdu: part.connectorGridCenterLdu ??
      recipeConnectorGridCenter(part.geometry) ?? [0, 0],
    partialOverhangClutchEvidence: part.geometry.partialOverhangClutchEvidence ?? null,
  });
}

function geometryProvenance(blueprint: RenderOnlyPartBlueprint): SourceProvenance {
  const { ldrawId, ldrawSource } = blueprint;
  return {
    sourceId: `ldraw:official:${ldrawId}`,
    sourceType: "external-bundled-geometry",
    sourceVersion: `ldraw-complete-2026-07; ${ldrawSource.ldrawOrg}; root ${ldrawSource.rootSha256}`,
    licenseExpression: ldrawSource.licenseExpression,
    attribution: `${ldrawId} "${ldrawSource.title}" by ${ldrawSource.author} and the ${ldrawSource.closureFileCount} files of its LDraw closure, (c) LDraw.org contributors, CC BY 4.0. Per-file authorship is preserved in ldraw-bundled-sources-6651557.ts; reuse is not permission to train.`,
    runtimeRole: "render-mesh-asset",
    redistributionAllowed: true,
    trainingUseAllowed: false,
    externalGeometryBundled: true,
  };
}

function containingProjection(exact: ExactLduBounds): LduBounds {
  const projected = exactLduBoundsToNumbers(exact);
  const min: [number, number, number] = [...projected.min];
  const max: [number, number, number] = [...projected.max];
  for (const axis of [0, 1, 2] as const) {
    if (compareNumberToExactLdu(min[axis], exact.min[axis], "render-only minimum") > 0) {
      min[axis] -= Number.EPSILON * Math.max(1, Math.abs(min[axis])) * 2;
    }
    if (compareNumberToExactLdu(max[axis], exact.max[axis], "render-only maximum") < 0) {
      max[axis] += Number.EPSILON * Math.max(1, Math.abs(max[axis])) * 2;
    }
  }
  return { min, max };
}

/**
 * Overlay one pinned official render surface without changing physical truth.
 *
 * The generated blueprint has no connector, allowance or collision fields.
 * Those arrays are retained by reference from `parametric`, compared as
 * canonical bytes after construction, and independently held to `/12` literals
 * by the focused promotion test.
 */
export function promoteRenderOnlyPart(
  parametric: ParametricPartDefinition,
  blueprint: RenderOnlyPartBlueprint,
): PartDefinition {
  const variantSuffix = blueprint.variant === undefined ? "" : `-${blueprint.variant}`;
  const expectedId = `builtin:${blueprint.family}-${blueprint.widthStuds}x${blueprint.lengthStuds}${variantSuffix}`;
  const identityMismatches = [
    ["id", expectedId, parametric.id],
    ["family", blueprint.family, parametric.family],
    ["widthStuds", blueprint.widthStuds, parametric.dimensions.widthStuds],
    ["lengthStuds", blueprint.lengthStuds, parametric.dimensions.lengthStuds],
    ["heightLdu", blueprint.heightLdu, parametric.dimensions.heightLdu],
  ].filter(([, expected, received]) => expected !== received);
  if (identityMismatches.length > 0) {
    fail(
      blueprint,
      `does not match its preceding catalog definition: ${identityMismatches
        .map(
          ([field, expected, received]) =>
            `${field} expected ${JSON.stringify(expected)}, received ${JSON.stringify(received)}`,
        )
        .join(
          "; ",
        )}. A render-only promotion keeps identity, family, width, length and height unchanged.`,
    );
  }
  if (
    !parametric.aliases.some(
      ({ namespace, value }) => namespace === "ldraw" && value === blueprint.ldrawId,
    )
  ) {
    fail(
      blueprint,
      `does not match the preceding catalog's LDraw identity; expected an ldraw:${blueprint.ldrawId} alias before replacing its picture.`,
    );
  }
  if (!UPRIGHT_ORIENTATIONS.some(({ id }) => id === blueprint.assetToCatalogFrame.orientationId)) {
    fail(
      blueprint,
      `names source-to-catalog orientation ${JSON.stringify(blueprint.assetToCatalogFrame.orientationId)}; require one of ${UPRIGHT_ORIENTATIONS.map(({ id }) => id).join(", ")}.`,
    );
  }
  if (!blueprint.assetToCatalogFrame.translationLdu.every(Number.isSafeInteger)) {
    fail(
      blueprint,
      `translates its source frame by [${blueprint.assetToCatalogFrame.translationLdu.join(", ")}]; require three whole-LDU coordinates.`,
    );
  }

  const asset = SET_6651557_MESH_ASSETS[blueprint.meshAssetId];
  if (asset === undefined) {
    fail(
      blueprint,
      `names bundled mesh asset ${JSON.stringify(blueprint.meshAssetId)}, which is absent from the generated closed set.`,
    );
  }
  const meshRecipe = {
    generatorId: "builtin:preloaded-mesh-reference/1",
    assetId: blueprint.meshAssetId,
    contentHash: meshAssetContentHash(asset),
    collisionMode: "preserved-catalog-recipe",
    assetToCatalogFrame: {
      schemaVersion: blueprint.assetToCatalogFrame.schemaVersion,
      orientationId: blueprint.assetToCatalogFrame.orientationId,
      translationLdu: [...blueprint.assetToCatalogFrame.translationLdu] as LduVector3,
    },
    provenance: geometryProvenance(blueprint),
  } as const satisfies MeshReferenceGeometryRecipe;
  const resolution = resolvePreloadedMeshAsset(meshRecipe);
  if (!resolution.ok) {
    fail(
      blueprint,
      `names bundled mesh ${JSON.stringify(blueprint.meshAssetId)}, which production resolution refuses with ${resolution.code}: ${resolution.message}`,
    );
  }

  const expectedStudSeats = sortedVectors(
    parametric.connectors
      .filter(({ kind }) => kind === "stud")
      .map(({ positionLdu }) => positionLdu),
  );
  const measuredStudSeats = sortedVectors(
    blueprint.sourceStudSeatsLdu.map(([x, y, z]) => [x, y, z]),
  );
  if (JSON.stringify(measuredStudSeats) !== JSON.stringify(expectedStudSeats)) {
    fail(
      blueprint,
      `frames visible source studs at ${JSON.stringify(measuredStudSeats)}, but the preceding catalog's male connectors are ${JSON.stringify(expectedStudSeats)}. Fix the source-to-catalog frame; never move connector truth to meet a mesh.`,
    );
  }

  const exactBodyBounds = parseExactLduBounds(
    blueprint.exactBodyBoundsLdu,
    `${blueprint.ldrawId} exactBodyBoundsLdu`,
  );
  const exactBounds = parseExactLduBounds(
    blueprint.exactBoundsLdu,
    `${blueprint.ldrawId} exactBoundsLdu`,
  );
  const bodyBoundsLdu = containingProjection(exactBodyBounds);
  const boundsLdu = containingProjection(exactBounds);
  assertNumericBoundsContainExact(
    bodyBoundsLdu,
    exactBodyBounds,
    `${blueprint.ldrawId} bodyBoundsLdu`,
  );
  assertNumericBoundsContainExact(boundsLdu, exactBounds, `${blueprint.ldrawId} boundsLdu`);

  const clutchSeatsLdu = parametric.connectors
    .filter(({ kind }) => kind === "undersideClutch")
    .map(({ positionLdu }) => positionLdu);
  const undersideVerdicts = meshClutchUndersides({
    positionsLdu: resolution.asset.positionsLdu,
    indices: resolution.asset.indices,
    groups: resolution.asset.groups,
    bodyBoundsLdu,
    clutchSeatsLdu,
  });
  if (clutchSeatsLdu.length === 0 || undersideVerdicts.some((verdict) => verdict === "flat")) {
    fail(
      blueprint,
      `does not draw a usable underside at every preserved clutch: ${JSON.stringify(undersideVerdicts)}. A render-only promotion may not turn a semantic seat into a visual claim unless the source mesh actually draws its cavity or opening.`,
    );
  }

  const oldConnectorGridCenterLdu =
    parametric.connectorGridCenterLdu ??
    recipeConnectorGridCenter(parametric.geometry) ??
    ([0, 0] as const);
  const oldPartialOverhangEvidence = parametric.geometry.partialOverhangClutchEvidence;
  const beforeStructuralBytes = renderPromotionStructuralBytes(parametric);
  const { geometry: oldGeometry, ...semanticDefinition } = parametric;
  void oldGeometry;
  const promoted: PartDefinition = {
    ...semanticDefinition,
    connectorGridCenterLdu: oldConnectorGridCenterLdu as readonly [number, number],
    bodyBoundsLdu,
    boundsLdu,
    exactBodyBoundsLdu: exactBodyBounds,
    exactBoundsLdu: exactBounds,
    geometry: {
      ...meshRecipe,
      bodyMode: "bundled-source-mesh",
      studMode: measuredStudSeats.length === 0 ? "none" : "measured-stud-seats",
      undersideMode: "modelled-shell-cavity",
      ...(oldPartialOverhangEvidence === undefined
        ? {}
        : { partialOverhangClutchEvidence: oldPartialOverhangEvidence }),
    },
  };
  if (
    promoted.connectors !== parametric.connectors ||
    promoted.collision !== parametric.collision
  ) {
    fail(
      blueprint,
      "copied connector or collision arrays instead of retaining the exact preceding frozen objects.",
    );
  }
  const afterStructuralBytes = renderPromotionStructuralBytes(promoted);
  if (afterStructuralBytes !== beforeStructuralBytes) {
    fail(
      blueprint,
      `changed physical-semantics bytes from ${beforeStructuralBytes} to ${afterStructuralBytes}; a render-only promotion may change only mesh and visual bounds.`,
    );
  }
  if (
    parametric.dimensions.widthLdu !== blueprint.widthStuds * STUD_PITCH_LDU ||
    parametric.dimensions.lengthLdu !== blueprint.lengthStuds * STUD_PITCH_LDU ||
    measuredStudSeats.some(
      ([, y]) => y > bodyBoundsLdu.max[1] || y < boundsLdu.min[1] + STUD_HEIGHT_LDU,
    )
  ) {
    fail(
      blueprint,
      "does not align its nominal lattice dimensions and source stud seats with the exact rendered bounds.",
    );
  }
  return deepFreeze(promoted);
}
