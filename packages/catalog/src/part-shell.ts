import { STUD_PITCH_LDU } from "./constants.ts";
import type { LduBounds, PartFamily } from "./types.ts";

/**
 * A part's underside, derived from the part's own footprint rather than authored.
 *
 * LDraw already models a brick, a plate and a tile as two nested `box5` solids —
 * "Box with 5 Faces", open on one side — with tubes standing in the gap. This
 * catalog had flattened all of that to one filled prism, which is a body no stud
 * can clutch into. Every number below was read off the official archive
 * `ldraw-complete-2026-07.zip`, sha256
 * 6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae, and none of
 * them was chosen.
 *
 * ## Wall and ceiling, 4 LDU each, in every family that has them
 *
 * | family        | file                 | outer                 | cavity                  |
 * |---------------|----------------------|-----------------------|-------------------------|
 * | plate         | `3020.dat` 30 / 21   | half 40 x 20, y 0..8  | half 36 x 16, y 4..8    |
 * | brick         | `s/3001s01.dat` 24   | half 40 x 20, y 0..24 | half 36 x 16, y 4..24   |
 * | tile          | `87079.dat`          | half 40 x 20, y 0..7  | half 36 x 16, y 4..8    |
 * | jumper-plate  | `87580.dat`          | half 20 x 20, y 0..7  | half 16 x 16, y 4..8    |
 * | grille-tile   | `2412b.dat`          | half 20 x 10, y 0..7  | half 16 x  6, y 4..8    |
 * | technic-brick | `3700.dat`           | half 20 x 10, y 0..24 | half 16 x  6, y 4..24   |
 * | corner-plate  | `2420.dat`           | L, -10..30, y 0..8    | the same L inset 4      |
 *
 * Every one of those cavities is the outer solid inset by exactly 4 LDU on both
 * horizontal axes, starting 4 LDU below the top face. The two numbers do not
 * vary with the part's size, its height or its family: the same 4 and 4 hold for
 * a 1 x 1 plate and for an 8 x 16 one, for a plate 8 LDU tall and a brick 24.
 * What does vary is the cavity's depth, which is whatever is left: 4 LDU for a
 * plate, 20 for a brick.
 *
 * The corner plate is why this is an erosion and not a rectangle. `2420.dat`
 * models an L, and its cavity is that L inset 4 LDU from its own boundary —
 * including at the reflex corner, where a naive per-box inset would be wrong.
 * Eroding the footprint by a 4 LDU square reproduces `2420.dat`'s three cavity
 * boxes exactly, which is the check that the rule is the part's rule.
 *
 * ## Tubes
 *
 * `stud4.dat` ("Stud Tube Open") lines 18-25 build the tube as two coaxial
 * cylinders, radius 6 and radius 8, capped between them by `4-4ring3.dat`
 * scaled 2. It is placed by a transform whose y scale sets its height:
 * `3020.dat` line 16 scales it by -1 for a plate's 4 LDU cavity, `s/3001s01.dat`
 * line 20 by -5 for a brick's 20. So a tube spans exactly the cavity band.
 *
 * Their positions are a lattice fact, confirmed against `3031.dat` lines 16-24
 * (nine tubes at every combination of x and z in {-20, 0, 20}), `3020.dat`
 * (three), `3022.dat` (one), `87079.dat` (three), `91988.dat` (thirteen) and
 * `2420.dat` (none): a tube stands at the centre of every complete 2 x 2 block
 * of stud cells, and nowhere else.
 *
 * A one-wide part has no such block and gets `stud3.dat` instead — a solid pin
 * of radius 4 (`stud3.dat` lines 17-20) at the midpoint between adjacent cells.
 * Those are deliberately NOT emitted. No clutch depends on one: a one-wide
 * cavity's own walls stand exactly 6 LDU from every clutch centre, which is the
 * stud radius, so the walls already hold it. A pin would sit exactly 10 LDU from
 * that same centre and its radius 4 plus the stud's 6 is exactly 10, so it would
 * be tangent to every incoming stud — an exact-equality collision case bought
 * for no admission. Four of the six one-wide parts here omit the pin in the
 * source anyway (`15573`, `34103`, `2412b` replace it, `3700` shortens it), so
 * there is no uniform rule to emit even if it were wanted.
 */

/** Both horizontal axes, every family measured. See the table above. */
export const SHELL_WALL_THICKNESS_LDU = 4;
/** The solid between the top face and the cavity. See the table above. */
export const SHELL_CEILING_THICKNESS_LDU = 4;
/** `stud4.dat` line 24: `4-4cyli.dat` scaled 8. */
export const TUBE_OUTER_RADIUS_LDU = 8;
/** `stud4.dat` line 23: `4-4cyli.dat` scaled 6, which is the stud radius exactly. */
export const TUBE_INNER_RADIUS_LDU = 6;

/**
 * Families whose shell was measured out of their own LDraw files.
 *
 * A family absent here whose body would otherwise qualify makes `deriveShellBody`
 * throw rather than inherit a plate's numbers. That is the point: a wedge plate's
 * wall may well be 4 LDU too, but nobody has read it off `41770a.dat`, and a
 * shell built from plausible numbers is the same error as a prism built from
 * none — it just looks more like a part.
 */
const MEASURED_SHELL_FAMILIES: ReadonlySet<PartFamily> = new Set<PartFamily>([
  "brick",
  "plate",
  "tile",
  "grille-tile",
  "jumper-plate",
  "technic-brick",
  "corner-plate",
]);

export interface DerivedShell {
  /** Ceiling slab and perimeter walls, disjoint, in ascending y then x then z. */
  readonly bodyBoxesLdu: readonly LduBounds[];
  /** Tube axes, at the centre of every complete 2 x 2 block of stud cells. */
  readonly tubeCentersXZLdu: readonly (readonly [x: number, z: number])[];
}

const EPSILON = 1e-9;

const uniqueSorted = (values: readonly number[]): number[] => {
  const out: number[] = [];
  for (const value of [...values].sort((left, right) => left - right)) {
    if (out.length === 0 || Math.abs(value - out[out.length - 1]!) > EPSILON) out.push(value);
  }
  return out;
};

const containsPoint = (boxes: readonly LduBounds[], x: number, z: number): boolean =>
  boxes.some(
    ({ min, max }) =>
      x > min[0] + EPSILON && x < max[0] - EPSILON && z > min[2] + EPSILON && z < max[2] - EPSILON,
  );

/**
 * Whether a closed rectangle lies wholly inside the footprint union.
 *
 * Exact rather than sampled: the footprint's own edges are cut into the test
 * rectangle, so every sub-rectangle is entirely in or entirely out and its
 * centre decides it.
 */
const rectangleInsideFootprint = (
  boxes: readonly LduBounds[],
  edgesX: readonly number[],
  edgesZ: readonly number[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean => {
  const xs = uniqueSorted([
    minX,
    maxX,
    ...edgesX.filter((edge) => edge > minX + EPSILON && edge < maxX - EPSILON),
  ]);
  const zs = uniqueSorted([
    minZ,
    maxZ,
    ...edgesZ.filter((edge) => edge > minZ + EPSILON && edge < maxZ - EPSILON),
  ]);
  for (let xi = 0; xi + 1 < xs.length; xi += 1) {
    for (let zi = 0; zi + 1 < zs.length; zi += 1) {
      if (!containsPoint(boxes, (xs[xi]! + xs[xi + 1]!) / 2, (zs[zi]! + zs[zi + 1]!) / 2)) {
        return false;
      }
    }
  }
  return true;
};

/** Consecutive true cells of one row, as merged index spans. */
const runsOf = (row: readonly boolean[]): readonly (readonly [number, number])[] => {
  const runs: [number, number][] = [];
  for (let index = 0; index < row.length; index += 1) {
    if (!row[index]) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else runs.push([index, index + 1]);
  }
  return runs;
};

const sameRuns = (
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
): boolean =>
  left.length === right.length &&
  left.every((run, index) => run[0] === right[index]![0] && run[1] === right[index]![1]);

/** One layer's solid cells merged into the fewest axis-aligned rectangles. */
const mergeLayer = (
  solid: readonly (readonly boolean[])[],
  xs: readonly number[],
  zs: readonly number[],
): readonly (readonly [number, number, number, number])[] => {
  const rows = solid.map(runsOf);
  const rectangles: [number, number, number, number][] = [];
  for (let xi = 0; xi < rows.length; xi += 1) {
    const runs = rows[xi]!;
    if (runs.length === 0) continue;
    let end = xi + 1;
    while (end < rows.length && sameRuns(rows[end]!, runs)) end += 1;
    for (const [zStart, zEnd] of runs) {
      rectangles.push([xs[xi]!, xs[end]!, zs[zStart]!, zs[zEnd]!]);
    }
    for (let skipped = xi + 1; skipped < end; skipped += 1) rows[skipped] = [];
    xi = end - 1;
  }
  return rectangles;
};

export interface ShellInput {
  readonly ldrawId: string;
  readonly family: PartFamily;
  /** The solid the part would be if it were filled, as disjoint boxes. */
  readonly footprintBoxes: readonly LduBounds[];
  readonly topY: number;
  readonly bottomY: number;
  /** Stud-cell centres, the same lattice the connector builder walks. */
  readonly cellCentersXZLdu: readonly (readonly [x: number, z: number])[];
}

/**
 * The shell a filled footprint becomes, or `undefined` when the footprint is not
 * a right prism of uniform height.
 *
 * The uniform-height test is what keeps an arch, a curved slope and a cheese
 * slope out. Their bodies are staircases whose boxes each stop at a different
 * height, so "the bottom of the part" is not one plane and the cavity depth
 * measured off `3020.dat` says nothing about them. They keep their filled
 * staircases and stay on the `underside-is-drawn` list until someone measures
 * their own cavities.
 */
export function deriveShellBody(input: ShellInput): DerivedShell | undefined {
  const { ldrawId, family, footprintBoxes, topY, bottomY, cellCentersXZLdu } = input;
  if (footprintBoxes.length === 0) return undefined;
  const uniformHeight = footprintBoxes.every(
    ({ min, max }) => Math.abs(min[1] - topY) <= EPSILON && Math.abs(max[1] - bottomY) <= EPSILON,
  );
  if (!uniformHeight) return undefined;
  const height = bottomY - topY;
  if (height <= SHELL_CEILING_THICKNESS_LDU + EPSILON) return undefined;
  if (!MEASURED_SHELL_FAMILIES.has(family)) {
    throw new Error(
      `${ldrawId} is a ${family} whose body is a uniform-height prism with underside clutches, so it wants the shell every such part gets — but no ${family} has had its wall thickness, ceiling thickness or tube lattice read off its own LDraw file. Measure one and add ${family} to MEASURED_SHELL_FAMILIES in part-shell.ts, or leave the family filled; do not let it inherit a plate's numbers.`,
    );
  }

  const wall = SHELL_WALL_THICKNESS_LDU;
  const edgesX = uniqueSorted(footprintBoxes.flatMap(({ min, max }) => [min[0], max[0]]));
  const edgesZ = uniqueSorted(footprintBoxes.flatMap(({ min, max }) => [min[2], max[2]]));
  const minX = edgesX[0]!;
  const maxX = edgesX[edgesX.length - 1]!;
  const minZ = edgesZ[0]!;
  const maxZ = edgesZ[edgesZ.length - 1]!;
  const withinX = (value: number): boolean => value > minX + EPSILON && value < maxX - EPSILON;
  const withinZ = (value: number): boolean => value > minZ + EPSILON && value < maxZ - EPSILON;
  // The eroded region's boundary can only fall on a footprint edge moved by the
  // wall thickness, so a grid built from those coordinates resolves it exactly.
  const xs = uniqueSorted([
    minX,
    maxX,
    ...edgesX.flatMap((edge) => [edge, edge - wall, edge + wall]).filter(withinX),
  ]);
  const zs = uniqueSorted([
    minZ,
    maxZ,
    ...edgesZ.flatMap((edge) => [edge, edge - wall, edge + wall]).filter(withinZ),
  ]);

  const solidCell: boolean[][] = [];
  const cavityCell: boolean[][] = [];
  for (let xi = 0; xi + 1 < xs.length; xi += 1) {
    const solidRow: boolean[] = [];
    const cavityRow: boolean[] = [];
    const centerX = (xs[xi]! + xs[xi + 1]!) / 2;
    for (let zi = 0; zi + 1 < zs.length; zi += 1) {
      const centerZ = (zs[zi]! + zs[zi + 1]!) / 2;
      const inside = containsPoint(footprintBoxes, centerX, centerZ);
      solidRow.push(inside);
      cavityRow.push(
        inside &&
          rectangleInsideFootprint(
            footprintBoxes,
            edgesX,
            edgesZ,
            centerX - wall,
            centerX + wall,
            centerZ - wall,
            centerZ + wall,
          ),
      );
    }
    solidCell.push(solidRow);
    cavityCell.push(cavityRow);
  }
  if (!cavityCell.some((row) => row.some(Boolean))) return undefined;

  const ceilingY = topY + SHELL_CEILING_THICKNESS_LDU;
  const wallCell = solidCell.map((row, xi) =>
    row.map((solid, zi) => solid && !cavityCell[xi]![zi]!),
  );
  const boxes: LduBounds[] = [
    ...mergeLayer(solidCell, xs, zs).map(([x0, x1, z0, z1]): LduBounds => ({
      min: [x0, topY, z0],
      max: [x1, ceilingY, z1],
    })),
    ...mergeLayer(wallCell, xs, zs).map(([x0, x1, z0, z1]): LduBounds => ({
      min: [x0, ceilingY, z0],
      max: [x1, bottomY, z1],
    })),
  ];

  const present = new Set(
    cellCentersXZLdu
      .filter(([x, z]) => containsPoint(footprintBoxes, x, z))
      .map(([x, z]) => `${x},${z}`),
  );
  const half = STUD_PITCH_LDU / 2;
  const blockCenters: [number, number][] = [];
  for (const [x, z] of cellCentersXZLdu) {
    const complete =
      present.has(`${x},${z}`) &&
      present.has(`${x + STUD_PITCH_LDU},${z}`) &&
      present.has(`${x},${z + STUD_PITCH_LDU}`) &&
      present.has(`${x + STUD_PITCH_LDU},${z + STUD_PITCH_LDU}`);
    if (complete) blockCenters.push([x + half, z + half]);
  }
  blockCenters.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  for (const [x, z] of blockCenters) {
    const clear = xs.every((_, xi) => {
      if (xi + 1 >= xs.length) return true;
      if (xs[xi + 1]! <= x - TUBE_OUTER_RADIUS_LDU || xs[xi]! >= x + TUBE_OUTER_RADIUS_LDU) {
        return true;
      }
      return zs.every((__, zi) => {
        if (zi + 1 >= zs.length) return true;
        if (zs[zi + 1]! <= z - TUBE_OUTER_RADIUS_LDU || zs[zi]! >= z + TUBE_OUTER_RADIUS_LDU) {
          return true;
        }
        return cavityCell[xi]![zi]!;
      });
    });
    if (!clear) {
      throw new Error(
        `${ldrawId} wants an underside tube at [${x}, ${z}] because four stud cells meet there, but a ${TUBE_OUTER_RADIUS_LDU} LDU tube does not fit inside the cavity at that point. Either the footprint is not the one the stud lattice describes, or this part is not a plain shell.`,
      );
    }
  }

  return { bodyBoxesLdu: boxes, tubeCentersXZLdu: blockCenters };
}
