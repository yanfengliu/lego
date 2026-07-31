import { describe, expect, it } from "vitest";

import {
  BOOST_MULTIPLIER,
  MAX_FLY_SPEED,
  MIN_FLY_SPEED,
  flyAxesFromKeys,
  flyDisplacement,
  flySpeed,
  isFlyKey,
} from "./fly-controls";

describe("fly key mapping", () => {
  it("maps the WASDQE cluster by physical position", () => {
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"]) {
      expect(isFlyKey(code)).toBe(true);
    }
    for (const code of ["ArrowUp", "KeyZ", "Escape", "Home"]) {
      expect(isFlyKey(code)).toBe(false);
    }
  });

  it("resolves each axis to a direction", () => {
    expect(flyAxesFromKeys(["KeyW"])).toEqual({ forward: 1, right: 0, up: 0 });
    expect(flyAxesFromKeys(["KeyS"])).toEqual({ forward: -1, right: 0, up: 0 });
    expect(flyAxesFromKeys(["KeyD"])).toEqual({ forward: 0, right: 1, up: 0 });
    expect(flyAxesFromKeys(["KeyA"])).toEqual({ forward: 0, right: -1, up: 0 });
    expect(flyAxesFromKeys(["KeyE"])).toEqual({ forward: 0, right: 0, up: 1 });
    expect(flyAxesFromKeys(["KeyQ"])).toEqual({ forward: 0, right: 0, up: -1 });
  });

  it("cancels opposing keys and ignores unrelated ones", () => {
    expect(flyAxesFromKeys(["KeyW", "KeyS"])).toEqual({ forward: 0, right: 0, up: 0 });
    expect(flyAxesFromKeys(["ArrowLeft", "Escape"])).toEqual({ forward: 0, right: 0, up: 0 });
  });
});

describe("fly speed", () => {
  it("scales with orbit distance between a floor and a ceiling", () => {
    expect(flySpeed(0, false)).toBe(MIN_FLY_SPEED);
    expect(flySpeed(1_000_000, false)).toBe(MAX_FLY_SPEED);
    expect(flySpeed(10, false)).toBeGreaterThan(flySpeed(1, false));
  });

  it("multiplies by the boost factor when shift is held", () => {
    expect(flySpeed(10, true)).toBe(flySpeed(10, false) * BOOST_MULTIPLIER);
  });

  it("names an orbit distance it cannot use", () => {
    expect(() => flySpeed(-1, false)).toThrow(/non-negative finite orbit distance, received -1/);
    expect(() => flySpeed(Number.POSITIVE_INFINITY, false)).toThrow(/received Infinity/);
  });
});

describe("fly displacement", () => {
  const orbitDistance = 10;

  it("stays still when nothing is held", () => {
    expect(flyDisplacement({ pressedKeys: [], orbitDistance, seconds: 1 })).toEqual({
      forward: 0,
      right: 0,
      up: 0,
    });
  });

  it("travels speed times frame time along one axis", () => {
    const { forward } = flyDisplacement({ pressedKeys: ["KeyW"], orbitDistance, seconds: 0.5 });
    expect(forward).toBeCloseTo(flySpeed(orbitDistance, false) * 0.5, 10);
  });

  it("does not let diagonals travel faster than a single axis", () => {
    const single = flyDisplacement({ pressedKeys: ["KeyW"], orbitDistance, seconds: 1 });
    const diagonal = flyDisplacement({
      pressedKeys: ["KeyW", "KeyD", "KeyE"],
      orbitDistance,
      seconds: 1,
    });

    const singleLength = Math.hypot(single.forward, single.right, single.up);
    const diagonalLength = Math.hypot(diagonal.forward, diagonal.right, diagonal.up);
    expect(diagonalLength).toBeCloseTo(singleLength, 10);
  });

  it("boosts every axis together", () => {
    const normal = flyDisplacement({ pressedKeys: ["KeyW"], orbitDistance, seconds: 1 });
    const boosted = flyDisplacement({
      pressedKeys: ["KeyW", "ShiftLeft"],
      orbitDistance,
      seconds: 1,
    });
    expect(boosted.forward).toBeCloseTo(normal.forward * BOOST_MULTIPLIER, 10);
  });

  it("moves further per second the further out the camera is", () => {
    const near = flyDisplacement({ pressedKeys: ["KeyW"], orbitDistance: 1, seconds: 1 });
    const far = flyDisplacement({ pressedKeys: ["KeyW"], orbitDistance: 100, seconds: 1 });
    expect(far.forward).toBeGreaterThan(near.forward);
  });

  it("names a frame time it cannot integrate", () => {
    expect(() =>
      flyDisplacement({ pressedKeys: ["KeyW"], orbitDistance, seconds: Number.NaN }),
    ).toThrow(/non-negative frame time, received NaN/);
  });
});
