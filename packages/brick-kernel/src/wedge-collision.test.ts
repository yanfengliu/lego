import { describe, expect, it } from "vitest";

import { findCatalogCollisions } from "./collisions.ts";
import { transformLduPoint } from "./transforms.ts";
import type { PartInstance } from "@lego-studio/protocol";

/**
 * A wedge is not its bounding box.
 *
 * `builtin:wedge-plate-2x4-left` is measured from LDraw part 41770a: a 2x4
 * footprint spanning x -20..20 and z -40..40, studs along x = -10, and the
 * corner at +x, -z sloped away. Its solid is `4x - z <= 40`, so the empty
 * region is a triangle with corners at (0,-40), (20,-40) and (20,40).
 *
 * A brick standing in that triangle shares the wedge's bounding box and none of
 * its solid, and must be allowed. Modelling the body as one box would refuse
 * it, which is the whole reason the wedge primitive exists.
 */
const part = (
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
) =>
  ({
    id,
    catalogPartId,
    colorId: "builtin:light-bluish-gray",
    transform: { positionLdu, orientationId },
    submodelId: "root",
    stepId: "step-1",
    semanticTags: [],
    provenance: { source: "manual" },
  }) satisfies PartInstance;

/** A 1x1 brick beside the wedge at the same height, so any overlap is horizontal. */
const probe = (x: number, z: number) => part("probe", "builtin:brick-1x1", [x, -8, z]);

const codesFor = (parts: readonly PartInstance[]) =>
  findCatalogCollisions(parts, []).map(({ code }) => code);

describe("wedge body collision", () => {
  const left = part("wedge", "builtin:wedge-plate-2x4-left", [0, 0, 0]);

  // Spans x 10..30, z -40..-20. Its nearest corner to the solid is (10,-20),
  // where 4x - z is 60 — past the cut at 40, so the whole probe is clear.
  const inEmptyCorner = probe(20, -30);
  // Spans x -20..0, z -40..-20, entirely on the studded spine.
  const onTheSpine = probe(-10, -30);

  it("leaves the sloped-away corner free", () => {
    expect(findCatalogCollisions([left, inEmptyCorner], [])).toEqual([]);
  });

  it("still refuses the solid half", () => {
    expect(codesFor([left, onTheSpine])).toContain("PART_BODY_COLLISION");
  });

  it("refuses the wide end, where the wedge keeps its full width", () => {
    // Same +x side as the free corner, but at +z the wedge runs full width.
    expect(codesFor([left, probe(10, 30)])).toContain("PART_BODY_COLLISION");
  });

  it("would be refused if the body were its bounding box", () => {
    // The same probe against a plain 2x4 plate of the same footprint collides,
    // which is what makes the free verdict above a property of the slope.
    const box = part("wedge", "builtin:plate-2x4", [0, 0, 0]);

    expect(codesFor([box, inEmptyCorner])).toContain("PART_BODY_COLLISION");
  });

  it("mirrors for the right-hand variant", () => {
    const right = part("wedge", "builtin:wedge-plate-2x4-right", [0, 0, 0]);

    // The right-hand wedge empties -x where the left empties +x.
    expect(findCatalogCollisions([right, probe(-20, -30)], [])).toEqual([]);
    expect(codesFor([right, inEmptyCorner])).toContain("PART_BODY_COLLISION");
  });

  it("carries the slope through a quarter turn", () => {
    // Turn the wedge and its probes by the same quarter turn and every verdict
    // must survive: a rigid motion cannot change what overlaps what. This is
    // the property to test rather than naming which corner empties, because
    // that depends on a rotation convention the test should not restate.
    const turn = { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-90" };
    const turned = part("wedge", "builtin:wedge-plate-2x4-left", [0, 0, 0], "upright-yaw-90");
    const turnedProbe = (source: PartInstance) => ({
      ...source,
      transform: {
        ...source.transform,
        positionLdu: transformLduPoint(turn, source.transform.positionLdu),
      },
    });

    expect(findCatalogCollisions([turned, turnedProbe(inEmptyCorner)], [])).toEqual([]);
    expect(codesFor([turned, turnedProbe(onTheSpine)])).toContain("PART_BODY_COLLISION");
  });
});
