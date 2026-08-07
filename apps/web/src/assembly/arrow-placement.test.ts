import { describe, expect, it } from "vitest";

import {
  arbitrateArrowCandidates,
  arrowTravelFamily,
  ArrowPlacementError,
  measureArrowTravelCeiling,
  panelProjectionForWorkRaster,
  panelProjectionFromFit,
  type DisplacementCandidate,
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

const lengthOf = (vector: { xPx: number; yPx: number }): number =>
  Math.hypot(vector.xPx, vector.yPx);

const scaled = (vector: { xPx: number; yPx: number }, factor: number) => ({
  xPx: vector.xPx * factor,
  yPx: vector.yPx * factor,
});

const holds = (
  family: readonly DisplacementCandidate[],
  studsA: number,
  studsB: number,
  plates: number,
): boolean =>
  family.some(
    (entry) => entry.studsA === studsA && entry.studsB === studsB && entry.plates === plates,
  );

describe("measureArrowTravelCeiling", () => {
  /**
   * A panel drawn the way an exploded step is: the model occupies the top of the
   * raster and the ghost floats below it, with the arrow inked upward out of the
   * ghost and stopping inside the model.
   */
  const WIDTH = 40;
  const HEIGHT = 100;
  const MODEL_TOP_ROW = 10;
  const MODEL_BOTTOM_ROW = 40;
  const built = (() => {
    const mask = new Uint8Array(WIDTH * HEIGHT);
    for (let y = MODEL_TOP_ROW; y <= MODEL_BOTTOM_ROW; y += 1) {
      for (let x = 8; x < 32; x += 1) mask[y * WIDTH + x] = 1;
    }
    return { width: WIDTH, height: HEIGHT, mask };
  })();
  const UPWARD = { xPx: 0, yPx: -20 };

  it("stops where the model the part is joining stops", () => {
    const ceiling = measureArrowTravelCeiling([{ tailXPx: 20, tailYPx: 70 }], UPWARD, built);
    // Up the page is decreasing y, so the far side of the model is its top row
    // and the travel that reaches it is the whole distance from the tail.
    expect(ceiling.modelFarAlongPx).toBeCloseTo(-MODEL_TOP_ROW, 6);
    expect(ceiling.tailAlongPx).toBeCloseTo(-70, 6);
    expect(ceiling.ceilingPx).toBeCloseTo(70 - MODEL_TOP_ROW, 6);
  });

  it("takes the arrows' mean tail, because the displacement is their consensus", () => {
    const ceiling = measureArrowTravelCeiling(
      [
        { tailXPx: 12, tailYPx: 60 },
        { tailXPx: 28, tailYPx: 80 },
      ],
      UPWARD,
      built,
    );
    expect(ceiling.ceilingPx).toBeCloseTo(70 - MODEL_TOP_ROW, 6);
  });

  it("measures along the arrow rather than down the raster", () => {
    // The same model, read along an arrow pointing up and to the left: the far
    // corner along that axis is a different pixel from the topmost row.
    const oblique = measureArrowTravelCeiling(
      [{ tailXPx: 20, tailYPx: 70 }],
      { xPx: -20, yPx: -20 },
      built,
    );
    const straight = measureArrowTravelCeiling([{ tailXPx: 20, tailYPx: 70 }], UPWARD, built);
    expect(oblique.ceilingPx).not.toBeCloseTo(straight.ceilingPx, 3);
  });

  it("names an arrow with no axis rather than dividing by its length", () => {
    expect(() =>
      measureArrowTravelCeiling([{ tailXPx: 1, tailYPx: 1 }], { xPx: 0, yPx: 0 }, built),
    ).toThrow(/zero length states no axis/);
  });

  it("refuses to guess a tail when no arrow was given", () => {
    expect(() => measureArrowTravelCeiling([], UPWARD, built)).toThrow(
      /measured from where the arrows start, and none were given/,
    );
  });

  it("refuses a mask that came off another raster", () => {
    expect(() =>
      measureArrowTravelCeiling([{ tailXPx: 1, tailYPx: 1 }], UPWARD, {
        width: WIDTH,
        height: HEIGHT,
        mask: new Uint8Array(4),
      }),
    ).toThrow(/holds 4 pixels against the 40x100 raster it claims/);
  });
});

describe("arrowTravelFamily", () => {
  /**
   * Panel 2 of the sample booklet, at the raster its arrows were read on. Every
   * number below is that panel's own measurement.
   */
  const PANEL_TWO = panelProjectionForWorkRaster(
    {
      azimuthDegrees: 54.882572739160764,
      elevationDegrees: 35.639060713178495,
      pixelsPerUnit: 40.574776536412344,
    },
    2,
  );
  /** The travel the booklet draws: seven plates straight up. */
  const TRUE_TRAVEL = project(PANEL_TWO, 0, 0, 7);
  /** The arrow as inked on that panel, tail to head. */
  const INKED = scaled(TRUE_TRAVEL, 33.50220230104512 / lengthOf(TRUE_TRAVEL));
  /** Where the already-built art stops along that axis, measured off the panel. */
  const CEILING_PX = 80.49463;

  it("recovers a travel the arrow was inked too short to state", () => {
    // The defect this replaces. Both of panel 2's arrows are drawn from inside
    // the ghost to inside the model — the head stops at the model's visible
    // surface while the seat is behind it — so the ink is a floor rather than
    // the travel. Stated as the geometry: the gap between the arrow's endpoint
    // and the true travel's is far wider than any family drawn as a disc around
    // the ink could admit, whatever radius it used to separate one plate from
    // the next.
    const gapStuds =
      Math.hypot(TRUE_TRAVEL.xPx - INKED.xPx, TRUE_TRAVEL.yPx - INKED.yPx) /
      PANEL_TWO.pixelsPerStud;
    const plateInStuds = Math.abs(PANEL_TWO.up.yPx) / PANEL_TWO.pixelsPerStud;
    expect(gapStuds).toBeGreaterThan(plateInStuds);

    const family = arrowTravelFamily(PANEL_TWO, INKED, CEILING_PX);
    expect(holds(family, 0, 0, 7)).toBe(true);
  });

  it("takes the ink as a floor, so nothing travels less far than it was drawn", () => {
    const family = arrowTravelFamily(PANEL_TWO, INKED, CEILING_PX);
    expect(family.length).toBeGreaterThan(0);
    expect(family.every((entry) => entry.travelPx >= lengthOf(INKED))).toBe(true);
    // Six plates is the whole-grid travel nearest the ink, and it is short of
    // the drawing: the family holds it, and it is not the only member.
    expect(holds(family, 0, 0, 6)).toBe(true);
    expect(
      family.filter((entry) => entry.studsA === 0 && entry.studsB === 0).length,
    ).toBeGreaterThan(1);
  });

  it("stops at the model rather than carrying the part through it", () => {
    const family = arrowTravelFamily(PANEL_TWO, INKED, CEILING_PX);
    expect(family.every((entry) => entry.travelPx <= CEILING_PX)).toBe(true);
    // Twelve plates is on the arrow's line and inside this panel's own ceiling,
    // so it is offered here. Nothing but the ceiling excludes such a travel: a
    // family that checked only the direction would take it at any distance.
    const twelvePlates = lengthOf(project(PANEL_TWO, 0, 0, 12));
    expect(twelvePlates).toBeLessThan(CEILING_PX);
    expect(holds(family, 0, 0, 12)).toBe(true);
    expect(holds(arrowTravelFamily(PANEL_TWO, INKED, twelvePlates - 1), 0, 0, 12)).toBe(false);
  });

  it("measures across the arrow rather than to its endpoint", () => {
    const family = arrowTravelFamily(PANEL_TWO, INKED, CEILING_PX);
    const tolerancePx = 0.15 * PANEL_TWO.pixelsPerStud;
    expect(family.every((entry) => entry.offLinePx <= tolerancePx)).toBe(true);
    // One stud sideways is on nobody's line: it travels a plausible distance and
    // is still excluded, because the arrow's direction is what it measures.
    expect(family.every((entry) => !(entry.studsA === 1 && entry.studsB === 0))).toBe(true);
  });

  it("converts to LDU with the document's y running down", () => {
    const travel = project(STEP_ONE, 2, -3, 5);
    const family = arrowTravelFamily(STEP_ONE, travel, lengthOf(travel) + 1, {
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

  it("orders off the line first and by travel after, deterministically", () => {
    const family = arrowTravelFamily(PANEL_TWO, INKED, CEILING_PX);
    for (let index = 1; index < family.length; index += 1) {
      const previous = family[index - 1]!;
      const current = family[index]!;
      expect(
        previous.offLinePx < current.offLinePx ||
          (previous.offLinePx === current.offLinePx && previous.travelPx <= current.travelPx),
      ).toBe(true);
    }
  });

  it("refuses a range counted in the wrong unit", () => {
    expect(() => arrowTravelFamily(STEP_ONE, { xPx: 0, yPx: 10 }, 50, { studRange: 400 })).toThrow(
      /studRange must be a whole number of grid steps between 0 and 64, received 400/,
    );
  });

  it("refuses rather than truncating when the tolerance is absurd", () => {
    expect(() =>
      arrowTravelFamily(STEP_ONE, { xPx: 0, yPx: 10 }, 400, { toleranceStuds: 20 }),
    ).toThrow(/over the 200 this will return/);
  });

  it("names the missing scale rather than dividing by it", () => {
    expect(() =>
      arrowTravelFamily({ ...STEP_ONE, pixelsPerStud: 0 }, { xPx: 0, yPx: 10 }, 50),
    ).toThrow(/needs a positive pixelsPerStud, received 0/);
  });

  it("names an arrow with no direction rather than searching every line at once", () => {
    expect(() => arrowTravelFamily(STEP_ONE, { xPx: 0, yPx: 0 }, 50)).toThrow(
      /zero length states no direction/,
    );
  });

  it("is empty when the panel's arrow and the panel's art disagree", () => {
    // A ceiling under the ink says the model the arrow points at does not reach
    // as far as the arrow is drawn. Nothing is invented to close that: the
    // family comes back empty and the caller refuses for want of a travel.
    expect(arrowTravelFamily(PANEL_TWO, INKED, lengthOf(INKED) - 1)).toStrictEqual([]);
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
    const family = arrowTravelFamily(
      panelProjectionForWorkRaster(FIT, WORK_FACTOR),
      workRasterPx,
      lengthOf(workRasterPx),
    );
    expect(family[0]).toMatchObject(TRAVEL);
    expect(family[0]!.offLineStuds).toBeCloseTo(0, 9);
  });

  it("reports the same travel from either raster, which is the whole point", () => {
    // Read on its own raster each time — the ceiling scales with the pixels the
    // travel is measured in, exactly as the displacement does.
    const fromFull = arrowTravelFamily(
      panelProjectionFromFit(FIT),
      fullResolutionPx,
      lengthOf(fullResolutionPx),
    );
    const fromWork = arrowTravelFamily(
      panelProjectionForWorkRaster(FIT, WORK_FACTOR),
      workRasterPx,
      lengthOf(workRasterPx),
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
    const mixedUp = arrowTravelFamily(
      panelProjectionFromFit(FIT),
      workRasterPx,
      lengthOf(workRasterPx),
    );
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
  const drawn = project(STEP_ONE, 0, 0, -6);
  const family = arrowTravelFamily(STEP_ONE, drawn, lengthOf(drawn) * 2, {
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
