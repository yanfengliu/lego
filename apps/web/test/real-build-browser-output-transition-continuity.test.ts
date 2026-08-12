import { describe, expect, it } from "vitest";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { readRealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import {
  createPanelCameraLineageContinuityState,
  panelCameraEvidenceDefect,
} from "../e2e/real-build-browser-output-panel-camera";
import {
  canonicalTransitionAdvance,
  inspectBrowserOutputCanonicalDocument,
  serializedRealBuildDocumentDefect,
  terminalCanonicalDocumentDefect,
} from "../e2e/real-build-browser-output-transition-continuity";
import { executeCanonicalTransition } from "../e2e/real-build-contract";
import type { RealBuildPanelCameraEvidence } from "../e2e/real-build-panel-camera-evidence";
import { browserOutput, DIGEST, options, PNG } from "./real-build-adversarial-fixtures";

const root = () =>
  createEmptyBrickDocument({
    id: "real-build",
    name: "Real booklet rebuild",
    maxParts: 1_464,
  });

function acceptedOnePartDocument() {
  const base = root();
  const part = createPartInstance({ id: "accepted-part" });
  return {
    ...base,
    parts: [part],
    steps: [{ ...base.steps[0]!, partIds: [part.id] }],
    submodels: [{ ...base.submodels[0]!, partIds: [part.id] }],
  };
}

function terminalDefect(document: ReturnType<typeof acceptedOnePartDocument>): string | null {
  const accepted = acceptedOnePartDocument();
  return terminalCanonicalDocumentDefect({
    boundary: inspectBrowserOutputCanonicalDocument(JSON.stringify(document), [], 1, 1_464),
    expectedRootDocumentHash: documentStructuralHash(root()),
    acceptedDocumentHash: documentStructuralHash(accepted),
    acceptedDocumentParts: 1,
    acceptedSteps: [{ stepNumber: 1, id: "step-1", name: "Step 1", partCount: 1 }],
  });
}

function genuineTransition() {
  const base = root();
  const result = executeCanonicalTransition({
    baseDocument: base,
    printedStepNumber: 2,
    transition: "rotation",
    panelEvidenceDigest: DIGEST,
    steps: base.steps,
    applyOperations: (document, operations) => applyBuildOperations(document, operations as never),
    validate: validateBrickDocument,
  });
  if (result.failure !== null || result.stepId === null)
    throw new Error("fixture transition failed");
  const boundary = inspectBrowserOutputCanonicalDocument(
    JSON.stringify(result.document),
    [2],
    2,
    1_464,
  );
  const evidence = {
    status: "unresolved",
    throughStepNumber: 1,
    registrationPanelStepNumber: 2,
    candidates: [{ selectedObservationId: null, selectedLineageIds: [] }],
    observations: [{ lineageId: "retained-lineage" }],
  } as unknown as RealBuildPanelCameraEvidence;
  const report = {
    action: {
      kind: "transition",
      assembledPieces: 0,
      transition: "rotation",
      panelEvidenceDigest: DIGEST,
      evidenceDigest: DIGEST,
    },
    actionEvidenceDigest: DIGEST,
    expectedAssembledPieces: 0,
    attemptedPieces: 0,
    placedPieces: 0,
    documentParts: 0,
    canonicalStepId: result.stepId,
    outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
    validation: result.validation,
  };
  return { base, boundary, evidence, report };
}

describe("real-build terminal document and transition continuity", () => {
  it("binds root refusals and failed partial outputs to the exact canonical empty document", () => {
    const baseline = browserOutput(1);
    if (baseline.status !== "executed") throw new Error("fixture output must execute");
    expect(readRealBuildBrowserOutput(baseline, options(1)).reproductionDefect).toBeNull();

    const parsed = JSON.parse(baseline.documentJson) as ReturnType<typeof root>;
    const leaked = {
      ...parsed,
      submodels: parsed.submodels.map((submodel) => ({
        ...submodel,
        name: "Renamed but structurally hash-equal",
      })),
    };
    const executed = readRealBuildBrowserOutput(
      { ...baseline, documentJson: JSON.stringify(leaked) },
      options(1),
    );
    expect(executed.reproductionDefect).toMatch(/exact canonical empty/u);

    const failed = readRealBuildBrowserOutput(
      {
        ...baseline,
        status: "failed",
        documentJson: JSON.stringify(leaked),
        failure: { code: "rendering-error", stage: "rendering", message: "cleanup failed" },
      },
      options(1),
    );
    expect(failed.envelopeDefect).toMatch(/exact canonical empty/u);
  });

  it("rejects transform drift plus step, submodel, semantic, provenance, and future-step leakage", () => {
    expect(terminalDefect(acceptedOnePartDocument())).toBeNull();
    const mutations = [
      (document: ReturnType<typeof acceptedOnePartDocument>) => ({
        ...document,
        parts: document.parts.map((part) => ({
          ...part,
          transform: { ...part.transform, positionLdu: [20, 0, 0] as const },
        })),
      }),
      (document: ReturnType<typeof acceptedOnePartDocument>) => ({
        ...document,
        steps: document.steps.map((step) => ({ ...step, name: "Unreported step name" })),
      }),
      (document: ReturnType<typeof acceptedOnePartDocument>) => ({
        ...document,
        submodels: document.submodels.map((submodel) => ({
          ...submodel,
          name: "Unreported submodel name",
        })),
      }),
      (document: ReturnType<typeof acceptedOnePartDocument>) => ({
        ...document,
        semanticRegions: [...document.semanticRegions, { id: "leak", label: "leak", partIds: [] }],
      }),
      (document: ReturnType<typeof acceptedOnePartDocument>) => ({
        ...document,
        parts: document.parts.map((part) => ({
          ...part,
          provenance: { source: "import" as const },
        })),
      }),
      (document: ReturnType<typeof acceptedOnePartDocument>) => ({
        ...document,
        steps: [
          ...document.steps,
          { id: "future", index: 1, name: "Future", partIds: [] as string[] },
        ],
      }),
    ];
    for (const mutate of mutations) {
      expect(terminalDefect(mutate(acceptedOnePartDocument()))).not.toBeNull();
    }
  });

  it("bounds serialized bytes, nesting, whitespace, complexity, and transition step lists", () => {
    expect(serializedRealBuildDocumentDefect("x".repeat(33), 64)).toMatch(/UTF-16/u);
    expect(serializedRealBuildDocumentDefect("€".repeat(30), 75)).toMatch(/UTF-8/u);
    const deep = `${'{"x":'.repeat(65)}0${"}".repeat(65)}`;
    expect(inspectBrowserOutputCanonicalDocument(deep, [], 1, 1_464).defect).toMatch(/depth/u);
    expect(inspectBrowserOutputCanonicalDocument(" ".repeat(100_000), [], 1, 1_464).defect).toMatch(
      /root is not a JSON object/u,
    );
    const tooManyNodes = `{"x":[${"0,".repeat(1_000_001)}0]}`;
    expect(inspectBrowserOutputCanonicalDocument(tooManyNodes, [], 1, 1_464).defect).toMatch(
      /pre-parse structural nodes/u,
    );
    const sparse: number[] = [];
    sparse.length = 2;
    sparse[1] = 2;
    expect(inspectBrowserOutputCanonicalDocument(JSON.stringify(root()), sparse, 2).defect).toMatch(
      /sparse/u,
    );
  });

  it("never serializes hostile, huge, or sparse blocking-issue arrays", () => {
    const { base, boundary, evidence, report } = genuineTransition();
    const toJson = [] as unknown[] & { toJSON?: () => never };
    toJson.toJSON = () => {
      throw new Error("must not run toJSON");
    };
    const accepted = canonicalTransitionAdvance({
      report: { ...report, validation: { ...report.validation, blockingIssues: toJson } },
      evidence,
      reportIndex: 1,
      acceptedDocumentHash: documentStructuralHash(base),
      acceptedDocumentParts: 0,
      witnesses: boundary.transitionWitnesses,
    });
    expect(accepted.kind).toBe("accepted");

    for (const issues of [new Array(1), new Array(1_000_000)]) {
      Object.defineProperty(issues, 0, {
        get: () => {
          throw new Error("must not inspect an issue");
        },
      });
      expect(
        canonicalTransitionAdvance({
          report: { ...report, validation: { ...report.validation, blockingIssues: issues } },
          evidence,
          reportIndex: 1,
          acceptedDocumentHash: documentStructuralHash(base),
          acceptedDocumentParts: 0,
          witnesses: boundary.transitionWitnesses,
        }).kind,
      ).toBe("rejected");
    }
  });

  it("exactly binds every report action digest to both the report action and prepared action", () => {
    const baseline = browserOutput(2);
    const differentDigest = `sha256:${"c".repeat(64)}`;
    const report = baseline.reports[1]!;
    if (report.action.kind !== "transition") throw new Error("fixture action must be a transition");

    for (const mutation of [
      { ...report, actionEvidenceDigest: differentDigest },
      {
        ...report,
        action: { ...report.action, evidenceDigest: differentDigest },
        actionEvidenceDigest: differentDigest,
      },
      { ...report, action: { ...report.action, panelEvidenceDigest: differentDigest } },
      { ...report, action: { ...report.action, classificationEvidenceDigest: differentDigest } },
    ]) {
      const reading = readRealBuildBrowserOutput(
        { ...baseline, reports: [baseline.reports[0]!, mutation] },
        options(2),
      );
      expect(reading.reportDefects[1]).toMatch(/prepared-panel boundary shape/u);
    }
  });

  it("rejects arbitrary root failures and every blocked-row execution or document drift", () => {
    const baseline = browserOutput(2);
    expect(readRealBuildBrowserOutput(baseline, options(2)).reportDefects).toStrictEqual([
      null,
      null,
    ]);
    for (const second of [
      { ...baseline.reports[1]!, attemptedPieces: 1 },
      { ...baseline.reports[1]!, documentParts: 1 },
      {
        ...baseline.reports[1]!,
        validation: { ...baseline.reports[1]!.validation, attempted: true },
      },
      {
        ...baseline.reports[1]!,
        validation: { ...baseline.reports[1]!.validation, failure: null },
      },
      {
        ...baseline.reports[1]!,
        fit: { ...baseline.reports[1]!.fit, coherence: 1 },
      },
      {
        ...baseline.reports[1]!,
        highlight: { ...baseline.reports[1]!.highlight, strokePx: 1 },
      },
      {
        ...baseline.reports[1]!,
        arrows: { ...baseline.reports[1]!.arrows, redPx: 1 },
      },
      { ...baseline.reports[1]!, elapsedMs: 1 },
      { ...baseline.reports[1]!, elapsedMs: 4 * 60 * 60 * 1_000 + 1 },
      { ...baseline.reports[1]!, panelPng: PNG },
      { ...baseline.reports[1]!, buildPng: PNG },
    ]) {
      const reading = readRealBuildBrowserOutput(
        { ...baseline, reports: [baseline.reports[0]!, second] },
        options(2),
      );
      expect(reading.reportDefects[1]).toMatch(/exact unattempted zero-placement blocked outcome/u);
    }

    const rootReport = baseline.reports[0]!;
    const arbitrary = {
      ...rootReport,
      outcome: {
        ...rootReport.outcome,
        failure: {
          code: "coverage-key-mismatch",
          stage: "coverage",
          stepNumber: 1,
          message: "unrelated failure",
        },
      },
    };
    expect(
      panelCameraEvidenceDefect(
        arbitrary.panelCamera,
        arbitrary,
        0,
        options(2).panelCameraBranchBudget,
        createPanelCameraLineageContinuityState(arbitrary.panelCamera!.candidates[0]!.documentHash),
      ),
    ).toMatch(/unattempted zero-placement refusal/u);

    const renderingFailure = {
      ...rootReport,
      elapsedMs: 0,
      outcome: {
        ...rootReport.outcome,
        failure: {
          code: "rendering-error",
          stage: "rendering",
          stepNumber: 1,
          message: "booklet page rasterization failed before placement",
        },
      },
    };
    expect(
      panelCameraEvidenceDefect(
        renderingFailure.panelCamera,
        renderingFailure,
        0,
        options(2).panelCameraBranchBudget,
        createPanelCameraLineageContinuityState(
          renderingFailure.panelCamera!.candidates[0]!.documentHash,
        ),
      ),
    ).toBeNull();

    for (const rasterDrift of [
      { panelPng: PNG },
      { fit: { ...rootReport.fit, coherence: 0.5 } },
      { highlight: { ...rootReport.highlight, strokePx: 1 } },
      { arrows: { ...rootReport.arrows, redPx: 1 } },
    ]) {
      const forged = { ...renderingFailure, ...rasterDrift };
      expect(
        panelCameraEvidenceDefect(
          forged.panelCamera,
          forged,
          0,
          options(2).panelCameraBranchBudget,
          createPanelCameraLineageContinuityState(forged.panelCamera!.candidates[0]!.documentHash),
        ),
      ).toMatch(/unattempted zero-placement refusal/u);
    }

    const delayedRenderingFailure = { ...renderingFailure, elapsedMs: 37 };
    expect(
      panelCameraEvidenceDefect(
        delayedRenderingFailure.panelCamera,
        delayedRenderingFailure,
        0,
        options(2).panelCameraBranchBudget,
        createPanelCameraLineageContinuityState(
          delayedRenderingFailure.panelCamera!.candidates[0]!.documentHash,
        ),
      ),
    ).toBeNull();

    const cameraEvidence = {
      ...rootReport,
      elapsedMs: 17,
      fit: { ...rootReport.fit, coherence: 0.5, failure: null },
      highlight: { ...rootReport.highlight, regions: 1, strokePx: 12 },
      arrows: { ...rootReport.arrows, redPx: 4 },
      panelPng: PNG,
    };
    expect(
      panelCameraEvidenceDefect(
        cameraEvidence.panelCamera,
        cameraEvidence,
        0,
        options(2).panelCameraBranchBudget,
        createPanelCameraLineageContinuityState(
          cameraEvidence.panelCamera!.candidates[0]!.documentHash,
        ),
      ),
    ).toBeNull();

    for (const drift of [
      { attemptedPieces: 1 },
      { deferral: {} },
      { fartherCaptures: [{}] },
      { buildPng: PNG },
    ]) {
      const forged = { ...rootReport, ...drift };
      expect(
        panelCameraEvidenceDefect(
          forged.panelCamera,
          forged,
          0,
          options(2).panelCameraBranchBudget,
          createPanelCameraLineageContinuityState(forged.panelCamera!.candidates[0]!.documentHash),
        ),
      ).toMatch(/unattempted zero-placement refusal/u);
    }
  });
});
