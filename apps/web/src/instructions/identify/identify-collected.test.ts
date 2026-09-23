import { describe, expect, it } from "vitest";

import type { Collected, CollectedCallout, CollectedInventory } from "./collect";
import { DEFAULT_PARAMETERS, identifyCollected } from "./identify-booklet";
import type { Picture } from "./pictures";

type Rgb = readonly [number, number, number];

function block(width: number, height: number, rgb: Rgb, drawing: string | null): Picture {
  const mask = new Uint8Array(width * height).fill(1);
  const colours = new Uint8Array(width * height * 3);
  for (let p = 0; p < width * height; p += 1) {
    const shade = Math.floor(p / width) < height * 0.3 ? 1.2 : 1;
    for (let c = 0; c < 3; c += 1) colours[p * 3 + c] = Math.min(255, Math.round(rgb[c]! * shade));
  }
  return {
    bbox: { x0: 0, y0: 0, x1: width / 3, y1: height / 3 },
    width,
    height,
    mask,
    rgb: colours,
    drawing,
    flags: [],
  };
}

function element(elementId: string, count: number, picture: Picture | null): CollectedInventory {
  return { label: { page: 9, count, xPt: 0, yPt: 0, sizePt: 7, widthPt: 7, elementId }, picture };
}

let nextX = 0;
function callout(step: number | null, count: number, picture: Picture | null): CollectedCallout {
  nextX += 50;
  const label = { page: step ?? 5, count, xPt: nextX, yPt: 100, sizePt: 8, widthPt: 8 };
  return { label, box: null, step, picture };
}

function collected(inventory: CollectedInventory[], callouts: CollectedCallout[]): Collected {
  return {
    pageCount: 9,
    inventoryPages: [9],
    unpairedElementIds: [],
    inventory,
    callouts,
    labelSizePt: 8,
    duplicateRuns: 0,
    otherSizeCountLabels: 0,
    stepNumbers: [],
    timingsMs: {},
  };
}

const RED: Rgb = [200, 40, 40];
const ORANGE: Rgb = [215, 90, 40];
const REDDISH: Rgb = [205, 55, 40];
const GREEN: Rgb = [40, 160, 80];

describe("identifyCollected", () => {
  const inventory = [
    element("red", 1, block(30, 15, RED, null)),
    element("orange", 1, block(30, 15, ORANGE, null)),
    element("green", 2, block(12, 36, GREEN, null)),
  ];

  it("lets the inventory count overrule the visual first choice, and flags the callout it moved", () => {
    const result = identifyCollected(
      collected(inventory, [
        callout(1, 1, block(30, 15, RED, "x")),
        callout(2, 1, block(30, 15, REDDISH, "y")),
      ]),
      DEFAULT_PARAMETERS,
    );
    const [x, y] = result.callouts;
    expect(x).toMatchObject({ elementId: "red", flags: [] });
    expect(y!.firstChoice!.elementId).toBe("red");
    expect(y!.elementId).toBe("orange");
    expect(y!.flags).toEqual(["conflict", "low-margin"]);
    expect(y!.margin!).toBeLessThan(0);
    expect(result.summary).toMatchObject({ calloutsAssigned: 2, firstChoiceKept: 1, residuals: 1 });
    expect(result.residuals).toEqual([
      expect.objectContaining({
        calloutId: y!.id,
        elementId: "orange",
        flags: ["conflict", "low-margin"],
      }),
    ]);
  });

  it("merges identical drawings into one demand and gives them one element", () => {
    const result = identifyCollected(
      collected(inventory, [
        callout(1, 1, block(12, 36, GREEN, "g")),
        callout(3, 1, block(12, 36, GREEN, "g")),
      ]),
      DEFAULT_PARAMETERS,
    );
    expect(result.callouts.map((c) => c.elementId)).toEqual(["green", "green"]);
    expect(result.reconciliation.find((r) => r.elementId === "green")).toEqual({
      elementId: "green",
      inventory: 2,
      assigned: 2,
    });
    expect(result.steps.map((s) => s.step)).toEqual([1, 3]);
  });

  it("marks a callout the inventory cannot cover as unassigned and keeps its pieces out of the totals", () => {
    const result = identifyCollected(
      collected(inventory, [callout(1, 3, block(12, 36, GREEN, "g"))]),
      DEFAULT_PARAMETERS,
    );
    const [only] = result.callouts;
    expect(only!.flags).toContain("unassigned");
    expect(result.steps).toEqual([{ step: 1, pages: [1], elements: {}, unassignedPieces: 3 }]);
    expect(result.reconciliation.find((r) => r.elementId === "green")!.assigned).toBe(0);
    expect(result.summary).toMatchObject({ calloutsAssigned: 0, piecesAssigned: 0, residuals: 1 });
  });

  it("names a callout outside any step by its first choice without spending inventory", () => {
    const result = identifyCollected(
      collected(inventory, [callout(null, 4, block(30, 15, RED, "x"))]),
      DEFAULT_PARAMETERS,
    );
    expect(result.callouts[0]).toMatchObject({
      step: null,
      elementId: "red",
      flags: ["outside-step"],
    });
    expect(result.summary).toMatchObject({ stepCallouts: 0, calloutsAssigned: 0, residuals: 0 });
    expect(result.reconciliation.every((r) => r.assigned === 0)).toBe(true);
  });

  it("lists a callout without a picture as a residual with no candidates", () => {
    const result = identifyCollected(
      collected(inventory, [callout(1, 1, null)]),
      DEFAULT_PARAMETERS,
    );
    expect(result.callouts[0]).toMatchObject({
      elementId: null,
      bbox: null,
      candidates: [],
      flags: ["no-picture"],
    });
    expect(result.residuals).toEqual([
      expect.objectContaining({ flags: ["no-picture"], candidates: [] }),
    ]);
    expect(result.summary.calloutsWithPicture).toBe(0);
  });

  it("flags an inventory element whose thumbnail was not found", () => {
    const result = identifyCollected(
      collected([...inventory, element("ghost", 1, null)], []),
      DEFAULT_PARAMETERS,
    );
    expect(result.inventory.find((e) => e.elementId === "ghost")).toMatchObject({
      bbox: null,
      flags: ["no-picture"],
    });
    expect(result.summary).toMatchObject({ inventoryElements: 4, inventoryThumbnails: 3 });
  });
});
