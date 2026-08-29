import type { ConnectorKind } from "./types.ts";

interface ConnectorAxialSpanCarrier {
  readonly kind: ConnectorKind;
  readonly positionLdu: readonly number[];
  readonly normal: readonly number[];
  readonly axialSpan?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeLduVector(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => Number.isSafeInteger(coordinate))
  );
}

/**
 * Returns the first exact-contract violation for a connector's axial span.
 *
 * This accepts an intentionally loose carrier so the runtime admission gate can
 * check untrusted objects as well as TypeScript-authored declarations.
 */
export function connectorAxialSpanIssue(connector: ConnectorAxialSpanCarrier): string | undefined {
  if (connector.kind !== "blindAxleHole") {
    return connector.axialSpan === undefined
      ? undefined
      : `kind ${connector.kind} is not one-sided and must not declare axialSpan`;
  }

  const span = connector.axialSpan;
  if (!isRecord(span)) {
    return "blindAxleHole requires an axialSpan object";
  }
  const keys = Object.keys(span).sort();
  const expectedKeys = ["closedEndLdu", "depthLdu", "openEndLdu", "schemaVersion", "sliding"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    return `axialSpan must contain exactly [${expectedKeys.join(", ")}], received [${keys.join(", ")}]`;
  }
  if (span.schemaVersion !== "connector-axial-span/1") {
    return `axialSpan.schemaVersion must be connector-axial-span/1, received ${JSON.stringify(span.schemaVersion)}`;
  }
  if (!isSafeLduVector(span.openEndLdu) || !isSafeLduVector(span.closedEndLdu)) {
    return `axialSpan ends must each be three safe-integer LDU coordinates, received open=${JSON.stringify(span.openEndLdu)} closed=${JSON.stringify(span.closedEndLdu)}`;
  }
  if (
    typeof span.depthLdu !== "number" ||
    !Number.isSafeInteger(span.depthLdu) ||
    span.depthLdu <= 0
  ) {
    return `axialSpan.depthLdu must be a positive safe integer, received ${JSON.stringify(span.depthLdu)}`;
  }
  if (span.sliding !== false) {
    return `blindAxleHole must preserve slide=false, received ${JSON.stringify(span.sliding)}`;
  }
  if (!isSafeLduVector(connector.positionLdu) || !isSafeLduVector(connector.normal)) {
    return "blindAxleHole position and normal must be safe-integer LDU vectors";
  }

  const depthLdu = span.depthLdu;
  for (const axis of [0, 1, 2] as const) {
    if (
      BigInt(span.openEndLdu[axis]) + BigInt(span.closedEndLdu[axis]) !==
      2n * BigInt(connector.positionLdu[axis])
    ) {
      return `connector point must be the exact midpoint of axialSpan; axis ${axis} has open ${span.openEndLdu[axis]}, closed ${span.closedEndLdu[axis]}, and point ${connector.positionLdu[axis]}`;
    }
    const observedDelta = BigInt(span.openEndLdu[axis]) - BigInt(span.closedEndLdu[axis]);
    const expectedDelta = BigInt(connector.normal[axis]) * BigInt(depthLdu);
    if (observedDelta !== expectedDelta) {
      return `connector normal must point from the closed end to the open mouth for exactly depthLdu ${depthLdu}; axis ${axis} moves ${observedDelta.toString()}, expected ${expectedDelta.toString()}`;
    }
  }
  return undefined;
}
