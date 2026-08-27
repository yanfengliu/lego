import { resolvePreloadedMeshAsset, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import type { PartDefinition, ResolvedMeshAsset } from "@lego-studio/catalog";

import type { LedgerTransform } from "./real-build-official";

export type Point = readonly [number, number, number];
export type Triangle = readonly [Point, Point, Point];

export const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

export function orientationOf(id: string): (typeof UPRIGHT_ORIENTATIONS)[number] {
  const orientation = UPRIGHT_ORIENTATIONS.find((candidate) => candidate.id === id);
  if (orientation === undefined) {
    throw new TypeError(
      `Upright orientation ${JSON.stringify(id)} is not one of ` +
        `${UPRIGHT_ORIENTATIONS.map(({ id: known }) => known).join(", ")}.`,
    );
  }
  return orientation;
}

export function applyUpright(transform: LedgerTransform, point: Point): Point {
  const { matrix } = orientationOf(transform.orientationId);
  return [0, 1, 2].map((row) =>
    normalizeZero(
      transform.positionLdu[row]! +
        [0, 1, 2].reduce((sum, column) => sum + matrix[row * 3 + column]! * point[column]!, 0),
    ),
  ) as unknown as Point;
}

export function invertUpright(transform: LedgerTransform): LedgerTransform {
  const inverse = UPRIGHT_ORIENTATIONS.find(
    ({ quarterTurns }) =>
      quarterTurns === (4 - orientationOf(transform.orientationId).quarterTurns) % 4,
  )!;
  const rotated = applyUpright(
    { positionLdu: [0, 0, 0], orientationId: inverse.id },
    transform.positionLdu as unknown as Point,
  );
  return {
    positionLdu: rotated.map((coordinate) =>
      normalizeZero(-coordinate),
    ) as unknown as LedgerTransform["positionLdu"],
    orientationId: inverse.id,
  };
}

/** The residual `left^-1 . right`: what one candidate frame does that the other does not. */
export function residualTransform(left: LedgerTransform, right: LedgerTransform): LedgerTransform {
  const inverse = invertUpright(left);
  const composedOrientation = UPRIGHT_ORIENTATIONS.find(
    ({ quarterTurns }) =>
      quarterTurns ===
      (orientationOf(inverse.orientationId).quarterTurns +
        orientationOf(right.orientationId).quarterTurns) %
        4,
  )!;
  return {
    positionLdu: applyUpright(
      inverse,
      right.positionLdu as unknown as Point,
    ) as unknown as LedgerTransform["positionLdu"],
    orientationId: composedOrientation.id,
  };
}

const key = (value: unknown): string => JSON.stringify(value);

function sortedKeys(values: readonly unknown[]): string {
  return JSON.stringify([...values.map(key)].sort((left, right) => left.localeCompare(right)));
}

function boundsKey(
  transform: LedgerTransform | null,
  bounds: { readonly min: Point; readonly max: Point },
): string {
  const corners: Point[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push(transform === null ? [x, y, z] : applyUpright(transform, [x, y, z]));
      }
    }
  }
  return key({
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((corner) => corner[axis]!))),
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((corner) => corner[axis]!))),
  });
}

/** Raised when the proof cannot describe a part, never when a part is simply not symmetric. */
export class InconclusiveSymmetry extends Error {}

interface TaggedBox {
  readonly tag: string;
  readonly min: Point;
  readonly max: Point;
}

function transformedBox(transform: LedgerTransform | null, box: TaggedBox): TaggedBox {
  if (transform === null) return box;
  const corners: Point[] = [];
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        corners.push(applyUpright(transform, [x, y, z]));
      }
    }
  }
  return {
    tag: box.tag,
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((c) => c[axis]!))) as unknown as Point,
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((c) => c[axis]!))) as unknown as Point,
  };
}

const boxCovers = (boxes: readonly TaggedBox[], point: Point): boolean =>
  boxes.some(({ min, max }) => [0, 1, 2].every((a) => point[a]! > min[a]! && point[a]! < max[a]!));

/**
 * Whether two sets of axis-aligned boxes occupy the same volume, tag by tag.
 *
 * A decomposition is not the part. `part-shell.ts` cuts a shell's walls into
 * boxes by sweeping x before z, so a square plate's wall ring comes out as two
 * boxes running the full length and two inset between them — a set that a
 * quarter turn does not map onto itself, though the ring it describes maps onto
 * itself exactly. Comparing the chopping called such a part asymmetric and sent
 * every square plate to the surface witness; comparing the volume asks the
 * question the proof means to ask, and keeps asking it correctly when step 4 of
 * the part-geometry plan re-derives a body into boxes nobody chose by hand.
 *
 * Exact rather than sampled: every coordinate of both sets is cut into one
 * shared grid, so each cell lies wholly inside or wholly outside every box and
 * its centre decides it.
 */
function sameBoxVolume(left: readonly TaggedBox[], right: readonly TaggedBox[]): boolean {
  for (const tag of new Set([...left, ...right].map((box) => box.tag))) {
    const here = left.filter((box) => box.tag === tag);
    const there = right.filter((box) => box.tag === tag);
    const edges = [0, 1, 2].map((axis) =>
      [...new Set([...here, ...there].flatMap((box) => [box.min[axis]!, box.max[axis]!]))].sort(
        (a, b) => a - b,
      ),
    );
    for (let xi = 0; xi + 1 < edges[0]!.length; xi += 1) {
      for (let yi = 0; yi + 1 < edges[1]!.length; yi += 1) {
        for (let zi = 0; zi + 1 < edges[2]!.length; zi += 1) {
          const center: Point = [
            (edges[0]![xi]! + edges[0]![xi + 1]!) / 2,
            (edges[1]![yi]! + edges[1]![yi + 1]!) / 2,
            (edges[2]![zi]! + edges[2]![zi + 1]!) / 2,
          ];
          if (boxCovers(here, center) !== boxCovers(there, center)) return false;
        }
      }
    }
  }
  return true;
}

function primitiveKey(
  definitionId: string,
  transform: LedgerTransform | null,
  primitive: Record<string, unknown>,
): string {
  const kind = String(primitive.kind);
  if (kind === "cylinder") {
    if (primitive.axis !== "y") {
      throw new InconclusiveSymmetry(
        `Catalog part ${definitionId} declares a collision cylinder on axis ` +
          `${JSON.stringify(primitive.axis)}; the Builder frame self-symmetry proof only covers the ` +
          `vertical axis a quarter turn preserves. Settle this design's frame with the surface ` +
          `witness or extend the proof deliberately.`,
      );
    }
    return key({
      kind,
      tag: primitive.tag,
      axis: primitive.axis,
      center:
        transform === null
          ? (primitive.centerLdu as Point)
          : applyUpright(transform, primitive.centerLdu as Point),
      radiusLdu: primitive.radiusLdu,
      heightLdu: primitive.heightLdu,
    });
  }
  throw new InconclusiveSymmetry(
    `Catalog part ${definitionId} declares a ${JSON.stringify(kind)} collision primitive, and the ` +
      `Builder frame self-symmetry proof covers only box — compared as occupied volume — and ` +
      `cylinder. Two exact frames cannot be declared equivalent on a body this proof cannot ` +
      `rotate; settle the design with the surface witness or extend the proof deliberately.`,
  );
}

const meshVector = (
  values: readonly number[],
  vertex: number,
  transform: LedgerTransform | null,
  direction: boolean,
): Point => {
  const point = values.slice(vertex * 3, vertex * 3 + 3) as unknown as Point;
  if (transform === null) return point.map(normalizeZero) as unknown as Point;
  return applyUpright(direction ? { ...transform, positionLdu: [0, 0, 0] } : transform, point).map(
    normalizeZero,
  ) as unknown as Point;
};

const meshIndices = (asset: ResolvedMeshAsset): readonly number[] =>
  asset.indices ?? Array.from({ length: asset.vertexCount }, (_, index) => index);

const cyclicKey = (values: readonly [string, string, string]): string => {
  const rotations = [
    values,
    [values[1], values[2], values[0]],
    [values[2], values[0], values[1]],
  ] as const;
  return rotations.map((rotation) => JSON.stringify(rotation)).sort()[0]!;
};

function meshVertexRenderKey(
  asset: ResolvedMeshAsset,
  vertex: number,
  transform: LedgerTransform | null,
): string {
  return JSON.stringify({
    position: meshVector(asset.positionsLdu, vertex, transform, false),
    normal:
      asset.normalsCatalogLocal === null
        ? null
        : meshVector(asset.normalsCatalogLocal, vertex, transform, true),
  });
}

function meshVertexTopologyKeys(
  asset: ResolvedMeshAsset,
  transform: LedgerTransform | null,
): readonly string[] {
  const indices = meshIndices(asset);
  const renderKeys = Array.from({ length: asset.vertexCount }, (_, vertex) =>
    meshVertexRenderKey(asset, vertex, transform),
  );
  const incident = Array.from({ length: asset.vertexCount }, () => [] as string[]);
  for (const group of asset.groups) {
    const groupKey = JSON.stringify(group);
    for (
      let triangle = group.triangleStart;
      triangle < group.triangleStart + group.triangleCount;
      triangle += 1
    ) {
      const vertices = indices.slice(triangle * 3, triangle * 3 + 3) as unknown as readonly [
        number,
        number,
        number,
      ];
      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = vertices[corner]!;
        incident[vertex]!.push(
          JSON.stringify({
            group: groupKey,
            winding: [
              renderKeys[vertices[corner]!]!,
              renderKeys[vertices[(corner + 1) % 3]!]!,
              renderKeys[vertices[(corner + 2) % 3]!]!,
            ],
          }),
        );
      }
    }
  }
  return renderKeys.map((render, vertex) =>
    JSON.stringify({ render, incident: incident[vertex]!.sort() }),
  );
}

/** Exact proper-yaw invariance of the resolved mesh the renderer actually consumes. */
export function isResolvedMeshAssetSelfSymmetry(
  asset: ResolvedMeshAsset,
  transform: LedgerTransform,
): boolean {
  const original = meshVertexTopologyKeys(asset, null);
  const moved = meshVertexTopologyKeys(asset, transform);
  const originalByKey = new Map<string, number[]>();
  for (const [vertex, signature] of original.entries()) {
    const bucket = originalByKey.get(signature) ?? [];
    bucket.push(vertex);
    originalByKey.set(signature, bucket);
  }
  const mapping = moved.map((signature) => {
    const candidates = originalByKey.get(signature) ?? [];
    if (candidates.length !== 1) {
      throw new InconclusiveSymmetry(
        `Resolved catalog mesh ${asset.assetId} leaves ${candidates.length} exact indexed vertices ` +
          `for one transformed position/normal/incident-triangle signature. An ambiguous vertex ` +
          `bijection cannot prove render symmetry.`,
      );
    }
    return candidates[0]!;
  });
  if (new Set(mapping).size !== asset.vertexCount) return false;
  const indices = meshIndices(asset);
  const groupedTriangles = (mapped: boolean): string =>
    JSON.stringify(
      asset.groups.map((group) => ({
        role: group.role,
        triangleStart: group.triangleStart,
        triangleCount: group.triangleCount,
        triangles: Array.from({ length: group.triangleCount }, (_, offset) => {
          const triangle = group.triangleStart + offset;
          const vertices = indices
            .slice(triangle * 3, triangle * 3 + 3)
            .map((vertex) => String(mapped ? mapping[vertex]! : vertex)) as unknown as [
            string,
            string,
            string,
          ];
          return cyclicKey(vertices);
        }).sort(),
      })),
    );
  return groupedTriangles(false) === groupedTriangles(true);
}

/**
 * Whether one upright transform maps the whole catalog part onto itself.
 *
 * Everything a placement is judged by has to be invariant, not merely the studs
 * that produced the candidate frames: the connector graph, the collision union,
 * the clutch allowances, both bounds, and the footprint the lattice indexes.
 */
export function isCatalogPartSelfSymmetry(
  definition: PartDefinition,
  transform: LedgerTransform,
): boolean {
  const meshBacked = definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1";
  const connectorGridCenter =
    definition.connectorGridCenterLdu ??
    (meshBacked ? undefined : (definition.geometry.connectorGridCenterLdu ?? [0, 0]));
  if (connectorGridCenter === undefined) {
    throw new InconclusiveSymmetry(
      `Catalog part ${definition.id} has no effective connector-grid center, so placement-lattice ` +
        `symmetry cannot be proved.`,
    );
  }
  const gridCenterPoint = [connectorGridCenter[0], 0, connectorGridCenter[1]] as Point;
  const legalTurns = definition.legalOrientationIds
    .map((id) => UPRIGHT_ORIENTATIONS.find(({ id: candidate }) => candidate === id)?.quarterTurns)
    .filter((turn): turn is 0 | 1 | 2 | 3 => turn !== undefined)
    .sort((left, right) => left - right);
  const residualTurn = orientationOf(transform.orientationId).quarterTurns;
  const movedLegalTurns = legalTurns
    .map((turn) => (turn + residualTurn) % 4)
    .sort((left, right) => left - right);
  const meshSymmetric = (() => {
    if (!meshBacked) return true;
    const resolution = resolvePreloadedMeshAsset(definition.geometry);
    if (!resolution.ok) {
      throw new InconclusiveSymmetry(
        `Catalog part ${definition.id} draws mesh ${definition.geometry.assetId}, but resolving ` +
          `the exact current asset failed with ${resolution.code}: ${resolution.message}`,
      );
    }
    return isResolvedMeshAssetSelfSymmetry(resolution.asset, transform);
  })();
  if (
    definition.dimensions.widthLdu !== definition.dimensions.lengthLdu &&
    orientationOf(transform.orientationId).quarterTurns % 2 === 1
  ) {
    return false;
  }
  const connectors = (mapped: LedgerTransform | null): string =>
    sortedKeys(
      definition.connectors.map((connector) => ({
        kind: connector.kind,
        geometryRole: connector.geometryRole,
        profileId: connector.profileId,
        gender: connector.gender,
        orientationId: connector.orientationId,
        capacity: connector.capacity,
        compatibleKinds: [...connector.compatibleKinds].sort(),
        positionLdu:
          mapped === null
            ? connector.positionLdu
            : applyUpright(mapped, connector.positionLdu as Point),
        normal:
          mapped === null
            ? connector.normal
            : applyUpright(
                { positionLdu: [0, 0, 0], orientationId: mapped.orientationId },
                connector.normal as Point,
              ),
      })),
    );
  // Boxes are compared as the volume they occupy and everything else by its own
  // key, because a box is the one primitive whose decomposition is a choice.
  const boxes = (mapped: LedgerTransform | null): TaggedBox[] =>
    definition.collision.primitives
      .filter((primitive) => primitive.kind === "box")
      .map((primitive) =>
        transformedBox(mapped, {
          tag: primitive.tag,
          min: primitive.minLdu as unknown as Point,
          max: primitive.maxLdu as unknown as Point,
        }),
      );
  const primitives = (mapped: LedgerTransform | null): string =>
    sortedKeys(
      definition.collision.primitives
        .filter((primitive) => primitive.kind !== "box")
        .map((primitive) =>
          primitiveKey(definition.id, mapped, primitive as unknown as Record<string, unknown>),
        ),
    );
  const allowances = (mapped: LedgerTransform | null): string =>
    sortedKeys(
      definition.collision.allowances.map((allowance) => ({
        portKind: allowance.portKind,
        incomingPrimitiveTag: allowance.incomingPrimitiveTag,
        radiusLdu: allowance.radiusLdu,
        maxInsertionDepthLdu: allowance.maxInsertionDepthLdu,
        requiresValidatedConnection: allowance.requiresValidatedConnection,
        centerLdu:
          mapped === null
            ? allowance.centerLdu
            : applyUpright(mapped, allowance.centerLdu as Point),
      })),
    );
  return (
    connectors(null) === connectors(transform) &&
    sameBoxVolume(boxes(null), boxes(transform)) &&
    primitives(null) === primitives(transform) &&
    allowances(null) === allowances(transform) &&
    boundsKey(null, definition.bodyBoundsLdu as { min: Point; max: Point }) ===
      boundsKey(transform, definition.bodyBoundsLdu as { min: Point; max: Point }) &&
    boundsKey(null, definition.boundsLdu as { min: Point; max: Point }) ===
      boundsKey(transform, definition.boundsLdu as { min: Point; max: Point }) &&
    key(gridCenterPoint) === key(applyUpright(transform, gridCenterPoint)) &&
    legalTurns.length === definition.legalOrientationIds.length &&
    JSON.stringify(legalTurns) === JSON.stringify(movedLegalTurns) &&
    meshSymmetric
  );
}
