import { connectorAxisFrame } from "./connector-axis.ts";
import { STUD_HEIGHT_LDU, STUD_RADIUS_LDU } from "./constants.ts";
import type { MeasuredPartBlueprint, MeasuredStudRow } from "./measured-part-types.ts";
import type { CollisionCylinder, ConnectorPortDefinition, LduBounds, LduVector3 } from "./types.ts";

export interface CompiledMeasuredStud {
  readonly connector: ConnectorPortDefinition;
  readonly primitive: CollisionCylinder;
}

export const NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE = "nominal-stud-tube/1";

/**
 * Maximum radial error introduced when a unit-circle coordinate rounded to
 * four decimal places is scaled by the nominal stud radius. Both coordinates
 * may move by 0.00005, hence the Euclidean sqrt(2) factor.
 */
export const NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU =
  STUD_RADIUS_LDU * Math.SQRT2 * 0.00005;

/**
 * Whether a source-authored stud sits on a centre-line-exposed outward face of
 * the measured body.
 *
 * A stud-bearing deck need not be the part's global extremum. 11253's roller
 * rises above its shoe deck, so the stud seats at y=-4 while the body reaches
 * y=-7. The conservative collision height field still supplies a local face at
 * the stud centre; requiring that face keeps a floating stud impossible without
 * pretending every irregular part is one box.
 */
export function studSeatTouchesOutwardBoxFace(
  bodyBoxesLdu: readonly LduBounds[],
  positionLdu: LduVector3,
  normal: LduVector3,
): boolean {
  const frame = connectorAxisFrame(normal);
  if (frame === undefined) return false;
  const tangentAxes = ([0, 1, 2] as const).filter((axis) => axis !== frame.axisIndex);
  const supportsSeat = bodyBoxesLdu.some((box) => {
    const face = frame.sign < 0 ? box.min[frame.axisIndex] : box.max[frame.axisIndex];
    return (
      face === positionLdu[frame.axisIndex] &&
      tangentAxes.every(
        (axis) => positionLdu[axis] > box.min[axis] && positionLdu[axis] < box.max[axis],
      )
    );
  });
  if (!supportsSeat) return false;

  // A second box may occupy the stud's outward half-line, which would make the
  // selected support face internal or leave a disconnected obstruction beyond it.
  // This proves only centre-line exposure; the source-authored stud mesh and
  // its integrity pin remain the evidence for the full-radius surface.
  return !bodyBoxesLdu.some((box) => {
    if (
      !tangentAxes.every(
        (axis) => positionLdu[axis] > box.min[axis] && positionLdu[axis] < box.max[axis],
      )
    ) {
      return false;
    }
    const minimum = box.min[frame.axisIndex];
    const seat = positionLdu[frame.axisIndex];
    return frame.sign < 0 ? minimum < seat : box.max[frame.axisIndex] > seat;
  });
}

function fail(blueprint: MeasuredPartBlueprint, index: number, message: string): never {
  throw new Error(
    `Measured part ${blueprint.designId} (${blueprint.ldrawId}) stud ${index} ${message}`,
  );
}

export function compileMeasuredStud(
  blueprint: MeasuredPartBlueprint,
  bodyBoxesLdu: readonly LduBounds[],
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
  const globalFace =
    frame.sign < 0
      ? Math.min(...bodyBoxesLdu.map(({ min }) => min[frame.axisIndex]))
      : Math.max(...bodyBoxesLdu.map(({ max }) => max[frame.axisIndex]));
  if (
    positionLdu[frame.axisIndex] !== globalFace &&
    !studSeatTouchesOutwardBoxFace(bodyBoxesLdu, positionLdu, normal)
  ) {
    fail(
      blueprint,
      index,
      `seats at [${positionLdu.join(", ")}] with outward normal [${normal.join(", ")}], but no measured body collision box supplies an exposed local ${frame.axis}-face at the stud centre.`,
    );
  }

  let validatedConnectionProfileRadiusLdu: number | undefined;
  if (blueprint.validatedConnectionStudProfile !== undefined) {
    if (
      blueprint.validatedConnectionStudProfile !== NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE
    ) {
      fail(
        blueprint,
        index,
        `names validated connection profile ${JSON.stringify(blueprint.validatedConnectionStudProfile)}; the only admitted measured-stud normalization is ${NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE}.`,
      );
    }
    const roundingDeltaLdu = radiusLdu - STUD_RADIUS_LDU;
    if (
      heightLdu !== STUD_HEIGHT_LDU ||
      roundingDeltaLdu < 0 ||
      roundingDeltaLdu > NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU
    ) {
      fail(
        blueprint,
        index,
        `measures radius ${radiusLdu} and height ${heightLdu} LDU, but ${NOMINAL_STUD_TUBE_VALIDATED_CONNECTION_PROFILE} requires height ${STUD_HEIGHT_LDU}, radius at least the nominal ${STUD_RADIUS_LDU}, and a source rounding delta no greater than ${NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU} LDU; observed delta ${roundingDeltaLdu}.`,
      );
    }
    validatedConnectionProfileRadiusLdu = STUD_RADIUS_LDU;
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
      ...(validatedConnectionProfileRadiusLdu === undefined
        ? {}
        : { validatedConnectionProfileRadiusLdu }),
      heightLdu,
    },
  };
}
