import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";
import {
  createOrthographicViewCamera,
  deriveBrickScene,
  instructionViewFrame,
  type OrthographicViewFrame,
} from "@lego-studio/rendering";
import { Box3, Vector3 } from "three";

import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  verifyRealBuildPrefix50Step44CameraMeasurementSemantics,
  type RealBuildPrefix50Step44DecodedCameraAttemptArtifact,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier.ts";
import type {
  RealBuildPrefix50Step44ExpectedCameraBranch,
  RealBuildPrefix50Step44CameraMeasurementSemanticContract,
} from "./real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import {
  deriveRealBuildPrefix50Step44PreregisteredCameraBranches,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import type { RealBuildPrefix50Step44RealDomainObservation } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import type { RealBuildPrefix50Step44RealDomainPredecessorCase } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-predecessor.ts";
import {
  readRealBuildPrefix50Step44RealDomainSourceCasePixels,
  requireRealBuildPrefix50Step44RealDomainSourceCase,
  type RealBuildPrefix50Step44RealDomainSourceCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import type { RealBuildPrefix50Step44CameraSearchAttempt } from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import { deriveRealBuildPrefix50RealDomainSemanticColorPolicy } from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";

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
    throw new TypeError("Persisted real-domain semantic replay found an empty target mask.");
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
    throw new TypeError("Persisted real-domain semantic replay found invalid projected bounds.");
  return { widthPx: maxX - minX, heightPx: maxY - minY };
}

export interface RealBuildPrefix50Step44PersistedSemanticReplay {
  readonly semanticPolicyCommitment: Sha256Digest;
  readonly scaleSeedCommitment: Sha256Digest;
  readonly runtimeStateCommitment: Sha256Digest;
  readonly independentReplayCommitment: Sha256Digest;
}

export function independentlyReplayPersistedRealBuildPrefix50Step44RealDomainCase(input: {
  readonly sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
  readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
  readonly artifacts: Readonly<Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>>;
}): RealBuildPrefix50Step44PersistedSemanticReplay {
  const source = requireRealBuildPrefix50Step44RealDomainSourceCase(input.sourceCase);
  const predecessor = input.predecessorCase;
  if (
    source.panelStep !== predecessor.panelStep ||
    input.observation.panelStep !== source.panelStep
  )
    throw new TypeError(
      "Persisted semantic replay mixed source, predecessor, or observation panels.",
    );
  const pixels = readRealBuildPrefix50Step44RealDomainSourceCasePixels(source);
  const semanticPolicy = deriveRealBuildPrefix50RealDomainSemanticColorPolicy(
    predecessor.activeChildDocument,
  );
  const scene = deriveBrickScene(predecessor.activeChildDocument, { finish: "instruction" });
  let frame: OrthographicViewFrame;
  let branches: readonly RealBuildPrefix50Step44ExpectedCameraBranch[];
  try {
    frame = instructionViewFrame(
      scene.bounds,
      REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
      REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
    );
    const target = maskBounds(pixels.parentOnlyForegroundMask);
    branches = deriveRealBuildPrefix50Step44PreregisteredCameraBranches(
      source.latticeFit.solution,
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
  } finally {
    scene.dispose();
  }
  const contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract = {
    context: {
      metricCalibrationCommitment:
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    },
    expectedPanelFace: "studs-up",
    frame,
    branches,
    sourceRgba: pixels.rgba,
    eligibleMask: pixels.eligibleMask,
    parentOnlyTargetMask: pixels.parentOnlyForegroundMask,
    semanticColorPolicy: semanticPolicy,
  };
  verifyRealBuildPrefix50Step44CameraMeasurementSemantics({
    attempt: input.attempt,
    artifacts: input.artifacts,
    contract,
  });
  const scaleSeedCommitment = canonicalDigest(
    branches.map(({ branchKey, parameters: { pixelsPerUnit } }) => ({
      branchKey,
      pixelsPerUnit,
    })),
  );
  const runtimeStateCommitment = canonicalDigest({
    panelStep: predecessor.panelStep,
    documentHash: predecessor.activeChildPredecessor.documentHash,
    documentCommitment: predecessor.activeChildPredecessor.documentCommitment,
    semanticPolicyCommitment: semanticPolicy.commitment,
    attemptCommitment: input.attempt.commitment,
    observationCommitment: input.observation.observationCommitment,
    scaleSeedCommitment,
    runtimeCaptureCount: input.attempt.totalCaptureCount,
  });
  const replayBody = {
    schemaVersion: "lego.real-build-prefix50-real-domain-independent-camera-replay/1" as const,
    panelStep: predecessor.panelStep,
    attemptCommitment: input.attempt.commitment,
    sourceCaseCommitment: source.commitment,
    predecessorCaseCommitment: predecessor.commitment,
    branchSeedCommitment: canonicalDigest(branches),
    frameCommitment: canonicalDigest(frame),
    semanticsVerified: true as const,
  };
  return deepFreeze({
    semanticPolicyCommitment: semanticPolicy.commitment,
    scaleSeedCommitment,
    runtimeStateCommitment,
    independentReplayCommitment: canonicalDigest(replayBody),
  });
}
