import { assignDrawings, type Demand } from "./assign";
import { collectBooklet, type Collected, type Progress } from "./collect";
import { roundRect } from "./geometry";
import { featuresOf, rankReferences, type Features, type Reference } from "./match";
import { loadPdfjs, openPdf, sha256Digest, type PdfjsLike } from "./pdf-scan";
import {
  IDENTIFY_SCHEMA_VERSION,
  type CalloutFlag,
  type CalloutIdentification,
  type Candidate,
  type IdentifyParameters,
  type IdentifyResult,
  type InventoryElement,
  type Reconciliation,
  type Residual,
  type StepTotals,
} from "./types";

/**
 * Closed-set identification of every part callout in a LEGO instruction booklet.
 *
 * The inventory printed at the back is the closed set: each element's id and
 * count are text, and its thumbnail is the reference picture. Every callout
 * picture is scored against every thumbnail at the booklet's fixed callout scale,
 * and a min-cost flow assigns drawings to elements with the inventory counts as
 * capacities, so the per-element totals reconcile. What the pictures and the
 * counts cannot settle is flagged and listed, not guessed at.
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
}

/** Flags that leave a callout for a later closed-question check. */
const RESIDUAL_FLAGS: ReadonlySet<CalloutFlag> = new Set<CalloutFlag>([
  "low-margin",
  "low-score",
  "conflict",
  "unlinked-picture",
  "no-picture",
  "merged-split",
  "unassigned",
]);

function calloutId(page: number, count: number, x: number, y: number): string {
  return `p${page}|q${count}|x${x.toFixed(3)}|y${y.toFixed(3)}`;
}

export async function identifyBooklet(
  pdfBytes: Uint8Array,
  options: IdentifyOptions = {},
): Promise<IdentifyResult> {
  const params: IdentifyParameters = { ...DEFAULT_PARAMETERS, ...definedParameters(options) };
  validateParameters(params);
  const now = options.now ?? (() => performance.now());
  const started = now();
  const pdfjs = options.pdfjs ?? (await loadPdfjs());
  const sha256 = await sha256Digest(pdfBytes);
  const document = await openPdf(pdfjs, pdfBytes);
  let collected: Collected;
  try {
    collected = await collectBooklet(pdfjs, document, params, options.onProgress, now);
  } finally {
    await document.destroy();
  }
  const matchStarted = now();
  const { matchMs, ...result } = identifyCollected(collected, params, now);
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
  wholeNumberIn(params, "candidatesPerDrawing", 1, 64);
  wholeNumberIn(params, "alignSearchPx", 0, 16);
}

/** Bounds the options that set how much work matching does per picture. */
function wholeNumberIn(
  params: IdentifyParameters,
  key: keyof IdentifyParameters,
  min: number,
  max: number,
): void {
  const value = params[key];
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(
      `identifyBooklet option ${key} is ${value}; it must be a whole number from ${min} to ${max}.`,
    );
  }
}

type Identified = Omit<IdentifyResult, "schemaVersion" | "source" | "parameters" | "timingsMs"> & {
  matchMs: number;
};

/** Matching, assignment and reporting over already-collected pictures; pure. */
export function identifyCollected(
  collected: Collected,
  params: IdentifyParameters,
  now: () => number = () => performance.now(),
): Identified {
  const t0 = now();
  const weights = params;
  const capacity = new Map<string, number>();
  const references: Reference[] = [];
  const inventory: InventoryElement[] = collected.inventory.map(({ label, picture }) => {
    capacity.set(label.elementId, (capacity.get(label.elementId) ?? 0) + label.count);
    const features = picture ? featuresOf(picture) : null;
    if (features) references.push({ elementId: label.elementId, features });
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
  const featureOf = new Map<string, Features | null>();
  for (const { picture } of collected.callouts) {
    if (!picture?.drawing || featureOf.has(picture.drawing)) continue;
    const features = featuresOf(picture);
    featureOf.set(picture.drawing, features);
    ranked.set(
      picture.drawing,
      features
        ? rankReferences(features, references, weights, Math.max(params.candidatesPerDrawing, 5))
        : [],
    );
  }
  const matchMs = now() - t0;

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
  const assignment = assignDrawings(demands, supplies, 1 + params.appearanceWeight);

  const callouts: CalloutIdentification[] = collected.callouts.map(({ label, step, picture }) => {
    const flags: CalloutFlag[] = picture ? [...picture.flags] : ["no-picture"];
    if (step === null) flags.push("outside-step");
    const candidates = picture?.drawing ? (ranked.get(picture.drawing) ?? []) : [];
    const placement = picture?.drawing ? assignment.placements.get(picture.drawing) : undefined;
    let elementId: string | null = placement?.elementId ?? null;
    if (
      step !== null &&
      candidates.length > 0 &&
      (placement === undefined || placement.placed < demandOf.get(picture!.drawing!)!)
    ) {
      flags.push("unassigned");
    }
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
      drawing: picture?.drawing ?? null,
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

  return { ...report(callouts, inventory, capacity), inventory, callouts, matchMs };
}

function report(
  callouts: readonly CalloutIdentification[],
  inventory: readonly InventoryElement[],
  capacity: ReadonlyMap<string, number>,
): Pick<IdentifyResult, "summary" | "steps" | "reconciliation" | "residuals"> {
  const stepCallouts = callouts.filter((c) => c.step !== null);
  const assigned = new Map<string, number>();
  const bySteps = new Map<
    number,
    { pages: Set<number>; elements: Map<string, number>; unassigned: number }
  >();
  for (const c of stepCallouts) {
    const entry = bySteps.get(c.step!) ?? { pages: new Set(), elements: new Map(), unassigned: 0 };
    entry.pages.add(c.page);
    if (c.elementId !== null && !c.flags.includes("unassigned")) {
      entry.elements.set(c.elementId, (entry.elements.get(c.elementId) ?? 0) + c.count);
      assigned.set(c.elementId, (assigned.get(c.elementId) ?? 0) + c.count);
    } else entry.unassigned += c.count;
    bySteps.set(c.step!, entry);
  }
  const steps: StepTotals[] = [...bySteps.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, e]) => ({
      step,
      pages: [...e.pages].sort((a, b) => a - b),
      elements: Object.fromEntries(
        [...e.elements.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      ),
      unassignedPieces: e.unassigned,
    }));
  const reconciliation: Reconciliation[] = [...capacity.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([elementId, count]) => ({
      elementId,
      inventory: count,
      assigned: assigned.get(elementId) ?? 0,
    }));
  const residuals: Residual[] = callouts
    .filter((c) => c.flags.some((flag) => RESIDUAL_FLAGS.has(flag)))
    .map((c) => ({
      calloutId: c.id,
      page: c.page,
      step: c.step,
      count: c.count,
      flags: c.flags,
      elementId: c.elementId,
      candidates: c.candidates.slice(0, 3),
    }));
  const drawings = new Set(callouts.map((c) => c.drawing).filter((d) => d !== null));
  const assignedCallouts = stepCallouts.filter(
    (c) => c.elementId !== null && !c.flags.includes("unassigned"),
  );
  return {
    summary: {
      inventoryElements: capacity.size,
      inventoryPieces: [...capacity.values()].reduce((a, b) => a + b, 0),
      inventoryThumbnails: inventory.filter((e) => e.bbox !== null).length,
      callouts: callouts.length,
      calloutPieces: callouts.reduce((a, c) => a + c.count, 0),
      stepCallouts: stepCallouts.length,
      stepCalloutPieces: stepCallouts.reduce((a, c) => a + c.count, 0),
      calloutsWithPicture: callouts.filter((c) => c.bbox !== null).length,
      drawings: drawings.size,
      calloutsAssigned: assignedCallouts.length,
      piecesAssigned: assignedCallouts.reduce((a, c) => a + c.count, 0),
      elementsExact: reconciliation.filter((r) => r.assigned === r.inventory).length,
      firstChoiceKept: assignedCallouts.filter((c) => c.firstChoice?.elementId === c.elementId)
        .length,
      residuals: residuals.length,
    },
    steps,
    reconciliation,
    residuals,
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
