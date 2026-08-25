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
import {
  isStepSilhouetteCleanupFailure,
  type StepCameraLatticeHypothesis,
} from "./real-build-step-camera";
import {
  inspectRealBuildStepOnePreparedMaskRenderer,
  requireRealBuildStepOneMaskRendererFactory,
  type RealBuildStepOneMaskRendererFactory,
  type RealBuildStepOnePreparedMaskRendererBoundary,
} from "./real-build-step-one-silhouette-renderer";

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
  readonly rendererPreparations: number;
  readonly renderCalls: number;
  readonly rendererDisposals: number;
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
  readonly rendererPreparations: number;
  readonly renderCalls: number;
  readonly rendererDisposals: number;
}): RealBuildStepOneCompiledCameraMetrics {
  return intrinsicRealBuildFreeze({
    rootCount: input.rootCount,
    offeredLineageEdges: input.batch.evidence.searchRequest.proposals.length,
    suppliedCompilerCalls: input.compilerCalls,
    uniquePhysicalTransitions: input.batch.evidence.uniqueTransitions.length,
    uniqueChildDocuments: input.batch.evidence.childCandidates.length,
    logicalCameraBranches: input.frontier?.reservation.requested ?? 0,
    rendererPreparations: input.rendererPreparations,
    renderCalls: input.renderCalls,
    rendererDisposals: input.rendererDisposals,
  });
}

const SAFE_REFLECT_APPLY = Reflect.apply;

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
  readonly prepareModelMaskRenderer: RealBuildStepOneMaskRendererFactory;
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
  const prepareModelMaskRenderer = requireRealBuildStepOneMaskRendererFactory(
    input.prepareModelMaskRenderer,
    source,
  );
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
        rendererPreparations: 0,
        renderCalls: 0,
        rendererDisposals: 0,
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
  const preparedRenderers = new Map<
    string,
    | { readonly status: "failed" }
    | ({
        readonly status: "ready";
        disposed: boolean;
        remainingRenders: number;
      } & RealBuildStepOnePreparedMaskRendererBoundary)
  >();
  let rendererPreparations = 0;
  let renderCalls = 0;
  let rendererDisposals = 0;
  let rendererDisposalFailed = false;
  let rendererSetupCleanupFailure: TypeError | null = null;
  const disposePreparedRenderer = (
    prepared: Extract<
      typeof preparedRenderers extends Map<string, infer V> ? V : never,
      { status: "ready" }
    >,
  ): void => {
    if (prepared.disposed) return;
    prepared.disposed = true;
    try {
      SAFE_REFLECT_APPLY(prepared.dispose, prepared.owner, []);
      rendererDisposals += 1;
    } catch {
      rendererDisposalFailed = true;
    }
  };
  const captureKey = (candidateId: string, hypothesis: StepCameraLatticeHypothesis) =>
    `${candidateId}\0${hypothesis.latticeHand}\0${hypothesis.turnDegrees}`;
  let frontier: RealBuildPanelCameraFrontierResolution<unknown> | undefined;
  let frontierFailure = false;
  let frontierThrown: unknown;
  try {
    frontier = resolveRealBuildPanelCameraFrontier({
      prefixes,
      registrationPanelStepNumber: 2,
      renderModelMask: ({ candidateId, document, hypothesis }) => {
        if (rendererDisposalFailed || rendererSetupCleanupFailure !== null) {
          throw new TypeError(
            "a prior child renderer cleanup failed, so no later child renderer may be prepared",
          );
        }
        let prepared = preparedRenderers.get(candidateId);
        if (prepared === undefined) {
          let supplied: unknown;
          try {
            supplied = SAFE_REFLECT_APPLY(prepareModelMaskRenderer, undefined, [
              intrinsicRealBuildFreeze({ candidateId, document }),
            ]);
            prepared = {
              status: "ready" as const,
              disposed: false,
              remainingRenders: 8,
              ...inspectRealBuildStepOnePreparedMaskRenderer(supplied),
            };
            rendererPreparations += 1;
            preparedRenderers.set(candidateId, prepared);
          } catch (caught) {
            preparedRenderers.set(candidateId, { status: "failed" });
            if (isStepSilhouetteCleanupFailure(caught)) {
              rendererSetupCleanupFailure = caught;
            }
            throw new TypeError(
              "the per-document camera renderer factory threw or returned an invalid renderer",
              { cause: caught },
            );
          }
        }
        if (prepared.status === "failed") {
          throw new TypeError("the per-document camera renderer factory already failed");
        }
        if (prepared.disposed || prepared.remainingRenders < 1) {
          throw new TypeError("Step-one diagnostic attempted to reuse a disposed child renderer.");
        }
        try {
          renderCalls += 1;
          const mask = SAFE_REFLECT_APPLY(prepared.render, prepared.owner, [hypothesis]);
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
        } finally {
          prepared.remainingRenders -= 1;
          if (prepared.remainingRenders === 0) disposePreparedRenderer(prepared);
        }
      },
      builtMask: new Uint8Array(source.sourceMask),
      excludedMask: source.excludedMask === null ? null : new Uint8Array(source.excludedMask),
      widthPx: source.widthPx,
      heightPx: source.heightPx,
      ledger: createRealBuildPanelCameraBranchBudgetLedger(input.cameraBranchBudget),
      hashDocument: (document) => documentStructuralHash(document) as Sha256Digest,
    });
  } catch (caught) {
    frontierFailure = true;
    frontierThrown = caught;
  } finally {
    for (const prepared of preparedRenderers.values()) {
      if (prepared.status !== "ready" || prepared.disposed) continue;
      disposePreparedRenderer(prepared);
    }
  }
  if (rendererSetupCleanupFailure !== null) throw rendererSetupCleanupFailure;
  if (rendererDisposalFailed) {
    throw new TypeError(
      "Step-one compiled camera diagnostic could not dispose every prepared renderer; discard its result and clean the task-owned render context.",
    );
  }
  if (frontierFailure) throw frontierThrown;
  if (frontier === undefined) {
    throw new TypeError("Step-one compiled camera diagnostic produced no camera frontier.");
  }
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
    metrics({
      rootCount: roots.length,
      batch,
      compilerCalls,
      frontier,
      rendererPreparations,
      renderCalls,
      rendererDisposals,
    });
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
