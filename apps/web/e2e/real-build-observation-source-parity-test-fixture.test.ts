import { describe, expect, it } from "vitest";

import { createRealBuildSourceParityTestServedEvidence } from "./real-build-observation-source-parity-test-fixture";

describe("source-parity test fixture detachment", () => {
  it("returns fresh source-file rows instead of exposing module-private fixture state", () => {
    const first = createRealBuildSourceParityTestServedEvidence();
    const originalPath = first.sourceFiles[0]!.path;
    (first.sourceFiles[0] as { path: string }).path = "poisoned.ts";

    const second = createRealBuildSourceParityTestServedEvidence();
    expect(second.sourceFiles[0]!.path).toBe(originalPath);
    expect(second.sourceFiles[0]).not.toBe(first.sourceFiles[0]);
  });
});
