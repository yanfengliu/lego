import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_LINEAGE_ID_PATTERN,
  REAL_BUILD_SHA256_DIGEST_PATTERN,
  snapshotRealBuildLineageIdentity,
  type RealBuildDocumentCandidateId,
  type RealBuildLineageId,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_MASK_PIXELS,
  MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROLE_BYTES,
  type RealBuildCompiledObservationByteReference,
  type RealBuildCompiledTransitionId,
} from "./real-build-compiled-placement-lineage-types";

const TRANSITION_ID = /^transition:sha256:[0-9a-f]{64}$/u;
const CANDIDATE_ID = /^document:sha256:[0-9a-f]{64}$/u;

export function compiledEvidenceRecord(
  value: unknown,
  path: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object with exact keys ${keys.join(", ")}.`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    const missing = keys.filter((key) => !Object.hasOwn(value, key));
    const expected = new Set(keys);
    const extra = actual.filter((key) => !expected.has(key));
    throw new TypeError(
      `${path} has an inexact shape; missing [${missing.join(", ")}], unexpected [${extra.join(", ")}].`,
    );
  }
  return value as Record<string, unknown>;
}

export function compiledEvidenceArray(
  value: unknown,
  path: string,
  maximum: number,
  minimum = 0,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new RangeError(`${path} must contain ${minimum} through ${maximum} dense entries.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) throw new TypeError(`${path} has a hole at index ${index}.`);
  }
  return value;
}

export function compiledEvidenceInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RangeError(
      `${path} must be a safe integer from ${minimum} through ${maximum}; received ${String(value)}.`,
    );
  }
  return value as number;
}

export function compiledEvidenceString(value: unknown, path: string, maximum = 256): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.includes("\0")
  ) {
    throw new TypeError(`${path} must contain 1 through ${maximum} non-NUL characters.`);
  }
  return value;
}

export function compiledEvidenceDigest(value: unknown, path: string): Sha256Digest {
  if (typeof value !== "string" || !REAL_BUILD_SHA256_DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${path} must be an exact lowercase sha256 digest.`);
  }
  return value as Sha256Digest;
}

export function compiledEvidenceCandidateId(
  value: unknown,
  path: string,
): RealBuildDocumentCandidateId {
  if (typeof value !== "string" || !CANDIDATE_ID.test(value)) {
    throw new TypeError(`${path} must be document: followed by an exact lowercase sha256 digest.`);
  }
  return value as RealBuildDocumentCandidateId;
}

export function compiledEvidenceLineageId(value: unknown, path: string): RealBuildLineageId {
  if (
    typeof value !== "string" ||
    !REAL_BUILD_LINEAGE_ID_PATTERN.test(value) ||
    !/^lineage:sha256:[0-9a-f]{64}$/u.test(value)
  ) {
    throw new TypeError(`${path} must be a generated lineage:sha256 identifier.`);
  }
  return value as RealBuildLineageId;
}

export function compiledEvidenceTransitionId(
  value: unknown,
  path: string,
): RealBuildCompiledTransitionId {
  if (typeof value !== "string" || !TRANSITION_ID.test(value)) {
    throw new TypeError(`${path} must be a transition:sha256 identifier.`);
  }
  return value as RealBuildCompiledTransitionId;
}

export function compiledEvidenceLineageIdentity(
  value: unknown,
  path: string,
): RealBuildLineageIdentity {
  compiledEvidenceRecord(value, path, [
    "candidateId",
    "documentHash",
    "lineageId",
    "lineageOrigin",
    "localIdentity",
    "originLineageId",
    "parentLineageId",
    "throughStepNumber",
  ]);
  compiledEvidenceRecord(
    (value as Record<string, unknown>).localIdentity,
    `${path}.localIdentity`,
    ["id", "kind"],
  );
  return snapshotRealBuildLineageIdentity(value);
}

export function compiledEvidenceNullableScore(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${path} must be null or a finite unit-interval score.`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function compiledEvidenceMaskReference(
  value: unknown,
  path: string,
): RealBuildCompiledObservationByteReference | null {
  if (value === null) return null;
  const row = compiledEvidenceRecord(value, path, [
    "role",
    "offset",
    "bytes",
    "digest",
    "encoding",
    "widthPx",
    "heightPx",
  ]);
  if (row.role !== "branch-observation-bytes") {
    throw new TypeError(`${path}.role must be branch-observation-bytes.`);
  }
  if (row.encoding !== "packed-binary-mask-msb/1") {
    throw new TypeError(`${path}.encoding must be packed-binary-mask-msb/1.`);
  }
  const offset = compiledEvidenceInteger(
    row.offset,
    `${path}.offset`,
    0,
    MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROLE_BYTES - 1,
  );
  const widthPx = compiledEvidenceInteger(
    row.widthPx,
    `${path}.widthPx`,
    1,
    MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_MASK_PIXELS,
  );
  const heightPx = compiledEvidenceInteger(
    row.heightPx,
    `${path}.heightPx`,
    1,
    MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_MASK_PIXELS,
  );
  const pixels = widthPx * heightPx;
  if (!Number.isSafeInteger(pixels) || pixels > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_MASK_PIXELS) {
    throw new RangeError(
      `${path} raster has ${pixels} pixels; maximum is ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_MASK_PIXELS}.`,
    );
  }
  const expectedBytes = Math.ceil(pixels / 8);
  const bytes = compiledEvidenceInteger(row.bytes, `${path}.bytes`, expectedBytes, expectedBytes);
  if (offset > MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_ROLE_BYTES - bytes) {
    throw new RangeError(`${path} byte range exceeds the bounded branch-observation role.`);
  }
  return Object.freeze({
    role: "branch-observation-bytes",
    offset,
    bytes,
    digest: compiledEvidenceDigest(row.digest, `${path}.digest`),
    encoding: "packed-binary-mask-msb/1",
    widthPx,
    heightPx,
  });
}
