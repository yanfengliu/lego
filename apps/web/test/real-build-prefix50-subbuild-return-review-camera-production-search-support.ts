import { createHash } from "node:crypto";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  SEMANTIC_COLOR_MASK_OTHER_HEX,
  SEMANTIC_COLOR_MASK_TARGET_HEX,
  type OrthographicViewFrame,
  type OrthographicViewParameters,
} from "@lego-studio/rendering";

import { stableBranchKeys } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import type {
  RealBuildPrefix50Step44SemanticColorPolicy,
  RealBuildPrefix50Step44SemanticColorRenderEvidence,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-semantic.ts";

export const WIDTH = 720;
export const HEIGHT = 470;
const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const DARK = [0x22, 0x25, 0x23, 0xff] as const;
const BLUE = [0x18, 0x91, 0xce, 0xff] as const;
export const BACKGROUND_HEX = 0x899093;
const TRUTH = { scale: 1.02, offsetXPx: 7.3, offsetYPx: -5.4 } as const;

type FixtureMode =
  | "positive"
  | "geometry-tie"
  | "feature-competitor"
  | "color-shopping-adversary"
  | "identity-ambiguity";

export function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function background(): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) rgba.set(BACKGROUND, index * 4);
  return rgba;
}

function fill(
  rgba: Uint8Array,
  bounds: readonly [number, number, number, number],
  color: readonly [number, number, number, number],
): void {
  const [minX, minY, maxX, maxY] = bounds;
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) rgba.set(color, (y * WIDTH + x) * 4);
}

function source(): Uint8Array {
  const rgba = background();
  fill(rgba, [80, 90, 625, 180], DARK);
  fill(rgba, [80, 181, 350, 405], DARK);
  fill(rgba, [300, 145, 505, 285], DARK);
  fill(rgba, [460, 240, 625, 405], DARK);
  fill(rgba, [125, 115, 175, 145], BACKGROUND);
  fill(rgba, [535, 120, 590, 155], BACKGROUND);
  fill(rgba, [205, 190, 275, 250], BLUE);
  fill(rgba, [500, 275, 560, 345], BLUE);
  return rgba;
}

function identitySource(): Uint8Array {
  const rgba = background();
  fill(rgba, [160, 120, 560, 360], DARK);
  fill(rgba, [300, 205, 420, 275], BLUE);
  return rgba;
}

function renderVariant(input: {
  readonly branchIndex: number;
  readonly mode: FixtureMode;
}): Uint8Array {
  if (input.mode === "identity-ambiguity") return identitySource();
  const rgba = source();
  if (input.branchIndex === 0) {
    if (input.mode === "color-shopping-adversary") fill(rgba, [530, 275, 560, 345], DARK);
    return rgba;
  }
  if (input.branchIndex < 8) {
    if (!(input.mode === "feature-competitor" && input.branchIndex === 1)) {
      fill(rgba, [205, 190, 275, 250], DARK);
      fill(rgba, [500, 275, 560, 345], DARK);
    }
    if (!(input.mode === "geometry-tie" && input.branchIndex === 1))
      fill(rgba, [585, 90, 625, 405], BACKGROUND);
    return rgba;
  }
  if (input.branchIndex === 15) return background();
  fill(rgba, [575, 90, 625, 405], BACKGROUND);
  return rgba;
}

function foreground(rgba: Uint8Array): Uint8Array {
  const mask = new Uint8Array(WIDTH * HEIGHT);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    if (
      rgba[offset] !== BACKGROUND[0] ||
      rgba[offset + 1] !== BACKGROUND[1] ||
      rgba[offset + 2] !== BACKGROUND[2]
    )
      mask[index] = 1;
  }
  return mask;
}

function warp(
  rgba: Uint8Array,
  transform: { readonly scale: number; readonly offsetXPx: number; readonly offsetYPx: number },
): Uint8Array {
  const result = background();
  for (let y = 0; y < HEIGHT; y += 1)
    for (let x = 0; x < WIDTH; x += 1) {
      const sourceX = Math.round((x - transform.offsetXPx) / transform.scale);
      const sourceY = Math.round((y - transform.offsetYPx) / transform.scale);
      if (sourceX < 0 || sourceX >= WIDTH || sourceY < 0 || sourceY >= HEIGHT) continue;
      const sourceOffset = (sourceY * WIDTH + sourceX) * 4;
      if (
        rgba[sourceOffset] === BACKGROUND[0] &&
        rgba[sourceOffset + 1] === BACKGROUND[1] &&
        rgba[sourceOffset + 2] === BACKGROUND[2]
      )
        continue;
      result.set(rgba.subarray(sourceOffset, sourceOffset + 4), (y * WIDTH + x) * 4);
    }
  return result;
}

function branches() {
  return stableBranchKeys().map((branchKey, branchIndex) => ({
    branchKey,
    parameters: {
      azimuthDegrees: branchIndex * 11,
      elevationDegrees: 30,
      pixelsPerUnit: 28,
      centerXPx: WIDTH / 2,
      centerYPx: HEIGHT / 2,
      upSign: 1 as const,
    },
  }));
}

function renderFactory(mode: FixtureMode, reuseRgbaBuffer = false) {
  let beautyCalls = 0;
  let semanticCalls = 0;
  const sharedRgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const render = async (parameters: OrthographicViewParameters, frame: OrthographicViewFrame) => {
    beautyCalls += 1;
    const branchIndex = Math.round(parameters.azimuthDegrees / 11);
    const scale = parameters.pixelsPerUnit / 28;
    const nextRgba = warp(renderVariant({ branchIndex, mode }), {
      scale,
      offsetXPx: parameters.centerXPx - (WIDTH / 2) * scale,
      offsetYPx: parameters.centerYPx - (HEIGHT / 2) * scale,
    });
    if (reuseRgbaBuffer) sharedRgba.set(nextRgba);
    const rgba = reuseRgbaBuffer ? sharedRgba : nextRgba;
    const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({
      width: WIDTH,
      height: HEIGHT,
      rgba,
    });
    const camera = createOrthographicViewCamera(parameters, frame);
    const projectionMatrix = Object.freeze(camera.projectionMatrix.toArray());
    const matrixWorldInverse = Object.freeze(camera.matrixWorldInverse.toArray());
    return {
      pngBytes,
      rgba,
      pngDigest: sha256(pngBytes),
      pixelDigest: sha256(rgba),
      projectionMatrix,
      matrixWorldInverse,
      rendererCameraCommitment: canonicalDigest({
        request: {
          scene: "model-only",
          backgroundHex: BACKGROUND_HEX,
          parameters,
          frame,
        },
        projectionMatrix,
        matrixWorldInverse,
      }),
    };
  };
  const renderSemantic = async (
    parameters: OrthographicViewParameters,
    frame: OrthographicViewFrame,
    policy: RealBuildPrefix50Step44SemanticColorPolicy,
  ): Promise<RealBuildPrefix50Step44SemanticColorRenderEvidence> => {
    semanticCalls += 1;
    const branchIndex = Math.round(parameters.azimuthDegrees / 11);
    const scale = parameters.pixelsPerUnit / 28;
    const beauty =
      mode === "color-shopping-adversary" && branchIndex === 2
        ? warp(source(), TRUTH)
        : warp(renderVariant({ branchIndex, mode }), {
            scale,
            offsetXPx: parameters.centerXPx - (WIDTH / 2) * scale,
            offsetYPx: parameters.centerYPx - (HEIGHT / 2) * scale,
          });
    const rgba = new Uint8Array(beauty.byteLength);
    const target = [
      (SEMANTIC_COLOR_MASK_TARGET_HEX >> 16) & 0xff,
      (SEMANTIC_COLOR_MASK_TARGET_HEX >> 8) & 0xff,
      SEMANTIC_COLOR_MASK_TARGET_HEX & 0xff,
      0xff,
    ] as const;
    const other = [
      (SEMANTIC_COLOR_MASK_OTHER_HEX >> 16) & 0xff,
      (SEMANTIC_COLOR_MASK_OTHER_HEX >> 8) & 0xff,
      SEMANTIC_COLOR_MASK_OTHER_HEX & 0xff,
      0xff,
    ] as const;
    for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
      const offset = index * 4;
      const color =
        beauty[offset] === BACKGROUND[0] &&
        beauty[offset + 1] === BACKGROUND[1] &&
        beauty[offset + 2] === BACKGROUND[2]
          ? BACKGROUND
          : beauty[offset] === BLUE[0] &&
              beauty[offset + 1] === BLUE[1] &&
              beauty[offset + 2] === BLUE[2]
            ? target
            : other;
      rgba.set(color, offset);
    }
    const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({
      width: WIDTH,
      height: HEIGHT,
      rgba,
    });
    const camera = createOrthographicViewCamera(parameters, frame);
    const projectionMatrix = Object.freeze(camera.projectionMatrix.toArray());
    const matrixWorldInverse = Object.freeze(camera.matrixWorldInverse.toArray());
    const request = {
      scene: "model-only" as const,
      renderMode: "semantic-color-id-mask" as const,
      targetColorIds: [...policy.targetColorIds],
      backgroundHex: BACKGROUND_HEX,
      parameters,
      frame,
    };
    return {
      pngBytes,
      rgba,
      pngDigest: sha256(pngBytes),
      pixelDigest: sha256(rgba),
      projectionMatrix,
      matrixWorldInverse,
      rendererCameraCommitment: canonicalDigest({
        request,
        policyCommitment: policy.commitment,
        classificationCommitment: policy.classificationCommitment,
        projectionMatrix,
        matrixWorldInverse,
      }),
      policyCommitment: policy.commitment,
      classification: policy.classification,
      classificationCommitment: policy.classificationCommitment,
    };
  };
  return {
    render,
    renderSemantic,
    beautyCalls: () => beautyCalls,
    semanticCalls: () => semanticCalls,
  };
}

export function inputFor(
  mode: FixtureMode,
  semanticPolicy: RealBuildPrefix50Step44SemanticColorPolicy,
  reuseRgbaBuffer = false,
) {
  const sourceRgba = mode === "identity-ambiguity" ? identitySource() : warp(source(), TRUTH);
  const target = foreground(sourceRgba);
  const eligible = new Uint8Array(WIDTH * HEIGHT).fill(1);
  const controlled = renderFactory(mode, reuseRgbaBuffer);
  return {
    input: {
      branches: branches(),
      expectedPanelFace: "studs-up" as const,
      sourceRgba,
      frame: {
        widthPx: WIDTH,
        heightPx: HEIGHT,
        target: [0, 0, 0] as const,
        sceneRadius: 20,
      },
      parentOnlyTargetMask: target,
      eligibleMask: eligible,
      render: controlled.render,
      semanticPolicy,
      renderSemantic: controlled.renderSemantic,
    },
    beautyCalls: controlled.beautyCalls,
    semanticCalls: controlled.semanticCalls,
  };
}
