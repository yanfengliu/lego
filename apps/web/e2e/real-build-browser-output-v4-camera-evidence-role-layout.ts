import type { RealBuildCompiledObservationMaskReference } from "./real-build-compiled-observation-closure-types";
import { exact, integer } from "./real-build-browser-output-v4-camera-evidence-reader-primitives";
import {
  maskReference,
  renderReference,
} from "./real-build-browser-output-v4-camera-evidence-reader-row-primitives";

const SAFE_OBJECT_HAS_OWN = Object.hasOwn;

const ROW_KEYS = [
  "evidenceId",
  "sourceId",
  "cameraId",
  "child",
  "preparedPanel",
  "fittedCamera",
  "fittedCameraDigest",
  "lattice",
  "d4CameraRecipeDigest",
  "rendererInputs",
  "rendererSnapshotDigest",
  "render",
  "maskExtraction",
  "maskRoleBaseOffset",
  "sourceMask",
  "excludedMask",
  "candidateMask",
  "registration",
] as const;

function sameMaskReference(
  left: RealBuildCompiledObservationMaskReference,
  right: RealBuildCompiledObservationMaskReference,
): boolean {
  return (
    left.role === right.role &&
    left.offset === right.offset &&
    left.bytes === right.bytes &&
    left.digest === right.digest &&
    left.encoding === right.encoding &&
    left.widthPx === right.widthPx &&
    left.heightPx === right.heightPx
  );
}

/**
 * Authenticates the complete role map before any raster replay. Mask references may be exact
 * aliases, but every distinct range must be disjoint and their union must cover the role densely.
 */
export function preflightRealBuildBrowserCameraEvidenceRoleLayout(
  rows: readonly unknown[],
  renderRoleBytes: number,
  maskRoleBytes: number,
): void {
  let nextRenderOffset = 0;
  const masksByRange = new Map<string, RealBuildCompiledObservationMaskReference>();
  for (let index = 0; index < rows.length; index += 1) {
    if (!SAFE_OBJECT_HAS_OWN(rows, String(index)))
      throw new TypeError(`manifest.rows[${index}] is not dense.`);
    const path = `manifest.rows[${index}]`;
    const row = exact(rows[index], path, ROW_KEYS);
    const maskRoleBaseOffset = integer(
      row.maskRoleBaseOffset,
      `${path}.maskRoleBaseOffset`,
      0,
      maskRoleBytes,
    );
    const render = renderReference(row.render, `${path}.render`);
    if (render.offset !== nextRenderOffset || render.offset + render.bytes > renderRoleBytes)
      throw new TypeError(
        `${path}.render must be exact, dense, non-overlapping, and ordered within its role.`,
      );
    nextRenderOffset += render.bytes;
    for (const [name, value] of [
      ["sourceMask", row.sourceMask],
      ["excludedMask", row.excludedMask],
      ["candidateMask", row.candidateMask],
    ] as const) {
      const reference = maskReference(value, `${path}.${name}`);
      const globalOffset = maskRoleBaseOffset + reference.offset;
      if (!Number.isSafeInteger(globalOffset) || globalOffset + reference.bytes > maskRoleBytes)
        throw new RangeError(`${path}.${name} exceeds its role.`);
      const globalReference = { ...reference, offset: globalOffset };
      const rangeKey = `${globalReference.offset}:${globalReference.bytes}`;
      const prior = masksByRange.get(rangeKey);
      if (prior !== undefined && !sameMaskReference(prior, globalReference))
        throw new TypeError(
          `${path}.${name} aliases an exact mask range with a different descriptor.`,
        );
      if (prior === undefined) masksByRange.set(rangeKey, globalReference);
    }
  }
  if (nextRenderOffset !== renderRoleBytes)
    throw new TypeError("Camera render role must be consumed exactly by its references.");
  const ranges = [...masksByRange.values()].sort(
    (left, right) => left.offset - right.offset || left.bytes - right.bytes,
  );
  let nextMaskOffset = 0;
  for (const range of ranges) {
    if (range.offset !== nextMaskOffset) {
      const defect = range.offset < nextMaskOffset ? "overlap" : "unused gap";
      throw new TypeError(`Camera mask role has a partial ${defect} at offset ${nextMaskOffset}.`);
    }
    nextMaskOffset += range.bytes;
  }
  if (nextMaskOffset !== maskRoleBytes)
    throw new TypeError(
      `Camera mask references cover ${nextMaskOffset} bytes, not the ${maskRoleBytes}-byte role, so it is not consumed exactly.`,
    );
}
