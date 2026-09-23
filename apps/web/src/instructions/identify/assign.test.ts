import { describe, expect, it } from "vitest";

import { assignDrawings, type Demand, type Supply } from "./assign";

const MAX_SCORE = 1.5;

function demand(key: string, quantity: number, scores: Record<string, number>): Demand {
  return {
    key,
    quantity,
    candidates: Object.entries(scores).map(([elementId, score]) => ({ elementId, score })),
  };
}

function supplies(capacities: Record<string, number>): Supply[] {
  return Object.entries(capacities).map(([elementId, capacity]) => ({ elementId, capacity }));
}

function placed(
  result: ReturnType<typeof assignDrawings>,
): Record<string, [string | null, number]> {
  return Object.fromEntries(
    [...result.placements].map(([key, p]) => [key, [p.elementId, p.placed]]),
  );
}

describe("assignDrawings", () => {
  it("finds the cheapest whole assignment, not the greedy one", () => {
    // Greedy gives X its best element A and leaves Y with B at 0.1; the optimum swaps them.
    const result = assignDrawings(
      [demand("X", 1, { A: 0.9, B: 0.8 }), demand("Y", 1, { A: 0.85, B: 0.1 })],
      supplies({ A: 1, B: 1 }),
      MAX_SCORE,
    );
    expect(placed(result)).toEqual({ X: ["B", 1], Y: ["A", 1] });
    expect(result.totalCost).toBe(700 + 650);
  });

  it("spends each element at most its inventory count and reports the pieces left over", () => {
    const result = assignDrawings([demand("X", 3, { A: 1.2 })], supplies({ A: 2 }), MAX_SCORE);
    expect(placed(result)).toEqual({ X: ["A", 2] });
  });

  it("keeps a drawing on one element rather than splitting its pieces across two", () => {
    const result = assignDrawings(
      [demand("X", 2, { A: 0.9, B: 0.8 })],
      supplies({ A: 1, B: 1 }),
      MAX_SCORE,
    );
    expect(placed(result)).toEqual({ X: ["A", 1] });
    expect(result.splitsRepaired).toBe(1);
  });

  it("moves a whole drawing when that frees an element another drawing needs more", () => {
    const result = assignDrawings(
      [demand("X", 2, { A: 1.1, B: 1.0 }), demand("Y", 1, { A: 1.2, B: 0.2 })],
      supplies({ A: 2, B: 2 }),
      MAX_SCORE,
    );
    expect(placed(result)).toEqual({ X: ["B", 2], Y: ["A", 1] });
  });

  it("ignores candidates that are not in the inventory", () => {
    const result = assignDrawings(
      [demand("X", 1, { Z: 1.4, A: 0.5 })],
      supplies({ A: 1 }),
      MAX_SCORE,
    );
    expect(placed(result)).toEqual({ X: ["A", 1] });
  });

  it("leaves a drawing with no usable candidate unplaced", () => {
    const result = assignDrawings([demand("X", 1, { Z: 1.4 })], supplies({ A: 1 }), MAX_SCORE);
    expect(placed(result)).toEqual({ X: [null, 0] });
  });

  it("names the drawing when the demands are malformed", () => {
    expect(() => assignDrawings([demand("X", 1, {}), demand("X", 2, {})], [], MAX_SCORE)).toThrow(
      'Assignment received drawing "X" twice; merge its callouts into one demand.',
    );
    expect(() => assignDrawings([demand("Y", 1.5, {})], [], MAX_SCORE)).toThrow(
      'Drawing "Y" demands 1.5 pieces; a demand must be a positive integer.',
    );
    expect(() => assignDrawings([demand("W", 0, {})], [], MAX_SCORE)).toThrow(
      /"W" demands 0 pieces/,
    );
  });

  it("names the element when a capacity is not a count", () => {
    expect(() =>
      assignDrawings([demand("X", 1, { A: 1 })], supplies({ A: -1 }), MAX_SCORE),
    ).toThrow('Element "A" has capacity -1; an inventory count must be a non-negative integer.');
    const twice = [...supplies({ A: 1 }), ...supplies({ A: 2 })];
    expect(() => assignDrawings([demand("X", 1, { A: 1 })], twice, MAX_SCORE)).toThrow(
      'Assignment received element "A" twice; sum its inventory counts into one supply.',
    );
  });
});
