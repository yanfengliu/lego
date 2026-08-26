import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeferredUnresolvedCandidate } from "../e2e/real-build-deferred-step";
import {
  MEASURED_FARTHER_ORIGIN_CANDIDATES,
  MEASURED_FARTHER_ORIGIN_PANEL_SPECS,
} from "../e2e/real-build-farther-origin-policy";
import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "../e2e/real-build-farther-origin-source-manifest";
import { attemptFartherPrintedStep } from "../e2e/real-build-farther-step";
import type { PanelRasterEvidence } from "../e2e/real-build-panel-raster";
import type { RealBuildPanelRasterSpec, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

type Document = {
  readonly id: string;
  readonly revision: number;
  readonly parts: readonly {
    readonly id: string;
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly transform: unknown;
  }[];
  readonly calibratedHash?: string;
};

const hashDocument = (document: Document): string =>
  document.calibratedHash !== undefined && document.revision === 0
    ? document.calibratedHash
    : `sha256:${document.id}:${document.revision}`;

const MEASURED_ORIGIN_IDS = [
  "step-005:sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8",
  "step-005:sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
] as const;

const MEASURED_INPUT_DIGESTS = {
  pdf: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  calloutManifest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
  coverage: "sha256:0ed8fb0225057ba6d36ae00f45d37921a0b590ff6de42fa96774545d62a4c3c6",
  officialModel: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  actionLedger: "sha256:e88688b23310b9ae16039c57f0ffbf2c5cbf36385e81af6e4824ac9faf64a377",
  highlightCalibration: "sha256:f18939b8b9b98123868c437561113f81c44142b4004aa206dfaf7d4b954ffadf",
  builderCalibration: "sha256:da326b44897eec7d0a3a7049c0d06cb8ae8c0fbcbcda2e3f7423d7017abd241b",
  builderGeometry: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
  transitionClassifications:
    "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab",
} as const;

const measuredOriginScore = () => ({
  observation: {
    stepNumber: 7,
    status: "scored" as const,
    subject: "origin" as const,
    scores: [
      { candidateId: MEASURED_ORIGIN_IDS[0], agreement: 0.81657223796034 },
      { candidateId: MEASURED_ORIGIN_IDS[1], agreement: 0.9367520589707421 },
    ],
  },
  candidatePngs: MEASURED_ORIGIN_IDS.map((candidateId) => ({
    candidateId,
    png: "data:image/png;base64,lazy-k",
  })),
});

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

const measuredSpec = (stepNumber: 5 | 6 | 7): RealBuildPanelSpec =>
  structuredClone(MEASURED_FARTHER_ORIGIN_PANEL_SPECS[stepNumber - 5]) as RealBuildPanelSpec;

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

const origins = (calibrated = false): readonly DeferredUnresolvedCandidate<Document>[] =>
  [0, 1].map((index) => {
    const candidateId = calibrated ? MEASURED_ORIGIN_IDS[index]! : `origin-${index}`;
    const measured = MEASURED_FARTHER_ORIGIN_CANDIDATES[index]!;
    const calibratedHash = calibrated ? candidateId.slice("step-005:".length) : undefined;
    const document: Document = {
      id: candidateId,
      revision: 0,
      parts: [
        {
          id: `origin-part-${index}`,
          catalogPartId: "builtin:brick-2x4",
          colorId: "builtin:black",
          transform: { positionLdu: [index * 20, 8, 0], orientationId: "upright-yaw-0" },
        },
      ],
      ...(calibratedHash === undefined ? {} : { calibratedHash }),
    };
    return {
      candidateId,
      document,
      documentHash: hashDocument(document),
      partIds: [`origin-part-${index}`],
      stepId: "step-005",
      registrations: [],
      pieces: calibrated
        ? structuredClone(measured.pieces)
        : [
            {
              catalogPartId: "builtin:brick-2x4",
              colorId: "builtin:black",
              transform: { positionLdu: [index * 20, 8, 0], orientationId: "upright-yaw-0" },
            },
          ],
      lookaheadAgreement: calibrated ? measured.lookaheadAgreement : 0.6,
      lookaheadShiftPx: [0, 0],
      lookaheadPixels: null,
    };
  });

const harness = (
  offeredPlacements: 1 | 2,
  narrowingBudget: number,
  behavior: {
    readonly revealingK?: boolean;
    readonly revealOriginK?: boolean;
    readonly calibratedOriginProbe?: boolean;
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
            : behavior.revealOriginK &&
                (document.id === "origin-0" || document.id === MEASURED_ORIGIN_IDS[0])
              ? rgba("background")
              : behavior.revealingK && document.id.startsWith("origin-0-next-")
                ? rgba("background")
                : rgba(),
        captureDepthSurface: () => ({}),
        captureSparseDepthSurface: () => ({ nonClearPixels: 1 }),
        dispose: () => {},
      }),
      deriveBrickScene: (document: Document) => {
        behavior.onDeriveScene?.(document);
        return {
          root: document,
          partObjects: new Map(document.parts.map(({ id }) => [id, { visible: true }])),
          dispose: () => {},
        };
      },
      setInstructionSilhouetteMode: () => {},
      createOrthographicViewCamera: () => ({}),
      composeInstructionDepthPrefixWithSparseProbe: () => ({
        status: "composed",
        probeVisibleMask: new Uint8Array([1, 0, 0, 0]),
      }),
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
  const place = (base: Document, catalogPartId: string, transform: unknown, colorId: string) => {
    const transformKey = (transform as { readonly positionLdu: readonly number[] }).positionLdu[0];
    const partId = `${base.id}-part-${base.parts.length}-${transformKey}`;
    const document = {
      id: `${base.id}-next-${transformKey}`,
      revision: base.revision + 1,
      parts: [...base.parts, { id: partId, catalogPartId, colorId, transform }],
    };
    placedDocuments.push(document);
    return {
      document,
      partId,
      stepId: "step-006",
    };
  };
  const candidatesAtN = origins(behavior.calibratedOriginProbe === true);
  const baseDocument: Document = { id: "base", revision: 0, parts: [] };
  const calibratedOptions = completeRealBuildTestOptions(7);
  return {
    placedDocuments,
    input: {
      originSpec: behavior.calibratedOriginProbe ? measuredSpec(5) : spec(5),
      originStatus: "unseparated" as const,
      originMargin: 0,
      originMinimumMargin: 0.01,
      baseDocument,
      origins: candidatesAtN,
      interveningSpec: behavior.calibratedOriginProbe ? measuredSpec(6) : spec(6),
      interveningEvidence: evidence(true),
      fartherSpec: behavior.calibratedOriginProbe ? measuredSpec(7) : spec(7),
      fartherRasterSpec: behavior.calibratedOriginProbe ? measuredSpec(7) : spec(7),
      options: {
        ...calibratedOptions,
        workFactor: behavior.calibratedOriginProbe ? 2 : 1,
        deferredCandidateBudget: 16,
        deferredNarrowingRenderBudget: behavior.calibratedOriginProbe ? 8_192 : narrowingBudget,
        fartherPanelRenderBudget: 16,
        fartherPanelMaximumReachSteps: 2,
        inputDigests: behavior.calibratedOriginProbe
          ? { ...calibratedOptions.inputDigests, ...MEASURED_INPUT_DIGESTS }
          : calibratedOptions.inputDigests,
        measuredFartherOriginSourceAttestation: behavior.calibratedOriginProbe
          ? MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION
          : null,
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
  it("routes passive step 7 through generic raster scoring without measured-spec comparison", async () => {
    const probe = harness(1, 8_192, { calibratedOriginProbe: true });
    const measuredFarther = measuredSpec(7);
    let authorityReads = 0;
    const passive = Object.fromEntries(
      [
        "stepNumber",
        "pageNumber",
        "panelFace",
        "minXPt",
        "maxXPt",
        "minYPt",
        "maxYPt",
        "calloutBoxes",
      ].map((key) => [key, measuredFarther[key as keyof RealBuildPanelSpec]]),
    ) as unknown as RealBuildPanelRasterSpec;
    for (const field of ["action", "pieces", "mappedCalloutKeys"]) {
      Object.defineProperty(passive, field, {
        enumerable: true,
        get() {
          authorityReads += 1;
          throw new Error(`passive ${field} must remain outside measured comparison`);
        },
      });
    }
    const loadFartherEvidence = vi.fn(async () => evidence(true));
    const scoreMeasuredOriginPanel = vi.fn(measuredOriginScore);

    const result = await attemptFartherPrintedStep({
      ...probe.input,
      fartherSpec: null,
      fartherRasterSpec: passive,
      loadFartherEvidence,
      scoreMeasuredOriginPanel,
    });

    expect(scoreMeasuredOriginPanel).not.toHaveBeenCalled();
    expect(loadFartherEvidence).toHaveBeenCalledOnce();
    expect(result.evidence.panels.map(({ stepNumber }) => stepNumber)).toEqual([6, 7]);
    expect(authorityReads).toBe(0);
  });

  it("lets a farther origin panel reveal N before any intervening parent expands", async () => {
    const probe = harness(2, 8_192, {
      revealOriginK: true,
      calibratedOriginProbe: true,
    });
    const loadFartherEvidence = vi.fn(async () => evidence(true));

    const result = await attemptFartherPrintedStep({
      ...probe.input,
      loadFartherEvidence,
      scoreMeasuredOriginPanel: measuredOriginScore,
    });

    expect(loadFartherEvidence).toHaveBeenCalledOnce();
    expect(probe.placedDocuments).toHaveLength(0);
    expect(result.evidence.carries).toEqual([]);
    expect(result.evidence.budgets).toMatchObject({
      offeredCandidates: 0,
      narrowingRenders: 0,
      panelRenders: 4,
      reachSteps: 2,
    });
    expect(result.evidence.decision).toEqual({
      originCandidateId: MEASURED_ORIGIN_IDS[1],
      revealingStepNumber: 7,
      survivingCandidateIds: [MEASURED_ORIGIN_IDS[1]],
      rejectedCandidateIds: [MEASURED_ORIGIN_IDS[0]],
      descendantSettled: true,
    });
    expect(result.selectedOrigin?.candidateId).toBe(MEASURED_ORIGIN_IDS[1]);
  });

  it("retains drifted K counterevidence without exposing a selected origin", async () => {
    const probe = harness(2, 8_192, {
      revealOriginK: true,
      calibratedOriginProbe: true,
    });
    const result = await attemptFartherPrintedStep({
      ...probe.input,
      loadFartherEvidence: async () => evidence(true),
    });

    expect(probe.placedDocuments).toEqual([]);
    expect(result.selectedOrigin).toBeNull();
    expect(result.evidence.decision).toBeNull();
    expect(result.evidence.refusal).toMatchObject({
      code: "calibration-mismatch",
      stage: "evidence",
      stepNumber: 7,
    });
    expect(result.evidence.refusal?.message).toContain(
      "differ from the source-bound measured calibration",
    );
    expect(result.evidence.panels.map(({ stepNumber }) => stepNumber)).toEqual([6, 7]);
    expect(result.captures).toHaveLength(4);
    expect(result.captures.filter(({ panelStepNumber }) => panelStepNumber === 7)).toHaveLength(3);
  });

  it("refuses origin or anchor mutation across the asynchronous early K score", async () => {
    for (const target of ["base", "origin"] as const) {
      const probe = harness(2, 8_192, {
        revealOriginK: true,
        calibratedOriginProbe: true,
      });
      const loadFartherEvidence = vi.fn(async () => {
        await Promise.resolve();
        const document =
          target === "base" ? probe.input.baseDocument : probe.input.origins[0]!.document;
        (document as { revision: number }).revision += 1;
        return evidence(true);
      });

      const result = await attemptFartherPrintedStep({
        ...probe.input,
        loadFartherEvidence,
        scoreMeasuredOriginPanel: measuredOriginScore,
      });

      expect(result.evidence.refusal?.code, target).toBe("farther-input-invalid");
      expect(result.evidence.carries, target).toEqual([]);
      expect(
        result.evidence.panels.map(({ stepNumber }) => stepNumber),
        target,
      ).toEqual([6]);
      expect(result.selectedOrigin, target).toBeNull();
    }
  });

  it("falls back to constructed carry when the measured source policy does not match", async () => {
    const probe = harness(2, 16, {
      revealOriginK: true,
      calibratedOriginProbe: true,
    });
    const loadFartherEvidence = vi.fn(async () => evidence(true));

    const result = await attemptFartherPrintedStep({
      ...probe.input,
      loadFartherEvidence,
      options: {
        ...probe.input.options,
        workFactor: 1,
      },
    });

    expect(loadFartherEvidence).not.toHaveBeenCalled();
    expect(probe.placedDocuments).toEqual([]);
    expect(result.evidence.refusal).toMatchObject({
      code: "incomplete-parent-expansion",
      stage: "evidence",
      stepNumber: 6,
    });
    expect(result.evidence.carries).toHaveLength(1);
    expect(result.evidence.panels.map(({ stepNumber }) => stepNumber)).toEqual([6]);
  });

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
