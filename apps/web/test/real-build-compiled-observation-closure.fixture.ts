import { sha256Hex } from "@lego-studio/brick-kernel";

import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationId,
  deriveRealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import type {
  RealBuildCompiledObservation,
  RealBuildCompiledObservationCameraCommitment,
  RealBuildCompiledObservationClosure,
  RealBuildCompiledObservationMaskReference,
  RealBuildCompiledObservationSourceCommitment,
} from "../e2e/real-build-compiled-observation-closure-types";
import { createRealBuildCompiledObservationRegistrationVerifier } from "../e2e/real-build-compiled-observation-registration";
import type { RealBuildCompiledPlacementLineageEvidence } from "../e2e/real-build-compiled-placement-lineage-types";
import {
  inspectRealBuildPreparedObservationPolicy,
  type RealBuildPreparedObservationPolicyInspection,
} from "../e2e/real-build-prepared-step-authority";
import {
  compiledPlacementLineageBytes,
  compiledPlacementLineageFixture,
} from "./real-build-compiled-placement-lineage.fixture";
import { preparedSearchOptionsBytes } from "./real-build-prepared-search.fixture";

const DIGEST_D = `sha256:${"d".repeat(64)}` as const;
const DIGEST_E = `sha256:${"e".repeat(64)}` as const;
const DIGEST_F = `sha256:${"f".repeat(64)}` as const;
const POLICY = inspectRealBuildPreparedObservationPolicy(preparedSearchOptionsBytes(1, 1));

export type CompiledObservationClosureFixtureMode =
  "selected" | "camera-tie" | "different-sources" | "failed" | "fully-excluded" | "raw-empty";

export interface CompiledObservationClosureFixture {
  readonly policy: RealBuildPreparedObservationPolicyInspection;
  readonly lineage: RealBuildCompiledPlacementLineageEvidence;
  readonly lineageBytes: Uint8Array;
  readonly closure: RealBuildCompiledObservationClosure;
  readonly closureBytes: Uint8Array;
  readonly roleBytes: Uint8Array | null;
}

export function encodeCompiledObservationClosure(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

export function digestCompiledObservationBytes(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${sha256Hex(bytes)}`;
}

export function commitCompiledObservation(
  row: Omit<RealBuildCompiledObservation, "observationId">,
): RealBuildCompiledObservation {
  return { observationId: deriveRealBuildCompiledObservationId(row), ...row };
}

function maskReference(
  role: Uint8Array,
  offset: number,
  widthPx = 8,
  heightPx = 1,
): RealBuildCompiledObservationMaskReference {
  const bytes = Math.ceil((widthPx * heightPx) / 8);
  return {
    role: "branch-observation-bytes",
    offset,
    bytes,
    digest: digestCompiledObservationBytes(role.subarray(offset, offset + bytes)),
    encoding: "packed-binary-mask-msb/1",
    widthPx,
    heightPx,
  };
}

function commitSource(
  row: Omit<RealBuildCompiledObservationSourceCommitment, "sourceId">,
): RealBuildCompiledObservationSourceCommitment {
  return { sourceId: deriveRealBuildCompiledObservationSourceId(row), ...row };
}

function commitCamera(
  row: Omit<RealBuildCompiledObservationCameraCommitment, "cameraId">,
): RealBuildCompiledObservationCameraCommitment {
  return { cameraId: deriveRealBuildCompiledObservationCameraId(row), ...row };
}

function closureLineage(policy: RealBuildPreparedObservationPolicyInspection): {
  readonly lineage: RealBuildCompiledPlacementLineageEvidence;
  readonly lineageBytes: Uint8Array;
} {
  const base = compiledPlacementLineageFixture();
  const lineage = {
    ...base,
    preparedStep: {
      ...base.preparedStep,
      preparedRunInputDigest: policy.preparedRunInputDigest,
    },
  };
  return { lineage, lineageBytes: compiledPlacementLineageBytes(lineage) };
}

function sourceCommitment(
  lineage: RealBuildCompiledPlacementLineageEvidence,
  sourceMask: RealBuildCompiledObservationMaskReference,
  excludedMask: RealBuildCompiledObservationMaskReference,
  descriptorDigest: `sha256:${string}`,
  policy: RealBuildPreparedObservationPolicyInspection,
): RealBuildCompiledObservationSourceCommitment {
  return commitSource({
    preparedRunInputDigest: policy.preparedRunInputDigest,
    preparedStepIdentity: lineage.preparedStep.printedStepIdentity,
    provisionalStepIdentity: DIGEST_D,
    observationMode: "own-panel",
    compiledThroughStepNumber: lineage.throughStepNumber,
    registrationPanelStepNumber: lineage.throughStepNumber,
    pageNumber: 1,
    panelDigest: DIGEST_D,
    cropDigest: DIGEST_E,
    sourceDescriptorDigest: descriptorDigest,
    exclusionDescriptorDigest: DIGEST_F,
    metric: "shifted-binary-silhouette-agreement-after-excluded/1",
    measure: "iou",
    sourceMask,
    excludedMask,
  });
}

function cameraCommitment(
  lineage: RealBuildCompiledPlacementLineageEvidence,
  source: RealBuildCompiledObservationSourceCommitment,
  candidateMask: RealBuildCompiledObservationMaskReference,
  recipeDigest: `sha256:${string}`,
): RealBuildCompiledObservationCameraCommitment {
  const child = lineage.childCandidates[0]!;
  return commitCamera({
    sourceId: source.sourceId,
    candidateId: child.candidateId,
    documentHash: child.documentHash,
    d4CameraRecipeDigest: recipeDigest,
    rendererSnapshotDigest: DIGEST_E,
    candidateMask,
  });
}

function scoredRow(
  lineageId: RealBuildCompiledPlacementLineageEvidence["lineageEdges"][number]["child"]["lineageId"],
  source: RealBuildCompiledObservationSourceCommitment,
  camera: RealBuildCompiledObservationCameraCommitment,
  role: Uint8Array,
): RealBuildCompiledObservation {
  const register = createRealBuildCompiledObservationRegistrationVerifier(1_000_000);
  const result = register.register({
    source: role.subarray(
      source.sourceMask.offset,
      source.sourceMask.offset + source.sourceMask.bytes,
    ),
    candidate: role.subarray(
      camera.candidateMask.offset,
      camera.candidateMask.offset + camera.candidateMask.bytes,
    ),
    excluded: role.subarray(
      source.excludedMask.offset,
      source.excludedMask.offset + source.excludedMask.bytes,
    ),
    width: source.sourceMask.widthPx,
    height: source.sourceMask.heightPx,
    measure: source.measure,
    path: "compiled observation fixture",
  });
  return commitCompiledObservation({
    lineageId,
    sourceId: source.sourceId,
    cameraId: camera.cameraId,
    status: "scored",
    shiftPx: result.shiftPx,
    score: result.score,
    outcome: null,
  });
}

function acceptedTransition(
  lineage: RealBuildCompiledPlacementLineageEvidence,
  lineageIds: readonly RealBuildCompiledPlacementLineageEvidence["lineageEdges"][number]["child"]["lineageId"][],
) {
  const transition = lineage.uniqueTransitions[0]!;
  return {
    candidateId: transition.childCandidateId,
    documentHash: transition.childDocumentHash,
    lineageIds,
    transitionIds: [transition.transitionId],
    canonicalStepId: transition.receipt.canonicalStepId,
    placedPieces: transition.pieces.length,
  };
}

export function compiledObservationClosureFixture(
  mode: CompiledObservationClosureFixtureMode = "selected",
  policy: RealBuildPreparedObservationPolicyInspection = POLICY,
): CompiledObservationClosureFixture {
  const { lineage, lineageBytes } = closureLineage(policy);
  const roleBytes = Uint8Array.of(
    mode === "raw-empty" ? 0 : 0x70,
    mode === "fully-excluded" ? 0x70 : 0,
    0xe0,
  );
  const sourceMask = maskReference(roleBytes, 0);
  const excludedMask = maskReference(roleBytes, 1);
  const candidateMask = maskReference(roleBytes, 2);
  const sourceA = sourceCommitment(lineage, sourceMask, excludedMask, DIGEST_D, policy);
  const sourceB = sourceCommitment(lineage, sourceMask, excludedMask, DIGEST_E, policy);
  const cameraA = cameraCommitment(lineage, sourceA, candidateMask, DIGEST_D);
  const cameraB = cameraCommitment(
    lineage,
    mode === "different-sources" ? sourceB : sourceA,
    candidateMask,
    DIGEST_F,
  );
  const lineageIds = lineage.lineageEdges.map(({ child }) => child.lineageId);
  const observations = lineageIds.map((lineageId, index) => {
    if (mode === "failed") {
      return commitCompiledObservation({
        lineageId,
        sourceId: null,
        cameraId: null,
        status: "failed",
        shiftPx: null,
        score: null,
        outcome: {
          schemaVersion: "lego.real-build-compiled-observation-failure/1",
          code: "candidate-render-failed",
          stage: "rendering",
          reason: "Synthetic retained rendering failure.",
        },
      });
    }
    if (mode === "raw-empty") {
      return commitCompiledObservation({
        lineageId,
        sourceId: sourceA.sourceId,
        cameraId: null,
        status: "not-observable",
        shiftPx: null,
        score: null,
        outcome: "source-mask-empty",
      });
    }
    const useB =
      index >= lineageIds.length / 2 && (mode === "camera-tie" || mode === "different-sources");
    return scoredRow(
      lineageId,
      useB && mode === "different-sources" ? sourceB : sourceA,
      useB ? cameraB : cameraA,
      roleBytes,
    );
  });
  const bestScore = mode === "failed" || mode === "raw-empty" ? null : observations[0]!.score;
  const selection =
    mode === "selected"
      ? {
          status: "selected" as const,
          decisionSourceId: sourceA.sourceId,
          selectedCameraId: cameraA.cameraId,
          selectedCandidateId: cameraA.candidateId,
          selectedLineageIds: lineageIds,
          bestScore,
          runnerUpScore: null,
          margin: null,
        }
      : mode === "camera-tie"
        ? {
            status: "unresolved" as const,
            decisionSourceId: sourceA.sourceId,
            selectedCameraId: null,
            selectedCandidateId: null,
            selectedLineageIds: [],
            bestScore,
            runnerUpScore: bestScore,
            margin: 0,
          }
        : mode === "failed"
          ? {
              status: "unverified-failure" as const,
              decisionSourceId: null,
              selectedCameraId: null,
              selectedCandidateId: null,
              selectedLineageIds: [],
              bestScore: null,
              runnerUpScore: null,
              margin: null,
            }
          : {
              status: "unresolved" as const,
              decisionSourceId: sourceA.sourceId,
              selectedCameraId: null,
              selectedCandidateId: null,
              selectedLineageIds: [],
              bestScore,
              runnerUpScore: null,
              margin: null,
            };
  const sources =
    mode === "failed" ? [] : mode === "different-sources" ? [sourceA, sourceB] : [sourceA];
  const cameras =
    mode === "failed" || mode === "raw-empty"
      ? []
      : mode === "camera-tie" || mode === "different-sources"
        ? [cameraA, cameraB]
        : [cameraA];
  const retainedRole =
    mode === "failed"
      ? new Uint8Array()
      : mode === "raw-empty"
        ? roleBytes.subarray(0, 2)
        : roleBytes;
  const closure: RealBuildCompiledObservationClosure = {
    schemaVersion: "lego.real-build-compiled-observation-closure/1",
    compiledLineageBytesDigest: digestCompiledObservationBytes(lineageBytes),
    roleBytes: retainedRole.length,
    roleDigest: retainedRole.length === 0 ? null : digestCompiledObservationBytes(retainedRole),
    sources,
    cameras,
    observations,
    selection,
    acceptedTransition: mode === "selected" ? acceptedTransition(lineage, lineageIds) : null,
    completionAuthority: {
      status: "absent",
      authorized: false,
      reason: "compiled-observation-closure-is-inspection-only",
    },
  };
  return {
    policy,
    lineage,
    lineageBytes,
    closure,
    closureBytes: encodeCompiledObservationClosure(closure),
    roleBytes: retainedRole.length === 0 ? null : retainedRole,
  };
}
