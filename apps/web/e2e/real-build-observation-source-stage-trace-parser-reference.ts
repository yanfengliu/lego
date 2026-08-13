import {
  exactStageTraceRecord as exactRecord,
  requireExactStageTraceMatch,
  stageTraceDigest as digest,
  stageTraceInteger as integer,
} from "./real-build-observation-source-stage-trace-parser-structure";
import {
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS,
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
  type RealBuildObservationSourceStageMaskReference,
  type RealBuildObservationSourceStageName,
} from "./real-build-observation-source-stage-trace-types";

export function parseRealBuildObservationSourceStageReference(
  value: unknown,
  path: string,
  expectedStage: RealBuildObservationSourceStageName,
  dimensions: {
    readonly highWidth: number;
    readonly highHeight: number;
    readonly workWidth: number;
    readonly workHeight: number;
  },
  expectedOffset: number,
): RealBuildObservationSourceStageMaskReference {
  const record = exactRecord(value, path, [
    "stage",
    "scale",
    "role",
    "encoding",
    "width",
    "height",
    "pixelCount",
    "offset",
    "bytes",
    "lowPaddingBits",
    "packedDigest",
    "unpackedDigest",
  ]);
  const scale = expectedStage === "high-cleaned-art" ? "high" : "work";
  const width = scale === "high" ? dimensions.highWidth : dimensions.workWidth;
  const height = scale === "high" ? dimensions.highHeight : dimensions.workHeight;
  const maximum =
    scale === "high"
      ? MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_HIGH_PIXELS
      : MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_WORK_PIXELS;
  requireExactStageTraceMatch(record.stage, expectedStage, `${path}.stage`);
  requireExactStageTraceMatch(record.scale, scale, `${path}.scale`);
  requireExactStageTraceMatch(
    record.role,
    REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
    `${path}.role`,
  );
  requireExactStageTraceMatch(
    record.encoding,
    REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
    `${path}.encoding`,
  );
  requireExactStageTraceMatch(record.width, width, `${path}.width`);
  requireExactStageTraceMatch(record.height, height, `${path}.height`);
  const pixelCount = integer(record.pixelCount, `${path}.pixelCount`, 1, maximum);
  requireExactStageTraceMatch(pixelCount, width * height, `${path}.pixelCount`);
  requireExactStageTraceMatch(record.offset, expectedOffset, `${path}.offset`);
  const bytes = Math.ceil(pixelCount / 8);
  requireExactStageTraceMatch(record.bytes, bytes, `${path}.bytes`);
  const lowPaddingBits = (8 - (pixelCount & 7)) & 7;
  requireExactStageTraceMatch(record.lowPaddingBits, lowPaddingBits, `${path}.lowPaddingBits`);
  return Object.freeze({
    stage: expectedStage,
    scale,
    role: REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
    encoding: REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
    width,
    height,
    pixelCount,
    offset: expectedOffset,
    bytes,
    lowPaddingBits,
    packedDigest: digest(record.packedDigest, `${path}.packedDigest`),
    unpackedDigest: digest(record.unpackedDigest, `${path}.unpackedDigest`),
  });
}
