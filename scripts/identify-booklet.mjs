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
 * output/booklet/identify.json and prints what the text layer said, the
 * inventory reconciliation, the assignment, the residuals, accuracy on Steps
 * 1-50 against the tracked first-fifty truth, and runtime. Without the booklet
 * it prints "skipped (input absent)".
 *
 * Only the judged-callout line measures accuracy. The reconciliation is forced
 * by the capacity constraint, first-choice agreement compares two of the
 * module's own stages, the residual count moves with the weights, and callouts
 * that inherit a verdict through the module's own drawing key agree with it by
 * construction; each line says which it is.
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
  const byVerdict = new Map();
  for (const erratum of bindings.errata ?? []) {
    const verdict = verdicts.get(erratum.n);
    const row = bindings.labels.find((r) => r.n === erratum.n);
    if (!verdict || !row || verdict.elementId !== erratum.claimed) {
      throw new Error(
        `${TRUTH_LABELS} records an erratum for verdict ${erratum.n} claiming ${erratum.claimed}, but ${TRUTH} ${verdict ? `now says ${verdict.elementId}` : "has no such verdict"}; re-check the erratum against the current truth or delete it.`,
      );
    }
    errata.set(calloutIdOf(row), erratum);
    byVerdict.set(erratum.n, erratum);
  }
  return { errata, byVerdict };
}

/** Joins the label bindings to their verdicts, refusing a binding whose digest disagrees. */
function truthLabels() {
  const truth = JSON.parse(readFileSync(TRUTH, "utf8"));
  const bindings = JSON.parse(readFileSync(TRUTH_LABELS, "utf8"));
  const verdicts = new Map([...truth.verdicts, ...truth.unjudgeable].map((v) => [v.n, v]));
  return {
    lastStep: truth.lastStep,
    ...truthErrata(bindings, verdicts),
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
  const forced = s.forcedByCapacity;
  console.log(
    `booklet: ${pdfPath} ${result.source.sha256} (${result.source.pageCount} pages, pdf.js ${result.source.pdfjsVersion})`,
  );
  const t = result.text;
  const unpaired = t.unpairedElementIds.map((u) => `${u.elementId} (p${u.page})`);
  console.log(
    `text: inventory on pages ${t.inventoryPages.join(", ")}; ${unpaired.length} unpaired element ids${unpaired.length > 0 ? ` (${unpaired.slice(0, 10).join(", ")})` : ""}; callout labels at ${t.calloutLabelSizePt} pt; ${t.overprintsDropped} overprinted runs dropped; ${t.otherSizeCountLabels} labels at other sizes (sub-assembly multipliers); steps 1-${t.lastStep}: ${t.stepNumbers} found, missing [${t.missingSteps.join(", ")}], repeated [${t.repeatedSteps.join(", ")}]`,
  );
  console.log(
    `inventory: ${s.inventoryElements} elements, ${s.inventoryPieces} pieces, ${s.inventoryThumbnails}/${result.inventory.length} thumbnails found`,
  );
  console.log(
    `callouts: ${s.callouts} (${s.calloutPieces} pieces); in numbered steps ${s.stepCallouts} (${s.stepCalloutPieces} pieces); with a picture ${s.calloutsWithPicture}; distinct drawings ${s.drawings}`,
  );
  console.log(
    `forced by capacity, not evidence: ${forced.elementsExact}/${s.inventoryElements} elements exact; ${forced.calloutsAssigned}/${s.stepCallouts} step callouts assigned (${forced.piecesAssigned}/${s.stepCalloutPieces} pieces). The assignment never spends past an element's count, so these fill whichever elements the pictures are given.`,
  );
  for (const r of result.reconciliation.filter((r) => r.assigned !== r.inventory)) {
    console.log(`  element ${r.elementId}: inventory ${r.inventory}, assigned ${r.assigned}`);
  }
  const a = result.assignment;
  console.log(
    `assignment: ${a.provenOptimal ? "proven optimal" : "NOT proven optimal (node budget spent)"} after ${a.nodes} node${a.nodes === 1 ? "" : "s"}; cost ${a.cost}, lower bound ${a.lowerBound}`,
  );
  console.log(
    `first choice kept: ${s.firstChoiceKept}/${forced.calloutsAssigned} (${percent(s.firstChoiceKept, forced.calloutsAssigned)}); agreement between this module's matching and its assignment, not accuracy`,
  );
  const flagCounts = new Map();
  for (const residual of result.residuals)
    for (const flag of residual.flags) flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
  console.log(
    `residuals: ${s.residuals} callouts (${[...flagCounts].map(([f, n]) => `${f} ${n}`).join(", ")}); the count depends on the weights and thresholds, so compare it only between runs with equal parameters`,
  );

  const { lastStep, labels, errata, byVerdict } = truthLabels();
  const score = scoreAgainstTruth(result, labels, lastStep);
  const corrected = labels.map((row) =>
    byVerdict.has(row.n) ? { ...row, elementId: byVerdict.get(row.n).correct } : row,
  );
  const withErrata = scoreAgainstTruth(result, corrected, lastStep);
  console.log(
    `truth, steps 1-${lastStep} (${score.calloutsInRange} callouts, ${score.piecesInRange} pieces; ${score.verdictsBound}/${labels.length} verdict labels bound):`,
  );
  console.log(
    `  independent accuracy, judged callouts only: ${score.direct.correct}/${score.direct.callouts} (${percent(score.direct.correct, score.direct.callouts)}) as judged; ${withErrata.direct.correct}/${withErrata.direct.callouts} (${percent(withErrata.direct.correct, withErrata.direct.callouts)}) with the ${byVerdict.size} recorded truth errata applied`,
  );
  console.log(`  negative verdicts avoided: ${score.negative.avoided}/${score.negative.callouts}`);
  console.log(
    `  not independent: ${score.inherited.callouts} more callouts share a judged callout's drawing key, so they get its element by construction; ${score.inherited.correct}/${score.inherited.callouts} agree (${score.expanded.correct}/${score.expanded.callouts} callouts, ${score.expanded.piecesCorrect}/${score.expanded.pieces} pieces, counting both)`,
  );
  console.log(
    `  per step, judged and inherited labels together: ${score.steps.allLabelledCorrect}/${score.steps.withLabels} steps with labels have every label right; ${score.steps.fullyLabelledCorrect}/${score.steps.fullyLabelled} fully labelled steps entirely right (of ${score.steps.total})`,
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
  const ms = result.timingsMs;
  console.log(
    `runtime: text ${(ms.text / 1000).toFixed(1)}s, images ${(ms.images / 1000).toFixed(1)}s, match ${(ms.match / 1000).toFixed(1)}s, assign ${(ms.assign / 1000).toFixed(1)}s, total ${(ms.total / 1000).toFixed(1)}s`,
  );
  console.log(`wrote ${OUTPUT}`);
}

await main();
