import {
  assertAnswerRecord,
  canonicalAnswerRecord,
} from "./part-identification-artifact-vision.mjs";
import { answerRecordDigest } from "./part-identification-call-proof-digest.mjs";
import { quoteLine } from "./generated-file-staleness.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import {
  copyArray,
  isArray,
  mapDelete,
  mapGet,
  mapHas,
  mapSet,
  setAdd,
  setHas,
} from "./part-identification-safe-shape.mjs";
import { PART_IDENTIFICATION_MAX_RESULT_BYTES } from "./part-identification-transport-contract.mjs";

export const MAX_PART_IDENTIFICATION_REFUSAL_QUOTE = 400;
const CARD_ID = /^card-\d{4}$/u;
const SENSITIVE_RESULT_SHAPE =
  /(?:[a-z]:[\\/]|\\\\[^\s]+[\\/]|\/(?:home|users|var|tmp)\/|session[_-]?id|oauth|bearer|api[_-]?key|access[_-]?token|credential|secret)/iu;
const regexpTest = Function.call.bind(RegExp.prototype.test);
const NativeMap = Map;
const NativeSet = Set;

function containsCardId(cardIds, cardId) {
  for (let index = 0; index < cardIds.length; index += 1) {
    if (cardIds[index] === cardId) return true;
  }
  return false;
}

export function assertSanitizedTerminalResult(result) {
  if (typeof result !== "string") {
    throw new Error("Part-identification terminal result must be a string.");
  }
  const bytes = Buffer.from(result, "utf8");
  if (bytes.length < 1 || bytes.length > PART_IDENTIFICATION_MAX_RESULT_BYTES) {
    throw new Error(
      `Part-identification terminal result requires 1 through ${PART_IDENTIFICATION_MAX_RESULT_BYTES} UTF-8 bytes; received ${bytes.length}.`,
    );
  }
  if (regexpTest(SENSITIVE_RESULT_SHAPE, result)) {
    throw new Error(
      "Part-identification terminal result contains a path, token, credential, or session-shaped value and cannot enter sanitized evidence.",
    );
  }
  return result;
}

/** Exact production parser shared by the live boundary and retained-proof replay. */
export function parsePartIdentificationAnswerLines(resultInput, cardIdsInput) {
  const result = assertSanitizedTerminalResult(resultInput);
  if (!isArray(cardIdsInput) || cardIdsInput.length < 1 || cardIdsInput.length > 6) {
    throw new Error(
      `Answer parser requires 1 through 6 unique canonical card-NNNN ids; received ${JSON.stringify(cardIdsInput)}.`,
    );
  }
  for (let index = 0; index < cardIdsInput.length; index += 1) {
    let duplicate = false;
    for (let prior = 0; prior < index; prior += 1) {
      if (cardIdsInput[prior] === cardIdsInput[index]) duplicate = true;
    }
    if (!regexpTest(CARD_ID, cardIdsInput[index]) || duplicate) {
      throw new Error(`Answer parser card ${index} is not a unique canonical card-NNNN id.`);
    }
  }
  const cardIds = copyArray(cardIdsInput);
  const answers = new NativeMap();
  const rejected = new NativeMap();
  const duplicates = new NativeSet();
  const lines = result.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length === 0) continue;
    const opened = line.indexOf("{");
    const closed = line.lastIndexOf("}");
    const prefix = opened < 0 ? line : line.slice(0, opened);
    const canonicalTag = prefix.trim();
    if (
      !regexpTest(CARD_ID, canonicalTag) ||
      !containsCardId(cardIds, canonicalTag) ||
      opened < 0 ||
      closed < opened ||
      line.slice(closed + 1).trim().length !== 0
    ) {
      throw new Error(
        `Terminal line ${index + 1} is not exactly one requested card id followed by one JSON object; unexpected output refuses the complete call.`,
      );
    }
    const cardId = canonicalTag;
    if (mapHas(answers, cardId) || mapHas(rejected, cardId) || setHas(duplicates, cardId)) {
      mapDelete(answers, cardId);
      mapDelete(rejected, cardId);
      setAdd(duplicates, cardId);
      continue;
    }
    try {
      mapSet(
        answers,
        cardId,
        assertAnswerRecord(
          canonicalAnswerRecord(
            parseStrictJsonBytes(Buffer.from(line.slice(opened, closed + 1), "utf8")),
          ),
          `Answer for ${cardId}`,
        ),
      );
    } catch (cause) {
      mapSet(
        rejected,
        cardId,
        `${cause instanceof Error ? cause.message : String(cause)} Refused text: ${quoteLine(line, MAX_PART_IDENTIFICATION_REFUSAL_QUOTE)}`,
      );
    }
  }
  const parsedAnswers = [];
  for (let index = 0; index < cardIds.length; index += 1) {
    const cardId = cardIds[index];
    const answer = setHas(duplicates, cardId) ? null : (mapGet(answers, cardId) ?? null);
    parsedAnswers[parsedAnswers.length] = {
      cardId,
      outcome: answer === null ? "no-usable-reply" : "usable",
      answer,
      answerDigest: answerRecordDigest(answer),
    };
  }
  return { answers, rejected, parsedAnswers };
}
