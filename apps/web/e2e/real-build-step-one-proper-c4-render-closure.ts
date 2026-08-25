import {
  canonicalDigest,
  canonicalStringify,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import type { RealBuildAtomicCompiledBranchCompiler } from "./real-build-atomic-compiled-branch-batch";
import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type {
  RealBuildCompiledObservation,
  RealBuildCompiledObservationCameraId,
} from "./real-build-compiled-observation-closure";
import type { RealBuildCompiledObservationSourceInput } from "./real-build-compiled-observation-source";
import type {
  RealBuildDocumentCandidateId,
  RealBuildLineageId,
} from "./real-build-candidate-lineage-identity";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildPanelCameraBranchBudgetLedger } from "./real-build-panel-camera-branch-budget";
import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "./real-build-panel-camera-resolver-boundary";
import type { RealBuildPreparedSearchLedger } from "./real-build-prepared-search-ledger";
import type {
  RealBuildPreparedObservationPolicyInspection,
  RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";
import { runRealBuildStepOneCompiledCameraDiagnostic } from "./real-build-step-one-compiled-camera-diagnostic";
import {
  REAL_BUILD_STEP_ONE_PROPER_C4_ORBITS_PER_CLOSURE,
  type RealBuildStepOneProperC4RepresentativeCameraScoreRow,
} from "./real-build-step-one-proper-c4-global-aggregation";
import type {
  RealBuildStepOneProperC4Orbit,
  RealBuildStepOneProperC4QuotientInspection,
} from "./real-build-step-one-proper-c4-quotient";
import type { RealBuildStepOneProperC4ClosureInspection } from "./real-build-step-one-proper-c4-render-reduction-types";
import type { RealBuildStepOneMaskRendererFactory } from "./real-build-step-one-silhouette-renderer";

const FIXED_BUDGET = 8_192;

function sameHypothesis(
  left: StepCameraLatticeHypothesis,
  right: StepCameraLatticeHypothesis,
): boolean {
  return (
    left.latticeHand === right.latticeHand &&
    left.latticeDeterminant === right.latticeDeterminant &&
    left.turnDegrees === right.turnDegrees
  );
}

function requireClosureAccounting(
  closureIndex: number,
  result: ReturnType<typeof runRealBuildStepOneCompiledCameraDiagnostic>,
): asserts result is Extract<typeof result, { status: "observed" }> {
  if (result.status !== "observed") {
    throw new TypeError(
      `Proper-C4 closure ${closureIndex} ended ${result.status}; no later closure or global rank may run.`,
    );
  }
  const search = result.batch.evidence.searchReservation;
  const camera = result.frontier.reservation;
  const expectedMetrics = {
    rootCount: 8,
    offeredLineageEdges: 40,
    suppliedCompilerCalls: 5,
    uniquePhysicalTransitions: 5,
    uniqueChildDocuments: 5,
    logicalCameraBranches: 320,
    rendererPreparations: 5,
    renderCalls: 40,
    rendererDisposals: 5,
  };
  if (
    canonicalStringify(result.metrics) !== canonicalStringify(expectedMetrics) ||
    result.batch.evidence.lineageEdges.length !== 40 ||
    result.batch.evidence.uniqueTransitions.length !== 5 ||
    result.batch.evidence.childCandidates.length !== 5 ||
    result.frontier.candidates.length !== 5 ||
    result.frontier.observations.length !== 320 ||
    result.observation.cameraCount !== 40 ||
    result.observation.observationCount !== 40 ||
    search.budget !== FIXED_BUDGET ||
    search.reservedBefore !== closureIndex * 40 ||
    search.requested !== 40 ||
    search.reservedAfter !== (closureIndex + 1) * 40 ||
    search.reservationNumber !== closureIndex + 1 ||
    !search.admitted ||
    search.refusal !== null ||
    search.terminalFailure !== null ||
    camera.budget !== FIXED_BUDGET ||
    camera.reservedBefore !== closureIndex * 320 ||
    camera.requested !== 320 ||
    camera.reservedAfter !== (closureIndex + 1) * 320 ||
    camera.failure !== null
  ) {
    throw new TypeError(
      `Proper-C4 closure ${closureIndex} did not preserve its exact five-representative accounting.`,
    );
  }
  const local = result.observation.inspection.closure.selection;
  if (
    !result.observation.inspection.reproducible ||
    result.observation.inspection.failedObservationIds.length !== 0 ||
    local.status !== "unresolved" ||
    local.selectedCameraId !== null ||
    local.selectedCandidateId !== null ||
    local.selectedLineageIds.length !== 0 ||
    result.observation.inspection.closure.acceptedTransition !== null ||
    result.observation.acceptedDocument !== null ||
    result.acceptedDocument !== null
  ) {
    throw new TypeError(
      `Proper-C4 closure ${closureIndex} leaked a batch-local decision or lost reproducibility.`,
    );
  }
}

function transitionForOrbit(
  orbit: RealBuildStepOneProperC4Orbit,
  transitions: Extract<
    ReturnType<typeof runRealBuildStepOneCompiledCameraDiagnostic>,
    { status: "observed" }
  >["batch"]["evidence"]["uniqueTransitions"],
) {
  const witnessBytes = canonicalStringify(orbit.representative.projectedWitnesses);
  const matches = transitions.filter(
    (transition) => canonicalStringify(transition.pieces) === witnessBytes,
  );
  if (matches.length !== 1) {
    throw new TypeError(
      `Proper-C4 orbit ${orbit.orbitIndex} does not map to exactly one compiled transition.`,
    );
  }
  return matches[0]!;
}

function scoreRows(
  closureIndex: number,
  orbits: readonly RealBuildStepOneProperC4Orbit[],
  result: Extract<
    ReturnType<typeof runRealBuildStepOneCompiledCameraDiagnostic>,
    { status: "observed" }
  >,
): readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[] {
  const transitions = new Map(
    orbits.map((orbit) => [
      orbit.orbitIndex,
      transitionForOrbit(orbit, result.batch.evidence.uniqueTransitions),
    ]),
  );
  const observations = new Map(
    result.observation.inspection.closure.observations.map((observation) => [
      observation.lineageId,
      observation,
    ]),
  );
  const rows: RealBuildStepOneProperC4RepresentativeCameraScoreRow[] = [];
  for (
    let hypothesisIndex = 0;
    hypothesisIndex < PANEL_CAMERA_ANGULAR_HYPOTHESES.length;
    hypothesisIndex += 1
  ) {
    const hypothesis = PANEL_CAMERA_ANGULAR_HYPOTHESES[hypothesisIndex]!;
    const rootLineageId = result.roots[hypothesisIndex]!.lineageId;
    for (const orbit of orbits) {
      const transition = transitions.get(orbit.orbitIndex)!;
      const edges = result.batch.evidence.lineageEdges.filter(
        (edge) =>
          edge.parentLineageId === rootLineageId && edge.transitionId === transition.transitionId,
      );
      const cameras = result.observation.cameraHypotheses.filter(
        (camera) =>
          camera.candidateId === transition.childCandidateId &&
          sameHypothesis(camera.hypothesis, hypothesis),
      );
      if (edges.length !== 1 || cameras.length !== 1) {
        throw new TypeError(
          `Proper-C4 closure ${closureIndex} lost one exact orbit/root lineage or camera.`,
        );
      }
      const edge = edges[0]!;
      const camera = cameras[0]!;
      const observation: RealBuildCompiledObservation | undefined = observations.get(
        edge.child.lineageId,
      );
      if (
        observation?.status !== "scored" ||
        observation.cameraId !== camera.cameraId ||
        observation.score === null ||
        observation.shiftPx === null ||
        camera.documentHash !== transition.childDocumentHash
      ) {
        throw new TypeError(
          `Proper-C4 closure ${closureIndex} cannot project one exact scored orbit/root row.`,
        );
      }
      rows.push(
        intrinsicRealBuildFreeze({
          closureIndex,
          orbitIndex: orbit.orbitIndex,
          hypothesis,
          candidateId: camera.candidateId as RealBuildDocumentCandidateId,
          documentHash: camera.documentHash,
          cameraId: camera.cameraId as RealBuildCompiledObservationCameraId,
          maskDigest: camera.maskDigest,
          shiftPx: observation.shiftPx,
          score: observation.score,
          rootLineageId: rootLineageId as RealBuildLineageId,
          lineageId: edge.child.lineageId,
        }),
      );
    }
  }
  if (rows.length !== 40) throw new TypeError("Proper-C4 closure did not retain 40 score rows.");
  return intrinsicRealBuildFreeze(rows);
}

export function runRealBuildStepOneProperC4RenderClosure(input: {
  readonly closureIndex: number;
  readonly quotient: RealBuildStepOneProperC4QuotientInspection;
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly deferredPolicy: RealBuildPreparedObservationPolicyInspection;
  readonly rootDocumentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly source: RealBuildCompiledObservationSourceInput;
  readonly sourceBindingDigest: Sha256Digest;
  readonly rendererConfigurationDigest: Sha256Digest;
  readonly prepareModelMaskRenderer: RealBuildStepOneMaskRendererFactory;
  readonly compiler: RealBuildAtomicCompiledBranchCompiler | undefined;
  readonly searchLedger: RealBuildPreparedSearchLedger;
  readonly cameraLedger: RealBuildPanelCameraBranchBudgetLedger;
}): RealBuildStepOneProperC4ClosureInspection {
  const firstOrbit = input.closureIndex * REAL_BUILD_STEP_ONE_PROPER_C4_ORBITS_PER_CLOSURE;
  const orbits = input.quotient.orbits.slice(firstOrbit, firstOrbit + 5);
  if (
    orbits.length !== 5 ||
    orbits.some((orbit, index) => orbit.orbitIndex !== firstOrbit + index)
  ) {
    throw new TypeError(
      `Proper-C4 closure ${input.closureIndex} is not one canonical orbit slice.`,
    );
  }
  const result = runRealBuildStepOneCompiledCameraDiagnostic({
    preparedStep: input.preparedStep,
    policy: input.deferredPolicy,
    rootDocumentSnapshot: input.rootDocumentSnapshot,
    candidates: orbits.map(({ representative }) => ({
      partIds: representative.partIds,
      offeredCandidates: representative.offeredCandidates,
    })),
    searchBudget: FIXED_BUDGET,
    cameraBranchBudget: FIXED_BUDGET,
    searchLedger: input.searchLedger,
    cameraLedger: input.cameraLedger,
    source: input.source,
    prepareModelMaskRenderer: input.prepareModelMaskRenderer,
    ...(input.compiler === undefined ? {} : { compiler: input.compiler }),
  });
  requireClosureAccounting(input.closureIndex, result);
  const representativeRows = scoreRows(input.closureIndex, orbits, result);
  const closure = result.observation.inspection.closure;
  const source = closure.sources[0];
  if (closure.sources.length !== 1 || source === undefined || closure.roleDigest === null) {
    throw new TypeError(
      `Proper-C4 closure ${input.closureIndex} lost its single bound source role.`,
    );
  }
  const logicalAssociationsDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-logical-associations/1",
    closureIndex: input.closureIndex,
    rows: result.frontier.observations.map((observation) => ({
      candidateId: observation.candidateId,
      documentHash: observation.documentHash,
      parentLineageId: observation.parentLineageId,
      lineageId: observation.lineageId,
      registration: observation.registration,
      silhouetteRegistration: observation.silhouetteRegistration,
    })),
  });
  const representativeRowsDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-closure-scores/1",
    closureIndex: input.closureIndex,
    rows: representativeRows,
  });
  const retained = {
    schemaVersion: "lego.real-build-step-one-proper-c4-render-closure/1" as const,
    closureIndex: input.closureIndex,
    orbitIndices: intrinsicRealBuildFreeze(orbits.map(({ orbitIndex }) => orbitIndex)),
    quotientDigest: input.quotient.quotientDigest,
    rendererConfigurationDigest: input.rendererConfigurationDigest,
    sourceBindingDigest: input.sourceBindingDigest,
    sourceId: source.sourceId,
    compiledLineageBytesDigest: closure.compiledLineageBytesDigest,
    closureBytesDigest: `sha256:${sha256Hex(result.observation.closureBytes)}` as Sha256Digest,
    roleBytes: closure.roleBytes,
    roleDigest: closure.roleDigest,
    logicalAssociationsDigest,
    representativeRows,
    representativeRowsDigest,
    metrics: result.metrics,
    searchReservation: result.batch.evidence.searchReservation,
    cameraReservation: result.frontier.reservation,
    accounting: intrinsicRealBuildFreeze({
      representatives: 5 as const,
      compiledLineageEdges: 40 as const,
      physicalTransitions: 5 as const,
      physicalRenders: 40 as const,
      representativeCameraScores: 40 as const,
      logicalCameraBranches: 320 as const,
    }),
    localSelectionStatus: "unresolved" as const,
    localSelectedCameraId: null,
    localSelectedCandidateId: null,
    localSelectedLineageIds: intrinsicRealBuildFreeze([]) as readonly [],
    acceptedTransition: null,
    acceptedDocument: null,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: intrinsicRealBuildFreeze({ status: "absent" as const, authorized: false }),
    authority: "absent" as const,
  };
  return intrinsicRealBuildFreeze({
    ...retained,
    closureDigest: canonicalDigest(retained),
  });
}
