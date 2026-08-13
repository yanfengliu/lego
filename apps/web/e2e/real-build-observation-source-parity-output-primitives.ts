import { Buffer } from "node:buffer";
import { types as nodeTypes } from "node:util";

import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS } from "./real-build-observation-source-parity-contract";
import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityAggregate,
  type RealBuildSourceParityMaskComparison,
  type RealBuildSourceParityProbeResult,
} from "./real-build-observation-source-parity-types";

export const REAL_BUILD_SOURCE_PARITY_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAXIMUM_PACKED_BASE64_CHARACTERS = Math.ceil((128 * 1024) / 3) * 4;

export const exactSourceParityKeys = (
  value: unknown,
  expected: readonly string[],
  label: string,
): void => {
  if (
    value === null ||
    typeof value !== "object" ||
    nodeTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a non-proxy plain data record.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain data record.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new TypeError(`${label} must not contain symbol keys.`);
  }
  const keys = (ownKeys as string[]).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly [${wanted.join(", ")}].`);
  }
  if (
    wanted.some((key) => {
      const descriptor = descriptors[key]!;
      return !("value" in descriptor) || descriptor.enumerable !== true;
    })
  ) {
    throw new TypeError(`${label} must contain only enumerable data properties, not accessors.`);
  }
};

export function boundedDenseSourceParityArray(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an Array.`);
  }
  if (nodeTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError(`${label} must be an ordinary dense Array with the standard prototype.`);
  }
  if (value.length < minimum || value.length > maximum) {
    throw new RangeError(`${label} must contain ${minimum} through ${maximum} rows.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const wanted = new Set<string>(["length"]);
  for (let index = 0; index < value.length; index += 1) wanted.add(String(index));
  if (
    keys.some((key) => typeof key !== "string" || !wanted.has(key)) ||
    keys.length !== wanted.size ||
    [...wanted].some((key) => {
      const descriptor = descriptors[key]!;
      return !("value" in descriptor);
    })
  ) {
    throw new TypeError(`${label} must be a dense accessor-free array with no extra properties.`);
  }
}

export function snapshotDenseSourceParityArray<T>(value: readonly T[]): T[] {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const snapshot = new Array<T>(value.length);
  for (let index = 0; index < value.length; index += 1) {
    snapshot[index] = descriptors[String(index)]!.value as T;
  }
  return snapshot;
}

export function snapshotSourceParityRecord<T extends object>(
  value: T,
  keys: readonly (keyof T)[],
): T {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.fromEntries(keys.map((key) => [key, descriptors[String(key)]!.value])) as T;
}

export const sourceParityDigest = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !REAL_BUILD_SOURCE_PARITY_DIGEST.test(value)) {
    throw new TypeError(`${label} must be an exact lowercase sha256:<64 hex> digest.`);
  }
  return value;
};

export const sourceParityInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
};

export const sourceParityFinite = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
  return value;
};

export function decodeSourceParityBase64(value: unknown, label: string): Buffer {
  if (
    typeof value !== "string" ||
    value.length > MAXIMUM_PACKED_BASE64_CHARACTERS ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    throw new TypeError(`${label} must be bounded canonical base64.`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new TypeError(`${label} is not canonical base64.`);
  return bytes;
}

export function sourceParityMismatchFacts(
  mask: Uint8Array,
  width: number,
): {
  readonly pixels: number;
  readonly bounds: RealBuildSourceParityMaskComparison["mismatchBounds"];
} {
  let pixels = 0;
  let minX = width;
  let minY = Number.MAX_SAFE_INTEGER;
  let maxX = -1;
  let maxY = -1;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] !== 1) continue;
    pixels += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    pixels,
    bounds:
      pixels === 0
        ? null
        : { minXPx: minX, minYPx: minY, maxXPxExclusive: maxX + 1, maxYPxExclusive: maxY + 1 },
  };
}

export function sourceParityAggregate(
  sourceClass: (typeof REAL_BUILD_SOURCE_PARITY_CLASSES)[number],
  result: RealBuildSourceParityProbeResult,
): RealBuildSourceParityAggregate {
  const rows = result.steps.map((step) =>
    step.comparisons.find((comparison) => comparison.sourceClass === sourceClass)!,
  );
  const total = (
    key:
      "productionArea" | "candidateArea" | "intersectionPixels" | "unionPixels" | "mismatchPixels",
  ) => rows.reduce((sum, row) => sum + row[key], 0);
  const intersectionPixels = total("intersectionPixels");
  const unionPixels = total("unionPixels");
  return {
    sourceClass,
    panels: rows.length,
    panelsDiffering: rows.filter(({ mismatchPixels }) => mismatchPixels > 0).length,
    totalPixels: result.steps.reduce((sum, step) => sum + step.width * step.height, 0),
    productionArea: total("productionArea"),
    candidateArea: total("candidateArea"),
    intersectionPixels,
    unionPixels,
    mismatchPixels: total("mismatchPixels"),
    iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
    meanIou: rows.reduce((sum, row) => sum + row.iou, 0) / rows.length,
    minimumIou: Math.min(...rows.map(({ iou }) => iou)),
  };
}

export function validateSourceParityComparisonShape(
  comparison: RealBuildSourceParityMaskComparison,
  stepNumber: number,
  sourceClass: string,
  width: number,
  height: number,
): void {
  const pixels = width * height;
  exactSourceParityKeys(
    comparison,
    [
      "sourceClass",
      "productionArea",
      "candidateArea",
      "intersectionPixels",
      "unionPixels",
      "mismatchPixels",
      "iou",
      "productionMaskDigest",
      "candidateMaskDigest",
      "xorMaskDigest",
      "mismatchBounds",
      "diagnosticCaptureDigest",
      "xorEvidencePackedDigest",
      "productionEvidencePackedDigest",
    ],
    `Printed step ${stepNumber} ${sourceClass} comparison`,
  );
  const productionArea = sourceParityInteger(
    comparison.productionArea,
    0,
    pixels,
    "Production area",
  );
  const candidateArea = sourceParityInteger(comparison.candidateArea, 0, pixels, "Candidate area");
  const intersection = sourceParityInteger(
    comparison.intersectionPixels,
    0,
    pixels,
    "Intersection",
  );
  const union = sourceParityInteger(comparison.unionPixels, 0, pixels, "Union");
  const mismatch = sourceParityInteger(comparison.mismatchPixels, 0, pixels, "Mismatch");
  if (
    union !== productionArea + candidateArea - intersection ||
    mismatch !== union - intersection ||
    comparison.iou !== (union === 0 ? 1 : intersection / union)
  ) {
    throw new TypeError(`Printed step ${stepNumber} ${sourceClass} metrics do not reconcile.`);
  }
  sourceParityDigest(comparison.productionMaskDigest, "Production mask digest");
  sourceParityDigest(comparison.candidateMaskDigest, "Candidate mask digest");
  sourceParityDigest(comparison.xorMaskDigest, "XOR mask digest");
  if (comparison.mismatchBounds !== null) {
    exactSourceParityKeys(
      comparison.mismatchBounds,
      ["minXPx", "minYPx", "maxXPxExclusive", "maxYPxExclusive"],
      `Printed step ${stepNumber} ${sourceClass} mismatch bounds`,
    );
    const minX = sourceParityInteger(
      comparison.mismatchBounds.minXPx,
      0,
      width - 1,
      "Mismatch minX",
    );
    const minY = sourceParityInteger(
      comparison.mismatchBounds.minYPx,
      0,
      height - 1,
      "Mismatch minY",
    );
    const maxX = sourceParityInteger(
      comparison.mismatchBounds.maxXPxExclusive,
      1,
      width,
      "Mismatch maxX",
    );
    const maxY = sourceParityInteger(
      comparison.mismatchBounds.maxYPxExclusive,
      1,
      height,
      "Mismatch maxY",
    );
    if (maxX <= minX || maxY <= minY) {
      throw new RangeError(`Printed step ${stepNumber} ${sourceClass} mismatch bounds are empty.`);
    }
  }
  if (pixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS)
    throw new RangeError("Comparison is oversized.");
}
