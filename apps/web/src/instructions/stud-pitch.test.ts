import { describe, expect, it } from "vitest";

import fixture from "./__fixtures__/booklet-edges.json";
import { estimateStudPitch, splitIntoRuns, type EdgeRun } from "./stud-pitch";

/**
 * A scalloped silhouette: a straight edge at some slope with one rounded bump
 * per stud pushed through it, rounded to whole rows the way a raster is.
 */
function scallopedEdge({
  columns,
  periodPx,
  slope,
  amplitude = 4,
  baseline = 400,
  phase = 0,
  slopeAfter,
}: {
  columns: number;
  periodPx: number;
  slope: number;
  amplitude?: number;
  baseline?: number;
  phase?: number;
  slopeAfter?: number;
}): number[] {
  const corner = Math.floor(columns / 2);
  let height = baseline;
  return Array.from({ length: columns }, (_, x) => {
    if (x > 0) height += slopeAfter !== undefined && x > corner ? slopeAfter : slope;
    const fraction = (((x + phase) % periodPx) + periodPx) % periodPx;
    // Up is a smaller row index, so a bump subtracts.
    return Math.round(height - amplitude * Math.sin((Math.PI * fraction) / periodPx));
  });
}

function straightEdge(columns: number, slope: number, slopeAfter?: number): number[] {
  const edge = { columns, periodPx: 40, slope, amplitude: 0 };
  return scallopedEdge(slopeAfter === undefined ? edge : { ...edge, slopeAfter });
}

const runOf = (rows: readonly number[], startX = 0): EdgeRun => ({ startX, rows });

describe("splitIntoRuns", () => {
  it("cuts at columns the region does not reach", () => {
    const profile = scallopedEdge({ columns: 200, periodPx: 30, slope: 0.3 });
    const runs = splitIntoRuns([...profile, null, null, ...profile]);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.startX).toBe(0);
    expect(runs[1]!.startX).toBe(202);
  });

  it("cuts where the topmost row hands over to another branch of the outline", () => {
    const runs = splitIntoRuns([
      ...straightEdge(150, 0.2),
      ...straightEdge(150, 0.2).map((r) => r + 40),
    ]);
    expect(runs.map(({ rows }) => rows.length)).toEqual([150, 150]);
  });

  it("drops a run too short to carry three of the shortest searched periods", () => {
    expect(splitIntoRuns(straightEdge(20, 0.2))).toHaveLength(0);
  });

  it("keeps a sloped run whole, since slope alone is not a discontinuity", () => {
    expect(splitIntoRuns(straightEdge(400, 2))).toHaveLength(1);
  });
});

describe("estimateStudPitch", () => {
  it("recovers a known period from a sloped scalloped edge", () => {
    const estimate = estimateStudPitch([
      runOf(scallopedEdge({ columns: 800, periodPx: 48, slope: 0.5 })),
    ]);
    expect(estimate.rejected).toBeNull();
    expect(estimate.pitchPx).toBeCloseTo(48, 0);
  });

  it("recovers the period across the zoom range a booklet draws steps at", () => {
    for (const periodPx of [16, 24, 37, 60, 96]) {
      const estimate = estimateStudPitch([
        runOf(scallopedEdge({ columns: periodPx * 14, periodPx, slope: 0.35 })),
      ]);
      expect(estimate.rejected).toBeNull();
      expect(estimate.pitchPx).toBeCloseTo(periodPx, 0);
    }
  });

  /** The failure that sank the first attempt: one linear fit cannot flatten this. */
  it("recovers the period from an edge that turns a corner partway", () => {
    const estimate = estimateStudPitch([
      runOf(scallopedEdge({ columns: 800, periodPx: 40, slope: 0.6, slopeAfter: -0.6 })),
    ]);
    expect(estimate.rejected).toBeNull();
    expect(estimate.pitchPx).toBeCloseTo(40, 0);
  });

  it("reports the fundamental rather than one of its multiples", () => {
    const estimate = estimateStudPitch([
      runOf(scallopedEdge({ columns: 900, periodPx: 30, slope: 0.4 })),
    ]);
    expect(estimate.pitchPx).toBeCloseTo(30, 0);
  });

  it("pools runs from one step onto the same period", () => {
    const estimate = estimateStudPitch([
      runOf(scallopedEdge({ columns: 400, periodPx: 44, slope: 0.5, amplitude: 3 })),
      runOf(
        scallopedEdge({ columns: 500, periodPx: 44, slope: -0.2, amplitude: 7, phase: 11 }),
        500,
      ),
    ]);
    expect(estimate.rejected).toBeNull();
    expect(estimate.pitchPx).toBeCloseTo(44, 0);
  });

  /** A step that adds tiles has no studs to scallop its outline. */
  it("reports no pitch for a smooth outline instead of a plausible constant", () => {
    const estimate = estimateStudPitch([runOf(straightEdge(900, 0.45))]);
    expect(estimate.pitchPx).toBeNull();
    expect(estimate.rejected).not.toBeNull();
  });

  it("reports no pitch for a smooth outline that turns corners", () => {
    const estimate = estimateStudPitch([runOf(straightEdge(900, 0.7, -0.3))]);
    expect(estimate.pitchPx).toBeNull();
  });

  /**
   * Rounding a sloped line into whole rows is exactly periodic — `round(0.45x)`
   * repeats every 20 — so this is the case a bare periodicity test fails.
   */
  it("never answers with a raster staircase, which is what the first attempt did", () => {
    for (const slope of [0.45, 0.5, 0.35, -0.7, 1.2, 0]) {
      const estimate = estimateStudPitch([runOf(straightEdge(900, slope))]);
      expect(estimate.pitchPx).toBeNull();
    }
  });

  it("names what it measured when it refuses, so the refusal can be acted on", () => {
    const tooShort = estimateStudPitch([runOf(straightEdge(20, 0.5))]);
    expect(tooShort.pitchPx).toBeNull();
    expect(tooShort.rejected).toContain("20 columns");

    const staircase = estimateStudPitch([runOf(straightEdge(900, 0.45))]);
    expect(staircase.rejected).toMatch(/\d+(\.\d+)? px|rows|wobble|carries no scallops/);
  });

  it("counts the columns it actually looked at", () => {
    const estimate = estimateStudPitch([
      runOf(scallopedEdge({ columns: 400, periodPx: 40, slope: 0.5 })),
      runOf(scallopedEdge({ columns: 250, periodPx: 40, slope: 0.5 }), 500),
    ]);
    expect(estimate.columnsUsed).toBe(650);
  });
});

/**
 * The synthetic cases above say the estimator works on the signal as imagined.
 * These say it works on the signal as drawn: every profile is a real highlight
 * outline traced out of the sample booklet, and every verdict was set by
 * rendering that region and looking at it.
 */
describe("real booklet edges", () => {
  const edges = fixture.edges as readonly {
    id: string;
    renderScale: number;
    verdict: string;
    profile: (number | null)[];
  }[];

  const pitchOf = (profile: readonly (number | null)[]): number | null =>
    estimateStudPitch(splitIntoRuns(profile)).pitchPx;

  it.each(
    edges.filter(({ verdict }) => verdict === "scalloped").map((edge) => [edge.id, edge] as const),
  )("measures a pitch for %s, whose studs visibly break the outline", (_id, edge) => {
    expect(pitchOf(edge.profile)).not.toBeNull();
  });

  it.each(
    edges.filter(({ verdict }) => verdict === "smooth").map((edge) => [edge.id, edge] as const),
  )("reports no pitch for %s, whose outline is visibly smooth", (_id, edge) => {
    expect(pitchOf(edge.profile)).toBeNull();
  });

  /**
   * The check that cannot be satisfied by accident: the same outline rendered
   * half again as large must give a pitch half again as big. Raster noise does
   * not grow with resolution, so nothing read out of it survives this.
   */
  it("scales the measured pitch with the render scale", () => {
    const checked: string[] = [];
    for (const edge of edges) {
      if (edge.renderScale !== 4 || edge.verdict !== "scalloped") continue;
      const larger = edges.find((other) => other.id === edge.id.replace("@4", "@6"));
      if (!larger) continue;
      const small = pitchOf(edge.profile);
      const large = pitchOf(larger.profile);
      expect(small).not.toBeNull();
      expect(large).not.toBeNull();
      expect(large! / small!).toBeCloseTo(1.5, 1);
      checked.push(edge.id);
    }
    expect(checked.length).toBeGreaterThanOrEqual(3);
  });
});
