import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
  preparedSearchArrayEntry,
  preparedSearchArrayLength,
  preparedSearchData,
} from "./real-build-prepared-search-boundary";

const MAXIMUM_PREPARED_SEARCH_PROPOSAL_OPERATIONS = 1_024;
export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS = 65_536;

export interface PlannedPreparedSearchWitness {
  readonly value: unknown;
  readonly connections: readonly unknown[];
}

export interface PlannedPreparedSearchChild {
  readonly witnesses: readonly PlannedPreparedSearchWitness[];
  readonly connectionCount: number;
  readonly programOperationCount: number;
}

export interface PlannedPreparedSearchParent {
  readonly row: unknown;
  readonly children: readonly PlannedPreparedSearchChild[];
}

export interface RealBuildPreparedSearchPlan {
  readonly parentCount: number;
  readonly childCount: number;
  readonly witnessCount: number;
  readonly connectionCount: number;
  readonly programOperationCount: number;
  readonly parents: readonly PlannedPreparedSearchParent[];
}

/** Captures every untrusted descriptor/index once before identities, hashes, or replay. */
export function planRealBuildPreparedSearchStructure(
  parents: unknown,
  expectedPieceCount: number,
): RealBuildPreparedSearchPlan {
  const parentCount = preparedSearchArrayLength(
    parents,
    "Prepared search parents",
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  );
  let childCount = 0;
  let witnessCount = 0;
  let connectionCount = 0;
  let programOperationCount = 0;
  const plan: PlannedPreparedSearchParent[] = [];
  for (let parentIndex = 0; parentIndex < parentCount; parentIndex += 1) {
    const path = `Prepared search parents[${parentIndex}]`;
    const parent = preparedSearchArrayEntry(parents, parentIndex, "Prepared search parents");
    const children = preparedSearchData(parent, "children", path);
    const length = preparedSearchArrayLength(
      children,
      `${path}.children`,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN,
    );
    childCount += length;
    if (childCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN) {
      throw new RangeError(
        `Prepared search child total exceeds ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN}; no identity, witness, ledger, or document was inspected.`,
      );
    }
    const plannedChildren: PlannedPreparedSearchChild[] = [];
    for (let childIndex = 0; childIndex < length; childIndex += 1) {
      const childPath = `${path}.children[${childIndex}]`;
      const child = preparedSearchArrayEntry(children, childIndex, `${path}.children`);
      const pieces = preparedSearchData(child, "pieces", childPath);
      const pieceCount = preparedSearchArrayLength(
        pieces,
        `${childPath}.pieces`,
        MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES,
      );
      if (pieceCount !== expectedPieceCount) {
        throw new TypeError(
          `${childPath}.pieces contains ${pieceCount} witnesses; prepared step requires exactly ${expectedPieceCount}.`,
        );
      }
      witnessCount += pieceCount;
      if (witnessCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES) {
        throw new RangeError(
          `Prepared search witness total exceeds ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES}; no identity, witness, ledger, or document was inspected.`,
        );
      }
      const witnesses: PlannedPreparedSearchWitness[] = [];
      let proposalConnections = 0;
      for (let pieceIndex = 0; pieceIndex < pieceCount; pieceIndex += 1) {
        const witnessPath = `${childPath}.pieces[${pieceIndex}]`;
        const witness = preparedSearchArrayEntry(pieces, pieceIndex, `${childPath}.pieces`);
        const connections = preparedSearchData(witness, "connections", witnessPath);
        const count = preparedSearchArrayLength(
          connections,
          `${witnessPath}.connections`,
          MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
          0,
        );
        proposalConnections += count;
        if (pieceCount + proposalConnections > MAXIMUM_PREPARED_SEARCH_PROPOSAL_OPERATIONS) {
          throw new RangeError(
            `${childPath} expands to ${pieceCount + proposalConnections} place/attach operations; the automatic compiler limit is ${MAXIMUM_PREPARED_SEARCH_PROPOSAL_OPERATIONS}. No connection entry was copied.`,
          );
        }
        const plannedConnections: unknown[] = [];
        for (let connectionIndex = 0; connectionIndex < count; connectionIndex += 1) {
          plannedConnections.push(
            preparedSearchArrayEntry(connections, connectionIndex, `${witnessPath}.connections`),
          );
        }
        witnesses.push(
          Object.freeze({ value: witness, connections: Object.freeze(plannedConnections) }),
        );
      }
      const proposalOperations = pieceCount + proposalConnections;
      connectionCount += proposalConnections;
      programOperationCount += proposalOperations;
      if (programOperationCount > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS) {
        throw new RangeError(
          `Prepared search aggregate program operations exceed ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS}; no identity, canonical digest, replay, or ledger reservation occurred.`,
        );
      }
      plannedChildren.push(
        Object.freeze({
          witnesses: Object.freeze(witnesses),
          connectionCount: proposalConnections,
          programOperationCount: proposalOperations,
        }),
      );
    }
    plan.push(Object.freeze({ row: parent, children: Object.freeze(plannedChildren) }));
  }
  return Object.freeze({
    parentCount,
    childCount,
    witnessCount,
    connectionCount,
    programOperationCount,
    parents: Object.freeze(plan),
  });
}
