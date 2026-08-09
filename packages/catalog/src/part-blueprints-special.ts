import type { LduBounds } from "./types.ts";

import { BRICK_HEIGHT_LDU } from "./constants.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";

/** Two thirds of a brick, which is what "1 x 1 x 0.667" names in LDraw 54200. */
export const CHEESE_SLOPE_HEIGHT_LDU = 16;

/**
 * A face that falls away along the part's length, as a staircase of boxes.
 *
 * The collision primitives here are prisms cut by *vertical* planes, so a wedge
 * plate's taper — which is a shape in plan — is one primitive, while a slope or
 * an arch — which is a shape in elevation — cannot be any primitive at all. It
 * becomes a run of boxes instead.
 *
 * Each span is `[from, to, thickness]` measured off the part's own LDraw file by
 * ray-casting its solid, with the thickness taken at the tallest point of the
 * real profile within the span. The union therefore contains the real part:
 * where it is wrong it claims material the part does not have, which refuses a
 * placement the real part would allow and never admits one it would not.
 *
 * `anchor` says which face the material grows from — a slope stands on its base,
 * an arch hangs from its flat top.
 */
const profileBoxes = (
  axis: "x" | "z",
  anchor: "top" | "bottom",
  heightLdu: number,
  halfCrossLdu: number,
  spansLdu: readonly (readonly [from: number, to: number, thicknessLdu: number])[],
): readonly LduBounds[] =>
  spansLdu.map(([from, to, thickness]) => {
    const topY = -heightLdu / 2;
    const bottomY = heightLdu / 2;
    const minY = anchor === "top" ? topY : bottomY - thickness;
    const maxY = anchor === "top" ? topY + thickness : bottomY;
    return axis === "z"
      ? { min: [-halfCrossLdu, minY, from], max: [halfCrossLdu, maxY, to] }
      : { min: [from, minY, -halfCrossLdu], max: [to, maxY, halfCrossLdu] };
  });

export const SPECIAL_PART_BLUEPRINTS = [
  {
    family: "jumper-plate",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "15573.dat",
    studOffsetsLdu: [[0, 0]],
    geometrySha256: "f1194823c1b2f75857734defca68c3fafac359b76a1ae904f530daa54d98e297",
  },
  {
    family: "jumper-plate",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "87580.dat",
    studOffsetsLdu: [[0, 0]],
    geometrySha256: "2f1a9bcb317519da457672390c0ec10e9aa5decaaa3f95def4930cbf7f3b66e4",
  },
  {
    family: "jumper-plate",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "34103.dat",
    // "Offset" in the part's name: the two studs sit half a pitch off the cell
    // grid, at the boundaries between cells, not on the outer cells.
    studOffsetsLdu: [
      [0, -10],
      [0, 10],
    ],
    geometrySha256: "37850bee42344ff3151059ea5e7553dd269b5eea55b07fbf11ce6120e962cb52",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 4,
    variant: "left",
    ldrawId: "41770a.dat",
    studOffsetsLdu: [
      [-10, -30],
      [-10, -10],
      [-10, 10],
      [-10, 30],
    ],
    bodyWedge: { cutNormalXZ: [4, -1], cutOffsetLdu: 40 },
    geometrySha256: "f0a7d07de1e70ebcfafc25609a2f4859eeb5e060452fcf5ffcfca448a50e936a",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 4,
    variant: "right",
    ldrawId: "41769a.dat",
    studOffsetsLdu: [
      [10, -30],
      [10, -10],
      [10, 10],
      [10, 30],
    ],
    bodyWedge: { cutNormalXZ: [-4, -1], cutOffsetLdu: 40 },
    geometrySha256: "01fe4912925c0adad52815bd1ff44c447e0f0ef47191ae2ccc6d993c8ddde9fc",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 3,
    variant: "left",
    ldrawId: "43723a.dat",
    studOffsetsLdu: [
      [-10, -20],
      [-10, 0],
      [-10, 20],
    ],
    bodyWedge: { cutNormalXZ: [3, -1], cutOffsetLdu: 30 },
    geometrySha256: "07f5e2351292bbc7779a5b0a6080e3d4da241c365ddcaceff3f86805be3d96f0",
  },
  {
    family: "wedge-plate",
    widthStuds: 2,
    lengthStuds: 3,
    variant: "right",
    ldrawId: "43722a.dat",
    studOffsetsLdu: [
      [10, -20],
      [10, 0],
      [10, 20],
    ],
    bodyWedge: { cutNormalXZ: [-3, -1], cutOffsetLdu: 30 },
    geometrySha256: "bf94e0979d89b8e27d2c29ec02deb3730716fdad78177b20497504d1ee0f3d32",
  },
  {
    family: "technic-brick",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3700.dat",
    // A round hole straight through the 1-stud direction, its centre 10 LDU
    // below the brick's top — measured from the peghole placements in 3700.dat.
    // One port, not two: the hole is one feature open at both ends, which is
    // why an axle may enter it facing either way.
    extraConnectors: [
      {
        id: "pinHole:0",
        kind: "pinHole",
        positionLdu: [0, -2, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
    ],
    geometrySha256: "04478baf083a461df2165cb827901fe41d468f99446b8fbe396d616b9225523b",
  },
  {
    family: "axle",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "32062.dat",
    // 39 LDU long and 12 across, from 32062.dat. The cross section is modelled
    // as its bounding box, which claims a little more space than the real part
    // in the corners — the safe direction: it refuses placements a real axle
    // would allow, never the reverse.
    bodyBoundsLdu: { min: [-19.5, -6, -6], max: [19.5, 6, 6] },
    withoutClutches: true,
    // A port at each stud position along the shaft and one at its centre. The
    // centre one matters: a hole in the middle of a part meets an axle that is
    // itself centred, and without it a centred axle could not be threaded
    // through anything.
    extraConnectors: [
      {
        id: "axle:0",
        kind: "axle",
        positionLdu: [-10, 0, 0],
        normal: [-1, 0, 0],
        orientationId: "connector-up",
      },
      {
        id: "axle:1",
        kind: "axle",
        positionLdu: [0, 0, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
      {
        id: "axle:2",
        kind: "axle",
        positionLdu: [10, 0, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
    ],
    geometrySha256: "d1017c9dff28387133e4b75d67d4ffb7124d6f1ccdc9ce9fb9e9a5ac62b14120",
  },
  {
    family: "axle",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "3705.dat",
    // 79 LDU long, from 3705.dat. Long enough to carry a wheel at each end of a
    // four-stud-wide chassis, which a 2L axle is not.
    bodyBoundsLdu: { min: [-39.5, -6, -6], max: [39.5, 6, 6] },
    withoutClutches: true,
    extraConnectors: [
      {
        id: "axle:0",
        kind: "axle",
        positionLdu: [-30, 0, 0],
        normal: [-1, 0, 0],
        orientationId: "connector-up",
      },
      {
        id: "axle:1",
        kind: "axle",
        positionLdu: [-10, 0, 0],
        normal: [-1, 0, 0],
        orientationId: "connector-up",
      },
      {
        id: "axle:2",
        kind: "axle",
        positionLdu: [0, 0, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
      {
        id: "axle:3",
        kind: "axle",
        positionLdu: [10, 0, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
      {
        id: "axle:4",
        kind: "axle",
        positionLdu: [30, 0, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
    ],
    geometrySha256: "6a3fb7e10b1ed36546dd800252aa6854a75eec86c4feb120e70bfdf42acb535e",
  },
  {
    family: "wheel",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "3483.dat",
    // Rim and tyre as one part: 62 LDU across the tread and 18 wide, from
    // LDraw 3483. Its axis lies on x, matching the axle it rides.
    bodyBoundsLdu: { min: [-9, -31, -31], max: [9, 31, 31] },
    withoutClutches: true,
    extraConnectors: [
      {
        id: "axleHole:0",
        kind: "axleHole",
        positionLdu: [0, 0, 0],
        normal: [1, 0, 0],
        orientationId: "connector-up",
      },
    ],
    geometrySha256: "7f574aa2e1f6c0d08c0666c6bf6ca8231289252eb0f5378445bf341ced7d9e58",
  },
  {
    // Legs at the two ends, a flat studded top, and a curved void between. The
    // underside curve reaches the bottom of the brick at 20 LDU from the centre
    // and rises to 8 below the top at the apex, so the span is one plate thick
    // in the middle and the two outer cells are the only ones that clutch.
    family: "arch",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "3659.dat",
    bodyBoxesLdu: profileBoxes("z", "top", BRICK_HEIGHT_LDU, 10, [
      [-40, -15, 24],
      [-15, -10, 15.14],
      [-10, -5, 11.09],
      [-5, 5, 8.99],
      [5, 10, 11.09],
      [10, 15, 15.14],
      [15, 40, 24],
    ]),
    geometrySha256: "c474ed120aaf67bf2336264fc750be7e62e524c1e7f82a3df946f7955d912909",
  },
  {
    family: "arch",
    widthStuds: 1,
    lengthStuds: 6,
    ldrawId: "3455.dat",
    bodyBoxesLdu: profileBoxes("z", "top", BRICK_HEIGHT_LDU, 10, [
      [-60, -30, 24],
      [-30, -20, 16.58],
      [-20, -10, 11.74],
      [-10, 10, 8.98],
      [10, 20, 11.74],
      [20, 30, 16.58],
      [30, 60, 24],
    ]),
    geometrySha256: "373a2ddb213fc8aec48eeea485025b6fdb7d563e28ccfb3fdeca8c0c2f626030",
  },
  {
    // Two plates tall at the high end, falling to half a plate at the low one.
    // The family holds both heights, so this one names its own.
    family: "curved-slope",
    widthStuds: 1,
    lengthStuds: 2,
    ldrawId: "11477.dat",
    heightLdu: 16,
    bodyBoxesLdu: profileBoxes("z", "bottom", 16, 10, [
      [-20, -10, 9.68],
      [-10, 0, 13.29],
      [0, 10, 15.27],
      [10, 20, 16],
    ]),
    geometrySha256: "13e887e0b75936bd62cb9a052b11dc5d3bf57ea67a8d4eb9fae32a15978e27af",
  },
  {
    // Brick height at the high end, tapering to a knife edge at the low one.
    family: "curved-slope",
    widthStuds: 1,
    lengthStuds: 3,
    ldrawId: "50950.dat",
    bodyBoxesLdu: profileBoxes("z", "bottom", BRICK_HEIGHT_LDU, 10, [
      [-30, -20, 10.78],
      [-20, -10, 15.81],
      [-10, 0, 19.48],
      [0, 10, 21.99],
      [10, 20, 23.47],
      [20, 30, 24],
    ]),
    geometrySha256: "b4fd6c480cc6e975e8e33acd274de9f7db1abcdee1f8c39f9dd1a00468ae8644",
  },
  {
    family: "curved-slope",
    widthStuds: 1,
    lengthStuds: 4,
    ldrawId: "61678.dat",
    bodyBoxesLdu: profileBoxes("z", "bottom", BRICK_HEIGHT_LDU, 10, [
      [-40, -30, 8.6],
      [-30, -20, 13.03],
      [-20, -10, 16.19],
      [-10, 0, 19.17],
      [0, 10, 21.03],
      [10, 20, 22.77],
      [20, 40, 24],
    ]),
    geometrySha256: "9bd6e7c02731c89de78f0dd78d422ed3f9e16c818d91ac3d55b619784f01f5f5",
  },
  {
    // The cheese slope: a 31-degree ramp two plates tall at the back and four
    // LDU at the leading edge, which is thin but not a knife. The slope always
    // falls along z in this family, so a builder rotates rather than guesses.
    family: "cheese-slope",
    widthStuds: 1,
    lengthStuds: 1,
    ldrawId: "54200.dat",
    bodyBoxesLdu: profileBoxes("z", "bottom", CHEESE_SLOPE_HEIGHT_LDU, 10, [
      [-10, -5, 7.08],
      [-5, 0, 10.08],
      [0, 5, 13.08],
      [5, 10, 16],
    ]),
    geometrySha256: "3ffa15552ca1e7bc26df1ab76d31cf0819188eca9994832158d7a26002b19b00",
  },
  {
    family: "cheese-slope",
    widthStuds: 2,
    lengthStuds: 1,
    ldrawId: "85984.dat",
    bodyBoxesLdu: profileBoxes("z", "bottom", CHEESE_SLOPE_HEIGHT_LDU, 20, [
      [-10, -5, 7.08],
      [-5, 0, 10.08],
      [0, 5, 13.08],
      [5, 10, 16],
    ]),
    geometrySha256: "48e95c7a7d5fd6fddaf8a05b5ab0f9d0d2fc0eafe97233669cfa5f105b833d28",
  },
  {
    // An L: a 1x2 arm and a 1x1 beside it, with the fourth cell of the 2x2
    // footprint absent. Nothing declares which stud is missing — the body says
    // it, and the studs and clutches follow the body.
    family: "corner-plate",
    widthStuds: 2,
    lengthStuds: 2,
    ldrawId: "2420.dat",
    bodyBoxesLdu: [
      { min: [-20, -4, -20], max: [0, 4, 20] },
      { min: [0, -4, -20], max: [20, 4, 0] },
    ],
    geometrySha256: "b018ea8d170304bffbfbf431388bf7b863405a935c971898e9fa1d76f58e16ed",
  },
] as const satisfies readonly PartBlueprint[];
