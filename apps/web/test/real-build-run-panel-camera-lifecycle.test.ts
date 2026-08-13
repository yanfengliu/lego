import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "../e2e/real-build-farther-origin-source-manifest";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-options-types";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const placementCallback = vi.hoisted(() => vi.fn());
const pageDispose = vi.hoisted(() => vi.fn());
const pdfDestroy = vi.hoisted(() => vi.fn(async () => undefined));
const loadingTaskDestroy = vi.hoisted(() => vi.fn(async () => undefined));
const renderPage = vi.hoisted(() => vi.fn());
const deriveEvidence = vi.hoisted(() => vi.fn());
const preparationBoundary = vi.hoisted(() => ({ crossed: false }));
const preparationMutation = vi.hoisted(() => ({ run: null as null | (() => void) }));

function hostileRejectedValue(): object {
  const target = Object.create(null) as object;
  const hostile = new Proxy(target, {
    getOwnPropertyDescriptor: () => {
      throw hostile;
    },
    getPrototypeOf: () => {
      throw hostile;
    },
    ownKeys: () => {
      throw hostile;
    },
    get: () => {
      throw hostile;
    },
  });
  return hostile;
}

vi.mock("../e2e/real-build-browser-preflight", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/real-build-browser-preflight")>();
  const kernel = await import("@lego-studio/brick-kernel");
  return {
    ...actual,
    prepareRealBuildModules: async () => ({
      pdfjs: {},
      lattice: {},
      rendering: {},
      kernel: {
        createEmptyBrickDocument: kernel.createEmptyBrickDocument,
        documentStructuralHash: kernel.documentStructuralHash,
        applyBuildOperations: vi.fn(),
        validateBrickDocument: kernel.validateBrickDocument,
      },
      commands: { createPlacePartTransaction: placementCallback },
      assembly: {},
    }),
    prepareDigestBoundPdf: async () => {
      preparationBoundary.crossed = true;
      preparationMutation.run?.();
      return {
        pdf: { destroy: pdfDestroy },
        loadingTask: { destroy: loadingTaskDestroy },
        fetchedPdfDigest: `sha256:${"a".repeat(64)}`,
      };
    },
    rgbaPngDataUrl: () => "data:image/png;base64,iVBORw0KGgo=",
  };
});

vi.mock("../e2e/real-build-panel-raster", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../e2e/real-build-panel-raster")>();
  return {
    ...actual,
    renderRealBuildPageCanvas: renderPage,
    derivePanelRasterEvidence: deriveEvidence,
  };
});

import { runRealBuild } from "../e2e/real-build-run";
import { readRealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import { snapshotRealBuildRunInput } from "../e2e/real-build-run-input-snapshot";
import { unexecutedStepReport } from "../e2e/real-build-contract";
import {
  createPanelCameraLineageContinuityState,
  panelCameraEvidenceDefect,
} from "../e2e/real-build-browser-output-panel-camera";

function attestedDirectStepOneOptions(): RealBuildOptions {
  const options = completeRealBuildTestOptions(1);
  const movedPiece = options.panels[357]!.pieces[0]!;
  const panels: RealBuildPanelSpec[] = options.panels.map((panel) => {
    if (panel.stepNumber === 1) {
      return {
        ...panel,
        action: {
          kind: "place-callouts" as const,
          assembledPieces: 1,
          evidenceDigest: options.inputDigests.actionLedger,
        },
        pieces: [movedPiece],
        mappedCalloutKeys: [movedPiece.calloutKey],
        calloutPieces: 1,
        classifiedPhysicalCalloutPieces: 1,
      };
    }
    if (panel.stepNumber === 358) {
      if (panel.action.kind !== "place-callouts") {
        throw new TypeError("The test fixture requires printed step 358 to place callouts.");
      }
      return {
        ...panel,
        action: { ...panel.action, assembledPieces: 1_394 },
        pieces: panel.pieces.slice(1),
        mappedCalloutKeys: panel.mappedCalloutKeys.slice(1),
        calloutPieces: 1_394,
        classifiedPhysicalCalloutPieces: 1_394,
      };
    }
    return panel;
  });
  return {
    ...options,
    measuredFartherOriginSourceAttestation: MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
    panels,
    coverageByCallout: {
      ...options.coverageByCallout,
      [movedPiece.calloutKey]: {
        ...options.coverageByCallout[movedPiece.calloutKey]!,
        pageNumber: 1,
        stepNumber: 1,
      },
    },
  };
}

describe("real-build runner panel-camera generation cutover", () => {
  beforeEach(() => {
    preparationBoundary.crossed = false;
    preparationMutation.run = null;
    placementCallback.mockClear();
    pageDispose.mockReset();
    pdfDestroy.mockReset();
    pdfDestroy.mockResolvedValue(undefined);
    loadingTaskDestroy.mockReset();
    loadingTaskDestroy.mockResolvedValue(undefined);
    renderPage.mockReset();
    renderPage.mockResolvedValue({ canvas: {}, dispose: pageDispose });
    deriveEvidence.mockReset();
    deriveEvidence.mockReturnValue({
      width: 1,
      height: 1,
      workPixels: new Uint8ClampedArray([0, 0, 0, 255]),
      builtMask: new Uint8Array(1),
      highlight: { regions: [], closedContourRate: 0, keyedPx: 0 },
      highlightBox: null,
      arrows: { arrows: [], redPx: 0, rejected: [] },
      arrowFamily: [],
      fitSolution: null,
      fitFailure: "not reached after root-lineage refusal",
      fitCoherence: 0,
    });
    vi.stubGlobal("document", { querySelectorAll: () => [] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("bounds a hostile page rejection while retaining the root report", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    renderPage.mockRejectedValue(hostileRejectedValue());

    const output = await runRealBuild(options);

    expect(output).toMatchObject({
      status: "executed",
      reports: [{ stepNumber: 1, panelCamera: { status: "seeded" } }],
    });
    const outcome = output.reports[0]!.outcome;
    if (outcome.status !== "failed") throw new Error("Expected hostile page rejection to fail.");
    expect(outcome.failure.message).toContain("hostile thrown object");
    expect(outcome.failure.message.length).toBeLessThan(2_048);
    expect(output.documentJson).not.toBeNull();
    expect(deriveEvidence).not.toHaveBeenCalled();
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("keeps provisional-preparation defects shadow-only in browser-output /3", async () => {
    const options = attestedDirectStepOneOptions();
    deriveEvidence.mockReturnValueOnce({
      width: 1,
      height: 1,
      workPixels: new Uint8ClampedArray([0, 0, 0]),
      builtMask: new Uint8Array(1),
      highlight: { regions: [], closedContourRate: 0, keyedPx: 0 },
      highlightBox: null,
      arrows: { arrows: [], redPx: 0, rejected: [] },
      arrowFamily: [],
      fitSolution: null,
      fitFailure: "not reached after root-lineage refusal",
      fitCoherence: 0,
    });

    const output = await runRealBuild(options);

    expect(output).toMatchObject({
      status: "executed",
      reports: [
        {
          stepNumber: 1,
          attemptedPieces: 0,
          placedPieces: 0,
          panelCamera: { status: "seeded" },
          outcome: { status: "failed", failure: { code: "camera-handedness-unresolved" } },
        },
      ],
    });
    expect(output.reports[0]!.panelCamera?.candidates).toHaveLength(1);
    expect(output.reports[0]!.panelCamera?.candidates[0]?.attempts).toHaveLength(8);
    expect(output.reports[0]!.panelCamera?.observations).toHaveLength(8);
    expect(output.reports[0]!.outcome.failure?.message).not.toContain("raster lengths");
    expect(deriveEvidence).toHaveBeenCalledOnce();
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("retains genuine panel-raster derivation failures as rendering failures", async () => {
    deriveEvidence.mockImplementationOnce(() => {
      throw new Error("panel raster derivation exploded");
    });

    const output = await runRealBuild(attestedDirectStepOneOptions());

    expect(output).toMatchObject({
      status: "executed",
      reports: [
        {
          stepNumber: 1,
          attemptedPieces: 0,
          placedPieces: 0,
          outcome: { status: "failed", failure: { code: "rendering-error" } },
        },
      ],
    });
    expect(output.reports[0]!.outcome.failure?.message).toContain(
      "panel raster derivation exploded",
    );
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("binds a valid attested raster without granting placement past root-camera refusal", async () => {
    const output = await runRealBuild(attestedDirectStepOneOptions());

    expect(output.reports[0]).toMatchObject({
      attemptedPieces: 0,
      placedPieces: 0,
      outcome: {
        status: "failed",
        failure: { code: "camera-handedness-unresolved" },
      },
    });
    expect(deriveEvidence).toHaveBeenCalledOnce();
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("does not mint from a caller-claimed but non-current source attestation", async () => {
    const options = attestedDirectStepOneOptions();
    deriveEvidence.mockReturnValueOnce({
      width: 1,
      height: 1,
      workPixels: new Uint8ClampedArray([0, 0, 0]),
      builtMask: new Uint8Array(1),
      highlight: { regions: [], closedContourRate: 0, keyedPx: 0 },
      highlightBox: null,
      arrows: { arrows: [], redPx: 0, rejected: [] },
      arrowFamily: [],
      fitSolution: null,
      fitFailure: "not reached after root-lineage refusal",
      fitCoherence: 0,
    });

    const output = await runRealBuild({
      ...options,
      measuredFartherOriginSourceAttestation: {
        ...MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
        digest: `sha256:${"b".repeat(64)}`,
      },
    });

    expect(output.reports[0]!.outcome.failure?.code).toBe("camera-handedness-unresolved");
    expect(output.reports[0]!.outcome.failure?.message).not.toContain("raster lengths");
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("rejects post-await drift before an attested step can be rasterized or prepared", async () => {
    const options = attestedDirectStepOneOptions();
    const firstPanel = options.panels[0] as { maxXPt: number };
    preparationMutation.run = () => {
      firstPanel.maxXPt += 1;
    };

    const output = await runRealBuild(options);

    expect(output).toMatchObject({
      status: "failed",
      reports: [],
      failure: { code: "printed-step-sequence-invalid", inputKey: "panels" },
    });
    expect(renderPage).not.toHaveBeenCalled();
    expect(deriveEvidence).not.toHaveBeenCalled();
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("executes shuffled input globally by printed step and reuses one page raster on demand", async () => {
    const options = { ...completeRealBuildTestOptions(3), panelCameraBranchBudget: 8 };
    const panels = options.panels.map((panel) =>
      panel.stepNumber <= 3 ? { ...panel, pageNumber: 1 } : panel,
    );
    [panels[0], panels[1], panels[2]] = [panels[2]!, panels[0]!, panels[1]!];

    const output = await runRealBuild({ ...options, panels });

    expect(output.reports.map(({ stepNumber }) => stepNumber)).toEqual([1, 2, 3]);
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(renderPage).toHaveBeenCalledWith(expect.anything(), 1, options.renderScale);
    expect(deriveEvidence.mock.calls.map(([input]) => input.spec.stepNumber)).toEqual([1]);
    expect(pageDispose).toHaveBeenCalledOnce();
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("retains one ordered row per step without retrying a failed shared page", async () => {
    const options = { ...completeRealBuildTestOptions(2), panelCameraBranchBudget: 8 };
    const panels = options.panels.map((panel) =>
      panel.stepNumber <= 2 ? { ...panel, pageNumber: 1 } : panel,
    );
    renderPage.mockRejectedValue(new Error("shared page decode failed"));

    const output = await runRealBuild({ ...options, panels });

    expect(output.reports.map(({ stepNumber }) => stepNumber)).toEqual([1, 2]);
    expect(output.reports[0]).toMatchObject({ panelCamera: { status: "seeded" } });
    expect(output.reports[1]).toMatchObject({ panelCamera: null });
    expect(output.reports.map(({ outcome }) => outcome.failure?.code)).toEqual([
      "rendering-error",
      "blocked-by-prior-step",
    ]);
    expect(renderPage).toHaveBeenCalledOnce();
    expect(deriveEvidence).not.toHaveBeenCalled();
    expect(pageDispose).not.toHaveBeenCalled();
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("retains reports and canonical bytes when page disposal fails", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    pageDispose.mockImplementation(() => {
      throw new Error("page cleanup exploded");
    });

    const output = await runRealBuild(options);

    expect(output).toMatchObject({
      status: "failed",
      reports: [{ stepNumber: 1, panelCamera: { status: "seeded" } }],
      failure: { code: "rendering-error", inputKey: "booklet page 1" },
    });
    if (output.status !== "failed") throw new Error("Expected cleanup failure output.");
    expect(output.failure.message).toContain("page cleanup exploded");
    expect(output.documentJson).not.toBeNull();
    expect(JSON.parse(output.documentJson!).parts).toHaveLength(0);
    expect(output.fetchedPdfDigest).toBe(options.inputDigests.pdf);
    expect(
      readRealBuildBrowserOutput(output, snapshotRealBuildRunInput(options).options),
    ).toMatchObject({ envelopeDefect: null, reportDefects: [null] });
    expect(pdfDestroy).toHaveBeenCalledOnce();
    expect(loadingTaskDestroy).toHaveBeenCalledOnce();
  });

  it("retains the executed evidence when PDF and loading-task cleanup both fail", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    pdfDestroy.mockRejectedValue(new Error("pdf destroy exploded"));
    loadingTaskDestroy.mockRejectedValue(new Error("loading task destroy exploded"));

    const output = await runRealBuild(options);

    expect(output).toMatchObject({
      status: "failed",
      reports: [{ stepNumber: 1, panelCamera: { status: "seeded" } }],
      failure: { code: "rendering-error", inputKey: "PDF document" },
    });
    if (output.status !== "failed") throw new Error("Expected cleanup failure output.");
    expect(output.failure.message).toContain("pdf destroy exploded");
    expect(output.failure.message).toContain("loading task destroy exploded");
    expect(output.documentJson).not.toBeNull();
    expect(output.fetchedPdfDigest).toBe(options.inputDigests.pdf);
    expect(
      readRealBuildBrowserOutput(output, snapshotRealBuildRunInput(options).options),
    ).toMatchObject({ envelopeDefect: null, reportDefects: [null] });
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("contains hostile page/PDF/loading cleanup values and preserves retained evidence", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    pageDispose.mockImplementation(() => {
      throw hostileRejectedValue();
    });
    pdfDestroy.mockRejectedValue(hostileRejectedValue());
    loadingTaskDestroy.mockRejectedValue(hostileRejectedValue());

    const output = await runRealBuild(options);

    expect(output).toMatchObject({
      status: "failed",
      reports: [{ stepNumber: 1, panelCamera: { status: "seeded" } }],
    });
    if (output.status !== "failed") throw new Error("Expected hostile cleanup to fail.");
    expect(output.failure.message).toContain("hostile thrown object");
    expect(output.failure.message.length).toBeLessThan(4_096);
    expect(output.documentJson).not.toBeNull();
    expect(JSON.parse(output.documentJson!).parts).toHaveLength(0);
    expect(placementCallback).not.toHaveBeenCalled();
  });

  it("keeps root lineage state stable across a large suffix of null transition rows", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    const output = await runRealBuild(options);
    const root = output.reports[0]!;
    const continuity = createPanelCameraLineageContinuityState(
      root.panelCamera!.candidates[0]!.documentHash,
    );

    expect(
      panelCameraEvidenceDefect(
        root.panelCamera,
        root as unknown as Record<string, unknown>,
        0,
        8,
        continuity,
      ),
    ).toBeNull();
    const eligibleParents = continuity.eligibleParents;
    const seenLineages = continuity.seenLineages;
    let defect: string | null = null;
    const blockedPanel = completeRealBuildTestOptions(1).panels[0]!;
    for (let index = 1; index <= 50_000 && defect === null; index += 1) {
      const blockedBase = unexecutedStepReport(
        { ...blockedPanel, stepNumber: index + 1, pageNumber: index + 1 },
        {
          code: "blocked-by-prior-step",
          stage: "causality",
          stepNumber: index + 1,
          causedByStep: 1,
          message: `Fixture row ${index + 1} remains blocked by printed step 1.`,
        },
        { blockingStep: 1, documentParts: 0 },
      );
      const blocked = {
        ...blockedBase,
        outcome: { ...blockedBase.outcome, mechanism: "blocked" as const },
      };
      defect = panelCameraEvidenceDefect(null, blocked, index, 8, continuity);
    }

    expect(defect).toBeNull();
    expect(continuity.eligibleParents).toBe(eligibleParents);
    expect(continuity.seenLineages).toBe(seenLineages);
    expect(continuity.eligibleParents).toHaveLength(8);
    expect(continuity.seenLineages).toHaveLength(8);
    expect(continuity.reservedAfter).toBe(8);
  });
});
