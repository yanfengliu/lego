import { sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";

import { MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS } from "../src/assembly/panel-art-stages";
import { snapshotObservationSourceCandidateRgba } from "./real-build-observation-source-raster-candidate-input";

export const MAXIMUM_REAL_BUILD_CALIBRATION_HIGH_RGBA_BYTES =
  4 * MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS;

export interface RealBuildPanelCalibrationHighRgbaSnapshot {
  readonly encoding: "rgba8-clamped/1";
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly byteLength: number;
  readonly rgbaDigest: Sha256Digest;
}

// This descriptor protects retained byte integrity only. It does not authenticate which PDF,
// panel preparation, served source, or execution produced those pixels; later integration must
// bind those identities in the same execution closure before the snapshot can support a gate.

const retainedHighRgba = new WeakMap<
  RealBuildPanelCalibrationHighRgbaSnapshot,
  Uint8ClampedArray
>();

export function createRealBuildPanelCalibrationHighRgbaSnapshot(
  rawPixels: unknown,
  width: number,
  height: number,
): RealBuildPanelCalibrationHighRgbaSnapshot {
  const pixelCount = width * height;
  const byteLength = pixelCount * 4;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(pixelCount) ||
    pixelCount > MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS ||
    !Number.isSafeInteger(byteLength) ||
    byteLength > MAXIMUM_REAL_BUILD_CALIBRATION_HIGH_RGBA_BYTES
  ) {
    throw new RangeError(
      `Calibration high RGBA dimensions ${String(width)}x${String(height)} must cover 1 through ${MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS} pixels and at most ${MAXIMUM_REAL_BUILD_CALIBRATION_HIGH_RGBA_BYTES} bytes.`,
    );
  }
  const pixels = snapshotObservationSourceCandidateRgba(rawPixels, byteLength);
  const snapshot = Object.freeze({
    encoding: "rgba8-clamped/1" as const,
    width,
    height,
    pixelCount,
    byteLength,
    rgbaDigest: `sha256:${sha256Hex(
      new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
    )}` as Sha256Digest,
  });
  retainedHighRgba.set(snapshot, pixels);
  return snapshot;
}

/** Returns fresh mutable storage; callers can never modify the retained calibration raster. */
export function copyRealBuildPanelCalibrationHighRgba(snapshot: unknown): Uint8ClampedArray {
  if (
    snapshot === null ||
    (typeof snapshot !== "object" && typeof snapshot !== "function") ||
    !retainedHighRgba.has(snapshot as RealBuildPanelCalibrationHighRgbaSnapshot)
  ) {
    throw new TypeError(
      "Calibration high RGBA must be a recognized storage-integrity snapshot created by createRealBuildPanelCalibrationHighRgbaSnapshot; this does not authenticate pixel origin.",
    );
  }
  return new Uint8ClampedArray(
    retainedHighRgba.get(snapshot as RealBuildPanelCalibrationHighRgbaSnapshot)!,
  );
}
