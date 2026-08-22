import { describe, expect, it, vi } from "vitest";

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
  inspectRealBuildBrowserBranchDetailedEvidence,
  REAL_BUILD_BROWSER_BRANCH_DETAILED_INSPECTION_SCHEMA_VERSION,
  REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION,
  requireRealBuildBrowserBranchDetailedInspection,
} from "../e2e/real-build-browser-output-v4-semantic";
import { REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS } from "../e2e/real-build-automatic-placement-step";
import {
  inspectRealBuildCompiledObservationPreflight,
  inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork,
} from "../e2e/real-build-compiled-observation-closure-preflight";
import { deriveRealBuildCompiledTransitionId } from "../e2e/real-build-compiled-placement-lineage-digest";
import {
  inspectRealBuildCompiledPlacementLineageWork,
  inspectRealBuildCompiledPlacementLineageReplayWork,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
  validateRealBuildCompiledPlacementLineageWorkInspection,
} from "../e2e/real-build-compiled-placement-lineage-parser";
import { MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS } from "../e2e/real-build-compiled-placement-lineage-types";
import { validateRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage-validation";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
} from "../e2e/real-build-prepared-search-boundary";
import { inspectRealBuildPreparedObservationPolicy } from "../e2e/real-build-prepared-step-authority";
import {
  DIFFERENT_PRINTED_STEP_IDENTITY,
  bindLineageToPreparedRun,
  branchFixture,
  branchFixtures,
  inspect,
  legacySelectedLineage,
  preparedRunBytes,
  rebindObservationClosure,
} from "./real-build-browser-output-v4-semantic.fixture";
import {
  compiledPlacementLineageBytes,
  compiledPlacementLineageFixture,
} from "./real-build-compiled-placement-lineage.fixture";

describe("browser-output /4 refusal-only branch semantics", () => {
  it("cross-binds one compiled lineage to exact prepared input without granting coverage", () => {
    const preparedBytes = preparedRunBytes();
    const lineageBytes = compiledPlacementLineageBytes(bindLineageToPreparedRun(preparedBytes));
    const result = inspect(branchFixture({ lineageBytes }), preparedBytes);

    expect(result.schemaVersion).toBe(REAL_BUILD_BROWSER_BRANCH_SEMANTIC_INSPECTION_SCHEMA_VERSION);
    expect(result.coverageAuthority).toBe("absent");
    expect(result.steps).toEqual([
      expect.objectContaining({
        stepNumber: 1,
        lineageStatus: "unresolved",
        rootLineages: 8,
        observationClosure: "absent",
        allObservationRowsScored: null,
        selectionStatus: "unresolved",
        acceptedTransitionInspected: false,
        provenanceAuthority: "absent",
      }),
    ]);
    expect(result.placementAuthority.authorized).toBe(false);
    expect(result.completionAuthority.authorized).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.steps)).toBe(true);
    expect(Object.isFrozen(result.steps[0])).toBe(true);
  });

  it("retains one branded detailed replay for later exact frontier and provenance continuity", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const branch = branchFixture(closure);
    const detailed = inspectRealBuildBrowserBranchDetailedEvidence(
      branch.indexBytes,
      branch.compiled,
      branch.roleBytes,
      preparedBytes,
    );

    expect(detailed.schemaVersion).toBe(
      REAL_BUILD_BROWSER_BRANCH_DETAILED_INSPECTION_SCHEMA_VERSION,
    );
    expect(detailed.authority).toBe("absent");
    expect(detailed.semantic.steps[0]!.selectionStatus).toBe("selected");
    expect(detailed.steps).toHaveLength(1);
    expect(detailed.steps[0]).toMatchObject({
      stepNumber: 1,
      preparedStep: {
        stepNumber: 1,
        authority: "absent",
      },
      lineageInspection: {
        evidence: {
          throughStepNumber: 1,
        },
      },
      closure: {
        selection: { status: "selected" },
      },
      observation: {
        reproducible: true,
        provenanceAuthority: "absent",
        authority: "absent",
      },
    });
    expect(detailed.steps[0]!.index).toBe(detailed.branch.steps[0]);
    expect(Object.isFrozen(detailed)).toBe(true);
    expect(Object.isFrozen(detailed.steps)).toBe(true);
    expect(requireRealBuildBrowserBranchDetailedInspection(detailed)).toBe(detailed);
    expect(() => requireRealBuildBrowserBranchDetailedInspection({ ...detailed })).toThrow(
      /exact authority-free result/u,
    );
  });

  it("replays a selected observation closure but keeps its transition inspection-only", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const result = inspect(branchFixture(closure), preparedBytes);

    expect(result.steps[0]).toEqual(
      expect.objectContaining({
        observationClosure: "verified",
        allObservationRowsScored: true,
        selectionStatus: "selected",
        acceptedTransitionInspected: true,
        provenanceAuthority: "absent",
        completionAuthority: expect.objectContaining({ authorized: false }),
      }),
    );
    expect(result.placementAuthority.reason).toMatch(/source-camera-and-terminal/iu);
  });

  it("retains one typed budget terminal row and refuses any later branch suffix", () => {
    const preparedBytes = preparedRunBytes();
    const source = bindLineageToPreparedRun(preparedBytes);
    const requested = source.searchRequest.offeredLineages;
    const terminal = {
      ...source,
      status: "budget-refused" as const,
      searchReservation: {
        budget: requested - 1,
        reservedBefore: 0,
        requested,
        reservedAfter: 0,
        reservationNumber: 1,
        admitted: false,
        refusal: "budget-exceeded" as const,
        terminalFailure: {
          preflightIdentity: source.searchRequest.preflightIdentity,
          reservationNumber: 1,
          reservedBefore: 0,
          requested,
          budget: requested - 1,
        },
      },
      terminalFailure: null,
      childCandidates: [],
      uniqueTransitions: [],
      lineageEdges: [],
      selection: {
        status: "not-applicable" as const,
        decisionPanelStepNumber: null,
        selectedCandidateId: null,
        selectedLineageIds: [],
        bestScore: null,
        runnerUpScore: null,
        margin: null,
      },
      acceptedTransition: null,
    };
    const terminalBytes = compiledPlacementLineageBytes(terminal);
    const accepted = inspect(branchFixture({ lineageBytes: terminalBytes }), preparedBytes);

    expect(accepted.steps[0]).toMatchObject({
      lineageStatus: "budget-refused",
      childCandidates: 0,
      lineageEdges: 0,
      observationClosure: "absent",
      selectionStatus: "not-applicable",
      acceptedTransitionInspected: false,
    });
    expect(() =>
      inspect(
        branchFixtures([
          { indexedStep: 1, lineageBytes: terminalBytes },
          { indexedStep: 2, lineageBytes: terminalBytes },
        ]),
        preparedBytes,
      ),
    ).toThrow(/step 2 follows terminal compiled step 1/iu);
  });

  it("admits observation preflight only from the exact replay-admitted work inspection", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const policy = inspectRealBuildPreparedObservationPolicy(preparedBytes);
    const inspection = inspectRealBuildCompiledPlacementLineageWork(closure.lineageBytes);
    expect(() =>
      inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
        { ...inspection },
        closure.closureBytes,
        policy,
      ),
    ).toThrow(/exact branded structural work inspection/iu);
    expect(() =>
      inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
        inspection,
        closure.closureBytes,
        policy,
      ),
    ).toThrow(/prior replay-work admission and semantic validation/iu);
    validateRealBuildCompiledPlacementLineageWorkInspection(inspection);
    expect(() =>
      inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
        inspection,
        closure.closureBytes,
        policy,
      ),
    ).toThrow(/prior replay-work admission and semantic validation/iu);
    validateRealBuildCompiledPlacementLineageReplayWorkInspection(
      inspectRealBuildCompiledPlacementLineageReplayWork(inspection),
    );
    expect(
      inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
        inspection,
        closure.closureBytes,
        policy,
      ).lineage,
    ).toBe(inspection.evidence);
  });

  it("refuses index-to-lineage step drift", () => {
    const preparedBytes = preparedRunBytes();
    const lineageBytes = compiledPlacementLineageBytes(bindLineageToPreparedRun(preparedBytes));
    expect(() => inspect(branchFixture({ indexedStep: 2, lineageBytes }), preparedBytes)).toThrow(
      /index step 2 contains compiled lineage through step 1/iu,
    );
  });

  it("refuses a self-consistent compiled graph bound to a different printed-step identity", () => {
    const preparedBytes = preparedRunBytes();
    const lineageBytes = compiledPlacementLineageBytes(
      bindLineageToPreparedRun(
        preparedBytes,
        compiledPlacementLineageFixture(),
        DIFFERENT_PRINTED_STEP_IDENTITY,
      ),
    );
    expect(() => inspect(branchFixture({ lineageBytes }), preparedBytes)).toThrow(
      /exact inspected prepared-run digest and printed-step identity/iu,
    );
  });

  it("refuses prepared-run drift even when the indexed step remains locally valid", () => {
    const preparedBytes = preparedRunBytes();
    const lineageBytes = compiledPlacementLineageBytes(bindLineageToPreparedRun(preparedBytes));
    expect(() => inspect(branchFixture({ lineageBytes }), preparedRunBytes(0.61))).toThrow(
      /exact inspected prepared-run digest and printed-step identity/iu,
    );
  });

  it("replays a raw-empty closure without misreporting every row as scored", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes, "raw-empty");
    const result = inspect(branchFixture(closure), preparedBytes);

    expect(result.steps[0]).toEqual(
      expect.objectContaining({
        observationClosure: "verified",
        allObservationRowsScored: false,
        selectionStatus: "unresolved",
        acceptedTransitionInspected: false,
        provenanceAuthority: "absent",
      }),
    );
    expect(result.completionAuthority.authorized).toBe(false);
  });

  it("refuses legacy selected lineage when no typed closure and raw role were transported", () => {
    const preparedBytes = preparedRunBytes();
    const lineage = legacySelectedLineage(bindLineageToPreparedRun(preparedBytes));
    expect(() =>
      inspect(
        branchFixture({ lineageBytes: compiledPlacementLineageBytes(lineage) }),
        preparedBytes,
      ),
    ).toThrow(/received compiled lineage status "selected"; expected "unresolved"/iu);
  });

  it("refuses prepared proposal identity, catalog, color, or order drift before replay", () => {
    const preparedBytes = preparedRunBytes();
    const source = bindLineageToPreparedRun(preparedBytes);
    const first = source.searchRequest.proposals[0]!;
    const lineage = {
      ...source,
      searchRequest: {
        ...source.searchRequest,
        proposals: [
          {
            ...first,
            pieces: [{ ...first.pieces[0]!, identityKey: "different-prepared-piece" }],
          },
          ...source.searchRequest.proposals.slice(1),
        ],
      },
    };
    expect(() =>
      inspect(
        branchFixture({ lineageBytes: compiledPlacementLineageBytes(lineage) }),
        preparedBytes,
      ),
    ).toThrow(/exact ordered identity, catalog part, and color rows/iu);
  });

  it("refuses prepared compiler metadata and transition printed-step metadata drift", () => {
    const preparedBytes = preparedRunBytes();
    const source = bindLineageToPreparedRun(preparedBytes);
    const preparedDrift = {
      ...source,
      preparedStep: {
        ...source.preparedStep,
        compilerMetadata: { ...source.preparedStep.compilerMetadata, name: "Prepared drift" },
      },
    };
    expect(() =>
      inspect(
        branchFixture({ lineageBytes: compiledPlacementLineageBytes(preparedDrift) }),
        preparedBytes,
      ),
    ).toThrow(/prepared action digest and compiler name/iu);

    const transition = source.uniqueTransitions[0]!;
    const committed = {
      parentCandidateId: transition.parentCandidateId,
      parentDocumentHash: transition.parentDocumentHash,
      childCandidateId: transition.childCandidateId,
      childDocumentHash: transition.childDocumentHash,
      printedStep: { ...transition.printedStep, name: "Transition drift" },
      pieces: transition.pieces,
      receipt: transition.receipt,
    };
    const transitionDrift = {
      transitionId: deriveRealBuildCompiledTransitionId(committed),
      ...committed,
    };
    const transitionLineage = {
      ...source,
      uniqueTransitions: [transitionDrift],
      lineageEdges: source.lineageEdges.map((edge) => ({
        ...edge,
        transitionId: transitionDrift.transitionId,
      })),
    };
    expect(() =>
      inspect(
        branchFixture({ lineageBytes: compiledPlacementLineageBytes(transitionLineage) }),
        preparedBytes,
      ),
    ).toThrow(/exact root, child, and prepared printed step/iu);
  });

  it("labels retained typed failures as verified inspection, never reproduced evidence", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes, "failed");
    const result = inspect(branchFixture(closure), preparedBytes);

    expect(result.steps[0]).toEqual(
      expect.objectContaining({
        observationClosure: "verified",
        allObservationRowsScored: false,
        failedObservations: 8,
        selectionStatus: "unverified-failure",
        acceptedTransitionInspected: false,
      }),
    );
    expect(result.completionAuthority.authorized).toBe(false);
  });

  it("charges cumulative measured work before a later step can enter semantic validation", () => {
    const preparedBytes = preparedRunBytes();
    const first = bindLineageToPreparedRun(preparedBytes);
    const repeatedRoot = first.rootCandidates[0]!.identities[0]!;
    const second = {
      ...first,
      throughStepNumber: 2,
      rootCandidates: [
        {
          ...first.rootCandidates[0]!,
          identities: Array.from(
            { length: MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROOTS - 7 },
            () => repeatedRoot,
          ),
        },
      ],
    };
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixtures([
          { indexedStep: 1, lineageBytes: compiledPlacementLineageBytes(first) },
          { indexedStep: 2, lineageBytes: compiledPlacementLineageBytes(second) },
        ]),
        preparedBytes,
      ),
    ).toThrow(/aggregates 8193 root lineages; maximum is 8192/iu);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it("refuses an orphan-heavy later child frontier before any child document is reconstructed", () => {
    const preparedBytes = preparedRunBytes();
    const first = bindLineageToPreparedRun(preparedBytes);
    const retainedChild = first.childCandidates[0]!;
    const orphanChildren = Array.from(
      { length: MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN - 1 },
      (_, index) => {
        const documentHash = `sha256:${(index + 1).toString(16).padStart(64, "0")}` as const;
        return {
          ...retainedChild,
          candidateId: `document:${documentHash}` as const,
          documentHash,
          canonicalBytesHash: documentHash,
        };
      },
    );
    const second = {
      ...first,
      throughStepNumber: 2,
      childCandidates: [retainedChild, ...orphanChildren],
    };
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixtures([
          { indexedStep: 1, lineageBytes: compiledPlacementLineageBytes(first) },
          { indexedStep: 2, lineageBytes: compiledPlacementLineageBytes(second) },
        ]),
        preparedBytes,
      ),
    ).toThrow(/aggregates 8193 child candidates; maximum is 8192/iu);
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it("charges divergent transition witnesses before exact proposal binding can serialize them", () => {
    const preparedBytes = preparedRunBytes();
    const first = bindLineageToPreparedRun(preparedBytes);
    const transition = first.uniqueTransitions[0]!;
    const piecesPerTransition =
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES -
      REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS;
    const repeatedPieces = Array.from({ length: piecesPerTransition }, () => transition.pieces[0]!);
    const transitionCount =
      Math.floor(MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES / piecesPerTransition) + 1;
    const second = {
      ...first,
      throughStepNumber: 2,
      uniqueTransitions: Array.from({ length: transitionCount }, () => ({
        ...transition,
        pieces: repeatedPieces,
      })),
    };
    const validate = vi.mocked(validateRealBuildCompiledPlacementLineage);
    validate.mockClear();

    expect(() =>
      inspect(
        branchFixtures([
          { indexedStep: 1, lineageBytes: compiledPlacementLineageBytes(first) },
          { indexedStep: 2, lineageBytes: compiledPlacementLineageBytes(second) },
        ]),
        preparedBytes,
      ),
    ).toThrow(
      new RegExp(
        `aggregates ${1 + transitionCount * piecesPerTransition} transition placement witnesses; maximum is ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES}`,
        "iu",
      ),
    );
    expect(validate).toHaveBeenCalledTimes(1);
  });

  it("keeps the bytes-only observation preflight behind the compiler-work brand", () => {
    const preparedBytes = preparedRunBytes();
    const closure = rebindObservationClosure(preparedBytes);
    const source = bindLineageToPreparedRun(preparedBytes);
    const transition = source.uniqueTransitions[0]!;
    const pieces = Array.from({ length: 100 }, (_, index) => ({
      ...transition.pieces[0]!,
      identityKey: `hostile-work-piece-${index}`,
      transform: {
        ...transition.pieces[0]!.transform,
        positionLdu: [index * 20, 0, 0] as const,
      },
    }));
    const expensive = {
      ...source,
      uniqueTransitions: Array.from({ length: 100 }, () => ({ ...transition, pieces })),
    };

    expect(() =>
      inspectRealBuildCompiledObservationPreflight(
        compiledPlacementLineageBytes(expensive),
        closure.closureBytes,
        inspectRealBuildPreparedObservationPolicy(preparedBytes),
      ),
    ).toThrow(/compiler graph-visit work-policy units; maximum is 2000000/iu);
  });

  it("keeps proxy, shared-storage, and detached bytes outside the semantic boundary", () => {
    const preparedBytes = preparedRunBytes();
    const lineageBytes = compiledPlacementLineageBytes(bindLineageToPreparedRun(preparedBytes));
    const branch = branchFixture({ lineageBytes });
    expect(() => inspect({ ...branch, indexBytes: new Proxy(branch.indexBytes, {}) })).toThrow(
      /branch-evidence index must be a genuine Uint8Array/iu,
    );

    if (typeof SharedArrayBuffer !== "undefined") {
      const shared = new Uint8Array(new SharedArrayBuffer(branch.compiled.length));
      shared.set(branch.compiled);
      expect(() => inspect({ ...branch, compiled: shared }, preparedBytes)).toThrow(
        /cannot use concurrently mutable SharedArrayBuffer storage/iu,
      );
    }

    const detached = preparedRunBytes();
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    expect(() => inspect(branch, detached)).toThrow(
      /prepared run input.*(?:genuine Uint8Array|changed or detached)/iu,
    );
  });
});
