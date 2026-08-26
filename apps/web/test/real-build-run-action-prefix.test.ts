import { describe, expect, it } from "vitest";

import {
  assertRealBuildRetainedActionPrefix,
  createRealBuildRunContract,
  realBuildRunBudgets,
  realBuildRunThresholds,
  selectRealBuildExecutablePanels,
} from "../e2e/real-build-run-contract";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";

describe("real-build retained action prefix", () => {
  it("admits only exact current action rows and refuses to filter a supplied tail", () => {
    const options = completeRealBuildTestOptions(2);
    const executablePanels = selectRealBuildExecutablePanels(options.panels, options.lastStep);
    const preparedOptions = { ...options, panels: executablePanels };
    let tailReads = 0;
    const tail = realBuildTransitionPanel(3) as unknown as Record<string, unknown>;
    Object.defineProperty(tail, "stepNumber", {
      enumerable: true,
      get() {
        tailReads += 1;
        throw new Error("rejected tail action must remain unread");
      },
    });
    const actionBearingTail = [...options.panels, tail as never];
    const ordinaryActionBearingTail = [...options.panels, realBuildTransitionPanel(3)];
    expect(() => selectRealBuildExecutablePanels(actionBearingTail, options.lastStep)).toThrow(
      /requires exactly ordered action-bearing steps 1\.\.2.*tail action specs are rejected/su,
    );
    expect(() =>
      createRealBuildRunContract({
        inputDigests: options.inputDigests,
        identificationClosure: {
          source: "deterministic",
          features: REAL_BUILD_TEST_DIGEST,
          match: REAL_BUILD_TEST_DIGEST,
          distances: REAL_BUILD_TEST_DIGEST,
          elements: REAL_BUILD_TEST_DIGEST,
          cards: null,
          cardImages: null,
          answers: null,
          pairJudged: REAL_BUILD_TEST_DIGEST,
        },
        panelSourceDigest: REAL_BUILD_TEST_DIGEST,
        panels: actionBearingTail,
        passivePanels: options.passivePanels,
        budgets: realBuildRunBudgets(options),
        thresholds: realBuildRunThresholds(options),
        codeSnapshots: {},
      }),
    ).toThrow(/tail action specs are rejected/u);
    expect(tailReads).toBe(0);
    const contract = createRealBuildRunContract({
      inputDigests: options.inputDigests,
      identificationClosure: {
        source: "deterministic",
        features: REAL_BUILD_TEST_DIGEST,
        match: REAL_BUILD_TEST_DIGEST,
        distances: REAL_BUILD_TEST_DIGEST,
        elements: REAL_BUILD_TEST_DIGEST,
        cards: null,
        cardImages: null,
        answers: null,
        pairJudged: REAL_BUILD_TEST_DIGEST,
      },
      panelSourceDigest: REAL_BUILD_TEST_DIGEST,
      panels: executablePanels,
      passivePanels: options.passivePanels,
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      codeSnapshots: {},
    });

    expect(preparedOptions.panels.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(contract.actionLedger).toHaveLength(2);
    const actionStepNumbers = contract.actionLedger.map((row) =>
      typeof row === "object" && row !== null && "stepNumber" in row ? row.stepNumber : undefined,
    );
    expect(actionStepNumbers).toEqual([1, 2]);
    expect(Math.max(...(actionStepNumbers as number[]))).toBe(options.lastStep);
    expect(() =>
      assertRealBuildRetainedActionPrefix({ contract, options: preparedOptions }),
    ).not.toThrow();
    expect(() =>
      assertRealBuildRetainedActionPrefix({
        contract,
        options: { ...options, panels: ordinaryActionBearingTail },
      }),
    ).toThrow(/prepared-options panels must each contain exactly executable printed steps 1\.\.2/u);

    expect(() =>
      selectRealBuildExecutablePanels([options.panels[1]!, options.panels[0]!], options.lastStep),
    ).toThrow(/row 0 names 2 instead of 1/u);
  });

  it("rejects hostile huge prefix bounds before constructing expected action rows", () => {
    const options = completeRealBuildTestOptions(1);
    expect(() => selectRealBuildExecutablePanels(options.panels, Number.MAX_SAFE_INTEGER)).toThrow(
      /requested last step from 1 through 359/u,
    );
    expect(() =>
      assertRealBuildRetainedActionPrefix({
        contract: { actionLedger: [] } as never,
        options: {
          ...options,
          expectedPrintedSteps: Number.MAX_SAFE_INTEGER,
          lastStep: Number.MAX_SAFE_INTEGER,
        } as never,
      }),
    ).toThrow(/fixed 359-step source\/index contract/u);
  });
});
