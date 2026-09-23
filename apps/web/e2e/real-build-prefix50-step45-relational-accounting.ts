import { getPartDefinition } from "@lego-studio/catalog";
import { deepFreeze } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  PLACEMENT_ENUMERATION_VERSION,
  type PlacementEnumeration,
  type PlacementEnumerationWork,
} from "../src/assembly/enumerate-placements";
import { emptyPlacementEnumerationWork } from "../src/assembly/enumerate-placement-work";
import { protocolConnectionKindForDiscoveredConnection } from "../src/assembly/placement-connection-kind";
import {
  STEP45_AXLE,
  STEP45_MAX_CANDIDATE_CONNECTIONS,
  STEP45_MAX_DISTINCT_TRANSFORMS,
  STEP45_MAX_RECORDED_WORK,
  STEP45_MAX_SEED_RECEIPT_ROWS,
} from "./real-build-prefix50-step45-relational-contract";

export function requireExactDataKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

export function sameSequence<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function boundedInteger(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= STEP45_MAX_RECORDED_WORK
  );
}

function normalizedCandidateRoster(enumeration: PlacementEnumeration, document: BrickDocumentV1) {
  const legal = getPartDefinition(STEP45_AXLE)!.legalOrientationIds;
  const targetPartIds = new Set(document.parts.map(({ id }) => id));
  const seen = new Set<string>();
  return enumeration.candidates.map((candidate, candidateIndex) => {
    requireExactDataKeys(
      candidate,
      ["catalogPartId", "connections", "restsOnBuildPlate", "transform"],
      `Step-45 candidate[${candidateIndex}]`,
    );
    if (
      candidate.catalogPartId !== STEP45_AXLE ||
      !legal.includes(candidate.transform.orientationId) ||
      !candidate.transform.positionLdu.every(Number.isSafeInteger) ||
      typeof candidate.restsOnBuildPlate !== "boolean" ||
      !Array.isArray(candidate.connections) ||
      candidate.connections.length > STEP45_MAX_CANDIDATE_CONNECTIONS
    ) {
      throw new TypeError(
        `Step-45 candidate[${candidateIndex}] is not one bounded legal axle placement.`,
      );
    }
    const transformKey = `${candidate.transform.positionLdu.join(",")}|${candidate.transform.orientationId}`;
    if (seen.has(transformKey))
      throw new TypeError("Step-45 enumeration contains duplicate transforms.");
    seen.add(transformKey);
    const connectionKeys = new Set<string>();
    const connections = candidate.connections.map((connection, connectionIndex) => {
      requireExactDataKeys(
        connection,
        ["candidatePortId", "targetPartId", "targetPortId"],
        `Step-45 candidate[${candidateIndex}].connection[${connectionIndex}]`,
      );
      const key = `${connection.targetPartId}\u0000${connection.targetPortId}\u0000${connection.candidatePortId}`;
      if (!targetPartIds.has(connection.targetPartId) || connectionKeys.has(key)) {
        throw new TypeError(
          `Step-45 candidate[${candidateIndex}] has a duplicate or unknown target.`,
        );
      }
      connectionKeys.add(key);
      const connectionKind = protocolConnectionKindForDiscoveredConnection(
        document.parts,
        STEP45_AXLE,
        connection,
      );
      if (connectionKind !== "stud-tube") {
        throw new TypeError(`Step-45 candidate[${candidateIndex}] has a noncanonical connection.`);
      }
      return {
        targetPartId: connection.targetPartId,
        targetPortId: connection.targetPortId,
        candidatePortId: connection.candidatePortId,
        connectionKind,
      };
    });
    return {
      catalogPartId: candidate.catalogPartId,
      transform: candidate.transform,
      connections,
      restsOnBuildPlate: candidate.restsOnBuildPlate,
    };
  });
}

export function requireStep45CompleteEnumeration(
  enumeration: PlacementEnumeration,
  work: PlacementEnumerationWork,
  document: BrickDocumentV1,
) {
  requireExactDataKeys(
    enumeration,
    [
      "candidates",
      "catalogPartId",
      "connectorSeedReceipt",
      "counts",
      "orientationIds",
      "schemaVersion",
    ],
    "Step-45 enumeration",
  );
  const legal = getPartDefinition(STEP45_AXLE)!.legalOrientationIds;
  const counts = enumeration.counts;
  requireExactDataKeys(
    counts,
    [
      "accepted",
      "distinctTransforms",
      "freeClutches",
      "freeStuds",
      "rawFromBuildPlate",
      "rawFromClutches",
      "rawFromStuds",
      "rejectedBelowBuildPlate",
      "rejectedColliding",
      "rejectedDetached",
      "rejectedUnsupported",
    ],
    "Step-45 enumeration counts",
  );
  if (
    enumeration.schemaVersion !== PLACEMENT_ENUMERATION_VERSION ||
    enumeration.catalogPartId !== STEP45_AXLE ||
    !sameSequence(enumeration.orientationIds, legal) ||
    !Object.values(counts).every(boundedInteger) ||
    counts.rawFromBuildPlate !== 0 ||
    counts.accepted !== enumeration.candidates.length ||
    counts.distinctTransforms > STEP45_MAX_DISTINCT_TRANSFORMS ||
    counts.distinctTransforms !==
      counts.accepted +
        counts.rejectedUnsupported +
        counts.rejectedDetached +
        counts.rejectedBelowBuildPlate +
        counts.rejectedColliding
  ) {
    throw new TypeError("Step-45 enumeration is incomplete, narrowed, unbounded, or inconsistent.");
  }
  requireExactDataKeys(
    work,
    Object.keys(emptyPlacementEnumerationWork()),
    "Step-45 enumeration work",
  );
  if (
    !Object.values(work).every(boundedInteger) ||
    work.occupiedCapacitySeedEdges !== document.connections.length ||
    work.candidateTransformsVisited !== counts.distinctTransforms
  ) {
    throw new TypeError("Step-45 observed enumeration work is incomplete or outside its bound.");
  }
  if (
    !Array.isArray(enumeration.connectorSeedReceipt) ||
    enumeration.connectorSeedReceipt.length > STEP45_MAX_SEED_RECEIPT_ROWS
  ) {
    throw new TypeError("Step-45 connector seed receipt is absent or unbounded.");
  }
  const seedPairs = new Set<string>();
  let seedTotal = 0;
  for (const [index, seed] of enumeration.connectorSeedReceipt.entries()) {
    requireExactDataKeys(
      seed,
      [
        "axisCompatibleSeeds",
        "candidateKind",
        "candidatePortsPerOrientation",
        "freeTargetPorts",
        "targetKind",
      ],
      `Step-45 connector seed receipt[${index}]`,
    );
    const key = `${seed.targetKind}\u0000${seed.candidateKind}`;
    if (
      seedPairs.has(key) ||
      !boundedInteger(seed.freeTargetPorts) ||
      !boundedInteger(seed.candidatePortsPerOrientation) ||
      !boundedInteger(seed.axisCompatibleSeeds) ||
      BigInt(seed.axisCompatibleSeeds) >
        BigInt(seed.freeTargetPorts) *
          BigInt(seed.candidatePortsPerOrientation) *
          BigInt(legal.length)
    ) {
      throw new TypeError(`Step-45 connector seed receipt[${index}] is duplicate or unbounded.`);
    }
    seedPairs.add(key);
    seedTotal += seed.axisCompatibleSeeds;
  }
  const studReceipt = enumeration.connectorSeedReceipt.find(
    ({ targetKind, candidateKind }) => targetKind === "stud" && candidateKind === "undersideClutch",
  );
  const clutchReceipt = enumeration.connectorSeedReceipt.find(
    ({ targetKind, candidateKind }) => targetKind === "undersideClutch" && candidateKind === "stud",
  );
  if (
    (studReceipt?.axisCompatibleSeeds ?? 0) !== counts.rawFromStuds ||
    (clutchReceipt?.axisCompatibleSeeds ?? 0) !== counts.rawFromClutches ||
    (studReceipt !== undefined && studReceipt.freeTargetPorts !== counts.freeStuds) ||
    (clutchReceipt !== undefined && clutchReceipt.freeTargetPorts !== counts.freeClutches) ||
    work.originProposals !== seedTotal
  ) {
    throw new TypeError("Step-45 seed, origin, and observed-work accounting does not conserve.");
  }
  const roster = normalizedCandidateRoster(enumeration, document);
  for (let index = 1; index < roster.length; index += 1) {
    const left = roster[index - 1]!.transform;
    const right = roster[index]!.transform;
    const order =
      left.positionLdu[0] - right.positionLdu[0] ||
      left.positionLdu[1] - right.positionLdu[1] ||
      left.positionLdu[2] - right.positionLdu[2] ||
      left.orientationId.localeCompare(right.orientationId);
    if (order > 0) throw new TypeError("Step-45 candidate roster is not in deterministic order.");
  }
  return deepFreeze(roster);
}
