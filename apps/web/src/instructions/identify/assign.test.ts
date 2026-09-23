import { describe, expect, it } from "vitest";

import { assignDrawings, type Demand, type Supply } from "./assign";

const MAX_SCORE = 1.5;
const UNASSIGNED = 10_000_000;

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

/** Every whole choice for every drawing — an element it may go to, or none — priced as the assignment prices it. */
function bruteForce(demands: readonly Demand[], stock: readonly Supply[]): number {
  const left = new Map(stock.map((s) => [s.elementId, s.capacity]));
  let best = Infinity;
  const walk = (i: number, cost: number): void => {
    if (cost >= best) return;
    if (i === demands.length) {
      best = cost;
      return;
    }
    const d = demands[i]!;
    walk(i + 1, cost + d.quantity * UNASSIGNED);
    for (const c of d.candidates) {
      const room = left.get(c.elementId);
      if (room === undefined || room < d.quantity) continue;
      left.set(c.elementId, room - d.quantity);
      walk(i + 1, cost + d.quantity * Math.max(0, Math.round(1000 * (MAX_SCORE - c.score))));
      left.set(c.elementId, room);
    }
  };
  walk(0, 0);
  return best;
}

/** The reviewer's generator: 2-4 drawings of 1-3 pieces over 2-4 elements holding 1-3, most short. */
function randomInstances(count: number): { demands: Demand[]; stock: Supply[] }[] {
  let seed = 12345;
  const random = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const instances: { demands: Demand[]; stock: Supply[] }[] = [];
  while (instances.length < count) {
    const elements = Array.from({ length: 2 + Math.floor(random() * 3) }, (_, i) => `E${i}`);
    const stock = elements.map((elementId) => ({
      elementId,
      capacity: 1 + Math.floor(random() * 3),
    }));
    const demands = Array.from({ length: 2 + Math.floor(random() * 3) }, (_, d) => ({
      key: `D${d}`,
      quantity: 1 + Math.floor(random() * 3),
      candidates: elements
        .filter(() => random() < 0.8)
        .map((elementId) => ({ elementId, score: Math.round(random() * 1500) / 1000 })),
    })).filter((d) => d.candidates.length > 0);
    if (demands.length > 0) instances.push({ demands, stock });
  }
  return instances;
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
    expect(result).toMatchObject({ totalCost: 700 + 650, provenOptimal: true, nodes: 1 });
  });

  it("leaves a drawing no element can hold whole unassigned, rather than placing part of it", () => {
    const result = assignDrawings([demand("X", 3, { A: 1.2 })], supplies({ A: 2 }), MAX_SCORE);
    expect(placed(result)).toEqual({ X: [null, 0] });
    expect(result).toMatchObject({ totalCost: 3 * UNASSIGNED, provenOptimal: true });
  });

  it("never splits a drawing across two elements", () => {
    const result = assignDrawings(
      [demand("X", 2, { A: 0.9, B: 0.8 })],
      supplies({ A: 1, B: 1 }),
      MAX_SCORE,
    );
    expect(placed(result)).toEqual({ X: [null, 0] });
    // The fractional optimum put one piece on each; the search had to decide it.
    expect(result.lowerBound).toBe(600 + 700);
    expect(result.decided).toEqual(["X"]);
  });

  it("moves a whole drawing when that frees an element another drawing needs more", () => {
    const result = assignDrawings(
      [demand("X", 2, { A: 1.1, B: 1.0 }), demand("Y", 1, { A: 1.2, B: 0.2 })],
      supplies({ A: 2, B: 2 }),
      MAX_SCORE,
    );
    expect(placed(result)).toEqual({ X: ["B", 2], Y: ["A", 1] });
    expect(result).toMatchObject({ totalCost: 1300, lowerBound: 1200, provenOptimal: true });
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

  /**
   * The exactness gate. Bound: 3,000 seeded instances of 2-4 drawings of 1-3
   * pieces over 2-4 elements holding 1-3 each, small enough to enumerate. It proves
   * the search exact at that size only; past it, `provenOptimal` is the claim.
   * The review of 71f2f55 found the old greedy split repair above the optimum on
   * 252 of 3,000 such instances.
   */
  it("matches brute force on every small capacity-short instance, whole and within capacity", () => {
    const misses: string[] = [];
    for (const [n, { demands, stock }] of randomInstances(3000).entries()) {
      const result = assignDrawings(demands, stock, MAX_SCORE);
      const optimum = bruteForce(demands, stock);
      const used = new Map<string, number>();
      for (const d of demands) {
        const p = result.placements.get(d.key)!;
        if (p.placed !== (p.elementId === null ? 0 : d.quantity))
          misses.push(`${n}: ${d.key} part-placed`);
        if (p.elementId !== null) used.set(p.elementId, (used.get(p.elementId) ?? 0) + p.placed);
      }
      for (const s of stock)
        if ((used.get(s.elementId) ?? 0) > s.capacity) misses.push(`${n}: ${s.elementId} over`);
      if (result.totalCost !== optimum || !result.provenOptimal)
        misses.push(`${n}: cost ${result.totalCost}, optimum ${optimum}`);
    }
    expect(misses).toEqual([]);
  });

  it("says when its node budget ran out before the answer was proven best", () => {
    const instance = [demand("X", 2, { A: 1.1, B: 1.0 }), demand("Y", 1, { A: 1.2, B: 0.2 })];
    const result = assignDrawings(instance, supplies({ A: 2, B: 2 }), MAX_SCORE, { maxNodes: 1 });
    // One node is the fractional optimum only: X was split, so it is left unassigned.
    expect(placed(result)).toEqual({ X: [null, 0], Y: ["A", 1] });
    expect(result).toMatchObject({ provenOptimal: false, nodes: 1, decided: ["X"] });
  });

  it("asks before every node after the first, and stops when told to", () => {
    const asked: number[] = [];
    const instance = [demand("X", 2, { A: 1.1, B: 1.0 }), demand("Y", 1, { A: 1.2, B: 0.2 })];
    const result = assignDrawings(instance, supplies({ A: 2, B: 2 }), MAX_SCORE, {
      checkpoint: (node) => asked.push(node),
    });
    expect(asked).toEqual(Array.from({ length: result.nodes - 1 }, (_, i) => i + 2));
    expect(() =>
      assignDrawings(instance, supplies({ A: 2, B: 2 }), MAX_SCORE, {
        checkpoint: () => {
          throw new Error("out of time");
        },
      }),
    ).toThrow("out of time");
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
    expect(() => assignDrawings([], [], MAX_SCORE, { maxNodes: 0 })).toThrow(
      "Assignment was given a node budget of 0; it must be a whole number from 1.",
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
