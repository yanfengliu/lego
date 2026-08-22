import { connectorAxisFrame } from "./connector-axis.ts";
import type { MeasuredPartBlueprint, MeasuredStudRow } from "./measured-part-types.ts";
import type { CollisionCylinder, ConnectorPortDefinition, LduBounds, LduVector3 } from "./types.ts";

export interface CompiledMeasuredStud {
  readonly connector: ConnectorPortDefinition;
  readonly primitive: CollisionCylinder;
}

function fail(blueprint: MeasuredPartBlueprint, index: number, message: string): never {
  throw new Error(
    `Measured part ${blueprint.designId} (${blueprint.ldrawId}) stud ${index} ${message}`,
  );
}

export function compileMeasuredStud(
  blueprint: MeasuredPartBlueprint,
  bodyBoundsLdu: LduBounds,
  row: MeasuredStudRow,
  index: number,
): CompiledMeasuredStud {
  const values = row as readonly number[];
  if (values.length !== 5 && values.length !== 8) {
    fail(
      blueprint,
      index,
      `has ${values.length} values; a row is [x, y, z, radius, height] or that tuple plus an outward axis-unit [nx, ny, nz].`,
    );
  }
  const x = values[0]!;
  const y = values[1]!;
  const z = values[2]!;
  const radiusLdu = values[3]!;
  const heightLdu = values[4]!;
  const positionLdu: LduVector3 = [x, y, z];
  const normal: LduVector3 =
    values.length === 5 ? [0, -1, 0] : [values[5]!, values[6]!, values[7]!];
  const frame = connectorAxisFrame(normal);
  if (!positionLdu.every(Number.isSafeInteger) || frame === undefined) {
    fail(
      blueprint,
      index,
      `seats at [${positionLdu.join(", ")}] with normal [${normal.join(", ")}]; the seat is whole LDU and the outward normal is one signed coordinate axis.`,
    );
  }
  const expectedSeat =
    frame.sign < 0 ? bodyBoundsLdu.min[frame.axisIndex] : bodyBoundsLdu.max[frame.axisIndex];
  if (positionLdu[frame.axisIndex] !== expectedSeat) {
    fail(
      blueprint,
      index,
      `seats at ${frame.axis}=${positionLdu[frame.axisIndex]} but outward normal [${normal.join(", ")}] requires the represented body face at ${frame.axis}=${expectedSeat}.`,
    );
  }
  if (
    !Number.isFinite(radiusLdu) ||
    !Number.isFinite(heightLdu) ||
    radiusLdu <= 0 ||
    heightLdu <= 0
  ) {
    fail(
      blueprint,
      index,
      `measures radius ${radiusLdu} and height ${heightLdu} LDU; both must be positive finite numbers.`,
    );
  }

  const id = `stud:${index}`;
  return {
    connector: {
      id,
      kind: "stud",
      geometryRole: "stud",
      profileId: "stud-tube/1",
      gender: "male",
      positionLdu,
      normal,
      orientationId: frame.orientationId,
      capacity: 1,
      compatibleKinds: ["undersideClutch"],
    },
    primitive: {
      id,
      kind: "cylinder",
      tag: "stud",
      axis: frame.axis,
      centerLdu: [
        x + (normal[0] * heightLdu) / 2,
        y + (normal[1] * heightLdu) / 2,
        z + (normal[2] * heightLdu) / 2,
      ],
      radiusLdu,
      heightLdu,
    },
  };
}
