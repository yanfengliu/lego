import { REAL_BUILD_ID_MAXIMUM_LENGTH } from "./real-build-candidate-lineage-identity";
import type { LineagedFartherProjectionContext } from "./real-build-farther-lineage-inspection-types";

const MAXIMUM_INSPECTION_ENTRIES = 2_000_000;
const MAXIMUM_INSPECTION_STRING_UNITS = 64 * 1024 * 1024;

const failureMessages = new WeakMap<object, string>();

export const failLineagedFartherInspection = (message: string): never => {
  const failure = Object.freeze({});
  failureMessages.set(failure, message);
  throw failure;
};
const fail = failLineagedFartherInspection;

export function lineagedFartherInspectionFailureMessage(error: unknown): string | null {
  return error !== null && typeof error === "object" ? (failureMessages.get(error) ?? null) : null;
}

export function lineagedFartherInspectionData(value: unknown, key: string, label: string): unknown {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return fail(`${label}.${key} must be an own data property`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    return fail(`${label}.${key} could not be inspected safely`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    return fail(`${label}.${key} must be an enumerable own data property`);
  }
  return descriptor.value;
}

function chargeEntries(
  context: LineagedFartherProjectionContext,
  count: number,
  label: string,
): void {
  if (count > MAXIMUM_INSPECTION_ENTRIES - context.budget.entries) {
    return fail(`${label} exceeds the aggregate farther-inspection entry budget`);
  }
  context.budget.entries += count;
}

export function lineagedFartherInspectionArrayLength(
  value: unknown,
  label: string,
  maximum: number,
  context: LineagedFartherProjectionContext,
): number {
  if (!Array.isArray(value)) return fail(`${label} must be an array`);
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    return fail(`${label}.length could not be inspected safely`);
  }
  if (descriptor === undefined || !("value" in descriptor)) {
    return fail(`${label}.length must be an own data property`);
  }
  const rawLength = descriptor.value;
  if (!Number.isSafeInteger(rawLength) || (rawLength as number) < 0) {
    return fail(`${label}.length must be a non-negative safe integer`);
  }
  const length = rawLength as number;
  if (length > maximum) return fail(`${label} exceeds its ${maximum}-entry bound`);
  chargeEntries(context, length, label);
  return length;
}

export function lineagedFartherInspectionArrayEntry(
  value: unknown,
  index: number,
  label: string,
): unknown {
  return lineagedFartherInspectionData(value, String(index), `${label}[${index}]`);
}

export function chargeLineagedFartherInspectionStringUnits(
  context: LineagedFartherProjectionContext,
  count: number,
  label: string,
): void {
  if (count > MAXIMUM_INSPECTION_STRING_UNITS - context.budget.stringUnits) {
    return fail(`${label} exceeds the aggregate farther-inspection string-work budget`);
  }
  context.budget.stringUnits += count;
}

export function lineagedFartherInspectionBoundedString(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > REAL_BUILD_ID_MAXIMUM_LENGTH
  ) {
    return fail(`${label} must contain 1 through ${REAL_BUILD_ID_MAXIMUM_LENGTH} characters`);
  }
  chargeLineagedFartherInspectionStringUnits(context, value.length, label);
  return value;
}

export function lineagedFartherInspectionSafeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) return fail(`${label} must be a safe integer`);
  return value as number;
}
