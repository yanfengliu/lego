import type { LduBounds, LduVector3, PartDefinition } from "./types.ts";

export interface CollisionAllowanceAdmissionIssue {
  readonly code: "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH" | "MESH_ADMISSION_COLLISION_INVALID";
  readonly path: string;
  readonly message: string;
}

const THROUGH_BORE_PART_IDS = new Set([
  "builtin:technic-brick-1x1-axle-hole",
  "builtin:technic-brick-1x2-axle-hole",
]);

function safeVector(value: unknown): value is LduVector3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => Number.isSafeInteger(coordinate))
  );
}

function pointInside(bounds: LduBounds, point: LduVector3): boolean {
  return point.every(
    (coordinate, axis) => coordinate >= bounds.min[axis]! && coordinate <= bounds.max[axis]!,
  );
}

/** Validate connection-gated collision regions as a closed, source-measured schema. */
export function collisionAllowanceAdmissionIssues(
  definition: PartDefinition,
  visualBoundsValid: boolean,
): readonly CollisionAllowanceAdmissionIssue[] {
  const issues: CollisionAllowanceAdmissionIssue[] = [];
  const allowanceIds = new Set<string>();
  for (let index = 0; index < definition.collision.allowances.length; index += 1) {
    const allowance = definition.collision.allowances[index]!;
    const port = definition.connectors.find(({ id }) => id === allowance.portId);
    const allowanceCenterMatchesPort =
      port !== undefined &&
      safeVector(allowance.centerLdu) &&
      Number.isSafeInteger(allowance.maxInsertionDepthLdu) &&
      allowance.centerLdu[0] === port.positionLdu[0] &&
      allowance.centerLdu[1] === port.positionLdu[1] - allowance.maxInsertionDepthLdu / 2 &&
      allowance.centerLdu[2] === port.positionLdu[2];
    if (
      allowance.id.trim().length === 0 ||
      allowanceIds.has(allowance.id) ||
      port?.kind !== "undersideClutch" ||
      allowance.portKind !== "undersideClutch" ||
      allowance.incomingPrimitiveTag !== "stud" ||
      allowance.requiresValidatedConnection !== true ||
      !safeVector(allowance.centerLdu) ||
      !allowanceCenterMatchesPort ||
      (visualBoundsValid && !pointInside(definition.boundsLdu, allowance.centerLdu)) ||
      !Number.isSafeInteger(allowance.radiusLdu) ||
      allowance.radiusLdu <= 0 ||
      !Number.isSafeInteger(allowance.maxInsertionDepthLdu) ||
      allowance.maxInsertionDepthLdu <= 0
    ) {
      issues.push({
        code: "MESH_ADMISSION_COLLISION_INVALID",
        path: `/collision/allowances/${index}`,
        message: `Part ${definition.id} collision allowance ${JSON.stringify(allowance.id)} must name an undersideClutch connector and use a safe-integer center exactly [port.x, port.y-maxInsertionDepthLdu/2, port.z], positive radius, and positive insertion depth; received port=${port === undefined ? "missing" : JSON.stringify(port.positionLdu)}, allowance=${JSON.stringify(allowance)}.`,
      });
    }
    allowanceIds.add(allowance.id);
  }
  for (let connectorIndex = 0; connectorIndex < definition.connectors.length; connectorIndex += 1) {
    const connector = definition.connectors[connectorIndex]!;
    if (connector.kind !== "undersideClutch") continue;
    const matchingAllowances = definition.collision.allowances.filter(
      ({ portId }) => portId === connector.id,
    );
    if (matchingAllowances.length !== 1) {
      issues.push({
        code: "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        path: `/connectors/${connectorIndex}`,
        message: `Part ${definition.id} undersideClutch connector ${connector.id} needs exactly one collision allowance naming its portId; found ${matchingAllowances.length} with ids [${matchingAllowances.map(({ id }) => id).join(", ")}]. Missing allowances disable valid connected-stud penetration, while duplicates make allowance selection order-dependent.`,
      });
    }
  }

  const rawThrough = (definition.collision as { readonly throughAxleBoreAllowances?: unknown })
    .throughAxleBoreAllowances;
  const through = Array.isArray(rawThrough) ? rawThrough : [];
  if (rawThrough !== undefined && !Array.isArray(rawThrough)) {
    issues.push({
      code: "MESH_ADMISSION_COLLISION_INVALID",
      path: "/collision/throughAxleBoreAllowances",
      message: `Part ${definition.id} throughAxleBoreAllowances must be an array, received ${JSON.stringify(rawThrough)}.`,
    });
  }

  const throughIds = new Set<string>();
  for (let index = 0; index < through.length; index += 1) {
    const raw = through[index];
    const row = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const port =
      typeof row.portId === "string"
        ? definition.connectors.find(({ id }) => id === row.portId)
        : undefined;
    const start = row.startLdu;
    const end = row.endLdu;
    const midpointMatches =
      port !== undefined &&
      safeVector(start) &&
      safeVector(end) &&
      start.every((coordinate, axis) => coordinate + end[axis]! === port.positionLdu[axis]! * 2);
    const axisMatches =
      port !== undefined &&
      safeVector(start) &&
      safeVector(end) &&
      start.every((coordinate, axis) => end[axis]! - coordinate === port.normal[axis]! * 20);
    const id = typeof row.id === "string" ? row.id : "";
    if (
      !THROUGH_BORE_PART_IDS.has(definition.id) ||
      id.length === 0 ||
      throughIds.has(id) ||
      port?.kind !== "axleHole" ||
      row.schemaVersion !== "collision-through-axle-bore-allowance/1" ||
      row.portKind !== "axleHole" ||
      row.incomingPortKind !== "axle" ||
      row.incomingPrimitiveTag !== "body" ||
      row.profileId !== "axle-cross/1" ||
      row.sourceSection !== "A 6 1" ||
      row.radiusLdu !== 6 ||
      row.segmentLengthLdu !== 20 ||
      row.caps !== "none" ||
      row.sliding !== true ||
      row.requiresValidatedConnection !== true ||
      !safeVector(start) ||
      !safeVector(end) ||
      !midpointMatches ||
      !axisMatches ||
      !pointInside(definition.bodyBoundsLdu, start) ||
      !pointInside(definition.bodyBoundsLdu, end)
    ) {
      issues.push({
        code: "MESH_ADMISSION_COLLISION_INVALID",
        path: `${"/collision/throughAxleBoreAllowances"}/${index}`,
        message: `Part ${definition.id} through axle-bore allowance ${JSON.stringify(id)} must be the unique exact A 6 1, caps=none, slide=true, 20-LDU segment centered on an axleHole port and contained by its measured body; received ${JSON.stringify(raw)}.`,
      });
    }
    throughIds.add(id);
  }

  const axleHoleConnectors = definition.connectors.filter(({ kind }) => kind === "axleHole");
  const expectedThroughCount = THROUGH_BORE_PART_IDS.has(definition.id)
    ? axleHoleConnectors.length
    : 0;
  if (through.length !== expectedThroughCount) {
    issues.push({
      code: "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
      path: "/collision/throughAxleBoreAllowances",
      message: `Part ${definition.id} needs ${expectedThroughCount} exact through axle-bore allowance(s), one per reviewed axleHole connector; found ${through.length}. Blind sockets and unmeasured bores must have none.`,
    });
  }
  for (let connectorIndex = 0; connectorIndex < definition.connectors.length; connectorIndex += 1) {
    const connector = definition.connectors[connectorIndex]!;
    if (connector.kind !== "axleHole" || !THROUGH_BORE_PART_IDS.has(definition.id)) continue;
    const matching = through.filter(
      (row) => row !== null && typeof row === "object" && row.portId === connector.id,
    );
    if (matching.length !== 1) {
      issues.push({
        code: "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
        path: `/connectors/${connectorIndex}`,
        message: `Part ${definition.id} axleHole connector ${connector.id} needs exactly one measured through-bore allowance; found ${matching.length}.`,
      });
    }
  }
  return issues;
}
