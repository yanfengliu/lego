import { describe, expect, it } from "vitest";

import {
  CoverageContractError,
  assertTargetPartBudget,
  benchmarkPrefixFailure,
  coverageCalloutKey,
  groupPlacementOperationsInPrintedStep,
  isAtomicStepComplete,
  placementSignalFailure,
  reconcileStepCoverage,
  resolveCoverageCallout,
  requireCoverageCallout,
  requireCoverageIndex,
  selectUniquePlacementScore,
  settleAtomicStep,
  stepPrerequisiteFacts,
  stepPrerequisiteFailure,
  type StepFailure,
  type RealBuildOptions,
  type RealBuildPanelSpec,
} from "../e2e/real-build-safety";
import {
  OFFICIAL_REAL_BUILD_ACCOUNTING,
  assessWholeStepVisualEvidence,
  executeCanonicalTransition,
  inputRejectedRealBuildResult,
  measureWholeStepMaskEvidence,
  preflightRealBuildOptions,
} from "../e2e/real-build-contract";
import { realBuildExecutionFailure } from "../e2e/real-build-finalize";
import { completeRealBuildTestOptions, realBuildTransitionPanel } from "./real-build-test-options";

const TEST_DIGEST = `sha256:${"a".repeat(64)}`;
const TEST_CLASSIFICATION_DIGEST = `sha256:${"b".repeat(64)}`;
const allInputDigests = (value = TEST_DIGEST) => ({
  pdf: value,
  calloutManifest: value,
  coverage: value,
  officialModel: value,
  actionLedger: value,
  highlightCalibration: value,
  builderCalibration: value,
  builderGeometry: value,
  transitionClassifications: value,
});

const transitionPanel = (stepNumber: number): RealBuildPanelSpec => ({
  stepNumber,
  pageNumber: stepNumber,
  panelFace: "studs-up",
  minXPt: 0,
  maxXPt: 1,
  minYPt: 0,
  maxYPt: 1,
  calloutBoxes: [],
  mappedCalloutKeys: [],
  action: {
    kind: "transition",
    assembledPieces: 0,
    transition: "rotation",
    panelEvidenceDigest: TEST_DIGEST,
    classificationEvidenceDigest: TEST_CLASSIFICATION_DIGEST,
    evidenceDigest: TEST_DIGEST,
  },
  pieces: [],
  omittedPieces: [],
  calloutPieces: 0,
  classifiedPhysicalCalloutPieces: 0,
  semanticMultiplierQuantity: 0,
  omittedPhysicalPieces: 0,
  coverageFailures: [],
  missingDesigns: [],
  unresolvedCallouts: [],
});

describe("real booklet build safety", () => {
  it("refuses candidate zero when an anchor has no usable placement signal", () => {
    const failure = placementSignalFailure({
      stepNumber: 1,
      hasHighlight: false,
      detectedArrowCount: 0,
      usableArrowPlacementCount: 0,
      independentPlacementSignalCount: 0,
    });

    expect(failure).toMatchObject({
      code: "no-placement-signal",
      stage: "evidence",
    });
    expect(failure?.message).toContain("cannot justify choosing the first enumerated placement");
  });

  it("does not treat an unconsumed arrow drawing as placement evidence", () => {
    expect(
      placementSignalFailure({
        stepNumber: 8,
        hasHighlight: false,
        detectedArrowCount: 2,
        usableArrowPlacementCount: 0,
        independentPlacementSignalCount: 0,
      })?.code,
    ).toBe("no-placement-signal");
    expect(
      placementSignalFailure({
        stepNumber: 8,
        hasHighlight: false,
        detectedArrowCount: 2,
        usableArrowPlacementCount: 1,
        independentPlacementSignalCount: 0,
      }),
    ).toBeNull();
  });

  it("keeps the exact step base when a later piece fails", () => {
    const base = { parts: ["base"] };
    const attemptedChild = { parts: ["base", "piece-a"] };
    const pieceFailure: StepFailure = {
      code: "no-placement-candidate",
      stage: "placement",
      pieceIndex: 1,
      catalogPartId: "builtin:missing-placement",
      message: "piece two had no candidate",
    };

    const decision = settleAtomicStep({
      stepNumber: 4,
      baseDocument: base,
      candidateDocument: attemptedChild,
      expectedPieces: 2,
      candidatePieces: 1,
      attemptedMechanism: "highlight",
      firstPieceFailure: pieceFailure,
      hardValidationPassed: false,
    });

    expect(decision.document).toBe(base);
    expect(decision.acceptedPieces).toBe(0);
    expect(decision.outcome).toMatchObject({
      status: "failed",
      attemptedMechanism: "highlight",
      failure: pieceFailure,
    });
  });

  it("commits only a complete printed step", () => {
    const base = { parts: ["base"] };
    const completeChild = { parts: ["base", "piece-a", "piece-b"] };

    const complete = settleAtomicStep({
      stepNumber: 4,
      baseDocument: base,
      candidateDocument: completeChild,
      expectedPieces: 2,
      candidatePieces: 2,
      attemptedMechanism: "highlight",
      firstPieceFailure: null,
      hardValidationPassed: true,
    });
    const partial = settleAtomicStep({
      stepNumber: 4,
      baseDocument: base,
      candidateDocument: completeChild,
      expectedPieces: 2,
      candidatePieces: 1,
      attemptedMechanism: "highlight",
      firstPieceFailure: null,
      hardValidationPassed: true,
    });

    expect(complete).toMatchObject({
      document: completeChild,
      acceptedPieces: 2,
      outcome: { status: "complete" },
    });
    expect(partial).toMatchObject({
      document: base,
      acceptedPieces: 0,
      outcome: {
        status: "failed",
        failure: { code: "piece-placement-failed", stage: "placement" },
      },
    });
  });

  it("does not count a partial step as complete in the score summary", () => {
    expect(
      isAtomicStepComplete({
        outcome: { status: "complete", mechanism: "highlight", failure: null },
        placedPieces: 1,
        expectedAssembledPieces: 2,
        canonicalStepId: "step-1",
        actionEvidenceDigest: TEST_DIGEST,
      }),
    ).toBe(false);
    expect(
      isAtomicStepComplete({
        outcome: { status: "complete", mechanism: "highlight", failure: null },
        placedPieces: 2,
        expectedAssembledPieces: 2,
        canonicalStepId: "step-1",
        actionEvidenceDigest: TEST_DIGEST,
      }),
    ).toBe(true);
    expect(
      isAtomicStepComplete({
        outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
        placedPieces: 0,
        expectedAssembledPieces: 0,
        canonicalStepId: null,
        actionEvidenceDigest: TEST_DIGEST,
      }),
    ).toBe(false);
  });

  it("retains every requested refusal row and makes input rejection fail the process contract", () => {
    const options = {
      panels: [transitionPanel(1), transitionPanel(2)],
      lastStep: 2,
      inputDigests: allInputDigests(),
    } as unknown as RealBuildOptions;
    const result = inputRejectedRealBuildResult(options, [
      {
        code: "set-accounting-mismatch",
        stage: "input",
        message: "fixture has no physical-piece ledger",
      },
    ]);

    expect(result.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(result.steps.every(({ canonicalStepId }) => canonicalStepId === null)).toBe(true);
    expect(realBuildExecutionFailure(result)).toMatchObject({ code: "run-incomplete" });
  });

  it("completes a transition only after adding and validating its canonical BuildStep", () => {
    const base = {
      steps: [
        {
          id: "step-1",
          index: 0,
          name: `Step 1 [transition:rotation;panel=${TEST_DIGEST}]`,
          partIds: [] as string[],
        },
      ],
    };
    const result = executeCanonicalTransition({
      baseDocument: base,
      printedStepNumber: 2,
      transition: "rotation",
      panelEvidenceDigest: TEST_DIGEST,
      steps: base.steps,
      applyOperations: (document, operations) => ({
        steps: [
          ...document.steps,
          (
            operations[0] as {
              step: { id: string; index: number; name: string; partIds: string[] };
            }
          ).step,
        ],
      }),
      validate: () => ({
        targetDocumentHash: TEST_DIGEST,
        truthSnapshotHash: TEST_DIGEST,
        validatorSetHash: TEST_DIGEST,
        documentGloballyValid: true,
        issues: [],
      }),
    });

    expect(result.failure).toBeNull();
    expect(result.stepId).toBe("real-build-step-2");
    expect(result.document).not.toBe(base);
    expect(result.validation.documentGloballyValid).toBe(true);
  });

  it("distinguishes unresolved callouts, missing catalog parts, and causal blocking", () => {
    const unresolved = stepPrerequisiteFailure({
      stepNumber: 3,
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: ["p8-c1 (2x)"],
      missingDesigns: [],
      calloutPieces: 2,
      resolvedPieces: 0,
    });
    const missing = stepPrerequisiteFailure({
      stepNumber: 3,
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: ["30565"],
      calloutPieces: 1,
      resolvedPieces: 0,
    });
    const blocked = stepPrerequisiteFailure({
      stepNumber: 4,
      blockingStep: 3,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: 1,
      resolvedPieces: 1,
    });

    expect(unresolved?.failure).toMatchObject({
      code: "unresolved-callout",
      stage: "callout-resolution",
    });
    expect(missing?.failure).toMatchObject({
      code: "missing-catalog-part",
      stage: "catalog",
    });
    expect(blocked?.failure).toMatchObject({
      code: "blocked-by-prior-step",
      stage: "causality",
      causedByStep: 3,
    });
  });

  it("retains local prerequisite failures when a prior step causally blocks execution", () => {
    const input = {
      stepNumber: 9,
      blockingStep: 4,
      coverageFailures: [],
      unresolvedCallouts: ["p14-c2.png (2x)"],
      missingDesigns: [],
      calloutPieces: 2,
      resolvedPieces: 0,
    };

    expect(stepPrerequisiteFacts(input)).toMatchObject({
      blockingStep: 4,
      localFailure: { code: "unresolved-callout", stage: "callout-resolution" },
    });
    expect(stepPrerequisiteFailure(input)?.failure).toMatchObject({
      code: "blocked-by-prior-step",
      causedByStep: 4,
    });
  });

  it("uses the stable v6 callout identity and rejects stale join metadata", () => {
    const key = coverageCalloutKey("p11|q3|x43.074|y486.271");
    const exact = {
      [key]: { identity: key, pageNumber: 11, quantity: 3, value: "claim" },
    };
    expect(key).toBe("p11|q3|x43.074|y486.271");
    expect(requireCoverageCallout(exact, { identity: key, pageNumber: 11, quantity: 3 })).toBe(
      exact[key],
    );

    const cases = [
      {
        byCallout: {},
        code: "coverage-key-missing",
      },
      {
        byCallout: { "p11-c2.png": { pageNumber: 11, quantity: 3 } },
        code: "coverage-key-missing",
      },
      {
        byCallout: { [key]: { identity: "p11|q3|x44.000|y486.271", pageNumber: 11, quantity: 3 } },
        code: "coverage-key-mismatch",
      },
      {
        byCallout: { [key]: { pageNumber: 12, quantity: 3 } },
        code: "coverage-page-mismatch",
      },
      {
        byCallout: { [key]: { pageNumber: 11, quantity: 2 } },
        code: "coverage-quantity-mismatch",
      },
    ] as const;
    for (const entry of cases) {
      try {
        requireCoverageCallout(
          entry.byCallout as Readonly<
            Record<string, { readonly pageNumber: number; readonly quantity: number }>
          >,
          { identity: key, pageNumber: 11, quantity: 3 },
        );
        throw new Error(`expected ${entry.code}`);
      } catch (error) {
        expect(error).toBeInstanceOf(CoverageContractError);
        expect((error as CoverageContractError).code).toBe(entry.code);
      }
    }
    expect(() => coverageCalloutKey("p11-c2.png")).toThrowError(CoverageContractError);
  });

  it("rejects a coverage file whose byCallout index is absent", () => {
    expect(() => requireCoverageIndex(undefined)).toThrowError(CoverageContractError);
    try {
      requireCoverageIndex([]);
      throw new Error("expected malformed coverage to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "coverage-key-missing", key: "byCallout" });
    }
  });

  it("refuses a panel that silently drops one expected callout key", () => {
    const coverage = {
      "p11|q1|x1.000|y1.000": { pageNumber: 11, stepNumber: 1, quantity: 1 },
      "p11|q1|x2.000|y1.000": { pageNumber: 11, stepNumber: 1, quantity: 1 },
      "p11|q1|x3.000|y1.000": { pageNumber: 11, stepNumber: 1, quantity: 1 },
    };
    const reconciliation = reconcileStepCoverage(coverage, {
      pageNumber: 11,
      stepNumber: 1,
      mappedKeys: ["p11|q1|x1.000|y1.000", "p11|q1|x2.000|y1.000"],
    });

    expect(reconciliation).toMatchObject({
      expectedPieces: 3,
      failure: { code: "coverage-key-mismatch", stage: "coverage" },
    });
    expect(reconciliation.failure?.message).toContain("p11|q1|x3.000|y1.000");
  });

  it("enforces coverage step assignment during production preflight", () => {
    const panels = Array.from({ length: 359 }, (_, index) => transitionPanel(index + 1));
    panels[0] = { ...panels[0]!, pageNumber: 11, mappedCalloutKeys: ["p11-c0.png"] };
    const failures = preflightRealBuildOptions({
      panels,
      passivePanels: [],
      expectedPrintedSteps: 359,
      lastStep: 359,
      accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
      targetPartCount: 1_464,
      maxParts: 1_464,
      inputDigests: allInputDigests(),
      coverageInputBindings: { pdf: TEST_DIGEST, calloutManifest: TEST_DIGEST },
      minimumWholeStepScore: 0.45,
      minimumExclusiveHighlightPixelsPerPiece: 8,
      maxRendersPerPiece: 220,
      blindRenderBudget: 220,
      deferredCandidateBudget: 512,
      panelCameraBranchBudget: 8_192,
      deferredNarrowingRenderBudget: 4_096,
      fartherPanelMaximumReachSteps: 2,
      fartherPanelRenderBudget: 16,
      explodedGhostRenderBudget: 4_096,
      highlightCalibrationDigest: TEST_DIGEST,
      coverageByCallout: {
        "p11-c0.png": { pageNumber: 11, stepNumber: 2, quantity: 1 },
      },
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "coverage-key-mismatch",
          stepNumber: 1,
        }),
      ]),
    );
  });

  it("refuses incomplete, zero, tied, and weakly separated visual scoring", () => {
    const decide = (scores: number[], eligibleCandidates = scores.length) =>
      selectUniquePlacementScore({
        stepNumber: 7,
        pieceIndex: 0,
        catalogPartId: "builtin:plate-2x4",
        eligibleCandidates,
        scores: scores.map((score, candidate) => ({ candidate, score })),
        minimumMargin: 0.01,
      });

    expect(decide([0.8], 2).failure?.code).toBe("incomplete-placement-scoring");
    expect(decide([0]).failure?.code).toBe("zero-placement-score");
    expect(decide([0.8, 0.8]).failure?.code).toBe("tied-placement-score");
    expect(decide([0.8, 0.795]).failure?.code).toBe("ambiguous-placement-score");
    expect(decide([0.8, 0.6])).toMatchObject({ winner: { candidate: 0 }, failure: null });
  });

  it("compares blind and highlight searches only from the same prefix", () => {
    expect(
      benchmarkPrefixFailure({
        stepNumber: 8,
        highlightPrefixHash: "sha256:same",
        blindPrefixHash: "sha256:same",
      }),
    ).toBeNull();
    expect(
      benchmarkPrefixFailure({
        stepNumber: 8,
        highlightPrefixHash: "sha256:highlight",
        blindPrefixHash: "sha256:blind",
      }),
    ).toMatchObject({ code: "benchmark-prefix-mismatch", stage: "benchmark" });
  });

  it("groups every piece in one canonical printed build step", () => {
    const first = groupPlacementOperationsInPrintedStep(
      [
        {
          kind: "addStep",
          operationId: "step-op",
          step: { id: "generated-step", index: 1, name: "Step 2", partIds: [] },
        },
        {
          kind: "addPart",
          operationId: "part-a-op",
          part: { id: "part-a", stepId: "generated-step" },
        },
      ],
      { printedStepNumber: 9, targetStepId: null },
    );
    const second = groupPlacementOperationsInPrintedStep(
      [
        {
          kind: "addStep",
          operationId: "discard-step-op",
          step: { id: "discard-step", index: 2, name: "Step 3", partIds: [] },
        },
        {
          kind: "addPart",
          operationId: "part-b-op",
          part: { id: "part-b", stepId: "discard-step" },
        },
      ],
      { printedStepNumber: 9, targetStepId: first.stepId },
    );

    expect(first.operations).toContainEqual(
      expect.objectContaining({
        kind: "addStep",
        step: expect.objectContaining({ index: 8, name: "Step 9" }),
      }),
    );
    expect(second.operations.some(({ kind }) => kind === "addStep")).toBe(false);
    expect(second.operations).toContainEqual(
      expect.objectContaining({
        kind: "addPart",
        part: expect.objectContaining({ stepId: first.stepId }),
      }),
    );
  });

  it("requires an explicit document budget large enough for the declared target", () => {
    expect(() => assertTargetPartBudget(500, 1_464)).toThrowError(
      /below the declared 1464-part target/,
    );
    expect(() => assertTargetPartBudget(1_464, 1_464)).not.toThrow();
  });

  it("will not atomically settle a candidate that skipped hard validation", () => {
    const base = { parts: ["base"] };
    const candidate = { parts: ["base", "new"] };
    const decision = settleAtomicStep({
      stepNumber: 10,
      baseDocument: base,
      candidateDocument: candidate,
      expectedPieces: 1,
      candidatePieces: 1,
      attemptedMechanism: "highlight",
      firstPieceFailure: null,
      hardValidationPassed: false,
    });

    expect(decision.document).toBe(base);
    expect(decision.outcome).toMatchObject({
      status: "failed",
      failure: { code: "hard-validation-failed", stage: "validation" },
    });
  });

  it("refuses quantity-only accounting without omitted identities and MultiBuild copies", () => {
    const panel = (
      stepNumber: number,
      overrides: Partial<RealBuildPanelSpec> = {},
    ): RealBuildPanelSpec => ({
      stepNumber,
      pageNumber: stepNumber,
      panelFace: "studs-up",
      minXPt: 0,
      maxXPt: 1,
      minYPt: 0,
      maxYPt: 1,
      calloutBoxes: [],
      mappedCalloutKeys: [],
      pieces: [],
      omittedPieces: [],
      calloutPieces: 0,
      classifiedPhysicalCalloutPieces: 0,
      semanticMultiplierQuantity: 0,
      omittedPhysicalPieces: 0,
      action: {
        kind: "transition",
        assembledPieces: 0,
        transition: "rotation",
        panelEvidenceDigest: TEST_DIGEST,
        classificationEvidenceDigest: TEST_DIGEST,
        evidenceDigest: TEST_DIGEST,
      },
      coverageFailures: [],
      missingDesigns: [],
      unresolvedCallouts: [],
      ...overrides,
    });
    const panels = Array.from({ length: 359 }, (_, index) => panel(index + 1));
    panels[0] = panel(1, {
      calloutPieces: 1_435,
      classifiedPhysicalCalloutPieces: 1_395,
      semanticMultiplierQuantity: 40,
      action: {
        kind: "place-callouts",
        assembledPieces: 1_395,
        evidenceDigest: TEST_DIGEST,
      },
    });
    panels[1] = panel(2, {
      calloutPieces: 51,
      classifiedPhysicalCalloutPieces: 51,
      omittedPhysicalPieces: 18,
      action: {
        kind: "multi-build-copy",
        assembledPieces: 69,
        sourceStepNumber: 1,
        evidenceDigest: TEST_DIGEST,
        copies: [],
      },
    });
    const digest = `sha256:${"a".repeat(64)}`;
    const input = {
      panels,
      passivePanels: [],
      expectedPrintedSteps: 359,
      lastStep: 359,
      accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
      targetPartCount: 1_464,
      maxParts: 1_464,
      inputDigests: allInputDigests(digest),
      coverageInputBindings: { pdf: digest, calloutManifest: digest },
      minimumWholeStepScore: 0.45,
      minimumExclusiveHighlightPixelsPerPiece: 8,
      maxRendersPerPiece: 220,
      blindRenderBudget: 220,
      deferredCandidateBudget: 512,
      panelCameraBranchBudget: 8_192,
      deferredNarrowingRenderBudget: 4_096,
      fartherPanelMaximumReachSteps: 2,
      fartherPanelRenderBudget: 16,
      explodedGhostRenderBudget: 4_096,
      highlightCalibrationDigest: digest,
      coverageByCallout: {},
    };

    expect(preflightRealBuildOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "omitted-piece-identity-missing", stepNumber: 2 }),
        expect.objectContaining({ code: "action-ledger-incomplete", stepNumber: 2 }),
        expect.objectContaining({ code: "set-accounting-mismatch" }),
      ]),
    );
    const inconsistent = [...panels];
    inconsistent[0] = { ...inconsistent[0]!, calloutPieces: 1_436 };
    expect(preflightRealBuildOptions({ ...input, panels: inconsistent })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "set-accounting-mismatch" })]),
    );
  });

  it("requires every printed step exactly once while allowing classified zero-piece transitions", () => {
    expect(
      stepPrerequisiteFailure({
        stepNumber: 44,
        actionKind: "transition",
        blockingStep: null,
        coverageFailures: [],
        unresolvedCallouts: [],
        missingDesigns: [],
        calloutPieces: 0,
        expectedAssembledPieces: 0,
        resolvedPieces: 0,
      }),
    ).toBeNull();

    const digest = `sha256:${"b".repeat(64)}`;
    const badPanels = Array.from({ length: 359 }, (_, index) => ({
      stepNumber: index === 358 ? 358 : index + 1,
      pageNumber: 1,
      minXPt: 0,
      maxXPt: 1,
      minYPt: 0,
      maxYPt: 1,
      calloutBoxes: [],
      mappedCalloutKeys: [],
      pieces: [],
      omittedPieces: [],
      panelFace: "studs-up" as const,
      calloutPieces: 0,
      classifiedPhysicalCalloutPieces: 0,
      semanticMultiplierQuantity: 0,
      omittedPhysicalPieces: 0,
      action: {
        kind: "transition" as const,
        assembledPieces: 0 as const,
        transition: "rotation" as const,
        panelEvidenceDigest: digest,
        classificationEvidenceDigest: digest,
        evidenceDigest: digest,
      },
      coverageFailures: [],
      missingDesigns: [],
      unresolvedCallouts: [],
    }));
    expect(
      preflightRealBuildOptions({
        panels: badPanels,
        passivePanels: [],
        expectedPrintedSteps: 359,
        lastStep: 359,
        accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
        targetPartCount: 1_464,
        maxParts: 1_464,
        inputDigests: allInputDigests(digest),
        coverageInputBindings: { pdf: digest, calloutManifest: digest },
        minimumWholeStepScore: 0.45,
        minimumExclusiveHighlightPixelsPerPiece: 8,
        maxRendersPerPiece: 220,
        blindRenderBudget: 220,
        deferredCandidateBudget: 512,
        panelCameraBranchBudget: 8_192,
        deferredNarrowingRenderBudget: 4_096,
        fartherPanelMaximumReachSteps: 2,
        fartherPanelRenderBudget: 16,
        explodedGhostRenderBudget: 4_096,
        highlightCalibrationDigest: digest,
        coverageByCallout: {},
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "printed-step-sequence-invalid" })]),
    );
  });

  it("retains untrusted or content-stale identification as a typed callout failure", () => {
    const crop = `sha256:${"c".repeat(64)}`;
    const input = `sha256:${"d".repeat(64)}`;
    const identity = "p11|q1|x43.074|y486.271";
    const base = { pageNumber: 11, quantity: 1, cropDigest: crop, inputDigest: input };
    expect(
      resolveCoverageCallout(
        { [identity]: { ...base, identity, identificationConfidence: "self-contradicted" } },
        {
          identity,
          pageNumber: 11,
          quantity: 1,
          cropDigest: crop,
          identificationInputDigest: input,
        },
      ).failure,
    ).toMatchObject({ code: "untrusted-identification", inputKey: identity });
    expect(
      resolveCoverageCallout(
        { [identity]: { ...base, identity, identificationConfidence: "vision-kept" } },
        {
          identity,
          pageNumber: 11,
          quantity: 1,
          cropDigest: `sha256:${"e".repeat(64)}`,
          identificationInputDigest: input,
        },
      ).failure,
    ).toMatchObject({ code: "input-digest-mismatch", inputKey: identity });
  });

  it("validates only the exact requested action prefix while source indexing remains separate", () => {
    const options = completeRealBuildTestOptions(2);
    const tailAction: RealBuildPanelSpec = {
      ...realBuildTransitionPanel(3),
      coverageFailures: [
        {
          code: "coverage-key-mismatch",
          stage: "coverage",
          message: "deliberately invalid unexecuted tail",
        },
      ],
    };

    expect(preflightRealBuildOptions(options)).toEqual([]);
    expect(
      preflightRealBuildOptions({ ...options, panels: [...options.panels, tailAction] }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "printed-step-sequence-invalid", inputKey: "panels" }),
      ]),
    );
    const throughThree = completeRealBuildTestOptions(3);
    expect(
      preflightRealBuildOptions({
        ...throughThree,
        panels: [...throughThree.panels.slice(0, 2), tailAction],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "coverage-key-mismatch", stepNumber: 3 }),
      ]),
    );
  });

  it("requires nontrivial joint score and distinct highlight evidence for every piece", () => {
    const coverage = measureWholeStepMaskEvidence(
      [new Uint8Array([1, 1, 0, 0]), new Uint8Array([0, 0, 1, 1])],
      new Uint8Array([1, 1, 1, 1]),
      2,
    );
    const region = {
      evidenceKind: "region",
      printedEvidencePixels: 4,
      unexplainedBoundsPx: null,
    } as const;
    expect(
      assessWholeStepVisualEvidence({
        stepNumber: 7,
        score: 0.39,
        minimumScore: 0.4,
        minimumExclusiveHighlightPixelsPerPiece: 2,
        calibrationDigest: TEST_DIGEST,
        ...region,
        ...coverage,
      }).failure?.code,
    ).toBe("whole-step-score-too-low");
    expect(
      assessWholeStepVisualEvidence({
        stepNumber: 7,
        score: 0.7,
        minimumScore: 0.4,
        minimumExclusiveHighlightPixelsPerPiece: 2,
        calibrationDigest: TEST_DIGEST,
        ...region,
        unionHighlightPixels: 2,
        summedPieceHighlightPixels: 4,
        exclusiveHighlightPixelsByPiece: [0, 0],
      }).failure?.code,
    ).toBe("highlight-reuse-unexplained");
    expect(
      assessWholeStepVisualEvidence({
        stepNumber: 7,
        score: 0.7,
        minimumScore: 0.4,
        minimumExclusiveHighlightPixelsPerPiece: 2,
        calibrationDigest: TEST_DIGEST,
        ...region,
        unionHighlightPixels: 1,
        summedPieceHighlightPixels: 1,
        exclusiveHighlightPixelsByPiece: [1],
      }).failure?.code,
    ).toBe("highlight-reuse-unexplained");
    expect(
      assessWholeStepVisualEvidence({
        stepNumber: 7,
        score: 0.7,
        minimumScore: 0.4,
        minimumExclusiveHighlightPixelsPerPiece: 2,
        calibrationDigest: TEST_DIGEST,
        ...region,
        ...coverage,
      }).failure,
    ).toBeNull();
  });

  // A panel whose contours all stay open prints no enclosed area at all, so the
  // region mask is empty by construction and every piece's intersection with it
  // is zero. That is exactly printed step 5 of the sample booklet: two open
  // contours, 1429px of keyed yellow, and a region union of 0px. Measuring the
  // stroke instead is what makes the same reuse question askable there.
  it("attributes an open contour's stroke to the piece whose boundary traces it", () => {
    // Two pieces side by side, each claiming the stroke its own boundary runs
    // under. Six printed pixels: three each, none shared.
    const left = new Uint8Array([1, 1, 1, 0, 0, 0]);
    const right = new Uint8Array([0, 0, 0, 1, 1, 1]);
    const printed = new Uint8Array([1, 1, 1, 1, 1, 1]);
    const measured = measureWholeStepMaskEvidence([left, right], printed, 6);
    expect(measured).toEqual({
      unionHighlightPixels: 6,
      summedPieceHighlightPixels: 6,
      exclusiveHighlightPixelsByPiece: [3, 3],
      unexplainedBoundsPx: null,
    });
    expect(
      assessWholeStepVisualEvidence({
        stepNumber: 5,
        score: 0.7,
        minimumScore: 0.45,
        minimumExclusiveHighlightPixelsPerPiece: 2,
        calibrationDigest: TEST_DIGEST,
        evidenceKind: "stroke",
        printedEvidencePixels: 6,
        ...measured,
      }).failure,
    ).toBeNull();
  });

  // The hard test an open contour does *not* get, and the measurement that
  // refused it. "Every printed pixel is explained" reads like containment's
  // mirror and is false of the right answer: on printed step 5 the best of 374
  // placements of the Plate 2 x 14 explains 907 of the 1081 pixels its own
  // contour prints, and the 174 it misses are the outer row of a two-pixel
  // stroke drawn outward of the silhouette by more than the boundary tolerance.
  // So this gate stays a reuse gate, and the hard test is `rankStepDelta`
  // maximality plus the run's existing separation margin in the search.
  it("does not refuse an open contour for printed line the drawing put out of reach", () => {
    const stepFive = {
      stepNumber: 5,
      score: 0.9,
      minimumScore: 0.45,
      minimumExclusiveHighlightPixelsPerPiece: 8,
      calibrationDigest: TEST_DIGEST,
      evidenceKind: "stroke",
      printedEvidencePixels: 1_429,
      unionHighlightPixels: 1_254,
      summedPieceHighlightPixels: 1_254,
      exclusiveHighlightPixelsByPiece: [347, 907],
      unexplainedBoundsPx: [36, 353, 286, 445] as const,
    } as const;
    expect(assessWholeStepVisualEvidence(stepFive).failure).toBeNull();
    // The shortfall is still reported, because it is where the drawing and the
    // build disagree and a box on the panel is the only actionable form of it.
    const evidence = assessWholeStepVisualEvidence(stepFive);
    expect(evidence.printedEvidencePixels - evidence.unionHighlightPixels).toBe(175);
    expect(evidence.unexplainedBoundsPx).toEqual([36, 353, 286, 445]);
    // Reuse still bites on exactly the same evidence: a piece that traces none
    // of the printed line has not explained anything, open contour or not.
    expect(
      assessWholeStepVisualEvidence({
        ...stepFive,
        exclusiveHighlightPixelsByPiece: [7, 1_247],
      }).failure?.code,
    ).toBe("highlight-reuse-unexplained");
  });
});
