const FARTHER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;

export const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
  JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)));

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

export const isBoundedInteger = (value: unknown, maximum: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

export const isTuple = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value) && value.length === length && value.every(isFiniteNumber);

export const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const sameIds = (actual: ReadonlySet<string>, expected: ReadonlySet<string>): boolean =>
  actual.size === expected.size && [...actual].every((id) => expected.has(id));

export function isDenseBoundedArray(value: unknown, maximum: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

export function isFartherId(value: unknown): value is string {
  return typeof value === "string" && FARTHER_ID_PATTERN.test(value);
}

export function isUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isFartherWitness(value: unknown): boolean {
  if (!isRecord(value) || !exactKeys(value, ["catalogPartId", "colorId", "transform"])) {
    return false;
  }
  if (
    !isFartherId(value.catalogPartId) ||
    !isFartherId(value.colorId) ||
    !isRecord(value.transform) ||
    !exactKeys(value.transform, ["positionLdu", "orientationId"]) ||
    !isTuple(value.transform.positionLdu, 3) ||
    !isFartherId(value.transform.orientationId)
  ) {
    return false;
  }
  return (value.transform.positionLdu as readonly number[]).every(
    (coordinate) => Math.abs(coordinate) <= 1_000_000_000,
  );
}

export function isFartherWitnesses(value: unknown, maximum: number): boolean {
  return isDenseBoundedArray(value, maximum) && value.every(isFartherWitness);
}

const atomicPieceKey = (piece: Record<string, unknown>): string =>
  `${String(piece.catalogPartId)}\u0000${String(piece.colorId)}`;

export function hasExactAtomicPieces(
  witnesses: readonly unknown[],
  expectedAtomicPieces: readonly unknown[],
): boolean {
  if (witnesses.length !== expectedAtomicPieces.length) return false;
  const actual = witnesses
    .map((piece) => atomicPieceKey(piece as Record<string, unknown>))
    .sort((left, right) => left.localeCompare(right));
  const expected = expectedAtomicPieces
    .map((piece) => atomicPieceKey(piece as Record<string, unknown>))
    .sort((left, right) => left.localeCompare(right));
  return sameJson(actual, expected);
}
