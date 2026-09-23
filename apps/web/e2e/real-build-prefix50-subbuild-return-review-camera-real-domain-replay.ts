import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  deriveBrickScene,
  instructionViewFrame,
  type OrthographicViewFrame,
} from "@lego-studio/rendering";
import { Box3, Vector3 } from "three";

import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  verifyRealBuildPrefix50Step44CameraMeasurementSemantics,
  type RealBuildPrefix50Step44DecodedCameraAttemptArtifact,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier.ts";
import type { RealBuildPrefix50Step44CameraMeasurementSemanticContract } from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import {
  deriveRealBuildPrefix50Step44PreregisteredCameraBranches,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import {
  requireRealBuildPrefix50Step44RealDomainCapturedCase,
  type RealBuildPrefix50Step44RealDomainCapturedCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-capture.ts";
import { readRealBuildPrefix50Step44RealDomainSourceCasePixels } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";

function maskBounds(mask: Uint8Array): { widthPx: number; heightPx: number } {
  let minX: number = REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH;
  let minY: number = REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH;
    const y = Math.floor(index / REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY)
    throw new TypeError("Independent real-domain replay found an empty target mask.");
  return { widthPx: maxX - minX + 1, heightPx: maxY - minY + 1 };
}

function projectedUnitBounds(
  bounds: Box3,
  frame: OrthographicViewFrame,
  parameters: ReturnType<
    typeof deriveRealBuildPrefix50Step44PreregisteredCameraBranches
  >[number]["parameters"],
): { widthPx: number; heightPx: number } {
  const camera = createOrthographicViewCamera({ ...parameters, pixelsPerUnit: 1 }, frame);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        const pixelX = ((projected.x + 1) * frame.widthPx) / 2;
        const pixelY = ((1 - projected.y) * frame.heightPx) / 2;
        minX = Math.min(minX, pixelX);
        minY = Math.min(minY, pixelY);
        maxX = Math.max(maxX, pixelX);
        maxY = Math.max(maxY, pixelY);
      }
  if (![minX, minY, maxX, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY)
    throw new TypeError("Independent real-domain replay found invalid projected bounds.");
  return { widthPx: maxX - minX, heightPx: maxY - minY };
}

function decodedArtifacts(
  artifacts: Readonly<Record<string, Uint8Array>>,
): Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(artifacts).map(([file, bytes]) => {
        const decoded = decodeRealBuildPrefix50Step44ReviewPng(
          bytes,
          REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH *
            REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
          `real-domain independent replay ${file}`,
        );
        if (
          decoded.width !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH ||
          decoded.height !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT
        )
          throw new TypeError(`Real-domain replay artifact ${file} is not exactly 720x470.`);
        return [file, { pngBytes: new Uint8Array(bytes), rgba: decoded.rgba }];
      }),
    ),
  );
}

export interface RealBuildPrefix50Step44RealDomainIndependentReplay {
  readonly schemaVersion: "lego.real-build-prefix50-real-domain-independent-camera-replay/1";
  readonly panelStep: 41 | 42 | 43;
  readonly attemptCommitment: Sha256Digest;
  readonly sourceCaseCommitment: Sha256Digest;
  readonly predecessorCaseCommitment: Sha256Digest;
  readonly branchSeedCommitment: Sha256Digest;
  readonly frameCommitment: Sha256Digest;
  readonly semanticsVerified: true;
  readonly commitment: Sha256Digest;
}

export function independentlyReplayRealBuildPrefix50Step44RealDomainCapture(
  input: RealBuildPrefix50Step44RealDomainCapturedCase,
): RealBuildPrefix50Step44RealDomainIndependentReplay {
  const capture = requireRealBuildPrefix50Step44RealDomainCapturedCase(input);
  const sourcePixels = readRealBuildPrefix50Step44RealDomainSourceCasePixels(capture.sourceCase);
  const scene = deriveBrickScene(capture.predecessorCase.activeChildDocument, {
    finish: "instruction",
  });
  const frame = instructionViewFrame(
    scene.bounds,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  );
  const target = maskBounds(sourcePixels.parentOnlyForegroundMask);
  const branches = deriveRealBuildPrefix50Step44PreregisteredCameraBranches(
    capture.sourceCase.latticeFit.solution,
  ).map((branch, branchIndex) => {
    const projected = projectedUnitBounds(scene.bounds, frame, branch.parameters);
    return deepFreeze({
      branchIndex,
      branchKey: branch.branchKey,
      parameters: {
        ...branch.parameters,
        pixelsPerUnit: Math.min(
          target.widthPx / projected.widthPx,
          target.heightPx / projected.heightPx,
        ),
      },
    });
  });
  scene.dispose();
  const contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract = {
    context: {
      metricCalibrationCommitment:
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    },
    expectedPanelFace: "studs-up",
    frame,
    branches,
    sourceRgba: sourcePixels.rgba,
    eligibleMask: sourcePixels.eligibleMask,
    parentOnlyTargetMask: sourcePixels.parentOnlyForegroundMask,
    semanticColorPolicy: capture.semanticPolicy,
  };
  verifyRealBuildPrefix50Step44CameraMeasurementSemantics({
    attempt: capture.attemptEvidence.attempt,
    artifacts: decodedArtifacts(capture.attemptEvidence.renderArtifacts),
    contract,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-independent-camera-replay/1" as const,
    panelStep: capture.panelStep,
    attemptCommitment: capture.attemptEvidence.attempt.commitment,
    sourceCaseCommitment: capture.sourceCase.commitment,
    predecessorCaseCommitment: capture.predecessorCase.commitment,
    branchSeedCommitment: canonicalDigest(branches),
    frameCommitment: canonicalDigest(frame),
    semanticsVerified: true as const,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
