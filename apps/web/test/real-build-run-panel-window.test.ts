import { describe, expect, it } from "vitest";

import { planRealBuildRunPanelWindow } from "../e2e/real-build-run-panel-window";

describe("real-build requested execution and passive panel window", () => {
  it("retains all 359 source labels but exposes only 1..50 for execution", () => {
    const panels = Array.from({ length: 359 }, (_, index) => ({
      stepNumber: index + 1,
      action: `hostile-action-${index + 1}`,
    }));
    const planned = planRealBuildRunPanelWindow({
      panels: [...panels].reverse(),
      requestedLastStep: 50,
      expectedPrintedSteps: 359,
      maximumPassiveLookaheadSteps: 2,
    });

    expect(panels).toHaveLength(359);
    expect(planned.executionPanels.map(({ stepNumber }) => stepNumber)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    expect(planned.passiveObservationPanels.map(({ stepNumber }) => stepNumber)).toEqual([51, 52]);
    expect(planned.observationPanels.map(({ stepNumber }) => stepNumber)).toEqual(
      Array.from({ length: 52 }, (_, index) => index + 1),
    );
    expect(planned.executionPanels.some(({ stepNumber }) => stepNumber > 50)).toBe(false);
    expect(planned.executionPanels).not.toContain(panels[50]);
  });

  it("clamps passive source observation at the full index without widening execution", () => {
    const panels = Array.from({ length: 359 }, (_, index) => ({ stepNumber: index + 1 }));
    const planned = planRealBuildRunPanelWindow({
      panels,
      requestedLastStep: 359,
      expectedPrintedSteps: 359,
      maximumPassiveLookaheadSteps: 2,
    });
    expect(planned.executionPanels).toHaveLength(359);
    expect(planned.passiveObservationPanels).toEqual([]);
    expect(planned.observationPanels).toHaveLength(359);
  });

  it("refuses an unbounded or nonsensical execution/lookahead request", () => {
    const panels = [{ stepNumber: 1 }];
    for (const input of [
      { requestedLastStep: 0, expectedPrintedSteps: 359, maximumPassiveLookaheadSteps: 2 },
      { requestedLastStep: 360, expectedPrintedSteps: 359, maximumPassiveLookaheadSteps: 2 },
      { requestedLastStep: 50, expectedPrintedSteps: 359, maximumPassiveLookaheadSteps: -1 },
      { requestedLastStep: 50, expectedPrintedSteps: 359, maximumPassiveLookaheadSteps: 359 },
      { requestedLastStep: 1, expectedPrintedSteps: 1, maximumPassiveLookaheadSteps: 0 },
      {
        requestedLastStep: 1,
        expectedPrintedSteps: Number.MAX_SAFE_INTEGER,
        maximumPassiveLookaheadSteps: 0,
      },
    ]) {
      expect(() => planRealBuildRunPanelWindow({ panels, ...input })).toThrow(
        /bounded requested prefix/iu,
      );
    }
  });

  it("rejects a non-359 contract before touching the supplied panel index", () => {
    let reads = 0;
    const panels = new Proxy([], {
      get() {
        reads += 1;
        throw new Error("non-359 panel index must remain unread");
      },
    });
    expect(() =>
      planRealBuildRunPanelWindow({
        panels,
        requestedLastStep: 1,
        expectedPrintedSteps: Number.MAX_SAFE_INTEGER,
        maximumPassiveLookaheadSteps: 0,
      }),
    ).toThrow(/fixed 359-step source\/index contract/u);
    expect(reads).toBe(0);
  });

  it("reads the fixed source index through bounded data descriptors, never row getters", () => {
    let reads = 0;
    const panels = Array.from({ length: 359 }, (_, index) => ({ stepNumber: index + 1 }));
    const proxy = new Proxy(panels, {
      get() {
        reads += 1;
        throw new Error("ordinary array reads are forbidden");
      },
    });
    expect(
      planRealBuildRunPanelWindow({
        panels: proxy,
        requestedLastStep: 50,
        expectedPrintedSteps: 359,
        maximumPassiveLookaheadSteps: 2,
      }).observationPanels,
    ).toHaveLength(52);
    expect(reads).toBe(0);

    Object.defineProperty(panels, "50", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        throw new Error("source accessor must remain unread");
      },
    });
    expect(() =>
      planRealBuildRunPanelWindow({
        panels,
        requestedLastStep: 50,
        expectedPrintedSteps: 359,
        maximumPassiveLookaheadSteps: 2,
      }),
    ).toThrow(/row 50 is absent or an accessor/u);
    expect(reads).toBe(0);
  });
});
