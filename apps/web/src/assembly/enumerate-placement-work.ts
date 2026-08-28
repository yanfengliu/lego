import { COLLISION_WORLD_WORK_KEYS, type CollisionWorldWork } from "@lego-studio/brick-kernel";

export interface PlacementEnumerationWork extends CollisionWorldWork {
  readonly occupiedCapacitySeedEdges: number;
  readonly occupiedCapacityClaims: number;
  readonly freePortPartsVisited: number;
  readonly freePortConnectorVisits: number;
  readonly freePortCapacityChecks: number;
  readonly seedAxisChecks: number;
  readonly originProposals: number;
  readonly candidateTransformsVisited: number;
  readonly connectorPortLookups: number;
  readonly connectorDiscoveries: number;
  readonly candidateSortComparisons: number;
}

export type PlacementEnumerationWorkObserver = (work: Readonly<PlacementEnumerationWork>) => void;

export type MutablePlacementEnumerationWork = {
  -readonly [Key in keyof PlacementEnumerationWork]: number;
};

/** A fresh accumulator for one enumeration; callers never share mutable work. */
export function emptyPlacementEnumerationWork(): MutablePlacementEnumerationWork {
  const collision = {} as {
    -readonly [Key in keyof CollisionWorldWork]: number;
  };
  for (const key of COLLISION_WORLD_WORK_KEYS) collision[key] = 0;
  return {
    ...collision,
    occupiedCapacitySeedEdges: 0,
    occupiedCapacityClaims: 0,
    freePortPartsVisited: 0,
    freePortConnectorVisits: 0,
    freePortCapacityChecks: 0,
    seedAxisChecks: 0,
    originProposals: 0,
    candidateTransformsVisited: 0,
    connectorPortLookups: 0,
    connectorDiscoveries: 0,
    candidateSortComparisons: 0,
  };
}
