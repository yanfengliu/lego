import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS } from "./catalog.ts";
import { meshClutchUndersides, meshUndersideIsDrawn } from "./mesh-underside.ts";
import type { LduBounds, LduVector3 } from "./types.ts";

/**
 * The eight mesh-first parts used to be the whole of `geometry-mode-is-declared`:
 * their recipe named no mode, so the standard could say nothing about what they
 * draw. What it says now is measured off the bundled surface, and these cases
 * pin both halves — that the measurement reports what the shipped meshes
 * actually contain, and that it can say no.
 */

/** One plate-shaped slab, as three triangles per face is enough to answer with. */
function slab(bounds: LduBounds, cavityCeilingY: number | null) {
  const { min, max } = bounds;
  const positions: number[] = [];
  const quad = (y: number, x0: number, x1: number, z0: number, z1: number) => {
    positions.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
  };
  // Top face, then the bottom: either the whole footprint, or a rim around a
  // cavity whose ceiling sits higher up.
  quad(min[1], min[0], max[0], min[2], max[2]);
  if (cavityCeilingY === null) {
    quad(max[1], min[0], max[0], min[2], max[2]);
  } else {
    const wall = 4;
    quad(max[1], min[0], min[0] + wall, min[2], max[2]);
    quad(max[1], max[0] - wall, max[0], min[2], max[2]);
    quad(max[1], min[0] + wall, max[0] - wall, min[2], min[2] + wall);
    quad(max[1], min[0] + wall, max[0] - wall, max[2] - wall, max[2]);
    quad(cavityCeilingY, min[0] + wall, max[0] - wall, min[2] + wall, max[2] - wall);
  }
  return {
    positionsLdu: positions,
    indices: null,
    groups: [{ role: "body" as const, triangleStart: 0, triangleCount: positions.length / 9 }],
    bodyBoundsLdu: bounds,
  };
}

const PLATE: LduBounds = { min: [-20, -4, -40], max: [20, 4, 40] };
const CLUTCH: LduVector3 = [-10, 4, -10];

describe("underside measured from a bundled mesh", () => {
  it("says no when the mesh is solid under its own clutch", () => {
    // The whole failure the standard exists to catch, as geometry: a slab with
    // one flat bottom face, declaring a clutch it has nowhere to put.
    const flat = { ...slab(PLATE, null), clutchSeatsLdu: [CLUTCH] };

    expect(meshClutchUndersides(flat)).toEqual(["flat"]);
    expect(meshUndersideIsDrawn(flat)).toBe(false);
  });

  it("says yes when the same slab is a shell, and reports the recess", () => {
    const shelled = { ...slab(PLATE, 0), clutchSeatsLdu: [CLUTCH] };

    expect(meshClutchUndersides(shelled)).toEqual(["recessed"]);
    expect(meshUndersideIsDrawn(shelled)).toBe(true);
  });

  it("reads a clutch the part is pierced at as open rather than as absent evidence", () => {
    // 35480's shape: the ceiling is there, and it is an annulus around a hole
    // that goes all the way through, so nothing at all stands over the clutch.
    const pierced = { ...slab(PLATE, 0), clutchSeatsLdu: [[100, 4, 100] as LduVector3] };

    expect(meshClutchUndersides(pierced)).toEqual(["open"]);
    expect(meshUndersideIsDrawn(pierced)).toBe(true);
  });

  it("makes no claim for a part that declares no clutch", () => {
    expect(meshUndersideIsDrawn({ ...slab(PLATE, 0), clutchSeatsLdu: [] })).toBe(false);
  });

  it("reports every shipped mesh part as drawing the underside it claims", () => {
    // Not a restatement of the code: these eight are bundled LDraw surfaces, and
    // LDraw models a plate's cavity, so the expected answer here is a fact about
    // the source rather than about the measurement. `35480` is the one that
    // reads `open` at both clutches, because its studs are open and the hole
    // runs through the part.
    const mesh = PART_DEFINITIONS.filter(
      (part) => part.geometry.generatorId === "builtin:preloaded-mesh-reference/1",
    );

    expect(mesh).toHaveLength(8);
    expect(
      mesh.map(({ id, geometry }) => [
        id,
        geometry.bodyMode,
        geometry.studMode,
        geometry.undersideMode,
      ]),
    ).toEqual([
      ["builtin:tile-1x2-cut-right-45", "bundled-source-mesh", "none", "modelled-shell-cavity"],
      [
        "builtin:plate-1x2-round-end",
        "bundled-source-mesh",
        "measured-stud-seats",
        "modelled-shell-cavity",
      ],
      [
        "builtin:wedge-plate-2x4-wing",
        "bundled-source-mesh",
        "measured-stud-seats",
        "modelled-shell-cavity",
      ],
      [
        "builtin:corner-plate-3x3",
        "bundled-source-mesh",
        "measured-stud-seats",
        "modelled-shell-cavity",
      ],
      ["builtin:curved-slope-1x4-double", "bundled-source-mesh", "none", "modelled-shell-cavity"],
      [
        "builtin:plate-3x3-corner-round",
        "bundled-source-mesh",
        "measured-stud-seats",
        "modelled-shell-cavity",
      ],
      [
        "builtin:wedge-plate-3x3-cut-corner",
        "bundled-source-mesh",
        "measured-stud-seats",
        "modelled-shell-cavity",
      ],
      [
        "builtin:corner-plate-2x2-round",
        "bundled-source-mesh",
        "measured-stud-seats",
        "modelled-shell-cavity",
      ],
    ]);
  });
});
