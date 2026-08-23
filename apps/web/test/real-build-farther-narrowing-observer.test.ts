import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createNarrowingRenderBudgetLedger,
  createWholeStepCandidateBudgetLedger,
} from "../e2e/real-build-deferral";
import {
  expandFartherPrintedStep,
  type FartherNarrowingBatchObservation,
  type FartherNarrowingBatchOutcomeObservation,
  type FartherNarrowingRenderObservation,
} from "../e2e/real-build-farther-step";
import type { PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import type { RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

type TestDocument = {
  readonly id: string;
  readonly revision: number;
  readonly parts: readonly { readonly id: string; readonly colorId: string }[];
};

const hashDocument = (document: TestDocument): string =>
  `sha256:${document.id}:${document.revision}`;

const rgba = (probe = false): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(16);
  for (let index = 0; index < 4; index += 1) {
    pixels[index * 4] = 0x89;
    pixels[index * 4 + 1] = 0x90;
    pixels[index * 4 + 2] = 0x93;
    pixels[index * 4 + 3] = 255;
  }
  if (probe) {
    pixels[0] = 0x92;
    pixels[1] = 0x39;
    pixels[2] = 0x78;
  } else {
    pixels[0] = 0;
    pixels[1] = 0;
    pixels[2] = 0;
  }
  return pixels;
};

const spec: RealBuildPanelSpec = {
  stepNumber: 6,
  pageNumber: 1,
  panelFace: "studs-up",
  minXPt: 0,
  maxXPt: 20,
  minYPt: 0,
  maxYPt: 20,
  calloutBoxes: [],
  mappedCalloutKeys: [],
  action: {
    kind: "place-callouts",
    assembledPieces: 1,
    evidenceDigest: `sha256:${"a".repeat(64)}`,
  },
  pieces: [
    {
      identityKey: "identity-6",
      designId: "3001",
      materialId: "26",
      catalogPartId: "builtin:brick-2x4",
      colorId: "builtin:black",
      calloutKey: "callout-6",
      identificationConfidence: "pair-judged-same",
      cropDigest: null,
      identificationInputDigest: null,
      expectedTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    },
  ],
  omittedPieces: [],
  calloutPieces: 1,
  classifiedPhysicalCalloutPieces: 1,
  semanticMultiplierQuantity: 0,
  omittedPhysicalPieces: 0,
  coverageFailures: [],
  missingDesigns: [],
  unresolvedCallouts: [],
};

const evidence: PanelRasterEvidence = {
  width: 2,
  height: 2,
  workPixels: rgba(),
  fitSolution: { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1, residualPx: 0 },
  fitFailure: null,
  fitCoherence: 1,
  faceCorrectedFit: { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1 },
  highlight: {
    regions: [],
    closedContourRate: 0,
    keyedPx: 0,
    mask: new Uint8Array(4),
    strokeMask: new Uint8Array(4),
    contourStrokeMask: new Uint8Array(4),
  },
  highlightBox: null,
  builtMask: new Uint8Array([1, 0, 0, 0]),
  arrows: { arrows: [], rejected: [], redPx: 0 },
  arrowFamily: [],
};

function expansionHarness(observe: boolean, onDispose = vi.fn(), rejectCompletedBatch = false) {
  const candidates = [0, 1].map((index) => ({
    catalogPartId: "builtin:brick-2x4",
    transform: {
      positionLdu: [index * 20, 8, 0] as const,
      orientationId: "upright-yaw-0",
    },
  }));
  const documentStructuralHash = vi.fn(hashDocument);
  const sha256Hex = vi.fn(() => "f".repeat(64));
  const batches: FartherNarrowingBatchObservation[] = [];
  const outcomes: FartherNarrowingBatchOutcomeObservation[] = [];
  const renders: FartherNarrowingRenderObservation[] = [];
  const parentDocument: TestDocument = {
    id: "origin-0",
    revision: 0,
    parts: [{ id: "origin-part-0", colorId: "builtin:black" }],
  };
  const options = {
    ...completeRealBuildTestOptions(7),
    workFactor: 1,
    deferredCandidateBudget: 16,
    deferredNarrowingRenderBudget: 16,
  };
  const result = expandFartherPrintedStep({
    parentCandidateId: "origin-0",
    parentDocument,
    parentStepId: "step-005",
    spec,
    evidence,
    options,
    modules: {
      rendering: {
        createInstructionRenderer: () => ({
          render: (document: TestDocument) =>
            rgba(document.parts.some(({ colorId }) => colorId === "builtin:magenta")),
          dispose: onDispose,
        }),
        deriveBrickScene: (document: TestDocument) => ({ root: document, dispose: () => {} }),
        setInstructionSilhouetteMode: () => {},
        createOrthographicViewCamera: () => ({}),
      },
      kernel: { documentStructuralHash, sha256Hex },
      assembly: {
        highlightExclusionMask: () => new Uint8Array(4),
        enumeratePlacements: () => ({ candidates }),
        placementOccupancyKey: (_catalogPartId: string, transform: unknown) =>
          JSON.stringify(transform),
        scoreStepDelta: () => ({
          schemaVersion: "lego.step-delta-score/1",
          regionIou: null,
          strokeRecall: 0,
          boundaryPrecision: 0,
          strokeF1: 0,
          score: 0,
          basis: "stroke",
          candidateAreaPx: 0,
          candidateBoundaryPx: 0,
          strokePx: 0,
        }),
        rankStepDelta: () => 0,
      },
    },
    ledger: createNarrowingRenderBudgetLedger(16),
    candidateLedger: createWholeStepCandidateBudgetLedger(16),
    ...(observe
      ? {
          narrowingObserver: {
            beginBatch: (observation: FartherNarrowingBatchObservation) =>
              batches.push(observation),
            render: (observation: FartherNarrowingRenderObservation) => renders.push(observation),
            endBatch: (observation: FartherNarrowingBatchOutcomeObservation) => {
              outcomes.push(observation);
              if (rejectCompletedBatch) throw new Error("observer outcome rejected");
            },
          },
        }
      : {}),
    place: (base, _catalogPartId, transform, colorId) => {
      const transformKey = (transform as { readonly positionLdu: readonly number[] })
        .positionLdu[0];
      const partId = `${base.id}-part-${base.parts.length}-${transformKey}`;
      return {
        document: {
          id: `${base.id}-next-${transformKey}`,
          revision: base.revision + 1,
          parts: [...base.parts, { id: partId, colorId }],
        },
        partId,
        stepId: "step-006",
      };
    },
  });
  return { result, batches, outcomes, renders, documentStructuralHash, sha256Hex, onDispose };
}

beforeEach(() => {
  vi.stubGlobal(
    "ImageData",
    class TestImageData {
      constructor(
        readonly data: Uint8ClampedArray,
        readonly width: number,
        readonly height: number,
      ) {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("farther-step narrowing observation", () => {
  it("leaves production output unchanged when the observer is omitted", () => {
    const plain = expansionHarness(false);
    const observed = expansionHarness(true);

    expect(observed.result).toEqual(plain.result);
    expect(plain.batches).toEqual([]);
    expect(plain.outcomes).toEqual([]);
    expect(plain.renders).toEqual([]);
    expect(plain.sha256Hex).not.toHaveBeenCalled();
    expect(observed.documentStructuralHash.mock.calls.length).toBe(
      plain.documentStructuralHash.mock.calls.length + observed.batches.length,
    );
    expect(observed.sha256Hex).toHaveBeenCalledTimes(observed.renders.length);
  });

  it("records every offered row after its exact score and mask exist", () => {
    const observed = expansionHarness(true);

    expect(observed.result.failure).toBeNull();
    expect(observed.result.expansion.narrowingRenders).toBe(2);
    expect(observed.batches).toEqual([
      {
        parentCandidateId: "origin-0",
        batchIndex: 0,
        prefixDocumentHash: "sha256:origin-0:0",
        catalogPartId: "builtin:brick-2x4",
        colorId: "builtin:black",
        offeredCount: 2,
      },
    ]);
    expect(observed.renders.map(({ rowIndex, score }) => ({ rowIndex, score }))).toEqual([
      { rowIndex: 0, score: 0 },
      { rowIndex: 1, score: 0 },
    ]);
    expect(observed.renders.map(({ probeMaskDigest }) => probeMaskDigest)).toEqual([
      `sha256:${"f".repeat(64)}`,
      `sha256:${"f".repeat(64)}`,
    ]);
    expect(observed.outcomes).toEqual([
      {
        parentCandidateId: "origin-0",
        batchIndex: 0,
        prefixDocumentHash: "sha256:origin-0:0",
        catalogPartId: "builtin:brick-2x4",
        colorId: "builtin:black",
        offeredCount: 2,
        carriedRowIndices: [0, 1],
      },
    ]);
    expect(observed.renders[0]!.transform).not.toBe(observed.renders[1]!.transform);
  });

  it("disposes the renderer when a diagnostic observer rejects a completed batch", () => {
    const onDispose = vi.fn();
    expect(() => expansionHarness(true, onDispose, true)).toThrow("observer outcome rejected");

    expect(onDispose).toHaveBeenCalledOnce();
  });
});
