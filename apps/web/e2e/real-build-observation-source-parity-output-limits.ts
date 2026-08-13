import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_BYTES } from "./real-build-observation-source-parity-contract";

export interface RealBuildSourceParityPublicationLimits {
  readonly maximumCaptureBytes: number;
  readonly maximumAggregateCaptureBytes: number;
  readonly maximumAggregatePackedEvidenceBytes: number;
}

const HARD_LIMITS: RealBuildSourceParityPublicationLimits = {
  maximumCaptureBytes: 512 * 1024,
  maximumAggregateCaptureBytes: 64 * 1024 * 1024,
  maximumAggregatePackedEvidenceBytes: REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_BYTES,
};

export function realBuildSourceParityPublicationLimits(
  supplied: Partial<RealBuildSourceParityPublicationLimits> | undefined,
): RealBuildSourceParityPublicationLimits {
  return Object.fromEntries(
    Object.entries(HARD_LIMITS).map(([key, maximum]) => {
      const value = supplied?.[key as keyof RealBuildSourceParityPublicationLimits];
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > maximum)) {
        throw new RangeError(
          `Source-parity publication limit ${key} must be a safe integer from 0 through ${maximum}.`,
        );
      }
      return [key, value ?? maximum];
    }),
  ) as unknown as RealBuildSourceParityPublicationLimits;
}
