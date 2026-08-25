import { describe, expect, it } from "vitest";

import type { InstructionSourceV1, InstructionTextElement } from "./instruction-source";
import {
  assignRegionsToPanels,
  deriveStepPanels,
  deriveStepPanelsForPages,
  indexStepPanelPages,
  panelCellsFor,
  summarizePanels,
} from "./step-panels";

const STEP = 26;
const INSET = 16;
const PAGE_NUMBER = 10;
const PAGE_WIDTH = 765;
const PAGE_HEIGHT = 600;

function element(text: string, heightPt: number, xPt: number, yPt = 400): InstructionTextElement {
  return { text, heightPt, xPt, yPt };
}

function sourceOf(pages: readonly (readonly InstructionTextElement[])[]): InstructionSourceV1 {
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: `sha256:${"0".repeat(64)}`,
    fileName: "fixture.pdf",
    byteLength: 1024,
    pageCount: pages.length,
    pages: pages.map((textElements, index) => ({
      pageNumber: index + 1,
      widthPt: PAGE_WIDTH,
      heightPt: 544,
      text: textElements.map(({ text }) => text).join(" "),
      textElements,
      textTruncated: false,
    })),
    provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
  };
}

describe("panelCellsFor", () => {
  const at = (xPt: number, yPt: number) => ({ xPt, yPt });

  it("gives a single step the whole page", () => {
    expect(panelCellsFor([at(14, 500)], PAGE_WIDTH, PAGE_HEIGHT)).toEqual([
      { minXPt: 0, maxXPt: PAGE_WIDTH, minYPt: 0, maxYPt: PAGE_HEIGHT },
    ]);
  });

  it("starts a column just before its own step number, not midway to it", () => {
    // The number is printed at the top left of its block, so the midpoint
    // between two numbers falls inside the left step's artwork.
    expect(panelCellsFor([at(14, 500), at(387, 500)], PAGE_WIDTH, PAGE_HEIGHT)).toEqual([
      { minXPt: 0, maxXPt: 377, minYPt: 0, maxYPt: PAGE_HEIGHT },
      { minXPt: 377, maxXPt: PAGE_WIDTH, minYPt: 0, maxYPt: PAGE_HEIGHT },
    ]);
  });

  it("splits a stacked pair by row, not into slivers", () => {
    // Two steps in one column, left-aligned to within a point: cutting on x
    // alone made the upper one a slice a couple of points wide.
    const cells = panelCellsFor([at(40, 500), at(41, 200)], PAGE_WIDTH, PAGE_HEIGHT);

    expect(cells[0]).toEqual({ minXPt: 0, maxXPt: PAGE_WIDTH, minYPt: 350, maxYPt: PAGE_HEIGHT });
    expect(cells[1]).toEqual({ minXPt: 0, maxXPt: PAGE_WIDTH, minYPt: 0, maxYPt: 350 });
  });

  it("cuts a stacked pair above the lower step's callout box, not through the art above it", () => {
    // The reader sees callout box, step number, artwork. The midpoint between
    // step numbers falls inside the upper step's artwork; the box does not.
    const box = { minXPt: 30, maxXPt: 200, minYPt: 250, maxYPt: 300 };
    const cells = panelCellsFor([at(40, 500), at(41, 200)], PAGE_WIDTH, PAGE_HEIGHT, [box]);

    expect(cells[0]!.minYPt).toBe(302);
    expect(cells[1]!.maxYPt).toBe(302);
  });

  it("ignores a callout box belonging to another column", () => {
    // A box in the right-hand column must not move the left column's row cut,
    // which falls back to the midpoint between its own two step numbers.
    const farColumn = { minXPt: 600, maxXPt: 700, minYPt: 250, maxYPt: 300 };
    const cells = panelCellsFor([at(40, 500), at(41, 200), at(620, 500)], PAGE_WIDTH, PAGE_HEIGHT, [
      farColumn,
    ]);

    expect(cells[0]!.minYPt).toBe(350);
    expect(cells[1]!.maxYPt).toBe(350);
  });

  it("tiles a two-by-two grid with no gap", () => {
    const cells = panelCellsFor(
      [at(40, 500), at(41, 200), at(400, 500), at(402, 200)],
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell.maxXPt).toBeGreaterThan(cell.minXPt);
      expect(cell.maxYPt).toBeGreaterThan(cell.minYPt);
    }
    // Columns meet, rows meet, and the outside edges reach the page.
    expect(cells[0]!.maxXPt).toBe(cells[2]!.minXPt);
    expect(cells[0]!.minYPt).toBe(cells[1]!.maxYPt);
    expect(cells[0]!.minXPt).toBe(0);
    expect(cells[2]!.maxXPt).toBe(PAGE_WIDTH);
  });

  it("does not depend on the order the labels arrive in", () => {
    const forward = panelCellsFor([at(14, 500), at(387, 500)], PAGE_WIDTH, PAGE_HEIGHT);
    const reversed = panelCellsFor([at(387, 500), at(14, 500)], PAGE_WIDTH, PAGE_HEIGHT);

    expect(reversed[0]).toEqual(forward[1]);
    expect(reversed[1]).toEqual(forward[0]);
  });
});

describe("deriveStepPanels", () => {
  it("reads one panel per step number, in reading order", () => {
    const panels = deriveStepPanels(
      sourceOf([
        [
          element("5", STEP, 14, 417),
          element("6", STEP, 387, 388),
          element("12", PAGE_NUMBER, 14, 14),
        ],
      ]),
      { stepNumberHeightPt: STEP },
    );

    expect(panels.map(({ stepNumber }) => stepNumber)).toEqual([5, 6]);
    expect(panels[0]!.pageNumber).toBe(1);
    expect(panels[0]!.labelYPt).toBe(417);
  });

  it("ignores numbers that are not set in the step size", () => {
    const panels = deriveStepPanels(
      sourceOf([
        [
          element("159", STEP, 14),
          element("1", INSET, 53),
          element("2", INSET, 159),
          element("120", PAGE_NUMBER, 14, 14),
        ],
      ]),
      { stepNumberHeightPt: STEP },
    );

    expect(panels.map(({ stepNumber }) => stepNumber)).toEqual([159]);
  });

  it("gives each step only the quantities printed in its own band", () => {
    const panels = deriveStepPanels(
      sourceOf([
        [
          element("5", STEP, 14),
          element("2x", INSET, 40),
          element("3x", INSET, 60),
          element("6", STEP, 600),
          element("8x", INSET, 620),
        ],
      ]),
      { stepNumberHeightPt: STEP },
    );

    expect(panels[0]!.quantities).toEqual([2, 3]);
    expect(panels[1]!.quantities).toEqual([8]);
  });

  it("skips a page that announces no step at all", () => {
    const panels = deriveStepPanels(
      sourceOf([[element("Available in English", 12, 100)], [element("7", STEP, 14)]]),
      { stepNumberHeightPt: STEP },
    );

    expect(panels).toHaveLength(1);
    expect(panels[0]!.pageNumber).toBe(2);
  });

  it("derives every joint panel on selected pages without materializing the other pages", () => {
    const source = sourceOf([
      [element("1", STEP, 40, 500), element("2", STEP, 41, 200)],
      [element("3", STEP, 40, 500), element("4", STEP, 41, 200)],
      [element("5", STEP, 40, 500)],
    ]);
    const boxes = new Map([[2, [{ minXPt: 30, maxXPt: 200, minYPt: 250, maxYPt: 300 }]]]);
    const full = deriveStepPanels(source, {
      stepNumberHeightPt: STEP,
      calloutBoxesByPage: boxes,
    });
    const selected = deriveStepPanelsForPages(source, [2], {
      stepNumberHeightPt: STEP,
      calloutBoxesByPage: boxes,
    });

    expect(selected).toEqual(full.filter(({ pageNumber }) => pageNumber === 2));
    expect(selected.map(({ stepNumber }) => stepNumber)).toEqual([3, 4]);
    expect(selected[0]!.bounds.minYPt).toBe(302);
    expect(indexStepPanelPages(source, STEP)).toEqual([
      { stepNumber: 1, pageNumber: 1 },
      { stepNumber: 2, pageNumber: 1 },
      { stepNumber: 3, pageNumber: 2 },
      { stepNumber: 4, pageNumber: 2 },
      { stepNumber: 5, pageNumber: 3 },
    ]);
  });

  it("refuses duplicate or absent selected pages", () => {
    const source = sourceOf([[element("1", STEP, 40)], [element("2", STEP, 40)]]);

    expect(() => deriveStepPanelsForPages(source, [1, 1], { stepNumberHeightPt: STEP })).toThrow(
      /unique safe integer/u,
    );
    expect(() => deriveStepPanelsForPages(source, [3], { stepNumberHeightPt: STEP })).toThrow(
      /unique safe integer/u,
    );
  });
});

describe("assignRegionsToPanels", () => {
  const panels = deriveStepPanels(sourceOf([[element("5", STEP, 14), element("6", STEP, 600)]]), {
    stepNumberHeightPt: STEP,
  });

  it("gives a region to the step whose band its centre falls in", () => {
    const assigned = assignRegionsToPanels(panels, [
      { minXPt: 20, maxXPt: 120, minYPt: 0, maxYPt: PAGE_HEIGHT },
      { minXPt: 500, maxXPt: 700, minYPt: 0, maxYPt: PAGE_HEIGHT },
    ]);

    expect(assigned.get(5)).toHaveLength(1);
    expect(assigned.get(6)).toHaveLength(1);
  });

  it("assigns a region straddling the boundary by its middle", () => {
    // Boundary sits at 307; this region spans it but is centred left of it.
    const assigned = assignRegionsToPanels(panels, [
      { minXPt: 200, maxXPt: 400, minYPt: 0, maxYPt: PAGE_HEIGHT },
    ]);

    expect(assigned.get(5)).toHaveLength(1);
    expect(assigned.get(6)).toHaveLength(0);
  });

  it("orphans no region, so nothing on the page is silently dropped", () => {
    const regions = [
      { minXPt: 0, maxXPt: 5, minYPt: 0, maxYPt: PAGE_HEIGHT },
      { minXPt: 760, maxXPt: 765, minYPt: 0, maxYPt: PAGE_HEIGHT },
      { minXPt: 300, maxXPt: 320, minYPt: 0, maxYPt: PAGE_HEIGHT },
    ];
    const assigned = assignRegionsToPanels(panels, regions);
    const total = [...assigned.values()].reduce((sum, list) => sum + list.length, 0);

    expect(total).toBe(regions.length);
  });

  it("returns an entry for every panel, even one with no regions", () => {
    const assigned = assignRegionsToPanels(panels, []);

    expect([...assigned.keys()].sort()).toEqual([5, 6]);
    expect(assigned.get(5)).toEqual([]);
  });
});

describe("summarizePanels", () => {
  it("counts panels, pages and callout pieces", () => {
    const panels = deriveStepPanels(
      sourceOf([
        [element("1", STEP, 14), element("2x", INSET, 40), element("2", STEP, 600)],
        [element("3", STEP, 14), element("3x", INSET, 40)],
      ]),
      { stepNumberHeightPt: STEP },
    );
    const summary = summarizePanels(panels);

    expect(summary.panelCount).toBe(3);
    expect(summary.pagesWithPanels).toBe(2);
    expect(summary.totalQuantityPieces).toBe(5);
    expect(summary.panelsWithoutQuantities).toEqual([2]);
    expect(summary.panelsPerPage).toEqual({ "1": 1, "2": 1 });
  });
});
