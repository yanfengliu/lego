import { createHash } from "node:crypto";

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { OrthographicViewFrame, OrthographicViewParameters } from "@lego-studio/rendering";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import type {
  RealBuildPrefix50Step44CameraAlignmentPass,
  RealBuildPrefix50Step44CameraBranchKey,
  RealBuildPrefix50Step44CameraRegistrationProposal,
  RealBuildPrefix50Step44CameraRenderEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import type { RealBuildPrefix50EligibleMaskSearchResult } from "./real-build-prefix50-subbuild-return-review-camera-registration.ts";

const PIXELS =
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH * REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT;

export interface RealBuildPrefix50Step44MaskAgreement {
  readonly panelForegroundPixels: number;
  readonly parentForegroundPixels: number;
  readonly intersectionPixels: number;
  readonly unionPixels: number;
  readonly intersectionOverUnion: number;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function requireCameraMask(mask: Uint8Array, label: string): Uint8Array {
  if (!(mask instanceof Uint8Array) || mask.byteLength !== PIXELS)
    throw new RangeError(`${label} must contain exactly ${PIXELS} binary pixels.`);
  for (const value of mask)
    if (value !== 0 && value !== 1)
      throw new TypeError(`${label} must contain only exact binary values 0 or 1.`);
  return new Uint8Array(mask);
}

export function cloneCameraParameters(
  parameters: OrthographicViewParameters,
  label = "Step-44 camera parameters",
): OrthographicViewParameters {
  const values = [
    parameters.azimuthDegrees,
    parameters.elevationDegrees,
    parameters.pixelsPerUnit,
    parameters.centerXPx,
    parameters.centerYPx,
  ];
  if (
    !values.every(Number.isFinite) ||
    parameters.pixelsPerUnit <= 0 ||
    (parameters.upSign !== undefined && parameters.upSign !== 1 && parameters.upSign !== -1)
  )
    throw new TypeError(`${label} must contain finite values, positive scale, and exact up sign.`);
  return Object.freeze({
    azimuthDegrees: parameters.azimuthDegrees,
    elevationDegrees: parameters.elevationDegrees,
    pixelsPerUnit: parameters.pixelsPerUnit,
    centerXPx: parameters.centerXPx,
    centerYPx: parameters.centerYPx,
    ...(parameters.upSign === undefined ? {} : { upSign: parameters.upSign }),
  });
}

export function cloneCameraFrame(
  frame: OrthographicViewFrame,
  label = "Step-44 camera frame",
): OrthographicViewFrame {
  if (
    frame.widthPx !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH ||
    frame.heightPx !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT ||
    !Array.isArray(frame.target) ||
    frame.target.length !== 3 ||
    ![...frame.target, frame.sceneRadius].every(Number.isFinite) ||
    frame.sceneRadius <= 0
  )
    throw new TypeError(`${label} must be the exact finite 720x470 model frame.`);
  return deepFreeze({
    widthPx: frame.widthPx,
    heightPx: frame.heightPx,
    target: [frame.target[0]!, frame.target[1]!, frame.target[2]!] as const,
    sceneRadius: frame.sceneRadius,
  });
}

function cloneCameraMatrix(matrix: readonly number[], label: string): readonly number[] {
  if (!Array.isArray(matrix) || matrix.length !== 16 || !matrix.every(Number.isFinite))
    throw new TypeError(`${label} must contain exactly 16 finite values.`);
  return Object.freeze([...matrix]);
}

export function requireCameraRender(
  render: RealBuildPrefix50Step44CameraRenderEvidence,
  label: string,
  parameters: OrthographicViewParameters,
  frame: OrthographicViewFrame,
): RealBuildPrefix50Step44CameraRenderEvidence {
  const pngBytes = new Uint8Array(render.pngBytes);
  const rgba = new Uint8Array(render.rgba);
  const stableParameters = cloneCameraParameters(parameters, `${label} request parameters`);
  const stableFrame = cloneCameraFrame(frame, `${label} request frame`);
  const projectionMatrix = cloneCameraMatrix(render.projectionMatrix, `${label} projection matrix`);
  const matrixWorldInverse = cloneCameraMatrix(
    render.matrixWorldInverse,
    `${label} world-inverse matrix`,
  );
  if (
    !(render.pngBytes instanceof Uint8Array) ||
    !(render.rgba instanceof Uint8Array) ||
    rgba.byteLength !== PIXELS * 4 ||
    pngBytes.byteLength === 0 ||
    render.pngDigest !== sha256(pngBytes) ||
    render.pixelDigest !== sha256(rgba) ||
    render.rendererCameraCommitment !==
      canonicalDigest({
        request: {
          scene: "model-only",
          backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
          parameters: stableParameters,
          frame: stableFrame,
        },
        projectionMatrix,
        matrixWorldInverse,
      })
  )
    throw new TypeError(
      `${label} must bind exact 720x470 RGBA, PNG bytes, and renderer matrices to their commitments.`,
    );
  return Object.freeze({
    pngBytes,
    rgba,
    pngDigest: render.pngDigest,
    pixelDigest: render.pixelDigest,
    projectionMatrix,
    matrixWorldInverse,
    rendererCameraCommitment: render.rendererCameraCommitment,
  });
}

export function foregroundMask(rgba: Uint8Array): Uint8Array {
  if (!(rgba instanceof Uint8Array) || rgba.byteLength !== PIXELS * 4)
    throw new RangeError(`Step-44 foreground input must contain exactly ${PIXELS * 4} RGBA bytes.`);
  const red = (REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX >> 16) & 0xff;
  const green = (REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX >> 8) & 0xff;
  const blue = REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX & 0xff;
  const mask = new Uint8Array(PIXELS);
  for (let index = 0; index < PIXELS; index += 1) {
    const offset = index * 4;
    if (
      rgba[offset + 3] !== 0 &&
      Math.max(
        Math.abs(rgba[offset]! - red),
        Math.abs(rgba[offset + 1]! - green),
        Math.abs(rgba[offset + 2]! - blue),
      ) > 10
    )
      mask[index] = 1;
  }
  return mask;
}

export function eligibleAgreement(input: {
  readonly renderedForeground: Uint8Array;
  readonly target: Uint8Array;
  readonly eligible: Uint8Array;
}): RealBuildPrefix50Step44MaskAgreement {
  const rendered = requireCameraMask(input.renderedForeground, "Step-44 rendered foreground");
  const target = requireCameraMask(input.target, "Step-44 parent-only target");
  const eligible = requireCameraMask(input.eligible, "Step-44 eligible region");
  let panelForegroundPixels = 0;
  let parentForegroundPixels = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  for (let index = 0; index < PIXELS; index += 1) {
    if (target[index] === 1) panelForegroundPixels += 1;
    if (eligible[index] !== 1) continue;
    const parent = rendered[index] === 1;
    const panel = target[index] === 1;
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

export function cameraCommitment(
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

export function applyRegistrationProposal(
  parameters: OrthographicViewParameters,
  transform: { readonly scale: number; readonly offsetXPx: number; readonly offsetYPx: number },
): OrthographicViewParameters {
  return deepFreeze({
    ...parameters,
    pixelsPerUnit: parameters.pixelsPerUnit * transform.scale,
    centerXPx: parameters.centerXPx * transform.scale + transform.offsetXPx,
    centerYPx: parameters.centerYPx * transform.scale + transform.offsetYPx,
  });
}

export function registrationProposal(
  result: RealBuildPrefix50EligibleMaskSearchResult,
  parameters: OrthographicViewParameters,
): RealBuildPrefix50Step44CameraRegistrationProposal {
  const proposedParameters =
    result.status !== "locally-contained" || result.transform === null
      ? null
      : applyRegistrationProposal(parameters, result.transform);
  const body = {
    status: result.status,
    transform: result.transform,
    refusalReason: result.status === "refused" ? result.reason : null,
    diagnostics: result.diagnostics,
    proposedParameters,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export function branchFace(
  branchKey: RealBuildPrefix50Step44CameraBranchKey,
): "studs-up" | "underside" {
  return branchKey.startsWith("face:studs-up/") ? "studs-up" : "underside";
}

export function stableBranchKeys(): readonly RealBuildPrefix50Step44CameraBranchKey[] {
  const keys: RealBuildPrefix50Step44CameraBranchKey[] = [];
  for (const face of ["studs-up", "underside"] as const)
    for (const hand of ["as-fitted", "x-reflected"] as const)
      for (const turn of [0, 1, 2, 3] as const) keys.push(`face:${face}/hand:${hand}/turn:${turn}`);
  return Object.freeze(keys);
}

export function requireStableBranches(
  branches: readonly { readonly branchKey: RealBuildPrefix50Step44CameraBranchKey }[],
): void {
  const expected = stableBranchKeys();
  if (
    branches.length !== expected.length ||
    branches.some((branch, index) => branch.branchKey !== expected[index])
  )
    throw new TypeError(
      "Step-44 camera search requires the exact stable 16-branch face/hand/quarter-turn order.",
    );
}

export function requireStableCameraMeasurementRoster(
  rows: readonly {
    readonly branchIndex: number;
    readonly branchKey: RealBuildPrefix50Step44CameraBranchKey;
    readonly branchFace: "studs-up" | "underside";
  }[],
  expectedPanelFace: "studs-up" | "underside",
): void {
  const expected = stableBranchKeys();
  if (
    rows.length !== expected.length ||
    rows.some(
      (row, index) =>
        row.branchIndex !== index ||
        row.branchKey !== expected[index] ||
        row.branchFace !== branchFace(row.branchKey),
    ) ||
    rows.filter((row) => row.branchFace === expectedPanelFace).length !== 8
  )
    throw new TypeError(
      "Step-44 camera decisions require the exact stable 16-row branch roster and eight expected-face rows.",
    );
}

export function cameraPass(input: {
  readonly passIndex: number;
  readonly passKind: "seed" | "confirmation" | "rebase";
  readonly artifactFile: string;
  readonly parameters: OrthographicViewParameters;
  readonly frame: OrthographicViewFrame;
  readonly render: RealBuildPrefix50Step44CameraRenderEvidence;
  readonly agreement: RealBuildPrefix50Step44MaskAgreement;
  readonly proposal: RealBuildPrefix50Step44CameraRegistrationProposal | null;
  readonly predictedIntersectionOverUnion: number | null;
  readonly incomingPredictionActualIntersectionOverUnionDrift: number | null;
  readonly settled: boolean;
}): RealBuildPrefix50Step44CameraAlignmentPass {
  const parameters = cloneCameraParameters(input.parameters);
  const frame = cloneCameraFrame(input.frame);
  const proposed = cloneCameraParameters(input.proposal?.proposedParameters ?? parameters);
  const body = {
    passIndex: input.passIndex,
    passKind: input.passKind,
    artifactFile: input.artifactFile,
    parameters,
    cameraCommitment: cameraCommitment(parameters, frame),
    pngDigest: input.render.pngDigest,
    pixelDigest: input.render.pixelDigest,
    projectionMatrix: Object.freeze([...input.render.projectionMatrix]),
    matrixWorldInverse: Object.freeze([...input.render.matrixWorldInverse]),
    rendererCameraCommitment: input.render.rendererCameraCommitment,
    ...input.agreement,
    registrationProposal: input.proposal,
    predictedIntersectionOverUnion: input.predictedIntersectionOverUnion,
    incomingPredictionActualIntersectionOverUnionDrift:
      input.incomingPredictionActualIntersectionOverUnionDrift,
    solvedParameters: proposed,
    solvedCenterDeltaPx: Math.hypot(
      proposed.centerXPx - input.parameters.centerXPx,
      proposed.centerYPx - input.parameters.centerYPx,
    ),
    solvedScaleDeltaFraction:
      Math.abs(proposed.pixelsPerUnit - input.parameters.pixelsPerUnit) /
      input.parameters.pixelsPerUnit,
    settled: input.settled,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
