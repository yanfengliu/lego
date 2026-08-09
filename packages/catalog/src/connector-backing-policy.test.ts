import { describe, expect, it } from "vitest";

import { getPartDefinition } from "./catalog.ts";
import type { LduBounds, ParametricPartDefinition } from "./types.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import { makePartDefinition } from "./part-factory.ts";

/**
 * What a stud needs and what a clutch needs are opposites, and one predicate was
 * answering for both.
 *
 * `faceHoldsStud` asks whether a whole stud's footprint of a face is backed by
 * solid. That is right for a stud, which stands on the body. Put to an underside
 * it says a filled block accepts a clutch, which is exactly backwards: the stud
 * has nowhere to go. These cases pin the clutch side without touching the stud
 * side — every one of them would have passed identically before the cavity rule
 * existed except where noted, because the rule only ever adds an admission
 * route, never removes one.
 */

/** The measured `3020.dat` shell, in catalog frame. See the blueprint for every source line. */
const PLATE_2X4_SHELL: readonly LduBounds[] = [
  { min: [-20, -4, -40], max: [20, 0, 40] },
  { min: [-20, 0, -40], max: [-16, 4, 40] },
  { min: [16, 0, -40], max: [20, 4, 40] },
  { min: [-16, 0, -40], max: [16, 4, -36] },
  { min: [-16, 0, 36], max: [16, 4, 40] },
];

const shellBlueprint = (bodyBoxesLdu: readonly LduBounds[]): PartBlueprint => ({
  family: "plate",
  widthStuds: 2,
  lengthStuds: 4,
  ldrawId: "backing-probe.dat",
  geometrySha256: "0".repeat(64),
  bodyBoxesLdu,
});

const clutchCount = (blueprint: PartBlueprint): number =>
  makePartDefinition(blueprint).connectors.filter(({ kind }) => kind === "undersideClutch").length;

describe("underside clutch backing", () => {
  it("keeps every clutch on the shipped plate whose body is a real cavity", () => {
    const plate = getPartDefinition("builtin:plate-2x4") as ParametricPartDefinition | undefined;

    expect(plate).toBeDefined();
    expect(plate!.geometry.bodyMode).toBe("compound");
    expect(plate!.geometry.undersideMode).toBe("modelled-shell-cavity");
    expect(plate!.connectors.filter(({ kind }) => kind === "undersideClutch")).toHaveLength(8);
    expect(plate!.connectors.filter(({ kind }) => kind === "stud")).toHaveLength(8);
    // The cavity is the thing being admitted, so it has to be visible in the
    // solid the renderer draws from, not only in the connector list.
    expect(plate!.collision.primitives.filter(({ tag }) => tag === "body")).toHaveLength(5);
  });

  it("refuses a clutch whose cavity is too wide for anything to grip it", () => {
    // Walls 1 LDU thick instead of 4, so the cavity face sits 19 LDU from centre
    // and 9 LDU from each clutch — three LDU of daylight around a 6 LDU stud.
    // Nothing holds it, and with no solid bottom face to fall back on the clutch
    // is refused outright rather than admitted loose.
    const slack: readonly LduBounds[] = [
      { min: [-20, -4, -40], max: [20, 0, 40] },
      { min: [-20, 0, -40], max: [-19, 4, 40] },
      { min: [19, 0, -40], max: [20, 4, 40] },
      { min: [-19, 0, -40], max: [19, 4, -39] },
      { min: [-19, 0, 39], max: [19, 4, 40] },
    ];

    expect(clutchCount(shellBlueprint(slack))).toBe(0);
    expect(clutchCount(shellBlueprint(PLATE_2X4_SHELL))).toBe(8);
  });

  it("refuses the one clutch a hole in the ceiling would let a stud pass through", () => {
    // The same shell with the ceiling split around the cell at [-10, -30]: the
    // stud would enter, find a wall to grip, and then come out the top. A cavity
    // has a floor, and the seven cells that still have one keep their clutches.
    const ceilingWithAHole: readonly LduBounds[] = [
      { min: [-20, -4, -40], max: [-4, 0, -36] },
      { min: [-4, -4, -40], max: [20, 0, -36] },
      { min: [-20, -4, -36], max: [-16, 0, -24] },
      { min: [-4, -4, -36], max: [20, 0, -24] },
      { min: [-20, -4, -24], max: [20, 0, 40] },
      ...PLATE_2X4_SHELL.slice(1),
    ];

    expect(clutchCount(shellBlueprint(ceilingWithAHole))).toBe(7);
  });

  it("drops the modelled-cavity claim when the body fills its own cavity", () => {
    // A union that leaves no cavity is a filled block wearing five boxes. The
    // clutches survive, because solid backing is still the answer available to a
    // part that models no underside — but the part stops claiming it draws one,
    // and `part-standard.ts` goes back to reporting it. The mode is derived from
    // the geometry, so it cannot outrun what the body actually is.
    const filled: readonly LduBounds[] = [
      ...PLATE_2X4_SHELL,
      { min: [-16, 0, -36], max: [16, 4, 36] },
    ];
    const part = makePartDefinition(shellBlueprint(filled));

    expect(part.connectors.filter(({ kind }) => kind === "undersideClutch")).toHaveLength(8);
    expect(part.geometry.undersideMode).toBe("semantic-tube-seat-grid");
  });

  it("still demands solid behind a stud, which a wall alone does not give it", () => {
    // The stud side is untouched: a stud stands on the ceiling, and a cell the
    // ceiling does not reach has nothing to stand on however much wall surrounds
    // it. Declared stud offsets throw rather than silently vanishing.
    const ceilingShortOfOneStud: readonly LduBounds[] = [
      { min: [-20, -4, -24], max: [20, 0, 40] },
      ...PLATE_2X4_SHELL.slice(1),
    ];

    expect(() =>
      makePartDefinition({
        ...shellBlueprint(ceilingShortOfOneStud),
        studOffsetsLdu: [[-10, -30]],
      }),
    ).toThrow(/backing-probe\.dat stud 0 at \[-10, -30\] has no body backing/);
  });

  it("names the cavity, the face and the evidence when an explicit clutch is held by nothing", () => {
    expect(() =>
      makePartDefinition({
        ...shellBlueprint(PLATE_2X4_SHELL),
        clutchOffsetsLdu: [[0, 0]],
      }),
    ).toThrow(
      /underside clutch 0 at \[0, 0\] is held by nothing: .*no body box between y 0 and y 4 reaches the stud's own 6 LDU circle/,
    );
  });
});
