/**
 * A selector that consults the acceptance test only after choosing refuses while
 * holding the answer, and reports the loser's number.
 *
 * `fitStudLattice` ranks candidate lattices and then judges the winner against one
 * residual threshold. While that threshold was consulted only after the ranking,
 * printed step 4 of the sample booklet was refused for two days: its own grid sat
 * second in the list at 43.83px pitch and 0.47% of pitch from an upright
 * axonometric projection, and lost to an index-2 sublattice of itself — the same
 * explained peaks, twice the unit cell, 9.11px and 10% of pitch from any such
 * projection. The message the run printed was the sublattice's residual, so every
 * consumer of it went looking for a reason the panel might not be axonometric at
 * all. When a selector picks among candidates and a gate then judges the pick, the
 * gate is part of the selection whether it is written there or not.
 *
 * The whole-picture cases in `camera-fit-lattice.test.ts` do not hold this: none of
 * their synthetic fields produces a coarser non-axonometric candidate tied with the
 * true grid on the keys above, so moving the acceptance test back below coarseness
 * left all 22 of them green. What is asserted here is the ordering property itself —
 * if any viable candidate passes the acceptance test, the chosen one passes it —
 * over the printed-step-4 pair and over every arrangement of a generated family.
 */

import { describe, expect, it } from "vitest";

import {
  chooseLatticeCandidate,
  type AxonometricSolution,
  type LatticeCandidate,
} from "./camera-fit-lattice";

const MAX_RESIDUAL_FRACTION = 0.02;

function solution(pixelsPerUnit: number, residualFraction: number): AxonometricSolution {
  return {
    azimuthDegrees: 34.71,
    elevationDegrees: 35.01,
    pixelsPerUnit,
    residualPx: residualFraction * pixelsPerUnit,
  };
}

function candidate(fields: {
  readonly label: string;
  readonly pitchPx: number;
  readonly residualFraction: number;
  readonly cellAreaPx: number;
  readonly explainedPeaks: number;
  readonly explainsStrongestPeak?: boolean;
}): LatticeCandidate & { readonly label: string } {
  return {
    label: fields.label,
    basis: {
      a: { xPx: fields.pitchPx, yPx: 0 },
      b: { xPx: 0, yPx: fields.pitchPx },
    },
    solution: solution(fields.pitchPx, fields.residualFraction),
    explainedPeaks: fields.explainedPeaks,
    explainsStrongestPeak: fields.explainsStrongestPeak ?? true,
    cellAreaPx: fields.cellAreaPx,
    coherence: 0.5,
    rejectedBecause: null,
  };
}

function passes(entry: LatticeCandidate): boolean {
  return (
    entry.solution !== null &&
    entry.solution.residualPx <= MAX_RESIDUAL_FRACTION * entry.solution.pixelsPerUnit
  );
}

/** Every ordering of the input, so the answer cannot depend on how the pairs were enumerated. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

describe("the acceptance test is consulted where the candidate is chosen", () => {
  /** Printed step 4 as it was measured, and the sublattice that took it. */
  const PANELS_OWN_GRID = candidate({
    label: "the panel's own grid",
    pitchPx: 43.83,
    residualFraction: 0.0047,
    cellAreaPx: 43.83 * 43.83,
    explainedPeaks: 6,
  });
  const INDEX_TWO_SUBLATTICE = candidate({
    label: "an index-2 sublattice of it",
    pitchPx: 92.19,
    residualFraction: 0.0988,
    cellAreaPx: 2 * 43.83 * 43.83,
    explainedPeaks: 6,
  });

  it("keeps printed step 4's own grid over the coarser lattice that cannot be printed", () => {
    for (const order of permutations([PANELS_OWN_GRID, INDEX_TWO_SUBLATTICE])) {
      const chosen = chooseLatticeCandidate([...order], MAX_RESIDUAL_FRACTION);
      expect(chosen).toBe(PANELS_OWN_GRID);
      expect(passes(chosen)).toBe(true);
    }
    // The loser is coarser and would win a coarseness-first ranking outright, and
    // its residual is the number the panel was refused on.
    expect(INDEX_TWO_SUBLATTICE.cellAreaPx).toBeGreaterThan(PANELS_OWN_GRID.cellAreaPx);
    expect(passes(INDEX_TWO_SUBLATTICE)).toBe(false);
    expect(INDEX_TWO_SUBLATTICE.solution!.residualPx).toBeCloseTo(9.11, 1);
  });

  it("never chooses a candidate the gate refuses while one it admits is on the list", () => {
    const family = [
      candidate({
        label: "coarsest, and not a projection of a square grid",
        pitchPx: 120,
        residualFraction: 0.25,
        cellAreaPx: 14_400,
        explainedPeaks: 6,
      }),
      candidate({
        label: "coarse, and not a projection either",
        pitchPx: 92,
        residualFraction: 0.1,
        cellAreaPx: 8_464,
        explainedPeaks: 6,
      }),
      candidate({
        label: "the answer, and the finest of the three",
        pitchPx: 44,
        residualFraction: 0.005,
        cellAreaPx: 1_936,
        explainedPeaks: 6,
      }),
    ];
    for (const order of permutations(family)) {
      const chosen = chooseLatticeCandidate([...order], MAX_RESIDUAL_FRACTION);
      expect(passes(chosen)).toBe(true);
      expect(chosen.cellAreaPx).toBe(1_936);
    }
  });

  it("still prefers the coarsest lattice among the ones the gate admits", () => {
    const admitted = [
      candidate({
        label: "the grid",
        pitchPx: 44,
        residualFraction: 0.005,
        cellAreaPx: 1_936,
        explainedPeaks: 6,
      }),
      candidate({
        label: "a refinement of it, which explains the same peaks and halves the pitch",
        pitchPx: 22,
        residualFraction: 0.004,
        cellAreaPx: 484,
        explainedPeaks: 6,
      }),
    ];
    for (const order of permutations(admitted)) {
      expect(chooseLatticeCandidate([...order], MAX_RESIDUAL_FRACTION).cellAreaPx).toBe(1_936);
    }
  });

  it("keeps the keys above the acceptance test above it", () => {
    const explainsMore = candidate({
      label: "explains every peak, and is refused by the gate",
      pitchPx: 44,
      residualFraction: 0.3,
      cellAreaPx: 1_936,
      explainedPeaks: 9,
    });
    const explainsFewer = candidate({
      label: "explains three, and passes the gate",
      pitchPx: 44,
      residualFraction: 0.001,
      cellAreaPx: 1_936,
      explainedPeaks: 3,
    });
    // A lattice that misses half the repeats is the wrong lattice however well its
    // own vectors solve, so the acceptance test does not outrank the peak count.
    for (const order of permutations([explainsMore, explainsFewer])) {
      expect(chooseLatticeCandidate([...order], MAX_RESIDUAL_FRACTION)).toBe(explainsMore);
    }
  });
});
