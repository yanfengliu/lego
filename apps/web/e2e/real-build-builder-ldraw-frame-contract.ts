import { createHash } from "node:crypto";

import { getPartDefinition, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import type { PartDefinition } from "@lego-studio/catalog";

import type { BuilderDesignSourcePin, BuilderFramePoint } from "./real-build-builder-sources";
import {
  InconclusiveSymmetry,
  applyUpright,
  isCatalogPartSelfSymmetry,
  residualTransform,
} from "./real-build-builder-frame-geometry";
import type { LedgerTransform } from "./real-build-official";

type Bounds = { readonly min: BuilderFramePoint; readonly max: BuilderFramePoint };
type Triangle = readonly [BuilderFramePoint, BuilderFramePoint, BuilderFramePoint];

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const canonicalOrder = (left: LedgerTransform, right: LedgerTransform): number => {
  const turn = (id: string): number =>
    UPRIGHT_ORIENTATIONS.find(({ id: candidate }) => candidate === id)!.quarterTurns;
  return (
    turn(left.orientationId) - turn(right.orientationId) ||
    left.positionLdu[0] - right.positionLdu[0] ||
    left.positionLdu[1] - right.positionLdu[1] ||
    left.positionLdu[2] - right.positionLdu[2]
  );
};

function decodeTriangles(bundle: Uint8Array, source: BuilderDesignSourcePin): readonly Triangle[] {
  const pin = source.ldrawReferenceGeometry;
  if (
    pin.byteLength !== pin.triangleCount * 36 ||
    pin.byteOffset < 0 ||
    pin.byteOffset + pin.byteLength > bundle.length
  ) {
    throw new TypeError(
      `${source.designRevision} LDraw slice ${pin.byteOffset}+${pin.byteLength} cannot encode ` +
        `${pin.triangleCount} bounded Float32 triangles in the retained geometry bundle.`,
    );
  }
  const bytes = bundle.subarray(pin.byteOffset, pin.byteOffset + pin.byteLength);
  if (digest(bytes) !== pin.digest) {
    throw new TypeError(
      `${source.designRevision} LDraw slice does not reproduce its exact ${pin.digest} source pin.`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from(
    { length: pin.triangleCount },
    (_, triangle) =>
      Array.from({ length: 3 }, (_, corner) =>
        Array.from({ length: 3 }, (_, axis) => {
          const value = view.getFloat32(triangle * 36 + corner * 12 + axis * 4, true);
          if (!Number.isFinite(value)) {
            throw new TypeError(
              `${source.designRevision} LDraw slice contains a non-finite point.`,
            );
          }
          return Object.is(value, -0) ? 0 : value;
        }),
      ) as unknown as Triangle,
  );
}

const boundsOf = (points: readonly BuilderFramePoint[]): Bounds => ({
  min: [0, 1, 2].map((axis) =>
    Math.min(...points.map((point) => point[axis]!)),
  ) as unknown as BuilderFramePoint,
  max: [0, 1, 2].map((axis) =>
    Math.max(...points.map((point) => point[axis]!)),
  ) as unknown as BuilderFramePoint,
});

function transformedBounds(bounds: Bounds, transform: LedgerTransform): Bounds {
  const corners: BuilderFramePoint[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push(applyUpright(transform, [x, y, z]));
      }
    }
  }
  return boundsOf(corners);
}

const sameBounds = (left: Bounds, right: Bounds): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

function boundsCandidates(
  triangles: readonly Triangle[],
  definition: PartDefinition,
): readonly LedgerTransform[] {
  const source = boundsOf(triangles.flat());
  const target = definition.boundsLdu as Bounds;
  const candidates: LedgerTransform[] = [];
  for (const orientation of UPRIGHT_ORIENTATIONS) {
    const rotated = transformedBounds(source, {
      positionLdu: [0, 0, 0],
      orientationId: orientation.id,
    });
    const position = [0, 1, 2].map(
      (axis) =>
        (target.min[axis]! + target.max[axis]! - rotated.min[axis]! - rotated.max[axis]!) / 2,
    );
    if (!position.every(Number.isSafeInteger)) continue;
    const transform: LedgerTransform = {
      positionLdu: position as unknown as LedgerTransform["positionLdu"],
      orientationId: orientation.id,
    };
    if (sameBounds(transformedBounds(source, transform), target)) candidates.push(transform);
  }
  return candidates.sort(canonicalOrder);
}

const pointKey = (point: BuilderFramePoint): string => JSON.stringify(point);

function connectedComponents(triangles: readonly Triangle[]): readonly number[][] {
  const byPoint = new Map<string, number[]>();
  for (const [triangle, points] of triangles.entries()) {
    for (const point of points) {
      const bucket = byPoint.get(pointKey(point)) ?? [];
      bucket.push(triangle);
      byPoint.set(pointKey(point), bucket);
    }
  }
  const unseen = new Set(triangles.keys());
  const components: number[][] = [];
  while (unseen.size > 0) {
    const first = unseen.values().next().value as number;
    unseen.delete(first);
    const pending = [first];
    const members: number[] = [];
    while (pending.length > 0) {
      const member = pending.pop()!;
      members.push(member);
      for (const point of triangles[member]!) {
        for (const adjacent of byPoint.get(pointKey(point)) ?? []) {
          if (unseen.delete(adjacent)) pending.push(adjacent);
        }
      }
    }
    components.push(members);
  }
  return components;
}

/** Exact standard LDraw stud seats, used only to dispose of bounds-inequivalent frames. */
function sourceStudSeats(triangles: readonly Triangle[]): readonly BuilderFramePoint[] {
  const complete = boundsOf(triangles.flat());
  return connectedComponents(triangles).flatMap((component) => {
    const bounds = boundsOf(component.flatMap((index) => triangles[index]!));
    const extents = bounds.max.map((value, axis) => value - bounds.min[axis]!);
    if (
      JSON.stringify(extents) !== JSON.stringify([12, 4, 12]) ||
      bounds.min[1] !== complete.min[1]
    ) {
      return [];
    }
    return [
      [
        (bounds.min[0] + bounds.max[0]) / 2,
        bounds.max[1],
        (bounds.min[2] + bounds.max[2]) / 2,
      ] as BuilderFramePoint,
    ];
  });
}

function oneSymmetryClass(
  definition: PartDefinition,
  candidates: readonly LedgerTransform[],
): boolean {
  const first = candidates[0];
  if (first === undefined) return false;
  return candidates.every((candidate) => {
    try {
      return isCatalogPartSelfSymmetry(definition, residualTransform(first, candidate));
    } catch (error) {
      if (error instanceof InconclusiveSymmetry) return false;
      throw error;
    }
  });
}

const connectorKeys = (definition: PartDefinition, transform: LedgerTransform | null): string =>
  JSON.stringify(
    definition.connectors
      .filter(({ kind }) => kind === "stud")
      .map(({ positionLdu }) =>
        pointKey(
          transform === null
            ? (positionLdu as BuilderFramePoint)
            : applyUpright(transform, positionLdu as BuilderFramePoint),
        ),
      )
      .sort(),
  );

function filterByExactStudLattice(
  definition: PartDefinition,
  triangles: readonly Triangle[],
  candidates: readonly LedgerTransform[],
): readonly LedgerTransform[] {
  const sourceSeats = sourceStudSeats(triangles);
  const expected = connectorKeys(definition, null);
  if (
    sourceSeats.length === 0 ||
    definition.connectors.filter(({ kind }) => kind === "stud").length === 0
  ) {
    return candidates;
  }
  return candidates.filter(
    (candidate) =>
      JSON.stringify(
        sourceSeats.map((point) => pointKey(applyUpright(candidate, point))).sort(),
      ) === expected,
  );
}

/** Derives the LDraw-to-catalog frame without consulting the row's expected transform. */
export function deriveLdrawToCatalogLocalTransform(
  source: BuilderDesignSourcePin,
  geometryBundle: Uint8Array,
): LedgerTransform {
  const definition = getPartDefinition(source.catalogPartId);
  if (definition === undefined) {
    throw new TypeError(
      `${source.designRevision} maps to absent current catalog part ${source.catalogPartId}.`,
    );
  }
  if (definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
    const frame = definition.geometry.assetToCatalogFrame;
    return { positionLdu: frame.translationLdu, orientationId: frame.orientationId };
  }
  const triangles = decodeTriangles(geometryBundle, source);
  let candidates = boundsCandidates(triangles, definition);
  if (!oneSymmetryClass(definition, candidates)) {
    candidates = filterByExactStudLattice(definition, triangles, candidates);
  }
  if (!oneSymmetryClass(definition, candidates)) {
    throw new TypeError(
      `${source.designRevision} leaves ${candidates.length} inequivalent exact LDraw-bounds/catalog-` +
        `lattice frames; no static transform pin may choose among them.`,
    );
  }
  const derived = [...candidates].sort(canonicalOrder)[0]!;
  if (
    definition.ldrawFrame !== undefined &&
    definition.ldrawFrame.ldrawToCatalogOrientationId !== derived.orientationId
  ) {
    throw new TypeError(
      `${source.designRevision} derives ${derived.orientationId}, but current catalog provenance ` +
        `names ${definition.ldrawFrame.ldrawToCatalogOrientationId}.`,
    );
  }
  return derived;
}

/** Exact comparison is last: a retained pin can fail this derivation but cannot steer it. */
export function assertDerivedLdrawToCatalogTransforms(
  sources: readonly BuilderDesignSourcePin[],
  geometryBundle: Uint8Array,
): void {
  for (const source of sources) {
    const derived = deriveLdrawToCatalogLocalTransform(source, geometryBundle);
    if (JSON.stringify(derived) !== JSON.stringify(source.ldrawToCatalogLocalTransform)) {
      throw new TypeError(
        `${source.designRevision} static LDraw-to-catalog pin ${JSON.stringify(source.ldrawToCatalogLocalTransform)} ` +
          `does not equal independently derived ${JSON.stringify(derived)}.`,
      );
    }
  }
}
