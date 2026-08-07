/**
 * Main-thread responsiveness sampling for the browser specs.
 *
 * The page collects raw observations only; every statistic is derived here, in
 * Node, so the summary can be unit tested without a browser.
 */

/** One frame at 60Hz. A tick later than this is a frame the editor failed to deliver. */
export const FRAME_BUDGET_MS = 16.7;

/**
 * The gate: the share of the sampled window in which the main thread was over
 * the frame budget.
 *
 * Calibrated over 121 completed runs of `candidate-lab.spec.ts` on one 32-core
 * machine, across load regimes of 0, 4, 8, 16, 32, 64 and 128 busy processes
 * held for the whole batch. Every candidate statistic below was computed from
 * the same runs and rated by the only thing that matters for a gate: the
 * smallest ceiling that passes every run, read as a multiple of what the
 * statistic does on an idle machine. That multiple is how blind the gate has to
 * be in order never to flake.
 *
 *   statistic                     idle median   all-regime range   safe ceiling
 *   maximum gap (the old gate)         88.6ms    78.8 - 371.4ms      4.19x idle
 *   p99 gap                            88.6ms    77.1 - 371.4ms      4.19x idle
 *   p90 gap                            48.6ms    11.1 - 101.1ms      2.08x idle
 *   blocked ms over 50ms               47.2ms   33.4 - 767.3ms     16.26x idle
 *   blocked fraction over 50ms          0.082      0.059 - 0.486      5.94x idle
 *   blocked ms over 16.7ms            251.2ms  229.1 - 1177.0ms      4.69x idle
 *   blocked fraction over 16.7ms        0.428      0.190 - 0.656      1.53x idle
 *
 * The last row wins by a factor of nearly three. It is the only statistic here
 * whose busiest and quietest runs overlap at all, because it is a ratio: load
 * stretches the generation window and the blocked time inside it together, so
 * dividing one by the other cancels most of the machine out. The others each
 * need a ceiling from two to sixteen times normal behaviour before they stop
 * flaking, which is a gate that can no longer see a regression.
 *
 * Two plausible-sounding alternatives are dead ends, and the numbers say why:
 *
 * - A quantile is not available. The probe collects 26-32 samples in the ~580ms
 *   an idle generation takes, so ceil(0.99 * n) == n and p99 is arithmetically
 *   the maximum - the same single sample, relabelled. p90 does move off the
 *   tail, but its own range is 9.11x because the sample count changes with load
 *   and drags p90 to a different part of the distribution.
 * - Total blocked time above a 50ms budget is the maximum in disguise. An idle
 *   run puts only about two gaps over 50ms, so the sum tracks (maximum - 50) and
 *   inherits its fragility, then compounds it: under load many gaps cross the
 *   budget at once and the sum ranges 22.97x, the worst of everything measured.
 *   16.7ms is what makes the sum a sum - about 15 gaps clear it per idle run.
 *
 * 0.85 is 1.30x the worst of the 121 runs (0.656) and 1.99x the idle median. The
 * margin is deliberately not a tight fit: the worst run measured was 0.598 after
 * 76 runs and 0.656 after 107, so the tail was still moving well into sampling,
 * and two batches at the same nominal load differed by 0.07 in median - the
 * machine has states this load parameter does not capture. A final 14 runs at
 * the load that produces the highest fractions left every figure in the table
 * unmoved, which is what 0.656 being the real tail looks like. A drift too small
 * to reach 0.85 is still visible, because every run writes its whole
 * distribution to `candidate-lab-responsiveness.json`.
 *
 * For contrast, the old 200ms ceiling failed 78 of these 121 runs while failing
 * none of the 12 idle ones - precisely the shape of a gate that passes on a
 * quiet machine and decides the suite by scheduling luck on a busy one. Being
 * safe everywhere would have cost it 4.19x idle, against 1.99x here.
 */
export const BLOCKED_FRACTION_CEILING = 0.85;

/**
 * A backstop for one pathological freeze, deliberately not calibrated to the tail.
 *
 * The fraction can be diluted: under the heaviest load the window stretched to
 * 4.9s while the fraction fell to 0.19, because the page was waiting on starved
 * workers rather than blocking. A single multi-second stall inside a window that
 * long would not move it. 1000ms is 2.69x the worst single gap observed
 * anywhere in the calibration (371.4ms), so machine noise cannot reach it and
 * only a genuine freeze can.
 */
export const SINGLE_STALL_CEILING_MS = 1000;

/** Enough for ~40s at the probe's 10ms period, and a bound on what the page may hand back. */
const MAXIMUM_SAMPLES = 4096;

export interface ResponsivenessObservation {
  /** Milliseconds between consecutive ticks of a fixed-period timer. */
  readonly gapsMs: readonly number[];
  /** Durations of `longtask` performance entries seen while sampling. */
  readonly longTasksMs: readonly number[];
  /** Wall time the probe was running, which the blocked time is a share of. */
  readonly observedMs: number;
  /** The timer period requested, so a gap can be read against its own baseline. */
  readonly periodMs: number;
}

export interface ResponsivenessSummary {
  readonly schemaVersion: "lego.responsiveness-sample/1";
  readonly sampleCount: number;
  readonly observedMs: number;
  readonly periodMs: number;
  readonly frameBudgetMs: number;
  /** Reported for diagnosis. None of these is the gate; see the constants above for why. */
  readonly gapMs: {
    readonly p50: number;
    readonly p90: number;
    readonly maximum: number;
  };
  /** Milliseconds a tick arrived beyond the frame budget, summed over every sample. */
  readonly blockedMs: number;
  /** `blockedMs` as a share of the window. The gate. */
  readonly blockedFraction: number;
  /**
   * Long tasks time the task itself, so unlike a timer gap they do not count
   * wall time in which the main thread was idle but the whole renderer was
   * descheduled. That distinction is why they are recorded: an idle run here
   * produces a ~89ms gap and zero to one long tasks, which says the worst gap is
   * mostly the machine rather than the page. Under load the same run reports
   * nine to eleven, so this separates a page regression from a busy machine.
   */
  readonly longTaskCount: number;
  readonly longTaskMaximumMs: number;
}

/** Nearest-rank quantile, so every reported value is one that was actually observed. */
export function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]!;
}

function assertFiniteSamples(values: readonly number[], field: string): void {
  if (values.length > MAXIMUM_SAMPLES) {
    throw new TypeError(
      `Responsiveness probe returned ${values.length} ${field} samples, over the ${MAXIMUM_SAMPLES} bound.`,
    );
  }
  const bad = values.findIndex((value) => !Number.isFinite(value) || value < 0);
  if (bad !== -1) {
    throw new TypeError(
      `Responsiveness probe returned a non-finite or negative ${field} sample at index ${bad}: ${values[bad]}.`,
    );
  }
}

export function summarizeResponsiveness(
  observation: ResponsivenessObservation,
): ResponsivenessSummary {
  assertFiniteSamples(observation.gapsMs, "gap");
  assertFiniteSamples(observation.longTasksMs, "long task");
  if (!Number.isFinite(observation.observedMs) || observation.observedMs <= 0) {
    throw new TypeError(
      `Responsiveness probe reported a ${observation.observedMs}ms observation window; the blocked fraction is a share of it, so it must be a positive duration.`,
    );
  }
  if (observation.gapsMs.length === 0) {
    throw new TypeError(
      `Responsiveness probe returned no gap samples across ${observation.observedMs.toFixed(1)}ms at a ${observation.periodMs}ms period; the timer never ran, so the run measured nothing.`,
    );
  }
  const sorted = [...observation.gapsMs].sort((left, right) => left - right);
  const blockedMs = observation.gapsMs.reduce(
    (total, value) => total + Math.max(0, value - FRAME_BUDGET_MS),
    0,
  );
  return {
    schemaVersion: "lego.responsiveness-sample/1",
    sampleCount: sorted.length,
    observedMs: observation.observedMs,
    periodMs: observation.periodMs,
    frameBudgetMs: FRAME_BUDGET_MS,
    gapMs: {
      p50: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9),
      maximum: sorted.at(-1)!,
    },
    blockedMs,
    blockedFraction: blockedMs / observation.observedMs,
    longTaskCount: observation.longTasksMs.length,
    longTaskMaximumMs: observation.longTasksMs.reduce((most, value) => Math.max(most, value), 0),
  };
}
