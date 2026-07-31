import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import { THREE_UNITS_PER_LDU } from "@lego-studio/rendering";
import type { PartInstance } from "@lego-studio/protocol";

import { GROUND_UNDERSIDE_LDU, partTopSurfaceLdu } from "../placement";

export interface ThreePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DropSupport {
  /** World Y in LDU that the dropped part's underside should rest on. */
  readonly supportUndersideLdu: number;
  /** The part being landed on, or null for the build plate. */
  readonly supportPartId: string | null;
}

/** Three.js is +Y up and scaled; the document is -Y up in raw LDU. */
export function threePointToLdu({ x, y, z }: ThreePoint): LduVector3 {
  return [x / THREE_UNITS_PER_LDU, -y / THREE_UNITS_PER_LDU, z / THREE_UNITS_PER_LDU];
}

/** Scene height of the build plate, for intersecting a drop ray with empty ground. */
export const GROUND_PLANE_THREE_Y = -GROUND_UNDERSIDE_LDU * THREE_UNITS_PER_LDU;

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
  const definition = part ? getPartDefinition(part.catalogPartId) : undefined;
  if (!part || !definition) {
    return { supportUndersideLdu: GROUND_UNDERSIDE_LDU, supportPartId: null };
  }
  return {
    supportUndersideLdu: partTopSurfaceLdu(definition, part.transform.positionLdu[1]),
    supportPartId: part.id,
  };
}
