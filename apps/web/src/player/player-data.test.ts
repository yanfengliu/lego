import { describe, expect, it } from "vitest";

import {
  mainModelStepRows,
  parsePlayerSetsIndex,
  parsePlayerSteps,
  PLAYER_SETS_VERSION,
  PLAYER_STEPS_VERSION,
  stepOfEachPart,
} from "./player-data";

const steps = (overrides: Record<string, unknown> = {}) => ({
  version: PLAYER_STEPS_VERSION,
  set: {
    id: "x",
    name: "Synthetic",
    bookletPages: 2,
    modelSource: "synthetic",
    partCount: 3,
    unplacedParts: 0,
  },
  steps: [
    { step: 1, page: 1, partsAdded: 2, alignment: "identity", subBuild: false },
    { step: 2, page: 1, partsAdded: 0, alignment: "count-fallback", subBuild: false },
    { step: 3, page: 2, partsAdded: 1, alignment: "identity", subBuild: true },
  ],
  ...overrides,
});

const MPD = [
  "0 FILE main.ldr",
  "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 a.dat",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 a.dat",
  "0 STEP",
  "0 STEP",
  "  1 4 0 0 0 1 0 0 0 1 0 0 0 1 a.dat",
  "0 STEP",
  "",
  "0 FILE a.dat",
  "1 16 0 0 0 1 0 0 0 1 0 0 0 1 b.dat",
  "0 STEP",
].join("\r\n");

describe("the player data contract", () => {
  it("accepts a well-formed steps.json and maps every part row to its printed step", () => {
    const parsed = parsePlayerSteps(steps());
    expect(mainModelStepRows(MPD)).toEqual([2, 0, 1]);
    expect(stepOfEachPart(MPD, parsed)).toEqual([1, 1, 3]);
  });

  it("names the field that breaks the contract", () => {
    expect(() => parsePlayerSteps(steps({ version: "lego.player-steps/0" }))).toThrow(
      /Regenerate it with npm start/u,
    );
    expect(() => parsePlayerSteps(steps({ steps: [] }))).toThrow(/1 to 10000 printed steps/u);
    const gap = steps();
    gap.steps[1] = { ...gap.steps[1]!, step: 3 };
    expect(() => parsePlayerSteps(gap)).toThrow(
      /steps\[1\]\.step is 3; printed steps must run 1\.\.N/u,
    );
    const offPage = steps();
    offPage.steps[2] = { ...offPage.steps[2]!, page: 9 };
    expect(() => parsePlayerSteps(offPage)).toThrow(
      /steps\[2\]\.page is 9; expected a whole number from 1 to 2/u,
    );
    expect(() => parsePlayerSteps(steps({ set: { ...steps().set, partCount: 4 } }))).toThrow(
      /steps add 3 parts but set\.partCount is 4/u,
    );
  });

  it("refuses a model whose steps disagree with steps.json, or leave rows after the last 0 STEP", () => {
    const parsed = parsePlayerSteps(steps());
    expect(() => stepOfEachPart(MPD.replace("0 STEP\r\n0 STEP", "0 STEP"), parsed)).toThrow(
      /model\.mpd has 2 printed steps but steps\.json lists 3/u,
    );
    expect(() => mainModelStepRows("0 FILE m.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 a.dat\n")).toThrow(
      /ends with 1 part rows after its last 0 STEP/u,
    );
  });

  it("reads the dev server's set list", () => {
    expect(
      parsePlayerSetsIndex({ version: PLAYER_SETS_VERSION, sets: [{ id: "x", name: "X" }] }).sets,
    ).toEqual([{ id: "x", name: "X" }]);
    expect(() => parsePlayerSetsIndex({ sets: [] })).toThrow(
      /is not a lego\.player-sets\/1 set list/u,
    );
  });
});
