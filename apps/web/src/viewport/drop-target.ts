import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import { lduToThreeVector, threeToLduVector, type ThreeCoordinates } from "@lego-studio/rendering";
import type { PartInstance } from "@lego-studio/protocol";

import { GROUND_UNDERSIDE_LDU, partTopSurfaceLdu } from "../placement";

export type ThreePoint = ThreeCoordinates;

export interface DropSupport {
  /** World Y in LDU that the dropped part's underside should rest on. */
  readonly supportUndersideLdu: number;
  /** The part being landed on, or null for the build plate. */
  readonly supportPartId: string | null;
}

/**
 * A scene point, such as where a pick ray hit, in document LDU. The renderer's
 * own inverse, so a pick cannot land on the mirror image of what was drawn.
 */
export function threePointToLdu(point: ThreePoint): LduVector3 {
  return threeToLduVector(point);
}

/**
 * Scene height of the build plate, for intersecting a drop ray with empty
 * ground and for drawing the grid there. It goes through the renderer's own
 * conversion rather than a sign of its own.
 */
export const GROUND_PLANE_THREE_Y = lduToThreeVector([0, GROUND_UNDERSIDE_LDU, 0]).y;

/**
 * Resolves what a dropped part should rest on. Landing anywhere on an existing
 * part seats the new part on that part's top surface, which is how bricks
 * actually stack; an empty ray falls through to the build plate.
 */
export function resolveDropSupport(
  hitPartId: string | null,
  parts: readonly PartInstance[],
): DropSupport {
  if (hitPartId === null) {
    return { supportUndersideLdu: GROUND_UNDERSIDE_LDU, supportPartId: null };
  }
  const part = parts.find(({ id }) => id === hitPartId);
  if (!part || !getPartDefinition(part.catalogPartId)) {
    return { supportUndersideLdu: GROUND_UNDERSIDE_LDU, supportPartId: null };
  }
  return {
    supportUndersideLdu: partTopSurfaceLdu(part),
    supportPartId: part.id,
  };
}
