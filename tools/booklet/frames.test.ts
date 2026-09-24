import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getPartDefinition } from "@lego-studio/catalog";

import { describeWithRunEvidence } from "../../scripts/run-evidence-gate.mjs";
import {
  lxfmlPoseInLdrawConvention,
  parseLxfml,
  type AnswerKey,
  type ExportDesignFrame,
} from "./answer-key/index.ts";
import { checkExportFrames, correctedPoses } from "./export-frames.ts";
import { checkCatalogFramesAgainstRegistry, isCatalogSelfMotion } from "./frame-checks.ts";
import { FRAME_PINS_DEFAULT_PATH, loadFramePins, parseFramePins } from "./frame-pins.ts";
import { mainCheckoutRoot } from "./inputs.ts";
import {
  DEFAULT_MEASURED_FRAMES_PATH,
  parseMeasuredFrames,
  type MeasuredFrame,
} from "./ldraw-frames.ts";
import { catalogFrameFor, officialPoseToCatalog } from "./playback-pose.ts";

/**
 * Frames that are not the identity: the LDraw-to-catalog frame playback uses,
 * the checks on it, and the export-frame check against the pinned Builder
 * frames. Bound: real catalog parts and the repository's real pins file; the
 * official export is replaced by hand-written design frames, and the
 * first-50 registry by a hand-written one, except in the last suite, which
 * reads the real registry and runs only with LEGO_RUN_EVIDENCE=1.
 */
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const yaw = (degrees: 0 | 90 | 180 | 270) =>
  ({
    0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
    270: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  })[degrees];
const row = (
  catalogPartId: string,
  orientationId: string,
  translationLdu: [number, number, number] = [0, -4, 0],
): MeasuredFrame => ({ catalogPartId, orientationId, translationLdu });

describe("LDraw-to-catalog frames", () => {
  it("takes a parametric part's turn and offset from its measured catalog LDraw frame", () => {
    // LDraw runs a 2 x 4 plate's long side along x with the origin on its top face;
    // the catalog runs it along z with the origin at the body centre.
    expect(catalogFrameFor("builtin:plate-2x4")).toEqual({
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
      basis: "measured-ldraw-frame",
    });
    expect(
      officialPoseToCatalog("builtin:plate-2x4", { matrix: yaw(90), positionLdu: [20, -8, 40] }),
    ).toMatchObject({
      ok: true,
      transform: { orientationId: "upright-yaw-0", positionLdu: [20, -4, 40] },
      frameBasis: "measured-ldraw-frame",
    });
    // The 2 x 14 plate once lost its top-face offset along with its declared turn.
    expect(
      officialPoseToCatalog("builtin:plate-2x14", { matrix: yaw(0), positionLdu: [0, 0, 0] }),
    ).toMatchObject({
      ok: true,
      transform: { orientationId: "upright-yaw-270", positionLdu: [0, 4, 0] },
    });
  });

  it("takes a mesh part's frame from its asset frame, offset off the vertical axis included", () => {
    // LDraw 3040 (1 x 2 slope) puts its origin 12 LDU up and 10 LDU along z from the catalog origin.
    expect(catalogFrameFor("builtin:slope-1x2-45")).toEqual({
      orientationId: "upright-yaw-0",
      translationLdu: [0, -12, 10],
      basis: "mesh-asset-frame",
    });
    expect(
      officialPoseToCatalog("builtin:slope-1x2-45", { matrix: yaw(180), positionLdu: [0, 0, 0] }),
    ).toMatchObject({
      ok: true,
      transform: { orientationId: "upright-yaw-180", positionLdu: [0, 12, 10] },
      frameBasis: "mesh-asset-frame",
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

  it("compares the catalog frames with a registry: agreement, symmetry, disagreement, unknown part", () => {
    const check = checkCatalogFramesAgainstRegistry(
      "registry.json",
      new Map([
        // The catalog's own frame, row for row.
        ["3020.dat", row("builtin:plate-2x4", "upright-yaw-90")],
        // A quarter turn off the catalog's upright-yaw-0, which a 2 x 2 plate cannot tell.
        ["3022.dat", row("builtin:plate-2x2", "upright-yaw-90")],
        // The catalog's turn without its top-face offset: the plate lands 4 LDU off.
        ["3024.dat", row("builtin:plate-1x1", "upright-yaw-0", [0, 0, 0])],
        ["99999.dat", row("builtin:no-such-part", "upright-yaw-0")],
      ]),
    );
    expect(check).toEqual({
      path: "registry.json",
      rows: 4,
      agree: 1,
      equivalentBySymmetry: 1,
      unknownParts: ["99999.dat builtin:no-such-part"],
      disagreements: [
        {
          ldrawFilename: "3024.dat",
          catalogPartId: "builtin:plate-1x1",
          registry: { orientationId: "upright-yaw-0", translationLdu: [0, 0, 0] },
          catalog: { orientationId: "upright-yaw-0", translationLdu: [0, -4, 0] },
        },
      ],
    });
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
      catalogPartFor,
    });
    expect(check.corrections).toEqual([]);
    expect(check.staleCorrections[0]).toMatch(/80015: the export now shows origin \(30, 8, -30\)/u);
  });

  it("turns 41682's frame so its flange is the ledge the booklet draws, under a side stud", () => {
    // Bound: the reviewed 41682 row against the real catalog part; the export frame is hand-written.
    const bracket = "builtin:bracket-2x2-1x2-vertical-studs";
    const check = checkExportFrames({
      key: keyWith([frame("41682;H", "41682.dat", yaw(180), [10, 8, 10])]),
      pins,
      catalogPartFor: (filename) => (filename === "41682.dat" ? bracket : null),
    });
    expect(check.staleCorrections).toEqual([]);
    const correction = check.corrections.find(({ designId }) => designId === "41682")!;
    expect(correction.source).toBe("review");
    const to = correction.to;
    expect(to).toEqual({ turn: [-1, 0, 0, 0, 0, 1, 0, 1, 0], originLdu: [10, -10, 4] });
    // The premise reads the side stud's column along its normal, not a vertical column.
    expect(correction.premise).toMatch(
      /\(10, -10, 4\) is under builtin:bracket-2x2-1x2-vertical-studs stud:1; the export's \(10, 8, 10\) is under no catalog stud/u,
    );
    // LXFML "up" (LDraw -y) lands on the flange studs' normal, and the origin sits one plate
    // (8 LDU) below a stud along it: the relation a 1 x 2 plate's LXFML origin has with its stud.
    const up = [0, 1, 2].map((r) => -to.turn[r * 3 + 1]! + 0);
    const frame41682 = catalogFrameFor(bracket);
    const studs = getPartDefinition(bracket)!.connectors.filter(({ kind }) => kind === "stud");
    expect(studs.map(({ normal }) => normal)).toEqual([up, up]);
    const seat = studs[1]!.positionLdu.map(
      (value, axis) => value - frame41682.translationLdu[axis]!,
    );
    expect(seat.map((value, axis) => value - to.originLdu[axis]!)).toEqual(up.map((u) => u * 8));
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

/**
 * The catalog frames against the real first-50 frame registry, the ignored
 * file playback read its frames from before they became catalog truth. Bound:
 * the registry covers only the 66 LDraw files of the first 50 printed steps,
 * so a catalog part that first appears later is not checked here. Its file
 * name carries the sha256 of its bytes, which the test checks before trusting
 * a row. It is read from the main checkout, since a worktree has no output/.
 */
describeWithRunEvidence(
  `reads the first-50 frame registry, the ignored ${DEFAULT_MEASURED_FRAMES_PATH} of the main checkout`,
)("catalog frames against the real first-50 frame registry", () => {
  it("places every registry row where the registry does, up to a symmetry of the part", () => {
    const path = resolve(mainCheckoutRoot(repositoryRoot), DEFAULT_MEASURED_FRAMES_PATH);
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch (error) {
      throw new Error(
        `LEGO_RUN_EVIDENCE=1 needs the first-50 frame registry at ${path}, which could not be read (${(error as Error).message}); restore that file, or unset LEGO_RUN_EVIDENCE to skip this comparison.`,
        { cause: error },
      );
    }
    const pinned = /-([0-9a-f]{64})\.json$/u.exec(DEFAULT_MEASURED_FRAMES_PATH)?.[1];
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(pinned);
    const frames = parseMeasuredFrames(bytes.toString("utf8"), path);
    const check = checkCatalogFramesAgainstRegistry(path, frames);
    expect(check.rows).toBe(66);
    expect(check.unknownParts).toEqual([]);
    expect(check.disagreements).toEqual([]);
    expect(check.agree + check.equivalentBySymmetry).toBe(check.rows);
  });
});
