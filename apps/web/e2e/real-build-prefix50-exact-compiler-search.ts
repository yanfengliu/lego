import {
  applyBuildOperations,
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  preparePlacementEnumerationWorld,
  type PlacementCandidate,
  type PlacementEnumeration,
  type PreparedPlacementEnumerationWorld,
} from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForDiscoveredConnection } from "../src/assembly/placement-connection-kind";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import {
  REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50SearchState,
  type RealBuildPrefix50TargetOccurrence,
} from "./real-build-prefix50-exact-compiler-contract";
import {
  buildRealBuildPrefix50ExactEnumerationQuery,
  enumerateFor,
  requireRealBuildPrefix50CompleteEnumeration,
  sameTransform,
} from "./real-build-prefix50-exact-compiler-foundation";
import {
  prefix50TemporaryOperations,
  prefix50TemporaryPartId,
} from "./real-build-prefix50-temporary-placement";

function witnessFor(
  document: BrickDocumentV1,
  basePartIds: ReadonlySet<string>,
  occurrence: RealBuildPrefix50TargetOccurrence,
  candidate: PlacementCandidate,
  witnessIndexByTempId: ReadonlyMap<string, number>,
): RealBuildAutomaticPlacementWitness {
  return deepFreeze({
    catalogPartId: occurrence.partIdentity.reconciledCatalogPartId,
    colorId: occurrence.colorId,
    transform: candidate.transform,
    connections: candidate.connections.map((connection) => {
      const witnessIndex = witnessIndexByTempId.get(connection.targetPartId);
      if (witnessIndex === undefined && !basePartIds.has(connection.targetPartId)) {
        throw new TypeError(
          `Prefix-50 enumerator returned connection target ${connection.targetPartId} outside the exact base and earlier within-step placements.`,
        );
      }
      return {
        target:
          witnessIndex === undefined
            ? { kind: "base" as const, partId: connection.targetPartId }
            : { kind: "witness" as const, witnessIndex },
        targetPortId: connection.targetPortId,
        candidatePortId: connection.candidatePortId,
        connectionKind: protocolConnectionKindForDiscoveredConnection(
          document.parts,
          occurrence.partIdentity.reconciledCatalogPartId,
          connection,
        ),
      };
    }),
  });
}

export function searchStateMemoCommitment(
  state: RealBuildPrefix50SearchState,
  basePartIds: ReadonlySet<string>,
  allowDetachedBuildPlate: boolean,
) {
  return canonicalDigest({
    schemaVersion: "lego.real-build-prefix50-search-state/1",
    documentStructuralHash: documentStructuralHash(state.document),
    partIterationOrder: state.document.parts.map(({ id }) => id),
    connectionIterationOrder: state.document.connections.map(({ id }) => id),
    submodelIterationOrder: state.document.submodels.map(({ id }) => id),
    stepIterationOrder: state.document.steps.map(({ id }) => id),
    remaining: state.remaining,
    basePartIds: [...basePartIds].sort(),
    witnesses: state.witnesses,
    placementOrdinals: state.ordinals,
    witnessIndexByTempId: [...state.witnessIndexByTempId.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
    allowDetachedBuildPlate,
  });
}

/**
 * Commits every input to one complete placement-enumeration query except the
 * document. The owning map is allocated inside one recursive search state, so
 * crossing a document transition necessarily discards every cached result.
 */
export function stateLocalEnumerationQueryCommitment(
  occurrence: RealBuildPrefix50TargetOccurrence,
  allowDetachedBuildPlate: boolean,
) {
  return canonicalDigest(
    buildRealBuildPrefix50ExactEnumerationQuery(occurrence, allowDetachedBuildPlate),
  );
}

function stateLocalCompleteEnumerator(
  document: BrickDocumentV1,
  allowDetachedBuildPlate: boolean,
  budget: RealBuildPrefix50SearchBudget,
  prepared: PreparedPlacementEnumerationWorld,
  enumeratePlacement: typeof enumerateFor,
  reuseCompleteEnumerations: boolean,
): (occurrence: RealBuildPrefix50TargetOccurrence) => PlacementEnumeration {
  const completeEnumerations = new Map<string, PlacementEnumeration>();
  return (occurrence) => {
    if (!reuseCompleteEnumerations) {
      return enumeratePlacement(document, occurrence, allowDetachedBuildPlate, budget, prepared);
    }
    const key = stateLocalEnumerationQueryCommitment(occurrence, allowDetachedBuildPlate);
    const cached = completeEnumerations.get(key);
    if (cached !== undefined) return cached;
    const complete = requireRealBuildPrefix50CompleteEnumeration(
      enumeratePlacement(document, occurrence, allowDetachedBuildPlate, budget, prepared),
    );
    completeEnumerations.set(key, complete);
    return complete;
  };
}

function searchStepWithEnumerator(
  state: RealBuildPrefix50SearchState,
  basePartIds: ReadonlySet<string>,
  allowDetachedBuildPlate: boolean,
  budget: RealBuildPrefix50SearchBudget,
  dead: Set<string>,
  enumeratePlacement: typeof enumerateFor,
  reuseCompleteEnumerations: boolean,
): RealBuildPrefix50SearchState | null {
  budget.nodes += 1;
  if (budget.nodes > REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES) {
    throw new RangeError(
      `Prefix-50 cumulative committed-prefix dependency search exceeded ${REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES} nodes while searching the current step for an exact within-step ordering.`,
    );
  }
  if (state.remaining.length === 0) return state;
  // Equal remaining subsets are not equal search states: earlier placement
  // order can change both capacity and which coincident free port wins.
  const key = searchStateMemoCommitment(state, basePartIds, allowDetachedBuildPlate);
  if (dead.has(key)) return null;
  const prepared = preparePlacementEnumerationWorld(state.document);
  // Placement enumeration depends on the unchanged document plus the committed
  // query above, not on occurrence ordinal, colour, or target position. Keeping
  // this map state-local makes invalidation structural: every recursive child
  // owns a new map after its document has changed.
  const enumerateStateLocal = stateLocalCompleteEnumerator(
    state.document,
    allowDetachedBuildPlate,
    budget,
    prepared,
    enumeratePlacement,
    reuseCompleteEnumerations,
  );
  for (let index = 0; index < state.remaining.length; index += 1) {
    const occurrence = state.remaining[index]!;
    const enumeration = enumerateStateLocal(occurrence);
    const candidate = enumeration.candidates.find(({ transform }) =>
      sameTransform(transform, occurrence.targetTransform),
    );
    const previousAttempt = budget.targetAttempts.get(occurrence.ordinal);
    budget.targetAttempts.set(occurrence.ordinal, {
      attempts: (previousAttempt?.attempts ?? 0) + 1,
      matches: (previousAttempt?.matches ?? 0) + (candidate === undefined ? 0 : 1),
      lastCounts: enumeration.counts,
    });
    if (candidate === undefined) continue;
    const witness = witnessFor(
      state.document,
      basePartIds,
      occurrence,
      candidate,
      state.witnessIndexByTempId,
    );
    const nextIndexByTempId = new Map(state.witnessIndexByTempId);
    nextIndexByTempId.set(prefix50TemporaryPartId(occurrence.ordinal), state.witnesses.length);
    const next: RealBuildPrefix50SearchState = {
      document: applyBuildOperations(
        state.document,
        prefix50TemporaryOperations(state.document, occurrence, candidate),
      ),
      remaining: [...state.remaining.slice(0, index), ...state.remaining.slice(index + 1)],
      witnesses: [...state.witnesses, witness],
      ordinals: [...state.ordinals, occurrence.ordinal],
      witnessIndexByTempId: nextIndexByTempId,
    };
    const result = searchStepWithEnumerator(
      next,
      basePartIds,
      allowDetachedBuildPlate,
      budget,
      dead,
      enumeratePlacement,
      reuseCompleteEnumerations,
    );
    if (result !== null) return result;
  }
  dead.add(key);
  return null;
}

export function searchStep(
  state: RealBuildPrefix50SearchState,
  basePartIds: ReadonlySet<string>,
  allowDetachedBuildPlate: boolean,
  budget: RealBuildPrefix50SearchBudget,
  dead: Set<string>,
): RealBuildPrefix50SearchState | null {
  return searchStepWithEnumerator(
    state,
    basePartIds,
    allowDetachedBuildPlate,
    budget,
    dead,
    enumerateFor,
    true,
  );
}

export function searchStepForTest(
  state: RealBuildPrefix50SearchState,
  basePartIds: ReadonlySet<string>,
  allowDetachedBuildPlate: boolean,
  budget: RealBuildPrefix50SearchBudget,
  dead: Set<string>,
  enumeratePlacement: typeof enumerateFor = enumerateFor,
  reuseCompleteEnumerations = enumeratePlacement === enumerateFor,
): RealBuildPrefix50SearchState | null {
  return searchStepWithEnumerator(
    state,
    basePartIds,
    allowDetachedBuildPlate,
    budget,
    dead,
    enumeratePlacement,
    reuseCompleteEnumerations,
  );
}
