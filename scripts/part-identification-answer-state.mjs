import { validAnswerRecord } from "./part-identification-artifact-vision.mjs";
import { answerRecordDigest } from "./part-identification-call-proof-digest.mjs";
import { MAX_JSON_ARTIFACT_BYTES } from "./part-identification-io.mjs";
import { isPinnedModelIdentity } from "./part-identification-model.mjs";
import {
  exactOwnKeys,
  isArray,
  isOrdinaryObject,
  own,
  ownKeys,
  setAdd,
  setDelete,
  setHas,
  setSize,
} from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_MAX_ATTEMPTS,
  PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD,
  PART_IDENTIFICATION_MAX_BATCH_CARDS,
  PART_IDENTIFICATION_MAX_CALLS,
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

export const PART_ANSWERS_SCHEMA = "lego.part-identification-answers/5";
export const PART_IDENTIFICATION_ANSWER_FIELDS = Object.freeze([
  "schemaVersion",
  "model",
  "modelIdentity",
  "matchDigest",
  "cardsDigest",
  "promptDigest",
  "transportContractDigest",
  "predecessor",
  "calls",
  "attempts",
  "answers",
]);

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const CARD_ID = /^card-\d{4}$/u;
const INDEX = /^(0|[1-9]\d{0,3})$/u;
const NativeSet = Set;
const numberIsSafeInteger = Number.isSafeInteger;
const numberIntrinsic = Number;
const regexpTest = Function.call.bind(RegExp.prototype.test);
const stringPadStart = Function.call.bind(String.prototype.padStart);
const stringIntrinsic = String;

function cardIdForKey(key) {
  if (!regexpTest(INDEX, key)) return null;
  const value = numberIntrinsic(key);
  if (!numberIsSafeInteger(value)) return null;
  return `card-${stringPadStart(stringIntrinsic(value), 4, "0")}`;
}

function callOwnsCard(call, cardId) {
  for (let index = 0; index < call.orderedCardIds.length; index += 1) {
    if (call.orderedCardIds[index] === cardId) return true;
  }
  return false;
}

function fail(reason) {
  throw new Error(`Answer checkpoint is not internally complete: ${reason}.`);
}

export function validPartIdentificationCheckpointReference(reference) {
  return (
    exactOwnKeys(reference, ["path", "byteLength", "digest"]) &&
    regexpTest(SHA256, reference.digest ?? "") &&
    reference.path ===
      `answer-checkpoints/sha256/${reference.digest.slice("sha256:".length)}.json` &&
    numberIsSafeInteger(reference.byteLength) &&
    reference.byteLength > 0 &&
    reference.byteLength <= MAX_JSON_ARTIFACT_BYTES
  );
}

export function assertInternallyValidPartIdentificationCheckpoint(bundle) {
  if (
    !exactOwnKeys(bundle, PART_IDENTIFICATION_ANSWER_FIELDS) ||
    bundle.schemaVersion !== PART_ANSWERS_SCHEMA ||
    bundle.transportContractDigest !== PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST ||
    !isPinnedModelIdentity(bundle.modelIdentity, bundle.model) ||
    !regexpTest(SHA256, bundle.matchDigest ?? "") ||
    !regexpTest(SHA256, bundle.cardsDigest ?? "") ||
    !regexpTest(SHA256, bundle.promptDigest ?? "") ||
    (bundle.predecessor !== null &&
      !validPartIdentificationCheckpointReference(bundle.predecessor)) ||
    !isOrdinaryObject(bundle.calls) ||
    !isOrdinaryObject(bundle.attempts) ||
    !isOrdinaryObject(bundle.answers)
  ) {
    fail("top-level schema, binding, predecessor, or state maps are malformed");
  }

  const callDigests = ownKeys(bundle.calls);
  if (callDigests.length < 1 || callDigests.length > PART_IDENTIFICATION_MAX_CALLS) {
    fail(`calls must contain 1 through ${PART_IDENTIFICATION_MAX_CALLS} entries`);
  }
  const unownedCallCards = new NativeSet();
  for (let callIndex = 0; callIndex < callDigests.length; callIndex += 1) {
    const digest = callDigests[callIndex];
    const call = bundle.calls[digest];
    if (
      !regexpTest(SHA256, digest) ||
      !exactOwnKeys(call, ["proof", "orderedCardIds"]) ||
      !exactOwnKeys(call.proof, ["path", "byteLength", "digest"]) ||
      call.proof.digest !== digest ||
      call.proof.path !== `call-proofs/sha256/${digest.slice("sha256:".length)}.json` ||
      !numberIsSafeInteger(call.proof.byteLength) ||
      call.proof.byteLength < 1 ||
      call.proof.byteLength > PART_IDENTIFICATION_MAX_PROOF_BYTES ||
      !isArray(call.orderedCardIds) ||
      call.orderedCardIds.length < 1 ||
      call.orderedCardIds.length > PART_IDENTIFICATION_MAX_BATCH_CARDS
    ) {
      fail(`call ${digest} has a malformed proof reference or card list`);
    }
    for (let index = 0; index < call.orderedCardIds.length; index += 1) {
      const cardId = call.orderedCardIds[index];
      if (!regexpTest(CARD_ID, cardId)) fail(`call ${digest} has a noncanonical card id`);
      for (let prior = 0; prior < index; prior += 1) {
        if (call.orderedCardIds[prior] === cardId) fail(`call ${digest} repeats ${cardId}`);
      }
      setAdd(unownedCallCards, `${digest}\0${cardId}`);
    }
  }

  const answerKeys = ownKeys(bundle.answers);
  const attemptKeys = ownKeys(bundle.attempts);
  if (answerKeys.length !== attemptKeys.length) {
    fail("attempt keys must exactly equal answer keys");
  }
  for (let index = 0; index < answerKeys.length; index += 1) {
    if (!own(bundle.attempts, answerKeys[index])) {
      fail("attempt keys must exactly equal answer keys");
    }
  }

  let attemptCount = 0;
  for (let keyIndex = 0; keyIndex < attemptKeys.length; keyIndex += 1) {
    const key = attemptKeys[keyIndex];
    const cardId = cardIdForKey(key);
    const answer = bundle.answers[key];
    const records = bundle.attempts[key];
    if (cardId === null || !validAnswerRecord(answer)) {
      fail(`answer ${key} is malformed or noncanonical`);
    }
    if (
      !isArray(records) ||
      records.length < 1 ||
      records.length > PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD
    ) {
      fail(`attempts ${key} must contain one or two immutable records`);
    }
    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      attemptCount += 1;
      const record = records[recordIndex];
      const call = bundle.calls[record?.callDigest];
      if (
        !exactOwnKeys(record, ["callDigest", "cardId", "answerDigest", "outcome"]) ||
        record.cardId !== cardId ||
        !regexpTest(SHA256, record.callDigest ?? "") ||
        !regexpTest(SHA256, record.answerDigest ?? "") ||
        (record.outcome !== "usable" && record.outcome !== "no-usable-reply") ||
        !isOrdinaryObject(call) ||
        !callOwnsCard(call, cardId) ||
        !setHas(unownedCallCards, `${record.callDigest}\0${cardId}`)
      ) {
        fail(`attempt ${key}[${recordIndex}] is malformed, duplicate, or not call-owned`);
      }
      setDelete(unownedCallCards, `${record.callDigest}\0${cardId}`);
    }
    const current = records[records.length - 1];
    const outcome = answer === null ? "no-usable-reply" : "usable";
    if (current.answerDigest !== answerRecordDigest(answer) || current.outcome !== outcome) {
      fail(`last attempt for ${key} does not own its current answer`);
    }
  }
  if (attemptCount > PART_IDENTIFICATION_MAX_ATTEMPTS) {
    fail(`attempt count exceeds ${PART_IDENTIFICATION_MAX_ATTEMPTS}`);
  }
  if (setSize(unownedCallCards) !== 0) {
    fail("one or more call cards are orphaned from attempt lineage");
  }
  return bundle;
}
