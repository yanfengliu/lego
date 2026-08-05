/**
 * How a first-fifty ground-truth verdict names the thing it was judged about.
 *
 * The first schema keyed a verdict `${clusterIndex}:${elementId}`. A cluster
 * index is a position in a list that `match` rebuilds whenever the callout
 * gallery is re-cut, so re-cutting the gallery renumbered every verdict at
 * once: 87 intact labels scored `calloutsJudged: 0` against the live closure
 * because the key was dead, not because the judgements were wrong.
 *
 * A verdict is now keyed by the SHA-256 of the crop that was actually put in
 * front of the judge, plus the element that crop was claimed to be. That has
 * the invalidation property the label set needs in both directions:
 *
 *   - the picture changes  -> the digest changes -> the verdict stops binding,
 *     which is correct, because nobody judged the new picture;
 *   - the claim changes    -> the element id changes -> the verdict stops
 *     binding, which is the property the first schema already had and which
 *     must survive: a different claim is unjudged rather than inherited.
 *
 * Renumbering, re-ordering, re-clustering and re-naming the crop files all
 * leave it alone, because none of them changes the bytes of the picture.
 */

/** Truth artifact schema that carries crop-digest keys. */
export const PART_TRUTH_SCHEMA = "lego.part-identification-truth/2";

/** The key a verdict is stored and looked up under. */
export function truthVerdictKey(judgedCropSha256, elementId) {
  if (typeof judgedCropSha256 !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(judgedCropSha256)) {
    throw new TypeError(
      `A truth verdict key needs the judged crop's sha256 as "sha256:" plus 64 lowercase hex ` +
        `characters; received ${JSON.stringify(judgedCropSha256)}.`,
    );
  }
  if (typeof elementId !== "string" || elementId.length === 0) {
    throw new TypeError(
      `A truth verdict key needs a non-empty element id; received ${JSON.stringify(elementId)}.`,
    );
  }
  return `${judgedCropSha256}:${elementId}`;
}

/**
 * The pairs a judge is shown, and the exact crop shown for each.
 *
 * One entry per distinct (drawing, claimed element), because that is what a
 * pair sheet prints one row for. `lead` is the crop that row displays: the
 * first callout of the group in feature order. Scoring and sheet generation
 * both read this, so the crop a verdict is keyed to cannot drift from the crop
 * that was actually rendered.
 */
export function judgedPairs(features, claims, lastStep) {
  const pairs = new Map();
  for (const [index, callout] of features.callouts.entries()) {
    if (callout.stepNumber === null || callout.stepNumber > lastStep) continue;
    const claim = claims.get(index);
    if (!claim) continue;
    const key = `${claim.clusterIndex}:${claim.elementId}`;
    const entry = pairs.get(key) ?? {
      clusterIndex: claim.clusterIndex,
      elementId: claim.elementId,
      lead: callout.file,
      leadIdentity: callout.identity,
      leadSha256: callout.sha256,
      firstStep: callout.stepNumber,
      callouts: 0,
      pieces: 0,
    };
    entry.callouts += 1;
    entry.pieces += callout.quantity;
    entry.firstStep = Math.min(entry.firstStep, callout.stepNumber);
    pairs.set(key, entry);
  }
  return pairs;
}

/**
 * Verdicts by crop digest, from either schema.
 *
 * Version 1 verdicts carry a cluster index that no longer means anything, so
 * they are reported as unbindable rather than guessed at. Re-keying them would
 * need the generation they were judged against, and that gallery is gone.
 */
export function verdictsByCropDigest(truth) {
  const bound = new Map();
  let unbindable = 0;
  for (const verdict of truth.verdicts) {
    if (typeof verdict.judgedCropSha256 !== "string") {
      unbindable += 1;
      continue;
    }
    bound.set(truthVerdictKey(verdict.judgedCropSha256, verdict.elementId), verdict);
  }
  return { bound, unbindable };
}
