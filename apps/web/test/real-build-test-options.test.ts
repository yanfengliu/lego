import { describe, expect, it } from "vitest";

import { preflightRealBuildOptions } from "../e2e/real-build-contract";
import { completeRealBuildTestOptions } from "./real-build-test-options";

describe("trusted real-build test options", () => {
  it("satisfies the complete 359-step and 1464-identity preflight contract", () => {
    expect(preflightRealBuildOptions(completeRealBuildTestOptions(2))).toEqual([]);
  });
});
