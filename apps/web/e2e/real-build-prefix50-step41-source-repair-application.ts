import {
  canonicalDigest,
  composeRigidTransforms,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import { sameTransform } from "./real-build-prefix50-exact-compiler-foundation";
import {
  REAL_BUILD_PREFIX50_LAST_STEP,
  REAL_BUILD_PREFIX50_OCCURRENCE_COUNT,
  realBuildPrefix50ProjectionCommitment,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50IntegralProjection } from "./real-build-prefix50-source-placement-repair";
import type {
  RealBuildPrefix50Step41PairEvidence,
  RealBuildPrefix50Step41SourceRepairEvidence,
} from "./real-build-prefix50-step41-source-repair-contract";
import { requireRealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return-runtime";

export interface RealBuildPrefix50Step41SourceRepairProposal {
  readonly schemaVersion: "lego.real-build-prefix50-step41-source-repair-proposal/1";
  readonly authority: "none";
  readonly occurrenceOrdinals: readonly [270, 271, 272, 273];
  readonly sourceEvidence: RealBuildPrefix50Step41SourceRepairEvidence;
  readonly repairCommitment: `sha256:${string}`;
  readonly provisionalBasis: "opaque-panel-and-reciprocal-seat-awaiting-complete-prefix-proof";
}

export interface RealBuildPrefix50BoundStep41Pair {
  readonly receiverOrdinal: number;
  readonly candidateOrdinal: number;
  readonly receiverPartId: string;
  readonly candidatePartId: string;
  readonly repairedDetachedTargetTransform: RigidTransform;
  readonly returnedTargetTransform: RigidTransform;
  readonly connectionIds: readonly [string, string];
}

export interface RealBuildPrefix50BoundStep41SourceRepair extends Omit<
  RealBuildPrefix50Step41SourceRepairProposal,
  "provisionalBasis" | "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-step41-source-repair/2";
  readonly basis: "opaque-panel-plus-reciprocal-seats-plus-complete-prefix50-enumeration";
  readonly compiledPairs: readonly RealBuildPrefix50BoundStep41Pair[];
  readonly proof: {
    readonly schemaVersion: "lego.real-build-prefix50-step41-source-repair-final-proof/1";
    readonly projectionCommitment: `sha256:${string}`;
    readonly selectedReturnCommitment: `sha256:${string}`;
    readonly completedPrintedStep: 50;
    readonly compiledPartCount: 320;
    readonly occurrenceOrdinalRoster: "exact-unique-1-through-320";
    readonly exactReturnedPosesRetained: true;
    readonly distinctConnectionCount: 8;
    readonly finalDocumentCollisionCount: 0;
    readonly finalDocumentHash: `sha256:${string}`;
  };
}

export interface RealBuildPrefix50Step41RepairedProjectionView {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly proposal: RealBuildPrefix50Step41SourceRepairProposal;
}

function sameOccurrenceExceptTransform(
  left: RealBuildPrefix50VerifiedProjection["occurrences"][number],
  right: RealBuildPrefix50VerifiedProjection["occurrences"][number],
): boolean {
  return (
    canonicalDigest({ ...left, sourceWorldTransform: right.sourceWorldTransform }) ===
    canonicalDigest(right)
  );
}

function requireIntegralViewDerivedFromSource(
  source: RealBuildPrefix50VerifiedProjection,
  integralView: RealBuildPrefix50IntegralProjection,
): void {
  const projection = integralView.projection;
  const repairByOrdinal = new Map(
    integralView.repairs.map((repair) => [repair.occurrenceOrdinal, repair] as const),
  );
  if (
    projection.schemaVersion !== source.schemaVersion ||
    projection.sourceSetId !== source.sourceSetId ||
    projection.sourceArtifactDigest !== source.sourceArtifactDigest ||
    projection.steps !== source.steps ||
    projection.childSubBuildWindow !== source.childSubBuildWindow ||
    projection.occurrences.length !== source.occurrences.length ||
    repairByOrdinal.size !== integralView.repairs.length
  ) {
    throw new TypeError(
      "Step-41 repair application requires the exact integral view derived from the opaque projection.",
    );
  }
  for (const [index, sourceOccurrence] of source.occurrences.entries()) {
    const computed = projection.occurrences[index]!;
    const repair = repairByOrdinal.get(sourceOccurrence.ordinal);
    if (
      repair === undefined
        ? computed !== sourceOccurrence
        : !sameOccurrenceExceptTransform(computed, sourceOccurrence) ||
          !sameTransform(computed.sourceWorldTransform, repair.repairedSourceWorldTransform) ||
          !sameTransform(sourceOccurrence.sourceWorldTransform, repair.sourceWorldTransform)
    ) {
      throw new TypeError(
        `Step-41 repair application found an unbound integral-view change at occurrence ${sourceOccurrence.ordinal}.`,
      );
    }
  }
}

/**
 * Applies only the four opaque-proof-backed Step-41 transforms to the compiler's
 * computation view. The original projection and every raw transform remain intact.
 */
export function applyRealBuildPrefix50Step41SourceRepair(
  sourceProjection: RealBuildPrefix50VerifiedProjection,
  integralView: RealBuildPrefix50IntegralProjection,
  sourceEvidence: RealBuildPrefix50Step41SourceRepairEvidence,
): RealBuildPrefix50Step41RepairedProjectionView {
  requireRealBuildPrefix50VerifiedProjectionValue(sourceProjection);
  requireIntegralViewDerivedFromSource(sourceProjection, integralView);
  const projectionCommitment = realBuildPrefix50ProjectionCommitment(sourceProjection);
  const expectedOrdinals = [270, 271, 272, 273] as const;
  const pairByCandidate = new Map(
    sourceEvidence.pairs.map((pair) => [pair.candidateOrdinal, pair] as const),
  );
  if (
    sourceEvidence.schemaVersion !== "lego.real-build-prefix50-step41-source-repair-evidence/1" ||
    sourceEvidence.authority !== "none" ||
    sourceEvidence.placementAuthority !== false ||
    sourceEvidence.catalogTruthClaimed !== false ||
    sourceEvidence.projectionCommitment !== projectionCommitment ||
    sourceEvidence.printedStepNumber !== 41 ||
    sourceEvidence.pairs.length !== 4 ||
    pairByCandidate.size !== 4 ||
    expectedOrdinals.some((ordinal) => !pairByCandidate.has(ordinal)) ||
    integralView.repairs.some(({ occurrenceOrdinal }) => pairByCandidate.has(occurrenceOrdinal))
  ) {
    throw new TypeError(
      "Step-41 repair application requires the exact four-pair opaque proof for this projection and no overlapping source repair.",
    );
  }
  const repairedOccurrences = integralView.projection.occurrences.map((occurrence) => {
    const pair = pairByCandidate.get(occurrence.ordinal);
    if (pair === undefined) return occurrence;
    const raw = sourceProjection.occurrences[occurrence.ordinal - 1];
    if (
      raw === undefined ||
      raw.ordinal !== pair.candidateOrdinal ||
      !sameTransform(raw.sourceWorldTransform, pair.rawSourceWorldTransform) ||
      occurrence !== raw
    ) {
      throw new TypeError(
        `Step-41 repair occurrence ${pair.candidateOrdinal} no longer retains its exact raw projection identity and transform.`,
      );
    }
    return deepFreeze({
      ...occurrence,
      sourceWorldTransform: pair.repairedSourceWorldTransform,
    });
  });
  const proposal = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step41-source-repair-proposal/1" as const,
    authority: "none" as const,
    occurrenceOrdinals: expectedOrdinals,
    sourceEvidence,
    repairCommitment: sourceEvidence.repairCommitment,
    provisionalBasis: "opaque-panel-and-reciprocal-seat-awaiting-complete-prefix-proof" as const,
  });
  return deepFreeze({
    projection: {
      ...integralView.projection,
      occurrences: repairedOccurrences,
    },
    proposal,
  });
}

function connectionIdsForPair(
  document: BrickDocumentV1,
  pair: RealBuildPrefix50Step41PairEvidence,
  candidatePartId: string,
  receiverPartId: string,
): readonly [string, string] {
  const ids = pair.canonicalConnections.map(({ candidatePortId, receiverPortId }) => {
    const matches = document.connections.filter(
      ({ kind, a, b }) =>
        kind === "stud-tube" &&
        ((a.partId === candidatePartId &&
          a.portId === candidatePortId &&
          b.partId === receiverPartId &&
          b.portId === receiverPortId) ||
          (b.partId === candidatePartId &&
            b.portId === candidatePortId &&
            a.partId === receiverPartId &&
            a.portId === receiverPortId)),
    );
    if (matches.length !== 1) {
      throw new TypeError(
        `Step-41 repaired occurrence ${pair.candidateOrdinal} requires exactly one ${candidatePortId} to ${receiverPortId} compiled edge; found ${matches.length}.`,
      );
    }
    return matches[0]!.id;
  });
  if (ids.length !== 2 || ids[0] === ids[1]) {
    throw new TypeError(
      `Step-41 repaired occurrence ${pair.candidateOrdinal} must retain two distinct compiled edges.`,
    );
  }
  return ids as [string, string];
}

export function bindRealBuildPrefix50Step41SourceRepair(
  document: BrickDocumentV1,
  proposal: RealBuildPrefix50Step41SourceRepairProposal,
  sourceProjection: RealBuildPrefix50VerifiedProjection,
  gauge: RigidTransform,
  selectedReturnValue: unknown,
  placementOrdinals: readonly number[],
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
): RealBuildPrefix50BoundStep41SourceRepair {
  const selectedReturn = requireRealBuildPrefix50SelectedSubBuildReturn(selectedReturnValue);
  const compiledPairs = proposal.sourceEvidence.pairs.map((pair) => {
    const candidatePartId = partIdByOccurrenceOrdinal.get(pair.candidateOrdinal);
    const receiverPartId = partIdByOccurrenceOrdinal.get(pair.receiverOrdinal);
    const candidate = document.parts.find(({ id }) => id === candidatePartId);
    const receiver = document.parts.find(({ id }) => id === receiverPartId);
    const detachedCandidateTarget = deepFreeze(
      composeRigidTransforms(gauge, pair.repairedSourceWorldTransform),
    );
    const detachedReceiverTarget = composeRigidTransforms(
      gauge,
      sourceProjection.occurrences[pair.receiverOrdinal - 1]!.sourceWorldTransform,
    );
    const returnedTargetTransform = deepFreeze(
      composeRigidTransforms(selectedReturn.groupDelta, detachedCandidateTarget),
    );
    const returnedReceiverTransform = composeRigidTransforms(
      selectedReturn.groupDelta,
      detachedReceiverTarget,
    );
    if (
      candidatePartId === undefined ||
      receiverPartId === undefined ||
      candidate?.catalogPartId !== "builtin:plate-1x2-round-end" ||
      receiver?.catalogPartId !== "builtin:bracket-2x2-1x2-vertical-studs" ||
      !sameTransform(candidate.transform, returnedTargetTransform) ||
      !sameTransform(receiver.transform, returnedReceiverTransform)
    ) {
      throw new TypeError(
        `Step-41 repaired occurrence ${pair.candidateOrdinal} did not retain its exact enumerated relative pose through the reviewed Step-44 rigid return.`,
      );
    }
    return deepFreeze({
      receiverOrdinal: pair.receiverOrdinal,
      candidateOrdinal: pair.candidateOrdinal,
      receiverPartId,
      candidatePartId,
      repairedDetachedTargetTransform: detachedCandidateTarget,
      returnedTargetTransform,
      connectionIds: connectionIdsForPair(document, pair, candidatePartId, receiverPartId),
    });
  });
  const connectionIds = compiledPairs.flatMap((pair) => pair.connectionIds);
  const exactPlacementRoster = [...placementOrdinals]
    .sort((left, right) => left - right)
    .every((ordinal, index) => ordinal === index + 1);
  const finalCollisions = findCatalogCollisions(document.parts, document.connections);
  if (
    compiledPairs.length !== 4 ||
    connectionIds.length !== 8 ||
    new Set(connectionIds).size !== 8 ||
    placementOrdinals.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    new Set(placementOrdinals).size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    !exactPlacementRoster ||
    document.parts.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    document.steps.length !== REAL_BUILD_PREFIX50_LAST_STEP ||
    finalCollisions.length !== 0
  ) {
    throw new TypeError(
      `Step-41 source repair did not survive complete exact compilation with eight distinct seats and zero collisions; connections/collisions=${connectionIds.length}/${finalCollisions.length}.`,
    );
  }
  const { provisionalBasis: _provisionalBasis, ...proven } = proposal;
  void _provisionalBasis;
  return deepFreeze({
    ...proven,
    schemaVersion: "lego.real-build-prefix50-step41-source-repair/2" as const,
    basis: "opaque-panel-plus-reciprocal-seats-plus-complete-prefix50-enumeration" as const,
    compiledPairs,
    proof: {
      schemaVersion: "lego.real-build-prefix50-step41-source-repair-final-proof/1" as const,
      projectionCommitment: realBuildPrefix50ProjectionCommitment(sourceProjection),
      selectedReturnCommitment: selectedReturn.commitment,
      completedPrintedStep: REAL_BUILD_PREFIX50_LAST_STEP,
      compiledPartCount: document.parts.length,
      occurrenceOrdinalRoster: "exact-unique-1-through-320" as const,
      exactReturnedPosesRetained: true as const,
      distinctConnectionCount: 8 as const,
      finalDocumentCollisionCount: 0 as const,
      finalDocumentHash: documentStructuralHash(document),
    },
  });
}
