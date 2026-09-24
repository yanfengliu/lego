/**
 * What "a printed step matches its bricks" means, by counts and by identity.
 *
 * By counts: the multiset of the step's callout quantities equals the
 * multiset of per-element brick counts. The text layer names no element per
 * callout, so a step drawing "2x" red and "1x" blue matches two blue and one
 * red: printed step 31 was given two dark bluish grey 1x3 bricks that way,
 * where the booklet draws a black 1x2x2 brick and a light grey 1x2 plate.
 *
 * By identity: each callout identification trusts names its element, and the
 * step's bricks must hold exactly that many of it. Callouts identification
 * flagged (a residual, such as a low margin) fall back to counts: the bricks
 * of every element no trusted callout names must match the flagged callouts'
 * quantities as a multiset, as a whole step does by counts. A step with no
 * flagged callout matches by identity alone.
 *
 * Both follow the booklet's convention that one step calls each element out
 * once, so each element's bricks answer exactly one callout.
 */
export interface IdentityTarget {
  /** Pieces per element, from the callouts identification trusts. */
  readonly elements: ReadonlyMap<string, number>;
  /** Quantities of the callouts identification flagged, matched by count only. */
  readonly flagged: readonly number[];
}

export function descending(values: readonly number[]): number[] {
  return [...values].sort((left, right) => right - left);
}

export function sameMultiset(left: readonly number[], right: readonly number[]): boolean {
  const a = descending(left);
  const b = descending(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Per-element brick counts of a list of element ids. */
export function countElements(elements: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const element of elements) counts.set(element, (counts.get(element) ?? 0) + 1);
  return counts;
}

/** By counts: the callout quantities equal the per-element brick counts, as multisets. */
export function countsMatch(
  counts: ReadonlyMap<string, number>,
  callouts: readonly number[],
): boolean {
  return sameMultiset([...counts.values()], callouts);
}

/**
 * By identity: every trusted element has exactly its pieces, and the other
 * elements' counts equal the flagged callouts' quantities as a multiset.
 */
export function identityMatches(
  counts: ReadonlyMap<string, number>,
  target: IdentityTarget,
): boolean {
  for (const [element, pieces] of target.elements) {
    if ((counts.get(element) ?? 0) !== pieces) return false;
  }
  const rest: number[] = [];
  for (const [element, pieces] of counts) {
    if (pieces > 0 && !target.elements.has(element)) rest.push(pieces);
  }
  return sameMultiset(rest, target.flagged);
}

/** The criterion a step is held to: identity when it has a target, counts otherwise. */
export function stepCountsMatch(
  counts: ReadonlyMap<string, number>,
  callouts: readonly number[],
  identity: IdentityTarget | null | undefined,
): boolean {
  return identity ? identityMatches(counts, identity) : countsMatch(counts, callouts);
}
