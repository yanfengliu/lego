import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it, vi } from "vitest";

import type { HighlightExtraction, HighlightRegionBounds } from "../instructions/highlight-region";
import { BuildTree } from "./build-tree";
import type { PlacementCandidate } from "./enumerate-placements";
import type { StepDeltaScore } from "./step-score";
import { runBacktrackingSearch, type BacktrackingSearchDeps } from "./backtracking-search";
import type { BeamEntry, StepTarget } from "./search-driver";

const BASE = createEmptyBrickDocument({ id: "backtrack", name: "Backtracking fixture" });
const BOX: HighlightRegionBounds = { minXPx: 0, minYPx: 0, maxXPx: 40, maxYPx: 30 };
const SEED: BeamEntry = { nodeId: null, document: BASE, cumulativeScore: 0, stepScores: [] };

function candidate(x: number): PlacementCandidate {
  return {
    catalogPartId: "builtin:brick-2x4",
    transform: { positionLdu: [x, 0, 0], orientationId: "upright-yaw-0" },
    connections: [],
    restsOnBuildPlate: true,
  };
}

function highlight(): HighlightExtraction {
  return {
    schemaVersion: "lego.highlight-region/1",
    width: 40,
    height: 30,
    mask: new Uint8Array(40 * 30),
    strokeMask: new Uint8Array(40 * 30),
    regions: [{ bounds: BOX, outlinePx: 10, enclosedPx: 20, areaPx: 30, leaked: false }],
    keyedPx: 10,
    discardedComponents: 0,
    leakedRegions: 0,
    closedContourRate: 1,
  };
}

function targets(count: number): StepTarget[] {
  return Array.from({ length: count }, (_unused, index) => ({
    stepNumber: index + 1,
    catalogPartId: "builtin:brick-2x4",
    colorId: "builtin:red",
    highlight: highlight(),
  }));
}

function scoreOf(value: number): StepDeltaScore {
  return {
    schemaVersion: "lego.step-delta-score/1",
    regionIou: value,
    strokeRecall: value,
    boundaryPrecision: value,
    strokeF1: value,
    score: value,
    basis: "region",
    candidateAreaPx: 1,
    candidateBoundaryPx: 1,
    strokePx: 1,
  };
}

/** The x values placed so far along this branch, which is its whole history. */
function history(document: BrickDocumentV1): number[] {
  return document.revision
    .split("+")
    .slice(1)
    .map((value) => Number(value));
}

/**
 * A fixture booklet where a step's own picture cannot settle it.
 *
 * Every candidate at every step scores the same, so nothing at the step it is
 * made on distinguishes the right placement from the wrong one — which is what
 * local symmetry looks like. `contradictsAt` names a later step that only has a
 * scoreable candidate when the history reaching it is the one wanted, so the
 * mistake surfaces there and nowhere earlier.
 */
function deps(input: { readonly offers?: readonly number[] } = {}): BacktrackingSearchDeps {
  const offers = input.offers ?? [10, 20, 30];
  return {
    enumerate: () => offers.map(candidate),
    projectBounds: () => BOX,
    renderCandidateMask: () => new Uint8Array(40 * 30),
    score: () => scoreOf(0.9),
    apply: (entry, placement) => ({
      document: {
        ...entry.document,
        revision: `${entry.document.revision}+${placement.transform.positionLdu[0]}`,
      } as BrickDocumentV1,
      nodeId: `node${entry.document.revision}+${placement.transform.positionLdu[0]}`,
    }),
  };
}

/** Wraps deps so a named step scores zero unless its history is the wanted one. */
function withContradiction(
  base: BacktrackingSearchDeps,
  atStepNumber: number,
  wanted: readonly number[],
): BacktrackingSearchDeps {
  let stepBeingScored = 0;
  let pastBeingScored: number[] = [];
  return {
    ...base,
    enumerate: (document, catalogPartId) => {
      pastBeingScored = history(document);
      stepBeingScored = pastBeingScored.length + 1;
      return base.enumerate(document, catalogPartId);
    },
    score: () =>
      stepBeingScored === atStepNumber &&
      wanted.join(",") !== pastBeingScored.slice(0, wanted.length).join(",")
        ? scoreOf(0)
        : scoreOf(0.9),
  };
}

describe("runBacktrackingSearch", () => {
  it("walks a booklet nothing contradicts without reversing once", () => {
    const result = runBacktrackingSearch(SEED, targets(5), deps());
    expect(result.stopReason).toBe("complete");
    expect(result.stepsCompleted).toBe(5);
    expect(result.reversals).toEqual([]);
    expect(result.deepestReversalSteps).toBe(0);
    expect(result.totalStepsUndone).toBe(0);
  });

  it("undoes a placement the step after it contradicts, and says how far back", () => {
    // Step 3 only scores when step 1 placed 20, which its own picture could not
    // have said: every candidate at step 1 scored identically.
    const result = runBacktrackingSearch(SEED, targets(4), withContradiction(deps(), 3, [20]));
    expect(result.stopReason).toBe("complete");
    expect(result.stepsCompleted).toBe(4);
    expect(history(result.entry!.document)[0]).toBe(20);
    expect(result.reversals.length).toBeGreaterThan(0);
    expect(result.deepestReversalSteps).toBeGreaterThanOrEqual(2);
    expect(result.reversals[0]).toMatchObject({ fromStepNumber: 3 });
  });

  it("reaches back past more than one step when the contradiction is older", () => {
    const result = runBacktrackingSearch(
      SEED,
      targets(6),
      withContradiction(deps({ offers: [10, 20] }), 5, [20, 20, 20, 20]),
    );
    expect(result.stopReason).toBe("complete");
    expect(history(result.entry!.document).slice(0, 4)).toEqual([20, 20, 20, 20]);
    expect(result.deepestReversalSteps).toBe(4);
    expect(result.totalStepsUndone).toBeGreaterThanOrEqual(4);
  });

  it("keeps every abandoned branch in the tree rather than deleting it", () => {
    const tree = new BuildTree();
    const base = deps({ offers: [10, 20] });
    const retreat = vi.fn();
    const result = runBacktrackingSearch(
      SEED,
      targets(4),
      {
        ...withContradiction(base, 3, [20]),
        apply: (entry, placement, stepNumber) => {
          const applied = base.apply(entry, placement, stepNumber);
          const node = tree.append(
            entry.nodeId,
            {
              catalogPartId: placement.catalogPartId,
              colorId: "builtin:red",
              transform: placement.transform,
              stepNumber,
            },
            applied.document.revision,
          );
          return { document: applied.document, nodeId: node.node.id };
        },
        retreat: (toEntry, fromStepNumber, toStepNumber) => {
          tree.moveHead(toEntry.nodeId);
          retreat(fromStepNumber, toStepNumber);
        },
      },
      { maxAlternativesPerStep: 2 },
    );
    expect(result.stopReason).toBe("complete");
    expect(retreat).toHaveBeenCalled();
    // The branch through the refused step-1 placement is still reachable, which
    // is what makes a rejected branch counterevidence instead of a gap.
    const roots = tree.children(null);
    expect(roots.map(({ placement }) => placement.transform.positionLdu[0]).sort()).toEqual([
      10, 20,
    ]);
    expect(tree.size).toBeGreaterThan(result.stepsCompleted);
  });

  it("says it exhausted the booklet rather than returning the prefix it held", () => {
    const result = runBacktrackingSearch(SEED, targets(3), {
      ...deps(),
      score: () => scoreOf(0),
    });
    expect(result.stopReason).toBe("exhausted");
    expect(result.stepsCompleted).toBe(0);
    expect(result.entry).toBeNull();
    expect(result.failure).toContain("exhausted every alternative");
  });

  it("stops on its expansion budget instead of truncating quietly", () => {
    const result = runBacktrackingSearch(SEED, targets(40), deps(), { expansionBudget: 5 });
    expect(result.stopReason).toBe("budget-exhausted");
    expect(result.stepsCompleted).toBe(5);
    expect(result.failure).toContain("whole budget of 5");
  });

  it("reports candidates the render budget never reached", () => {
    const result = runBacktrackingSearch(SEED, targets(2), deps({ offers: [1, 2, 3, 4, 5, 6] }), {
      maxRendersPerBranch: 2,
    });
    expect(result.stopReason).toBe("complete");
    expect(result.unrenderedCandidates).toBe(8);
    expect(result.totalRendered).toBe(4);
  });

  it("refuses a zero-scoring placement even when it is the only one offered", () => {
    const result = runBacktrackingSearch(SEED, targets(1), {
      ...deps({ offers: [10] }),
      score: () => scoreOf(0),
    });
    expect(result.stopReason).toBe("exhausted");
  });
});
