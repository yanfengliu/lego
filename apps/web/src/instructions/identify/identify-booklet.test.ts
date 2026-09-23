import { describe, expect, it } from "vitest";

import {
  fakePdfjs,
  SYNTHETIC_STEPS,
  syntheticBooklet,
  type SyntheticPage,
} from "./__fixtures__/synthetic-booklet";
import { identifyBooklet } from "./identify-booklet";
import { IDENTIFY_SCHEMA_VERSION, type IdentifyResult } from "./types";

const BYTES = new Uint8Array([37, 80, 68, 70, 45]);

async function identify(
  pages: readonly SyntheticPage[] = syntheticBooklet(),
): Promise<IdentifyResult> {
  return identifyBooklet(BYTES, { pdfjs: fakePdfjs(pages) });
}

describe("identifyBooklet on a synthetic booklet", () => {
  it("names every callout's element and reconciles the inventory counts", async () => {
    const result = await identify();
    expect(result.schemaVersion).toBe(IDENTIFY_SCHEMA_VERSION);
    expect(result.source).toMatchObject({
      byteLength: BYTES.byteLength,
      pageCount: 3,
      pdfjsVersion: "synthetic",
    });
    expect(result.summary).toMatchObject({
      inventoryElements: 8,
      inventoryPieces: 12,
      inventoryThumbnails: 8,
      callouts: 8,
      calloutPieces: 11,
      stepCallouts: 8,
      calloutsWithPicture: 8,
      drawings: 7,
      calloutsAssigned: 8,
      piecesAssigned: 11,
      elementsExact: 7,
      firstChoiceKept: 8,
      residuals: 0,
    });
    const expected = SYNTHETIC_STEPS.flatMap((callouts, i) =>
      callouts.map(([elementId, count]) => [i + 1, elementId, count]),
    );
    expect(result.callouts.map((c) => [c.step, c.elementId, c.count])).toEqual(expected);
    // The one element no step calls out stays visible as a shortfall, not a guess.
    expect(result.reconciliation.filter((r) => r.assigned !== r.inventory)).toEqual([
      { elementId: "3001008", inventory: 1, assigned: 0 },
    ]);
    expect(result.steps).toEqual([
      {
        step: 1,
        pages: [1],
        elements: { "3001001": 1, "3001002": 1, "3001003": 1 },
        unassignedPieces: 0,
      },
      {
        step: 2,
        pages: [2],
        elements: { "3001001": 1, "3001004": 3, "3001005": 2, "3001006": 1, "3001007": 1 },
        unassignedPieces: 0,
      },
    ]);
  });

  it("tells one shape in two colours apart by colour, and two lengths apart by the fixed scale", async () => {
    const result = await identify();
    const blue = result.callouts.find((c) => c.elementId === "3001002")!;
    const red = blue.candidates.find((c) => c.elementId === "3001001")!;
    expect(red.iou).toBeGreaterThan(0.95);
    expect(blue.score! - red.score).toBeGreaterThan(2);
    const long = result.callouts.find((c) => c.elementId === "3001003")!;
    const short = long.candidates.find((c) => c.elementId === "3001001")!;
    expect(short.iou).toBeLessThan(0.75);
    expect(long.iou!).toBeGreaterThan(0.95);
  });

  it("gives a drawing printed on two pages one key and one element", async () => {
    const result = await identify();
    const red = result.callouts.filter((c) => c.elementId === "3001001");
    expect(red.map((c) => c.page)).toEqual([1, 2]);
    expect(red[0]!.drawing).toMatch(/^sha256:[0-9a-f]{64}@/);
    expect(red[1]!.drawing).toBe(red[0]!.drawing);
  });

  it("returns the same identification for the same bytes, and releases the document", async () => {
    const pdfjs = fakePdfjs(syntheticBooklet());
    const first = await identifyBooklet(BYTES, { pdfjs });
    const second = await identifyBooklet(BYTES, { pdfjs });
    expect(pdfjs.destroyed()).toBe(2);
    // Timings are the one field allowed to differ between two runs.
    const a = { ...first, timingsMs: {} };
    const b = { ...second, timingsMs: {} };
    expect(Object.keys(first).sort()).toEqual([
      "callouts",
      "inventory",
      "parameters",
      "reconciliation",
      "residuals",
      "schemaVersion",
      "source",
      "steps",
      "summary",
      "timingsMs",
    ]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Array.from(BYTES)).toEqual([37, 80, 68, 70, 45]);
  });

  it("refuses a booklet with no parts inventory instead of returning unidentified callouts", async () => {
    const withoutInventory = syntheticBooklet().slice(0, 2);
    await expect(identify(withoutInventory)).rejects.toThrow(
      /no parts inventory.*2 pages.*at least 8 element ids/s,
    );
  });

  it("names the option, the value and the rule when a parameter is out of range", async () => {
    const pdfjs = fakePdfjs(syntheticBooklet());
    await expect(identifyBooklet(BYTES, { pdfjs, calloutScale: 0 })).rejects.toThrow(
      /calloutScale.*0/,
    );
    await expect(identifyBooklet(BYTES, { pdfjs, gridPxPerPt: Number.NaN })).rejects.toThrow(
      /option gridPxPerPt is NaN; it must be a finite non-negative number/,
    );
    await expect(identifyBooklet(BYTES, { pdfjs, candidatesPerDrawing: 1.5 })).rejects.toThrow(
      /candidatesPerDrawing is 1\.5; it must be a whole number from 1 to 64/,
    );
    await expect(identifyBooklet(BYTES, { pdfjs, alignSearchPx: 40 })).rejects.toThrow(
      /alignSearchPx is 40; it must be a whole number from 0 to 16/,
    );
    expect(pdfjs.destroyed()).toBe(0);
  });

  it("refuses empty bytes before reading anything", async () => {
    await expect(identifyBooklet(new Uint8Array(0), { pdfjs: fakePdfjs([]) })).rejects.toThrow(
      "identifyBooklet received an empty PDF; pass the booklet's bytes.",
    );
  });
});
