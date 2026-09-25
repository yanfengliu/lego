import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePlayerSteps, stepOfEachPart } from "../../apps/web/src/player/player-data.ts";
import type { PlayerInputPaths } from "../player/freshness.ts";
import type { PlayerSet } from "../player/sets.ts";
import type { AnswerKey, OfficialLdrawModel } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import type { FrameCorrection } from "./export-frames.ts";
import type { PlayerLibrary } from "./player-library.ts";
import {
  buildPlayerData,
  MODEL_SOURCE,
  openSubBuildTest,
  PlayerStageError,
  runPlayerStage,
} from "./player-stage.ts";

/** Stands in for the pinned 144 MB LDraw archive when set; otherwise the real opener runs. */
const archive = vi.hoisted(() => ({ fake: null as PlayerLibrary | null }));
vi.mock(import("./player-library.ts"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    openPlayerLibrary: (path: string) => archive.fake ?? actual.openPlayerLibrary(path),
  };
});

/**
 * Synthetic: five bricks over three printed steps. Every brick sits in one
 * wrapper sub-build W attached at the last unit (as 21066's LXFML wraps its
 * whole build), and brick "e" also in sub-build S, which no printed step
 * attaches. Brick "d" is a design no library holds.
 */
const SET: PlayerSet = {
  id: "fixture",
  name: "Synthetic fixture",
  booklet: "recipes/fixture.pdf",
  model: { source: "official-model", lxfml: "fixture.xml", ldraw: "fixture.ldr" },
  frameCorrections: [],
  meshFallback: "fixture-pack.json",
  output: "output/booklet/player/fixture",
  baseline: "status/fixture-baseline.json",
};

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const WRAPPER = { key: "W", attachUnit: 99 };

function brick(uuid: string, design: string, x: number) {
  return {
    row: 1,
    uuid,
    designId: design,
    designRevision: `${design};A`,
    itemNos: [],
    materialId: "1",
    parts: [
      { designRevision: `${design};A`, materialId: "1", transformation: [...IDENTITY, x, 0, 0] },
    ],
  };
}

function fixture(options: { unplaced?: boolean } = {}) {
  const bricks = [
    brick("a", "3001", 0),
    brick("b", "3024", 1),
    brick("c", "3024", 2),
    brick("d", "9999", 3),
    brick("e", "3001", 4),
    ...(options.unplaced ? [brick("z", "31510", 5)] : []),
  ];
  const levels = (uuid: string) =>
    uuid === "e" ? [WRAPPER, { key: "S", attachUnit: 50 }] : [WRAPPER];
  const key = {
    model: { bricks },
    brickByUuid: new Map(bricks.map((entry) => [entry.uuid, entry])),
    sequence: {
      placements: new Map(
        bricks.map((entry) => [entry.uuid, { unit: 0, levels: levels(entry.uuid), copyOf: null }]),
      ),
    },
    ldraw: {
      status: "paired",
      pairing: {
        byBrick: new Map(
          bricks.map((entry, index) => [
            entry.uuid,
            {
              filename: `${entry.designId}.dat`,
              colorCode: index === 1 ? 47 : 4,
              matrix: IDENTITY,
              positionLdu: [index * 20, 0, 0],
            },
          ]),
        ),
      },
    },
  } as unknown as AnswerKey;
  const align = {
    windows: [],
    unplaced: [],
    steps: [
      { step: 1, page: 3, verdict: "identity", bricks: ["a", "b"], unitEnd: 2 },
      { step: 2, page: 3, verdict: "count fallback", bricks: [], unitEnd: 3 },
      { step: 3, page: 4, verdict: "identity", bricks: ["c", "d", "e"], unitEnd: 4 },
    ],
  } as unknown as AlignStage;
  const official: OfficialLdrawModel = {
    mainFile: "main",
    files: new Map([["main", []]]),
    ignoredLines: 0,
  };
  return { key, align, official };
}

const LIBRARY: Record<string, string> = {
  "parts/3001.dat": "0 Brick 2 x 4\n0 !LDRAW_ORG Part\n3 16 0 0 0 1 0 0 0 1 0",
  "parts/3024.dat": "0 Plate 1 x 1\n0 !LDRAW_ORG Part\n3 16 0 0 0 1 0 0 0 1 0",
};
const COLOURS = "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333";

function build(
  overrides: { corrections?: FrameCorrection[]; set?: PlayerSet; unplaced?: boolean } = {},
) {
  const { key, align, official } = fixture(overrides);
  const asked: string[] = [];
  const data = buildPlayerData({
    set: overrides.set ?? SET,
    bookletPages: 4,
    key,
    official,
    align,
    corrections: overrides.corrections ?? [],
    library: { read: (path) => LIBRARY[path] ?? null },
    colours: COLOURS,
    standInFor: (design) => {
      asked.push(design);
      return design === "9999"
        ? "0 Stand-in\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 1 0 0 0 1 0"
        : null;
    },
  });
  return { data, asked };
}

/** The main model's part rows, in build order: the first section, before any embedded file. */
const partRows = (text: string) =>
  text
    .split("\n\n0 FILE ")[0]!
    .split("\n")
    .filter((line) => line.startsWith("1 "));

describe("buildPlayerData", () => {
  it("writes one steps.json entry per printed step, with its page, parts added, alignment and sub-build flag", () => {
    const { data } = build({ unplaced: true });
    expect(data.steps.set).toEqual({
      id: "fixture",
      name: "Synthetic fixture",
      bookletPages: 4,
      modelSource: "Reference build: LEGO's official model",
      partCount: 5,
      unplacedParts: 1,
    });
    expect(data.steps.steps).toEqual([
      { step: 1, page: 3, partsAdded: 2, alignment: "identity", subBuild: false },
      { step: 2, page: 3, partsAdded: 0, alignment: "count-fallback", subBuild: false },
      { step: 3, page: 4, partsAdded: 3, alignment: "identity", subBuild: true },
    ]);
    // The files agree with each other the way the player checks them.
    expect(stepOfEachPart(data.model.text, parsePlayerSteps(data.steps))).toEqual([1, 1, 3, 3, 3]);
  });

  it("keeps the short label for the 3D view and says how the steps were grouped in model.mpd's header", () => {
    const { data } = build({ unplaced: true });
    expect(MODEL_SOURCE).toBe("Reference build: LEGO's official model");
    const header = data.model.text.split("\n").filter((line) => line.startsWith("0 // "));
    expect(header.slice(0, 2)).toEqual([
      "0 // Reference build: LEGO's official model. Its parts keep their official poses; left out: 1 part no printed step places.",
      "0 // Grouped into printed steps by the booklet harness's alignment: identity for 2 steps, count fallback for 1 step.",
    ]);
  });

  it("keeps each export row's colour and pose, in build order", () => {
    const { data } = build();
    const rows = data.model.text.split("\n").filter((line) => line.startsWith("1 "));
    expect(rows.slice(0, 2)).toEqual([
      "1 4 0 0 0 1 0 0 0 1 0 0 0 1 parts/3001.dat",
      "1 47 20 0 0 1 0 0 0 1 0 0 0 1 parts/3024.dat",
    ]);
  });

  it("stands a Builder mesh in for a design no library holds, posed from the LXFML", () => {
    const { data, asked } = build();
    expect(asked).toEqual(["9999"]);
    expect(data.standIns).toEqual(new Map([["9999", 1]]));
    // LXFML x = 3 units = 75 LDU; the export row's own position (60) is not used.
    expect(data.model.text).toContain("1 4 75 0 0 1 0 0 0 1 0 0 0 1 parts/builder/9999.dat");
    expect(data.model.text).toContain("0 FILE parts/builder/9999.dat");
  });

  it("poses a corrected design from its corrected frame, not its export row, and counts the parts it moved", () => {
    const correction: FrameCorrection = {
      designId: "3024",
      designRevision: "3024;A",
      filename: "3024.dat",
      source: "review",
      why: "synthetic: a quarter turn about y and a new origin",
      from: { turn: IDENTITY, originLdu: [0, 0, 0] },
      to: { turn: [0, 0, 1, 0, 1, 0, -1, 0, 0], originLdu: [10, 8, -30] },
    };
    const { data } = build({
      corrections: [correction],
      set: { ...SET, frameCorrections: ["3024"] },
    });
    // By hand, not through correctedPoses: bricks b and c have no LXFML turn and sit at
    // x = 1 and 2 units (25 and 50 LDU). The row is (turnT, x - turnT origin), with
    // turnT = [0 0 -1; 0 1 0; 1 0 0] and turnT (10, 8, -30) = (30, 8, 10). Their export
    // rows (20 0 0 and 40 0 0, no turn) must not survive; a and e (3001) are untouched.
    expect(partRows(data.model.text)).toEqual([
      "1 4 0 0 0 1 0 0 0 1 0 0 0 1 parts/3001.dat",
      "1 47 -5 -8 -10 0 0 -1 0 1 0 1 0 0 parts/3024.dat",
      "1 4 20 -8 -10 0 0 -1 0 1 0 1 0 0 parts/3024.dat",
      "1 4 75 0 0 1 0 0 0 1 0 0 0 1 parts/builder/9999.dat",
      "1 4 80 0 0 1 0 0 0 1 0 0 0 1 parts/3001.dat",
    ]);
    expect(data.correctedParts).toBe(2);
    expect(data.model.text).toContain(
      "0 // Reference build: LEGO's official model. Its parts keep their official poses, except designs 3024, whose export frames tools/booklet/export-frames.ts corrects; left out: 0 parts no printed step places.",
    );
  });

  it("refuses when the frame corrections applied differ from the manifest's list", () => {
    expect(() => build({ set: { ...SET, frameCorrections: ["77844"] } })).toThrowError(
      /frame corrections applied \(none\) differ from set fixture's frameCorrections \(77844\)/u,
    );
    expect(() => build({ set: { ...SET, frameCorrections: ["77844"] } })).toThrowError(
      PlayerStageError,
    );
  });
});

/** What `run` threw; fails the test when it returns. */
function thrown(run: () => unknown): Error & { readonly absent?: boolean } {
  try {
    run();
  } catch (error) {
    return error as Error & { readonly absent?: boolean };
  }
  throw new Error("expected it to throw");
}

/**
 * Bound: no real archive or mesh pack. The archive cases run the real opener
 * on a missing and a wrong file; the pack is opened only once the archive is,
 * so the pack cases replace the archive with the synthetic library and run
 * the real pack reader. How the run turns `absent` into skipped or failed is
 * main.test.ts's.
 */
describe("a missing player input skips, a present but unusable one fails", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "player-stage-"));
  });
  afterEach(() => {
    archive.fake = null;
    rmSync(dir, { recursive: true, force: true });
  });
  const runStage = (inputs: Partial<PlayerInputPaths>) => {
    const { key, align, official } = fixture();
    return runPlayerStage({
      set: SET,
      directory: join(dir, "out"),
      repositoryRoot: dir,
      inputs: {
        booklet: join(dir, "booklet.pdf"),
        lxfml: join(dir, "model.xml"),
        ldraw: join(dir, "model.ldr"),
        library: join(dir, "absent-ldraw.zip"),
        meshFallback: join(dir, "absent-pack.json"),
        ...inputs,
      },
      bookletPages: 4,
      key,
      official,
      align,
      corrections: [],
    });
  };

  it("marks a missing LDraw library archive absent, naming its path and LEGO_LDRAW_OFFICIAL_ARCHIVE", () => {
    const error = thrown(() => runStage({}));
    expect(error).toBeInstanceOf(PlayerStageError);
    expect(error.absent).toBe(true);
    expect(error.message).toMatch(
      /^no LDraw library archive at .*absent-ldraw\.zip; set LEGO_LDRAW_OFFICIAL_ARCHIVE to the pinned ldraw-complete-2026-07\.zip/u,
    );
  });

  it("does not mark an archive that is there but not the pinned one", () => {
    writeFileSync(join(dir, "wrong.zip"), "not an archive");
    const error = thrown(() => runStage({ library: join(dir, "wrong.zip") }));
    expect(error).toBeInstanceOf(PlayerStageError);
    expect(error.absent).toBe(false);
    expect(error.message).toMatch(
      /wrong\.zip is 14 bytes at sha256:[0-9a-f]{64}, not the pinned ldraw-complete-2026-07\.zip/u,
    );
  });

  it("marks a missing Builder mesh pack absent, naming its path and LEGO_BUILDER_NATIVE_PACK", () => {
    archive.fake = { library: { read: (path) => LIBRARY[path] ?? null }, colours: COLOURS };
    // Design 9999 is in no library, so its stand-in needs the pack.
    const error = thrown(() => runStage({}));
    expect(error).toBeInstanceOf(PlayerStageError);
    expect(error.absent).toBe(true);
    expect(error.message).toMatch(
      /^no LEGO Builder mesh pack at .*absent-pack\.json; design 9999 has no LDraw file, so its stand-in comes from the set's pack\. Set LEGO_BUILDER_NATIVE_PACK/u,
    );
  });

  it("does not mark a Builder mesh pack that is there but unusable", () => {
    archive.fake = { library: { read: (path) => LIBRARY[path] ?? null }, colours: COLOURS };
    const withPack = (name: string, text: string) => {
      writeFileSync(join(dir, name), text);
      const error = thrown(() => runStage({ meshFallback: join(dir, name) }));
      expect(error).toBeInstanceOf(PlayerStageError);
      expect(error.absent).toBe(false);
      return error.message;
    };
    expect(withPack("not-json.json", "not json")).toMatch(
      /^the Builder mesh pack at .*not-json\.json cannot be read as JSON \(.*\); point LEGO_BUILDER_NATIVE_PACK at the set's pack\.$/u,
    );
    expect(withPack("no-parts.json", '{"binaryBase64": ""}')).toMatch(
      /no-parts\.json is not a mesh pack: it needs binaryBase64, binarySha256, and parts/u,
    );
    const tampered = { binaryBase64: "AAAA", binarySha256: "0".repeat(64), parts: [] };
    expect(withPack("tampered.json", JSON.stringify(tampered))).toMatch(
      /tampered\.json does not match its own binarySha256/u,
    );
  });
});

describe("openSubBuildTest", () => {
  it("treats levels every brick shares as the model, so only a real sub-build counts", () => {
    const { key, align } = fixture();
    const open = openSubBuildTest(key, align);
    expect(open("a", 1)).toBe(false);
    expect(open("e", 3)).toBe(true);
  });
});
