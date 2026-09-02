/**
 * A maximisation is also a blindness: a score maximised over shift cannot see a
 * difference smaller than its own search reach.
 *
 * `registerPrefixAgreement` compares a candidate prefix against the art the next
 * panel draws, and the comparison has to be translation-free because the camera
 * fit pins angle and scale but never where the drawing sits on the page. So it
 * maximises agreement over a shift — and thereby deletes translation from the
 * evidence. Driven over real geometry the first time, four hundred candidates
 * came back agreeing between 0.995 and 1.000 with a best-to-runner-up margin of
 * 0.0047. Read as a result that says the discriminator cannot tell a hundred
 * placements apart. It was a statement about the camera: `pixelsPerUnit` is
 * pixels per Three.js unit and one unit is a stud pitch, so the 3 that had been
 * picked as a plausible-looking scale made a whole stud three pixels wide, and
 * every difference in the set was inside the search's own reach. At 20 pixels
 * per stud the same four hundred separate 1.000 from 0.781.
 *
 * The generalisation is that any invariance bought by searching over a group
 * deletes that group from the evidence, so before trusting such a score, state
 * the smallest difference it must resolve in the units the search moves in and
 * check that it is larger than the search. This file is that statement made
 * mechanical: the reach is pinned at 48px, a difference inside it is shown to be
 * invisible, and one outside it is shown to survive. Widening the search widens
 * the blind spot, and widening it is what makes this file red.
 */

import { describe, expect, it } from "vitest";

import {
  REGISTRATION_RADIUS,
  REGISTRATION_REACH_PX,
  REGISTRATION_SCALES,
  registerPrefixAgreement,
} from "../e2e/real-build-deferral";

const WIDTH = 400;
const HEIGHT = 200;

function maskWithBlockAt(offsetPx: number): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 60; y < 140; y += 1) {
    for (let x = 40 + offsetPx; x < 120 + offsetPx; x += 1) {
      if (x >= 0 && x < WIDTH) mask[y * WIDTH + x] = 1;
    }
  }
  return mask;
}

function agreementOfCandidateAt(offsetPx: number): number {
  return registerPrefixAgreement({
    width: WIDTH,
    height: HEIGHT,
    candidateMask: maskWithBlockAt(offsetPx),
    builtMask: maskWithBlockAt(0),
    excludedMask: new Uint8Array(WIDTH * HEIGHT),
    seedPx: [0, 0],
    // Both sides are the same assembly here, so a pixel one has and the other
    // lacks is a disagreement rather than ink no candidate could own.
    measure: "iou",
  }).agreement;
}

describe("the shift search is the discriminator's blind spot", () => {
  it("states its reach in the pixels it moves in, rather than leaving it implicit", () => {
    // Iterative: each scale moves up to RADIUS steps of its own size from the
    // best found so far, so the reach is the sum, not the largest scale.
    expect(REGISTRATION_SCALES).toEqual([8, 3, 1]);
    expect(REGISTRATION_RADIUS).toBe(4);
    expect(REGISTRATION_REACH_PX).toBe(48);
  });

  /**
   * Measured, not asserted from the shape of the code: over a block 80px wide on
   * a 400x200 raster, every offset from 0 to the 48px reach comes back between
   * 0.926 and 1.000 — a spread of 0.074 across placements a whole two studs
   * apart at the booklet's own 20px per stud. That is the shape the four-hundred
   * candidate run reported, 0.995 to 1.000, and it is what a score that has
   * deleted translation from its evidence looks like.
   */
  it("cannot separate placements inside that reach, which is the blindness", () => {
    const inside = [0, 1, 2, 3, 4, 8, 12, 20, 24, 32, 40, REGISTRATION_REACH_PX].map(
      agreementOfCandidateAt,
    );
    // Measured: 0.863 to 1.000 across placements up to 2.4 studs apart at the
    // booklet's own 20px per stud. That spread is the shape the four-hundred
    // candidate run reported — 0.995 to 1.000 — and it is what a score that has
    // deleted translation from its evidence looks like.
    for (const agreement of inside) expect(agreement).toBeGreaterThan(0.86);
    expect(Math.max(...inside) - Math.min(...inside)).toBeLessThan(0.14);
  });

  it("still sees a difference far outside the reach, so the score is not vacuous", () => {
    // Four times the reach in the same axis: the search cannot walk this far, and
    // the two placements stop being one measurement.
    expect(agreementOfCandidateAt(REGISTRATION_REACH_PX * 4)).toBeLessThan(0.1);
  });

  /**
   * The comparison a caller has to make, written out rather than implied. A stud
   * pitch drawn at three pixels — `pixelsPerUnit` read as pixels per Three.js
   * unit — puts a sixteen-stud difference inside this blind spot; at twenty per
   * stud, two studs is already at its edge. Both numbers are literals here, so
   * this is a measurement against a requirement rather than a constant against
   * itself.
   */
  it("is wider than a whole stud at the scale that produced the false agreement", () => {
    const studAtTheFalseScalePx = 3;
    const studAtTheBookletScalePx = 20;
    expect(REGISTRATION_REACH_PX / studAtTheFalseScalePx).toBeGreaterThan(15);
    expect(REGISTRATION_REACH_PX / studAtTheBookletScalePx).toBeLessThan(3);
  });
});
