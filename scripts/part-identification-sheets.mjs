import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { claimsFor, conservation } from "./part-identification-score.mjs";
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
  judgedPairs,
  truthVerdictKey,
  verdictsByCropDigest,
} from "./part-identification-truth-key.mjs";
import {
  MAX_IMAGE_ARTIFACT_BYTES,
  MAX_JSON_ARTIFACT_BYTES,
  readContainedFile,
  writeContainedFile,
} from "./part-identification-io.mjs";
import {
  assertBoundedCanvasDimensions,
  canvasApi,
  contactSheet,
  createPngDecodeBudget,
} from "./part-thumbnail-image.mjs";
import { verifyRetainedCardImageClosure } from "./part-identification-card-images.mjs";

/**
 * Pictures a person can check the run against.
 *
 * Two kinds. A pair sheet puts the step's own callout drawing beside the
 * back-of-book drawing of the element claimed for it, with nothing else on the
 * cell, because the only question it asks is whether they are the same part.
 * A failure sheet shows every drawing whose claim the printed inventory
 * contradicts, worst over-claim first, so the count has faces attached to it.
 */

const OUT = "output/part-identification";

function readJson(path) {
  return readJsonArtifact(path, `part-identification input ${path}`).value;
}

function writeJson(path, value) {
  writeContainedFile(dirname(path), basename(path), `${JSON.stringify(value, null, 1)}\n`, {
    label: "Part-identification sheet index",
    pathLabel: "Part-identification sheet index path",
    maxBytes: MAX_JSON_ARTIFACT_BYTES,
  });
}

function writeImage(root, relativePath, bytes) {
  writeContainedFile(root, relativePath, bytes, {
    label: "Part-identification sheet image",
    pathLabel: "Part-identification sheet image path",
    maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
  });
}

function loadRun(argv, { option, inventoryHeld, elementNames }) {
  const source = option(argv, "source", "deterministic");
  const assignment = option(argv, "assign", "one-to-one");
  const model = option(argv, "model", PART_IDENTIFICATION_MODEL_ID);
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
  if (source === "adjudicated") requirePinnedPartIdentificationModel(model);
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
  if (source !== "deterministic" && !existsSync(answersPath)) {
    throw new Error(
      `Source ${JSON.stringify(source)} requires content-bound vision answers at ${answersPath}; rerun the bounded ask command for the exact current match.`,
    );
  }
  const cardsPath = join(OUT, "cards", "manifest.json");
  if (source !== "deterministic" && !existsSync(cardsPath)) {
    throw new Error(
      `Source ${JSON.stringify(source)} requires a feature/match-bound cards manifest at ${cardsPath}; regenerate source-bound cards first.`,
    );
  }
  const cardsArtifact =
    source === "deterministic" ? null : readJsonArtifact(cardsPath, "part-identification cards");
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
        `Source ${JSON.stringify(source)} requires a retained card-image bundle at ${cardImagesPath}; regenerate cards first.`,
      );
    }
    verifyRetainedCardImageClosure(cardsRoot, cards);
  }
  const answers =
    source !== "deterministic" && existsSync(answersPath)
      ? boundAnswers(readJsonArtifact(answersPath, `vision answers for ${model}`), {
          model,
          matchDigest: artifacts.match.digest,
          cardsDigest: cardsArtifact.digest,
          promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
          clusters: match.clusters,
          cards: cards.cards,
        })
      : null;
  const { held } = inventoryHeld();
  const { names } = elementNames();
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names,
    cards: cards?.cards,
  });
  return { source, assignment, model, features, match, answers, held, names, claims };
}

/**
 * The pairs a person judges to establish first-fifty truth.
 *
 * Each cell is the step's own callout drawing beside the back-of-book drawing
 * of the element claimed for it. Nothing else is on the cell — no name, no
 * score, no candidate list — because the judgement is only "same part or not",
 * and anything else on the picture is an argument for one answer.
 */
export async function commandPairsheet(argv, helpers) {
  const { option } = helpers;
  const lastStepValue = option(argv, "last-step", "50");
  const lastStep = Number(lastStepValue);
  if (!Number.isInteger(lastStep) || lastStep < 1 || lastStep > 359) {
    throw new Error(
      `--last-step must be an integer from 1 through 359; received ${JSON.stringify(lastStepValue)}.`,
    );
  }
  const unjudgedOnly = option(argv, "unjudged-only", "no");
  if (unjudgedOnly !== "yes" && unjudgedOnly !== "no") {
    throw new Error(`--unjudged-only must be yes or no; received ${JSON.stringify(unjudgedOnly)}.`);
  }
  const { source, assignment, features, claims } = loadRun(argv, helpers);
  const dir = join(OUT, "pair-sheets");
  const pairDir = join(dir, "pairs");
  mkdirSync(pairDir, { recursive: true });

  const wanted = judgedPairs(features, claims, lastStep);
  // A verdict is keyed to the crop that was shown and the element it was
  // claimed to be, so re-judging a configuration means judging the pairs whose
  // picture or claim actually changed - and nothing else.
  const truthPath = join(OUT, "truth-first50.json");
  const judged = existsSync(truthPath)
    ? verdictsByCropDigest(readJson(truthPath)).bound
    : new Map();
  const pairs = [...wanted.values()]
    .filter(
      (pair) =>
        unjudgedOnly === "no" ||
        // A pair with no claimed element has a blank right-hand side, so it can
        // never carry a verdict and is always still to be looked at.
        pair.elementId === null ||
        !judged.has(truthVerdictKey(pair.leadSha256, pair.elementId)),
    )
    .sort(
      (left, right) => left.firstStep - right.firstStep || left.clusterIndex - right.clusterIndex,
    );
  const decodeBudget = createPngDecodeBudget("Part-identification pair sheets");

  for (const [at, pair] of pairs.entries()) {
    const png = await sideBySide(
      join(OUT, "tiles", "callout"),
      pair.lead,
      join(OUT, "tiles", "inventory"),
      pair.elementId === null ? null : `${pair.elementId}.png`,
      decodeBudget,
    );
    writeImage(pairDir, `pair-${String(at + 1).padStart(3, "0")}.png`, png);
  }

  const perSheet = 6;
  for (let page = 0; page * perSheet < pairs.length; page += 1) {
    const slice = pairs.slice(page * perSheet, page * perSheet + perSheet);
    const png = await contactSheet(
      slice.map((pair, at) => ({
        path: readContainedFile(
          pairDir,
          `pair-${String(page * perSheet + at + 1).padStart(3, "0")}.png`,
          {
            label: `Pair-sheet cell ${page * perSheet + at + 1}`,
            pathLabel: "Pair-sheet cell path",
            maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
          },
        ),
        lines: [
          `#${page * perSheet + at + 1}`,
          `step ${pair.firstStep} · ${pair.callouts} callouts`,
        ],
      })),
      {
        columns: 2,
        cellWidth: 980,
        cellHeight: 400,
        decodeBudget,
        title: `left = step callout, right = claimed element — sheet ${page + 1}`,
      },
    );
    writeImage(dir, `${source}-${assignment}-pairs-${page}.png`, png);
  }

  writeJson(join(dir, `index-${source}-${assignment}.json`), {
    note: "Judge each pair same/different. Numbering matches pairs-*.png.",
    source,
    assignment,
    lastStep,
    pairs: pairs.map((pair, at) => ({ n: at + 1, ...pair })),
  });
  console.log(
    `${pairs.length} pairs covering ` +
      `${pairs.reduce((total, { callouts }) => total + callouts, 0)} callouts, ` +
      `over ${Math.ceil(pairs.length / perSheet)} sheets in ${dir}`,
  );
}

/** One drawing beside another, scaled to the same height, for a same/different call. */
async function sideBySide(leftRoot, leftRelative, rightRoot, rightRelative, decodeBudget) {
  const sources = [
    [leftRoot, leftRelative, 0],
    [rightRoot, rightRelative, 478],
  ].flatMap(([root, relativePath, left]) => {
    if (relativePath === null) return [];
    const bytes = readContainedFile(root, relativePath, {
      label: `Pair-sheet image ${relativePath}`,
      pathLabel: "Pair-sheet image path",
      maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
    });
    return [
      {
        bytes,
        expected: decodeBudget.charge(bytes, `Pair-sheet image ${relativePath}`),
        left,
        relativePath,
      },
    ];
  });
  const { createCanvas, loadImage } = await canvasApi();
  const height = 340;
  const half = 470;
  const dimensions = assertBoundedCanvasDimensions(half * 2 + 8, height, "Pair-sheet canvas");
  const canvas = createCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#c8ccd0";
  context.fillRect(half, 0, 8, height);
  const place = async ({ bytes, expected, left, relativePath }) => {
    const image = await loadImage(bytes);
    if (image.width !== expected.width || image.height !== expected.height) {
      throw new Error(
        `Pair-sheet image ${relativePath} decoded as ${image.width} x ${image.height}, but its authenticated PNG IHDR declared ${expected.width} x ${expected.height}.`,
      );
    }
    const scale = Math.min((half - 16) / image.width, (height - 16) / image.height);
    context.drawImage(
      image,
      left + (half - image.width * scale) / 2,
      (height - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  };
  for (const source of sources) await place(source);
  return canvas.encode("png");
}

/** Contact sheets a person can look at: what was claimed, and where it broke. */
export async function commandSheets(argv, helpers) {
  const { source, assignment, features, match, held, names, claims } = loadRun(argv, helpers);
  const table = conservation(features.callouts, claims, held);
  const dir = join(OUT, "sheets");
  mkdirSync(dir, { recursive: true });
  const decodeBudget = createPngDecodeBudget("Part-identification evidence sheets");

  const overBy = new Map(table.perElement.map((row) => [row.elementId, row.claimed - row.held]));
  const calloutDir = join(OUT, "tiles", "callout");
  const cells = match.clusters.map((cluster) => {
    const claim = claims.get(cluster.members[0]);
    const elementId = claim?.elementId ?? null;
    const excess = elementId === null ? 0 : (overBy.get(elementId) ?? 0);
    return {
      path: readContainedFile(calloutDir, cluster.lead, {
        label: `Part-identification sheet callout ${cluster.lead}`,
        pathLabel: "Part-identification sheet callout path",
        maxBytes: MAX_IMAGE_ARTIFACT_BYTES,
      }),
      tint: elementId === null ? "#3a2020" : excess > 0 ? "#3a3320" : "#1d242b",
      excess,
      lines: [
        `${cluster.pieces} pcs / ${cluster.members.length} callouts`,
        elementId ?? "no pick",
        (names.get(elementId)?.name ?? "").slice(0, 40),
        elementId === null
          ? "unmatched"
          : `held ${held.get(elementId) ?? 0}${excess > 0 ? ` over +${excess}` : ""}`,
      ],
    };
  });

  const failing = cells
    .filter(({ excess, tint }) => excess > 0 || tint === "#3a2020")
    .sort((left, right) => right.excess - left.excess);
  const sheets = [
    ["failures", failing],
    ["all", cells],
  ];
  let written = 0;
  for (const [name, group] of sheets) {
    for (let page = 0; page * 36 < group.length; page += 1) {
      const png = await contactSheet(group.slice(page * 36, page * 36 + 36), {
        columns: 6,
        cellWidth: 320,
        cellHeight: 210,
        decodeBudget,
        title: `${name} — ${source} — page ${page + 1}`,
      });
      writeImage(dir, `${source}-${assignment}-${name}-${page}.png`, png);
      written += 1;
    }
  }
  console.log(
    `${written} sheets into ${dir}; ${failing.length} clusters over-claim or match nothing`,
  );
}
