import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { claimsFor } from "./part-identification-score.mjs";
import {
  resolveElementPart,
  summarizeCatalogCoverage,
} from "../apps/web/src/assembly/element-catalog.ts";

/**
 * How much of the booklet's opening this catalog could place, if it were asked.
 *
 * Part identification answers a callout with an element id, and the published
 * parts list turns that into a design number. Neither is a thing the enumerator
 * can place. This walks the whole chain — callout, element, design number,
 * catalog part — and reports where it breaks, per step and per design.
 *
 * It is the measurement that has to come before any attempt to rebuild the set,
 * because a build cannot skip a step: the step after a missing part has nothing
 * to attach to. So the number that matters is not how many steps are covered
 * but how long the covered prefix is.
 *
 * Reads only what earlier passes already wrote; runs no model and no browser.
 */
const IDENTIFICATION = "output/part-identification";
const OUT = "output/real-build";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function requireJson(path, produce) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Produce it with: ${produce}`);
  }
  return readJson(path);
}

function option(argv, name, fallback) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 || at === argv.length - 1 ? fallback : argv[at + 1];
}

const argv = process.argv.slice(2);
const source = option(argv, "source", "adjudicated");
const model = option(argv, "model", "sonnet");
const assignment = option(argv, "assign", "one-to-one");
const lastStep = Number(option(argv, "last-step", "50"));
if (!Number.isInteger(lastStep) || lastStep < 1) {
  throw new Error(
    `--last-step must be a positive integer, received "${option(argv, "last-step", "50")}".`,
  );
}

const features = requireJson(
  join(IDENTIFICATION, "features.json"),
  "node scripts/part-identification.mjs features",
);
const match = requireJson(
  join(IDENTIFICATION, "match.json"),
  "node scripts/part-identification.mjs match",
);
const distances = requireJson(
  join(IDENTIFICATION, "distances.json"),
  "node scripts/part-identification.mjs match",
);
const elements = requireJson(
  join(IDENTIFICATION, "element-resolution.json"),
  "node scripts/part-identification.mjs resolve",
);
const answersPath = join(IDENTIFICATION, `answers-${model}.json`);
if (source !== "deterministic" && !existsSync(answersPath)) {
  throw new Error(
    `Source "${source}" needs vision answers at ${answersPath}. ` +
      `Produce them with: node scripts/part-identification.mjs ask --model ${model}. ` +
      `Or pass --source deterministic to score geometry alone, which is measurably worse on the first fifty steps.`,
  );
}
const answers = existsSync(answersPath) ? readJson(answersPath) : null;

const held = new Map(Object.entries(elements).map(([id, entry]) => [id, entry.quantity]));
const names = new Map(Object.entries(elements).map(([id, entry]) => [id, entry]));
const claims = claimsFor(match, distances, source, answers, { assign: assignment, held, names });

/**
 * Callout crops are named `p{page}-c{index}` where the index is the callout's
 * position in that page's list, so the file name is a stable join key between
 * identification (which keys by callout index) and any later pass that cuts the
 * pages again and may assign steps differently.
 */
const byCallout = {};
const requirements = [];
let unidentified = 0;

for (let index = 0; index < features.callouts.length; index += 1) {
  const callout = features.callouts[index];
  const claim = claims.get(index);
  const elementId = claim?.elementId ?? null;
  const element = elementId === null ? null : elements[elementId];
  if (element === null || element === undefined) {
    unidentified += 1;
    byCallout[callout.file] = {
      pageNumber: callout.pageNumber,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      elementId,
      resolution: null,
      unidentifiedBecause:
        elementId === null
          ? `Part identification made no claim for callout ${callout.file}; it is one of the ${features.callouts.length} crops the assignment left unmatched.`
          : `Part identification claimed element ${elementId} for callout ${callout.file}, but the published parts list resolves no design number for it.`,
    };
    continue;
  }
  const resolution = resolveElementPart({
    elementId,
    partNum: element.partNum,
    name: element.name,
    colorId: element.colorId,
  });
  byCallout[callout.file] = {
    pageNumber: callout.pageNumber,
    stepNumber: callout.stepNumber,
    quantity: callout.quantity,
    elementId,
    identificationConfidence: claim?.picked ?? null,
    resolution,
    unidentifiedBecause: null,
  };
  if (callout.stepNumber !== null && callout.stepNumber >= 1 && callout.stepNumber <= lastStep) {
    requirements.push({ stepNumber: callout.stepNumber, quantity: callout.quantity, resolution });
  }
}

const coverage = summarizeCatalogCoverage(requirements);
mkdirSync(OUT, { recursive: true });
const report = {
  what:
    "Whether the pinned catalog holds the parts the real booklet's opening steps place. " +
    "The covered prefix is the number that governs a rebuild: a step whose part is absent cannot be skipped, " +
    "because the step after it has nothing to attach to.",
  identification: { source, model: source === "deterministic" ? null : model, assignment },
  lastStep,
  calloutsConsidered: requirements.length,
  calloutsUnidentified: unidentified,
  coverage,
  byCallout,
};
writeFileSync(join(OUT, "catalog-coverage.json"), `${JSON.stringify(report, null, 1)}\n`);

console.log(
  [
    `steps covered ${coverage.stepsCovered}/${coverage.stepsTotal}`,
    `covered prefix ${coverage.coveredPrefixLength}`,
    `first covered step ${coverage.firstCoveredStep ?? "none"}`,
    `pieces placeable ${coverage.piecesPlaceable}/${coverage.piecesTotal}`,
    `designs missing ${coverage.missingDesigns.length}`,
  ].join(" | "),
);
for (const design of coverage.missingDesigns.slice(0, 12)) {
  console.log(
    `  ${design.partNum.padEnd(12)} ${String(design.pieces).padStart(3)} pieces  steps ${design.steps.join(",")}  ${design.name}`,
  );
}
