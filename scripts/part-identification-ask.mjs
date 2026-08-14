import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { option } from "./part-identification.mjs";
import {
  answerBundle,
  assertAnswerRecord,
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  boundAnswers,
  canonicalAnswerRecord,
  hasUsableAnswer,
  readJsonArtifact,
  usableAnswerCount,
} from "./part-identification-artifacts.mjs";
import {
  CHILD_TIMEOUT_MS,
  MAX_CHILD_STDERR_BYTES,
  MAX_CHILD_STDOUT_BYTES,
  runBoundedChild,
  writeContainedFile,
} from "./part-identification-io.mjs";
import { verifyRetainedCardImageClosure } from "./part-identification-card-images.mjs";
import {
  PART_IDENTIFICATION_PROMPT,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-prompt.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { MAX_QUOTED_REFUSAL } from "./part-identification-reask.mjs";
import { quoteLine } from "./generated-file-staleness.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  requirePinnedPartIdentificationModel,
  responseModelIdentity,
} from "./part-identification-model.mjs";
import { withCardCallSnapshot } from "./part-identification-call-snapshot.mjs";

/**
 * The vision call that proposes a part identity.
 *
 * It only ever proposes. Every answer is checked before it becomes a claim —
 * the pick has to be a number on the card it was asked about, the element
 * behind that number has to be one the printed inventory lists, and the free
 * description given in the same reply has to agree with that element's
 * published name. See `part-identification-score.mjs` for the checks.
 */

const OUT = "output/part-identification";

function writeJson(path, value) {
  writeContainedFile(dirname(path), basename(path), `${JSON.stringify(value, null, 1)}\n`, {
    label: "Part-identification answers",
    pathLabel: "Answers file",
  });
}

const PROMPT = PART_IDENTIFICATION_PROMPT;

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
  const hasApiStatus = Number.isInteger(status) && status >= 100 && status <= 599;
  if (hasApiStatus) {
    fields.push(`api_error_status=${status}`);
  }
  const reason = payload.terminal_reason;
  if (reason === "api_error") {
    fields.push(`terminal_reason=${quoteLine(reason)}`);
  } else if (typeof reason === "string" && reason.length > 0) {
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

/**
 * The child environment for one vision call.
 *
 * The consent that permits this call covers booklet crops reaching the pinned
 * model, and nothing else. Left to itself the CLI also runs a small background
 * model over the same session for conversation bookkeeping, which both widens
 * that scope and puts a second entry in `modelUsage` — so the response can no
 * longer prove that one pinned model, and only that model, produced the answer.
 * Turning the non-essential traffic off is what makes the single-entry check in
 * `responseModelIdentity` an enforceable statement rather than one that fails
 * against every real CLI.
 */
function visionChildEnv(base = process.env) {
  return { ...base, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" };
}

/**
 * The vision call, headless.
 *
 * `claude -p` is a real executable on every platform this runs on, so it is
 * spawned directly. Going through a shell on Windows concatenated the argument
 * array into one string, and every call returned in a tenth of a second having
 * done nothing — which reads as an unparseable answer rather than as a failure
 * to run, so the error is named here instead.
 *
 * Several cards go into one call because almost all of the cost is per call,
 * not per card: one card took 3m23s and six took 2m45s. Each answer is tagged
 * with the card it belongs to and matched back by that tag, so a call that
 * answers about five of six loses one answer rather than shifting all of them.
 */
async function askBatch(cardIds, model, out = OUT, context = {}) {
  requirePinnedPartIdentificationModel(model);
  if (
    !Array.isArray(cardIds) ||
    cardIds.length < 1 ||
    cardIds.length > 12 ||
    new Set(cardIds).size !== cardIds.length ||
    cardIds.some((id) => typeof id !== "string" || !/^card-\d{4}$/u.test(id))
  ) {
    throw new Error(
      `Vision batch requires 1 through 12 unique canonical card-NNNN ids; received ${JSON.stringify(cardIds)}.`,
    );
  }
  void out;
  const result = await withCardCallSnapshot(
    cardIds,
    context.cardImages,
    context.cardDigests,
    async (paths, inheritFds) => {
      const instruction =
        `Read these ${cardIds.length} images: ${paths.join(" ")}\n\n` +
        `Answer separately about each, in the order given, one line per image, ` +
        `each line beginning with the image's card id (${cardIds.join(", ")}) followed by the JSON. ` +
        `No prose, no code fences.\n\n${PROMPT}`;
      return runBoundedChild(
        context.command ?? process.env.CLAUDE_CLI ?? "claude",
        ["-p", instruction, "--model", model, "--allowedTools", "Read", "--output-format", "json"],
        {
          label: `Pinned Claude vision call for ${cardIds.join(", ")}`,
          timeoutMs: context.timeoutMs ?? CHILD_TIMEOUT_MS,
          maxStdoutBytes: context.maxStdoutBytes ?? MAX_CHILD_STDOUT_BYTES,
          maxStderrBytes: context.maxStderrBytes ?? MAX_CHILD_STDERR_BYTES,
          spawnImpl: context.spawnImpl,
          env: visionChildEnv(context.env),
          inheritFds,
        },
      );
    },
    { __testHooks: { lockSpawnImpl: context.lockSpawnImpl } },
  );
  if (result.code !== 0) {
    throw new Error(
      `Pinned Claude vision call for ${cardIds.join(", ")} exited ${result.code}${result.signal === null ? "" : ` (${result.signal})`}; stderr: ${claudeFailureStderrDiagnostic(result.stderr)}; stdout: ${claudeFailureStdoutDiagnostic(result.stdout)}. No answer was retained.`,
    );
  }
  let payload;
  try {
    payload = parseStrictJsonBytes(Buffer.from(result.stdout, "utf8"));
  } catch (error) {
    throw new Error(
      `Pinned Claude vision call for ${cardIds.join(", ")} returned non-JSON metadata: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  const modelIdentity = responseModelIdentity(payload, model);
  const answers = new Map();
  const rejected = new Map();
  const duplicates = new Set();
  for (const line of payload.result.split("\n")) {
    const opened = line.indexOf("{");
    const closed = line.lastIndexOf("}");
    // The card id is read from the text before the JSON starts. Scanning the
    // whole line would let a written note that mentions another card retag the
    // answer, which is the one way free text could corrupt a record rather than
    // merely fail to parse.
    const tag = /(card-\d{4})/u.exec(opened < 0 ? line : line.slice(0, opened));
    if (!tag || opened < 0 || closed < opened || !cardIds.includes(tag[1])) continue;
    if (answers.has(tag[1]) || rejected.has(tag[1])) {
      duplicates.add(tag[1]);
      continue;
    }
    try {
      // Carving the object with a brace-free regex was safe only while no field
      // could contain a brace. A note may legally contain one inside its JSON
      // string, so the whole first-brace-to-last-brace span is handed to the
      // strict parser instead: it either yields exactly one well-formed object
      // or it throws, where the regex would have silently produced no match.
      answers.set(
        tag[1],
        assertAnswerRecord(
          canonicalAnswerRecord(
            parseStrictJsonBytes(Buffer.from(line.slice(opened, closed + 1), "utf8")),
          ),
          `Answer for ${tag[1]}`,
        ),
      );
    } catch (error) {
      // A malformed or schema-invalid line loses one answer, never the batch
      // alignment — but it says so. A silent drop reports a whole schema change
      // as "answered N drawings, N with no usable reply", which reads as a model
      // that would not answer rather than as a call and a validator that no
      // longer agree.
      //
      // The refused text travels with the reason, because the reason alone is
      // not enough to act on. A re-ask refused during this session named the
      // rule it broke and discarded the line, and finding out which rule it had
      // actually broken cost a second live call — on a reply that turned out to
      // be correct. Quoted rather than pasted: this is untrusted model output
      // and an escape or control character in it must be visible, not rendered.
      rejected.set(
        tag[1],
        `${error instanceof Error ? error.message : String(error)} Refused text: ${quoteLine(line, MAX_QUOTED_REFUSAL)}`,
      );
    }
  }
  for (const id of duplicates) {
    answers.delete(id);
    rejected.delete(id);
  }
  return { answers, rejected, modelIdentity };
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
  const only = option(argv, "only", null);
  const lastStep = option(argv, "last-step", null);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8) {
    throw new Error(
      `--jobs must be an integer from 1 through 8; received ${JSON.stringify(jobs)}.`,
    );
  }
  if (!Number.isInteger(batch) || batch < 1 || batch > 12) {
    throw new Error(
      `--batch must be an integer from 1 through 12; received ${JSON.stringify(batch)}.`,
    );
  }
  if (only !== null && (!/^\d+$/u.test(only) || Number(only) > 4_000)) {
    throw new Error(
      `--only must be a cluster index from 0 through 4000; received ${JSON.stringify(only)}.`,
    );
  }
  if (
    lastStep !== null &&
    (!/^\d+$/u.test(lastStep) || Number(lastStep) < 1 || Number(lastStep) > 359)
  ) {
    throw new Error(
      `--last-step must be an integer from 1 through 359; received ${JSON.stringify(lastStep)}.`,
    );
  }
  const featuresArtifact = readJsonArtifact(
    join(out, "features.json"),
    "part-identification features",
  );
  const matchArtifact = readJsonArtifact(join(out, "match.json"), "part-identification match");
  const distancesArtifact = readJsonArtifact(
    join(out, "distances.json"),
    "part-identification distances",
  );
  const { features, match, artifacts } = assertBoundMatchArtifacts({
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
  const answersPath = join(out, `answers-${model}.json`);
  const answers = existsSync(answersPath)
    ? boundAnswers(readJsonArtifact(answersPath, `vision answers for ${model}`), {
        model,
        matchDigest: artifacts.match.digest,
        cardsDigest: cardsArtifact.digest,
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        clusters: match.clusters,
        cards: cardsManifest.cards,
      })
    : {};
  const writeAnswers = () =>
    writeJson(
      answersPath,
      answerBundle({
        model,
        modelIdentity: expectedModelIdentity,
        matchDigest: artifacts.match.digest,
        cardsDigest: cardsArtifact.digest,
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        answers,
      }),
    );

  // A vision pass over the whole book is hours of wall clock, so it can be
  // restricted to the drawings the first N steps use — the range that carries
  // judged truth, and therefore the range where the delta is measurable.
  let inRange = null;
  if (lastStep !== null) {
    inRange = new Set();
    for (const cluster of match.clusters) {
      const uses = cluster.members.some((member) => {
        const callout = features.callouts[member];
        return callout.stepNumber !== null && callout.stepNumber <= Number(lastStep);
      });
      if (uses) inRange.add(cluster.clusterIndex);
    }
  }

  const pending = pendingAnswerClusterIndexes(match.clusters, answers, { only, inRange });
  const chunks = [];
  for (let at = 0; at < pending.length; at += batch) chunks.push(pending.slice(at, at + batch));
  console.log(
    `${pending.length} drawings to ask in ${chunks.length} calls of up to ${batch}, ` +
      `${usableAnswerCount(answers)} already answered`,
  );

  let done = 0;
  const rejections = new Map();
  const queue = [...chunks];
  const workers = Array.from({ length: jobs }, async () => {
    for (;;) {
      const chunk = queue.shift();
      if (!chunk) return;
      const replies = await askBatch(chunk.map(cardId), model, out, {
        cardImages: retained.images,
        cardDigests: new Map(
          Object.entries(cardsManifest.cards).map(([id, card]) => [id, card.sha256]),
        ),
      });
      for (const clusterIndex of chunk) {
        const id = cardId(clusterIndex);
        answers[clusterIndex] = replies.answers.get(id) ?? null;
        const reason = replies.rejected?.get(id);
        if (reason !== undefined) rejections.set(id, reason);
      }
      if (JSON.stringify(replies.modelIdentity) !== JSON.stringify(expectedModelIdentity)) {
        throw new Error(`Pinned model identity changed while answering ${chunk.join(", ")}.`);
      }
      done += 1;
      writeAnswers();
      if (done % 4 === 0) console.log(`  ${done}/${chunks.length} calls`);
    }
  });
  await settleVisionWorkers(workers);
  writeAnswers();
  const refused = Object.values(answers).filter((answer) => answer === null).length;
  console.log(`answered ${usableAnswerCount(answers)} drawings, ${refused} with no usable reply`);
  // A reply the validator threw out is a different event from a reply that never
  // arrived, and only one of the two is fixed by asking again. Printing the first
  // distinct reasons is what makes a prompt and a schema that have drifted apart
  // visible in the run that produced them.
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
