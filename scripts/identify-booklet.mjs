import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

/**
 * Identifies every part callout in the booklet and scores the result.
 *
 *   node scripts/identify-booklet.mjs
 *   LEGO_BOOKLET_PDF=path/to/booklet.pdf node scripts/identify-booklet.mjs
 *
 * The booklet defaults to recipes/6651557.pdf, found by climbing from this
 * checkout (a worktree has no recipes/ of its own). Writes the ignored
 * output/booklet/identify.json and prints: accuracy on Steps 1-50 against the
 * tracked first-fifty truth, the inventory reconciliation, first-choice
 * agreement, and runtime. Without the booklet it prints "skipped (input absent)".
 */
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(repositoryRoot, "output/booklet/identify.json");
const TRUTH = resolve(repositoryRoot, "scripts/fixtures/part-identification-truth-first50.json");
const TRUTH_LABELS = resolve(
  repositoryRoot,
  "scripts/fixtures/part-identification-truth-first50-labels.json",
);
const OLD_ROUTE = "output/part-identification/prefix50-semantic-closure.json";
const moduleUrl = (path) => new URL(`../apps/web/src/instructions/${path}`, import.meta.url).href;

function percent(part, whole) {
  return whole === 0 ? "n/a" : `${((100 * part) / whole).toFixed(1)}%`;
}

/** Walks up from the checkout for an ignored artifact another checkout may hold. */
function findUp(relative) {
  let directory = repositoryRoot;
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = resolve(directory, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
  return null;
}

/** The label row's callout id, as identification formats it. */
function calloutIdOf(row) {
  return `p${row.page}|q${row.quantity}|x${row.xPt.toFixed(3)}|y${row.yPt.toFixed(3)}`;
}

/**
 * Errata are verdicts the tracked truth gets wrong, kept beside the bindings with
 * their evidence. The truth file stays as judged; a miss an erratum explains is
 * still counted as a miss, and printed with the erratum beside it.
 */
function truthErrata(bindings, verdicts) {
  const errata = new Map();
  for (const erratum of bindings.errata ?? []) {
    const verdict = verdicts.get(erratum.n);
    const row = bindings.labels.find((r) => r.n === erratum.n);
    if (!verdict || !row || verdict.elementId !== erratum.claimed) {
      throw new Error(
        `${TRUTH_LABELS} records an erratum for verdict ${erratum.n} claiming ${erratum.claimed}, but ${TRUTH} ${verdict ? `now says ${verdict.elementId}` : "has no such verdict"}; re-check the erratum against the current truth or delete it.`,
      );
    }
    errata.set(calloutIdOf(row), erratum);
  }
  return errata;
}

/** Joins the label bindings to their verdicts, refusing a binding whose digest disagrees. */
function truthLabels() {
  const truth = JSON.parse(readFileSync(TRUTH, "utf8"));
  const bindings = JSON.parse(readFileSync(TRUTH_LABELS, "utf8"));
  const verdicts = new Map([...truth.verdicts, ...truth.unjudgeable].map((v) => [v.n, v]));
  return {
    lastStep: truth.lastStep,
    errata: truthErrata(bindings, verdicts),
    labels: bindings.labels.map((row) => {
      const verdict = verdicts.get(row.n);
      if (!verdict || verdict.judgedCropSha256 !== row.judgedCropSha256) {
        throw new Error(
          `${TRUTH_LABELS} binds verdict ${row.n} to crop ${row.judgedCropSha256}, but ${TRUTH} ${verdict ? `judged ${verdict.judgedCropSha256}` : "has no such verdict"}; regenerate the bindings from the judged crops.`,
        );
      }
      return {
        n: row.n,
        page: row.page,
        quantity: row.quantity,
        xPt: row.xPt,
        yPt: row.yPt,
        elementId: verdict.elementId ?? null,
        same: typeof verdict.same === "boolean" ? verdict.same : null,
      };
    }),
  };
}

function oldRouteAgreement(result, lastStep) {
  const path = findUp(OLD_ROUTE);
  if (path === null) return null;
  const closure = JSON.parse(readFileSync(path, "utf8"));
  const reference = new Map(
    (closure.semanticIdentity ?? []).map((row) => [row.identity, row.elementId]),
  );
  const inRange = result.callouts.filter((c) => c.step !== null && c.step <= lastStep);
  const compared = inRange.filter((c) => reference.has(c.id));
  const agree = compared.filter((c) => c.elementId === reference.get(c.id));
  return {
    path,
    rows: reference.size,
    compared: compared.length,
    agree: agree.length,
    differ: compared.filter((c) => c.elementId !== reference.get(c.id)),
  };
}

async function main() {
  const { findSampleBooklet } = await importRepositoryTypeScript(
    moduleUrl("sample-booklet-path.ts"),
  );
  const pdfPath = process.env.LEGO_BOOKLET_PDF || findSampleBooklet(repositoryRoot);
  if (!pdfPath || !existsSync(pdfPath)) {
    console.log(
      `identify-booklet: skipped (input absent): ${pdfPath ? `no file at ${pdfPath}` : "recipes/6651557.pdf not found above this checkout"}; set LEGO_BOOKLET_PDF to the booklet.`,
    );
    return;
  }
  const { identifyBooklet, scoreAgainstTruth } = await importRepositoryTypeScript(
    moduleUrl("identify/index.ts"),
  );
  const bytes = new Uint8Array(readFileSync(pdfPath));
  let lastStage = "";
  const result = await identifyBooklet(bytes, {
    onProgress: (stage, done, total) => {
      if (stage !== lastStage || done === total)
        process.stderr.write(`\r${stage} ${done}/${total}${done === total ? "\n" : ""}`);
      lastStage = stage;
    },
  });
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 1)}\n`);

  const s = result.summary;
  console.log(
    `booklet: ${pdfPath} ${result.source.sha256} (${result.source.pageCount} pages, pdf.js ${result.source.pdfjsVersion})`,
  );
  console.log(
    `inventory: ${s.inventoryElements} elements, ${s.inventoryPieces} pieces, ${s.inventoryThumbnails}/${result.inventory.length} thumbnails found`,
  );
  console.log(
    `callouts: ${s.callouts} (${s.calloutPieces} pieces); in numbered steps ${s.stepCallouts} (${s.stepCalloutPieces} pieces); with a picture ${s.calloutsWithPicture}; distinct drawings ${s.drawings}`,
  );
  console.log(
    `reconciliation: ${s.elementsExact}/${s.inventoryElements} elements exact; ${s.calloutsAssigned}/${s.stepCallouts} step callouts assigned (${s.piecesAssigned}/${s.stepCalloutPieces} pieces)`,
  );
  for (const r of result.reconciliation.filter((r) => r.assigned !== r.inventory)) {
    console.log(`  element ${r.elementId}: inventory ${r.inventory}, assigned ${r.assigned}`);
  }
  console.log(
    `first choice kept: ${s.firstChoiceKept}/${s.calloutsAssigned} (${percent(s.firstChoiceKept, s.calloutsAssigned)})`,
  );
  const flagCounts = new Map();
  for (const residual of result.residuals)
    for (const flag of residual.flags) flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
  console.log(
    `residuals: ${s.residuals} callouts (${[...flagCounts].map(([f, n]) => `${f} ${n}`).join(", ")})`,
  );

  const { lastStep, labels, errata } = truthLabels();
  const score = scoreAgainstTruth(result, labels, lastStep);
  console.log(
    `truth, steps 1-${lastStep} (${score.calloutsInRange} callouts, ${score.piecesInRange} pieces; ${score.verdictsBound}/${labels.length} verdict labels bound):`,
  );
  console.log(
    `  judged callouts: ${score.direct.correct}/${score.direct.callouts} correct (${percent(score.direct.correct, score.direct.callouts)}); negative verdicts avoided ${score.negative.avoided}/${score.negative.callouts}`,
  );
  console.log(
    `  with identical drawings: ${score.expanded.correct}/${score.expanded.callouts} callouts correct (${percent(score.expanded.correct, score.expanded.callouts)}), ${score.expanded.piecesCorrect}/${score.expanded.pieces} pieces`,
  );
  console.log(
    `  per step: ${score.steps.allLabelledCorrect}/${score.steps.withLabels} steps with labels have every label right; ${score.steps.fullyLabelledCorrect}/${score.steps.fullyLabelled} fully labelled steps entirely right (of ${score.steps.total})`,
  );
  let explained = 0;
  for (const miss of score.misses) {
    const erratum = errata.get(miss.calloutId);
    const explains = erratum !== undefined && erratum.correct === miss.got;
    if (explains) explained += 1;
    console.log(
      `  miss ${miss.calloutId} step ${miss.step}: truth ${miss.truth}, got ${miss.got}${miss.inherited ? " (inherited label)" : ""}${explains ? ` (truth erratum, verdict ${erratum.n}: ${erratum.reason})` : ""}`,
    );
  }
  if (score.misses.length > 0)
    console.log(`  misses a recorded truth erratum explains: ${explained}/${score.misses.length}`);
  const old = oldRouteAgreement(result, lastStep);
  if (old) {
    console.log(
      `old vision route (${old.rows} rows, ${OLD_ROUTE}): agrees on ${old.agree}/${old.compared} callouts (${percent(old.agree, old.compared)})`,
    );
  }
  const t = result.timingsMs;
  console.log(
    `runtime: text ${(t.text / 1000).toFixed(1)}s, images ${(t.images / 1000).toFixed(1)}s, match ${(t.match / 1000).toFixed(1)}s, assign ${(t.assign / 1000).toFixed(1)}s, total ${(t.total / 1000).toFixed(1)}s`,
  );
  console.log(`wrote ${OUTPUT}`);
}

await main();
