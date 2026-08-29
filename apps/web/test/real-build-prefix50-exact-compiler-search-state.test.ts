import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import { __testOnly as exactCompilerTestOnly } from "../e2e/real-build-prefix50-exact-compiler";
import type { RealBuildPrefix50TargetOccurrence } from "../e2e/real-build-prefix50-exact-compiler-contract";
import {
  diagnosePlacementTransform,
  enumeratePlacements,
  PLACEMENT_ENUMERATION_VERSION,
  type PlacementCandidate,
  type PlacementEnumeration,
} from "../src/assembly/enumerate-placements";

function emptyDocument(): BrickDocumentV1 {
  return createEmptyBrickDocument({
    id: "prefix50-search-synthetic",
    name: "Prefix 50 search synthetic",
  });
}

function target(
  ordinal: number,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  printedStepNumber = 1,
): RealBuildPrefix50TargetOccurrence {
  const transform: RigidTransform = {
    positionLdu,
    orientationId: "upright-yaw-0",
  };
  return {
    ordinal,
    printedStepNumber,
    colorId: "builtin:red",
    partIdentity: {
      publishedCatalogPartId: catalogPartId,
      reconciledCatalogPartId: catalogPartId,
      officialDesignId: `synthetic-${ordinal}`,
      officialDesignRevision: `synthetic-${ordinal}:1`,
      sourceLDrawPartId: `synthetic-${ordinal}`,
      catalogLDrawPartId: `synthetic-${ordinal}`,
      identityProofId: null,
      basis: "published-exact",
    },
    sourceWorldTransform: transform,
    targetTransform: transform,
  };
}

function budget() {
  return {
    nodes: 0,
    enumerations: 0,
    orientationNarrowedEnumerations: 0,
    targetAttempts: new Map(),
  };
}

function syntheticEnumeration(
  occurrence: RealBuildPrefix50TargetOccurrence,
  connections: PlacementCandidate["connections"] | null,
): PlacementEnumeration {
  const available = connections !== null;
  return {
    schemaVersion: PLACEMENT_ENUMERATION_VERSION,
    catalogPartId: occurrence.partIdentity.reconciledCatalogPartId,
    orientationIds: [occurrence.targetTransform.orientationId],
    connectorSeedReceipt: [],
    candidates: available
      ? [
          {
            catalogPartId: occurrence.partIdentity.reconciledCatalogPartId,
            transform: occurrence.targetTransform,
            connections,
            restsOnBuildPlate: connections.length === 0,
          },
        ]
      : [],
    counts: {
      freeStuds: 0,
      freeClutches: 0,
      rawFromStuds: 0,
      rawFromClutches: 0,
      rawFromBuildPlate: available && connections.length === 0 ? 1 : 0,
      distinctTransforms: available ? 1 : 0,
      rejectedUnsupported: 0,
      rejectedDetached: 0,
      rejectedBelowBuildPlate: 0,
      rejectedColliding: 0,
      accepted: available ? 1 : 0,
    },
  };
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((coordinate, index) => coordinate === right.positionLdu[index])
  );
}

type TestEnumerator = NonNullable<Parameters<typeof exactCompilerTestOnly.searchStep>[5]>;

interface TileCapacityTerminalState {
  readonly documentHash: string;
  readonly occupiedTilePort: string;
  readonly targetMatched: boolean;
}

function tileCapacityEnumerator(terminalStates: TileCapacityTerminalState[] = []): TestEnumerator {
  return (document, occurrence, _allowDetachedBuildPlate, currentBudget) => {
    if (!("targetTransform" in occurrence)) {
      throw new TypeError("Synthetic step search requires an exact target occurrence.");
    }
    currentBudget.enumerations += 1;
    currentBudget.orientationNarrowedEnumerations += 1;
    const tile = document.parts.find(
      ({ catalogPartId }) => catalogPartId === "builtin:tile-1x2-chamfered-indented",
    );
    const plate = document.parts.find(({ catalogPartId }) => catalogPartId === "builtin:plate-1x1");
    if (occurrence.ordinal === 1) {
      return syntheticEnumeration(
        occurrence,
        plate !== undefined
          ? [
              {
                targetPartId: plate.id,
                targetPortId: "stud:0:0",
                candidatePortId: "undersideClutch:0",
              },
            ]
          : [],
      );
    }
    if (occurrence.ordinal === 2) {
      return syntheticEnumeration(
        occurrence,
        tile !== undefined
          ? [
              {
                targetPartId: tile.id,
                targetPortId: "undersideClutch:1",
                candidatePortId: "stud:0:0",
              },
            ]
          : [],
      );
    }
    if (occurrence.ordinal !== 3 || tile === undefined || plate === undefined) {
      return syntheticEnumeration(occurrence, null);
    }
    const enumeration = enumeratePlacements(
      document,
      occurrence.partIdentity.reconciledCatalogPartId,
      {
        orientationIds: [occurrence.targetTransform.orientationId],
        includeBuildPlate: false,
        allowDetached: false,
      },
    );
    const tileConnection = document.connections.find(({ a, b }) =>
      [a.partId, b.partId].includes(tile.id),
    )!;
    const tileEndpoint = tileConnection.a.partId === tile.id ? tileConnection.a : tileConnection.b;
    terminalStates.push({
      documentHash: documentStructuralHash(document),
      occupiedTilePort: tileEndpoint.portId,
      targetMatched: enumeration.candidates.some(({ transform }) =>
        sameTransform(transform, occurrence.targetTransform),
      ),
    });
    return enumeration;
  };
}

describe("exact prefix-50 search-state memoization", () => {
  it("prepares each recursive child document instead of leaking the parent enumeration world", () => {
    const first = target(1, "builtin:brick-1x1", [0, 0, 0]);
    const second = target(2, "builtin:brick-1x1", [0, -24, 0]);
    const searchBudget = budget();
    const result = exactCompilerTestOnly.searchStep(
      {
        document: emptyDocument(),
        remaining: [second, first],
        witnesses: [],
        ordinals: [],
        witnessIndexByTempId: new Map(),
      },
      new Set(),
      true,
      searchBudget,
      new Set(),
    );

    expect(result).not.toBeNull();
    expect(result?.ordinals).toEqual([1, 2]);
    expect(result?.document.parts.map(({ transform }) => transform.positionLdu)).toEqual([
      [0, 0, 0],
      [0, -24, 0],
    ]);
    expect(result?.document.connections).toHaveLength(1);
    expect(result?.witnesses[1]?.connections).toEqual([
      expect.objectContaining({ target: { kind: "witness", witnessIndex: 0 } }),
    ]);
    expect(searchBudget).toMatchObject({ enumerations: 3, nodes: 3 });
  });

  it("does not let a dead A-to-B capacity state prune the completable B-to-A state", () => {
    const a = target(1, "builtin:tile-1x2-chamfered-indented", [0, 0, 0]);
    const b = target(2, "builtin:plate-1x1", [0, 8, -10]);
    const c = target(3, "builtin:plate-1x1", [0, 8, 10]);
    const searchBudget = budget();
    const terminalStates: TileCapacityTerminalState[] = [];

    const result = exactCompilerTestOnly.searchStep(
      {
        document: emptyDocument(),
        remaining: [a, b, c],
        witnesses: [],
        ordinals: [],
        witnessIndexByTempId: new Map(),
      },
      new Set(),
      false,
      searchBudget,
      new Set(),
      tileCapacityEnumerator(terminalStates),
    );

    expect(terminalStates).toEqual([
      {
        documentHash: expect.stringMatching(/^sha256:/u),
        occupiedTilePort: "undersideClutch:1",
        targetMatched: false,
      },
      {
        documentHash: expect.stringMatching(/^sha256:/u),
        occupiedTilePort: "undersideClutch:0",
        targetMatched: true,
      },
    ]);
    expect(terminalStates[0]!.documentHash).not.toBe(terminalStates[1]!.documentHash);
    expect(result?.ordinals).toEqual([2, 1, 3]);
  });

  it("models the abstract cross-step false-negative class in the isolated search helper", () => {
    // This custom enumerator intentionally isolates the search algorithm from
    // production compiler and graph-validity checks. It proves why an early
    // locally complete return is not a global infeasibility witness; it does
    // not claim that this synthetic tile topology is a valid compiled model.
    const a = target(1, "builtin:tile-1x2-chamfered-indented", [0, 0, 0]);
    const b = target(2, "builtin:plate-1x1", [0, 8, -10]);
    const later = target(3, "builtin:plate-1x1", [0, 8, 10], 2);
    const enumerator = tileCapacityEnumerator();
    const firstLocalBudget = budget();
    const firstLocal = exactCompilerTestOnly.searchStep(
      {
        document: emptyDocument(),
        remaining: [a, b],
        witnesses: [],
        ordinals: [],
        witnessIndexByTempId: new Map(),
      },
      new Set(),
      true,
      firstLocalBudget,
      new Set(),
      enumerator,
    );
    expect(firstLocal?.ordinals).toEqual([1, 2]);

    const searchLaterFrom = (
      committed: NonNullable<typeof firstLocal>,
      cumulativeBudget: ReturnType<typeof budget>,
    ) =>
      exactCompilerTestOnly.searchStep(
        {
          document: committed.document,
          remaining: [later],
          witnesses: [],
          ordinals: [],
          witnessIndexByTempId: new Map(),
        },
        new Set(committed.document.parts.map(({ id }) => id)),
        false,
        cumulativeBudget,
        new Set(),
        enumerator,
      );

    expect(searchLaterFrom(firstLocal!, firstLocalBudget)).toBeNull();
    expect(firstLocalBudget.nodes).toBe(4);

    const alternateBudget = budget();
    const alternateLocal = exactCompilerTestOnly.searchStep(
      {
        document: emptyDocument(),
        remaining: [b, a],
        witnesses: [],
        ordinals: [],
        witnessIndexByTempId: new Map(),
      },
      new Set(),
      true,
      alternateBudget,
      new Set(),
      enumerator,
    );
    expect(alternateLocal?.ordinals).toEqual([2, 1]);
    expect(searchLaterFrom(alternateLocal!, alternateBudget)).not.toBeNull();
    expect(alternateBudget.nodes).toBe(5);
  });

  it("commits raw part order when canonical structure hides coincident-port selection", () => {
    const orderedDocument = (partIds: readonly string[]) => {
      const document = applyBuildOperations(
        emptyDocument(),
        partIds.map((partId) => ({
          kind: "addPart" as const,
          operationId: `add-${partId}`,
          part: {
            id: partId,
            catalogPartId: "builtin:brick-1x1",
            colorId: "builtin:red",
            transform: {
              positionLdu: [0, 0, 0] as const,
              orientationId: "upright-yaw-0" as const,
            },
            submodelId: "root",
            stepId: "step-1",
            semanticTags: [],
            provenance: { source: "manual" as const },
          },
          semanticRegionIds: [],
        })),
      );
      return {
        ...document,
        parts: partIds.map((partId) => document.parts.find(({ id }) => id === partId)!),
      };
    };
    const aThenB = orderedDocument(["prefix50-temp-1", "prefix50-temp-2"]);
    const bThenA = orderedDocument(["prefix50-temp-2", "prefix50-temp-1"]);
    const targetTransform = {
      positionLdu: [0, -24, 0] as const,
      orientationId: "upright-yaw-0" as const,
    };
    const remaining = [target(3, "builtin:brick-1x1", [0, -24, 0])];
    const stateFor = (
      document: BrickDocumentV1,
      witnessIndexByTempId: ReadonlyMap<string, number> = new Map([
        ["prefix50-temp-1", 0],
        ["prefix50-temp-2", 1],
      ]),
    ) => ({
      document,
      remaining,
      witnesses: [],
      ordinals: [1, 2],
      witnessIndexByTempId,
    });

    expect(documentStructuralHash(aThenB)).toBe(documentStructuralHash(bThenA));
    expect(
      diagnosePlacementTransform(aThenB, "builtin:brick-1x1", targetTransform).connections.map(
        ({ targetPartId }) => targetPartId,
      ),
    ).toEqual(["prefix50-temp-1"]);
    expect(
      diagnosePlacementTransform(bThenA, "builtin:brick-1x1", targetTransform).connections.map(
        ({ targetPartId }) => targetPartId,
      ),
    ).toEqual(["prefix50-temp-2"]);

    const aThenBCommitment = exactCompilerTestOnly.searchStateMemoCommitment(
      stateFor(aThenB),
      new Set(),
      false,
    );
    expect(
      exactCompilerTestOnly.searchStateMemoCommitment(stateFor(bThenA), new Set(), false),
    ).not.toBe(aThenBCommitment);
    expect(
      exactCompilerTestOnly.searchStateMemoCommitment(
        stateFor(
          aThenB,
          new Map([
            ["prefix50-temp-2", 1],
            ["prefix50-temp-1", 0],
          ]),
        ),
        new Set(),
        false,
      ),
    ).toBe(aThenBCommitment);
    expect(
      exactCompilerTestOnly.searchStateMemoCommitment(
        stateFor(
          aThenB,
          new Map([
            ["prefix50-temp-1", 1],
            ["prefix50-temp-2", 0],
          ]),
        ),
        new Set(),
        false,
      ),
    ).not.toBe(aThenBCommitment);

    const connections = [
      {
        id: "edge-a",
        kind: "stud-tube" as const,
        a: { partId: "prefix50-temp-1", portId: "stud:0:0" },
        b: { partId: "prefix50-temp-2", portId: "undersideClutch:0:0" },
        provenance: { source: "manual" as const },
      },
      {
        id: "edge-b",
        kind: "stud-tube" as const,
        a: { partId: "prefix50-temp-2", portId: "stud:0:0" },
        b: { partId: "prefix50-temp-1", portId: "undersideClutch:0:0" },
        provenance: { source: "manual" as const },
      },
    ];
    const forwardConnections = { ...aThenB, connections };
    const reverseConnections = { ...aThenB, connections: [...connections].reverse() };
    expect(documentStructuralHash(forwardConnections)).toBe(
      documentStructuralHash(reverseConnections),
    );
    expect(
      exactCompilerTestOnly.searchStateMemoCommitment(
        stateFor(forwardConnections),
        new Set(),
        false,
      ),
    ).not.toBe(
      exactCompilerTestOnly.searchStateMemoCommitment(
        stateFor(reverseConnections),
        new Set(),
        false,
      ),
    );
  });
});
