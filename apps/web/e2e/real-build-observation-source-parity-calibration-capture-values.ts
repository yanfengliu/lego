import {
  MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
  REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
  type RealBuildObservationSourceStageMaskReference,
  type RealBuildObservationSourceStageName,
} from "./real-build-observation-source-stage-trace-types";
import {
  REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH,
  REAL_BUILD_SOURCE_PARITY_RENDER_SCALE,
} from "./real-build-observation-source-parity-contract";
import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
  type RealBuildSourceParityCalibrationCaptureByteReference,
  type RealBuildSourceParityCalibrationCapturePackedMaskReference,
  type RealBuildSourceParityCalibrationPairwiseMaskBinding,
  type RealBuildSourceParityCalibrationCapturePngReference,
  type RealBuildSourceParityCalibrationCaptureRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import {
  boundedDenseCaptureArray,
  captureFinite,
  captureInteger,
  describeCaptureValue,
  exactCaptureRecord,
  requireCaptureDigest,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import type { RealBuildSourceParityBounds } from "./real-build-observation-source-parity-types";

function exactLiteral<T extends string | number | boolean>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) {
    throw new TypeError(
      `${path} observed ${describeCaptureValue(value)}; expected ${describeCaptureValue(expected)}.`,
    );
  }
  return expected;
}

export function parseCaptureBounds(value: unknown, path: string): RealBuildSourceParityBounds {
  const row = exactCaptureRecord(value, ["minXPt", "maxXPt", "minYPt", "maxYPt"], path);
  const minXPt = captureFinite(row.minXPt, `${path}.minXPt`);
  const maxXPt = captureFinite(row.maxXPt, `${path}.maxXPt`);
  const minYPt = captureFinite(row.minYPt, `${path}.minYPt`);
  const maxYPt = captureFinite(row.maxYPt, `${path}.maxYPt`);
  if (maxXPt <= minXPt) {
    throw new RangeError(
      `${path}.maxXPt observed ${maxXPt}; expected greater than minXPt ${minXPt}.`,
    );
  }
  if (maxYPt <= minYPt) {
    throw new RangeError(
      `${path}.maxYPt observed ${maxYPt}; expected greater than minYPt ${minYPt}.`,
    );
  }
  return Object.freeze({ minXPt, maxXPt, minYPt, maxYPt });
}

export function parseCaptureCallouts(
  value: unknown,
  path: string,
): readonly RealBuildSourceParityBounds[] {
  return Object.freeze(
    boundedDenseCaptureArray(value, 0, 1_024, path).map((box, index) =>
      parseCaptureBounds(box, `${path}[${index}]`),
    ),
  );
}

export function requireCaptureHighGeometry(
  bounds: RealBuildSourceParityBounds,
  width: number,
  height: number,
  path: string,
): void {
  const sourceWidth = (bounds.maxXPt - bounds.minXPt) * REAL_BUILD_SOURCE_PARITY_RENDER_SCALE;
  const sourceHeight = (bounds.maxYPt - bounds.minYPt) * REAL_BUILD_SOURCE_PARITY_RENDER_SCALE;
  const ratio = REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH / sourceWidth;
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(ratio) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    ratio <= 0
  ) {
    throw new RangeError(
      `${path} prepared bounds overflow production crop geometry at render scale ${REAL_BUILD_SOURCE_PARITY_RENDER_SCALE}.`,
    );
  }
  const expectedHeight = Math.max(1, Math.round(sourceHeight * ratio));
  if (width !== REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH || height !== expectedHeight) {
    throw new RangeError(
      `${path} high raster observed ${width}x${height}; exact prepared bounds and production render/panel constants require ${REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH}x${expectedHeight}.`,
    );
  }
}

export function parseCaptureByteReference(
  value: unknown,
  expectedRole: RealBuildSourceParityCalibrationCaptureRole,
  maximumBytes: number,
  path: string,
): RealBuildSourceParityCalibrationCaptureByteReference {
  const row = exactCaptureRecord(value, ["role", "offset", "byteLength", "digest"], path);
  return Object.freeze({
    role: exactLiteral(row.role, expectedRole, `${path}.role`),
    offset: captureInteger(row.offset, 0, maximumBytes - 1, `${path}.offset`),
    byteLength: captureInteger(row.byteLength, 1, maximumBytes, `${path}.byteLength`),
    digest: requireCaptureDigest(row.digest, `${path}.digest`),
  });
}

export function parseCaptureStageReference(
  value: unknown,
  expectedStage: Extract<
    RealBuildObservationSourceStageName,
    "isolate-then-downsample" | "downsample-then-isolate"
  >,
  expectedWidth: number,
  expectedHeight: number,
  path: string,
): RealBuildObservationSourceStageMaskReference {
  const row = exactCaptureRecord(
    value,
    [
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
    ],
    path,
  );
  const pixelCount = expectedWidth * expectedHeight;
  const byteLength = Math.ceil(pixelCount / 8);
  const lowPaddingBits = (8 - (pixelCount & 7)) & 7;
  exactLiteral(row.stage, expectedStage, `${path}.stage`);
  exactLiteral(row.scale, "work", `${path}.scale`);
  exactLiteral(row.role, REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE, `${path}.role`);
  exactLiteral(row.encoding, REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING, `${path}.encoding`);
  exactLiteral(row.width, expectedWidth, `${path}.width`);
  exactLiteral(row.height, expectedHeight, `${path}.height`);
  exactLiteral(row.pixelCount, pixelCount, `${path}.pixelCount`);
  const offset = captureInteger(
    row.offset,
    0,
    MAXIMUM_REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE_BYTES - 1,
    `${path}.offset`,
  );
  exactLiteral(row.bytes, byteLength, `${path}.bytes`);
  exactLiteral(row.lowPaddingBits, lowPaddingBits, `${path}.lowPaddingBits`);
  return Object.freeze({
    stage: expectedStage,
    scale: "work",
    role: REAL_BUILD_OBSERVATION_SOURCE_STAGE_ROLE,
    encoding: REAL_BUILD_OBSERVATION_SOURCE_STAGE_MASK_ENCODING,
    width: expectedWidth,
    height: expectedHeight,
    pixelCount,
    offset,
    bytes: byteLength,
    lowPaddingBits,
    packedDigest: requireCaptureDigest(row.packedDigest, `${path}.packedDigest`),
    unpackedDigest: requireCaptureDigest(row.unpackedDigest, `${path}.unpackedDigest`),
  });
}

export function parseCapturePackedMaskReference(
  value: unknown,
  expectedWidth: number,
  expectedHeight: number,
  path: string,
): RealBuildSourceParityCalibrationCapturePackedMaskReference {
  const row = exactCaptureRecord(
    value,
    [
      "role",
      "offset",
      "byteLength",
      "digest",
      "contentEncoding",
      "width",
      "height",
      "pixelCount",
      "lowPaddingBits",
      "unpackedDigest",
    ],
    path,
  );
  const pixelCount = expectedWidth * expectedHeight;
  const byteLength = Math.ceil(pixelCount / 8);
  exactLiteral(row.role, "calibration-w-packed-msb", `${path}.role`);
  exactLiteral(row.contentEncoding, "packed-binary-mask-msb/1", `${path}.contentEncoding`);
  exactLiteral(row.width, expectedWidth, `${path}.width`);
  exactLiteral(row.height, expectedHeight, `${path}.height`);
  exactLiteral(row.pixelCount, pixelCount, `${path}.pixelCount`);
  exactLiteral(row.byteLength, byteLength, `${path}.byteLength`);
  exactLiteral(row.lowPaddingBits, (8 - (pixelCount & 7)) & 7, `${path}.lowPaddingBits`);
  return Object.freeze({
    role: "calibration-w-packed-msb",
    contentEncoding: "packed-binary-mask-msb/1",
    width: expectedWidth,
    height: expectedHeight,
    pixelCount,
    offset: captureInteger(
      row.offset,
      0,
      MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES - 1,
      `${path}.offset`,
    ),
    byteLength,
    lowPaddingBits: (8 - (pixelCount & 7)) & 7,
    digest: requireCaptureDigest(row.digest, `${path}.digest`),
    unpackedDigest: requireCaptureDigest(row.unpackedDigest, `${path}.unpackedDigest`),
  });
}

export function parseCapturePairwise(
  value: unknown,
  expectedLeft: "P" | "D",
  expectedRight: "D" | "W",
  maximumPixels: number,
  path: string,
): RealBuildSourceParityCalibrationPairwiseMaskBinding {
  const row = exactCaptureRecord(
    value,
    ["left", "right", "differingPixels", "intersectionPixels", "unionPixels", "iou", "xorDigest"],
    path,
  );
  const unionPixels = captureInteger(row.unionPixels, 0, maximumPixels, `${path}.unionPixels`);
  const intersectionPixels = captureInteger(
    row.intersectionPixels,
    0,
    unionPixels,
    `${path}.intersectionPixels`,
  );
  const differingPixels = captureInteger(
    row.differingPixels,
    0,
    maximumPixels,
    `${path}.differingPixels`,
  );
  const iou = captureFinite(row.iou, `${path}.iou`);
  if (iou < 0 || iou > 1) {
    throw new RangeError(`${path}.iou observed ${iou}; expected 0 through 1.`);
  }
  return Object.freeze({
    left: exactLiteral(row.left, expectedLeft, `${path}.left`),
    right: exactLiteral(row.right, expectedRight, `${path}.right`),
    differingPixels,
    intersectionPixels,
    unionPixels,
    iou,
    xorDigest: requireCaptureDigest(row.xorDigest, `${path}.xorDigest`),
  });
}

export function parseCapturePngReference(
  value: unknown,
  expectedWidth: number,
  expectedHeight: number,
  maximumBytes: number,
  path: string,
): RealBuildSourceParityCalibrationCapturePngReference {
  const row = exactCaptureRecord(
    value,
    ["mediaType", "byteLength", "digest", "width", "height", "rgbaDigest"],
    path,
  );
  return Object.freeze({
    mediaType: exactLiteral(row.mediaType, "image/png", `${path}.mediaType`),
    byteLength: captureInteger(row.byteLength, 57, maximumBytes, `${path}.byteLength`),
    digest: requireCaptureDigest(row.digest, `${path}.digest`),
    width: exactLiteral(row.width, expectedWidth, `${path}.width`),
    height: exactLiteral(row.height, expectedHeight, `${path}.height`),
    rgbaDigest: requireCaptureDigest(row.rgbaDigest, `${path}.rgbaDigest`),
  });
}
