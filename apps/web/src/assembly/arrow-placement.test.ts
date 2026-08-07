import { describe, expect, it } from "vitest";

import {
  arbitrateArrowCandidates,
  arrowDisplacementFamily,
  ArrowPlacementError,
  correctArrowForClearance,
  panelProjectionForWorkRaster,
  panelProjectionFromFit,
  type PanelProjection,
} from "./arrow-placement";

const DEGREES = Math.PI / 180;

/** The projection a panel of the sample booklet was actually fitted with. */
function projectionFor(azimuth: number, elevation: number, pixelsPerStud: number): PanelProjection {
  return {
    a: {
      xPx: pixelsPerStud * Math.cos(azimuth * DEGREES),
      yPx: pixelsPerStud * Math.sin(elevation * DEGREES) * Math.sin(azimuth * DEGREES),
    },
    b: {
      xPx: -pixelsPerStud * Math.sin(azimuth * DEGREES),
      yPx: pixelsPerStud * Math.sin(elevation * DEGREES) * Math.cos(azimuth * DEGREES),
    },
    up: { xPx: 0, yPx: -pixelsPerStud * Math.cos(elevation * DEGREES) * 0.4 },
    pixelsPerStud,
  };
}

/** Step 1's camera: azimuth 55.1, elevation 34.5, 40.6 pixels per stud. */
const STEP_ONE = projectionFor(55.1, 34.5, 40.6);

function project(
  projection: PanelProjection,
  studsA: number,
  studsB: number,
  plates: number,
): { xPx: number; yPx: number } {
  return {
    xPx: studsA * projection.a.xPx + studsB * projection.b.xPx + plates * projection.up.xPx,
    yPx: studsA * projection.a.yPx + studsB * projection.b.yPx + plates * projection.up.yPx,
  };
}

describe("correctArrowForClearance", () => {
  it("extends the arrow along its own axis by both gaps", () => {
    const corrected = correctArrowForClearance(
      { xPx: 0, yPx: 100 },
      { tailToGhostPx: 13, headToBuiltPx: 4 },
    );
    expect(corrected.xPx).toBeCloseTo(0, 6);
    expect(corrected.yPx).toBeCloseTo(117, 6);
  });

  it("treats an unmeasured gap as zero rather than guessing one", () => {
    const corrected = correctArrowForClearance(
      { xPx: 30, yPx: 40 },
      { tailToGhostPx: null, headToBuiltPx: 5 },
    );
    expect(Math.hypot(corrected.xPx, corrected.yPx)).toBeCloseTo(55, 6);
  });

  it("refuses a zero-length arrow, which has no axis to extend along", () => {
    expect(() =>
      correctArrowForClearance({ xPx: 0, yPx: 0 }, { tailToGhostPx: 1, headToBuiltPx: 1 }),
    ).toThrow(/zero length has no direction to extend along/);
  });
});

describe("arrowDisplacementFamily", () => {
  it("finds the displacement its own projection came from", () => {
    const truth = { studsA: 0, studsB: 0, plates: -6 };
    const family = arrowDisplacementFamily(
      STEP_ONE,
      project(STEP_ONE, truth.studsA, truth.studsB, truth.plates),
      { toleranceStuds: 0.35 },
    );
    const exact = family.find(
      (entry) =>
        entry.studsA === truth.studsA &&
        entry.studsB === truth.studsB &&
        entry.plates === truth.plates,
    );
    expect(exact).toBeDefined();
    expect(exact!.errorStuds).toBeCloseTo(0, 6);
  });

  it("converts to LDU with the document's y running down", () => {
    const family = arrowDisplacementFamily(STEP_ONE, project(STEP_ONE, 2, -3, 5), {
      toleranceStuds: 0.01,
    });
    const exact = family.find((entry) => entry.plates === 5)!;
    expect(exact.lduX).toBe(40);
    expect(exact.lduZ).toBe(-60);
    // Five plates up the page is five plates down the axis: the booklet draws
    // up and the document counts down, and a sign error here drops the part
    // through the model so the validator refuses every candidate.
    expect(exact.lduY).toBe(-40);
  });

  it("cannot separate one height from the next above the plate quantum", () => {
    // The design constraint the default exists for. A plate projects to about a
    // third of a stud, so a tolerance at or above that admits the neighbouring
    // heights whatever the arrow said — on step 1's camera a clean six-plate
    // drop comes back as a family of fifteen, three of which are the same
    // ground position at three different heights.
    const plateInStuds = Math.abs(STEP_ONE.up.yPx) / STEP_ONE.pixelsPerStud;
    expect(plateInStuds).toBeGreaterThan(0.3);
    expect(plateInStuds).toBeLessThan(0.34);

    const wide = arrowDisplacementFamily(STEP_ONE, project(STEP_ONE, 0, 0, -6), {
      toleranceStuds: 0.35,
    });
    expect(wide.length).toBeGreaterThan(10);
    const sameGround = wide.filter((entry) => entry.studsA === 0 && entry.studsB === 0);
    expect(sameGround.length).toBeGreaterThan(1);
  });

  it("separates the heights below half a plate, which is what the default does", () => {
    const family = arrowDisplacementFamily(STEP_ONE, project(STEP_ONE, 0, 0, -6));
    expect(family.length).toBeLessThan(5);
    const sameGround = family.filter((entry) => entry.studsA === 0 && entry.studsB === 0);
    expect(sameGround).toHaveLength(1);
    expect(sameGround[0]!.plates).toBe(-6);
  });

  it("refuses a range counted in the wrong unit", () => {
    expect(() =>
      arrowDisplacementFamily(STEP_ONE, { xPx: 0, yPx: 10 }, { studRange: 400 }),
    ).toThrow(/studRange must be a whole number of grid steps between 0 and 64, received 400/);
  });

  it("refuses rather than truncating when the tolerance is absurd", () => {
    expect(() =>
      arrowDisplacementFamily(STEP_ONE, { xPx: 0, yPx: 10 }, { toleranceStuds: 20 }),
    ).toThrow(/over the 200 this will return/);
  });

  it("names the missing scale rather than dividing by it", () => {
    expect(() =>
      arrowDisplacementFamily({ ...STEP_ONE, pixelsPerStud: 0 }, { xPx: 0, yPx: 10 }),
    ).toThrow(/needs a positive pixelsPerStud, received 0/);
  });
});

describe("panelProjectionForWorkRaster", () => {
  /**
   * Panel 2 of the sample booklet: the lattice fit is measured on the
   * full-resolution crop, and the arrows are read off the same crop downsampled
   * by the run's work factor.
   */
  const FIT = {
    azimuthDegrees: 54.882572739160764,
    elevationDegrees: 35.639060713178495,
    pixelsPerUnit: 40.574776536412344,
  };
  const WORK_FACTOR = 2;
  // Straight up the page, which is the direction panel 2's arrows draw, over an
  // even number of plates so that the factor divides the travel exactly and the
  // mistake below is arithmetic rather than a rounding.
  const TRAVEL = { studsA: 0, studsB: 0, plates: 8 };

  /** The same travel, as it is measured on each of the two rasters. */
  const fullResolutionPx = project(
    panelProjectionFromFit(FIT),
    TRAVEL.studsA,
    TRAVEL.studsB,
    TRAVEL.plates,
  );
  const workRasterPx = {
    xPx: fullResolutionPx.xPx / WORK_FACTOR,
    yPx: fullResolutionPx.yPx / WORK_FACTOR,
  };

  it("recovers the travel a displacement measured on the work raster came from", () => {
    const family = arrowDisplacementFamily(
      panelProjectionForWorkRaster(FIT, WORK_FACTOR),
      workRasterPx,
    );
    expect(family[0]).toMatchObject(TRAVEL);
    expect(family[0]!.errorStuds).toBeCloseTo(0, 9);
  });

  it("reports the same travel from either raster, which is the whole point", () => {
    const fromFull = arrowDisplacementFamily(panelProjectionFromFit(FIT), fullResolutionPx);
    const fromWork = arrowDisplacementFamily(
      panelProjectionForWorkRaster(FIT, WORK_FACTOR),
      workRasterPx,
    );
    expect(fromWork.map(({ lduX, lduY, lduZ }) => [lduX, lduY, lduZ])).toStrictEqual(
      fromFull.map(({ lduX, lduY, lduZ }) => [lduX, lduY, lduZ]),
    );
  });

  it("reads exactly a factor too little travel when the rasters are mixed up", () => {
    // The defect this replaces, stated as the arithmetic rather than as a
    // number: inverting a work-pixel displacement through the full-resolution
    // projection divides the answer by the work factor, and the run's whole
    // arrow family inherited it.
    const mixedUp = arrowDisplacementFamily(panelProjectionFromFit(FIT), workRasterPx);
    expect(mixedUp[0]).toMatchObject({ ...TRAVEL, plates: TRAVEL.plates / WORK_FACTOR });
    expect(mixedUp.every((entry) => entry.plates < TRAVEL.plates)).toBe(true);
  });

  it("is the fit's own projection when nothing was downsampled", () => {
    expect(panelProjectionForWorkRaster(FIT, 1)).toStrictEqual(panelProjectionFromFit(FIT));
  });

  it("names the factor rather than accepting a raster nobody rendered", () => {
    expect(() => panelProjectionForWorkRaster(FIT, 1.5)).toThrow(
      /workFactor must be a whole downsampling factor of at least 1, received 1.5/,
    );
    expect(() => panelProjectionForWorkRaster(FIT, 0)).toThrow(/received 0/);
  });
});

describe("arbitrateArrowCandidates", () => {
  const family = arrowDisplacementFamily(STEP_ONE, project(STEP_ONE, 0, 0, -6), {
    toleranceStuds: 0.35,
  });

  it("has a family to arbitrate over at all", () => {
    expect(family.length).toBeGreaterThan(3);
  });

  it("reports a unique survivor when the domain accepts exactly one", () => {
    const arbitration = arbitrateArrowCandidates(family, [100, 60, 40], (position) =>
      // Only the pure six-plate drop is buildable: anything sideways, and any
      // other height, has nothing under it.
      position[0] === 100 && position[2] === 40 && position[1] === 60 + 6 * 8
        ? null
        : "nothing would hold it up there",
    );
    expect(arbitration.offered).toBe(family.length);
    expect(arbitration.accepted).toBe(1);
    expect(arbitration.unique).toBe(true);
    expect(arbitration.best!.candidate.studsA).toBe(0);
    expect(arbitration.best!.candidate.studsB).toBe(0);
    expect(arbitration.best!.positionLdu[1]).toBe(60 + 6 * 8);
  });

  it("carries the domain's refusal through rather than discarding it", () => {
    const arbitration = arbitrateArrowCandidates(family, [0, 0, 0], () => "it would collide");
    expect(arbitration.accepted).toBe(0);
    expect(arbitration.unique).toBe(false);
    expect(arbitration.best).toBeNull();
    expect(arbitration.attempts[0]!.refusal).toBe("it would collide");
  });

  it("does not call a tie a placement", () => {
    const arbitration = arbitrateArrowCandidates(family, [0, 0, 0], () => null);
    expect(arbitration.accepted).toBe(family.length);
    expect(arbitration.unique).toBe(false);
    // The best is still the pixel-nearest of the survivors, so a caller that
    // has to pick one has a deterministic answer — but `unique` says plainly
    // that the domain did not settle it.
    expect(arbitration.best!.candidate).toBe(family[0]);
  });

  it("is named so a caller can tell it from a renderer failure", () => {
    expect(new ArrowPlacementError("x").name).toBe("ArrowPlacementError");
  });
});
