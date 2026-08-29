import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { GROUND_UNDERSIDE_LDU, bodyBoundsLdu } from "../placement";
import { enumeratePlacements } from "./enumerate-placements";

const SIDEWAYS_AXLE = "proper-m-00pp000p0";

describe("proper-orientation build-plate enumeration", () => {
  it("keeps the safe canonical half-LDU axle rest reachable", () => {
    const document = createEmptyBrickDocument({
      id: "proper-ground-enumeration",
      name: "Proper ground enumeration",
    });

    const result = enumeratePlacements(document, "builtin:axle-1x3", {
      includeBuildPlate: true,
      orientationIds: [SIDEWAYS_AXLE],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      catalogPartId: "builtin:axle-1x3",
      transform: { positionLdu: [0, -18, 0], orientationId: SIDEWAYS_AXLE },
      connections: [],
      restsOnBuildPlate: true,
    });
    const candidate = createPartInstance({
      id: "candidate",
      catalogPartId: "builtin:axle-1x3",
      transform: result.candidates[0]!.transform,
    });
    const actualUndersideLdu = bodyBoundsLdu(candidate).max[1];
    expect(actualUndersideLdu).toBe(11.5);
    expect(GROUND_UNDERSIDE_LDU - actualUndersideLdu).toBe(0.5);
    expect(result.counts.rejectedUnsupported).toBe(0);
    expect(result.counts.rejectedBelowBuildPlate).toBe(0);
  });
});
