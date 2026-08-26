/**
 * Which identification confidences a placement may be built on, and how each was earned.
 *
 * The real build refuses any callout whose identity is not one of these. The set
 * is deliberately small and deliberately explicit about mechanism, because the
 * only thing that makes the refusal count meaningful is that nothing can enter
 * this list by asserting itself: the coverage compiler emits the label, and the
 * closure has to recompile the coverage bytes from the retained raw roles before
 * the label is read at all.
 *
 * - `vision-kept` — the pinned vision model picked one candidate card, and the
 *   free description it gave in the same call independently agreed with that
 *   element's published name, stud size and colour code. The call never sees
 *   that metadata, so the agreement is not something it can satisfy by
 *   asserting. Earned per drawing, by one model, answering a wide question.
 *
 * - `pair-judged-same` — two independent blind raters, on different models, were
 *   each shown exactly two pictures (the booklet callout on the left, the
 *   claimed element on the right) with no access to features, distances, match,
 *   answers, score or truth artifacts, and both said the same part. The verdict
 *   is keyed to the digest of the crop that was judged plus the element it was
 *   claimed to be, so re-cutting the drawing or re-assigning the claim unbinds
 *   it rather than inheriting it. Earned per judged pair, by two raters,
 *   answering a narrow question.
 *
 * - `source-art-rebound` — the exact embedded-source-art relation independently
 *   reproduced from the retained PDF and complete callout manifest agrees with
 *   the catalog identity already carried by that callout. The relation binds the
 *   source drawing; it does not admit a catalog part, place a Brick, or certify
 *   completion by itself.
 *
 * They are separate values on purpose. A pair-judged identity was established by
 * a different mechanism with different evidence, and collapsing it into
 * `vision-kept` would make it impossible to tell later which of the two actually
 * carried the build — which is the whole reason the distinction is worth
 * keeping. `official-model` is not in this set: it is the confidence of a piece
 * the official Builder program places without a booklet callout, and it is
 * checked against the model export rather than against an identification claim.
 *
 * The refusing counterpart, `pair-judged-different`, is never trusted: it is
 * positive evidence that the claim is wrong, and the coverage compiler strips
 * the resolution from any callout carrying it.
 */
export const TRUSTED_IDENTIFICATION_CONFIDENCES = [
  "vision-kept",
  "pair-judged-same",
  "source-art-rebound",
] as const;

export type TrustedIdentificationConfidence = (typeof TRUSTED_IDENTIFICATION_CONFIDENCES)[number];

export function isTrustedIdentificationConfidence(
  value: unknown,
): value is TrustedIdentificationConfidence {
  return TRUSTED_IDENTIFICATION_CONFIDENCES.some((confidence) => confidence === value);
}

/** The list as a message fragment, so a refusal can say what would satisfy it. */
export const TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE = TRUSTED_IDENTIFICATION_CONFIDENCES.map(
  (confidence) => JSON.stringify(confidence),
).join(" and ");

/**
 * Selects the retained input whose exact bytes earned a trusted confidence.
 *
 * The two direct identification paths remain manifest-bound. A source-art
 * rebound is deliberately rebound-artifact-bound, so replacing that relation
 * cannot inherit an earlier callout's positive label.
 */
export function trustedIdentificationInputDigest(
  confidence: TrustedIdentificationConfidence,
  bindings: {
    readonly calloutManifestDigest: string;
    readonly sourceArtReboundDigest: string;
  },
): string {
  return confidence === "source-art-rebound"
    ? bindings.sourceArtReboundDigest
    : bindings.calloutManifestDigest;
}

/**
 * Carries a coverage claim's own confidence into a generated record.
 *
 * Never write a confidence literal into a ledger piece or a panel spec. The
 * emitted value has to be the one the coverage compiler published for that exact
 * callout, or the record would be relabelling the evidence that produced it —
 * which is precisely how a pair-judged identity would come to masquerade as a
 * vision-kept one.
 */
export function requireTrustedIdentificationConfidence(
  value: unknown,
  calloutKey: string,
): TrustedIdentificationConfidence {
  if (!isTrustedIdentificationConfidence(value)) {
    throw new TypeError(
      `Callout ${calloutKey} has identification confidence ${JSON.stringify(value ?? "missing")}, which is ` +
        `not one of ${TRUSTED_IDENTIFICATION_CONFIDENCES_SENTENCE}. A generated record may only carry the ` +
        `confidence its coverage claim published; refuse the callout instead of writing a trusted label for it.`,
    );
  }
  return value;
}
