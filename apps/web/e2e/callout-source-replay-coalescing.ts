import type { ReplayBounds } from "./callout-source-replay-digest";

export interface ReplayComponentAnchor {
  readonly key: string;
  readonly rasterX: number;
  readonly labelTop: number;
  readonly maximumHorizontalGap: number;
}

export interface ReplayRawComponent extends ReplayBounds {
  readonly size: number;
}

export const MAX_SOURCE_REPLAY_RAW_COMPONENTS = 64;

function onlyEligibleAnchor(
  component: ReplayRawComponent,
  anchors: readonly ReplayComponentAnchor[],
): string | null {
  const eligible = anchors.filter((anchor) => {
    const horizontalGap =
      anchor.rasterX < component.left
        ? component.left - anchor.rasterX
        : anchor.rasterX > component.right
          ? anchor.rasterX - component.right
          : 0;
    return horizontalGap <= anchor.maximumHorizontalGap && component.top <= anchor.labelTop;
  });
  return eligible.length === 1 ? eligible[0]!.key : null;
}

/**
 * Independently groups a disconnected inner detail only when both it and a
 * strict enclosing component are eligible for the same single source label.
 */
export function singletonContainedComponentGroups(
  anchors: readonly ReplayComponentAnchor[],
  components: readonly ReplayRawComponent[],
): readonly (readonly number[])[] {
  if (components.length > MAX_SOURCE_REPLAY_RAW_COMPONENTS) {
    throw new Error(
      `Independent source replay found ${components.length} raw components before coalescing; maximum is ${MAX_SOURCE_REPLAY_RAW_COMPONENTS}, and containment may not hide the overflow sentinel.`,
    );
  }
  const ownerKeys = components.map((component) => onlyEligibleAnchor(component, anchors));
  const immediateContainer = components.map((child, childIndex) => {
    const owner = ownerKeys[childIndex];
    if (owner === null) return -1;
    const candidates = components
      .map((component, index) => ({ component, index }))
      .filter(
        ({ component, index }) =>
          index !== childIndex &&
          ownerKeys[index] === owner &&
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
    return candidates[0]?.index ?? -1;
  });
  const rootOf = (start: number): number => {
    let root = start;
    while (immediateContainer[root] !== -1) root = immediateContainer[root]!;
    return root;
  };
  const byRoot = new Map<number, number[]>();
  for (let index = 0; index < components.length; index += 1) {
    const root = rootOf(index);
    const members = byRoot.get(root) ?? [];
    members.push(index);
    byRoot.set(root, members);
  }
  return [...byRoot.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, members]) => members);
}
