import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";

import type { RigidSubassemblyReturnEnumeration } from "../src/assembly/rigid-subassembly-return";
import {
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
  type RealBuildPrefix50SubBuildReturnCandidateDescriptor,
} from "./real-build-prefix50-subbuild-return-contract";

const CANDIDATE_KEY = /^[0-9a-f]{64}$/u;

export function realBuildPrefix50SubBuildReturnCandidateRoster(
  enumeration: RigidSubassemblyReturnEnumeration,
): readonly RealBuildPrefix50SubBuildReturnCandidateDescriptor[] {
  return deepFreeze(
    enumeration.candidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      groupDelta: candidate.groupDelta,
      crossPorts: candidate.crossEdges.map(({ a, b }) => ({
        aPartId: a.partId,
        aPortId: a.portId,
        bPartId: b.partId,
        bPortId: b.portId,
      })),
    })),
  );
}

export function requireCompleteRealBuildPrefix50SubBuildReturnEnumeration(
  enumeration: RigidSubassemblyReturnEnumeration,
  sourceDocumentHash: `sha256:${string}`,
  childPartIds: readonly string[],
): void {
  const childIds = new Set(childPartIds);
  const terminal =
    enumeration.counts.rejectedTransformPolicy +
    enumeration.counts.rejectedIllegalPartOrientation +
    enumeration.counts.rejectedBelowGround +
    enumeration.counts.rejectedNoCrossEdge +
    enumeration.counts.rejectedConnectorCapacityConflict +
    enumeration.counts.rejectedCollision +
    enumeration.counts.rejectedDisconnected +
    enumeration.counts.rejectedOtherBlockingValidation +
    enumeration.counts.accepted;
  const invalidCandidate = enumeration.candidates.some((candidate) => {
    const transformedIds = candidate.transformedChildParts.map(({ id }) => id);
    return (
      !CANDIDATE_KEY.test(candidate.candidateKey) ||
      candidate.crossEdges.length === 0 ||
      candidate.crossEdges.some(({ a, b }) => childIds.has(a.partId) === childIds.has(b.partId)) ||
      !candidate.validationReport.documentGloballyValid ||
      candidate.validationReport.targetDocumentHash !==
        documentStructuralHash(candidate.hardValidDocument) ||
      candidate.hardValidDocument.parts.length !== 280 ||
      transformedIds.length !== childIds.size ||
      new Set(transformedIds).size !== childIds.size ||
      transformedIds.some((partId) => !childIds.has(partId))
    );
  });
  if (
    enumeration.sourceDocumentHash !== sourceDocumentHash ||
    canonicalDigest(enumeration.workLimits) !==
      canonicalDigest(REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS) ||
    canonicalDigest(enumeration.childPartIds) !== canonicalDigest([...childPartIds].sort()) ||
    enumeration.counts.parentParts !== 257 ||
    enumeration.counts.childParts !== 23 ||
    enumeration.counts.groupDeltasVisited !== enumeration.counts.distinctGroupDeltas ||
    terminal !== enumeration.counts.groupDeltasVisited ||
    enumeration.counts.accepted !== enumeration.candidates.length ||
    new Set(enumeration.candidates.map(({ candidateKey }) => candidateKey)).size !==
      enumeration.candidates.length ||
    invalidCandidate
  ) {
    throw new TypeError(
      "Prefix-50 return enumerator did not provide one complete deterministic hard-valid receipt.",
    );
  }
}
