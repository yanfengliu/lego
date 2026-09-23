import {
  applyBuildOperations,
  canonicalDigest,
  canonicalSha256,
  composeRigidTransforms,
  deepFreeze,
  documentStructuralHash,
  invertBuildOperations,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BuildOperation, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50SubBuildReturnCompactReviewCandidate,
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
  RealBuildPrefix50SubBuildReturnReviewRosterSummary,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment,
  realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment,
  realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment,
} from "./real-build-prefix50-subbuild-return-review-batch.ts";
import { realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment } from "./real-build-prefix50-subbuild-return-review-envelope.ts";

export const REAL_BUILD_PREFIX50_STEP44_REPLAY_BASE_REVISION_POLICY =
  "synthetic-structural-source-v1" as const;

export function realBuildPrefix50Step44SyntheticReviewReplayRevision(
  sourceDocumentHash: `sha256:${string}`,
): string {
  return `revision-step44-review-${sourceDocumentHash.slice("sha256:".length, 31)}`;
}

function operationRows(operations: readonly BuildOperation[]): {
  updates: readonly Extract<BuildOperation, { kind: "updatePart" }>[];
  additions: readonly Extract<BuildOperation, { kind: "addConnection" }>[];
} {
  return {
    updates: operations.filter(
      (operation): operation is Extract<BuildOperation, { kind: "updatePart" }> =>
        operation.kind === "updatePart",
    ),
    additions: operations.filter(
      (operation): operation is Extract<BuildOperation, { kind: "addConnection" }> =>
        operation.kind === "addConnection",
    ),
  };
}

function crossPorts(edges: readonly ConnectionEdge[]) {
  return edges.map(({ a, b }) => ({
    aPartId: a.partId,
    aPortId: a.portId,
    bPartId: b.partId,
    bPortId: b.portId,
  }));
}

function candidateKey(input: {
  readonly groupDelta: RealBuildPrefix50SubBuildReturnReviewRosterSummary["candidates"][number]["groupDelta"];
  readonly transformedChildParts: readonly PartInstance[];
  readonly crossEdges: readonly ConnectionEdge[];
  readonly operations: readonly BuildOperation[];
  readonly documentHash: `sha256:${string}`;
}): string {
  return canonicalDigest(input).slice("sha256:".length);
}

function restoreFinalRevision(
  document: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope["reviewReplayBaseDocument"],
  revision: string,
) {
  return deepFreeze({ ...document, revision });
}

function samePartExceptTransform(before: PartInstance, after: PartInstance): boolean {
  return (
    canonicalDigest({ ...before, transform: null }) ===
    canonicalDigest({ ...after, transform: null })
  );
}

function compareConnectionEndpoints(left: ConnectionEdge, right: ConnectionEdge): number {
  return (
    left.a.partId.localeCompare(right.a.partId) ||
    left.a.portId.localeCompare(right.a.portId) ||
    left.b.partId.localeCompare(right.b.partId) ||
    left.b.portId.localeCompare(right.b.portId)
  );
}

function exactReturnConnectionIds(
  additions: readonly Extract<BuildOperation, { kind: "addConnection" }>[],
  baseConnectionIds: ReadonlySet<string>,
): readonly string[] {
  const usedIds = new Set(baseConnectionIds);
  return additions.map(({ connection }) => {
    const baseId = `rigid-return-${canonicalSha256({
      parentPartId: connection.a.partId,
      parentPortId: connection.a.portId,
      childPartId: connection.b.partId,
      childPortId: connection.b.portId,
    }).slice(0, 24)}`;
    let id = baseId;
    for (let suffix = 1; usedIds.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    usedIds.add(id);
    return id;
  });
}

export function hydrateRealBuildPrefix50Step44ReviewEnvelope(
  batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  row: RealBuildPrefix50SubBuildReturnCompactReviewCandidate,
): RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope {
  const roster = batch.rosterSummary.candidates[row.rosterIndex];
  const childIds = new Set(batch.enumerationReceipt.childPartIds);
  const basePartById = new Map(
    batch.reviewReplayBaseDocument.parts.map((part) => [part.id, part] as const),
  );
  const baseChildParts = batch.enumerationReceipt.childPartIds.map((id) => basePartById.get(id)!);
  const baseConnectionIds = new Set(batch.reviewReplayBaseDocument.connections.map(({ id }) => id));
  const { updates, additions } = operationRows(row.operations);
  if (roster === undefined || roster.candidateKey !== row.candidateKey)
    throw new TypeError(
      `Step-44 compact candidate ${row.candidateKey} is absent from its exact roster index.`,
    );
  const sourceId = `rigid-return:${canonicalSha256({
    sourceDocumentHash: batch.sourceDocumentHash,
    groupDelta: roster.groupDelta,
  })}`;
  const exactConnectionIds = exactReturnConnectionIds(additions, baseConnectionIds);
  if (
    row.operationsCommitment !== canonicalDigest(row.operations) ||
    row.commitment !==
      realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment({
        candidateKey: row.candidateKey,
        rosterIndex: row.rosterIndex,
        operations: row.operations,
        operationsCommitment: row.operationsCommitment,
        selectedDocumentRevision: row.selectedDocumentRevision,
      }) ||
    row.operations.length !== updates.length + additions.length ||
    !/^revision-[0-9a-f]{24}$/u.test(row.selectedDocumentRevision) ||
    updates.length !== childIds.size ||
    baseChildParts.length !== childIds.size ||
    additions.length < 1 ||
    additions.length > batch.enumerationReceipt.workLimits.maxCrossEdgesPerCandidate ||
    row.operations.some(
      (operation, index) =>
        (index < baseChildParts.length && operation.kind !== "updatePart") ||
        (index >= baseChildParts.length && operation.kind !== "addConnection"),
    ) ||
    new Set(row.operations.map(({ operationId }) => operationId)).size !== row.operations.length ||
    new Set(updates.map(({ before }) => before.id)).size !== childIds.size ||
    updates.some(
      ({ before, after }, index) =>
        before.id !== after.id ||
        before.id !== baseChildParts[index]?.id ||
        !childIds.has(before.id) ||
        updates[index]!.operationId !==
          `rigid-return-update-${canonicalSha256({
            sourceDocumentHash: batch.sourceDocumentHash,
            groupDelta: roster.groupDelta,
            partId: before.id,
          }).slice(0, 24)}` ||
        !samePartExceptTransform(before, after) ||
        canonicalDigest(after.transform) !==
          canonicalDigest(composeRigidTransforms(roster.groupDelta, before.transform)) ||
        canonicalDigest(before) !==
          canonicalDigest(batch.reviewReplayBaseDocument.parts.find(({ id }) => id === before.id)),
    ) ||
    new Set(additions.map(({ connection }) => connection.id)).size !== additions.length ||
    additions.some(
      ({ operationId, connection }, index) =>
        baseConnectionIds.has(connection.id) ||
        childIds.has(connection.a.partId) ||
        !childIds.has(connection.b.partId) ||
        connection.id !== exactConnectionIds[index] ||
        operationId !==
          `rigid-return-connect-${canonicalSha256({
            sourceDocumentHash: batch.sourceDocumentHash,
            groupDelta: roster.groupDelta,
            connectionId: connection.id,
          }).slice(0, 24)}` ||
        canonicalDigest(connection.provenance) !== canonicalDigest({ source: "ai", sourceId }),
    ) ||
    additions.some(
      ({ connection }, index) =>
        index > 0 && compareConnectionEndpoints(additions[index - 1]!.connection, connection) >= 0,
    )
  )
    throw new TypeError(
      `Step-44 compact candidate ${row.candidateKey} has stale, internal, incomplete, or unbound replay operations.`,
    );
  const replayed = applyBuildOperations(batch.reviewReplayBaseDocument, row.operations);
  const selectedDocument = restoreFinalRevision(replayed, row.selectedDocumentRevision);
  const selectedDocumentHash = documentStructuralHash(selectedDocument);
  const selectedDocumentCommitment = canonicalDigest(selectedDocument);
  const report = validateBrickDocument(selectedDocument);
  const derivedCrossEdges = additions.map(({ connection }) => connection);
  if (
    selectedDocumentHash !== roster.selectedDocumentHash ||
    selectedDocumentCommitment !== roster.selectedDocumentCommitment ||
    !report.documentGloballyValid ||
    report.targetDocumentHash !== selectedDocumentHash ||
    candidateKey({
      groupDelta: roster.groupDelta,
      transformedChildParts: updates.map(({ after }) => after),
      crossEdges: derivedCrossEdges,
      operations: row.operations,
      documentHash: selectedDocumentHash,
    }) !== row.candidateKey ||
    canonicalDigest(crossPorts(derivedCrossEdges)) !== canonicalDigest(roster.crossPorts)
  )
    throw new TypeError(
      `Step-44 compact candidate ${row.candidateKey} did not replay to its exact hard-valid document, descriptor, and candidate key.`,
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-harness-input/2" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    returnResultCommitment: batch.returnResultCommitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    projectionCommitment: batch.projectionCommitment,
    childSubBuildWindowCommitment: batch.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: batch.sourceMemberRowsCommitment,
    detachedStateCommitment: batch.detachedStateCommitment,
    step42_43RepairCommitment: batch.step42_43RepairCommitment,
    step43PredecessorCommitment: batch.step43PredecessorCommitment,
    sourceDocumentHash: batch.sourceDocumentHash,
    candidateKey: row.candidateKey,
    selectedDocumentHash,
    selectedDocumentCommitment,
    selectedDocument,
  };
  const envelope = deepFreeze({
    ...body,
    commitment: realBuildPrefix50SubBuildReturnReviewHarnessEnvelopeCommitment(body),
  });
  if (envelope.commitment !== roster.reviewHarnessEnvelopeCommitment)
    throw new TypeError(
      `Step-44 compact candidate ${row.candidateKey} drifted from its exact legacy review-envelope commitment.`,
    );
  return envelope;
}

function deriveReplayBase(result: RealBuildPrefix50SubBuildReturnResult) {
  const ordered = [...result.enumeration.candidates].sort((left, right) =>
    left.candidateKey.localeCompare(right.candidateKey),
  );
  const revision = realBuildPrefix50Step44SyntheticReviewReplayRevision(result.sourceDocumentHash);
  const first = ordered[0];
  const base =
    first === undefined
      ? undefined
      : restoreFinalRevision(
          applyBuildOperations(first.hardValidDocument, invertBuildOperations(first.operations)),
          revision,
        );
  if (
    base === undefined ||
    base.parts.length !== 280 ||
    base.steps.length !== 43 ||
    documentStructuralHash(base) !== result.sourceDocumentHash
  )
    throw new TypeError(
      "Step-44 compact review batch could not derive one deterministic structural replay base from every complete candidate.",
    );
  const baseCommitment = canonicalDigest(base);
  for (const candidate of ordered.slice(1)) {
    const candidateBase = restoreFinalRevision(
      applyBuildOperations(
        candidate.hardValidDocument,
        invertBuildOperations(candidate.operations),
      ),
      revision,
    );
    if (
      documentStructuralHash(candidateBase) !== result.sourceDocumentHash ||
      canonicalDigest(candidateBase) !== baseCommitment
    )
      throw new TypeError(
        "Step-44 compact review batch could not derive one deterministic structural replay base from every complete candidate.",
      );
  }
  return base;
}

export function constructRealBuildPrefix50Step44CompactReviewBatch(input: {
  readonly result: RealBuildPrefix50SubBuildReturnResult;
  readonly rosterSummary: RealBuildPrefix50SubBuildReturnReviewRosterSummary;
  readonly envelopeForCandidateKey: (
    candidateKey: string,
  ) => RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
}): RealBuildPrefix50SubBuildReturnReviewBatchEnvelope {
  const { result, rosterSummary, envelopeForCandidateKey } = input;
  const reviewReplayBaseDocument = deriveReplayBase(result);
  const enumerationBody = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-enumeration-receipt/1" as const,
    enumerationSchemaVersion: result.enumeration.schemaVersion,
    sourceDocumentHash: result.sourceDocumentHash,
    childPartIds: result.enumeration.childPartIds,
    workLimits: result.enumeration.workLimits,
    counts: result.enumeration.counts,
  };
  const enumerationReceipt = deepFreeze({
    ...enumerationBody,
    commitment: realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment(enumerationBody),
  });
  const byKey = new Map(
    result.enumeration.candidates.map((candidate) => [candidate.candidateKey, candidate]),
  );
  const rosterIndexByKey = new Map(
    rosterSummary.candidates.map(({ candidateKey, rosterIndex }) => [candidateKey, rosterIndex]),
  );
  const candidateKeys = [...byKey.keys()].sort();
  const candidates = candidateKeys.map((key) => {
    const candidate = byKey.get(key)!;
    const envelope = envelopeForCandidateKey(key);
    if (
      envelope.selectedDocumentCommitment !== canonicalDigest(candidate.hardValidDocument) ||
      envelope.commitment !==
        rosterSummary.candidates[rosterIndexByKey.get(key)!]!.reviewHarnessEnvelopeCommitment
    )
      throw new TypeError(`Step-44 compact candidate ${key} drifted before serialization.`);
    const row = {
      candidateKey: key,
      rosterIndex: rosterIndexByKey.get(key)!,
      operations: candidate.operations,
      operationsCommitment: canonicalDigest(candidate.operations),
      selectedDocumentRevision: candidate.hardValidDocument.revision,
    };
    return deepFreeze({
      ...row,
      commitment: realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment(row),
    });
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-batch-input/2" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    projectionCommitment: result.projectionCommitment,
    childSubBuildWindowCommitment: result.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: result.sourceMemberRowsCommitment,
    detachedStateCommitment: result.detachedStateCommitment,
    step42_43RepairCommitment: result.step42_43RepairCommitment,
    step43PredecessorCommitment: result.step43PredecessorCommitment,
    sourceDocumentHash: result.sourceDocumentHash,
    reviewReplayBaseRevisionPolicy: REAL_BUILD_PREFIX50_STEP44_REPLAY_BASE_REVISION_POLICY,
    reviewReplayBaseDocumentCommitment: canonicalDigest(reviewReplayBaseDocument),
    reviewReplayBaseDocument,
    enumerationReceipt,
    ordering: "candidate-key-lexicographic" as const,
    candidateCount: candidates.length,
    candidateKeysCommitment: canonicalDigest(candidateKeys),
    rosterSummary,
    candidates,
  };
  const batch = deepFreeze({
    ...body,
    commitment: realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment(body),
  });
  for (const row of candidates) hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, row);
  return batch;
}
