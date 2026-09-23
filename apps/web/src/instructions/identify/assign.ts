/**
 * Closed-set assignment of drawings to inventory elements.
 *
 * Every piece a callout prints must come out of the inventory, so the counts
 * printed at the back are capacities. A drawing is one part: all of its pieces go
 * to one element, or none do and it is reported unassigned. That is a generalized
 * assignment problem priced by the visual score, solved exactly by branch and
 * bound. Each node is a min-cost flow, by successive shortest paths, in which the
 * drawings not yet decided may split across elements or be placed in part; its
 * cost bounds every whole answer below the node, and a node whose flow is
 * already whole is an answer. A priced "unassigned" route keeps every node
 * solvable; using it is reported, never hidden.
 *
 * The search stops at a node budget. An answer it could not prove best says so,
 * and names the drawings the search decided so the caller can flag them. On the
 * sample booklet the first flow is already whole: one node, proven optimal.
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
  /** The element the drawing went to, or null when it was left unassigned. */
  readonly elementId: string | null;
  /** Pieces placed: the drawing's whole quantity, or 0. */
  readonly placed: number;
}

export interface AssignmentOptions {
  /** Flow problems the search may solve before it settles for the best answer found. */
  readonly maxNodes?: number | undefined;
  /** Called before each flow problem after the first, with its number; throw to stop. */
  readonly checkpoint?: (node: number) => void;
}

export interface AssignmentResult {
  readonly placements: ReadonlyMap<string, Placement>;
  readonly totalCost: number;
  /** The fractional optimum: no whole assignment costs less. */
  readonly lowerBound: number;
  /** True when no whole assignment costs less than `totalCost`. */
  readonly provenOptimal: boolean;
  readonly nodes: number;
  /** Drawings whose placement is not the one the fractional optimum gave them whole. */
  readonly decided: readonly string[];
}

const SCALE = 1_000;
const UNASSIGNED_COST = 10_000_000;
export const DEFAULT_MAX_NODES = 200;

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

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Decided drawings: the element each is fixed to, or null for unassigned. */
type Fixings = ReadonlyMap<string, string | null>;

interface Solved {
  /** False when the decided drawings cannot all fit. */
  readonly feasible: boolean;
  readonly cost: number;
  /** Pieces of each drawing on each element. */
  readonly flows: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

function solve(
  demands: readonly Demand[],
  supplies: readonly Supply[],
  fixed: Fixings,
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
    const decision = fixed.get(demand.key);
    if (decision !== null) {
      for (const candidate of demand.candidates) {
        if (decision !== undefined && candidate.elementId !== decision) continue;
        const e = elementIndex.get(candidate.elementId)!;
        const price = priceOf(candidate.score, maxScore);
        const edge = graph.addEdge(firstDemand + d, firstElement + e, demand.quantity, price);
        edges.push({ demand: d, elementId: candidate.elementId, edge });
      }
    }
    // A drawing fixed to an element has no way out but that element.
    if (decision === undefined || decision === null)
      graph.addEdge(firstDemand + d, sink, demand.quantity, UNASSIGNED_COST);
  });
  supplies.forEach((supply, e) => graph.addEdge(firstElement + e, sink, supply.capacity, 0));
  const { flow, cost } = graph.minCostFlow(source, sink, total);
  const flows = new Map<string, Map<string, number>>();
  for (const { demand, elementId, edge } of edges) {
    const used = graph.capacity[edge ^ 1]!;
    if (used <= 0) continue;
    const key = demands[demand]!.key;
    if (!flows.has(key)) flows.set(key, new Map());
    flows.get(key)!.set(elementId, used);
  }
  return { feasible: flow === total, cost, flows };
}

/** The drawing's one element; null when none of it is placed; undefined when it is split or part-placed. */
function wholeChoice(solved: Solved, demand: Demand): string | null | undefined {
  const flows = solved.flows.get(demand.key);
  if (flows === undefined || flows.size === 0) return null;
  if (flows.size > 1) return undefined;
  const [elementId, placed] = [...flows][0]!;
  return placed === demand.quantity ? elementId : undefined;
}

function costOf(
  choice: ReadonlyMap<string, string | null>,
  demands: readonly Demand[],
  maxScore: number,
): number {
  let cost = 0;
  for (const demand of demands) {
    const elementId = choice.get(demand.key) ?? null;
    const candidate = demand.candidates.find((c) => c.elementId === elementId);
    cost += demand.quantity * (candidate ? priceOf(candidate.score, maxScore) : UNASSIGNED_COST);
  }
  return cost;
}

function validate(demands: readonly Demand[], supplies: readonly Supply[], maxNodes: number): void {
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
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1) {
    throw new Error(
      `Assignment was given a node budget of ${maxNodes}; it must be a whole number from 1.`,
    );
  }
}

/** Each demand's candidates in the inventory, one per element at its best score. */
function inInventory(demands: readonly Demand[], supplies: readonly Supply[]): Demand[] {
  const held = new Set(supplies.map((s) => s.elementId));
  return demands.map((demand) => {
    const best = new Map<string, number>();
    for (const { elementId, score } of demand.candidates) {
      if (held.has(elementId) && score > (best.get(elementId) ?? -Infinity))
        best.set(elementId, score);
    }
    const candidates = [...best].map(([elementId, score]) => ({ elementId, score }));
    return { key: demand.key, quantity: demand.quantity, candidates };
  });
}

/** Assigns each demand wholly to one element or to none, respecting capacities; see the module note. */
export function assignDrawings(
  demands: readonly Demand[],
  supplies: readonly Supply[],
  maxScore: number,
  options: AssignmentOptions = {},
): AssignmentResult {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  validate(demands, supplies, maxNodes);
  const drawings = inInventory(demands, supplies);
  const root = solve(drawings, supplies, new Map(), maxScore);
  const rootChoice = new Map(drawings.map((d) => [d.key, wholeChoice(root, d)]));
  // The first answer keeps the root's whole drawings and leaves the rest unassigned; it always fits.
  const fallback = new Map([...rootChoice].map(([key, choice]) => [key, choice ?? null]));
  let best = { choice: fallback, cost: costOf(fallback, drawings, maxScore) };
  let nodes = 1;
  const stack: Fixings[] = [];
  const expand = (fixed: Fixings, solved: Solved): void => {
    if (!solved.feasible || solved.cost >= best.cost) return;
    const open = drawings.filter((d) => !fixed.has(d.key) && wholeChoice(solved, d) === undefined);
    if (open.length === 0) {
      const choice = new Map(drawings.map((d) => [d.key, wholeChoice(solved, d) ?? null]));
      best = { choice, cost: solved.cost };
      return;
    }
    const pick = open.sort((a, b) => b.quantity - a.quantity || byText(a.key, b.key))[0]!;
    const flows = solved.flows.get(pick.key) ?? new Map<string, number>();
    const order: (string | null)[] = [...pick.candidates]
      .sort(
        (a, b) =>
          (flows.get(b.elementId) ?? 0) - (flows.get(a.elementId) ?? 0) ||
          b.score - a.score ||
          byText(a.elementId, b.elementId),
      )
      .map((c) => c.elementId);
    order.push(null);
    // Pushed last-first, so the element carrying most of the drawing is tried first.
    for (const choice of order.reverse()) stack.push(new Map(fixed).set(pick.key, choice));
  };
  expand(new Map(), root);
  let exhausted = false;
  while (stack.length > 0) {
    if (nodes >= maxNodes) {
      exhausted = true;
      break;
    }
    options.checkpoint?.(nodes + 1);
    const fixed = stack.pop()!;
    nodes += 1;
    expand(fixed, solve(drawings, supplies, fixed, maxScore));
  }
  const placements = new Map<string, Placement>();
  for (const demand of drawings) {
    const elementId = best.choice.get(demand.key) ?? null;
    placements.set(demand.key, { elementId, placed: elementId === null ? 0 : demand.quantity });
  }
  return {
    placements,
    totalCost: best.cost,
    lowerBound: root.cost,
    provenOptimal: !exhausted || best.cost === root.cost,
    nodes,
    decided: drawings
      .filter((d) => best.choice.get(d.key) !== rootChoice.get(d.key))
      .map((d) => d.key),
  };
}
