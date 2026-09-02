/**
 * The phase of a repeat is not the centre of the thing that repeats.
 *
 * Having fitted a panel's stud grid, the obvious way to say where the studs are is
 * the argument of the picture's fundamental Fourier component at the grid
 * frequency. It is off by half a cell: the first overlay drawn that way put a
 * predicted ellipse squarely in every gap between the drawn studs, with the grid,
 * the pitch and the direction all correct and every mark wrong. What names a stud
 * is the fold — every art pixel wrapped onto one cell, and the circular mean of the
 * folded ring's own contrast.
 *
 * The sign trap beside it is pinned in `camera-fit-lattice.test.ts` ("latticePhase >
 * moves with the picture"). What is pinned here is the choice itself, which lives at
 * every call site rather than inside either function: both readings are a pair of
 * numbers in cycles, so while `latticeSite`, `latticeSitesInBox` and
 * `latticeSiteResiduals` all took the shared `LatticePhaseOffset`, handing any of
 * them the Fourier argument compiled and ran. `LatticeSitePhase` is the marker that
 * makes it a compile error, and the first case here is what proves the compiler
 * refuses it — `npm run typecheck` fails on an unused `@ts-expect-error` the moment
 * the parameter widens back to the shared type.
 *
 * The second case is why the marker has to be the gate. Measured here: on a clean
 * synthetic grid the two phases agree to 0.0003 of a cell and the residuals taken
 * against either are the same to four decimals, so no fixture this module can draw
 * separates them. The half-cell divergence is a property of printed instruction art,
 * where the anchor measured 0.96px of reprojection error from the folded centre
 * against about 20px from the Fourier argument.
 */

import { describe, expect, it } from "vitest";

import {
  buildStudTextureField,
  fitStudLattice,
  latticeBasisFromAxonometric,
} from "./camera-fit-lattice.ts";
import {
  foldedStudShape,
  foldUnitCell,
  latticePhase,
  latticeReciprocal,
  latticeSite,
  latticeSiteResiduals,
  latticeSitesInBox,
  type LatticeSitePhase,
} from "./camera-fit-lattice-phase.ts";
import { INSTRUCTION_BACKGROUND_HEX } from "./constants.ts";

const PANEL = {
  width: 640,
  height: 480,
  azimuthDegrees: 34,
  elevationDegrees: 28,
  pixelsPerUnit: 26,
  originXPx: 300,
  originYPx: 120,
  studsAcross: 16,
  studsDeep: 12,
} as const;

/** A studded plate drawn under a camera the fitter is never told about. */
function syntheticPanel(): Uint8ClampedArray {
  const basis = latticeBasisFromAxonometric(PANEL);
  const reciprocal = latticeReciprocal(basis)!;
  const pixels = new Uint8ClampedArray(PANEL.width * PANEL.height * 4);
  const background: readonly [number, number, number] = [
    (INSTRUCTION_BACKGROUND_HEX >> 16) & 0xff,
    (INSTRUCTION_BACKGROUND_HEX >> 8) & 0xff,
    INSTRUCTION_BACKGROUND_HEX & 0xff,
  ];
  for (let y = 0; y < PANEL.height; y += 1) {
    for (let x = 0; x < PANEL.width; x += 1) {
      const offset = (y * PANEL.width + x) * 4;
      const relativeX = x - PANEL.originXPx;
      const relativeY = y - PANEL.originYPx;
      const u = reciprocal.f1XPx * relativeX + reciprocal.f1YPx * relativeY;
      const v = reciprocal.f2XPx * relativeX + reciprocal.f2YPx * relativeY;
      let shade: readonly [number, number, number] = background;
      if (u >= 0 && u <= PANEL.studsAcross && v >= 0 && v <= PANEL.studsDeep) {
        // A stud top is 6 LDU of radius on a 20 LDU pitch, so 0.3 of a cell.
        const radius = Math.hypot(u - Math.floor(u) - 0.5, v - Math.floor(v) - 0.5);
        shade = radius > 0.3 ? [108, 110, 104] : radius > 0.23 ? [26, 26, 26] : [168, 170, 164];
      }
      pixels[offset] = shade[0];
      pixels[offset + 1] = shade[1];
      pixels[offset + 2] = shade[2];
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

const FIELD = buildStudTextureField(syntheticPanel(), PANEL.width, PANEL.height, {
  backgroundHex: INSTRUCTION_BACKGROUND_HEX,
  backgroundTolerance: 6,
  highPassRadiusPx: 14,
});
const BASIS = fitStudLattice(FIELD).basis!;
const FOURIER = latticePhase(FIELD, latticeReciprocal(BASIS)!)!;
const FOLD = foldedStudShape(foldUnitCell(FIELD, BASIS, 28)!)!;

/** Cycles from `left` to `right` along one direction, wrapped into (-0.5, 0.5]. */
function cyclesApart(left: number, right: number): number {
  const raw = (right - left) % 1;
  return raw > 0.5 ? raw - 1 : raw <= -0.5 ? raw + 1 : raw;
}

describe("only a phase that names a stud may be drawn from", () => {
  it("refuses the Fourier argument at the type level, at every site call", () => {
    // Each of these compiles the moment the parameter widens back to the shared
    // `LatticePhaseOffset`, and then draws marks in the gaps. `tsc` reports the
    // unused directive, which is what makes this a gate rather than a comment.
    // @ts-expect-error latticePhase returns where the pattern peaks, not where a stud is
    latticeSite(BASIS, FOURIER, 0, 0);
    // @ts-expect-error the same argument, at the call that draws a panel's overlay
    latticeSitesInBox(BASIS, FOURIER, { minXPx: 0, minYPx: 0, maxXPx: 64, maxYPx: 64 });
    // @ts-expect-error the same argument, at the measurement that reports the panel's error
    latticeSiteResiduals(FIELD, BASIS, FOURIER);
    // "Every site call" is the claim, so it is checked rather than asserted: every
    // exported function of this module taking a phase appears above.
    expect(FOLD.namesAStudCentre).toBe(true);
    expect("namesAStudCentre" in FOURIER).toBe(false);
  });

  /**
   * Why the marker is the gate and a fixture is not, measured rather than argued.
   * On a clean synthetic grid the two readings agree — a filled disc high passed at
   * about its own width still peaks on the stud — so no synthetic panel this module
   * can draw separates them, and the defect lives entirely on printed art. The
   * booklet's own number is in the anchor: 0.96px of reprojection error with the
   * folded centre against about half a pitch, roughly 20px, with the Fourier phase,
   * and `output/camera-fit/overlay-003.png` is the picture that showed it.
   */
  it("agrees with the fold on a synthetic grid, so no fixture here can catch the swap", () => {
    expect(Math.abs(cyclesApart(FOURIER.phase1, FOLD.phase1))).toBeLessThan(0.01);
    expect(Math.abs(cyclesApart(FOURIER.phase2, FOLD.phase2))).toBeLessThan(0.01);

    const fromFold = latticeSiteResiduals(FIELD, BASIS, FOLD)!;
    // The cast is the defect this file exists to make impossible, written once on
    // purpose so the blindness below is a measurement and not an assumption.
    const fromFourier = latticeSiteResiduals(FIELD, BASIS, FOURIER as unknown as LatticeSitePhase)!;
    expect(fromFold.hitRate).toBe(1);
    expect(fromFold.rmsPx).toBeLessThan(1);
    // 0.2504px against 0.2501px, and 19.7391 against 19.7395 on the anti-phase
    // control. Two readings this close cannot be told apart by any threshold, which
    // is exactly why the choice is pinned in the type system instead.
    expect(Math.abs(fromFourier.rmsPx - fromFold.rmsPx)).toBeLessThan(0.01);
    expect(Math.abs(fromFourier.inkOverAntiPhase - fromFold.inkOverAntiPhase)).toBeLessThan(0.01);
  });

  it("still holds the sign of the fold, which is the trap next to this one", () => {
    // A pattern peaking at p0 makes the transform's argument -2*pi*f.p0, so the
    // phase that names a site is the negated argument; signed the other way every
    // mark lands mirrored about the panel's centre. Drawn at the negated fold, the
    // predicted site moves off the ink it was on.
    const onTheStud = latticeSite(BASIS, FOLD, 3, 2);
    const mirrored = latticeSite(
      BASIS,
      { namesAStudCentre: true, phase1: -FOLD.phase1, phase2: -FOLD.phase2 },
      3,
      2,
    );
    expect(Math.hypot(onTheStud.xPx - mirrored.xPx, onTheStud.yPx - mirrored.yPx)).toBeGreaterThan(
      1,
    );
  });
});
