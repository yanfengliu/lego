import type {
  RealBuildPrefix50EligibleMaskRaster,
  RealBuildPrefix50EligibleMaskSimilarityTransform,
} from "./real-build-prefix50-subbuild-return-review-camera-registration-types.ts";
import type { RealBuildPrefix50MaskAgreement } from "./real-build-prefix50-subbuild-return-review-camera-registration-primitives.ts";

interface SourceRowRuns {
  readonly y: number;
  readonly runs: Int32Array;
}

export interface RealBuildPrefix50ExactRowSpanIndex {
  readonly width: number;
  readonly height: number;
  readonly sourceRows: readonly SourceRowRuns[];
  readonly eligibleRows: readonly Int32Array[];
  readonly targetRowPrefix: Uint32Array;
  readonly targetForegroundCount: number;
  readonly sourceRunCount: number;
  readonly eligibleRunCount: number;
  readonly constructionPixelVisits: number;
  readonly maximumCandidatePixelVisits: number;
}

export interface RealBuildPrefix50ExactRowSpanAgreement {
  readonly agreement: RealBuildPrefix50MaskAgreement;
  readonly eligibleWarpRuns: Int32Array | null;
  readonly pixelVisits: number;
}

export function maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits(
  index: Pick<
    RealBuildPrefix50ExactRowSpanIndex,
    "sourceRows" | "sourceRunCount" | "eligibleRunCount"
  >,
  scale: number,
): number {
  if (!Number.isFinite(scale) || scale <= 0)
    throw new RangeError("Exact row-span candidate scale must be finite and greater than 0.");
  const maximumOutputRowsPerSourceRow = Math.ceil(scale);
  const maximum =
    index.sourceRows.length * 8 +
    index.sourceRunCount * 12 * (1 + maximumOutputRowsPerSourceRow) +
    index.eligibleRunCount * 12;
  if (!Number.isSafeInteger(maximum))
    throw new RangeError("Exact row-span candidate work bound must be a safe integer.");
  return maximum;
}

/**
 * Canonical eligible-warp rows contain triples of y/start/stop cells. For one output row,
 * intersecting two ordered disjoint run rosters yields at most left + right - 1 runs.
 */
export function maximumRealBuildPrefix50ExactWarpRunComparisonPixelVisits(
  index: RealBuildPrefix50ExactRowSpanIndex,
  maximumScale: number,
): number {
  if (!Number.isFinite(maximumScale) || maximumScale <= 0)
    throw new RangeError("Exact warp-run comparison scale must be finite and greater than 0.");
  const outputRowsPerSourceRow = Math.ceil(maximumScale);
  const maximumEligibleRunsPerRow = index.eligibleRows.reduce(
    (maximum, runs) => Math.max(maximum, runs.length / 2),
    0,
  );
  let sourceDerivedRuns = 0;
  for (const sourceRow of index.sourceRows) {
    const sourceRuns = sourceRow.runs.length / 2;
    const intersections =
      maximumEligibleRunsPerRow === 0 ? 0 : sourceRuns + maximumEligibleRunsPerRow - 1;
    const additional = outputRowsPerSourceRow * intersections;
    if (
      !Number.isSafeInteger(additional) ||
      sourceDerivedRuns > Number.MAX_SAFE_INTEGER - additional
    )
      throw new RangeError("Exact warp-run comparison work bound must be a safe integer.");
    sourceDerivedRuns += additional;
  }
  const rasterDerivedRuns = index.height * Math.ceil(index.width / 2);
  const maximum = Math.min(sourceDerivedRuns, rasterDerivedRuns) * 3;
  if (!Number.isSafeInteger(maximum))
    throw new RangeError("Exact warp-run comparison work bound must be a safe integer.");
  return maximum;
}

export function maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisitsForRaster(input: {
  readonly width: number;
  readonly height: number;
  readonly maximumScale: number;
}): number {
  if (
    !Number.isSafeInteger(input.width) ||
    input.width < 1 ||
    !Number.isSafeInteger(input.height) ||
    input.height < 1
  )
    throw new RangeError("Exact row-span raster work bounds require positive safe dimensions.");
  const maximumRunsPerRow = Math.ceil(input.width / 2);
  const maximumRuns = input.height * maximumRunsPerRow;
  return maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits(
    {
      sourceRows: new Array(input.height),
      sourceRunCount: maximumRuns,
      eligibleRunCount: maximumRuns,
    },
    input.maximumScale,
  );
}

function binaryRuns(mask: Uint8Array, width: number): readonly Int32Array[] {
  const rows: Int32Array[] = [];
  const height = mask.length / width;
  for (let y = 0; y < height; y += 1) {
    const values: number[] = [];
    let x = 0;
    while (x < width) {
      while (x < width && mask[y * width + x] !== 1) x += 1;
      if (x === width) break;
      const start = x;
      while (x < width && mask[y * width + x] === 1) x += 1;
      values.push(start, x);
    }
    rows.push(Int32Array.from(values));
  }
  return rows;
}

export function buildRealBuildPrefix50ExactRowSpanIndex(input: {
  readonly source: RealBuildPrefix50EligibleMaskRaster;
  readonly target: RealBuildPrefix50EligibleMaskRaster;
  readonly eligible: RealBuildPrefix50EligibleMaskRaster;
  readonly maximumScale: number;
}): RealBuildPrefix50ExactRowSpanIndex {
  const { source, target, eligible } = input;
  const sourceRuns = binaryRuns(source.mask, source.width);
  const eligibleRows = binaryRuns(eligible.mask, eligible.width);
  const sourceRows: SourceRowRuns[] = [];
  let sourceRunCount = 0;
  let eligibleRunCount = 0;
  for (let y = 0; y < source.height; y += 1) {
    const runs = sourceRuns[y]!;
    sourceRunCount += runs.length / 2;
    eligibleRunCount += eligibleRows[y]!.length / 2;
    if (runs.length > 0) sourceRows.push({ y, runs });
  }
  const rowStride = source.width + 1;
  const targetRowPrefix = new Uint32Array(rowStride * source.height);
  let targetForegroundCount = 0;
  for (let y = 0; y < source.height; y += 1) {
    const rowOffset = y * rowStride;
    const rasterOffset = y * source.width;
    for (let x = 0; x < source.width; x += 1) {
      const value = target.mask[rasterOffset + x]!;
      targetForegroundCount += value;
      targetRowPrefix[rowOffset + x + 1] = targetRowPrefix[rowOffset + x]! + value;
    }
  }
  const partial = {
    width: source.width,
    height: source.height,
    sourceRows: Object.freeze(sourceRows),
    eligibleRows: Object.freeze(eligibleRows),
    targetRowPrefix,
    targetForegroundCount,
    sourceRunCount,
    eligibleRunCount,
    constructionPixelVisits: source.mask.length * 3 + sourceRunCount * 2 + eligibleRunCount * 2,
  };
  return Object.freeze({
    ...partial,
    maximumCandidatePixelVisits: maximumRealBuildPrefix50ExactRowSpanCandidatePixelVisits(
      partial,
      input.maximumScale,
    ),
  });
}

function outputInterval(
  offset: number,
  scale: number,
  sourceStart: number,
  sourceStop: number,
): readonly [number, number] {
  return [
    Math.ceil(offset + scale * (sourceStart - 0.5)),
    Math.ceil(offset + scale * (sourceStop - 0.5)),
  ];
}

export function measureRealBuildPrefix50ExactRowSpanAgreement(input: {
  readonly transform: RealBuildPrefix50EligibleMaskSimilarityTransform;
  readonly index: RealBuildPrefix50ExactRowSpanIndex;
  readonly retainEligibleWarpRuns: boolean;
}): RealBuildPrefix50ExactRowSpanAgreement {
  const { transform, index } = input;
  const retained: number[] | null = input.retainEligibleWarpRuns ? [] : null;
  let intersection = 0;
  let warpedEligible = 0;
  let warpedInRaster = 0;
  let warpedUnclipped = 0;
  let pixelVisits = 0;
  const rowStride = index.width + 1;
  for (const sourceRow of index.sourceRows) {
    const [unclippedStartY, unclippedStopY] = outputInterval(
      transform.offsetYPx,
      transform.scale,
      sourceRow.y,
      sourceRow.y + 1,
    );
    const unclippedRuns: number[] = [];
    for (let runIndex = 0; runIndex < sourceRow.runs.length; runIndex += 2) {
      const [unclippedStartX, unclippedStopX] = outputInterval(
        transform.offsetXPx,
        transform.scale,
        sourceRow.runs[runIndex]!,
        sourceRow.runs[runIndex + 1]!,
      );
      pixelVisits += 6;
      if (unclippedStartX >= unclippedStopX) continue;
      const lastStopIndex = unclippedRuns.length - 1;
      if (lastStopIndex >= 0 && unclippedStartX <= unclippedRuns[lastStopIndex]!)
        unclippedRuns[lastStopIndex] = Math.max(unclippedRuns[lastStopIndex]!, unclippedStopX);
      else unclippedRuns.push(unclippedStartX, unclippedStopX);
    }
    const unclippedRowWidth = unclippedRuns.reduce(
      (total, value, runIndex) => (runIndex % 2 === 0 ? total - value : total + value),
      0,
    );
    warpedUnclipped += unclippedRowWidth * Math.max(0, unclippedStopY - unclippedStartY);
    const startY = Math.max(0, unclippedStartY);
    const stopY = Math.min(index.height, unclippedStopY);
    pixelVisits += unclippedRuns.length + 8;
    if (startY >= stopY) continue;
    const transformedRuns: number[] = [];
    for (let runIndex = 0; runIndex < unclippedRuns.length; runIndex += 2) {
      const startX = Math.max(0, unclippedRuns[runIndex]!);
      const stopX = Math.min(index.width, unclippedRuns[runIndex + 1]!);
      pixelVisits += 4;
      if (startX < stopX) transformedRuns.push(startX, stopX);
    }
    const inRasterRowWidth = transformedRuns.reduce(
      (total, value, runIndex) => (runIndex % 2 === 0 ? total - value : total + value),
      0,
    );
    for (let y = startY; y < stopY; y += 1) {
      warpedInRaster += inRasterRowWidth;
      const eligibleRuns = index.eligibleRows[y]!;
      let transformedIndex = 0;
      let eligibleIndex = 0;
      while (transformedIndex < transformedRuns.length && eligibleIndex < eligibleRuns.length) {
        const transformedStart = transformedRuns[transformedIndex]!;
        const transformedStop = transformedRuns[transformedIndex + 1]!;
        const eligibleStart = eligibleRuns[eligibleIndex]!;
        const eligibleStop = eligibleRuns[eligibleIndex + 1]!;
        const start = Math.max(transformedStart, eligibleStart);
        const stop = Math.min(transformedStop, eligibleStop);
        pixelVisits += 8;
        if (start < stop) {
          warpedEligible += stop - start;
          const rowOffset = y * rowStride;
          intersection +=
            index.targetRowPrefix[rowOffset + stop]! - index.targetRowPrefix[rowOffset + start]!;
          retained?.push(y, start, stop);
          pixelVisits += 4;
        }
        if (transformedStop <= eligibleStop) transformedIndex += 2;
        if (eligibleStop <= transformedStop) eligibleIndex += 2;
      }
    }
  }
  if (pixelVisits > index.maximumCandidatePixelVisits)
    throw new RangeError(
      `Exact row-span agreement used ${pixelVisits} index-cell visits, exceeding its preregistered ${index.maximumCandidatePixelVisits}-visit bound.`,
    );
  return {
    agreement: {
      intersection,
      union:
        warpedEligible +
        (warpedUnclipped - warpedInRaster) +
        index.targetForegroundCount -
        intersection,
      warpedEligible,
      warpedInRaster,
      warpedUnclipped,
    },
    eligibleWarpRuns: retained === null ? null : Int32Array.from(retained),
    pixelVisits,
  };
}

export function compareRealBuildPrefix50ExactWarpRuns(
  left: Int32Array,
  right: Int32Array,
): Readonly<{ equal: boolean; visits: number }> {
  if (left.length !== right.length) return { equal: false, visits: 0 };
  for (let index = 0; index < left.length; index += 1)
    if (left[index] !== right[index]) return { equal: false, visits: index + 1 };
  return { equal: true, visits: left.length };
}
