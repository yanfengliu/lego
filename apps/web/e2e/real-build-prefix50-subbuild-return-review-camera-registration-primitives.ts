import type {
  RealBuildPrefix50EligibleMaskRaster,
  RealBuildPrefix50EligibleMaskSimilarityTransform,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";

export interface RealBuildPrefix50MaskMoments {
  readonly count: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
}

export interface RealBuildPrefix50SimilaritySearchCoordinate {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly relativeScaleDelta: number;
}

export interface RealBuildPrefix50MaskAgreement {
  readonly intersection: number;
  readonly union: number;
  readonly warpedEligible: number;
  readonly warpedInRaster: number;
  readonly warpedUnclipped: number;
}

export function requirePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${label} must be finite and greater than 0.`);
  return value;
}

export function requireExactBinaryRaster(
  raster: RealBuildPrefix50EligibleMaskRaster,
  label: string,
): RealBuildPrefix50EligibleMaskRaster {
  if (
    !Number.isInteger(raster.width) ||
    raster.width < 1 ||
    !Number.isInteger(raster.height) ||
    raster.height < 1 ||
    raster.width * raster.height > 1_000_000 ||
    raster.mask.byteLength !== raster.width * raster.height
  )
    throw new RangeError(
      `${label} must be a positive raster of at most 1000000 pixels with one mask byte per pixel.`,
    );
  for (const value of raster.mask)
    if (value !== 0 && value !== 1)
      throw new TypeError(`${label} must contain only exact binary mask values 0 or 1.`);
  return raster;
}

export function maskMoments(
  mask: Uint8Array,
  width: number,
  eligible?: Uint8Array,
): RealBuildPrefix50MaskMoments {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1 || (eligible !== undefined && eligible[index] !== 1)) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    count += 1;
    sumX += x;
    sumY += y;
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }
  return {
    count,
    centerX: count === 0 ? 0 : sumX / count,
    centerY: count === 0 ? 0 : sumY / count,
    minimumX: count === 0 ? 0 : minimumX,
    maximumX: count === 0 ? 0 : maximumX,
    minimumY: count === 0 ? 0 : minimumY,
    maximumY: count === 0 ? 0 : maximumY,
  };
}

export function quantizedSearchValue(value: number): number {
  const rounded = Number(value.toFixed(12));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function similarityTransformFor(
  seed: RealBuildPrefix50EligibleMaskSimilarityTransform,
  coordinate: RealBuildPrefix50SimilaritySearchCoordinate,
): RealBuildPrefix50EligibleMaskSimilarityTransform {
  return {
    scale: quantizedSearchValue(seed.scale * (1 + coordinate.relativeScaleDelta)),
    offsetXPx: quantizedSearchValue(seed.offsetXPx + coordinate.deltaX),
    offsetYPx: quantizedSearchValue(seed.offsetYPx + coordinate.deltaY),
  };
}

export function compareMaskAgreement(
  left: RealBuildPrefix50MaskAgreement,
  right: RealBuildPrefix50MaskAgreement,
): number {
  return left.intersection * right.union - right.intersection * left.union;
}

export function similarityCoordinateKey(
  coordinate: RealBuildPrefix50SimilaritySearchCoordinate,
): string {
  return `${coordinate.deltaX.toFixed(12)}:${coordinate.deltaY.toFixed(12)}:${coordinate.relativeScaleDelta.toFixed(12)}`;
}

export function compareMaskBytes(
  left: Uint8Array,
  right: Uint8Array,
): Readonly<{ equal: boolean; pixelVisits: number }> {
  if (left.byteLength !== right.byteLength) return { equal: false, pixelVisits: 0 };
  for (let index = 0; index < left.byteLength; index += 1)
    if (left[index] !== right[index]) return { equal: false, pixelVisits: index + 1 };
  return { equal: true, pixelVisits: left.byteLength };
}

export function boundedSearchGridValueCount(
  radius: number,
  step: number,
  maximumValues: number,
  label: string,
): number {
  const positiveSlots = Math.ceil(radius / step);
  if (
    !Number.isSafeInteger(positiveSlots) ||
    positiveSlots < 1 ||
    positiveSlots > Math.floor((Number.MAX_SAFE_INTEGER - 1) / 2)
  )
    throw new RangeError(
      `${label} grid radius/step ratio is too large for safe deterministic enumeration.`,
    );
  const count = positiveSlots * 2 + 1;
  if (count > maximumValues)
    throw new RangeError(
      `${label} grid needs ${count} values, exceeding the ${maximumValues}-value candidate budget. Increase the step or reduce the radius.`,
    );
  return count;
}

export function boundedSearchGrid(
  radius: number,
  step: number,
  maximumValues: number,
  label: string,
): readonly number[] {
  const count = boundedSearchGridValueCount(radius, step, maximumValues, label);
  const positiveSlots = (count - 1) / 2;
  const values = new Set<number>([0, -radius, radius]);
  for (let slot = 1; slot < positiveSlots; slot += 1) {
    const value = quantizedSearchValue(slot * step);
    values.add(quantizedSearchValue(-value));
    values.add(value);
  }
  return [...values].sort((left, right) => left - right);
}

export function boundedSearchInterval(
  minimum: number,
  maximum: number,
  step: number,
  maximumValues: number,
  label: string,
): readonly number[] {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum > maximum ||
    !Number.isFinite(step) ||
    step <= 0
  )
    throw new RangeError(
      `${label} interval bounds and step must be finite, ordered, and positive.`,
    );
  const firstSlot = Math.ceil(minimum / step);
  const lastSlot = Math.floor(maximum / step);
  const alignedCount = Math.max(0, lastSlot - firstSlot + 1);
  if (!Number.isSafeInteger(alignedCount) || alignedCount + 2 > maximumValues)
    throw new RangeError(
      `${label} interval needs at least ${alignedCount + 2} values, exceeding the ${maximumValues}-value axis cap.`,
    );
  const values = new Set<number>([quantizedSearchValue(minimum), quantizedSearchValue(maximum)]);
  for (let slot = firstSlot; slot <= lastSlot; slot += 1)
    values.add(quantizedSearchValue(slot * step));
  if (values.size > maximumValues)
    throw new RangeError(
      `${label} interval needs ${values.size} values, exceeding the ${maximumValues}-value axis cap.`,
    );
  return [...values].sort((left, right) => left - right);
}

export function sampledEligibleMaskIndices(
  eligible: Uint8Array,
  width: number,
  stride: number,
): Int32Array {
  const values: number[] = [];
  const height = eligible.length / width;
  for (let y = 0; y < height; y += stride)
    for (let x = 0; x < width; x += stride) {
      const index = y * width + x;
      if (eligible[index] === 1) values.push(index);
    }
  return Int32Array.from(values);
}
