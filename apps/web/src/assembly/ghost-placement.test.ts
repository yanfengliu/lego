import { describe, expect, it } from "vitest";

import { dilateMask } from "@lego-studio/rendering";

import {
  decideExplodedGhostPlacement,
  GhostPlacementError,
  measureGhostContainment,
} from "./ghost-placement";

const WIDTH = 64;
const HEIGHT = 64;

function rectangle(x: number, y: number, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let row = y; row < y + h; row += 1) {
    for (let column = x; column < x + w; column += 1) {
      mask[row * WIDTH + column] = 1;
    }
  }
  return mask;
}

/**
 * The booklet's own drawing convention, as it was measured.
 *
 * On printed step 2 of the sample booklet the yellow sits about five work pixels
 * clear of the part all the way round — dilating the drawn ghost's silhouette
 * peaks against the printed region at radius 5. So a printed region is the
 * silhouette grown, and a ghost drawn where the booklet drew it has no pixel
 * outside it.
 */
const GHOST = rectangle(20, 20, 12, 10);
const PRINTED_REGION = dilateMask(GHOST, WIDTH, HEIGHT, 5);

describe("measureGhostContainment", () => {
  it("scores a wholly contained ghost at exactly the panel's own ceiling", () => {
    const measured = measureGhostContainment(GHOST, PRINTED_REGION);
    expect(measured.contained).toBe(true);
    expect(measured.outsideRegionPx).toBe(0);
    // Not a threshold and not a coincidence: a ghost inside the region
    // intersects in all of itself and unions to the whole region, so its IoU is
    // its own area over the region's. The ceiling is derived from the two masks
    // rather than supplied, which is why it can be compared against.
    expect(measured.regionIou).toBe(measured.containmentCeiling);
    expect(measured.ghostPx).toBe(measured.insideRegionPx);
  });

  it("cannot reach the ceiling once any pixel spills outside", () => {
    const spilled = measureGhostContainment(rectangle(20, 12, 12, 10), PRINTED_REGION);
    expect(spilled.contained).toBe(false);
    expect(spilled.outsideRegionPx).toBeGreaterThan(0);
    expect(spilled.regionIou).toBeLessThan(spilled.containmentCeiling);
  });

  it("reports the ceiling as a fact about the panel, not about the placement", () => {
    // Two placements of the same part reach the same ceiling and different
    // agreements; a bar that ignores the ceiling is reading the panel.
    const here = measureGhostContainment(GHOST, PRINTED_REGION);
    const elsewhere = measureGhostContainment(rectangle(28, 26, 12, 10), PRINTED_REGION);
    expect(elsewhere.containmentCeiling).toBeCloseTo(here.containmentCeiling, 12);
    expect(elsewhere.regionIou).toBeLessThan(here.regionIou);
    expect(here.containmentCeiling).toBeLessThan(1);
  });

  it("counts the already-built art the prediction assumed was not there", () => {
    const built = rectangle(24, 22, 4, 4);
    expect(measureGhostContainment(GHOST, PRINTED_REGION, built).overlapsBuiltPx).toBe(16);
    expect(measureGhostContainment(GHOST, PRINTED_REGION).overlapsBuiltPx).toBe(0);
  });

  it("names a raster mismatch rather than comparing across sizes", () => {
    expect(() => measureGhostContainment(GHOST, new Uint8Array(16))).toThrow(GhostPlacementError);
    expect(() => measureGhostContainment(GHOST, PRINTED_REGION, new Uint8Array(16))).toThrow(
      /already-built mask holds 16 pixels/,
    );
  });
});

describe("decideExplodedGhostPlacement", () => {
  const score = (subject: string, mask: Uint8Array) => ({
    subject,
    containment: measureGhostContainment(mask, PRINTED_REGION),
  });

  it("names the one candidate the printed contour contains", () => {
    const decision = decideExplodedGhostPlacement([
      score("spilled", rectangle(20, 12, 12, 10)),
      score("drawn", GHOST),
      score("far", rectangle(2, 2, 12, 10)),
    ]);
    expect(decision.containedCount).toBe(1);
    expect(decision.winner?.subject).toBe("drawn");
    expect(decision.best?.subject).toBe("drawn");
    expect(decision.ranked.map(({ subject }) => subject)).toStrictEqual([
      "drawn",
      "spilled",
      "far",
    ]);
  });

  it("refuses to name one when the drawing fits several", () => {
    // The structural limit, not a tuning failure: a ghost drawn clear of the
    // assembly says where the part is drawn, and several seats can be drawn
    // there. Shifting inside the printed contour keeps containment.
    const decision = decideExplodedGhostPlacement([
      score("drawn", GHOST),
      score("also-inside", rectangle(21, 21, 12, 10)),
    ]);
    expect(decision.containedCount).toBe(2);
    expect(decision.winner).toBeNull();
    expect(decision.best).not.toBeNull();
    expect(decision.runnerUp).not.toBeNull();
  });

  it("refuses when nothing the panel offers fits, and says so separately", () => {
    const decision = decideExplodedGhostPlacement([
      score("spilled", rectangle(20, 12, 12, 10)),
      score("far", rectangle(2, 2, 12, 10)),
    ]);
    expect(decision.containedCount).toBe(0);
    expect(decision.winner).toBeNull();
    expect(decision.best?.subject).toBe("spilled");
  });

  it("has nothing to say about an empty field", () => {
    const decision = decideExplodedGhostPlacement<string>([]);
    expect(decision.winner).toBeNull();
    expect(decision.best).toBeNull();
    expect(decision.runnerUp).toBeNull();
    expect(decision.containedCount).toBe(0);
  });
});
