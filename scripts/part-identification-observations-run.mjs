import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  boundAnswers,
  readJsonArtifact,
} from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  requirePinnedPartIdentificationModel,
} from "./part-identification-model.mjs";
import {
  MAX_IMAGE_ARTIFACT_BYTES,
  MAX_JSON_ARTIFACT_BYTES,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";
import { observationRecords, observationReport } from "./part-identification-observations.mjs";
import { handednessVerdicts } from "./part-identification-handedness.mjs";
import { mirrorPairedPicks } from "./part-identification-mirror-pairs.mjs";
import { readBoundCardImages } from "./part-identification-card-images.mjs";
import {
  DEFAULT_MAX_REASKS,
  REASK_REASONS,
  askReaskBatch,
  boundReasks,
  planReasks,
  reaskBundle,
} from "./part-identification-reask.mjs";

/**
 * Reading the answers off disk, once, for both the report and the gate that checks it.
 *
 * The report and `check-observation-consumers.mjs` load through this same
 * function on purpose. A gate that regenerates an artifact by a shorter route
 * than the generator used is checking two different things against each other,
 * and would go green on exactly the divergence it exists to catch.
 */

export const DEFAULT_OUT = "output/part-identification";
const OUT = DEFAULT_OUT;
export const OBSERVATION_REPORT_FILE = "observations.md";

export const observationReportPath = (out = OUT) => join(out, OBSERVATION_REPORT_FILE);
export const answersPathFor = (model, out = OUT) => join(out, `answers-${model}.json`);
export const reasksPathFor = (model, out = OUT) => join(out, `reasks-${model}.json`);

function writeArtifact(path, text, label) {
  writeContainedFile(dirname(path), basename(path), text, {
    label,
    pathLabel: `${label} path`,
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
}

/**
 * Everything the report is a function of, bound to the exact bytes it came from.
 *
 * Returns null when no vision pass has been run, which is a legitimate state and
 * not a failure: the answers artifact lives under an ignored path, so a fresh
 * clone has none and a gate that treated its absence as red would be red
 * everywhere it was not useful.
 */
export function loadObservationInputs(model, out = OUT) {
  requirePinnedPartIdentificationModel(model);
  const answersPath = answersPathFor(model, out);
  if (!existsSync(answersPath)) return null;
  const answersArtifact = readJsonArtifact(answersPath, `vision answers for ${model}`);
  const featuresArtifact = readJsonArtifact(join(out, "features.json"), "features");
  const matchArtifact = readJsonArtifact(join(out, "match.json"), "match");
  const distancesArtifact = readJsonArtifact(join(out, "distances.json"), "distances");
  const { match, artifacts } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const cardsArtifact = readJsonArtifact(join(out, "cards", "manifest.json"), "cards");
  const cardsManifest = assertCardsArtifact(cardsArtifact, {
    featuresDigest: artifacts.features.digest,
    matchDigest: artifacts.match.digest,
    clusters: match.clusters,
  });
  const answers = boundAnswers(answersArtifact, {
    model,
    matchDigest: artifacts.match.digest,
    cardsDigest: cardsArtifact.digest,
    promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
    clusters: match.clusters,
    cards: cardsManifest.cards,
  });
  const resolutionPath = join(out, "element-resolution.json");
  const names = existsSync(resolutionPath)
    ? new Map(
        Object.entries(readJsonArtifact(resolutionPath, "element resolution").value).map(
          ([id, entry]) => [id, entry],
        ),
      )
    : new Map();
  // The same pixel verdicts the grader reaches, from the same bound bytes, so
  // the report cannot label a pick one thing while score.json labels it another.
  // Only the mirror-paired cards are opened; the manifest still authenticates
  // each one it hands over.
  const pairs = mirrorPairedPicks(match, answers, names, cardsManifest.cards);
  const handedness = handednessVerdicts(
    pairs,
    pairs.length === 0
      ? new Map()
      : readBoundCardImages(
          join(out, "cards"),
          cardsManifest,
          pairs.map(({ cardId }) => cardId),
        ),
  );
  return {
    model,
    match,
    answers,
    names,
    handedness,
    cards: cardsManifest.cards,
    provenance: {
      model,
      answersDigest: answersArtifact.digest,
      cardsDigest: cardsArtifact.digest,
      matchDigest: artifacts.match.digest,
      promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
      drawings: match.clusters.length,
    },
  };
}

/** The recorded follow-up calls, or none, checked against the run they claim to be about. */
export function loadRecordedReasks(inputs, out = OUT) {
  const path = reasksPathFor(inputs.model, out);
  if (!existsSync(path)) return [];
  const artifact = readJsonArtifact(path, `recorded re-asks for ${inputs.model}`);
  return boundReasks(artifact.value, {
    model: inputs.model,
    matchDigest: inputs.provenance.matchDigest,
    cardsDigest: inputs.provenance.cardsDigest,
    answersDigest: inputs.provenance.answersDigest,
  });
}

/** The exact report text the current artifacts produce. */
export function renderObservationReport(inputs, reasks) {
  return observationReport({
    provenance: inputs.provenance,
    records: observationRecords(inputs),
    reasks,
  });
}

export async function commandObservations(argv, { option }) {
  const out = option(argv, "out", OUT);
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
  const inputs = loadObservationInputs(model, out);
  if (inputs === null) {
    throw new Error(
      `No vision answers at ${answersPathFor(model, out)}; run "node scripts/part-identification.mjs ask --model ${model}" before reporting what the call observed.`,
    );
  }
  const reasks = loadRecordedReasks(inputs, out);
  const records = observationRecords(inputs);
  const text = renderObservationReport(inputs, reasks);
  writeArtifact(observationReportPath(out), text, "Part-identification observation report");
  const notes = records.filter(({ note }) => note !== null).length;
  const differences = records.filter(({ differsFromPick }) => differsFromPick !== "nothing").length;
  const ambiguous = records.filter(({ alsoCouldBe }) => alsoCouldBe !== 0).length;
  console.log(
    [
      `wrote ${observationReportPath(out)}`,
      `${notes} notes`,
      `${differences} declared differences`,
      `${ambiguous} second choices`,
      `${reasks.length} re-asks`,
    ].join(" | "),
  );
}

/**
 * The bounded follow-up pass.
 *
 * Plans from the first-pass answers, asks at most `--max` narrowed questions,
 * and writes them into their own artifact bound to the exact answers bytes they
 * came from. Nothing here reads the re-ask artifact, so a second run re-plans
 * from the first pass rather than from its own output.
 */
export async function commandReask(argv, { option }) {
  const out = option(argv, "out", OUT);
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
  const max = Number(option(argv, "max", String(DEFAULT_MAX_REASKS)));
  const expectedModelIdentity = requirePinnedPartIdentificationModel(model);
  const inputs = loadObservationInputs(model, out);
  if (inputs === null) {
    throw new Error(
      `No vision answers at ${answersPathFor(model, out)}; there is nothing to ask again about.`,
    );
  }
  const targets = planReasks({ ...inputs, max });
  console.log(
    targets.length === 0
      ? "no drawing left two candidates standing, so there is nothing to ask again"
      : `${targets.length} drawings to ask again: ${countReasons(targets)}`,
  );
  if (targets.length === 0) return;

  const cardImages = new Map();
  const cardDigests = new Map();
  const cardsRoot = join(out, "cards");
  for (const target of targets) {
    const card = inputs.cards[target.cardId];
    // Through the same containment boundary the first pass reads cards with, so
    // a manifest entry cannot name a path outside its own immutable run.
    cardImages.set(
      target.cardId,
      readContainedFile(cardsRoot, card.file, {
        label: `Vision card ${target.cardId}`,
        pathLabel: "Vision card path",
        maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
      }),
    );
    cardDigests.set(target.cardId, card.sha256);
  }

  const reasks = {};
  for (let at = 0; at < targets.length; at += 3) {
    const chunk = targets.slice(at, at + 3);
    const { replies, rejected, modelIdentity } = await askReaskBatch(chunk, model, {
      cardImages,
      cardDigests,
    });
    if (JSON.stringify(modelIdentity) !== JSON.stringify(expectedModelIdentity)) {
      throw new Error(
        `Pinned model identity changed while asking again about ${chunk.map(({ cardId }) => cardId).join(", ")}.`,
      );
    }
    for (const target of chunk) {
      const reply = replies.get(target.cardId);
      if (reply === undefined) {
        console.log(
          `  ${target.cardId} returned no usable reply: ${rejected.get(target.cardId) ?? "no tagged line"}`,
        );
        continue;
      }
      reasks[target.clusterIndex] = {
        cardId: target.cardId,
        reason: target.reason,
        between: target.between,
        firstPick: target.firstPick,
        pick: reply.pick,
        because: reply.because,
      };
    }
    writeArtifact(
      reasksPathFor(model, out),
      `${JSON.stringify(
        reaskBundle({
          model,
          modelIdentity: expectedModelIdentity,
          matchDigest: inputs.provenance.matchDigest,
          cardsDigest: inputs.provenance.cardsDigest,
          answersDigest: inputs.provenance.answersDigest,
          reasks,
        }),
        null,
        1,
      )}\n`,
      "Part-identification re-asks",
    );
  }
  const recorded = Object.values(reasks);
  const contradicting = recorded.filter(({ pick, firstPick }) => pick !== 0 && pick !== firstPick);
  console.log(
    `recorded ${recorded.length} re-asks in ${reasksPathFor(model, out)} | ${contradicting.length} contradict the first answer`,
  );
}

function countReasons(targets) {
  const tally = new Map();
  for (const { reason } of targets) tally.set(reason, (tally.get(reason) ?? 0) + 1);
  return [...tally]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => `${count} because ${REASK_REASONS[reason].why}`)
    .join("; ");
}
