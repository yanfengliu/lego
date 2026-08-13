import type { RealBuildAutomaticPrintedStepMetadata } from "./real-build-automatic-placement-step";
import {
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  requireRealBuildCandidateDocumentSnapshot,
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import { projectRealBuildEnumeratedPlacementWitnesses } from "./real-build-enumerated-placement-witness";
import {
  inspectRealBuildPreparedSearchBatch,
  type RealBuildPreparedSearchBatchInspection,
} from "./real-build-prepared-search-batch-authority";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
  preparedSearchArrayEntry,
  preparedSearchArrayLength,
  preparedSearchData,
} from "./real-build-prepared-search-boundary";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "./real-build-prepared-search-plan";
import {
  requireRealBuildPreparedStepInspection,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";

declare const atomicCompiledBatchPreparationType: unique symbol;

export interface RealBuildAtomicCompiledBranchBatchPreparation {
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly printedStep: Readonly<RealBuildAutomaticPrintedStepMetadata>;
  readonly rootDocumentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly rootIdentities: readonly RealBuildLineageIdentity[];
  readonly searchInspection: RealBuildPreparedSearchBatchInspection;
  readonly ledger: unknown;
  readonly [atomicCompiledBatchPreparationType]: true;
}

const preparations = new WeakSet<object>();

interface PlannedEnumeratedParent {
  readonly parentLineageId: string;
  readonly candidates: readonly {
    readonly partIds: readonly unknown[];
    readonly offeredCandidates: readonly unknown[];
  }[];
}

interface UnexpandedEnumeratedCandidate {
  readonly path: string;
  readonly partIds: unknown;
  readonly offeredCandidates: unknown;
  readonly pieceCount: number;
}

function planEnumeratedParents(
  value: unknown,
  expectedParentCount: number,
  expectedPieceCount: number,
): readonly PlannedEnumeratedParent[] {
  const count = preparedSearchArrayLength(
    value,
    "Atomic compiled batch enumeratedParents",
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  );
  if (count !== expectedParentCount) {
    throw new TypeError(
      `Atomic compiled batch enumeratedParents contains ${count} rows; every one of the ${expectedParentCount} root lineages requires exactly one row.`,
    );
  }
  const parentRows: { readonly parentLineageId: string; readonly candidates: unknown[] }[] = [];
  const unexpanded: UnexpandedEnumeratedCandidate[] = [];
  let candidateCount = 0;
  let witnessCount = 0;
  for (let index = 0; index < count; index += 1) {
    const path = `Atomic compiled batch enumeratedParents[${index}]`;
    const row = preparedSearchArrayEntry(value, index, "Atomic compiled batch enumeratedParents");
    const parentLineageId = preparedSearchData(row, "parentLineageId", path);
    if (typeof parentLineageId !== "string") {
      throw new TypeError(`${path}.parentLineageId must be an exact retained lineage ID.`);
    }
    const candidates = preparedSearchData(row, "candidates", path);
    const length = preparedSearchArrayLength(
      candidates,
      `${path}.candidates`,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
    );
    candidateCount += length;
    if (candidateCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN) {
      throw new RangeError(
        `Atomic compiled batch enumerated candidate total exceeds ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN}; no offer was projected or budget reserved.`,
      );
    }
    const rows: unknown[] = [];
    for (let childIndex = 0; childIndex < length; childIndex += 1) {
      const candidatePath = `${path}.candidates[${childIndex}]`;
      const candidate = preparedSearchArrayEntry(candidates, childIndex, `${path}.candidates`);
      const partIds = preparedSearchData(candidate, "partIds", candidatePath);
      const offeredCandidates = preparedSearchData(candidate, "offeredCandidates", candidatePath);
      const partIdCount = preparedSearchArrayLength(
        partIds,
        `${candidatePath}.partIds`,
        expectedPieceCount,
        expectedPieceCount,
      );
      const offerCount = preparedSearchArrayLength(
        offeredCandidates,
        `${candidatePath}.offeredCandidates`,
        expectedPieceCount,
        expectedPieceCount,
      );
      if (partIdCount !== expectedPieceCount || offerCount !== expectedPieceCount) {
        throw new TypeError(
          `${candidatePath} must carry exactly ${expectedPieceCount} part IDs and detached offers.`,
        );
      }
      witnessCount += expectedPieceCount;
      if (witnessCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES) {
        throw new RangeError(
          `Atomic compiled batch witness total exceeds ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES}; no offer entry was inspected, projected, or reserved.`,
        );
      }
      rows.push(candidate);
      unexpanded.push({ path: candidatePath, partIds, offeredCandidates, pieceCount: offerCount });
    }
    parentRows.push(Object.freeze({ parentLineageId, candidates: rows }));
  }

  let operationCount = 0;
  const plannedCandidates: PlannedEnumeratedParent["candidates"][number][] = [];
  for (const candidate of unexpanded) {
    const partIds: unknown[] = [];
    const offeredCandidates: unknown[] = [];
    let connectionCount = 0;
    for (let index = 0; index < candidate.pieceCount; index += 1) {
      partIds.push(preparedSearchArrayEntry(candidate.partIds, index, `${candidate.path}.partIds`));
      const offer = preparedSearchArrayEntry(
        candidate.offeredCandidates,
        index,
        `${candidate.path}.offeredCandidates`,
      );
      const connections = preparedSearchData(
        offer,
        "connections",
        `${candidate.path}.offeredCandidates[${index}]`,
      );
      connectionCount += preparedSearchArrayLength(
        connections,
        `${candidate.path}.offeredCandidates[${index}].connections`,
        MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
        0,
      );
      offeredCandidates.push(offer);
    }
    operationCount += candidate.pieceCount + connectionCount;
    if (operationCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS) {
      throw new RangeError(
        `Atomic compiled batch aggregate placement operations exceed ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS}; no offer was projected or budget reserved.`,
      );
    }
    plannedCandidates.push(
      Object.freeze({
        partIds: Object.freeze(partIds),
        offeredCandidates: Object.freeze(offeredCandidates),
      }),
    );
  }
  let candidateIndex = 0;
  return Object.freeze(
    parentRows.map(({ parentLineageId, candidates }) =>
      Object.freeze({
        parentLineageId,
        candidates: Object.freeze(candidates.map(() => plannedCandidates[candidateIndex++]!)),
      }),
    ),
  );
}

/**
 * Projects and validates every enumerated offer before the shared ledger can be
 * touched. The returned brand is inspection-only and grants no compiler or
 * selection authority.
 */
export function prepareRealBuildAtomicCompiledBranchBatch(
  input: unknown,
): RealBuildAtomicCompiledBranchBatchPreparation {
  const preparedStep = requireRealBuildPreparedStepInspection(
    preparedSearchData(input, "preparedStep", "Atomic compiled batch input"),
  );
  const rootCandidate = preparedSearchData(input, "rootCandidate", "Atomic compiled batch input");
  const rootDocumentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    preparedSearchData(rootCandidate, "documentSnapshot", "Atomic compiled batch rootCandidate"),
  );
  const identityRows = preparedSearchData(
    rootCandidate,
    "identities",
    "Atomic compiled batch rootCandidate",
  );
  const identityCount = preparedSearchArrayLength(
    identityRows,
    "Atomic compiled batch rootCandidate.identities",
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  );
  const plannedParents = planEnumeratedParents(
    preparedSearchData(input, "enumeratedParents", "Atomic compiled batch input"),
    identityCount,
    preparedStep.expectedAtomicPieces.length,
  );
  const rootIdentities: RealBuildLineageIdentity[] = [];
  const identitiesById = new Map<string, RealBuildLineageIdentity>();
  for (let index = 0; index < identityCount; index += 1) {
    const identity = snapshotRealBuildLineageIdentity(
      preparedSearchArrayEntry(
        identityRows,
        index,
        "Atomic compiled batch rootCandidate.identities",
      ),
    );
    requireRealBuildCandidateDocumentSnapshot(rootDocumentSnapshot, identity);
    if (identity.throughStepNumber + 1 !== preparedStep.stepNumber) {
      throw new RangeError(
        `Atomic compiled batch root lineage ${identity.lineageId} ends at step ${identity.throughStepNumber}; prepared step ${preparedStep.stepNumber} requires ${preparedStep.stepNumber - 1}.`,
      );
    }
    if (identitiesById.has(identity.lineageId)) {
      throw new TypeError(`Atomic compiled batch repeats root lineage ${identity.lineageId}.`);
    }
    identitiesById.set(identity.lineageId, identity);
    rootIdentities.push(identity);
  }

  const seenParents = new Set<string>();
  const projectedParents = plannedParents.map((parent, parentIndex) => {
    const identity = identitiesById.get(parent.parentLineageId);
    if (identity === undefined) {
      throw new TypeError(
        `Atomic compiled batch enumeratedParents[${parentIndex}] does not name a retained root lineage.`,
      );
    }
    if (seenParents.has(parent.parentLineageId)) {
      throw new TypeError(
        `Atomic compiled batch enumeratedParents repeats ${parent.parentLineageId}.`,
      );
    }
    seenParents.add(parent.parentLineageId);
    return Object.freeze({
      identity,
      documentSnapshot: rootDocumentSnapshot,
      children: Object.freeze(
        parent.candidates.map((candidate) =>
          Object.freeze({
            pieces: projectRealBuildEnumeratedPlacementWitnesses({
              documentSnapshot: rootDocumentSnapshot,
              pieces: preparedStep.expectedAtomicPieces,
              candidate,
            }),
          }),
        ),
      ),
    });
  });
  if (seenParents.size !== identitiesById.size) {
    throw new TypeError("Atomic compiled batch did not provide candidates for every root lineage.");
  }
  const searchInspection = inspectRealBuildPreparedSearchBatch({
    preparedStep,
    parents: projectedParents,
  });
  const preparation = Object.freeze({
    preparedStep,
    printedStep: preparedStep.compilerMetadata,
    rootDocumentSnapshot,
    rootIdentities: Object.freeze(rootIdentities),
    searchInspection,
    ledger: preparedSearchData(input, "ledger", "Atomic compiled batch input"),
  }) as RealBuildAtomicCompiledBranchBatchPreparation;
  preparations.add(preparation);
  return preparation;
}

export function requireRealBuildAtomicCompiledBranchBatchPreparation(
  value: unknown,
): RealBuildAtomicCompiledBranchBatchPreparation {
  if (value === null || typeof value !== "object" || !preparations.has(value)) {
    throw new TypeError(
      "Atomic compiled branch batch requires its exact module-created inspection preparation.",
    );
  }
  return value as RealBuildAtomicCompiledBranchBatchPreparation;
}
