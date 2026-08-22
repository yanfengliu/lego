import {
  PART_IDENTIFICATION_DIFFERENCES,
  PART_IDENTIFICATION_MAX_NOTE_LENGTH,
} from "./part-identification-prompt.mjs";
import { authenticateJsonArtifact, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  copyArray,
  exactOwnKeys,
  isArray,
  isOrdinaryObject,
  own,
  ownKeys,
  sameOrderedStrings,
  sortedUniqueStrings,
} from "./part-identification-safe-shape.mjs";

export const PART_CARDS_SCHEMA = "lego.part-identification-cards/4";
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ELEMENT_ID = /^\d{3,12}$/u;
const stringify = JSON.stringify;
const numberIsFinite = Number.isFinite;
const numberIsInteger = Number.isInteger;
const objectCreate = Object.create;
const defineProperty = Object.defineProperty;
const regexpTest = Function.call.bind(RegExp.prototype.test);
const stringCharCodeAt = Function.call.bind(String.prototype.charCodeAt);
const stringTrim = Function.call.bind(String.prototype.trim);

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
  const keys = ownKeys(answers);
  let count = 0;
  for (let index = 0; index < keys.length; index += 1) {
    if (hasUsableAnswer(answers[keys[index]])) count += 1;
  }
  return count;
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
const ANSWER_DIFFERENCES = new Set(PART_IDENTIFICATION_DIFFERENCES);
const setHas = Function.call.bind(Set.prototype.has);

function joinStrings(values, separator) {
  let result = "";
  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) result += separator;
    result += values[index];
  }
  return result;
}
/**
 * A note travels on one line inside one JSON object, so braces and line breaks
 * are structurally forbidden rather than merely discouraged: the reply is split
 * per line before it is parsed, and a brace inside the text would carve the
 * object at the wrong place. Rejecting them here means a malformed note costs
 * one answer at a boundary that says so, not a silently truncated record.
 */
const noteHasForbiddenCharacter = (text) => {
  for (let index = 0; index < text.length; index += 1) {
    const code = stringCharCodeAt(text, index);
    if (code < 0x20 || code === 0x7f) return true;
    if (code === 0x7b || code === 0x7d) return true;
  }
  return false;
};

export class PartIdentificationArtifactBindingError extends Error {
  constructor(artifactRole, mismatches) {
    super(
      `${artifactRole} binding failed: ${joinStrings(mismatches, "; ")}. ` +
        "Archive legacy answers and rerun the bounded vision pass; cluster indexes cannot cross a match or prompt change.",
    );
    this.name = "PartIdentificationArtifactBindingError";
    this.artifactRole = artifactRole;
    this.mismatches = Object.freeze([...mismatches]);
  }
}

export function deriveCardRunId(featuresDigest, matchDigest, cards) {
  const keys = sortedUniqueStrings(ownKeys(cards));
  const canonicalCards = Object.create(null);
  for (let index = 0; index < keys.length; index += 1) {
    const cardId = keys[index];
    const entry = cards[cardId];
    canonicalCards[cardId] = {
      sha256: entry?.sha256,
      candidateElementIds: isArray(entry?.candidateElementIds)
        ? copyArray(entry.candidateElementIds)
        : entry?.candidateElementIds,
    };
  }
  return sha256Digest(stringify({ featuresDigest, matchDigest, cards: canonicalCards })).slice(
    "sha256:".length,
    "sha256:".length + 24,
  );
}

export function assertCardsArtifact(artifact, { featuresDigest, matchDigest, clusters }) {
  const boundArtifact = authenticateJsonArtifact(artifact, "part-identification cards");
  const manifest = boundArtifact.value;
  const boundClusters = isArray(clusters) ? clusters : [];
  const indexes = new Array(boundClusters.length);
  const expectedCardIds = new Array(boundClusters.length);
  let invalid = boundClusters.length === 0;
  for (let index = 0; index < boundClusters.length; index += 1) {
    const clusterIndex = boundClusters[index]?.clusterIndex;
    indexes[index] = clusterIndex;
    expectedCardIds[index] = `card-${String(clusterIndex).padStart(4, "0")}`;
    if (!numberIsInteger(clusterIndex) || clusterIndex < 0) invalid = true;
    for (let prior = 0; prior < index; prior += 1) {
      if (indexes[prior] === clusterIndex) invalid = true;
    }
  }
  const expectedCards = sortedUniqueStrings(expectedCardIds) ?? [];
  const actualCards = sortedUniqueStrings(ownKeys(manifest?.cards)) ?? [];
  const expectedRunId = deriveCardRunId(featuresDigest, matchDigest, manifest?.cards);
  if (
    invalid ||
    !isOrdinaryObject(manifest) ||
    !exactOwnKeys(manifest, [
      "cards",
      "featuresDigest",
      "imagesFile",
      "matchDigest",
      "runId",
      "schemaVersion",
    ]) ||
    manifest?.schemaVersion !== PART_CARDS_SCHEMA ||
    manifest.featuresDigest !== featuresDigest ||
    manifest.matchDigest !== matchDigest ||
    manifest.runId !== expectedRunId ||
    manifest.imagesFile !== `runs/${expectedRunId}/images.bin` ||
    !isOrdinaryObject(manifest.cards) ||
    !sameOrderedStrings(actualCards, expectedCards)
  ) {
    throw new Error(
      `Vision cards must use ${PART_CARDS_SCHEMA}, bind exact features/match digests ${featuresDigest}/${matchDigest}, derive one canonical 24-hex immutable run, and contain exactly one run-contained card digest/file plus the exact displayed ordered candidate prefix for each of ${expectedCards.length} match clusters with no extras. Regenerate cards from the unchanged feature galleries after every feature, match, or display-count change; never repair a pointer by rebinding partial files.`,
    );
  }
  for (let clusterIndex = 0; clusterIndex < boundClusters.length; clusterIndex += 1) {
    const cluster = boundClusters[clusterIndex];
    const cardId = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
    const entry = manifest.cards[cardId];
    const ids = entry?.candidateElementIds;
    let invalidEntry =
      !isArray(cluster?.candidates) ||
      !exactOwnKeys(entry, ["candidateElementIds", "file", "sha256"]) ||
      entry.file !== `runs/${expectedRunId}/${cardId}.png` ||
      !regexpTest(SHA256, entry.sha256 ?? "") ||
      !isArray(ids) ||
      ids.length < 1 ||
      ids.length > cluster.candidates.length;
    if (!invalidEntry) {
      for (let candidateIndex = 0; candidateIndex < ids.length; candidateIndex += 1) {
        for (let prior = 0; prior < candidateIndex; prior += 1) {
          if (ids[prior] === ids[candidateIndex]) invalidEntry = true;
        }
        if (
          !regexpTest(ELEMENT_ID, ids[candidateIndex]) ||
          ids[candidateIndex] !== cluster.candidates[candidateIndex]?.elementId
        ) {
          invalidEntry = true;
        }
      }
    }
    if (invalidEntry) {
      throw new Error(
        `Vision cards must use ${PART_CARDS_SCHEMA}, bind exact features/match digests ${featuresDigest}/${matchDigest}, derive one canonical 24-hex immutable run, and contain exactly one run-contained card digest/file plus the exact displayed ordered candidate prefix for each of ${expectedCards.length} match clusters with no extras. Regenerate cards from the unchanged feature galleries after every feature, match, or display-count change; never repair a pointer by rebinding partial files.`,
      );
    }
  }
  return manifest;
}

export function validAnswerRecord(answer) {
  if (answer === null) return true;
  if (!isOrdinaryObject(answer)) return false;
  if (
    !exactOwnKeys(answer, ANSWER_FIELDS) &&
    !exactOwnKeys(answer, [
      "alsoCouldBe",
      "colour",
      "confidence",
      "differsFromPick",
      "kind",
      "note",
      "pick",
      "studsLong",
      "studsWide",
    ])
  ) {
    return false;
  }
  if (
    !setHas(ANSWER_KINDS, answer.kind) ||
    !numberIsInteger(answer.studsLong) ||
    answer.studsLong < 0 ||
    answer.studsLong > 64 ||
    !numberIsInteger(answer.studsWide) ||
    answer.studsWide < 0 ||
    answer.studsWide > 64 ||
    typeof answer.colour !== "string" ||
    answer.colour.length < 1 ||
    answer.colour.length > 64 ||
    !numberIsInteger(answer.pick) ||
    answer.pick < 0 ||
    answer.pick > 64 ||
    !numberIsInteger(answer.alsoCouldBe) ||
    answer.alsoCouldBe < 0 ||
    answer.alsoCouldBe > 64 ||
    !numberIsFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1 ||
    !setHas(ANSWER_DIFFERENCES, answer.differsFromPick)
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
  if (own(answer, "note")) {
    if (
      typeof answer.note !== "string" ||
      stringTrim(answer.note).length === 0 ||
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
      `${label} must be null or an exact bounded ${joinStrings(ANSWER_FIELDS, "/")} object, with an optional non-empty ` +
        `note of at most ${PART_IDENTIFICATION_MAX_NOTE_LENGTH} characters carrying no braces or control characters. ` +
        `differsFromPick must be one of ${joinStrings(PART_IDENTIFICATION_DIFFERENCES, ", ")}, must be "not-on-card" exactly ` +
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
  if (!isOrdinaryObject(answer)) return answer;
  const hasNote = own(answer, "note");
  const expectedFields = hasNote
    ? [
        "alsoCouldBe",
        "colour",
        "confidence",
        "differsFromPick",
        "kind",
        "note",
        "pick",
        "studsLong",
        "studsWide",
      ]
    : ANSWER_FIELDS;
  if (!exactOwnKeys(answer, expectedFields) || !hasNote) return answer;
  const trimmed = typeof answer.note === "string" ? stringTrim(answer.note) : null;
  if (trimmed !== null && trimmed.length === 0) {
    const withoutNote = objectCreate(null);
    const keys = ownKeys(answer);
    for (let index = 0; index < keys.length; index += 1) {
      if (keys[index] !== "note") {
        defineProperty(withoutNote, keys[index], {
          value: answer[keys[index]],
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }
    return withoutNote;
  }
  if (typeof answer.note !== "string") return answer;
  if (answer.note === trimmed) return answer;
  const canonical = objectCreate(null);
  const keys = ownKeys(answer);
  for (let index = 0; index < keys.length; index += 1) {
    defineProperty(canonical, keys[index], {
      value: keys[index] === "note" ? trimmed : answer[keys[index]],
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return canonical;
}
