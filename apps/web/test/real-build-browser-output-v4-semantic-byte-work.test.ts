import { describe, expect, it, vi } from "vitest";

const testLimits = vi.hoisted(() => ({ byteVisits: 80 * 1024 * 1024 }));

vi.mock("../e2e/real-build-automatic-placement-step", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-automatic-placement-step")>();
  return {
    ...actual,
    REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS: testLimits.byteVisits,
  };
});

vi.mock("../e2e/real-build-compiled-placement-lineage-validation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../e2e/real-build-compiled-placement-lineage-validation")
    >();
  return {
    ...actual,
    validateRealBuildCompiledPlacementLineage: vi.fn(
      actual.validateRealBuildCompiledPlacementLineage,
    ),
  };
});

import {
  inspectRealBuildCompiledPlacementLineageReplayWork,
  inspectRealBuildCompiledPlacementLineageWork,
} from "../e2e/real-build-compiled-placement-lineage-parser";
import { validateRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage-validation";
import { realBuildBrowserOutputV4SemanticTwoStepFixture } from "./real-build-browser-output-v4-semantic-two-step.fixture";
import { branchFixtures, inspect } from "./real-build-browser-output-v4-semantic.fixture";

describe("browser-output /4 cumulative compiler byte-work semantics", () => {
  it("refuses genuine individually admissible compiler work at a lowered cumulative byte limit", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture(100, 100);
    const work = fixture.steps.map(
      ({ lineageBytes }) =>
        inspectRealBuildCompiledPlacementLineageReplayWork(
          inspectRealBuildCompiledPlacementLineageWork(lineageBytes),
        ).work,
    );
    const byteVisits = work.map(({ compilerByteVisits }) => compilerByteVisits);
    expect(byteVisits.every((visits) => visits <= testLimits.byteVisits)).toBe(true);
    const aggregateByteVisits = byteVisits[0]! + byteVisits[1]!;
    expect(aggregateByteVisits).toBeGreaterThan(testLimits.byteVisits);
    expect(work.reduce((total, step) => total + step.compilerGraphVisits, 0)).toBeLessThanOrEqual(
      2_000_000,
    );
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixtures(
          fixture.steps.map(({ stepNumber, lineageBytes }) => ({
            indexedStep: stepNumber,
            lineageBytes,
          })),
        ),
        fixture.preparedRunInputBytes,
      ),
    ).toThrow(
      new RegExp(
        `aggregates ${aggregateByteVisits} compiler byte-visit work-policy units; maximum is ${testLimits.byteVisits}`,
        "iu",
      ),
    );
    expect(validate).toHaveBeenCalledTimes(1);
  }, 30_000);
});
