import { describe, expect, it } from "vitest";

import { parseRealBuildRequestedLastStep } from "../e2e/real-build-requested-last-step";

describe("real-build requested last step", () => {
  it.each([
    ["1", 1],
    ["50", 50],
    ["359", 359],
  ])("accepts canonical decimal prefix %s", (value, expected) => {
    expect(parseRealBuildRequestedLastStep(value)).toBe(expected);
  });

  it.each([
    [undefined, "missing"],
    ["", "empty"],
    [" 50", "leading whitespace"],
    ["50 ", "trailing whitespace"],
    ["5e1", "exponent"],
    ["0", "zero"],
    ["360", "above the 359-step source/index contract"],
  ])("refuses %s (%s) without numeric coercion", (value, description) => {
    expect(description).not.toHaveLength(0);
    expect(() => parseRealBuildRequestedLastStep(value)).toThrow(
      /LEGO_REAL_BUILD_LAST_STEP must be .*integer from 1 through 359/u,
    );
  });
});
