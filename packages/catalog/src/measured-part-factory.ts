import {
  COLLISION_MODEL_VERSION,
  LDCAD_SHADOW_CONNECTOR_PROVENANCE,
  LDRAW_BUNDLED_GEOMETRY_PROVENANCE,
  MEASURED_PART_CATALOG_PROVENANCE,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  UPRIGHT_ORIENTATIONS,
} from "./constants.ts";
import type {
  CollisionAllowance,
  CollisionPrimitive,
  ConnectorPortDefinition,
  LduBounds,
  LduVector3,
  MeshReferenceGeometryRecipe,
  PartDefinition,
  SourceProvenance,
} from "./types.ts";

import { AVAILABLE_COLOR_IDS } from "./colors.ts";
import { validatePinnedClutchOffsets } from "./connector-backing-policy.ts";
import {
  assertNumericBoundsContainExact,
  exactLduBoundsToNumbers,
  parseExactLduBounds,
} from "./exact-ldu.ts";
import { deepFreeze } from "./freeze.ts";
import { meshAssetContentHash, resolvePreloadedMeshAsset } from "./mesh-assets.ts";
import { meshUndersideIsDrawn } from "./mesh-underside.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import type { MeasuredPartBlueprint } from "./measured-part-types.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import {
  FAMILY_DISPLAY_NAMES,
  LEGAL_ORIENTATION_IDS,
  makeAliases,
} from "./part-factory-support.ts";

/**
 * How far the union of measured collision columns may sit from the measured
 * body bounds before the declaration is refused. Both come from the same
 * expansion, so they agree to the last bit; this is a guard against an edited
 * table, not a fitting tolerance.
 */
export const MEASURED_BOUNDS_TOLERANCE_LDU = 1e-9;

const AXIS_NAMES = ["x", "y", "z"] as const;

function fail(blueprint: MeasuredPartBlueprint, message: string): never {
  throw new Error(`Measured part ${blueprint.designId} (${blueprint.ldrawId}) ${message}`);
}

/**
 * Which authored source made this part's clutch cells, and the catalog
 * provenance that says so.
 *
 * A female connector is not recoverable from LDraw geometry — an underside is a
 * cavity and the measured tubes sit half a stud pitch off the cell lattice — so
 * every clutch here is an authored claim by a named third party. Exactly one
 * source may make it, because a part that names two has no single licence,
 * attribution or evidence chain, and a part that names none is claiming a grip
 * nothing authored.
 */
function connectorProvenance(blueprint: MeasuredPartBlueprint): SourceProvenance {
  const builder = blueprint.builderSource !== undefined;
  const builderConnectivity = blueprint.builderConnectivitySource !== undefined;
  const shadow = blueprint.ldcadShadowSource !== undefined;
  const sourceCount = Number(builder) + Number(builderConnectivity) + Number(shadow);
  if (sourceCount !== 1) {
    fail(
      blueprint,
      `declares ${sourceCount} authored connector sources for its ${blueprint.clutchesLdu.length} clutch cells; a clutch is one authored claim, so exactly one Builder frame, pinned Builder connectivity fact, or LDCad shadow walk must make it.`,
    );
  }
  if (builderConnectivity) {
    validatePinnedClutchOffsets(
      blueprint.ldrawId,
      blueprint.clutchesLdu.map(([x, , z]) => [x, z] as const),
      blueprint.builderConnectivitySource!,
    );
  }
  return shadow ? LDCAD_SHADOW_CONNECTOR_PROVENANCE : MEASURED_PART_CATALOG_PROVENANCE;
}

function unionOf(boxes: readonly LduBounds[]): LduBounds {
  return {
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
  };
}

function readBodyBoxes(blueprint: MeasuredPartBlueprint): readonly LduBounds[] {
  const flat = blueprint.bodyBoxesLdu;
  if (flat.length === 0 || flat.length % 6 !== 0) {
    fail(
      blueprint,
      `declares ${flat.length} collision column values; the per-column height field is flattened into [minX, minY, minZ, maxX, maxY, maxZ] sextuples, so the count must be a positive multiple of six.`,
    );
  }
  const boxes: LduBounds[] = [];
  for (let offset = 0; offset < flat.length; offset += 6) {
    const values = flat.slice(offset, offset + 6);
    if (!values.every(Number.isFinite)) {
      fail(
        blueprint,
        `collision column ${offset / 6} is [${values.join(", ")}]; every measured LDU coordinate must be finite.`,
      );
    }
    const box: LduBounds = {
      min: [values[0]!, values[1]!, values[2]!],
      max: [values[3]!, values[4]!, values[5]!],
    };
    const flatAxis = [0, 1, 2].find((axis) => box.max[axis]! <= box.min[axis]!);
    if (flatAxis !== undefined) {
      fail(
        blueprint,
        `collision column ${offset / 6} spans ${AXIS_NAMES[flatAxis]} from ${box.min[flatAxis]} to ${box.max[flatAxis]}; a solid column needs a strictly positive extent on every axis.`,
      );
    }
    boxes.push(box);
  }
  return boxes;
}

function assertBoundsAgree(
  blueprint: MeasuredPartBlueprint,
  measured: LduBounds,
  declared: LduBounds,
  label: string,
): void {
  for (const axis of [0, 1, 2] as const) {
    if (
      Math.abs(measured.min[axis] - declared.min[axis]) > MEASURED_BOUNDS_TOLERANCE_LDU ||
      Math.abs(measured.max[axis] - declared.max[axis]) > MEASURED_BOUNDS_TOLERANCE_LDU
    ) {
      fail(
        blueprint,
        `${label} spans ${AXIS_NAMES[axis]} from ${measured.min[axis]} to ${measured.max[axis]} but its declared body extents run ${declared.min[axis]} to ${declared.max[axis]}; the two are measured from the same expanded closure and must agree within ${MEASURED_BOUNDS_TOLERANCE_LDU} LDU.`,
      );
    }
  }
}

/**
 * Compiles one measured declaration into a catalog part.
 *
 * Every check here names the part and the observed number, because a measured
 * table is regenerated rather than typed: a failure has to say which row of
 * which part disagrees with which other row.
 */
export const makeMeasuredPartDefinition = (blueprint: MeasuredPartBlueprint): PartDefinition => {
  const {
    ldrawId,
    family,
    widthStuds,
    lengthStuds,
    variant,
    heightLdu,
    meshAssetId,
    assetToCatalogFrame,
    connectorGridCenterLdu,
  } = blueprint;

  if (!UPRIGHT_ORIENTATIONS.some(({ id }) => id === assetToCatalogFrame.orientationId)) {
    fail(
      blueprint,
      `names source-to-catalog orientation ${JSON.stringify(assetToCatalogFrame.orientationId)}; the frame is one of ${UPRIGHT_ORIENTATIONS.map(({ id }) => id).join(", ")}.`,
    );
  }
  if (!assetToCatalogFrame.translationLdu.every(Number.isSafeInteger)) {
    fail(
      blueprint,
      `translates its source frame by [${assetToCatalogFrame.translationLdu.join(", ")}]; the source-to-catalog translation is whole LDU so the raw frame is carried exactly rather than resampled.`,
    );
  }
  if (!Number.isSafeInteger(heightLdu) || heightLdu <= 0) {
    fail(blueprint, `declares heightLdu ${heightLdu}; a lattice height is a positive whole LDU.`);
  }
  if (!connectorGridCenterLdu.every(Number.isSafeInteger)) {
    fail(
      blueprint,
      `declares connectorGridCenterLdu [${connectorGridCenterLdu.join(", ")}]; the lattice centre is two whole LDU coordinates so snapping stays exact.`,
    );
  }

  const exactBodyBounds = parseExactLduBounds(
    blueprint.exactBodyBoundsLdu,
    `${ldrawId} exactBodyBoundsLdu`,
  );
  const exactBounds = parseExactLduBounds(blueprint.exactBoundsLdu, `${ldrawId} exactBoundsLdu`);
  const bodyBoundsLdu = exactLduBoundsToNumbers(exactBodyBounds);
  const boundsLdu = exactLduBoundsToNumbers(exactBounds);
  assertNumericBoundsContainExact(bodyBoundsLdu, exactBodyBounds, `${ldrawId} bodyBoundsLdu`);
  assertNumericBoundsContainExact(boundsLdu, exactBounds, `${ldrawId} boundsLdu`);
  for (const axis of [0, 1, 2] as const) {
    if (
      boundsLdu.min[axis] > bodyBoundsLdu.min[axis] ||
      boundsLdu.max[axis] < bodyBoundsLdu.max[axis]
    ) {
      fail(
        blueprint,
        `has visual ${AXIS_NAMES[axis]} extents ${boundsLdu.min[axis]} to ${boundsLdu.max[axis]} that do not contain its body extents ${bodyBoundsLdu.min[axis]} to ${bodyBoundsLdu.max[axis]}; the visual bounds are the body plus whatever stands proud of it.`,
      );
    }
  }
  // Placement rests a part's underside from its lattice height, so the
  // underside plane is exact. The top may stand proud of the nominal plane —
  // 93273's curve peaks 0.00016098 LDU above two plates — but never short of
  // it, which would mean the declared height overstates the measured part.
  if (bodyBoundsLdu.max[1] !== heightLdu / 2) {
    fail(
      blueprint,
      `has its measured underside at y=${bodyBoundsLdu.max[1]} but declares heightLdu ${heightLdu}, whose underside plane is y=${heightLdu / 2}; placement rests the part there, so the two must be the same number.`,
    );
  }
  if (bodyBoundsLdu.min[1] > -heightLdu / 2) {
    fail(
      blueprint,
      `has its measured top at y=${bodyBoundsLdu.min[1]}, inside the nominal top plane y=${-heightLdu / 2} of heightLdu ${heightLdu}; a measured body may stand proud of its lattice height and may not fall short of it.`,
    );
  }

  const bodyBoxes = readBodyBoxes(blueprint);
  assertBoundsAgree(blueprint, unionOf(bodyBoxes), bodyBoundsLdu, "its collision column union");

  const connectors: ConnectorPortDefinition[] = [];
  const primitives: CollisionPrimitive[] = bodyBoxes.map((box, index) => ({
    id: `body:${index}`,
    kind: "box",
    tag: "body",
    minLdu: box.min,
    maxLdu: box.max,
  }));
  const allowances: CollisionAllowance[] = [];

  blueprint.studsLdu.forEach(([x, y, z, radiusLdu, studHeightLdu], index) => {
    if (y !== bodyBoundsLdu.min[1]) {
      fail(
        blueprint,
        `stud ${index} seats at y=${y} but the measured top plane is y=${bodyBoundsLdu.min[1]}; a stud stands on the part's own top surface.`,
      );
    }
    if (!(radiusLdu > 0) || !(studHeightLdu > 0)) {
      fail(
        blueprint,
        `stud ${index} measures radius ${radiusLdu} and height ${studHeightLdu} LDU; both must be positive.`,
      );
    }
    connectors.push({
      id: `stud:${index}`,
      kind: "stud",
      geometryRole: "stud",
      profileId: "stud-tube/1",
      gender: "male",
      positionLdu: [x, y, z],
      normal: [0, -1, 0],
      orientationId: "connector-up",
      capacity: 1,
      compatibleKinds: ["undersideClutch"],
    });
    primitives.push({
      id: `stud:${index}`,
      kind: "cylinder",
      tag: "stud",
      axis: "y",
      centerLdu: [x, y - studHeightLdu / 2, z],
      radiusLdu,
      heightLdu: studHeightLdu,
    });
  });

  blueprint.clutchesLdu.forEach(([x, y, z], index) => {
    if (!Number.isSafeInteger(y) || y < bodyBoundsLdu.min[1] || y > bodyBoundsLdu.max[1]) {
      fail(
        blueprint,
        `underside clutch ${index} seats at y=${y}, outside the measured body's ${bodyBoundsLdu.min[1]} to ${bodyBoundsLdu.max[1]} range or off the whole-LDU lattice; a seat is a plane of the part.`,
      );
    }
    const portId = `undersideClutch:${index}`;
    connectors.push({
      id: portId,
      kind: "undersideClutch",
      geometryRole: "tubeSeat",
      profileId: "stud-tube/1",
      gender: "female",
      positionLdu: [x, y, z],
      normal: [0, 1, 0],
      orientationId: "connector-down",
      capacity: 1,
      compatibleKinds: ["stud"],
    });
    allowances.push({
      id: `tubeSeat:${index}`,
      portId,
      portKind: "undersideClutch",
      incomingPrimitiveTag: "stud",
      centerLdu: [x, y - STUD_HEIGHT_LDU / 2, z],
      radiusLdu: STUD_RADIUS_LDU,
      maxInsertionDepthLdu: STUD_HEIGHT_LDU,
      requiresValidatedConnection: true,
    });
  });

  const asset = SET_6651557_MESH_ASSETS[meshAssetId];
  if (asset === undefined) {
    fail(
      blueprint,
      `names bundled mesh asset ${JSON.stringify(meshAssetId)}, which is not in the closed set [${Object.keys(SET_6651557_MESH_ASSETS).join(", ")}].`,
    );
  }

  const geometryProvenance: SourceProvenance = {
    sourceId: `ldraw:official:${ldrawId}`,
    sourceType: "external-bundled-geometry",
    sourceVersion: `${LDRAW_BUNDLED_GEOMETRY_PROVENANCE.sourceVersion}; ${blueprint.ldrawSource.ldrawOrg}; root ${blueprint.ldrawSource.rootSha256}`,
    licenseExpression: blueprint.ldrawSource.licenseExpression,
    attribution: `${ldrawId} "${blueprint.ldrawSource.title}" by ${blueprint.ldrawSource.author} and the ${blueprint.ldrawSource.closureFileCount} files of its LDraw closure, (c) LDraw.org contributors, CC BY 4.0. Per-file authorship is preserved in ldraw-bundled-sources-6651557.ts; reuse is not permission to train.`,
    runtimeRole: "render-mesh-asset",
    redistributionAllowed: true,
    trainingUseAllowed: false,
    externalGeometryBundled: true,
  };

  const meshRecipe = {
    generatorId: "builtin:preloaded-mesh-reference/1",
    assetId: meshAssetId,
    contentHash: meshAssetContentHash(asset),
    collisionMode: "mesh-derived-height-field",
    assetToCatalogFrame: {
      schemaVersion: assetToCatalogFrame.schemaVersion,
      orientationId: assetToCatalogFrame.orientationId,
      translationLdu: [
        assetToCatalogFrame.translationLdu[0],
        assetToCatalogFrame.translationLdu[1],
        assetToCatalogFrame.translationLdu[2],
      ],
    },
    ...(blueprint.builderConnectivitySource === undefined
      ? {}
      : { partialOverhangClutchEvidence: blueprint.builderConnectivitySource }),
    provenance: geometryProvenance,
  } as const satisfies MeshReferenceGeometryRecipe;

  /**
   * The three modes, read off the mesh rather than written beside it.
   *
   * `part-standard` reported all eight mesh parts as unverifiable because the
   * recipe named no mode at all. It could not have named one honestly either:
   * these parts draw the expanded LDraw surface, so what they draw is a fact
   * about bundled geometry and the only truthful way to state it is to measure
   * it. The resolver is the same one the renderer uses, so the surface measured
   * here is the surface drawn.
   */
  const resolution = resolvePreloadedMeshAsset(meshRecipe);
  if (!resolution.ok) {
    fail(
      blueprint,
      `names bundled mesh asset ${JSON.stringify(meshAssetId)}, which the production resolver refuses with ${resolution.code}: ${resolution.message}`,
    );
  }
  const clutchSeatsLdu = blueprint.clutchesLdu.map(([x, y, z]) => [x, y, z] as LduVector3);
  const undersideMode =
    blueprint.clutchesLdu.length === 0
      ? "none"
      : meshUndersideIsDrawn({
            positionsLdu: resolution.asset.positionsLdu,
            indices: resolution.asset.indices,
            groups: resolution.asset.groups,
            bodyBoundsLdu,
            clutchSeatsLdu,
          })
        ? "modelled-shell-cavity"
        : "semantic-tube-seat-offsets";

  const variantSuffix = variant === undefined ? "" : `-${variant}`;
  const displayName =
    `${FAMILY_DISPLAY_NAMES[family]} ${widthStuds} x ${lengthStuds}` +
    (variant === undefined ? "" : ` ${variant[0]!.toUpperCase()}${variant.slice(1)}`);

  return deepFreeze({
    id: `builtin:${family}-${widthStuds}x${lengthStuds}${variantSuffix}`,
    family,
    displayName,
    aliases: makeAliases(displayName, ldrawId),
    dimensions: {
      widthStuds,
      lengthStuds,
      widthLdu: widthStuds * STUD_PITCH_LDU,
      lengthLdu: lengthStuds * STUD_PITCH_LDU,
      heightLdu,
    },
    connectorGridCenterLdu,
    bodyBoundsLdu,
    boundsLdu,
    exactBodyBoundsLdu: exactBodyBounds,
    exactBoundsLdu: exactBounds,
    geometry: {
      ...meshRecipe,
      // A mesh part's body is the bundled surface itself, so it is neither a
      // prism nor a union of boxes and says so rather than borrowing a
      // generated part's word for it.
      bodyMode: "bundled-source-mesh",
      studMode: blueprint.studsLdu.length === 0 ? "none" : "measured-stud-seats",
      undersideMode,
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
    provenance: connectorProvenance(blueprint),
  });
};

/** The set 6651557 parts admitted from measured LDraw, Builder and LDCad source. */
export const MEASURED_PART_DEFINITIONS: readonly PartDefinition[] = deepFreeze(
  SET_6651557_MEASURED_BLUEPRINTS.map(makeMeasuredPartDefinition),
);
