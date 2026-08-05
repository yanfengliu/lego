import {
  CONNECTOR_KIND_RULES,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
  UPRIGHT_ORIENTATIONS,
  connectorAccepts,
} from "./constants.ts";
import { MAX_EXACT_LDU_MAGNITUDE } from "./exact-ldu.ts";
import {
  MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
  isLowercaseSha256,
  isValidMeshAssetId,
  resolvePreloadedMeshAsset,
  type MeshAssetResolver,
  type PreloadedMeshGroup,
  type ResolvedMeshAsset,
} from "./mesh-assets.ts";
import type {
  CollisionPrimitive,
  LduBounds,
  LduVector3,
  PartDefinition,
  SourceProvenance,
} from "./types.ts";

export const MESH_VISUAL_BOUNDS_TOLERANCE_LDU = MESH_RENDER_QUANTIZATION_TOLERANCE_LDU;

export type MeshPartAdmissionIssueCode =
  | "MESH_ADMISSION_NOT_MESH"
  | "MESH_ADMISSION_ASSET_ID_INVALID"
  | "MESH_ADMISSION_HASH_INVALID"
  | "MESH_ADMISSION_PROVENANCE_INVALID"
  | "MESH_ADMISSION_FRAME_INVALID"
  | "MESH_ADMISSION_DIMENSIONS_INVALID"
  | "MESH_ADMISSION_CONNECTOR_INVALID"
  | "MESH_ADMISSION_CONNECTOR_GRID_MISMATCH"
  | "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH"
  | "MESH_ADMISSION_COLLISION_INVALID"
  | "MESH_ADMISSION_VERTICAL_EXTENTS_INVALID"
  | "MESH_ADMISSION_GRID_CENTER_INVALID"
  | "MESH_ADMISSION_BOUNDS_INVALID"
  | "MESH_ADMISSION_RESOLUTION_FAILED"
  | "MESH_ADMISSION_BODY_BOUNDS_MISMATCH"
  | "MESH_ADMISSION_VISUAL_BOUNDS_MISMATCH";

export interface MeshPartAdmissionIssue {
  readonly code: MeshPartAdmissionIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface MeshPartAdmissionResult {
  readonly accepted: boolean;
  readonly issues: readonly MeshPartAdmissionIssue[];
}

/**
 * A measured LDU coordinate: finite, and within the magnitude the exact bound
 * representation can carry.
 *
 * Geometry is not whole LDU once it is measured rather than generated — 51739's
 * wing ends at 38.5 and 93273's curve peaks 0.00016098 LDU above two plates — so
 * requiring integers of extents and collision bodies would refuse the real parts
 * this gate exists to admit. Connector positions, the placement lattice, the
 * asset frame and collision allowances keep their whole-LDU rule below, because
 * those are lattice claims rather than measurements.
 */
function isMeasuredLdu(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_EXACT_LDU_MAGNITUDE;
}

function validBounds(bounds: LduBounds): boolean {
  return (
    bounds.min.length === 3 &&
    bounds.max.length === 3 &&
    bounds.min.every(isMeasuredLdu) &&
    bounds.max.every(isMeasuredLdu) &&
    bounds.min.every((minimum, axis) => minimum <= bounds.max[axis]!)
  );
}

function boundsContain(outer: LduBounds, inner: LduBounds): boolean {
  return outer.min.every(
    (minimum, axis) => minimum <= inner.min[axis]! && outer.max[axis]! >= inner.max[axis]!,
  );
}

function validConnectorGridCenter(
  value: PartDefinition["connectorGridCenterLdu"],
): value is readonly [number, number] {
  return value !== undefined && value.length === 2 && value.every(Number.isSafeInteger);
}

function hasDeclaredText(value: string): boolean {
  return value.trim().length > 0;
}

function hasDeclaredLicense(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 && normalized !== "NONE" && normalized !== "NOASSERTION";
}

function coherentRenderMeshProvenance(provenance: SourceProvenance): boolean {
  const coherentSource =
    (provenance.sourceType === "project-authored" && !provenance.externalGeometryBundled) ||
    (provenance.sourceType === "external-bundled-geometry" && provenance.externalGeometryBundled);
  return (
    provenance.runtimeRole === "render-mesh-asset" &&
    coherentSource &&
    provenance.redistributionAllowed &&
    hasDeclaredText(provenance.sourceId) &&
    hasDeclaredText(provenance.sourceVersion) &&
    hasDeclaredLicense(provenance.licenseExpression) &&
    hasDeclaredText(provenance.attribution)
  );
}

function validAssetFrame(
  recipe: Extract<PartDefinition["geometry"], { assetId: string }>,
): boolean {
  const frame = recipe.assetToCatalogFrame;
  return (
    frame !== undefined &&
    frame.schemaVersion === "mesh-asset-to-catalog-frame/1" &&
    UPRIGHT_ORIENTATIONS.some(({ id }) => id === frame.orientationId) &&
    Array.isArray(frame.translationLdu) &&
    frame.translationLdu.length === 3 &&
    frame.translationLdu.every(Number.isSafeInteger)
  );
}

function boundsAgree(left: LduBounds, right: LduBounds): boolean {
  return left.min.every(
    (minimum, axis) =>
      Math.abs(minimum - right.min[axis]!) <= MESH_VISUAL_BOUNDS_TOLERANCE_LDU &&
      Math.abs(left.max[axis]! - right.max[axis]!) <= MESH_VISUAL_BOUNDS_TOLERANCE_LDU,
  );
}

function safeVector(value: readonly number[]): value is LduVector3 {
  return value.length === 3 && value.every(Number.isSafeInteger);
}

function pointInside(bounds: LduBounds, point: LduVector3): boolean {
  return point.every(
    (coordinate, axis) =>
      coordinate >= bounds.min[axis]! - MESH_VISUAL_BOUNDS_TOLERANCE_LDU &&
      coordinate <= bounds.max[axis]! + MESH_VISUAL_BOUNDS_TOLERANCE_LDU,
  );
}

function validPositiveBounds(bounds: LduBounds): boolean {
  return validBounds(bounds) && bounds.min.every((minimum, axis) => minimum < bounds.max[axis]!);
}

function validConvexPlan(vertices: readonly (readonly [number, number])[]): boolean {
  if (
    vertices.length < 3 ||
    vertices.length > 8 ||
    !vertices.every((vertex) => vertex.length === 2 && vertex.every(isMeasuredLdu))
  ) {
    return false;
  }
  for (let index = 0; index < vertices.length; index += 1) {
    const [ax, az] = vertices[(index + vertices.length - 1) % vertices.length]!;
    const [bx, bz] = vertices[index]!;
    const [cx, cz] = vertices[(index + 1) % vertices.length]!;
    if ((bx - ax) * (cz - bz) - (bz - az) * (cx - bx) <= 0) return false;
  }
  return true;
}

function clippedWedgePlan(
  bounds: LduBounds,
  cutNormalXZ: readonly [number, number],
  cutOffsetLdu: number,
): readonly (readonly [number, number])[] | null {
  const [normalX, normalZ] = cutNormalXZ;
  const corners: readonly (readonly [number, number])[] = [
    [bounds.min[0], bounds.min[2]],
    [bounds.max[0], bounds.min[2]],
    [bounds.max[0], bounds.max[2]],
    [bounds.min[0], bounds.max[2]],
  ];
  const distance = ([x, z]: readonly [number, number]): number =>
    normalX * x + normalZ * z - cutOffsetLdu;
  const clipped: (readonly [number, number])[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index]!;
    const previous = corners[(index + corners.length - 1) % corners.length]!;
    const currentDistance = distance(current);
    const previousDistance = distance(previous);
    if (!Number.isFinite(currentDistance) || !Number.isFinite(previousDistance)) return null;
    const currentInside = currentDistance <= 0;
    const previousInside = previousDistance <= 0;
    if (currentInside !== previousInside) {
      const denominator = previousDistance - currentDistance;
      const fraction = previousDistance / denominator;
      const intersection = [
        previous[0] + fraction * (current[0] - previous[0]),
        previous[1] + fraction * (current[1] - previous[1]),
      ] as const;
      if (!intersection.every(Number.isFinite)) return null;
      clipped.push(intersection);
    }
    if (currentInside) clipped.push(current);
  }
  const unique = clipped.filter(
    (point, index) =>
      index === 0 || point[0] !== clipped[index - 1]![0] || point[1] !== clipped[index - 1]![1],
  );
  if (
    unique.length > 1 &&
    unique[0]![0] === unique[unique.length - 1]![0] &&
    unique[0]![1] === unique[unique.length - 1]![1]
  ) {
    unique.pop();
  }
  if (unique.length < 3) return null;
  let twiceArea = 0;
  for (let index = 0; index < unique.length; index += 1) {
    const current = unique[index]!;
    const next = unique[(index + 1) % unique.length]!;
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return Number.isFinite(twiceArea) && Math.abs(twiceArea) > 0 ? unique : null;
}

function collisionPrimitiveBounds(primitive: CollisionPrimitive): LduBounds | null {
  if (primitive.kind === "box") {
    const bounds = { min: primitive.minLdu, max: primitive.maxLdu };
    return primitive.tag === "body" && validPositiveBounds(bounds) ? bounds : null;
  }
  if (primitive.kind === "wedge") {
    const bounds = { min: primitive.minLdu, max: primitive.maxLdu };
    const cutNormalValid =
      primitive.cutNormalXZ.length === 2 &&
      primitive.cutNormalXZ.every(Number.isSafeInteger) &&
      primitive.cutNormalXZ.some((coordinate) => coordinate !== 0);
    if (
      primitive.tag !== "body" ||
      !validPositiveBounds(bounds) ||
      !cutNormalValid ||
      !isMeasuredLdu(primitive.cutOffsetLdu)
    ) {
      return null;
    }
    const clipped = clippedWedgePlan(bounds, primitive.cutNormalXZ, primitive.cutOffsetLdu);
    if (clipped === null) return null;
    const xs = clipped.map(([x]) => x);
    const zs = clipped.map(([, z]) => z);
    return {
      min: [Math.min(...xs), bounds.min[1], Math.min(...zs)],
      max: [Math.max(...xs), bounds.max[1], Math.max(...zs)],
    };
  }
  if (primitive.kind === "cylinder") {
    if (
      (primitive.tag !== "body" && primitive.tag !== "stud") ||
      (primitive.tag === "stud" && primitive.axis !== "y") ||
      (primitive.axis !== "x" && primitive.axis !== "y" && primitive.axis !== "z") ||
      primitive.centerLdu.length !== 3 ||
      !primitive.centerLdu.every(isMeasuredLdu) ||
      !isMeasuredLdu(primitive.radiusLdu) ||
      primitive.radiusLdu <= 0 ||
      !isMeasuredLdu(primitive.heightLdu) ||
      primitive.heightLdu <= 0
    ) {
      return null;
    }
    const halfHeight = primitive.heightLdu / 2;
    const halfExtents: LduVector3 =
      primitive.axis === "x"
        ? [halfHeight, primitive.radiusLdu, primitive.radiusLdu]
        : primitive.axis === "y"
          ? [primitive.radiusLdu, halfHeight, primitive.radiusLdu]
          : [primitive.radiusLdu, primitive.radiusLdu, halfHeight];
    return {
      min: primitive.centerLdu.map(
        (coordinate, axis) => coordinate - halfExtents[axis]!,
      ) as unknown as LduVector3,
      max: primitive.centerLdu.map(
        (coordinate, axis) => coordinate + halfExtents[axis]!,
      ) as unknown as LduVector3,
    };
  }
  if (primitive.kind !== "convex-prism") return null;
  if (
    primitive.tag !== "body" ||
    !validConvexPlan(primitive.verticesXZLdu) ||
    !isMeasuredLdu(primitive.minYLdu) ||
    !isMeasuredLdu(primitive.maxYLdu) ||
    primitive.minYLdu >= primitive.maxYLdu
  ) {
    return null;
  }
  const xs = primitive.verticesXZLdu.map(([x]) => x);
  const zs = primitive.verticesXZLdu.map(([, z]) => z);
  return {
    min: [Math.min(...xs), primitive.minYLdu, Math.min(...zs)],
    max: [Math.max(...xs), primitive.maxYLdu, Math.max(...zs)],
  };
}

function unionBounds(bounds: readonly LduBounds[]): LduBounds | null {
  if (bounds.length === 0) return null;
  return {
    min: [
      Math.min(...bounds.map(({ min }) => min[0])),
      Math.min(...bounds.map(({ min }) => min[1])),
      Math.min(...bounds.map(({ min }) => min[2])),
    ],
    max: [
      Math.max(...bounds.map(({ max }) => max[0])),
      Math.max(...bounds.map(({ max }) => max[1])),
      Math.max(...bounds.map(({ max }) => max[2])),
    ],
  };
}

function placementResidue(firstConnectorCoordinate: number): number {
  return (
    (((STUD_PITCH_LDU / 2 - firstConnectorCoordinate) % STUD_PITCH_LDU) + STUD_PITCH_LDU) %
    STUD_PITCH_LDU
  );
}

function onStudLattice(coordinate: number): boolean {
  return (
    (((coordinate - STUD_PITCH_LDU / 2) % STUD_PITCH_LDU) + STUD_PITCH_LDU) % STUD_PITCH_LDU === 0
  );
}

function resolvedMeshBounds(
  asset: ResolvedMeshAsset,
  selectedRole?: PreloadedMeshGroup["role"],
): LduBounds | null {
  const minimum = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const maximum = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let visitedVertices = 0;
  const visit = (vertex: number): void => {
    const offset = vertex * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const coordinate = asset.positionsLdu[offset + axis]!;
      minimum[axis] = Math.min(minimum[axis]!, coordinate);
      maximum[axis] = Math.max(maximum[axis]!, coordinate);
    }
    visitedVertices += 1;
  };
  if (selectedRole === undefined) {
    for (let vertex = 0; vertex < asset.vertexCount; vertex += 1) visit(vertex);
  } else {
    for (const group of asset.groups) {
      if (group.role !== selectedRole) continue;
      for (
        let triangle = group.triangleStart;
        triangle < group.triangleStart + group.triangleCount;
        triangle += 1
      ) {
        for (let corner = 0; corner < 3; corner += 1) {
          visit(asset.indices?.[triangle * 3 + corner] ?? triangle * 3 + corner);
        }
      }
    }
  }
  if (visitedVertices === 0) return null;
  return {
    min: [minimum[0]!, minimum[1]!, minimum[2]!],
    max: [maximum[0]!, maximum[1]!, maximum[2]!],
  };
}

/**
 * Admission gate for rendering-only mesh references.
 *
 * This proves closed-asset identity, asset-frame application, exact declared
 * visual bounds, and that the independently authored dimensions, connector,
 * snapping, and collision representations are finite and internally
 * consistent. It does not certify resemblance, clutch strength, physical
 * buildability, or that those independent declarations match a real part.
 */
export function validateMeshPartDefinitionAdmission(
  definition: PartDefinition,
  resolveMeshAsset: MeshAssetResolver = resolvePreloadedMeshAsset,
): MeshPartAdmissionResult {
  const issues: MeshPartAdmissionIssue[] = [];
  const add = (code: MeshPartAdmissionIssueCode, path: string, message: string) => {
    issues.push(Object.freeze({ code, path, message }));
  };

  if (definition.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
    add(
      "MESH_ADMISSION_NOT_MESH",
      "/geometry/generatorId",
      `Part ${definition.id} uses ${definition.geometry.generatorId}; this admission gate accepts only builtin:preloaded-mesh-reference/1 recipes.`,
    );
    return Object.freeze({ accepted: false, issues: Object.freeze(issues) });
  }

  const recipe = definition.geometry;
  if (!isValidMeshAssetId(recipe.assetId)) {
    add(
      "MESH_ADMISSION_ASSET_ID_INVALID",
      "/geometry/assetId",
      `Part ${definition.id} has invalid mesh asset id ${JSON.stringify(recipe.assetId)}; use the resolver's bounded lowercase bundled-asset identifier syntax with no NUL or control characters.`,
    );
  }
  if (!isLowercaseSha256(recipe.contentHash)) {
    add(
      "MESH_ADMISSION_HASH_INVALID",
      "/geometry/contentHash",
      `Part ${definition.id} mesh contentHash must be exactly sha256: plus 64 lowercase hexadecimal digits; received ${JSON.stringify(recipe.contentHash)}.`,
    );
  }
  if (!coherentRenderMeshProvenance(recipe.provenance)) {
    add(
      "MESH_ADMISSION_PROVENANCE_INVALID",
      "/geometry/provenance",
      `Part ${definition.id} mesh provenance must be a redistributable render-mesh-asset with declared source, version, license, and attribution. project-authored requires externalGeometryBundled=false; external-bundled-geometry requires externalGeometryBundled=true. Received sourceType=${recipe.provenance.sourceType}, runtimeRole=${recipe.provenance.runtimeRole}, redistributionAllowed=${recipe.provenance.redistributionAllowed}, externalGeometryBundled=${recipe.provenance.externalGeometryBundled}, licenseExpression=${JSON.stringify(recipe.provenance.licenseExpression)}.`,
    );
  }
  if (!validAssetFrame(recipe)) {
    add(
      "MESH_ADMISSION_FRAME_INVALID",
      "/geometry/assetToCatalogFrame",
      `Part ${definition.id} needs a versioned mesh asset-to-catalog frame with a valid upright orientation and exactly three safe-integer LDU translations; PartDefinition.ldrawFrame is not used for mesh normalization. Received ${JSON.stringify(recipe.assetToCatalogFrame)}.`,
    );
  }

  const dimensions = definition.dimensions;
  const dimensionsValid =
    Number.isSafeInteger(dimensions.widthStuds) &&
    dimensions.widthStuds > 0 &&
    Number.isSafeInteger(dimensions.lengthStuds) &&
    dimensions.lengthStuds > 0 &&
    Number.isSafeInteger(dimensions.widthLdu) &&
    dimensions.widthLdu === dimensions.widthStuds * STUD_PITCH_LDU &&
    Number.isSafeInteger(dimensions.lengthLdu) &&
    dimensions.lengthLdu === dimensions.lengthStuds * STUD_PITCH_LDU &&
    Number.isSafeInteger(dimensions.heightLdu) &&
    dimensions.heightLdu > 0;
  if (!dimensionsValid) {
    add(
      "MESH_ADMISSION_DIMENSIONS_INVALID",
      "/dimensions",
      `Part ${definition.id} dimensions must use positive safe integers, with widthLdu=widthStuds*${STUD_PITCH_LDU} and lengthLdu=lengthStuds*${STUD_PITCH_LDU}; received ${JSON.stringify(dimensions)}.`,
    );
  }

  const gridCenter = definition.connectorGridCenterLdu;
  if (!validConnectorGridCenter(gridCenter)) {
    add(
      "MESH_ADMISSION_GRID_CENTER_INVALID",
      "/connectorGridCenterLdu",
      `Part ${definition.id} needs exactly two safe-integer geometry-independent connectorGridCenterLdu coordinates before mesh admission; received ${JSON.stringify(gridCenter)}.`,
    );
  }

  const bodyBoundsValid = validBounds(definition.bodyBoundsLdu);
  const visualBoundsValid = validBounds(definition.boundsLdu);
  if (
    !bodyBoundsValid ||
    !visualBoundsValid ||
    (bodyBoundsValid &&
      visualBoundsValid &&
      !boundsContain(definition.boundsLdu, definition.bodyBoundsLdu))
  ) {
    add(
      "MESH_ADMISSION_BOUNDS_INVALID",
      "/bodyBoundsLdu",
      `Part ${definition.id} needs finite ordered bodyBoundsLdu separately contained by visual boundsLdu before mesh admission.`,
    );
  }

  // Placement rests a part's underside from heightLdu, so the underside plane
  // is exact. The measured top may stand proud of the nominal plane — 93273's
  // curve peaks 0.00016098 LDU above two plates — but never short of it, which
  // would mean the declared lattice height overstates the part.
  if (
    dimensionsValid &&
    bodyBoundsValid &&
    (definition.bodyBoundsLdu.min[1] > -dimensions.heightLdu / 2 ||
      definition.bodyBoundsLdu.max[1] !== dimensions.heightLdu / 2)
  ) {
    add(
      "MESH_ADMISSION_VERTICAL_EXTENTS_INVALID",
      "/bodyBoundsLdu",
      `Part ${definition.id} body vertical bounds are [${definition.bodyBoundsLdu.min[1]}, ${definition.bodyBoundsLdu.max[1]}]; heightLdu ${dimensions.heightLdu} requires the underside at exactly ${dimensions.heightLdu / 2} so placement can rest it there, and a top at ${-dimensions.heightLdu / 2} or above it, never inside.`,
    );
  }

  const connectorIds = new Set<string>();
  let connectorRepresentationValid = true;
  for (let index = 0; index < definition.connectors.length; index += 1) {
    const connector = definition.connectors[index]!;
    const taxonomy = CONNECTOR_KIND_RULES[connector.kind];
    const expectedCompatibleKinds = taxonomy === undefined ? [] : connectorAccepts(connector.kind);
    const normalMagnitude = connector.normal.reduce(
      (total, coordinate) => total + Math.abs(coordinate),
      0,
    );
    const verticalConnectorDirectionValid =
      connector.kind === "stud"
        ? connector.orientationId === "connector-up" &&
          connector.normal[0] === 0 &&
          connector.normal[1] === -1 &&
          connector.normal[2] === 0
        : connector.kind === "undersideClutch"
          ? connector.orientationId === "connector-down" &&
            connector.normal[0] === 0 &&
            connector.normal[1] === 1 &&
            connector.normal[2] === 0
          : true;
    const valid =
      connector.id.trim().length > 0 &&
      !connectorIds.has(connector.id) &&
      taxonomy !== undefined &&
      connector.geometryRole === taxonomy.geometryRole &&
      connector.gender === taxonomy.gender &&
      connector.profileId === taxonomy.profileId &&
      connector.capacity === 1 &&
      (connector.orientationId === "connector-up" ||
        connector.orientationId === "connector-down") &&
      verticalConnectorDirectionValid &&
      Array.isArray(connector.compatibleKinds) &&
      connector.compatibleKinds.length === expectedCompatibleKinds.length &&
      connector.compatibleKinds.every(
        (kind, compatibleIndex) => kind === expectedCompatibleKinds[compatibleIndex],
      ) &&
      safeVector(connector.positionLdu) &&
      safeVector(connector.normal) &&
      normalMagnitude === 1 &&
      connector.normal.every(
        (coordinate) => coordinate === -1 || coordinate === 0 || coordinate === 1,
      ) &&
      (!visualBoundsValid || pointInside(definition.boundsLdu, connector.positionLdu));
    connectorIds.add(connector.id);
    if (!valid) {
      connectorRepresentationValid = false;
      add(
        "MESH_ADMISSION_CONNECTOR_INVALID",
        `/connectors/${index}`,
        `Part ${definition.id} connector ${JSON.stringify(connector.id)} needs a unique non-empty id, the catalog taxonomy fields for kind ${connector.kind}, a safe-integer in-bounds position, and one axis-unit safe-integer normal; studs require connector-up/[0,-1,0] and undersideClutch ports require connector-down/[0,1,0]. Received position=${JSON.stringify(connector.positionLdu)}, orientation=${JSON.stringify(connector.orientationId)}, normal=${JSON.stringify(connector.normal)}.`,
      );
    }
    if (
      bodyBoundsValid &&
      ((connector.kind === "stud" &&
        connector.positionLdu[1] !== definition.bodyBoundsLdu.min[1]) ||
        (connector.kind === "undersideClutch" &&
          (connector.positionLdu[1] < definition.bodyBoundsLdu.min[1] ||
            connector.positionLdu[1] > definition.bodyBoundsLdu.max[1])))
    ) {
      connectorRepresentationValid = false;
      add(
        "MESH_ADMISSION_VERTICAL_EXTENTS_INVALID",
        `/connectors/${index}/positionLdu/1`,
        connector.kind === "stud"
          ? `Part ${definition.id} stud connector ${connector.id} must stand on the represented top body plane Y=${definition.bodyBoundsLdu.min[1]}; received Y=${connector.positionLdu[1]}.`
          : `Part ${definition.id} underside connector ${connector.id} seats at Y=${connector.positionLdu[1]}, outside the represented body's [${definition.bodyBoundsLdu.min[1]}, ${definition.bodyBoundsLdu.max[1]}] range. A stepped underside may seat above the lowest plane — 93273 seats two clutches 8 LDU up — but never outside the part.`,
      );
    }
  }

  if (dimensionsValid && validConnectorGridCenter(gridCenter) && connectorRepresentationValid) {
    const firstX = gridCenter[0] - ((dimensions.widthStuds - 1) * STUD_PITCH_LDU) / 2;
    const firstZ = gridCenter[1] - ((dimensions.lengthStuds - 1) * STUD_PITCH_LDU) / 2;
    const originOffsetX = placementResidue(firstX);
    const originOffsetZ = placementResidue(firstZ);
    for (let index = 0; index < definition.connectors.length; index += 1) {
      const connector = definition.connectors[index]!;
      if (connector.kind !== "undersideClutch") continue;
      if (
        !onStudLattice(connector.positionLdu[0] + originOffsetX) ||
        !onStudLattice(connector.positionLdu[2] + originOffsetZ)
      ) {
        add(
          "MESH_ADMISSION_CONNECTOR_GRID_MISMATCH",
          `/connectors/${index}/positionLdu`,
          `Part ${definition.id} underside connector ${connector.id} at [${connector.positionLdu[0]}, ${connector.positionLdu[2]}] is incompatible with connectorGridCenterLdu [${gridCenter.join(", ")}], ${dimensions.widthStuds}x${dimensions.lengthStuds} footprint parity, and the placement lattice; snapped world coordinates must have residue ${STUD_PITCH_LDU / 2} modulo ${STUD_PITCH_LDU}.`,
        );
      }
    }
  }

  if (!hasDeclaredText(definition.collision.modelVersion)) {
    add(
      "MESH_ADMISSION_COLLISION_INVALID",
      "/collision/modelVersion",
      `Part ${definition.id} collision modelVersion must be a non-empty declared representation identifier; received ${JSON.stringify(definition.collision.modelVersion)}.`,
    );
  }

  const primitiveIds = new Set<string>();
  const bodyPrimitiveBounds: LduBounds[] = [];
  for (let index = 0; index < definition.collision.primitives.length; index += 1) {
    const primitive = definition.collision.primitives[index]!;
    const primitiveBounds = collisionPrimitiveBounds(primitive);
    const valid =
      primitive.id.trim().length > 0 &&
      !primitiveIds.has(primitive.id) &&
      primitiveBounds !== null &&
      (!visualBoundsValid || boundsContain(definition.boundsLdu, primitiveBounds));
    primitiveIds.add(primitive.id);
    if (!valid) {
      add(
        "MESH_ADMISSION_COLLISION_INVALID",
        `/collision/primitives/${index}`,
        `Part ${definition.id} collision primitive ${JSON.stringify(primitive.id)} needs a unique non-empty id, safe finite representation, and an AABB contained by visual boundsLdu; received ${JSON.stringify(primitive)}.`,
      );
      continue;
    }
    if (primitive.tag === "body") bodyPrimitiveBounds.push(primitiveBounds);
  }
  const representedBodyBounds = unionBounds(bodyPrimitiveBounds);
  if (
    bodyBoundsValid &&
    (representedBodyBounds === null ||
      !boundsAgree(representedBodyBounds, definition.bodyBoundsLdu))
  ) {
    add(
      "MESH_ADMISSION_COLLISION_INVALID",
      "/collision/primitives",
      `Part ${definition.id} body collision primitive union ${representedBodyBounds === null ? "is empty" : `is [${representedBodyBounds.min.join(", ")}]..[${representedBodyBounds.max.join(", ")}]`} but must agree with bodyBoundsLdu [${definition.bodyBoundsLdu.min.join(", ")}]..[${definition.bodyBoundsLdu.max.join(", ")}]. This validates declared representation bounds, not physical correctness.`,
    );
  }

  // A declared underside seat has to be a plane the represented solid actually
  // presents downward, with none of that solid hanging below it inside the stud
  // footprint that an incoming stud would have to pass through. This is the
  // collision union's half of the physical clutch-room measurement; it does not
  // certify clutch strength, and the surface probe stays the source of that.
  for (
    let index = 0;
    bodyPrimitiveBounds.length > 0 && index < definition.connectors.length;
    index += 1
  ) {
    const connector = definition.connectors[index]!;
    if (connector.kind !== "undersideClutch" || !safeVector(connector.positionLdu)) continue;
    const [seatX, seatY, seatZ] = connector.positionLdu;
    const seatPlanes = bodyPrimitiveBounds.map(({ max }) => max[1]);
    if (!seatPlanes.some((plane) => Math.abs(plane - seatY) <= MESH_VISUAL_BOUNDS_TOLERANCE_LDU)) {
      add(
        "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        `/connectors/${index}/positionLdu/1`,
        `Part ${definition.id} underside connector ${connector.id} declares a seat plane Y=${seatY} that no body collision primitive presents downward; the represented solid's downward faces are at [${[...new Set(seatPlanes)].sort((left, right) => left - right).join(", ")}]. A seat has to be a plane of the part, not a coordinate near one.`,
      );
      continue;
    }
    const blocking = bodyPrimitiveBounds.filter(
      (bounds) =>
        bounds.max[1] > seatY + MESH_VISUAL_BOUNDS_TOLERANCE_LDU &&
        bounds.min[0] < seatX + STUD_RADIUS_LDU &&
        bounds.max[0] > seatX - STUD_RADIUS_LDU &&
        bounds.min[2] < seatZ + STUD_RADIUS_LDU &&
        bounds.max[2] > seatZ - STUD_RADIUS_LDU,
    );
    if (blocking.length > 0) {
      const deepest = Math.max(...blocking.map(({ max }) => max[1]));
      add(
        "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        `/connectors/${index}/positionLdu`,
        `Part ${definition.id} underside connector ${connector.id} seats at Y=${seatY}, but ${blocking.length} body collision primitive(s) reach down to Y=${deepest} inside its ${STUD_RADIUS_LDU} LDU stud footprint at [${seatX}, ${seatZ}]; an incoming stud cannot pass through the part's own solid to reach that seat.`,
      );
    }
  }

  const studConnectors = definition.connectors.filter(({ kind }) => kind === "stud");
  const studCylinders = definition.collision.primitives.filter(
    (primitive): primitive is Extract<CollisionPrimitive, { kind: "cylinder" }> =>
      primitive.kind === "cylinder" && primitive.tag === "stud",
  );
  const studRepresentationsMatch = (
    connector: (typeof studConnectors)[number],
    cylinder: (typeof studCylinders)[number],
  ): boolean =>
    connector.id === cylinder.id &&
    connector.normal[0] === 0 &&
    connector.normal[1] === -1 &&
    connector.normal[2] === 0 &&
    cylinder.axis === "y" &&
    cylinder.centerLdu[0] === connector.positionLdu[0] &&
    cylinder.centerLdu[2] === connector.positionLdu[2] &&
    cylinder.centerLdu[1] + cylinder.heightLdu / 2 === connector.positionLdu[1];
  for (const connector of studConnectors) {
    const matches = studCylinders.filter((cylinder) =>
      studRepresentationsMatch(connector, cylinder),
    );
    if (matches.length !== 1) {
      add(
        "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        `/connectors/${definition.connectors.indexOf(connector)}`,
        `Part ${definition.id} stud connector ${connector.id} needs exactly one same-id vertical stud collision cylinder at the same X/Z whose lower face meets connector Y=${connector.positionLdu[1]}; found ${matches.length}. Connector and collision declarations are independent, so mesh admission requires their represented attachment feature to agree.`,
      );
    }
  }
  for (const cylinder of studCylinders) {
    const matches = studConnectors.filter((connector) =>
      studRepresentationsMatch(connector, cylinder),
    );
    if (matches.length !== 1) {
      add(
        "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        `/collision/primitives/${definition.collision.primitives.indexOf(cylinder)}`,
        `Part ${definition.id} stud collision cylinder ${cylinder.id} needs exactly one same-id stud connector on its lower face; found ${matches.length}. Orphan collision studs cannot be admitted as connector truth.`,
      );
    }
  }

  const allowanceIds = new Set<string>();
  for (let index = 0; index < definition.collision.allowances.length; index += 1) {
    const allowance = definition.collision.allowances[index]!;
    const port = definition.connectors.find(({ id }) => id === allowance.portId);
    const allowanceCenterMatchesPort =
      port !== undefined &&
      safeVector(allowance.centerLdu) &&
      Number.isSafeInteger(allowance.maxInsertionDepthLdu) &&
      allowance.centerLdu[0] === port.positionLdu[0] &&
      allowance.centerLdu[1] === port.positionLdu[1] - allowance.maxInsertionDepthLdu / 2 &&
      allowance.centerLdu[2] === port.positionLdu[2];
    if (
      allowance.id.trim().length === 0 ||
      allowanceIds.has(allowance.id) ||
      port?.kind !== "undersideClutch" ||
      allowance.portKind !== "undersideClutch" ||
      allowance.incomingPrimitiveTag !== "stud" ||
      allowance.requiresValidatedConnection !== true ||
      !safeVector(allowance.centerLdu) ||
      !allowanceCenterMatchesPort ||
      (visualBoundsValid && !pointInside(definition.boundsLdu, allowance.centerLdu)) ||
      !Number.isSafeInteger(allowance.radiusLdu) ||
      allowance.radiusLdu <= 0 ||
      !Number.isSafeInteger(allowance.maxInsertionDepthLdu) ||
      allowance.maxInsertionDepthLdu <= 0
    ) {
      add(
        "MESH_ADMISSION_COLLISION_INVALID",
        `/collision/allowances/${index}`,
        `Part ${definition.id} collision allowance ${JSON.stringify(allowance.id)} must name an undersideClutch connector and use a safe-integer center exactly [port.x, port.y-maxInsertionDepthLdu/2, port.z], positive radius, and positive insertion depth; received port=${port === undefined ? "missing" : JSON.stringify(port.positionLdu)}, allowance=${JSON.stringify(allowance)}.`,
      );
    }
    allowanceIds.add(allowance.id);
  }
  for (let connectorIndex = 0; connectorIndex < definition.connectors.length; connectorIndex += 1) {
    const connector = definition.connectors[connectorIndex]!;
    if (connector.kind !== "undersideClutch") continue;
    const matchingAllowances = definition.collision.allowances.filter(
      ({ portId }) => portId === connector.id,
    );
    if (matchingAllowances.length !== 1) {
      add(
        "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        `/connectors/${connectorIndex}`,
        `Part ${definition.id} undersideClutch connector ${connector.id} needs exactly one collision allowance naming its portId; found ${matchingAllowances.length} with ids [${matchingAllowances.map(({ id }) => id).join(", ")}]. Missing allowances disable valid connected-stud penetration, while duplicates make allowance selection order-dependent.`,
      );
    }
  }

  if (issues.length > 0) {
    return Object.freeze({ accepted: false, issues: Object.freeze(issues) });
  }

  const resolution = resolveMeshAsset(recipe);
  if (!resolution.ok) {
    add(
      "MESH_ADMISSION_RESOLUTION_FAILED",
      "/geometry",
      `Part ${definition.id} mesh cannot be admitted because closed resolution failed with ${resolution.code}: ${resolution.message}`,
    );
    return Object.freeze({ accepted: false, issues: Object.freeze(issues) });
  }

  const meshBounds = resolvedMeshBounds(resolution.asset)!;
  const meshBodyBounds = resolvedMeshBounds(resolution.asset, "body")!;

  if (!boundsAgree(meshBodyBounds, definition.bodyBoundsLdu)) {
    add(
      "MESH_ADMISSION_BODY_BOUNDS_MISMATCH",
      "/bodyBoundsLdu",
      `Part ${definition.id} integrity-bound body triangles have AABB [${meshBodyBounds.min.join(", ")}]..[${meshBodyBounds.max.join(", ")}] but declared bodyBoundsLdu is [${definition.bodyBoundsLdu.min.join(", ")}]..[${definition.bodyBoundsLdu.max.join(", ")}]. They must agree within ${MESH_VISUAL_BOUNDS_TOLERANCE_LDU} LDU so stud filtering, collision-body bounds, selection, and placement share one represented body extent. This does not certify real-world shape or physics.`,
    );
  }

  if (!boundsAgree(meshBounds, definition.boundsLdu)) {
    add(
      "MESH_ADMISSION_VISUAL_BOUNDS_MISMATCH",
      "/boundsLdu",
      `Part ${definition.id} framed mesh AABB [${meshBounds.min.join(", ")}]..[${meshBounds.max.join(", ")}] must agree with declared visual boundsLdu [${definition.boundsLdu.min.join(", ")}]..[${definition.boundsLdu.max.join(", ")}] within ${MESH_VISUAL_BOUNDS_TOLERANCE_LDU} LDU; loose or clipped visual bounds are not admitted. This validates represented extents, not resemblance or physical correctness.`,
    );
  }

  return Object.freeze({ accepted: issues.length === 0, issues: Object.freeze(issues) });
}
