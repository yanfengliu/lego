import {
  snapshotDenseOwnDataArray,
  snapshotExactOwnDataRecord,
} from "./projective-dual-quaternion-boundary.ts";

/** Experimental wire identifier only; this is not a product persistence or schema contract. */
export const PROJECTIVE_DUAL_QUATERNION_VERSION =
  "lego.experimental-projective-dual-quaternion/1" as const;

export const PROJECTIVE_DUAL_QUATERNION_LIMITS = Object.freeze({
  maxRealComponentBits: 1024,
  maxDualComponentBits: 1088,
  maxRealComponentCharacters: 310,
  maxDualComponentCharacters: 329,
  maxIntermediateBits: 3200,
  maxCompositionChainLength: 32,
  maxWireJsonBytes: 8192,
  maxPositionMicroLdu: 10_000_000_000_000n,
} as const);

export type BigIntQuaternion = readonly [bigint, bigint, bigint, bigint];
export type BigIntVector3 = readonly [bigint, bigint, bigint];

export interface ProjectiveDualQuaternion {
  readonly real: BigIntQuaternion;
  readonly dual: BigIntQuaternion;
}

export interface ProjectiveDualQuaternionWireV1 {
  readonly schemaVersion: typeof PROJECTIVE_DUAL_QUATERNION_VERSION;
  readonly real: readonly [string, string, string, string];
  readonly dual: readonly [string, string, string, string];
}

export interface RationalMicroLduVector3 {
  readonly numerator: BigIntVector3;
  readonly denominator: bigint;
}

export type ProjectiveDualQuaternionErrorCode =
  | "MALFORMED_VALUE"
  | "MALFORMED_WIRE"
  | "NON_CANONICAL_INTEGER"
  | "COMPONENT_LIMIT_EXCEEDED"
  | "ZERO_ROTATION"
  | "NON_PRIMITIVE_TRANSFORM"
  | "NON_CANONICAL_SIGN"
  | "STUDY_CONDITION_FAILED"
  | "POSITION_LIMIT_EXCEEDED"
  | "COMPOSITION_CHAIN_LIMIT_EXCEEDED"
  | "TRANSFORM_COMPLEXITY_EXCEEDED";

export class ProjectiveDualQuaternionError extends Error {
  public readonly code: ProjectiveDualQuaternionErrorCode;
  public readonly inputLabel: string;

  public constructor(
    code: ProjectiveDualQuaternionErrorCode,
    inputLabel: string,
    problem: string,
    remedy: string,
  ) {
    super(`${inputLabel}: ${problem}; ${remedy}`);
    this.name = "ProjectiveDualQuaternionError";
    this.code = code;
    this.inputLabel = inputLabel;
  }
}

function fail(
  code: ProjectiveDualQuaternionErrorCode,
  inputLabel: string,
  problem: string,
  remedy: string,
): never {
  throw new ProjectiveDualQuaternionError(code, inputLabel, problem, remedy);
}

const rejectMalformed = (label: string, problem: string, remedy: string): never =>
  fail("MALFORMED_VALUE", label, problem, remedy);

function snapshotBigIntTuple(value: unknown, length: 4, label: string): readonly bigint[] {
  return snapshotDenseOwnDataArray(
    value,
    label,
    {
      exactLength: length,
      maximumLength: length,
      accepts: (component) => typeof component === "bigint",
      expectedComponent: "a bigint",
    },
    rejectMalformed,
  ) as readonly bigint[];
}

function requireBigInt(value: unknown, label: string): bigint {
  if (typeof value !== "bigint") {
    return fail("MALFORMED_VALUE", label, "component is not a bigint", "supply a bigint primitive");
  }
  return value;
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

function componentGcd(components: readonly bigint[]): bigint {
  return components.reduce(gcd, 0n) || 1n;
}

function bitLength(value: bigint): number {
  return absolute(value).toString(2).length;
}

function maximumBitLength(values: readonly bigint[]): number {
  return Math.max(...values.map(bitLength));
}

function quaternion(values: readonly bigint[]): BigIntQuaternion {
  return Object.freeze([values[0]!, values[1]!, values[2]!, values[3]!]);
}

function inputQuaternion(
  w: unknown,
  x: unknown,
  y: unknown,
  z: unknown,
  label: string,
): BigIntQuaternion {
  return quaternion([
    requireBigInt(w, `${label}.w`),
    requireBigInt(x, `${label}.x`),
    requireBigInt(y, `${label}.y`),
    requireBigInt(z, `${label}.z`),
  ]);
}

const trustedTransforms = new WeakSet<object>();

function freezeTransform(
  realValues: readonly bigint[],
  dualValues: readonly bigint[],
): ProjectiveDualQuaternion {
  const transform = Object.freeze({ real: quaternion(realValues), dual: quaternion(dualValues) });
  trustedTransforms.add(transform);
  return transform;
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

function conjugate([w, x, y, z]: BigIntQuaternion): BigIntQuaternion {
  return [w, -x, -y, -z];
}

function normSquared(values: BigIntQuaternion): bigint {
  return values.reduce((total, value) => total + value * value, 0n);
}

function studyDot(real: BigIntQuaternion, dual: BigIntQuaternion): bigint {
  return real.reduce((total, value, index) => total + value * dual[index]!, 0n);
}

function translationNumerator(real: BigIntQuaternion, dual: BigIntQuaternion): BigIntQuaternion {
  const product = multiplyQuaternion(dual, conjugate(real));
  return [2n * product[0], 2n * product[1], 2n * product[2], 2n * product[3]];
}

function assertCanonicalSnapshot(value: ProjectiveDualQuaternion, label: string): void {
  if (value.real.every((component) => component === 0n)) {
    return fail("ZERO_ROTATION", label, "real quaternion is zero", "supply a nonzero rotation");
  }
  if (maximumBitLength(value.real) > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxRealComponentBits) {
    return fail(
      "COMPONENT_LIMIT_EXCEEDED",
      label,
      `a real component exceeds ${PROJECTIVE_DUAL_QUATERNION_LIMITS.maxRealComponentBits} bits`,
      "reduce transform complexity",
    );
  }
  if (maximumBitLength(value.dual) > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxDualComponentBits) {
    return fail(
      "COMPONENT_LIMIT_EXCEEDED",
      label,
      `a dual component exceeds ${PROJECTIVE_DUAL_QUATERNION_LIMITS.maxDualComponentBits} bits`,
      "reduce transform complexity",
    );
  }
  if (componentGcd([...value.real, ...value.dual]) !== 1n) {
    return fail(
      "NON_PRIMITIVE_TRANSFORM",
      label,
      "components have a common factor",
      "divide all eight by their positive greatest common divisor",
    );
  }
  if (value.real.find((component) => component !== 0n)! < 0n) {
    return fail(
      "NON_CANONICAL_SIGN",
      label,
      "projective sign is negative",
      "negate all eight components",
    );
  }
  if (studyDot(value.real, value.dual) !== 0n) {
    return fail(
      "STUDY_CONDITION_FAILED",
      label,
      "Study inner product is nonzero",
      "encode dual = translationQuaternion * real / 2",
    );
  }
  const translated = translationNumerator(value.real, value.dual);
  const denominator = normSquared(value.real);
  const bound = PROJECTIVE_DUAL_QUATERNION_LIMITS.maxPositionMicroLdu * denominator;
  if (translated.slice(1).some((component) => absolute(component) > bound)) {
    return fail(
      "POSITION_LIMIT_EXCEEDED",
      label,
      "translation exceeds the micro-LDU coordinate envelope",
      "move the transform inside the bounded envelope",
    );
  }
}

function snapshotTrustedTransform(value: unknown, label: string): ProjectiveDualQuaternion {
  if (typeof value !== "object" || value === null || !trustedTransforms.has(value)) {
    return fail(
      "MALFORMED_VALUE",
      label,
      "transform was not created by this experimental module",
      "use its constructor or JSON decoder before algebra or encoding",
    );
  }
  const record = snapshotExactOwnDataRecord(value, ["real", "dual"], label, rejectMalformed);
  const result = freezeTransform(
    snapshotBigIntTuple(record.real, 4, `${label}.real`),
    snapshotBigIntTuple(record.dual, 4, `${label}.dual`),
  );
  assertCanonicalSnapshot(result, label);
  return result;
}

export function assertCanonicalProjectiveDualQuaternion(value: ProjectiveDualQuaternion): void {
  snapshotTrustedTransform(value, "Transform");
}

export function snapshotCanonicalProjectiveDualQuaternion(
  value: ProjectiveDualQuaternion,
): ProjectiveDualQuaternion {
  return snapshotTrustedTransform(value, "Transform");
}

export function createCanonicalProjectiveDualQuaternionFromScalars(
  realW: bigint,
  realX: bigint,
  realY: bigint,
  realZ: bigint,
  dualW: bigint,
  dualX: bigint,
  dualY: bigint,
  dualZ: bigint,
): ProjectiveDualQuaternion {
  const result = freezeTransform(
    inputQuaternion(realW, realX, realY, realZ, "Transform.real"),
    inputQuaternion(dualW, dualX, dualY, dualZ, "Transform.dual"),
  );
  assertCanonicalSnapshot(result, "Transform");
  return result;
}

function canonicalizeRaw(
  realValues: BigIntQuaternion,
  dualValues: BigIntQuaternion,
  label: string,
): ProjectiveDualQuaternion {
  if (realValues.every((component) => component === 0n)) {
    return fail("ZERO_ROTATION", label, "real quaternion is zero", "supply a nonzero rotation");
  }
  const divisor = componentGcd([...realValues, ...dualValues]);
  let components = [...realValues, ...dualValues].map((component) => component / divisor);
  if (components.slice(0, 4).find((component) => component !== 0n)! < 0n) {
    components = components.map((component) => -component);
  }
  const result = freezeTransform(components.slice(0, 4), components.slice(4, 8));
  assertCanonicalSnapshot(result, label);
  return result;
}

export function canonicalizeProjectiveDualQuaternion(
  realW: bigint,
  realX: bigint,
  realY: bigint,
  realZ: bigint,
  dualW: bigint,
  dualX: bigint,
  dualY: bigint,
  dualZ: bigint,
): ProjectiveDualQuaternion {
  const real = inputQuaternion(realW, realX, realY, realZ, "Transform.real");
  const dual = inputQuaternion(dualW, dualX, dualY, dualZ, "Transform.dual");
  if (
    maximumBitLength([...real, ...dual]) > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxIntermediateBits
  ) {
    return fail(
      "TRANSFORM_COMPLEXITY_EXCEEDED",
      "Transform",
      "an input exceeds the canonicalization bit budget",
      "reduce it before canonicalization",
    );
  }
  return canonicalizeRaw(real, dual, "Transform");
}

export function createProjectiveDualQuaternion(
  rotationW: bigint,
  rotationX: bigint,
  rotationY: bigint,
  rotationZ: bigint,
  positionXMicroLdu: bigint,
  positionYMicroLdu: bigint,
  positionZMicroLdu: bigint,
): ProjectiveDualQuaternion {
  const rotationInput = inputQuaternion(rotationW, rotationX, rotationY, rotationZ, "Rotation");
  const position: BigIntVector3 = Object.freeze([
    requireBigInt(positionXMicroLdu, "Position.x"),
    requireBigInt(positionYMicroLdu, "Position.y"),
    requireBigInt(positionZMicroLdu, "Position.z"),
  ]);
  if (maximumBitLength(rotationInput) > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxIntermediateBits) {
    return fail(
      "TRANSFORM_COMPLEXITY_EXCEEDED",
      "Rotation",
      "a component exceeds the construction bit budget",
      "reduce the projective rotation",
    );
  }
  if (
    position.some(
      (coordinate) => absolute(coordinate) > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxPositionMicroLdu,
    )
  ) {
    return fail(
      "POSITION_LIMIT_EXCEEDED",
      "Position",
      "a coordinate exceeds the micro-LDU envelope",
      "move it inside the bounded envelope",
    );
  }
  const divisor = componentGcd(rotationInput);
  let reduced = rotationInput.map((component) => component / divisor);
  const first = reduced.find((component) => component !== 0n);
  if (first === undefined) {
    return fail("ZERO_ROTATION", "Rotation", "rotation is zero", "supply a nonzero quaternion");
  }
  if (first < 0n) reduced = reduced.map((component) => -component);
  const rotation = quaternion(reduced);
  const predictedBits = maximumBitLength(rotation) + maximumBitLength(position) + 2;
  if (predictedBits > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxIntermediateBits) {
    return fail(
      "TRANSFORM_COMPLEXITY_EXCEEDED",
      "Transform",
      `construction can require ${predictedBits} intermediate bits`,
      "reduce the rotation or position",
    );
  }
  const translation: BigIntQuaternion = [0n, position[0], position[1], position[2]];
  return canonicalizeRaw(
    quaternion(rotation.map((component) => 2n * component)),
    multiplyQuaternion(translation, rotation),
    "Transform",
  );
}

function composeSnapshots(
  parent: ProjectiveDualQuaternion,
  local: ProjectiveDualQuaternion,
): ProjectiveDualQuaternion {
  const realBits = maximumBitLength(parent.real) + maximumBitLength(local.real) + 2;
  const dualBits =
    Math.max(
      maximumBitLength(parent.real) + maximumBitLength(local.dual),
      maximumBitLength(parent.dual) + maximumBitLength(local.real),
    ) + 3;
  if (Math.max(realBits, dualBits) > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxIntermediateBits) {
    return fail(
      "TRANSFORM_COMPLEXITY_EXCEEDED",
      "Composition",
      "intermediate exceeds the composition bit budget",
      "split or reduce the exact derivation",
    );
  }
  const real = multiplyQuaternion(parent.real, local.real);
  const leftDual = multiplyQuaternion(parent.real, local.dual);
  const rightDual = multiplyQuaternion(parent.dual, local.real);
  const dual = quaternion(leftDual.map((component, index) => component + rightDual[index]!));
  return canonicalizeRaw(real, dual, "Composition");
}

export function composeProjectiveDualQuaternions(
  parentValue: ProjectiveDualQuaternion,
  localValue: ProjectiveDualQuaternion,
): ProjectiveDualQuaternion {
  return composeSnapshots(
    snapshotTrustedTransform(parentValue, "Parent transform"),
    snapshotTrustedTransform(localValue, "Local transform"),
  );
}

export function composeProjectiveDualQuaternionChain(
  ...transformValues: readonly ProjectiveDualQuaternion[]
): ProjectiveDualQuaternion {
  if (
    transformValues.length === 0 ||
    transformValues.length > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxCompositionChainLength
  ) {
    return fail(
      "COMPOSITION_CHAIN_LIMIT_EXCEEDED",
      "Transform chain",
      "chain length is outside 1..32",
      "supply 1..32 module-created transforms",
    );
  }
  const transforms = transformValues.map((value, index) =>
    snapshotTrustedTransform(value, `Transform chain[${index}]`),
  );
  let result = transforms[0]!;
  for (let index = 1; index < transforms.length; index += 1) {
    result = composeSnapshots(result, transforms[index]!);
  }
  return result;
}

export function invertProjectiveDualQuaternion(
  transformValue: ProjectiveDualQuaternion,
): ProjectiveDualQuaternion {
  const transform = snapshotTrustedTransform(transformValue, "Inverse transform");
  const realBits = maximumBitLength(transform.real);
  const dualBits = maximumBitLength(transform.dual);
  const predictedBits = Math.max(3 * realBits + 2, 2 * realBits + dualBits + 4);
  if (predictedBits > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxIntermediateBits) {
    return fail(
      "TRANSFORM_COMPLEXITY_EXCEEDED",
      "Inverse transform",
      "intermediate exceeds the inverse bit budget",
      "reduce the exact transform",
    );
  }
  const conjugated = conjugate(transform.real);
  const norm = normSquared(transform.real);
  const dual = quaternion(
    multiplyQuaternion(multiplyQuaternion(conjugated, transform.dual), conjugated).map(
      (component) => -component,
    ),
  );
  return canonicalizeRaw(
    quaternion(conjugated.map((component) => norm * component)),
    dual,
    "Inverse transform",
  );
}

export function extractProjectiveDualQuaternionTranslation(
  transformValue: ProjectiveDualQuaternion,
): RationalMicroLduVector3 {
  const transform = snapshotTrustedTransform(transformValue, "Transform");
  const translated = translationNumerator(transform.real, transform.dual);
  const denominator = normSquared(transform.real);
  const divisor = componentGcd([...translated.slice(1), denominator]);
  return Object.freeze({
    numerator: Object.freeze([
      translated[1] / divisor,
      translated[2] / divisor,
      translated[3] / divisor,
    ]) as BigIntVector3,
    denominator: denominator / divisor,
  });
}
