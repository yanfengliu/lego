import type { BigIntQuaternion, ProjectiveDualQuaternion } from "./projective-dual-quaternion.ts";

export type ProjectiveMatrix4 = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
];

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function multiplyQuaternion(
  [w, x, y, z]: BigIntQuaternion,
  [otherW, otherX, otherY, otherZ]: BigIntQuaternion,
): BigIntQuaternion {
  return [
    w * otherW - x * otherX - y * otherY - z * otherZ,
    w * otherX + x * otherW + y * otherZ - z * otherY,
    w * otherY - x * otherZ + y * otherW + z * otherX,
    w * otherZ + x * otherY - y * otherX + z * otherW,
  ];
}

export function canonicalProjectiveMatrix(values: readonly bigint[]): ProjectiveMatrix4 {
  const divisor = values.reduce(gcd, 0n) || 1n;
  let normalized = values.map((value) => value / divisor);
  const last = normalized[15]!;
  if (last < 0n) normalized = normalized.map((value) => -value);
  return normalized as unknown as ProjectiveMatrix4;
}

export function dualQuaternionToProjectiveMatrix(
  transform: ProjectiveDualQuaternion,
): ProjectiveMatrix4 {
  const [w, x, y, z] = transform.real;
  const norm = w * w + x * x + y * y + z * z;
  const translated = multiplyQuaternion(transform.dual, [w, -x, -y, -z]).map((value) => 2n * value);
  if (translated[0] !== 0n) throw new Error("test oracle received a non-Study transform");
  return canonicalProjectiveMatrix([
    w * w + x * x - y * y - z * z,
    2n * (x * y - w * z),
    2n * (x * z + w * y),
    translated[1]!,
    2n * (x * y + w * z),
    w * w - x * x + y * y - z * z,
    2n * (y * z - w * x),
    translated[2]!,
    2n * (x * z - w * y),
    2n * (y * z + w * x),
    w * w - x * x - y * y + z * z,
    translated[3]!,
    0n,
    0n,
    0n,
    norm,
  ]);
}

export function composeProjectiveMatrices(
  parent: ProjectiveMatrix4,
  local: ProjectiveMatrix4,
): ProjectiveMatrix4 {
  const product: bigint[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let value = 0n;
      for (let axis = 0; axis < 4; axis += 1) {
        value += parent[row * 4 + axis]! * local[axis * 4 + column]!;
      }
      product.push(value);
    }
  }
  return canonicalProjectiveMatrix(product);
}
