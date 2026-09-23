import { canonicalDigest, deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import {
  requireRealBuildPrefix50Step44RealDomainCalibrationReceipt,
  requireRealBuildPrefix50Step44RealDomainPredecessorSequence,
  type RealBuildPrefix50Step44RealDomainCalibrationReceipt,
  type RealBuildPrefix50Step44RealDomainPredecessorCase,
  type RealBuildPrefix50Step44RealDomainPredecessorSequence,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  requireRealBuildPrefix50Step44RealDomainSourceSequence,
  type RealBuildPrefix50Step44RealDomainSourceCase,
  type RealBuildPrefix50Step44RealDomainSourceSequence,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import type { RealBuildPrefix50Step44OfflineVerifiedRealDomainCase } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts";

export interface RealBuildPrefix50Step44RealDomainCalibrationSession {
  readonly schemaVersion: "lego.real-build-prefix50-real-domain-calibration-session/1";
  readonly status: "qualified-for-heldout" | "refused";
  readonly sourceLockCommitment: Sha256Digest;
  /** Legacy name: schema `bounded-calibration-crop-set/1`, never a full page. */
  readonly pageRasterCommitment: Sha256Digest;
  readonly sharedOrientationAnchorCommitment: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly orderedCalibrationObservationCommitment: Sha256Digest;
  readonly calibrationReceiptCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

interface SessionPrivate {
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly sourceSequence: RealBuildPrefix50Step44RealDomainSourceSequence;
  readonly predecessorSequence: RealBuildPrefix50Step44RealDomainPredecessorSequence;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
}

export interface RealBuildPrefix50Step44HeldOutUnlockCapability {
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly sourceSequenceCommitment: Sha256Digest;
  readonly predecessorSequenceCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44RealDomainHeldOutPair {
  readonly schemaVersion: "lego.real-build-prefix50-real-domain-heldout-pair/1";
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly sourceCase: RealBuildPrefix50Step44RealDomainSourceCase;
  readonly predecessorCase: RealBuildPrefix50Step44RealDomainPredecessorCase;
  readonly commitment: Sha256Digest;
}

const sessions = new WeakMap<object, SessionPrivate>();
const consumedSessions = new WeakSet<object>();
const heldOutUnlockCapabilities = new WeakSet<object>();
const heldOutPairs = new WeakMap<object, RealBuildPrefix50Step44RealDomainCalibrationSession>();

export function createRealBuildPrefix50Step44RealDomainCalibrationSession(input: {
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly sourceSequence: RealBuildPrefix50Step44RealDomainSourceSequence;
  readonly predecessorSequence: RealBuildPrefix50Step44RealDomainPredecessorSequence;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
}): RealBuildPrefix50Step44RealDomainCalibrationSession {
  const sourceLock = requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(input.sourceLock);
  const sourceSequence = requireRealBuildPrefix50Step44RealDomainSourceSequence(
    input.sourceSequence,
  );
  const predecessorSequence = requireRealBuildPrefix50Step44RealDomainPredecessorSequence(
    input.predecessorSequence,
  );
  const reviewBatch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  const calibrationReceipt = requireRealBuildPrefix50Step44RealDomainCalibrationReceipt(
    input.calibrationReceipt,
  );
  const observations = calibrationReceipt.observations;
  if (
    observations.length !== 2 ||
    observations[0]?.panelStep !== 41 ||
    observations[1]?.panelStep !== 42 ||
    sourceSequence.sourceLockCommitment !== sourceLock.evidence.commitment ||
    observations.some(
      (observation) =>
        observation.sourceLockCommitment !== sourceSequence.sourceLockCommitment ||
        observation.pageRasterCommitment !== sourceSequence.pageRasterCommitment ||
        observation.sourceSharedOrientationAnchorCommitment !==
          sourceSequence.sharedOrientationAnchorCommitment,
    ) ||
    predecessorSequence.reviewBatchEnvelopeCommitment !== reviewBatch.commitment ||
    observations.some(
      (observation, index) =>
        observation.predecessorCaseCommitment !==
        predecessorSequence.calibrationCases[index]?.commitment,
    )
  )
    throw new TypeError(
      "Real-domain calibration session must bind one live source lock, page raster, shared anchor, exact batch, and ordered Steps-41/42 observations.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-calibration-session/1" as const,
    status: calibrationReceipt.status,
    sourceLockCommitment: sourceLock.evidence.commitment,
    pageRasterCommitment: sourceSequence.pageRasterCommitment,
    sharedOrientationAnchorCommitment: sourceSequence.sharedOrientationAnchorCommitment,
    reviewBatchEnvelopeCommitment: reviewBatch.commitment,
    orderedCalibrationObservationCommitment: canonicalDigest(observations),
    calibrationReceiptCommitment: calibrationReceipt.commitment,
  };
  const session = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  sessions.set(session, {
    sourceLock,
    sourceSequence,
    predecessorSequence,
    reviewBatch,
    calibrationReceipt,
  });
  return session;
}

export async function replayPersistedRealBuildPrefix50Step44RealDomainCalibrationSession(input: {
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly sourceSequence: RealBuildPrefix50Step44RealDomainSourceSequence;
  readonly predecessorSequence: RealBuildPrefix50Step44RealDomainPredecessorSequence;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
  readonly calibrationCaseProofs: readonly [
    RealBuildPrefix50Step44OfflineVerifiedRealDomainCase,
    RealBuildPrefix50Step44OfflineVerifiedRealDomainCase,
  ];
}): Promise<RealBuildPrefix50Step44RealDomainCalibrationSession> {
  const sourceLock = requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock(input.sourceLock);
  const sourceSequence = requireRealBuildPrefix50Step44RealDomainSourceSequence(
    input.sourceSequence,
  );
  const predecessorSequence = requireRealBuildPrefix50Step44RealDomainPredecessorSequence(
    input.predecessorSequence,
  );
  const reviewBatch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  const persisted =
    await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-case.ts");
  const preregistration =
    await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts");
  const states = input.calibrationCaseProofs.map((proof) =>
    persisted.requirePersistedRealBuildPrefix50Step44RealDomainCaseOffline(proof),
  );
  const receipt = input.calibrationReceipt;
  const { commitment, ...receiptBody } = receipt;
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-real-domain-calibration-receipt/1" ||
    receipt.preregistrationCommitment !==
      preregistration.REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_PREREGISTRATION.commitment ||
    canonicalDigest(receipt.calibrationPanelSteps) !== canonicalDigest([41, 42]) ||
    receipt.observations.length !== 2 ||
    receipt.failuresByPanelStep.length !== 2 ||
    receipt.failuresByPanelStep.some(
      ({ panelStep, failures }, index) => panelStep !== index + 41 || failures.length !== 0,
    ) ||
    receipt.status !== "qualified-for-heldout" ||
    receipt.thresholdsChanged !== false ||
    commitment !== canonicalDigest(receiptBody) ||
    sourceSequence.sourceLockCommitment !== sourceLock.evidence.commitment ||
    predecessorSequence.reviewBatchEnvelopeCommitment !== reviewBatch.commitment ||
    states.some(
      (state, index) =>
        state.sourceCase !== sourceSequence.calibrationCases[index] ||
        state.predecessorCase !== predecessorSequence.calibrationCases[index] ||
        state.observation.observationCommitment !==
          receipt.observations[index]?.observationCommitment,
    )
  )
    throw new TypeError(
      "Persisted calibration session requires exact independently replayed Steps 41/42 from the current live source and batch.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-calibration-session/1" as const,
    status: "qualified-for-heldout" as const,
    sourceLockCommitment: sourceLock.evidence.commitment,
    pageRasterCommitment: sourceSequence.pageRasterCommitment,
    sharedOrientationAnchorCommitment: sourceSequence.sharedOrientationAnchorCommitment,
    reviewBatchEnvelopeCommitment: reviewBatch.commitment,
    orderedCalibrationObservationCommitment: canonicalDigest(receipt.observations),
    calibrationReceiptCommitment: receipt.commitment,
  };
  const session = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  sessions.set(session, {
    sourceLock,
    sourceSequence,
    predecessorSequence,
    reviewBatch,
    calibrationReceipt: receipt,
  });
  return session;
}

export function requireRealBuildPrefix50Step44RealDomainCalibrationSession(
  session: RealBuildPrefix50Step44RealDomainCalibrationSession,
): SessionPrivate {
  const state = sessions.get(session);
  const { commitment, ...body } = session;
  if (state === undefined || commitment !== canonicalDigest(body))
    throw new TypeError(
      "Real-domain gate requires its exact opaque calibration-session capability, including branded refusals.",
    );
  return state;
}

export function requireRealBuildPrefix50Step44HeldOutUnlockCapability(
  capability: RealBuildPrefix50Step44HeldOutUnlockCapability,
): RealBuildPrefix50Step44HeldOutUnlockCapability {
  const { commitment, ...body } = capability;
  if (!heldOutUnlockCapabilities.has(capability) || commitment !== canonicalDigest(body))
    throw new TypeError(
      "Step-43 source/predecessor materialization requires the consumed calibration-session capability.",
    );
  return capability;
}

export async function consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut(
  session: RealBuildPrefix50Step44RealDomainCalibrationSession,
): Promise<RealBuildPrefix50Step44RealDomainHeldOutPair> {
  const state = requireRealBuildPrefix50Step44RealDomainCalibrationSession(session);
  if (
    session.status !== "qualified-for-heldout" ||
    state.calibrationReceipt.status !== "qualified-for-heldout"
  )
    throw new TypeError("A refused real-domain calibration session cannot open Step 43.");
  if (consumedSessions.has(session))
    throw new TypeError(
      "This real-domain calibration session has already consumed its Step-43 unlock.",
    );
  consumedSessions.add(session);
  const capabilityBody = {
    calibrationSessionCommitment: session.commitment,
    sourceSequenceCommitment: state.sourceSequence.commitment,
    predecessorSequenceCommitment: state.predecessorSequence.commitment,
  };
  const capability = Object.freeze({
    ...capabilityBody,
    commitment: canonicalDigest(capabilityBody),
  });
  heldOutUnlockCapabilities.add(capability);
  const heldOut =
    await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-heldout.ts");
  const opened = await heldOut.openRealBuildPrefix50Step44RealDomainHeldOut({
    capability,
    sourceSequence: state.sourceSequence,
    reviewBatch: state.reviewBatch,
  });
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-heldout-pair/1" as const,
    calibrationSessionCommitment: session.commitment,
    sourceCase: opened.sourceCase,
    predecessorCase: opened.predecessorCase,
  };
  const pair = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  heldOutPairs.set(pair, session);
  return pair;
}

export function requireRealBuildPrefix50Step44RealDomainHeldOutPair(
  pair: RealBuildPrefix50Step44RealDomainHeldOutPair,
  session: RealBuildPrefix50Step44RealDomainCalibrationSession,
): RealBuildPrefix50Step44RealDomainHeldOutPair {
  const { commitment, ...body } = pair;
  if (
    heldOutPairs.get(pair) !== session ||
    pair.calibrationSessionCommitment !== session.commitment ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Step-43 source and predecessor must come from the same consumed session.");
  return pair;
}
