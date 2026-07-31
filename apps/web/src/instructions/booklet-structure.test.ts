import { describe, expect, it } from "vitest";

import {
  checkBookletConsistency,
  classifyPageTokens,
  extractBookletStructure,
  selectStepNumberHeight,
} from "./booklet-structure";
import type { InstructionSourceV1 } from "./instruction-source";

/** Sizes the sample booklet actually sets these in, in PDF points. */
const STEP = 26;
const INSET = 16;
const PAGE_NUMBER = 10;

type Token = readonly [text: string, heightPt: number];

function sourceOf(pages: readonly (readonly Token[])[]): InstructionSourceV1 {
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: `sha256:${"0".repeat(64)}`,
    fileName: "fixture.pdf",
    byteLength: 1024,
    pageCount: pages.length,
    pages: pages.map((tokens, index) => ({
      pageNumber: index + 1,
      widthPt: 765,
      heightPt: 544,
      text: tokens.map(([text]) => text).join(" "),
      textElements: tokens.map(([text, heightPt]) => ({ text, heightPt, xPt: 0, yPt: 0 })),
      textTruncated: false,
    })),
    provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
  };
}

/** A page carrying one step, its callouts, and the printed page number. */
function page(stepNumber: number, pageNumber: number, quantities: readonly number[] = []): Token[] {
  return [
    ...quantities.map((quantity): Token => [`${quantity}x`, INSET]),
    [String(stepNumber), STEP],
    [String(pageNumber), PAGE_NUMBER],
  ];
}

describe("classifyPageTokens", () => {
  it("separates callout quantities from bare numbers and prose", () => {
    const tokens = classifyPageTokens(12, ["1x", "3x", "5", "6", "12", "Available in English"]);

    expect(tokens.quantities).toEqual([1, 3]);
    expect(tokens.bareNumbers).toEqual([5, 6, 12]);
    expect(tokens.other).toEqual(["Available in English"]);
  });

  it("keeps tokens it cannot classify instead of dropping them", () => {
    const tokens = classifyPageTokens(1, ["®", "21066", "x"]);

    expect(tokens.other).toContain("®");
    expect(tokens.other).toContain("x");
    // A five-digit set number is not a plausible step, so it stays unclassified.
    expect(tokens.bareNumbers).toEqual([]);
    expect(tokens.other).toContain("21066");
  });
});

describe("selectStepNumberHeight", () => {
  it("picks the size whose numbers run 1..N without repeating", () => {
    const height = selectStepNumberHeight([
      { value: 1, pageNumber: 1, heightPt: STEP },
      { value: 2, pageNumber: 2, heightPt: STEP },
      { value: 3, pageNumber: 3, heightPt: STEP },
      { value: 1, pageNumber: 1, heightPt: INSET },
      { value: 1, pageNumber: 2, heightPt: INSET },
      { value: 2, pageNumber: 2, heightPt: INSET },
    ]);

    expect(height).toBe(STEP);
  });

  it("rejects a size that never starts at one", () => {
    expect(
      selectStepNumberHeight([
        { value: 7, pageNumber: 1, heightPt: STEP },
        { value: 9, pageNumber: 2, heightPt: STEP },
      ]),
    ).toBeNull();
    expect(selectStepNumberHeight([])).toBeNull();
  });

  it("prefers the size that accounts for more of the booklet when scores tie", () => {
    const height = selectStepNumberHeight([
      { value: 1, pageNumber: 1, heightPt: STEP },
      { value: 2, pageNumber: 2, heightPt: STEP },
      { value: 1, pageNumber: 1, heightPt: PAGE_NUMBER },
    ]);

    expect(height).toBe(STEP);
  });
});

describe("extractBookletStructure", () => {
  it("reads the step from each page and ignores the printed page number", () => {
    const structure = extractBookletStructure(sourceOf([page(1, 1, [2]), page(2, 2, [3])]));

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(structure.steps[0]!.pageNumber).toBe(1);
    expect(structure.totalCalloutPieces).toBe(5);
  });

  it("carries several steps printed on one page", () => {
    const structure = extractBookletStructure(
      sourceOf([
        [
          ["1x", INSET],
          ["1", STEP],
          ["2", STEP],
          ["1", PAGE_NUMBER],
        ],
        [
          ["3", STEP],
          ["2", PAGE_NUMBER],
        ],
      ]),
    );

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2, 3]);
  });

  it("ignores sub-assembly inset labels set at a smaller size", () => {
    // Page 2 shows a two-part inset numbered 1 and 2 beside step 2, exactly as
    // the sample booklet does.
    const structure = extractBookletStructure(
      sourceOf([
        page(1, 1),
        [
          ["2", STEP],
          ["1", INSET],
          ["1", INSET],
          ["2", INSET],
          ["2", PAGE_NUMBER],
        ],
        page(3, 3),
      ]),
    );
    const consistency = checkBookletConsistency(structure);

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2, 3]);
    expect(consistency.findings).toEqual([]);
    expect(consistency.sequenceContiguous).toBe(true);
  });

  it("orders steps by number, not by the page they were found on", () => {
    const structure = extractBookletStructure(sourceOf([page(2, 1), page(1, 2)]));

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
  });

  it("sums every callout across the booklet", () => {
    const structure = extractBookletStructure(sourceOf([page(1, 1, [2, 3]), page(2, 2, [10])]));

    expect(structure.totalCalloutPieces).toBe(15);
  });

  it("falls back to every bare number when no size explains the numbering", () => {
    const structure = extractBookletStructure(
      sourceOf([
        [
          ["7", STEP],
          ["1", PAGE_NUMBER],
        ],
      ]),
    );

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([7]);
    expect(checkBookletConsistency(structure).findings.map(({ code }) => code)).toContain(
      "STEP_DOES_NOT_START_AT_ONE",
    );
  });
});

describe("checkBookletConsistency", () => {
  it("accepts a contiguous run of steps", () => {
    const consistency = checkBookletConsistency(
      extractBookletStructure(sourceOf([page(1, 1, [1]), page(2, 2, [1]), page(3, 3, [1])])),
    );

    expect(consistency.sequenceContiguous).toBe(true);
    expect(consistency.sequenceCoverage).toBe(1);
    expect(consistency.findings).toEqual([]);
  });

  it("names the first missing step, since a gap means the parse lost one", () => {
    const consistency = checkBookletConsistency(
      extractBookletStructure(sourceOf([page(1, 1), page(2, 2), page(4, 3)])),
    );

    expect(consistency.sequenceContiguous).toBe(false);
    expect(consistency.sequenceCoverage).toBeCloseTo(3 / 4);
    expect(consistency.findings.map(({ code }) => code)).toContain("STEP_SEQUENCE_GAP");
    expect(consistency.findings[0]!.message).toMatch(/1 of 4 steps are missing, starting with 3/);
  });

  it("says so plainly when no steps were recovered at all", () => {
    const consistency = checkBookletConsistency(
      extractBookletStructure(sourceOf([[["hello", 12]]])),
    );

    expect(consistency.stepCount).toBe(0);
    expect(consistency.sequenceCoverage).toBe(0);
    expect(consistency.findings.map(({ code }) => code)).toEqual(["STEP_SEQUENCE_EMPTY"]);
  });

  it("reconciles callouts against a declared piece count when one is known", () => {
    const structure = extractBookletStructure(sourceOf([page(1, 1, [2]), page(2, 2, [3])]));

    expect(checkBookletConsistency(structure, 5).pieceCountMatches).toBe(true);
    const wrong = checkBookletConsistency(structure, 9);
    expect(wrong.pieceCountMatches).toBe(false);
    expect(wrong.findings.map(({ message }) => message)).toContain(
      "Callouts add up to 5 pieces but the set declares 9",
    );
  });

  it("leaves the piece-count verdict unset when no count was supplied", () => {
    const structure = extractBookletStructure(sourceOf([page(1, 1, [1])]));

    expect(checkBookletConsistency(structure).pieceCountMatches).toBeNull();
  });
});
