/**
 * Prepares a traced edge for measurement: levels it, finds the corners where
 * the silhouette turns, and exposes the pieces between them.
 *
 * Everything here exists to make the *trend* someone else's problem. A drawn
 * outline descends across the page and turns corners, and a corner is an
 * enormous least-squares feature sitting next to a scallop a few rows deep — so
 * the corners are found and cut first, and only straight pieces are ever
 * measured. This half holds no notion of periodicity at all.
 */
export const STUD_PITCH_SCHEMA_VERSION = "lego.stud-pitch/1" as const;

export const STUD_PITCH_DEFAULTS = Object.freeze({
  /** Below this a "period" is indistinguishable from raster stair-stepping. */
  minPitchPx: 10,
  /** Rows the topmost edge may jump between neighbouring columns before it is a new run. */
  maxRowJumpPx: 6,
  /** Periods of the shortest searched pitch a run must span to be worth keeping. */
  minPeriodsPerRun: 3,
  maxPitchPx: 160,
  /** Harmonics of the candidate period the comb gathers (and penalises between). */
  harmonics: 4,
  /** Width of the high-pass window, in whole candidate periods. */
  windowPeriods: 2,
  /** Periods that must survive the high-pass before a candidate is scored. */
  minCyclesMeasured: 3,
  minSamples: 48,
  /** Geometric spacing of the coarse search. */
  coarseStepRatio: 0.008,
  /** Coarse peaks taken through to refinement and the acceptance gates. */
  peaksExamined: 5,
  /** Share of the edge's wobble the comb must gather to count as a period. */
  minCombShare: 0.4,
  /** Share of the comb that must sit on the period's own frequency. */
  minFundamentalShare: 0.3,
  /** Power allowed on the half-multiples, against the comb's own. */
  maxHalfShare: 0.35,
  /**
   * Rows the edge must actually move, peak to peak, at the reported period.
   *
   * A straight line rounded to whole rows never leaves its own trend by a full
   * row, so its periodic part cannot reach 1.0; a stud drawn 2 rows deep
   * reaches 2.0. The gate sits between them.
   */
  minRippleRows: 1.45,
  /** Two-piece fit must cut the residual this far before a corner is believed. */
  cornerSseRatio: 0.5,
  /** Shortest piece a corner split may leave behind. */
  minSegmentPx: 60,
  maxCorners: 3,
});

export type StudPitchOptions = typeof STUD_PITCH_DEFAULTS;

export interface EdgeRun {
  readonly startX: number;
  readonly rows: readonly number[];
}

export interface StudPitchEstimate {
  readonly schemaVersion: typeof STUD_PITCH_SCHEMA_VERSION;
  /** Scallop period in raster pixels, or null when the edge carries none. */
  readonly pitchPx: number | null;
  /** Why no pitch was reported, naming what was actually measured. */
  readonly rejected: string | null;
  /** Share of the edge's wobble gathered by the comb at the reported pitch. */
  readonly combShare: number;
  /** Share of that comb sitting on the pitch's own frequency. */
  readonly fundamentalShare: number;
  /** Power on the half-multiples, against the comb's own. */
  readonly halfShare: number;
  /** How far the edge moves at the reported pitch, peak to peak, in rows. */
  readonly rippleRows: number;
  readonly segmentsUsed: number;
  readonly columnsUsed: number;
}

export interface Segment {
  readonly from: number;
  readonly to: number;
}

export interface PreparedRun {
  readonly startX: number;
  /** Rows with the run's own least-squares line removed, for conditioning. */
  readonly levelled: Float64Array;
  /** Continuous prefix integral of `levelled`. */
  readonly integral: Float64Array;
  readonly segments: readonly Segment[];
  /** High-passed rows of the block currently under measurement. */
  readonly scratch: Float64Array;
  /** Taper weight of each of those rows. */
  readonly taper: Float64Array;
}

/** One stretch of high-passed edge: `values[from..from+count)` starting at `x0`. */
export interface ResidualBlock {
  readonly x0: number;
  readonly from: number;
  readonly count: number;
}

export interface Evaluated {
  readonly pitchPx: number;
  readonly combPower: number;
  readonly combShare: number;
  readonly fundamentalShare: number;
  readonly halfShare: number;
  readonly rippleRows: number;
  readonly samples: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/**
 * Splits a profile where its slope changes, so that every piece is a straight
 * edge plus scallops.
 *
 * A corner is not a subtlety: a silhouette that turns swings the profile by
 * hundreds of rows where the scallops are worth four, so the two-piece
 * least-squares fit collapses the residual by orders of magnitude exactly at
 * the turn. Scallops alone never buy a two-piece fit half of the residual,
 * which is why the gate can be this blunt.
 */
function splitAtCorners(levelled: Float64Array, settings: StudPitchOptions): Segment[] {
  const count = levelled.length;
  const sumY = new Float64Array(count + 1);
  const sumYY = new Float64Array(count + 1);
  const sumXY = new Float64Array(count + 1);
  for (let i = 0; i < count; i += 1) {
    const y = levelled[i]!;
    sumY[i + 1] = sumY[i]! + y;
    sumYY[i + 1] = sumYY[i]! + y * y;
    sumXY[i + 1] = sumXY[i]! + i * y;
  }
  const sumX = (n: number): number => (n * (n - 1)) / 2;
  const sumXX = (n: number): number => ((n - 1) * n * (2 * n - 1)) / 6;

  /** Residual sum of squares of the best straight line through `[from, to)`. */
  const lineSse = (from: number, to: number): number => {
    const n = to - from;
    if (n < 3) return 0;
    const sx = sumX(to) - sumX(from);
    const sxx = sumXX(to) - sumXX(from);
    const sy = sumY[to]! - sumY[from]!;
    const syy = sumYY[to]! - sumYY[from]!;
    const sxy = sumXY[to]! - sumXY[from]!;
    const centredXX = sxx - (sx * sx) / n;
    const centredYY = syy - (sy * sy) / n;
    const centredXY = sxy - (sx * sy) / n;
    if (centredXX <= 0) return Math.max(0, centredYY);
    return Math.max(0, centredYY - (centredXY * centredXY) / centredXX);
  };

  const segments: Segment[] = [];
  const shortest = settings.minSegmentPx;
  const divide = (from: number, to: number, depth: number): void => {
    const whole = lineSse(from, to);
    if (depth > 0 && to - from >= 2 * shortest && whole > 1e-6) {
      let bestAt = -1;
      let bestSse = Number.POSITIVE_INFINITY;
      for (let at = from + shortest; at <= to - shortest; at += 1) {
        const split = lineSse(from, at) + lineSse(at, to);
        if (split < bestSse) {
          bestSse = split;
          bestAt = at;
        }
      }
      if (bestAt > 0 && bestSse <= settings.cornerSseRatio * whole) {
        divide(from, bestAt, depth - 1);
        divide(bestAt, to, depth - 1);
        return;
      }
    }
    segments.push({ from, to });
  };
  divide(0, count, settings.maxCorners);
  return segments;
}

export function prepareRun(run: EdgeRun, settings: StudPitchOptions): PreparedRun | null {
  const count = run.rows.length;
  if (count < settings.minSamples) return null;
  for (const row of run.rows) if (!Number.isFinite(row)) return null;

  // Levelling by the run's own line keeps every later sum well conditioned:
  // a raw profile sits at row ~400 and its squares cancel to four significant
  // figures, which is not enough to tell a stair from a scallop.
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < count; i += 1) {
    const y = run.rows[i]!;
    sumX += i;
    sumY += y;
    sumXX += i * i;
    sumXY += i * y;
  }
  const centredXX = sumXX - (sumX * sumX) / count;
  const slope = centredXX > 0 ? (sumXY - (sumX * sumY) / count) / centredXX : 0;
  const intercept = (sumY - slope * sumX) / count;

  const levelled = new Float64Array(count);
  for (let i = 0; i < count; i += 1) levelled[i] = run.rows[i]! - (intercept + slope * i);

  const integral = new Float64Array(count + 1);
  for (let i = 0; i < count; i += 1) integral[i + 1] = integral[i]! + levelled[i]!;

  return {
    startX: run.startX,
    levelled,
    integral,
    segments: splitAtCorners(levelled, settings),
    scratch: new Float64Array(count),
    taper: new Float64Array(count),
  };
}

/** Integral of the sample train from 0 to a continuous column position. */
export function integralAt(prepared: PreparedRun, at: number): number {
  const count = prepared.levelled.length;
  if (at <= 0) return 0;
  if (at >= count) return prepared.integral[count]!;
  const whole = Math.floor(at);
  return prepared.integral[whole]! + (at - whole) * prepared.levelled[whole]!;
}

/**
 * High-passes each straight piece by removing a centred moving average.
 *
 * The window is a whole number of candidate periods wide, which makes the
 * filter exact in both directions that matter: it removes any straight line
 * completely (so slope never leaks into the score) and it passes every comb
 * tooth k/P with gain 1 (so nothing has to be corrected back out afterwards).
 * Samples closer to a piece's end than half a window have no window, so they
 * are dropped — that is also what keeps a corner from ever being averaged
 * across.
 */
export function residualBlocks(prepared: PreparedRun, windowPx: number): ResidualBlock[] {
  const half = windowPx / 2;
  const blocks: ResidualBlock[] = [];
  let cursor = 0;
  for (const segment of prepared.segments) {
    const first = Math.ceil(segment.from + half - 0.5);
    const last = Math.floor(segment.to - half - 0.5);
    if (last < first) continue;
    const from = cursor;
    for (let i = first; i <= last; i += 1) {
      const centre = i + 0.5;
      const mean =
        (integralAt(prepared, centre + half) - integralAt(prepared, centre - half)) / windowPx;
      prepared.scratch[cursor] = prepared.levelled[i]! - mean;
      cursor += 1;
    }
    const count = cursor - from;
    // A block that simply stops rings: its cut ends scatter the fundamental's
    // power across every other frequency, and the leftovers land under the
    // neighbouring teeth and drag the peak. Tapering each block to nothing at
    // its ends is what makes the reading unbiased rather than merely close —
    // it is worth two tenths of a percent at fourteen periods on this art.
    for (let i = 0; i < count; i += 1) {
      prepared.taper[from + i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / count);
    }
    blocks.push({ x0: prepared.startX + first, from, count });
  }
  return blocks;
}
