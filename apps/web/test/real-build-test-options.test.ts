import { describe, expect, it } from "vitest";

import { preflightRealBuildOptions } from "../e2e/real-build-contract";
import { preflightRealBuildPanelPrefix } from "../e2e/real-build-panel-prefix-preflight";
import { completeRealBuildTestOptions } from "./real-build-test-options";

describe("trusted real-build test options", () => {
  it("satisfies a bounded executable prefix under the fixed 359-step source contract", () => {
    expect(preflightRealBuildOptions(completeRealBuildTestOptions(2))).toEqual([]);
  });

  it("refuses hostile huge prefix bounds without allocating from them", () => {
    const options = completeRealBuildTestOptions(1);
    const failures = preflightRealBuildPanelPrefix({
      panels: options.panels,
      passivePanels: options.passivePanels,
      expectedPrintedSteps: Number.MAX_SAFE_INTEGER,
      lastStep: Number.MAX_SAFE_INTEGER,
      fartherPanelMaximumReachSteps: options.fartherPanelMaximumReachSteps,
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inputKey: "lastStep" }),
        expect.objectContaining({ inputKey: "panels" }),
      ]),
    );
  });

  it("accepts an optional passive raster subset and rejects passive authority or excess reach", () => {
    const options = completeRealBuildTestOptions(2);
    expect(preflightRealBuildOptions({ ...options, passivePanels: [] })).toEqual([]);
    expect(
      preflightRealBuildOptions({
        ...options,
        passivePanels: options.passivePanels.slice(0, 1),
      }),
    ).toEqual([]);

    const authorityBearingPassive = {
      ...options.passivePanels[0]!,
      action: options.panels[0]!.action,
    };
    expect(
      preflightRealBuildOptions({ ...options, passivePanels: [authorityBearingPassive] }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ inputKey: "passivePanels" })]));

    const beyondReach = {
      ...options.passivePanels[0]!,
      stepNumber: options.lastStep + options.fartherPanelMaximumReachSteps + 1,
    };
    expect(preflightRealBuildOptions({ ...options, passivePanels: [beyondReach] })).toEqual(
      expect.arrayContaining([expect.objectContaining({ inputKey: "passivePanels" })]),
    );

    const uninspectablePassive = new Proxy(options.passivePanels[0]!, {
      ownKeys() {
        throw new TypeError("hostile descriptor trap");
      },
    });
    expect(() =>
      preflightRealBuildOptions({ ...options, passivePanels: [uninspectablePassive] }),
    ).not.toThrow();
    expect(
      preflightRealBuildOptions({ ...options, passivePanels: [uninspectablePassive] }),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ inputKey: "passivePanels" })]));
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

  it("requires a bounded whole-D4 panel-camera lineage allowance", () => {
    const options = completeRealBuildTestOptions(2);
    for (const panelCameraBranchBudget of [undefined, 7, 10, 800_008, Number.NaN]) {
      expect(
        preflightRealBuildOptions({ ...options, panelCameraBranchBudget } as typeof options),
      ).toEqual(
        expect.arrayContaining([expect.objectContaining({ inputKey: "panelCameraBranchBudget" })]),
      );
    }
  });
});
