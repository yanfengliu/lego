/**
 * The booklet turns the model over mid-build and says so, and a panel the loop
 * scores against the wrong face cannot be matched by any placement.
 *
 * The toggle that turns the icon into a viewpoint is pinned in
 * `apps/web/src/assembly/panel-face.test.ts`, including the fact that one missed
 * icon inverts every later step rather than its own. What is pinned here is the
 * measurement that toggle stands on: the rotate-the-model chrome is a white square
 * 44.937pt on a side, measured across all 43 of them in 6651557, and the detector
 * admits a printed icon and refuses everything else on the page.
 *
 * Every other check of this detector builds its own fixture out of
 * `ROTATION_ICON_SIDE_PT`, so moving the constant moves both sides of the
 * comparison and nothing goes red — a check built from the same symbol as the
 * thing it checks proves only that the code agrees with itself. The side, the
 * tolerance and the admitted extremes are therefore written here as literals.
 */

import { describe, expect, test } from "vitest";

import type { PageShape } from "../src/instructions/page-shapes";
import type { StepPanel } from "../src/instructions/step-panels";
import {
  isRotationIcon,
  panelContainsRotationIcon,
  ROTATION_ICON_FILL_HEX,
  ROTATION_ICON_SIDE_PT,
  ROTATION_ICON_SIDE_TOLERANCE_PT,
} from "../e2e/real-build-transition-features";

function square(sidePt: number, fillHex = "#ffffff", minXPt = 100, minYPt = 400): PageShape {
  return {
    fillHex,
    bounds: { minXPt, minYPt, maxXPt: minXPt + sidePt, maxYPt: minYPt + sidePt },
    pointCount: 4,
  };
}

describe("the rotate-the-model icon is a measured square, not a named constant", () => {
  test("holds the side and tolerance measured off the booklet", () => {
    expect(ROTATION_ICON_SIDE_PT).toBe(44.937);
    expect(ROTATION_ICON_SIDE_TOLERANCE_PT).toBe(0.5);
    expect(ROTATION_ICON_FILL_HEX).toBe("#ffffff");
  });

  test("admits a white square drawn at the size the booklet prints it", () => {
    expect(isRotationIcon(square(44.937))).toBe(true);
    // The whole admitted band, so a detector narrowed to one exact value is caught
    // as surely as one moved off the measurement.
    expect(isRotationIcon(square(44.45))).toBe(true);
    expect(isRotationIcon(square(45.42))).toBe(true);
  });

  test("refuses a square outside the admitted band in either direction", () => {
    expect(isRotationIcon(square(44.4))).toBe(false);
    expect(isRotationIcon(square(45.5))).toBe(false);
    // Page chrome this booklet really carries at other sizes: a callout box and a
    // page-number plate would both be icons under a detector that only checks white.
    expect(isRotationIcon(square(30))).toBe(false);
    expect(isRotationIcon(square(12))).toBe(false);
  });

  test("refuses the right size in the wrong ink, and the right ink in the wrong shape", () => {
    expect(isRotationIcon(square(44.937, "#fefefe"))).toBe(false);
    expect(
      isRotationIcon({
        fillHex: "#ffffff",
        bounds: { minXPt: 100, minYPt: 400, maxXPt: 144.937, maxYPt: 430 },
        pointCount: 4,
      }),
    ).toBe(false);
  });

  test("attributes an icon to the panel its centre falls in", () => {
    const panel: Pick<StepPanel, "bounds"> = {
      bounds: { minXPt: 0, maxXPt: 300, minYPt: 0, maxYPt: 500 },
    };
    expect(panelContainsRotationIcon(panel, [square(44.937, "#ffffff", 100, 400)])).toBe(true);
    expect(panelContainsRotationIcon(panel, [square(44.937, "#ffffff", 400, 400)])).toBe(false);
    expect(panelContainsRotationIcon(panel, [square(30, "#ffffff", 100, 400)])).toBe(false);
  });

  /**
   * A stated limit of this detector's reach, not a passing behaviour to rely on.
   * Attribution is centre-in-bounds, so an icon the booklet prints above a panel's
   * artwork is not counted for that panel: page 13 of 6651557 carries two icons and
   * only step 7's is seen. That undercount is what "39 icons, one per page" was.
   */
  test("cannot see an icon printed outside its panel's own bounds", () => {
    const panel: Pick<StepPanel, "bounds"> = {
      bounds: { minXPt: 0, maxXPt: 300, minYPt: 0, maxYPt: 500 },
    };
    const aboveTheArtwork = square(44.937, "#ffffff", 100, 520);
    expect(isRotationIcon(aboveTheArtwork)).toBe(true);
    expect(panelContainsRotationIcon(panel, [aboveTheArtwork])).toBe(false);
  });
});
