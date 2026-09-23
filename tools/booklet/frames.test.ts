import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  lxfmlPoseInLdrawConvention,
  parseLxfml,
  type AnswerKey,
  type ExportDesignFrame,
} from "./answer-key/index.ts";
import { checkExportFrames, correctedPoses } from "./export-frames.ts";
import { checkFallbackAgainstRegistry, isCatalogSelfMotion } from "./frame-checks.ts";
import { FRAME_PINS_DEFAULT_PATH, loadFramePins, parseFramePins } from "./frame-pins.ts";
import type { MeasuredFrame } from "./ldraw-frames.ts";
import { catalogFrameFor, officialPoseToCatalog } from "./playback-pose.ts";

/**
 * Frames that are not the identity: the LDraw-to-catalog frame playback uses,
 * the checks on it, and the export-frame check against the pinned Builder
 * frames. Bound: real catalog parts and the repository's real pins file; the
 * official export is replaced by hand-written design frames.
 */
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const yaw = (degrees: 0 | 90 | 180 | 270) =>
  ({
    0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
    270: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  })[degrees];
const row = (catalogPartId: string, orientationId: string): MeasuredFrame => ({
  catalogPartId,
  orientationId,
  translationLdu: [0, -4, 0],
});

describe("LDraw-to-catalog frames", () => {
  it("keeps the top-face offset of a parametric part whose catalog declares a turn", () => {
    // The 2 x 14 plate declares upright-yaw-90; the offset used to be dropped with it.
    expect(catalogFrameFor("builtin:plate-2x14", "91988.dat", null)).toEqual({
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
      basis: "inferred-top-of-body",
    });
    const pose = officialPoseToCatalog(
      "builtin:plate-2x14",
      "91988.dat",
      { matrix: yaw(0), positionLdu: [0, 0, 0] },
      null,
    );
    expect(pose).toMatchObject({
      ok: true,
      transform: { orientationId: "upright-yaw-270", positionLdu: [0, 4, 0] },
    });
  });

  it("applies a measured turn and offset from the registry before any declaration", () => {
    const measured = new Map([["3020.dat", row("builtin:plate-2x4", "upright-yaw-90")]]);
    expect(catalogFrameFor("builtin:plate-2x4", "3020.dat", measured).basis).toBe("measured");
    const pose = officialPoseToCatalog(
      "builtin:plate-2x4",
      "3020.dat",
      { matrix: yaw(90), positionLdu: [20, -8, 40] },
      measured,
    );
    expect(pose).toMatchObject({
      ok: true,
      transform: { orientationId: "upright-yaw-0", positionLdu: [20, -4, 40] },
    });
  });

  it("tells a symmetry of the part from a motion that moves it", () => {
    const turn = (degrees: 90 | 180) => ({ matrix: yaw(degrees), translationLdu: [0, 0, 0] });
    expect(isCatalogSelfMotion("builtin:plate-2x2", turn(90))).toBe(true);
    expect(isCatalogSelfMotion("builtin:plate-2x4", turn(90))).toBe(false);
    expect(isCatalogSelfMotion("builtin:plate-2x4", turn(180))).toBe(true);
    expect(
      isCatalogSelfMotion("builtin:plate-1x1", { matrix: yaw(0), translationLdu: [20, 0, 0] }),
    ).toBe(false);
    expect(isCatalogSelfMotion("builtin:no-such-part", turn(90))).toBeNull();
  });

  it("measures the no-registry fallback against the registry's parametric rows", () => {
    const check = checkFallbackAgainstRegistry(
      new Map([
        ["3020.dat", row("builtin:plate-2x4", "upright-yaw-90")],
        ["3022.dat", row("builtin:plate-2x2", "upright-yaw-90")],
        ["3024.dat", row("builtin:plate-1x1", "upright-yaw-0")],
        ["91988.dat", row("builtin:plate-2x14", "upright-yaw-90")],
        ["77844.dat", row("builtin:corner-plate-3x3", "upright-yaw-0")],
      ]),
    );
    expect(check.parametricRows).toBe(4);
    expect(check.agree).toBe(2);
    expect(check.equivalentBySymmetry).toBe(1);
    expect(check.disagreements.map(({ ldrawFilename }) => ldrawFilename)).toEqual(["3020.dat"]);
  });
});

describe("export frame check", () => {
  const pins = loadFramePins(resolve(repositoryRoot, FRAME_PINS_DEFAULT_PATH));
  const frame = (
    designRevision: string,
    filename: string,
    turn: number[],
    originLdu: number[],
  ): ExportDesignFrame => ({
    designRevision,
    designId: designRevision.split(";")[0]!,
    filename,
    instances: 1,
    turn,
    originLdu,
    pairing: "single-instance",
  });
  const keyWith = (frames: ExportDesignFrame[]): AnswerKey =>
    ({
      ldraw: {
        status: "paired",
        pairing: { designFrames: new Map(frames.map((f) => [f.designRevision, f])) },
      },
      model: { bricks: [] },
    }) as unknown as AnswerKey;
  const catalogPartFor = (filename: string) =>
    ({
      "77844.dat": "builtin:corner-plate-3x3",
      "93273.dat": "builtin:curved-slope-1x4-double",
      "80015.dat": "builtin:corner-plate-5x5-quarter-ring",
    })[filename] ?? null;

  it("reproduces every pin's digest from the fields it reads, and flags a tampered one", () => {
    expect(pins.status).toBe("loaded");
    const loaded = pins.status === "loaded" ? pins.pins : [];
    expect(loaded.map(({ designId }) => designId)).toContain("77844");
    expect(loaded.every(({ digestVerified }) => digestVerified)).toBe(true);
    const text = `EXACT = "exact-lattice-correspondence"\n_PINS: tuple = (\n    (\n        "3001",\n        "A",\n        "${"a".repeat(64)}",\n        "turn0",\n        (0, 24, 0),\n        EXACT,\n        "${"b".repeat(64)}",\n    ),\n)\n`;
    expect(parseFramePins(text, "tampered.py")[0]!.digestVerified).toBe(false);
    expect(() => parseFramePins("PINS = ()\n", "empty.py")).toThrow(/has no "_PINS: .*" table/u);
  });

  it("reports agreement, symmetry and disagreement, and corrects only real disagreements", () => {
    const check = checkExportFrames({
      key: keyWith([
        frame("35480;K", "35480.dat", yaw(0), [-10, 8, 0]),
        frame("77844;B", "77844.dat", yaw(180), [20, 8, 20]),
        frame("93273;M", "93273.dat", yaw(90), [0, 0, 30]),
        frame("2877;F", "2877.dat", yaw(180), [10, 24, 0]),
        frame("80015;E", "80015.dat", yaw(90), [50, 8, -30]),
      ]),
      pins,
      measured: null,
      catalogPartFor,
    });
    const verdicts = Object.fromEntries(
      check.comparisons.map(({ designId, verdict }) => [designId, verdict]),
    );
    expect(verdicts).toEqual({
      "35480": "agrees",
      "77844": "disagrees",
      "93273": "equivalent by symmetry",
      "2877": "unusable pin",
    });
    expect(check.comparisons.find(({ designId }) => designId === "77844")!.catalogRecord).toBe(
      "matches the pin",
    );
    expect(check.corrections.map(({ designId, source, to }) => [designId, source, to])).toEqual([
      ["77844", "pin", { turn: yaw(180), originLdu: [40, 8, 0] }],
      ["80015", "review", { turn: yaw(90), originLdu: [-10, 8, -70] }],
    ]);
    expect(check.corrections[1]!.premise).toMatch(
      /\(-10, 8, -70\) is under builtin:corner-plate-5x5-quarter-ring stud:\S+; the export's \(50, 8, -30\) is under no catalog stud/u,
    );
    expect(check.staleCorrections).toEqual([]);
  });

  it("does not apply a reviewed correction once the export shows another frame", () => {
    const check = checkExportFrames({
      key: keyWith([frame("80015;E", "80015.dat", yaw(90), [30, 8, -30])]),
      pins,
      measured: null,
      catalogPartFor,
    });
    expect(check.corrections).toEqual([]);
    expect(check.staleCorrections[0]).toMatch(/80015: the export now shows origin \(30, 8, -30\)/u);
  });

  it("carries the LXFML pose through a corrected frame", () => {
    const model = parseLxfml(
      '<LXFML><Bricks><Brick uuid="r" designID="77844;B"><Part designID="77844;B" materials="1"><Bone refID="0" transformation="0,0,-1,0,1,0,1,0,0,1.6,0.32,-0.8"/></Part></Brick></Bricks></LXFML>',
      "one.lxfml",
    );
    const to = { turn: yaw(180), originLdu: [40, 8, 0] };
    const poses = correctedPoses({ model } as unknown as AnswerKey, [
      {
        designId: "77844",
        designRevision: "77844;B",
        filename: "77844.dat",
        source: "pin",
        why: "test",
        from: to,
        to,
      },
    ]);
    const pose = poses.get("r")!;
    const xml = lxfmlPoseInLdrawConvention(model.bricks[0]!.parts[0]!);
    // Back through the frame: row matrix * turn is the LXFML turn, and the LXFML origin lands where it was.
    const back = [0, 1, 2].map((r) =>
      [0, 1, 2].map((c) =>
        [0, 1, 2].reduce((t, k) => t + pose.matrix[r * 3 + k]! * to.turn[k * 3 + c]!, 0),
      ),
    );
    expect(back.flat().map((value) => value + 0)).toEqual(xml.matrix.map((value) => value + 0));
    const origin = [0, 1, 2].map(
      (r) =>
        pose.positionLdu[r]! +
        [0, 1, 2].reduce((t, k) => t + pose.matrix[r * 3 + k]! * to.originLdu[k]!, 0),
    );
    expect(origin.map((value) => Math.round(value * 1e6) / 1e6)).toEqual(
      xml.positionLdu.map((value) => Math.round(value * 1e6) / 1e6),
    );
  });
});
