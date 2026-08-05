import {
  PART_TRUTH_SCHEMA,
  cropDigestKey,
  judgedPairs,
  truthVerdictKey,
  verdictsByCropDigest,
} from "./part-identification-truth-key.mjs";

/**
 * Blind pair judging, as a trust source in its own right.
 *
 * The vision pass answers "which of these candidates is this drawing?" and
 * checks itself by describing the same picture twice. Measured on this booklet
 * it was 39.9% self-consistent, changed none of the 273 drawings it was asked
 * about, and its confidence did not separate right from wrong. Blind pair
 * judging asks a strictly smaller question — here are two pictures, are they
 * the same part? — with no features, no distances, no answers, no score and no
 * truth artifact in front of the rater. Two independent raters on different
 * models agreed 84 of 84, including all eight "different" calls.
 *
 * That is a different mechanism with different evidence, so it gets its own
 * confidence value rather than being written out as `vision-kept`. Conflating
 * them would destroy the only thing that makes either number readable later:
 * which of the two established the identity.
 *
 * A verdict is evidence, never authority. It cannot say a callout is placeable;
 * it can only say the claim the assignment already made about that exact
 * drawing was, or was not, judged to be the same part. The coverage compiler
 * still disposes, the closure still has to recompile byte-for-byte, and a
 * verdict whose crop or claim has moved simply stops binding.
 */

/** A judged pair the raters called the same part; a placement may be built on it. */
export const PAIR_JUDGED_SAME_CONFIDENCE = "pair-judged-same";

/**
 * A judged pair the raters called different parts.
 *
 * This is refused rather than merely unkept: an absent judgement says nobody
 * looked, while this one says somebody looked and the claim is wrong. The
 * stronger evidence has to produce the stronger outcome, or the label set would
 * only ever be able to add trust.
 */
export const PAIR_JUDGED_DIFFERENT_CONFIDENCE = "pair-judged-different";

const MAX_PAIR_JUDGED_VERDICTS = 4_000;
const MAX_PAIR_JUDGED_NOTE_LENGTH = 2_000;
const ELEMENT_ID = /^\d{3,12}$/u;
const JUDGED_CROP_DIGEST = /^sha256:[0-9a-f]{16,64}$/u;

function describeVerdict(verdict, position) {
  const ordinal = Number.isInteger(verdict?.n) ? `n ${verdict.n}` : `position ${position}`;
  return `${ordinal} (crop ${JSON.stringify(verdict?.judgedCropSha256 ?? "missing")}, element ${JSON.stringify(verdict?.elementId ?? "missing")})`;
}

/**
 * Bounded structural check on the retained verdict bytes.
 *
 * The file is a repository input, not a run output, so it is checked the way
 * every other hostile input here is: bounded count, bounded strings, exact
 * schema, no duplicate or self-contradicting keys.
 */
export function assertPairJudgedTruth(value, label = "Pair-judged truth") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `${label} must be a JSON object carrying ${PART_TRUTH_SCHEMA} verdicts; received ${Array.isArray(value) ? "an array" : typeof value}.`,
    );
  }
  if (value.schemaVersion !== PART_TRUTH_SCHEMA) {
    throw new Error(
      `${label} declares schema ${JSON.stringify(value.schemaVersion ?? "missing")}, but only ${PART_TRUTH_SCHEMA} keys a verdict to the judged crop and the claimed element. A cluster-index generation cannot be re-keyed, because the gallery it was judged against no longer exists; re-judge the pairs against the current crops.`,
    );
  }
  if (!Number.isInteger(value.lastStep) || value.lastStep < 1 || value.lastStep > 359) {
    throw new Error(
      `${label} declares lastStep ${JSON.stringify(value.lastStep ?? "missing")}; it must be an integer printed step from 1 through 359, because it fixes the exact range the pair sheets were cut for and therefore the range a verdict may bind in.`,
    );
  }
  if (!Array.isArray(value.verdicts)) {
    throw new Error(`${label} has no verdicts array.`);
  }
  if (value.verdicts.length > MAX_PAIR_JUDGED_VERDICTS) {
    throw new Error(
      `${label} carries ${value.verdicts.length} verdicts; the bounded maximum is ${MAX_PAIR_JUDGED_VERDICTS}. Split the label set or raise the bound deliberately.`,
    );
  }
  const seen = new Map();
  for (const [position, verdict] of value.verdicts.entries()) {
    if (typeof verdict !== "object" || verdict === null || Array.isArray(verdict)) {
      throw new Error(`${label} verdict at position ${position} is not an object.`);
    }
    if (
      typeof verdict.judgedCropSha256 !== "string" ||
      !JUDGED_CROP_DIGEST.test(verdict.judgedCropSha256)
    ) {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} has no "sha256:" crop digest of 16 to 64 lowercase hex characters. A verdict that names no crop was judged against a gallery generation that no longer exists and cannot be re-keyed.`,
      );
    }
    if (typeof verdict.elementId !== "string" || !ELEMENT_ID.test(verdict.elementId)) {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} has no published element id of 3 to 12 digits. The element is half the key: without it the verdict does not say what the drawing was judged against.`,
      );
    }
    if (typeof verdict.same !== "boolean") {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} declares same ${JSON.stringify(verdict.same ?? "missing")}; it must be exactly true or false. A judged pair has two outcomes and neither may be inferred from a missing, numeric, or string field.`,
      );
    }
    if (
      verdict.note !== undefined &&
      (typeof verdict.note !== "string" || verdict.note.length > MAX_PAIR_JUDGED_NOTE_LENGTH)
    ) {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} carries a note that is not a string of at most ${MAX_PAIR_JUDGED_NOTE_LENGTH} characters.`,
      );
    }
    const key = truthVerdictKey(verdict.judgedCropSha256, verdict.elementId);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(
        `${label} judges the same pair twice: ${describeVerdict(verdict, position)} repeats key ${key}, first seen at position ${previous.position} with same ${previous.same}. One drawing claimed to be one element has one verdict; remove the duplicate rather than letting file order decide.`,
      );
    }
    seen.set(key, { position, same: verdict.same });
  }
  return { lastStep: value.lastStep, verdictCount: value.verdicts.length };
}

/**
 * Which callouts a retained verdict actually binds to, by exact feature index.
 *
 * The pairing is recomputed through the same `judgedPairs` helper the pair
 * sheets and the scorer use, so the crop a verdict is keyed to cannot drift
 * from the crop that was put in front of the rater. Binding is deliberately
 * narrow in both directions: re-cutting the drawing changes the digest, and
 * re-assigning the claim changes the element, and either one leaves the callout
 * unjudged rather than inheriting a verdict about something else.
 *
 * `truth.lastStep` — not the coverage prefix — bounds the range, because that is
 * the range the sheets were cut for. A coverage report compiled to step 359
 * therefore still carries judged trust only where somebody judged.
 */
export function pairJudgedVerdictsByCalloutIndex(input) {
  const { lastStep } = assertPairJudgedTruth(input.truth, input.label ?? "Pair-judged truth");
  const { bound } = verdictsByCropDigest(input.truth);
  const pairs = judgedPairs(input.features, input.claims, lastStep);
  const verdicts = new Map();
  for (const [index, callout] of input.features.callouts.entries()) {
    if (callout?.evidenceKind !== "part-art") continue;
    if (!Number.isInteger(callout.stepNumber) || callout.stepNumber > lastStep) continue;
    const claim = input.claims.get(index);
    if (!claim || claim.elementId === null || claim.elementId === undefined) continue;
    const pair = pairs.get(`${claim.clusterIndex}:${claim.elementId}`);
    if (pair === undefined || pair.elementId === null) continue;
    const key = truthVerdictKey(pair.leadSha256, pair.elementId);
    const verdict = bound.get(key);
    if (verdict === undefined) continue;
    // The crop the rater saw is the group's lead, which is usually a different
    // drawing from this callout. A refusal that named this callout's own crop
    // would send the next reader to a picture nobody judged.
    verdicts.set(index, {
      verdict: verdict.same === true ? "same" : "different",
      judgedCrop: cropDigestKey(pair.leadSha256),
      judgedElementId: pair.elementId,
    });
  }
  return verdicts;
}
