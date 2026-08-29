import {
  connectorPairRule,
  getPartDefinition,
  type LduVector3,
  type ThroughAxleBoreCollisionAllowance,
} from "@lego-studio/catalog";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import {
  axisIndexForUnitVector,
  type AxisIndex,
  type PrimitiveBounds,
  type WorldBody,
} from "./collision-prism-geometry.ts";
import { getConnectorWorldFrame, getProperOrientation, transformLduPoint } from "./transforms.ts";

interface WorldThroughAxleBore {
  readonly axlePartId: string;
  readonly borePartId: string;
  readonly bounds: PrimitiveBounds;
}

export type ThroughAxleBoreReliefs = ReadonlyMap<string, readonly WorldThroughAxleBore[]>;

function reliefKey(axlePartId: string, borePartId: string): string {
  return `${axlePartId}\u0000${borePartId}`;
}

function worldBounds(
  borePart: PartInstance,
  boreNormal: LduVector3,
  allowance: ThroughAxleBoreCollisionAllowance,
): PrimitiveBounds | undefined {
  const start = transformLduPoint(borePart.transform, allowance.startLdu);
  const end = transformLduPoint(borePart.transform, allowance.endLdu);
  const orientation = getProperOrientation(borePart.transform.orientationId);
  const worldNormal: LduVector3 = [
    orientation.matrix[0]! * boreNormal[0] +
      orientation.matrix[1]! * boreNormal[1] +
      orientation.matrix[2]! * boreNormal[2],
    orientation.matrix[3]! * boreNormal[0] +
      orientation.matrix[4]! * boreNormal[1] +
      orientation.matrix[5]! * boreNormal[2],
    orientation.matrix[6]! * boreNormal[0] +
      orientation.matrix[7]! * boreNormal[1] +
      orientation.matrix[8]! * boreNormal[2],
  ];
  const axisIndex = axisIndexForUnitVector(worldNormal);
  if (axisIndex === undefined) return undefined;
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = [0, 0, 0];
  for (let axis = 0 as AxisIndex; axis < 3; axis = (axis + 1) as AxisIndex) {
    if (axis === axisIndex) {
      min[axis] = Math.min(start[axis], end[axis]);
      max[axis] = Math.max(start[axis], end[axis]);
    } else {
      const center = (start[axis] + end[axis]) / 2;
      min[axis] = center - allowance.radiusLdu;
      max[axis] = center + allowance.radiusLdu;
    }
  }
  return { min, max };
}

function exactlyAlignedAxleEdge(
  axlePart: PartInstance,
  axlePortId: string,
  borePart: PartInstance,
  borePortId: string,
): boolean {
  const axleDefinition = getPartDefinition(axlePart.catalogPartId);
  const boreDefinition = getPartDefinition(borePart.catalogPartId);
  if (axleDefinition?.family !== "axle" || boreDefinition === undefined) {
    return false;
  }
  const axlePort = axleDefinition.connectors.find(({ id }) => id === axlePortId);
  const borePort = boreDefinition.connectors.find(({ id }) => id === borePortId);
  if (
    axlePort?.kind !== "axle" ||
    axlePort.geometryRole !== "axleShaft" ||
    axlePort.profileId !== "axle-cross/1" ||
    borePort?.kind !== "axleHole" ||
    borePort.geometryRole !== "axleBore" ||
    borePort.profileId !== "axle-cross/1"
  ) {
    return false;
  }
  const pair = connectorPairRule(axlePort.kind, borePort.kind);
  if (pair?.axisMatching !== "collinear") return false;
  try {
    const axleFrame = getConnectorWorldFrame(axlePart, axlePortId);
    const boreFrame = getConnectorWorldFrame(borePart, borePortId);
    const coincident = axleFrame.positionLdu.every(
      (coordinate, axis) => coordinate === boreFrame.positionLdu[axis],
    );
    const sameLine = axleFrame.normal.every(
      (coordinate, axis) =>
        coordinate === boreFrame.normal[axis] || coordinate === -boreFrame.normal[axis]!,
    );
    return coincident && sameLine;
  } catch {
    return false;
  }
}

/** Build relief only from an exact validated axleHole:0-to-axle:* edge. */
export function collectThroughAxleBoreReliefs(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
): ThroughAxleBoreReliefs {
  const partById = new Map(parts.map((part) => [part.id, part]));
  const reliefs = new Map<string, WorldThroughAxleBore[]>();
  for (const connection of connections) {
    if (connection.kind !== "stud-tube") continue;
    const aPart = partById.get(connection.a.partId);
    const bPart = partById.get(connection.b.partId);
    if (!aPart || !bPart || aPart.id === bPart.id) continue;
    const aDefinition = getPartDefinition(aPart.catalogPartId);
    const bDefinition = getPartDefinition(bPart.catalogPartId);
    const aPort = aDefinition?.connectors.find(({ id }) => id === connection.a.portId);
    const bPort = bDefinition?.connectors.find(({ id }) => id === connection.b.portId);
    if (!aPort || !bPort) continue;
    const axle =
      aPort.kind === "axle"
        ? { part: aPart, portId: aPort.id }
        : bPort.kind === "axle"
          ? { part: bPart, portId: bPort.id }
          : undefined;
    const bore =
      aPort.kind === "axleHole"
        ? { part: aPart, port: aPort, definition: aDefinition! }
        : bPort.kind === "axleHole"
          ? { part: bPart, port: bPort, definition: bDefinition! }
          : undefined;
    if (
      !axle ||
      !bore ||
      !exactlyAlignedAxleEdge(axle.part, axle.portId, bore.part, bore.port.id)
    ) {
      continue;
    }
    const allowances = bore.definition.collision.throughAxleBoreAllowances?.filter(
      ({ portId, requiresValidatedConnection }) =>
        portId === bore.port.id && requiresValidatedConnection,
    );
    if (allowances?.length !== 1) continue;
    const bounds = worldBounds(bore.part, bore.port.normal, allowances[0]!);
    if (!bounds) continue;
    const value: WorldThroughAxleBore = {
      axlePartId: axle.part.id,
      borePartId: bore.part.id,
      bounds,
    };
    const key = reliefKey(value.axlePartId, value.borePartId);
    const existing = reliefs.get(key);
    if (existing) existing.push(value);
    else reliefs.set(key, [value]);
  }
  return reliefs;
}

/** Clear only a body-body intersection wholly inside the connected measured bore. */
export function bodyOverlapCoveredByThroughAxleBore(
  left: WorldBody,
  right: WorldBody,
  reliefs: ThroughAxleBoreReliefs,
): boolean {
  const candidates =
    reliefs.get(reliefKey(left.part.id, right.part.id)) ??
    reliefs.get(reliefKey(right.part.id, left.part.id));
  if (!candidates) return false;
  return candidates.some(({ axlePartId, borePartId, bounds }) => {
    if (!(
      (left.part.id === axlePartId && right.part.id === borePartId) ||
      (right.part.id === axlePartId && left.part.id === borePartId)
    )) {
      return false;
    }
    return bounds.min.every((minimum, axis) => {
      const overlapMin = Math.max(left.min[axis]!, right.min[axis]!);
      const overlapMax = Math.min(left.max[axis]!, right.max[axis]!);
      return overlapMin >= minimum && overlapMax <= bounds.max[axis]!;
    });
  });
}
