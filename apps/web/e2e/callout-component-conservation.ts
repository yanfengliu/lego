export interface AssignedComponentPixels {
  readonly identity: string;
  readonly filled: ReadonlySet<number>;
}

/** Refuse exact pixel reuse even when overlapping source boxes produce different group digests. */
export function retainDisjointAssignedComponent(
  retained: readonly AssignedComponentPixels[],
  candidate: AssignedComponentPixels,
): readonly AssignedComponentPixels[] {
  if (retained.length > 15 || candidate.filled.size < 1 || candidate.filled.size > 4_000_000) {
    throw new Error("Callout page component conservation requires at most 16 bounded assignments.");
  }
  for (const prior of retained) {
    const [smaller, larger] =
      prior.filled.size <= candidate.filled.size
        ? [prior.filled, candidate.filled]
        : [candidate.filled, prior.filled];
    for (const pixel of smaller) {
      if (larger.has(pixel)) {
        throw new Error(
          `Callout component assignments ${JSON.stringify(prior.identity.slice(0, 96))} and ${JSON.stringify(candidate.identity.slice(0, 96))} reuse one page-raster foreground pixel. Refuse overlapping source-box ownership and repair the joint assignment before publication.`,
        );
      }
    }
  }
  return [...retained, candidate];
}
