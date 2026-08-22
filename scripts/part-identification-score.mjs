import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  PART_SCORE_SCHEMA,
  PART_SCORE_SUMMARY_SCHEMA,
  assertBoundMatchArtifacts,
  assertCardsArtifact,
  boundAnswers,
  readJsonArtifact,
  usableAnswerCount,
} from "./part-identification-artifacts.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import { handednessVerdicts } from "./part-identification-handedness.mjs";
import { mirrorPairedPicks } from "./part-identification-mirror-pairs.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  requirePinnedPartIdentificationModel,
} from "./part-identification-model.mjs";
import { MAX_JSON_ARTIFACT_BYTES, writeContainedFile } from "./part-identification-io.mjs";
import { verifyRetainedCardImageClosure } from "./part-identification-card-images.mjs";
import { PART_TRUTH_PATH } from "./part-identification-truth-key.mjs";
import {
  claimsFor,
  conservation,
  describesSameThing,
  visionPick,
} from "./part-identification-claims.mjs";
import {
  scoreAgainstTruth,
  snapshotScoreSummaryInputDigests,
} from "./part-identification-score-truth.mjs";
import { readWhatTheCallObserved } from "./part-identification-score-observations.mjs";

export {
  claimsFor,
  conservation,
  describesSameThing,
  scoreAgainstTruth,
  snapshotScoreSummaryInputDigests,
  visionPick,
  readWhatTheCallObserved,
};

/**
 * The grader.
 *
 * Every part the book calls out, summed over all 359 steps, must come to the
 * inventory printed at the back: 276 elements, 1465 pieces. That grades every
 * step at once with nothing hand-labelled, and it cannot be talked round —
 * claiming an element 104 times when the set holds 21 is 83 pieces of proof
 * that the identification is wrong.
 *
 * It is a necessary condition, not a sufficient one: two elements swapped for
 * each other with equal quantities conserve perfectly and are both wrong. So
 * the first fifty steps carry a separate hand-read label file, and the two
 * numbers are reported side by side rather than one standing in for the other.
 */

const OUT = "output/part-identification";

function writeJson(path, value) {
  writeContainedFile(dirname(path), basename(path), `${JSON.stringify(value, null, 1)}\n`, {
    label: "Part-identification score",
    pathLabel: "Part-identification score path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
}

function countBy(values) {
  const tally = {};
  for (const value of values) tally[value] = (tally[value] ?? 0) + 1;
  return tally;
}

export async function commandScore(argv, { option, inventoryHeld, elementNames }) {
  const source = option(argv, "source", "deterministic");
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
  const assignment = option(argv, "assign", "one-to-one");
  if (source !== "deterministic" && source !== "adjudicated") {
    throw new Error(
      `--source must be deterministic or adjudicated; received ${JSON.stringify(source)}.`,
    );
  }
  if (!["nearest", "one-to-one", "quantity-informed"].includes(assignment)) {
    throw new Error(
      `--assign must be nearest, one-to-one, or quantity-informed; received ${JSON.stringify(assignment)}.`,
    );
  }
  requirePinnedPartIdentificationModel(model);
  const featuresArtifact = readJsonArtifact(
    join(OUT, "features.json"),
    "part-identification features",
  );
  const matchArtifact = readJsonArtifact(join(OUT, "match.json"), "part-identification match");
  const distancesArtifact = readJsonArtifact(
    join(OUT, "distances.json"),
    "part-identification distances",
  );
  const { features, match, distances, artifacts } = assertBoundMatchArtifacts({
    featuresArtifact,
    matchArtifact,
    distancesArtifact,
  });
  const answersPath = join(OUT, `answers-${model}.json`);
  const answersArtifact = existsSync(answersPath)
    ? readJsonArtifact(answersPath, `vision answers for ${model}`)
    : null;
  const cardsPath = join(OUT, "cards", "manifest.json");
  const cardsArtifact =
    source !== "deterministic" && existsSync(cardsPath)
      ? readJsonArtifact(cardsPath, "part-identification cards")
      : null;
  const cards =
    cardsArtifact === null
      ? null
      : assertCardsArtifact(cardsArtifact, {
          featuresDigest: artifacts.features.digest,
          matchDigest: artifacts.match.digest,
          clusters: match.clusters,
        });
  let cardImages = null;
  if (cards !== null) {
    const cardsRoot = join(OUT, "cards");
    const cardImagesPath = join(cardsRoot, ...cards.imagesFile.split("/"));
    if (!existsSync(cardImagesPath)) {
      throw new Error(
        `No retained card-image bundle at ${cardImagesPath}; regenerate cards before scoring adjudicated answers.`,
      );
    }
    cardImages = verifyRetainedCardImageClosure(cardsRoot, cards);
  }
  if (source !== "deterministic" && cardsArtifact === null) {
    throw new Error(
      `No feature/match-bound vision cards at ${cardsPath}; regenerate source-bound cards before scoring adjudicated answers.`,
    );
  }
  const answers =
    source === "deterministic" || answersArtifact === null || cardsArtifact === null
      ? null
      : boundAnswers(answersArtifact, {
          model,
          matchDigest: artifacts.match.digest,
          cardsDigest: cardsArtifact.digest,
          promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
          clusters: match.clusters,
          cards: cards.cards,
          cardImages: cardImages.images,
          traceRoot: OUT,
        });
  if (source !== "deterministic" && answers === null) {
    throw new Error(
      `No vision answers at ${answersPath}; run "node scripts/part-identification.mjs ask --model ${model}" first, ` +
        `or score with --source deterministic.`,
    );
  }

  const { held, digest: inventoryDigest } = inventoryHeld();
  const { names, digest: elementResolutionDigest } = elementNames();
  // The hand is read off the card before anything is claimed, and only for the
  // cards that display both hands of one part. Everywhere else there is no
  // mirror question, and inflating 269 rasters to establish that would cost a
  // minute of every score run for nothing.
  const mirrorPairs =
    source === "deterministic" || answers === null
      ? []
      : mirrorPairedPicks(match, answers, names, cards?.cards);
  const handedness = handednessVerdicts(mirrorPairs, cardImages?.images);
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names,
    cards: cards?.cards,
    handedness,
  });
  const table = conservation(features.callouts, claims, held);

  const agreement = {
    checked: 0,
    kindDisagrees: 0,
    sizeDisagrees: 0,
    colourDisagrees: 0,
    either: 0,
  };
  const disagreements = [];
  if (source !== "deterministic") {
    for (const cluster of match.clusters) {
      const answer = answers[cluster.clusterIndex];
      const claim = claims.get(cluster.members[0]);
      if (!answer || !claim?.elementId) continue;
      const verdict = describesSameThing(answer, names.get(claim.elementId));
      if (!verdict) continue;
      agreement.checked += 1;
      if (verdict.kindAgrees === false) agreement.kindDisagrees += 1;
      if (verdict.sizeAgrees === false) agreement.sizeDisagrees += 1;
      if (verdict.colourAgrees === false) agreement.colourDisagrees += 1;
      if (
        verdict.kindAgrees === false ||
        verdict.sizeAgrees === false ||
        verdict.colourAgrees === false
      ) {
        agreement.either += 1;
        disagreements.push({
          clusterIndex: cluster.clusterIndex,
          lead: cluster.lead,
          said: `${answer.kind} ${answer.studsLong}x${answer.studsWide} ${answer.colour}`,
          picked: claim.elementId,
          publishedName: names.get(claim.elementId)?.name ?? null,
        });
      }
    }
  }

  const observed =
    source === "deterministic"
      ? null
      : readWhatTheCallObserved(match, answers, claims, names, cards?.cards, handedness);

  const truthPath = PART_TRUTH_PATH;
  const truthArtifact = existsSync(truthPath)
    ? readJsonArtifact(truthPath, "part-identification first-fifty truth")
    : null;
  const accuracy =
    truthArtifact === null
      ? null
      : scoreAgainstTruth(truthArtifact.value, features, match, claims, names);

  const picks = [...claims.values()];
  const score = {
    schemaVersion: PART_SCORE_SCHEMA,
    // Every sibling artifact binds the bytes it was derived from; a score that
    // named none of its inputs could not be told apart from one produced by an
    // earlier closure generation, which is exactly how stale scores survived.
    inputDigests: {
      features: artifacts.features.digest,
      match: artifacts.match.digest,
      distances: artifacts.distances.digest,
      inventoryLabels: inventoryDigest,
      elementResolution: elementResolutionDigest,
      ...(cardsArtifact === null ? {} : { cards: cardsArtifact.digest }),
      ...(cardImages === null ? {} : { cardImages: cardImages.digest }),
      ...(answers === null ? {} : { answers: answersArtifact.digest }),
      ...(truthArtifact === null ? {} : { truthFirstFifty: truthArtifact.digest }),
    },
    source,
    assignment,
    assignmentNote:
      assignment === "quantity-informed"
        ? "Printed quantities enter the assignment cost, so conservation below is fitted, not an independent grade."
        : "Printed quantities are not used to choose; conservation below is an independent grade.",
    model: source === "deterministic" ? null : model,
    calloutDir: features.calloutDir,
    calloutsIdentified: picks.filter(({ elementId }) => elementId !== null).length,
    calloutsTotal: features.calloutCount,
    clusters: match.clusters.length,
    picked: countBy(picks.map(({ picked }) => picked)),
    visionCoverage:
      source === "deterministic"
        ? null
        : {
            drawings: match.clusters.length,
            answered: usableAnswerCount(answers),
            note: "Drawings with no answer fall back to geometry, so a partial pass moves the measured range and leaves the rest of the book as it was.",
          },
    conservation: table,
    descriptionAgreement: source === "deterministic" ? null : agreement,
    descriptionDisagreements: disagreements.slice(0, 30),
    // What the call saw and could not say in the six description fields. This is
    // the reader the written notes have to have: a booklet icon that was
    // detected, measured and correctly named, then consumed by nothing for
    // weeks, is how this repository already inverted the face parity of every
    // step after it. Collecting text nobody prints is the same failure with a
    // different field name, so the notes are reported in full rather than
    // counted.
    observations: observed,
    firstFiftyAccuracy: accuracy,
  };
  writeJson(join(OUT, `score-${source}-${assignment}.json`), score);
  if (option(argv, "headline", "yes") !== "no") writeJson(join(OUT, "score.json"), score);
  console.log(
    [
      `source ${source}/${assignment}${source === "deterministic" ? "" : ` (${model})`}`,
      `elements exact ${table.elementsExact}/${table.elementsHeld}`,
      `pieces reconciled ${table.piecesReconciled}/${table.piecesHeld}`,
      `over ${table.piecesOverClaimed} under ${table.piecesUnderClaimed}`,
      // The observation field is only worth having if a run says out loud how
      // often it was used. The two mirror numbers are printed separately and
      // named for what each one measures: "hand read" is the card's pixels
      // deciding which hand the query is, "pair named" is only that the answer
      // mentioned the twin's number, which cannot separate the hands at all.
      observed === null
        ? "no vision observations"
        : `notes ${observed.notesWritten}/${observed.answered} | hand read ${observed.handedness.picksWhoseHandWasRead}/${observed.handedness.picksWhoseMirrorWasDisplayed}` +
          ` (${observed.handedness.picksTheHandRefuted} refuted) | pair named ${observed.mirrorPairAwareness.picksThatNamedTheMirror}/${observed.mirrorPairAwareness.picksWhoseMirrorWasDisplayed}`,
      // "0/0" reads as "nobody labelled this", which is a different problem
      // from labels that exist and no longer bind to any current claim.
      accuracy === null
        ? "first-50 unlabelled"
        : accuracy.calloutsJudged === 0
          ? `first-50 no verdict binds any of the ${accuracy.calloutsInRange} callouts in range`
          : `first-50 ${accuracy.correct}/${accuracy.calloutsJudged}`,
    ].join(" | "),
  );
  return score;
}

/**
 * Every configuration side by side, because no single one is the answer.
 *
 * Geometry alone against geometry plus a vision pick says what the model call
 * bought; nearest-match against a global assignment says what the
 * one-drawing-one-element constraint bought; and the quantity-informed variant
 * is fitted to the grader and is here to be read as such, not as a score.
 */
export async function commandSummary(argv, helpers) {
  const { option } = helpers;
  const models = (option(argv, "models", PART_IDENTIFICATION_MODEL_ID) ?? "")
    .split(",")
    .filter(Boolean);
  if (models.length === 0 || new Set(models).size !== models.length) {
    throw new Error("--models must contain one or more unique comma-separated pinned model ids.");
  }
  for (const model of models) requirePinnedPartIdentificationModel(model);
  const configurations = [
    ["deterministic", "nearest", null],
    ["deterministic", "one-to-one", null],
    ["deterministic", "quantity-informed", null],
    ...models.flatMap((name) => [
      ["adjudicated", "nearest", name],
      ["adjudicated", "one-to-one", name],
      ["adjudicated", "quantity-informed", name],
    ]),
  ];
  const variants = [];
  let sharedInputDigests = null;
  for (const [source, assignment, named] of configurations) {
    const model = named ?? models[0] ?? PART_IDENTIFICATION_MODEL_ID;
    const answersPath = join(OUT, `answers-${model}.json`);
    if (source === "adjudicated" && !existsSync(answersPath)) continue;
    const score = await commandScore(
      ["--source", source, "--assign", assignment, "--model", model, "--headline", "no"],
      helpers,
    );
    const capturedDigests = snapshotScoreSummaryInputDigests(
      score.inputDigests,
      `${score.source}/${score.assignment}/${score.model ?? "no-model"}`,
      sharedInputDigests,
    );
    sharedInputDigests ??= capturedDigests.shared;
    variants.push({
      source: score.source,
      assignment: score.assignment,
      model: score.model,
      inputDigests: capturedDigests.all,
      elementsExact: score.conservation.elementsExact,
      elementsHeld: score.conservation.elementsHeld,
      piecesReconciled: score.conservation.piecesReconciled,
      piecesHeld: score.conservation.piecesHeld,
      piecesOverClaimed: score.conservation.piecesOverClaimed,
      piecesUnderClaimed: score.conservation.piecesUnderClaimed,
      piecesUnclaimed: score.conservation.piecesUnclaimed,
      elementsNeverClaimed: score.conservation.elementsNeverClaimed,
      firstFifty: score.firstFiftyAccuracy && {
        calloutsInRange: score.firstFiftyAccuracy.calloutsInRange,
        calloutsJudged: score.firstFiftyAccuracy.calloutsJudged,
        calloutsUnjudged: score.firstFiftyAccuracy.calloutsUnjudged,
        verdictsUnboundToCurrentClaims: score.firstFiftyAccuracy.verdictsUnboundToCurrentClaims,
        correct: score.firstFiftyAccuracy.correct,
        accuracy: score.firstFiftyAccuracy.accuracy,
        piecesJudged: score.firstFiftyAccuracy.piecesJudged,
        piecesCorrect: score.firstFiftyAccuracy.piecesCorrect,
      },
      descriptionAgreement: score.descriptionAgreement,
      // Compact here, sentences and all: whether a declared second choice
      // actually carried a drawing is the one observation number that changes
      // with the assignment, so the side-by-side table would be blind without
      // it. The written notes themselves live under `headline.observations`.
      observations: score.observations && {
        notesWritten: score.observations.notesWritten,
        byDifference: score.observations.byDifference,
        secondChoicesOffered: score.observations.secondChoicesOffered,
        secondChoicesTaken: score.observations.secondChoicesTaken,
        picksWhoseMirrorWasDisplayed: score.observations.handedness.picksWhoseMirrorWasDisplayed,
        // The hand, read from the card. Kept separate from the awareness count
        // below, which was previously the only mirror number reported and was
        // read as if it were this one.
        picksWhoseHandWasRead: score.observations.handedness.picksWhoseHandWasRead,
        picksTheHandUpheld: score.observations.handedness.picksTheHandUpheld,
        picksTheHandRefuted: score.observations.handedness.picksTheHandRefuted,
        picksThatNamedTheMirror: score.observations.mirrorPairAwareness.picksThatNamedTheMirror,
      },
      visionCoverage: score.visionCoverage,
    });
  }

  const headlineName = option(argv, "headline-source", "adjudicated");
  const headlineAssign = option(argv, "headline-assign", "one-to-one");
  const headlineModel = option(
    argv,
    "headline-model",
    models[models.length - 1] ?? PART_IDENTIFICATION_MODEL_ID,
  );
  const headline = await commandScore(
    [
      "--source",
      headlineName,
      "--assign",
      headlineAssign,
      "--model",
      headlineModel,
      "--headline",
      "no",
    ],
    helpers,
  );
  const headlineDigests = snapshotScoreSummaryInputDigests(
    headline.inputDigests,
    `headline ${headline.source}/${headline.assignment}/${headline.model ?? "no-model"}`,
    sharedInputDigests,
  );
  const featuresArtifact = readJsonArtifact(
    join(OUT, "features.json"),
    "part-identification features",
  );
  const matchArtifact = readJsonArtifact(join(OUT, "match.json"), "part-identification match");
  for (const [role, digest] of [
    ["features", featuresArtifact.digest],
    ["match", matchArtifact.digest],
  ]) {
    if (sharedInputDigests?.[role] !== digest) {
      throw new Error(
        `Score summary metadata reread ${role} digest ${digest}, but the compared variants bind ${JSON.stringify(sharedInputDigests?.[role] ?? "missing")}. An input changed while the summary was running; discard the mixed summary and rerun against immutable artifacts.`,
      );
    }
  }
  const features = featuresArtifact.value;
  writeJson(join(OUT, "score.json"), {
    schemaVersion: PART_SCORE_SUMMARY_SCHEMA,
    what: "Naming the part a booklet step adds, by matching its printed callout drawing to the back-of-book parts list.",
    headline: {
      source: headlineName,
      assignment: headlineAssign,
      model: headlineModel,
      ...headline,
      inputDigests: headlineDigests.all,
    },
    variants,
    inputs: {
      inputDigests: {
        ...sharedInputDigests,
      },
      calloutDir: features.calloutDir,
      inventoryDir: features.inventoryDir,
      callouts: features.calloutCount,
      piecesCalledOut: features.piecesCalledOut,
      distinctDrawings: matchArtifact.value.clusterCount,
      inventoryThumbnails: features.inventoryCount,
      inventoryElements: features.inventoryHeldCount,
      elementsWithoutThumbnail: features.elementsWithoutThumbnail,
      piecesWithoutThumbnail: features.piecesWithoutThumbnail,
    },
  });
  console.log(`wrote ${join(OUT, "score.json")} with ${variants.length} variants`);
}

/** Everything a scoring or sheet run needs, resolved once from the same options. */
