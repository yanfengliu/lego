import { Buffer } from "node:buffer";

export const LEGACY_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const FARTHER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;
const PNG_PREFIX = "data:image/png;base64,";
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAXIMUM_CAPTURE_BYTES = 16 * 1024 * 1024;

export const legacyRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const legacyExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export const legacyFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const legacyNullableFinite = (value: unknown): value is number | null =>
  value === null || legacyFinite(value);

export const legacyBoundedInteger = (value: unknown, maximum: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

export const legacyTuple = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value) && value.length === length && value.every(legacyFinite);

export function legacyDenseArray(value: unknown, maximum: number): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return false;
  }
  return true;
}

export const legacyFartherId = (value: unknown): value is string =>
  typeof value === "string" && FARTHER_ID_PATTERN.test(value);

export const legacyUnitInterval = (value: unknown): value is number =>
  legacyFinite(value) && value >= 0 && value <= 1;

export const legacySameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const legacySameIds = (
  actual: ReadonlySet<string>,
  expected: ReadonlySet<string>,
): boolean => actual.size === expected.size && [...actual].every((id) => expected.has(id));

export function legacyStepFailure(value: unknown): boolean {
  if (!legacyRecord(value)) return false;
  const allowed = new Set([
    "code",
    "stage",
    "message",
    "causedByStep",
    "pieceIndex",
    "catalogPartId",
    "inputKey",
    "stepNumber",
  ]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.stage === "string" &&
    value.stage.length > 0 &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    ["causedByStep", "pieceIndex", "stepNumber"].every(
      (key) => value[key] === undefined || Number.isSafeInteger(value[key]),
    ) &&
    ["catalogPartId", "inputKey"].every(
      (key) => value[key] === undefined || typeof value[key] === "string",
    )
  );
}

export function legacyPng(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith(PNG_PREFIX)) return false;
  const encoded = value.slice(PNG_PREFIX.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
    return false;
  }
  const bytes = Buffer.from(encoded, "base64");
  return (
    bytes.length >= PNG_SIGNATURE.length &&
    bytes.length <= MAXIMUM_CAPTURE_BYTES &&
    bytes.toString("base64") === encoded &&
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  );
}

export function decodeFrozenLegacyPngCaptureV2(value: unknown): Buffer {
  if (!legacyPng(value)) {
    throw new TypeError(
      "Legacy browser-output /2 capture is not a canonical bounded PNG data URL.",
    );
  }
  return Buffer.from(value.slice(PNG_PREFIX.length), "base64");
}

export const legacyNullablePng = (value: unknown): value is string | null =>
  value === null || legacyPng(value);

export function legacyWitnesses(
  value: unknown,
  maximum: number,
): value is readonly Record<string, unknown>[] {
  return (
    legacyDenseArray(value, maximum) &&
    value.every(
      (piece) =>
        legacyRecord(piece) &&
        legacyExactKeys(piece, ["catalogPartId", "colorId", "transform"]) &&
        legacyFartherId(piece.catalogPartId) &&
        legacyFartherId(piece.colorId) &&
        legacyRecord(piece.transform) &&
        legacyExactKeys(piece.transform, ["positionLdu", "orientationId"]) &&
        legacyTuple(piece.transform.positionLdu, 3) &&
        piece.transform.positionLdu.every((coordinate) => Math.abs(coordinate) <= 1_000_000_000) &&
        legacyFartherId(piece.transform.orientationId),
    )
  );
}

const atomicKey = (piece: Record<string, unknown>): string =>
  `${String(piece.catalogPartId)}\u0000${String(piece.colorId)}`;

export function legacyExactAtomicPieces(
  witnesses: readonly unknown[],
  expected: readonly unknown[],
): boolean {
  if (witnesses.length !== expected.length) return false;
  const left = witnesses
    .map((piece) => atomicKey(piece as Record<string, unknown>))
    .sort((a, b) => a.localeCompare(b));
  const right = expected
    .map((piece) => atomicKey(piece as Record<string, unknown>))
    .sort((a, b) => a.localeCompare(b));
  return legacySameJson(left, right);
}

export function legacyDeferral(
  value: unknown,
  maximumPieces: number,
  expectedPieces: number,
  renderBound: number,
): boolean {
  if (value === null) return true;
  if (!legacyRecord(value)) return false;
  const offeredPerPiece = value.offeredPerPiece;
  const carriedPerPiece = value.carriedPerPiece;
  if (
    !legacyExactKeys(value, [
      "trigger",
      "ownPanelMargin",
      "ownPanelMinimumMargin",
      "lookaheadStepNumber",
      "reachSteps",
      "lookaheadUpSign",
      "lookaheadMeasure",
      "lookaheadTurnDegrees",
      "lookaheadTurnAnchorIou",
      "lookaheadTurnMargin",
      "narrowingRenders",
      "offeredPerPiece",
      "carriedPerPiece",
      "wholeStepCandidates",
      "rendered",
      "lookaheadBuiltPixels",
      "bestAgreement",
      "runnerUpAgreement",
      "margin",
      "minimumMargin",
      "minimumAgreement",
      "settled",
    ]) ||
    !["no-local-signal", "unseparated-by-own-panel"].includes(String(value.trigger)) ||
    !legacyNullableFinite(value.ownPanelMargin) ||
    !legacyNullableFinite(value.ownPanelMinimumMargin) ||
    (value.ownPanelMargin === null) !== (value.ownPanelMinimumMargin === null) ||
    (value.trigger === "unseparated-by-own-panel" && value.ownPanelMargin === null) ||
    !(
      value.lookaheadStepNumber === null ||
      legacyBoundedInteger(value.lookaheadStepNumber, 1_000_000)
    ) ||
    !legacyBoundedInteger(value.reachSteps, 1_000_000) ||
    ![null, -1, 1].includes(value.lookaheadUpSign as number | null) ||
    ![null, "iou", "containment"].includes(value.lookaheadMeasure as string | null) ||
    !legacyNullableFinite(value.lookaheadTurnDegrees) ||
    !legacyNullableFinite(value.lookaheadTurnAnchorIou) ||
    !legacyNullableFinite(value.lookaheadTurnMargin) ||
    !legacyBoundedInteger(value.narrowingRenders, renderBound + 1) ||
    !legacyDenseArray(offeredPerPiece, maximumPieces) ||
    !legacyDenseArray(carriedPerPiece, maximumPieces) ||
    offeredPerPiece.length !== expectedPieces ||
    carriedPerPiece.length !== expectedPieces ||
    !offeredPerPiece.every((count) => legacyBoundedInteger(count, Number.MAX_SAFE_INTEGER)) ||
    !carriedPerPiece.every((count, index) =>
      legacyBoundedInteger(count, offeredPerPiece[index] as number),
    ) ||
    !legacyBoundedInteger(value.wholeStepCandidates, Number.MAX_SAFE_INTEGER) ||
    !legacyBoundedInteger(value.rendered, Number.MAX_SAFE_INTEGER) ||
    !legacyBoundedInteger(value.lookaheadBuiltPixels, Number.MAX_SAFE_INTEGER) ||
    !legacyNullableFinite(value.bestAgreement) ||
    !legacyNullableFinite(value.runnerUpAgreement) ||
    !legacyNullableFinite(value.margin) ||
    !legacyFinite(value.minimumMargin) ||
    !legacyFinite(value.minimumAgreement) ||
    typeof value.settled !== "boolean"
  )
    return false;
  return (
    !value.settled ||
    (value.lookaheadStepNumber !== null &&
      (value.reachSteps as number) > 0 &&
      value.lookaheadUpSign !== null &&
      value.lookaheadMeasure !== null &&
      legacyFinite(value.lookaheadTurnDegrees) &&
      legacyFinite(value.bestAgreement))
  );
}
