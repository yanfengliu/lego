import {
  connectorAccepts,
  getPartDefinition,
  type ConnectorKind,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
import {
  getProperOrientation,
  rotateLduVector,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";

import {
  capacityEndpointForConnector,
  connectorCapacityIsFree,
  reserveConnectorCapacity,
  type ConnectorCapacityEndpoint,
} from "../connector-capacity";
import { connectorAxesAlign } from "../connector-frame-alignment";
import type { DiscoveredConnection } from "../placement";
import type { MutablePlacementEnumerationWork } from "./enumerate-placement-work";

export interface IndexedConnectorPort extends ConnectorCapacityEndpoint {
  readonly kind: ConnectorKind;
  readonly normal: LduVector3;
}

export type PlacementFreePortIndex = ReadonlyMap<string, IndexedConnectorPort>;

export type PlacementFreePortIndexProvider = (
  kind: ConnectorKind,
  work?: MutablePlacementEnumerationWork,
) => PlacementFreePortIndex;

interface RotatedConnectorPort extends ConnectorCapacityEndpoint {
  readonly kind: ConnectorKind;
  readonly normal: LduVector3;
  readonly offset: LduVector3;
}

interface ConnectorPairing {
  readonly targetKind: ConnectorKind;
  readonly candidateKind: ConnectorKind;
}

export interface PlacementConnectorSeedReceipt {
  readonly targetKind: ConnectorKind;
  readonly candidateKind: ConnectorKind;
  /** Unique free world positions after same-kind coincident endpoints are coalesced. */
  readonly freeTargetPorts: number;
  readonly candidatePortsPerOrientation: number;
  readonly axisCompatibleSeeds: number;
}

export interface PlacementConnectorIndexes {
  readonly freeByKind: ReadonlyMap<ConnectorKind, ReadonlyMap<string, IndexedConnectorPort>>;
  readonly rotatedByOrientation: ReadonlyMap<
    string,
    ReadonlyMap<ConnectorKind, readonly RotatedConnectorPort[]>
  >;
  readonly pairings: readonly ConnectorPairing[];
}

export interface PlacementConnectorOriginCounts {
  readonly rawFromStuds: number;
  readonly rawFromClutches: number;
  readonly rawFromOtherConnectorPairs: number;
  readonly seedReceipt: readonly PlacementConnectorSeedReceipt[];
}

function positionKey(position: LduVector3): string {
  return `${position[0]},${position[1]},${position[2]}`;
}

export function createPlacementFreePortIndex(
  parts: readonly PartInstance[],
  occupied: ReadonlySet<string>,
  kind: ConnectorKind,
  work?: MutablePlacementEnumerationWork,
): PlacementFreePortIndex {
  const index = new Map<string, IndexedConnectorPort>();
  for (const part of parts) {
    if (work) work.freePortPartsVisited += 1;
    const definition = getPartDefinition(part.catalogPartId);
    if (definition === undefined) continue;
    for (const connector of definition.connectors) {
      if (work) work.freePortConnectorVisits += 1;
      if (connector.kind !== kind) continue;
      const capacityEndpoint = capacityEndpointForConnector(part.id, connector);
      if (work) work.freePortCapacityChecks += 1;
      if (!connectorCapacityIsFree(capacityEndpoint, occupied)) continue;
      const key = positionKey(transformLduPoint(part.transform, connector.positionLdu));
      const orientation = getProperOrientation(part.transform.orientationId);
      const normal = rotateLduVector(orientation.matrix, connector.normal);
      if (!index.has(key)) {
        index.set(key, { ...capacityEndpoint, kind: connector.kind, normal });
      }
    }
  }
  return index;
}

function rotatedPorts(
  definition: PartDefinition,
  orientationId: string,
  kind: ConnectorKind,
): readonly RotatedConnectorPort[] {
  const rotation: RigidTransform = { positionLdu: [0, 0, 0], orientationId };
  const orientation = getProperOrientation(orientationId);
  return definition.connectors
    .filter((connector) => connector.kind === kind)
    .map((connector) => ({
      ...capacityEndpointForConnector("enumeration-candidate", connector),
      kind,
      normal: rotateLduVector(orientation.matrix, connector.normal),
      offset: transformLduPoint(rotation, connector.positionLdu),
    }));
}

function orderedPairings(definition: PartDefinition): readonly ConnectorPairing[] {
  const candidateKinds = [...new Set(definition.connectors.map(({ kind }) => kind))].sort();
  const rows = candidateKinds.flatMap((candidateKind) =>
    connectorAccepts(candidateKind).map((targetKind) => ({ targetKind, candidateKind })),
  );
  const key = ({ targetKind, candidateKind }: ConnectorPairing): string =>
    `${targetKind}\u0000${candidateKind}`;
  const unique = [...new Map(rows.map((row) => [key(row), row])).values()];
  const priority = ({ targetKind, candidateKind }: ConnectorPairing): number =>
    targetKind === "stud" && candidateKind === "undersideClutch"
      ? 0
      : targetKind === "undersideClutch" && candidateKind === "stud"
        ? 1
        : 2;
  return unique.sort(
    (left, right) => priority(left) - priority(right) || key(left).localeCompare(key(right)),
  );
}

export function createPlacementConnectorIndexes(
  parts: readonly PartInstance[],
  occupied: ReadonlySet<string>,
  definition: PartDefinition,
  orientationIds: readonly string[],
  work?: MutablePlacementEnumerationWork,
  freePortIndexProvider?: PlacementFreePortIndexProvider,
): PlacementConnectorIndexes {
  const pairings = orderedPairings(definition);
  const targetKinds = new Set(pairings.map(({ targetKind }) => targetKind));
  // Preserve the generation-2 stud receipt even for a part with no stud ports.
  targetKinds.add("stud");
  targetKinds.add("undersideClutch");
  const orderedTargetKinds = [
    "stud",
    "undersideClutch",
    ...[...targetKinds].filter((kind) => kind !== "stud" && kind !== "undersideClutch").sort(),
  ] as ConnectorKind[];
  const freeByKind = new Map(
    orderedTargetKinds.map(
      (kind) =>
        [
          kind,
          freePortIndexProvider?.(kind, work) ??
            createPlacementFreePortIndex(parts, occupied, kind, work),
        ] as const,
    ),
  );
  const candidateKinds = [...new Set(pairings.map(({ candidateKind }) => candidateKind))];
  const rotatedByOrientation = new Map(
    orientationIds.map((orientationId) => [
      orientationId,
      new Map(
        candidateKinds.map(
          (kind) => [kind, rotatedPorts(definition, orientationId, kind)] as const,
        ),
      ),
    ]),
  );
  return { freeByKind, rotatedByOrientation, pairings };
}

export function enumerateConnectorOrigins(
  indexes: PlacementConnectorIndexes,
  orientationIds: readonly string[],
  remember: (
    origin: LduVector3,
    orientationId: string,
    progress: Omit<PlacementConnectorOriginCounts, "seedReceipt">,
  ) => void,
  work?: MutablePlacementEnumerationWork,
): PlacementConnectorOriginCounts {
  const rawByPair = new Map<ConnectorPairing, number>(
    indexes.pairings.map((pair) => [pair, 0] as const),
  );
  let rawFromStuds = 0;
  let rawFromClutches = 0;
  let rawFromOtherConnectorPairs = 0;
  for (const orientationId of orientationIds) {
    const rotated = indexes.rotatedByOrientation.get(orientationId)!;
    for (const pairing of indexes.pairings) {
      const targets = indexes.freeByKind.get(pairing.targetKind)!;
      const candidatePorts = rotated.get(pairing.candidateKind) ?? [];
      for (const [targetPosition, target] of targets) {
        const [x, y, z] = targetPosition.split(",").map(Number) as [number, number, number];
        for (const candidatePort of candidatePorts) {
          if (work) work.seedAxisChecks += 1;
          if (!connectorAxesAlign(target, candidatePort)) continue;
          rawByPair.set(pairing, rawByPair.get(pairing)! + 1);
          if (pairing.targetKind === "stud" && pairing.candidateKind === "undersideClutch") {
            rawFromStuds += 1;
          } else if (pairing.targetKind === "undersideClutch" && pairing.candidateKind === "stud") {
            rawFromClutches += 1;
          } else {
            rawFromOtherConnectorPairs += 1;
          }
          remember(
            [x - candidatePort.offset[0], y - candidatePort.offset[1], z - candidatePort.offset[2]],
            orientationId,
            { rawFromStuds, rawFromClutches, rawFromOtherConnectorPairs },
          );
        }
      }
    }
  }
  const seedReceipt = indexes.pairings.map((pairing) => ({
    ...pairing,
    freeTargetPorts: indexes.freeByKind.get(pairing.targetKind)!.size,
    candidatePortsPerOrientation:
      indexes.rotatedByOrientation.values().next().value?.get(pairing.candidateKind)?.length ?? 0,
    axisCompatibleSeeds: rawByPair.get(pairing)!,
  }));
  const rawFor = (targetKind: ConnectorKind, candidateKind: ConnectorKind): number =>
    seedReceipt.find((row) => row.targetKind === targetKind && row.candidateKind === candidateKind)
      ?.axisCompatibleSeeds ?? 0;
  if (
    rawFor("stud", "undersideClutch") !== rawFromStuds ||
    rawFor("undersideClutch", "stud") !== rawFromClutches
  ) {
    throw new Error("Connector seed accounting diverged from its pair receipt.");
  }
  return {
    rawFromStuds,
    rawFromClutches,
    rawFromOtherConnectorPairs,
    seedReceipt,
  };
}

export function discoverIndexedConnections(
  indexes: PlacementConnectorIndexes,
  transform: RigidTransform,
  candidateId: string,
  work?: MutablePlacementEnumerationWork,
): readonly DiscoveredConnection[] {
  const discovered: DiscoveredConnection[] = [];
  const reservedCapacityClaims = new Set<string>();
  const rotated = indexes.rotatedByOrientation.get(transform.orientationId)!;
  for (const pairing of indexes.pairings) {
    const candidatePorts = rotated.get(pairing.candidateKind) ?? [];
    const targets = indexes.freeByKind.get(pairing.targetKind)!;
    for (const port of candidatePorts) {
      if (work) work.connectorPortLookups += 1;
      const world: LduVector3 = [
        port.offset[0] + transform.positionLdu[0],
        port.offset[1] + transform.positionLdu[1],
        port.offset[2] + transform.positionLdu[2],
      ];
      const target = targets.get(positionKey(world));
      if (target === undefined || target.partId === candidateId) continue;
      if (!connectorAxesAlign(port, target)) continue;
      if (!reserveConnectorCapacity([port, target], reservedCapacityClaims)) continue;
      if (work) work.connectorDiscoveries += 1;
      discovered.push({
        targetPartId: target.partId,
        targetPortId: target.portId,
        candidatePortId: port.portId,
      });
    }
  }
  return discovered.sort(
    (left, right) =>
      left.targetPartId.localeCompare(right.targetPartId) ||
      left.targetPortId.localeCompare(right.targetPortId) ||
      left.candidatePortId.localeCompare(right.candidatePortId),
  );
}
