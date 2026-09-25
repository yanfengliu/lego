import { connectorAxisFrame } from "./connector-axis.ts";
import { STUD_HEIGHT_LDU, STUD_RADIUS_LDU } from "./constants.ts";
import type { MeasuredClutchRow, MeasuredPartBlueprint } from "./measured-part-types.ts";
import type {
  CollisionAllowance,
  ConnectorPortDefinition,
  LduBounds,
  LduVector3,
} from "./types.ts";

export interface CompiledMeasuredClutch {
  readonly connector: ConnectorPortDefinition;
  readonly allowance: CollisionAllowance;
}

const AXIS_NAMES = ["x", "y", "z"] as const;

function fail(blueprint: MeasuredPartBlueprint, index: number, message: string): never {
  throw new Error(
    `Measured part ${blueprint.designId} (${blueprint.ldrawId}) clutch ${index} ${message}`,
  );
}

/** A clutch row's seat and outward normal; a three-number row faces down (+Y). */
export function measuredClutchFrame(row: MeasuredClutchRow): {
  readonly positionLdu: LduVector3;
  readonly normal: LduVector3;
} {
  return {
    positionLdu: [row[0], row[1], row[2]],
    normal: row.length === 3 ? [0, 1, 0] : [row[3], row[4], row[5]],
  };
}

/**
 * One clutch seat as a connector and its tube-seat allowance.
 *
 * The connector's orientation names its outward axis, and the allowance is the
 * nominal stud volume a validated edge may occupy: radius `STUD_RADIUS_LDU`,
 * `STUD_HEIGHT_LDU` deep, centred half that depth inside the seat along -normal.
 * For an underside seat that is the long-standing `[x, y - 2, z]`.
 */
export function compileMeasuredClutch(
  blueprint: MeasuredPartBlueprint,
  bodyBoundsLdu: LduBounds,
  row: MeasuredClutchRow,
  index: number,
): CompiledMeasuredClutch {
  const values = row as readonly number[];
  if (values.length !== 3 && values.length !== 6) {
    fail(
      blueprint,
      index,
      `has ${values.length} values; a row is [x, y, z] for an underside seat or that seat plus an outward axis-unit [nx, ny, nz].`,
    );
  }
  const { positionLdu, normal } = measuredClutchFrame(row);
  const frame = connectorAxisFrame(normal);
  if (frame === undefined) {
    fail(
      blueprint,
      index,
      `faces [${normal.join(", ")}]; a clutch seat's outward normal is one signed coordinate axis.`,
    );
  }
  const seat = positionLdu[frame.axisIndex];
  if (
    !Number.isSafeInteger(seat) ||
    seat < bodyBoundsLdu.min[frame.axisIndex] ||
    seat > bodyBoundsLdu.max[frame.axisIndex]
  ) {
    fail(
      blueprint,
      index,
      `seats at ${AXIS_NAMES[frame.axisIndex]}=${seat}, outside the measured body's ${bodyBoundsLdu.min[frame.axisIndex]} to ${bodyBoundsLdu.max[frame.axisIndex]} range or off the whole-LDU lattice; a seat is a plane of the part.`,
    );
  }
  const portId = `undersideClutch:${index}`;
  const depthOffset = STUD_HEIGHT_LDU / 2;
  return {
    connector: {
      id: portId,
      kind: "undersideClutch",
      geometryRole: "tubeSeat",
      profileId: "stud-tube/1",
      gender: "female",
      positionLdu,
      normal,
      orientationId: frame.orientationId,
      capacity: 1,
      ...(blueprint.clutchSharedCapacityGroupIds?.[index]?.length
        ? { sharedCapacityGroupIds: blueprint.clutchSharedCapacityGroupIds[index] }
        : {}),
      compatibleKinds: ["stud"],
    },
    allowance: {
      id: `tubeSeat:${index}`,
      portId,
      portKind: "undersideClutch",
      incomingPrimitiveTag: "stud",
      centerLdu: [
        positionLdu[0] - normal[0] * depthOffset,
        positionLdu[1] - normal[1] * depthOffset,
        positionLdu[2] - normal[2] * depthOffset,
      ],
      radiusLdu: STUD_RADIUS_LDU,
      maxInsertionDepthLdu: STUD_HEIGHT_LDU,
      requiresValidatedConnection: true,
    },
  };
}
