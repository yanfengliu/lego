import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { assignDrawings } from "./part-assignment.mjs";
import { COLOR_DEFINITIONS } from "../packages/catalog/src/colors.ts";
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
import { MAX_JSON_ARTIFACT_BYTES, writeContainedFile } from "./part-identification-io.mjs";
import {
  assertCardImageFilesAndBundle,
  readCardImageBundleFromRoot,
} from "./part-identification-card-images.mjs";

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

function readJson(path) {
  return readJsonArtifact(path, `part-identification input ${path}`).value;
}

function writeJson(path, value) {
  writeContainedFile(dirname(path), basename(path), `${JSON.stringify(value, null, 1)}\n`, {
    label: "Part-identification score",
    pathLabel: "Part-identification score path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
}

/**
 * What the vision call said about one drawing, reduced to the element it pointed at.
 *
 * Three deterministic checks stand between the answer and a claim, and all of
 * them can throw it out: the pick has to be a number on the card, the element
 * behind that number has to be one the inventory lists, and the free
 * description given in the same breath has to agree with that element's
 * published name and colour code on kind, stud size, and colour. The call never
 * sees that metadata, so the third check is not something it can satisfy by
 * asserting.
 */
function visionPick(cluster, answers, names, cards) {
  const answer = answers?.[cluster.clusterIndex] ?? null;
  if (answer === null || answer === undefined) return { elementId: null, picked: "unanswered" };
  const pick = Number(answer.pick ?? 0);
  if (pick === 0) return { elementId: null, picked: "refused" };
  const cardId = `card-${String(cluster.clusterIndex).padStart(4, "0")}`;
  const displayed = cards?.[cardId]?.candidateElementIds;
  if (!Array.isArray(displayed)) {
    return { elementId: null, picked: "description-unverifiable" };
  }
  if (!Number.isInteger(pick) || pick < 1 || pick > displayed.length) {
    return { elementId: null, picked: "out-of-range" };
  }
  const elementId = displayed[pick - 1];
  if (!(names instanceof Map)) {
    return { elementId: null, picked: "description-unverifiable" };
  }
  const verdict = describesSameThing(answer, names.get(elementId));
  if (
    verdict === null ||
    verdict.kindAgrees !== true ||
    verdict.sizeAgrees !== true ||
    verdict.colourAgrees !== true
  ) {
    return {
      elementId: null,
      picked:
        verdict?.kindAgrees === false ||
        verdict?.sizeAgrees === false ||
        verdict?.colourAgrees === false
          ? "self-contradicted"
          : "description-unverifiable",
    };
  }
  return { elementId, picked: "vision-kept" };
}

/**
 * Which element each callout is claimed to be.
 *
 * `nearest` lets every drawing take its closest element with no regard for what
 * any other drawing wants; `assigned` makes the choice once for the whole book
 * under the one-element-one-drawing constraint. The vision pick, where there is
 * one, enters as a discount on that element rather than as the answer.
 */
export function claimsFor(match, distances, source, answers, options = {}) {
  if (source !== "deterministic" && source !== "adjudicated") {
    throw new Error(
      `Part-identification source must be deterministic or adjudicated; received ${JSON.stringify(source)}.`,
    );
  }
  if (!["nearest", "one-to-one", "quantity-informed"].includes(options.assign ?? "one-to-one")) {
    throw new Error(
      `Part-identification assignment must be nearest, one-to-one, or quantity-informed; received ${JSON.stringify(options.assign)}.`,
    );
  }
  const useAssignment = options.assign !== "nearest";
  const chosen = new Map();

  if (useAssignment) {
    const held = options.held ?? new Map();
    const elements = distances.elementIds.map((elementId) => ({
      elementId,
      held: held.get(elementId) ?? 0,
    }));
    const drawings = match.clusters.map((cluster, row) => ({
      distanceTo: distances.rows[row],
      pieces: cluster.pieces,
      picked:
        source === "deterministic"
          ? null
          : visionPick(cluster, answers, options.names, options.cards).elementId,
    }));
    const result = assignDrawings(drawings, elements, {
      useQuantities: options.assign === "quantity-informed",
    });
    for (const [row, elementId] of result.entries()) {
      chosen.set(match.clusters[row].clusterIndex, elementId);
    }
  }

  const claims = new Map();
  for (const cluster of match.clusters) {
    const vision =
      source === "deterministic"
        ? null
        : visionPick(cluster, answers, options.names, options.cards);
    const nearest = cluster.candidates[0]?.elementId ?? null;
    const elementId = useAssignment
      ? (chosen.get(cluster.clusterIndex) ?? null)
      : (vision?.elementId ?? nearest);
    let picked = source === "deterministic" ? "geometry" : (vision?.picked ?? "unanswered");
    if (useAssignment && vision?.elementId) {
      picked = vision.elementId === elementId ? "vision-kept" : "vision-overruled";
    }
    for (const member of cluster.members) {
      claims.set(member, { elementId, clusterIndex: cluster.clusterIndex, picked });
    }
  }
  return claims;
}

/** Claimed against held, per element. */
export function conservation(callouts, claims, held) {
  const claimed = new Map();
  let unclaimedPieces = 0;
  for (const [index, claim] of claims) {
    const quantity = callouts[index].quantity;
    if (claim.elementId === null) {
      unclaimedPieces += quantity;
      continue;
    }
    claimed.set(claim.elementId, (claimed.get(claim.elementId) ?? 0) + quantity);
  }

  const perElement = [...held].map(([elementId, holds]) => ({
    elementId,
    held: holds,
    claimed: claimed.get(elementId) ?? 0,
  }));
  for (const [elementId, count] of claimed) {
    if (!held.has(elementId)) perElement.push({ elementId, held: 0, claimed: count });
  }

  const over = perElement.filter((row) => row.claimed > row.held);
  const under = perElement.filter((row) => row.claimed < row.held);
  return {
    elementsHeld: held.size,
    piecesHeld: [...held.values()].reduce((total, value) => total + value, 0),
    piecesClaimed: [...claimed.values()].reduce((total, value) => total + value, 0),
    piecesUnclaimed: unclaimedPieces,
    elementsExact: perElement.filter((row) => row.claimed === row.held).length,
    elementsNeverClaimed: perElement.filter((row) => row.claimed === 0 && row.held > 0).length,
    elementsClaimedButNotHeld: perElement.filter((row) => row.held === 0).length,
    piecesOverClaimed: over.reduce((total, row) => total + row.claimed - row.held, 0),
    piecesUnderClaimed: under.reduce((total, row) => total + row.held - row.claimed, 0),
    piecesReconciled: perElement.reduce((total, row) => total + Math.min(row.claimed, row.held), 0),
    worstOverClaims: [...over]
      .sort((left, right) => right.claimed - right.held - (left.claimed - left.held))
      .slice(0, 20),
    worstUnderClaims: [...under]
      .sort((left, right) => right.held - right.claimed - (left.held - left.claimed))
      .slice(0, 20),
    perElement: perElement.sort((left, right) => left.elementId.localeCompare(right.elementId)),
  };
}

/**
 * Does the free description the same call gave agree with the element it picked?
 *
 * This is the check that stops the vision call certifying itself. The call
 * answers twice about one picture — once in words, once by pointing at a
 * candidate — and the candidate's published name and colour code are not
 * something the call can see. Two answers that disagree are one answer nobody
 * should trust.
 */
const normalizeColourName = (value) =>
  typeof value === "string"
    ? value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\bgrey\b/gu, "gray")
        .replace(/[^a-z0-9]+/gu, " ")
        .trim()
        .replace(/\s+/gu, " ")
    : null;

const COLOUR_BY_LDRAW_CODE = new Map(
  COLOR_DEFINITIONS.map(({ ldrawCode, displayName }) => [
    ldrawCode,
    normalizeColourName(displayName),
  ]),
);

export function describesSameThing(answer, element) {
  if (
    typeof answer !== "object" ||
    answer === null ||
    typeof element !== "object" ||
    element === null ||
    typeof element.name !== "string" ||
    element.name.length === 0 ||
    typeof answer.kind !== "string" ||
    !Number.isInteger(answer.studsLong) ||
    !Number.isInteger(answer.studsWide)
  )
    return null;
  const plain = element.name.toLowerCase();
  const kind = String(answer.kind ?? "").toLowerCase();
  const kindWords = {
    brick: ["brick"],
    plate: ["plate"],
    tile: ["tile"],
    slope: ["slope", "sloped", "wedge", "cheese"],
    wedge: ["wedge", "slope", "sloped"],
    arch: ["arch", "bow"],
    round: ["round", "cylinder", "dish", "cone"],
    technic: ["technic", "pin", "axle"],
  }[kind];
  const kindAgrees =
    kindWords === undefined ? null : kindWords.some((word) => plain.includes(word));

  const long = answer.studsLong;
  const wide = answer.studsWide;
  const printed = [...plain.matchAll(/(\d+)\s*x\s*(\d+)/g)].map(([, a, b]) => [
    Number(a),
    Number(b),
  ]);
  const sizeAgrees =
    long > 0 && wide > 0 && printed.length > 0
      ? printed.some(([a, b]) => (a === long && b === wide) || (a === wide && b === long))
      : null;
  const colorCode =
    Number.isInteger(element.colorId) || /^\d+$/u.test(element.colorId ?? "")
      ? Number(element.colorId)
      : null;
  const expectedColour = colorCode === null ? null : (COLOUR_BY_LDRAW_CODE.get(colorCode) ?? null);
  const statedColour = normalizeColourName(answer.colour);
  const colourAgrees =
    expectedColour === null || statedColour === null || statedColour.length === 0
      ? null
      : expectedColour === statedColour;
  return { kindAgrees, sizeAgrees, colourAgrees };
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
  if (cards !== null) {
    const cardsRoot = join(OUT, "cards");
    const cardImagesPath = join(cardsRoot, ...cards.imagesFile.split("/"));
    if (!existsSync(cardImagesPath)) {
      throw new Error(
        `No retained card-image bundle at ${cardImagesPath}; regenerate cards before scoring adjudicated answers.`,
      );
    }
    assertCardImageFilesAndBundle(cardsRoot, readCardImageBundleFromRoot(cardsRoot, cards), cards);
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
        });
  if (source !== "deterministic" && answers === null) {
    throw new Error(
      `No vision answers at ${answersPath}; run "node scripts/part-identification.mjs ask --model ${model}" first, ` +
        `or score with --source deterministic.`,
    );
  }

  const held = inventoryHeld();
  const names = elementNames();
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names,
    cards: cards?.cards,
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

  const truthPath = join(OUT, "truth-first50.json");
  const accuracy = existsSync(truthPath)
    ? scoreAgainstTruth(readJson(truthPath), features, match, claims, names)
    : null;

  const picks = [...claims.values()];
  const score = {
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
            answered: match.clusters.filter(
              ({ clusterIndex }) => answers[clusterIndex] !== undefined,
            ).length,
            note: "Drawings with no answer fall back to geometry, so a partial pass moves the measured range and leaves the rest of the book as it was.",
          },
    conservation: table,
    descriptionAgreement: source === "deterministic" ? null : agreement,
    descriptionDisagreements: disagreements.slice(0, 30),
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
      accuracy ? `first-50 ${accuracy.correct}/${accuracy.calloutsJudged}` : "first-50 unlabelled",
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
  for (const [source, assignment, named] of configurations) {
    const model = named ?? models[0] ?? PART_IDENTIFICATION_MODEL_ID;
    const answersPath = join(OUT, `answers-${model}.json`);
    if (source === "adjudicated" && !existsSync(answersPath)) continue;
    const score = await commandScore(
      ["--source", source, "--assign", assignment, "--model", model, "--headline", "no"],
      helpers,
    );
    variants.push({
      source: score.source,
      assignment: score.assignment,
      model: score.model,
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
        correct: score.firstFiftyAccuracy.correct,
        accuracy: score.firstFiftyAccuracy.accuracy,
        piecesJudged: score.firstFiftyAccuracy.piecesJudged,
        piecesCorrect: score.firstFiftyAccuracy.piecesCorrect,
      },
      descriptionAgreement: score.descriptionAgreement,
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
  const features = readJson(join(OUT, "features.json"));
  writeJson(join(OUT, "score.json"), {
    what: "Naming the part a booklet step adds, by matching its printed callout drawing to the back-of-book parts list.",
    headline: {
      source: headlineName,
      assignment: headlineAssign,
      model: headlineModel,
      ...headline,
    },
    variants,
    inputs: {
      calloutDir: features.calloutDir,
      inventoryDir: features.inventoryDir,
      callouts: features.calloutCount,
      piecesCalledOut: features.piecesCalledOut,
      distinctDrawings: readJson(join(OUT, "match.json")).clusterCount,
      inventoryThumbnails: features.inventoryCount,
      inventoryElements: features.inventoryHeldCount,
      elementsWithoutThumbnail: features.elementsWithoutThumbnail,
      piecesWithoutThumbnail: features.piecesWithoutThumbnail,
    },
  });
  console.log(`wrote ${join(OUT, "score.json")} with ${variants.length} variants`);
}

function countBy(values) {
  const tally = {};
  for (const value of values) tally[value] = (tally[value] ?? 0) + 1;
  return tally;
}

/**
 * Accuracy on the first fifty steps.
 *
 * Truth here is a same-or-different judgement on a pair of drawings: the
 * callout the step printed, beside the back-of-book drawing of the element this
 * pipeline says it is. Both pictures are in the booklet, the element id under
 * the second one came out of the text layer, and every pair ships as a contact
 * sheet, so the judgement can be re-made by anyone without part names, part
 * numbers or this code.
 *
 * It is verification, not blind labelling: the pipeline proposes and the
 * judgement accepts or rejects. What it cannot catch is the case where the
 * pipeline and the judge are wrong the same way, so it is reported next to the
 * conservation total, which no judgement touches.
 *
 * A verdict names the element it was made about, so changing the claim
 * invalidates it rather than silently carrying over: a callout whose current
 * claim has no verdict is unscored and counted as such.
 */
function scoreAgainstTruth(truth, features, match, claims, names) {
  const verdicts = new Map(
    truth.verdicts.map((verdict) => [`${verdict.clusterIndex}:${verdict.elementId}`, verdict]),
  );
  const lastStep = truth.lastStep ?? 50;
  const rows = [];
  for (const [index, callout] of features.callouts.entries()) {
    if (callout.evidenceKind !== "part-art") continue;
    if (callout.stepNumber === null || callout.stepNumber > lastStep) continue;
    const claim = claims.get(index);
    const verdict = verdicts.get(`${claim?.clusterIndex}:${claim?.elementId}`) ?? null;
    rows.push({
      file: callout.file,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      clusterIndex: claim?.clusterIndex ?? null,
      claimedElement: claim?.elementId ?? null,
      claimedName: claim?.elementId ? (names.get(claim.elementId)?.name ?? null) : null,
      verdict: verdict === null ? "unjudged" : verdict.same === true ? "same" : "different",
    });
  }
  const judged = rows.filter(({ verdict }) => verdict !== "unjudged");
  const correct = judged.filter(({ verdict }) => verdict === "same");
  const drawings = new Set(judged.map(({ clusterIndex }) => clusterIndex));
  return {
    method: truth.method,
    labelSource: truth.note,
    lastStep,
    calloutsInRange: rows.length,
    calloutsJudged: judged.length,
    calloutsUnjudged: rows.length - judged.length,
    drawingsJudged: drawings.size,
    correct: correct.length,
    accuracy: judged.length === 0 ? 0 : correct.length / judged.length,
    piecesJudged: judged.reduce((total, row) => total + row.quantity, 0),
    piecesCorrect: correct.reduce((total, row) => total + row.quantity, 0),
    misses: judged.filter(({ verdict }) => verdict !== "same"),
    rows,
  };
}

/** Everything a scoring or sheet run needs, resolved once from the same options. */
