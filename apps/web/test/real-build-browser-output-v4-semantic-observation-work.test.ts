import { beforeEach, describe, expect, it, vi } from "vitest";

const testLimits = vi.hoisted(() => ({
  searchParents: 8_192,
  sources: 8_192,
  cameras: 8_192,
  selectedLineageReferences: 8_192,
  acceptedLineageReferences: 8_192,
  acceptedTransitionReferences: 8_192,
}));

vi.mock("../e2e/real-build-browser-output-v4-semantic-limits", () => ({
  REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS: testLimits,
}));

vi.mock("../e2e/real-build-candidate-document-snapshot", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-candidate-document-snapshot")>();
  return {
    ...actual,
    createRealBuildCandidateDocumentSnapshot: vi.fn(
      actual.createRealBuildCandidateDocumentSnapshot,
    ),
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

import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { validateRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage-validation";
import { realBuildBrowserOutputV4SemanticTwoStepFixture } from "./real-build-browser-output-v4-semantic-two-step.fixture";
import {
  branchFixture,
  branchFixtures,
  inspect,
  rebindObservationClosureForLineage,
} from "./real-build-browser-output-v4-semantic.fixture";

function selectedTwoStepFixture() {
  const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
  const closures = fixture.steps.map((step) =>
    rebindObservationClosureForLineage(
      fixture.preparedRunInputBytes,
      step.lineage,
      step.lineageBytes,
    ),
  );
  return { fixture, closures };
}

describe("browser-output /4 cumulative observation-table semantics", () => {
  beforeEach(() => {
    Object.assign(testLimits, {
      searchParents: 8_192,
      sources: 8_192,
      cameras: 8_192,
      selectedLineageReferences: 8_192,
      acceptedLineageReferences: 8_192,
      acceptedTransitionReferences: 8_192,
    });
    vi.mocked(createRealBuildCandidateDocumentSnapshot).mockClear();
    vi.mocked(validateRealBuildCompiledPlacementLineage).mockClear();
  });

  it("uses the prepared-search parent ceiling before reconstructing a later root", () => {
    const { fixture } = selectedTwoStepFixture();
    testLimits.searchParents = 1;
    const snapshot = vi.mocked(createRealBuildCandidateDocumentSnapshot);
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    snapshot.mockClear();
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixtures(
          fixture.steps.map((step) => ({
            indexedStep: step.stepNumber,
            lineageBytes: step.lineageBytes,
          })),
        ),
        fixture.preparedRunInputBytes,
      ),
    ).toThrow(/aggregates 2 search parents; maximum is 1/iu);
    expect(snapshot).toHaveBeenCalled();
    expect(validate).toHaveBeenCalledTimes(1);
  });

  for (const field of ["sources", "cameras"] as const) {
    it(`charges cumulative observation ${field} before reconstructing a later root`, () => {
      const { fixture, closures } = selectedTwoStepFixture();
      testLimits[field] = 1;
      const snapshot = vi.mocked(createRealBuildCandidateDocumentSnapshot);
      const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
      snapshot.mockClear();
      validate.mockClear();

      inspect(
        branchFixture({
          indexedStep: 1,
          lineageBytes: closures[0]!.lineageBytes,
          closureBytes: closures[0]!.closureBytes,
          roleBytes: closures[0]!.roleBytes,
        }),
        fixture.preparedRunInputBytes,
      );
      const oneStepSnapshotCalls = snapshot.mock.calls.length;
      expect(oneStepSnapshotCalls).toBeGreaterThan(0);
      snapshot.mockClear();
      validate.mockClear();

      expect(() =>
        inspect(
          branchFixtures(
            closures.map((closure, index) => ({
              indexedStep: index + 1,
              lineageBytes: closure.lineageBytes,
              closureBytes: closure.closureBytes,
              roleBytes: closure.roleBytes,
            })),
          ),
          fixture.preparedRunInputBytes,
        ),
      ).toThrow(new RegExp(`aggregates 2 observation ${field}; maximum is 1`, "iu"));
      expect(snapshot).toHaveBeenCalledTimes(oneStepSnapshotCalls);
      expect(validate).toHaveBeenCalledTimes(1);
    });
  }

  for (const [field, label] of [
    ["selectedLineageReferences", "selected lineage references"],
    ["acceptedLineageReferences", "accepted lineage references"],
    ["acceptedTransitionReferences", "accepted transition references"],
  ] as const) {
    it(`charges ${label} before lineage reconstruction`, () => {
      const { fixture, closures } = selectedTwoStepFixture();
      testLimits[field] = 0;
      const snapshot = vi.mocked(createRealBuildCandidateDocumentSnapshot);
      const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
      snapshot.mockClear();
      validate.mockClear();

      expect(() =>
        inspect(
          branchFixture({
            indexedStep: 1,
            lineageBytes: closures[0]!.lineageBytes,
            closureBytes: closures[0]!.closureBytes,
            roleBytes: closures[0]!.roleBytes,
          }),
          fixture.preparedRunInputBytes,
        ),
      ).toThrow(new RegExp(`aggregates 1 ${label}; maximum is 0`, "iu"));
      expect(snapshot).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
    });
  }
});
