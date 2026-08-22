import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildDocumentCandidateId,
  RealBuildLineageId,
} from "./real-build-candidate-lineage-identity";
import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
  type RealBuildCompiledObservationCameraId,
  type RealBuildCompiledObservationId,
  type RealBuildCompiledObservationMaskReference,
  type RealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-types";
import type { RealBuildCompiledTransitionId } from "./real-build-compiled-placement-lineage-types";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const LINEAGE = /^lineage:sha256:[0-9a-f]{64}$/u;
const CANDIDATE = /^document:sha256:[0-9a-f]{64}$/u;
const TRANSITION = /^transition:sha256:[0-9a-f]{64}$/u;
const SOURCE = /^compiled-observation-source:sha256:[0-9a-f]{64}$/u;
const CAMERA = /^compiled-observation-camera:sha256:[0-9a-f]{64}$/u;
const OBSERVATION = /^compiled-observation:sha256:[0-9a-f]{64}$/u;

export function closureRecord(
  value: unknown,
  path: string,
  exactKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an exact object.`);
  }
  const keys = Object.keys(value);
  if (keys.length !== exactKeys.length || exactKeys.some((key) => !Object.hasOwn(value, key))) {
    throw new TypeError(`${path} must contain exactly ${exactKeys.join(", ")}.`);
  }
  return value as Record<string, unknown>;
}

export function closureArray(
  value: unknown,
  path: string,
  maximum: number,
  minimum = 0,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new RangeError(`${path} must contain ${minimum} through ${maximum} entries.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) throw new TypeError(`${path} must be dense.`);
  }
  return value;
}

export function closureInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  }
  return Object.is(value, -0) ? 0 : (value as number);
}

export function closureScore(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${path} must be null or a finite score from 0 through 1.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function closureString(value: unknown, path: string, maximum = 1_024): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    [...value].some((character) => character.charCodeAt(0) <= 0x1f)
  ) {
    throw new TypeError(`${path} must be a bounded non-control string.`);
  }
  return value;
}

function patterned<T extends string>(
  value: unknown,
  path: string,
  pattern: RegExp,
  label: string,
): T {
  if (typeof value !== "string" || !pattern.test(value))
    throw new TypeError(`${path} must be ${label}.`);
  return value as T;
}

export const closureDigest = (value: unknown, path: string): Sha256Digest =>
  patterned(value, path, DIGEST, "a sha256 digest");
export const closureLineageId = (value: unknown, path: string): RealBuildLineageId =>
  patterned(value, path, LINEAGE, "a lineage:sha256 ID");
export const closureCandidateId = (value: unknown, path: string): RealBuildDocumentCandidateId =>
  patterned(value, path, CANDIDATE, "a document:sha256 ID");
export const closureTransitionId = (value: unknown, path: string): RealBuildCompiledTransitionId =>
  patterned(value, path, TRANSITION, "a transition:sha256 ID");
export const closureSourceId = (
  value: unknown,
  path: string,
): RealBuildCompiledObservationSourceId =>
  patterned(value, path, SOURCE, "a compiled-observation-source:sha256 ID");
export const closureCameraId = (
  value: unknown,
  path: string,
): RealBuildCompiledObservationCameraId =>
  patterned(value, path, CAMERA, "a compiled-observation-camera:sha256 ID");
export const closureObservationId = (
  value: unknown,
  path: string,
): RealBuildCompiledObservationId =>
  patterned(value, path, OBSERVATION, "a compiled-observation:sha256 ID");

export function closureMaskReference(
  value: unknown,
  path: string,
): RealBuildCompiledObservationMaskReference {
  const row = closureRecord(value, path, [
    "role",
    "offset",
    "bytes",
    "digest",
    "encoding",
    "widthPx",
    "heightPx",
  ]);
  if (row.role !== "branch-observation-bytes" || row.encoding !== "packed-binary-mask-msb/1") {
    throw new TypeError(`${path} must declare the compiled MSB mask role and encoding.`);
  }
  const widthPx = closureInteger(
    row.widthPx,
    `${path}.widthPx`,
    1,
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS,
  );
  const heightPx = closureInteger(
    row.heightPx,
    `${path}.heightPx`,
    1,
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS,
  );
  const pixels = widthPx * heightPx;
  if (
    !Number.isSafeInteger(pixels) ||
    pixels > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS
  ) {
    throw new RangeError(
      `${path} raster exceeds ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS} pixels.`,
    );
  }
  const bytes = Math.ceil(pixels / 8);
  const offset = closureInteger(
    row.offset,
    `${path}.offset`,
    0,
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES - 1,
  );
  closureInteger(row.bytes, `${path}.bytes`, bytes, bytes);
  if (offset > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES - bytes)
    throw new RangeError(`${path} range exceeds the local role ceiling.`);
  return intrinsicRealBuildFreeze({
    role: "branch-observation-bytes",
    offset,
    bytes,
    digest: closureDigest(row.digest, `${path}.digest`),
    encoding: "packed-binary-mask-msb/1",
    widthPx,
    heightPx,
  });
}
