import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeRealBuildTestOptions, REAL_BUILD_TEST_DIGEST } from "./real-build-test-options";

const placementCallback = vi.hoisted(() => vi.fn());
const pageDispose = vi.hoisted(() => vi.fn());
const pdfDestroy = vi.hoisted(() => vi.fn(async () => undefined));
const loadingTaskDestroy = vi.hoisted(() => vi.fn(async () => undefined));
const renderPage = vi.hoisted(() => vi.fn());
const deriveEvidence = vi.hoisted(() => vi.fn());
const preparationBoundary = vi.hoisted(() => ({ crossed: false }));
const preparationMutation = vi.hoisted(() => ({ run: null as null | (() => void) }));

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

  it("retains all eight roots and refuses step 1 before any placement callback mutates the document", async () => {
    const options = {
      ...completeRealBuildTestOptions(1),
      panelCameraBranchBudget: 8,
    };
    const output = await runRealBuild(options);

    expect(output.schemaVersion).toBe("lego.real-build-browser-output/3");
    expect(output.status).toBe("executed");
    expect(output.reports).toHaveLength(1);
    expect(output.reports[0]).toMatchObject({
      stepNumber: 1,
      attemptedPieces: 0,
      placedPieces: 0,
      canonicalStepId: null,
      outcome: {
        status: "failed",
        attemptedMechanism: null,
        failure: { code: "camera-handedness-unresolved", stage: "camera-registration" },
      },
      panelCamera: {
        status: "seeded",
        throughStepNumber: 0,
        registrationPanelStepNumber: 1,
        reservation: { budget: 8, reservedBefore: 0, requested: 8, reservedAfter: 8 },
      },
    });
    expect(output.reports[0]!.panelCamera?.observations).toHaveLength(8);
    expect(output.reports[0]!.panelCamera?.candidates[0]?.attempts).toHaveLength(8);
    expect(placementCallback).not.toHaveBeenCalled();
    expect(JSON.parse(output.documentJson!).parts).toHaveLength(0);
    expect(pageDispose).toHaveBeenCalledOnce();
    expect(pdfDestroy).toHaveBeenCalledOnce();
    expect(loadingTaskDestroy).toHaveBeenCalledOnce();
    expect(output.fetchedPdfDigest).toBe(REAL_BUILD_TEST_DIGEST);
  });

  it("rejects reversed page bindings before imports or a later step can execute", async () => {
    const options = completeRealBuildTestOptions(2);
    const panels = options.panels.map((panel) =>
      panel.stepNumber === 1
        ? { ...panel, pageNumber: 2 }
        : panel.stepNumber === 2
          ? { ...panel, pageNumber: 1 }
          : panel,
    );
    const output = await runRealBuild({ ...options, panels });

    expect(output).toMatchObject({
      status: "failed",
      reports: [],
      failure: { code: "printed-step-sequence-invalid", inputKey: "panels" },
    });
    expect(renderPage).not.toHaveBeenCalled();
    expect(deriveEvidence).not.toHaveBeenCalled();
    expect(placementCallback).not.toHaveBeenCalled();
    expect(pdfDestroy).not.toHaveBeenCalled();
    expect(output).toMatchObject({ documentJson: null, fetchedPdfDigest: null });
    expect(
      readRealBuildBrowserOutput(output, snapshotRealBuildRunInput({ ...options, panels }).options),
    ).toMatchObject({ envelopeDefect: null, reportDefects: [] });
  });

  it("rejects a post-preflight page flip before rasterization or placement", async () => {
    const options = completeRealBuildTestOptions(1);
    const firstPanel = { ...options.panels[0]! } as {
      pageNumber: number;
    } & (typeof options.panels)[number];
    const panels = [firstPanel, ...options.panels.slice(1)];
    preparationMutation.run = () => {
      firstPanel.pageNumber = 2;
    };

    const output = await runRealBuild({ ...options, panels });

    expect(output).toMatchObject({
      status: "failed",
      reports: [],
      failure: {
        code: "printed-step-sequence-invalid",
        inputKey: "panels",
      },
    });
    if (output.status !== "failed") throw new Error("Expected the changed step sequence to fail.");
    expect(output.failure.message).toContain(
      "before page rasterization, candidate search, or placement",
    );
    expect(renderPage).not.toHaveBeenCalled();
    expect(deriveEvidence).not.toHaveBeenCalled();
    expect(placementCallback).not.toHaveBeenCalled();
    expect(pdfDestroy).toHaveBeenCalledOnce();
    expect(loadingTaskDestroy).toHaveBeenCalledOnce();
  });

  it("rejects post-preflight digest mutation before rasterization or placement", async () => {
    const options = completeRealBuildTestOptions(1);
    const inputDigests = { ...options.inputDigests };
    preparationMutation.run = () => {
      inputDigests.pdf = `sha256:${"b".repeat(64)}`;
    };

    const output = await runRealBuild({ ...options, inputDigests });

    expect(output).toMatchObject({
      status: "failed",
      reports: [],
      failure: { code: "printed-step-sequence-invalid", inputKey: "panels" },
    });
    if (output.status !== "failed") throw new Error("Expected input drift to fail.");
    expect(output.failure.message).toContain("digests");
    expect(renderPage).not.toHaveBeenCalled();
    expect(deriveEvidence).not.toHaveBeenCalled();
    expect(placementCallback).not.toHaveBeenCalled();
    expect(pdfDestroy).toHaveBeenCalledOnce();
    expect(loadingTaskDestroy).toHaveBeenCalledOnce();
  });

  it("retains seeded root counterevidence when step-1 raster preparation fails", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    deriveEvidence.mockImplementation(() => {
      throw new Error("hostile raster failure");
    });

    const output = await runRealBuild(options);
    expect(output.reports).toHaveLength(1);
    expect(output.reports[0]).toMatchObject({
      outcome: { status: "failed", failure: { code: "rendering-error" } },
      panelCamera: { status: "seeded" },
      attemptedPieces: 0,
      placedPieces: 0,
      canonicalStepId: null,
      elapsedMs: 0,
      fit: {
        azimuthDegrees: null,
        elevationDegrees: null,
        pixelsPerUnit: null,
        residualPx: null,
        coherence: 0,
      },
      highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
      arrows: { kept: 0, redPx: 0, rejected: 0, displacementFamily: 0 },
      panelPng: null,
      buildPng: null,
    });
    expect(placementCallback).not.toHaveBeenCalled();
    expect(
      readRealBuildBrowserOutput(output, snapshotRealBuildRunInput(options).options),
    ).toMatchObject({ envelopeDefect: null, reportDefects: [null] });
  });

  it("keeps a delayed root raster exception readable with honest measured elapsed", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    let now = 0;
    vi.stubGlobal("performance", {
      now: () => {
        now += 10;
        return now;
      },
    });
    deriveEvidence.mockImplementation(() => {
      throw new Error("delayed hostile raster failure");
    });

    const output = await runRealBuild(options);
    expect(output.reports[0]).toMatchObject({
      outcome: { status: "failed", failure: { code: "rendering-error" } },
      panelCamera: { status: "seeded" },
      elapsedMs: 10,
      panelPng: null,
      buildPng: null,
    });
    expect(
      readRealBuildBrowserOutput(output, snapshotRealBuildRunInput(options).options),
    ).toMatchObject({ envelopeDefect: null, reportDefects: [null] });
  });

  it("does not acquire a later page after the root refusal and retains exact causal output", async () => {
    const options = { ...completeRealBuildTestOptions(2), panelCameraBranchBudget: 8 };
    renderPage.mockImplementation(async (_pdf, pageNumber: number) => {
      if (pageNumber === 2) throw new Error("page two decode failed");
      return { canvas: {}, dispose: pageDispose };
    });

    const output = await runRealBuild(options);
    expect(output.status).toBe("executed");
    expect(output.reports).toHaveLength(2);
    expect(output.reports[0]).toMatchObject({
      stepNumber: 1,
      panelCamera: { status: "seeded" },
    });
    expect(output.reports[1]).toMatchObject({
      stepNumber: 2,
      pageNumber: 2,
      attemptedPieces: 0,
      placedPieces: 0,
      prerequisites: { blockingStep: 1 },
      outcome: {
        status: "failed",
        mechanism: "blocked",
        attemptedMechanism: null,
        failure: { code: "blocked-by-prior-step", stage: "causality", causedByStep: 1 },
      },
      fit: {
        azimuthDegrees: null,
        elevationDegrees: null,
        pixelsPerUnit: null,
        residualPx: null,
        coherence: 0,
      },
      camera: null,
      panelCamera: null,
      highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
      arrows: {
        kept: 0,
        redPx: 0,
        rejected: 0,
        displacementFamily: 0,
        displacementFamilyLdu: [],
      },
      pieces: [],
      jointVisual: null,
      deferral: null,
      farther: null,
      fartherCaptures: [],
      explodedGhost: null,
      documentParts: 0,
      elapsedMs: 0,
      panelPng: null,
      buildPng: null,
    });
    const secondOutcome = output.reports[1]!.outcome;
    expect(secondOutcome.status).toBe("failed");
    if (secondOutcome.status !== "failed") throw new Error("Expected a failed step-2 outcome.");
    expect(secondOutcome.failure.message).toContain("step 1 failed");
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(deriveEvidence).toHaveBeenCalledTimes(1);
    expect(pdfDestroy).toHaveBeenCalledOnce();
    expect(placementCallback).not.toHaveBeenCalled();
  });
});
