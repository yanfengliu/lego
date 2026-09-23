import type { CalloutIdentification, IdentifyResult } from "./types";

/**
 * Scores an identification against hand-judged verdicts.
 *
 * A verdict says whether one callout's picture is (or is not) one element. It
 * binds to a callout by page, count and label position. A verdict also covers
 * every other callout in range that prints the byte-identical drawing at the same
 * size, because those callouts show the same picture; composite pictures, cut
 * out of overlapping tiles, never inherit a verdict.
 */
export interface TruthIdentity {
  readonly n: number;
  readonly page: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  /** The element the verdict was about, or null when nothing could be judged. */
  readonly elementId: string | null;
  /** True: the picture is `elementId`. False: it is not. Null: unjudgeable. */
  readonly same: boolean | null;
}

export interface TruthMiss {
  readonly calloutId: string;
  readonly step: number | null;
  readonly truth: string;
  readonly got: string | null;
  readonly inherited: boolean;
}

export interface TruthScore {
  readonly lastStep: number;
  readonly calloutsInRange: number;
  readonly piecesInRange: number;
  readonly verdictsBound: number;
  readonly verdictsUnbound: readonly number[];
  /** Callouts carrying their own positive verdict. */
  readonly direct: { readonly callouts: number; readonly correct: number };
  /** Callouts with a negative verdict, and how many avoided the rejected element. */
  readonly negative: { readonly callouts: number; readonly avoided: number };
  /** Positive labels including those inherited through identical drawings. */
  readonly expanded: {
    readonly callouts: number;
    readonly correct: number;
    readonly pieces: number;
    readonly piecesCorrect: number;
  };
  readonly steps: {
    readonly total: number;
    /** Steps with at least one labelled callout, and those whose labelled callouts are all right. */
    readonly withLabels: number;
    readonly allLabelledCorrect: number;
    /** Steps whose every callout carries a positive label, and those entirely right. */
    readonly fullyLabelled: number;
    readonly fullyLabelledCorrect: number;
  };
  readonly misses: readonly TruthMiss[];
}

function matches(callout: CalloutIdentification, truth: TruthIdentity): boolean {
  const m = /^p(\d+)\|q(\d+)\|x(-?[\d.]+)\|y(-?[\d.]+)$/.exec(callout.id);
  if (!m) return false;
  return (
    Number(m[1]) === truth.page &&
    Number(m[2]) === truth.quantity &&
    Math.abs(Number(m[3]) - truth.xPt) < 0.02 &&
    Math.abs(Number(m[4]) - truth.yPt) < 0.02
  );
}

function inheritable(drawing: string | null): drawing is string {
  return drawing !== null && !drawing.startsWith("composite:");
}

export function scoreAgainstTruth(
  result: Pick<IdentifyResult, "callouts">,
  truth: readonly TruthIdentity[],
  lastStep: number,
): TruthScore {
  const inRange = result.callouts.filter((c) => c.step !== null && c.step <= lastStep);
  const positive = new Map<string, { elementId: string; inherited: boolean }>();
  const negative = new Map<string, string>();
  const byDrawing = new Map<string, string>();
  const unbound: number[] = [];
  let bound = 0;
  for (const verdict of truth) {
    const callout = inRange.find((c) => matches(c, verdict));
    if (!callout) {
      unbound.push(verdict.n);
      continue;
    }
    bound += 1;
    if (verdict.elementId === null || verdict.same === null) continue;
    if (verdict.same) {
      positive.set(callout.id, { elementId: verdict.elementId, inherited: false });
      if (inheritable(callout.drawing)) byDrawing.set(callout.drawing, verdict.elementId);
    } else {
      negative.set(callout.id, verdict.elementId);
    }
  }
  for (const callout of inRange) {
    if (positive.has(callout.id) || !inheritable(callout.drawing)) continue;
    const elementId = byDrawing.get(callout.drawing);
    if (elementId !== undefined && negative.get(callout.id) !== elementId) {
      positive.set(callout.id, { elementId, inherited: true });
    }
  }

  const misses: TruthMiss[] = [];
  let directCorrect = 0;
  let directTotal = 0;
  let correct = 0;
  let pieces = 0;
  let piecesCorrect = 0;
  for (const callout of inRange) {
    const label = positive.get(callout.id);
    if (!label) continue;
    const right = callout.elementId === label.elementId;
    pieces += callout.count;
    if (right) {
      correct += 1;
      piecesCorrect += callout.count;
    } else {
      misses.push({
        calloutId: callout.id,
        step: callout.step,
        truth: label.elementId,
        got: callout.elementId,
        inherited: label.inherited,
      });
    }
    if (!label.inherited) {
      directTotal += 1;
      if (right) directCorrect += 1;
    }
  }
  let avoided = 0;
  for (const [id, rejected] of negative) {
    const callout = inRange.find((c) => c.id === id)!;
    if (callout.elementId !== rejected) avoided += 1;
    else
      misses.push({
        calloutId: id,
        step: callout.step,
        truth: `not ${rejected}`,
        got: callout.elementId,
        inherited: false,
      });
  }

  const stepNumbers = [...new Set(inRange.map((c) => c.step!))];
  let withLabels = 0;
  let allLabelledCorrect = 0;
  let fullyLabelled = 0;
  let fullyLabelledCorrect = 0;
  for (const step of stepNumbers) {
    const here = inRange.filter((c) => c.step === step);
    const labelled = here.filter((c) => positive.has(c.id));
    const allRight = labelled.every((c) => c.elementId === positive.get(c.id)!.elementId);
    if (labelled.length > 0) {
      withLabels += 1;
      if (allRight) allLabelledCorrect += 1;
    }
    if (labelled.length === here.length) {
      fullyLabelled += 1;
      if (allRight) fullyLabelledCorrect += 1;
    }
  }
  return {
    lastStep,
    calloutsInRange: inRange.length,
    piecesInRange: inRange.reduce((a, c) => a + c.count, 0),
    verdictsBound: bound,
    verdictsUnbound: unbound,
    direct: { callouts: directTotal, correct: directCorrect },
    negative: { callouts: negative.size, avoided },
    expanded: { callouts: positive.size, correct, pieces, piecesCorrect },
    steps: {
      total: stepNumbers.length,
      withLabels,
      allLabelledCorrect,
      fullyLabelled,
      fullyLabelledCorrect,
    },
    misses,
  };
}
