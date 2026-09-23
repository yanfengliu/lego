import { describe, expect, it } from "vitest";

import {
  createRealBuildPrefix50IncompleteRunBoundary,
  REAL_BUILD_PREFIX50_INCOMPLETE_RUN_MANIFEST,
  realBuildPrefix50ExactCompilationCommitment,
  requireRealBuildPrefix50IncompleteRunBoundary,
} from "../e2e/real-build-prefix50-incomplete-run-boundary";
import type { RealBuildPrefix50ExactCompilation } from "../e2e/real-build-prefix50-exact-compiler";

describe("prefix-50 incomplete-run authority boundary", () => {
  it("declares an exact replay-only Step-50 boundary with no completion or acceptance authority", () => {
    expect(REAL_BUILD_PREFIX50_INCOMPLETE_RUN_MANIFEST).toEqual({
      schemaVersion: "lego.real-build-prefix50-incomplete-run-manifest/2",
      sourceSetId: "6651557",
      exactBoundary: "printed-steps-1-through-50-only",
      terminalPolicy: "intentional-detached-step50-subassembly/1",
      validationPolicy: "sole-disconnected-assembly-blocker-plus-two-hard-valid-components/1",
      authorityPolicy: "replay-evidence-only-no-patch-completion-or-acceptance/1",
      step45PlacementPolicy: "single-relational-enumeration-no-generic-transform-search/1",
      step51Inspected: false,
    });
    expect(Object.isFrozen(REAL_BUILD_PREFIX50_INCOMPLETE_RUN_MANIFEST)).toBe(true);
  });

  it("rejects caller-shaped compilations, extra arguments, and boundary clones", () => {
    expect(() => createRealBuildPrefix50IncompleteRunBoundary({})).toThrow(
      /runtime-branded real-evidence compilation/u,
    );
    expect(() =>
      (createRealBuildPrefix50IncompleteRunBoundary as (...args: unknown[]) => unknown)({}, {}),
    ).toThrow(/accepts only one runtime-branded exact compilation/u);
    expect(() => requireRealBuildPrefix50IncompleteRunBoundary({})).toThrow(
      /runtime-branded incomplete-run boundary/u,
    );
  });

  it("commits the complete compilation including replay trace, counters, and repairs", () => {
    const baseline = {
      schemaVersion: "lego.real-build-prefix50-exact-compilation/6",
      playbackTrace: { transitions: [{ printedStepNumber: 1, operations: ["add"] }] },
      enumerationCount: 12,
      orientationNarrowedEnumerationCount: 4,
      searchNodeCount: 33,
      sourcePlacementRepairs: [{ occurrenceOrdinal: 281, commitment: "repair-a" }],
    } as unknown as RealBuildPrefix50ExactCompilation;
    const commitment = realBuildPrefix50ExactCompilationCommitment(baseline);
    expect(
      realBuildPrefix50ExactCompilationCommitment({
        ...baseline,
        playbackTrace: {
          transitions: [{ printedStepNumber: 1, operations: ["add", "connect"] }],
        },
      } as unknown as RealBuildPrefix50ExactCompilation),
    ).not.toBe(commitment);
    expect(
      realBuildPrefix50ExactCompilationCommitment({
        ...baseline,
        enumerationCount: 13,
      } as unknown as RealBuildPrefix50ExactCompilation),
    ).not.toBe(commitment);
    expect(
      realBuildPrefix50ExactCompilationCommitment({
        ...baseline,
        orientationNarrowedEnumerationCount: 5,
      } as unknown as RealBuildPrefix50ExactCompilation),
    ).not.toBe(commitment);
    expect(
      realBuildPrefix50ExactCompilationCommitment({
        ...baseline,
        searchNodeCount: 34,
      } as unknown as RealBuildPrefix50ExactCompilation),
    ).not.toBe(commitment);
    expect(
      realBuildPrefix50ExactCompilationCommitment({
        ...baseline,
        sourcePlacementRepairs: [{ occurrenceOrdinal: 281, commitment: "repair-b" }],
      } as unknown as RealBuildPrefix50ExactCompilation),
    ).not.toBe(commitment);
  });
});
