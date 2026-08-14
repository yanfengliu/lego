import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BUILTIN_CATALOG } from "../packages/catalog/src/index.ts";
import { sha256Digest } from "./part-identification-artifacts.mjs";
import { readBoundedFile } from "./part-identification-io.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
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
const ACTION_LEDGER_PATH = "output/real-build/action-ledger.json";
const ACTION_LEDGER_MAXIMUM_BYTES = 16 * 1024 * 1024;
const MAXIMUM_FAILURE_CATEGORIES = 8;
const COMPILER_URL = new URL("../apps/web/e2e/real-build-action-ledger-compile.ts", import.meta.url)
  .href;

function boundedFailureCategories(failures) {
  const counts = new Map();
  for (const failure of failures) {
    const category = /^[a-z0-9-]{1,80}$/u.test(failure?.code)
      ? failure.code
      : "invalid-failure-code";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const categories = [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  const shown = categories
    .slice(0, MAXIMUM_FAILURE_CATEGORIES)
    .map(([category, count]) => `${category}=${count}`)
    .join(", ");
  const omitted = categories.length - MAXIMUM_FAILURE_CATEGORIES;
  return `${shown}${omitted > 0 ? `, ${omitted} more categories omitted` : ""}`;
}

/** Pure fail-closed verdict over the canonical compilation and the one retained byte sequence. */
export function panelPlacementLedgerVerificationFailure(retainedBytes, compiled) {
  if (compiled.validationFailures.length > 0) {
    return (
      `canonical validation rejected ${compiled.validationFailures.length} failure(s) through assembled step ` +
      `${compiled.validatedThroughStep}; bounded categories: ` +
      `${boundedFailureCategories(compiled.validationFailures)}`
    );
  }
  if (!Buffer.from(retainedBytes).equals(Buffer.from(compiled.encoded))) {
    return (
      `retained bytes digest ${sha256Digest(retainedBytes)} does not equal canonical compiled digest ` +
      `${sha256Digest(compiled.encoded)}`
    );
  }
  return null;
}

async function compileCanonicalActionLedger() {
  const module = await importRepositoryTypeScript(COMPILER_URL);
  return module.compileRealBuildActionLedger();
}

/** Returns only the in-memory ledger whose complete source closure and retained bytes were verified. */
export async function readVerifiedPanelPlacementLedger({
  ledgerPath = ACTION_LEDGER_PATH,
  readRetainedBytes = (path) =>
    readBoundedFile(path, {
      label: "Panel-placement action ledger",
      maxBytes: ACTION_LEDGER_MAXIMUM_BYTES,
    }),
  compile = compileCanonicalActionLedger,
} = {}) {
  const retainedBytes = readRetainedBytes(ledgerPath);
  let compiled;
  try {
    compiled = await compile();
  } catch {
    throw new TypeError(
      "Panel placement refused the action ledger because canonical source-closure compilation failed. " +
        "Repair the bounded real-build inputs and run the action-ledger publisher; no output or model call started.",
    );
  }
  const failure = panelPlacementLedgerVerificationFailure(retainedBytes, compiled);
  if (failure !== null) {
    throw new TypeError(
      `Panel placement refused the action ledger: ${failure}. Republish the exact validated ledger; ` +
        `no output or model call started.`,
    );
  }
  return { ledger: compiled.emitted, digest: sha256Digest(retainedBytes) };
}

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

/** Resolve every requested ledger brief before any output directory or paid job exists. */
export function panelPlacementBriefs(ledger, steps) {
  const seen = new Set();
  return steps.map((stepNumber, index) => {
    if (
      !Number.isSafeInteger(stepNumber) ||
      stepNumber < 1 ||
      stepNumber > 359 ||
      seen.has(stepNumber)
    ) {
      throw new RangeError(
        `Panel-placement requested step at index ${index} must be one unique integer from 1 through 359.`,
      );
    }
    seen.add(stepNumber);
    return {
      stepNumber,
      pieces: piecesAt(ledger, stepNumber),
      built: builtBefore(ledger, stepNumber),
    };
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const steps = (option(argv, "steps", "6") ?? "6").split(",").map((value) => Number(value.trim()));
  const panelRoot = option(argv, "panels", "output/zzz-vision");
  const out = option(argv, "out", "output/panel-placement");
  const { ledger, digest: ledgerDigest } = await readVerifiedPanelPlacementLedger();
  const briefs = panelPlacementBriefs(ledger, steps);
  mkdirSync(out, { recursive: true });

  const summary = [];
  const jobs = briefs.map(async ({ stepNumber, pieces, built }) => {
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
    `${JSON.stringify({ promptDigest: PANEL_PLACEMENT_PROMPT_DIGEST, ledgerDigest, readings: summary }, null, 1)}\n`,
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
