import { lxfmlPoseInLdrawConvention, parseLxfml } from "./index.ts";

/**
 * A synthetic model and its LDraw export, generated from one known frame per
 * design, so the pairing check can be proved on both a faithful export and a
 * shifted one. Bound: five designs and eight bricks; the check's arithmetic,
 * not the official file, is under test.
 */
const YAW = "0,0,-1,0,1,0,1,0,0";
const IDENTITY = "1,0,0,0,1,0,0,0,1";
interface FixtureBrick {
  readonly uuid: string;
  readonly design: string;
  readonly material: string;
  readonly rotation: string;
  readonly at: readonly [number, number, number];
  readonly parts?: number;
}
const BRICKS: readonly FixtureBrick[] = [
  { uuid: "p1", design: "3024;N", material: "26", rotation: IDENTITY, at: [0, 0, 0] },
  { uuid: "p2", design: "3024;N", material: "26", rotation: YAW, at: [0.8, 0.32, 0] },
  { uuid: "t1", design: "3023;S", material: "1", rotation: IDENTITY, at: [1.6, 0, 0.8] },
  { uuid: "p3", design: "3024;N", material: "26", rotation: IDENTITY, at: [-0.8, 0, 0] },
  { uuid: "t2", design: "3023;S", material: "1", rotation: YAW, at: [2.4, 0.32, 0.8] },
  { uuid: "b1", design: "3001;A", material: "5", rotation: IDENTITY, at: [0, 0.96, 0] },
  { uuid: "c1", design: "973;K", material: "5", rotation: IDENTITY, at: [4, 0, 0], parts: 2 },
  { uuid: "p4", design: "3024;N", material: "26", rotation: YAW, at: [0.8, 0.64, 0.8] },
];
/** The LXFML-to-LDraw frame the "exporter" applies per design: turn and origin. */
export const FRAMES: Readonly<Record<string, { turn: number[]; origin: number[]; file: string }>> =
  {
    "3024;N": { turn: [1, 0, 0, 0, 1, 0, 0, 0, 1], origin: [-10, 8, 0], file: "3024.dat" },
    "3023;S": { turn: [-1, 0, 0, 0, 1, 0, 0, 0, -1], origin: [10, 8, -10], file: "3023.dat" },
    "3001;A": { turn: [0, 0, 1, 0, 1, 0, -1, 0, 0], origin: [30, 24, -10], file: "3001.dat" },
  };
const COLOR: Readonly<Record<string, number>> = { "26": 0, "1": 15, "5": 4 };

const bone = (brick: FixtureBrick) =>
  `<Bone refID="0" transformation="${brick.rotation},${brick.at.join(",")}"/>`;
const part = (brick: FixtureBrick) =>
  `<Part designID="${brick.design}" materials="${brick.material}">${bone(brick)}</Part>`;
export const LXFML = `<LXFML versionMajor="8"><Bricks>${BRICKS.map(
  (brick) =>
    `<Brick uuid="${brick.uuid}" designID="${brick.design}">${part(brick).repeat(brick.parts ?? 1)}</Brick>`,
).join("")}</Bricks></LXFML>`;

const multiply = (a: readonly number[], b: readonly number[]) =>
  Array.from({ length: 9 }, (_, i) =>
    [0, 1, 2].reduce((t, k) => t + a[Math.floor(i / 3) * 3 + k]! * b[k * 3 + (i % 3)]!, 0),
  );
const transpose = (m: readonly number[]) => [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => m[i]!);
const rotate = (m: readonly number[], v: readonly number[]) =>
  [0, 1, 2].map((r) => m[r * 3]! * v[0]! + m[r * 3 + 1]! * v[1]! + m[r * 3 + 2]! * v[2]!);

/** One type-1 row per single-part brick, placed through its design's frame. */
export function exportRows(): string[] {
  const model = parseLxfml(LXFML, "fixture");
  return model.bricks
    .filter((brick) => brick.parts.length === 1)
    .map((brick) => {
      const frame = FRAMES[brick.designRevision]!;
      const pose = lxfmlPoseInLdrawConvention(brick.parts[0]!);
      const matrix = multiply(pose.matrix, transpose(frame.turn));
      const offset = rotate(matrix, frame.origin);
      const position = pose.positionLdu.map((value, axis) => value - offset[axis]!);
      const clean = (values: number[]) => values.map((value) => Math.round(value * 1e6) / 1e6 + 0);
      return `1 ${COLOR[brick.materialId]} ${clean(position).join(" ")} ${clean(matrix).join(" ")} ${frame.file}`;
    });
}
export const exportText = (rows: readonly string[]) =>
  [
    "0 FILE main.ldr",
    ...rows,
    "1 16 80 0 0 1 0 0 0 1 0 0 0 1 torso.ldr",
    "0 FILE torso.ldr",
    "1 4 0 0 0 1 0 0 0 1 0 0 0 1 973.dat",
  ].join("\n");
