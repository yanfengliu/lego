import { describe, expect, it } from "vitest";

import { scoreAgainstTruth, type TruthIdentity } from "./truth-score";
import type { CalloutIdentification } from "./types";

function callout(
  page: number,
  count: number,
  x: number,
  step: number | null,
  drawing: string,
  elementId: string,
): CalloutIdentification {
  return {
    id: `p${page}|q${count}|x${x.toFixed(3)}|y100.000`,
    page,
    step,
    count,
    bbox: null,
    drawing,
    elementId,
    score: null,
    iou: null,
    firstChoice: null,
    runnerUp: null,
    margin: null,
    candidates: [],
    flags: [],
  };
}

function verdict(
  n: number,
  page: number,
  count: number,
  x: number,
  elementId: string | null,
  same: boolean | null,
): TruthIdentity {
  return { n, page, quantity: count, xPt: x + 0.004, yPt: 100.001, elementId, same };
}

const callouts = [
  callout(1, 1, 10, 1, "sha256:a@1x1", "A"),
  callout(1, 2, 60, 1, "sha256:b@1x1", "B"),
  callout(2, 1, 10, 2, "sha256:a@1x1", "A"),
  callout(2, 1, 60, 2, "composite:60,100", "C"),
  callout(3, 1, 10, 3, "sha256:b@1x1", "X"),
  callout(3, 1, 60, 3, "sha256:d@1x1", "D"),
  callout(9, 1, 10, 9, "sha256:a@1x1", "Z"),
  callout(4, 1, 10, null, "sha256:a@1x1", "Z"),
];

describe("scoreAgainstTruth", () => {
  const score = scoreAgainstTruth(
    { callouts },
    [
      verdict(1, 1, 1, 10, "A", true),
      verdict(2, 1, 2, 60, "B", true),
      verdict(3, 2, 1, 60, "C", true),
      verdict(4, 3, 1, 60, "D", false),
      verdict(5, 7, 1, 10, "A", true),
      verdict(6, 3, 1, 10, null, null),
    ],
    3,
  );

  it("binds verdicts by page, count and label position, and lists the ones it could not bind", () => {
    expect(score).toMatchObject({
      lastStep: 3,
      calloutsInRange: 6,
      piecesInRange: 7,
      verdictsBound: 5,
      verdictsUnbound: [5],
    });
  });

  it("extends a verdict to identical drawings, but never through a composite picture", () => {
    expect(score.direct).toEqual({ callouts: 3, correct: 3 });
    // p2 x10 inherits A from p1's drawing; p3 x10 inherits B and is wrong.
    expect(score.inherited).toEqual({ callouts: 2, correct: 1 });
    expect(score.expanded).toEqual({ callouts: 5, correct: 4, pieces: 6, piecesCorrect: 5 });
    expect(score.misses).toEqual([
      { calloutId: "p3|q1|x10.000|y100.000", step: 3, truth: "B", got: "X", inherited: true },
      { calloutId: "p3|q1|x60.000|y100.000", step: 3, truth: "not D", got: "D", inherited: false },
    ]);
  });

  it("never passes a verdict on through a composite picture's key, even a shared one", () => {
    const shared = "composite:p2@60.000,100.000";
    const composites = scoreAgainstTruth(
      { callouts: [callout(2, 1, 60, 2, shared, "C"), callout(3, 1, 60, 3, shared, "Q")] },
      [verdict(1, 2, 1, 60, "C", true)],
      3,
    );
    expect(composites.inherited).toEqual({ callouts: 0, correct: 0 });
    expect(composites.expanded.callouts).toBe(1);
  });

  it("counts a negative verdict as avoided only when the rejected element was not chosen", () => {
    expect(score.negative).toEqual({ callouts: 1, avoided: 0 });
  });

  it("scores steps by their labelled callouts and by whether every callout carries a label", () => {
    expect(score.steps).toEqual({
      total: 3,
      withLabels: 3,
      allLabelledCorrect: 2,
      fullyLabelled: 2,
      fullyLabelledCorrect: 2,
    });
  });
});
