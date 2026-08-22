import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildAutomaticPrintedStepMetadata } from "./real-build-automatic-placement-step";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  snapshotRealBuildExactLineageIdentity,
  type RealBuildExactLineageIdentity,
} from "./real-build-exact-lineage-identity";
import { projectRealBuildEnumeratedPlacementWitnesses } from "./real-build-enumerated-placement-witness";
import {
  inspectRealBuildPreparedSearchBatch,
  type RealBuildPreparedSearchBatchInspection,
} from "./real-build-prepared-search-batch-authority";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
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
  readonly rootCandidates: readonly RealBuildAtomicCompiledBranchRootCandidate[];
  readonly searchInspection: RealBuildPreparedSearchBatchInspection;
  readonly ledger: unknown;
  readonly [atomicCompiledBatchPreparationType]: true;
}

export interface RealBuildAtomicCompiledBranchRootCandidate {
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly identities: readonly RealBuildExactLineageIdentity[];
}

const preparations = new WeakSet<object>();
const parentSnapshots = new WeakMap<
  object,
  ReadonlyMap<string, RealBuildCandidateDocumentSnapshot>
>();
const parentIdentities = new WeakMap<object, ReadonlyMap<string, RealBuildExactLineageIdentity>>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_MAP = Map;
const SAFE_SET = Set;
const SAFE_MAP_GET = Map.prototype.get;
const SAFE_MAP_HAS = Map.prototype.has;
const SAFE_MAP_SET = Map.prototype.set;
const SAFE_SET_ADD = Set.prototype.add;
const SAFE_SET_HAS = Set.prototype.has;
const SAFE_WEAK_MAP_GET = WeakMap.prototype.get;
const SAFE_WEAK_MAP_SET = WeakMap.prototype.set;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

function mapGet<K, V>(map: ReadonlyMap<K, V>, key: K): V | undefined {
  return SAFE_REFLECT_APPLY(SAFE_MAP_GET, map, [key]) as V | undefined;
}

function mapHas<K, V>(map: ReadonlyMap<K, V>, key: K): boolean {
  return SAFE_REFLECT_APPLY(SAFE_MAP_HAS, map, [key]) as boolean;
}

function mapSet<K, V>(map: Map<K, V>, key: K, value: V): void {
  SAFE_REFLECT_APPLY(SAFE_MAP_SET, map, [key, value]);
}

function setAdd<T>(set: Set<T>, value: T): void {
  SAFE_REFLECT_APPLY(SAFE_SET_ADD, set, [value]);
}

function setHas<T>(set: ReadonlySet<T>, value: T): boolean {
  return SAFE_REFLECT_APPLY(SAFE_SET_HAS, set, [value]) as boolean;
}

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

interface PlannedRootCandidate {
  readonly path: string;
  readonly documentSnapshot: unknown;
  readonly identities: unknown;
  readonly identityCount: number;
}

function planRootCandidates(value: unknown): {
  readonly roots: readonly PlannedRootCandidate[];
  readonly identityCount: number;
} {
  const rootCount = preparedSearchArrayLength(
    value,
    "Atomic compiled batch rootCandidates",
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  );
  const roots: PlannedRootCandidate[] = [];
  let identityCount = 0;
  for (let index = 0; index < rootCount; index += 1) {
    const path = `Atomic compiled batch rootCandidates[${index}]`;
    const row = preparedSearchArrayEntry(value, index, "Atomic compiled batch rootCandidates");
    const identities = preparedSearchData(row, "identities", path);
    const count = preparedSearchArrayLength(
      identities,
      `${path}.identities`,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
    );
    identityCount += count;
    if (identityCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS) {
      throw new RangeError(
        `Atomic compiled batch root lineage total exceeds ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS}; no identity, offer, or ledger entry was inspected.`,
      );
    }
    roots.push(
      intrinsicRealBuildFreeze({
        path,
        documentSnapshot: preparedSearchData(row, "documentSnapshot", path),
        identities,
        identityCount: count,
      }),
    );
  }
  return intrinsicRealBuildFreeze({ roots: intrinsicRealBuildFreeze(roots), identityCount });
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
    parentRows.push(intrinsicRealBuildFreeze({ parentLineageId, candidates: rows }));
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
      intrinsicRealBuildFreeze({
        partIds: intrinsicRealBuildFreeze(partIds),
        offeredCandidates: intrinsicRealBuildFreeze(offeredCandidates),
      }),
    );
  }
  let candidateIndex = 0;
  return intrinsicRealBuildFreeze(
    parentRows.map(({ parentLineageId, candidates }) =>
      intrinsicRealBuildFreeze({
        parentLineageId,
        candidates: intrinsicRealBuildFreeze(
          candidates.map(() => plannedCandidates[candidateIndex++]!),
        ),
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
  const plannedRoots = planRootCandidates(
    preparedSearchData(input, "rootCandidates", "Atomic compiled batch input"),
  );
  const rootCandidates: RealBuildAtomicCompiledBranchRootCandidate[] = [];
  const validatedRoots: {
    readonly plannedRoot: PlannedRootCandidate;
    readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  }[] = [];
  const orderedIdentities: RealBuildExactLineageIdentity[] = [];
  const identitiesById = new SAFE_MAP<string, RealBuildExactLineageIdentity>();
  const snapshotsByLineage = new SAFE_MAP<string, RealBuildCandidateDocumentSnapshot>();
  const snapshotsByCanonicalHash = new SAFE_MAP<string, RealBuildCandidateDocumentSnapshot>();
  let aggregateCanonicalBytes = 0;
  for (const plannedRoot of plannedRoots.roots) {
    const documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
      plannedRoot.documentSnapshot,
    );
    const priorCanonicalSnapshot = mapGet(
      snapshotsByCanonicalHash,
      documentSnapshot.canonicalBytesHash,
    );
    if (priorCanonicalSnapshot !== undefined) {
      throw new TypeError(
        `${plannedRoot.path} duplicates an exact canonical byte payload group; convergent exact lineages must share one group.`,
      );
    }
    aggregateCanonicalBytes += documentSnapshot.canonicalByteLength;
    if (aggregateCanonicalBytes > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES) {
      throw new RangeError(
        `Atomic compiled batch unique root canonical bytes exceed ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES}; no offer or ledger entry was inspected.`,
      );
    }
    mapSet(snapshotsByCanonicalHash, documentSnapshot.canonicalBytesHash, documentSnapshot);
    validatedRoots.push({ plannedRoot, documentSnapshot });
  }
  const plannedParents = planEnumeratedParents(
    preparedSearchData(input, "enumeratedParents", "Atomic compiled batch input"),
    plannedRoots.identityCount,
    preparedStep.expectedAtomicPieces.length,
  );
  for (const { plannedRoot, documentSnapshot } of validatedRoots) {
    const identities: RealBuildExactLineageIdentity[] = [];
    for (let index = 0; index < plannedRoot.identityCount; index += 1) {
      const identity = snapshotRealBuildExactLineageIdentity(
        preparedSearchArrayEntry(plannedRoot.identities, index, `${plannedRoot.path}.identities`),
      );
      if (
        identity.documentHash !== documentSnapshot.documentHash ||
        identity.canonicalBytesHash !== documentSnapshot.canonicalBytesHash ||
        identity.canonicalByteLength !== documentSnapshot.canonicalByteLength
      ) {
        throw new TypeError(
          `${plannedRoot.path}.identities[${index}] does not bind this exact canonical document snapshot.`,
        );
      }
      if (identity.throughStepNumber + 1 !== preparedStep.stepNumber) {
        throw new RangeError(
          `Atomic compiled batch root lineage ${identity.lineageId} ends at step ${identity.throughStepNumber}; prepared step ${preparedStep.stepNumber} requires ${preparedStep.stepNumber - 1}.`,
        );
      }
      if (mapHas(identitiesById, identity.lineageId)) {
        throw new TypeError(`Atomic compiled batch repeats root lineage ${identity.lineageId}.`);
      }
      mapSet(identitiesById, identity.lineageId, identity);
      mapSet(snapshotsByLineage, identity.lineageId, documentSnapshot);
      identities.push(identity);
      orderedIdentities.push(identity);
    }
    rootCandidates.push(
      intrinsicRealBuildFreeze({
        documentSnapshot,
        identities: intrinsicRealBuildFreeze(identities),
      }),
    );
  }

  const seenParents = new SAFE_SET<string>();
  const projectedParents = plannedParents.map((parent, parentIndex) => {
    const expectedIdentity = orderedIdentities[parentIndex]!;
    const identity = mapGet(identitiesById, parent.parentLineageId);
    if (identity === undefined) {
      throw new TypeError(
        `Atomic compiled batch enumeratedParents[${parentIndex}] does not name a retained root lineage.`,
      );
    }
    if (identity.lineageId !== expectedIdentity.lineageId) {
      throw new TypeError(
        `Atomic compiled batch enumeratedParents[${parentIndex}] must name root lineage ${expectedIdentity.lineageId} in retained frontier order.`,
      );
    }
    if (setHas(seenParents, parent.parentLineageId)) {
      throw new TypeError(
        `Atomic compiled batch enumeratedParents repeats ${parent.parentLineageId}.`,
      );
    }
    setAdd(seenParents, parent.parentLineageId);
    const documentSnapshot = mapGet(snapshotsByLineage, parent.parentLineageId)!;
    return intrinsicRealBuildFreeze({
      identity,
      documentSnapshot,
      children: intrinsicRealBuildFreeze(
        parent.candidates.map((candidate) =>
          intrinsicRealBuildFreeze({
            pieces: projectRealBuildEnumeratedPlacementWitnesses({
              documentSnapshot,
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
  const preparation = intrinsicRealBuildFreeze({
    preparedStep,
    printedStep: preparedStep.compilerMetadata,
    rootCandidates: intrinsicRealBuildFreeze(rootCandidates),
    searchInspection,
    ledger: preparedSearchData(input, "ledger", "Atomic compiled batch input"),
  }) as RealBuildAtomicCompiledBranchBatchPreparation;
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, preparations, [preparation]);
  SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, parentSnapshots, [preparation, snapshotsByLineage]);
  SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_SET, parentIdentities, [preparation, identitiesById]);
  return preparation;
}

export function requireRealBuildAtomicCompiledBranchBatchPreparation(
  value: unknown,
): RealBuildAtomicCompiledBranchBatchPreparation {
  if (
    value === null ||
    typeof value !== "object" ||
    !(SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, preparations, [value]) as boolean)
  ) {
    throw new TypeError(
      "Atomic compiled branch batch requires its exact module-created inspection preparation.",
    );
  }
  return value as RealBuildAtomicCompiledBranchBatchPreparation;
}

/** Resolves an exact branded parent snapshot without exposing the retained map. */
export function requireRealBuildAtomicCompiledBranchParentSnapshot(
  preparationValue: unknown,
  parentLineageId: string,
): RealBuildCandidateDocumentSnapshot {
  const preparation = requireRealBuildAtomicCompiledBranchBatchPreparation(preparationValue);
  if (typeof parentLineageId !== "string") {
    throw new TypeError(
      "Atomic compiled branch parent must name one exact retained root lineage ID.",
    );
  }
  const retained = SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, parentSnapshots, [preparation]) as
    ReadonlyMap<string, RealBuildCandidateDocumentSnapshot> | undefined;
  const snapshot = retained === undefined ? undefined : mapGet(retained, parentLineageId);
  if (snapshot === undefined) {
    throw new TypeError(
      "Atomic compiled branch parent does not name one exact retained root lineage.",
    );
  }
  return snapshot;
}

/** Resolves the exact canonical lineage commitment paired with one root. */
export function requireRealBuildAtomicCompiledBranchParentIdentity(
  preparationValue: unknown,
  parentLineageId: string,
): RealBuildExactLineageIdentity {
  const preparation = requireRealBuildAtomicCompiledBranchBatchPreparation(preparationValue);
  const retained = SAFE_REFLECT_APPLY(SAFE_WEAK_MAP_GET, parentIdentities, [preparation]) as
    ReadonlyMap<string, RealBuildExactLineageIdentity> | undefined;
  const identity = retained === undefined ? undefined : mapGet(retained, parentLineageId);
  if (identity === undefined) {
    throw new TypeError(
      "Atomic compiled branch parent does not name one exact retained lineage identity.",
    );
  }
  return identity;
}
