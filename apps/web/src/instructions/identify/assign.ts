/**
 * Closed-set assignment of drawings to inventory elements.
 *
 * Every piece a callout prints must come out of the inventory, so the counts
 * printed at the back are capacities: a transportation problem from drawings
 * (supply = pieces called out) to elements (capacity = pieces in the set), with
 * the visual score as the price. It is solved as a min-cost flow by successive
 * shortest paths. A drawing is one part, so a drawing split across elements is
 * repaired by fixing it to each element it was split across in turn and keeping
 * the cheapest outcome. A priced "unassigned" route keeps every instance
 * solvable; using it is reported, never hidden.
 */
export interface Demand {
  readonly key: string;
  readonly quantity: number;
  /** Candidate elements with their visual scores, any order. */
  readonly candidates: readonly { readonly elementId: string; readonly score: number }[];
}

export interface Supply {
  readonly elementId: string;
  readonly capacity: number;
}

export interface Placement {
  /** The element the drawing went to, or null when none of its pieces could be placed. */
  readonly elementId: string | null;
  /** Pieces placed; fewer than the demand when the element ran out. */
  readonly placed: number;
}

export interface AssignmentResult {
  readonly placements: ReadonlyMap<string, Placement>;
  readonly totalCost: number;
  readonly splitsRepaired: number;
}

const SCALE = 1_000;
const UNASSIGNED_COST = 10_000_000;

class FlowGraph {
  readonly to: number[] = [];
  readonly capacity: number[] = [];
  readonly cost: number[] = [];
  readonly next: number[] = [];
  readonly head: Int32Array;
  readonly nodes: number;

  constructor(nodes: number) {
    this.nodes = nodes;
    this.head = new Int32Array(nodes).fill(-1);
  }

  addEdge(from: number, to: number, capacity: number, cost: number): number {
    const index = this.to.length;
    this.push(from, to, capacity, cost);
    this.push(to, from, 0, -cost);
    return index;
  }

  private push(from: number, to: number, capacity: number, cost: number): void {
    this.to.push(to);
    this.capacity.push(capacity);
    this.cost.push(cost);
    this.next.push(this.head[from]!);
    this.head[from] = this.to.length - 1;
  }

  /** Successive shortest paths with Dijkstra on reduced costs; costs start non-negative. */
  minCostFlow(source: number, sink: number, demand: number): { flow: number; cost: number } {
    const potential = new Float64Array(this.nodes);
    const distance = new Float64Array(this.nodes);
    const via = new Int32Array(this.nodes);
    let flow = 0;
    let cost = 0;
    while (flow < demand) {
      distance.fill(Infinity);
      via.fill(-1);
      distance[source] = 0;
      const heap = new MinHeap();
      heap.push(0, source);
      while (heap.size > 0) {
        const [d, u] = heap.pop();
        if (d > distance[u]!) continue;
        for (let e = this.head[u]!; e >= 0; e = this.next[e]!) {
          if (this.capacity[e]! <= 0) continue;
          const v = this.to[e]!;
          const nd = d + this.cost[e]! + potential[u]! - potential[v]!;
          if (nd < distance[v]! - 1e-9) {
            distance[v] = nd;
            via[v] = e;
            heap.push(nd, v);
          }
        }
      }
      if (distance[sink] === Infinity) break;
      for (let v = 0; v < this.nodes; v += 1)
        if (distance[v]! < Infinity) potential[v]! += distance[v]!;
      let push = demand - flow;
      for (let v = sink; v !== source; v = this.to[via[v]! ^ 1]!)
        push = Math.min(push, this.capacity[via[v]!]!);
      for (let v = sink; v !== source; v = this.to[via[v]! ^ 1]!) {
        this.capacity[via[v]!]! -= push;
        this.capacity[via[v]! ^ 1]! += push;
        cost += push * this.cost[via[v]!]!;
      }
      flow += push;
    }
    return { flow, cost };
  }
}

class MinHeap {
  private readonly keys: number[] = [];
  private readonly values: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, value: number): void {
    this.keys.push(key);
    this.values.push(value);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent]! <= key) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.keys[0]!, this.values[0]!];
    const lastKey = this.keys.pop()!;
    const lastValue = this.values.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.values[0] = lastValue;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l]! < this.keys[m]!) m = l;
        if (r < this.keys.length && this.keys[r]! < this.keys[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b]!, this.keys[a]!];
    [this.values[a], this.values[b]] = [this.values[b]!, this.values[a]!];
  }
}

/** Integer price of one piece: 0 for a perfect score, growing as the score falls. */
function priceOf(score: number, maxScore: number): number {
  return Math.max(0, Math.round(SCALE * (maxScore - score)));
}

interface Solved {
  readonly flows: Map<string, Map<string, number>>;
  readonly cost: number;
}

function solve(
  demands: readonly Demand[],
  supplies: readonly Supply[],
  fixed: ReadonlyMap<string, string>,
  maxScore: number,
): Solved {
  const elementIndex = new Map(supplies.map((s, i) => [s.elementId, i]));
  const source = 0;
  const firstDemand = 1;
  const firstElement = firstDemand + demands.length;
  const sink = firstElement + supplies.length;
  const graph = new FlowGraph(sink + 1);
  const edges: { demand: number; elementId: string; edge: number }[] = [];
  let total = 0;
  demands.forEach((demand, d) => {
    graph.addEdge(source, firstDemand + d, demand.quantity, 0);
    total += demand.quantity;
    const only = fixed.get(demand.key);
    for (const candidate of demand.candidates) {
      if (only !== undefined && candidate.elementId !== only) continue;
      const e = elementIndex.get(candidate.elementId);
      if (e === undefined) continue;
      const edge = graph.addEdge(
        firstDemand + d,
        firstElement + e,
        demand.quantity,
        priceOf(candidate.score, maxScore),
      );
      edges.push({ demand: d, elementId: candidate.elementId, edge });
    }
    graph.addEdge(firstDemand + d, sink, demand.quantity, UNASSIGNED_COST);
  });
  supplies.forEach((supply, e) => graph.addEdge(firstElement + e, sink, supply.capacity, 0));
  const { cost } = graph.minCostFlow(source, sink, total);
  const flows = new Map<string, Map<string, number>>();
  for (const { demand, elementId, edge } of edges) {
    const used = graph.capacity[edge ^ 1]!;
    if (used <= 0) continue;
    const key = demands[demand]!.key;
    if (!flows.has(key)) flows.set(key, new Map());
    flows.get(key)!.set(elementId, used);
  }
  return { flows, cost };
}

/** Assigns each demand to one element, respecting capacities; see the module note. */
export function assignDrawings(
  demands: readonly Demand[],
  supplies: readonly Supply[],
  maxScore: number,
  maxRepairs = 60,
): AssignmentResult {
  const keys = new Set<string>();
  for (const demand of demands) {
    if (keys.has(demand.key)) {
      throw new Error(
        `Assignment received drawing ${JSON.stringify(demand.key)} twice; merge its callouts into one demand.`,
      );
    }
    if (!Number.isSafeInteger(demand.quantity) || demand.quantity < 1) {
      throw new Error(
        `Drawing ${JSON.stringify(demand.key)} demands ${demand.quantity} pieces; a demand must be a positive integer.`,
      );
    }
    keys.add(demand.key);
  }
  const elements = new Set<string>();
  for (const supply of supplies) {
    if (elements.has(supply.elementId)) {
      throw new Error(
        `Assignment received element ${JSON.stringify(supply.elementId)} twice; sum its inventory counts into one supply.`,
      );
    }
    if (!Number.isSafeInteger(supply.capacity) || supply.capacity < 0) {
      throw new Error(
        `Element ${JSON.stringify(supply.elementId)} has capacity ${supply.capacity}; an inventory count must be a non-negative integer.`,
      );
    }
    elements.add(supply.elementId);
  }
  const fixed = new Map<string, string>();
  let current = solve(demands, supplies, fixed, maxScore);
  let repairs = 0;
  for (;;) {
    const split = demands
      .filter((d) => (current.flows.get(d.key)?.size ?? 0) > 1 && !fixed.has(d.key))
      .sort((a, b) => b.quantity - a.quantity || a.key.localeCompare(b.key))[0];
    if (split === undefined) break;
    const options = [...current.flows.get(split.key)!.keys()].sort();
    if (repairs >= maxRepairs) {
      // Out of repair budget: keep the element carrying most of the drawing.
      const flows = current.flows.get(split.key)!;
      fixed.set(
        split.key,
        options.sort((a, b) => flows.get(b)! - flows.get(a)! || a.localeCompare(b))[0]!,
      );
      current = solve(demands, supplies, fixed, maxScore);
      continue;
    }
    let best: { element: string; solved: Solved } | null = null;
    for (const element of options) {
      const trial = new Map(fixed).set(split.key, element);
      const solved = solve(demands, supplies, trial, maxScore);
      if (best === null || solved.cost < best.solved.cost) best = { element, solved };
    }
    fixed.set(split.key, best!.element);
    current = best!.solved;
    repairs += 1;
  }
  const placements = new Map<string, Placement>();
  for (const demand of demands) {
    const flows = current.flows.get(demand.key);
    const [elementId, placed] = flows ? [...flows.entries()][0]! : [null, 0];
    placements.set(demand.key, { elementId, placed });
  }
  return { placements, totalCost: current.cost, splitsRepaired: repairs };
}
