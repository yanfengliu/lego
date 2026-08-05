import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { option } from "./part-identification.mjs";
import {
  answerBundle,
  assertAnswerRecord,
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  boundAnswers,
  readJsonArtifact,
} from "./part-identification-artifacts.mjs";
import {
  CHILD_TIMEOUT_MS,
  MAX_CHILD_STDERR_BYTES,
  MAX_CHILD_STDOUT_BYTES,
  runBoundedChild,
  writeContainedFile,
} from "./part-identification-io.mjs";
import {
  assertCardImageFilesAndBundle,
  readCardImageBundleFromRoot,
} from "./part-identification-card-images.mjs";
import {
  PART_IDENTIFICATION_PROMPT,
  PART_IDENTIFICATION_PROMPT_DIGEST,
} from "./part-identification-prompt.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
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
          inheritFds,
        },
      );
    },
    { __testHooks: { lockSpawnImpl: context.lockSpawnImpl } },
  );
  if (result.code !== 0) {
    throw new Error(
      `Pinned Claude vision call for ${cardIds.join(", ")} exited ${result.code}${result.signal === null ? "" : ` (${result.signal})`}; stderr: ${result.stderr.trim() || "empty"}. No answer was retained.`,
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
  const duplicates = new Set();
  for (const line of payload.result.split("\n")) {
    const tag = /(card-\d{4})/u.exec(line);
    const json = /\{[^{}]*"pick"[^{}]*\}/u.exec(line);
    if (!tag || !json || !cardIds.includes(tag[1])) continue;
    if (answers.has(tag[1])) {
      duplicates.add(tag[1]);
      continue;
    }
    try {
      answers.set(
        tag[1],
        assertAnswerRecord(
          parseStrictJsonBytes(Buffer.from(json[0], "utf8")),
          `Answer for ${tag[1]}`,
        ),
      );
    } catch {
      // A malformed or schema-invalid line loses one answer, never the batch alignment.
    }
  }
  for (const id of duplicates) answers.delete(id);
  return { answers, modelIdentity };
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
    retained = assertCardImageFilesAndBundle(
      cardsRoot,
      readCardImageBundleFromRoot(cardsRoot, cardsManifest),
      cardsManifest,
    );
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

  const pending = match.clusters
    .filter(({ clusterIndex }) => answers[clusterIndex] === undefined)
    .filter(({ clusterIndex }) => only === null || Number(only) === clusterIndex)
    .filter(({ clusterIndex }) => inRange === null || inRange.has(clusterIndex))
    .map(({ clusterIndex }) => clusterIndex);
  const chunks = [];
  for (let at = 0; at < pending.length; at += batch) chunks.push(pending.slice(at, at + batch));
  console.log(
    `${pending.length} drawings to ask in ${chunks.length} calls of up to ${batch}, ` +
      `${Object.keys(answers).length} already answered`,
  );

  let done = 0;
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
        answers[clusterIndex] = replies.answers.get(cardId(clusterIndex)) ?? null;
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
  console.log(`answered ${Object.keys(answers).length} drawings, ${refused} with no usable reply`);
}

export { PROMPT, askBatch, commandAsk };
