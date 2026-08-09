import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BUILTIN_CATALOG } from "../packages/catalog/src/index.ts";
import { readPanel, writeReading } from "./panel-placement-ask.mjs";
import { PANEL_PLACEMENT_PROMPT_DIGEST } from "./panel-placement-prompt.mjs";

/**
 * Drives the panel-placement vision pass over a range of printed steps.
 *
 * The piece list handed to the model is the action ledger's, not the model's own
 * reading of the parts box: identification is a settled upstream question and
 * asking it again would spend the call on something already known. What is left
 * is the one thing the ledger does not carry — where each piece goes.
 *
 *   node scripts/panel-placement-run.mjs --steps 4,5,6 --panels output/zzz-vision
 */

const PART_BY_ID = new Map(BUILTIN_CATALOG.parts.map((part) => [part.id, part]));
const COLOUR_BY_ID = new Map(BUILTIN_CATALOG.colors.map((colour) => [colour.id, colour]));

function option(argv, name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
}

/** Stud footprint from the part's own bounds, so the brief cannot drift from the catalog. */
export function studFootprint(catalogPartId) {
  const definition = PART_BY_ID.get(catalogPartId);
  if (definition === undefined) throw new Error(`Catalog has no part ${catalogPartId}.`);
  const { min, max } = definition.boundsLdu;
  const wide = Math.round((max[0] - min[0]) / 20);
  const long = Math.round((max[2] - min[2]) / 20);
  return {
    studsLong: Math.max(long, wide),
    studsWide: Math.min(long, wide),
    family: definition.family,
  };
}

export function colourName(colorId) {
  const colour = COLOUR_BY_ID.get(colorId);
  if (colour === undefined) throw new Error(`Catalog has no colour ${colorId}.`);
  return colour.displayName;
}

export function describePiece(id, catalogPartId, colorId) {
  const { studsLong, studsWide, family } = studFootprint(catalogPartId);
  return {
    id,
    catalogPartId,
    colorId,
    colour: colourName(colorId),
    studsLong,
    studsWide,
    shape: family,
  };
}

/** Every piece the ledger places strictly before this printed step. */
export function builtBefore(ledger, stepNumber) {
  const built = [];
  for (const step of ledger.steps) {
    if (step.stepNumber >= stepNumber) continue;
    for (const piece of step.action.pieces ?? []) {
      built.push(describePiece(`S${step.stepNumber}`, piece.catalogPartId, piece.colorId));
    }
  }
  return built;
}

export function piecesAt(ledger, stepNumber) {
  const step = ledger.steps.find((entry) => entry.stepNumber === stepNumber);
  if (step === undefined) throw new Error(`Action ledger has no printed step ${stepNumber}.`);
  return (step.action.pieces ?? []).map((piece, index) =>
    describePiece(`P${index + 1}`, piece.catalogPartId, piece.colorId),
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const steps = (option(argv, "steps", "6") ?? "6").split(",").map((value) => Number(value.trim()));
  const panelRoot = option(argv, "panels", "output/zzz-vision");
  const out = option(argv, "out", "output/panel-placement");
  const ledger = JSON.parse(readFileSync("output/real-build/action-ledger.json", "utf8"));
  mkdirSync(out, { recursive: true });

  const summary = [];
  const jobs = steps.map(async (stepNumber) => {
    const pieces = piecesAt(ledger, stepNumber);
    const built = builtBefore(ledger, stepNumber);
    const panelImagePath = join(
      panelRoot,
      `${option(argv, "prefix", "panel")}-${String(stepNumber).padStart(3, "0")}.png`,
    );
    const reading = await readPanel({ stepNumber, panelImagePath, pieces, built });
    reading.pieces = pieces;
    const path = writeReading(out, reading);
    summary.push({
      stepNumber,
      elapsedMs: reading.elapsedMs,
      usdCost: reading.usdCost,
      pieces: pieces.length,
      answered: reading.reading.pieces.length,
      rejected: reading.reading.rejected.length,
      viewpoint: reading.reading.panel?.viewpoint ?? null,
      path,
    });
  });
  const settled = await Promise.allSettled(jobs);
  for (const entry of settled) {
    if (entry.status === "rejected")
      console.error(`FAILED: ${entry.reason?.message ?? entry.reason}`);
  }
  summary.sort((left, right) => left.stepNumber - right.stepNumber);
  writeFileSync(
    join(out, "run-summary.json"),
    `${JSON.stringify({ promptDigest: PANEL_PLACEMENT_PROMPT_DIGEST, readings: summary }, null, 1)}\n`,
  );
  for (const entry of summary) {
    console.log(
      `step ${entry.stepNumber}: ${entry.answered}/${entry.pieces} pieces, viewpoint ${entry.viewpoint}, ` +
        `${entry.rejected} rejected lines, ${(entry.elapsedMs / 1000).toFixed(1)}s, ` +
        `${entry.usdCost === null ? "cost unknown" : `$${entry.usdCost.toFixed(4)}`}`,
    );
  }
  if (settled.some((entry) => entry.status === "rejected")) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("panel-placement-run.mjs")) await main();
