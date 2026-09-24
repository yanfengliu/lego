import {
  MESH_RENDER_AXIS_SIGNS,
  MESH_RENDER_UNITS_PER_LDU,
  PROPER_ORIENTATIONS,
  type LduVector3,
} from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";
import { Matrix4, Quaternion, Vector3 } from "three";

export const THREE_UNITS_PER_LDU = MESH_RENDER_UNITS_PER_LDU;

/**
 * The basis change from catalog LDU to Three.js scene axes, as the sign each
 * axis takes. LDraw is right-handed with -Y up and Three.js right-handed with
 * +Y up, so the change is the half-turn about X, `(x, y, z) -> (x, -y, -z)`:
 * determinant +1, the rotation Three's own `LDrawLoader` applies with
 * `rotation.x = PI`. It carries the LDraw front (-Z, the way a slope faces)
 * to Three's +Z, toward a default camera.
 *
 * Negating Y alone, which this renderer did until 2026-09-24, is a
 * reflection: every chiral part drew as its opposite hand and every model as
 * its mirror image, while each part still agreed with its own surface. Every
 * conversion below reads these signs, so positions, orientations, vertices,
 * normals and picking cannot disagree about the hand.
 */
export const LDU_TO_THREE_AXIS_SIGNS = MESH_RENDER_AXIS_SIGNS;

export class RenderTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderTransformError";
  }
}

/** A scene coordinate: anything with Three.js `x`, `y` and `z`, such as a ray hit. */
export interface ThreeCoordinates {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** `+ 0` turns the -0 a sign flip makes of a zero coordinate into +0. */
function signed(sign: number, value: number): number {
  return sign * value + 0;
}

/** Converts the catalog's -Y-up LDU coordinates into Three.js +Y-up scene units. */
export function lduToThreeVector([x, y, z]: LduVector3): Vector3 {
  const [sx, sy, sz] = LDU_TO_THREE_AXIS_SIGNS;
  return new Vector3(
    signed(sx, x * THREE_UNITS_PER_LDU),
    signed(sy, y * THREE_UNITS_PER_LDU),
    signed(sz, z * THREE_UNITS_PER_LDU),
  );
}

/**
 * The inverse of `lduToThreeVector`: a scene point, such as where a pick ray
 * hit, in catalog LDU. The basis change is its own inverse, so only the scale
 * is undone.
 */
export function threeToLduVector({ x, y, z }: ThreeCoordinates): LduVector3 {
  const [sx, sy, sz] = LDU_TO_THREE_AXIS_SIGNS;
  return [
    signed(sx, x / THREE_UNITS_PER_LDU),
    signed(sy, y / THREE_UNITS_PER_LDU),
    signed(sz, z / THREE_UNITS_PER_LDU),
  ];
}

/** A direction such as a surface normal in catalog axes, in Three.js axes: the rotation without the scale. */
export function lduDirectionToThree(
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] {
  const [sx, sy, sz] = LDU_TO_THREE_AXIS_SIGNS;
  return [signed(sx, x), signed(sy, y), signed(sz, z)];
}

/** The basis change as a matrix, scale included, for composing with LDU-frame transforms. */
export function lduToThreeBasisMatrix(): Matrix4 {
  const [sx, sy, sz] = LDU_TO_THREE_AXIS_SIGNS;
  return new Matrix4().makeScale(
    sx * THREE_UNITS_PER_LDU,
    sy * THREE_UNITS_PER_LDU,
    sz * THREE_UNITS_PER_LDU,
  );
}

/**
 * Converts a rotation quaternion from the document's LDU frame into Three.js
 * scene axes: the same conjugation `lduTransformToThreeMatrix` applies to a
 * part's rest orientation (`B * R * B`, `B = diag(LDU_TO_THREE_AXIS_SIGNS)`,
 * its own inverse), generalised to a free rotation — a physics body's turn
 * since rest, say — rather than one of the catalog's proper orientations.
 * Points relabel with a direct sign flip (`lduDirectionToThree`); a rotation
 * operator instead needs this conjugation, or a physically correct tip
 * renders backwards.
 */
export function lduRotationToThreeQuaternion(
  rotation: readonly [number, number, number, number],
): Quaternion {
  const [x, y, z, w] = rotation;
  const ldu = new Matrix4().makeRotationFromQuaternion(new Quaternion(x, y, z, w));
  const [s1, s2, s3] = LDU_TO_THREE_AXIS_SIGNS;
  const basis = new Matrix4().makeScale(s1, s2, s3);
  const scene = basis.clone().multiply(ldu).multiply(basis.clone().invert());
  return new Quaternion().setFromRotationMatrix(scene);
}

/**
 * Converts an authoritative rigid transform without making a Three.js object authoritative.
 * `B * R * B` changes the rotation's basis with `B = diag(LDU_TO_THREE_AXIS_SIGNS)`, which is
 * its own inverse; the position goes through `lduToThreeVector`.
 */
export function lduTransformToThreeMatrix(transform: RigidTransform): Matrix4 {
  const orientation = PROPER_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (!orientation) {
    throw new RenderTransformError(`Unknown proper orientation: ${transform.orientationId}`);
  }

  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = orientation.matrix;
  const [s1, s2, s3] = LDU_TO_THREE_AXIS_SIGNS;
  const position = lduToThreeVector(transform.positionLdu);

  return new Matrix4().set(
    s1 * m11 * s1,
    s1 * m12 * s2,
    s1 * m13 * s3,
    position.x,
    s2 * m21 * s1,
    s2 * m22 * s2,
    s2 * m23 * s3,
    position.y,
    s3 * m31 * s1,
    s3 * m32 * s2,
    s3 * m33 * s3,
    position.z,
    0,
    0,
    0,
    1,
  );
}
