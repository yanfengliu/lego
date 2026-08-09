import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it, vi } from "vitest";

import type { HighlightExtraction, HighlightRegionBounds } from "../instructions/highlight-region";
import type { PlacementCandidate } from "./enumerate-placements";
import type { StepDeltaScore } from "./step-score";
import {
  advanceBeam,
  highlightBounds,
  runBuildSearch,
  type BeamEntry,
  type SearchDriverDeps,
  type StepTarget,
} from "./search-driver";

const BASE = createEmptyBrickDocument({ id: "search", name: "Search fixture" });

function candidate(x: number): PlacementCandidate {
  return {
    catalogPartId: "builtin:brick-2x4",
    transform: { positionLdu: [x, 0, 0], orientationId: "upright-yaw-0" },
    connections: [],
    restsOnBuildPlate: true,
  };
}

function highlight(bounds: HighlightRegionBounds): HighlightExtraction {
  return {
    schemaVersion: "lego.highlight-region/2",
    width: 40,
    height: 30,
    mask: new Uint8Array(40 * 30),
    strokeMask: new Uint8Array(40 * 30),
    contourStrokeMask: new Uint8Array(40 * 30),
    regions: [{ bounds, outlinePx: 10, enclosedPx: 20, areaPx: 30, leaked: false }],
    keyedPx: 10,
    discardedComponents: 0,
    leakedRegions: 0,
    closedContourRate: 1,
  };
}

const TARGET_BOX: HighlightRegionBounds = { minXPx: 10, minYPx: 10, maxXPx: 20, maxYPx: 20 };

function stepTarget(stepNumber: number): StepTarget {
  return {
    stepNumber,
    catalogPartId: "builtin:brick-2x4",
    colorId: "builtin:red",
    highlight: highlight(TARGET_BOX),
  };
}

const SEED: BeamEntry = { nodeId: null, document: BASE, cumulativeScore: 0, stepScores: [] };

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

/**
 * The truth is that x = 0 is the drawn placement. Candidates project to boxes
 * around their x, so only the ones near the highlight survive the cheap prune,
 * and the score falls off with distance from the truth.
 */
function deps(overrides: Partial<SearchDriverDeps> = {}): SearchDriverDeps {
  return {
    enumerate: () => [candidate(-200), candidate(-20), candidate(0), candidate(20), candidate(400)],
    projectBounds: (_document, placement) => {
      const x = 15 + placement.transform.positionLdu[0] / 4;
      return { minXPx: x - 5, minYPx: 10, maxXPx: x + 5, maxYPx: 20 };
    },
    renderCandidateMask: () => new Uint8Array(40 * 30),
    score: () => scoreOf(0),
    apply: (entry, placement) => ({
      document: {
        ...entry.document,
        revision: `${entry.document.revision}+${placement.transform.positionLdu[0]}`,
      } as BrickDocumentV1,
      nodeId: `node-${placement.transform.positionLdu[0]}`,
    }),
    ...overrides,
  };
}

function scoreByDistance(): SearchDriverDeps["score"] {
  let call = 0;
  const order = [1, 0.9, 0.5, 0.2];
  return () => scoreOf(order[call++ % order.length]!);
}

describe("driving the closed loop", () => {
  it("renders only the candidates the picture localises", () => {
    const renderCandidateMask = vi.fn(() => new Uint8Array(40 * 30));

    const outcome = advanceBeam([SEED], stepTarget(1), deps({ renderCandidateMask }));

    // Five placements enumerated; the two far ones project away from the
    // highlight and cost eight corners each instead of a render.
    expect(outcome.enumerated).toBe(5);
    expect(outcome.prunedByProximity).toBe(2);
    expect(outcome.rendered).toBe(3);
    expect(renderCandidateMask).toHaveBeenCalledTimes(3);
  });

  it("carries several candidates rather than committing to one", () => {
    const outcome = advanceBeam([SEED], stepTarget(1), deps({ score: scoreByDistance() }), {
      beamWidth: 2,
    });

    expect(outcome.beam).toHaveLength(2);
    expect(outcome.beam[0]!.cumulativeScore).toBeGreaterThanOrEqual(
      outcome.beam[1]!.cumulativeScore,
    );
    expect(outcome.failure).toBeNull();
  });

  it("lets a later step kill a branch an earlier one could not separate", () => {
    // Step 1 cannot tell two placements apart; step 2 scores their
    // continuations differently, and the beam keeps only the winner.
    const scores = [0.8, 0.8, 0.8, 0.95, 0.1, 0.1];
    let call = 0;
    const result = runBuildSearch(
      SEED,
      [stepTarget(1), stepTarget(2)],
      deps({ score: () => scoreOf(scores[call++] ?? 0) }),
      { beamWidth: 2 },
    );

    expect(result.failedAtStep).toBeNull();
    expect(result.steps).toHaveLength(2);
    expect(result.beam).toHaveLength(2);
    // The winner's total is the better of the two branches carried forward.
    expect(result.beam[0]!.cumulativeScore).toBeGreaterThan(result.beam[1]!.cumulativeScore);
    expect(result.beam[0]!.stepScores).toHaveLength(2);
  });

  it("says why a step killed the whole beam", () => {
    const outcome = advanceBeam([SEED], stepTarget(7), deps({ enumerate: () => [] }));

    expect(outcome.beam).toEqual([]);
    expect(outcome.failure).toMatch(/Step 7 killed the whole beam/);
    expect(outcome.failure).toMatch(/0 placements of builtin:brick-2x4/);
    expect(outcome.failure).toMatch(/already diverged/);
  });

  it("names the missing localisation when the highlight enclosed nothing", () => {
    const empty = { ...stepTarget(4), highlight: { ...highlight(TARGET_BOX), regions: [] } };

    const outcome = advanceBeam([SEED], empty, deps({ enumerate: () => [] }));

    expect(outcome.failure).toMatch(/highlight enclosed nothing, so nothing localised the search/);
  });

  it("stops at the first step it cannot pass rather than running on", () => {
    let step = 0;
    const result = runBuildSearch(
      SEED,
      [stepTarget(1), stepTarget(2), stepTarget(3)],
      deps({
        enumerate: () => {
          step += 1;
          return step === 2 ? [] : [candidate(0)];
        },
      }),
    );

    expect(result.failedAtStep).toBe(2);
    expect(result.steps).toHaveLength(2);
  });

  it("reports the render budget it would have exceeded instead of spending it", () => {
    const renderCandidateMask = vi.fn(() => new Uint8Array(40 * 30));

    const outcome = advanceBeam([SEED], stepTarget(1), deps({ renderCandidateMask }), {
      maxRendersPerBranch: 2,
    });

    expect(outcome.rendered).toBe(2);
    expect(renderCandidateMask).toHaveBeenCalledTimes(2);
  });

  it("unions every highlight on a step into one box to prune against", () => {
    const two: HighlightExtraction = {
      ...highlight(TARGET_BOX),
      regions: [
        { bounds: TARGET_BOX, outlinePx: 1, enclosedPx: 1, areaPx: 2, leaked: false },
        {
          bounds: { minXPx: 30, minYPx: 2, maxXPx: 35, maxYPx: 8 },
          outlinePx: 1,
          enclosedPx: 1,
          areaPx: 2,
          leaked: false,
        },
      ],
    };

    expect(highlightBounds(two)).toEqual({ minXPx: 10, minYPx: 2, maxXPx: 35, maxYPx: 20 });
    expect(highlightBounds({ ...two, regions: [] })).toBeNull();
  });

  it("refuses an empty beam rather than reporting a vacuous success", () => {
    expect(() => advanceBeam([], stepTarget(1), deps())).toThrowError(
      /Cannot advance an empty beam at step 1/,
    );
    expect(() => advanceBeam([SEED], stepTarget(1), deps(), { beamWidth: 0 })).toThrowError(
      /beamWidth must be a positive integer, received 0/,
    );
  });
});
