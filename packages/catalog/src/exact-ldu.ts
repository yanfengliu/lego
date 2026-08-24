import type { ExactLdu, ExactLduBounds, ExactLduVector3, LduBounds, LduVector3 } from "./types.ts";

/**
 * The fixed decimal scale of an exact LDU quantity: one unit is 10^-9 LDU.
 *
 * Measured, not chosen. The retained set 6651557 source-pilot and measured-part
 * emissions through catalog /19 use terminating decimals needing at most nine
 * fractional digits, and the deepest of them — 93273's -16.00016098 — is not a
 * float64. Nine digits covers the measurement; the safe-integer range covers
 * the magnitude.
 */
export const EXACT_LDU_SCALE_EXPONENT = 9;

/** Rejection threshold, quoted in the errors so a caller sees the boundary. */
export const MAX_EXACT_LDU_SCALE_EXPONENT = EXACT_LDU_SCALE_EXPONENT;

const SCALE = 1_000_000_000;
const SCALE_BIG = 1_000_000_000n;

/** The largest magnitude one exact quantity can carry: safe-integer units at 10^-9. */
export const MAX_EXACT_LDU_MAGNITUDE = Number.MAX_SAFE_INTEGER / SCALE;

const DECIMAL_PATTERN = /^(-?)([0-9]+)(?:\.([0-9]+))?$/;

/**
 * Fractional digits of the exact decimal expansion of a double, for the exact
 * tie-break in `compareNumberToExactLdu`.
 *
 * A finite double m * 2^-k expands in exactly k fractional digits, and
 * |v| >= 2^-30 forces k <= 82. Every value reaching that branch is either zero
 * or at least one unit, and 10^-9 is just above 2^-30, so its own expansion is
 * the worst case at 82 digits. `toFixed` at this width is therefore the exact
 * expansion rather than a rounded one, with eighteen digits to spare.
 */
const EXACT_EXPANSION_FRACTION_DIGITS = 100;
const EXACT_EXPANSION_GUARD = 1e-9;

function describe(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** Canonical decimal text for signed units, with no trailing fractional zeros. */
function unitsToDecimal(units: number): string {
  const negative = units < 0;
  const magnitude = Math.abs(units);
  const whole = Math.trunc(magnitude / SCALE);
  const fraction = magnitude - whole * SCALE;
  const digits = String(fraction).padStart(EXACT_LDU_SCALE_EXPONENT, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${digits === "" ? "" : `.${digits}`}`;
}

/**
 * Validates a value that claims to already be exact, so a hand-written or
 * deserialized record cannot enter the catalog with a scale nobody checked.
 */
export function assertExactLdu(value: ExactLdu, label: string): ExactLdu {
  if (!Number.isInteger(value.scaleExponent) || value.scaleExponent < 0) {
    throw new RangeError(
      `${label} declares scaleExponent ${describe(value.scaleExponent)}; an exact LDU quantity needs a whole scaleExponent between 0 and ${MAX_EXACT_LDU_SCALE_EXPONENT}.`,
    );
  }
  if (value.scaleExponent > MAX_EXACT_LDU_SCALE_EXPONENT) {
    throw new RangeError(
      `${label} declares scaleExponent ${value.scaleExponent}, finer than the measured maximum ${MAX_EXACT_LDU_SCALE_EXPONENT}; every audited LDraw coordinate terminates within ${MAX_EXACT_LDU_SCALE_EXPONENT} fractional digits, so re-measure the source rather than deepening the scale.`,
    );
  }
  if (value.scaleExponent !== EXACT_LDU_SCALE_EXPONENT) {
    throw new RangeError(
      `${label} declares ${describe(value.units)} units at scaleExponent ${value.scaleExponent}; catalog-stored exact LDU is normalized to the single fixed scale ${EXACT_LDU_SCALE_EXPONENT}, so write the value as a decimal string and pass it through exactLduFromDecimalString rather than hand-building the record at another scale.`,
    );
  }
  if (!Number.isSafeInteger(value.units)) {
    throw new RangeError(
      `${label} declares units ${describe(value.units)}; exact LDU units must be a safe integer count of 10^-${EXACT_LDU_SCALE_EXPONENT} LDU, so the value must be a whole multiple of 10^-${EXACT_LDU_SCALE_EXPONENT} within +/-${MAX_EXACT_LDU_MAGNITUDE} LDU.`,
    );
  }
  return value;
}

function makeExact(units: number): ExactLdu {
  return { units: units === 0 ? 0 : units, scaleExponent: EXACT_LDU_SCALE_EXPONENT };
}

/**
 * Reads the one authoring form that survives the trip: a canonical plain
 * decimal, exactly as the measured source prints it.
 */
export function exactLduFromDecimalString(text: string, label: string): ExactLdu {
  if (typeof text !== "string") {
    throw new TypeError(
      `${label} must be a decimal string such as "-16.00016098"; received ${describe(text)} of type ${typeof text}.`,
    );
  }
  const match = DECIMAL_PATTERN.exec(text);
  if (match === null) {
    throw new SyntaxError(
      `${label} is ${describe(text)}; an exact LDU coordinate must be a plain signed decimal — an optional "-", one or more digits, and at most ${MAX_EXACT_LDU_SCALE_EXPONENT} digits after a single "." — with no exponent, no "+", and no spaces. "-16.00016098", "38.5" and "-20" all satisfy it.`,
    );
  }
  const [, sign = "", whole = "", fraction = ""] = match;
  if (fraction.length > MAX_EXACT_LDU_SCALE_EXPONENT) {
    throw new RangeError(
      `${label} is ${describe(text)}, carrying ${fraction.length} fractional digits (${describe(fraction)}); the exact LDU scale is 10^-${MAX_EXACT_LDU_SCALE_EXPONENT}, so at most ${MAX_EXACT_LDU_SCALE_EXPONENT} are representable. Re-measure the source instead of truncating a value it did not produce.`,
    );
  }
  const scaled =
    BigInt(whole) * SCALE_BIG + BigInt(fraction.padEnd(EXACT_LDU_SCALE_EXPONENT, "0") || "0");
  const units = sign === "-" ? -scaled : scaled;
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `${label} is ${describe(text)}, which is ${units} units of 10^-${EXACT_LDU_SCALE_EXPONENT} LDU and outside the safe-integer range +/-${Number.MAX_SAFE_INTEGER}; an exact LDU coordinate must stay within +/-${MAX_EXACT_LDU_MAGNITUDE} LDU.`,
    );
  }
  const value = makeExact(Number(units));
  const canonical = unitsToDecimal(value.units);
  if (canonical !== text) {
    throw new SyntaxError(
      `${label} is ${describe(text)}, which is not the canonical spelling of that value; declare it as ${describe(canonical)} so one exact bound has one text, one digest and one comparison.`,
    );
  }
  return value;
}

/**
 * Bridge for a coordinate that only exists as a double — an existing authored
 * literal, or a measurement that already crossed a JSON number.
 *
 * It reads the shortest decimal that round-trips the double, which recovers the
 * literal an author wrote, and refuses anything that decimal cannot state
 * plainly. It is deliberately not the truth path: a double that never spelled
 * itself in nine digits has already lost the value, and this cannot invent it.
 */
export function exactLduFromNumber(value: number, label: string): ExactLdu {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `${label} must be a finite number to become an exact LDU coordinate; received ${describe(value)}.`,
    );
  }
  const text = String(Object.is(value, -0) ? 0 : value);
  if (!DECIMAL_PATTERN.test(text)) {
    throw new RangeError(
      `${label} is the number ${text}, whose shortest round-trip decimal uses exponent notation and cannot be read as an exact LDU coordinate; declare it as a plain decimal string within +/-${MAX_EXACT_LDU_MAGNITUDE} LDU instead.`,
    );
  }
  return exactLduFromDecimalString(text, label);
}

/** The canonical decimal text of an exact quantity. */
export function formatExactLdu(value: ExactLdu): string {
  return unitsToDecimal(assertExactLdu(value, "Exact LDU value").units);
}

/** Nearest double. Lossy by construction; the exact record stays the truth. */
export function exactLduToNumber(value: ExactLdu): number {
  return assertExactLdu(value, "Exact LDU value").units / SCALE;
}

export function exactLduEquals(left: ExactLdu, right: ExactLdu): boolean {
  return compareExactLdu(left, right) === 0;
}

export function compareExactLdu(left: ExactLdu, right: ExactLdu): -1 | 0 | 1 {
  const a = assertExactLdu(left, "Exact LDU left operand").units;
  const b = assertExactLdu(right, "Exact LDU right operand").units;
  return a < b ? -1 : a > b ? 1 : 0;
}

function combine(left: ExactLdu, right: ExactLdu, sign: 1 | -1, label: string): ExactLdu {
  const a = assertExactLdu(left, `${label} left operand`).units;
  const b = assertExactLdu(right, `${label} right operand`).units;
  const units = a + sign * b;
  if (!Number.isSafeInteger(units)) {
    throw new RangeError(
      `${label} produced ${units} units of 10^-${EXACT_LDU_SCALE_EXPONENT} LDU from ${unitsToDecimal(a)} and ${unitsToDecimal(b)}, leaving the safe-integer range; both operands and the result must stay within +/-${MAX_EXACT_LDU_MAGNITUDE} LDU.`,
    );
  }
  return makeExact(units);
}

export function addExactLdu(left: ExactLdu, right: ExactLdu, label: string): ExactLdu {
  return combine(left, right, 1, label);
}

export function subtractExactLdu(left: ExactLdu, right: ExactLdu, label: string): ExactLdu {
  return combine(left, right, -1, label);
}

/** Exact decimal expansion of a double, scaled to an integer, for exact compare. */
function scaledExpansion(value: number): bigint {
  const text = value.toFixed(EXACT_EXPANSION_FRACTION_DIGITS);
  const negative = text.startsWith("-");
  const [whole = "", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const magnitude = BigInt(whole + fraction.padEnd(EXACT_EXPANSION_FRACTION_DIGITS, "0"));
  return negative ? -magnitude : magnitude;
}

/**
 * Where a double sits relative to an exact quantity, decided exactly.
 *
 * The nearest double to the exact value separates the space: anything below it
 * is below the exact value and anything above it is above, because the nearest
 * double is nearer than any other. Only the nearest double itself needs the
 * expansion, and it is the one comparison a float64 bound cannot answer for
 * itself.
 */
export function compareNumberToExactLdu(value: number, exact: ExactLdu, label: string): -1 | 0 | 1 {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `${label} must be a finite number to compare against exact ${formatExactLdu(exact)} LDU; received ${describe(value)}.`,
    );
  }
  const nearest = exactLduToNumber(exact);
  if (value < nearest) return -1;
  if (value > nearest) return 1;
  if (exact.units === 0) return 0;
  if (Math.abs(nearest) < EXACT_EXPANSION_GUARD) {
    throw new RangeError(
      `${label} compares ${value} against exact ${formatExactLdu(exact)} LDU below the ${EXACT_EXPANSION_GUARD} LDU magnitude where a ${EXACT_EXPANSION_FRACTION_DIGITS}-digit expansion is still exact; no exact LDU quantity is that small, so the record was built outside exactLduFromDecimalString.`,
    );
  }
  const scaledDouble = scaledExpansion(nearest);
  const scaledExact =
    BigInt(exact.units) * 10n ** BigInt(EXACT_EXPANSION_FRACTION_DIGITS - EXACT_LDU_SCALE_EXPONENT);
  return scaledDouble < scaledExact ? -1 : scaledDouble > scaledExact ? 1 : 0;
}

/** True when the nearest double carries the exact value with no error at all. */
export function isExactLduRepresentableAsNumber(value: ExactLdu): boolean {
  return compareNumberToExactLdu(exactLduToNumber(value), value, "Exact LDU value") === 0;
}

/** How an exact bound is authored: canonical decimal text on every axis. */
export interface ExactLduBoundsDeclaration {
  readonly min: readonly [x: string, y: string, z: string];
  readonly max: readonly [x: string, y: string, z: string];
}

const AXIS_NAMES = ["x", "y", "z"] as const;

function parseVector(
  text: ExactLduBoundsDeclaration["min"],
  label: string,
): [ExactLdu, ExactLdu, ExactLdu] {
  if (!Array.isArray(text) || text.length !== 3) {
    throw new TypeError(
      `${label} must be exactly three decimal strings, one per axis; received ${describe(JSON.stringify(text))}.`,
    );
  }
  return [
    exactLduFromDecimalString(text[0], `${label} x`),
    exactLduFromDecimalString(text[1], `${label} y`),
    exactLduFromDecimalString(text[2], `${label} z`),
  ];
}

export function parseExactLduBounds(
  declaration: ExactLduBoundsDeclaration,
  label: string,
): ExactLduBounds {
  const min = parseVector(declaration.min, `${label} min`);
  const max = parseVector(declaration.max, `${label} max`);
  for (const axis of [0, 1, 2] as const) {
    if (compareExactLdu(min[axis], max[axis]) > 0) {
      throw new RangeError(
        `${label} ${AXIS_NAMES[axis]} runs from min ${formatExactLdu(min[axis])} to max ${formatExactLdu(max[axis])}; a bound needs min no greater than max on every axis.`,
      );
    }
  }
  return { min, max };
}

export function formatExactLduBounds(bounds: ExactLduBounds): ExactLduBoundsDeclaration {
  return {
    min: [
      formatExactLdu(bounds.min[0]),
      formatExactLdu(bounds.min[1]),
      formatExactLdu(bounds.min[2]),
    ],
    max: [
      formatExactLdu(bounds.max[0]),
      formatExactLdu(bounds.max[1]),
      formatExactLdu(bounds.max[2]),
    ],
  };
}

function toNumbers(vector: ExactLduVector3): LduVector3 {
  return [exactLduToNumber(vector[0]), exactLduToNumber(vector[1]), exactLduToNumber(vector[2])];
}

/** The float64 projection every existing consumer keeps reading. */
export function exactLduBoundsToNumbers(bounds: ExactLduBounds): LduBounds {
  return { min: toNumbers(bounds.min), max: toNumbers(bounds.max) };
}

/**
 * Refuses a float64 projection that would claim less material than the exact
 * bound it came from.
 *
 * Collision may refuse a placement a real part would allow and must never allow
 * one it would not, so a min that rounded up or a max that rounded down is a
 * rejection rather than a rounding note. Every measured set 6651557 bound
 * projects outward or exactly; this fires if one ever does not.
 */
export function assertNumericBoundsContainExact(
  numeric: LduBounds,
  exact: ExactLduBounds,
  label: string,
): void {
  for (const axis of [0, 1, 2] as const) {
    const minimum = numeric.min[axis];
    const maximum = numeric.max[axis];
    if (compareNumberToExactLdu(minimum, exact.min[axis], `${label} min ${AXIS_NAMES[axis]}`) > 0) {
      throw new RangeError(
        `${label} min ${AXIS_NAMES[axis]} projects exact ${formatExactLdu(exact.min[axis])} LDU to the float64 ${minimum}, which lies inside the exact bound and shrinks the modelled solid; collision may only be wrong outward, so declare a coordinate whose nearest double is not above it.`,
      );
    }
    if (compareNumberToExactLdu(maximum, exact.max[axis], `${label} max ${AXIS_NAMES[axis]}`) < 0) {
      throw new RangeError(
        `${label} max ${AXIS_NAMES[axis]} projects exact ${formatExactLdu(exact.max[axis])} LDU to the float64 ${maximum}, which lies inside the exact bound and shrinks the modelled solid; collision may only be wrong outward, so declare a coordinate whose nearest double is not below it.`,
      );
    }
  }
}
