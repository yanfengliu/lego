import { describe, expect, it } from "vitest";

import {
  buildStudTextureField,
  fitStudLattice,
  latticeBasisFromAxonometric,
  solveAxonometricFromLattice,
  reduceToAxonometricBasis,
  studLatticePeaks,
  type LatticeBasisPx,
} from "./camera-fit-lattice.ts";
import {
  foldedStudShape,
  foldUnitCell,
  latticeDrift,
  latticePhase,
  latticeReciprocal,
  latticeSiteResiduals,
} from "./camera-fit-lattice-phase.ts";
import { INSTRUCTION_BACKGROUND_HEX } from "./constants.ts";

/**
 * A synthetic panel: a studded plate drawn under a camera the fitter is never
 * told. It is the same trick `camera-fit.test.ts` plays with silhouettes, and it
 * is what lets the grid fitter be graded before a real booklet is involved —
 * a recovered azimuth means nothing until it has been checked against one that
 * was chosen.
 */
interface SyntheticPanelOptions {
  readonly width: number;
  readonly height: number;
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly originXPx: number;
  readonly originYPx: number;
  readonly studsAcross: number;
  readonly studsDeep: number;
  /** Fractional pincushion, to stand in for a perspective render. */
  readonly warp?: number;
}

function drawSyntheticPanel(options: SyntheticPanelOptions): Uint8ClampedArray {
  const { width, height, studsAcross, studsDeep, originXPx, originYPx } = options;
  const basis = latticeBasisFromAxonometric(options);
  const reciprocal = latticeReciprocal(basis)!;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const background: readonly [number, number, number] = [
    (INSTRUCTION_BACKGROUND_HEX >> 16) & 0xff,
    (INSTRUCTION_BACKGROUND_HEX >> 8) & 0xff,
    INSTRUCTION_BACKGROUND_HEX & 0xff,
  ];

  // A pincushion about the raster's centre; zero leaves an exact orthographic
  // projection, which is what the recovery tests want. Rasterising needs the
  // inverse, and the map is radial and monotonic, so a fixed point finds it.
  const warp = options.warp ?? 0;
  const centreX = width / 2;
  const centreY = height / 2;
  const span = Math.hypot(centreX, centreY);
  const unwarp = (x: number, y: number): [number, number] => {
    if (warp === 0) return [x, y];
    const dx = x - centreX;
    const dy = y - centreY;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return [x, y];
    let source = distance;
    for (let iteration = 0; iteration < 24; iteration += 1) {
      source = distance / (1 + warp * (source / span) ** 2);
    }
    const shrink = source / distance;
    return [centreX + dx * shrink, centreY + dy * shrink];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [sourceX, sourceY] = unwarp(x, y);
      const relativeX = sourceX - originXPx;
      const relativeY = sourceY - originYPx;
      const u = reciprocal.f1XPx * relativeX + reciprocal.f1YPx * relativeY;
      const v = reciprocal.f2XPx * relativeX + reciprocal.f2YPx * relativeY;
      let shade: readonly [number, number, number] = background;
      if (u >= 0 && u <= studsAcross && v >= 0 && v <= studsDeep) {
        // Stud tops are circles of radius 6 LDU, which is 0.3 of a pitch, and a
        // grid coordinate is a world coordinate, so the test is a plain radius.
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

const TRUTH = {
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

function fieldFor(options: SyntheticPanelOptions) {
  return buildStudTextureField(drawSyntheticPanel(options), options.width, options.height, {
    backgroundHex: INSTRUCTION_BACKGROUND_HEX,
    backgroundTolerance: 6,
    highPassRadiusPx: 14,
  });
}

describe("solveAxonometricFromLattice", () => {
  it("round-trips every projection it can print", () => {
    for (const azimuthDegrees of [12, 30, 45, 62, 78]) {
      for (const elevationDegrees of [15, 26, 35.264, 48]) {
        const solution = solveAxonometricFromLattice(
          latticeBasisFromAxonometric({ azimuthDegrees, elevationDegrees, pixelsPerUnit: 31 }),
        );
        expect(solution).not.toBeNull();
        expect(solution!.azimuthDegrees).toBeCloseTo(azimuthDegrees, 6);
        expect(solution!.elevationDegrees).toBeCloseTo(elevationDegrees, 6);
        expect(solution!.pixelsPerUnit).toBeCloseTo(31, 6);
        expect(solution!.residualPx).toBeLessThan(1e-9);
      }
    }
  });

  it("rejects the shorter non-primitive pair that outranks the true basis below 35 degrees", () => {
    // At 30 degrees of elevation and 45 of azimuth, |a + b| is shorter than |b|,
    // so peak strength alone would pick the wrong pair. The solve is what says no.
    const basis = latticeBasisFromAxonometric({
      azimuthDegrees: 45,
      elevationDegrees: 30,
      pixelsPerUnit: 30,
    });
    const sum = { xPx: basis.a.xPx + basis.b.xPx, yPx: basis.a.yPx + basis.b.yPx };
    expect(Math.hypot(sum.xPx, sum.yPx)).toBeLessThan(Math.hypot(basis.b.xPx, basis.b.yPx));
    const impostor: LatticeBasisPx = { a: basis.a, b: sum };
    const solution = solveAxonometricFromLattice(impostor);
    // Either flatly impossible, or possible only with a residual far above the
    // true basis's zero.
    expect(solution === null || solution.residualPx > 1).toBe(true);
    expect(solveAxonometricFromLattice(basis)!.residualPx).toBeLessThan(1e-9);
  });
});

describe("fitStudLattice", () => {
  it("recovers a camera it was never told from a drawn stud grid", () => {
    const fit = fitStudLattice(fieldFor(TRUTH));
    expect(fit.failure).toBeNull();
    expect(fit.solution).not.toBeNull();
    expect(fit.solution!.azimuthDegrees).toBeCloseTo(TRUTH.azimuthDegrees, 0);
    expect(fit.solution!.elevationDegrees).toBeCloseTo(TRUTH.elevationDegrees, 0);
    expect(fit.solution!.pixelsPerUnit).toBeCloseTo(TRUTH.pixelsPerUnit, 0);
    // Measured, and the gap to the gate matters: the default refuses a fit
    // above 0.02 of a pitch, and this one is two orders of magnitude inside it.
    expect(fit.solution!.residualPx / fit.solution!.pixelsPerUnit).toBeLessThan(0.002);
  });

  it("recovers a second camera, so the first is not a coincidence of one grid", () => {
    const second = { ...TRUTH, azimuthDegrees: 62, elevationDegrees: 41, pixelsPerUnit: 22 };
    const fit = fitStudLattice(fieldFor(second));
    expect(fit.failure).toBeNull();
    expect(fit.solution!.azimuthDegrees).toBeCloseTo(62, 0);
    expect(fit.solution!.elevationDegrees).toBeCloseTo(41, 0);
    expect(fit.solution!.pixelsPerUnit).toBeCloseTo(22, 0);
  });

  it("says what is missing when the crop holds no art", () => {
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    const field = buildStudTextureField(blank, 64, 64, {
      backgroundHex: 0xffffff,
    });
    const fit = fitStudLattice(field);
    expect(fit.basis).toBeNull();
    expect(fit.failure).toContain("art pixels");
    expect(fit.failure).toContain("tolerance");
  });

  it("does not pretend the axonometric residual alone proves a stud grid", () => {
    // Measured, not assumed: a rhombic grid, which no square grid could ever
    // project to, still reads as a clean axonometric view once a change of
    // basis is allowed — under 1% of pitch. So the residual is a fit quality,
    // not a proof, and anything that claims a booklet panel is a stud grid
    // needs the second, independent measurement below.
    const square = latticeBasisFromAxonometric(TRUTH);
    const sheared = {
      a: square.a,
      b: { xPx: square.b.xPx + square.a.xPx * 0.5, yPx: square.b.yPx + square.a.yPx * 0.5 },
    };
    const reduced = reduceToAxonometricBasis(sheared);
    expect(reduced).not.toBeNull();
    expect(reduced!.solution.residualPx).toBeLessThan(0.05 * reduced!.solution.pixelsPerUnit);
    expect(solveAxonometricFromLattice(square)!.residualPx).toBeLessThan(1e-9);
  });
});

describe("studLatticePeaks", () => {
  it("puts the two grid directions among its strongest repeats", () => {
    const peaks = studLatticePeaks(fieldFor(TRUTH), 7, 60, 12);
    const basis = latticeBasisFromAxonometric(TRUTH);
    for (const wanted of [basis.a, basis.b]) {
      const nearest = Math.min(
        ...peaks.map(({ vector }) => Math.hypot(vector.xPx - wanted.xPx, vector.yPx - wanted.yPx)),
      );
      expect(nearest).toBeLessThan(1.5);
    }
  });
});

describe("latticeDrift", () => {
  it("finds one grid across an orthographic panel", () => {
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const drift = latticeDrift(field, fit.basis!, { gridSize: 3, minimumSamples: 200 });
    expect(drift.failure).toBeNull();
    expect(drift.windows.length).toBeGreaterThanOrEqual(4);
    expect(drift.horizontalRmsPx).toBeLessThan(1.2);
  });

  it("catches a basis that does not explain the whole panel", () => {
    // Two percent off in pitch is invisible over one cell and eight pixels off
    // over the four hundred this plate spans, which is what the windows exist
    // to see. This is the measure's real job: deciding whether one camera
    // covers the whole picture, and later whether it covers the next step too.
    const field = fieldFor(TRUTH);
    const fitted = fitStudLattice(field).basis!;
    const detuned = {
      a: { xPx: fitted.a.xPx * 1.02, yPx: fitted.a.yPx * 1.02 },
      b: { xPx: fitted.b.xPx * 1.02, yPx: fitted.b.yPx * 1.02 },
    };
    const honest = latticeDrift(field, fitted, { gridSize: 3, minimumSamples: 200 });
    const wrong = latticeDrift(field, detuned, { gridSize: 3, minimumSamples: 200 });
    expect(wrong.failure).toBeNull();
    expect(wrong.horizontalRmsPx).toBeGreaterThan(honest.horizontalRmsPx * 2.5);
  });

  it("is only as sensitive as its noise floor, which is measured not assumed", () => {
    // A radial pincushion standing in for a perspective render moves the far
    // corner of this plate by four pixels, and the windows do not separate it
    // from a flat panel: 0.92 against 0.98 of weighted RMS. Sixteen studs across
    // is a small sample, so the floor here is about a pixel — on a booklet panel
    // with hundreds of studs it is lower, but the honest reading of this measure
    // is a bound on drift, not a detector of every departure from orthographic.
    const flat = fieldFor(TRUTH);
    const bent = fieldFor({ ...TRUTH, warp: 0.02 });
    const flatDrift = latticeDrift(flat, fitStudLattice(flat).basis!, {
      gridSize: 3,
      minimumSamples: 200,
    });
    const bentDrift = latticeDrift(bent, fitStudLattice(bent).basis!, {
      gridSize: 3,
      minimumSamples: 200,
    });
    expect(flatDrift.horizontalRmsPx).toBeGreaterThan(0.5);
    expect(Math.abs(bentDrift.horizontalRmsPx - flatDrift.horizontalRmsPx)).toBeLessThan(0.5);
  });

  it("explains a basis it cannot take a phase against", () => {
    const field = fieldFor(TRUTH);
    const drift = latticeDrift(field, { a: { xPx: 10, yPx: 5 }, b: { xPx: 20, yPx: 10 } });
    expect(drift.failure).toContain("collinear");
  });
});

describe("latticeSiteResiduals", () => {
  it("puts every predicted stud on the ink that drew it", () => {
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const shape = foldedStudShape(foldUnitCell(field, fit.basis!, 28)!)!;
    const residuals = latticeSiteResiduals(field, fit.basis!, shape)!;
    expect(residuals.sites).toBeGreaterThan(100);
    // One plate, one height, so nothing should miss.
    expect(residuals.hitRate).toBe(1);
    expect(residuals.rmsPx).toBeLessThan(1);
  });

  it("grows when the grid is wrong, which is what makes it a measurement", () => {
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const shape = foldedStudShape(foldUnitCell(field, fit.basis!, 28)!)!;
    const honest = latticeSiteResiduals(field, fit.basis!, shape)!;
    const detuned = latticeSiteResiduals(
      field,
      {
        a: { xPx: fit.basis!.a.xPx * 1.03, yPx: fit.basis!.a.yPx * 1.03 },
        b: { xPx: fit.basis!.b.xPx * 1.03, yPx: fit.basis!.b.yPx * 1.03 },
      },
      shape,
    )!;
    expect(detuned.rmsAllPx).toBeGreaterThan(honest.rmsAllPx * 3);
  });
});

describe("foldedStudShape", () => {
  it("finds the ring the stud was drawn as, at the radius it was drawn at", () => {
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const shape = foldedStudShape(foldUnitCell(field, fit.basis!, 28)!)!;
    // A stud is 6 LDU of radius on a 20 LDU pitch, so its ring is at 0.3.
    expect(shape.ringRadiusCells).toBeGreaterThan(0.2);
    expect(shape.ringRadiusCells).toBeLessThan(0.4);
    expect(shape.radialContrast).toBeGreaterThan(3);
  });

  it("scores a cell with no stud in it near zero, which is what makes it a check", () => {
    // The trap this replaced: second moments of the folded cell are *maximised*
    // by having no stud at all. A uniform cell has a circularity of 0.999 and an
    // RMS radius of 0.408, both above what a clean synthetic stud scores, so an
    // assertion on them could not fail. A radial profile has the opposite sense.
    const size = 28;
    const flat = {
      size,
      values: new Float32Array(size * size).fill(1),
      counts: new Int32Array(size * size).fill(1),
      contrast: 0,
    };
    const mush = foldedStudShape(flat)!;
    expect(mush.radialContrast).toBeLessThan(0.5);

    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const real = foldedStudShape(foldUnitCell(field, fit.basis!, size)!)!;
    expect(real.radialContrast).toBeGreaterThan(mush.radialContrast * 5);
  });

  it("loses the ring when the grid is sheared off square", () => {
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const skewed = {
      a: fit.basis!.a,
      b: {
        xPx: fit.basis!.b.xPx + fit.basis!.a.xPx * 0.5,
        yPx: fit.basis!.b.yPx + fit.basis!.a.yPx * 0.5,
      },
    };
    const honest = foldedStudShape(foldUnitCell(field, fit.basis!, 28)!)!;
    const wrong = foldedStudShape(foldUnitCell(field, skewed, 28)!)!;
    expect(wrong.radialContrast).toBeLessThan(honest.radialContrast * 0.6);
  });
});

describe("foldUnitCell", () => {
  it("is crisp on the fitted grid and mush on a detuned one", () => {
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const tuned = foldUnitCell(field, fit.basis!, 24)!;
    const detuned = foldUnitCell(
      field,
      {
        a: { xPx: fit.basis!.a.xPx * 1.04, yPx: fit.basis!.a.yPx },
        b: { xPx: fit.basis!.b.xPx, yPx: fit.basis!.b.yPx * 1.04 },
      },
      24,
    )!;
    expect(tuned.contrast).toBeGreaterThan(detuned.contrast * 1.5);
  });
});

describe("latticePhase", () => {
  it("moves with the picture, so it registers one panel against another", () => {
    // The phase is the argument of a Fourier component, so where it lands
    // inside the cell depends on how a stud is inked, not only on where the
    // stud is. What has to hold is that it tracks the picture exactly: shift
    // the drawing by a known amount and the phase reports that amount back.
    // That is what lets a rendered plate be registered against printed art.
    const field = fieldFor(TRUTH);
    const fit = fitStudLattice(field);
    const reciprocal = latticeReciprocal(fit.basis!)!;
    const reference = latticePhase(field, reciprocal)!;
    expect(reference.coherence1).toBeGreaterThan(0.05);

    const shiftXPx = 5;
    const shiftYPx = -3;
    const moved = latticePhase(
      fieldFor({
        ...TRUTH,
        originXPx: TRUTH.originXPx + shiftXPx,
        originYPx: TRUTH.originYPx + shiftYPx,
      }),
      reciprocal,
    )!;
    const wrap = (value: number) => value - Math.round(value);
    const delta1 = wrap(moved.phase1 - reference.phase1);
    const delta2 = wrap(moved.phase2 - reference.phase2);
    const recoveredX = fit.basis!.a.xPx * delta1 + fit.basis!.b.xPx * delta2;
    const recoveredY = fit.basis!.a.yPx * delta1 + fit.basis!.b.yPx * delta2;
    expect(recoveredX).toBeCloseTo(shiftXPx, 0);
    expect(recoveredY).toBeCloseTo(shiftYPx, 0);
  });
});

describe("solveAxonometricFromLattice below the model", () => {
  /**
   * Set 6651557 is built partly upside down, so five of its first forty-three
   * panels are drawn from underneath. A projected square lattice is identical
   * from above and below — the two differ only in the sign of sin elevation —
   * so the grid cannot say which, and the face has to be supplied.
   */
  const BELOW = { azimuthDegrees: 55, elevationDegrees: -35, pixelsPerUnit: 16 };

  it("recovers a below-view exactly when told the panel is drawn from underneath", () => {
    const solution = solveAxonometricFromLattice(latticeBasisFromAxonometric(BELOW), {
      face: "underside",
    });

    expect(solution).not.toBeNull();
    expect(solution!.azimuthDegrees).toBeCloseTo(BELOW.azimuthDegrees, 6);
    expect(solution!.elevationDegrees).toBeCloseTo(BELOW.elevationDegrees, 6);
    expect(solution!.pixelsPerUnit).toBeCloseTo(BELOW.pixelsPerUnit, 6);
    expect(solution!.residualPx).toBeLessThan(1e-9);
  });

  it("refuses that same basis as an above-view rather than fitting it badly", () => {
    // This is what the booklet's refused panels were: the camera fit reported
    // 32 of 40 fitted, and a below-view forced through the above-view root is
    // exactly the shape of the eight it would not take.
    expect(solveAxonometricFromLattice(latticeBasisFromAxonometric(BELOW))).toBeNull();
  });

  it("still refuses an above-view basis when told to read it as underside", () => {
    // The face is a claim that can be wrong, and a wrong claim has to fail
    // loudly rather than return a mirrored fit that looks fine.
    expect(
      solveAxonometricFromLattice(latticeBasisFromAxonometric({ ...BELOW, elevationDegrees: 35 }), {
        face: "underside",
      }),
    ).toBeNull();
  });

  it("round-trips every below-view it can print", () => {
    for (const azimuthDegrees of [12, 30, 45, 62, 78]) {
      for (const elevationDegrees of [-15, -26, -35.264, -48]) {
        const solution = solveAxonometricFromLattice(
          latticeBasisFromAxonometric({ azimuthDegrees, elevationDegrees, pixelsPerUnit: 31 }),
          { face: "underside" },
        );

        expect(solution).not.toBeNull();
        expect(solution!.azimuthDegrees).toBeCloseTo(azimuthDegrees, 6);
        expect(solution!.elevationDegrees).toBeCloseTo(elevationDegrees, 6);
        expect(solution!.residualPx).toBeLessThan(1e-9);
      }
    }
  });
});
