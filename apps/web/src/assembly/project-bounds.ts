import { lduToThreeVector } from "@lego-studio/rendering";
import type { PartInstance } from "@lego-studio/protocol";
import { Vector3, type Camera } from "three";

import type { HighlightRegionBounds } from "../instructions/highlight-region";
import { bodyBoundsLdu } from "../placement";

/**
 * Where a placement would land on the panel, without rendering it.
 *
 * This is what makes the closed loop affordable. A step can have a couple of
 * thousand legal placements and the booklet's highlight says where on the page
 * the new part is, so nearly all of them are refuted by projecting eight
 * corners — a few microseconds — rather than by rasterising a model.
 *
 * The box is the projection of the part's solid body, studs excluded, which is
 * deliberately the smaller of the two: this prunes candidates, so it must never
 * be tighter than the truth, and a box that omits the studs is looser in the
 * only direction that matters once the caller's margin is added.
 */
export function projectPartBounds(
  part: Pick<PartInstance, "catalogPartId" | "transform">,
  camera: Camera,
  widthPx: number,
  heightPx: number,
): HighlightRegionBounds | null {
  const bounds = bodyBoundsLdu(part);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const projected = lduToThreeVector([x, y, z]).project(camera);
        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;
        const pixelX = ((projected.x + 1) / 2) * widthPx;
        const pixelY = ((1 - projected.y) / 2) * heightPx;
        minX = Math.min(minX, pixelX);
        maxX = Math.max(maxX, pixelX);
        minY = Math.min(minY, pixelY);
        maxY = Math.max(maxY, pixelY);
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  // Entirely outside the panel is not a candidate the booklet could have drawn.
  if (maxX < 0 || minX > widthPx || maxY < 0 || minY > heightPx) return null;
  return {
    minXPx: Math.floor(minX),
    minYPx: Math.floor(minY),
    maxXPx: Math.ceil(maxX),
    maxYPx: Math.ceil(maxY),
  };
}

/** Re-exported so a caller can build a projection without importing three. */
export function projectPoint(
  pointLdu: readonly [number, number, number],
  camera: Camera,
  widthPx: number,
  heightPx: number,
): { readonly xPx: number; readonly yPx: number } {
  const projected = new Vector3().copy(lduToThreeVector(pointLdu)).project(camera);
  return {
    xPx: ((projected.x + 1) / 2) * widthPx,
    yPx: ((1 - projected.y) / 2) * heightPx,
  };
}
