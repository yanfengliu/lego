import type {
  MeasuredPartBlueprint,
  MeasuredSourceConnectorRow,
  MeasuredThroughAxleBoreCollisionEvidence,
} from "./measured-part-types.ts";
import type { LduBounds, LduVector3, ThroughAxleBoreCollisionAllowance } from "./types.ts";

const ELIGIBLE_DESIGNS = new Set(["32064", "32064a", "73230"]);

function fail(blueprint: MeasuredPartBlueprint, message: string): never {
  throw new Error(`Measured part ${blueprint.designId} (${blueprint.ldrawId}) ${message}`);
}

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

function measuredEvidence(value: unknown): value is MeasuredThroughAxleBoreCollisionEvidence {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<MeasuredThroughAxleBoreCollisionEvidence>;
  return (
    row.schemaVersion === "measured-through-axle-bore-collision/1" &&
    row.sourceSection === "A 6 1" &&
    safeVector(row.startLdu) &&
    safeVector(row.endLdu) &&
    row.radiusLdu === 6 &&
    row.segmentLengthLdu === 20 &&
    row.caps === "none" &&
    row.sliding === true
  );
}

/** Compile exact measured A6x1 evidence without inferring a cavity from compatibility. */
export function compileThroughAxleBoreCollisionAllowance(
  blueprint: MeasuredPartBlueprint,
  source: MeasuredSourceConnectorRow,
  index: number,
  bodyBoundsLdu: LduBounds,
): ThroughAxleBoreCollisionAllowance | undefined {
  const rawEvidence = (source as { readonly throughBoreCollision?: unknown }).throughBoreCollision;
  if (source.kind !== "axleHole") {
    if (rawEvidence !== undefined) {
      fail(
        blueprint,
        `source connector ${index} carries throughBoreCollision on ${source.kind}; only an exact through axleHole may carry bore relief.`,
      );
    }
    return undefined;
  }
  if (!ELIGIBLE_DESIGNS.has(blueprint.designId)) {
    fail(
      blueprint,
      `source connector ${index} requests through axle-bore relief outside the reviewed 32064/32064a/73230 route.`,
    );
  }
  if (!measuredEvidence(rawEvidence)) {
    fail(
      blueprint,
      `source connector ${index} needs exact measured-through-axle-bore-collision/1 evidence for LDCad A 6 1, caps=none, slide=true, radius 6, and length 20; received ${JSON.stringify(rawEvidence)}.`,
    );
  }

  const { startLdu, endLdu } = rawEvidence;
  const delta = startLdu.map(
    (coordinate, axis) => endLdu[axis]! - coordinate,
  ) as unknown as LduVector3;
  const midpoint = startLdu.map(
    (coordinate, axis) => (coordinate + endLdu[axis]!) / 2,
  ) as unknown as LduVector3;
  const aligned = delta.every((coordinate, axis) => coordinate === source.normal[axis]! * 20);
  if (
    !aligned ||
    !midpoint.every((coordinate, axis) => coordinate === source.positionLdu[axis]) ||
    !pointInside(bodyBoundsLdu, startLdu) ||
    !pointInside(bodyBoundsLdu, endLdu)
  ) {
    fail(
      blueprint,
      `source connector ${index} bore segment ${JSON.stringify(startLdu)}..${JSON.stringify(endLdu)} must be a 20-LDU axis segment following normal ${JSON.stringify(source.normal)}, centered on ${JSON.stringify(source.positionLdu)}, and contained by body bounds ${JSON.stringify(bodyBoundsLdu)}.`,
    );
  }

  return {
    schemaVersion: "collision-through-axle-bore-allowance/1",
    id: `throughAxleBore:${index}`,
    portId: `axleHole:${index}`,
    portKind: "axleHole",
    incomingPortKind: "axle",
    incomingPrimitiveTag: "body",
    profileId: "axle-cross/1",
    sourceSection: rawEvidence.sourceSection,
    startLdu,
    endLdu,
    radiusLdu: rawEvidence.radiusLdu,
    segmentLengthLdu: rawEvidence.segmentLengthLdu,
    caps: rawEvidence.caps,
    sliding: rawEvidence.sliding,
    requiresValidatedConnection: true,
  };
}
