import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { claimsFor, conservation } from "./part-identification-score.mjs";
import { canvasApi, contactSheet } from "./part-thumbnail-image.mjs";

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
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(
    path,
    `${JSON.stringify(value, null, 1)}
`,
  );
}

function loadRun(argv, { option, inventoryHeld, elementNames }) {
  const source = option(argv, "source", "deterministic");
  const assignment = option(argv, "assign", "one-to-one");
  const model = option(argv, "model", "sonnet");
  const features = readJson(join(OUT, "features.json"));
  const match = readJson(join(OUT, "match.json"));
  const distances = readJson(join(OUT, "distances.json"));
  const answersPath = join(OUT, `answers-${model}.json`);
  const answers = existsSync(answersPath) ? readJson(answersPath) : null;
  const held = inventoryHeld();
  const claims = claimsFor(match, distances, source, answers, {
    assign: assignment,
    held,
    names: elementNames(),
  });
  return { source, assignment, model, features, match, answers, held, claims };
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
  const lastStep = Number(option(argv, "last-step", "50"));
  const { source, assignment, features, claims } = loadRun(argv, helpers);
  const dir = join(OUT, "pair-sheets");
  const pairDir = join(dir, "pairs");
  mkdirSync(pairDir, { recursive: true });

  const wanted = new Map();
  for (const [index, callout] of features.callouts.entries()) {
    if (callout.stepNumber === null || callout.stepNumber > lastStep) continue;
    const claim = claims.get(index);
    if (!claim) continue;
    const key = `${claim.clusterIndex}:${claim.elementId}`;
    const entry = wanted.get(key) ?? {
      clusterIndex: claim.clusterIndex,
      elementId: claim.elementId,
      lead: callout.file,
      firstStep: callout.stepNumber,
      callouts: 0,
      pieces: 0,
    };
    entry.callouts += 1;
    entry.pieces += callout.quantity;
    entry.firstStep = Math.min(entry.firstStep, callout.stepNumber);
    wanted.set(key, entry);
  }
  // A verdict is keyed to the element it was made about, so re-judging a
  // configuration only means judging the pairs that changed.
  const truthPath = join(OUT, "truth-first50.json");
  const judged = existsSync(truthPath)
    ? new Set(
        readJson(truthPath).verdicts.map(
          (verdict) => `${verdict.clusterIndex}:${verdict.elementId}`,
        ),
      )
    : new Set();
  const pairs = [...wanted.values()]
    .filter(
      (pair) =>
        option(argv, "unjudged-only", "no") === "no" ||
        !judged.has(`${pair.clusterIndex}:${pair.elementId}`),
    )
    .sort(
      (left, right) => left.firstStep - right.firstStep || left.clusterIndex - right.clusterIndex,
    );

  for (const [at, pair] of pairs.entries()) {
    const png = await sideBySide(
      join(OUT, "tiles", "callout", pair.lead),
      pair.elementId === null ? null : join(OUT, "tiles", "inventory", `${pair.elementId}.png`),
    );
    writeFileSync(join(pairDir, `pair-${String(at + 1).padStart(3, "0")}.png`), png);
  }

  const perSheet = 6;
  for (let page = 0; page * perSheet < pairs.length; page += 1) {
    const slice = pairs.slice(page * perSheet, page * perSheet + perSheet);
    const png = await contactSheet(
      slice.map((pair, at) => ({
        path: join(pairDir, `pair-${String(page * perSheet + at + 1).padStart(3, "0")}.png`),
        lines: [
          `#${page * perSheet + at + 1}`,
          `step ${pair.firstStep} · ${pair.callouts} callouts`,
        ],
      })),
      {
        columns: 2,
        cellWidth: 980,
        cellHeight: 400,
        title: `left = step callout, right = claimed element — sheet ${page + 1}`,
      },
    );
    writeFileSync(join(dir, `${source}-${assignment}-pairs-${page}.png`), png);
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
async function sideBySide(leftPath, rightPath) {
  const { createCanvas, loadImage } = await canvasApi();
  const height = 340;
  const half = 470;
  const canvas = createCanvas(half * 2 + 8, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#c8ccd0";
  context.fillRect(half, 0, 8, height);
  const place = async (path, left) => {
    if (path === null || !existsSync(path)) return;
    const image = await loadImage(path);
    const scale = Math.min((half - 16) / image.width, (height - 16) / image.height);
    context.drawImage(
      image,
      left + (half - image.width * scale) / 2,
      (height - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  };
  await place(leftPath, 0);
  await place(rightPath, half + 8);
  return canvas.encode("png");
}

/** Contact sheets a person can look at: what was claimed, and where it broke. */
export async function commandSheets(argv, helpers) {
  const { elementNames } = helpers;
  const { source, assignment, features, match, held, claims } = loadRun(argv, helpers);
  const names = elementNames();
  const table = conservation(features.callouts, claims, held);
  const dir = join(OUT, "sheets");
  mkdirSync(dir, { recursive: true });

  const overBy = new Map(table.perElement.map((row) => [row.elementId, row.claimed - row.held]));
  const calloutDir = join(OUT, "tiles", "callout");
  const cells = match.clusters.map((cluster) => {
    const claim = claims.get(cluster.members[0]);
    const elementId = claim?.elementId ?? null;
    const excess = elementId === null ? 0 : (overBy.get(elementId) ?? 0);
    return {
      path: join(calloutDir, cluster.lead),
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
        title: `${name} — ${source} — page ${page + 1}`,
      });
      writeFileSync(join(dir, `${source}-${assignment}-${name}-${page}.png`), png);
      written += 1;
    }
  }
  console.log(
    `${written} sheets into ${dir}; ${failing.length} clusters over-claim or match nothing`,
  );
}
