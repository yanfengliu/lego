import { realpath } from "node:fs/promises";
import { resolve } from "node:path";

import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock,
  captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import {
  assertRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  type RealBuildPrefix50Step44ClaimedDirectoryIdentity,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  realBuildPrefix50Step44BrowserLifecycleError,
  runRealBuildPrefix50Step44TwoPhaseCalibrationBrowserLifecycle,
} from "./real-build-prefix50-subbuild-return-review-browser-lifecycle.ts";
import {
  evaluateRealBuildPrefix50Step44RealDomainCalibration,
  evaluateRealBuildPrefix50Step44RealDomainHeldOut,
  prepareRealBuildPrefix50Step44RealDomainPredecessorSequence,
  type RealBuildPrefix50Step44RealDomainCalibrationReceipt,
  type RealBuildPrefix50Step44RealDomainHeldOutReceipt,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  captureRealBuildPrefix50Step44RealDomainCaseInApp,
  type RealBuildPrefix50Step44RealDomainCapturedCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-capture.ts";
import {
  persistRealBuildPrefix50Step44RealDomainCase,
  type RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import {
  assertRealBuildPrefix50Step44RealDomainGateOutputTree,
  persistAndVerifyRealBuildPrefix50Step44RealDomainQualification,
  persistAndVerifyRealBuildPrefix50Step44RealDomainRefusal,
  requireRealBuildPrefix50Step44VerifiedRealDomainQualification,
  requireRealBuildPrefix50Step44VerifiedRealDomainRefusal,
  type PersistedGateManifest,
  type PersistedRefusalManifest,
  type RealBuildPrefix50Step44VerifiedRealDomainQualification,
  type RealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { prepareRealBuildPrefix50Step44RealDomainSourceSequence } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import type { RealBuildPrefix50Step42SourceGeometryAdmission } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";
import {
  consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut,
  createRealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainHeldOutPair,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  requireRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";

interface CalibrationRunResult {
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
  readonly heldOutReceipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt | null;
  readonly heldOutPair: RealBuildPrefix50Step44RealDomainHeldOutPair | null;
  readonly captures: readonly RealBuildPrefix50Step44RealDomainCapturedCase[];
}

type CalibrationPhaseResult = Pick<
  CalibrationRunResult,
  "calibrationSession" | "calibrationReceipt"
> & {
  readonly captures: readonly [
    RealBuildPrefix50Step44RealDomainCapturedCase,
    RealBuildPrefix50Step44RealDomainCapturedCase,
  ];
};

export class RealBuildPrefix50Step44VerifiedRealDomainRefusalError extends TypeError {
  readonly code = "STEP44_REAL_DOMAIN_VERIFIED_REFUSAL" as const;
  readonly outputPath: string;
  readonly status: PersistedRefusalManifest["status"];
  readonly manifestCommitment: Sha256Digest;
  readonly proof: RealBuildPrefix50Step44VerifiedRealDomainRefusal;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;

  constructor(input: {
    readonly outputPath: string;
    readonly manifest: PersistedRefusalManifest;
    readonly proof: RealBuildPrefix50Step44VerifiedRealDomainRefusal;
    readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  }) {
    super(
      `Real-domain Step-44 camera qualification ${input.manifest.status} under frozen thresholds; exact counterevidence is retained at ${input.outputPath} as ${input.manifest.commitment}.`,
    );
    this.name = "RealBuildPrefix50Step44VerifiedRealDomainRefusalError";
    this.outputPath = input.outputPath;
    this.status = input.manifest.status;
    this.manifestCommitment = input.manifest.commitment;
    this.proof = input.proof;
    this.calibrationSession = input.calibrationSession;
  }
}

function currentSourceLock(
  repositoryRoot: string,
): RealBuildPrefix50Step44CameraOnlyLiveSourceLock {
  return captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot);
}

async function persistCases(input: {
  readonly outputPath: string;
  readonly captures: readonly RealBuildPrefix50Step44RealDomainCapturedCase[];
  readonly publicationTransaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): Promise<readonly RealBuildPrefix50Step44VerifiedPersistedRealDomainCase[]> {
  const proofs: RealBuildPrefix50Step44VerifiedPersistedRealDomainCase[] = [];
  for (const capture of input.captures)
    proofs.push(
      await persistRealBuildPrefix50Step44RealDomainCase({
        outputPath: input.outputPath,
        capture,
        publicationTransaction: input.publicationTransaction,
      }),
    );
  return Object.freeze(proofs);
}

export async function runRealBuildPrefix50Step44RealDomainCalibrationGate(input: {
  readonly repositoryRoot: string;
  readonly outputPath: string;
  readonly claimedOutputIdentity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly sourceLockBefore: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly sourceGeometryAdmission: RealBuildPrefix50Step42SourceGeometryAdmission;
  readonly publicationTransaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): Promise<
  Readonly<{
    outputPath: string;
    proof: RealBuildPrefix50Step44VerifiedRealDomainQualification;
    manifest: PersistedGateManifest;
    calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  }>
> {
  const repositoryRoot = await realpath(input.repositoryRoot);
  const outputPath = await realpath(input.outputPath);
  const publicationTransaction = requireRealBuildPrefix50Step44CalibrationDirectoryTransaction(
    input.publicationTransaction,
  );
  if ((await realpath(publicationTransaction.stagingOutputPath)) !== outputPath)
    throw new TypeError(
      "Real-domain camera gate output must be the exact live private publication staging directory.",
    );
  const batch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(input.reviewBatch);
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(input.claimedOutputIdentity);
  const sourceSequence = await prepareRealBuildPrefix50Step44RealDomainSourceSequence({
    repositoryRoot,
    sourceLock: input.sourceLockBefore,
    sourceGeometryAdmission: input.sourceGeometryAdmission,
  });
  const predecessorSequence = prepareRealBuildPrefix50Step44RealDomainPredecessorSequence(batch);
  const lifecycle = await runRealBuildPrefix50Step44TwoPhaseCalibrationBrowserLifecycle<
    CalibrationPhaseResult,
    CalibrationRunResult
  >({
    serverLogPath: resolve(outputPath, "real-domain-camera-static-app.log"),
    calibrate: async ({ page }) => {
      const step41 = await captureRealBuildPrefix50Step44RealDomainCaseInApp({
        page,
        sourceCase: sourceSequence.calibrationCases[0],
        predecessorCase: predecessorSequence.calibrationCases[0],
      });
      const step42 = await captureRealBuildPrefix50Step44RealDomainCaseInApp({
        page,
        sourceCase: sourceSequence.calibrationCases[1],
        predecessorCase: predecessorSequence.calibrationCases[1],
      });
      const calibrationReceipt = evaluateRealBuildPrefix50Step44RealDomainCalibration({
        predecessorCases: predecessorSequence.calibrationCases,
        observations: [step41.observation, step42.observation],
      });
      const calibrationSession = createRealBuildPrefix50Step44RealDomainCalibrationSession({
        sourceLock: input.sourceLockBefore,
        sourceSequence,
        predecessorSequence,
        reviewBatch: batch,
        calibrationReceipt,
      });
      return { calibrationSession, calibrationReceipt, captures: [step41, step42] };
    },
    afterCalibrationClosed: async ({ calibrationSession, calibrationReceipt, captures }) => {
      if (calibrationReceipt.status === "refused")
        return {
          status: "complete",
          value: {
            calibrationSession,
            calibrationReceipt,
            heldOutReceipt: null,
            heldOutPair: null,
            captures,
          },
        };

      assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock({
        before: input.sourceLockBefore,
        after: currentSourceLock(repositoryRoot),
      });
      // The first browser context and its policy have finalized before this one-shot source read.
      const heldOutPair =
        await consumeRealBuildPrefix50Step44CalibrationSessionForHeldOut(calibrationSession);
      return {
        status: "validate",
        execute: async ({ page }) => {
          const step43 = await captureRealBuildPrefix50Step44RealDomainCaseInApp({
            page,
            sourceCase: heldOutPair.sourceCase,
            predecessorCase: heldOutPair.predecessorCase,
          });
          const heldOutReceipt = evaluateRealBuildPrefix50Step44RealDomainHeldOut({
            calibrationReceipt,
            calibrationSession,
            heldOutPair,
            predecessorCase: heldOutPair.predecessorCase,
            observation: step43.observation,
          });
          return {
            calibrationSession,
            calibrationReceipt,
            heldOutReceipt,
            heldOutPair,
            captures: [...captures, step43],
          };
        },
      };
    },
  });
  if (lifecycle.status === "failed") throw realBuildPrefix50Step44BrowserLifecycleError(lifecycle);
  if (
    !lifecycle.cleanup.browserClosed ||
    !lifecycle.cleanup.browserProcessTreeClosed ||
    !lifecycle.cleanup.serverClosed
  )
    throw new TypeError("Real-domain camera lifecycle did not close every task-owned process.");
  assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock({
    before: input.sourceLockBefore,
    after: currentSourceLock(repositoryRoot),
  });
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(input.claimedOutputIdentity);
  const runtime = lifecycle.value;
  const caseProofs = await persistCases({
    outputPath,
    captures: runtime.captures,
    publicationTransaction,
  });
  if (
    runtime.calibrationReceipt.status === "refused" ||
    runtime.heldOutReceipt?.status === "refused"
  ) {
    const proof = await persistAndVerifyRealBuildPrefix50Step44RealDomainRefusal({
      outputPath,
      publicationTransaction,
      calibrationSession: runtime.calibrationSession,
      heldOutReceipt: runtime.heldOutReceipt,
      caseProofs,
      cleanup: lifecycle.cleanup,
    });
    const manifest = requireRealBuildPrefix50Step44VerifiedRealDomainRefusal({
      proof,
      outputPath,
      calibrationSession: runtime.calibrationSession,
      publicationTransaction,
    });
    await assertRealBuildPrefix50Step44RealDomainGateOutputTree({
      outputPath,
      persistedCaseCount: runtime.captures.length as 2 | 3,
    });
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(input.claimedOutputIdentity);
    throw new RealBuildPrefix50Step44VerifiedRealDomainRefusalError({
      outputPath,
      manifest,
      proof,
      calibrationSession: runtime.calibrationSession,
    });
  }
  if (runtime.heldOutReceipt === null || runtime.heldOutPair === null || caseProofs.length !== 3)
    throw new TypeError(
      "Qualified real-domain calibration did not retain its exact Step-43 holdout.",
    );
  const proof = await persistAndVerifyRealBuildPrefix50Step44RealDomainQualification({
    outputPath,
    publicationTransaction,
    calibrationSession: runtime.calibrationSession,
    heldOutReceipt: runtime.heldOutReceipt,
    heldOutPair: runtime.heldOutPair,
    caseProofs: caseProofs as [
      RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
      RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
      RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
    ],
    cleanup: lifecycle.cleanup,
  });
  const manifest = requireRealBuildPrefix50Step44VerifiedRealDomainQualification({
    proof,
    outputPath,
    calibrationSession: runtime.calibrationSession,
    publicationTransaction,
  });
  await assertRealBuildPrefix50Step44RealDomainGateOutputTree({
    outputPath,
    persistedCaseCount: 3,
  });
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(input.claimedOutputIdentity);
  return Object.freeze({
    outputPath,
    proof,
    manifest,
    calibrationSession: runtime.calibrationSession,
  });
}
