import { assignDrawings, type Demand } from "./assign";
import { timeBudget, UNLIMITED, type Budget } from "./budget";
import { collectBooklet, type Collected, type Progress } from "./collect";
import { roundRect } from "./geometry";
import { IDENTIFY_LIMITS } from "./limits";
import { featuresOf, rankReferences, type Reference } from "./match";
import { assertPdfBytes, loadPdfjs, openPdf, sha256Digest, type PdfjsLike } from "./pdf-scan";
import { report, textCounts } from "./report";
import {
  IDENTIFY_SCHEMA_VERSION,
  type CalloutFlag,
  type CalloutIdentification,
  type Candidate,
  type IdentifyParameters,
  type IdentifyResult,
  type InventoryElement,
} from "./types";

/**
 * Closed-set identification of every part callout in a LEGO instruction booklet.
 *
 * The inventory printed at the back is the closed set: each element's id and
 * count are text, and its thumbnail is the reference picture. Every callout
 * picture is scored against every thumbnail at the booklet's fixed callout scale,
 * and an exact search assigns each drawing wholly to one element with the
 * inventory counts as capacities, so the per-element totals reconcile. What the
 * pictures and the counts cannot settle is flagged and listed, not guessed at.
 */
export const DEFAULT_PARAMETERS: IdentifyParameters = Object.freeze({
  calloutScale: 1.334,
  gridPxPerPt: 3,
  backgroundTolerance: 14,
  alignSearchPx: 3,
  appearanceWeight: 0.5,
  colourWeight: 1 / 60,
  candidatesPerDrawing: 8,
  lowMargin: 0.05,
  lowIou: 0.75,
});

export interface IdentifyOptions extends Partial<IdentifyParameters> {
  /** A pdf.js module; the legacy build from node_modules is loaded when omitted. */
  readonly pdfjs?: PdfjsLike;
  readonly onProgress?: Progress;
  readonly now?: () => number;
  /** The whole run's time limit; `IDENTIFY_LIMITS.timeLimitMs` when omitted. */
  readonly timeLimitMs?: number;
  /** Flow problems the exact assignment may solve before settling; see `assign.ts`. */
  readonly maxAssignmentNodes?: number;
}

function calloutId(page: number, count: number, x: number, y: number): string {
  return `p${page}|q${count}|x${x.toFixed(3)}|y${y.toFixed(3)}`;
}

export async function identifyBooklet(
  pdfBytes: Uint8Array,
  options: IdentifyOptions = {},
): Promise<IdentifyResult> {
  // Bytes are checked before anything hashes or parses them.
  assertPdfBytes(pdfBytes);
  const params: IdentifyParameters = { ...DEFAULT_PARAMETERS, ...definedParameters(options) };
  validateParameters(params);
  const timeLimitMs = options.timeLimitMs ?? IDENTIFY_LIMITS.timeLimitMs;
  if (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    throw new Error(
      `identifyBooklet option timeLimitMs is ${timeLimitMs}; it must be a positive number of milliseconds.`,
    );
  }
  if (options.maxAssignmentNodes !== undefined)
    wholeNumberIn("maxAssignmentNodes", options.maxAssignmentNodes, 1, 100_000);
  const now = options.now ?? (() => performance.now());
  const started = now();
  const budget = timeBudget(timeLimitMs, now);
  const pdfjs = options.pdfjs ?? (await loadPdfjs());
  const sha256 = await sha256Digest(pdfBytes);
  const document = await openPdf(pdfjs, pdfBytes);
  let collected: Collected;
  try {
    collected = await collectBooklet(pdfjs, document, params, options.onProgress, now, budget);
  } finally {
    await document.destroy();
  }
  const matchStarted = now();
  const { matchMs, ...result } = identifyCollected(collected, params, {
    now,
    budget,
    maxAssignmentNodes: options.maxAssignmentNodes,
  });
  const finished = now();
  return {
    schemaVersion: IDENTIFY_SCHEMA_VERSION,
    source: {
      sha256,
      byteLength: pdfBytes.byteLength,
      pageCount: collected.pageCount,
      pdfjsVersion: pdfjs.version,
    },
    parameters: params,
    ...result,
    timingsMs: {
      ...collected.timingsMs,
      match: Math.round(matchMs),
      assign: Math.round(finished - matchStarted - matchMs),
      total: Math.round(finished - started),
    },
  };
}

function definedParameters(options: IdentifyOptions): Partial<IdentifyParameters> {
  const keys = Object.keys(DEFAULT_PARAMETERS) as (keyof IdentifyParameters)[];
  return Object.fromEntries(
    keys.filter((key) => options[key] !== undefined).map((key) => [key, options[key]]),
  );
}

function validateParameters(params: IdentifyParameters): void {
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(
        `identifyBooklet option ${key} is ${String(value)}; it must be a finite non-negative number.`,
      );
    }
  }
  if (params.calloutScale <= 0 || params.gridPxPerPt <= 0 || params.gridPxPerPt > 8) {
    throw new Error(
      `identifyBooklet needs calloutScale > 0 and 0 < gridPxPerPt <= 8; received ${params.calloutScale} and ${params.gridPxPerPt}.`,
    );
  }
  wholeNumberIn("candidatesPerDrawing", params.candidatesPerDrawing, 1, 64);
  wholeNumberIn("alignSearchPx", params.alignSearchPx, 0, 16);
}

/** Bounds the options that set how much work a run does. */
function wholeNumberIn(key: string, value: number, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(
      `identifyBooklet option ${key} is ${value}; it must be a whole number from ${min} to ${max}.`,
    );
  }
}

type Identified = Omit<IdentifyResult, "schemaVersion" | "source" | "parameters" | "timingsMs"> & {
  matchMs: number;
};

export interface CollectedOptions {
  readonly now?: () => number;
  readonly budget?: Budget;
  readonly maxAssignmentNodes?: number | undefined;
}

/**
 * A composite picture is its own drawing. Two callouts under one composite key
 * would share one demand and the first one's picture, so the second would get
 * the first's element with no flag; that is refused.
 */
function assertCompositesUnshared(collected: Collected): void {
  const owner = new Map<string, string>();
  for (const { label, picture } of collected.callouts) {
    const key = picture?.drawing;
    if (!key?.startsWith("composite:")) continue;
    const id = calloutId(label.page, label.count, label.xPt, label.yPt);
    const first = owner.get(key);
    if (first !== undefined) {
      throw new Error(
        `Callouts ${first} and ${id} share the composite drawing key ${JSON.stringify(key)}. A composite picture belongs to one callout, so its key must name that callout's page and label position: a defect in apps/web/src/instructions/identify/pictures.ts, not in the booklet.`,
      );
    }
    owner.set(key, id);
  }
}

/** Matching, assignment and reporting over already-collected pictures; pure. */
export function identifyCollected(
  collected: Collected,
  params: IdentifyParameters,
  options: CollectedOptions = {},
): Identified {
  const now = options.now ?? (() => performance.now());
  const budget = options.budget ?? UNLIMITED;
  const t0 = now();
  assertCompositesUnshared(collected);
  const capacity = new Map<string, number>();
  const references: Reference[] = [];
  const referenced = new Set<string>();
  const inventory: InventoryElement[] = collected.inventory.map(({ label, picture }) => {
    capacity.set(label.elementId, (capacity.get(label.elementId) ?? 0) + label.count);
    const features = picture ? featuresOf(picture) : null;
    // An element listed twice keeps one reference, so it cannot fill two candidate places.
    if (features && !referenced.has(label.elementId)) {
      referenced.add(label.elementId);
      references.push({ elementId: label.elementId, features });
    }
    return {
      elementId: label.elementId,
      count: label.count,
      page: label.page,
      xPt: label.xPt,
      yPt: label.yPt,
      bbox: picture?.bbox ? roundRect(picture.bbox) : null,
      flags: picture ? [...picture.flags] : ["no-picture"],
    };
  });

  // Score each distinct drawing once; identical drawings share every candidate.
  const ranked = new Map<string, Candidate[]>();
  for (const { picture } of collected.callouts) {
    if (!picture?.drawing || ranked.has(picture.drawing)) continue;
    budget.check(`matching drawing ${ranked.size + 1}`);
    const features = featuresOf(picture);
    ranked.set(
      picture.drawing,
      features
        ? rankReferences(features, references, params, Math.max(params.candidatesPerDrawing, 5))
        : [],
    );
  }
  const matchMs = now() - t0;

  // Identical drawings are one part, so their pieces are one demand on one element.
  const demandOf = new Map<string, number>();
  for (const { picture, step, label } of collected.callouts) {
    if (step === null || !picture?.drawing || (ranked.get(picture.drawing)?.length ?? 0) === 0)
      continue;
    demandOf.set(picture.drawing, (demandOf.get(picture.drawing) ?? 0) + label.count);
  }
  const demands: Demand[] = [...demandOf.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, quantity]) => ({
      key,
      quantity,
      candidates: ranked.get(key)!.slice(0, params.candidatesPerDrawing),
    }));
  const supplies = [...capacity.entries()]
    .sort()
    .map(([elementId, count]) => ({ elementId, capacity: count }));
  const assignment = assignDrawings(demands, supplies, 1 + params.appearanceWeight, {
    maxNodes: options.maxAssignmentNodes,
    checkpoint: (node) => budget.check(`assignment node ${node}`),
  });
  const unproven = new Set(assignment.provenOptimal ? [] : assignment.decided);

  const callouts: CalloutIdentification[] = collected.callouts.map(({ label, step, picture }) => {
    const flags: CalloutFlag[] = picture ? [...picture.flags] : ["no-picture"];
    if (step === null) flags.push("outside-step");
    const drawing = picture?.drawing ?? null;
    const candidates = drawing ? (ranked.get(drawing) ?? []) : [];
    const placement = drawing ? assignment.placements.get(drawing) : undefined;
    let elementId: string | null = placement?.elementId ?? null;
    if (
      step !== null &&
      candidates.length > 0 &&
      (placement === undefined || placement.placed < demandOf.get(drawing!)!)
    ) {
      flags.push("unassigned");
    }
    if (step !== null && drawing !== null && unproven.has(drawing))
      flags.push("assignment-unproven");
    if (step === null && elementId === null) elementId = candidates[0]?.elementId ?? null;
    const chosen = candidates.find((c) => c.elementId === elementId) ?? null;
    const others = candidates.filter((c) => c.elementId !== elementId);
    const margin = chosen && others.length > 0 ? round(chosen.score - others[0]!.score) : null;
    const firstChoice = candidates[0] ?? null;
    if (elementId !== null && firstChoice && firstChoice.elementId !== elementId)
      flags.push("conflict");
    if (margin !== null && margin < params.lowMargin) flags.push("low-margin");
    if (chosen && chosen.iou < params.lowIou) flags.push("low-score");
    return {
      id: calloutId(label.page, label.count, label.xPt, label.yPt),
      page: label.page,
      step,
      count: label.count,
      bbox: picture?.bbox ? roundRect(picture.bbox) : null,
      drawing,
      elementId,
      score: chosen?.score ?? null,
      iou: chosen?.iou ?? null,
      firstChoice,
      runnerUp: candidates[1] ?? null,
      margin,
      candidates: candidates.slice(0, 5),
      flags: [...new Set(flags)],
    };
  });

  const { summary, steps, reconciliation, residuals } = report(callouts, inventory, capacity);
  return {
    summary,
    text: textCounts(collected),
    assignment: {
      cost: assignment.totalCost,
      lowerBound: assignment.lowerBound,
      provenOptimal: assignment.provenOptimal,
      nodes: assignment.nodes,
    },
    inventory,
    callouts,
    steps,
    reconciliation,
    residuals,
    matchMs,
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
