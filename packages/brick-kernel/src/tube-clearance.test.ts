/**
 * "Err on the safe side" has a direction, and a legal fit that is nearly tangent reverses it.
 *
 * `collisions.ts` turns a body cylinder into a box and justifies it as the
 * conservative choice: a box claims corners a round part does not fill, so it
 * refuses a placement a real wheel would allow and never admits one it would
 * not. That is correct for a wheel, which stands alone. An underside tube does
 * not stand alone. It sits at the centre of a 2 x 2 block with four studs at the
 * corners, 10 * sqrt(2) = 14.142 LDU from its axis against a true radius sum of
 * 8 + 6 = 14 — a clearance of 0.142 LDU. Approximate the tube by its *bounding*
 * box and the box reaches 8 LDU along each axis, so its nearest point to a stud
 * centre is (10 - 8) * sqrt(2) = 2.83 LDU, well inside the stud's own 6, and
 * every exactly seated stack of two 2-wide parts reports
 * `PART_STUD_BODY_COLLISION` against its own tubes — with the connection
 * declared.
 *
 * The conservative direction was the broken one, because the legal configuration
 * is nearly tangent to the thing being approximated. An over-claiming
 * approximation does not fail safe; it refuses the real build.
 *
 * What replaces it is the largest axis-aligned box *inside* the tube circle:
 * half-side `outerRadius / sqrt(2)`, whose corners lie exactly on the circle in
 * the four diagonal directions the studs occupy. It gives up reach only along
 * the two axes, where the neighbouring tube 20 LDU away covers the gap.
 *
 * This file exists because the rest of the suite does not hold it. The seated
 * 1x1 stack in `validation.test.ts` is about the *cavity wall*, not the tube, and
 * a 1x1 brick has no tube at all; replacing the inscribed box with the bounding
 * box leaves that test green and moves only catalog hash pins, which name a
 * changed digest rather than a refused build.
 */

import { describe, expect, it } from "vitest";

import { BUILTIN_CATALOG } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { validateBrickDocument } from "./validation";

/** LDU. A stud is 12 LDU across, so 6 from its own axis. */
const STUD_RADIUS_LDU = 6;
/** LDU. Studs sit on a 20 LDU grid, so a tube axis is 10 in each plan axis from four of them. */
const HALF_PITCH_LDU = 10;

function stack(catalogPartId: string, dropLdu: number): BrickDocumentV1 {
  const parts: PartInstance[] = [
    createPartInstance({ id: "lower", catalogPartId }),
    createPartInstance({
      id: "upper",
      catalogPartId,
      colorId: "builtin:blue",
      transform: { positionLdu: [0, dropLdu, 0], orientationId: "upright-yaw-0" },
    }),
  ];
  const connections: ConnectionEdge[] = [
    {
      id: "seated",
      kind: "stud-tube",
      a: { partId: "lower", portId: "stud:0:0" },
      b: { partId: "upper", portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    },
  ];
  const base = createEmptyBrickDocument({ id: "tube-clearance", name: "Tube clearance" });
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
  };
}

describe("an underside tube approximated by a box", () => {
  it("leaves the four studs its own cell puts at its corners, which a bounding box does not", () => {
    // Derived from the lattice rather than read back off the constant that built
    // it: the box has to clear a stud standing half a pitch away in both plan
    // axes. A box of half-side h has its nearest point to that centre at
    // (10 - h) * sqrt(2), and that has to reach the stud's own 6 LDU.
    const clearance = (halfSideLdu: number) =>
      Math.SQRT2 * (HALF_PITCH_LDU - halfSideLdu) - STUD_RADIUS_LDU;

    let checked = 0;
    for (const part of BUILTIN_CATALOG.parts) {
      const tubes = (part.collision?.primitives ?? []).filter(({ id }) =>
        String(id).startsWith("tube:"),
      );
      for (const tube of tubes) {
        if (tube.kind !== "box") continue;
        const halfSideX = (tube.maxLdu[0] - tube.minLdu[0]) / 2;
        const halfSideZ = (tube.maxLdu[2] - tube.minLdu[2]) / 2;
        expect(halfSideX).toBeCloseTo(halfSideZ, 9);
        expect(
          clearance(halfSideX),
          `${part.id} ${String(tube.id)} half-side ${halfSideX} leaves ${clearance(halfSideX).toFixed(3)} LDU ` +
            "for a stud half a pitch away in both plan axes; a bounding box of the same tube leaves -3.17",
        ).toBeGreaterThan(0);
        checked += 1;
      }
    }
    // The corpus has to be non-empty or the loop above asserts nothing at all.
    expect(checked).toBeGreaterThan(20);
  });

  it("lets two 2-wide parts seat exactly on each other, connection declared", () => {
    // The build this refused. Both stacks are the plain legal case: one part on
    // another, on the lattice, with the stud/tube edge declared.
    for (const [catalogPartId, dropLdu] of [
      ["builtin:plate-2x2", -8],
      ["builtin:plate-2x4", -8],
      ["builtin:brick-2x4", -24],
    ] as const) {
      const codes = validateBrickDocument(stack(catalogPartId, dropLdu)).issues.map(
        ({ code }) => code,
      );
      expect(codes, `${catalogPartId} seated on itself`).not.toContain("PART_STUD_BODY_COLLISION");
    }
  });
});
