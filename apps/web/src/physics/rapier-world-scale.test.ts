/**
 * Simulate bricks in centimetres, not LDU or metres, and give the ground real
 * depth, or a falling brick goes straight through it.
 *
 * Two scale traps, one cause: a brick is small, and solvers are tuned for
 * objects around a metre. One LDU is 0.4 mm, so a 2x4 brick is 80 x 24 x 40 LDU
 * and 0.032 m across; feeding either unit to a solver puts every object orders of
 * magnitude away from the size its default tolerances, sleep thresholds and
 * contact slop assume. Centimetres put a 2x4 brick at 3.2 by 1.6, which is the
 * range those defaults were chosen for, and gravity is then 981 rather than 9.81.
 *
 * The second trap follows from the first. A brick dropped 8 cm reaches about
 * 125 cm/s, which is 2 cm of travel in a sixtieth of a second — larger than most
 * of the parts involved. The ground collider was 20 micrometres thick, so the
 * brick crossed it entirely inside one step, kept falling with nothing to
 * report, and came to rest 11 LDU *below* the plate.
 *
 * This file exists because "lands a body on the plate and leaves it there" in
 * `rapier-world.test.ts` does not hold either claim. Two independent defences
 * now cover the tunnelling — a deep slab and continuous collision detection —
 * so removing either one alone leaves that test green, and it never looks at the
 * unit system at all. The assertions below are derived from the drop the lesson
 * describes rather than read back off the constants they check: the slab has to
 * be deeper than one step of travel at the speed an 8 cm fall reaches.
 */

import { describe, expect, it } from "vitest";

import { CM_PER_LDU, GRAVITY_CM_PER_S2, GROUND_SLAB_HALF_DEPTH_CM } from "./rapier-world.ts";

/** One LDU is 0.4 mm. Anything else and the numbers below are not centimetres. */
const MM_PER_LDU = 0.4;
/** The drop the original failure was measured at. */
const DROP_CM = 8;
/** Rapier is stepped once per rendered frame. */
const STEP_SECONDS = 1 / 60;

describe("the unit system a brick is simulated in", () => {
  it("puts a 2x4 brick in the size range a solver's defaults were tuned for", () => {
    // 80 x 40 LDU in plan. In metres that is 0.032 by 0.016 and in LDU it is 80
    // by 40; neither is within two orders of magnitude of a solver's assumptions.
    const lengthCm = 80 * CM_PER_LDU;
    const widthCm = 40 * CM_PER_LDU;
    expect(CM_PER_LDU).toBeCloseTo(MM_PER_LDU / 10, 12);
    expect(lengthCm).toBeCloseTo(3.2, 12);
    expect(widthCm).toBeCloseTo(1.6, 12);
    // The band a rigid-body solver's default tolerances, sleep thresholds and
    // contact slop are chosen for. Metres (0.032) and LDU (80) both miss it.
    expect(lengthCm).toBeGreaterThan(0.5);
    expect(lengthCm).toBeLessThan(50);
  });

  it("states gravity in the same system, so the numbers are consistent", () => {
    // 9.81 m/s^2 is 981 cm/s^2. Writing 9.81 beside centimetre lengths is the
    // same mistake as writing metres, wearing a different face.
    expect(GRAVITY_CM_PER_S2).toBeCloseTo(9.81 * 100, 9);
  });

  it("gives the build plate more depth than one step of the fall can cross", () => {
    // v = sqrt(2 g h) at the bottom of the drop, and the collider has to be
    // thicker than v * dt or the body is past it before anything is reported.
    const impactSpeedCmPerS = Math.sqrt(2 * GRAVITY_CM_PER_S2 * DROP_CM);
    const travelPerStepCm = impactSpeedCmPerS * STEP_SECONDS;
    expect(travelPerStepCm).toBeGreaterThan(2);

    const slabThicknessCm = 2 * GROUND_SLAB_HALF_DEPTH_CM;
    expect(
      slabThicknessCm,
      `a ${slabThicknessCm} cm plate is crossed by ${travelPerStepCm.toFixed(2)} cm of travel in one ` +
        `${STEP_SECONDS.toFixed(4)} s step, which is how the brick came to rest 11 LDU below it`,
    ).toBeGreaterThan(travelPerStepCm);
    // Not merely thicker: a margin, because the drop height is a property of the
    // build and this one was measured at only 8 cm.
    expect(slabThicknessCm).toBeGreaterThan(travelPerStepCm * 10);
  });
});
