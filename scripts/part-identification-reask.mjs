import { createHash } from "node:crypto";

import { mirrorTwinCandidate } from "./part-identification-mirror-pairs.mjs";
import { visionPick } from "./part-identification-score.mjs";
import { PART_IDENTIFICATION_MAX_NOTE_LENGTH } from "./part-identification-prompt.mjs";
import { requirePinnedPartIdentificationModel } from "./part-identification-model.mjs";

/**
 * One pointed follow-up question, where the first answer left exactly two candidates standing.
 *
 * The closed choice is the whole design and it is not weakened here. Asking
 * "which numbered candidate is this" scores 84/84; asking the model to name a
 * part from memory scored 39.9%. A re-ask therefore narrows the same closed
 * question rather than opening it — two numbers instead of six — and never asks
 * for a description.
 *
 * Only one question shape exists, deliberately. A separation between two named
 * candidates covers both cases the grounding actually found on these cards: a
 * pick whose mirror twin sits on the same card and was never named, and a
 * declared second choice. A viewpoint observation has no rival to separate it
 * from and would need an open question, which is the thing that scores 39.9%, so
 * it is reported and left alone.
 *
 * The re-ask can only ever remove trust. It is not permitted to earn a claim
 * back, and the reason is specific: the question hands the model the two
 * candidate numbers in its own wording, so any reply names one of them and a
 * check keyed on the reply would be the question grading itself. So a re-ask
 * that agrees changes nothing, and a re-ask that disagrees is surfaced as a
 * contradiction for a person to act on. The handedness question is now settled
 * from the card's pixels where the card can settle it, which leaves the re-ask
 * for the cards it cannot.
 *
 * There is no recursion and it is structural rather than promised: the planner
 * takes the first-pass answers and nothing else, the record binds the exact
 * bytes of the answers file it was derived from, and the bundle declares a
 * generation that the reader refuses at any value but 1.
 */

export const PART_REASK_SCHEMA = "lego.part-identification-reasks/1";

/** The generation a re-ask bundle may declare. Nothing may be derived from a re-ask. */
export const REASK_GENERATION = 1;

/** Default and hard ceiling on how many follow-up calls one pass may make. */
export const DEFAULT_MAX_REASKS = 24;
export const MAX_REASKS = 64;
export const PART_IDENTIFICATION_REASK_DISABLED_MESSAGE =
  "Part-identification re-ask is disabled before artifact reads, output writes, or provider work: no reviewed card-digest-bound provider policy/privacy authorization and immutable launch-settlement lineage exists, and re-ask lacks its own strict one-shot MCP call-proof/checkpoint contract.";

export function requirePartIdentificationReaskAuthorization() {
  throw new Error(PART_IDENTIFICATION_REASK_DISABLED_MESSAGE);
}

/**
 * Enough of a refused reply to see which rule it broke.
 *
 * Longer than the 120 characters a quoted source line gets, because a refused
 * reply is one JSON object and cutting it at 120 hides the offending key. Shared
 * with the first pass, which had the same hole.
 */
export const MAX_QUOTED_REFUSAL = 400;

/**
 * How long the one sentence explaining a re-ask may be.
 *
 * The same bound as a first-pass note, and for the same reason: it is the same
 * kind of sentence about the same drawings, and that limit was already tuned
 * against real replies from this model on these cards. A tighter one here was
 * arbitrary and cost a real answer — the first live re-ask on card-0079 came
 * back correct and well-formed, and a reply of this shape sits at 179
 * characters, close enough to 200 that a slightly fuller sentence is refused for
 * length alone. Refusing a right answer over a limit nothing chose deliberately
 * is the worst kind of strictness.
 */
export const MAX_BECAUSE_LENGTH = PART_IDENTIFICATION_MAX_NOTE_LENGTH;

/**
 * Why a drawing was asked again, and what the reader is told when it is.
 *
 * The hint is a fact about the card computed from the published part names
 * before any answer exists — that two candidates are opposite hands is not
 * something the model told us. Handing it over is what makes the question
 * pointed rather than a repeat, and it is exactly why the reply is recorded as
 * its own answer under its own prompt digest instead of overwriting the first.
 */
export const REASK_REASONS = Object.freeze({
  "handedness-unverified": {
    hint: "These two candidates are the same part in opposite hands, so one of them is the mirror image of the other. Decide which hand the query shows.",
    why: "the pick's mirror twin was displayed on the same card and the two drawings could not be separated by silhouette",
  },
  "declared-mirrored": {
    hint: "These two candidates are the same part in opposite hands, so one of them is the mirror image of the other. Decide which hand the query shows.",
    why: "the first answer said the query is the mirror of the candidate it picked",
  },
  "second-choice-offered": {
    hint: "The first pass named both of these and could not separate them. Decide which one the query is.",
    why: "the first answer named a second candidate it could not rule out",
  },
});

export const PART_REASK_PROMPT = [
  "Each image shows one LEGO part drawing from an instruction booklet (QUERY), and numbered",
  "CANDIDATE drawings taken from the same booklet's own parts list. You have seen this image",
  "before and answered about it; this is one narrower question about the same picture.",
  "For each image you are given exactly two candidate numbers. The query is one of them.",
  "Look at the query and at those two candidates only, and say which of the two it is.",
  "Reply with one line per image, each line beginning with the image's card id, then the JSON",
  '{"pick":<one of the two numbers you were given, or 0>,"because":"<one short sentence>"}.',
  "No prose, no code fences. Those two keys exactly: no card id inside the object, no confidence,",
  "no other field, or the whole line is refused and the question is wasted.",
  "Answer 0 only if the query is neither of the two, which should be rare — you are being asked",
  "because the first pass had already narrowed it to these two.",
  // The free text is required here where it is optional on the first pass, and
  // the asymmetry is the point. A first-pass note is a signal that an image was
  // unusual, so it earns its meaning by being rare. A re-ask has already been
  // selected as unusual, and the whole reason the question is being put again is
  // that the record could not say what settled it; a reply that returned a bare
  // number would reproduce the hole it was sent to fill.
  "because is required and must name the specific visible thing that decided it — which edge is",
  "straight, which side the steps or the taper are on, which stud or notch is present — not a",
  "feeling and not a restatement of the part's name or size.",
  `Keep because on the one line, under ${MAX_BECAUSE_LENGTH} characters, with no braces and no line breaks.`,
].join(" ");

export const PART_REASK_PROMPT_DIGEST = `sha256:${createHash("sha256").update(PART_REASK_PROMPT).digest("hex")}`;

const cardIdFor = (clusterIndex) => `card-${String(clusterIndex).padStart(4, "0")}`;

/**
 * Which drawings are worth one more call, in a fixed order.
 *
 * Reads the first-pass answers and the card facts, and nothing else — there is
 * no parameter through which a previous re-ask could enter, which is what makes
 * "no recursion" a property of the signature rather than a rule someone has to
 * remember.
 *
 * A pick that already named its mirror is not a target: it has been settled by
 * the check the grader actually runs, and asking again would spend a call to
 * confirm something already earned.
 */
export function planReasks({
  match,
  answers,
  cards,
  names,
  handedness = null,
  max = DEFAULT_MAX_REASKS,
}) {
  if (!Number.isInteger(max) || max < 0 || max > MAX_REASKS) {
    throw new Error(
      `Re-ask budget must be an integer from 0 through ${MAX_REASKS}; received ${JSON.stringify(max)}. ` +
        `The bound exists so a widened schema cannot turn one offline pass into an unbounded conversation.`,
    );
  }
  const targets = [];
  for (const cluster of match.clusters) {
    const answer = answers?.[cluster.clusterIndex] ?? null;
    if (answer === null || answer === undefined || answer.pick === 0) continue;
    const cardId = cardIdFor(cluster.clusterIndex);
    const displayed = cards?.[cardId]?.candidateElementIds ?? null;
    if (!Array.isArray(displayed)) continue;
    const label = visionPick(cluster, answers, names, cards, handedness).picked;
    const twin = mirrorTwinCandidate(displayed, names, answer.pick);
    let reason = null;
    let rival = 0;
    // A hand the card's own pixels refuted is not a question for the model: the
    // drawing already answered it, and putting it again would offer a call the
    // chance to overturn a measurement with an opinion. Only a card that could
    // not separate the two hands is worth a follow-up.
    if (label === "handedness-unverified" && twin !== 0) {
      reason = "handedness-unverified";
      rival = twin;
    } else if (answer.differsFromPick === "mirrored" && twin !== 0) {
      reason = "declared-mirrored";
      rival = twin;
    } else if (answer.alsoCouldBe !== 0) {
      reason = "second-choice-offered";
      rival = answer.alsoCouldBe;
    }
    if (reason === null || rival === 0 || rival === answer.pick) continue;
    targets.push({
      clusterIndex: cluster.clusterIndex,
      cardId,
      reason,
      firstPick: answer.pick,
      between: [answer.pick, rival].sort((left, right) => left - right),
    });
  }
  return targets.slice(0, max);
}

const REASK_FIELDS = ["because", "pick"].join(",");

export function validReaskReply(reply, between) {
  if (typeof reply !== "object" || reply === null || Array.isArray(reply)) return false;
  if (Object.keys(reply).sort().join(",") !== REASK_FIELDS) return false;
  if (!Number.isInteger(reply.pick) || (reply.pick !== 0 && !between.includes(reply.pick))) {
    return false;
  }
  if (
    typeof reply.because !== "string" ||
    reply.because.trim().length === 0 ||
    reply.because.length > MAX_BECAUSE_LENGTH
  ) {
    return false;
  }
  for (const character of reply.because) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f || character === "{" || character === "}") return false;
  }
  return true;
}

export function assertReaskReply(reply, between, label = "Re-ask reply") {
  if (!validReaskReply(reply, between)) {
    throw new Error(
      `${label} must be an exact {because, pick} object whose pick is 0 or one of the two offered candidate numbers ` +
        `${JSON.stringify(between)}, with a non-empty because of at most ${MAX_BECAUSE_LENGTH} characters carrying no braces or control characters.`,
    );
  }
  return reply;
}

/**
 * One bounded call carrying several narrowed questions.
 *
 * Batched for the same reason the first pass is: almost all of the cost is per
 * call. Each question names its own card id and its own two numbers, and each
 * reply is matched back by that tag read from the text before the JSON, so a
 * call that answers four of six loses two answers rather than shifting all of
 * them onto the wrong cards.
 */
export async function askReaskBatch(targets, model, context = {}) {
  requirePinnedPartIdentificationModel(model);
  void targets;
  void context;
  requirePartIdentificationReaskAuthorization();
}
export const reaskBundle = ({
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  answersDigest,
  reasks,
}) => ({
  schemaVersion: PART_REASK_SCHEMA,
  generation: REASK_GENERATION,
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  // The exact bytes of the first-pass answers this was derived from. A re-ask
  // fed back in as a source would not reproduce this digest, and a first pass
  // re-run invalidates every re-ask against it rather than silently carrying
  // stale follow-ups onto new answers.
  answersDigest,
  reaskPromptDigest: PART_REASK_PROMPT_DIGEST,
  reasks,
});

/**
 * The recorded re-asks, checked against the run they claim to be about.
 *
 * `agrees` is computed here rather than stored, so no artifact can assert that a
 * follow-up confirmed a pick; the record holds the question that was put and the
 * answer that came back, and agreement is derived from those two every time it
 * is read.
 */
export function boundReasks(bundle, { model, matchDigest, cardsDigest, answersDigest }) {
  const mismatches = [];
  if (bundle?.schemaVersion !== PART_REASK_SCHEMA) {
    mismatches.push(
      `schemaVersion observed ${JSON.stringify(bundle?.schemaVersion)} but required ${JSON.stringify(PART_REASK_SCHEMA)}`,
    );
  }
  if (bundle?.generation !== REASK_GENERATION) {
    mismatches.push(
      `generation observed ${JSON.stringify(bundle?.generation)} but required ${REASK_GENERATION}; a re-ask may never be derived from a re-ask`,
    );
  }
  if (bundle?.reaskPromptDigest !== PART_REASK_PROMPT_DIGEST) {
    mismatches.push(
      `reaskPromptDigest observed ${JSON.stringify(bundle?.reaskPromptDigest)} but required ${JSON.stringify(PART_REASK_PROMPT_DIGEST)}`,
    );
  }
  for (const [field, required] of [
    ["model", model],
    ["matchDigest", matchDigest],
    ["cardsDigest", cardsDigest],
    ["answersDigest", answersDigest],
  ]) {
    if (bundle?.[field] !== required) {
      mismatches.push(
        `${field} observed ${JSON.stringify(bundle?.[field])} but required ${JSON.stringify(required)}`,
      );
    }
  }
  const records = bundle?.reasks;
  if (typeof records !== "object" || records === null || Array.isArray(records)) {
    mismatches.push("reasks must be an object keyed by cluster index");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Recorded re-asks do not bind the run they claim to be about: ${mismatches.join("; ")}. ` +
        `Re-run "node scripts/part-identification.mjs reask" against the current answers, or delete the stale bundle.`,
    );
  }
  return Object.entries(records)
    .map(([key, record]) => ({ ...record, clusterIndex: Number(key) }))
    .sort((left, right) => left.clusterIndex - right.clusterIndex)
    .map((record) => ({
      ...record,
      agrees: record.pick === 0 ? null : record.pick === record.firstPick,
    }));
}
