import { readFileSync } from "node:fs";

import {
  identifyBooklet,
  type IdentifyOptions,
  type IdentifyResult,
} from "../../apps/web/src/instructions/identify/index.ts";
import { descending, sameMultiset, type IdentityTarget } from "./align-identity.ts";
import type { BookletRead } from "./read.ts";

/**
 * Stage 1b: which element each printed callout draws, read from the booklet
 * alone.
 *
 * Runs the product's deterministic closed-set identification
 * (apps/web/src/instructions/identify: no model call, no answer key) on the
 * booklet PDF and turns its callouts into one identity target per printed
 * step for the aligner: the pieces of each element identification trusts,
 * and the quantities of the callouts it flagged (its residuals: a low margin,
 * a low score, a capacity conflict, no picture, and so on), which the aligner
 * matches by count only. A step whose identified callout quantities differ
 * from the text read's is aligned by counts alone, and says so.
 *
 * The harness may import product code; product code never imports the harness.
 */
export const IDENTIFY_STAGE_VERSION = "lego.booklet-identify/1";

export interface IdentifiedCallout {
  readonly id: string;
  readonly count: number;
  readonly elementId: string | null;
  /** The residual flags that make the aligner match this callout by count; empty when trusted. */
  readonly flags: readonly string[];
}

export interface StepIdentity {
  readonly step: number;
  readonly callouts: readonly IdentifiedCallout[];
  /** What the aligner holds the step to; null when it aligns the step by counts alone. */
  readonly target: IdentityTarget | null;
  /** Why the step is aligned by counts alone, or null. */
  readonly countsOnly: string | null;
}

export interface IdentifyStage {
  readonly version: typeof IDENTIFY_STAGE_VERSION;
  readonly source: IdentifyResult["source"];
  readonly summary: IdentifyResult["summary"];
  readonly assignment: IdentifyResult["assignment"];
  /** One per printed step of the text read, in its order. */
  readonly steps: readonly StepIdentity[];
  readonly flaggedCallouts: number;
  readonly flaggedSteps: number;
  /** Steps whose identified callout quantities differ from the text read's. */
  readonly stepsCountsOnly: readonly number[];
  /** Steps identification found that the text read has not. */
  readonly stepsUnknownToRead: readonly number[];
  readonly timingsMs: IdentifyResult["timingsMs"];
}

const quantities = (callouts: readonly { count: number }[]) =>
  descending(callouts.map(({ count }) => count));

/**
 * One identity per printed step. A callout is trusted when identification gave
 * it an element and left it out of its residuals; the others are flagged.
 */
export function stepIdentities(
  read: Pick<BookletRead, "steps">,
  result: Pick<IdentifyResult, "callouts" | "residuals">,
): StepIdentity[] {
  const residual = new Map(result.residuals.map(({ calloutId, flags }) => [calloutId, flags]));
  const byStep = new Map<number, IdentifiedCallout[]>();
  for (const callout of result.callouts) {
    if (callout.step === null) continue;
    const flags = residual.get(callout.id) ?? (callout.elementId === null ? ["unassigned"] : []);
    const list = byStep.get(callout.step) ?? [];
    list.push({ id: callout.id, count: callout.count, elementId: callout.elementId, flags });
    byStep.set(callout.step, list);
  }
  return read.steps.map(({ step, callouts: printed }) => {
    const callouts = byStep.get(step) ?? [];
    if (!sameMultiset(printed, quantities(callouts))) {
      return {
        step,
        callouts,
        target: null,
        countsOnly: `identification reads callouts ${quantities(callouts).join("+") || "none"}, the text read ${descending(printed).join("+") || "none"}`,
      };
    }
    const elements = new Map<string, number>();
    const flagged: number[] = [];
    for (const callout of callouts) {
      if (callout.flags.length > 0 || callout.elementId === null) flagged.push(callout.count);
      else elements.set(callout.elementId, (elements.get(callout.elementId) ?? 0) + callout.count);
    }
    return { step, callouts, target: { elements, flagged }, countsOnly: null };
  });
}

export function identifyStageOf(
  read: Pick<BookletRead, "steps">,
  result: Omit<IdentifyResult, "schemaVersion" | "parameters" | "inventory">,
): IdentifyStage {
  const steps = stepIdentities(read, result);
  const known = new Set(read.steps.map(({ step }) => step));
  const flagged = steps.flatMap(({ callouts }) =>
    callouts.filter(({ flags, elementId }) => flags.length > 0 || elementId === null),
  );
  return {
    version: IDENTIFY_STAGE_VERSION,
    source: result.source,
    summary: result.summary,
    assignment: result.assignment,
    steps,
    flaggedCallouts: flagged.length,
    flaggedSteps: steps.filter(({ target }) => (target?.flagged.length ?? 0) > 0).length,
    stepsCountsOnly: steps.filter(({ target }) => target === null).map(({ step }) => step),
    stepsUnknownToRead: [
      ...new Set(
        result.callouts
          .map(({ step }) => step)
          .filter((step): step is number => step !== null && !known.has(step)),
      ),
    ].sort((left, right) => left - right),
    timingsMs: result.timingsMs,
  };
}

/** Identifies the booklet at `pdfPath`; the text read supplies the printed steps. */
export async function runIdentifyStage(
  pdfPath: string,
  read: Pick<BookletRead, "steps">,
  options: IdentifyOptions = {},
): Promise<IdentifyStage> {
  const result = await identifyBooklet(new Uint8Array(readFileSync(pdfPath)), options);
  return identifyStageOf(read, result);
}
