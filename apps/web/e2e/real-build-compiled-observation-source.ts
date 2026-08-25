import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES,
  MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS,
} from "./real-build-compiled-observation-closure-types";
import { realBuildCompiledObservationRegistrationVisits } from "./real-build-compiled-observation-registration";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { snapshotPanelCameraBinaryMask } from "./real-build-panel-camera-resolver-boundary";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildCompiledObservationSourceInput {
  readonly provisionalStepIdentity: Sha256Digest;
  readonly observationMode: "own-panel" | "lookahead";
  readonly registrationPanelStepNumber: number;
  readonly pageNumber: number;
  readonly panelDigest: Sha256Digest;
  readonly cropDigest: Sha256Digest;
  readonly sourceDescriptorDigest: Sha256Digest;
  readonly exclusionDescriptorDigest: Sha256Digest;
  readonly measure: "iou" | "containment";
  readonly widthPx: number;
  readonly heightPx: number;
  readonly sourceMask: Uint8Array;
  readonly excludedMask: Uint8Array | null;
}

export interface RealBuildCompiledObservationResourcePreflight {
  readonly pixelCount: number;
  readonly packedBytesPerMask: number;
  readonly predictedRoleBytes: number;
  readonly predictedPixelVisits: number;
}

function data(input: unknown, key: string): unknown {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Compiled observation source must be an in-process data object.");
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(input, key);
  } catch {
    throw new TypeError(`Compiled observation source ${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
    throw new TypeError(
      `Compiled observation source ${key} must be an enumerable own data property.`,
    );
  }
  return descriptor.value;
}

function digest(value: unknown, label: string): Sha256Digest {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(`${label} must be one lowercase sha256 digest.`);
  }
  return value as Sha256Digest;
}

/** Detaches the complete source before any compiler or renderer callback can mutate its owner. */
export function snapshotRealBuildCompiledObservationSource(
  input: RealBuildCompiledObservationSourceInput,
): RealBuildCompiledObservationSourceInput {
  const widthPx = data(input, "widthPx") as number;
  const heightPx = data(input, "heightPx") as number;
  realBuildCompiledObservationRegistrationVisits(widthPx, heightPx);
  const pixelCount = widthPx * heightPx;
  const observationMode = data(input, "observationMode");
  const registrationPanelStepNumber = data(input, "registrationPanelStepNumber");
  const pageNumber = data(input, "pageNumber");
  const measure = data(input, "measure");
  if (observationMode !== "own-panel" && observationMode !== "lookahead") {
    throw new TypeError("Compiled observation source mode must be own-panel or lookahead.");
  }
  if (
    !Number.isSafeInteger(registrationPanelStepNumber) ||
    (registrationPanelStepNumber as number) < 1 ||
    (registrationPanelStepNumber as number) > 359
  ) {
    throw new RangeError("Compiled observation registration panel must be in 1..359.");
  }
  if (
    !Number.isSafeInteger(pageNumber) ||
    (pageNumber as number) < 1 ||
    (pageNumber as number) > 10_000
  ) {
    throw new RangeError("Compiled observation source page must be in 1..10000.");
  }
  if (measure !== "iou" && measure !== "containment") {
    throw new TypeError("Compiled observation measure must be iou or containment.");
  }
  const excluded = data(input, "excludedMask");
  return intrinsicRealBuildFreeze({
    provisionalStepIdentity: digest(
      data(input, "provisionalStepIdentity"),
      "Compiled observation provisional step identity",
    ),
    observationMode,
    registrationPanelStepNumber: registrationPanelStepNumber as number,
    pageNumber: pageNumber as number,
    panelDigest: digest(data(input, "panelDigest"), "Compiled observation panel digest"),
    cropDigest: digest(data(input, "cropDigest"), "Compiled observation crop digest"),
    sourceDescriptorDigest: digest(
      data(input, "sourceDescriptorDigest"),
      "Compiled observation source descriptor digest",
    ),
    exclusionDescriptorDigest: digest(
      data(input, "exclusionDescriptorDigest"),
      "Compiled observation exclusion descriptor digest",
    ),
    measure,
    widthPx,
    heightPx,
    sourceMask: snapshotPanelCameraBinaryMask(
      data(input, "sourceMask"),
      pixelCount,
      "Compiled observation source mask",
    ),
    excludedMask:
      excluded === null
        ? null
        : snapshotPanelCameraBinaryMask(excluded, pixelCount, "Compiled observation excluded mask"),
  });
}

/** Proves closure allocation and replay bounds before protected compiler or renderer work. */
export function preflightRealBuildCompiledObservationResources(input: {
  readonly source: RealBuildCompiledObservationSourceInput;
  readonly rootCount: number;
  readonly cameraCount: number;
  readonly observationCount: number;
}): RealBuildCompiledObservationResourcePreflight {
  for (const [label, value] of [
    ["roots", input.rootCount],
    ["cameras", input.cameraCount],
    ["observations", input.observationCount],
  ] as const) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS
    ) {
      throw new RangeError(
        `Compiled observation producer accepts 0..${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS} ${label}.`,
      );
    }
  }
  const pixelCount = input.source.widthPx * input.source.heightPx;
  const packedBytesPerMask = Math.ceil(pixelCount / 8);
  const predictedRoleBytes = packedBytesPerMask * (2 + input.cameraCount);
  if (
    !Number.isSafeInteger(predictedRoleBytes) ||
    predictedRoleBytes > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES
  ) {
    throw new RangeError(
      `Compiled observation producer predicts ${predictedRoleBytes} role bytes above maximum ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_ROLE_BYTES}.`,
    );
  }
  const predictedPixelVisits =
    pixelCount +
    input.cameraCount *
      realBuildCompiledObservationRegistrationVisits(input.source.widthPx, input.source.heightPx);
  if (
    !Number.isSafeInteger(predictedPixelVisits) ||
    predictedPixelVisits > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS
  ) {
    throw new RangeError(
      `Compiled observation producer predicts ${predictedPixelVisits} pixel visits above maximum ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS}.`,
    );
  }
  return intrinsicRealBuildFreeze({
    pixelCount,
    packedBytesPerMask,
    predictedRoleBytes,
    predictedPixelVisits,
  });
}
