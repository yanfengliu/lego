import { existsSync } from "node:fs";
import { join } from "node:path";

import { option } from "./part-identification.mjs";
import {
  answerBundle,
  auditPartIdentificationAnswerCheckpointStore,
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  hasUsableAnswer,
  publishPartIdentificationAnswerCheckpoint,
  readJsonArtifact,
  usableAnswerCount,
} from "./part-identification-artifacts.mjs";
import { verifyRetainedCardImageClosure } from "./part-identification-card-images.mjs";
import {
  finalizePartIdentificationCallProof,
  publishPartIdentificationCallProof,
} from "./part-identification-call-proof.mjs";
import {
  createPartIdentificationProofBudget,
  estimatePartIdentificationProofReservation,
  runPartIdentificationClaudeTransport,
} from "./part-identification-claude-transport.mjs";
import { partIdentificationInstructionBytes } from "./part-identification-instruction.mjs";
import { createPartIdentificationMcpRequest } from "./part-identification-mcp-server.mjs";
import { writeContainedFile } from "./part-identification-io.mjs";
import {
  isPinnedModelIdentity,
  PART_IDENTIFICATION_MODEL_ID,
  requirePinnedPartIdentificationModel,
} from "./part-identification-model.mjs";
import { parsePartIdentificationAnswerLines } from "./part-identification-answer-lines.mjs";
import {
  PART_IDENTIFICATION_PROMPT,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-prompt.mjs";
import { MAX_QUOTED_REFUSAL } from "./part-identification-reask.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { isArray } from "./part-identification-safe-shape.mjs";
import { auditPartIdentificationProofStore } from "./part-identification-proof-store.mjs";
import {
  PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES,
  PART_IDENTIFICATION_MAX_ATTEMPTS,
  PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD,
  PART_IDENTIFICATION_MAX_BATCH_CARDS,
  PART_IDENTIFICATION_MAX_CALLS,
  PART_IDENTIFICATION_MAX_COST_MICROUSD,
  PART_IDENTIFICATION_MAX_WALL_TIME_MS,
  PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
} from "./part-identification-transport-contract.mjs";
import { quoteLine } from "./generated-file-staleness.mjs";

const OUT = "output/part-identification";
const PROMPT = PART_IDENTIFICATION_PROMPT;
const own = Function.call.bind(Object.prototype.hasOwnProperty);

function requireReviewedPilotAuthorization() {
  throw new Error(
    "The isolated hardened pilot is disabled: no reviewed, card-digest-bound provider policy and privacy authorization artifact exists yet. Add and verify that immutable Gate-0 record before any provider process may launch; --pilot true alone is not authorization.",
  );
}

function pendingAnswerClusterIndexes(clusters, answers, { only = null, inRange = null } = {}) {
  return clusters
    .filter(({ clusterIndex }) => !hasUsableAnswer(answers[clusterIndex]))
    .filter(({ clusterIndex }) => only === null || Number(only) === clusterIndex)
    .filter(({ clusterIndex }) => inRange === null || inRange.has(clusterIndex))
    .map(({ clusterIndex }) => clusterIndex);
}

function claudeFailureStdoutDiagnostic(stdout) {
  const bytes = Buffer.from(stdout, "utf8");
  if (bytes.length === 0) return "empty";
  let payload;
  try {
    payload = parseStrictJsonBytes(bytes);
  } catch {
    return `non-JSON ${bytes.length} UTF-8 bytes omitted`;
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    payload.is_error !== true
  ) {
    return `JSON without a CLI error envelope; ${bytes.length} UTF-8 bytes omitted`;
  }
  const fields = [`stdoutBytes=${bytes.length}`];
  const status = payload.api_error_status;
  if (Number.isInteger(status) && status >= 100 && status <= 599) {
    fields.push(`api_error_status=${status}`);
  }
  const reason = payload.terminal_reason;
  if (reason === "api_error") fields.push(`terminal_reason=${quoteLine(reason)}`);
  else if (typeof reason === "string" && reason.length > 0) {
    fields.push(`terminalReasonBytes=${Buffer.byteLength(reason, "utf8")} omitted`);
  }
  const remediation =
    status === 401
      ? 'reauthenticate with "claude auth login --claudeai", then retry one bounded call'
      : status === 429
        ? "wait for the provider or account limit to reset, then retry one bounded call"
        : "verify Claude CLI authentication and pinned-model access before retrying";
  fields.push(`remediation=${quoteLine(remediation, MAX_QUOTED_REFUSAL)}`);
  if (typeof payload.result === "string" && payload.result.length > 0) {
    fields.push(`resultBytes=${Buffer.byteLength(payload.result, "utf8")} omitted`);
  }
  return `JSON error (${fields.join(", ")})`;
}

function claudeFailureStderrDiagnostic(stderr) {
  const bytes = Buffer.from(stderr, "utf8");
  return bytes.length === 0 ? "empty" : `${bytes.length} UTF-8 bytes omitted`;
}

async function askBatch(cardIds, model, out = OUT, context = {}) {
  requirePinnedPartIdentificationModel(model);
  let invalidCardIds = !isArray(cardIds);
  if (!invalidCardIds) {
    for (let index = 0; index < cardIds.length; index += 1) {
      let duplicate = false;
      for (let prior = 0; prior < index; prior += 1) {
        if (cardIds[prior] === cardIds[index]) duplicate = true;
      }
      if (
        typeof cardIds[index] !== "string" ||
        !/^card-\d{4}$/u.test(cardIds[index]) ||
        duplicate
      ) {
        invalidCardIds = true;
      }
    }
  }
  if (
    invalidCardIds ||
    cardIds.length < 1 ||
    cardIds.length > PART_IDENTIFICATION_MAX_BATCH_CARDS
  ) {
    throw new Error(
      `Vision batch requires 1 through ${PART_IDENTIFICATION_MAX_BATCH_CARDS} unique canonical card-NNNN ids; received ${JSON.stringify(cardIds)}.`,
    );
  }
  void out;
  for (const key of ["spawnImpl", "command", "env", "lockSpawnImpl"]) {
    if (own(context, key)) {
      throw new Error(
        `Vision batch context ${JSON.stringify(key)} is a removed local-path provider hook; use the strict MCP test transport, which cannot publish a call proof.`,
      );
    }
  }
  const injectedTransport = own(context, "transport");
  const transport = await (context.transport ?? runPartIdentificationClaudeTransport)({
    cardIds,
    images: context.cardImages,
    digests: context.cardDigests,
    cardsDigest: context.cardsDigest,
    model,
    proofBudget: context.proofBudget,
  });
  const parsed = parsePartIdentificationAnswerLines(transport.terminalResult, cardIds);
  if (injectedTransport) {
    return { ...parsed, modelIdentity: transport.modelIdentity, callProof: null };
  }
  try {
    return {
      ...parsed,
      modelIdentity: transport.modelIdentity,
      callProof: finalizePartIdentificationCallProof(transport, parsed.parsedAnswers),
      reservationTicket: transport.reservationTicket,
    };
  } catch (cause) {
    transport.reservationTicket.release();
    throw cause;
  }
}

const cardId = (clusterIndex) => `card-${String(clusterIndex).padStart(4, "0")}`;

export async function settleVisionWorkers(workers) {
  const workerResults = await Promise.allSettled(workers);
  const failures = workerResults.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `${failures.length} bounded vision worker${failures.length === 1 ? "" : "s"} failed; every sibling worker and owned child process finished before this error was returned.`,
    );
  }
}

async function commandAsk(argv) {
  const out = option(argv, "out", OUT);
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
  const expectedModelIdentity = requirePinnedPartIdentificationModel(model);
  const jobs = Number(option(argv, "jobs", "4"));
  const batch = Number(option(argv, "batch", "6"));
  const maxCalls = Number(option(argv, "max-calls", "1"));
  const pilot = option(argv, "pilot", "false");
  const only = option(argv, "only", null);
  const lastStep = option(argv, "last-step", null);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) {
    throw new Error(
      `--jobs must be an integer from 1 through 8; received ${JSON.stringify(jobs)}.`,
    );
  }
  if (!Number.isInteger(batch) || batch < 1 || batch > PART_IDENTIFICATION_MAX_BATCH_CARDS) {
    throw new Error(
      `--batch must be an integer from 1 through ${PART_IDENTIFICATION_MAX_BATCH_CARDS}; received ${JSON.stringify(batch)}.`,
    );
  }
  if (maxCalls !== 1) {
    throw new Error(
      `--max-calls is temporarily pinned to 1 until a representative hardened six-card pilot measures token and cost ceilings; received ${JSON.stringify(maxCalls)}.`,
    );
  }
  if (pilot !== "true") {
    throw new Error(
      "Canonical /5 provider calls remain disabled until one isolated hardened pilot freezes measured token/cost limits and the provider authorization record; pass --pilot true only after the required privacy/policy evidence exists.",
    );
  }
  if (batch !== PART_IDENTIFICATION_MAX_BATCH_CARDS || only !== null || lastStep !== null) {
    throw new Error(
      "The isolated hardened pilot requires --batch 6 with no --only or --last-step narrowing so it can select the measurable worst authenticated packet.",
    );
  }
  requireReviewedPilotAuthorization();
  const featuresArtifact = readJsonArtifact(
    join(out, "features.json"),
    "part-identification features",
  );
  const matchArtifact = readJsonArtifact(join(out, "match.json"), "part-identification match");
  const distancesArtifact = readJsonArtifact(
    join(out, "distances.json"),
    "part-identification distances",
  );
  const { match, artifacts } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const cardsManifestPath = join(out, "cards", "manifest.json");
  if (!existsSync(cardsManifestPath)) {
    throw new Error(
      `Vision cards have no manifest at ${cardsManifestPath}; regenerate source-bound cards for the exact current features and match.`,
    );
  }
  const cardsArtifact = readJsonArtifact(cardsManifestPath, "part-identification cards");
  const cardsManifest = assertCardsArtifact(cardsArtifact, {
    featuresDigest: artifacts.features.digest,
    matchDigest: artifacts.match.digest,
    clusters: match.clusters,
  });
  const cardsRoot = join(out, "cards");
  const cardImagesPath = join(cardsRoot, ...cardsManifest.imagesFile.split("/"));
  if (!existsSync(cardImagesPath)) {
    throw new Error(
      `Vision cards have no retained image bundle at ${cardImagesPath}; regenerate every source-bound card before asking, including already-answered clusters.`,
    );
  }
  let retained;
  try {
    retained = verifyRetainedCardImageClosure(cardsRoot, cardsManifest);
  } catch (cause) {
    throw new Error(
      `Vision cards are missing or differ from the exact feature/match-bound manifest and retained image bundle. Regenerate every source-bound card before asking, including already-answered clusters: ${cause instanceof Error ? cause.message : String(cause)}.`,
      { cause },
    );
  }
  const generationOut = join(
    out,
    "transport-pilot",
    PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST.slice("sha256:".length),
  );
  const answersPath = join(generationOut, `pilot-answers-${model}.json`);
  const launchJournalPath = join(generationOut, "pilot-launch.json");
  if (existsSync(launchJournalPath)) {
    throw new Error(
      `The isolated hardened pilot generation already charged its one provider launch at ${launchJournalPath}; archive it and review the retained result or failure before any new generation.`,
    );
  }
  const hasAnswers = existsSync(answersPath);
  if (hasAnswers) {
    throw new Error(
      `The isolated hardened pilot generation already has ${answersPath}; archive the complete generation before changing the transport contract.`,
    );
  }
  auditPartIdentificationAnswerCheckpointStore(generationOut);
  const checkpoint = { answers: {}, attempts: {}, calls: {}, checkpointReference: null };
  let answers = checkpoint.answers;
  let attempts = checkpoint.attempts;
  let calls = checkpoint.calls;
  let predecessor = checkpoint.checkpointReference;
  const retainedProofBytes = auditPartIdentificationProofStore(generationOut, calls);
  if (retainedProofBytes > PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES) {
    throw new Error(
      `Retained call proofs use ${retainedProofBytes} bytes above the strict ${PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES}-byte run ceiling.`,
    );
  }
  const proofBudget = createPartIdentificationProofBudget(retainedProofBytes);
  const writeAnswers = () => {
    predecessor = publishPartIdentificationAnswerCheckpoint(
      generationOut,
      `pilot-answers-${model}.json`,
      answerBundle({
        model,
        modelIdentity: expectedModelIdentity,
        matchDigest: artifacts.match.digest,
        cardsDigest: cardsArtifact.digest,
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        predecessor,
        calls,
        attempts,
        answers,
      }),
    );
  };
  const pending = pendingAnswerClusterIndexes(match.clusters, answers);
  const planned = [];
  for (let at = 0; at < pending.length; at += batch) planned.push(pending.slice(at, at + batch));
  let pilotChunk = null;
  let pilotBytes = -1;
  for (let index = 0; index < planned.length; index += 1) {
    if (planned[index].length !== PART_IDENTIFICATION_MAX_BATCH_CARDS) continue;
    let bytes = 0;
    for (let cardIndex = 0; cardIndex < planned[index].length; cardIndex += 1) {
      bytes += retained.images.get(cardId(planned[index][cardIndex])).byteLength;
    }
    if (bytes > pilotBytes) {
      pilotBytes = bytes;
      pilotChunk = planned[index];
    }
  }
  if (pilotChunk === null)
    throw new Error("No complete six-card packet exists for the hardened pilot.");
  const chunks = [pilotChunk];
  let existingAttemptCount = 0;
  for (const records of Object.values(attempts)) existingAttemptCount += records.length;
  if (
    Object.keys(calls).length + chunks.length > PART_IDENTIFICATION_MAX_CALLS ||
    existingAttemptCount + chunks.reduce((total, chunk) => total + chunk.length, 0) >
      PART_IDENTIFICATION_MAX_ATTEMPTS
  ) {
    throw new Error("Planned strict calls or attempts exceed the cumulative generation contract.");
  }
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    for (let cardIndex = 0; cardIndex < chunks[chunkIndex].length; cardIndex += 1) {
      const key = String(chunks[chunkIndex][cardIndex]);
      if ((attempts[key]?.length ?? 0) >= PART_IDENTIFICATION_MAX_ATTEMPTS_PER_CARD) {
        throw new Error(`Card ${cardId(Number(key))} exhausted its two immutable attempts.`);
      }
    }
  }
  const pilotCardIds = pilotChunk.map(cardId);
  const cardDigests = new Map(
    Object.entries(cardsManifest.cards).map(([id, card]) => [id, card.sha256]),
  );
  const pilotRequest = createPartIdentificationMcpRequest({
    cardIds: pilotCardIds,
    images: retained.images,
    digests: cardDigests,
    model,
    cardsDigest: cardsArtifact.digest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    instructionBytes: partIdentificationInstructionBytes(pilotCardIds),
  });
  const pilotProofReservation = estimatePartIdentificationProofReservation(pilotRequest);
  writeContainedFile(
    generationOut,
    "pilot-launch.json",
    Buffer.from(
      JSON.stringify({
        schemaVersion: "lego.part-identification-pilot-launch/1",
        transportContractDigest: PART_IDENTIFICATION_TRANSPORT_CONTRACT_DIGEST,
        requestDigest: pilotRequest.requestDigest,
        orderedCards: pilotRequest.cards.map(({ cardId: id, byteLength, digest }) => ({
          cardId: id,
          byteLength,
          digest,
        })),
        proofByteReservation: pilotProofReservation,
        conservativeCostMicrousdCharge: PART_IDENTIFICATION_MAX_COST_MICROUSD,
        conservativeWallTimeMsCharge: PART_IDENTIFICATION_MAX_WALL_TIME_MS,
        outcome: "reserved-before-provider-launch",
      }),
    ),
    {
      label: "One-shot hardened pilot launch reservation",
      pathLabel: "Pilot launch journal",
      maxBytes: 64 * 1024,
      exclusive: true,
    },
  );
  console.log(
    `${pending.length} drawings pending; this hardened pilot will make ${chunks.length} of ${planned.length} planned calls, ${usableAnswerCount(answers)} already answered`,
  );
  const rejections = new Map();
  const queue = [...chunks];
  const workers = Array.from({ length: Math.min(jobs, maxCalls) }, async () => {
    for (;;) {
      const chunk = queue.shift();
      if (!chunk) return;
      const replies = await askBatch(chunk.map(cardId), model, generationOut, {
        cardImages: retained.images,
        cardDigests,
        cardsDigest: cardsArtifact.digest,
        proofBudget,
      });
      if (!isPinnedModelIdentity(replies.modelIdentity, model)) {
        throw new Error(`Pinned model identity changed while answering ${chunk.join(", ")}.`);
      }
      let proofReference;
      try {
        proofReference = publishPartIdentificationCallProof(generationOut, replies.callProof);
        replies.reservationTicket.commit(proofReference.byteLength);
      } catch (cause) {
        replies.reservationTicket?.release();
        throw cause;
      }
      const callDigest = proofReference.digest;
      if (own(calls, callDigest)) {
        throw new Error(
          `Strict call proof ${callDigest} already exists in this checkpoint; duplicate call ownership was refused.`,
        );
      }
      const nextCalls = {
        ...calls,
        [callDigest]: { proof: proofReference, orderedCardIds: chunk.map(cardId) },
      };
      const nextAnswers = { ...answers };
      const nextAttempts = { ...attempts };
      for (let index = 0; index < replies.parsedAnswers.length; index += 1) {
        const parsed = replies.parsedAnswers[index];
        const clusterIndex = chunk[index];
        const id = cardId(clusterIndex);
        if (parsed.cardId !== id) {
          throw new Error(
            `Strict call proof answer ${index} belongs to ${JSON.stringify(parsed.cardId)} instead of ${id}.`,
          );
        }
        nextAnswers[clusterIndex] = parsed.answer;
        nextAttempts[clusterIndex] = [
          ...(attempts[clusterIndex] ?? []),
          {
            callDigest,
            cardId: id,
            answerDigest: parsed.answerDigest,
            outcome: parsed.outcome,
          },
        ];
        const reason = replies.rejected?.get(id);
        if (reason !== undefined) rejections.set(id, reason);
      }
      calls = nextCalls;
      answers = nextAnswers;
      attempts = nextAttempts;
      writeAnswers();
    }
  });
  await settleVisionWorkers(workers);
  const refused = Object.values(answers).filter((answer) => answer === null).length;
  console.log(`answered ${usableAnswerCount(answers)} drawings, ${refused} with no usable reply`);
  if (rejections.size > 0) {
    const reasons = [...new Set(rejections.values())].slice(0, 3);
    console.log(
      `${rejections.size} replies arrived and were refused by the answer schema; first reasons:\n  ${reasons.join("\n  ")}`,
    );
  }
}

export {
  PROMPT,
  askBatch,
  claudeFailureStderrDiagnostic,
  claudeFailureStdoutDiagnostic,
  commandAsk,
  pendingAnswerClusterIndexes,
};
