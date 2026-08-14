import {
  PART_TRUTH_SCHEMA,
  judgedPairs,
  truthVerdictKey,
  verdictsByCropDigest,
} from "./part-identification-truth-key.mjs";

/**
 * Blind pair judging, as a trust source in its own right.
 *
 * The vision pass answers "which of these candidates is this drawing?" and
 * checks itself by describing the same picture twice. Historically, on the
 * then-current booklet generation, it measured 39.9% self-consistent, changed
 * none of the 273 drawings it was asked about, and its confidence did not
 * separate right from wrong. Blind pair
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
const MAX_RATER_NAME_LENGTH = 200;
const ELEMENT_ID = /^\d{3,12}$/u;
const JUDGED_CROP_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const RATER_AGREEMENT = /^(\d{1,4})\/(\d{1,4})$/u;
const TOP_LEVEL_KEYS = new Set([
  "schemaVersion",
  "note",
  "method",
  "judgedBy",
  "raters",
  "lastStep",
  "source",
  "assignment",
  "pairsJudged",
  "pairsUnjudgeable",
  "verdicts",
  "unjudgeable",
  "keyNote",
]);
const VERDICT_KEYS = new Set([
  "n",
  "judgedCropSha256",
  "elementId",
  "same",
  "note",
  "raterConfidence",
]);
const RATER_CONFIDENCE = new Set(["low", "medium", "high"]);
const PAIR_JUDGED_SOURCES = new Set(["deterministic", "adjudicated"]);
const PAIR_JUDGED_ASSIGNMENTS = new Set(["nearest", "one-to-one", "quantity-informed"]);
const RATER_KEYS = [
  "adjudicationNote",
  "agreement",
  "descriptionDivergenceAdjudicated",
  "primary",
  "secondary",
];
const UNJUDGEABLE_KEYS = ["callouts", "elementId", "judgedCropSha256", "n", "pieces", "reason"];

function describeVerdict(verdict, position) {
  const ordinal = Number.isInteger(verdict?.n) ? `n ${verdict.n}` : `position ${position}`;
  return `${ordinal} (crop ${JSON.stringify(verdict?.judgedCropSha256 ?? "missing")}, element ${JSON.stringify(verdict?.elementId ?? "missing")})`;
}

/**
 * Bounded structural check on retained verdict JSON after byte authentication.
 *
 * @internal The value must be ordinary parsed JSON returned by
 * `readJsonArtifact` or `authenticateJsonArtifact`. This structured seam does
 * not claim to safely inspect accessors, proxies, or mutable caller objects.
 */
export function assertPairJudgedTruthFromParsedJson(value, label = "Pair-judged truth") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `${label} must be a JSON object carrying ${PART_TRUTH_SCHEMA} verdicts; received ${Array.isArray(value) ? "an array" : typeof value}.`,
    );
  }
  if (value.schemaVersion !== PART_TRUTH_SCHEMA) {
    const migration =
      value.schemaVersion === "lego.part-identification-truth/2"
        ? "Schema /2 stores only a crop prefix. Expand each prefix only when the retained authenticated feature generation resolves it to exactly one distinct full crop digest; re-judge any missing or ambiguous pair."
        : "Schema /1 stores cluster indexes. Restore the exact gallery generation it was judged against or re-judge the pairs; current cluster positions cannot recover that evidence.";
    throw new Error(
      `${label} declares schema ${JSON.stringify(value.schemaVersion ?? "missing")}, but only ${PART_TRUTH_SCHEMA} keys a verdict to the exact full judged crop and claimed element. ${migration}`,
    );
  }
  const unexpectedTopLevel = Object.keys(value).filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (unexpectedTopLevel.length > 0) {
    throw new Error(
      `${label} carries unsupported top-level fields ${JSON.stringify(unexpectedTopLevel)}. ${PART_TRUTH_SCHEMA} accepts only the bounded pair-sheet metadata, verdicts, and unjudgeable rows; remove detached fields instead of letting an unauthenticated extension influence a consumer.`,
    );
  }
  for (const field of ["note", "method", "judgedBy", "keyNote"]) {
    if (
      value[field] !== undefined &&
      (typeof value[field] !== "string" || value[field].length > MAX_PAIR_JUDGED_NOTE_LENGTH)
    ) {
      throw new Error(
        `${label} top-level ${field} must be a string of at most ${MAX_PAIR_JUDGED_NOTE_LENGTH} characters when present.`,
      );
    }
  }
  if (value.source !== undefined && !PAIR_JUDGED_SOURCES.has(value.source)) {
    throw new Error(
      `${label} top-level source must be deterministic or adjudicated when present; received ${JSON.stringify(value.source)}. Restore the bounded claim source the pair sheets used instead of attaching an unrecognized producer to these verdicts.`,
    );
  }
  if (value.assignment !== undefined && !PAIR_JUDGED_ASSIGNMENTS.has(value.assignment)) {
    throw new Error(
      `${label} top-level assignment must be nearest, one-to-one, or quantity-informed when present; received ${JSON.stringify(value.assignment)}. Restore the bounded assignment mode the pair sheets used instead of projecting these verdicts onto an unrecognized claim policy.`,
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
  if (
    !Number.isInteger(value.pairsJudged) ||
    value.pairsJudged !== value.verdicts.length ||
    !Number.isInteger(value.pairsUnjudgeable) ||
    value.pairsUnjudgeable < 0 ||
    !Array.isArray(value.unjudgeable) ||
    value.unjudgeable.length !== value.pairsUnjudgeable
  ) {
    throw new Error(
      `${label} must declare pairsJudged equal to verdicts.length and pairsUnjudgeable equal to unjudgeable.length; received ${JSON.stringify({ pairsJudged: value.pairsJudged, verdicts: value.verdicts.length, pairsUnjudgeable: value.pairsUnjudgeable, unjudgeable: Array.isArray(value.unjudgeable) ? value.unjudgeable.length : "missing" })}. Preserve the complete pair-sheet accounting rather than dropping rows that did not produce a verdict.`,
    );
  }
  if (value.verdicts.length > MAX_PAIR_JUDGED_VERDICTS) {
    throw new Error(
      `${label} carries ${value.verdicts.length} verdicts; the bounded maximum is ${MAX_PAIR_JUDGED_VERDICTS}. Split the label set or raise the bound deliberately.`,
    );
  }
  const pairSheetRows = value.verdicts.length + value.unjudgeable.length;
  if (pairSheetRows > MAX_PAIR_JUDGED_VERDICTS) {
    throw new Error(
      `${label} carries ${pairSheetRows} total judged and unjudgeable pair-sheet rows; the bounded maximum is ${MAX_PAIR_JUDGED_VERDICTS}. Split the label set or raise the bound deliberately before validating or sorting the rows.`,
    );
  }
  if (value.raters !== undefined) {
    const raters = value.raters;
    if (
      typeof raters !== "object" ||
      raters === null ||
      Array.isArray(raters) ||
      Object.keys(raters).sort().join(",") !== RATER_KEYS.join(",")
    ) {
      throw new Error(
        `${label} top-level raters must contain exactly agreement, primary, secondary, descriptionDivergenceAdjudicated, and adjudicationNote. Detached rater metadata cannot establish how these pair-sheet rows were reviewed.`,
      );
    }
    for (const field of ["primary", "secondary"]) {
      if (
        typeof raters[field] !== "string" ||
        raters[field].length < 1 ||
        raters[field].length > MAX_RATER_NAME_LENGTH
      ) {
        throw new Error(
          `${label} raters.${field} must be a non-empty string of at most ${MAX_RATER_NAME_LENGTH} characters.`,
        );
      }
    }
    if (raters.primary === raters.secondary) {
      throw new Error(
        `${label} raters.primary and raters.secondary must name distinct independent raters; both are ${JSON.stringify(raters.primary)}.`,
      );
    }
    const agreementMatch =
      typeof raters.agreement === "string" ? RATER_AGREEMENT.exec(raters.agreement) : null;
    const agreementCount = agreementMatch === null ? NaN : Number(agreementMatch[1]);
    const reviewedCount = agreementMatch === null ? NaN : Number(agreementMatch[2]);
    if (
      agreementMatch === null ||
      agreementCount > reviewedCount ||
      reviewedCount !== pairSheetRows
    ) {
      throw new Error(
        `${label} raters.agreement must be a bounded "agreed/reviewed" count whose reviewed count equals all ${pairSheetRows} pair-sheet rows and whose agreed count does not exceed it; received ${JSON.stringify(raters.agreement)}.`,
      );
    }
    if (
      typeof raters.adjudicationNote !== "string" ||
      raters.adjudicationNote.length < 1 ||
      raters.adjudicationNote.length > MAX_PAIR_JUDGED_NOTE_LENGTH
    ) {
      throw new Error(
        `${label} raters.adjudicationNote must be a non-empty string of at most ${MAX_PAIR_JUDGED_NOTE_LENGTH} characters.`,
      );
    }
    const adjudicated = raters.descriptionDivergenceAdjudicated;
    if (!Array.isArray(adjudicated) || adjudicated.length > pairSheetRows) {
      throw new Error(
        `${label} raters.descriptionDivergenceAdjudicated must be a bounded array containing at most one ordinal for each of the ${pairSheetRows} pair-sheet rows.`,
      );
    }
    for (const [position, ordinal] of adjudicated.entries()) {
      if (
        !Number.isInteger(ordinal) ||
        ordinal < 1 ||
        ordinal > pairSheetRows ||
        (position > 0 && ordinal <= adjudicated[position - 1])
      ) {
        throw new Error(
          `${label} raters.descriptionDivergenceAdjudicated must contain unique pair-sheet ordinals in strictly increasing order from 1 through ${pairSheetRows}; received ${JSON.stringify(adjudicated)}.`,
        );
      }
    }
  }
  const seen = new Map();
  const seenOrdinals = new Set();
  for (const [position, verdict] of value.verdicts.entries()) {
    if (typeof verdict !== "object" || verdict === null || Array.isArray(verdict)) {
      throw new Error(`${label} verdict at position ${position} is not an object.`);
    }
    const verdictKeys = Object.keys(verdict);
    if (verdictKeys.some((key) => !VERDICT_KEYS.has(key))) {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} carries unsupported fields ${JSON.stringify(verdictKeys.filter((key) => !VERDICT_KEYS.has(key)))}. A verdict may contain only n, judgedCropSha256, elementId, same, an optional note, and optional bounded raterConfidence.`,
      );
    }
    if (!Number.isInteger(verdict.n) || verdict.n < 1 || verdict.n > MAX_PAIR_JUDGED_VERDICTS) {
      throw new Error(
        `${label} verdict at position ${position} declares pair-sheet ordinal n ${JSON.stringify(verdict.n ?? "missing")}; it must be an integer from 1 through ${MAX_PAIR_JUDGED_VERDICTS}.`,
      );
    }
    if (
      typeof verdict.judgedCropSha256 !== "string" ||
      !JUDGED_CROP_DIGEST.test(verdict.judgedCropSha256)
    ) {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} has no exact "sha256:" crop digest of 64 lowercase hex characters. A prefix cannot establish byte identity, and a verdict that names no full crop was judged against a generation that cannot bind current trust.`,
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
    if (
      verdict.raterConfidence !== undefined &&
      (typeof verdict.raterConfidence !== "object" ||
        verdict.raterConfidence === null ||
        Array.isArray(verdict.raterConfidence) ||
        Object.keys(verdict.raterConfidence).sort().join(",") !== "primary,secondary" ||
        !RATER_CONFIDENCE.has(verdict.raterConfidence.primary) ||
        !RATER_CONFIDENCE.has(verdict.raterConfidence.secondary))
    ) {
      throw new Error(
        `${label} verdict ${describeVerdict(verdict, position)} has malformed raterConfidence. When present it must contain exactly primary and secondary, each low, medium, or high.`,
      );
    }
    const key = truthVerdictKey(verdict.judgedCropSha256, verdict.elementId);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(
        `${label} judges the same pair twice: ${describeVerdict(verdict, position)} repeats key ${key}, first seen at position ${previous.position} with same ${previous.same}. One drawing claimed to be one element has one verdict; remove the duplicate rather than letting file order decide.`,
      );
    }
    if (seenOrdinals.has(verdict.n)) {
      throw new Error(
        `${label} repeats pair-sheet ordinal n ${verdict.n}; every judged or unjudgeable row must appear exactly once.`,
      );
    }
    seen.set(key, { position, same: verdict.same, n: verdict.n });
    seenOrdinals.add(verdict.n);
  }
  for (const [position, entry] of value.unjudgeable.entries()) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !== UNJUDGEABLE_KEYS.join(",") ||
      !Number.isInteger(entry.n) ||
      !JUDGED_CROP_DIGEST.test(entry.judgedCropSha256 ?? "") ||
      entry.elementId !== null ||
      typeof entry.reason !== "string" ||
      entry.reason.length < 1 ||
      entry.reason.length > MAX_PAIR_JUDGED_NOTE_LENGTH ||
      !Number.isSafeInteger(entry.callouts) ||
      entry.callouts < 1 ||
      !Number.isSafeInteger(entry.pieces) ||
      entry.pieces < 1
    ) {
      throw new Error(
        `${label} unjudgeable pair at position ${position} must retain an integer n, exact full crop digest, null elementId, bounded non-empty reason, and positive callout/piece counts; received ${JSON.stringify(entry)}. Restore it from the exact pair-sheet index rather than treating an absent verdict as absent evidence.`,
      );
    }
    const key = `${entry.judgedCropSha256}:null`;
    if (seen.has(key) || seenOrdinals.has(entry.n)) {
      throw new Error(
        `${label} repeats unjudgeable pair n ${entry.n} or crop key ${key}; each pair-sheet row must appear exactly once across verdicts and unjudgeable entries.`,
      );
    }
    seen.set(key, { position, n: entry.n });
    seenOrdinals.add(entry.n);
  }
  const ordinals = [...seen.values()].map(({ n }) => n).sort((left, right) => left - right);
  const expectedOrdinals = Array.from({ length: ordinals.length }, (_, index) => index + 1);
  if (!ordinals.every((ordinal, index) => ordinal === expectedOrdinals[index])) {
    throw new Error(
      `${label} pair-sheet ordinals must cover every row from 1 through ${ordinals.length} exactly once; received ${JSON.stringify(ordinals)}. Restore missing judged or unjudgeable rows instead of renumbering surviving evidence.`,
    );
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
/**
 * @internal Every structured input must come from an authenticated strict-JSON
 * artifact and its schema-specific validator before this binding step.
 */
export function pairJudgedVerdictsByCalloutIndexFromParsedJson(input) {
  const { lastStep } = assertPairJudgedTruthFromParsedJson(
    input.truth,
    input.label ?? "Pair-judged truth",
  );
  const { bound } = verdictsByCropDigest(input.truth);
  const pairs = judgedPairs(input.features, input.claims, lastStep);
  const verdicts = new Map();
  for (const [index, callout] of input.features.callouts.entries()) {
    if (callout?.evidenceKind !== "part-art") continue;
    if (!Number.isInteger(callout.stepNumber) || callout.stepNumber > lastStep) continue;
    const claim = input.claims.get(index);
    if (!claim || claim.elementId === null || claim.elementId === undefined) continue;
    const pair = pairs.get(truthVerdictKey(callout.sha256, claim.elementId));
    if (pair === undefined || pair.elementId === null) continue;
    // A similarity cluster is an economy, not a statement that every member is
    // the exact picture the rater saw. Only byte-identical crops inherit the
    // lead judgement. Full digests are compared before the exact full-digest
    // crop-and-element key is consulted, so a shared prefix cannot transfer trust.
    if (callout.sha256 !== pair.leadSha256) continue;
    const key = truthVerdictKey(pair.leadSha256, pair.elementId);
    const verdict = bound.get(key);
    if (verdict === undefined) continue;
    verdicts.set(index, {
      verdict: verdict.same === true ? "same" : "different",
      judgedCrop: pair.leadSha256,
      judgedElementId: pair.elementId,
    });
  }
  return verdicts;
}
