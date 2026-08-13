import { describe, expect, it } from "vitest";

import { clearPdfBoxes, type PdfPointBox } from "../src/assembly/panel-art";
import {
  clearObservationSourceCandidateCalloutRectangles,
  mapObservationSourceCandidateCalloutRectangles,
  MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_RECTANGLES,
  type ObservationSourceCandidatePdfBox,
} from "./real-build-observation-source-raster-candidate-callouts";

const WIDTH = 31;
const HEIGHT = 23;
const PANEL = {
  panelMinXPt: 10,
  panelMaxXPt: 72,
  panelMinYPt: 20,
  panelMaxYPt: 66,
} as const;

function referenceMappedBoxes(
  callouts: readonly ObservationSourceCandidatePdfBox[],
): PdfPointBox[] {
  const boxes: PdfPointBox[] = [];
  for (const callout of callouts) {
    const minXPt = Math.max(PANEL.panelMinXPt, callout.minXPt);
    const maxXPt = Math.min(PANEL.panelMaxXPt, callout.maxXPt);
    const minYPt = Math.max(PANEL.panelMinYPt, callout.minYPt);
    const maxYPt = Math.min(PANEL.panelMaxYPt, callout.maxYPt);
    if (maxXPt <= minXPt || maxYPt <= minYPt) continue;
    boxes.push({
      minXPt: ((minXPt - PANEL.panelMinXPt) / (PANEL.panelMaxXPt - PANEL.panelMinXPt)) * WIDTH,
      maxXPt: ((maxXPt - PANEL.panelMinXPt) / (PANEL.panelMaxXPt - PANEL.panelMinXPt)) * WIDTH,
      minYPt: ((minYPt - PANEL.panelMinYPt) / (PANEL.panelMaxYPt - PANEL.panelMinYPt)) * HEIGHT,
      maxYPt: ((maxYPt - PANEL.panelMinYPt) / (PANEL.panelMaxYPt - PANEL.panelMinYPt)) * HEIGHT,
    });
  }
  return boxes;
}

describe("bounded work-raster callout clearing", () => {
  it("reproduces historical clearing while merging overlaps into one bounded traversal", () => {
    const callouts = [
      { minXPt: 8, maxXPt: 30, minYPt: 18, maxYPt: 40 },
      { minXPt: 20, maxXPt: 50, minYPt: 30, maxYPt: 60 },
      { minXPt: 60, maxXPt: 80, minYPt: 55, maxYPt: 75 },
      { minXPt: -20, maxXPt: 0, minYPt: -20, maxYPt: 0 },
    ] as const;
    const expected = new Uint8Array(WIDTH * HEIGHT).fill(1);
    clearPdfBoxes(
      expected,
      {
        width: WIDTH,
        height: HEIGHT,
        renderScale: 1,
        sourceXPx: 0,
        sourceYPx: 0,
        ratio: 1,
        pageHeightPx: HEIGHT,
        marginPx: 1,
      },
      referenceMappedBoxes(callouts),
    );

    const actual = new Uint8Array(WIDTH * HEIGHT).fill(1);
    const rectangles = mapObservationSourceCandidateCalloutRectangles({
      width: WIDTH,
      height: HEIGHT,
      marginPx: 1,
      panelBounds: PANEL,
      callouts,
    });
    clearObservationSourceCandidateCalloutRectangles(actual, WIDTH, HEIGHT, rectangles);

    expect(actual).toEqual(expected);
    expect(rectangles).toHaveLength(3);
  });

  it("bounds 1024 overlapping boxes to one mask traversal", () => {
    const callouts = Array.from({ length: 1_024 }, () => ({
      minXPt: PANEL.panelMinXPt,
      maxXPt: PANEL.panelMaxXPt,
      minYPt: PANEL.panelMinYPt,
      maxYPt: PANEL.panelMaxYPt,
    }));
    const mask = new Uint8Array(WIDTH * HEIGHT).fill(1);
    const rectangles = mapObservationSourceCandidateCalloutRectangles({
      width: WIDTH,
      height: HEIGHT,
      marginPx: 1,
      panelBounds: PANEL,
      callouts,
    });

    clearObservationSourceCandidateCalloutRectangles(mask, WIDTH, HEIGHT, rectangles);

    expect(rectangles).toHaveLength(1_024);
    expect(mask.every((value) => value === 0)).toBe(true);
  });

  it("rejects overflowed panel spans and non-finite mapped coordinates", () => {
    expect(() =>
      mapObservationSourceCandidateCalloutRectangles({
        width: 1,
        height: 1,
        marginPx: 0,
        panelBounds: {
          panelMinXPt: -Number.MAX_VALUE,
          panelMaxXPt: Number.MAX_VALUE,
          panelMinYPt: 0,
          panelMaxYPt: 1,
        },
        callouts: [],
      }),
    ).toThrowError(/panel X span .* is Infinity, not a finite positive PDF-point distance/);

    expect(() =>
      mapObservationSourceCandidateCalloutRectangles({
        width: 1,
        height: 1,
        marginPx: 0,
        panelBounds: PANEL,
        callouts: [{ minXPt: Number.NaN, maxXPt: 20, minYPt: 30, maxYPt: 40 }],
      }),
    ).toThrowError(/callout 0 minX mapped to NaN, not a finite work-raster coordinate/);
  });

  it("refuses malformed or unbounded direct rectangle input before allocating a union grid", () => {
    expect(() =>
      clearObservationSourceCandidateCalloutRectangles(
        new Uint8Array(WIDTH * HEIGHT),
        WIDTH,
        HEIGHT,
        [{ minX: -1, maxX: 2, minY: 0, maxY: 2 }],
      ),
    ).toThrowError(/rectangle 0 must contain safe-integer inclusive coordinates inside 31x23/);

    expect(() =>
      clearObservationSourceCandidateCalloutRectangles(
        new Uint8Array(WIDTH * HEIGHT),
        WIDTH,
        HEIGHT,
        Array.from(
          { length: MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_RECTANGLES + 1 },
          () => ({ minX: 0, maxX: 0, minY: 0, maxY: 0 }),
        ),
      ),
    ).toThrowError(/callout rectangles must be one dense exact array with at most 1024 rows/);
  });
});
