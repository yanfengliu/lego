import { UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import type { PartDefinition } from "@lego-studio/catalog";

import type { LedgerTransform } from "./real-build-official";

/**
 * Choosing one catalog-to-Builder frame when the stud lattice admits several.
 *
 * An exact correspondence is not a unique answer. A 4x6 plate's stud set is
 * unchanged by a half turn and an 8x8 plate's by every quarter turn, so the
 * exact enumeration returns two or four frames for parts whose placement is a
 * single fact. Only two things may settle that, and they are different claims:
 *
 *  * **The part's own symmetry.** If the residual transform between two
 *    candidates maps the catalog part onto itself — every connector, every
 *    collision primitive, every clutch allowance, both bounds and the footprint
 *    dimensions — then the two frames place the same part in the same cells with
 *    the same grips, and the residual choice is not observable by anything
 *    downstream. It is canonicalized rather than decided.
 *  * **An independent surface witness.** Where the residual is *not* a symmetry,
 *    the part is genuinely different under the two frames and geometry has to
 *    say which. Builder's own Shell vertices are carried through each candidate
 *    and their mean distance to the expanded LDraw surface is compared; the
 *    winner must beat the runner-up by a stated factor, and that factor is
 *    reported so the choice can be judged instead of trusted.
 *
 * The symmetry proof is deliberately narrow and says so: it covers the box and
 * cylinder collision primitives and parametric recipes, and refuses by name
 * rather than assuming for anything else. A refusal here is a design whose frame
 * is not pinned, which is a missing step; a wrong quotient is a part placed
 * slightly wrong, which reads as a step that succeeded.
 */

export type FrameSelectionMethod =
  "unique-stud-correspondence" | "catalog-part-self-symmetry" | "ldraw-surface-witness";

/** The runner-up must be at least this many times worse, in mean surface distance. */
export const FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO = 4_000_000;

export interface FrameSelection {
  readonly transform: LedgerTransform;
  readonly candidateCount: number;
  readonly equivalenceClassCount: number;
  readonly method: FrameSelectionMethod;
  /** Runner-up mean over chosen mean, scaled by 10^6; null when nothing competes. */
  readonly witnessMarginMicroRatio: number | null;
}

type Point = readonly [number, number, number];

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

function orientationOf(id: string): (typeof UPRIGHT_ORIENTATIONS)[number] {
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
class InconclusiveSymmetry extends Error {}

function primitiveKey(
  definitionId: string,
  transform: LedgerTransform | null,
  primitive: Record<string, unknown>,
): string {
  const kind = String(primitive.kind);
  if (kind === "box") {
    return key({
      kind,
      tag: primitive.tag,
      bounds: boundsKey(transform, {
        min: primitive.minLdu as Point,
        max: primitive.maxLdu as Point,
      }),
    });
  }
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
      `Builder frame self-symmetry proof covers only box and cylinder. Two exact frames cannot be ` +
      `declared equivalent on a body this proof cannot rotate; settle the design with the surface ` +
      `witness or extend the proof deliberately.`,
  );
}

/**
 * Whether one upright transform maps the whole catalog part onto itself.
 *
 * Everything a placement is judged by has to be invariant, not merely the studs
 * that produced the candidate frames: the connector graph, the collision union,
 * the clutch allowances, both bounds, and the footprint the lattice indexes.
 */
function isCatalogPartSelfSymmetry(
  definition: PartDefinition,
  transform: LedgerTransform,
): boolean {
  if (definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1") {
    throw new InconclusiveSymmetry(
      `Catalog part ${definition.id} draws a bundled source mesh, whose shape this proof cannot ` +
        `rotate, so two exact Builder frames cannot be declared equivalent for it. Settle the ` +
        `design's frame with the independent LDraw surface witness.`,
    );
  }
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
  const primitives = (mapped: LedgerTransform | null): string =>
    sortedKeys(
      definition.collision.primitives.map((primitive) =>
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
    primitives(null) === primitives(transform) &&
    allowances(null) === allowances(transform) &&
    boundsKey(null, definition.bodyBoundsLdu as { min: Point; max: Point }) ===
      boundsKey(transform, definition.bodyBoundsLdu as { min: Point; max: Point }) &&
    boundsKey(null, definition.boundsLdu as { min: Point; max: Point }) ===
      boundsKey(transform, definition.boundsLdu as { min: Point; max: Point })
  );
}

function canonicalOrder(left: LedgerTransform, right: LedgerTransform): number {
  return (
    orientationOf(left.orientationId).quarterTurns -
      orientationOf(right.orientationId).quarterTurns ||
    left.positionLdu[0]! - right.positionLdu[0]! ||
    left.positionLdu[1]! - right.positionLdu[1]! ||
    left.positionLdu[2]! - right.positionLdu[2]!
  );
}

/**
 * Every upright frame under which the catalog stud set lands exactly on the Builder one.
 *
 * The comparison is exact integer equality on both sets, in both directions, so
 * a missing stud, an extra stud, or a clutch centre substituted for a stud
 * leaves no candidate at all rather than a near fit.
 */
export function deriveCatalogToBuilderFrames(
  catalogStudCenters: readonly Point[],
  builderStudCenters: readonly Point[],
): LedgerTransform[] {
  if (catalogStudCenters.length < 1 || catalogStudCenters.length !== builderStudCenters.length) {
    throw new TypeError(
      `Builder type-23 stud set has ${builderStudCenters.length} centers while the catalog has ` +
        `${catalogStudCenters.length}; a missing, extra, or clutch-center substitution cannot calibrate a frame.`,
    );
  }
  const expected = JSON.stringify(
    [...builderStudCenters]
      .map((point) => point.map(normalizeZero))
      .sort((left, right) => left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!),
  );
  const first = catalogStudCenters[0]!;
  const found = new Map<string, LedgerTransform>();
  for (const orientation of UPRIGHT_ORIENTATIONS) {
    const rotatedFirst = applyUpright(
      { positionLdu: [0, 0, 0], orientationId: orientation.id },
      first,
    );
    for (const target of builderStudCenters) {
      const candidate: LedgerTransform = {
        positionLdu: target.map(
          (coordinate, axis) => coordinate - rotatedFirst[axis]!,
        ) as unknown as LedgerTransform["positionLdu"],
        orientationId: orientation.id,
      };
      const mapped = JSON.stringify(
        catalogStudCenters
          .map((point) => applyUpright(candidate, point))
          .sort(
            (left, right) => left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!,
          ),
      );
      if (mapped === expected) found.set(JSON.stringify(candidate), candidate);
    }
  }
  return [...found.values()].sort(canonicalOrder);
}

/**
 * One frame, with the reason it is the frame.
 *
 * `measure` is the independent witness and is called only when the part's own
 * symmetry cannot account for the residual choice, because for a symmetric part
 * every candidate scores identically by construction and a tie is not evidence.
 */
export function selectCatalogToBuilderFrame(input: {
  readonly definition: PartDefinition;
  readonly designRevision: string;
  readonly catalogStudCenters: readonly Point[];
  readonly builderStudCenters: readonly Point[];
  readonly measure: (frame: LedgerTransform) => readonly number[];
}): FrameSelection {
  const { definition, designRevision, catalogStudCenters, builderStudCenters, measure } = input;
  const candidates = deriveCatalogToBuilderFrames(catalogStudCenters, builderStudCenters);
  if (candidates.length === 0) {
    throw new TypeError(
      `Builder type-23 centers and catalog stud centers for ${designRevision} yield no upright local ` +
        `frame at all, so the two sources do not describe the same stud lattice.`,
    );
  }
  const classes: LedgerTransform[][] = [];
  let inconclusive: string | null = null;
  const equivalent = (group: LedgerTransform[], candidate: LedgerTransform): boolean => {
    try {
      return isCatalogPartSelfSymmetry(definition, residualTransform(group[0]!, candidate));
    } catch (error) {
      // A part the proof cannot describe is not a part the proof may quotient.
      // The residual stays a real ambiguity and the surface witness has to
      // settle it, which is the conservative direction: the alternative is
      // declaring two frames the same because nothing checked them.
      if (!(error instanceof InconclusiveSymmetry)) throw error;
      inconclusive = error.message;
      return false;
    }
  };
  for (const candidate of candidates) {
    const existing = classes.find((group) => equivalent(group, candidate));
    if (existing === undefined) classes.push([candidate]);
    else existing.push(candidate);
  }
  const representatives = classes.map((group) => [...group].sort(canonicalOrder)[0]!);
  if (representatives.length === 1) {
    return {
      transform: representatives[0]!,
      candidateCount: candidates.length,
      equivalenceClassCount: 1,
      method: candidates.length === 1 ? "unique-stud-correspondence" : "catalog-part-self-symmetry",
      witnessMarginMicroRatio: null,
    };
  }
  const scored = representatives
    .map((transform) => {
      const distances = measure(transform);
      const total = distances.reduce((sum, value) => sum + value, 0);
      return { transform, mean: total / Math.max(1, distances.length) };
    })
    .sort(
      (left, right) => left.mean - right.mean || canonicalOrder(left.transform, right.transform),
    );
  const best = scored[0]!;
  const runnerUp = scored[1]!;
  const margin =
    best.mean <= 0 ? Number.POSITIVE_INFINITY : Math.round((runnerUp.mean / best.mean) * 1_000_000);
  if (!(margin >= FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO)) {
    throw new TypeError(
      `Builder type-23 centers for ${designRevision} admit ${candidates.length} exact upright frames in ` +
        `${representatives.length} classes that ${definition.id}'s own symmetry cannot account for, and the ` +
        `independent LDraw surface witness separates the best two by only ${margin / 1_000_000}x ` +
        `(${best.mean / 1_000_000} LDU against ${runnerUp.mean / 1_000_000} LDU mean); ` +
        `${FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO / 1_000_000}x is required. A frame that fits the studs ` +
        `is not automatically the right frame, so this design stays uncalibrated rather than guessed.` +
        (inconclusive === null
          ? ""
          : ` Some residual pairs could not even be tested for symmetry: ${inconclusive}`),
    );
  }
  return {
    transform: best.transform,
    candidateCount: candidates.length,
    equivalenceClassCount: representatives.length,
    method: "ldraw-surface-witness",
    witnessMarginMicroRatio: Number.isFinite(margin) ? margin : null,
  };
}
