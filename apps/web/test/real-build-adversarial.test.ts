import { describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  auditRealBuildReportEvidence,
  finalizeExecutedRealBuildResult,
  realBuildExecutionFailure,
} from "../e2e/real-build-finalize";
import { assessWholeStepVisualEvidence } from "../e2e/real-build-contract";
import {
  stepPrerequisiteFacts,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildResult,
  type RealBuildStepReport,
} from "../e2e/real-build-safety";
import { isLocalRealBuildAuthority } from "../e2e/real-build-authority";
import type { RealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";

const DIGEST = REAL_BUILD_TEST_DIGEST;
const transitionPanel = realBuildTransitionPanel;

const completeReport = (stepNumber: number): RealBuildStepReport => ({
  stepNumber,
  pageNumber: stepNumber,
  calloutPieces: 0,
  expectedAssembledPieces: 0,
  attemptedPieces: 0,
  placedPieces: 0,
  action: transitionPanel(stepNumber).action,
  actionEvidenceDigest: DIGEST,
  canonicalStepId: `step-${stepNumber}`,
  prerequisites: stepPrerequisiteFacts({
    stepNumber,
    actionKind: "transition",
    blockingStep: null,
    coverageFailures: [],
    unresolvedCallouts: [],
    missingDesigns: [],
    calloutPieces: 0,
    expectedAssembledPieces: 0,
    resolvedPieces: 0,
  }),
  outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
  validation: {
    attempted: true,
    targetDocumentHash: DIGEST,
    truthSnapshotHash: DIGEST,
    validatorSetHash: DIGEST,
    documentGloballyValid: true,
    blockingIssues: [],
    failure: null,
  },
  fit: {
    azimuthDegrees: null,
    elevationDegrees: null,
    pixelsPerUnit: null,
    residualPx: null,
    coherence: 0,
    failure: null,
  },
  camera: null,
  highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
  arrows: { kept: 0, redPx: 0, rejected: 0, displacementFamily: 0 },
  pieces: [],
  jointVisual: null,
  documentParts: 0,
  elapsedMs: 1,
  panelPng: null,
  buildPng: null,
});

const options = completeRealBuildTestOptions;

const documentJson = (lastStep: number): string => {
  const base = createEmptyBrickDocument({ id: "test", name: "test", maxParts: 1_464 });
  return JSON.stringify({
    ...base,
    steps: Array.from({ length: lastStep }, (_, index) => ({
      id: `step-${index + 1}`,
      index,
      name: `Step ${index + 1} [transition:rotation;panel=${DIGEST}]`,
      partIds: [],
    })),
  });
};

const prefixDocument = (
  document: ReturnType<typeof createEmptyBrickDocument>,
  lastStep: number,
): ReturnType<typeof createEmptyBrickDocument> => {
  const steps = document.steps.filter(({ index }) => index < lastStep);
  const stepIds = new Set(steps.map(({ id }) => id));
  const parts = document.parts.filter(({ stepId }) => stepIds.has(stepId));
  const partIds = new Set(parts.map(({ id }) => id));
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => partIds.has(partId)),
  });
  return {
    ...document,
    steps,
    parts,
    connections: document.connections.filter(
      ({ a, b }) => partIds.has(a.partId) && partIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
};

const browserOutput = (
  lastStep: number,
  reports: readonly RealBuildStepReport[] = Array.from({ length: lastStep }, (_, index) =>
    completeReport(index + 1),
  ),
  bytes = documentJson(lastStep),
): RealBuildBrowserOutput => {
  const document = JSON.parse(bytes) as ReturnType<typeof createEmptyBrickDocument>;
  const normalizedReports = reports.map((report) => ({
    ...report,
    validation: (() => {
      const validation = validateBrickDocument(prefixDocument(document, report.stepNumber));
      return {
        attempted: true,
        targetDocumentHash: validation.targetDocumentHash,
        truthSnapshotHash: validation.truthSnapshotHash,
        validatorSetHash: validation.validatorSetHash,
        documentGloballyValid: validation.documentGloballyValid,
        blockingIssues: validation.issues
          .filter(({ severity }) => severity === "blocking")
          .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
        failure: null,
      };
    })(),
  }));
  return {
    schemaVersion: "lego.real-build-browser-output/1",
    status: "executed",
    reports: normalizedReports,
    documentJson: bytes,
    identityBindings: [],
    fetchedPdfDigest: DIGEST,
    totalElapsedMs: lastStep,
  };
};

describe("real build adversarial completion and ledger contracts", () => {
  it("fails malformed or semantically weakened retained options without trusting browser JSON", () => {
    const malformed = finalizeExecutedRealBuildResult({
      options: null as unknown as RealBuildOptions,
      browserOutput: null as unknown as RealBuildBrowserOutput,
    });
    const weakened = finalizeExecutedRealBuildResult({
      options: { ...options(2), targetPartCount: 0 },
      browserOutput: browserOutput(2),
    });

    expect(malformed).toMatchObject({ status: "incomplete", requestedLastStep: 0 });
    expect(malformed.completionFailures[0]?.message).toContain("retained run options");
    expect(weakened).toMatchObject({ status: "incomplete", finalParts: 0 });
    expect(weakened.completionFailures.map(({ code }) => code)).toContain(
      "set-accounting-mismatch",
    );
  });

  it("reparses canonical bytes and accepts only an exact hard-valid prefix", () => {
    const reports = [completeReport(1), completeReport(2)];
    const result = finalizeExecutedRealBuildResult({
      options: options(2),
      browserOutput: browserOutput(2, reports),
    });

    expect(result).toMatchObject({
      status: "prefix-complete",
      finalParts: 0,
      completionFailures: [],
    });
    expect(realBuildExecutionFailure(result)).toBeNull();
  });

  it("refuses browser-forged visual completion until Node can recompute raw rasters", () => {
    const directPanel: RealBuildPanelSpec = {
      ...transitionPanel(1),
      action: { kind: "place-callouts", assembledPieces: 1, evidenceDigest: DIGEST },
      pieces: [
        {
          identityKey: "direct-evidence",
          designId: "3005",
          materialId: "1",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
          calloutKey: "p1-c0.png",
          identificationConfidence: "vision-kept",
          cropDigest: DIGEST,
          identificationInputDigest: DIGEST,
          expectedTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        },
      ],
      calloutPieces: 1,
      classifiedPhysicalCalloutPieces: 1,
      mappedCalloutKeys: ["p1-c0.png"],
    };
    const prerequisites = stepPrerequisiteFacts({
      stepNumber: 1,
      actionKind: "place-callouts",
      blockingStep: null,
      coverageFailures: [],
      unresolvedCallouts: [],
      missingDesigns: [],
      calloutPieces: 1,
      expectedAssembledPieces: 1,
      resolvedPieces: 1,
    });
    const jointVisual = assessWholeStepVisualEvidence({
      stepNumber: 1,
      score: 0.9,
      minimumScore: 0.45,
      minimumExclusiveHighlightPixelsPerPiece: 8,
      calibrationDigest: DIGEST,
      unionHighlightPixels: 20,
      summedPieceHighlightPixels: 20,
      exclusiveHighlightPixelsByPiece: [20],
    });
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const directReport: RealBuildStepReport = {
      ...completeReport(1),
      calloutPieces: 1,
      expectedAssembledPieces: 1,
      attemptedPieces: 1,
      placedPieces: 1,
      action: directPanel.action,
      prerequisites,
      outcome: { status: "complete", mechanism: "highlight", failure: null },
      fit: {
        azimuthDegrees: 45,
        elevationDegrees: 35,
        pixelsPerUnit: 16,
        residualPx: 1,
        coherence: 0.5,
        failure: null,
      },
      camera: {
        azimuthDegrees: 45,
        elevationDegrees: 35,
        pixelsPerUnit: 16,
        residualPx: 1,
        coherence: 0.5,
        centerXPx: 100,
        centerYPx: 100,
        anchorIou: 0.8,
        anchorShiftPx: [0, 0],
      },
      highlight: { regions: 1, closedContourRate: 1, strokePx: 20, boundsPx: [0, 0, 10, 10] },
      pieces: [
        {
          catalogPartId: "builtin:brick-1x1",
          blind: {
            comparisonPrefixHash: DIGEST,
            distinctCandidates: 1,
            feasible: true,
            rendered: 1,
            bestScore: 0.9,
            runnerUpScore: null,
            agreesWithHighlight: true,
            refusal: null,
            elapsedMs: 1,
          },
          enumerated: 1,
          afterProximity: 1,
          rendered: 1,
          bestScore: 0.9,
          runnerUpScore: null,
          placed: true,
          positionLdu: [0, 0, 0],
          orientationId: "upright-yaw-0",
          failure: null,
        },
      ],
      jointVisual,
      documentParts: 1,
      panelPng: png,
      buildPng: png,
    };
    const audit = (report: RealBuildStepReport) =>
      auditRealBuildReportEvidence(options(1), directPanel, report);

    expect(audit(directReport)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "visual-evidence-unverified",
          message: expect.stringContaining("cannot independently recompute"),
        }),
      ]),
    );
    const mutations: readonly RealBuildStepReport[] = [
      { ...directReport, prerequisites: { ...prerequisites, resolvedPieces: 0 } },
      {
        ...directReport,
        pieces: [{ ...directReport.pieces[0]!, positionLdu: [1, 0, 0] }],
      },
      { ...directReport, fit: { ...directReport.fit, residualPx: 2 } },
      { ...directReport, camera: { ...directReport.camera!, azimuthDegrees: 46 } },
      { ...directReport, highlight: { ...directReport.highlight, boundsPx: null } },
      { ...directReport, jointVisual: { ...jointVisual, score: 0.1 } },
      { ...directReport, panelPng: null },
      { ...directReport, buildPng: null },
    ];
    for (const mutation of mutations) expect(audit(mutation).length).toBeGreaterThan(0);
  });

  it("rejects reordered rows, duplicate BuildStep ownership, and semantic-name forgery", () => {
    const reports = [completeReport(1), completeReport(2)];
    const finalize = (rows: readonly RealBuildStepReport[], bytes = documentJson(2)) =>
      finalizeExecutedRealBuildResult({
        options: options(2),
        browserOutput: browserOutput(2, rows, bytes),
      });
    const wrongNameDocument = JSON.parse(documentJson(2)) as {
      steps: { name: string }[];
    };
    wrongNameDocument.steps[0]!.name = "Step 1";
    const wrongName = JSON.stringify(wrongNameDocument);

    expect(finalize([reports[1]!, reports[0]!]).status).toBe("incomplete");
    expect(finalize([reports[0]!, { ...reports[1]!, canonicalStepId: "step-1" }]).status).toBe(
      "incomplete",
    );
    expect(finalize(reports, wrongName).status).toBe("incomplete");
    const tandem = browserOutput(2, reports);
    const forgedReports = tandem.reports.map((report) => ({
      ...report,
      validation: { ...report.validation, targetDocumentHash: sha256Digest("forged-structure") },
    }));
    expect(
      finalizeExecutedRealBuildResult({
        options: options(2),
        browserOutput: { ...tandem, reports: forgedReports },
      }).status,
    ).toBe("incomplete");
  });

  it("derives part count from bytes and rejects unowned canonical parts", () => {
    const document = JSON.parse(documentJson(1)) as ReturnType<typeof createEmptyBrickDocument>;
    const bytes = JSON.stringify({
      ...document,
      parts: [createPartInstance({ id: "forged-part", stepId: "step-1" })],
    });
    const result = finalizeExecutedRealBuildResult({
      options: options(1),
      browserOutput: browserOutput(1, [completeReport(1)], bytes),
    });

    expect(result).toMatchObject({ status: "incomplete", finalParts: 1 });
    expect(result.completionFailures.map(({ message }) => message).join(" ")).toContain(
      "canonical",
    );
  });

  it("rejects colluding report/document and tandem-hash tampering against exact ledger identity", () => {
    const base = createEmptyBrickDocument({ id: "identity", name: "identity", maxParts: 10 });
    const expectedPart = createPartInstance({
      id: "part-a",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:black",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    });
    const expectedDocument = {
      ...base,
      parts: [expectedPart],
      steps: [{ ...base.steps[0]!, partIds: [expectedPart.id] }],
      submodels: [{ ...base.submodels[0]!, partIds: [expectedPart.id] }],
    };
    const panel: RealBuildPanelSpec = {
      ...transitionPanel(1),
      pieces: [
        {
          identityKey: "brick-a",
          designId: "3005",
          materialId: "1",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
          calloutKey: "p1-c0.png",
          identificationConfidence: "vision-kept",
          cropDigest: DIGEST,
          identificationInputDigest: DIGEST,
          expectedTransform: expectedPart.transform,
        },
      ],
      calloutPieces: 1,
      classifiedPhysicalCalloutPieces: 1,
      mappedCalloutKeys: ["p1-c0.png"],
      action: { kind: "place-callouts", assembledPieces: 1, evidenceDigest: DIGEST },
    };
    const trustedOptions = options(1);
    const sourcePanel = trustedOptions.panels[357]!;
    if (sourcePanel.action.kind !== "place-callouts") {
      throw new TypeError("The complete fixture must retain its direct-piece panel at step 358.");
    }
    const rebalancedSourcePanel: RealBuildPanelSpec = {
      ...sourcePanel,
      pieces: sourcePanel.pieces.slice(0, -1),
      mappedCalloutKeys: sourcePanel.mappedCalloutKeys.slice(0, -1),
      calloutPieces: sourcePanel.calloutPieces - 1,
      classifiedPhysicalCalloutPieces: sourcePanel.classifiedPhysicalCalloutPieces - 1,
      action: {
        ...sourcePanel.action,
        assembledPieces: sourcePanel.action.assembledPieces - 1,
      },
    };
    const identityOptions: RealBuildOptions = {
      ...trustedOptions,
      panels: trustedOptions.panels.map((candidate) => {
        if (candidate.stepNumber === 1) return panel;
        if (candidate.stepNumber === 358) return rebalancedSourcePanel;
        return candidate;
      }),
      coverageByCallout: {
        ...Object.fromEntries(
          Object.entries(trustedOptions.coverageByCallout).filter(
            ([key]) => key !== "fixture-direct-1376",
          ),
        ),
        "p1-c0.png": {
          pageNumber: 1,
          stepNumber: 1,
          quantity: 1,
          identificationConfidence: "vision-kept",
          cropDigest: DIGEST,
          inputDigest: DIGEST,
        },
      },
    };
    const report: RealBuildStepReport = {
      ...completeReport(1),
      calloutPieces: 1,
      expectedAssembledPieces: 1,
      attemptedPieces: 1,
      placedPieces: 1,
      action: panel.action,
      actionEvidenceDigest: DIGEST,
      documentParts: 1,
    };
    const tamperedDocument = {
      ...expectedDocument,
      parts: [
        {
          ...expectedPart,
          catalogPartId: "builtin:plate-1x1",
          transform: { positionLdu: [1, 0, 0] as const, orientationId: "upright-yaw-90" },
        },
      ],
    };
    const tamperedValidation = validateBrickDocument(tamperedDocument);
    const tamperedReport = {
      ...report,
      validation: {
        attempted: true,
        targetDocumentHash: tamperedValidation.targetDocumentHash,
        truthSnapshotHash: tamperedValidation.truthSnapshotHash,
        validatorSetHash: tamperedValidation.validatorSetHash,
        documentGloballyValid: tamperedValidation.documentGloballyValid,
        blockingIssues: tamperedValidation.issues
          .filter(({ severity }) => severity === "blocking")
          .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
        failure: null,
      },
    };
    const bytes = JSON.stringify(tamperedDocument);
    expect(documentStructuralHash(tamperedDocument)).toBe(tamperedValidation.targetDocumentHash);
    const result = finalizeExecutedRealBuildResult({
      options: identityOptions,
      browserOutput: {
        schemaVersion: "lego.real-build-browser-output/1",
        status: "executed",
        reports: [tamperedReport],
        documentJson: bytes,
        identityBindings: [
          {
            identityKey: "brick-a",
            partId: "part-a",
            stepNumber: 1,
            designId: "3005",
            materialId: "1",
            catalogPartId: "builtin:plate-1x1",
            colorId: "builtin:black",
          },
        ],
        fetchedPdfDigest: DIGEST,
        totalElapsedMs: 1,
      },
    });

    expect(result.status).toBe("incomplete");
    expect(result.completionFailures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "visual-evidence-unverified" })]),
    );
    expect(result.completionFailures.map(({ message }) => message).join(" ")).toContain(
      "exact official-ledger",
    );
  });

  it("fails every bad row and requires completed 1464-part truth at step 359", () => {
    const prefix = finalizeExecutedRealBuildResult({
      options: options(1),
      browserOutput: browserOutput(1),
    });
    const badRow: RealBuildResult = {
      ...prefix,
      steps: [
        {
          ...prefix.steps[0]!,
          outcome: {
            status: "failed",
            mechanism: "deferred",
            attemptedMechanism: null,
            failure: { code: "piece-placement-failed", stage: "placement", message: "fabricated" },
          },
        },
      ],
    };
    const badFull: RealBuildResult = {
      ...prefix,
      status: "prefix-complete",
      requestedLastStep: 359,
      expectedPrintedSteps: 359,
      assembledTargetParts: 1_464,
      steps: Array.from({ length: 359 }, (_, index) => completeReport(index + 1)),
      documentJson: documentJson(359),
      finalParts: 0,
    };
    const zeroPartFull = finalizeExecutedRealBuildResult({
      options: options(359),
      browserOutput: browserOutput(359, badFull.steps, badFull.documentJson!),
    });

    expect(realBuildExecutionFailure(badRow)?.message).toContain("local Node finalizer");
    expect(realBuildExecutionFailure(badFull)?.message).toContain("local Node finalizer");
    expect(zeroPartFull.status).toBe("incomplete");
    expect(isLocalRealBuildAuthority(prefix.authority)).toBe(true);
    expect(Object.isFrozen(prefix)).toBe(true);
    expect(Object.isFrozen(prefix.authority)).toBe(true);
    expect(Object.isFrozen(prefix.steps)).toBe(true);
    expect(Object.isFrozen(prefix.steps[0]!.outcome)).toBe(true);
    expect(Reflect.set(prefix.authority, "authenticated", true)).toBe(false);
    expect(Reflect.set(prefix.steps[0]!.outcome, "status", "failed")).toBe(false);
    expect(isLocalRealBuildAuthority({ ...prefix.authority, authenticated: true })).toBe(false);
  });
});
