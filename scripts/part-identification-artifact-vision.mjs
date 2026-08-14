import { isPinnedModelIdentity } from "./part-identification-model.mjs";
import {
  PART_IDENTIFICATION_DIFFERENCES,
  PART_IDENTIFICATION_MAX_NOTE_LENGTH,
} from "./part-identification-prompt.mjs";
import { authenticateJsonArtifact, sha256Digest } from "./part-identification-artifact-source.mjs";

export const PART_CARDS_SCHEMA = "lego.part-identification-cards/4";
export const PART_ANSWERS_SCHEMA = "lego.part-identification-answers/4";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ELEMENT_ID = /^\d{3,12}$/u;

const ANSWER_KINDS = new Set([
  "brick",
  "plate",
  "tile",
  "slope",
  "wedge",
  "arch",
  "round",
  "technic",
  "other",
]);

export function hasUsableAnswer(answer) {
  return answer !== undefined && answer !== null;
}

export function usableAnswerCount(answers) {
  return Object.values(answers).filter(hasUsableAnswer).length;
}
/**
 * The keys every answer carries, and the one key it may omit.
 *
 * `note` is optional on purpose, and the option is the point. A required
 * observation field is filled on every card, so two hundred answers would say
 * "a standard 2x4 plate in Dark Bluish Gray" and bury the five that say
 * something; leaving it absent makes a written note itself the signal. It is
 * stored only when non-empty — the ask boundary drops a blank one rather than
 * retaining a key that means nothing — so a present `note` in a retained bundle
 * always means the call chose to write.
 */
export const ANSWER_FIELDS = [
  "alsoCouldBe",
  "colour",
  "confidence",
  "differsFromPick",
  "kind",
  "pick",
  "studsLong",
  "studsWide",
];
export const OPTIONAL_ANSWER_FIELDS = ["note"];
const ANSWER_KEY_SETS = new Set([
  ANSWER_FIELDS.join(","),
  [...ANSWER_FIELDS, ...OPTIONAL_ANSWER_FIELDS].sort().join(","),
]);
const ANSWER_DIFFERENCES = new Set(PART_IDENTIFICATION_DIFFERENCES);
/**
 * A note travels on one line inside one JSON object, so braces and line breaks
 * are structurally forbidden rather than merely discouraged: the reply is split
 * per line before it is parsed, and a brace inside the text would carve the
 * object at the wrong place. Rejecting them here means a malformed note costs
 * one answer at a boundary that says so, not a silently truncated record.
 */
const noteHasForbiddenCharacter = (text) => {
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
    if (character === "{" || character === "}") return true;
  }
  return false;
};

export class PartIdentificationArtifactBindingError extends Error {
  constructor(artifactRole, mismatches) {
    super(
      `${artifactRole} binding failed: ${mismatches.join("; ")}. ` +
        "Archive legacy answers and rerun the bounded vision pass; cluster indexes cannot cross a match or prompt change.",
    );
    this.name = "PartIdentificationArtifactBindingError";
    this.artifactRole = artifactRole;
    this.mismatches = Object.freeze([...mismatches]);
  }
}

export function deriveCardRunId(featuresDigest, matchDigest, cards) {
  const canonicalCards = Object.fromEntries(
    Object.entries(cards ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([cardId, entry]) => [
        cardId,
        {
          sha256: entry?.sha256,
          candidateElementIds: Array.isArray(entry?.candidateElementIds)
            ? [...entry.candidateElementIds]
            : entry?.candidateElementIds,
        },
      ]),
  );
  return sha256Digest(JSON.stringify({ featuresDigest, matchDigest, cards: canonicalCards })).slice(
    "sha256:".length,
    "sha256:".length + 24,
  );
}

export function assertCardsArtifact(artifact, { featuresDigest, matchDigest, clusters }) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification cards");
  const manifest = boundArtifact.value;
  const boundClusters = Array.isArray(clusters) ? clusters : [];
  const indexes = boundClusters.map((cluster) => cluster?.clusterIndex);
  const expectedCards = indexes.map((index) => `card-${String(index).padStart(4, "0")}`).sort();
  const actualCards =
    typeof manifest?.cards === "object" && manifest.cards !== null && !Array.isArray(manifest.cards)
      ? Object.keys(manifest.cards).sort()
      : [];
  const expectedRunId = deriveCardRunId(featuresDigest, matchDigest, manifest?.cards);
  if (
    manifest?.schemaVersion !== PART_CARDS_SCHEMA ||
    manifest.featuresDigest !== featuresDigest ||
    manifest.matchDigest !== matchDigest ||
    manifest.runId !== expectedRunId ||
    manifest.imagesFile !== `runs/${expectedRunId}/images.bin` ||
    expectedCards.length === 0 ||
    new Set(indexes).size !== indexes.length ||
    !indexes.every((index) => Number.isInteger(index) && index >= 0) ||
    typeof manifest.cards !== "object" ||
    manifest.cards === null ||
    Array.isArray(manifest.cards) ||
    actualCards.length !== expectedCards.length ||
    !actualCards.every((card, index) => card === expectedCards[index]) ||
    Object.keys(manifest).sort().join(",") !==
      "cards,featuresDigest,imagesFile,matchDigest,runId,schemaVersion" ||
    boundClusters.some((cluster) => {
      const cardId = `card-${String(cluster?.clusterIndex).padStart(4, "0")}`;
      const entry = manifest.cards[cardId];
      const ids = entry?.candidateElementIds;
      return (
        !Array.isArray(cluster?.candidates) ||
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry) ||
        Object.keys(entry).sort().join(",") !== "candidateElementIds,file,sha256" ||
        entry.file !== `runs/${expectedRunId}/${cardId}.png` ||
        !SHA256.test(entry.sha256 ?? "") ||
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > cluster.candidates.length ||
        new Set(ids).size !== ids.length ||
        ids.some(
          (elementId, candidateIndex) =>
            !ELEMENT_ID.test(elementId) ||
            elementId !== cluster.candidates[candidateIndex]?.elementId,
        )
      );
    })
  ) {
    throw new Error(
      `Vision cards must use ${PART_CARDS_SCHEMA}, bind exact features/match digests ${featuresDigest}/${matchDigest}, derive one canonical 24-hex immutable run, and contain exactly one run-contained card digest/file plus the exact displayed ordered candidate prefix for each of ${expectedCards.length} match clusters with no extras. Regenerate cards from the unchanged feature galleries after every feature, match, or display-count change; never repair a pointer by rebinding partial files.`,
    );
  }
  return manifest;
}

export function boundAnswers(
  artifact,
  { model, matchDigest, cardsDigest, promptDigest, clusters, cards },
) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification answers");
  const bundle = boundArtifact.value;
  const allowed = new Set(
    Array.isArray(clusters) ? clusters.map(({ clusterIndex }) => clusterIndex) : [],
  );
  const answerKeys =
    typeof bundle?.answers === "object" && bundle.answers !== null && !Array.isArray(bundle.answers)
      ? Object.keys(bundle.answers)
      : [];
  const mismatches = [];
  if (bundle?.schemaVersion !== PART_ANSWERS_SCHEMA) {
    mismatches.push(
      `schemaVersion observed ${JSON.stringify(bundle?.schemaVersion)} but required ${JSON.stringify(PART_ANSWERS_SCHEMA)}`,
    );
  }
  if (bundle?.model !== model) {
    mismatches.push(
      `model observed ${JSON.stringify(bundle?.model)} but required ${JSON.stringify(model)}`,
    );
  }
  if (!isPinnedModelIdentity(bundle?.modelIdentity, model)) {
    mismatches.push(
      `modelIdentity did not reproduce the pinned identity for ${JSON.stringify(model)}`,
    );
  }
  if (bundle?.matchDigest !== matchDigest) {
    mismatches.push(
      `matchDigest observed ${JSON.stringify(bundle?.matchDigest)} but required ${JSON.stringify(matchDigest)}`,
    );
  }
  if (!SHA256.test(bundle?.cardsDigest ?? "") || bundle?.cardsDigest !== cardsDigest) {
    mismatches.push(
      `cardsDigest observed ${JSON.stringify(bundle?.cardsDigest)} but required ${JSON.stringify(cardsDigest)}`,
    );
  }
  if (!SHA256.test(bundle?.promptDigest ?? "") || bundle?.promptDigest !== promptDigest) {
    mismatches.push(
      `promptDigest observed ${JSON.stringify(bundle?.promptDigest)} but required ${JSON.stringify(promptDigest)}`,
    );
  }
  if (
    typeof bundle?.answers !== "object" ||
    bundle.answers === null ||
    Array.isArray(bundle.answers)
  ) {
    mismatches.push(
      `answers observed ${Array.isArray(bundle?.answers) ? "an array" : typeof bundle?.answers} but required an object keyed by cluster index`,
    );
  }
  const invalidAnswerKeys = answerKeys.filter(
    (key) => !/^(0|[1-9]\d*)$/u.test(key) || !allowed.has(Number(key)),
  );
  if (invalidAnswerKeys.length > 0) {
    mismatches.push(
      `answer cluster indexes ${JSON.stringify(invalidAnswerKeys)} were absent from the required match clusters ${JSON.stringify([...allowed].sort((left, right) => left - right))}`,
    );
  }
  const invalidAnswers = answerKeys.filter((key) => !validAnswerRecord(bundle.answers[key]));
  if (invalidAnswers.length > 0) {
    mismatches.push(
      `answer records ${JSON.stringify(invalidAnswers)} were not null or exact bounded ${ANSWER_FIELDS.join("/")} objects with an optional bounded note`,
    );
  }
  // A second choice is a candidate number exactly as a pick is, so it is held to
  // the same rule: both have to be numbers the exact bound card actually showed,
  // or the assignment would discount an element nobody was ever asked about.
  const unseenPicks = answerKeys.filter((key) => {
    const answer = bundle.answers[key];
    if (answer === null || !validAnswerRecord(answer)) return false;
    if (answer.pick === 0 && answer.alsoCouldBe === 0) return false;
    const cardId = `card-${String(Number(key)).padStart(4, "0")}`;
    const displayed = cards?.[cardId]?.candidateElementIds;
    if (!Array.isArray(displayed)) return true;
    return answer.pick > displayed.length || answer.alsoCouldBe > displayed.length;
  });
  if (unseenPicks.length > 0) {
    mismatches.push(
      `answer records ${JSON.stringify(unseenPicks)} named picked or second-choice candidates that their exact bound cards did not display`,
    );
  }
  if (mismatches.length > 0) {
    throw new PartIdentificationArtifactBindingError("identification-answers", mismatches);
  }
  return bundle.answers;
}

function validAnswerRecord(answer) {
  if (answer === null) return true;
  if (typeof answer !== "object" || Array.isArray(answer)) return false;
  if (!ANSWER_KEY_SETS.has(Object.keys(answer).sort().join(","))) return false;
  if (
    !ANSWER_KINDS.has(answer.kind) ||
    !Number.isInteger(answer.studsLong) ||
    answer.studsLong < 0 ||
    answer.studsLong > 64 ||
    !Number.isInteger(answer.studsWide) ||
    answer.studsWide < 0 ||
    answer.studsWide > 64 ||
    typeof answer.colour !== "string" ||
    answer.colour.length < 1 ||
    answer.colour.length > 64 ||
    !Number.isInteger(answer.pick) ||
    answer.pick < 0 ||
    answer.pick > 64 ||
    !Number.isInteger(answer.alsoCouldBe) ||
    answer.alsoCouldBe < 0 ||
    answer.alsoCouldBe > 64 ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1 ||
    !ANSWER_DIFFERENCES.has(answer.differsFromPick)
  ) {
    return false;
  }
  // A second choice that repeats the first is not a second choice, and a second
  // choice offered where nothing was picked names an alternative to nothing.
  if (answer.alsoCouldBe !== 0 && (answer.alsoCouldBe === answer.pick || answer.pick === 0)) {
    return false;
  }
  // `pick` and `differsFromPick` are two statements about the same thing, so
  // they have to agree: refusing every candidate is exactly the case where there
  // is no pick to differ from, and declaring a difference from a candidate that
  // was never named describes nothing.
  if ((answer.pick === 0) !== (answer.differsFromPick === "not-on-card")) return false;
  if (Object.hasOwn(answer, "note")) {
    if (
      typeof answer.note !== "string" ||
      answer.note.trim().length === 0 ||
      answer.note.length > PART_IDENTIFICATION_MAX_NOTE_LENGTH ||
      noteHasForbiddenCharacter(answer.note)
    ) {
      return false;
    }
  } else if (answer.differsFromPick !== "nothing") {
    // A declared difference with no sentence is the failure this field exists to
    // stop: the record would say the pick is wrong and destroy the reason in the
    // same breath, which is what a bare `pick: 0` did for the two refusals in
    // the previous run.
    return false;
  }
  return true;
}

export function assertAnswerRecord(answer, label = "Part-identification answer") {
  if (!validAnswerRecord(answer)) {
    throw new Error(
      `${label} must be null or an exact bounded ${ANSWER_FIELDS.join("/")} object, with an optional non-empty ` +
        `note of at most ${PART_IDENTIFICATION_MAX_NOTE_LENGTH} characters carrying no braces or control characters. ` +
        `differsFromPick must be one of ${PART_IDENTIFICATION_DIFFERENCES.join(", ")}, must be "not-on-card" exactly ` +
        'when pick is 0, and must carry a note whenever it is not "nothing"; alsoCouldBe must be 0 or a second, different candidate number.',
    );
  }
  return answer;
}

/**
 * Drops a blank note so a retained answer never carries a key that means nothing.
 *
 * The whole value of an optional observation field is that a present note means
 * the call had something to say. A model that emits `"note":""` to satisfy the
 * shape would erase that, and rejecting the whole answer over an empty string
 * would throw away a good pick on punctuation, so the blank is removed here — at
 * the boundary, before the record is validated or stored — rather than tolerated
 * downstream.
 */
export function canonicalAnswerRecord(answer) {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return answer;
  if (!Object.hasOwn(answer, "note")) return answer;
  if (typeof answer.note === "string" && answer.note.trim().length === 0) {
    return Object.fromEntries(Object.entries(answer).filter(([key]) => key !== "note"));
  }
  if (typeof answer.note !== "string") return answer;
  return answer.note === answer.note.trim() ? answer : { ...answer, note: answer.note.trim() };
}

export const answerBundle = ({
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  promptDigest,
  answers,
}) => ({
  schemaVersion: PART_ANSWERS_SCHEMA,
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  promptDigest,
  answers,
});
