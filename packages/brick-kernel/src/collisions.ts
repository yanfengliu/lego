import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import {
  boundsOverlap,
  type PrimitiveBounds,
  type WorldBody,
  type WorldPrimitive,
  type WorldStud,
} from "./collision-prism-geometry.ts";
import {
  collectAllowedPenetrations,
  makeWorldPrimitives,
  primitivesCollide,
} from "./collision-world-primitives.ts";
import { MAX_COLLISION_COMPARISONS, MAX_COLLISION_FINDINGS } from "./truth-manifests.ts";

export interface CollisionFinding {
  readonly validatorId: "kernel.collision";
  readonly code:
    | "COLLISION_COMPARISON_BUDGET_EXCEEDED"
    | "COLLISION_FINDING_BUDGET_EXCEEDED"
    | "PART_BODY_COLLISION"
    | "PART_STUD_BODY_COLLISION"
    | "PART_STUD_COLLISION";
  readonly message: string;
  readonly path: "/parts";
  readonly partIds: readonly string[];
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collisionFinding(left: WorldPrimitive, right: WorldPrimitive): CollisionFinding {
  const partIds = [left.part.id, right.part.id].sort(compareStrings);
  if (left.kind === "body" && right.kind === "body") {
    return {
      validatorId: "kernel.collision",
      code: "PART_BODY_COLLISION",
      message: `Part bodies overlap: ${partIds[0]} and ${partIds[1]}`,
      path: "/parts",
      partIds,
    };
  }
  if (left.kind === "stud" && right.kind === "stud") {
    return {
      validatorId: "kernel.collision",
      code: "PART_STUD_COLLISION",
      message: `Part studs overlap: ${left.part.id}/${left.primitiveId} and ${right.part.id}/${right.primitiveId}`,
      path: "/parts",
      partIds,
    };
  }
  const stud = left.kind === "stud" ? left : (right as WorldStud);
  const body = left.kind === "body" ? left : (right as WorldBody);
  return {
    validatorId: "kernel.collision",
    code: "PART_STUD_BODY_COLLISION",
    message: `Stud ${stud.part.id}/${stud.primitiveId} overlaps body ${body.part.id}/${body.primitiveId}`,
    path: "/parts",
    partIds,
  };
}

function collisionClassKey(finding: CollisionFinding): string {
  return `${finding.code}\u0000${finding.partIds.join("\u0001")}`;
}

const PART_BROAD_PHASE_CELL_LDU = 40;

interface PartBroadPhaseIndex {
  readonly boundsBySource: readonly (PrimitiveBounds | undefined)[];
  readonly cellKeysBySource: readonly (readonly string[] | undefined)[];
  readonly primitiveIndicesBySource: readonly (readonly number[] | undefined)[];
  readonly sourcesByCell: ReadonlyMap<string, readonly number[]>;
}

function partBroadPhaseCellKeys(bounds: PrimitiveBounds): readonly string[] {
  const keys: string[] = [];
  const minX = Math.floor(bounds.min[0] / PART_BROAD_PHASE_CELL_LDU);
  const maxX = Math.floor(bounds.max[0] / PART_BROAD_PHASE_CELL_LDU);
  const minY = Math.floor(bounds.min[1] / PART_BROAD_PHASE_CELL_LDU);
  const maxY = Math.floor(bounds.max[1] / PART_BROAD_PHASE_CELL_LDU);
  const minZ = Math.floor(bounds.min[2] / PART_BROAD_PHASE_CELL_LDU);
  const maxZ = Math.floor(bounds.max[2] / PART_BROAD_PHASE_CELL_LDU);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) keys.push(`${x}:${y}:${z}`);
    }
  }
  return keys;
}

function createPartBroadPhaseIndex(
  primitives: readonly WorldPrimitive[],
  sourceCount: number,
): PartBroadPhaseIndex {
  const boundsBySource: (PrimitiveBounds | undefined)[] = Array.from({ length: sourceCount });
  const primitiveIndicesBySource: (number[] | undefined)[] = Array.from({ length: sourceCount });
  for (let index = 0; index < primitives.length; index += 1) {
    const primitive = primitives[index]!;
    const indices = primitiveIndicesBySource[primitive.sourceIndex];
    if (indices) indices.push(index);
    else primitiveIndicesBySource[primitive.sourceIndex] = [index];
    const prior = boundsBySource[primitive.sourceIndex];
    boundsBySource[primitive.sourceIndex] = prior
      ? {
          min: [
            Math.min(prior.min[0], primitive.min[0]),
            Math.min(prior.min[1], primitive.min[1]),
            Math.min(prior.min[2], primitive.min[2]),
          ],
          max: [
            Math.max(prior.max[0], primitive.max[0]),
            Math.max(prior.max[1], primitive.max[1]),
            Math.max(prior.max[2], primitive.max[2]),
          ],
        }
      : { min: primitive.min, max: primitive.max };
  }

  const cellKeysBySource: (readonly string[] | undefined)[] = Array.from({
    length: sourceCount,
  });
  const sourcesByCell = new Map<string, number[]>();
  for (let sourceIndex = 0; sourceIndex < boundsBySource.length; sourceIndex += 1) {
    const bounds = boundsBySource[sourceIndex];
    if (!bounds) continue;
    const keys = partBroadPhaseCellKeys(bounds);
    cellKeysBySource[sourceIndex] = keys;
    for (const key of keys) {
      const sources = sourcesByCell.get(key);
      if (sources) sources.push(sourceIndex);
      else sourcesByCell.set(key, [sourceIndex]);
    }
  }
  return { boundsBySource, cellKeysBySource, primitiveIndicesBySource, sourcesByCell };
}

function candidatePrimitiveIndices(
  sourceIndex: number,
  index: PartBroadPhaseIndex,
): readonly number[] {
  const sourceBounds = index.boundsBySource[sourceIndex];
  if (!sourceBounds) return [];
  const candidateSources = new Set<number>();
  for (const key of index.cellKeysBySource[sourceIndex] ?? []) {
    for (const candidateSource of index.sourcesByCell.get(key) ?? []) {
      if (candidateSource === sourceIndex || candidateSources.has(candidateSource)) continue;
      const candidateBounds = index.boundsBySource[candidateSource];
      if (candidateBounds && boundsOverlap(sourceBounds, candidateBounds)) {
        candidateSources.add(candidateSource);
      }
    }
  }
  const indices: number[] = [];
  for (const candidateSource of candidateSources) {
    indices.push(...(index.primitiveIndicesBySource[candidateSource] ?? []));
  }
  return indices.sort((left, right) => left - right);
}

export function findCatalogCollisions(
  parts: readonly PartInstance[],
  validConnections: readonly ConnectionEdge[],
): CollisionFinding[] {
  const primitives = makeWorldPrimitives(parts);
  const allowedPenetrations = collectAllowedPenetrations(parts, validConnections);
  const findings: CollisionFinding[] = [];
  const reportedClasses = new Set<string>();
  const partBroadPhase = createPartBroadPhaseIndex(primitives, parts.length);
  const candidatesBySource: (readonly number[] | undefined)[] = Array.from({
    length: parts.length,
  });
  let comparisons = 0;

  for (let leftIndex = 0; leftIndex < primitives.length; leftIndex += 1) {
    const left = primitives[leftIndex];
    if (!left) continue;
    const sourceCandidates =
      candidatesBySource[left.sourceIndex] ??
      (candidatesBySource[left.sourceIndex] = candidatePrimitiveIndices(
        left.sourceIndex,
        partBroadPhase,
      ));
    for (const rightIndex of sourceCandidates) {
      if (rightIndex <= leftIndex) continue;
      const right = primitives[rightIndex]!;
      if (right.min[0] >= left.max[0]) break;
      if (!boundsOverlap(left, right)) continue;
      comparisons += 1;
      if (comparisons > MAX_COLLISION_COMPARISONS) {
        return [
          {
            validatorId: "kernel.collision",
            code: "COLLISION_COMPARISON_BUDGET_EXCEEDED",
            message: `Collision validation exceeded its deterministic ${MAX_COLLISION_COMPARISONS}-comparison budget`,
            path: "/parts",
            partIds: [],
          },
        ];
      }
      if (!primitivesCollide(left, right, allowedPenetrations)) continue;

      const finding = collisionFinding(left, right);
      const key = collisionClassKey(finding);
      if (reportedClasses.has(key)) continue;
      reportedClasses.add(key);
      findings.push(finding);
      if (findings.length >= MAX_COLLISION_FINDINGS) {
        return [
          ...findings.slice(0, MAX_COLLISION_FINDINGS - 1),
          {
            validatorId: "kernel.collision",
            code: "COLLISION_FINDING_BUDGET_EXCEEDED",
            message: `Collision findings exceeded the deterministic ${MAX_COLLISION_FINDINGS}-finding budget`,
            path: "/parts",
            partIds: [],
          },
        ];
      }
    }
  }

  return findings;
}

const WORLD_CELL_LDU = 40;
const LEGACY_WORLD_CELL_LDU = 100;

function cellKeysFor(bounds: PrimitiveBounds): readonly string[] {
  const keys: string[] = [];
  const minX = Math.floor(bounds.min[0] / WORLD_CELL_LDU);
  const maxX = Math.floor(bounds.max[0] / WORLD_CELL_LDU);
  const minY = Math.floor(bounds.min[1] / WORLD_CELL_LDU);
  const maxY = Math.floor(bounds.max[1] / WORLD_CELL_LDU);
  const minZ = Math.floor(bounds.min[2] / WORLD_CELL_LDU);
  const maxZ = Math.floor(bounds.max[2] / WORLD_CELL_LDU);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) keys.push(`${x}:${y}:${z}`);
    }
  }
  return keys;
}

/** The exact x/z traversal order used by placement enumeration version 2. */
function legacyCellKeysFor(bounds: PrimitiveBounds): readonly string[] {
  const keys: string[] = [];
  const minX = Math.floor(bounds.min[0] / LEGACY_WORLD_CELL_LDU);
  const maxX = Math.floor(bounds.max[0] / LEGACY_WORLD_CELL_LDU);
  const minZ = Math.floor(bounds.min[2] / LEGACY_WORLD_CELL_LDU);
  const maxZ = Math.floor(bounds.max[2] / LEGACY_WORLD_CELL_LDU);
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) keys.push(`${x}:${z}`);
  }
  return keys;
}

/**
 * Deterministic work, separate from collision truth and enumeration counts.
 *
 * An observer receives one world-build delta and one delta per query. The
 * indexed world itself stays immutable after construction, and ordinary
 * callers pay no positive-control indexing cost when no observer is supplied.
 */
export interface CollisionWorldWork {
  readonly worldParts: number;
  readonly worldPrimitives: number;
  readonly worldCellInsertions: number;
  readonly collisionQueries: number;
  readonly candidateConnectionEdges: number;
  readonly candidatePrimitives: number;
  readonly queryCellVisits: number;
  readonly broadphaseCellEntries: number;
  readonly broadphaseUniquePrimitives: number;
  readonly legacyOrderWorldCellKeys: number;
  readonly legacyOrderCandidateCellKeys: number;
  readonly legacyOrderSetInsertions: number;
  readonly legacyOrderCellChecks: number;
  readonly legacyOrderComparisons: number;
  readonly primitivePairAabbTests: number;
  readonly primitivePairNarrowphaseTests: number;
  readonly collisionFindings: number;
  /** Deliberately bad controls; never part of the production collision path. */
  readonly positiveControl2dCellEntries: number;
  readonly positiveControlAllPrimitiveAabbTests: number;
}

export const COLLISION_WORLD_WORK_KEYS = [
  "worldParts",
  "worldPrimitives",
  "worldCellInsertions",
  "collisionQueries",
  "candidateConnectionEdges",
  "candidatePrimitives",
  "queryCellVisits",
  "broadphaseCellEntries",
  "broadphaseUniquePrimitives",
  "legacyOrderWorldCellKeys",
  "legacyOrderCandidateCellKeys",
  "legacyOrderSetInsertions",
  "legacyOrderCellChecks",
  "legacyOrderComparisons",
  "primitivePairAabbTests",
  "primitivePairNarrowphaseTests",
  "collisionFindings",
  "positiveControl2dCellEntries",
  "positiveControlAllPrimitiveAabbTests",
] as const satisfies readonly (keyof CollisionWorldWork)[];

export type CollisionWorldWorkObserver = (delta: Readonly<CollisionWorldWork>) => void;

function emptyCollisionWorldWork(): Record<keyof CollisionWorldWork, number> {
  return {
    worldParts: 0,
    worldPrimitives: 0,
    worldCellInsertions: 0,
    collisionQueries: 0,
    candidateConnectionEdges: 0,
    candidatePrimitives: 0,
    queryCellVisits: 0,
    broadphaseCellEntries: 0,
    broadphaseUniquePrimitives: 0,
    legacyOrderWorldCellKeys: 0,
    legacyOrderCandidateCellKeys: 0,
    legacyOrderSetInsertions: 0,
    legacyOrderCellChecks: 0,
    legacyOrderComparisons: 0,
    primitivePairAabbTests: 0,
    primitivePairNarrowphaseTests: 0,
    collisionFindings: 0,
    positiveControl2dCellEntries: 0,
    positiveControlAllPrimitiveAabbTests: 0,
  };
}

export interface CollisionWorld {
  readonly primitiveCount: number;
  findCollisionsWith(
    candidate: PartInstance,
    candidateConnections: readonly ConnectionEdge[],
  ): CollisionFinding[];
}

export function createCollisionWorld(
  parts: readonly PartInstance[],
  observeWork?: CollisionWorldWorkObserver,
): CollisionWorld {
  const primitives = makeWorldPrimitives(parts);
  const partById = new Map(parts.map((part) => [part.id, part]));
  const mutableCells = new Map<string, WorldPrimitive[]>();
  const primitiveOrdinal = new Map<WorldPrimitive, number>();
  const legacyCellsByPrimitive = new Map<WorldPrimitive, readonly string[]>();
  const buildWork = emptyCollisionWorldWork();
  buildWork.worldParts = parts.length;
  buildWork.worldPrimitives = primitives.length;
  const positiveControl2dCellOccupancy = observeWork ? new Map<string, number>() : undefined;
  for (let ordinal = 0; ordinal < primitives.length; ordinal += 1) {
    const primitive = primitives[ordinal]!;
    primitiveOrdinal.set(primitive, ordinal);
    const legacyCells = legacyCellKeysFor(primitive);
    legacyCellsByPrimitive.set(primitive, legacyCells);
    buildWork.legacyOrderWorldCellKeys += legacyCells.length;
    for (const key of cellKeysFor(primitive)) {
      buildWork.worldCellInsertions += 1;
      const cell = mutableCells.get(key);
      if (cell) cell.push(primitive);
      else mutableCells.set(key, [primitive]);
    }
    if (positiveControl2dCellOccupancy) {
      for (const key of legacyCells) {
        positiveControl2dCellOccupancy.set(key, (positiveControl2dCellOccupancy.get(key) ?? 0) + 1);
      }
    }
  }
  const cells: ReadonlyMap<string, readonly WorldPrimitive[]> = new Map(
    [...mutableCells].map(([key, members]) => [key, Object.freeze([...members])] as const),
  );
  observeWork?.(Object.freeze({ ...buildWork }));

  return {
    primitiveCount: primitives.length,
    findCollisionsWith(candidate, candidateConnections) {
      const queryWork = emptyCollisionWorldWork();
      queryWork.collisionQueries = 1;
      queryWork.candidateConnectionEdges = candidateConnections.length;
      const candidatePrimitives = makeWorldPrimitives([candidate]);
      queryWork.candidatePrimitives = candidatePrimitives.length;
      const candidateLegacyCells = candidatePrimitives.map((primitive) => {
        const keys = legacyCellKeysFor(primitive);
        queryWork.legacyOrderCandidateCellKeys += keys.length;
        return keys;
      });
      queryWork.positiveControlAllPrimitiveAabbTests =
        candidatePrimitives.length * primitives.length;
      const finish = (findings: CollisionFinding[]): CollisionFinding[] => {
        queryWork.collisionFindings = findings.length;
        observeWork?.(Object.freeze({ ...queryWork }));
        return findings;
      };
      if (candidatePrimitives.length === 0) return finish([]);
      const roster = [candidate];
      for (const connection of candidateConnections) {
        for (const endpoint of [connection.a, connection.b]) {
          const part = partById.get(endpoint.partId);
          if (part && !roster.includes(part)) roster.push(part);
        }
      }
      const allowedPenetrations = collectAllowedPenetrations(roster, candidateConnections);

      const neighbourhood = new Set<WorldPrimitive>();
      for (
        let primitiveIndex = 0;
        primitiveIndex < candidatePrimitives.length;
        primitiveIndex += 1
      ) {
        const primitive = candidatePrimitives[primitiveIndex]!;
        for (const key of cellKeysFor(primitive)) {
          queryWork.queryCellVisits += 1;
          const members = cells.get(key) ?? [];
          queryWork.broadphaseCellEntries += members.length;
          for (const other of members) {
            if (other.part.id !== candidate.id) neighbourhood.add(other);
          }
        }
        if (positiveControl2dCellOccupancy) {
          for (const key of candidateLegacyCells[primitiveIndex]!) {
            queryWork.positiveControl2dCellEntries += positiveControl2dCellOccupancy.get(key) ?? 0;
          }
        }
      }
      queryWork.broadphaseUniquePrimitives = neighbourhood.size;

      // Removing y-separated primitives must not perturb the finding sequence.
      // Rank each retained primitive by the first place the former 2-D index
      // would have encountered it, then by the immutable source ordinal. This
      // is exactly the old Set insertion order with proven non-overlaps removed.
      const rankedNeighbourhood = [...neighbourhood].map((primitive) => {
        const legacyCells = legacyCellsByPrimitive.get(primitive)!;
        const primitiveLegacyCells = new Set(legacyCells);
        queryWork.legacyOrderSetInsertions += legacyCells.length;
        let candidatePrimitiveIndex = Number.MAX_SAFE_INTEGER;
        let candidateCellIndex = Number.MAX_SAFE_INTEGER;
        outer: for (let index = 0; index < candidatePrimitives.length; index += 1) {
          const candidateCells = candidateLegacyCells[index]!;
          for (let cellIndex = 0; cellIndex < candidateCells.length; cellIndex += 1) {
            queryWork.legacyOrderCellChecks += 1;
            if (!primitiveLegacyCells.has(candidateCells[cellIndex]!)) continue;
            candidatePrimitiveIndex = index;
            candidateCellIndex = cellIndex;
            break outer;
          }
        }
        return {
          primitive,
          candidatePrimitiveIndex,
          candidateCellIndex,
          ordinal: primitiveOrdinal.get(primitive)!,
        };
      });
      rankedNeighbourhood.sort((left, right) => {
        queryWork.legacyOrderComparisons += 1;
        return (
          left.candidatePrimitiveIndex - right.candidatePrimitiveIndex ||
          left.candidateCellIndex - right.candidateCellIndex ||
          left.ordinal - right.ordinal
        );
      });

      const findings: CollisionFinding[] = [];
      const reportedClasses = new Set<string>();
      for (const left of candidatePrimitives) {
        for (const { primitive: right } of rankedNeighbourhood) {
          queryWork.primitivePairAabbTests += 1;
          if (!boundsOverlap(left, right)) continue;
          queryWork.primitivePairNarrowphaseTests += 1;
          if (!primitivesCollide(left, right, allowedPenetrations)) continue;
          const finding = collisionFinding(left, right);
          const classKey = collisionClassKey(finding);
          if (reportedClasses.has(classKey)) continue;
          reportedClasses.add(classKey);
          findings.push(finding);
          if (findings.length >= MAX_COLLISION_FINDINGS) return finish(findings);
        }
      }
      return finish(findings);
    },
  };
}
