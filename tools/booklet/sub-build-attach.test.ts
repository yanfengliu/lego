import { describe, expect, it } from "vitest";

import type { BrickPlacement } from "./answer-key/index.ts";
import { playBack, type PlaybackBrick } from "./playback.ts";
import {
  assemblyAfterStep,
  subBuildAttachSteps,
  type AttachStepInput,
  type AttachWindowInput,
  type SubBuildAttach,
} from "./sub-build-attach.ts";

/**
 * Synthetic sequences only: brick ids, units and printed steps are made up,
 * shaped like the cases the rule was written for (a window whose repair swaps
 * two sub-builds, a sub-build joined in a brickless step of its own).
 */
const at = (unit: number, ...levels: (readonly [string, number])[]): BrickPlacement => ({
  unit,
  copyOf: null,
  levels: levels.map(([key, attachUnit]) => ({ key, attachUnit })),
});
const timing = (
  placements: Record<string, BrickPlacement>,
  steps: AttachStepInput[],
  windows: AttachWindowInput[] = [],
) => subBuildAttachSteps({ steps, windows, placements: new Map(Object.entries(placements)) });
const summary = (attach: ReadonlyMap<string, SubBuildAttach>) =>
  Object.fromEntries(
    [...attach.values()].map(({ key, attachStep, basis }) => [key, `${attachStep} ${basis}`]),
  );

/**
 * A window like printed steps 30-33: the run gives step 31 units 48-50 and
 * step 32 units 51-55; S0 is unit 48 (attach unit 49), S1 units 50-52 (attach
 * unit 53). The repair gives step 31 S1's bricks and step 32 S0's.
 */
const SWAP = {
  placements: {
    x: at(47),
    s0a: at(48, ["S0", 49]),
    s0b: at(48, ["S0", 49]),
    s1a: at(50, ["S1", 53]),
    s1b: at(50, ["S1", 53]),
    s1c: at(51, ["S1", 53]),
    s1d: at(52, ["S1", 53]),
    m54: at(54),
    m55: at(55),
    m56: at(56),
  },
  steps: [
    { step: 30, unitEnd: 48, bricks: ["x"] },
    { step: 31, unitEnd: 51, bricks: ["s1a", "s1b", "s1c", "s1d"] },
    { step: 32, unitEnd: 56, bricks: ["s0a", "s0b", "m54", "m55"] },
    { step: 33, unitEnd: 57, bricks: ["m56"] },
  ],
  window: { solved: true, firstStep: 30, lastStep: 33 },
};

describe("sub-build attach steps", () => {
  it("joins each sub-build of a re-laid window at the step that completes it", () => {
    const attach = timing(SWAP.placements, SWAP.steps, [SWAP.window]);
    expect(summary(attach)).toEqual({ S0: "32 window", S1: "31 window" });
    expect(attach.get("S1")).toMatchObject({
      attachUnit: 53,
      runStep: 32,
      complete: 31,
      window: { firstStep: 30, lastStep: 33 },
    });
    const s1 = SWAP.placements.s1d;
    expect([30, 31, 32].map((step) => assemblyAfterStep(s1, step, attach))).toEqual([
      "S1",
      "model",
      "model",
    ]);
    // Without a solved window the run's timing holds, and it attaches S1 a step late.
    for (const windows of [[], [{ ...SWAP.window, solved: false }]]) {
      expect(summary(timing(SWAP.placements, SWAP.steps, windows))).toEqual({
        S0: "32 completion",
        S1: "32 run order",
      });
    }
  });

  it("holds no sub-build apart in playback after the window step that builds and attaches it", () => {
    const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const pendingAfterEachStep = (windows: AttachWindowInput[]) => {
      const attach = timing(SWAP.placements, SWAP.steps, windows);
      let height = 0;
      const plate = (uuid: string): PlaybackBrick => ({
        uuid,
        design: "3024.dat",
        catalogPartId: "builtin:plate-1x1",
        ldrawColor: 4,
        colorId: "builtin:red",
        // A stack of 1x1 plates, one per brick in build order.
        pose: { matrix: IDENTITY, positionLdu: [0, -8 * height++, 0] },
        assemblyAfter: (step) =>
          assemblyAfterStep(SWAP.placements[uuid as keyof typeof SWAP.placements], step, attach),
      });
      const result = playBack(
        SWAP.steps.map(({ step, bricks }) => ({ step, page: step, bricks: bricks.map(plate) })),
      );
      return result.steps.map(
        ({ status, pendingSubAssemblies }) => `${status}/${pendingSubAssemblies}`,
      );
    };
    expect(pendingAfterEachStep([SWAP.window])).toEqual([
      "valid/0",
      "valid/0",
      "valid/0",
      "valid/0",
    ]);
    // By the run alone S1 would stay apart after step 31, the step that attaches it in the booklet.
    expect(pendingAfterEachStep([])).toEqual(["valid/0", "valid/1", "valid/0", "valid/0"]);
  });

  it("joins a sub-build at the brickless step of its own that the run gives its attach unit", () => {
    // Built over steps 1-3; its attach unit 3 holds no bricks and is the whole of step 4.
    const placements = {
      a: at(0, ["S2", 3]),
      b: at(1, ["S2", 3]),
      c: at(2, ["S2", 3]),
      m: at(4),
    };
    const attach = timing(placements, [
      { step: 1, unitEnd: 1, bricks: ["a"] },
      { step: 2, unitEnd: 2, bricks: ["b"] },
      { step: 3, unitEnd: 3, bricks: ["c"] },
      { step: 4, unitEnd: 4, bricks: [] },
      { step: 5, unitEnd: 5, bricks: ["m"] },
    ]);
    expect(summary(attach)).toEqual({ S2: "4 run order" });
    expect(attach.get("S2")).toMatchObject({ runStep: 4, complete: 3, window: null });
    expect([3, 4].map((step) => assemblyAfterStep(placements.c, step, attach))).toEqual([
      "S2",
      "model",
    ]);
  });

  it("times every physical copy of a sub-build by its own bricks", () => {
    // Two copies share attach unit 2; the booklet finishes the second a step later.
    const attach = timing({ a: at(0, ["S", 2]), b: at(0, ["S#m1", 2]), m: at(3) }, [
      { step: 1, unitEnd: 3, bricks: ["a"] },
      { step: 2, unitEnd: 4, bricks: ["b", "m"] },
    ]);
    expect(summary(attach)).toEqual({ S: "1 run order", "S#m1": "2 completion" });
  });

  it("never attaches a nested sub-build after its parent", () => {
    // In order: C (attach unit 2) joins P at step 2, and P (attach unit 4) joins the model at step 3.
    const nested = {
      c1: at(0, ["P", 4], ["P/C", 2]),
      c2: at(1, ["P", 4], ["P/C", 2]),
      p1: at(3, ["P", 4]),
      m: at(5),
    };
    const inOrder = timing(nested, [
      { step: 1, unitEnd: 2, bricks: ["c1", "c2"] },
      { step: 2, unitEnd: 3, bricks: [] },
      { step: 3, unitEnd: 5, bricks: ["p1"] },
      { step: 4, unitEnd: 6, bricks: ["m"] },
    ]);
    expect(summary(inOrder)).toEqual({ P: "3 run order", "P/C": "2 run order" });
    expect([1, 2, 3].map((step) => assemblyAfterStep(nested.c1, step, inOrder))).toEqual([
      "P/C",
      "P",
      "model",
    ]);

    // P has a brick no step holds, so it keeps its run's step 3, while C's last brick is printed at step 4.
    const late = {
      c1: at(0, ["P", 3], ["P/C", 1]),
      c2: at(0, ["P", 3], ["P/C", 1]),
      p1: at(2, ["P", 3]),
      p2: at(2, ["P", 3]),
      m: at(4),
    };
    const clamped = timing(late, [
      { step: 1, unitEnd: 1, bricks: ["c1"] },
      { step: 2, unitEnd: 3, bricks: ["p1"] },
      { step: 3, unitEnd: 4, bricks: [] },
      { step: 4, unitEnd: 5, bricks: ["m", "c2"] },
    ]);
    expect(summary(clamped)).toEqual({ P: "3 unaligned brick", "P/C": "3 parent" });
    expect(clamped.get("P/C")).toMatchObject({ runStep: 2, complete: 4 });
    for (const level of clamped.values()) {
      if (level.parent === "model") continue;
      const parent = clamped.get(level.parent)!.attachStep ?? Infinity;
      expect(level.attachStep ?? Infinity).toBeLessThanOrEqual(parent);
    }
    expect([2, 3].map((step) => assemblyAfterStep(late.c2, step, clamped))).toEqual([
      "P/C",
      "model",
    ]);
  });

  it("keeps a sub-build apart for good when no printed step's run reaches its attach unit", () => {
    const placements = { k1: at(0, ["K", 9]), n1: at(1, ["K", 9], ["K/N", 2]) };
    const attach = timing(placements, [
      { step: 1, unitEnd: 2, bricks: ["k1", "n1"] },
      { step: 2, unitEnd: 3, bricks: [] },
    ]);
    // A nested sub-build still joins its parent; the parent, never.
    expect(summary(attach)).toEqual({ K: "null never", "K/N": "2 run order" });
    expect([1, 2, 1000].map((step) => assemblyAfterStep(placements.k1, step, attach))).toEqual([
      "K",
      "K",
      "K",
    ]);
    expect([1, 2].map((step) => assemblyAfterStep(placements.n1, step, attach))).toEqual([
      "K/N",
      "K",
    ]);
  });

  it("falls back to its run's step when a brick of the sub-build is in no printed step", () => {
    const attach = timing({ k1: at(0, ["K", 2]), k2: at(1, ["K", 2]) }, [
      { step: 1, unitEnd: 2, bricks: [] },
      { step: 2, unitEnd: 3, bricks: [] },
      { step: 3, unitEnd: 4, bricks: ["k1"] },
    ]);
    expect(summary(attach)).toEqual({ K: "2 unaligned brick" });
    expect(attach.get("K")!.complete).toBeNull();
  });

  it("refuses to place a brick against timing computed from other placements", () => {
    expect(() => assemblyAfterStep(at(0, ["elsewhere", 1]), 1, new Map())).toThrow(
      /Sub-build elsewhere has no attach step; compute subBuildAttachSteps from the placements this brick comes from/u,
    );
  });
});
