import { describe, expect, it } from "vitest";

import { resolveStep7Gate3InvocationPolicy } from "../e2e/real-build-step7-gate3-runner-policy";

describe("Gate-3 diagnostic invocation policy", () => {
  it("skips only an ordinary non-requested run", () => {
    expect(
      resolveStep7Gate3InvocationPolicy({
        diagnostic: false,
        parentOnly: false,
        prewarm: false,
        sampleBookletAvailable: false,
      }),
    ).toEqual({
      status: "skip",
      reason:
        "set LEGO_GATE3_STEP7_DIAGNOSTIC=1 or LEGO_GATE3_STEP7_PARENT_ONLY=1 for a Gate-3 control",
    });
  });

  it.each([
    { diagnostic: true, parentOnly: false, label: "diagnostic" },
    { diagnostic: false, parentOnly: true, label: "parent-only control" },
  ])("fails closed when the requested $label has no booklet", (mode) => {
    expect(() =>
      resolveStep7Gate3InvocationPolicy({
        diagnostic: mode.diagnostic,
        parentOnly: mode.parentOnly,
        prewarm: false,
        sampleBookletAvailable: false,
      }),
    ).toThrow(
      `Gate-3 ${mode.label} was requested, but recipes/6651557.pdf was not found in this checkout or its parent directories; provide that exact sample booklet or unset the Gate-3 mode.`,
    );
  });

  it.each([
    { diagnostic: true, parentOnly: true, prewarm: false, modes: "diagnostic, parent-only" },
    { diagnostic: true, parentOnly: false, prewarm: true, modes: "diagnostic, prewarm" },
    { diagnostic: false, parentOnly: true, prewarm: true, modes: "parent-only, prewarm" },
  ])("refuses conflicting $modes modes before checking inputs", (mode) => {
    expect(() =>
      resolveStep7Gate3InvocationPolicy({
        diagnostic: mode.diagnostic,
        parentOnly: mode.parentOnly,
        prewarm: mode.prewarm,
        sampleBookletAvailable: false,
      }),
    ).toThrow(
      `Gate-3 invocation selected conflicting modes ${mode.modes}; set exactly one of LEGO_GATE3_STEP7_DIAGNOSTIC, LEGO_GATE3_STEP7_PARENT_ONLY, or LEGO_GATE3_STEP7_PREWARM to 1.`,
    );
  });

  it("allows a prewarm without the booklet and a requested run with it", () => {
    expect(
      resolveStep7Gate3InvocationPolicy({
        diagnostic: false,
        parentOnly: false,
        prewarm: true,
        sampleBookletAvailable: false,
      }),
    ).toEqual({ status: "run" });
    expect(
      resolveStep7Gate3InvocationPolicy({
        diagnostic: false,
        parentOnly: true,
        prewarm: false,
        sampleBookletAvailable: true,
      }),
    ).toEqual({ status: "run" });
  });
});
