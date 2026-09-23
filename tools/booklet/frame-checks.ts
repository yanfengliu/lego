import { getPartDefinition, PROPER_ORIENTATIONS } from "@lego-studio/catalog";

import type { MeasuredFrames } from "./ldraw-frames.ts";
import { fallbackCatalogFrame, type CatalogFrame } from "./playback-pose.ts";

/**
 * Two checks on the frames playback depends on, and the one question both
 * ask: do two frames that differ still put the part in the same place?
 *
 * They do when the difference between them is a symmetry of the part — a
 * half turn of a 2 x 2 plate — so a difference is only reported as a
 * disagreement when it moves the part as the catalog models it. Bound: "as
 * the catalog models it" is the connector set (kind, seat and normal) and the
 * body bounds; the shape of individual collision primitives and the visual
 * mesh are not compared, so a part whose connectors and bounds are symmetric
 * but whose body is not would be called equivalent.
 */

/** A rigid motion x -> matrix * x + translation, row-major 3x3, in one part's local frame. */
export interface LocalMotion {
  readonly matrix: readonly number[];
  readonly translationLdu: readonly number[];
}

const matrixById = new Map(PROPER_ORIENTATIONS.map(({ id, matrix }) => [id, matrix] as const));

export function multiply(left: readonly number[], right: readonly number[]): number[] {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce((total, k) => total + left[row * 3 + k]! * right[k * 3 + column]!, 0);
  });
}

export function transpose(m: readonly number[]): number[] {
  return [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!];
}

export function rotate(m: readonly number[], v: readonly number[]): number[] {
  return [0, 1, 2].map(
    (row) => m[row * 3]! * v[0]! + m[row * 3 + 1]! * v[1]! + m[row * 3 + 2]! * v[2]!,
  );
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const isIdentity = (motion: LocalMotion) =>
  motion.matrix.every((value, index) => Math.abs(value - IDENTITY[index]!) < 1e-9) &&
  motion.translationLdu.every((value) => Math.abs(value) < 1e-6);

/** An LDraw-local motion p -> A p + d seen in catalog-local coordinates through `frame`. */
export function ldrawMotionInCatalog(frame: CatalogFrame, motion: LocalMotion): LocalMotion {
  // catalog = O * ldraw + t, so the motion becomes (O A O^T) c + (O d + t - O A O^T t).
  const o = matrixById.get(frame.orientationId)!;
  const conjugated = multiply(multiply(o, motion.matrix), transpose(o));
  const moved = rotate(conjugated, frame.translationLdu);
  const shift = rotate(o, motion.translationLdu);
  return {
    matrix: conjugated,
    translationLdu: [0, 1, 2].map(
      (axis) => shift[axis]! + frame.translationLdu[axis]! - moved[axis]!,
    ),
  };
}

/** The catalog-local motion between two catalog frames of one LDraw file. */
export function catalogFrameDelta(from: CatalogFrame, to: CatalogFrame): LocalMotion {
  // Same placement iff the geometry maps onto itself under c -> O2 O1^T (c - t1) + t2.
  const turn = multiply(
    matrixById.get(to.orientationId)!,
    transpose(matrixById.get(from.orientationId)!),
  );
  const moved = rotate(turn, from.translationLdu);
  return {
    matrix: turn,
    translationLdu: [0, 1, 2].map((axis) => to.translationLdu[axis]! - moved[axis]!),
  };
}

const key = (values: readonly number[]) =>
  values.map((value) => Math.round(value * 1000) / 1000 + 0).join(",");

/**
 * Whether `motion` maps the catalog part onto itself: every connector onto a
 * connector of the same kind with the same normal, and the body bounds onto
 * themselves. Null when the catalog has no such part.
 */
export function isCatalogSelfMotion(catalogPartId: string, motion: LocalMotion): boolean | null {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) return null;
  if (isIdentity(motion)) return true;
  const apply = (point: readonly number[]) =>
    rotate(motion.matrix, point).map((value, axis) => value + motion.translationLdu[axis]!);
  const seats = new Map<string, number>();
  for (const connector of definition.connectors) {
    const seat = `${connector.kind}|${key(connector.positionLdu)}|${key(connector.normal)}`;
    seats.set(seat, (seats.get(seat) ?? 0) + 1);
  }
  for (const connector of definition.connectors) {
    const seat = `${connector.kind}|${key(apply(connector.positionLdu))}|${key(rotate(motion.matrix, connector.normal))}`;
    const left = seats.get(seat) ?? 0;
    if (left === 0) return false;
    seats.set(seat, left - 1);
  }
  const { min, max } = definition.bodyBoundsLdu;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((bits) =>
    apply([bits & 1 ? max[0] : min[0], bits & 2 ? max[1] : min[1], bits & 4 ? max[2] : min[2]]),
  );
  const movedMin = [0, 1, 2].map((axis) => Math.min(...corners.map((corner) => corner[axis]!)));
  const movedMax = [0, 1, 2].map((axis) => Math.max(...corners.map((corner) => corner[axis]!)));
  return key(movedMin) === key(min) && key(movedMax) === key(max);
}

export interface FallbackDisagreement {
  readonly ldrawFilename: string;
  readonly catalogPartId: string;
  readonly registry: { readonly orientationId: string; readonly translationLdu: readonly number[] };
  readonly fallback: { readonly orientationId: string; readonly translationLdu: readonly number[] };
  /** True when the two frames differ only by a symmetry of the part (the same placement). */
  readonly equivalentBySymmetry: boolean;
}

export interface FallbackCheck {
  /** Registry rows whose catalog part is parametric: the rows the fallback would otherwise guess. */
  readonly parametricRows: number;
  readonly agree: number;
  readonly equivalentBySymmetry: number;
  readonly disagreements: readonly FallbackDisagreement[];
}

/**
 * How the no-registry fallback (`fallbackCatalogFrame`) compares with the
 * registry on every parametric row: what playback would get wrong if the
 * ignored registry were missing. Mesh-backed rows are left out, because their
 * fallback is the catalog's own measured declaration rather than a guess.
 */
export function checkFallbackAgainstRegistry(frames: MeasuredFrames): FallbackCheck {
  let parametricRows = 0;
  let agree = 0;
  const disagreements: FallbackDisagreement[] = [];
  for (const [ldrawFilename, row] of [...frames].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const definition = getPartDefinition(row.catalogPartId);
    if (!definition || definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1")
      continue;
    parametricRows += 1;
    const fallback = fallbackCatalogFrame(row.catalogPartId);
    const registry: CatalogFrame = { ...row, basis: "measured" };
    if (
      fallback.orientationId === row.orientationId &&
      key(fallback.translationLdu) === key(row.translationLdu)
    ) {
      agree += 1;
      continue;
    }
    disagreements.push({
      ldrawFilename,
      catalogPartId: row.catalogPartId,
      registry: { orientationId: row.orientationId, translationLdu: row.translationLdu },
      fallback: { orientationId: fallback.orientationId, translationLdu: fallback.translationLdu },
      equivalentBySymmetry:
        isCatalogSelfMotion(row.catalogPartId, catalogFrameDelta(registry, fallback)) === true,
    });
  }
  const equivalent = disagreements.filter(({ equivalentBySymmetry }) => equivalentBySymmetry);
  return {
    parametricRows,
    agree,
    equivalentBySymmetry: equivalent.length,
    disagreements: disagreements.filter(({ equivalentBySymmetry }) => !equivalentBySymmetry),
  };
}
