import { CONNECTOR_KIND_RULES, connectorAccepts } from "./constants.ts";
import { connectorAxialSpanIssue } from "./connector-axial-span.ts";
import { connectorAxisFrame } from "./connector-axis.ts";
import type { MeasuredPartBlueprint, MeasuredSourceConnectorRow } from "./measured-part-types.ts";
import type { ConnectorPortDefinition, LduBounds } from "./types.ts";

function fail(blueprint: MeasuredPartBlueprint, message: string): never {
  throw new Error(`Measured part ${blueprint.designId} (${blueprint.ldrawId}) ${message}`);
}

/** Compile one exact LDCad-authored shaft or socket row into catalog truth. */
export function compileMeasuredSourceConnector(
  blueprint: MeasuredPartBlueprint,
  source: MeasuredSourceConnectorRow,
  index: number,
  bodyBoundsLdu: LduBounds,
): ConnectorPortDefinition {
  const sourceKind = (source as { readonly kind?: unknown }).kind;
  if (sourceKind !== "axle" && sourceKind !== "axleHole" && sourceKind !== "blindAxleHole") {
    fail(
      blueprint,
      `source connector ${index} names kind ${JSON.stringify(sourceKind)}; the measured route currently admits only the exact LDCad axle, through axle-hole, and blind axle-hole lanes.`,
    );
  }
  if (!source.positionLdu.every(Number.isSafeInteger)) {
    fail(
      blueprint,
      `source connector ${index} seats at [${source.positionLdu.join(", ")}]; an authored shaft or socket seat must remain on exact whole-LDU coordinates.`,
    );
  }
  if (connectorAxisFrame(source.normal) === undefined) {
    fail(
      blueprint,
      `source connector ${index} has normal [${source.normal.join(", ")}]; an exact shaft or bore gate emits one signed unit axis.`,
    );
  }
  const axialSpanIssue = connectorAxialSpanIssue(source);
  if (axialSpanIssue !== undefined) {
    fail(
      blueprint,
      `source connector ${index} has invalid one-sided semantics: ${axialSpanIssue}.`,
    );
  }
  if (
    source.kind === "blindAxleHole" &&
    [source.axialSpan.openEndLdu, source.axialSpan.closedEndLdu].some((endpoint) =>
      endpoint.some(
        (coordinate, axis) =>
          coordinate < bodyBoundsLdu.min[axis]! || coordinate > bodyBoundsLdu.max[axis]!,
      ),
    )
  ) {
    fail(
      blueprint,
      `source connector ${index} spans open [${source.axialSpan.openEndLdu.join(", ")}] to closed [${source.axialSpan.closedEndLdu.join(", ")}], outside body bounds ${JSON.stringify(bodyBoundsLdu)}; exact socket evidence must stay inside the admitted body.`,
    );
  }

  const rule = CONNECTOR_KIND_RULES[source.kind];
  const connector = {
    id: `${source.kind}:${index}`,
    geometryRole: rule.geometryRole,
    profileId: rule.profileId,
    gender: rule.gender,
    positionLdu: source.positionLdu,
    normal: source.normal,
    // Existing non-stud ports retain the neutral serialized frame label; their
    // separately authoritative normal carries the shaft or socket axis.
    orientationId: "connector-up",
    capacity: 1,
    compatibleKinds: connectorAccepts(source.kind),
  } as const;
  return source.kind === "blindAxleHole"
    ? { ...connector, kind: source.kind, axialSpan: source.axialSpan }
    : { ...connector, kind: source.kind };
}
