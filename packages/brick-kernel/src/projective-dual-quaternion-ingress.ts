import {
  snapshotDenseOwnDataArray,
  snapshotExactOwnDataRecord,
} from "./projective-dual-quaternion-boundary.ts";
import {
  PROJECTIVE_DUAL_QUATERNION_LIMITS,
  createProjectiveDualQuaternion,
  type BigIntQuaternion,
  type BigIntVector3,
  type ProjectiveDualQuaternion,
} from "./projective-dual-quaternion.ts";

/** Limits for an approximate, non-authoritative experiment; never a persistence contract. */
export const EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS = Object.freeze({
  maxInputJsonBytes: 4096,
  maxDecimalCharacters: 96,
  maxMantissaDigits: 32,
  maxAbsoluteExponent: 64,
  maxMatrixMagnitude: 2,
  maxGramResidual: 1e-6,
  maxProjectionShiftLdu: 1e-3,
  quaternionScale: 1_000_000,
  ambiguousTieDistance: 1e-9,
  polarIterations: 16,
} as const);

export interface ExperimentalDecimalRigidTransformInput {
  readonly rotationMatrix: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  readonly positionLdu: readonly [string, string, string];
}

export type DecimalRigidTransformIngressErrorCode =
  | "MALFORMED_DECIMAL"
  | "DECIMAL_LIMIT_EXCEEDED"
  | "SINGULAR_MATRIX"
  | "REFLECTION_MATRIX"
  | "NON_RIGID_MATRIX"
  | "PROJECTION_SHIFT_EXCEEDED"
  | "AMBIGUOUS_QUANTIZATION";

export class DecimalRigidTransformIngressError extends Error {
  public readonly code: DecimalRigidTransformIngressErrorCode;
  public readonly inputLabel: string;

  public constructor(
    code: DecimalRigidTransformIngressErrorCode,
    inputLabel: string,
    problem: string,
    remedy: string,
  ) {
    super(`${inputLabel}: ${problem}; ${remedy}`);
    this.name = "DecimalRigidTransformIngressError";
    this.code = code;
    this.inputLabel = inputLabel;
  }
}

interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

function fail(
  code: DecimalRigidTransformIngressErrorCode,
  inputLabel: string,
  problem: string,
  remedy: string,
): never {
  throw new DecimalRigidTransformIngressError(code, inputLabel, problem, remedy);
}

const rejectIngress = (label: string, problem: string, remedy: string): never =>
  fail("MALFORMED_DECIMAL", label, problem, remedy);

function affineInputData(input: unknown): {
  readonly matrix: readonly unknown[];
  readonly position: readonly unknown[];
} {
  const record = snapshotExactOwnDataRecord(
    input,
    ["rotationMatrix", "positionLdu"],
    "Experimental decimal affine",
    rejectIngress,
  );
  const snapshotTuple = (value: unknown, length: number, label: string) =>
    snapshotDenseOwnDataArray(
      value,
      label,
      {
        exactLength: length,
        maximumLength: length,
        accepts: () => true,
        expectedComponent: "a decimal string",
      },
      rejectIngress,
    );
  return {
    matrix: snapshotTuple(record.rotationMatrix, 9, "Experimental decimal affine.rotationMatrix"),
    position: snapshotTuple(record.positionLdu, 3, "Experimental decimal affine.positionLdu"),
  };
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function rational(numerator: bigint, denominator = 1n): Rational {
  const divisor = gcd(numerator, denominator) || 1n;
  const sign = denominator < 0n ? -1n : 1n;
  return {
    numerator: (sign * numerator) / divisor,
    denominator: absolute(denominator) / divisor,
  };
}

function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function parseDecimal(value: unknown, label: string): Rational {
  if (typeof value !== "string") {
    return fail(
      "MALFORMED_DECIMAL",
      label,
      "coordinate is not a decimal string",
      "supply a bounded base-10 string rather than a JSON number",
    );
  }
  if (value.length > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxDecimalCharacters) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      label,
      `decimal has ${value.length} characters, above the ${EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxDecimalCharacters}-character limit`,
      "shorten the decimal before rigid-transform ingress",
    );
  }
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?)(0|[1-9][0-9]*))?$/.exec(value);
  if (match === null) {
    return fail(
      "MALFORMED_DECIMAL",
      label,
      "coordinate is not a finite bounded decimal with canonical integer digits",
      "remove whitespace, NaN, Infinity, leading zeros, or non-decimal syntax",
    );
  }
  const integerDigits = match[2]!;
  const fractionDigits = match[3] ?? "";
  const mantissaDigits = `${integerDigits}${fractionDigits}`;
  if (mantissaDigits.length > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxMantissaDigits) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      label,
      `mantissa has ${mantissaDigits.length} digits, above the ${EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxMantissaDigits}-digit limit`,
      "round the source decimal deliberately before ingress",
    );
  }
  const exponentMagnitude = Number(match[5] ?? "0");
  if (
    !Number.isSafeInteger(exponentMagnitude) ||
    exponentMagnitude > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxAbsoluteExponent
  ) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      label,
      `decimal exponent exceeds +/-${EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxAbsoluteExponent}`,
      "rescale the source value into the accepted coordinate envelope",
    );
  }
  const exponent = (match[4] === "-" ? -1 : 1) * exponentMagnitude;
  const decimalPlaces = fractionDigits.length - exponent;
  let numerator = BigInt(mantissaDigits) * (match[1] === "-" ? -1n : 1n);
  let denominator = 1n;
  if (decimalPlaces >= 0) denominator = 10n ** BigInt(decimalPlaces);
  else numerator *= 10n ** BigInt(-decimalPlaces);
  return rational(numerator, denominator);
}

function determinantExact(matrix: readonly Rational[]): Rational {
  const [a, b, c, d, e, f, g, h, i] = matrix as readonly [
    Rational,
    Rational,
    Rational,
    Rational,
    Rational,
    Rational,
    Rational,
    Rational,
    Rational,
  ];
  return add(
    subtract(
      multiply(a, subtract(multiply(e, i), multiply(f, h))),
      multiply(b, subtract(multiply(d, i), multiply(f, g))),
    ),
    multiply(c, subtract(multiply(d, h), multiply(e, g))),
  );
}

function rationalToNumber(value: Rational): number {
  return Number(value.numerator) / Number(value.denominator);
}

function determinant(matrix: Matrix3): number {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function inverseTranspose(matrix: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const det = determinant(matrix);
  if (!Number.isFinite(det) || Math.abs(det) < Number.EPSILON) {
    return fail(
      "SINGULAR_MATRIX",
      "rotationMatrix",
      "numeric projection encountered a singular matrix",
      "supply a proper near-orthonormal rotation",
    );
  }
  return [
    (e * i - f * h) / det,
    (f * g - d * i) / det,
    (d * h - e * g) / det,
    (c * h - b * i) / det,
    (a * i - c * g) / det,
    (b * g - a * h) / det,
    (b * f - c * e) / det,
    (c * d - a * f) / det,
    (a * e - b * d) / det,
  ];
}

function gramResidual(matrix: Matrix3): number {
  let residual = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      let dot = 0;
      for (let axis = 0; axis < 3; axis += 1) {
        dot += matrix[axis * 3 + row]! * matrix[axis * 3 + column]!;
      }
      residual = Math.max(residual, Math.abs(dot - (row === column ? 1 : 0)));
    }
  }
  return residual;
}

function projectRotation(matrix: Matrix3, label: string): Matrix3 {
  let projected = matrix;
  for (
    let iteration = 0;
    iteration < EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.polarIterations;
    iteration += 1
  ) {
    const reciprocal = inverseTranspose(projected);
    projected = projected.map(
      (value, index) => (value + reciprocal[index]!) / 2,
    ) as unknown as Matrix3;
  }
  const shift = Math.max(...projected.map((value, index) => Math.abs(value - matrix[index]!)));
  if (shift > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxProjectionShiftLdu) {
    return fail(
      "PROJECTION_SHIFT_EXCEEDED",
      label,
      `nearest rotation moves a unit endpoint by ${shift}, above ${EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxProjectionShiftLdu} LDU`,
      "repair the affine transform instead of projecting a materially different shape",
    );
  }
  return projected;
}

function matrixToQuaternion([m00, m01, m02, m10, m11, m12, m20, m21, m22]: Matrix3): readonly [
  number,
  number,
  number,
  number,
] {
  const trace = m00 + m11 + m22;
  let quaternion: [number, number, number, number];
  if (trace > 0) {
    const scale = 2 * Math.sqrt(trace + 1);
    quaternion = [scale / 4, (m21 - m12) / scale, (m02 - m20) / scale, (m10 - m01) / scale];
  } else if (m00 > m11 && m00 > m22) {
    const scale = 2 * Math.sqrt(1 + m00 - m11 - m22);
    quaternion = [(m21 - m12) / scale, scale / 4, (m01 + m10) / scale, (m02 + m20) / scale];
  } else if (m11 > m22) {
    const scale = 2 * Math.sqrt(1 + m11 - m00 - m22);
    quaternion = [(m02 - m20) / scale, (m01 + m10) / scale, scale / 4, (m12 + m21) / scale];
  } else {
    const scale = 2 * Math.sqrt(1 + m22 - m00 - m11);
    quaternion = [(m10 - m01) / scale, (m02 + m20) / scale, (m12 + m21) / scale, scale / 4];
  }
  const length = Math.hypot(...quaternion);
  quaternion = quaternion.map((component) => component / length) as typeof quaternion;
  const firstNonzero = quaternion.find((component) => component !== 0)!;
  return firstNonzero < 0
    ? (quaternion.map((component) => -component) as typeof quaternion)
    : quaternion;
}

function roundNumberTiesToEven(value: number, label: string): bigint {
  const magnitude = Math.abs(value);
  const floor = Math.floor(magnitude);
  const fraction = magnitude - floor;
  if (Math.abs(fraction - 0.5) < EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.ambiguousTieDistance) {
    return fail(
      "AMBIGUOUS_QUANTIZATION",
      label,
      "binary projection is too close to a half-integer quaternion quantum",
      "provide a higher-confidence source rotation or an exact projective quaternion",
    );
  }
  const rounded = fraction < 0.5 ? floor : floor + 1;
  return BigInt(value < 0 ? -rounded : rounded);
}

function roundRationalTiesToEven(value: Rational, scale: bigint): bigint {
  const sign = value.numerator < 0n ? -1n : 1n;
  const scaled = absolute(value.numerator) * scale;
  let quotient = scaled / value.denominator;
  const doubledRemainder = 2n * (scaled % value.denominator);
  if (
    doubledRemainder > value.denominator ||
    (doubledRemainder === value.denominator && quotient % 2n !== 0n)
  ) {
    quotient += 1n;
  }
  return sign * quotient;
}

/**
 * Approximate experiment only. It uses binary floating-point polar projection and must never
 * author canonical persistence, hashes, migrations, acceptance, or physical claims.
 */
function createFromDetachedDecimalAffine(input: unknown): ProjectiveDualQuaternion {
  const label = "Experimental decimal affine";
  const detached = affineInputData(input);
  const exactMatrix = detached.matrix.map((value, index) =>
    parseDecimal(value, `${label}.rotationMatrix[${index}]`),
  );
  const exactDeterminant = determinantExact(exactMatrix);
  if (exactDeterminant.numerator === 0n) {
    return fail(
      "SINGULAR_MATRIX",
      `${label}.rotationMatrix`,
      "matrix determinant is exactly zero",
      "supply a proper non-singular rotation",
    );
  }
  if (exactDeterminant.numerator < 0n) {
    return fail(
      "REFLECTION_MATRIX",
      `${label}.rotationMatrix`,
      "matrix determinant is negative and encodes a reflection",
      "supply a right-handed proper rotation",
    );
  }
  const matrix = exactMatrix.map(rationalToNumber) as unknown as Matrix3;
  if (
    matrix.some(
      (value) =>
        !Number.isFinite(value) ||
        Math.abs(value) > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxMatrixMagnitude,
    )
  ) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      `${label}.rotationMatrix`,
      `matrix magnitude exceeds ${EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxMatrixMagnitude}`,
      "supply a normalized near-rigid rotation",
    );
  }
  const projected = projectRotation(matrix, `${label}.rotationMatrix`);
  const residual = gramResidual(matrix);
  if (residual > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxGramResidual) {
    return fail(
      "NON_RIGID_MATRIX",
      `${label}.rotationMatrix`,
      `Gram residual ${residual} exceeds ${EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxGramResidual}`,
      "remove scale or shear before rigid-transform ingress",
    );
  }
  const rotation = matrixToQuaternion(projected).map((component, index) =>
    roundNumberTiesToEven(
      component * EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.quaternionScale,
      `${label}.rotationQuaternion[${index}]`,
    ),
  ) as unknown as BigIntQuaternion;
  const exactPosition = detached.position.map((value, index) =>
    parseDecimal(value, `${label}.positionLdu[${index}]`),
  );
  if (
    exactPosition.some(
      (coordinate) =>
        absolute(coordinate.numerator) * 1_000_000n >
        PROJECTIVE_DUAL_QUATERNION_LIMITS.maxPositionMicroLdu * coordinate.denominator,
    )
  ) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      `${label}.positionLdu`,
      "position exceeds the projective transform coordinate envelope",
      "move it within +/-10,000,000 LDU",
    );
  }
  const position = exactPosition.map((value) =>
    roundRationalTiesToEven(value, 1_000_000n),
  ) as unknown as BigIntVector3;
  return createProjectiveDualQuaternion(...rotation, ...position);
}

/**
 * Experimental approximate bridge from bounded JSON text. Floating-point projection may vary
 * across runtimes, so its result is never authoritative canonical persistence.
 */
export function createExperimentalProjectiveDualQuaternionFromDecimalAffineJson(
  json: string,
): ProjectiveDualQuaternion {
  if (typeof json !== "string") {
    return fail(
      "MALFORMED_DECIMAL",
      "Experimental decimal affine JSON",
      "payload is not JSON text",
      "supply bounded UTF-8 JSON text",
    );
  }
  if (json.length > EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxInputJsonBytes) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      "Experimental decimal affine JSON",
      "text length exceeds the byte cap before UTF-8 inspection",
      "send one bounded affine value",
    );
  }
  if (
    new TextEncoder().encode(json).byteLength >
    EXPERIMENTAL_DECIMAL_RIGID_TRANSFORM_LIMITS.maxInputJsonBytes
  ) {
    return fail(
      "DECIMAL_LIMIT_EXCEEDED",
      "Experimental decimal affine JSON",
      "UTF-8 payload exceeds the byte cap",
      "send one bounded affine value",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return fail(
      "MALFORMED_DECIMAL",
      "Experimental decimal affine JSON",
      "payload is not valid JSON",
      "encode rotationMatrix and positionLdu as string tuples",
    );
  }
  return createFromDetachedDecimalAffine(parsed);
}
