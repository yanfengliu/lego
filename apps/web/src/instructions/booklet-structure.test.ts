import { describe, expect, it } from "vitest";

import {
  checkBookletConsistency,
  classifyPageTokens,
  extractBookletStructure,
} from "./booklet-structure";
import type { InstructionSourceV1 } from "./instruction-source";

function sourceOf(pages: readonly (readonly string[])[]): InstructionSourceV1 {
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: `sha256:${"0".repeat(64)}`,
    fileName: "fixture.pdf",
    byteLength: 1024,
    pageCount: pages.length,
    pages: pages.map((items, index) => ({
      pageNumber: index + 1,
      widthPt: 765,
      heightPt: 544,
      text: items.join(" "),
      textItems: items,
      textTruncated: false,
    })),
    provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
  };
}

describe("classifyPageTokens", () => {
  it("separates callout quantities from bare numbers and prose", () => {
    const tokens = classifyPageTokens(12, ["1x", "3x", "5", "6", "12", "Available in English"]);

    expect(tokens.quantities).toEqual([1, 3]);
    expect(tokens.bareNumbers).toEqual([5, 6, 12]);
    expect(tokens.other).toEqual(["Available in English"]);
  });

  it("keeps tokens it cannot classify instead of dropping them", () => {
    const tokens = classifyPageTokens(1, ["®", "21066", "x", "2 x"]);

    expect(tokens.other).toContain("®");
    expect(tokens.other).toContain("x");
    // A five-digit set number is not a plausible step, so it stays unclassified.
    expect(tokens.bareNumbers).toEqual([]);
    expect(tokens.other).toContain("21066");
  });
});

describe("extractBookletStructure", () => {
  it("reads a step per page, ignoring the printed page number", () => {
    // Page 1 prints step 1; page 2 prints step 2; each prints its page number.
    const structure = extractBookletStructure(
      sourceOf([
        ["2x", "1", "1"],
        ["3x", "2", "2"],
      ]),
    );

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(structure.steps[0]!.pageNumber).toBe(1);
    expect(structure.totalCalloutPieces).toBe(5);
  });

  it("carries several steps printed on one page", () => {
    const structure = extractBookletStructure(sourceOf([["1x", "5", "1x", "6", "1"]]));

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([5, 6]);
  });

  it("orders steps by number, not by the page they were found on", () => {
    const structure = extractBookletStructure(
      sourceOf([
        ["9", "1"],
        ["4", "2"],
      ]),
    );

    expect(structure.steps.map(({ stepNumber }) => stepNumber)).toEqual([4, 9]);
  });

  it("sums every callout across the booklet", () => {
    const structure = extractBookletStructure(
      sourceOf([
        ["2x", "3x", "1"],
        ["10x", "2"],
      ]),
    );

    expect(structure.totalCalloutPieces).toBe(15);
  });
});

describe("checkBookletConsistency", () => {
  it("accepts a contiguous run of steps", () => {
    const structure = extractBookletStructure(
      sourceOf([
        ["1x", "1", "1"],
        ["1x", "2", "2"],
        ["1x", "3", "3"],
      ]),
    );
    const consistency = checkBookletConsistency(structure);

    expect(consistency.sequenceContiguous).toBe(true);
    expect(consistency.sequenceCoverage).toBe(1);
    expect(consistency.findings).toEqual([]);
  });

  it("names the first missing step, since a gap means the parse lost one", () => {
    const structure = extractBookletStructure(
      sourceOf([
        ["1", "1"],
        ["2", "2"],
        ["4", "3"],
      ]),
    );
    const consistency = checkBookletConsistency(structure);

    expect(consistency.sequenceContiguous).toBe(false);
    expect(consistency.sequenceCoverage).toBeCloseTo(3 / 4);
    expect(consistency.findings.map(({ code }) => code)).toContain("STEP_SEQUENCE_GAP");
    expect(consistency.findings[0]!.message).toMatch(/1 of 4 steps are missing, starting with 3/);
  });

  it("reports a repeated step number, which is how inset labels betray themselves", () => {
    const structure = extractBookletStructure(
      sourceOf([
        ["1", "1"],
        ["2", "1", "2"],
      ]),
    );
    const consistency = checkBookletConsistency(structure);

    expect(consistency.findings.map(({ code }) => code)).toContain("STEP_SEQUENCE_DUPLICATE");
  });

  it("reports a booklet whose steps do not begin at one", () => {
    const structure = extractBookletStructure(sourceOf([["7", "1"]]));

    expect(checkBookletConsistency(structure).findings.map(({ code }) => code)).toContain(
      "STEP_DOES_NOT_START_AT_ONE",
    );
  });

  it("says so plainly when no steps were recovered at all", () => {
    const consistency = checkBookletConsistency(extractBookletStructure(sourceOf([["hello"]])));

    expect(consistency.stepCount).toBe(0);
    expect(consistency.sequenceCoverage).toBe(0);
    expect(consistency.findings.map(({ code }) => code)).toEqual(["STEP_SEQUENCE_EMPTY"]);
  });

  it("reconciles callouts against a declared piece count when one is known", () => {
    const structure = extractBookletStructure(
      sourceOf([
        ["2x", "1", "1"],
        ["3x", "2", "2"],
      ]),
    );

    expect(checkBookletConsistency(structure, 5).pieceCountMatches).toBe(true);
    const wrong = checkBookletConsistency(structure, 9);
    expect(wrong.pieceCountMatches).toBe(false);
    expect(wrong.findings.map(({ message }) => message)).toContain(
      "Callouts add up to 5 pieces but the set declares 9",
    );
  });

  it("leaves the piece-count verdict unset when no count was supplied", () => {
    const structure = extractBookletStructure(sourceOf([["1x", "1", "1"]]));

    expect(checkBookletConsistency(structure).pieceCountMatches).toBeNull();
  });
});
