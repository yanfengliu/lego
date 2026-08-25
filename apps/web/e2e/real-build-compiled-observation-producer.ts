import {
  canonicalDigest,
  canonicalStringify,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import {
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  requireRealBuildAtomicCompiledBranchBatchResult,
  type RealBuildAtomicCompiledBranchBatchResult,
} from "./real-build-atomic-compiled-branch-batch";
import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationId,
  deriveRealBuildCompiledObservationSourceId,
  verifyRealBuildCompiledObservationClosure,
  type RealBuildCompiledObservation,
  type RealBuildCompiledObservationCameraCommitment,
  type RealBuildCompiledObservationClosure,
  type RealBuildCompiledObservationClosureInspection,
  type RealBuildCompiledObservationMaskReference,
} from "./real-build-compiled-observation-closure";
import {
  createRealBuildCompiledObservationRegistrationVerifier,
  packRealBuildCompiledBinaryMaskMsb,
} from "./real-build-compiled-observation-registration";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION,
  REAL_BUILD_COMPILED_OBSERVATION_METRIC,
} from "./real-build-compiled-observation-closure-types";
import {
  preflightRealBuildCompiledObservationResources,
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import type { RealBuildLineageId } from "./real-build-candidate-lineage-identity";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { snapshotPanelCameraBinaryMask } from "./real-build-panel-camera-resolver-boundary";
import {
  requireRealBuildPreparedObservationPolicyInspection,
  type RealBuildPreparedObservationPolicyInspection,
} from "./real-build-prepared-step-authority";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";

export type { RealBuildCompiledObservationSourceInput } from "./real-build-compiled-observation-source";

export interface RealBuildCompiledObservationCameraInput {
  readonly candidateId: string;
  readonly documentHash: Sha256Digest;
  readonly hypothesis: StepCameraLatticeHypothesis;
  readonly candidateMask: Uint8Array;
}

export interface RealBuildCompiledObservationRootHypothesis {
  readonly lineageId: string;
  readonly hypothesis: StepCameraLatticeHypothesis;
}

export interface RealBuildCompiledObservationProduction {
  readonly closureBytes: Uint8Array;
  readonly roleBytes: Uint8Array;
  readonly inspection: RealBuildCompiledObservationClosureInspection;
  readonly cameraCount: number;
  readonly observationCount: number;
  readonly acceptedDocument: null;
  readonly authority: "absent";
}

type CameraRow = RealBuildCompiledObservationCameraCommitment & {
  readonly hypothesis: StepCameraLatticeHypothesis;
  readonly packedMask: Uint8Array;
};

const cameraKey = (candidateId: string, hypothesis: StepCameraLatticeHypothesis): string =>
  `${candidateId}\0${hypothesis.latticeHand}\0${hypothesis.latticeDeterminant}\0${hypothesis.turnDegrees}`;

function maskReference(
  offset: number,
  bytes: Uint8Array,
  widthPx: number,
  heightPx: number,
): RealBuildCompiledObservationMaskReference {
  return intrinsicRealBuildFreeze({
    role: "branch-observation-bytes" as const,
    offset,
    bytes: bytes.length,
    digest: `sha256:${sha256Hex(bytes)}` as Sha256Digest,
    encoding: "packed-binary-mask-msb/1" as const,
    widthPx,
    heightPx,
  });
}

function append(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  if (offset !== length) throw new TypeError("Compiled observation role lost dense byte closure.");
  return result;
}

function acceptedTransition(
  batch: RealBuildAtomicCompiledBranchBatchResult,
  lineageIds: readonly RealBuildLineageId[],
) {
  if (lineageIds.length === 0) return null;
  const edges = new Map(batch.evidence.lineageEdges.map((edge) => [edge.child.lineageId, edge]));
  const transitions = new Map(
    batch.evidence.uniqueTransitions.map((transition) => [transition.transitionId, transition]),
  );
  const selectedEdges = lineageIds.map((lineageId) => {
    const edge = edges.get(lineageId);
    if (edge === undefined) throw new TypeError("Selected camera group is not one compiled edge.");
    return edge;
  });
  const orderedTransitionIds = [...new Set(selectedEdges.map(({ transitionId }) => transitionId))];
  const selectedTransitions = orderedTransitionIds.map((transitionId) => {
    const transition = transitions.get(transitionId);
    if (transition === undefined) throw new TypeError("Selected edge has no compiled transition.");
    return transition;
  });
  const first = selectedTransitions[0]!;
  if (
    selectedTransitions.some(
      (transition) =>
        transition.childCandidateId !== first.childCandidateId ||
        transition.childDocumentHash !== first.childDocumentHash ||
        transition.receipt.canonicalStepId !== first.receipt.canonicalStepId ||
        transition.pieces.length !== first.pieces.length,
    )
  ) {
    throw new TypeError("Selected camera group does not converge on one compiled transition.");
  }
  return intrinsicRealBuildFreeze({
    candidateId: first.childCandidateId,
    documentHash: first.childDocumentHash,
    lineageIds: intrinsicRealBuildFreeze([...lineageIds]),
    transitionIds: intrinsicRealBuildFreeze(orderedTransitionIds),
    canonicalStepId: first.receipt.canonicalStepId,
    placedPieces: first.pieces.length,
  });
}

/**
 * Produces and immediately replays one authority-absent typed observation closure.
 * Source and renderer commitments remain opaque until browser-output /4 cross-binds them.
 */
export function produceRealBuildCompiledObservationClosure(input: {
  readonly batch: RealBuildAtomicCompiledBranchBatchResult;
  readonly policy: RealBuildPreparedObservationPolicyInspection;
  readonly source: RealBuildCompiledObservationSourceInput;
  readonly roots: readonly RealBuildCompiledObservationRootHypothesis[];
  readonly cameras: readonly RealBuildCompiledObservationCameraInput[];
}): RealBuildCompiledObservationProduction {
  const batch = requireRealBuildAtomicCompiledBranchBatchResult(input.batch);
  const policy = requireRealBuildPreparedObservationPolicyInspection(input.policy);
  if (batch.status !== "compiled" || batch.evidence.status !== "unresolved") {
    throw new TypeError("Compiled observation production requires one unresolved compiled batch.");
  }
  if (policy.preparedRunInputDigest !== batch.evidence.preparedStep.preparedRunInputDigest) {
    throw new TypeError("Compiled observation policy does not bind the compiled prepared run.");
  }
  const sourceSnapshot = snapshotRealBuildCompiledObservationSource(input.source);
  const { pixelCount } = preflightRealBuildCompiledObservationResources({
    source: sourceSnapshot,
    rootCount: input.roots.length,
    cameraCount: input.cameras.length,
    observationCount: batch.evidence.lineageEdges.length,
  });
  const sourceMask = snapshotPanelCameraBinaryMask(
    sourceSnapshot.sourceMask,
    pixelCount,
    "Compiled observation source mask",
  );
  const excludedMask =
    sourceSnapshot.excludedMask === null
      ? new Uint8Array(pixelCount)
      : snapshotPanelCameraBinaryMask(
          sourceSnapshot.excludedMask,
          pixelCount,
          "Compiled observation excluded mask",
        );
  const packedSource = packRealBuildCompiledBinaryMaskMsb(
    sourceMask,
    sourceSnapshot.widthPx,
    sourceSnapshot.heightPx,
  );
  const packedExcluded = packRealBuildCompiledBinaryMaskMsb(
    excludedMask,
    sourceSnapshot.widthPx,
    sourceSnapshot.heightPx,
  );
  const chunks: Uint8Array[] = [packedSource, packedExcluded];
  let roleLength = packedSource.length + packedExcluded.length;
  const sourceReference = maskReference(
    0,
    packedSource,
    sourceSnapshot.widthPx,
    sourceSnapshot.heightPx,
  );
  const excludedReference = maskReference(
    packedSource.length,
    packedExcluded,
    sourceSnapshot.widthPx,
    sourceSnapshot.heightPx,
  );
  const sourceBody = intrinsicRealBuildFreeze({
    preparedRunInputDigest: batch.evidence.preparedStep.preparedRunInputDigest,
    preparedStepIdentity: batch.evidence.preparedStep.printedStepIdentity,
    provisionalStepIdentity: sourceSnapshot.provisionalStepIdentity,
    observationMode: sourceSnapshot.observationMode,
    compiledThroughStepNumber: batch.evidence.throughStepNumber,
    registrationPanelStepNumber: sourceSnapshot.registrationPanelStepNumber,
    pageNumber: sourceSnapshot.pageNumber,
    panelDigest: sourceSnapshot.panelDigest,
    cropDigest: sourceSnapshot.cropDigest,
    sourceDescriptorDigest: sourceSnapshot.sourceDescriptorDigest,
    exclusionDescriptorDigest: sourceSnapshot.exclusionDescriptorDigest,
    metric: REAL_BUILD_COMPILED_OBSERVATION_METRIC,
    measure: sourceSnapshot.measure,
    sourceMask: sourceReference,
    excludedMask: excludedReference,
  });
  const source = intrinsicRealBuildFreeze({
    sourceId: deriveRealBuildCompiledObservationSourceId(sourceBody),
    ...sourceBody,
  });
  const cameraRows: CameraRow[] = [];
  const seenCameras = new Set<string>();
  for (const supplied of input.cameras) {
    const key = cameraKey(supplied.candidateId, supplied.hypothesis);
    if (seenCameras.has(key)) throw new TypeError("Compiled observation repeats one D4 camera.");
    seenCameras.add(key);
    const candidateMask = snapshotPanelCameraBinaryMask(
      supplied.candidateMask,
      pixelCount,
      `Compiled observation camera ${key}`,
    );
    const packed = packRealBuildCompiledBinaryMaskMsb(
      candidateMask,
      sourceSnapshot.widthPx,
      sourceSnapshot.heightPx,
    );
    const reference = maskReference(
      roleLength,
      packed,
      sourceSnapshot.widthPx,
      sourceSnapshot.heightPx,
    );
    chunks.push(packed);
    roleLength += packed.length;
    const d4CameraRecipeDigest = canonicalDigest({
      schemaVersion: "lego.real-build-compiled-diagnostic-camera-recipe/1",
      sourceId: source.sourceId,
      candidateId: supplied.candidateId,
      documentHash: supplied.documentHash,
      hypothesis: supplied.hypothesis,
    });
    const rendererSnapshotDigest = canonicalDigest({
      schemaVersion: "lego.real-build-compiled-diagnostic-renderer-snapshot/1",
      d4CameraRecipeDigest,
      candidateMaskDigest: reference.digest,
    });
    const body = intrinsicRealBuildFreeze({
      sourceId: source.sourceId,
      candidateId: supplied.candidateId as `document:sha256:${string}`,
      documentHash: supplied.documentHash,
      d4CameraRecipeDigest,
      rendererSnapshotDigest,
      candidateMask: reference,
    });
    cameraRows.push(
      intrinsicRealBuildFreeze({
        cameraId: deriveRealBuildCompiledObservationCameraId(body),
        ...body,
        hypothesis: supplied.hypothesis,
        packedMask: packed,
      }),
    );
  }
  const roots = new Map(input.roots.map((root) => [root.lineageId, root.hypothesis]));
  if (roots.size !== input.roots.length) {
    throw new TypeError("Compiled observation root hypotheses repeat one lineage ID.");
  }
  const cameras = new Map(
    cameraRows.map((camera) => [cameraKey(camera.candidateId, camera.hypothesis), camera]),
  );
  const camerasById = new Map(cameraRows.map((camera) => [camera.cameraId, camera]));
  const verifier = createRealBuildCompiledObservationRegistrationVerifier(
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  );
  const registrationByCamera = new Map<string, ReturnType<typeof verifier.register>>();
  const observations: RealBuildCompiledObservation[] = [];
  for (const edge of batch.evidence.lineageEdges) {
    const hypothesis = roots.get(edge.parentLineageId);
    if (hypothesis === undefined) {
      throw new TypeError("Compiled edge has no exact retained root D4 hypothesis.");
    }
    const camera = cameras.get(cameraKey(edge.child.candidateId, hypothesis));
    if (camera === undefined || camera.documentHash !== edge.child.documentHash) {
      throw new TypeError("Compiled edge has no exact child/D4 camera mask.");
    }
    let registration = registrationByCamera.get(camera.cameraId);
    if (registration === undefined) {
      registration = verifier.register({
        source: packedSource,
        excluded: packedExcluded,
        candidate: camera.packedMask,
        width: sourceSnapshot.widthPx,
        height: sourceSnapshot.heightPx,
        measure: sourceSnapshot.measure,
        path: `compiled observation ${observations.length}`,
      });
      registrationByCamera.set(camera.cameraId, registration);
    }
    const body = intrinsicRealBuildFreeze({
      lineageId: edge.child.lineageId,
      sourceId: source.sourceId,
      cameraId: camera.cameraId,
      status: "scored" as const,
      shiftPx: registration.shiftPx,
      score: registration.score,
      outcome: null,
    });
    observations.push(
      intrinsicRealBuildFreeze({
        observationId: deriveRealBuildCompiledObservationId(body),
        ...body,
      }),
    );
  }
  const groups = new Map<
    string,
    {
      readonly camera: CameraRow;
      readonly score: number;
      readonly lineages: RealBuildLineageId[];
      order: number;
    }
  >();
  for (const [order, observation] of observations.entries()) {
    const camera = camerasById.get(observation.cameraId!)!;
    const key = `${camera.candidateId}\0${camera.cameraId}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        camera,
        score: observation.score!,
        lineages: [observation.lineageId],
        order,
      });
    } else group.lineages.push(observation.lineageId);
  }
  const ranked = [...groups.values()].sort(
    (left, right) => right.score - left.score || left.order - right.order,
  );
  const best = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const margin = best === null || runnerUp === null ? null : best.score - runnerUp.score;
  const selected =
    best !== null &&
    best.score >= policy.minimumScore &&
    (runnerUp === null || margin! > policy.minimumMargin);
  const selection = intrinsicRealBuildFreeze({
    status: selected ? ("selected" as const) : ("unresolved" as const),
    decisionSourceId: source.sourceId,
    selectedCameraId: selected ? best!.camera.cameraId : null,
    selectedCandidateId: selected ? best!.camera.candidateId : null,
    selectedLineageIds: intrinsicRealBuildFreeze(selected ? [...best!.lineages] : []),
    bestScore: best?.score ?? null,
    runnerUpScore: runnerUp?.score ?? null,
    margin,
  });
  const roleBytes = append(chunks, roleLength);
  const compiledLineageBytes = decodeRealBuildAtomicCompiledBranchEvidenceWire(batch.evidenceWire);
  const closure: RealBuildCompiledObservationClosure = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_COMPILED_OBSERVATION_CLOSURE_SCHEMA_VERSION,
    compiledLineageBytesDigest: `sha256:${sha256Hex(compiledLineageBytes)}` as Sha256Digest,
    roleBytes: roleBytes.length,
    roleDigest: `sha256:${sha256Hex(roleBytes)}` as Sha256Digest,
    sources: intrinsicRealBuildFreeze([source]),
    cameras: intrinsicRealBuildFreeze(
      cameraRows.map((camera) =>
        intrinsicRealBuildFreeze({
          cameraId: camera.cameraId,
          sourceId: camera.sourceId,
          candidateId: camera.candidateId,
          documentHash: camera.documentHash,
          d4CameraRecipeDigest: camera.d4CameraRecipeDigest,
          rendererSnapshotDigest: camera.rendererSnapshotDigest,
          candidateMask: camera.candidateMask,
        }),
      ),
    ),
    observations: intrinsicRealBuildFreeze(observations),
    selection,
    acceptedTransition: acceptedTransition(batch, selection.selectedLineageIds),
    completionAuthority: intrinsicRealBuildFreeze({
      status: "absent" as const,
      authorized: false as const,
      reason: "compiled-observation-closure-is-inspection-only" as const,
    }),
  });
  const closureBytes = new TextEncoder().encode(canonicalStringify(closure));
  const inspection = verifyRealBuildCompiledObservationClosure(
    compiledLineageBytes,
    closureBytes,
    roleBytes,
    policy,
  );
  return intrinsicRealBuildFreeze({
    closureBytes,
    roleBytes,
    inspection,
    cameraCount: cameraRows.length,
    observationCount: observations.length,
    acceptedDocument: null,
    authority: "absent" as const,
  });
}
