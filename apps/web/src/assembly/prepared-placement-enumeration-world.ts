import type { ConnectorKind } from "@lego-studio/catalog";
import {
  COLLISION_WORLD_WORK_KEYS,
  createCollisionWorld,
  deepFreeze,
  type CollisionWorld,
  type CollisionWorldWork,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { occupiedConnectorCapacityClaims } from "../connector-capacity";
import {
  createPlacementFreePortIndex,
  type PlacementFreePortIndex,
} from "./connector-placement-enumeration";
import type { MutablePlacementEnumerationWork } from "./enumerate-placement-work";

/** A collision and connector index bound to one exact document reference. */
export interface PreparedPlacementEnumerationWorld {
  readonly document: BrickDocumentV1;
}

interface PreparedCollisionIndex {
  readonly instrumented: boolean;
  readonly world: CollisionWorld;
  run<T>(work: MutablePlacementEnumerationWork, callback: (world: CollisionWorld) => T): T;
}

export interface PreparedPlacementEnumerationState {
  readonly document: BrickDocumentV1;
  readonly occupiedCapacityClaims: ReadonlySet<string>;
  readonly collisionIndex: PreparedCollisionIndex;
  readonly freePortIndexes: Map<ConnectorKind, PlacementFreePortIndex>;
}

const preparedStates = new WeakMap<
  PreparedPlacementEnumerationWorld,
  PreparedPlacementEnumerationState
>();

function addCollisionWork(
  work: MutablePlacementEnumerationWork,
  delta: Readonly<CollisionWorldWork>,
): void {
  for (const key of COLLISION_WORLD_WORK_KEYS) work[key] += delta[key];
}

function createPreparedCollisionIndex(
  parts: readonly PartInstance[],
  initialWork?: MutablePlacementEnumerationWork,
): PreparedCollisionIndex {
  let activeWork = initialWork;
  const instrumented = initialWork !== undefined;
  const world = Object.freeze(
    createCollisionWorld(
      parts,
      instrumented
        ? (delta) => {
            if (activeWork !== undefined) addCollisionWork(activeWork, delta);
          }
        : undefined,
    ),
  );
  return {
    instrumented,
    world,
    run<T>(work: MutablePlacementEnumerationWork, callback: (value: CollisionWorld) => T): T {
      const previousWork = activeWork;
      activeWork = work;
      try {
        return callback(world);
      } finally {
        activeWork = previousWork;
      }
    },
  };
}

export function createPreparedPlacementEnumerationWorld(
  document: BrickDocumentV1,
  initialWork?: MutablePlacementEnumerationWork,
): PreparedPlacementEnumerationWorld {
  const snapshot = deepFreeze(structuredClone(document));
  const occupiedCapacityClaims = occupiedConnectorCapacityClaims(
    snapshot.parts,
    snapshot.connections,
  );
  const prepared = Object.freeze({ document: snapshot });
  preparedStates.set(prepared, {
    document: snapshot,
    occupiedCapacityClaims,
    collisionIndex: createPreparedCollisionIndex(snapshot.parts, initialWork),
    freePortIndexes: new Map(),
  });
  return prepared;
}

export function requirePreparedPlacementEnumerationState(
  prepared: PreparedPlacementEnumerationWorld,
): PreparedPlacementEnumerationState {
  const state = preparedStates.get(prepared);
  if (state === undefined || state.document !== prepared.document) {
    throw new TypeError(
      "Placement enumeration requires a world minted for the exact document being enumerated.",
    );
  }
  return state;
}

export function preparedCollisionWorld(
  state: PreparedPlacementEnumerationState,
  work?: MutablePlacementEnumerationWork,
): CollisionWorld {
  if (work === undefined) return state.collisionIndex.world;
  if (!state.collisionIndex.instrumented) {
    throw new TypeError("Observed placement enumeration requires a freshly instrumented world.");
  }
  const index = state.collisionIndex;
  return Object.freeze({
    primitiveCount: index.world.primitiveCount,
    findCollisionsWith(candidate: PartInstance, candidateConnections: readonly ConnectionEdge[]) {
      return index.run(work, (world) => world.findCollisionsWith(candidate, candidateConnections));
    },
  });
}

export function preparedFreePortIndex(
  state: PreparedPlacementEnumerationState,
  kind: ConnectorKind,
  work?: MutablePlacementEnumerationWork,
): PlacementFreePortIndex {
  const existing = state.freePortIndexes.get(kind);
  if (existing !== undefined) return existing;
  const created = createPlacementFreePortIndex(
    state.document.parts,
    state.occupiedCapacityClaims,
    kind,
    work,
  );
  state.freePortIndexes.set(kind, created);
  return created;
}
