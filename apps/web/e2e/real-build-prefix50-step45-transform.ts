import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import { rotateLduVector } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

export function inverseRealBuildPrefix50Step45Transform(transform: RigidTransform): RigidTransform {
  const orientation = PROPER_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (orientation === undefined)
    throw new TypeError(`Unknown proper orientation ${transform.orientationId}.`);
  const matrix = orientation.matrix;
  const inverseMatrix = [
    matrix[0],
    matrix[3],
    matrix[6],
    matrix[1],
    matrix[4],
    matrix[7],
    matrix[2],
    matrix[5],
    matrix[8],
  ];
  const inverse = PROPER_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((value, index) => value === inverseMatrix[index]),
  );
  if (inverse === undefined)
    throw new TypeError("Proper orientations are not closed under inversion.");
  return {
    positionLdu: rotateLduVector(
      inverse.matrix,
      transform.positionLdu.map((value) => -value) as [number, number, number],
    ),
    orientationId: inverse.id,
  };
}
