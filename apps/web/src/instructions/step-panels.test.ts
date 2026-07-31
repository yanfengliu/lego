import { describe, expect, it } from "vitest";

import type { InstructionSourceV1, InstructionTextElement } from "./instruction-source";
import {
  assignRegionsToPanels,
  deriveStepPanels,
  panelBoundsFor,
  summarizePanels,
} from "./step-panels";

const STEP = 26;
const INSET = 16;
const PAGE_NUMBER = 10;
const PAGE_WIDTH = 765;

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

describe("panelBoundsFor", () => {
  it("gives a single step the whole page", () => {
    expect(panelBoundsFor([14], PAGE_WIDTH)).toEqual([{ minXPt: 0, maxXPt: PAGE_WIDTH }]);
  });

  it("splits two steps at the midpoint between their numbers", () => {
    expect(panelBoundsFor([14, 387], PAGE_WIDTH)).toEqual([
      { minXPt: 0, maxXPt: 200.5 },
      { minXPt: 200.5, maxXPt: PAGE_WIDTH },
    ]);
  });

  it("tiles the page with no gap, so nothing falls outside every panel", () => {
    const bounds = panelBoundsFor([100, 300, 600], PAGE_WIDTH);

    expect(bounds[0]!.minXPt).toBe(0);
    expect(bounds.at(-1)!.maxXPt).toBe(PAGE_WIDTH);
    for (let index = 1; index < bounds.length; index += 1) {
      expect(bounds[index]!.minXPt).toBe(bounds[index - 1]!.maxXPt);
    }
  });

  it("does not depend on the order the labels arrive in", () => {
    expect(panelBoundsFor([387, 14], PAGE_WIDTH)).toEqual(panelBoundsFor([14, 387], PAGE_WIDTH));
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
});

describe("assignRegionsToPanels", () => {
  const panels = deriveStepPanels(sourceOf([[element("5", STEP, 14), element("6", STEP, 600)]]), {
    stepNumberHeightPt: STEP,
  });

  it("gives a region to the step whose band its centre falls in", () => {
    const assigned = assignRegionsToPanels(panels, [
      { minXPt: 20, maxXPt: 120 },
      { minXPt: 500, maxXPt: 700 },
    ]);

    expect(assigned.get(5)).toHaveLength(1);
    expect(assigned.get(6)).toHaveLength(1);
  });

  it("assigns a region straddling the boundary by its middle", () => {
    // Boundary sits at 307; this region spans it but is centred left of it.
    const assigned = assignRegionsToPanels(panels, [{ minXPt: 200, maxXPt: 400 }]);

    expect(assigned.get(5)).toHaveLength(1);
    expect(assigned.get(6)).toHaveLength(0);
  });

  it("orphans no region, so nothing on the page is silently dropped", () => {
    const regions = [
      { minXPt: 0, maxXPt: 5 },
      { minXPt: 760, maxXPt: 765 },
      { minXPt: 300, maxXPt: 320 },
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
