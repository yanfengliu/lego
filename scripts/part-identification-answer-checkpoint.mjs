import {
  answerRecordDigest,
  readPartIdentificationCallProof,
} from "./part-identification-call-proof.mjs";
import {
  PartIdentificationArtifactBindingError,
  validAnswerRecord,
} from "./part-identification-artifact-vision.mjs";
import { authenticateJsonArtifact } from "./part-identification-artifact-source.mjs";
import {
  PART_ANSWERS_SCHEMA,
  PART_IDENTIFICATION_ANSWER_FIELDS,
  publishPartIdentificationAnswerCheckpoint,
  verifyPartIdentificationAnswerLineage,
} from "./part-identification-answer-lineage.mjs";
import { callProofSha256 } from "./part-identification-call-proof-digest.mjs";
import { isPinnedModelIdentity } from "./part-identification-model.mjs";
import {
  exactOwnKeys,
  isArray,
  isOrdinaryObject,
  mapGet,
  mapSet,
  own,
  ownKeys,
  setAdd,
  setHas,
  sortedUniqueStrings,
} from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES,
  PART_IDENTIFICATION_MAX_ATTEMPTS,
  PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD,
  PART_IDENTIFICATION_MAX_CALLS,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";

export { PART_ANSWERS_SCHEMA, publishPartIdentificationAnswerCheckpoint };
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const CARD_ID = /^card-\d{4}$/u;
const NativeMap = Map;
const NativeSet = Set;
function objectKeys(value) {
  return ownKeys(value);
}

function exactKeys(value, expected) {
  return exactOwnKeys(value, expected);
}

function hasDuplicateString(values) {
  for (let index = 0; index < values.length; index += 1) {
    for (let prior = 0; prior < index; prior += 1) {
      if (values[prior] === values[index]) return true;
    }
  }
  return false;
}

const cardIdForKey = (key) => `card-${String(Number(key)).padStart(4, "0")}`;

export function boundAnswerCheckpoint(
  artifact,
  {
    model,
    matchDigest,
    cardsDigest,
    promptDigest,
    clusters,
    cards,
    cardImages,
    traceRoot,
    traceArtifacts,
  },
) {
  const bundle = authenticateJsonArtifact(artifact, "part-identification answers").value;
  const mismatches = [];
  const expectedTop = PART_IDENTIFICATION_ANSWER_FIELDS;
  if (!exactKeys(bundle, expectedTop)) {
    mismatches.push(
      "top-level fields do not match the exact /5 checkpoint contract; legacy or mixed transport checkpoints cannot resume",
    );
  }
  if (bundle?.schemaVersion !== PART_ANSWERS_SCHEMA) {
    mismatches.push(
      `schemaVersion observed ${JSON.stringify(bundle?.schemaVersion)} but required ${JSON.stringify(PART_ANSWERS_SCHEMA)}`,
    );
  }
  if (bundle?.transportContractDigest !== PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST) {
    mismatches.push(
      `transportContractDigest observed ${JSON.stringify(bundle?.transportContractDigest)} but required ${PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST}`,
    );
  }
  if (bundle?.predecessor !== null && !isOrdinaryObject(bundle?.predecessor)) {
    mismatches.push("predecessor must be null or one exact immutable checkpoint reference");
  }
  if (bundle?.model !== model || !isPinnedModelIdentity(bundle?.modelIdentity, model)) {
    mismatches.push(`model/modelIdentity did not reproduce pinned model ${JSON.stringify(model)}`);
  }
  for (const [field, required] of [
    ["matchDigest", matchDigest],
    ["cardsDigest", cardsDigest],
    ["promptDigest", promptDigest],
  ]) {
    if (!SHA256.test(bundle?.[field] ?? "") || bundle?.[field] !== required) {
      mismatches.push(
        `${field} observed ${JSON.stringify(bundle?.[field])} but required ${JSON.stringify(required)}`,
      );
    }
  }
  const answers = isOrdinaryObject(bundle?.answers) ? bundle.answers : null;
  const calls = isOrdinaryObject(bundle?.calls) ? bundle.calls : null;
  const attempts = isOrdinaryObject(bundle?.attempts) ? bundle.attempts : null;
  if (answers === null || calls === null || attempts === null) {
    mismatches.push("answers, calls, and attempts must each be objects");
  }
  let checkpointReference;
  if (mismatches.length === 0) {
    try {
      checkpointReference = verifyPartIdentificationAnswerLineage(
        artifact,
        bundle,
        traceRoot,
        traceArtifacts,
      );
    } catch (cause) {
      mismatches.push(`immutable predecessor lineage refused: ${cause.message}`);
    }
  }
  if (mismatches.length > 0) {
    throw new PartIdentificationArtifactBindingError("identification-answers", mismatches);
  }
  const answerKeys = objectKeys(answers);
  const callDigests = objectKeys(calls);
  const attemptKeys = objectKeys(attempts);
  if (callDigests.length > PART_IDENTIFICATION_MAX_CALLS) {
    mismatches.push(
      `calls contain ${callDigests.length} entries above ${PART_IDENTIFICATION_MAX_CALLS}`,
    );
  }
  const allowed = new NativeSet();
  if (isArray(clusters)) {
    for (let index = 0; index < clusters.length; index += 1) {
      setAdd(allowed, clusters[index]?.clusterIndex);
    }
  }
  for (let index = 0; index < answerKeys.length; index += 1) {
    const key = answerKeys[index];
    if (!/^(0|[1-9]\d*)$/u.test(key) || !setHas(allowed, Number(key))) {
      mismatches.push(`answer cluster index ${JSON.stringify(key)} is absent from the bound match`);
      continue;
    }
    if (!validAnswerRecord(answers[key])) {
      mismatches.push(
        `answer ${key} is not null or an exact bounded because/pick/name/alsoCouldBe/note record`,
      );
      continue;
    }
    const answer = answers[key];
    if (answer !== null && (answer.pick !== 0 || answer.alsoCouldBe !== 0)) {
      const displayed = cards?.[cardIdForKey(key)]?.candidateElementIds;
      if (
        !Array.isArray(displayed) ||
        answer.pick > displayed.length ||
        answer.alsoCouldBe > displayed.length
      ) {
        mismatches.push(`answer ${key} names a candidate its exact bound card did not display`);
      }
    }
  }
  let sameAttemptKeys = answerKeys.length === attemptKeys.length;
  for (let index = 0; index < answerKeys.length; index += 1) {
    if (!own(attempts, answerKeys[index])) sameAttemptKeys = false;
  }
  if (!sameAttemptKeys) {
    mismatches.push(
      "attempt keys must exactly equal answer keys; mixed or orphan answers cannot resume",
    );
  }

  const proofByCall = new NativeMap();
  let aggregateProofBytes = 0;
  for (let index = 0; index < callDigests.length; index += 1) {
    const reference = calls?.[callDigests[index]]?.proof;
    if (
      !exactKeys(reference, ["path", "byteLength", "digest"]) ||
      !Number.isSafeInteger(reference.byteLength) ||
      reference.byteLength < 1
    ) {
      mismatches.push(
        `call ${JSON.stringify(callDigests[index])} has an unbounded proof reference`,
      );
      continue;
    }
    aggregateProofBytes += reference.byteLength;
    if (aggregateProofBytes > PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES) {
      throw new PartIdentificationArtifactBindingError("identification-answers", [
        `aggregate proof byte references exceed ${PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES} before replay`,
      ]);
    }
  }
  for (let index = 0; index < callDigests.length; index += 1) {
    const callDigest = callDigests[index];
    const call = calls[callDigest];
    if (
      !SHA256.test(callDigest) ||
      !exactKeys(call, ["proof", "orderedCardIds"]) ||
      call?.proof?.digest !== callDigest ||
      !isArray(call?.orderedCardIds) ||
      call.orderedCardIds.length < 1 ||
      call.orderedCardIds.length > 6 ||
      hasDuplicateString(call.orderedCardIds)
    ) {
      mismatches.push(
        `call ${JSON.stringify(callDigest)} has an invalid proof reference or card order`,
      );
      continue;
    }
    let invalidCardId = false;
    for (let cardIndex = 0; cardIndex < call.orderedCardIds.length; cardIndex += 1) {
      if (!CARD_ID.test(call.orderedCardIds[cardIndex])) invalidCardId = true;
    }
    if (invalidCardId) {
      mismatches.push(`call ${JSON.stringify(callDigest)} has a noncanonical card id`);
      continue;
    }
    if (
      (typeof traceRoot !== "string" || traceRoot.length === 0) &&
      !isOrdinaryObject(traceArtifacts)
    ) {
      mismatches.push(`call ${callDigest} cannot be verified without its retained trace root`);
      continue;
    }
    try {
      const proof = readPartIdentificationCallProof(traceRoot, call.proof, traceArtifacts);
      const proofIds = new Array(proof.parsedAnswers.length);
      let transplantedCard = false;
      for (let cardIndex = 0; cardIndex < proof.request.orderedCards.length; cardIndex += 1) {
        const proofCard = proof.request.orderedCards[cardIndex];
        proofIds[cardIndex] = proof.parsedAnswers[cardIndex].cardId;
        const image = cardImages instanceof NativeMap ? mapGet(cardImages, proofCard.cardId) : null;
        if (
          cards?.[proofCard.cardId]?.sha256 !== proofCard.digest ||
          !(image instanceof Uint8Array) ||
          image.byteLength !== proofCard.byteLength ||
          callProofSha256(Buffer.from(image)) !== proofCard.digest
        ) {
          transplantedCard = true;
        }
      }
      let differentOrder = proofIds.length !== call.orderedCardIds.length;
      for (let cardIndex = 0; cardIndex < proofIds.length; cardIndex += 1) {
        if (proofIds[cardIndex] !== call.orderedCardIds[cardIndex]) differentOrder = true;
      }
      if (
        proof.request.cardsDigest !== cardsDigest ||
        proof.request.promptDigest !== promptDigest ||
        !isPinnedModelIdentity(proof.request.modelIdentity, model) ||
        transplantedCard ||
        differentOrder
      ) {
        mismatches.push(
          `call ${callDigest} proof does not reproduce its bundle/card/model bindings`,
        );
        continue;
      }
      mapSet(proofByCall, callDigest, proof);
    } catch (cause) {
      mismatches.push(`call ${callDigest} proof refused: ${cause.message}`);
    }
  }
  const seenCallCards = new NativeSet();
  let attemptCount = 0;
  for (let keyIndex = 0; keyIndex < attemptKeys.length; keyIndex += 1) {
    const key = attemptKeys[keyIndex];
    const records = attempts[key];
    if (
      !isArray(records) ||
      records.length < 1 ||
      records.length > PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD
    ) {
      mismatches.push(`attempts ${key} must be a non-empty append-only array`);
      continue;
    }
    const cardId = cardIdForKey(key);
    const perCardCalls = new NativeSet();
    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      attemptCount += 1;
      const record = records[recordIndex];
      if (
        !exactKeys(record, ["callDigest", "cardId", "answerDigest", "outcome"]) ||
        record.cardId !== cardId ||
        !SHA256.test(record.callDigest ?? "") ||
        !SHA256.test(record.answerDigest ?? "") ||
        (record.outcome !== "usable" && record.outcome !== "no-usable-reply") ||
        setHas(perCardCalls, record.callDigest)
      ) {
        mismatches.push(`attempt ${key}[${recordIndex}] is duplicate, malformed, or misowned`);
        continue;
      }
      setAdd(perCardCalls, record.callDigest);
      const proof = mapGet(proofByCall, record.callDigest);
      let parsed;
      if (proof !== undefined) {
        for (let parsedIndex = 0; parsedIndex < proof.parsedAnswers.length; parsedIndex += 1) {
          if (proof.parsedAnswers[parsedIndex].cardId === cardId)
            parsed = proof.parsedAnswers[parsedIndex];
        }
      }
      if (
        parsed === undefined ||
        parsed.answerDigest !== record.answerDigest ||
        parsed.outcome !== record.outcome
      ) {
        mismatches.push(
          `attempt ${key}[${recordIndex}] does not replay from call ${record.callDigest}`,
        );
      } else {
        setAdd(seenCallCards, `${record.callDigest}\0${cardId}`);
      }
    }
    const current = records[records.length - 1];
    const expectedOutcome = answers?.[key] === null ? "no-usable-reply" : "usable";
    if (
      current?.answerDigest !== answerRecordDigest(answers?.[key]) ||
      current?.outcome !== expectedOutcome
    ) {
      mismatches.push(`last attempt for ${key} does not own the current answer bytes and outcome`);
    }
  }
  if (attemptCount > PART_IDENTIFICATION_MAX_ATTEMPTS) {
    mismatches.push(
      `attempts contain ${attemptCount} records above ${PART_IDENTIFICATION_MAX_ATTEMPTS}`,
    );
  }
  for (let callIndex = 0; callIndex < callDigests.length; callIndex += 1) {
    const callDigest = callDigests[callIndex];
    const proof = mapGet(proofByCall, callDigest);
    if (proof === undefined) continue;
    for (let index = 0; index < proof.parsedAnswers.length; index += 1) {
      const cardId = proof.parsedAnswers[index].cardId;
      if (!setHas(seenCallCards, `${callDigest}\0${cardId}`)) {
        mismatches.push(`call ${callDigest} card ${cardId} is orphaned from attempts`);
      }
    }
  }
  if (mismatches.length > 0) {
    throw new PartIdentificationArtifactBindingError("identification-answers", mismatches);
  }
  return { answers, calls, attempts, checkpointReference };
}

export function boundAnswers(artifact, context) {
  return boundAnswerCheckpoint(artifact, context).answers;
}

function canonicalMap(value) {
  if (!isOrdinaryObject(value)) return value;
  const keys = sortedUniqueStrings(ownKeys(value));
  const held = Object.create(null);
  for (let index = 0; index < keys.length; index += 1) held[keys[index]] = value[keys[index]];
  return held;
}

export const answerBundle = ({
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  promptDigest,
  predecessor,
  calls,
  attempts,
  answers,
}) => ({
  schemaVersion: PART_ANSWERS_SCHEMA,
  model,
  modelIdentity,
  matchDigest,
  cardsDigest,
  promptDigest,
  transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
  predecessor,
  calls: canonicalMap(calls),
  attempts: canonicalMap(attempts),
  answers: canonicalMap(answers),
});
