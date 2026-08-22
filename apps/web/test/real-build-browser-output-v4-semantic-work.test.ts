import { describe, expect, it, vi } from "vitest";

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

import {
  inspectRealBuildCompiledPlacementLineageReplayWork,
  inspectRealBuildCompiledPlacementLineageWork,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
} from "../e2e/real-build-compiled-placement-lineage-parser";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { validateRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage-validation";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS } from "../e2e/real-build-prepared-search-boundary";
import { realBuildBrowserOutputV4SemanticTwoStepFixture } from "./real-build-browser-output-v4-semantic-two-step.fixture";
import {
  bindLineageToPreparedRun,
  branchFixture,
  branchFixtures,
  inspect,
  preparedRunBytes,
} from "./real-build-browser-output-v4-semantic.fixture";
import { compiledPlacementLineageBytes } from "./real-build-compiled-placement-lineage.fixture";

describe("browser-output /4 cumulative compiler-work semantics", () => {
  it("admits a genuine compiler-produced two-step lineage without granting authority", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture();
    const firstInspection = inspectRealBuildCompiledPlacementLineageWork(
      fixture.step1.lineageBytes,
    );
    const secondInspection = inspectRealBuildCompiledPlacementLineageWork(
      fixture.step2.lineageBytes,
    );
    const firstReplayInspection =
      inspectRealBuildCompiledPlacementLineageReplayWork(firstInspection);
    expect(() =>
      validateRealBuildCompiledPlacementLineageReplayWorkInspection({
        ...firstReplayInspection,
      }),
    ).toThrow(/exact branded replay-work inspection/iu);
    const firstReplayWork = firstReplayInspection.work;
    const secondReplayWork =
      inspectRealBuildCompiledPlacementLineageReplayWork(secondInspection).work;
    const placementOperations = (lineage: typeof fixture.step1.lineage): number =>
      lineage.uniqueTransitions[0]!.pieces.reduce(
        (total, piece) => total + 1 + piece.connections.length,
        0,
      );
    expect(
      firstReplayWork.compilerReplayOperations - placementOperations(fixture.step1.lineage),
    ).toBe(2);
    expect(
      secondReplayWork.compilerReplayOperations - placementOperations(fixture.step2.lineage),
    ).toBe(1);
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    const result = inspect(
      branchFixtures(
        fixture.steps.map(({ stepNumber, lineageBytes }) => ({
          indexedStep: stepNumber,
          lineageBytes,
        })),
      ),
      fixture.preparedRunInputBytes,
    );

    expect(result.steps).toHaveLength(2);
    expect(result.steps.every(({ lineageStatus }) => lineageStatus === "unresolved")).toBe(true);
    expect(result.coverageAuthority).toBe("absent");
    expect(result.placementAuthority.authorized).toBe(false);
    expect(result.completionAuthority.authorized).toBe(false);
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("refuses genuine individually admissible compiler work at the cumulative graph limit", () => {
    const fixture = realBuildBrowserOutputV4SemanticTwoStepFixture(200, 100);
    const graphVisits = fixture.steps.map(
      ({ lineageBytes }) =>
        inspectRealBuildCompiledPlacementLineageReplayWork(
          inspectRealBuildCompiledPlacementLineageWork(lineageBytes),
        ).work.compilerGraphVisits,
    );
    expect(graphVisits[0]).toBeLessThanOrEqual(2_000_000);
    expect(graphVisits[1]).toBeLessThanOrEqual(2_000_000);
    const aggregateGraphVisits = graphVisits[0]! + graphVisits[1]!;
    expect(aggregateGraphVisits).toBeGreaterThan(2_000_000);
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
        `aggregates ${aggregateGraphVisits} compiler graph-visit work-policy units; maximum is 2000000`,
        "iu",
      ),
    );
    expect(validate).toHaveBeenCalledTimes(1);
  }, 30_000);

  it("charges cumulative search-parent rows before reconstructing a later root", () => {
    const preparedBytes = preparedRunBytes();
    const first = bindLineageToPreparedRun(preparedBytes);
    const repeatedParent = first.searchRequest.parents[0]!;
    const second = {
      ...first,
      throughStepNumber: 2,
      searchRequest: {
        ...first.searchRequest,
        parents: Array.from(
          { length: MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS - 7 },
          () => repeatedParent,
        ),
      },
    };
    const snapshot = vi.mocked(createRealBuildCandidateDocumentSnapshot);
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    snapshot.mockClear();
    inspect(branchFixture({ lineageBytes: compiledPlacementLineageBytes(first) }), preparedBytes);
    const oneStepSnapshotCalls = snapshot.mock.calls.length;
    expect(oneStepSnapshotCalls).toBeGreaterThan(0);
    snapshot.mockClear();
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixtures([
          { indexedStep: 1, lineageBytes: compiledPlacementLineageBytes(first) },
          { indexedStep: 2, lineageBytes: compiledPlacementLineageBytes(second) },
        ]),
        preparedBytes,
      ),
    ).toThrow(/aggregates 8193 search parents; maximum is 8192/iu);
    expect(snapshot).toHaveBeenCalledTimes(oneStepSnapshotCalls);
    expect(validate).toHaveBeenCalledTimes(1);
  });
});
