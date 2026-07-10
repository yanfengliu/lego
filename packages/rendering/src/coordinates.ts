import { UPRIGHT_ORIENTATIONS, type LduVector3 } from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";
import { Matrix4, Vector3 } from "three";

export const THREE_UNITS_PER_LDU = 0.05 as const;

export class RenderTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderTransformError";
  }
}

/** Converts the catalog's -Y-up LDU coordinates into Three.js +Y-up scene units. */
export function lduToThreeVector([x, y, z]: LduVector3): Vector3 {
  return new Vector3(x * THREE_UNITS_PER_LDU, -y * THREE_UNITS_PER_LDU, z * THREE_UNITS_PER_LDU);
}

/**
 * Converts an authoritative rigid transform without making a Three.js object authoritative.
 * C * R * C changes basis between canonical -Y-up and Three.js +Y-up coordinates.
 */
export function lduTransformToThreeMatrix(transform: RigidTransform): Matrix4 {
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (!orientation) {
    throw new RenderTransformError(`Unknown upright orientation: ${transform.orientationId}`);
  }

  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = orientation.matrix;
  const position = lduToThreeVector(transform.positionLdu);

  return new Matrix4().set(
    m11,
    -m12,
    m13,
    position.x,
    -m21,
    m22,
    -m23,
    position.y,
    m31,
    -m32,
    m33,
    position.z,
    0,
    0,
    0,
    1,
  );
}
