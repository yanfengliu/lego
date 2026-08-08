import { candidatesNamedInNote, mirrorTwinCandidate } from "./part-identification-mirror-pairs.mjs";
import { visionPick } from "./part-identification-score.mjs";

/**
 * The reader the written observations have to have.
 *
 * This repository has already paid for the alternative. The booklet's rotate
 * icon was detected, measured, and correctly identified as a viewpoint change,
 * and then consumed by nothing for weeks while a lesson argued it was probably
 * page chrome; that single unread signal inverted the face parity of every step
 * after it. Widening the reply schema so the call can say what it sees only
 * moves that failure one field along unless something prints what it said.
 *
 * So this module turns the answers into a document a person reads: the themes
 * that recur, every declared difference, every doubt with the cause the call
 * gave for it, and every two-way ambiguity. Nothing here decides anything —
 * `part-identification-score.mjs` still owns what becomes a claim — and that is
 * deliberate, because a report that could promote an answer would be the call
 * grading itself.
 *
 * The grouping is deterministic and offline. That is not a limitation worked
 * around, it is required: the gate in `check-observation-consumers.mjs` proves
 * the report is current by regenerating it and comparing bytes, and a model call
 * in this path would make "stale" and "asked again" indistinguishable.
 */

/** Below this, an answer is reported with whatever cause it managed to state. */
export const LOW_CONFIDENCE = 0.8;

/** How many notes must share a term before it is a theme rather than a coincidence. */
const MIN_CLUSTER_SIZE = 2;

/**
 * A term in more than this share of the notes describes the corpus, not a theme.
 *
 * No domain lexicon is used anywhere in here on purpose. A hand-written list of
 * words to look for is the same mistake as a hand-written list of failure modes:
 * it can only find what somebody already knew to name. Frequency over the notes
 * themselves finds a theme the first time a run produces one, with no code
 * change, which is the property that lets the vocabulary close instead of grow.
 */
const MAX_TERM_SHARE = 0.6;

const STOPWORDS = new Set(
  [
    "about, all, also, and, any, are, but, can, cannot, could, did, does, down, each, either, else",
    "for, from, get, given, had, has, have, here, how, into, its, just, like, made, make, may, might",
    "more, most, much, must, not, off, one, only, other, our, out, over, same, see, should, since",
    "some, still, such, than, that, the, their, them, then, there, these, they, this, those, through",
    "too, until, use, used, using, very, was, way, were, what, when, where, which, while, who",
    "why, will, with, within, would, you, your",
  ]
    .join(", ")
    .split(", "),
);

/**
 * Approximate English stemming, and approximate is the right target.
 *
 * The job is only to stop "mirror", "mirrors" and "mirrored" counting as three
 * unrelated terms; over a few dozen short sentences a full stemmer would buy
 * nothing a reader could notice and would need its own tests.
 */
export function stemTerm(word) {
  let stem = word;
  if (stem.length > 4 && /(?:s|x|z|ch|sh)es$/u.test(stem)) stem = stem.slice(0, -2);
  else if (stem.length > 3 && stem.endsWith("s") && !stem.endsWith("ss")) stem = stem.slice(0, -1);
  const verbal =
    stem.length > 5 && stem.endsWith("ing") ? 3 : stem.length > 4 && stem.endsWith("ed") ? 2 : 0;
  if (verbal === 0) return stem;
  stem = stem.slice(0, -verbal);
  // "stepped" leaves "stepp", which groups perfectly well and reads as a typo.
  // These stems are printed as the name of a theme, so the doubled consonant an
  // English suffix adds is undone: a heading a person cannot read is a heading
  // they skip.
  return /([^aeiou])\1$/u.test(stem) && !/(?:ll|ss|ff|zz)$/u.test(stem) ? stem.slice(0, -1) : stem;
}

/**
 * The stems one written sentence contains.
 *
 * "candidate" is dropped rather than left to the frequency rule. The prompt
 * requires that word wherever a note points at another drawing, so it is a
 * grammatical fixture of the corpus; leaving it in makes every note that follows
 * the instruction look related to every other one.
 */
export function noteTerms(note) {
  if (typeof note !== "string") return new Set();
  const terms = new Set();
  for (const word of note.toLowerCase().match(/[a-z]+/gu) ?? []) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    const stem = stemTerm(word);
    if (stem === "candidate" || stem.length < 3) continue;
    terms.add(stem);
  }
  return terms;
}

/**
 * Recurring themes, discovered from the notes rather than looked up.
 *
 * Greedy on the most-shared salient term: the term the largest number of
 * unassigned notes have in common names a theme, those notes leave the pool, and
 * the process repeats. Each theme then reports the stems every one of its
 * members carries, which is what makes the group legible — "mirror, stepped,
 * edge" says what the theme is in a way "cluster 2" never could.
 *
 * Notes that join nothing are not discarded. They are returned as one-offs and
 * printed in full, because the whole premise of an optional observation field is
 * that a call wrote only when it had something to say, and a singleton is the
 * most likely place for the thing nobody has seen before.
 */
export function clusterObservations(records) {
  const written = records.filter(({ note }) => typeof note === "string" && note.length > 0);
  const terms = new Map(written.map((record) => [record, noteTerms(record.note)]));
  const documentFrequency = new Map();
  for (const set of terms.values()) {
    for (const term of set) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const ceiling = Math.max(MIN_CLUSTER_SIZE, Math.floor(written.length * MAX_TERM_SHARE));
  const salient = new Set(
    [...documentFrequency]
      .filter(([, count]) => count >= MIN_CLUSTER_SIZE && count <= ceiling)
      .map(([term]) => term),
  );

  const unassigned = new Set(written);
  const clusters = [];
  for (;;) {
    let best = null;
    for (const term of [...salient].sort()) {
      const members = [...unassigned].filter((record) => terms.get(record).has(term));
      if (members.length < MIN_CLUSTER_SIZE) continue;
      if (best === null || members.length > best.members.length) best = { term, members };
    }
    if (best === null) break;
    const shared = [
      ...best.members
        .map((record) => terms.get(record))
        .reduce((left, right) => new Set([...left].filter((term) => right.has(term)))),
    ]
      .filter((term) => salient.has(term))
      .sort();
    clusters.push({
      label: best.term,
      terms: shared.length > 0 ? shared : [best.term],
      members: best.members.sort((left, right) => left.clusterIndex - right.clusterIndex),
    });
    for (const record of best.members) unassigned.delete(record);
    salient.delete(best.term);
  }
  return {
    clusters,
    oneOffs: [...unassigned].sort((left, right) => left.clusterIndex - right.clusterIndex),
  };
}

const cardIdFor = (clusterIndex) => `card-${String(clusterIndex).padStart(4, "0")}`;

/**
 * One row per answered drawing, with what the grader then did to it.
 *
 * The label matters as much as the sentence. "The call wrote that candidate 4 is
 * the same mould in a dark shade, and its pick was thrown out on kind" is a work
 * item; the sentence on its own is a curiosity.
 */
export function observationRecords({ match, answers, cards, names, handedness = null }) {
  const rows = [];
  for (const cluster of match.clusters) {
    const answer = answers?.[cluster.clusterIndex] ?? null;
    if (answer === null || answer === undefined) continue;
    const cardId = cardIdFor(cluster.clusterIndex);
    const displayed = cards?.[cardId]?.candidateElementIds ?? null;
    const at = (number) =>
      Array.isArray(displayed) && number >= 1 && number <= displayed.length
        ? displayed[number - 1]
        : null;
    const pickedElementId = at(answer.pick);
    const secondElementId = at(answer.alsoCouldBe);
    const mirrorCandidate = mirrorTwinCandidate(displayed, names, answer.pick);
    const mirrorElementId = at(mirrorCandidate);
    const hand =
      (handedness instanceof Map ? handedness.get(cardId) : handedness?.[cardId]) ?? null;
    const nameOf = (elementId) =>
      elementId === null ? null : (names?.get?.(elementId)?.name ?? null);
    rows.push({
      clusterIndex: cluster.clusterIndex,
      cardId,
      lead: cluster.lead,
      pieces: cluster.pieces,
      pick: answer.pick,
      pickedElementId,
      pickedName: nameOf(pickedElementId),
      alsoCouldBe: answer.alsoCouldBe,
      secondElementId,
      secondName: nameOf(secondElementId),
      mirrorCandidate,
      mirrorName: nameOf(mirrorElementId),
      // What the card's own pixels said about the hand, and the two numbers that
      // said it. Printed rather than summarised, because a reader who is told
      // only "upheld" has to take the check's word for it.
      handRead: hand?.decided === true ? hand.hand : null,
      handReason: hand?.decided === true ? null : (hand?.reason ?? "no-verdict"),
      queryAgainstPick: hand?.queryAgainstPick ?? null,
      queryAgainstTwin: hand?.queryAgainstTwin ?? null,
      differsFromPick: answer.differsFromPick,
      confidence: answer.confidence,
      said: `${answer.kind} ${answer.studsLong}x${answer.studsWide} ${answer.colour}`,
      note: typeof answer.note === "string" && answer.note.length > 0 ? answer.note : null,
      label: visionPick(cluster, answers, names, cards, handedness).picked,
    });
  }
  return rows;
}

/**
 * What the call stated as the cause of its own doubt, or that it stated none.
 *
 * `confidence` is one scalar over every kind of uncertainty, and the previous
 * run proved it inert: inverting all 240 values changed 0 of 859 claims. The
 * fields added beside it are supposed to carry the cause instead, so the honest
 * thing to print for a doubtful answer with none of them set is that the doubt
 * arrived with no cause attached — and to count those, because that count is the
 * measure of whether the new fields are actually being used where they matter.
 */
export function statedCause(record) {
  const causes = [];
  if (record.differsFromPick !== "nothing") causes.push(`differs: ${record.differsFromPick}`);
  if (record.alsoCouldBe !== 0) {
    causes.push(
      `or candidate ${record.alsoCouldBe}${record.secondName ? ` (${record.secondName})` : ""}`,
    );
  }
  if (record.note !== null) causes.push(`note: ${record.note}`);
  return causes;
}

const bullet = (record, extra = []) =>
  [
    `- \`${record.cardId}\` · pick ${record.pick}${record.pickedName === null ? "" : ` ${record.pickedName}`}` +
      ` · ${record.label} · said "${record.said}" · confidence ${record.confidence.toFixed(2)}`,
    ...extra.map((line) => `  - ${line}`),
  ].join("\n");

function section(heading, lines) {
  return [`## ${heading}`, "", ...lines, ""].join("\n");
}

/**
 * The document.
 *
 * Written whole from the answers every time rather than appended to, so the gate
 * can regenerate it and compare bytes. Nothing in here is a timestamp or a path
 * outside the repository, for the same reason.
 */
export function observationReport({ provenance, records, reasks = [] }) {
  const { clusters, oneOffs } = clusterObservations(records);
  const written = records.filter(({ note }) => note !== null);
  const differences = records.filter(({ differsFromPick }) => differsFromPick !== "nothing");
  const doubtful = records.filter(({ confidence }) => confidence < LOW_CONFIDENCE);
  const ambiguous = records.filter(({ alsoCouldBe }) => alsoCouldBe !== 0);
  const uncaused = doubtful.filter((record) => statedCause(record).length === 0);
  const paired = records.filter(({ mirrorCandidate }) => mirrorCandidate !== 0);
  const namedTheMirror = paired.filter(
    ({ note, mirrorCandidate }) =>
      note !== null && candidatesNamedInNote(note).has(mirrorCandidate),
  );
  const unreadHands = records.filter(({ label }) => label === "handedness-unverified");
  const refutedHands = records.filter(({ label }) => label === "handedness-refuted");

  const lines = [
    "# What the vision call observed",
    "",
    "Generated by `node scripts/part-identification.mjs observations`; regenerated and byte-compared by `npm run observations:check`.",
    "Every sentence below was written by the pinned model about one booklet drawing, and every one of them is reproduced in full.",
    "This file exists because the alternative has already been paid for once: the booklet's rotate icon was detected, measured and correctly named, then read by nothing for weeks, and the face parity of every step after it was wrong.",
    "Nothing here decides anything — the grader owns what becomes a claim — so a row saying an observation was written and its pick thrown out is a work item, not a contradiction.",
    "",
    section("Provenance", [
      `- model: \`${provenance.model}\``,
      `- answers: \`${provenance.answersDigest}\``,
      `- cards: \`${provenance.cardsDigest}\``,
      `- match: \`${provenance.matchDigest}\``,
      `- prompt: \`${provenance.promptDigest}\``,
      `- drawings answered: ${records.length} of ${provenance.drawings}`,
      `- notes written: ${written.length}`,
      `- declared differences: ${differences.length}`,
      `- second choices offered: ${ambiguous.length}`,
      `- picks whose mirror twin is on the same card: ${paired.length}`,
      `- of those, hand read from the card: ${paired.length - unreadHands.length - refutedHands.length} upheld, ${refutedHands.length} refuted, ${unreadHands.length} the card could not separate`,
      `- of those, mirror-pair awareness (the note named the twin's number, which does not say which hand it is): ${namedTheMirror.length}`,
      `- targeted re-asks recorded: ${reasks.length}`,
    ]),
    section(
      `Recurring observations (${clusters.length} theme${clusters.length === 1 ? "" : "s"} over ${written.length} note${written.length === 1 ? "" : "s"})`,
      written.length === 0
        ? [
            "No note was written in this run.",
            "",
            "That is a legitimate outcome — the prompt says leaving the note out is the expected answer — but it is also what a silently broken note path looks like, so the count is stated rather than the section omitted.",
          ]
        : [
            "Themes are the terms the notes turned out to share, not a list of failure modes anybody wrote down in advance.",
            "A new kind of observation forms its own theme the first time two notes agree, with no code change; until then it is a one-off below, printed in full.",
            "",
            ...clusters.flatMap((cluster) => [
              `### ${cluster.terms.join(" · ")} — ${cluster.members.length} notes`,
              "",
              ...cluster.members.map((record) => bullet(record, [`"${record.note}"`])),
              "",
            ]),
            ...(oneOffs.length === 0
              ? []
              : [
                  `### one-off observations — ${oneOffs.length}`,
                  "",
                  ...oneOffs.map((record) => bullet(record, [`"${record.note}"`])),
                  "",
                ]),
          ],
    ),
    section(
      `Declared differences (${differences.length})`,
      differences.length === 0
        ? ["Every answer said the query is the candidate it picked, with no difference to declare."]
        : [
            "An answer that declares a difference other than `view` is saying the candidate it named is not the query, so it claims nothing and the reason travels in the label.",
            "",
            ...differences.map((record) =>
              bullet(record, [
                `differs: **${record.differsFromPick}**`,
                ...(record.note === null ? [] : [`"${record.note}"`]),
              ]),
            ),
          ],
    ),
    section(
      `Doubt below ${LOW_CONFIDENCE.toFixed(2)} (${doubtful.length}, of which ${uncaused.length} state no cause)`,
      doubtful.length === 0
        ? ["No answer in this run sits below the reporting threshold."]
        : [
            "`confidence` is a single scalar over every kind of uncertainty, and the previous run proved it inert: inverting all 240 values changed 0 of 859 claims.",
            "The fields beside it are what carry a cause, so an answer here with nothing in the sub-bullets is doubt that arrived with no cause attached — that count is the measure of whether the widened schema is being used where it matters.",
            "",
            ...doubtful.map((record) => {
              const causes = statedCause(record);
              return bullet(record, causes.length === 0 ? ["**no stated cause**"] : causes);
            }),
          ],
    ),
    section(
      `Two-way ambiguity (${ambiguous.length})`,
      ambiguous.length === 0
        ? ["No answer named a second candidate it could not rule out."]
        : [
            "A declared second choice is half a vote in the global assignment (`pairCost`), carried only where the pick survived every check.",
            "Where the same drawing is also a re-ask target below, the two-way question was put back to the model as a closed choice.",
            "",
            ...ambiguous.map((record) =>
              bullet(record, [
                `also could be candidate ${record.alsoCouldBe}${record.secondName === null ? "" : ` — ${record.secondName}`}`,
                ...(record.note === null ? [] : [`"${record.note}"`]),
              ]),
            ),
          ],
    ),
    mirrorPairSection(records),
    reaskSection(reasks),
  ];
  return `${lines
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trimEnd()}\n`;
}

/**
 * The cards that showed both hands, and which hand their own pixels say the query is.
 *
 * Two statements per row, and they are not the same statement. The hand comes
 * from the drawing: the query silhouette against the picked candidate and
 * against its twin, the wider overlap deciding. Whether the note named the twin
 * is printed beside it as mirror-pair awareness and nothing more — that check
 * was once what promoted the pick, and it was refuted by execution, because the
 * twin's number is the same number whichever hand was picked.
 */
function mirrorPairSection(records) {
  const paired = records.filter(({ mirrorCandidate }) => mirrorCandidate !== 0);
  const undecided = paired.filter(({ handRead }) => handRead === null);
  return section(
    `Picks a mirror twin sits beside (${paired.length}, hand read from the card on ${paired.length - undecided.length})`,
    paired.length === 0
      ? ["No card in this run displayed both hands of a mirror pair under the pick."]
      : [
          "On these cards the kind/size/colour check provably cannot separate the pick from the other hand: `wedge 6x2 White` agrees exactly as well with `Wedge Plate 6 x 2 Right` as with `Left`.",
          "So the hand is read off the card instead — the query silhouette compared with each hand, and with each hand mirrored — and the wider overlap decides. A row whose pixels say the other hand is labelled `handedness-refuted`; a card that cannot separate the two is labelled `handedness-unverified` and stays unpromoted rather than being guessed.",
          "The note line is mirror-pair awareness only. Naming the twin's number does not say which hand the query is, and treating it as if it did is what let a swapped pick through.",
          "",
          ...paired.map((record) =>
            bullet(record, [
              `mirror twin is candidate ${record.mirrorCandidate}${record.mirrorName === null ? "" : ` — ${record.mirrorName}`}`,
              record.handRead === null
                ? `**hand not readable from the card: ${record.handReason}**`
                : `hand read from the card: candidate ${record.handRead}` +
                  ` (query overlaps pick ${formatOverlap(record.queryAgainstPick)}, twin ${formatOverlap(record.queryAgainstTwin)})`,
              record.note === null
                ? "note absent, so the pair was never mentioned"
                : `"${record.note}"`,
            ]),
          ),
        ],
  );
}

const formatOverlap = (value) => (typeof value === "number" ? value.toFixed(3) : "unmeasured");

/**
 * The follow-up calls, and whether they agreed.
 *
 * A re-ask never promotes anything — see `part-identification-reask.mjs` for why
 * a second call agreeing with the first is not independent evidence. What it can
 * do is contradict, and a contradiction is the row worth a person's attention,
 * so it is counted in the heading rather than left to be spotted.
 */
function reaskSection(reasks) {
  const contradicted = reasks.filter(({ agrees }) => agrees === false);
  return section(
    `Targeted re-asks (${reasks.length}, ${contradicted.length} contradicting the first answer)`,
    reasks.length === 0
      ? ["No re-ask has been recorded against these answers."]
      : [
          "Each is one closed two-way question about the same card image, recorded as its own answer with its own prompt digest rather than overwriting the first.",
          "A re-ask can only ever remove trust: it is not allowed to earn a claim back, because the question names both candidates and would therefore satisfy the mirror check by its own wording.",
          "",
          ...reasks.map((reask) =>
            [
              `- \`${reask.cardId}\` · ${reask.reason} · first answer picked ${reask.firstPick}, re-ask picked ${reask.pick}` +
                ` · **${reask.agrees === true ? "agrees" : reask.agrees === false ? "CONTRADICTS" : "neither"}**`,
              `  - asked: candidate ${reask.between[0]} or candidate ${reask.between[1]}`,
              `  - "${reask.because}"`,
            ].join("\n"),
          ),
        ],
  );
}
