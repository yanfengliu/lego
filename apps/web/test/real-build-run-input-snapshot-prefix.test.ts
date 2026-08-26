import { describe, expect, it } from "vitest";

import {
  realBuildRunInputDriftFailure,
  snapshotRealBuildRunInput,
} from "../e2e/real-build-run-input-snapshot";
import { completeRealBuildTestOptions, realBuildTransitionPanel } from "./real-build-test-options";

describe("real-build input snapshot prefix boundary", () => {
  it("retains the complete 359-step execution boundary without an unbounded suffix", () => {
    const snapshot = snapshotRealBuildRunInput(completeRealBuildTestOptions(359));
    expect(snapshot.options.panels).toHaveLength(359);
    expect(snapshot.options.passivePanels).toEqual([]);
  });

  it("refuses tail actions and every extra passive field without invoking getters", () => {
    const options = completeRealBuildTestOptions(50);
    let hostileReads = 0;
    const hostileTail = new Proxy(realBuildTransitionPanel(51), {
      get(target, property, receiver) {
        if (property !== "stepNumber") {
          hostileReads += 1;
          throw new Error(`tail execution field ${String(property)} must remain unread`);
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    expect(() =>
      snapshotRealBuildRunInput({
        ...options,
        panels: [...options.panels, hostileTail],
      }),
    ).toThrow(/action-bearing printed step 51 above requested step 50/u);
    expect(hostileReads).toBe(0);

    for (const field of [
      "action",
      "pieces",
      "mappedCalloutKeys",
      "placementAuthority",
      "authenticatedPlacements",
      "completionAuthority",
    ]) {
      const passive = { ...options.passivePanels[0]! } as Record<string, unknown>;
      Object.defineProperty(passive, field, {
        enumerable: true,
        get() {
          hostileReads += 1;
          throw new Error(`passive ${field} getter must remain unread`);
        },
      });
      expect(() =>
        snapshotRealBuildRunInput({
          ...options,
          passivePanels: [passive as never],
        }),
      ).toThrow(new RegExp(`unsupported own field "${field}"`, "u"));
      expect(hostileReads).toBe(0);
    }
  });

  it("preserves every raster-only passive field and detects later drift", () => {
    const options = completeRealBuildTestOptions(50);
    const passive = { ...options.passivePanels[0]! };
    const snapshot = snapshotRealBuildRunInput({
      ...options,
      passivePanels: [passive, options.passivePanels[1]!],
    });

    expect(snapshot.options.panels).toHaveLength(50);
    expect(snapshot.options.panels.at(-1)?.stepNumber).toBe(50);
    expect(snapshot.options.passivePanels.map(({ stepNumber }) => stepNumber)).toEqual([51, 52]);
    expect(snapshot.options.passivePanels[0]).toEqual(passive);
    expect(realBuildRunInputDriftFailure(snapshot)).toBeNull();

    passive.minXPt += 1;
    expect(realBuildRunInputDriftFailure(snapshot)).toMatchObject({
      code: "printed-step-sequence-invalid",
      stage: "input",
    });
  });

  it("rejects arbitrary nested authority-like fields instead of projecting them away", () => {
    const options = completeRealBuildTestOptions(50);
    for (const field of ["action", "placementAuthority", "authenticatedPlacements"]) {
      let hostileReads = 0;
      const calloutBox = {
        minXPt: 1,
        maxXPt: 2,
        minYPt: 3,
        maxYPt: 4,
      } as Record<string, unknown>;
      Object.defineProperty(calloutBox, field, {
        enumerable: true,
        get() {
          hostileReads += 1;
          throw new Error(`nested passive ${field} must remain unread`);
        },
      });
      const passive = { ...options.passivePanels[0]!, calloutBoxes: [calloutBox] };

      expect(() =>
        snapshotRealBuildRunInput({
          ...options,
          passivePanels: [passive as never],
        }),
      ).toThrow(new RegExp(`calloutBoxes\\[0\\].*unsupported own field "${field}"`, "u"));
      expect(hostileReads).toBe(0);
    }
  });

  it("rejects passive required-field accessors without invoking them", () => {
    const options = completeRealBuildTestOptions(50);
    let hostileReads = 0;
    const passive = { ...options.passivePanels[0]! } as Record<string, unknown>;
    Object.defineProperty(passive, "minXPt", {
      enumerable: true,
      get() {
        hostileReads += 1;
        throw new Error("passive minXPt must remain unread");
      },
    });

    expect(() =>
      snapshotRealBuildRunInput({
        ...options,
        passivePanels: [passive as never],
      }),
    ).toThrow(/passivePanels\[0\]\.minXPt must be one enumerable own data property/u);
    expect(hostileReads).toBe(0);
  });

  it("rejects oversized panel arrays before inspecting any row", () => {
    const options = completeRealBuildTestOptions(1);
    let reads = 0;
    const hostile = new Proxy(realBuildTransitionPanel(1), {
      get() {
        reads += 1;
        throw new Error("oversized rows must remain unread");
      },
    });
    const panels = Array.from({ length: 360 }, () => hostile);

    expect(() => snapshotRealBuildRunInput({ ...options, panels })).toThrow(
      /panels\.length.*no greater than 359/u,
    );
    expect(reads).toBe(0);
  });
});
