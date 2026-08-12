import {
  EXACT_LDU_SCALE_EXPONENT,
  UPRIGHT_ORIENTATIONS,
  assertExactLdu,
  type CollisionPrimitive,
  type ExactLduBounds,
  type LduBounds,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  applyFramePoint as apply,
  requireFrame,
  rigidTransformToFrameTransform,
  rotateFramePoint as rotate,
  type FrameTransform,
} from "./real-build-catalog-frame";
import { flatRenderTriangleRealizationKeys } from "./real-build-catalog-render-realization";

type Point = readonly [number, number, number];

export {
  composeFrameTransforms,
  rigidTransformToFrameTransform,
  type FrameTransform,
} from "./real-build-catalog-frame";

export interface RealizationLayerResult {
  readonly matches: boolean;
  readonly supported: boolean;
  readonly leftCount: number;
  readonly rightCount: number;
  readonly witness: string | null;
}

export interface CatalogPartRealizationComparison {
  readonly matches: boolean;
  readonly layers: {
    readonly connectors: RealizationLayerResult;
    readonly collision: RealizationLayerResult;
    readonly allowances: RealizationLayerResult;
    readonly bounds: RealizationLayerResult;
    readonly render: RealizationLayerResult;
  };
  readonly witness: string | null;
}

export interface TransformedCollisionBox {
  readonly tag: string;
  readonly min: Point;
  readonly max: Point;
}

export interface CatalogPartStructuralRealizationKeys {
  readonly connectors: readonly string[];
  readonly collisionBoxes: readonly TransformedCollisionBox[];
  readonly collisionPrimitives: readonly string[];
  readonly allowances: readonly string[];
  readonly bodyBounds: string;
  readonly bounds: string;
  readonly exactBodyBounds: string | null;
  readonly exactBounds: string | null;
}

const IDENTITY_FRAME: FrameTransform = {
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  translationLdu: [0, 0, 0],
};
const MAX_BOX_COMPARISON_CELLS = 1_000_000;
const stable = (value: unknown): string => JSON.stringify(value);

function sortedKeys(values: readonly unknown[]): readonly string[] {
  return values.map(stable).sort((left, right) => left.localeCompare(right));
}

function connectorRecord(
  definition: PartDefinition,
  frame: FrameTransform,
  portId: string,
): Record<string, unknown> {
  const connector = definition.connectors.find(({ id }) => id === portId);
  if (connector === undefined) {
    throw new TypeError(
      `Catalog part ${definition.id} collision allowance names missing connector ${JSON.stringify(portId)}.`,
    );
  }
  return {
    kind: connector.kind,
    geometryRole: connector.geometryRole,
    profileId: connector.profileId,
    gender: connector.gender,
    orientationId: connector.orientationId,
    capacity: connector.capacity,
    compatibleKinds: [...connector.compatibleKinds].sort(),
    positionLdu: apply(frame, connector.positionLdu as Point),
    normal: rotate(frame, connector.normal as Point),
  };
}

function boundsCorners(bounds: LduBounds): Point[] {
  const corners: Point[] = [];
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push([x, y, z]);
  return corners;
}

function boundsKey(bounds: LduBounds, frame: FrameTransform): string {
  const corners = boundsCorners(bounds).map((corner) => apply(frame, corner));
  return stable({
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((corner) => corner[axis]!))),
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((corner) => corner[axis]!))),
  });
}

function exactBoundsKey(bounds: ExactLduBounds | undefined, frame: FrameTransform): string | null {
  if (bounds === undefined) return null;
  const scale = 10n ** BigInt(EXACT_LDU_SCALE_EXPONENT);
  const source = [bounds.min, bounds.max].flatMap((vector, boundIndex) =>
    vector.map((coordinate, axis) =>
      BigInt(assertExactLdu(coordinate, `Exact bound ${boundIndex}/${axis}`).units),
    ),
  );
  const corners: bigint[][] = [];
  for (const x of [source[0]!, source[3]!])
    for (const y of [source[1]!, source[4]!])
      for (const z of [source[2]!, source[5]!]) {
        const point = [x, y, z];
        corners.push(
          [0, 1, 2].map(
            (row) =>
              [0, 1, 2].reduce(
                (sum, column) => sum + BigInt(frame.matrix[row * 3 + column]!) * point[column]!,
                0n,
              ) +
              BigInt(frame.translationLdu[row]!) * scale,
          ),
        );
      }
  return stable({
    scaleExponent: EXACT_LDU_SCALE_EXPONENT,
    min: [0, 1, 2]
      .map((axis) =>
        corners.reduce(
          (minimum, point) => (point[axis]! < minimum ? point[axis]! : minimum),
          corners[0]![axis]!,
        ),
      )
      .map(String),
    max: [0, 1, 2]
      .map((axis) =>
        corners.reduce(
          (maximum, point) => (point[axis]! > maximum ? point[axis]! : maximum),
          corners[0]![axis]!,
        ),
      )
      .map(String),
  });
}

function transformedBox(
  frame: FrameTransform,
  primitive: Extract<CollisionPrimitive, { kind: "box" }>,
): TransformedCollisionBox {
  const corners = boundsCorners({ min: primitive.minLdu, max: primitive.maxLdu }).map((corner) =>
    apply(frame, corner),
  );
  return {
    tag: primitive.tag,
    min: [0, 1, 2].map((axis) =>
      Math.min(...corners.map((corner) => corner[axis]!)),
    ) as unknown as Point,
    max: [0, 1, 2].map((axis) =>
      Math.max(...corners.map((corner) => corner[axis]!)),
    ) as unknown as Point,
  };
}

function canonicalPolygon(
  vertices: readonly (readonly [number, number])[],
): readonly (readonly [number, number])[] {
  const variants: (readonly (readonly [number, number])[])[] = [];
  for (const order of [vertices, [...vertices].reverse()]) {
    for (let offset = 0; offset < order.length; offset += 1) {
      variants.push([...order.slice(offset), ...order.slice(0, offset)]);
    }
  }
  return variants.sort((left, right) => stable(left).localeCompare(stable(right)))[0]!;
}

/** Catalog collision geometry is already declared at the repository's exact 10^-9 LDU scale. */
const canonicalCollisionCoordinate = (value: number): number => {
  const units = Math.round(value * 10 ** EXACT_LDU_SCALE_EXPONENT);
  if (!Number.isSafeInteger(units)) {
    throw new RangeError(
      `Collision coordinate ${value} exceeds the exact 10^-${EXACT_LDU_SCALE_EXPONENT} LDU comparison range.`,
    );
  }
  return units === 0 ? 0 : units;
};

function primitiveRecord(
  frame: FrameTransform,
  primitive: CollisionPrimitive,
): Record<string, unknown> {
  if (primitive.kind === "wedge") {
    const normal = rotate(frame, [primitive.cutNormalXZ[0], 0, primitive.cutNormalXZ[1]]);
    return {
      kind: primitive.kind,
      tag: primitive.tag,
      bounds: JSON.parse(boundsKey({ min: primitive.minLdu, max: primitive.maxLdu }, frame)),
      cutNormalXZ: [normal[0], normal[2]],
      cutOffsetLdu:
        primitive.cutOffsetLdu +
        normal[0] * frame.translationLdu[0] +
        normal[2] * frame.translationLdu[2],
    };
  }
  if (primitive.kind === "cylinder") {
    const localAxis: Point =
      primitive.axis === "x" ? [1, 0, 0] : primitive.axis === "y" ? [0, 1, 0] : [0, 0, 1];
    const mappedAxis = rotate(frame, localAxis);
    const first = mappedAxis.find((value) => value !== 0) ?? 1;
    const canonicalAxis = first < 0 ? mappedAxis.map((value) => -value) : mappedAxis;
    return {
      kind: primitive.kind,
      tag: primitive.tag,
      axis: canonicalAxis,
      centerLdu: apply(frame, primitive.centerLdu as Point),
      radiusLdu: primitive.radiusLdu,
      heightLdu: primitive.heightLdu,
    };
  }
  if (primitive.kind === "convex-prism") {
    const vertices = primitive.verticesXZLdu.map(([x, z]) => {
      const mapped = apply(frame, [x, 0, z]);
      return [
        canonicalCollisionCoordinate(mapped[0]),
        canonicalCollisionCoordinate(mapped[2]),
      ] as const;
    });
    return {
      kind: primitive.kind,
      tag: primitive.tag,
      verticesXZLdu: canonicalPolygon(vertices),
      coordinateScaleExponent: EXACT_LDU_SCALE_EXPONENT,
      minYUnits: canonicalCollisionCoordinate(apply(frame, [0, primitive.minYLdu, 0])[1]),
      maxYUnits: canonicalCollisionCoordinate(apply(frame, [0, primitive.maxYLdu, 0])[1]),
    };
  }
  throw new TypeError(`Box primitives are compared as occupied volume, not individual records.`);
}

/** Deterministic transformed semantic keys, also usable under an improper D4 diagnostic frame. */
export function catalogPartStructuralRealizationKeys(
  definition: PartDefinition,
  frameValue: FrameTransform,
): CatalogPartStructuralRealizationKeys {
  const frame = requireFrame(frameValue);
  return {
    connectors: sortedKeys(
      definition.connectors.map(({ id }) => connectorRecord(definition, frame, id)),
    ),
    collisionBoxes: definition.collision.primitives
      .filter(
        (primitive): primitive is Extract<CollisionPrimitive, { kind: "box" }> =>
          primitive.kind === "box",
      )
      .map((primitive) => transformedBox(frame, primitive)),
    collisionPrimitives: sortedKeys(
      definition.collision.primitives
        .filter((primitive) => primitive.kind !== "box")
        .map((primitive) => primitiveRecord(frame, primitive)),
    ),
    allowances: sortedKeys(
      definition.collision.allowances.map((allowance) => ({
        port: connectorRecord(definition, frame, allowance.portId),
        portKind: allowance.portKind,
        incomingPrimitiveTag: allowance.incomingPrimitiveTag,
        centerLdu: apply(frame, allowance.centerLdu as Point),
        radiusLdu: allowance.radiusLdu,
        maxInsertionDepthLdu: allowance.maxInsertionDepthLdu,
        requiresValidatedConnection: allowance.requiresValidatedConnection,
      })),
    ),
    bodyBounds: boundsKey(definition.bodyBoundsLdu, frame),
    bounds: boundsKey(definition.boundsLdu, frame),
    exactBodyBounds: exactBoundsKey(definition.exactBodyBoundsLdu, frame),
    exactBounds: exactBoundsKey(definition.exactBoundsLdu, frame),
  };
}

const boxCovers = (boxes: readonly TransformedCollisionBox[], tag: string, point: Point): boolean =>
  boxes.some(
    (box) =>
      box.tag === tag &&
      [0, 1, 2].every((axis) => point[axis]! > box.min[axis]! && point[axis]! < box.max[axis]!),
  );

function compareBoxVolume(
  left: readonly TransformedCollisionBox[],
  right: readonly TransformedCollisionBox[],
): RealizationLayerResult {
  const edges = [0, 1, 2].map((axis) =>
    [...new Set([...left, ...right].flatMap((box) => [box.min[axis]!, box.max[axis]!]))].sort(
      (a, b) => a - b,
    ),
  );
  const cells =
    Math.max(0, edges[0]!.length - 1) *
    Math.max(0, edges[1]!.length - 1) *
    Math.max(0, edges[2]!.length - 1);
  if (cells > MAX_BOX_COMPARISON_CELLS) {
    return {
      matches: false,
      supported: false,
      leftCount: left.length,
      rightCount: right.length,
      witness: `box occupied-volume comparison requires ${cells} cells, above the ${MAX_BOX_COMPARISON_CELLS} fail-closed limit`,
    };
  }
  const tags = [...new Set([...left, ...right].map(({ tag }) => tag))].sort();
  for (const tag of tags)
    for (let x = 0; x + 1 < edges[0]!.length; x += 1)
      for (let y = 0; y + 1 < edges[1]!.length; y += 1)
        for (let z = 0; z + 1 < edges[2]!.length; z += 1) {
          const point: Point = [
            (edges[0]![x]! + edges[0]![x + 1]!) / 2,
            (edges[1]![y]! + edges[1]![y + 1]!) / 2,
            (edges[2]![z]! + edges[2]![z + 1]!) / 2,
          ];
          if (boxCovers(left, tag, point) !== boxCovers(right, tag, point)) {
            return {
              matches: false,
              supported: true,
              leftCount: left.length,
              rightCount: right.length,
              witness: `box tag ${JSON.stringify(tag)} differs in the cell containing ${stable(point)}`,
            };
          }
        }
  return {
    matches: true,
    supported: true,
    leftCount: left.length,
    rightCount: right.length,
    witness: null,
  };
}

function compareKeys(left: readonly string[], right: readonly string[]): RealizationLayerResult {
  const mismatch = Array.from(
    { length: Math.max(left.length, right.length) },
    (_, index) => index,
  ).find((index) => left[index] !== right[index]);
  return {
    matches: mismatch === undefined,
    supported: true,
    leftCount: left.length,
    rightCount: right.length,
    witness:
      mismatch === undefined
        ? null
        : `key ${mismatch} is ${left[mismatch] ?? "<missing>"} versus ${right[mismatch] ?? "<missing>"}`,
  };
}

function combineCollision(
  boxes: RealizationLayerResult,
  primitives: RealizationLayerResult,
): RealizationLayerResult {
  return {
    matches: boxes.matches && primitives.matches,
    supported: boxes.supported && primitives.supported,
    leftCount: boxes.leftCount + primitives.leftCount,
    rightCount: boxes.rightCount + primitives.rightCount,
    witness: boxes.witness === null ? primitives.witness : boxes.witness,
  };
}

/**
 * Proves equality of every catalog semantic and flat-render layer under two D4 frames.
 * Any unsupported layer makes the overall answer false rather than weakening the claim.
 */
export function catalogPartRealizationMatches(
  definition: PartDefinition,
  leftWorldValue: FrameTransform,
  rightWorldValue: FrameTransform,
  options: { readonly includeRender?: boolean } = {},
): CatalogPartRealizationComparison {
  const leftWorld = requireFrame(leftWorldValue);
  const rightWorld = requireFrame(rightWorldValue);
  const left = catalogPartStructuralRealizationKeys(definition, leftWorld);
  const right = catalogPartStructuralRealizationKeys(definition, rightWorld);
  const connectors = compareKeys(left.connectors, right.connectors);
  const collision = combineCollision(
    compareBoxVolume(left.collisionBoxes, right.collisionBoxes),
    compareKeys(left.collisionPrimitives, right.collisionPrimitives),
  );
  const allowances = compareKeys(left.allowances, right.allowances);
  const bounds = compareKeys(
    [left.bodyBounds, left.bounds, stable(left.exactBodyBounds), stable(left.exactBounds)],
    [right.bodyBounds, right.bounds, stable(right.exactBodyBounds), stable(right.exactBounds)],
  );
  const rendered =
    options.includeRender === false
      ? {
          supported: false,
          keys: [] as readonly string[],
          splitIndex: 0,
          witness:
            "flat render comparison was disabled, so complete catalog realization equivalence is unproved",
        }
      : flatRenderTriangleRealizationKeys(definition, leftWorld, rightWorld);
  const render: RealizationLayerResult = rendered.supported
    ? compareKeys(
        rendered.keys.slice(0, rendered.splitIndex),
        rendered.keys.slice(rendered.splitIndex),
      )
    : { matches: false, supported: false, leftCount: 0, rightCount: 0, witness: rendered.witness };
  const entries = Object.entries({
    connectors,
    collision,
    allowances,
    bounds,
    render,
  }) as readonly [string, RealizationLayerResult][];
  const first = entries.find(([, result]) => !result.supported || !result.matches);
  return {
    matches: first === undefined,
    layers: { connectors, collision, allowances, bounds, render },
    witness:
      first === undefined ? null : `${first[0]}: ${first[1].witness ?? "layer did not match"}`,
  };
}

/** Complete, conservative self-symmetry proof for one catalog part and upright residual. */
export function isCatalogPartUprightSelfSymmetry(
  definition: PartDefinition,
  residual: RigidTransform,
): boolean {
  return catalogPartRealizationMatches(
    definition,
    IDENTITY_FRAME,
    rigidTransformToFrameTransform(residual),
  ).matches;
}

/** Enumerates every complete proper symmetry, including an off-origin integer translation. */
export function catalogPartUprightSelfSymmetries(
  definition: PartDefinition,
): readonly RigidTransform[] {
  const targetCenter = [0, 1, 2].map(
    (axis) => (definition.boundsLdu.min[axis]! + definition.boundsLdu.max[axis]!) / 2,
  );
  const proven: RigidTransform[] = [];
  for (const orientation of UPRIGHT_ORIENTATIONS) {
    const rotatedCorners = boundsCorners(definition.boundsLdu).map((point) =>
      rotate({ matrix: orientation.matrix, translationLdu: [0, 0, 0] }, point),
    );
    const rotatedCenter = [0, 1, 2].map(
      (axis) =>
        (Math.min(...rotatedCorners.map((point) => point[axis]!)) +
          Math.max(...rotatedCorners.map((point) => point[axis]!))) /
        2,
    );
    const positionLdu = targetCenter.map((value, axis) =>
      Object.is(value - rotatedCenter[axis]!, -0) ? 0 : value - rotatedCenter[axis]!,
    ) as unknown as LduVector3;
    if (!positionLdu.every(Number.isSafeInteger)) continue;
    const residual: RigidTransform = { orientationId: orientation.id, positionLdu };
    if (isCatalogPartUprightSelfSymmetry(definition, residual)) proven.push(residual);
  }
  return proven;
}
