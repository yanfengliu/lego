import {
  STUD_PITCH_LDU,
  getPartDefinition,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { GROUND_UNDERSIDE_LDU, bodyBoundsLdu, worldFootprint } from "../placement";

/** Build-plate seats bounded by the current assembly plus one candidate reach. */
export function buildPlateOrigins(
  document: BrickDocumentV1,
  definition: PartDefinition,
  orientationId: string,
): readonly LduVector3[] {
  const y = GROUND_UNDERSIDE_LDU - definition.dimensions.heightLdu / 2;
  const placed = document.parts.filter((part) => getPartDefinition(part.catalogPartId));
  if (placed.length === 0) return [[0, y, 0]];

  const boxes = placed.map((part) => bodyBoundsLdu(part));
  const reach = Math.max(definition.dimensions.widthLdu, definition.dimensions.lengthLdu);
  const minX = Math.min(...boxes.map((box) => box.min[0])) - reach;
  const maxX = Math.max(...boxes.map((box) => box.max[0])) + reach;
  const minZ = Math.min(...boxes.map((box) => box.min[2])) - reach;
  const maxZ = Math.max(...boxes.map((box) => box.max[2])) + reach;

  const footprint = worldFootprint(definition, orientationId);
  const origins: LduVector3[] = [];
  for (let x = alignedStart(minX, footprint.originOffsetX); x <= maxX; x += STUD_PITCH_LDU) {
    for (let z = alignedStart(minZ, footprint.originOffsetZ); z <= maxZ; z += STUD_PITCH_LDU) {
      origins.push([x, y, z]);
    }
  }
  return origins;
}

function alignedStart(from: number, offset: number): number {
  return Math.ceil((from - offset) / STUD_PITCH_LDU) * STUD_PITCH_LDU + offset;
}
