import { createHash } from "node:crypto";

import { MAXIMUM_REAL_BUILD_FARTHER_CAPTURES } from "./real-build-browser-output";
import { REAL_BUILD_DIAGNOSTIC_PREFIX_FILE } from "./real-build-diagnostic-prefix";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files";
import {
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  servedResponseChunkName,
} from "./real-build-served-response-policy";

export const REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA = "lego.real-build-artifact-manifest/4" as const;
export const LEGACY_REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA_V3 =
  "lego.real-build-artifact-manifest/3" as const;

export const MAXIMUM_ARTIFACT_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_REAL_BUILD_PRINTED_STEPS = 359;
export const MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_REAL_BUILD_SCORE_BYTES = 16 * 1024 * 1024;
const MAXIMUM_SERVED_RESPONSE_CHUNKS = Math.ceil(
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES / MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
);
export const MAXIMUM_RETAINED_ARTIFACTS =
  MAXIMUM_REAL_BUILD_PRINTED_STEPS * 2 +
  (MAXIMUM_REAL_BUILD_PRINTED_STEPS - 1) * MAXIMUM_REAL_BUILD_FARTHER_CAPTURES +
  MAXIMUM_SERVED_RESPONSE_CHUNKS +
  4;
export const MAXIMUM_RETAINED_ARTIFACT_AGGREGATE_BYTES =
  MAXIMUM_REAL_BUILD_PRINTED_STEPS * 2 * MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES +
  (MAXIMUM_REAL_BUILD_PRINTED_STEPS - 1) *
    MAXIMUM_REAL_BUILD_FARTHER_CAPTURES *
    MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES +
  MAXIMUM_SERVED_RESPONSE_CHUNKS * MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES +
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES +
  MAXIMUM_REAL_BUILD_DOCUMENT_BYTES * 2 +
  MAXIMUM_REAL_BUILD_SCORE_BYTES;

export function sha256Digest(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function maximumRealBuildRetainedArtifactBytes(file: string): number {
  const normalized = normalizeRealBuildRelativePath(file, "retained artifact");
  const stepMatch = /^step-([0-9]{3})-(?:panel|build)\.png$/u.exec(normalized);
  if (stepMatch !== null) {
    const step = Number(stepMatch[1]);
    if (step >= 1 && step <= MAXIMUM_REAL_BUILD_PRINTED_STEPS) {
      return MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES;
    }
  }
  const fartherMatch =
    /^step-([0-9]{3})-farther-([0-9]{2})-(?:source-panel|candidate-render)-panel-([0-9]{3})\.png$/u.exec(
      normalized,
    );
  if (fartherMatch !== null) {
    const step = Number(fartherMatch[1]);
    const captureId = Number(fartherMatch[2]);
    const panelStep = Number(fartherMatch[3]);
    if (
      step >= 1 &&
      step <= MAXIMUM_REAL_BUILD_PRINTED_STEPS &&
      captureId >= 0 &&
      captureId < MAXIMUM_REAL_BUILD_FARTHER_CAPTURES &&
      panelStep > step &&
      panelStep <= MAXIMUM_REAL_BUILD_PRINTED_STEPS
    ) {
      return MAXIMUM_REAL_BUILD_STEP_CAPTURE_BYTES;
    }
  }
  if (normalized === "document.json" || normalized === REAL_BUILD_DIAGNOSTIC_PREFIX_FILE) {
    return MAXIMUM_REAL_BUILD_DOCUMENT_BYTES;
  }
  if (normalized === "score.json") return MAXIMUM_REAL_BUILD_SCORE_BYTES;
  if (normalized === REAL_BUILD_SERVED_RESPONSE_MANIFEST) {
    return MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES;
  }
  for (let index = 0; index < MAXIMUM_SERVED_RESPONSE_CHUNKS; index += 1) {
    if (normalized === servedResponseChunkName(index)) {
      return MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES;
    }
  }
  throw new TypeError(
    `Retained artifact ${normalized} is not one of the bounded step, canonical/diagnostic document, score, or served-response evidence classes.`,
  );
}

export function validateRealBuildArtifactFilePlan(files: readonly string[]): readonly string[] {
  if (files.length > MAXIMUM_RETAINED_ARTIFACTS) {
    throw new TypeError(
      `Artifact manifest has ${files.length} declared files; the 359-step live-shape maximum is ${MAXIMUM_RETAINED_ARTIFACTS}.`,
    );
  }
  const normalized = files.map((file) => {
    const path = normalizeRealBuildRelativePath(file, "retained artifact");
    maximumRealBuildRetainedArtifactBytes(path);
    return path;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError("Artifact manifest files must be unique within the bounded live shape.");
  }
  const fartherOrdinalsByStep = new Map<number, Set<number>>();
  for (const file of normalized) {
    const match = /^step-([0-9]{3})-farther-([0-9]{2})-/u.exec(file);
    if (match === null) continue;
    const step = Number(match[1]);
    const ordinal = Number(match[2]);
    const ordinals = fartherOrdinalsByStep.get(step) ?? new Set<number>();
    if (ordinals.has(ordinal)) {
      throw new TypeError(
        `Printed step ${step} repeats farther capture ordinal ${ordinal}; required one deterministic path per captureId.`,
      );
    }
    ordinals.add(ordinal);
    fartherOrdinalsByStep.set(step, ordinals);
  }
  return normalized;
}
