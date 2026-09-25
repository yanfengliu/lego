import { describe, expect, it } from "vitest";

import { parsePlayerSteps, stepOfEachPart } from "../../apps/web/src/player/player-data.ts";
import type { PlayerSet } from "../player/sets.ts";
import type { AnswerKey, OfficialLdrawModel } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import type { FrameCorrection } from "./export-frames.ts";
import { buildPlayerData, openSubBuildTest, PlayerStageError } from "./player-stage.ts";

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
    colours: "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333",
    standInFor: (design) => {
      asked.push(design);
      return design === "9999"
        ? "0 Stand-in\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 1 0 0 0 1 0"
        : null;
    },
  });
  return { data, asked };
}

describe("buildPlayerData", () => {
  it("writes one steps.json entry per printed step, with its page, parts added, alignment and sub-build flag", () => {
    const { data } = build({ unplaced: true });
    expect(data.steps.set).toMatchObject({
      id: "fixture",
      bookletPages: 4,
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

  it("refuses when the frame corrections applied differ from the manifest's list", () => {
    expect(() => build({ set: { ...SET, frameCorrections: ["77844"] } })).toThrowError(
      /frame corrections applied \(none\) differ from set fixture's frameCorrections \(77844\)/u,
    );
    expect(() => build({ set: { ...SET, frameCorrections: ["77844"] } })).toThrowError(
      PlayerStageError,
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
