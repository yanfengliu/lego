import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  SEMANTIC_COLOR_MASK_OTHER_HEX,
} from "@lego-studio/rendering";
import { beforeAll, describe, expect, it } from "vitest";

import { REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH } from "../e2e/real-build-prefix50-step44-camera-only-gate-contract.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-input.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "../e2e/real-build-prefix50-subbuild-return-contract.ts";
import { verifyRealBuildPrefix50Step44CameraMeasurementSemantics } from "../e2e/real-build-prefix50-subbuild-return-review-camera-attempt-verifier.ts";
import {
  deriveRealBuildPrefix50Step44CameraMeasurementSemanticContract,
  type RealBuildPrefix50Step44CameraMeasurementSemanticContract,
  type RealBuildPrefix50Step44PersistedCameraSemanticSource,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import {
  searchRealBuildPrefix50Step44ParentCamera,
  type RealBuildPrefix50Step44CameraSearchAttemptEvidence,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-search.ts";
import { REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX } from "../e2e/real-build-prefix50-subbuild-return-review-camera-source.ts";
import { createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest } from "../e2e/real-build-prefix50-subbuild-return-review-camera-source.ts";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import type { Mutable } from "./real-build-prefix50-subbuild-return-review-camera-verifier-test-support.ts";

const WIDTH = 720;
const HEIGHT = 470;
const BACKGROUND = [0x89, 0x90, 0x93, 0xff] as const;
const hasExactBatch = existsSync(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH);

let source: RealBuildPrefix50Step44PersistedCameraSemanticSource;
let contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract;
let evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function blank(color: readonly [number, number, number, number] = BACKGROUND): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) rgba.set(color, offset);
  return rgba;
}

function rectangle(
  rgba: Uint8Array,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) rgba.set(color, (y * WIDTH + x) * 4);
}

function circle(
  rgba: Uint8Array,
  centerX: number,
  centerY: number,
  radius: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = -radius; y <= radius; y += 1)
    for (let x = -radius; x <= radius; x += 1)
      if (x * x + y * y <= radius * radius) {
        const px = centerX + x;
        const py = centerY + y;
        if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) rgba.set(color, (py * WIDTH + px) * 4);
      }
}

function syntheticCrop(): Uint8Array {
  const rgba = blank();
  const dark = [0x1a, 0x1d, 0x1b, 0xff] as const;
  rectangle(rgba, 45, 374, 325, 440, dark);
  rectangle(rgba, 535, 330, 680, 440, dark);
  rectangle(rgba, 245, 405, 610, 440, dark);
  for (let m = -45; m <= 45; m += 1)
    for (let n = -45; n <= 45; n += 1) {
      const x = Math.round(360 + m * 18 - n * 12);
      const y = Math.round(235 + m * 7 + n * 10);
      if (x >= 30 && x < WIDTH - 30 && y >= 150 && y < HEIGHT - 30) circle(rgba, x, y, 4, dark);
    }
  rectangle(rgba, 140, 150, 547, 333, [0x2b, 0x9d, 0xc6, 0xff]);
  rectangle(rgba, 160, 385, 240, 425, [0x2b, 0x9d, 0xc6, 0xff]);
  const yellow = [0xff, 0xd8, 0x00, 0xff] as const;
  rectangle(rgba, 120, 132, 567, 135, yellow);
  rectangle(rgba, 120, 350, 567, 353, yellow);
  rectangle(rgba, 120, 132, 123, 353, yellow);
  rectangle(rgba, 564, 132, 567, 353, yellow);
  return rgba;
}

function renderEvidence(rgba: Uint8Array, parameters: unknown, frame: unknown) {
  const exactParameters = parameters as Parameters<typeof createOrthographicViewCamera>[0];
  const exactFrame = frame as Parameters<typeof createOrthographicViewCamera>[1];
  const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({
    width: WIDTH,
    height: HEIGHT,
    rgba,
  });
  const camera = createOrthographicViewCamera(exactParameters, exactFrame);
  const projectionMatrix = camera.projectionMatrix.toArray();
  const matrixWorldInverse = camera.matrixWorldInverse.toArray();
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
        backgroundHex: REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX,
        parameters: exactParameters,
        frame: exactFrame,
      },
      projectionMatrix,
      matrixWorldInverse,
    }),
  };
}

beforeAll(async () => {
  if (!hasExactBatch) return;
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(
    JSON.parse(readFileSync(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH, "utf8")),
  ) as RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  const branded = createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest(syntheticCrop());
  source = {
    sourcePdfDigest: branded.sourcePdfDigest,
    sourcePageRasterCommitment: branded.sourcePageRasterCommitment,
    panelCropCommitment: branded.panelCropCommitment,
    panelFacePrefixEvidenceCommitment: branded.panelFacePrefixEvidenceCommitment,
    expectedPanelFace: branded.expectedPanelFace,
    parentOnlyRegionCommitment: branded.parentOnlyRegion.commitment,
    latticeFit: branded.latticeFit,
    rgba: branded.rgba,
    eligibleMask: branded.eligibleMask,
    parentOnlyTargetMask: branded.parentOnlyForegroundMask,
  };
  contract = deriveRealBuildPrefix50Step44CameraMeasurementSemanticContract({
    reviewBatch: batch,
    source,
  });
  const beauty = blank();
  const semanticColor = [
    (SEMANTIC_COLOR_MASK_OTHER_HEX >> 16) & 0xff,
    (SEMANTIC_COLOR_MASK_OTHER_HEX >> 8) & 0xff,
    SEMANTIC_COLOR_MASK_OTHER_HEX & 0xff,
    0xff,
  ] as const;
  const semantic = blank(semanticColor);
  let captured: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
  try {
    await searchRealBuildPrefix50Step44ParentCamera({
      branches: contract.branches,
      expectedPanelFace: contract.expectedPanelFace,
      sourceRgba: contract.sourceRgba,
      frame: contract.frame,
      parentOnlyTargetMask: contract.parentOnlyTargetMask,
      eligibleMask: contract.eligibleMask,
      semanticPolicy: contract.semanticColorPolicy,
      render: async (parameters, frame) => renderEvidence(beauty, parameters, frame),
      renderSemantic: async (parameters, frame, policy) => {
        const rendered = renderEvidence(semantic, parameters, frame);
        const request = {
          scene: "model-only" as const,
          renderMode: "semantic-color-id-mask" as const,
          targetColorIds: [...policy.targetColorIds],
          backgroundHex: REAL_BUILD_PREFIX50_STEP44_PAGE45_BACKGROUND_HEX,
          parameters,
          frame,
        };
        return {
          ...rendered,
          rendererCameraCommitment: canonicalDigest({
            request,
            policyCommitment: policy.commitment,
            classificationCommitment: policy.classificationCommitment,
            projectionMatrix: rendered.projectionMatrix,
            matrixWorldInverse: rendered.matrixWorldInverse,
          }),
          policyCommitment: policy.commitment,
          classification: policy.classification,
          classificationCommitment: policy.classificationCommitment,
        };
      },
      attemptSink: (attempt) => {
        captured = attempt;
      },
    });
  } catch (error) {
    if (captured === undefined) throw error;
  }
  if (captured === undefined) throw new TypeError("Refused camera attempt was not captured.");
  evidence = captured;
}, 180_000);

describe.runIf(hasExactBatch)("Step-44 non-authoritative camera measurement core", () => {
  it("keeps refused search evidence immutable and independently replayable", () => {
    const mutable = evidence.attempt as unknown as Mutable<typeof evidence.attempt>;
    expect(() => {
      mutable.branchMeasurements[0]!.alignmentPasses[0]!.intersectionOverUnion = 0.5;
    }).toThrow(TypeError);
    const artifacts = Object.fromEntries(
      Object.entries(evidence.renderArtifacts).map(([file, bytes]) => [
        file,
        {
          pngBytes: bytes,
          rgba: decodeRealBuildPrefix50Step44ReviewPng(bytes, WIDTH * HEIGHT, file).rgba,
        },
      ]),
    );
    expect(() =>
      verifyRealBuildPrefix50Step44CameraMeasurementSemantics({
        attempt: evidence.attempt,
        artifacts,
        contract,
      }),
    ).not.toThrow();
  });

  it("rejects a coordinated lattice rewrite before any production receipt is created", () => {
    const changed = structuredClone(source);
    const mutableSolution = changed.latticeFit.solution as unknown as {
      azimuthDegrees: number;
    };
    mutableSolution.azimuthDegrees += 1;
    expect(() =>
      deriveRealBuildPrefix50Step44CameraMeasurementSemanticContract({
        reviewBatch: requireRealBuildPrefix50Step44ReviewBatchEnvelope(
          JSON.parse(
            readFileSync(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH, "utf8"),
          ),
        ),
        source: changed,
      }),
    ).toThrow(/lattice fit did not independently reproduce/u);
  }, 120_000);
});
