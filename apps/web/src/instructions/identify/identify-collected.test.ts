import { describe, expect, it } from "vitest";

import type { Collected, CollectedCallout, CollectedInventory } from "./collect";
import { DEFAULT_PARAMETERS, identifyCollected } from "./identify-booklet";
import type { Picture } from "./pictures";
import { assertWithinInventory, report } from "./report";
import type { CalloutIdentification, IdentifyResult } from "./types";

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

/** The one rule a report may never break, whatever the pictures: no element spent past its count. */
function expectWithinInventory(result: Pick<IdentifyResult, "reconciliation">): void {
  const over = result.reconciliation.filter((r) => r.assigned > r.inventory);
  expect(over).toEqual([]);
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
    expect(result.summary).toMatchObject({
      forcedByCapacity: { calloutsAssigned: 2 },
      firstChoiceKept: 1,
      residuals: 1,
    });
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

  /**
   * Gate for the double-count class: identical drawings are one demand whose
   * pieces are summed. Bound: one drawing repeated three times against a count of
   * two. In the review of 71f2f55, a demand taken from one callout instead of the
   * sum passed all 67 tests while element 242026 was reported 27 of 13.
   */
  it("gives a drawing repeated past its element's count nothing, never more than the inventory holds", () => {
    const result = identifyCollected(
      collected(inventory, [
        callout(1, 1, block(12, 36, GREEN, "g")),
        callout(2, 1, block(12, 36, GREEN, "g")),
        callout(3, 1, block(12, 36, GREEN, "g")),
      ]),
      DEFAULT_PARAMETERS,
    );
    expectWithinInventory(result);
    expect(result.callouts.map((c) => [c.elementId, c.flags.includes("unassigned")])).toEqual([
      [null, true],
      [null, true],
      [null, true],
    ]);
    expect(result.reconciliation.find((r) => r.elementId === "green")!.assigned).toBe(0);
    expect(result.summary.forcedByCapacity).toEqual({
      calloutsAssigned: 0,
      piecesAssigned: 0,
      elementsExact: 0,
    });
  });

  it("marks a callout the inventory cannot cover as unassigned and keeps its pieces out of the totals", () => {
    const result = identifyCollected(
      collected(inventory, [callout(1, 3, block(12, 36, GREEN, "g"))]),
      DEFAULT_PARAMETERS,
    );
    const [only] = result.callouts;
    expect(only).toMatchObject({ elementId: null, firstChoice: { elementId: "green" } });
    expect(only!.flags).toContain("unassigned");
    expect(result.steps).toEqual([{ step: 1, pages: [1], elements: {}, unassignedPieces: 3 }]);
    expect(result.reconciliation.find((r) => r.elementId === "green")!.assigned).toBe(0);
    expect(result.summary).toMatchObject({
      forcedByCapacity: { calloutsAssigned: 0, piecesAssigned: 0 },
      residuals: 1,
    });
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
    expect(result.summary).toMatchObject({
      stepCallouts: 0,
      forcedByCapacity: { calloutsAssigned: 0 },
      residuals: 0,
    });
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

  it("flags the callouts whose element the search ran out of nodes to prove", () => {
    const pair = [
      element("red", 1, block(30, 15, RED, null)),
      element("orange", 1, block(30, 15, ORANGE, null)),
    ];
    const twice = [callout(1, 1, block(30, 15, RED, "x")), callout(2, 1, block(30, 15, RED, "x"))];
    // No element holds both pieces; the fractional optimum puts one on each.
    const settled = identifyCollected(collected(pair, twice), DEFAULT_PARAMETERS);
    expect(settled.assignment).toMatchObject({ provenOptimal: true });
    expect(settled.callouts.every((c) => !c.flags.includes("assignment-unproven"))).toBe(true);
    const cut = identifyCollected(collected(pair, twice), DEFAULT_PARAMETERS, {
      maxAssignmentNodes: 1,
    });
    expect(cut.assignment).toMatchObject({ provenOptimal: false, nodes: 1 });
    expect(cut.callouts.map((c) => c.flags)).toEqual([
      ["unassigned", "assignment-unproven"],
      ["unassigned", "assignment-unproven"],
    ]);
    expect(cut.summary.residuals).toBe(2);
  });

  it("reports what the text layer said: unpaired ids, overprints, multipliers and the step run", () => {
    const step = (value: number) => ({ page: value, step: value, xPt: 0, yPt: 0, sizePt: 20 });
    const result = identifyCollected(
      {
        ...collected(inventory, []),
        unpairedElementIds: [{ elementId: "3009999", page: 9 }],
        duplicateRuns: 4,
        otherSizeCountLabels: 2,
        stepNumbers: [step(1), step(2), step(2), step(4)],
      },
      DEFAULT_PARAMETERS,
    );
    expect(result.text).toEqual({
      inventoryPages: [9],
      unpairedElementIds: [{ elementId: "3009999", page: 9 }],
      calloutLabelSizePt: 8,
      overprintsDropped: 4,
      otherSizeCountLabels: 2,
      stepNumbers: 4,
      lastStep: 4,
      missingSteps: [3],
      repeatedSteps: [2],
    });
  });

  it("refuses two callouts sharing one composite picture's key, naming both", () => {
    const shared = "composite:p5@50.000,100.000";
    expect(() =>
      identifyCollected(
        collected(inventory, [
          callout(1, 1, block(30, 15, RED, shared)),
          callout(2, 1, block(12, 36, GREEN, shared)),
        ]),
        DEFAULT_PARAMETERS,
      ),
    ).toThrow(
      /Callouts p1\|q1\|x\d+\.000\|y100\.000 and p2\|q1\|x\d+\.000\|y100\.000 share the composite drawing key "composite:p5@50\.000,100\.000"/,
    );
  });
});

describe("assertWithinInventory", () => {
  const spent = (id: string, elementId: string): CalloutIdentification => ({
    id,
    page: 1,
    step: 1,
    count: 1,
    bbox: null,
    drawing: null,
    elementId,
    score: null,
    iou: null,
    firstChoice: null,
    runnerUp: null,
    margin: null,
    candidates: [],
    flags: [],
  });

  it("is what report() runs: a report spending an element past its count is refused, not printed", () => {
    const three = ["p1|q1|x1.000|y1.000", "p2|q1|x1.000|y1.000", "p3|q1|x1.000|y1.000"];
    expect(() =>
      report(
        three.map((id) => spent(id, "A")),
        [],
        new Map([["A", 2]]),
      ),
    ).toThrow(
      /^identifyBooklet assigned 3 pieces of element A, but the inventory prints 2, by callouts p1/,
    );
    expect(() =>
      report(
        three.slice(0, 2).map((id) => spent(id, "A")),
        [],
        new Map([["A", 2]]),
      ),
    ).not.toThrow();
  });

  it("stops a report that spends an element past its count, naming the element and its callouts", () => {
    const callouts = [spent("p1|q2|x1.000|y1.000", "A"), spent("p2|q1|x1.000|y1.000", "A")];
    expect(() => assertWithinInventory(new Map([["A", 3]]), new Map([["A", 2]]), callouts)).toThrow(
      "identifyBooklet assigned 3 pieces of element A, but the inventory prints 2, by callouts p1|q2|x1.000|y1.000, p2|q1|x1.000|y1.000. The assignment never spends past an element's count, so the report disagrees with it: a defect in apps/web/src/instructions/identify, not in the booklet.",
    );
    expect(() =>
      assertWithinInventory(new Map([["A", 2]]), new Map([["A", 2]]), callouts),
    ).not.toThrow();
    expect(() => assertWithinInventory(new Map([["B", 1]]), new Map(), [])).toThrow(
      /element B, but the inventory prints 0/,
    );
  });
});
