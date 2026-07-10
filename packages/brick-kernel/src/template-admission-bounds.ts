import type { PartDefinition } from "@lego-studio/catalog";
import type { TemplateSnapshotV1 } from "@lego-studio/protocol";

import { transformLduPoint } from "./transforms.ts";

export function clearanceContainsTransformedPartBounds(
  definition: PartDefinition,
  transform: TemplateSnapshotV1["parts"][number]["transform"],
  clearance: TemplateSnapshotV1["clearanceVolume"],
): boolean {
  const xs = [definition.boundsLdu.min[0], definition.boundsLdu.max[0]] as const;
  const ys = [definition.boundsLdu.min[1], definition.boundsLdu.max[1]] as const;
  const zs = [definition.boundsLdu.min[2], definition.boundsLdu.max[2]] as const;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const point = transformLduPoint(transform, [x, y, z]);
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis]!, point[axis]!);
          max[axis] = Math.max(max[axis]!, point[axis]!);
        }
      }
    }
  }

  return min.every(
    (minimum, axis) => minimum >= clearance.minLdu[axis]! && max[axis]! <= clearance.maxLdu[axis]!,
  );
}
