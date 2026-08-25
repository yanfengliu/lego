import { documentStructuralHash, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  executeRealBuildAtomicCompiledBranchBatch,
  type RealBuildAtomicCompiledBranchBatchResult,
  type RealBuildAtomicCompiledBranchCompiler,
} from "./real-build-atomic-compiled-branch-batch";
import { compileRealBuildAutomaticPlacement } from "./real-build-automatic-placement-compiler";
import { snapshotRealBuildLineageIdentity } from "./real-build-candidate-lineage-identity";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  createRealBuildCandidateDocumentSnapshot,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  bindRealBuildExactRootLineageIdentity,
  type RealBuildExactLineageIdentity,
} from "./real-build-exact-lineage-identity";
import type { RealBuildEnumeratedPlacementOffer } from "./real-build-enumerated-placement-witness";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { createRealBuildPanelCameraBranchBudgetLedger } from "./real-build-panel-camera-branch-budget";
import {
  resolveRealBuildPanelCameraFrontier,
  type RealBuildPanelCameraFrontierResolution,
} from "./real-build-panel-camera-frontier";
import { projectRealBuildPanelCameraLineageEvidence } from "./real-build-panel-camera-lineage-adapter";
import { resolveRealBuildPanelCameraBranches } from "./real-build-panel-camera-resolver";
import { snapshotPanelCameraBinaryMask } from "./real-build-panel-camera-resolver-boundary";
import {
  produceRealBuildCompiledObservationClosure,
  type RealBuildCompiledObservationProduction,
} from "./real-build-compiled-observation-producer";
import {
  preflightRealBuildCompiledObservationResources,
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import { createRealBuildPreparedSearchLedger } from "./real-build-prepared-search-ledger";
import {
  requireRealBuildPreparedObservationPolicyInspection,
  requireRealBuildPreparedStepInspection,
  type RealBuildPreparedObservationPolicyInspection,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";

export interface RealBuildStepOneCompiledCandidate {
  readonly partIds: readonly string[];
  readonly offeredCandidates: readonly RealBuildEnumeratedPlacementOffer[];
}

export interface RealBuildStepOneCompiledCameraMetrics {
  readonly rootCount: number;
  readonly offeredLineageEdges: number;
  readonly suppliedCompilerCalls: number;
  readonly uniquePhysicalTransitions: number;
  readonly uniqueChildDocuments: number;
  readonly logicalCameraBranches: number;
  readonly renderCalls: number;
}

interface ResultBase {
  readonly rootResolution: ReturnType<typeof resolveRealBuildPanelCameraBranches>;
  readonly roots: readonly RealBuildExactLineageIdentity[];
  readonly batch: RealBuildAtomicCompiledBranchBatchResult;
  readonly metrics: RealBuildStepOneCompiledCameraMetrics;
  readonly acceptedDocument: null;
  readonly completionAuthority: { readonly status: "absent"; readonly authorized: false };
}

export type RealBuildStepOneCompiledCameraDiagnosticResult =
  | (ResultBase & {
      readonly status: "search-budget-refused" | "compilation-failed";
      readonly frontier: null;
      readonly observation: null;
    })
  | (ResultBase & {
      readonly status: "camera-budget-refused" | "camera-failed";
      readonly frontier: RealBuildPanelCameraFrontierResolution<unknown>;
      readonly observation: null;
    })
  | (ResultBase & {
      readonly status: "observed";
      readonly frontier: RealBuildPanelCameraFrontierResolution<unknown>;
      readonly observation: RealBuildCompiledObservationProduction;
    });

const NO_COMPLETION_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
});

function metrics(input: {
  readonly rootCount: number;
  readonly batch: RealBuildAtomicCompiledBranchBatchResult;
  readonly compilerCalls: number;
  readonly frontier: RealBuildPanelCameraFrontierResolution<unknown> | null;
  readonly renderCalls: number;
}): RealBuildStepOneCompiledCameraMetrics {
  return intrinsicRealBuildFreeze({
    rootCount: input.rootCount,
    offeredLineageEdges: input.batch.evidence.searchRequest.proposals.length,
    suppliedCompilerCalls: input.compilerCalls,
    uniquePhysicalTransitions: input.batch.evidence.uniqueTransitions.length,
    uniqueChildDocuments: input.batch.evidence.childCandidates.length,
    logicalCameraBranches: input.frontier?.reservation.requested ?? 0,
    renderCalls: input.renderCalls,
  });
}

/**
 * Private step-1/panel-2 lookahead diagnostic. It executes branch work and exact replay,
 * but cannot select a physical frame, mutate a user document, or authorize completion.
 */
export function runRealBuildStepOneCompiledCameraDiagnostic(input: {
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly policy: RealBuildPreparedObservationPolicyInspection;
  readonly rootDocumentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly candidates: readonly RealBuildStepOneCompiledCandidate[];
  readonly searchBudget: number;
  readonly cameraBranchBudget: number;
  readonly source: RealBuildCompiledObservationSourceInput;
  readonly renderModelMask: (input: {
    readonly candidateId: string;
    readonly document: RealBuildCandidateDocumentSnapshot["document"];
    readonly hypothesis: StepCameraLatticeHypothesis;
  }) => Uint8Array;
  readonly compiler?: RealBuildAtomicCompiledBranchCompiler;
}): RealBuildStepOneCompiledCameraDiagnosticResult {
  const preparedStep = requireRealBuildPreparedStepInspection(input.preparedStep);
  const policy = requireRealBuildPreparedObservationPolicyInspection(input.policy);
  const rootSnapshot = requireRealBuildCandidateDocumentSnapshotValue(input.rootDocumentSnapshot);
  const source = snapshotRealBuildCompiledObservationSource(input.source);
  if (
    preparedStep.stepNumber !== 1 ||
    source.observationMode !== "lookahead" ||
    source.registrationPanelStepNumber !== 2
  ) {
    throw new RangeError(
      "Step-one compiled camera diagnostic requires step 1 and lookahead panel 2.",
    );
  }
  preflightRealBuildCompiledObservationResources({
    source,
    rootCount: 8,
    cameraCount: 0,
    observationCount: 0,
  });
  if (rootSnapshot.document.parts.length !== 0) {
    throw new TypeError(
      "Step-one compiled camera diagnostic requires an exact empty root document.",
    );
  }
  if (input.candidates.length === 0) {
    throw new RangeError(
      "Step-one compiled camera diagnostic requires at least one whole-step offer.",
    );
  }
  if (typeof input.renderModelMask !== "function") {
    throw new TypeError("Step-one compiled camera diagnostic requires one render callback.");
  }
  // Candidate snapshots pin deterministic array iteration with private own symbols. The camera
  // boundary intentionally accepts only plain JSON containers, so cross it from the already
  // bounded canonical bytes rather than smuggling one boundary's in-process instrumentation.
  const cameraRootDocument = JSON.parse(
    rootSnapshot.canonicalBytes,
  ) as RealBuildCandidateDocumentSnapshot["document"];
  const rootResolution = resolveRealBuildPanelCameraBranches({
    prefix: {
      throughStepNumber: 0,
      parentLineageId: null,
      document: cameraRootDocument,
      documentHash: rootSnapshot.documentHash,
    },
    registrationPanelStepNumber: 1,
    renderModelMask: () => {
      throw new TypeError("An empty-root D4 seed must not render.");
    },
    builtMask: new Uint8Array(1),
    excludedMask: null,
    widthPx: 1,
    heightPx: 1,
    ledger: createRealBuildPanelCameraBranchBudgetLedger(8),
    hashDocument: () => rootSnapshot.documentHash,
  });
  const rootLineage = projectRealBuildPanelCameraLineageEvidence({
    resolution: rootResolution,
    parent: null,
  });
  if (rootResolution.seeds.length !== 8 || rootLineage.attempts.length !== 8) {
    throw new TypeError("Step-one diagnostic did not retain the complete eight-way D4 root.");
  }
  const roots = intrinsicRealBuildFreeze(
    rootLineage.attempts.map((attempt) => {
      const identity = snapshotRealBuildLineageIdentity(attempt);
      if (identity.lineageOrigin !== "root") {
        throw new TypeError("Step-one D4 seed projected a non-root lineage identity.");
      }
      return bindRealBuildExactRootLineageIdentity({ identity, documentSnapshot: rootSnapshot });
    }),
  );
  const enumeratedParents = roots.map((identity) => ({
    parentLineageId: identity.lineageId,
    candidates: input.candidates,
  }));
  let compilerCalls = 0;
  const compiler = input.compiler ?? compileRealBuildAutomaticPlacement;
  const countedCompiler: RealBuildAtomicCompiledBranchCompiler = (compilerInput) => {
    compilerCalls += 1;
    return compiler(compilerInput);
  };
  const batchInput = {
    preparedStep,
    rootCandidates: [{ documentSnapshot: rootSnapshot, identities: roots }],
    enumeratedParents,
    ledger: createRealBuildPreparedSearchLedger(input.searchBudget),
  };
  const batch = executeRealBuildAtomicCompiledBranchBatch(batchInput, countedCompiler);
  const base = {
    rootResolution,
    roots,
    batch,
    acceptedDocument: null,
    completionAuthority: NO_COMPLETION_AUTHORITY,
  };
  if (batch.status !== "compiled") {
    return intrinsicRealBuildFreeze({
      ...base,
      status: batch.status === "budget-refused" ? "search-budget-refused" : "compilation-failed",
      frontier: null,
      observation: null,
      metrics: metrics({
        rootCount: roots.length,
        batch,
        compilerCalls,
        frontier: null,
        renderCalls: 0,
      }),
    });
  }
  preflightRealBuildCompiledObservationResources({
    source,
    rootCount: roots.length,
    cameraCount: batch.evidence.childCandidates.length * 8,
    observationCount: batch.evidence.lineageEdges.length,
  });
  const childSnapshots = new Map(
    batch.evidence.childCandidates.map((child) => [
      child.candidateId,
      {
        exact: createRealBuildCandidateDocumentSnapshot({
          canonicalDocument: child.canonicalBytes,
          expectedDocumentHash: child.documentHash,
        }),
        cameraDocument: JSON.parse(
          child.canonicalBytes,
        ) as RealBuildCandidateDocumentSnapshot["document"],
      },
    ]),
  );
  const prefixes = batch.evidence.lineageEdges.map((edge) => {
    const child = childSnapshots.get(edge.child.candidateId);
    if (child === undefined) throw new TypeError("Compiled edge has no exact child snapshot.");
    return {
      throughStepNumber: 1,
      parentLineageId: edge.child.lineageId,
      document: child.cameraDocument,
      documentHash: child.exact.documentHash,
    };
  });
  const captured = new Map<string, Uint8Array>();
  let renderCalls = 0;
  const captureKey = (candidateId: string, hypothesis: StepCameraLatticeHypothesis) =>
    `${candidateId}\0${hypothesis.latticeHand}\0${hypothesis.turnDegrees}`;
  const frontier = resolveRealBuildPanelCameraFrontier({
    prefixes,
    registrationPanelStepNumber: 2,
    renderModelMask: ({ candidateId, document, hypothesis }) => {
      renderCalls += 1;
      const mask = input.renderModelMask({ candidateId, document, hypothesis });
      const snapshot = snapshotPanelCameraBinaryMask(
        mask,
        source.widthPx * source.heightPx,
        `Step-one diagnostic ${captureKey(candidateId, hypothesis)}`,
      );
      const key = captureKey(candidateId, hypothesis);
      if (captured.has(key))
        throw new TypeError("Step-one diagnostic repeated one physical render.");
      captured.set(key, snapshot);
      return snapshot;
    },
    builtMask: new Uint8Array(source.sourceMask),
    excludedMask: source.excludedMask === null ? null : new Uint8Array(source.excludedMask),
    widthPx: source.widthPx,
    heightPx: source.heightPx,
    ledger: createRealBuildPanelCameraBranchBudgetLedger(input.cameraBranchBudget),
    hashDocument: (document) => documentStructuralHash(document) as Sha256Digest,
  });
  const expectedExcludedMaskDigest =
    source.excludedMask === null ? null : `sha256:${sha256Hex(source.excludedMask)}`;
  if (
    frontier.rasterMeasurement.widthPx !== source.widthPx ||
    frontier.rasterMeasurement.heightPx !== source.heightPx ||
    frontier.rasterMeasurement.builtMaskDigest !== `sha256:${sha256Hex(source.sourceMask)}` ||
    frontier.rasterMeasurement.excludedMaskDigest !== expectedExcludedMaskDigest
  ) {
    throw new TypeError(
      "Step-one diagnostic frontier does not reproduce its detached source raster.",
    );
  }
  const completedMetrics = () =>
    metrics({ rootCount: roots.length, batch, compilerCalls, frontier, renderCalls });
  if (frontier.status === "budget-refused" || frontier.status === "failed") {
    return intrinsicRealBuildFreeze({
      ...base,
      status: frontier.status === "budget-refused" ? "camera-budget-refused" : "camera-failed",
      frontier,
      observation: null,
      metrics: completedMetrics(),
    });
  }
  const rootHypotheses = roots.map((root, index) => ({
    lineageId: root.lineageId,
    hypothesis: {
      latticeHand: rootResolution.seeds[index]!.latticeHand,
      latticeDeterminant: rootResolution.seeds[index]!.latticeDeterminant,
      turnDegrees: rootResolution.seeds[index]!.turnDegrees,
    },
  }));
  const cameras = frontier.candidates.flatMap((candidate) =>
    candidate.attempts.map((hypothesis, index) => {
      const candidateMask = captured.get(captureKey(candidate.candidateId, hypothesis));
      if (
        candidateMask === undefined ||
        candidate.renderMaskDigests[index] !== `sha256:${sha256Hex(candidateMask)}`
      ) {
        throw new TypeError(
          "Step-one diagnostic capture does not reproduce frontier mask evidence.",
        );
      }
      return {
        candidateId: candidate.candidateId,
        documentHash: candidate.documentHash,
        hypothesis,
        candidateMask,
      };
    }),
  );
  const observation = produceRealBuildCompiledObservationClosure({
    batch,
    policy,
    source,
    roots: rootHypotheses,
    cameras,
  });
  return intrinsicRealBuildFreeze({
    ...base,
    status: "observed" as const,
    frontier,
    observation,
    metrics: completedMetrics(),
  });
}
