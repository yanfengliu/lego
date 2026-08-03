import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { option } from "./part-identification.mjs";
import {
  PART_MATCH_SCHEMA,
  answerBundle,
  assertCardsArtifact,
  boundAnswers,
  readJsonArtifact,
  sha256Digest,
} from "./part-identification-artifacts.mjs";

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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(
    path,
    `${JSON.stringify(value, null, 1)}
`,
  );
}

const PROMPT = [
  "Each image shows one LEGO part drawing from an instruction booklet (QUERY), and",
  "numbered CANDIDATE drawings taken from the same booklet's own parts list.",
  "Every drawing uses the same viewing angle and drawing style; only the printed size differs.",
  "The parts list contains every part in the set, so the query part is usually among the",
  "candidates — answer 0 only when none of them could be the same part.",
  "First describe the QUERY part on its own, then say which candidate is the same part.",
  'Reply with one line of JSON per image: {"kind":"<brick|plate|tile|slope|wedge|arch|round|technic|other>",',
  '"studsLong":<integer or 0>,"studsWide":<integer or 0>,"colour":"<plain colour name>",',
  '"pick":<candidate number, or 0>,"confidence":<0..1>}',
  "Count studs along the long axis for studsLong and across for studsWide.",
  "Shape, stud count and colour must all match for a candidate to be the same part.",
].join(" ");

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
function askBatch(cardIds, model, out = OUT) {
  const paths = cardIds.map((id) => join(out, "cards", `${id}.png`).replaceAll("\\", "/"));
  const instruction =
    `Read these ${cardIds.length} images: ${paths.join(" ")}\n\n` +
    `Answer separately about each, in the order given, one line per image, ` +
    `each line beginning with the image's card id (${cardIds.join(", ")}) followed by the JSON. ` +
    `No prose, no code fences.\n\n${PROMPT}`;
  return new Promise((resolve) => {
    const child = spawn(
      process.env.CLAUDE_CLI ?? "claude",
      ["-p", instruction, "--model", model, "--allowedTools", "Read"],
      { windowsHide: true },
    );
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", () => {});
    child.on("error", () => resolve(new Map()));
    child.on("close", () => {
      const answers = new Map();
      for (const line of out.split("\n")) {
        const tag = /(card-\d{4})/.exec(line);
        const json = /\{[^{}]*"pick"[^{}]*\}/.exec(line);
        if (!tag || !json || !cardIds.includes(tag[1])) continue;
        try {
          answers.set(tag[1], JSON.parse(json[0]));
        } catch {
          /* a malformed line loses one answer, not the batch */
        }
      }
      resolve(answers);
    });
  });
}

const cardId = (clusterIndex) => `card-${String(clusterIndex).padStart(4, "0")}`;

async function commandAsk(argv) {
  const out = option(argv, "out", OUT);
  const model = option(argv, "model", "sonnet");
  const jobs = Number(option(argv, "jobs", "4"));
  const batch = Number(option(argv, "batch", "6"));
  const only = option(argv, "only", null);
  const lastStep = option(argv, "last-step", null);
  const matchArtifact = readJsonArtifact(join(out, "match.json"), "part-identification match");
  const match = matchArtifact.value;
  if (match.schemaVersion !== PART_MATCH_SCHEMA) {
    throw new Error(
      `Vision cards require ${PART_MATCH_SCHEMA}; regenerate features, match, tiles, and cards before asking.`,
    );
  }
  const cardsManifestPath = join(out, "cards", "manifest.json");
  if (!existsSync(cardsManifestPath)) {
    throw new Error(
      `Vision cards have no manifest at ${cardsManifestPath}; regenerate tiles and cards for the exact current match.`,
    );
  }
  const cardsArtifact = readJsonArtifact(cardsManifestPath, "part-identification cards");
  const cardsManifest = assertCardsArtifact(cardsArtifact, {
    matchDigest: matchArtifact.digest,
    clusterIndexes: match.clusters.map(({ clusterIndex }) => clusterIndex),
  });
  for (const [id, digest] of Object.entries(cardsManifest.cards)) {
    const path = join(out, "cards", `${id}.png`);
    if (!existsSync(path) || sha256Digest(readFileSync(path)) !== digest) {
      throw new Error(
        `Vision card ${id} is missing or differs from the exact match-bound cards manifest. Regenerate every tile and card before asking, including already-answered clusters.`,
      );
    }
  }
  const answersPath = join(out, `answers-${model}.json`);
  const answers = existsSync(answersPath)
    ? boundAnswers(readJsonArtifact(answersPath, `vision answers for ${model}`), {
        model,
        matchDigest: matchArtifact.digest,
        cardsDigest: cardsArtifact.digest,
        clusterIndexes: match.clusters.map(({ clusterIndex }) => clusterIndex),
      })
    : {};
  const writeAnswers = () =>
    writeJson(
      answersPath,
      answerBundle({
        model,
        matchDigest: matchArtifact.digest,
        cardsDigest: cardsArtifact.digest,
        answers,
      }),
    );

  // A vision pass over the whole book is hours of wall clock, so it can be
  // restricted to the drawings the first N steps use — the range that carries
  // judged truth, and therefore the range where the delta is measurable.
  let inRange = null;
  if (lastStep !== null) {
    const features = readJson(join(out, "features.json"));
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
      const replies = await askBatch(chunk.map(cardId), model, out);
      for (const clusterIndex of chunk) {
        answers[clusterIndex] = replies.get(cardId(clusterIndex)) ?? null;
      }
      done += 1;
      writeAnswers();
      if (done % 4 === 0) console.log(`  ${done}/${chunks.length} calls`);
    }
  });
  await Promise.all(workers);
  writeAnswers();
  const refused = Object.values(answers).filter((answer) => answer === null).length;
  console.log(`answered ${Object.keys(answers).length} drawings, ${refused} with no usable reply`);
}

export { PROMPT, commandAsk };
