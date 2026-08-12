import { describe, expect, it } from "vitest";

import { preflightRealBuildOptions } from "../e2e/real-build-contract";
import { completeRealBuildTestOptions } from "./real-build-test-options";

describe("trusted real-build test options", () => {
  it("satisfies the complete 359-step and 1464-identity preflight contract", () => {
    expect(preflightRealBuildOptions(completeRealBuildTestOptions(2))).toEqual([]);
  });

  // The prefix case above exercises neither full-set clause: preflight requires
  // panel and action totals to reach the official set totals only when step 359
  // is requested. Without this, the accounting constant could be changed to any
  // self-consistent set of numbers and every unit test would still pass — which
  // is how the constant sat 26 pieces away from the published callouts.
  it("satisfies the full-set accounting clause at the last printed step", () => {
    expect(preflightRealBuildOptions(completeRealBuildTestOptions(359))).toEqual([]);
  });

  it("refuses unbounded or unreachable farther-panel policy", () => {
    const options = completeRealBuildTestOptions(2);
    expect(preflightRealBuildOptions({ ...options, fartherPanelMaximumReachSteps: 0 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inputKey: "fartherPanelMaximumReachSteps" }),
      ]),
    );
    expect(preflightRealBuildOptions({ ...options, fartherPanelRenderBudget: 17 })).toEqual(
      expect.arrayContaining([expect.objectContaining({ inputKey: "fartherPanelRenderBudget" })]),
    );
  });
});
