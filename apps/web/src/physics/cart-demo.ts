import { applyBuildOperations, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { createPlacePartTransaction } from "../manual-commands";

/**
 * A four-wheeled cart, as the smallest thing that exercises the whole stack at
 * once: a rigid chassis of several part types, two axles, four wheels, and a
 * connection graph that has to come out as three bodies and four joints rather
 * than eleven bodies or one.
 *
 * Built through the same `createPlacePartTransaction` the editor uses, so a
 * placement the demo makes is a placement a person could make. Nothing here is
 * a fixture: if the cart cannot be built by the rules, this throws.
 */

const COLORS = {
  chassis: "builtin:red",
  bearing: "builtin:dark-bluish-gray",
  axle: "builtin:light-bluish-gray",
  wheel: "builtin:black",
} as const;

interface Placement {
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly positionLdu: readonly [number, number, number];
  readonly orientationId?: string;
}

/**
 * The plate sits on the build plate; bearings hang under it at each corner with
 * their holes in line; an axle runs through each pair, and a wheel rides each
 * axle end.
 */
const CART: readonly Placement[] = [
  // A 2x6 plate, narrow enough that the wheels clear it, with a 2x4 brick on
  // top so the chassis is visibly more than one piece.
  { catalogPartId: "builtin:plate-2x6", colorId: COLORS.chassis, positionLdu: [0, 8, 0] },
  { catalogPartId: "builtin:brick-2x4", colorId: COLORS.chassis, positionLdu: [0, -8, 0] },

  // Four bearings under the plate, two per axle, at the far ends.
  //
  // The axles have to be further apart than a wheel is wide or the front and
  // rear wheels occupy the same space. A 62 LDU wheel needs more than 62
  // between axles; at ±20 they overlapped by 22 — a third of their diameter —
  // and the demo shipped that way because nothing asserted the document was
  // valid. ±40 gives 80.
  //
  // Their positions are forced by the lattice rather than chosen. A 1x2 brick's
  // studs sit 10 LDU either side of its centre, and a plate's cells are at odd
  // multiples of 10, so a bearing's centre has to be at an even one — 20, not
  // 30. Getting that wrong is why the first attempt had every part refused.
  //
  // Two per axle rather than one, because a single bearing would have to sit at
  // x = 0 for its hole to line up with a centred axle, and x = 0 is not a cell
  // on a two-wide plate.
  ...[-10, 10].flatMap((x) =>
    [-40, 40].map((z) => ({
      catalogPartId: "builtin:technic-brick-1x2",
      colorId: COLORS.bearing,
      positionLdu: [x, 24, z] as const,
    })),
  ),
];

/**
 * Where the axles and wheels go, in the same frame.
 *
 * The axles are 4L. A wheel sits 30 LDU out on each side, and a 2L axle's
 * furthest port is 10 from its centre, so it cannot reach one — the first
 * attempt used a 2L and the editor refused every wheel as unsupported,
 * correctly.
 */
const RUNNING_GEAR: readonly Placement[] = [
  ...[-40, 40].flatMap((z) => [
    { catalogPartId: "builtin:axle-1x4", colorId: COLORS.axle, positionLdu: [0, 22, z] as const },
    // At the axle's outermost ports, and far enough out that a 36 LDU wheel
    // clears the 40 LDU wide plate it is carrying.
    ...[-30, 30].map((x) => ({
      catalogPartId: "builtin:wheel-1x2",
      colorId: COLORS.wheel,
      positionLdu: [x, 22, z] as const,
    })),
  ]),
];

/**
 * The cart, as a document.
 *
 * Placements that the editor's own rules refuse are reported rather than
 * skipped, because a demo that silently drops a wheel is worse than one that
 * does not build.
 */
export function createCartDocument(): BrickDocumentV1 {
  let document = createEmptyBrickDocument({ id: "cart-demo", name: "Wheeled cart" });
  const refused: string[] = [];

  for (const placement of [...CART, ...RUNNING_GEAR]) {
    try {
      const transaction = createPlacePartTransaction(document, {
        catalogPartId: placement.catalogPartId,
        colorId: placement.colorId,
        transform: {
          positionLdu: placement.positionLdu,
          orientationId: placement.orientationId ?? "upright-yaw-0",
        },
      });
      document = applyBuildOperations(document, transaction.operations);
    } catch (error) {
      refused.push(
        `${placement.catalogPartId} at [${placement.positionLdu.join(", ")}]: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (refused.length > 0) {
    throw new Error(
      `The cart demo could not be built by the editor's own rules. Refused:\n- ${refused.join("\n- ")}`,
    );
  }
  return document;
}
