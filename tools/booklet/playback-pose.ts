import { getPartDefinition, PROPER_ORIENTATIONS, type LduVector3 } from "@lego-studio/catalog";
import { rotateLduVector } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import { ldrawToCatalogFrame } from "../../packages/brick-kernel/src/ldraw-frame-conversion.ts";
import { snapPlacementOriginForDefinition } from "../../apps/web/src/placement.ts";
import type { MeasuredFrames } from "./ldraw-frames.ts";

/**
 * One official brick's pose, moved into the editor's document frame.
 *
 * The official LDraw export writes each brick as a type-1 line in its LDraw
 * file's frame; the catalog part sits in the catalog frame. The map between
 * them is taken, in order of trust, from (1) a measured frame registry when
 * one is supplied and names this file, (2) the catalog's own declaration
 * (`assetToCatalogFrame` of a mesh-backed part, `ldrawFrame` orientation),
 * and (3) for a parametric part that declares nothing, the top-face
 * convention every mesh declaration follows: LDraw puts the origin on the
 * body's top face, the catalog at its centre, so translation [0, body top, 0].
 * Each placed part records which basis it used.
 *
 * The export carries float noise (-24.00000000000325), so a term is snapped
 * only within a stated tolerance of a value the document can represent; a
 * pose that is not — a 45-degree hinge, a half-LDU origin — is reported,
 * never forced.
 */
export const POSE_TOLERANCES = Object.freeze({
  /** A rotation term within this of -1, 0 or 1 is that value. */
  matrixTerm: 1e-4,
  /** A coordinate within this of a half-LDU value is that value. */
  positionLdu: 1e-3,
});

export interface OfficialPose {
  /** Row-major 3x3 acting on column vectors, as LDraw writes it. */
  readonly matrix: readonly number[];
  readonly positionLdu: readonly number[];
}

export type PoseBlock =
  | "orientation-off-lattice"
  | "orientation-unsupported"
  | "orientation-illegal-for-part"
  | "position-off-lattice"
  | "origin-not-integral";

export type FrameBasis = "measured" | "declared" | "inferred-top-of-body";

export type PoseResolution =
  | { readonly ok: true; readonly transform: RigidTransform; readonly frameBasis: FrameBasis }
  | { readonly ok: false; readonly block: PoseBlock; readonly detail: string };

const orientationIdByMatrix = new Map(
  PROPER_ORIENTATIONS.map(({ id, matrix }) => [matrix.join(" "), id] as const),
);
const matrixById = new Map(PROPER_ORIENTATIONS.map(({ id, matrix }) => [id, matrix] as const));

function snapTerm(value: number, step: number, tolerance: number): number | null {
  const snapped = Math.round(value / step) * step;
  if (Math.abs(value - snapped) > tolerance) return null;
  return Object.is(snapped, -0) ? 0 : snapped;
}

/** left · transpose(right): an LDraw instance matrix with the part's frame turn taken out. */
function multiplyByTranspose(left: readonly number[], right: readonly number[]): number[] {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce((total, k) => total + left[row * 3 + k]! * right[column * 3 + k]!, 0);
  });
}

export interface CatalogFrame {
  /** Orientation id of the LDraw-file-to-catalog turn. */
  readonly orientationId: string;
  /** Catalog-local offset from the catalog origin to the LDraw origin. */
  readonly translationLdu: LduVector3;
  readonly basis: FrameBasis;
}

export function catalogFrameFor(
  catalogPartId: string,
  ldrawFilename: string,
  measured: MeasuredFrames | null,
): CatalogFrame {
  const row = measured?.get(ldrawFilename.toLowerCase());
  if (row && row.catalogPartId === catalogPartId) {
    return {
      orientationId: row.orientationId,
      translationLdu: row.translationLdu,
      basis: "measured",
    };
  }
  const frame = ldrawToCatalogFrame(catalogPartId);
  const definition = getPartDefinition(catalogPartId);
  const parametric =
    definition !== undefined &&
    definition.geometry.generatorId !== "builtin:preloaded-mesh-reference/1";
  if (
    parametric &&
    frame.orientation.id === "upright-yaw-0" &&
    frame.translationLdu.every((value) => value === 0)
  ) {
    return {
      orientationId: "upright-yaw-0",
      translationLdu: [0, definition.bodyBoundsLdu.min[1], 0],
      basis: "inferred-top-of-body",
    };
  }
  return {
    orientationId: frame.orientation.id,
    translationLdu: frame.translationLdu,
    basis: "declared",
  };
}

/** The catalog transform for `pose`, before any world shift. */
export function officialPoseToCatalog(
  catalogPartId: string,
  ldrawFilename: string,
  pose: OfficialPose,
  measured: MeasuredFrames | null,
): PoseResolution {
  const matrix = pose.matrix.map((term) => snapTerm(term, 1, POSE_TOLERANCES.matrixTerm));
  if (matrix.length !== 9 || matrix.some((term) => term === null)) {
    return {
      ok: false,
      block: "orientation-off-lattice",
      detail: `rotation [${pose.matrix.map((term) => term.toFixed(4)).join(" ")}] is not a quarter-turn pose`,
    };
  }
  const frame = catalogFrameFor(catalogPartId, ldrawFilename, measured);
  const catalogMatrix = multiplyByTranspose(
    matrix as number[],
    matrixById.get(frame.orientationId) ?? [],
  ).map((term) => (Object.is(term, -0) ? 0 : term));
  const orientationId = orientationIdByMatrix.get(catalogMatrix.join(" "));
  if (orientationId === undefined) {
    return {
      ok: false,
      block: "orientation-unsupported",
      detail: `rotation [${matrix.join(" ")}] with ${frame.basis} frame ${frame.orientationId} is not a proper catalog orientation`,
    };
  }
  if (!getPartDefinition(catalogPartId)?.legalOrientationIds.includes(orientationId)) {
    return {
      ok: false,
      block: "orientation-illegal-for-part",
      detail: `the catalog does not allow ${catalogPartId} in orientation ${orientationId}`,
    };
  }
  const position = pose.positionLdu.map((value) =>
    snapTerm(value, 0.5, POSE_TOLERANCES.positionLdu),
  );
  if (position.length !== 3 || position.some((value) => value === null)) {
    return {
      ok: false,
      block: "position-off-lattice",
      detail: `origin [${pose.positionLdu.map((value) => value.toFixed(3)).join(", ")}] is not on the half-LDU grid`,
    };
  }
  const rotated = rotateLduVector(matrixById.get(orientationId)!, frame.translationLdu);
  const origin = (position as number[]).map(
    (value, axis) => value - rotated[axis]!,
  ) as unknown as LduVector3;
  return { ok: true, transform: { positionLdu: origin, orientationId }, frameBasis: frame.basis };
}

/** Adds an integer world shift; the result must be whole LDU, which canonical transforms require. */
export function shiftTransform(
  transform: RigidTransform,
  shift: LduVector3,
  frameBasis: FrameBasis,
): PoseResolution {
  const positionLdu = transform.positionLdu.map((value, axis) => value + shift[axis]!);
  if (!positionLdu.every(Number.isSafeInteger)) {
    return {
      ok: false,
      block: "origin-not-integral",
      detail: `catalog origin [${positionLdu.join(", ")}] is not whole LDU`,
    };
  }
  return {
    ok: true,
    transform: {
      positionLdu: positionLdu as unknown as LduVector3,
      orientationId: transform.orientationId,
    },
    frameBasis,
  };
}

/**
 * The integer shift that seats `anchor` — the first brick the booklet places —
 * on the editor's build plate at its stud lattice, found with the editor's
 * own snap. The official model's coordinates are otherwise arbitrary; this
 * one shift, applied to every brick, is the only liberty playback takes.
 */
export function worldShiftFor(anchor: {
  catalogPartId: string;
  transform: RigidTransform;
}): LduVector3 | null {
  const definition = getPartDefinition(anchor.catalogPartId);
  if (!definition) return null;
  const snapped = snapPlacementOriginForDefinition({
    definition,
    orientationId: anchor.transform.orientationId,
    rawLdu: anchor.transform.positionLdu,
  });
  return snapped.map((value, axis) =>
    Math.round(value - anchor.transform.positionLdu[axis]!),
  ) as unknown as LduVector3;
}
