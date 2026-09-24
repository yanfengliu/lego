import { createPartInstance } from "@lego-studio/brick-kernel";
import type { PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { occupiedConnectorCapacityClaims } from "./connector-capacity";
import { findStudConnections } from "./placement";

/**
 * Discovery of 15573's center seat, the path that failed: booklet 6651557 step
 * 29 centres a jumper on each roller skate's one stud, `findStudConnections`
 * found no clutch over it, and the jumper joined nothing (DISCONNECTED_ASSEMBLY).
 *
 * Bound: a jumper centred on a roller skate's stud at yaw 270, as step 29 prints it, and a 1 x 2 plate at yaw 0 for the
 * two grid seats; the kernel side is `catalog-15573-connection.test.ts`.
 */

const JUMPER = "builtin:jumper-plate-1x2";

function placed(
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
): PartInstance {
  return createPartInstance({ id, catalogPartId, transform: { positionLdu, orientationId } });
}

describe("15573 center-seat discovery", () => {
  it("finds the center seat over a roller skate's one stud as step 29 prints it", () => {
    const skate = placed("skate", "builtin:roller-skate", [40, -16, -20], "upright-yaw-270");
    const jumper = placed("jumper", JUMPER, [40, -24, -20], "upright-yaw-270");

    expect(findStudConnections(jumper, [skate])).toEqual([
      { targetPartId: "skate", targetPortId: "stud:0", candidatePortId: "undersideClutch:center" },
    ]);
  });

  it("finds both grid seats over a 1 x 2 plate, and the center seat only while no grid seat is held", () => {
    const plate = placed("plate", "builtin:plate-1x2", [10, 8, 0]);
    const jumper = placed("jumper", JUMPER, [10, 0, 0]);

    expect(findStudConnections(jumper, [plate])).toEqual([
      { targetPartId: "plate", targetPortId: "stud:0:0", candidatePortId: "undersideClutch:0:0" },
      { targetPartId: "plate", targetPortId: "stud:0:1", candidatePortId: "undersideClutch:0:1" },
    ]);

    const heldNegative = occupiedConnectorCapacityClaims(
      [plate, jumper],
      [
        {
          id: "negative",
          kind: "stud-tube",
          a: { partId: "plate", portId: "stud:0:0" },
          b: { partId: "jumper", portId: "undersideClutch:0:0" },
          provenance: { source: "manual" },
        },
      ],
    );
    const centered = placed("centered", "builtin:plate-1x1", [10, 8, 0]);
    expect(findStudConnections(centered, [jumper])).toEqual([
      {
        targetPartId: "jumper",
        targetPortId: "undersideClutch:center",
        candidatePortId: "stud:0:0",
      },
    ]);
    expect(findStudConnections(centered, [jumper], heldNegative)).toEqual([]);
  });
});
