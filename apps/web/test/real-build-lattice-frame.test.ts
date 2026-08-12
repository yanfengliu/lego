import { describe, expect, it } from "vitest";

import {
  arrowDisplacementForRealBuildLatticeFrame,
  createRealBuildLatticeFrame,
  realBuildFrameCandidateId,
  viewForRealBuildLatticeFrame,
  type RealBuildLatticeFrame,
  type RealBuildLatticeTurnDegrees,
} from "../e2e/real-build-lattice-frame";

const HASH = `sha256:${"a".repeat(64)}`;
const TURNS: readonly RealBuildLatticeTurnDegrees[] = [0, 90, 180, 270];
const HANDS = [
  { latticeHand: "as-fitted" as const, latticeDeterminant: 1 as const },
  { latticeHand: "x-reflected" as const, latticeDeterminant: -1 as const },
] as const;

const frame = (
  latticeHand: RealBuildLatticeFrame["latticeHand"] = "as-fitted",
  turnDegrees: RealBuildLatticeTurnDegrees = 0,
  shiftPx: readonly [number, number] = [17, -23],
): RealBuildLatticeFrame =>
  createRealBuildLatticeFrame({
    latticeHand,
    latticeDeterminant: latticeHand === "as-fitted" ? 1 : -1,
    turnDegrees,
    shiftPx,
  });

describe("createRealBuildLatticeFrame", () => {
  it("copies and deeply freezes all eight determinant-and-turn frames", () => {
    const inputs = HANDS.flatMap((hand) =>
      TURNS.map((turnDegrees) => ({ ...hand, turnDegrees, shiftPx: [17, -23] })),
    );
    const frames = inputs.map(createRealBuildLatticeFrame);

    expect(frames).toHaveLength(8);
    expect(frames.map(({ latticeHand, turnDegrees }) => `${latticeHand}:${turnDegrees}`)).toEqual([
      "as-fitted:0",
      "as-fitted:90",
      "as-fitted:180",
      "as-fitted:270",
      "x-reflected:0",
      "x-reflected:90",
      "x-reflected:180",
      "x-reflected:270",
    ]);
    expect(frames.every(Object.isFrozen)).toBe(true);
    expect(frames.every(({ shiftPx }) => Object.isFrozen(shiftPx))).toBe(true);

    inputs[0]!.shiftPx[0] = 999;
    expect(frames[0]!.shiftPx).toEqual([17, -23]);
    expect(Object.isFrozen(inputs[0])).toBe(false);
  });

  it.each([
    [
      { latticeHand: "right", latticeDeterminant: 1, turnDegrees: 0, shiftPx: [0, 0] },
      /latticeHand.*right/su,
    ],
    [
      { latticeHand: "as-fitted", latticeDeterminant: 0, turnDegrees: 0, shiftPx: [0, 0] },
      /latticeDeterminant.*0/su,
    ],
    [
      { latticeHand: "as-fitted", latticeDeterminant: -1, turnDegrees: 0, shiftPx: [0, 0] },
      /requires latticeDeterminant 1.*-1/su,
    ],
    [
      { latticeHand: "x-reflected", latticeDeterminant: 1, turnDegrees: 0, shiftPx: [0, 0] },
      /requires latticeDeterminant -1.*1/su,
    ],
    [
      { latticeHand: "as-fitted", latticeDeterminant: 1, turnDegrees: 45, shiftPx: [0, 0] },
      /turnDegrees.*45/su,
    ],
    [
      { latticeHand: "as-fitted", latticeDeterminant: 1, turnDegrees: 0, shiftPx: [0.5, 0] },
      /shiftPx.*safe integer/su,
    ],
    [
      { latticeHand: "as-fitted", latticeDeterminant: 1, turnDegrees: 0, shiftPx: [0] },
      /shiftPx.*exactly two/su,
    ],
    [
      {
        latticeHand: "as-fitted",
        latticeDeterminant: 1,
        turnDegrees: 0,
        shiftPx: [0, 0],
        extra: true,
      },
      /exactly.*extra/su,
    ],
  ])("refuses malformed frame %# with a field-specific error", (input, message) => {
    expect(() => createRealBuildLatticeFrame(input)).toThrow(message);
  });

  it("normalizes negative zero so one mathematical shift has one frame", () => {
    const normalized = createRealBuildLatticeFrame({
      latticeHand: "as-fitted",
      latticeDeterminant: 1,
      turnDegrees: -0,
      shiftPx: [-0, -0],
    });
    expect(normalized.turnDegrees).toBe(0);
    expect(normalized.shiftPx).toStrictEqual([0, 0]);
  });

  it("snapshots every caller-owned frame field and shift coordinate exactly once", () => {
    const reads = new Map<string, number>();
    const once =
      <T>(key: string, value: T): (() => T) =>
      () => {
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return value;
      };
    const shift = [17, -23];
    Object.defineProperties(shift, {
      0: { configurable: true, enumerable: true, get: once("shiftX", 17) },
      1: { configurable: true, enumerable: true, get: once("shiftY", -23) },
    });
    const input = {};
    Object.defineProperties(input, {
      latticeHand: { enumerable: true, get: once("hand", "x-reflected") },
      latticeDeterminant: { enumerable: true, get: once("determinant", -1) },
      shiftPx: { enumerable: true, get: once("shift", shift) },
      turnDegrees: { enumerable: true, get: once("turn", 90) },
    });

    expect(createRealBuildLatticeFrame(input)).toEqual({
      latticeHand: "x-reflected",
      latticeDeterminant: -1,
      shiftPx: [17, -23],
      turnDegrees: 90,
    });
    expect(Object.fromEntries(reads)).toEqual({
      hand: 1,
      determinant: 1,
      turn: 1,
      shift: 1,
      shiftX: 1,
      shiftY: 1,
    });
  });
});

describe("realBuildFrameCandidateId", () => {
  it("has a stable canonical suffix in hand-then-turn order", () => {
    const ids = HANDS.flatMap(({ latticeHand }) =>
      TURNS.map((turnDegrees) =>
        realBuildFrameCandidateId({
          stepNumber: 5,
          documentHash: HASH,
          frame: frame(latticeHand, turnDegrees),
        }),
      ),
    );

    expect(ids).toEqual([
      `step-005:${HASH}:frame:as-fitted:d1:q000:x17:y-23`,
      `step-005:${HASH}:frame:as-fitted:d1:q090:x17:y-23`,
      `step-005:${HASH}:frame:as-fitted:d1:q180:x17:y-23`,
      `step-005:${HASH}:frame:as-fitted:d1:q270:x17:y-23`,
      `step-005:${HASH}:frame:x-reflected:d-1:q000:x17:y-23`,
      `step-005:${HASH}:frame:x-reflected:d-1:q090:x17:y-23`,
      `step-005:${HASH}:frame:x-reflected:d-1:q180:x17:y-23`,
      `step-005:${HASH}:frame:x-reflected:d-1:q270:x17:y-23`,
    ]);
    expect(new Set(ids)).toHaveLength(8);
  });

  it("separates equal document bytes retained under opposite horizontal hands", () => {
    const common = { stepNumber: 5, documentHash: HASH };
    const fitted = realBuildFrameCandidateId({ ...common, frame: frame("as-fitted", 90) });
    const reflected = realBuildFrameCandidateId({ ...common, frame: frame("x-reflected", 90) });

    expect(fitted).not.toBe(reflected);
    expect(fitted).toContain(":as-fitted:d1:");
    expect(reflected).toContain(":x-reflected:d-1:");
  });

  it.each([
    [{ stepNumber: 0, documentHash: HASH, frame: frame() }, /stepNumber.*positive/su],
    [
      { stepNumber: 1, documentHash: "sha256:ABC", frame: frame() },
      /documentHash.*lowercase sha256/su,
    ],
    [
      { stepNumber: 1, documentHash: HASH, frame: { ...frame(), latticeDeterminant: -1 } },
      /requires latticeDeterminant 1/su,
    ],
    [{ stepNumber: 1, documentHash: HASH, frame: frame(), extra: true }, /exactly.*extra/su],
  ])("refuses malformed candidate identity input %#", (input, message) => {
    expect(() => realBuildFrameCandidateId(input as never)).toThrow(message);
  });

  it("snapshots candidate identity fields before validating the nested frame", () => {
    const reads = new Map<string, number>();
    const once =
      <T>(key: string, value: T): (() => T) =>
      () => {
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return value;
      };
    const input = {};
    Object.defineProperties(input, {
      stepNumber: { enumerable: true, get: once("step", 5) },
      documentHash: { enumerable: true, get: once("hash", HASH) },
      frame: { enumerable: true, get: once("frame", frame("x-reflected", 90)) },
    });

    expect(realBuildFrameCandidateId(input as never)).toBe(
      `step-005:${HASH}:frame:x-reflected:d-1:q090:x17:y-23`,
    );
    expect(Object.fromEntries(reads)).toEqual({ step: 1, hash: 1, frame: 1 });
  });
});

describe("viewForRealBuildLatticeFrame", () => {
  const view = { azimuthDegrees: 41, elevationDegrees: 26, pixelsPerUnit: 52, upSign: -1 as const };

  it("applies the quarter turn before the hand transform for all eight frames", () => {
    const transformed = HANDS.flatMap(({ latticeHand }) =>
      TURNS.map((turnDegrees) =>
        viewForRealBuildLatticeFrame(view, frame(latticeHand, turnDegrees)),
      ),
    );

    expect(transformed.map(({ azimuthDegrees }) => azimuthDegrees)).toEqual([
      41, 131, 221, 311, 139, 49, -41, -131,
    ]);
    expect(transformed.map(({ elevationDegrees }) => elevationDegrees)).toEqual([
      26, 26, 26, 26, -26, -26, -26, -26,
    ]);
    expect(transformed.every(({ pixelsPerUnit }) => pixelsPerUnit === 52)).toBe(true);
    expect(transformed.every(({ upSign }) => upSign === -1)).toBe(true);
    expect(transformed.every(Object.isFrozen)).toBe(true);
    expect(view).toStrictEqual({
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
      upSign: -1,
    });
    expect(Object.isFrozen(view)).toBe(false);
  });

  it("refuses a non-finite or unscaled view", () => {
    expect(() =>
      viewForRealBuildLatticeFrame({ ...view, azimuthDegrees: Number.NaN }, frame()),
    ).toThrow(/azimuthDegrees.*finite/su);
    expect(() => viewForRealBuildLatticeFrame({ ...view, pixelsPerUnit: 0 }, frame())).toThrow(
      /pixelsPerUnit.*positive/su,
    );
  });

  it("reads caller-owned view fields once before applying the frame", () => {
    const reads = new Map<string, number>();
    const once =
      <T>(key: string, value: T): (() => T) =>
      () => {
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return value;
      };
    const suppliedView = {};
    Object.defineProperties(suppliedView, {
      azimuthDegrees: { enumerable: true, get: once("azimuth", 41) },
      elevationDegrees: { enumerable: true, get: once("elevation", 26) },
      pixelsPerUnit: { enumerable: true, get: once("scale", 52) },
      upSign: { enumerable: true, get: once("up", -1) },
    });

    expect(
      viewForRealBuildLatticeFrame(suppliedView as typeof view, frame("x-reflected", 90)),
    ).toEqual({ azimuthDegrees: 49, elevationDegrees: -26, pixelsPerUnit: 52, upSign: -1 });
    expect(Object.fromEntries(reads)).toEqual({ azimuth: 1, elevation: 1, scale: 1, up: 1 });
  });
});

describe("arrowDisplacementForRealBuildLatticeFrame", () => {
  it("rotates X/Z before reflecting X for all eight frames", () => {
    const input = { lduX: 40, lduY: -8, lduZ: 60, travelPx: 46.17, offLineStuds: 0.04 };
    const transformed = HANDS.flatMap(({ latticeHand }) =>
      TURNS.map((turnDegrees) =>
        arrowDisplacementForRealBuildLatticeFrame(input, frame(latticeHand, turnDegrees)),
      ),
    );

    expect(transformed.map(({ lduX, lduZ }) => [lduX, lduZ])).toEqual([
      [40, 60],
      [60, -40],
      [-40, -60],
      [-60, 40],
      [-40, 60],
      [-60, -40],
      [40, -60],
      [60, 40],
    ]);
    expect(transformed.every(({ lduY }) => lduY === -8)).toBe(true);
    expect(transformed.every(({ travelPx }) => travelPx === 46.17)).toBe(true);
    expect(transformed.every(({ offLineStuds }) => offLineStuds === 0.04)).toBe(true);
    expect(transformed.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    expect(input.lduX).toBe(40);
  });

  it("refuses coordinates or measurements that cannot describe a derived arrow family", () => {
    expect(() =>
      arrowDisplacementForRealBuildLatticeFrame(
        { lduX: 0.5, lduY: 0, lduZ: 0, travelPx: 1, offLineStuds: 0 },
        frame(),
      ),
    ).toThrow(/lduX.*safe integer/su);
    expect(() =>
      arrowDisplacementForRealBuildLatticeFrame(
        { lduX: 0, lduY: 0, lduZ: 0, travelPx: -1, offLineStuds: 0 },
        frame(),
      ),
    ).toThrow(/travelPx.*non-negative/su);
  });

  it("reads each caller-owned arrow field once before transforming it", () => {
    const reads = new Map<string, number>();
    const once =
      <T>(key: string, value: T): (() => T) =>
      () => {
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return value;
      };
    const input = {};
    Object.defineProperties(input, {
      lduX: { enumerable: true, get: once("x", 40) },
      lduY: { enumerable: true, get: once("y", -8) },
      lduZ: { enumerable: true, get: once("z", 60) },
      travelPx: { enumerable: true, get: once("travel", 46.17) },
      offLineStuds: { enumerable: true, get: once("offline", 0.04) },
    });

    expect(
      arrowDisplacementForRealBuildLatticeFrame(input as never, frame("x-reflected", 90)),
    ).toEqual({ lduX: -60, lduY: -8, lduZ: -40, travelPx: 46.17, offLineStuds: 0.04 });
    expect(Object.fromEntries(reads)).toEqual({ x: 1, y: 1, z: 1, travel: 1, offline: 1 });
  });

  it("normalizes negative zero so equivalent arrow families serialize identically", () => {
    expect(
      arrowDisplacementForRealBuildLatticeFrame(
        { lduX: -0, lduY: -0, lduZ: -0, travelPx: -0, offLineStuds: -0 },
        frame("x-reflected", 270),
      ),
    ).toStrictEqual({ lduX: 0, lduY: 0, lduZ: 0, travelPx: 0, offLineStuds: 0 });
  });
});
