import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const placementCallback = vi.hoisted(() => vi.fn());
const pageDispose = vi.hoisted(() => vi.fn());
const renderPage = vi.hoisted(() => vi.fn());
const deriveEvidence = vi.hoisted(() => vi.fn());

function positiveSecondStepOptions(samePage: boolean): RealBuildOptions {
  const options = completeRealBuildTestOptions(2);
  const source = options.panels[357]!;
  if (source.action.kind !== "place-callouts" || source.pieces.length === 0) {
    throw new Error("The complete fixture must retain direct pieces at printed step 358.");
  }
  const sourceAction = source.action;
  const [piece, ...remaining] = source.pieces;
  const pageNumber = samePage ? 1 : 2;
  const panels = options.panels.map((panel): RealBuildPanelSpec => {
    if (panel.stepNumber === 2) {
      return {
        ...panel,
        pageNumber,
        action: {
          kind: "place-callouts",
          assembledPieces: 1,
          evidenceDigest: panel.action.evidenceDigest,
        },
        pieces: [piece!],
        mappedCalloutKeys: [piece!.calloutKey],
        calloutPieces: 1,
        classifiedPhysicalCalloutPieces: 1,
      };
    }
    if (panel.stepNumber === 358) {
      return {
        ...source,
        action: { ...sourceAction, assembledPieces: remaining.length },
        pieces: remaining,
        mappedCalloutKeys: remaining.map(({ calloutKey }) => calloutKey),
        calloutPieces: remaining.length,
        classifiedPhysicalCalloutPieces: remaining.length,
      };
    }
    return panel;
  });
  return {
    ...options,
    panelCameraBranchBudget: 8,
    panels,
    coverageByCallout: {
      ...options.coverageByCallout,
      [piece!.calloutKey]: {
        ...options.coverageByCallout[piece!.calloutKey]!,
        pageNumber,
        stepNumber: 2,
      },
    },
  };
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
    prepareDigestBoundPdf: async () => ({
      pdf: { destroy: vi.fn(async () => undefined) },
      loadingTask: { destroy: vi.fn(async () => undefined) },
      fetchedPdfDigest: `sha256:${"a".repeat(64)}`,
    }),
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

import { readRealBuildBrowserOutput } from "../e2e/real-build-browser-output";
import { runRealBuild } from "../e2e/real-build-run";
import { snapshotRealBuildRunInput } from "../e2e/real-build-run-input-snapshot";

function expectReadable(output: unknown, options: RealBuildOptions, rows: number): void {
  expect(
    readRealBuildBrowserOutput(output, snapshotRealBuildRunInput(options).options),
  ).toMatchObject({
    envelopeDefect: null,
    reportDefects: Array.from({ length: rows }, () => null),
  });
}

describe("real-build runner causal blocked output", () => {
  beforeEach(() => {
    placementCallback.mockClear();
    pageDispose.mockReset();
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

  it("emits a readable zero-attempt root refusal", async () => {
    const options = { ...completeRealBuildTestOptions(1), panelCameraBranchBudget: 8 };
    const output = await runRealBuild(options);

    expect(output.reports[0]).toMatchObject({
      attemptedPieces: 0,
      placedPieces: 0,
      outcome: { failure: { code: "camera-handedness-unresolved" } },
      panelCamera: { status: "seeded" },
      panelPng: "data:image/png;base64,iVBORw0KGgo=",
    });
    expect(output.reports[0]!.elapsedMs).toBeGreaterThanOrEqual(0);
    expectReadable(output, options, 1);
  });

  it("keeps a positive-piece suffix readable without raster, search, or placement work", async () => {
    const options = positiveSecondStepOptions(true);
    const output = await runRealBuild(options);

    expect(output.reports[1]).toMatchObject({
      expectedAssembledPieces: 1,
      attemptedPieces: 0,
      placedPieces: 0,
      prerequisites: {
        blockingStep: 1,
        expectedAssembledPieces: 1,
        resolvedPieces: 1,
        localFailure: null,
      },
      outcome: {
        status: "failed",
        mechanism: "blocked",
        attemptedMechanism: null,
        failure: { code: "blocked-by-prior-step", stage: "causality", causedByStep: 1 },
      },
      documentParts: 0,
      elapsedMs: 0,
    });
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(deriveEvidence).toHaveBeenCalledTimes(1);
    expect(placementCallback).not.toHaveBeenCalled();
    expectReadable(output, options, 2);
  });

  it("keeps a would-fail later page causal and exactly free of source or candidate work", async () => {
    const options = positiveSecondStepOptions(false);
    renderPage.mockImplementation(async (_pdf, pageNumber: number) => {
      if (pageNumber === 2) throw new Error("page two decode failed");
      return { canvas: {}, dispose: pageDispose };
    });
    const output = await runRealBuild(options);

    expect(output.reports[1]).toMatchObject({
      outcome: {
        status: "failed",
        mechanism: "blocked",
        failure: { code: "blocked-by-prior-step", causedByStep: 1 },
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
      elapsedMs: 0,
      panelPng: null,
      buildPng: null,
    });
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(deriveEvidence).toHaveBeenCalledTimes(1);
    expect(placementCallback).not.toHaveBeenCalled();
    expectReadable(output, options, 2);
  });
});
