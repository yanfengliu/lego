import {
  snapshotDenseOwnDataArray,
  snapshotExactOwnDataRecord,
} from "./projective-dual-quaternion-boundary.ts";
import {
  PROJECTIVE_DUAL_QUATERNION_LIMITS,
  PROJECTIVE_DUAL_QUATERNION_VERSION,
  ProjectiveDualQuaternionError,
  createCanonicalProjectiveDualQuaternionFromScalars,
  extractProjectiveDualQuaternionTranslation,
  snapshotCanonicalProjectiveDualQuaternion,
  type BigIntQuaternion,
  type ProjectiveDualQuaternion,
  type ProjectiveDualQuaternionErrorCode,
  type ProjectiveDualQuaternionWireV1,
} from "./projective-dual-quaternion.ts";

export interface ApproximateDualQuaternionTransform {
  readonly rotationMatrix: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  readonly positionMicroLdu: readonly [number, number, number];
}

function fail(
  code: ProjectiveDualQuaternionErrorCode,
  inputLabel: string,
  problem: string,
  remedy: string,
): never {
  throw new ProjectiveDualQuaternionError(code, inputLabel, problem, remedy);
}

const rejectWire = (label: string, problem: string, remedy: string): never =>
  fail("MALFORMED_WIRE", label, problem, remedy);

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bitLength(value: bigint): number {
  return absolute(value).toString(2).length;
}

function quaternion(values: readonly bigint[]): BigIntQuaternion {
  return Object.freeze([values[0]!, values[1]!, values[2]!, values[3]!]);
}

function parseComponent(
  value: unknown,
  label: string,
  maxCharacters: number,
  maxBits: number,
): bigint {
  if (typeof value !== "string") {
    return fail(
      "NON_CANONICAL_INTEGER",
      label,
      "component is not a decimal string",
      "supply inert JSON string data",
    );
  }
  if (value.length > maxCharacters) {
    return fail(
      "COMPONENT_LIMIT_EXCEEDED",
      label,
      `component exceeds the ${maxCharacters}-character cap`,
      "reduce it before integer validation",
    );
  }
  if (!/^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(value)) {
    return fail(
      "NON_CANONICAL_INTEGER",
      label,
      "component is not a canonical decimal integer string",
      "remove whitespace, plus, exponent, negative zero, or leading zeros",
    );
  }
  const parsed = BigInt(value);
  if (bitLength(parsed) > maxBits) {
    return fail(
      "COMPONENT_LIMIT_EXCEEDED",
      label,
      `component exceeds ${maxBits} bits`,
      "reduce transform complexity before decoding",
    );
  }
  return parsed;
}

function parseWireTuple(
  value: unknown,
  label: string,
  maxCharacters: number,
  maxBits: number,
): BigIntQuaternion {
  const snapshot = snapshotDenseOwnDataArray(
    value,
    label,
    {
      exactLength: 4,
      maximumLength: 4,
      accepts: () => true,
      expectedComponent: "a decimal string",
    },
    rejectWire,
  );
  return quaternion(
    snapshot.map((component, index) =>
      parseComponent(component, `${label}[${index}]`, maxCharacters, maxBits),
    ),
  );
}

/** Object form is for already-detached inert data; hostile byte input must use the JSON decoder. */
function parseDetachedProjectiveDualQuaternionWire(value: unknown): ProjectiveDualQuaternion {
  const wire = snapshotExactOwnDataRecord(
    value,
    ["schemaVersion", "real", "dual"],
    "Detached transform wire",
    rejectWire,
  );
  if (wire.schemaVersion !== PROJECTIVE_DUAL_QUATERNION_VERSION) {
    return fail(
      "MALFORMED_WIRE",
      "Detached transform wire.schemaVersion",
      "schema version does not exactly match this experimental codec",
      `use the literal ${PROJECTIVE_DUAL_QUATERNION_VERSION}`,
    );
  }
  const real = parseWireTuple(
    wire.real,
    "Detached transform wire.real",
    PROJECTIVE_DUAL_QUATERNION_LIMITS.maxRealComponentCharacters,
    PROJECTIVE_DUAL_QUATERNION_LIMITS.maxRealComponentBits,
  );
  const dual = parseWireTuple(
    wire.dual,
    "Detached transform wire.dual",
    PROJECTIVE_DUAL_QUATERNION_LIMITS.maxDualComponentCharacters,
    PROJECTIVE_DUAL_QUATERNION_LIMITS.maxDualComponentBits,
  );
  return createCanonicalProjectiveDualQuaternionFromScalars(...real, ...dual);
}

export function projectiveDualQuaternionToWire(
  transformValue: ProjectiveDualQuaternion,
): ProjectiveDualQuaternionWireV1 {
  const transform = snapshotCanonicalProjectiveDualQuaternion(transformValue);
  return Object.freeze({
    schemaVersion: PROJECTIVE_DUAL_QUATERNION_VERSION,
    real: Object.freeze(
      transform.real.map((value) => value.toString()),
    ) as unknown as ProjectiveDualQuaternionWireV1["real"],
    dual: Object.freeze(
      transform.dual.map((value) => value.toString()),
    ) as unknown as ProjectiveDualQuaternionWireV1["dual"],
  });
}

export function encodeProjectiveDualQuaternionJson(transform: ProjectiveDualQuaternion): string {
  return JSON.stringify(projectiveDualQuaternionToWire(transform));
}

export function decodeProjectiveDualQuaternionJson(json: string): ProjectiveDualQuaternion {
  if (typeof json !== "string") {
    return fail(
      "MALFORMED_WIRE",
      "Transform JSON",
      "payload is not JSON text",
      "supply bounded UTF-8 JSON text",
    );
  }
  if (json.length > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxWireJsonBytes) {
    return fail(
      "MALFORMED_WIRE",
      "Transform JSON",
      "text length exceeds the byte cap before UTF-8 inspection",
      "send one bounded transform",
    );
  }
  if (
    new TextEncoder().encode(json).byteLength > PROJECTIVE_DUAL_QUATERNION_LIMITS.maxWireJsonBytes
  ) {
    return fail(
      "MALFORMED_WIRE",
      "Transform JSON",
      "UTF-8 payload exceeds the byte cap",
      "send one bounded transform",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return fail(
      "MALFORMED_WIRE",
      "Transform JSON",
      "payload is not valid JSON",
      "use the experimental encoder's exact object shape",
    );
  }
  return parseDetachedProjectiveDualQuaternionWire(parsed);
}

function bigintMantissa(value: bigint): { readonly mantissa: number; readonly exponent: number } {
  if (value === 0n) return { mantissa: 0, exponent: 0 };
  const magnitude = absolute(value);
  const shift = Math.max(0, bitLength(magnitude) - 53);
  return {
    mantissa: Number(magnitude >> BigInt(shift)) * (value < 0n ? -1 : 1),
    exponent: shift,
  };
}

function bigintRatioToNumber(numerator: bigint, denominator: bigint): number {
  const top = bigintMantissa(numerator);
  const bottom = bigintMantissa(denominator);
  return (top.mantissa / bottom.mantissa) * 2 ** (top.exponent - bottom.exponent);
}

export function projectiveDualQuaternionToApproximateTransform(
  transformValue: ProjectiveDualQuaternion,
): ApproximateDualQuaternionTransform {
  const transform = snapshotCanonicalProjectiveDualQuaternion(transformValue);
  const maximumBits = Math.max(...transform.real.map(bitLength));
  const shift = Math.max(0, maximumBits - 52);
  const scaled = transform.real.map((component) => {
    const magnitude = absolute(component) >> BigInt(shift);
    return Number(magnitude) * (component < 0n ? -1 : 1);
  });
  const length = Math.hypot(...scaled);
  const [w, x, y, z] = scaled.map((component) => component / length) as [
    number,
    number,
    number,
    number,
  ];
  const translation = extractProjectiveDualQuaternionTranslation(transform);
  return Object.freeze({
    rotationMatrix: Object.freeze([
      w * w + x * x - y * y - z * z,
      2 * (x * y - w * z),
      2 * (x * z + w * y),
      2 * (x * y + w * z),
      w * w - x * x + y * y - z * z,
      2 * (y * z - w * x),
      2 * (x * z - w * y),
      2 * (y * z + w * x),
      w * w - x * x - y * y + z * z,
    ]) as ApproximateDualQuaternionTransform["rotationMatrix"],
    positionMicroLdu: Object.freeze(
      translation.numerator.map((component) =>
        bigintRatioToNumber(component, translation.denominator),
      ),
    ) as unknown as readonly [number, number, number],
  });
}
