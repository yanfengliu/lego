import { describe, expect, it } from "vitest";

import {
  GALLERY_CODE_MEASUREMENTS,
  GALLERY_CROP_POLICY,
  adjudicateGalleryCrop,
  assignGalleryComponents,
  galleryComponentScore,
  summariseCodeReachability,
  type GalleryContaminationCode,
  type GalleryCropMeasurement,
} from "../e2e/gallery-crop-contract";

/**
 * Every contamination code is fired here deliberately, and the reachability
 * report is tested for saying so.
 *
 * The inventory gallery publishes 276 crops with none of them contaminated, and
 * a clean sweep is exactly the shape a check that has quietly stopped checking
 * makes. The first version of this contract carried three codes that could not
 * fire on that pipeline at all and a unit test that could not tell, because it
 * fed the adjudicator crafted structs the pipeline could never produce. So the
 * codes are proved reachable here, and `summariseCodeReachability` is proved to
 * report how close each one came — which is the part a manifest reader can
 * check against the booklet.
 */
const CLEAN: GalleryCropMeasurement = Object.freeze({
  foregroundPixels: 25_128,
  largestUnclaimedRivalPixels: 4,
  largestUnclaimedRivalAreaPt2: 0.06,
  unclaimedRivalComponentsAboveThreshold: 0,
  quantityGlyphInkPixels: 608,
  selectedScore: 64.65,
  freeRunnerUpScore: 154.4,
  touchesPageBoundary: false,
});

describe("adjudicateGalleryCrop", () => {
  it("passes a measurement taken from a crop known to be right", () => {
    expect(adjudicateGalleryCrop(CLEAN)).toEqual([]);
  });

  const cases: readonly (readonly [GalleryContaminationCode, Partial<GalleryCropMeasurement>])[] = [
    ["empty-foreground", { foregroundPixels: GALLERY_CROP_POLICY.minimumForegroundPixels - 1 }],
    ["touches-page-boundary", { touchesPageBoundary: true }],
    ["quantity-label-pairing-not-reproduced", { quantityGlyphInkPixels: 0 }],
    [
      "unclaimed-rival-ink",
      { largestUnclaimedRivalPixels: 25_128, largestUnclaimedRivalAreaPt2: 392.6 },
    ],
    ["ambiguous-component-selection", { freeRunnerUpScore: 64.65 }],
  ];

  for (const [code, mutation] of cases) {
    it(`fires ${code}`, () => {
      expect(adjudicateGalleryCrop({ ...CLEAN, ...mutation })).toContain(code);
    });
  }

  it("covers every declared code, so none can be added without a firing case", () => {
    expect(cases.map(([code]) => code).sort()).toEqual(
      (Object.keys(GALLERY_CODE_MEASUREMENTS) as GalleryContaminationCode[]).sort(),
    );
  });

  it("names every defect a crop carries rather than the first", () => {
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        touchesPageBoundary: true,
        quantityGlyphInkPixels: 0,
        largestUnclaimedRivalPixels: 25_128,
        largestUnclaimedRivalAreaPt2: 392.6,
      }),
    ).toEqual([
      "touches-page-boundary",
      "quantity-label-pairing-not-reproduced",
      "unclaimed-rival-ink",
    ]);
  });

  it("fires on one unclaimed blob big enough to have been a part, however small its share", () => {
    // The share test alone is far too loose on a large part: a fifth of a
    // 128,000-pixel component is bigger than most whole parts in the gallery.
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        foregroundPixels: 128_000,
        largestUnclaimedRivalPixels: 1_000,
        largestUnclaimedRivalAreaPt2: 15.6,
        unclaimedRivalComponentsAboveThreshold: 1,
      }),
    ).toContain("unclaimed-rival-ink");
  });

  it("does not blame a crop for a speck too small to be part of anything", () => {
    // 6253436 is the smallest part in the gallery at 2334 pixels, so a single
    // 120-pixel crumb of antialiasing beside it is over a twentieth of its ink
    // — and 1.9 square points of print, which is nothing a reader could see.
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        foregroundPixels: 2_334,
        largestUnclaimedRivalPixels: 120,
        largestUnclaimedRivalAreaPt2: 1.88,
        freeRunnerUpScore: null,
      }),
    ).toEqual([]);
  });

  it("does not blame a crop for ink another cell was awarded", () => {
    // 383228's rectangle holds 14,578 pixels of its neighbour's plate — a
    // quarter of its own ink — and the picture is right, because the isolation
    // paints that neighbour out and the gallery gave it to the neighbour.
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        foregroundPixels: 58_319,
        largestUnclaimedRivalPixels: 4,
      }),
    ).toEqual([]);
  });

  it("treats being outbid as the constraint working, not as ambiguity", () => {
    // A label whose own best candidate went to a nearer cell is not ambiguous;
    // it lost. Scoring that as contamination would make the gallery constraint
    // unusable, because the first time it ever bound the run would fail.
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 5, score: 10 },
      { labelIndex: 1, componentIndex: 5, score: 11 },
      { labelIndex: 1, componentIndex: 6, score: 90 },
    ]);
    const outbid = assignment.byLabel.get(1)!;
    expect(outbid.outbidScore).toBe(11);
    expect(outbid.freeRunnerUpScore).toBeNull();
    expect(
      adjudicateGalleryCrop({
        ...CLEAN,
        selectedScore: outbid.score,
        freeRunnerUpScore: outbid.freeRunnerUpScore,
      }),
    ).toEqual([]);
  });

  it("a lone component has no free runner-up to be ambiguous against", () => {
    expect(adjudicateGalleryCrop({ ...CLEAN, freeRunnerUpScore: null })).toEqual([]);
  });
});

describe("summariseCodeReachability", () => {
  it("reports how close a clean gallery came to each check", () => {
    const summary = summariseCodeReachability([CLEAN, { ...CLEAN, foregroundPixels: 2_334 }]);
    expect(summary.map(({ code }) => code).sort()).toEqual(
      (Object.keys(GALLERY_CODE_MEASUREMENTS) as GalleryContaminationCode[]).sort(),
    );
    expect(summary.every(({ fired }) => fired === 0)).toBe(true);
    const foreground = summary.find(({ code }) => code === "empty-foreground")!;
    expect(foreground.closestObserved).toBe(2_334);
    expect(foreground.threshold).toBe(GALLERY_CROP_POLICY.minimumForegroundPixels);
  });

  it("counts a code that did fire", () => {
    const summary = summariseCodeReachability([CLEAN, { ...CLEAN, touchesPageBoundary: true }]);
    expect(summary.find(({ code }) => code === "touches-page-boundary")).toMatchObject({
      fired: 1,
      closestObserved: 1,
    });
  });

  it("reports null rather than a number when nothing could be observed", () => {
    const summary = summariseCodeReachability([{ ...CLEAN, freeRunnerUpScore: null }]);
    expect(summary.find(({ code }) => code === "ambiguous-component-selection")).toMatchObject({
      closestObserved: null,
    });
    expect(
      summariseCodeReachability([]).every(({ closestObserved }) => closestObserved === null),
    ).toBe(true);
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
    expect(assignment.byLabel.get(0)).toMatchObject({ componentIndex: 7, score: 10 });
    expect(assignment.byLabel.get(1)).toMatchObject({ componentIndex: 8, score: 40 });
  });

  it("splits 383228 from 302028 without the constraint having to bind", () => {
    // Both labels get their own best candidate, so per-label argmax would have
    // returned the same answer. What separates the two plates is the scoring
    // over whole-page components, not the assignment — and the assignment says
    // so, by reporting neither label as outbid.
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 0, score: 79.5 },
      { labelIndex: 0, componentIndex: 1, score: 895.3 },
      { labelIndex: 1, componentIndex: 1, score: 64.65 },
      { labelIndex: 1, componentIndex: 0, score: 154.4 },
    ]);
    expect(assignment.byLabel.get(0)?.componentIndex).toBe(0);
    expect(assignment.byLabel.get(1)?.componentIndex).toBe(1);
    expect(assignment.byLabel.get(0)?.outbidScore).toBeNull();
    expect(assignment.byLabel.get(1)?.outbidScore).toBeNull();
  });

  it("leaves a label unassigned rather than inventing a component for it", () => {
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 3, score: 5 },
      { labelIndex: 1, componentIndex: 3, score: 6 },
    ]);
    expect(assignment.byLabel.has(1)).toBe(false);
  });

  it("reports components no label took, which is where page furniture shows up", () => {
    const assignment = assignGalleryComponents(
      [{ labelIndex: 0, componentIndex: 1, score: 5 }],
      [0, 1, 2],
    );
    expect(assignment.unclaimedComponents).toEqual([0, 2]);
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

  it("offers a free runner-up only among components nobody else took", () => {
    const assignment = assignGalleryComponents([
      { labelIndex: 0, componentIndex: 1, score: 10 },
      { labelIndex: 0, componentIndex: 2, score: 20 },
      { labelIndex: 0, componentIndex: 3, score: 50 },
      { labelIndex: 1, componentIndex: 2, score: 21 },
    ]);
    // Component 2 went to label 1, so label 0's free alternative is 3, not 2.
    expect(assignment.byLabel.get(0)?.freeRunnerUpScore).toBe(50);
  });
});
