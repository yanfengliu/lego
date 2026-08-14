import type { CalloutTarget } from "./callout-types";

export interface ComponentAnchor {
  readonly identity: string;
  readonly rasterX: number;
  readonly labelTop: number;
  readonly maximumHorizontalGap: number;
}

export interface MatchableComponent {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly size: number;
}

export interface FilledMatchableComponent extends MatchableComponent {
  readonly filled: ReadonlySet<number>;
  readonly overflowed: boolean;
  readonly rawComponentCount: number;
}

export type ComponentAssignment =
  | { readonly kind: "assigned"; readonly byIdentity: ReadonlyMap<string, number> }
  | { readonly kind: "unresolved"; readonly reason: "bounds" | "missing" | "ambiguous" };

const soleEligibleAnchorIdentity = (
  component: MatchableComponent,
  anchors: readonly ComponentAnchor[],
): string | null => {
  const eligible = anchors.filter((anchor) => {
    const gap =
      anchor.rasterX < component.left
        ? component.left - anchor.rasterX
        : anchor.rasterX > component.right
          ? anchor.rasterX - component.right
          : 0;
    return gap <= anchor.maximumHorizontalGap && component.top <= anchor.labelTop;
  });
  return eligible.length === 1 ? eligible[0]!.identity : null;
};

/** Merge only disconnected detail that cannot belong to a different label than its container. */
export function containedComponentGroups(
  anchors: readonly ComponentAnchor[],
  components: readonly MatchableComponent[],
): readonly (readonly number[])[] {
  if (components.length > 64) return components.map((_, index) => [index]);
  const eligible = components.map((component) => soleEligibleAnchorIdentity(component, anchors));
  const parent = Array(components.length).fill(-1) as number[];
  for (const [childIndex, child] of components.entries()) {
    const candidates = components
      .map((component, index) => ({ component, index }))
      .filter(
        ({ component, index }) =>
          index !== childIndex &&
          eligible[childIndex] !== null &&
          eligible[index] === eligible[childIndex] &&
          component.left <= child.left &&
          component.top <= child.top &&
          component.right >= child.right &&
          component.bottom >= child.bottom &&
          (component.left < child.left ||
            component.top < child.top ||
            component.right > child.right ||
            component.bottom > child.bottom),
      )
      .sort((left, right) => {
        const leftArea =
          (left.component.right - left.component.left + 1) *
          (left.component.bottom - left.component.top + 1);
        const rightArea =
          (right.component.right - right.component.left + 1) *
          (right.component.bottom - right.component.top + 1);
        return (
          leftArea - rightArea ||
          left.component.size - right.component.size ||
          left.index - right.index
        );
      });
    parent[childIndex] = candidates[0]?.index ?? -1;
  }
  const root = (index: number): number => {
    let current = index;
    while (parent[current] !== -1) current = parent[current]!;
    return current;
  };
  const groups = new Map<number, number[]>();
  for (let index = 0; index < components.length; index += 1) {
    const owner = root(index);
    const group = groups.get(owner) ?? [];
    group.push(index);
    groups.set(owner, group);
  }
  return [...groups.entries()].sort(([left], [right]) => left - right).map(([, group]) => group);
}

export function coalesceContainedComponentGroups(
  anchors: readonly ComponentAnchor[],
  components: readonly FilledMatchableComponent[],
): FilledMatchableComponent[] {
  if (components.length > 64) return [...components];
  return containedComponentGroups(anchors, components).map((group) => {
    if (group.length === 1) return components[group[0]!]!;
    const members = group.map((index) => components[index]!);
    const filled = new Set<number>();
    for (const member of members) {
      for (const pixel of member.filled) filled.add(pixel);
    }
    return {
      left: Math.min(...members.map(({ left }) => left)),
      top: Math.min(...members.map(({ top }) => top)),
      right: Math.max(...members.map(({ right }) => right)),
      bottom: Math.max(...members.map(({ bottom }) => bottom)),
      size: filled.size,
      filled,
      overflowed: members.some(({ overflowed }) => overflowed),
      rawComponentCount: members.reduce(
        (total, { rawComponentCount }) => total + rawComponentCount,
        0,
      ),
    };
  });
}

function solve(costs: readonly (readonly number[])[]): { cost: number; columns: number[] } | null {
  const rows = costs.length;
  const columns = costs[0]?.length ?? 0;
  if (rows === 0 || rows > columns) return null;
  const u = Array(rows + 1).fill(0) as number[];
  const v = Array(columns + 1).fill(0) as number[];
  const matchedRow = Array(columns + 1).fill(0) as number[];
  const previousColumn = Array(columns + 1).fill(0) as number[];
  for (let row = 1; row <= rows; row += 1) {
    matchedRow[0] = row;
    let column = 0;
    const minimum = Array(columns + 1).fill(Number.POSITIVE_INFINITY) as number[];
    const used = Array(columns + 1).fill(false) as boolean[];
    do {
      used[column] = true;
      const activeRow = matchedRow[column]!;
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columns; candidate += 1) {
        if (used[candidate]) continue;
        const reduced = costs[activeRow - 1]![candidate - 1]! - u[activeRow]! - v[candidate]!;
        if (reduced < minimum[candidate]!) {
          minimum[candidate] = reduced;
          previousColumn[candidate] = column;
        }
        if (minimum[candidate]! < delta) {
          delta = minimum[candidate]!;
          nextColumn = candidate;
        }
      }
      if (!Number.isFinite(delta)) return null;
      for (let candidate = 0; candidate <= columns; candidate += 1) {
        if (used[candidate]) {
          const rowIndex = matchedRow[candidate]!;
          u[rowIndex] = u[rowIndex]! + delta;
          v[candidate] = v[candidate]! - delta;
        } else minimum[candidate]! -= delta;
      }
      column = nextColumn;
    } while (matchedRow[column] !== 0);
    do {
      const prior = previousColumn[column]!;
      matchedRow[column] = matchedRow[prior]!;
      column = prior;
    } while (column !== 0);
  }
  const assignment = Array(rows).fill(-1) as number[];
  for (let column = 1; column <= columns; column += 1) {
    if (matchedRow[column] !== 0) assignment[matchedRow[column]! - 1] = column - 1;
  }
  for (let row = 0; row < assignment.length; row += 1) {
    if (assignment[row]! < 0 || !Number.isFinite(costs[row]![assignment[row]!]!)) return null;
  }
  return {
    cost: assignment.reduce((total, column, row) => total + costs[row]![column]!, 0),
    columns: assignment,
  };
}

export function assignCalloutComponents(
  rawAnchors: readonly ComponentAnchor[],
  rawComponents: readonly MatchableComponent[],
): ComponentAssignment {
  if (rawAnchors.length < 1 || rawAnchors.length > 10 || rawComponents.length > 64)
    return { kind: "unresolved", reason: "bounds" };
  const anchors = [...rawAnchors].sort((left, right) =>
    left.identity.localeCompare(right.identity),
  );
  const components = [...rawComponents]
    .map((component, originalIndex) => ({ component, originalIndex }))
    .sort(
      (left, right) =>
        left.component.top - right.component.top ||
        left.component.left - right.component.left ||
        left.component.bottom - right.component.bottom ||
        left.component.right - right.component.right ||
        left.component.size - right.component.size,
    );
  const costs = anchors.map((anchor) =>
    components.map(({ component }) => {
      const gap =
        anchor.rasterX < component.left
          ? component.left - anchor.rasterX
          : anchor.rasterX > component.right
            ? anchor.rasterX - component.right
            : 0;
      if (gap > anchor.maximumHorizontalGap || component.top > anchor.labelTop)
        return Number.POSITIVE_INFINITY;
      return (
        Math.abs(component.left - anchor.rasterX) * 100 +
        Math.abs(component.bottom - anchor.labelTop)
      );
    }),
  );
  const best = solve(costs);
  if (best === null) return { kind: "unresolved", reason: "missing" };
  for (let row = 0; row < best.columns.length; row += 1) {
    const alternate = costs.map((values) => [...values]);
    alternate[row]![best.columns[row]!] = Number.POSITIVE_INFINITY;
    const next = solve(alternate);
    if (next !== null && Math.abs(next.cost - best.cost) < 1e-9)
      return { kind: "unresolved", reason: "ambiguous" };
  }
  return {
    kind: "assigned",
    byIdentity: new Map(
      anchors.map((anchor, row) => [
        anchor.identity,
        components[best.columns[row]!]!.originalIndex,
      ]),
    ),
  };
}

export function calloutSourceBoxKey(target: CalloutTarget): string {
  return `${target.box.minXPt}|${target.box.minYPt}|${target.box.maxXPt}|${target.box.maxYPt}`;
}

export function assignTargetBoxComponents<T extends MatchableComponent>(
  target: CalloutTarget,
  targets: readonly CalloutTarget[],
  components: readonly T[],
  pageHeightPt: number,
  scale: number,
): {
  readonly byIdentity: ReadonlyMap<string, T | null>;
  readonly failure: {
    readonly reason: "bounds" | "missing" | "ambiguous";
    readonly targetCount: number;
    readonly componentCount: number;
    readonly targetAnchors: readonly ComponentAnchor[];
    readonly componentBounds: readonly MatchableComponent[];
  } | null;
} {
  const key = calloutSourceBoxKey(target);
  const peers = targets.filter(
    (peer) => peer.evidenceKind === "part-art" && calloutSourceBoxKey(peer) === key,
  );
  const anchors = peers.map((peer) => ({
    identity: peer.identity,
    rasterX: Math.round(peer.xPt * scale),
    labelTop: Math.round((pageHeightPt - peer.yPt - 9) * scale),
    maximumHorizontalGap: Math.round(peer.heightPt * scale),
  }));
  const outcome = assignCalloutComponents(anchors, components);
  return {
    byIdentity: new Map(
      peers.map((peer) => [
        peer.identity,
        outcome.kind === "assigned"
          ? (components[outcome.byIdentity.get(peer.identity)!] ?? null)
          : null,
      ]),
    ),
    failure:
      outcome.kind === "unresolved"
        ? {
            reason: outcome.reason,
            targetCount: peers.length,
            componentCount: components.length,
            targetAnchors: anchors,
            componentBounds: components.slice(0, 8).map(({ left, top, right, bottom, size }) => ({
              left,
              top,
              right,
              bottom,
              size,
            })),
          }
        : null,
  };
}
