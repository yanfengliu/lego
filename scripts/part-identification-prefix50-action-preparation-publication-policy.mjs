const REQUIRED_PUBLISHED_COUNTEREVIDENCE = Object.freeze([
  Object.freeze({
    identity: "p30|q2|x84.228|y407.699",
    publishedPartNum: "28802",
    officialDesignId: "10201",
    catalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
    members: Object.freeze([
      Object.freeze({ ordinal: 139, designRevision: "10201;H" }),
      Object.freeze({ ordinal: 147, designRevision: "10201;H" }),
    ]),
  }),
  Object.freeze({
    identity: "p34|q1|x62.389|y468.271",
    publishedPartNum: "3245c",
    officialDesignId: "3245",
    catalogPartId: "builtin:brick-1x2x2-without-understud",
    members: Object.freeze([Object.freeze({ ordinal: 178, designRevision: "3245;M" })]),
  }),
  Object.freeze({
    identity: "p35|q2|x147.987|y481.711",
    publishedPartNum: "3245c",
    officialDesignId: "3245",
    catalogPartId: "builtin:brick-1x2x2-without-understud",
    members: Object.freeze([
      Object.freeze({ ordinal: 183, designRevision: "3245;M" }),
      Object.freeze({ ordinal: 185, designRevision: "3245;M" }),
    ]),
  }),
  Object.freeze({
    identity: "p36|q4|x83.269|y421.615",
    publishedPartNum: "3245c",
    officialDesignId: "3245",
    catalogPartId: "builtin:brick-1x2x2-without-understud",
    members: Object.freeze([
      Object.freeze({ ordinal: 190, designRevision: "3245;M" }),
      Object.freeze({ ordinal: 191, designRevision: "3245;M" }),
      Object.freeze({ ordinal: 192, designRevision: "3245;M" }),
      Object.freeze({ ordinal: 193, designRevision: "3245;M" }),
    ]),
  }),
]);

export function assertPublishedCounterevidenceBoundary(artifact) {
  if (
    artifact.authority?.semanticIdentity !== true ||
    artifact.authority?.exactOccurrenceIdentity !== false ||
    artifact.authority?.physicalFrame !== false ||
    artifact.authority?.assignmentAuthority !== false ||
    artifact.authority?.actionAuthority !== false ||
    artifact.authority?.placement !== false
  ) {
    throw new Error(
      "Action preparation must remain semantic/published-callout evidence with explicit non-occurrence, non-frame, non-assignment, non-action, and non-placement authority.",
    );
  }
  for (const expected of REQUIRED_PUBLISHED_COUNTEREVIDENCE) {
    const step = artifact.steps.find(({ callouts }) =>
      callouts.some(({ identity }) => identity === expected.identity),
    );
    const callout = step?.callouts.find(({ identity }) => identity === expected.identity);
    const members =
      step?.phases
        .flatMap(({ members: rows }) => rows)
        .filter(({ calloutIdentity }) => calloutIdentity === expected.identity)
        .map(({ sourceBuilderIdentityOrdinal: ordinal, designRevision }) => ({
          ordinal,
          designRevision,
        }))
        .sort((left, right) => left.ordinal - right.ordinal) ?? [];
    if (
      callout?.publishedPartNum !== expected.publishedPartNum ||
      callout?.officialDesignId !== expected.officialDesignId ||
      callout?.catalogPartId !== expected.catalogPartId ||
      JSON.stringify(members) !== JSON.stringify(expected.members)
    ) {
      throw new Error(
        `Action-preparation callout ${expected.identity} must retain its published mapping ${expected.publishedPartNum} -> ${expected.catalogPartId} and contradictory Builder revision members as counterevidence; exact occurrence identity belongs only to verified proposal/reconciliation artifacts.`,
      );
    }
  }
}
