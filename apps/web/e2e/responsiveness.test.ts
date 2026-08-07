import { describe, expect, it } from "vitest";

import {
  BLOCKED_FRACTION_CEILING,
  FRAME_BUDGET_MS,
  SINGLE_STALL_CEILING_MS,
  quantile,
  summarizeResponsiveness,
  type ResponsivenessObservation,
} from "./responsiveness";

const observation = (
  overrides: Partial<ResponsivenessObservation> = {},
): ResponsivenessObservation => ({
  gapsMs: [10, 10, 10, 10],
  longTasksMs: [],
  observedMs: 40,
  periodMs: 10,
  ...overrides,
});

describe("responsiveness summary", () => {
  it("charges only the milliseconds past the frame budget, and reads them as a share of the window", () => {
    // Two gaps 50ms over budget in a 1000ms window: 100ms blocked, a tenth of it.
    const summary = summarizeResponsiveness(
      observation({
        gapsMs: [10, 66.7, 10, 66.7, 10],
        observedMs: 1000,
      }),
    );
    expect(summary.blockedMs).toBeCloseTo(100, 6);
    expect(summary.blockedFraction).toBeCloseTo(0.1, 6);
    expect(summary.frameBudgetMs).toBe(FRAME_BUDGET_MS);
  });

  it("keeps the fraction flat when load stretches the window and every gap inside it", () => {
    // The whole point of the ratio: a machine 3x slower doubles nothing.
    const quiet = summarizeResponsiveness(
      observation({ gapsMs: [10, 60, 10, 60], observedMs: 140 }),
    );
    const busy = summarizeResponsiveness(
      observation({ gapsMs: [30, 180, 30, 180], observedMs: 420 }),
    );
    expect(busy.gapMs.maximum / quiet.gapMs.maximum).toBeCloseTo(3, 6);
    expect(busy.blockedFraction).toBeGreaterThan(quiet.blockedFraction);
    expect(busy.blockedFraction / quiet.blockedFraction).toBeLessThan(1.5);
  });

  it("does not let one sample decide the fraction the way a maximum does", () => {
    const steady = observation({ gapsMs: Array.from({ length: 50 }, () => 30), observedMs: 1500 });
    const hiccup = observation({
      gapsMs: [...Array.from({ length: 49 }, () => 30), 300],
      observedMs: 1770,
    });
    const before = summarizeResponsiveness(steady);
    const after = summarizeResponsiveness(hiccup);
    // One 300ms hiccup among fifty 30ms gaps: the maximum multiplies by ten,
    // the fraction moves by a fifth, because the hiccup adds its own size to a
    // sum instead of replacing the one value that was being read.
    expect(after.gapMs.maximum / before.gapMs.maximum).toBe(10);
    expect(after.blockedFraction / before.blockedFraction).toBeLessThan(1.2);
  });

  it("reports gap quantiles by nearest rank, so every value is one that happened", () => {
    const summary = summarizeResponsiveness(
      observation({ gapsMs: [10, 20, 30, 40, 200], observedMs: 300 }),
    );
    expect(summary.gapMs.p50).toBe(30);
    expect(summary.gapMs.p90).toBe(200);
    expect(summary.gapMs.maximum).toBe(200);
    expect(summary.sampleCount).toBe(5);
  });

  it("counts long tasks separately from timer gaps", () => {
    const summary = summarizeResponsiveness(
      observation({ gapsMs: [10, 90], longTasksMs: [60, 120], observedMs: 100 }),
    );
    expect(summary.longTaskCount).toBe(2);
    expect(summary.longTaskMaximumMs).toBe(120);
  });

  it("refuses a window that cannot be divided into, naming what it got", () => {
    expect(() => summarizeResponsiveness(observation({ observedMs: 0 }))).toThrow(
      /reported a 0ms observation window/u,
    );
    expect(() => summarizeResponsiveness(observation({ observedMs: Number.NaN }))).toThrow(
      /reported a NaNms observation window/u,
    );
  });

  it("refuses an empty sample set rather than reporting a responsive zero", () => {
    // A timer that never ran would otherwise summarise as 0ms blocked and pass.
    expect(() => summarizeResponsiveness(observation({ gapsMs: [] }))).toThrow(
      /no gap samples across 40.0ms at a 10ms period/u,
    );
  });

  it("refuses samples that are not durations, naming the index and the value", () => {
    expect(() => summarizeResponsiveness(observation({ gapsMs: [10, -1] }))).toThrow(
      /negative gap sample at index 1: -1/u,
    );
    expect(() =>
      summarizeResponsiveness(observation({ longTasksMs: [Number.POSITIVE_INFINITY] })),
    ).toThrow(/non-finite or negative long task sample at index 0/u);
  });

  it("bounds how many samples the page may hand back", () => {
    expect(() =>
      summarizeResponsiveness(observation({ gapsMs: Array.from({ length: 4097 }, () => 10) })),
    ).toThrow(/4097 gap samples, over the 4096 bound/u);
  });
});

describe("quantile", () => {
  it("returns an observed value at every rank, and clamps outside [0, 1]", () => {
    const sorted = [1, 2, 3, 4];
    expect(quantile(sorted, 0)).toBe(1);
    expect(quantile(sorted, 0.5)).toBe(2);
    expect(quantile(sorted, 1)).toBe(4);
    expect(quantile(sorted, 2)).toBe(4);
    expect(quantile([], 0.5)).toBe(0);
  });

  it("collapses to the maximum once the sample is small, which is why p99 is not the gate", () => {
    // The probe collects 26-32 samples per idle run; ceil(0.99 * 30) === 30.
    const sorted = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(quantile(sorted, 0.99)).toBe(sorted.at(-1));
  });
});

describe("calibrated ceilings", () => {
  it("clears the worst calibration run with margin, and still fails a doubling of idle blocking", () => {
    // 0.656 was the worst of 121 runs; 0.428 the idle median.
    expect(0.656).toBeLessThan(BLOCKED_FRACTION_CEILING);
    expect(BLOCKED_FRACTION_CEILING / 0.656).toBeGreaterThan(1.25);
    expect(0.428 * 2).toBeGreaterThan(BLOCKED_FRACTION_CEILING);
    // 371.4ms was the worst single gap seen anywhere under load.
    expect(371.4).toBeLessThan(SINGLE_STALL_CEILING_MS);
    expect(SINGLE_STALL_CEILING_MS / 371.4).toBeGreaterThan(2.5);
  });
});
