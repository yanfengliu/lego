import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { OrthographicViewFrame, OrthographicViewParameters } from "@lego-studio/rendering";

import type { RealBuildPrefix50EligibleMaskSearchResult } from "./real-build-prefix50-subbuild-return-review-camera-registration.ts";
import type {
  RealBuildPrefix50Step44CameraBranchKey,
  RealBuildPrefix50Step44CameraRegistrationProposal,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";

const PIXELS =
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH * REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT;

export interface RealBuildPrefix50Step44VerifiedMaskAgreement {
  readonly panelForegroundPixels: number;
  readonly parentForegroundPixels: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly intersectionOverUnion: number;
}

function requireBinaryMask(mask: Uint8Array, label: string): Uint8Array {
  if (!(mask instanceof Uint8Array) || mask.byteLength !== PIXELS)
    throw new RangeError(`${label} must contain exactly ${PIXELS} binary pixels.`);
  for (const value of mask)
    if (value !== 0 && value !== 1)
      throw new TypeError(`${label} must contain only exact binary values 0 or 1.`);
  return mask;
}

export function independentlyDeriveRealBuildPrefix50Step44ForegroundMask(
  rgba: Uint8Array,
): Uint8Array {
  if (!(rgba instanceof Uint8Array) || rgba.byteLength !== PIXELS * 4)
    throw new RangeError(
      `Persisted Step-44 foreground input must contain exactly ${PIXELS * 4} RGBA bytes.`,
    );
  const red = (REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX >> 16) & 0xff;
  const green = (REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX >> 8) & 0xff;
  const blue = REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX & 0xff;
  const mask = new Uint8Array(PIXELS);
  for (let index = 0; index < PIXELS; index += 1) {
    const offset = index * 4;
    const distance = Math.max(
      Math.abs(rgba[offset]! - red),
      Math.abs(rgba[offset + 1]! - green),
      Math.abs(rgba[offset + 2]! - blue),
    );
    if (rgba[offset + 3] !== 0 && distance > 10) mask[index] = 1;
  }
  return mask;
}

/**
 * Recomputes the fixed blue/cyan class extraction without calling the
 * production metric helper. The semantic render uses unlit cyan for target
 * parts and dark neutral gray for every other part; the HSV bounds also retain
 * anti-aliased cyan edge pixels while excluding the gray and page background.
 */
export function independentlyDeriveRealBuildPrefix50Step44SemanticBlueCyanMask(
  rgba: Uint8Array,
): Uint8Array {
  if (!(rgba instanceof Uint8Array) || rgba.byteLength !== PIXELS * 4)
    throw new RangeError(
      `Persisted Step-44 semantic color input must contain exactly ${PIXELS * 4} RGBA bytes.`,
    );
  const foreground = independentlyDeriveRealBuildPrefix50Step44ForegroundMask(rgba);
  const mask = new Uint8Array(PIXELS);
  for (let index = 0; index < PIXELS; index += 1) {
    if (foreground[index] !== 1) continue;
    const offset = index * 4;
    const red = rgba[offset]! / 255;
    const green = rgba[offset + 1]! / 255;
    const blue = rgba[offset + 2]! / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    const saturation = maximum === 0 ? 0 : delta / maximum;
    let hue = 0;
    if (delta !== 0) {
      if (maximum === red) hue = ((green - blue) / delta) % 6;
      else if (maximum === green) hue = (blue - red) / delta + 2;
      else hue = (red - green) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    if (saturation >= 0.2 && maximum >= 0.12 && hue >= 175 && hue < 265) mask[index] = 1;
  }
  return mask;
}

export function independentlyMeasureRealBuildPrefix50Step44EligibleAgreement(input: {
  readonly renderedForeground: Uint8Array;
  readonly target: Uint8Array;
  readonly eligible: Uint8Array;
}): RealBuildPrefix50Step44VerifiedMaskAgreement {
  const rendered = requireBinaryMask(input.renderedForeground, "Persisted rendered foreground");
  const target = requireBinaryMask(input.target, "Persisted parent-only target");
  const eligible = requireBinaryMask(input.eligible, "Persisted eligible region");
  let panelForegroundPixels = 0;
  let parentForegroundPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  for (let index = 0; index < PIXELS; index += 1) {
    const panel = target[index] === 1;
    if (panel) panelForegroundPixels += 1;
    if (eligible[index] !== 1) continue;
    const parent = rendered[index] === 1;
    if (parent) parentForegroundPixels += 1;
    if (parent && panel) intersectionPixels += 1;
    if (parent || panel) unionPixels += 1;
  }
  return Object.freeze({
    panelForegroundPixels,
    parentForegroundPixels,
    intersectionPixels,
    unionPixels,
    intersectionOverUnion: unionPixels === 0 ? 0 : intersectionPixels / unionPixels,
  });
}

export function independentlyApplyRealBuildPrefix50Step44Registration(input: {
  readonly parameters: OrthographicViewParameters;
  readonly transform: {
    readonly scale: number;
    readonly offsetXPx: number;
    readonly offsetYPx: number;
  };
}): OrthographicViewParameters {
  return deepFreeze({
    ...input.parameters,
    pixelsPerUnit: input.parameters.pixelsPerUnit * input.transform.scale,
    centerXPx: input.parameters.centerXPx * input.transform.scale + input.transform.offsetXPx,
    centerYPx: input.parameters.centerYPx * input.transform.scale + input.transform.offsetYPx,
  });
}

export function independentlyDeriveRealBuildPrefix50Step44RegistrationProposal(
  result: RealBuildPrefix50EligibleMaskSearchResult,
  parameters: OrthographicViewParameters,
): RealBuildPrefix50Step44CameraRegistrationProposal {
  const proposedParameters =
    result.status !== "locally-contained" || result.transform === null
      ? null
      : independentlyApplyRealBuildPrefix50Step44Registration({
          parameters,
          transform: result.transform,
        });
  const body = {
    status: result.status,
    transform: result.transform,
    refusalReason: result.status === "refused" ? result.reason : null,
    diagnostics: result.diagnostics,
    proposedParameters,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function independentlyDeriveRealBuildPrefix50Step44CameraCommitment(
  parameters: OrthographicViewParameters,
  frame: OrthographicViewFrame,
): `sha256:${string}` {
  return canonicalDigest({
    scene: "model-only",
    backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
    parameters,
    frame,
    width: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
    height: REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  });
}

export function independentlyDeriveRealBuildPrefix50Step44BranchFace(
  branchKey: RealBuildPrefix50Step44CameraBranchKey,
): "studs-up" | "underside" {
  return branchKey.startsWith("face:studs-up/") ? "studs-up" : "underside";
}
