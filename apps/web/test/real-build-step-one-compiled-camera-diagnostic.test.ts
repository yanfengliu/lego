import { describe, expect, it, vi } from "vitest";

import { applyBuildOperations, canonicalDigest, sha256Hex } from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { produceRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-producer";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "../e2e/real-build-panel-camera-resolver-boundary";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
} from "../e2e/real-build-prepared-step-authority";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import { runRealBuildStepOneCompiledCameraDiagnostic } from "../e2e/real-build-step-one-compiled-camera-diagnostic";
import {
  createRealBuildStepOneSilhouetteRendererFactory,
  inspectRealBuildStepOneMaskRendererFactoryConfiguration,
  requireRealBuildStepOneMaskRendererFactory,
} from "../e2e/real-build-step-one-silhouette-renderer";
import {
  enumeratePlacements,
  placementOccupancyKey,
  type PlacementCandidate,
} from "../src/assembly/enumerate-placements";
import { createPlacePartTransaction } from "../src/manual-commands";
import {
  preparedSearchEmptyParent,
  preparedSearchOptions,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

const SOURCE_MASK = new Uint8Array([1, 1, 0, 0]);
const WEAKER_MASK = new Uint8Array([1, 0, 0, 0]);
const TEST_VIEW = { azimuthDegrees: 10, elevationDegrees: 20, pixelsPerUnit: 1 };

function rgbaMask(mask: Uint8Array, reusable?: Uint8Array): Uint8Array {
  const pixels = reusable ?? new Uint8Array(mask.length * 4);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    pixels.set(mask[index] === 1 ? [0, 0, 0, 0xff] : [0x89, 0x90, 0x93, 0xff], offset);
  }
  return pixels;
}

function testRendererFactory(input: {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly registrationPanelStepNumber?: number;
  readonly fittedView?: typeof TEST_VIEW & { readonly upSign?: 1 | -1 };
  readonly frameTarget?: readonly [number, number, number];
  readonly sceneRadius?: number;
  readonly centrePx?: readonly [number, number];
  readonly renderMask: (view: typeof TEST_VIEW) => Uint8Array;
  readonly onPrepare?: () => void;
  readonly onDispose?: () => void;
  readonly reuseReadback?: boolean;
  readonly throwOnSilhouetteSetup?: boolean;
}) {
  let readback: Uint8Array | undefined;
  return createRealBuildStepOneSilhouetteRendererFactory({
    rendering: {
      deriveBrickScene: (document: unknown) => {
        input.onPrepare?.();
        return { root: { document }, dispose: () => input.onDispose?.() };
      },
      setInstructionSilhouetteMode: () => {
        if (input.throwOnSilhouetteSetup) throw new Error("synthetic silhouette setup loss");
      },
      createOrthographicViewCamera: (view: typeof TEST_VIEW) => ({ view }),
    },
    renderer: {
      render: (_root, camera) => {
        const mask = input.renderMask((camera as { view: typeof TEST_VIEW }).view);
        if (input.reuseReadback) readback ??= new Uint8Array(mask.length * 4);
        return rgbaMask(mask, readback);
      },
    },
    fittedView: input.fittedView ?? TEST_VIEW,
    frame: {
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      target: input.frameTarget ?? [0, 0, 0],
      sceneRadius: input.sceneRadius ?? 1,
    },
    centrePx: input.centrePx ?? [input.widthPx / 2, input.heightPx / 2],
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    registrationPanelStepNumber: input.registrationPanelStepNumber ?? 2,
  });
}

function distinct(candidates: readonly PlacementCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function currentCatalogStepOneBytes() {
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

function fixture(
  searchBudget = 8,
  cameraBranchBudget = 64,
  candidatePositions: readonly number[] = [0],
  mutateSourceOnFirstRender = false,
  rendererBehavior: {
    readonly throwFromRender?: number;
    readonly reuseSharedBuffer?: boolean;
    readonly throwOnDispose?: boolean;
    readonly factoryWidthPx?: number;
    readonly factoryHeightPx?: number;
    readonly registrationPanelStepNumber?: number;
    readonly externalCounts?: { preparations: number; renders: number; disposals: number };
    readonly throwOnSilhouetteSetup?: boolean;
  } = {},
) {
  const bytes = preparedSearchOptionsBytes(1, 1);
  const preparedStep = inspectRealBuildPreparedStepInput(bytes, 1);
  const policy = inspectRealBuildPreparedObservationPolicy(bytes);
  const parent = preparedSearchEmptyParent();
  const piece = preparedStep.expectedAtomicPieces[0]!;
  const compiler = vi.fn(compileRealBuildAutomaticPlacement);
  const sourceMask = new Uint8Array(SOURCE_MASK);
  let rendererPreparations = 0;
  let renders = 0;
  let rendererDisposals = 0;
  let liveRenderers = 0;
  let maxLiveRenderers = 0;
  const rendererEvents: string[] = [];
  const sharedMask = new Uint8Array(SOURCE_MASK);
  const result = runRealBuildStepOneCompiledCameraDiagnostic({
    preparedStep,
    policy,
    rootDocumentSnapshot: parent.documentSnapshot,
    candidates: candidatePositions.map((positionX, index) => ({
      partIds: [`step-one-diagnostic-part-${index}`],
      offeredCandidates: [
        snapshotRealBuildEnumeratedPlacementOffer({
          catalogPartId: piece.catalogPartId,
          transform: {
            positionLdu: [positionX, 0, 0],
            orientationId: "upright-yaw-0",
          },
          connections: [],
          restsOnBuildPlate: true,
        }),
      ],
    })),
    searchBudget,
    cameraBranchBudget,
    source: {
      provisionalStepIdentity: canonicalDigest({ fixture: "step-one-provisional" }),
      observationMode: "lookahead",
      registrationPanelStepNumber: 2,
      pageNumber: 2,
      panelDigest: canonicalDigest({ fixture: "step-two-panel" }),
      cropDigest: canonicalDigest({ fixture: "step-two-crop" }),
      sourceDescriptorDigest: canonicalDigest({ fixture: "step-two-source" }),
      exclusionDescriptorDigest: canonicalDigest({ fixture: "step-two-exclusion" }),
      measure: "iou",
      widthPx: 2,
      heightPx: 2,
      sourceMask,
      excludedMask: null,
    },
    prepareModelMaskRenderer: testRendererFactory({
      widthPx: rendererBehavior.factoryWidthPx ?? 2,
      heightPx: rendererBehavior.factoryHeightPx ?? 2,
      ...(rendererBehavior.registrationPanelStepNumber === undefined
        ? {}
        : { registrationPanelStepNumber: rendererBehavior.registrationPanelStepNumber }),
      reuseReadback: rendererBehavior.reuseSharedBuffer === true,
      throwOnSilhouetteSetup: rendererBehavior.throwOnSilhouetteSetup === true,
      onPrepare: () => {
        rendererPreparations += 1;
        if (rendererBehavior.externalCounts !== undefined) {
          rendererBehavior.externalCounts.preparations += 1;
        }
        liveRenderers += 1;
        maxLiveRenderers = Math.max(maxLiveRenderers, liveRenderers);
        rendererEvents.push(`prepare-${rendererPreparations}`);
      },
      onDispose: () => {
        rendererDisposals += 1;
        if (rendererBehavior.externalCounts !== undefined) {
          rendererBehavior.externalCounts.disposals += 1;
        }
        liveRenderers -= 1;
        rendererEvents.push(`dispose-${rendererDisposals}`);
        if (rendererBehavior.throwOnDispose) throw new Error("synthetic disposal loss");
      },
      renderMask: (view) => {
        renders += 1;
        if (rendererBehavior.externalCounts !== undefined) {
          rendererBehavior.externalCounts.renders += 1;
        }
        if (
          rendererBehavior.throwFromRender !== undefined &&
          renders >= rendererBehavior.throwFromRender
        ) {
          throw new Error("synthetic persistent render loss");
        }
        if (mutateSourceOnFirstRender && renders === 1) sourceMask.fill(0);
        const mask =
          view.azimuthDegrees === TEST_VIEW.azimuthDegrees &&
          view.elevationDegrees === TEST_VIEW.elevationDegrees
            ? SOURCE_MASK
            : WEAKER_MASK;
        if (!rendererBehavior.reuseSharedBuffer) return mask;
        sharedMask.set(mask);
        return sharedMask;
      },
    }),
    compiler,
  });
  return {
    result,
    compiler,
    rendererPreparations,
    renders,
    rendererDisposals,
    maxLiveRenderers,
    rendererEvents,
    parent,
    policy,
    sourceMask,
  };
}

function runResourceBoundDiagnostic(
  widthPx: number,
  heightPx: number,
  sourceMask: Uint8Array,
  counters: { compilerCalls: number; renderCalls: number },
) {
  const bytes = preparedSearchOptionsBytes(1, 1);
  const preparedStep = inspectRealBuildPreparedStepInput(bytes, 1);
  const parent = preparedSearchEmptyParent();
  const piece = preparedStep.expectedAtomicPieces[0]!;
  return runRealBuildStepOneCompiledCameraDiagnostic({
    preparedStep,
    policy: inspectRealBuildPreparedObservationPolicy(bytes),
    rootDocumentSnapshot: parent.documentSnapshot,
    candidates: [
      {
        partIds: ["step-one-resource-part"],
        offeredCandidates: [
          snapshotRealBuildEnumeratedPlacementOffer({
            catalogPartId: piece.catalogPartId,
            transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
            connections: [],
            restsOnBuildPlate: true,
          }),
        ],
      },
    ],
    searchBudget: 8,
    cameraBranchBudget: 64,
    source: {
      provisionalStepIdentity: canonicalDigest({ fixture: "step-one-resource" }),
      observationMode: "lookahead",
      registrationPanelStepNumber: 2,
      pageNumber: 2,
      panelDigest: canonicalDigest({ fixture: "step-two-resource-panel" }),
      cropDigest: canonicalDigest({ fixture: "step-two-resource-crop" }),
      sourceDescriptorDigest: canonicalDigest({ fixture: "step-two-resource-source" }),
      exclusionDescriptorDigest: canonicalDigest({ fixture: "step-two-resource-exclusion" }),
      measure: "iou",
      widthPx,
      heightPx,
      sourceMask,
      excludedMask: null,
    },
    prepareModelMaskRenderer: testRendererFactory({
      widthPx,
      heightPx,
      renderMask: () => {
        counters.renderCalls += 1;
        return sourceMask;
      },
    }),
    compiler: (input) => {
      counters.compilerCalls += 1;
      return compileRealBuildAutomaticPlacement(input);
    },
  });
}

describe("step-one compiled camera diagnostic", () => {
  it("deduplicates physical compile and render work while retaining every exact lineage", () => {
    const source = fixture();
    const { result } = source;
    expect(result.status).toBe("observed");
    if (result.status !== "observed") throw new TypeError("Expected observed diagnostic.");

    expect(result.rootResolution.status).toBe("seeded");
    expect(result.rootResolution.seeds).toHaveLength(8);
    expect(result.roots).toHaveLength(8);
    expect(new Set(result.roots.map(({ lineageId }) => lineageId))).toHaveLength(8);
    expect(new Set(result.roots.map(({ canonicalBytesHash }) => canonicalBytesHash))).toHaveLength(
      1,
    );
    expect(result.batch.evidence.lineageEdges).toHaveLength(8);
    expect(result.batch.evidence.childCandidates).toHaveLength(1);
    expect(result.batch.evidence.uniqueTransitions).toHaveLength(1);
    expect(source.compiler).toHaveBeenCalledOnce();
    expect(source.rendererPreparations).toBe(1);
    expect(source.renders).toBe(8);
    expect(source.rendererDisposals).toBe(1);
    expect(result.metrics).toEqual({
      rootCount: 8,
      offeredLineageEdges: 8,
      suppliedCompilerCalls: 1,
      uniquePhysicalTransitions: 1,
      uniqueChildDocuments: 1,
      logicalCameraBranches: 64,
      rendererPreparations: 1,
      renderCalls: 8,
      rendererDisposals: 1,
    });

    expect(result.frontier.candidates).toHaveLength(1);
    expect(result.frontier.observations).toHaveLength(64);
    expect(result.observation.cameraCount).toBe(8);
    expect(result.observation.observationCount).toBe(8);
    expect(result.observation.inspection).toMatchObject({
      reproducible: true,
      provenanceAuthority: "absent",
      authority: "absent",
      closure: {
        selection: { status: "selected" },
        completionAuthority: { status: "absent", authorized: false },
      },
    });
    expect(result.observation.inspection.closure.acceptedTransition).not.toBeNull();
    expect(result.batch.acceptedDocument).toBeNull();
    expect(result.acceptedDocument).toBeNull();
    expect(result.completionAuthority).toEqual({ status: "absent", authorized: false });
    expect(source.parent.documentSnapshot.canonicalBytes).toBe(
      result.batch.evidence.rootCandidates[0]!.canonicalBytes,
    );
    const selectedLineageId =
      result.observation.inspection.closure.selection.selectedLineageIds[0]!;
    const selectedEdge = result.batch.evidence.lineageEdges.find(
      ({ child }) => child.lineageId === selectedLineageId,
    )!;
    const parentIndex = result.roots.findIndex(
      ({ lineageId }) => lineageId === selectedEdge.parentLineageId,
    );
    expect(result.rootResolution.seeds[parentIndex]).toMatchObject({
      latticeHand: "as-fitted",
      latticeDeterminant: 1,
      turnDegrees: 0,
    });
  });

  it("snapshots the complete renderer configuration before caller mutation", () => {
    const masks = [
      new Uint8Array([1, 0, 0, 0]),
      new Uint8Array([0, 1, 0, 0]),
      new Uint8Array([0, 0, 1, 0]),
      new Uint8Array([0, 0, 0, 1]),
      new Uint8Array([1, 1, 0, 0]),
      new Uint8Array([0, 1, 1, 0]),
      new Uint8Array([0, 0, 1, 1]),
      new Uint8Array([1, 0, 0, 1]),
    ];
    const views: unknown[] = [];
    const frames: unknown[] = [];
    let renderIndex = 0;
    let disposals = 0;
    const rendering = {
      deriveBrickScene: (document: unknown) => ({
        root: { document },
        dispose: () => {
          disposals += 1;
        },
      }),
      setInstructionSilhouetteMode: () => undefined,
      createOrthographicViewCamera: (view: unknown, frame: unknown) => {
        views.push(view);
        frames.push(frame);
        return { view };
      },
    };
    const renderer = {
      render: () => rgbaMask(masks[renderIndex++]!),
    };
    const fittedView = { ...TEST_VIEW };
    const frame = {
      widthPx: 2,
      heightPx: 2,
      target: [1, 2, 3] as [number, number, number],
      sceneRadius: 4,
    };
    const centrePx = [1, 1] as [number, number];
    const configuration = {
      rendering,
      renderer,
      fittedView,
      frame,
      centrePx,
      widthPx: 2,
      heightPx: 2,
      registrationPanelStepNumber: 2,
    };
    const factory = createRealBuildStepOneSilhouetteRendererFactory(configuration);

    configuration.widthPx = 1;
    configuration.heightPx = 4;
    configuration.registrationPanelStepNumber = 3;
    fittedView.azimuthDegrees = 999;
    frame.widthPx = 1;
    frame.heightPx = 4;
    frame.target[0] = 999;
    frame.sceneRadius = 999;
    centrePx[0] = 999;
    centrePx[1] = 999;
    rendering.deriveBrickScene = () => {
      throw new Error("mutated derive must not run");
    };
    renderer.render = () => {
      throw new Error("mutated render must not run");
    };

    const inspection = inspectRealBuildStepOneMaskRendererFactoryConfiguration(factory, {
      widthPx: 2,
      heightPx: 2,
      registrationPanelStepNumber: 2,
    });
    expect(inspection).toEqual({
      configurationDigest: canonicalDigest({
        schema: "real-build-step-one-mask-renderer-configuration/v1",
        raster: { widthPx: 2, heightPx: 2 },
        frame: {
          widthPx: 2,
          heightPx: 2,
          target: [1, 2, 3],
          sceneRadius: 4,
        },
        fittedView: TEST_VIEW,
        centrePx: [1, 1],
        registrationPanelStepNumber: 2,
      }),
      widthPx: 2,
      heightPx: 2,
      frame: {
        widthPx: 2,
        heightPx: 2,
        target: [1, 2, 3],
        sceneRadius: 4,
      },
      fittedView: TEST_VIEW,
      centrePx: [1, 1],
      registrationPanelStepNumber: 2,
    });
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.frame)).toBe(true);
    expect(Object.isFrozen(inspection.frame.target)).toBe(true);
    expect(Object.isFrozen(inspection.fittedView)).toBe(true);
    expect(Object.isFrozen(inspection.centrePx)).toBe(true);
    expect(() => {
      (inspection.frame.target as unknown as number[])[0] = 0;
    }).toThrow(TypeError);

    const required = requireRealBuildStepOneMaskRendererFactory(factory, {
      widthPx: 2,
      heightPx: 2,
      registrationPanelStepNumber: 2,
    });
    expect(() =>
      requireRealBuildStepOneMaskRendererFactory(factory, {
        widthPx: 2,
        heightPx: 2,
        registrationPanelStepNumber: 3,
      }),
    ).toThrow(/panel 2/u);
    const prepared = required({ candidateId: "mutation-control", document: { parts: [] } });
    const digests: string[] = [];
    try {
      for (const hypothesis of PANEL_CAMERA_ANGULAR_HYPOTHESES) {
        digests.push(`sha256:${sha256Hex(prepared.render(hypothesis))}`);
      }
    } finally {
      prepared.dispose();
    }

    expect(digests).toEqual(masks.map((mask) => `sha256:${sha256Hex(mask)}`));
    expect(views).toHaveLength(8);
    expect(views[0]).toMatchObject({
      azimuthDegrees: TEST_VIEW.azimuthDegrees,
      elevationDegrees: TEST_VIEW.elevationDegrees,
      centerXPx: 1,
      centerYPx: 1,
    });
    expect(frames).toEqual(
      Array.from({ length: 8 }, () => ({
        widthPx: 2,
        heightPx: 2,
        target: [1, 2, 3],
        sceneRadius: 4,
      })),
    );
    expect(disposals).toBe(1);
  });

  it("commits every semantics-bearing renderer configuration field independently", () => {
    const digestFor = (input: {
      readonly widthPx?: number;
      readonly heightPx?: number;
      readonly registrationPanelStepNumber?: number;
      readonly fittedView?: typeof TEST_VIEW & { readonly upSign?: 1 | -1 };
      readonly frameTarget?: readonly [number, number, number];
      readonly sceneRadius?: number;
      readonly centrePx?: readonly [number, number];
    }): string => {
      const widthPx = input.widthPx ?? 2;
      const heightPx = input.heightPx ?? 2;
      const registrationPanelStepNumber = input.registrationPanelStepNumber ?? 2;
      const factory = testRendererFactory({
        widthPx,
        heightPx,
        registrationPanelStepNumber,
        ...(input.fittedView === undefined ? {} : { fittedView: input.fittedView }),
        ...(input.frameTarget === undefined ? {} : { frameTarget: input.frameTarget }),
        ...(input.sceneRadius === undefined ? {} : { sceneRadius: input.sceneRadius }),
        ...(input.centrePx === undefined ? {} : { centrePx: input.centrePx }),
        renderMask: () => SOURCE_MASK,
      });
      return inspectRealBuildStepOneMaskRendererFactoryConfiguration(factory, {
        widthPx,
        heightPx,
        registrationPanelStepNumber,
      }).configurationDigest;
    };

    const digests = [
      digestFor({}),
      digestFor({ widthPx: 3 }),
      digestFor({ heightPx: 3 }),
      digestFor({ frameTarget: [1, 0, 0] }),
      digestFor({ sceneRadius: 2 }),
      digestFor({ fittedView: { ...TEST_VIEW, azimuthDegrees: 11 } }),
      digestFor({ fittedView: { ...TEST_VIEW, elevationDegrees: 21 } }),
      digestFor({ fittedView: { ...TEST_VIEW, pixelsPerUnit: 2 } }),
      digestFor({ fittedView: { ...TEST_VIEW, upSign: -1 } }),
      digestFor({ centrePx: [0, 1] }),
      digestFor({ registrationPanelStepNumber: 3 }),
    ];
    expect(new Set(digests)).toHaveLength(digests.length);
  });

  it("refuses configuration inspection when the source binding is detached", () => {
    const factory = testRendererFactory({
      widthPx: 2,
      heightPx: 2,
      registrationPanelStepNumber: 2,
      renderMask: () => SOURCE_MASK,
    });
    expect(() =>
      inspectRealBuildStepOneMaskRendererFactoryConfiguration(factory, {
        widthPx: 4,
        heightPx: 1,
        registrationPanelStepNumber: 2,
      }),
    ).toThrow(/bound to raster 2x2/u);
    expect(() =>
      inspectRealBuildStepOneMaskRendererFactoryConfiguration(factory, {
        widthPx: 2,
        heightPx: 2,
        registrationPanelStepNumber: 3,
      }),
    ).toThrow(/panel 2/u);
  });

  it("refuses non-square raster and wrong-panel factory bindings before rendering", () => {
    const transposed = { preparations: 0, renders: 0, disposals: 0 };
    expect(() =>
      fixture(8, 64, [0], false, {
        factoryWidthPx: 1,
        factoryHeightPx: 4,
        externalCounts: transposed,
      }),
    ).toThrow(/bound to raster 1x4/u);
    expect(transposed).toEqual({ preparations: 0, renders: 0, disposals: 0 });

    const wrongPanel = { preparations: 0, renders: 0, disposals: 0 };
    expect(() =>
      fixture(8, 64, [0], false, {
        registrationPanelStepNumber: 3,
        externalCounts: wrongPanel,
      }),
    ).toThrow(/panel 3/u);
    expect(wrongPanel).toEqual({ preparations: 0, renders: 0, disposals: 0 });
  });

  it("detaches source evidence before a renderer mutates its caller-owned mask", () => {
    const baseline = fixture();
    const source = fixture(8, 64, [0], true);
    expect([...source.sourceMask]).toEqual([0, 0, 0, 0]);
    expect(source.result.status).toBe("observed");
    if (source.result.status !== "observed") throw new TypeError("Expected observed diagnostic.");
    expect(source.result.frontier.rasterMeasurement.builtMaskDigest).toBe(
      `sha256:${sha256Hex(SOURCE_MASK)}`,
    );
    expect(source.result.observation.roleBytes[0]).toBe(0xc0);
    if (baseline.result.status !== "observed") throw new TypeError("Expected baseline diagnostic.");
    expect(source.result.observation.closureBytes).toEqual(
      baseline.result.observation.closureBytes,
    );
    expect(source.result.observation.roleBytes).toEqual(baseline.result.observation.roleBytes);
    expect(source.result.observation.inspection.closure.selection.status).toBe("selected");
  });

  it("uses only detached dimensions when a direct producer source Proxy drifts", () => {
    const fixtureSource = fixture();
    if (fixtureSource.result.status !== "observed") {
      throw new TypeError("Expected observed diagnostic.");
    }
    let drifted = false;
    const sourceTarget = {
      provisionalStepIdentity: canonicalDigest({ fixture: "producer-proxy" }),
      observationMode: "lookahead" as const,
      registrationPanelStepNumber: 2,
      pageNumber: 2,
      panelDigest: canonicalDigest({ fixture: "producer-proxy-panel" }),
      cropDigest: canonicalDigest({ fixture: "producer-proxy-crop" }),
      sourceDescriptorDigest: canonicalDigest({ fixture: "producer-proxy-source" }),
      exclusionDescriptorDigest: canonicalDigest({ fixture: "producer-proxy-exclusion" }),
      measure: "iou" as const,
      widthPx: 2,
      heightPx: 2,
      sourceMask: new Uint8Array(SOURCE_MASK),
      excludedMask: null,
    };
    const driftingSource = new Proxy(sourceTarget, {
      get(target, property, receiver) {
        if (drifted && property === "widthPx") return 1;
        if (drifted && property === "heightPx") return 4;
        return Reflect.get(target, property, receiver) as unknown;
      },
      getOwnPropertyDescriptor(target, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (property === "excludedMask") drifted = true;
        return descriptor;
      },
    });
    const roots = fixtureSource.result.roots.map((root, index) => ({
      lineageId: root.lineageId,
      hypothesis: fixtureSource.result.rootResolution.seeds[index]!,
    }));
    const cameras = fixtureSource.result.frontier.candidates.flatMap((candidate) =>
      candidate.attempts.map((hypothesis) => ({
        candidateId: candidate.candidateId,
        documentHash: candidate.documentHash,
        hypothesis,
        candidateMask:
          hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
            ? SOURCE_MASK
            : WEAKER_MASK,
      })),
    );
    const production = produceRealBuildCompiledObservationClosure({
      batch: fixtureSource.result.batch,
      policy: fixtureSource.policy,
      source: driftingSource,
      roots,
      cameras,
    });
    expect(drifted).toBe(true);
    expect(production.inspection.reproducible).toBe(true);
    expect(production.inspection.closure.sources[0]!.sourceMask).toMatchObject({
      widthPx: 2,
      heightPx: 2,
    });
    expect(
      production.inspection.closure.cameras.every(
        ({ candidateMask }) => candidateMask.widthPx === 2 && candidateMask.heightPx === 2,
      ),
    ).toBe(true);
  });

  it("preflights closure raster and replay limits before their protected work", () => {
    const oversized = { compilerCalls: 0, renderCalls: 0 };
    expect(() => runResourceBoundDiagnostic(1_025, 1_024, new Uint8Array(), oversized)).toThrow(
      /at most 1048576 pixels/u,
    );
    expect(oversized).toEqual({ compilerCalls: 0, renderCalls: 0 });

    const replayHeavy = { compilerCalls: 0, renderCalls: 0 };
    expect(() =>
      runResourceBoundDiagnostic(1_024, 1_024, new Uint8Array(1_024 * 1_024), replayHeavy),
    ).toThrow(/pixel visits above maximum/u);
    expect(replayHeavy).toEqual({ compilerCalls: 1, renderCalls: 0 });
  });

  it("refuses search budget minus one before compiler or camera work", () => {
    const source = fixture(7, 64);
    expect(source.result.status).toBe("search-budget-refused");
    expect(source.compiler).not.toHaveBeenCalled();
    expect(source.renders).toBe(0);
    expect(source.result.batch.evidence.searchReservation).toMatchObject({
      requested: 8,
      reservedAfter: 0,
      admitted: false,
    });
    expect(source.result.metrics).toMatchObject({
      rootCount: 8,
      offeredLineageEdges: 8,
      suppliedCompilerCalls: 0,
      renderCalls: 0,
    });
    expect(source.result.acceptedDocument).toBeNull();
  });

  it("scales physical work by unique child documents rather than retained edges", () => {
    const source = fixture(16, 128, [0, 20]);
    expect(source.result.status).toBe("observed");
    if (source.result.status !== "observed") throw new TypeError("Expected observed diagnostic.");
    expect(source.result.metrics).toEqual({
      rootCount: 8,
      offeredLineageEdges: 16,
      suppliedCompilerCalls: 2,
      uniquePhysicalTransitions: 2,
      uniqueChildDocuments: 2,
      logicalCameraBranches: 128,
      rendererPreparations: 2,
      renderCalls: 16,
      rendererDisposals: 2,
    });
    expect(source.result.batch.evidence.lineageEdges).toHaveLength(16);
    expect(source.result.frontier.observations).toHaveLength(128);
    expect(source.result.observation.cameraCount).toBe(16);
    expect(source.result.observation.observationCount).toBe(16);
    expect(source.result.observation.inspection.closure.selection.status).toBe("unresolved");
    expect(source.result.observation.inspection.closure.acceptedTransition).toBeNull();
    expect(source.maxLiveRenderers).toBe(1);
    expect(source.rendererEvents).toEqual(["prepare-1", "dispose-1", "prepare-2", "dispose-2"]);
  });

  it("copies reusable render buffers and disposes the prepared renderer after a failed view", () => {
    const shared = fixture(8, 64, [0], false, { reuseSharedBuffer: true });
    expect(shared.result.status).toBe("observed");
    expect(shared.result.frontier?.candidates[0]?.renderMaskDigests[0]).toBe(
      `sha256:${sha256Hex(SOURCE_MASK)}`,
    );
    expect(shared.result.frontier?.candidates[0]?.renderMaskDigests[1]).toBe(
      `sha256:${sha256Hex(WEAKER_MASK)}`,
    );
    expect(shared.rendererPreparations).toBe(1);
    expect(shared.rendererDisposals).toBe(1);

    const failed = fixture(8, 64, [0], false, { throwFromRender: 2 });
    expect(failed.result.status).toBe("camera-failed");
    expect(failed.renders).toBe(8);
    expect(failed.rendererPreparations).toBe(1);
    expect(failed.rendererDisposals).toBe(1);
    expect(failed.result.metrics).toMatchObject({
      rendererPreparations: 1,
      renderCalls: 8,
      rendererDisposals: 1,
    });
  });

  it("refuses the diagnostic when prepared-renderer cleanup fails", () => {
    expect(() => fixture(8, 64, [0], false, { throwOnDispose: true })).toThrow(
      /could not dispose every prepared renderer/u,
    );
  });

  it("does not prepare a later child after an earlier child cleanup failure", () => {
    const counts = { preparations: 0, renders: 0, disposals: 0 };
    expect(() =>
      fixture(16, 128, [0, 20], false, {
        throwOnDispose: true,
        externalCounts: counts,
      }),
    ).toThrow(/could not dispose every prepared renderer/u);
    expect(counts).toEqual({ preparations: 1, renders: 8, disposals: 1 });
  });

  it("propagates fatal setup-and-cleanup failure through the branded factory", () => {
    const counts = { preparations: 0, renders: 0, disposals: 0 };
    expect(() =>
      fixture(16, 128, [0, 20], false, {
        throwOnSilhouetteSetup: true,
        throwOnDispose: true,
        externalCounts: counts,
      }),
    ).toThrow(/partially prepared scene could not be disposed/u);
    expect(counts).toEqual({ preparations: 1, renders: 0, disposals: 1 });
  });

  it("carries one no-model two-part /26 enumerator witness through the same absent-authority closure", () => {
    const bytes = currentCatalogStepOneBytes();
    const preparedStep = inspectRealBuildPreparedStepInput(bytes, 1);
    const policy = inspectRealBuildPreparedObservationPolicy(bytes);
    const parent = preparedSearchEmptyParent();
    const first = distinct(
      enumeratePlacements(
        parent.documentSnapshot.document,
        preparedStep.expectedAtomicPieces[0]!.catalogPartId,
        {
          includeBuildPlate: true,
        },
      ).candidates,
    )[0]!;
    const firstTransaction = createPlacePartTransaction(parent.documentSnapshot.document, {
      catalogPartId: first.catalogPartId,
      colorId: "builtin:black",
      transform: first.transform,
    });
    const firstDocument = applyBuildOperations(
      parent.documentSnapshot.document,
      firstTransaction.operations,
    );
    const second = distinct(
      enumeratePlacements(firstDocument, preparedStep.expectedAtomicPieces[1]!.catalogPartId, {})
        .candidates,
    )[0]!;
    const secondTransaction = createPlacePartTransaction(firstDocument, {
      catalogPartId: second.catalogPartId,
      colorId: "builtin:black",
      transform: second.transform,
    });
    const compiler = vi.fn(compileRealBuildAutomaticPlacement);
    const result = runRealBuildStepOneCompiledCameraDiagnostic({
      preparedStep,
      policy,
      rootDocumentSnapshot: parent.documentSnapshot,
      candidates: [
        {
          partIds: [firstTransaction.partId, secondTransaction.partId],
          offeredCandidates: [
            snapshotRealBuildEnumeratedPlacementOffer(first),
            snapshotRealBuildEnumeratedPlacementOffer(second),
          ],
        },
      ],
      searchBudget: 8,
      cameraBranchBudget: 64,
      source: {
        provisionalStepIdentity: canonicalDigest({ fixture: "current-catalog-step-one" }),
        observationMode: "lookahead",
        registrationPanelStepNumber: 2,
        pageNumber: 2,
        panelDigest: canonicalDigest({ fixture: "synthetic-step-two-panel" }),
        cropDigest: canonicalDigest({ fixture: "synthetic-step-two-crop" }),
        sourceDescriptorDigest: canonicalDigest({ fixture: "synthetic-step-two-source" }),
        exclusionDescriptorDigest: canonicalDigest({ fixture: "synthetic-step-two-exclusion" }),
        measure: "iou",
        widthPx: 2,
        heightPx: 2,
        sourceMask: SOURCE_MASK,
        excludedMask: null,
      },
      prepareModelMaskRenderer: testRendererFactory({
        widthPx: 2,
        heightPx: 2,
        renderMask: (view) =>
          view.azimuthDegrees === TEST_VIEW.azimuthDegrees &&
          view.elevationDegrees === TEST_VIEW.elevationDegrees
            ? SOURCE_MASK
            : WEAKER_MASK,
      }),
      compiler,
    });

    expect(result.status).toBe("observed");
    if (result.status !== "observed") throw new TypeError("Expected observed diagnostic.");
    expect(first.transform).toEqual({
      positionLdu: [0, 8, 0],
      orientationId: "upright-yaw-0",
    });
    expect(second.connections.length).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      rootCount: 8,
      offeredLineageEdges: 8,
      suppliedCompilerCalls: 1,
      uniquePhysicalTransitions: 1,
      uniqueChildDocuments: 1,
      logicalCameraBranches: 64,
      rendererPreparations: 1,
      renderCalls: 8,
      rendererDisposals: 1,
    });
    expect(result.observation.inspection.closure.acceptedTransition?.placedPieces).toBe(2);
    expect(result.observation.inspection.authority).toBe("absent");
    expect(result.acceptedDocument).toBeNull();
  });

  it("refuses camera budget minus one after compile but before any render", () => {
    const source = fixture(8, 63);
    expect(source.result.status).toBe("camera-budget-refused");
    expect(source.compiler).toHaveBeenCalledOnce();
    expect(source.renders).toBe(0);
    expect(source.result.frontier?.reservation).toMatchObject({
      requested: 64,
      reservedAfter: 0,
    });
    expect(source.result.metrics).toMatchObject({
      suppliedCompilerCalls: 1,
      logicalCameraBranches: 64,
      rendererPreparations: 0,
      renderCalls: 0,
      rendererDisposals: 0,
    });
    expect(source.result.observation).toBeNull();
    expect(source.result.acceptedDocument).toBeNull();
  });
});
