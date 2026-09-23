import type {
  RealBuildPrefix50EligibleMaskRaster,
  RealBuildPrefix50EligibleMaskSimilarityTransform,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import type { RealBuildPrefix50MaskAgreement } from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";

export interface RealBuildPrefix50AgreementMeasurement {
  readonly agreement: RealBuildPrefix50MaskAgreement;
  readonly pixelVisits: number;
}

export interface RealBuildPrefix50SourceForegroundMeasurement {
  readonly indices: Int32Array;
  readonly pixelVisits: number;
}

export interface RealBuildPrefix50CoveragePyramidLevel {
  readonly stride: number;
  readonly width: number;
  readonly height: number;
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly sourceCounts: Uint32Array;
  readonly targetCounts: Uint32Array;
  readonly eligibleCounts: Uint32Array;
  readonly blockAreas: Uint32Array;
  readonly occupiedSourceIndices: Int32Array;
  readonly targetCount: number;
  readonly maximumPixelVisits: number;
  readonly constructionPixelVisits: number;
}

export function measureSourceForegroundIndices(
  source: RealBuildPrefix50EligibleMaskRaster,
): RealBuildPrefix50SourceForegroundMeasurement {
  const values: number[] = [];
  for (let index = 0; index < source.mask.length; index += 1)
    if (source.mask[index] === 1) values.push(index);
  return {
    indices: Int32Array.from(values),
    pixelVisits: source.mask.length + values.length * 3,
  };
}

export function buildCoveragePyramidLevel(input: {
  source: RealBuildPrefix50EligibleMaskRaster;
  target: RealBuildPrefix50EligibleMaskRaster;
  eligible: RealBuildPrefix50EligibleMaskRaster;
  stride: number;
}): RealBuildPrefix50CoveragePyramidLevel {
  const { source, target, eligible, stride } = input;
  const width = Math.ceil(source.width / stride);
  const height = Math.ceil(source.height / stride);
  const sourceCounts = new Uint32Array(width * height);
  const targetCounts = new Uint32Array(width * height);
  const eligibleCounts = new Uint32Array(width * height);
  const blockAreas = new Uint32Array(width * height);
  let targetCount = 0;
  for (let y = 0; y < source.height; y += 1)
    for (let x = 0; x < source.width; x += 1) {
      const originalIndex = y * source.width + x;
      const levelIndex = Math.floor(y / stride) * width + Math.floor(x / stride);
      sourceCounts[levelIndex] = sourceCounts[levelIndex]! + source.mask[originalIndex]!;
      targetCounts[levelIndex] = targetCounts[levelIndex]! + target.mask[originalIndex]!;
      eligibleCounts[levelIndex] = eligibleCounts[levelIndex]! + eligible.mask[originalIndex]!;
      blockAreas[levelIndex] = blockAreas[levelIndex]! + 1;
      targetCount += target.mask[originalIndex]!;
    }
  const occupiedValues: number[] = [];
  for (let index = 0; index < sourceCounts.length; index += 1)
    if (sourceCounts[index]! > 0) occupiedValues.push(index);
  return {
    stride,
    width,
    height,
    originalWidth: source.width,
    originalHeight: source.height,
    sourceCounts,
    targetCounts,
    eligibleCounts,
    blockAreas,
    occupiedSourceIndices: Int32Array.from(occupiedValues),
    targetCount,
    maximumPixelVisits: occupiedValues.length * 2,
    constructionPixelVisits:
      source.mask.length * 11 + sourceCounts.length * 6 + occupiedValues.length * 4,
  };
}

export function createCoveragePyramidAgreementEvaluator(
  level: RealBuildPrefix50CoveragePyramidLevel,
): (
  transform: RealBuildPrefix50EligibleMaskSimilarityTransform,
) => RealBuildPrefix50AgreementMeasurement {
  const warpedCounts = new Float64Array(level.width * level.height);
  const touched = new Int32Array(level.occupiedSourceIndices.length);
  return (transform) => {
    let touchedCount = 0;
    for (const sourceIndex of level.occupiedSourceIndices) {
      const sourceX = sourceIndex % level.width;
      const sourceY = Math.floor(sourceIndex / level.width);
      const centerX = Math.min((sourceX + 0.5) * level.stride - 0.5, level.originalWidth - 1);
      const centerY = Math.min((sourceY + 0.5) * level.stride - 0.5, level.originalHeight - 1);
      const outputX = transform.scale * centerX + transform.offsetXPx;
      const outputY = transform.scale * centerY + transform.offsetYPx;
      if (
        outputX < 0 ||
        outputX >= level.originalWidth ||
        outputY < 0 ||
        outputY >= level.originalHeight
      )
        continue;
      const targetX = Math.floor(outputX / level.stride);
      const targetY = Math.floor(outputY / level.stride);
      const targetIndex = targetY * level.width + targetX;
      if (warpedCounts[targetIndex] === 0) touched[touchedCount++] = targetIndex;
      warpedCounts[targetIndex] =
        warpedCounts[targetIndex]! + level.sourceCounts[sourceIndex]! * transform.scale ** 2;
    }
    let intersection = 0;
    let warpedEligible = 0;
    for (let index = 0; index < touchedCount; index += 1) {
      const targetIndex = touched[index]!;
      const eligibleFraction = level.eligibleCounts[targetIndex]! / level.blockAreas[targetIndex]!;
      const eligibleWarped =
        Math.min(warpedCounts[targetIndex]!, level.blockAreas[targetIndex]!) * eligibleFraction;
      warpedEligible += eligibleWarped;
      intersection += Math.min(eligibleWarped, level.targetCounts[targetIndex]!);
      warpedCounts[targetIndex] = 0;
    }
    return {
      agreement: {
        intersection,
        union: warpedEligible + level.targetCount - intersection,
        warpedEligible,
        warpedInRaster: warpedEligible,
        warpedUnclipped: warpedEligible,
      },
      pixelVisits: level.occupiedSourceIndices.length + touchedCount,
    };
  };
}

function outputInterval(
  offset: number,
  scale: number,
  sourceCoordinate: number,
): readonly [number, number] {
  return [
    Math.ceil(offset + scale * (sourceCoordinate - 0.5)),
    Math.ceil(offset + scale * (sourceCoordinate + 0.5)),
  ];
}

export function measureExactEligibleAgreement(input: {
  transform: RealBuildPrefix50EligibleMaskSimilarityTransform;
  source: RealBuildPrefix50EligibleMaskRaster;
  target: RealBuildPrefix50EligibleMaskRaster;
  eligible: RealBuildPrefix50EligibleMaskRaster;
  sourceForeground: Int32Array;
  targetForegroundCount: number;
}): RealBuildPrefix50AgreementMeasurement {
  const { transform, source, target, eligible, sourceForeground, targetForegroundCount } = input;
  let intersection = 0;
  let warpedEligible = 0;
  let warpedInRaster = 0;
  let warpedUnclipped = 0;
  let pixelVisits = sourceForeground.length;
  for (const sourceIndex of sourceForeground) {
    const sourceX = sourceIndex % source.width;
    const sourceY = Math.floor(sourceIndex / source.width);
    const [startX, stopX] = outputInterval(transform.offsetXPx, transform.scale, sourceX);
    const [startY, stopY] = outputInterval(transform.offsetYPx, transform.scale, sourceY);
    warpedUnclipped += Math.max(0, stopX - startX) * Math.max(0, stopY - startY);
    for (let y = Math.max(0, startY); y < Math.min(target.height, stopY); y += 1)
      for (let x = Math.max(0, startX); x < Math.min(target.width, stopX); x += 1) {
        pixelVisits += 1;
        warpedInRaster += 1;
        const targetIndex = y * target.width + x;
        if (eligible.mask[targetIndex] !== 1) continue;
        warpedEligible += 1;
        if (target.mask[targetIndex] === 1) intersection += 1;
      }
  }
  return {
    agreement: {
      intersection,
      union:
        warpedEligible + (warpedUnclipped - warpedInRaster) + targetForegroundCount - intersection,
      warpedEligible,
      warpedInRaster,
      warpedUnclipped,
    },
    pixelVisits,
  };
}

export function materializeExactEligibleWarp(input: {
  transform: RealBuildPrefix50EligibleMaskSimilarityTransform;
  source: RealBuildPrefix50EligibleMaskRaster;
  eligible: RealBuildPrefix50EligibleMaskRaster;
  sourceForeground: Int32Array;
}): Readonly<{ mask: Uint8Array; pixelVisits: number }> {
  const { transform, source, eligible, sourceForeground } = input;
  const warped = new Uint8Array(eligible.mask.length);
  let pixelVisits = eligible.mask.length + sourceForeground.length;
  for (const sourceIndex of sourceForeground) {
    const sourceX = sourceIndex % source.width;
    const sourceY = Math.floor(sourceIndex / source.width);
    const [startX, stopX] = outputInterval(transform.offsetXPx, transform.scale, sourceX);
    const [startY, stopY] = outputInterval(transform.offsetYPx, transform.scale, sourceY);
    for (let y = Math.max(0, startY); y < Math.min(eligible.height, stopY); y += 1)
      for (let x = Math.max(0, startX); x < Math.min(eligible.width, stopX); x += 1) {
        pixelVisits += 1;
        const index = y * eligible.width + x;
        if (eligible.mask[index] === 1) warped[index] = 1;
      }
  }
  return { mask: warped, pixelVisits };
}
