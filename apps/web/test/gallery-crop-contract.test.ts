import { describe, expect, it } from "vitest";

import {
  GALLERY_CROP_POLICY,
  adjudicateGalleryCrop,
  assignGalleryComponents,
  galleryComponentScore,
  type GalleryContaminationCode,
  type GalleryCropMeasurement,
} from "../e2e/gallery-crop-contract";

/**
 * Every contamination code is fired here deliberately.
 *
 * The inventory gallery currently publishes 276 crops with none of them
 * contaminated, and a clean sweep is exactly the shape a check that has quietly
 * stopped checking makes. So the codes are proved to be reachable against
 * crafted measurements rather than against the booklet, which is the only place
 * a passing run can be told apart from an inert one.
 */
const CLEAN: GalleryCropMeasurement = Object.freeze({
  foregroundPixels: 25_128,
  componentPixels: 25_128,
  unclaimedRivalPixels: 4,
  rivalComponentCount: 1,
  quantityGlyphInkPixels: 608,
  sourceTextGlyphPixels: 900,
  selectedScore: 64.65,
  runnerUpScore: 154.4,
  touchesPageBoundary: false,
  boundaryClearancePx: { left: 5, top: 5, right: 5, bottom: 5 },
  floodBudgetExhausted: false,
});

describe("adjudicateGalleryCrop", () => {
  it("passes a measurement taken from a crop known to be right", () => {
    expect(adjudicateGalleryCrop(CLEAN)).toEqual([]);
  });

  const cases: readonly (readonly [GalleryContaminationCode, Partial<GalleryCropMeasurement>])[] = [
    ["empty-foreground", { foregroundPixels: GALLERY_CROP_POLICY.minimumForegroundPixels - 1 }],
    ["touches-page-boundary", { touchesPageBoundary: true }],
    [
      "insufficient-boundary-clearance",
      { boundaryClearancePx: { left: 5, top: 0, right: 5, bottom: 5 } },
    ],
    ["quantity-label-not-located", { quantityGlyphInkPixels: 0 }],
    ["unclaimed-rival-ink", { unclaimedRivalPixels: 25_128 }],
    ["ambiguous-component-selection", { runnerUpScore: 64.65 }],
    ["flood-budget-exhausted", { floodBudgetExhausted: true }],
  ];

  for (const [code, mutation] of cases) {
    it(`fires ${code}`, () => {
      expect(adjudicateGalleryCrop({ ...CLEAN, ...mutation })).toContain(code);
    });
  }

  it("names every defect a crop carries rather than the first", () => {
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        touchesPageBoundary: true,
        quantityGlyphInkPixels: 0,
        boundaryClearancePx: { left: 0, top: 0, right: 0, bottom: 0 },
      }),
    ).toEqual([
      "touches-page-boundary",
      "insufficient-boundary-clearance",
      "quantity-label-not-located",
    ]);
  });

  it("does not blame a crop for rival ink another cell was awarded", () => {
    // 383228's rectangle holds 14578 pixels of its neighbour 302028's plate,
    // which is a quarter of its own ink. The picture is right because the
    // isolation paints that neighbour out, so only ink nobody claimed counts.
    expect(
      adjudicateGalleryCrop({ ...CLEAN, componentPixels: 58_319, unclaimedRivalPixels: 4 }),
    ).toEqual([]);
  });

  it("a lone component has no runner-up to be ambiguous against", () => {
    expect(adjudicateGalleryCrop({ ...CLEAN, runnerUpScore: null })).toEqual([]);
  });
});

describe("galleryComponentScore", () => {
  it("prefers the picture directly above a label to a nearer one beside it", () => {
    const above = galleryComponentScore({
      labelXPx: 100,
      labelTopPx: 200,
      componentLeftPx: 60,
      componentRightPx: 160,
      componentBottomPx: 190,
    });
    const beside = galleryComponentScore({
      labelXPx: 100,
      labelTopPx: 200,
      componentLeftPx: 105,
      componentRightPx: 205,
      componentBottomPx: 140,
    });
    expect(above).toBeLessThan(beside);
  });

  it("costs nothing horizontally when the label sits under the component", () => {
    expect(
      galleryComponentScore({
        labelXPx: 100,
        labelTopPx: 100,
        componentLeftPx: 50,
        componentRightPx: 150,
        componentBottomPx: 100,
      }),
    ).toBe(0);
  });
});

describe("assignGalleryComponents", () => {
  it("gives a component to one label only, so taking it costs the others", () => {
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 7, score: 10 },
      { labelIndex: 1, componentIndex: 7, score: 12 },
      { labelIndex: 1, componentIndex: 8, score: 40 },
    ]);
    expect(assignment.byLabel.get(0)).toEqual({ componentIndex: 7, score: 10 });
    expect(assignment.byLabel.get(1)).toEqual({ componentIndex: 8, score: 40 });
  });

  it("reproduces the 383228/302028 split that a per-cell match got wrong", () => {
    // The long 2x8 plate scores best for 383228 and the short 2x4 best for
    // 302028; matching either one alone would hand the long plate to both.
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 0, score: 79.5 },
      { labelIndex: 0, componentIndex: 1, score: 895.3 },
      { labelIndex: 1, componentIndex: 1, score: 64.65 },
      { labelIndex: 1, componentIndex: 0, score: 154.4 },
    ]);
    expect(assignment.byLabel.get(0)?.componentIndex).toBe(0);
    expect(assignment.byLabel.get(1)?.componentIndex).toBe(1);
    expect(assignment.runnerUpByLabel.get(0)).toBe(895.3);
    expect(assignment.runnerUpByLabel.get(1)).toBe(154.4);
  });

  it("leaves a label unassigned rather than inventing a component for it", () => {
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 3, score: 5 },
      { labelIndex: 1, componentIndex: 3, score: 6 },
    ]);
    expect(assignment.byLabel.has(1)).toBe(false);
  });

  it("does not depend on the order the pairs arrive in", () => {
    const pairs = [
      { labelIndex: 1, componentIndex: 2, score: 30 },
      { labelIndex: 0, componentIndex: 2, score: 30 },
      { labelIndex: 0, componentIndex: 1, score: 30 },
      { labelIndex: 1, componentIndex: 1, score: 30 },
    ];
    const forward = assignGalleryComponents(pairs);
    const backward = assignGalleryComponents([...pairs].reverse());
    expect([...backward.byLabel]).toEqual([...forward.byLabel]);
  });

  it("reports a negative margin when a label is outbid for what it wanted", () => {
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 5, score: 10 },
      { labelIndex: 1, componentIndex: 5, score: 11 },
      { labelIndex: 1, componentIndex: 6, score: 90 },
    ]);
    const selected = assignment.byLabel.get(1)!;
    expect(assignment.runnerUpByLabel.get(1)! - selected.score).toBeLessThan(0);
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        selectedScore: selected.score,
        runnerUpScore: assignment.runnerUpByLabel.get(1)!,
      }),
    ).toContain("ambiguous-component-selection");
  });
});
