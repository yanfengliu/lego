import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeferredUnresolvedCandidate } from "../e2e/real-build-deferred-step";
import { attemptFartherPrintedStep } from "../e2e/real-build-farther-step";
import type { PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import type { RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

type Document = {
  readonly id: string;
  readonly revision: number;
  readonly parts: readonly { readonly id: string; readonly colorId: string }[];
};

const hashDocument = (document: Document): string => `sha256:${document.id}:${document.revision}`;

const spec = (stepNumber: number): RealBuildPanelSpec => ({
  stepNumber,
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
      identityKey: `identity-${stepNumber}`,
      designId: "3001",
      materialId: "26",
      catalogPartId: "builtin:brick-2x4",
      colorId: "builtin:black",
      calloutKey: `callout-${stepNumber}`,
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
});

const rgba = (mode: "foreground" | "background" | "probe" = "foreground"): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(2 * 2 * 4);
  for (let index = 0; index < 4; index += 1) {
    pixels[index * 4] = 0x89;
    pixels[index * 4 + 1] = 0x90;
    pixels[index * 4 + 2] = 0x93;
    pixels[index * 4 + 3] = 255;
  }
  if (mode !== "background") {
    pixels[0] = mode === "probe" ? 0x92 : 0;
    pixels[1] = mode === "probe" ? 0x39 : 0;
    pixels[2] = mode === "probe" ? 0x78 : 0;
  }
  return pixels;
};

const evidence = (cameraResolved: boolean): PanelRasterEvidence => ({
  width: 2,
  height: 2,
  workPixels: rgba(),
  fitSolution: { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1, residualPx: 0 },
  fitFailure: null,
  fitCoherence: 1,
  faceCorrectedFit: cameraResolved
    ? { azimuthDegrees: 45, elevationDegrees: 30, pixelsPerUnit: 1 }
    : null,
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
});

const origins = (): readonly DeferredUnresolvedCandidate<Document>[] =>
  [0, 1].map((index) => {
    const document: Document = {
      id: `origin-${index}`,
      revision: 0,
      parts: [{ id: `origin-part-${index}`, colorId: "builtin:black" }],
    };
    return {
      candidateId: `origin-${index}`,
      document,
      documentHash: hashDocument(document),
      partIds: [`origin-part-${index}`],
      stepId: "step-005",
      registrations: [],
      pieces: [
        {
          catalogPartId: "builtin:brick-2x4",
          colorId: "builtin:black",
          transform: { positionLdu: [index * 20, 8, 0], orientationId: "upright-yaw-0" },
        },
      ],
      lookaheadAgreement: 0.6,
      lookaheadShiftPx: [0, 0],
      lookaheadPixels: null,
    };
  });

const harness = (
  offeredPlacements: 1 | 2,
  narrowingBudget: number,
  behavior: {
    readonly revealingK?: boolean;
    readonly onDeriveScene?: (document: Document) => void;
  } = {},
) => {
  const candidates = Array.from({ length: offeredPlacements }, (_, index) => ({
    catalogPartId: "builtin:brick-2x4",
    transform: {
      positionLdu: [index * 20, 8, 0] as const,
      orientationId: "upright-yaw-0",
    },
  }));
  const placedDocuments: Document[] = [];
  const modules = {
    rendering: {
      createInstructionRenderer: () => ({
        render: (document: Document) =>
          document.parts.some(({ colorId }) => colorId === "builtin:magenta")
            ? rgba("probe")
            : behavior.revealingK && document.id.startsWith("origin-0-next-")
              ? rgba("background")
              : rgba(),
        dispose: () => {},
      }),
      deriveBrickScene: (document: Document) => {
        behavior.onDeriveScene?.(document);
        return { root: document, dispose: () => {} };
      },
      setInstructionSilhouetteMode: () => {},
      createOrthographicViewCamera: () => ({}),
    },
    kernel: { documentStructuralHash: hashDocument },
    assembly: {
      highlightExclusionMask: () => new Uint8Array(4),
      enumeratePlacements: () => ({ candidates }),
      placementOccupancyKey: (_catalogPartId: string, transform: unknown) =>
        JSON.stringify(transform),
      scoreStepDelta: () => ({}),
      rankStepDelta: () => 0,
    },
  };
  const place = (base: Document, _catalogPartId: string, transform: unknown, colorId: string) => {
    const transformKey = (transform as { readonly positionLdu: readonly number[] }).positionLdu[0];
    const partId = `${base.id}-part-${base.parts.length}-${transformKey}`;
    const document = {
      id: `${base.id}-next-${transformKey}`,
      revision: base.revision + 1,
      parts: [...base.parts, { id: partId, colorId }],
    };
    placedDocuments.push(document);
    return {
      document,
      partId,
      stepId: "step-006",
    };
  };
  const candidatesAtN = origins();
  const baseDocument: Document = { id: "base", revision: 0, parts: [] };
  return {
    placedDocuments,
    input: {
      originSpec: spec(5),
      originStatus: "unseparated" as const,
      originMargin: 0,
      originMinimumMargin: 0.01,
      baseDocument,
      origins: candidatesAtN,
      interveningSpec: spec(6),
      interveningEvidence: evidence(true),
      fartherSpec: spec(7),
      options: {
        ...completeRealBuildTestOptions(7),
        workFactor: 1,
        deferredCandidateBudget: 16,
        deferredNarrowingRenderBudget: narrowingBudget,
        fartherPanelRenderBudget: 16,
        fartherPanelMaximumReachSteps: 2,
      },
      modules,
      place,
    },
  };
};

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
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ putImageData: () => {} }),
      toDataURL: () => "data:image/png;base64,lazy-k",
    }),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("farther-step lazy K evidence", () => {
  it("does not load K when expansion refuses its narrowing budget", async () => {
    const probe = harness(2, 3);
    const loadFartherEvidence = vi.fn(async () => evidence(false));

    const result = await attemptFartherPrintedStep({ ...probe.input, loadFartherEvidence });

    expect(result.evidence.refusal).toMatchObject({
      code: "aggregate-narrowing-budget-exhausted",
    });
    expect(loadFartherEvidence).not.toHaveBeenCalled();
  });

  it("loads K exactly once only after every parent completes", async () => {
    const probe = harness(1, 16);
    const loadFartherEvidence = vi.fn(async () => evidence(false));

    const result = await attemptFartherPrintedStep({ ...probe.input, loadFartherEvidence });

    expect(loadFartherEvidence).toHaveBeenCalledOnce();
    expect(result.evidence.carries).toHaveLength(1);
    expect(result.evidence.refusal?.code).toBe("not-observable");
    expect(result.evidence.panels.map(({ stepNumber }) => stepNumber)).toEqual([6, 7]);
  });

  it("types a rejected K load while retaining N+1, carry, and unresolved lineages", async () => {
    const probe = harness(1, 16);
    const loadFartherEvidence = vi.fn(async () => {
      throw new Error("synthetic raster rejection");
    });

    const result = await attemptFartherPrintedStep({ ...probe.input, loadFartherEvidence });

    expect(loadFartherEvidence).toHaveBeenCalledOnce();
    expect(result.evidence.refusal).toMatchObject({
      code: "incomplete-panel-evidence",
      stage: "evidence",
      stepNumber: 7,
    });
    expect(result.evidence.refusal?.message).toContain("synthetic raster rejection");
    expect(result.evidence.carries[0]).toMatchObject({
      parentCandidates: 2,
      parentsExpanded: 2,
      offeredCandidates: 2,
    });
    expect(result.evidence.carries[0]!.measuredLineages).toHaveLength(2);
    expect(result.evidence.panels.map(({ stepNumber }) => stepNumber)).toEqual([6]);
    expect(result.selectedOrigin).toBeNull();
  });

  it("rehashes exact origins and children after the asynchronous K load", async () => {
    for (const target of ["base", "origin", "child"] as const) {
      const probe = harness(1, 16);
      const loadFartherEvidence = vi.fn(async () => {
        await Promise.resolve();
        const document =
          target === "base"
            ? probe.input.baseDocument
            : target === "origin"
              ? probe.input.origins[0]!.document
              : probe.placedDocuments[0]!;
        (document as { revision: number }).revision += 1;
        return evidence(false);
      });

      const result = await attemptFartherPrintedStep({ ...probe.input, loadFartherEvidence });

      expect(result.evidence.refusal?.code, target).toBe("farther-input-invalid");
      expect(result.evidence.refusal?.message, target).toContain("documentStructuralHash returned");
      expect(result.evidence.carries, target).toHaveLength(1);
      expect(
        result.evidence.panels.map(({ stepNumber }) => stepNumber),
        target,
      ).toEqual([6]);
      expect(result.selectedOrigin, target).toBeNull();
    }
  });

  it("refuses a K renderer that mutates a child without admitting its panel", async () => {
    let mutated = false;
    const probe = harness(1, 16, {
      onDeriveScene: (document) => {
        if (!mutated && document.id.startsWith("origin-0-next-")) {
          (document as { revision: number }).revision += 1;
          mutated = true;
        }
      },
    });
    const loadFartherEvidence = vi.fn(async () => evidence(true));

    const result = await attemptFartherPrintedStep({ ...probe.input, loadFartherEvidence });

    expect(mutated).toBe(true);
    expect(result.evidence.refusal?.code).toBe("farther-input-invalid");
    expect(result.evidence.refusal?.message).toContain('Candidate "step-006:');
    expect(result.evidence.carries).toHaveLength(1);
    expect(result.evidence.panels.map(({ stepNumber }) => stepNumber)).toEqual([6]);
    expect(result.captures.some(({ panelStepNumber }) => panelStepNumber === 7)).toBe(false);
  });

  it("lets a revealing K select only its origin family and leaves descendants unsettled", async () => {
    const probe = harness(2, 16, { revealingK: true });
    const loadFartherEvidence = vi.fn(async () => evidence(true));

    const result = await attemptFartherPrintedStep({ ...probe.input, loadFartherEvidence });

    expect(result.evidence.refusal).toBeNull();
    expect(result.evidence.decision).toMatchObject({
      originCandidateId: "origin-1",
      revealingStepNumber: 7,
      descendantSettled: false,
    });
    expect(result.evidence.decision?.survivingCandidateIds).toHaveLength(2);
    expect(result.evidence.decision?.rejectedCandidateIds).toHaveLength(2);
    expect(result.selectedOrigin?.candidateId).toBe("origin-1");
    expect(result.evidence.panels.at(-1)).toMatchObject({
      stepNumber: 7,
      status: "revealing",
      descendantMargin: 0,
    });
  });
});
