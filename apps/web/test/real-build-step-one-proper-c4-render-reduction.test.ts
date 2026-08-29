import { applyBuildOperations, canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it, vi } from "vitest";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import {
  preflightRealBuildCompiledObservationResources,
  type RealBuildCompiledObservationSourceInput,
} from "../e2e/real-build-compiled-observation-source";
import {
  snapshotRealBuildEnumeratedPlacementOffer,
  type RealBuildEnumeratedPlacementOffer,
} from "../e2e/real-build-enumerated-placement-witness";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
} from "../e2e/real-build-prepared-step-authority";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import { inspectRealBuildStepOneProperC4Quotient } from "../e2e/real-build-step-one-proper-c4-quotient";
import {
  requireRealBuildStepOneProperC4RenderReductionInspection,
  runRealBuildStepOneProperC4RenderReduction,
} from "../e2e/real-build-step-one-proper-c4-render-reduction";
import { calibrateRealBuildStepOneProperC4RendererEquivariance } from "../e2e/real-build-step-one-proper-c4-render-equivariance";
import { createRealBuildStepOneSilhouetteRendererFactory } from "../e2e/real-build-step-one-silhouette-renderer";
import {
  enumeratePlacements,
  placementOccupancyKey,
  type PlacementCandidate,
} from "../src/assembly/enumerate-placements";
import { createPlacePartTransaction } from "../src/manual-commands";
import {
  preparedSearchEmptyParent,
  preparedSearchOptions,
} from "./real-build-prepared-search.fixture";

const SOURCE_MASK = new Uint8Array([1, 1, 0, 0]);
const TEST_VIEW = { azimuthDegrees: 10, elevationDegrees: 20, pixelsPerUnit: 1 };
const DISTINCT_D4_MASKS = [
  new Uint8Array([1, 0, 0, 0]),
  new Uint8Array([0, 1, 0, 0]),
  new Uint8Array([0, 0, 1, 0]),
  new Uint8Array([0, 0, 0, 1]),
  SOURCE_MASK,
  new Uint8Array([1, 0, 1, 0]),
  new Uint8Array([1, 0, 0, 1]),
  new Uint8Array([0, 1, 1, 0]),
] as const;

interface RawCandidate {
  readonly partIds: readonly [string, string];
  readonly offeredCandidates: readonly [
    RealBuildEnumeratedPlacementOffer,
    RealBuildEnumeratedPlacementOffer,
  ];
}

interface RendererCounts {
  preparations: number;
  renders: number;
  disposals: number;
  live: number;
  peakLive: number;
}

function rendererGeometryKey(
  parts: readonly {
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly transform: {
      readonly positionLdu: readonly [number, number, number];
      readonly orientationId: string;
    };
  }[],
): string {
  const rows = parts.map(({ catalogPartId, colorId, transform }) => ({
    catalogPartId,
    colorId,
    transform: {
      positionLdu: [...transform.positionLdu],
      orientationId: transform.orientationId,
    },
  }));
  rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify(rows);
}

function distinct(candidates: readonly PlacementCandidate[]): readonly PlacementCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentCatalogStepOneBytes(): Uint8Array {
  const options = preparedSearchOptions(2, 1);
  const panels = [...options.panels];
  const panel = panels[0]!;
  panels[0] = {
    ...panel,
    pieces: panel.pieces.map((piece, index) => ({
      ...piece,
      designId: index === 0 ? "80015" : "30565",
      materialId: "26",
      catalogPartId:
        index === 0 ? "builtin:corner-plate-5x5-quarter-ring" : "builtin:corner-plate-4x4-round",
      colorId: "builtin:black",
    })),
  };
  return encodeRealBuildPreparedRunInput({ ...options, panels });
}

function buildCurrentControl() {
  const bytes = currentCatalogStepOneBytes();
  const preparedStep = inspectRealBuildPreparedStepInput(bytes, 1);
  const policy = inspectRealBuildPreparedObservationPolicy(bytes);
  const rootDocumentSnapshot = preparedSearchEmptyParent().documentSnapshot;
  const [firstPiece, secondPiece] = preparedStep.expectedAtomicPieces;
  const firstCandidates = distinct(
    enumeratePlacements(rootDocumentSnapshot.document, firstPiece!.catalogPartId, {
      includeBuildPlate: true,
    }).candidates,
  );
  const rawCandidates: RawCandidate[] = firstCandidates.flatMap((first) => {
    const firstTransaction = createPlacePartTransaction(rootDocumentSnapshot.document, {
      catalogPartId: first.catalogPartId,
      colorId: firstPiece!.colorId,
      transform: first.transform,
    });
    const firstDocument = applyBuildOperations(
      rootDocumentSnapshot.document,
      firstTransaction.operations,
    );
    const firstOffer = snapshotRealBuildEnumeratedPlacementOffer(first);
    return distinct(
      enumeratePlacements(firstDocument, secondPiece!.catalogPartId, {}).candidates,
    ).map((second) => {
      const secondTransaction = createPlacePartTransaction(firstDocument, {
        catalogPartId: second.catalogPartId,
        colorId: secondPiece!.colorId,
        transform: second.transform,
      });
      return {
        partIds: [firstTransaction.partId, secondTransaction.partId] as const,
        offeredCandidates: [firstOffer, snapshotRealBuildEnumeratedPlacementOffer(second)] as const,
      };
    });
  });
  const quotient = inspectRealBuildStepOneProperC4Quotient({
    rootDocumentSnapshot,
    preparedStep,
    rawCandidates,
  });
  return { preparedStep, policy, quotient, rootDocumentSnapshot };
}

let cachedControl: ReturnType<typeof buildCurrentControl> | undefined;

function currentControl() {
  cachedControl ??= buildCurrentControl();
  return cachedControl;
}

let cachedMemberTurns: ReadonlyMap<string, number> | undefined;

function currentMemberTurn(document: unknown): number {
  cachedMemberTurns ??= new Map(
    currentControl().quotient.rawRoster.map((row) => [
      rendererGeometryKey(row.projectedWitnesses),
      currentControl().quotient.inverseMap[row.rawIndex]!.turnDegrees,
    ]),
  );
  const parts = (
    document as {
      readonly parts: readonly {
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly transform: {
          readonly positionLdu: readonly [number, number, number];
          readonly orientationId: string;
        };
      }[];
    }
  ).parts;
  const turn = cachedMemberTurns.get(rendererGeometryKey(parts));
  if (turn === undefined) throw new TypeError("Synthetic renderer received unknown geometry.");
  return turn;
}

function source(widthPx = 2, heightPx = 2): RealBuildCompiledObservationSourceInput {
  const pixelCount = widthPx * heightPx;
  return {
    provisionalStepIdentity: canonicalDigest({ fixture: "proper-c4-step-one" }),
    observationMode: "lookahead",
    registrationPanelStepNumber: 2,
    pageNumber: 11,
    panelDigest: canonicalDigest({ fixture: "proper-c4-step-two-panel" }),
    cropDigest: canonicalDigest({ fixture: "proper-c4-step-two-crop" }),
    sourceDescriptorDigest: canonicalDigest({ fixture: "proper-c4-step-two-source" }),
    exclusionDescriptorDigest: canonicalDigest({ fixture: "proper-c4-step-two-exclusion" }),
    measure: "iou",
    widthPx,
    heightPx,
    sourceMask:
      pixelCount === SOURCE_MASK.length ? new Uint8Array(SOURCE_MASK) : new Uint8Array(pixelCount),
    excludedMask: null,
  };
}

function rgbaMask(mask: Uint8Array): Uint8Array {
  const pixels = new Uint8Array(mask.length * 4);
  for (let index = 0; index < mask.length; index += 1) {
    pixels.set(mask[index] === 1 ? [0, 0, 0, 0xff] : [0x89, 0x90, 0x93, 0xff], index * 4);
  }
  return pixels;
}

function rendererFactory(
  counts: RendererCounts,
  options: {
    readonly widthPx?: number;
    readonly heightPx?: number;
    readonly throwFromRender?: number;
    readonly frameTarget?: readonly [number, number, number];
    readonly calibrationDocumentSpecialCase?: boolean;
    readonly stateAfterCalibration?: boolean;
  } = {},
) {
  const widthPx = options.widthPx ?? 2;
  const heightPx = options.heightPx ?? 2;
  return createRealBuildStepOneSilhouetteRendererFactory({
    rendering: {
      deriveBrickScene: (document: unknown) => {
        counts.preparations += 1;
        counts.live += 1;
        counts.peakLive = Math.max(counts.peakLive, counts.live);
        const documentId = (document as { readonly id?: unknown }).id;
        const calibrationTurn =
          typeof documentId === "string"
            ? /^proper-c4-calibration-q(0|90|180|270)$/u.exec(documentId)?.[1]
            : undefined;
        const inferredTurn =
          calibrationTurn === undefined ? currentMemberTurn(document) : Number(calibrationTurn);
        return {
          root: {
            memberTurn: options.calibrationDocumentSpecialCase
              ? calibrationTurn === undefined
                ? 0
                : Number(calibrationTurn)
              : inferredTurn,
          },
          dispose: () => {
            counts.disposals += 1;
            counts.live -= 1;
          },
        };
      },
      setInstructionSilhouetteMode: () => undefined,
      createOrthographicViewCamera: (view: typeof TEST_VIEW) => ({ view }),
    },
    renderer: {
      render: (root, camera) => {
        counts.renders += 1;
        if (options.throwFromRender !== undefined && counts.renders >= options.throwFromRender) {
          throw new Error("synthetic persistent render loss");
        }
        const view = (camera as { readonly view: typeof TEST_VIEW }).view;
        const asFitted = view.elevationDegrees === TEST_VIEW.elevationDegrees;
        const suppliedTurn = asFitted
          ? view.azimuthDegrees - TEST_VIEW.azimuthDegrees
          : 180 - TEST_VIEW.azimuthDegrees - view.azimuthDegrees;
        const turn = ((suppliedTurn % 360) + 360) % 360;
        const determinant = asFitted ? 1 : -1;
        const memberTurn =
          options.stateAfterCalibration && counts.renders > 32
            ? 0
            : (root as { readonly memberTurn: number }).memberTurn;
        const representativeTurn = (((turn - determinant * memberTurn) % 360) + 360) % 360;
        const representativeIndex = (asFitted ? 0 : 4) + representativeTurn / 90;
        return rgbaMask(DISTINCT_D4_MASKS[representativeIndex]!);
      },
    },
    fittedView: TEST_VIEW,
    frame: {
      widthPx,
      heightPx,
      target: options.frameTarget ?? [0, 0, 0],
      sceneRadius: 1,
    },
    centrePx: [widthPx / 2, heightPx / 2],
    widthPx,
    heightPx,
    registrationPanelStepNumber: 2,
  });
}

function emptyCounts(): RendererCounts {
  return { preparations: 0, renders: 0, disposals: 0, live: 0, peakLive: 0 };
}

function runReduction(
  counts: RendererCounts,
  options: {
    readonly includeCompiler?: boolean;
    readonly throwFromRender?: number;
    readonly calibrationDocumentSpecialCase?: boolean;
    readonly stateAfterCalibration?: boolean;
  } = {},
) {
  const control = currentControl();
  const compiler = vi.fn(compileRealBuildAutomaticPlacement);
  const boundSource = source();
  const prepareModelMaskRenderer = rendererFactory(counts, {
    ...(options.throwFromRender === undefined ? {} : { throwFromRender: options.throwFromRender }),
    ...(options.calibrationDocumentSpecialCase === undefined
      ? {}
      : { calibrationDocumentSpecialCase: options.calibrationDocumentSpecialCase }),
    ...(options.stateAfterCalibration === undefined
      ? {}
      : { stateAfterCalibration: options.stateAfterCalibration }),
  });
  const equivariance = calibrateRealBuildStepOneProperC4RendererEquivariance({
    prepareModelMaskRenderer,
    source: boundSource,
  });
  const result = runRealBuildStepOneProperC4RenderReduction({
    quotient: control.quotient,
    preparedStep: control.preparedStep,
    policy: control.policy,
    rootDocumentSnapshot: control.rootDocumentSnapshot,
    source: boundSource,
    prepareModelMaskRenderer,
    equivariance,
    ...(options.includeCompiler === false ? {} : { compiler }),
  });
  return { compiler, equivariance, result };
}

describe("step-one proper-C4 twenty-closure render reduction", () => {
  it("runs the genuine 400-row quotient through one shared fixed-8192 reduction", () => {
    const counts = emptyCounts();
    const { compiler, equivariance, result } = runReduction(counts);

    expect(result.quotientDigest).toBe(
      "sha256:7b2c0080b8a09f9816ff2955bfe8d140a7c9a2c85d9e5c113595bb243197d88c",
    );
    expect(currentControl().quotient.rawRosterDigest).toBe(
      "sha256:24e68a134cf86c181ede701c2f189d1f2816af4a83510e2a841f270249d5ce72",
    );
    expect(result.accounting).toEqual({
      closureCount: 20,
      representatives: 100,
      rawCandidates: 400,
      compiledLineageEdges: 800,
      uniquePhysicalTransitions: 100,
      physicalRenderBaseline: 3_200,
      physicalRenderCalls: 800,
      representativeCameraScores: 800,
      inverseExpandedRawCameraScores: 3_200,
      rawLogicalCameraBranches: 25_600,
      quotientLogicalCameraBranches: 6_400,
      reductionNumerator: 3,
      reductionDenominator: 4,
    });
    expect(result.searchLedger).toEqual({
      budget: 8_192,
      reserved: 800,
      refused: false,
      reservationCount: 20,
      failedReservation: null,
    });
    expect(result.cameraLedger).toEqual({
      budget: 8_192,
      reserved: 6_400,
      refusedReservation: false,
      failedReservation: null,
    });
    expect(result.rendererEquivariance).toBe(equivariance);
    expect(result.rendererEquivariance).toMatchObject({
      schemaVersion: "lego.real-build-step-one-proper-c4-renderer-equivariance/1",
      configurationDigest: result.rendererConfigurationDigest,
      sourceBindingDigest: result.sourceBindingDigest,
      accounting: {
        controlDocuments: 4,
        rendererPreparations: 4,
        physicalRenderCalls: 32,
        rendererDisposals: 4,
      },
      exactParity: true,
      backendClaim: "calibrated-same-factory-only",
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: { status: "absent", authorized: false },
      authority: "absent",
    });
    expect(result.rendererPopulationEquivariance).toMatchObject({
      exactPackedMaskCommitmentParity: true,
      scoreAndTiePreservation: "identical-packed-masks-under-one-bound-source",
      backendClaim: "exhaustive-current-population-same-factory",
      accounting: {
        verificationBudget: 8_192,
        verificationReserved: 2_400,
        verificationReservationCount: 60,
        verificationClosureCount: 60,
        membersPerVerificationClosure: 5,
        camerasPerVerificationClosure: 40,
        perClosurePredictedRoleBytes: 42,
        perClosurePredictedPixelVisits: 10_244,
        omittedMembers: 300,
        verificationPreparations: 300,
        verificationPhysicalRenderCalls: 2_400,
        verificationDisposals: 300,
        reductionPhysicalRenderCalls: 800,
        reductionAndVerificationPhysicalRenderCalls: 3_200,
        verificationMaskPixels: 9_600,
      },
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: { status: "absent", authorized: false },
      authority: "absent",
    });
    expect(new Set(result.rendererEquivariance.maskDigests[0])).toHaveLength(8);
    expect(result.rendererEquivariance.maskAreas.flat().every((area) => area > 0 && area < 4)).toBe(
      true,
    );
    expect(result.closures).toHaveLength(20);
    for (const [closureIndex, closure] of result.closures.entries()) {
      expect(closure).toMatchObject({
        closureIndex,
        orbitIndices: Array.from({ length: 5 }, (_, index) => closureIndex * 5 + index),
        accounting: {
          representatives: 5,
          compiledLineageEdges: 40,
          physicalTransitions: 5,
          physicalRenders: 40,
          representativeCameraScores: 40,
          logicalCameraBranches: 320,
        },
        searchReservation: {
          budget: 8_192,
          reservedBefore: closureIndex * 40,
          requested: 40,
          reservedAfter: (closureIndex + 1) * 40,
          reservationNumber: closureIndex + 1,
          admitted: true,
        },
        cameraReservation: {
          budget: 8_192,
          reservedBefore: closureIndex * 320,
          requested: 320,
          reservedAfter: (closureIndex + 1) * 320,
          failure: null,
        },
        localSelectionStatus: "unresolved",
        acceptedTransition: null,
        acceptedDocument: null,
        physicalFrameAuthority: "absent",
        placementAuthority: "absent",
        completionAuthority: { status: "absent", authorized: false },
        authority: "absent",
      });
      expect(closure.representativeRows).toHaveLength(40);
      expect(closure.metrics).toEqual({
        rootCount: 8,
        offeredLineageEdges: 40,
        suppliedCompilerCalls: 5,
        uniquePhysicalTransitions: 5,
        uniqueChildDocuments: 5,
        logicalCameraBranches: 320,
        rendererPreparations: 5,
        renderCalls: 40,
        rendererDisposals: 5,
      });
    }
    expect(result.globalAggregation.representativeRows).toHaveLength(800);
    expect(result.globalAggregation.quotientInverseMap).toHaveLength(400);
    expect(result.globalAggregation.inverseExpandedRows).toHaveLength(3_200);
    expect(result.globalAggregation.selection).toEqual({
      status: "unresolved",
      selectedRawEncounterIndex: null,
      selectedRepresentativeEncounterIndex: null,
      bestScore: 1,
      runnerUpScore: 1,
      margin: 0,
    });
    expect(result).toMatchObject({
      acceptedTransition: null,
      acceptedDocument: null,
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: { status: "absent", authorized: false },
      authority: "absent",
    });
    expect(compiler).toHaveBeenCalledTimes(100);
    expect(counts).toEqual({
      preparations: 404,
      renders: 3_232,
      disposals: 404,
      live: 0,
      peakLive: 1,
    });
    expect(requireRealBuildStepOneProperC4RenderReductionInspection(result)).toBe(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.closures)).toBe(true);
  }, 20_000);

  it("repeats every retained commitment deterministically", () => {
    const firstRun = runReduction(emptyCounts());
    const secondRun = runReduction(emptyCounts(), { includeCompiler: false });
    const first = firstRun.result;
    const second = secondRun.result;

    expect(firstRun.compiler).toHaveBeenCalledTimes(100);
    expect(secondRun.compiler).not.toHaveBeenCalled();
    expect({
      integration: first.integrationDigest,
      source: first.sourceBindingDigest,
      renderer: first.rendererConfigurationDigest,
      equivariance: first.rendererEquivariance.parityDigest,
      population: first.rendererPopulationEquivariance.comparisonDigest,
      closures: first.closureDigestsDigest,
      closureDigests: first.closures.map(({ closureDigest }) => closureDigest),
      aggregation: first.globalAggregation.aggregationDigest,
    }).toEqual({
      integration: second.integrationDigest,
      source: second.sourceBindingDigest,
      renderer: second.rendererConfigurationDigest,
      equivariance: second.rendererEquivariance.parityDigest,
      population: second.rendererPopulationEquivariance.comparisonDigest,
      closures: second.closureDigestsDigest,
      closureDigests: second.closures.map(({ closureDigest }) => closureDigest),
      aggregation: second.globalAggregation.aggregationDigest,
    });
  }, 30_000);

  it.each([
    {
      label: "calibration-document special casing",
      options: { calibrationDocumentSpecialCase: true },
    },
    {
      label: "state that changes after the 32 calibration renders",
      options: { stateAfterCalibration: true },
    },
  ])(
    "refuses $label before global aggregation",
    ({ options }) => {
      const counts = emptyCounts();
      expect(() => runReduction(counts, options)).toThrow(
        /did not match its scored representative mask; no quotient score or tie claim may survive/u,
      );
      expect(counts).toEqual({
        preparations: 105,
        renders: 833,
        disposals: 105,
        live: 0,
        peakLive: 1,
      });
    },
    15_000,
  );

  it("stops after a failed closure and disposes every renderer it prepared", () => {
    const counts = emptyCounts();
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const control = currentControl();
    const boundSource = source();
    const prepareModelMaskRenderer = rendererFactory(counts, { throwFromRender: 41 });
    const equivariance = calibrateRealBuildStepOneProperC4RendererEquivariance({
      prepareModelMaskRenderer,
      source: boundSource,
    });
    Object.assign(counts, emptyCounts());

    expect(() =>
      runRealBuildStepOneProperC4RenderReduction({
        quotient: control.quotient,
        preparedStep: control.preparedStep,
        policy: control.policy,
        rootDocumentSnapshot: control.rootDocumentSnapshot,
        source: boundSource,
        prepareModelMaskRenderer,
        equivariance,
        compiler,
      }),
    ).toThrow(/closure 1 ended camera-failed; no later closure or global rank may run/u);
    expect(counts.live).toBe(0);
    expect(counts.disposals).toBe(counts.preparations);
    expect(counts.preparations).toBeGreaterThan(5);
    expect(counts.preparations).toBeLessThanOrEqual(10);
    expect(counts.renders).toBeGreaterThanOrEqual(41);
    expect(counts.renders).toBeLessThanOrEqual(80);
    expect(compiler.mock.calls.length).toBeGreaterThan(5);
    expect(compiler.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("binds renderer dimensions before compiler or renderer work", () => {
    const counts = emptyCounts();
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const control = currentControl();

    expect(() =>
      runRealBuildStepOneProperC4RenderReduction({
        quotient: control.quotient,
        preparedStep: control.preparedStep,
        policy: control.policy,
        rootDocumentSnapshot: control.rootDocumentSnapshot,
        source: source(),
        prepareModelMaskRenderer: rendererFactory(counts, { widthPx: 3 }),
        equivariance: {},
        compiler,
      }),
    ).toThrow(/factory is bound to raster 3x2/u);
    expect(compiler).not.toHaveBeenCalled();
    expect(counts).toEqual(emptyCounts());
  });

  it("refuses off-axis calibration before preparing its control scenes", () => {
    const counts = emptyCounts();
    const prepareModelMaskRenderer = rendererFactory(counts, { frameTarget: [1, 0, 0] });

    expect(() =>
      calibrateRealBuildStepOneProperC4RendererEquivariance({
        prepareModelMaskRenderer,
        source: source(),
      }),
    ).toThrow(/C4-fixed frame target with exact x=0 and z=0/u);
    expect(counts).toEqual(emptyCounts());
  });

  it("refuses a calibration reused with another factory or source binding before work", () => {
    const control = currentControl();
    const calibratedCounts = emptyCounts();
    const boundSource = source();
    const calibratedFactory = rendererFactory(calibratedCounts);
    const equivariance = calibrateRealBuildStepOneProperC4RendererEquivariance({
      prepareModelMaskRenderer: calibratedFactory,
      source: boundSource,
    });
    const wrongFactoryCounts = emptyCounts();
    const wrongFactory = rendererFactory(wrongFactoryCounts);
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const common = {
      quotient: control.quotient,
      preparedStep: control.preparedStep,
      policy: control.policy,
      rootDocumentSnapshot: control.rootDocumentSnapshot,
      equivariance,
      compiler,
    };

    expect(() =>
      runRealBuildStepOneProperC4RenderReduction({
        ...common,
        source: boundSource,
        prepareModelMaskRenderer: wrongFactory,
      }),
    ).toThrow(/exact calibration from this factory, configuration, and source binding/u);
    expect(wrongFactoryCounts).toEqual(emptyCounts());

    const wrongSource = {
      ...source(),
      cropDigest: canonicalDigest({ fixture: "wrong-proper-c4-step-two-crop" }),
    };
    expect(() =>
      runRealBuildStepOneProperC4RenderReduction({
        ...common,
        source: wrongSource,
        prepareModelMaskRenderer: calibratedFactory,
      }),
    ).toThrow(/exact calibration from this factory, configuration, and source binding/u);
    expect(compiler).not.toHaveBeenCalled();
    expect(calibratedCounts).toEqual({
      preparations: 4,
      renders: 32,
      disposals: 4,
      live: 0,
      peakLive: 1,
    });
  });

  it("admits exactly five 500x336 representatives but refuses six before rendering", () => {
    const exactSource = source(500, 336);
    expect(
      preflightRealBuildCompiledObservationResources({
        source: exactSource,
        rootCount: 8,
        cameraCount: 40,
        observationCount: 40,
      }),
    ).toEqual({
      pixelCount: 168_000,
      packedBytesPerMask: 21_000,
      predictedRoleBytes: 882_000,
      predictedPixelVisits: 122_808_000,
    });
    expect(() =>
      preflightRealBuildCompiledObservationResources({
        source: exactSource,
        rootCount: 8,
        cameraCount: 48,
        observationCount: 48,
      }),
    ).toThrow(/147336000 pixel visits above maximum/u);
  });
});
