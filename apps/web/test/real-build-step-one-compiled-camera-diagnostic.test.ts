import { describe, expect, it, vi } from "vitest";

import { applyBuildOperations, canonicalDigest, sha256Hex } from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { produceRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-producer";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedStepInput,
} from "../e2e/real-build-prepared-step-authority";
import { runRealBuildStepOneCompiledCameraDiagnostic } from "../e2e/real-build-step-one-compiled-camera-diagnostic";
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
  return new TextEncoder().encode(JSON.stringify({ ...options, panels }));
}

function fixture(
  searchBudget = 8,
  cameraBranchBudget = 64,
  candidatePositions: readonly number[] = [0],
  mutateSourceOnFirstRender = false,
) {
  const bytes = preparedSearchOptionsBytes(1, 1);
  const preparedStep = inspectRealBuildPreparedStepInput(bytes, 1);
  const policy = inspectRealBuildPreparedObservationPolicy(bytes);
  const parent = preparedSearchEmptyParent();
  const piece = preparedStep.expectedAtomicPieces[0]!;
  const compiler = vi.fn(compileRealBuildAutomaticPlacement);
  const sourceMask = new Uint8Array(SOURCE_MASK);
  let renders = 0;
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
    renderModelMask: ({ hypothesis }) => {
      renders += 1;
      if (mutateSourceOnFirstRender && renders === 1) sourceMask.fill(0);
      return hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
        ? SOURCE_MASK
        : WEAKER_MASK;
    },
    compiler,
  });
  return { result, compiler, renders, parent, policy, sourceMask };
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
    renderModelMask: () => {
      counters.renderCalls += 1;
      return sourceMask;
    },
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
    expect(source.renders).toBe(8);
    expect(result.metrics).toEqual({
      rootCount: 8,
      offeredLineageEdges: 8,
      suppliedCompilerCalls: 1,
      uniquePhysicalTransitions: 1,
      uniqueChildDocuments: 1,
      logicalCameraBranches: 64,
      renderCalls: 8,
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
      renderCalls: 16,
    });
    expect(source.result.batch.evidence.lineageEdges).toHaveLength(16);
    expect(source.result.frontier.observations).toHaveLength(128);
    expect(source.result.observation.cameraCount).toBe(16);
    expect(source.result.observation.observationCount).toBe(16);
    expect(source.result.observation.inspection.closure.selection.status).toBe("unresolved");
    expect(source.result.observation.inspection.closure.acceptedTransition).toBeNull();
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
      renderModelMask: ({ hypothesis }) =>
        hypothesis.latticeHand === "as-fitted" && hypothesis.turnDegrees === 0
          ? SOURCE_MASK
          : WEAKER_MASK,
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
      renderCalls: 8,
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
      renderCalls: 0,
    });
    expect(source.result.observation).toBeNull();
    expect(source.result.acceptedDocument).toBeNull();
  });
});
