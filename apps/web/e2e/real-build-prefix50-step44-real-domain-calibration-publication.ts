import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import {
  captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import {
  RealBuildPrefix50Step44VerifiedRealDomainRefusalError,
  runRealBuildPrefix50Step44RealDomainCalibrationGate,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate.ts";
import {
  assertRealBuildPrefix50Step44RealDomainGateOutputTree,
  requireRealBuildPrefix50Step44VerifiedRealDomainQualification,
  requireRealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import {
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  type RealBuildPrefix50Step44ReviewOutputPublication,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  assertRealBuildPrefix50Step44CalibrationStagingIdentity,
  beginRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  commitRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  type RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";
import type { RealBuildPrefix50Step44ProductionMaterials } from "./real-build-prefix50-subbuild-return-review-production-materials.ts";
import { rederiveRealBuildPrefix50Step44PinnedProductionMaterials } from "./real-build-prefix50-step44-runtime-materials.ts";
import { requireRealBuildPrefix50Step44IndependentCameraBranch } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preunlock-receipt.ts";

type CalibrationGateResult = Awaited<
  ReturnType<typeof runRealBuildPrefix50Step44RealDomainCalibrationGate>
>;
type CalibrationPublicationResult = CalibrationGateResult &
  Readonly<{
    committedPublication: RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication;
  }>;

interface CalibrationPublicationDependencies {
  readonly requireIndependentCameraBranch: () => void;
  readonly captureSourceLock: (
    repositoryRoot: string,
  ) => RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly requireSourceLock: (
    sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  ) => RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly rederiveMaterials: (
    repositoryRoot: string,
  ) => Promise<RealBuildPrefix50Step44ProductionMaterials>;
  readonly preparePublication: (
    outputPath: string,
  ) => Promise<RealBuildPrefix50Step44ReviewOutputPublication>;
  readonly beginTransaction: (
    publication: RealBuildPrefix50Step44ReviewOutputPublication,
  ) => Promise<RealBuildPrefix50Step44CalibrationDirectoryTransaction>;
  readonly assertStagingIdentity: typeof assertRealBuildPrefix50Step44CalibrationStagingIdentity;
  readonly createPublicationProof: (
    transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
    proof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  ) => RealBuildPrefix50Step44CalibrationDirectoryPublicationProof;
  readonly commitTransaction: typeof commitRealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly finalizeTransaction: typeof finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly completePublication: typeof completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication;
  readonly abandonTransaction: typeof abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly assertGateOutputTree: typeof assertRealBuildPrefix50Step44RealDomainGateOutputTree;
  readonly requireQualification: typeof requireRealBuildPrefix50Step44VerifiedRealDomainQualification;
  readonly requireRefusal: typeof requireRealBuildPrefix50Step44VerifiedRealDomainRefusal;
  readonly runGate: typeof runRealBuildPrefix50Step44RealDomainCalibrationGate;
}

export class RealBuildPrefix50Step44CalibrationPublicationFailureError extends TypeError {
  readonly code = "STEP44_REAL_DOMAIN_CALIBRATION_PUBLICATION_FAILED" as const;
  readonly outputPath: string;
  readonly outputRemoved: boolean;
  readonly retainedPath: string | null;

  constructor(input: {
    readonly outputPath: string;
    readonly outputRemoved: boolean;
    readonly retainedPath: string | null;
    readonly cause: unknown;
  }) {
    super(
      input.outputRemoved
        ? `Page44 real-domain calibration failed before publication; its exact private staging directory remains at ${String(input.retainedPath)}, and ${input.outputPath} is reusable.`
        : `Page44 real-domain calibration failed without publishing this task's staging directory; ${input.outputPath} is occupied or could not be proved absent, and the exact private staging path is ${String(input.retainedPath)}.`,
      { cause: input.cause },
    );
    this.name = "RealBuildPrefix50Step44CalibrationPublicationFailureError";
    this.outputPath = input.outputPath;
    this.outputRemoved = input.outputRemoved;
    this.retainedPath = input.retainedPath;
  }
}

const productionDependencies: CalibrationPublicationDependencies = Object.freeze({
  requireIndependentCameraBranch: requireRealBuildPrefix50Step44IndependentCameraBranch,
  captureSourceLock: captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  requireSourceLock: requireRealBuildPrefix50Step44CameraOnlyLiveSourceLock,
  rederiveMaterials: rederiveRealBuildPrefix50Step44PinnedProductionMaterials,
  preparePublication: prepareRealBuildPrefix50Step44ReviewOutputPublication,
  beginTransaction: beginRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  assertStagingIdentity: assertRealBuildPrefix50Step44CalibrationStagingIdentity,
  createPublicationProof: (
    _transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
    proof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  ) => proof,
  commitTransaction: commitRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  finalizeTransaction: finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  completePublication: completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  abandonTransaction: abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  assertGateOutputTree: assertRealBuildPrefix50Step44RealDomainGateOutputTree,
  requireQualification: requireRealBuildPrefix50Step44VerifiedRealDomainQualification,
  requireRefusal: requireRealBuildPrefix50Step44VerifiedRealDomainRefusal,
  runGate: runRealBuildPrefix50Step44RealDomainCalibrationGate,
});

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function executeCalibrationPublication(
  input: Readonly<{ repositoryRoot: string; outputPath: string }>,
  dependencies: CalibrationPublicationDependencies,
): Promise<CalibrationPublicationResult> {
  // Preflight finishes before the native helper creates a private staging directory.
  const sourceLockBefore = dependencies.captureSourceLock(input.repositoryRoot);
  dependencies.requireSourceLock(sourceLockBefore);
  dependencies.requireIndependentCameraBranch();
  const materials = await dependencies.rederiveMaterials(input.repositoryRoot);
  const publication = await dependencies.preparePublication(input.outputPath);
  const transaction = await dependencies.beginTransaction(publication);
  try {
    const claimedOutputIdentity = await dependencies.assertStagingIdentity(transaction);
    const result = await dependencies.runGate({
      repositoryRoot: input.repositoryRoot,
      outputPath: transaction.stagingOutputPath,
      claimedOutputIdentity,
      reviewBatch: materials.batch,
      sourceLockBefore,
      sourceGeometryAdmission: materials.sourceGeometryAdmission,
      publicationTransaction: transaction,
    });
    if (resolve(result.outputPath) !== resolve(transaction.stagingOutputPath))
      throw new TypeError("Calibration gate returned a result for a different staging path.");
    dependencies.requireQualification({
      proof: result.proof,
      outputPath: transaction.stagingOutputPath,
      calibrationSession: result.calibrationSession,
      publicationTransaction: transaction,
    });
    const publicationProof = dependencies.createPublicationProof(
      transaction,
      Object.freeze({
        kind: "qualification",
        proof: result.proof,
        calibrationSession: result.calibrationSession,
      }),
    );
    await dependencies.assertStagingIdentity(transaction);
    await dependencies.commitTransaction(transaction, publicationProof);
    const committedPublication = await dependencies.finalizeTransaction(
      transaction,
      publicationProof,
    );
    await dependencies.assertGateOutputTree({
      outputPath: input.outputPath,
      persistedCaseCount: 3,
    });
    const manifest = dependencies.requireQualification({
      proof: result.proof,
      outputPath: input.outputPath,
      calibrationSession: result.calibrationSession,
    });
    return Object.freeze({
      ...result,
      outputPath: resolve(input.outputPath),
      manifest,
      committedPublication,
    });
  } catch (error) {
    if (error instanceof RealBuildPrefix50Step44VerifiedRealDomainRefusalError) {
      let manifest;
      try {
        manifest = dependencies.requireRefusal({
          proof: error.proof,
          outputPath: transaction.stagingOutputPath,
          calibrationSession: error.calibrationSession,
          publicationTransaction: transaction,
        });
        const publicationProof = dependencies.createPublicationProof(
          transaction,
          Object.freeze({
            kind: "refusal",
            proof: error.proof,
            calibrationSession: error.calibrationSession,
          }),
        );
        await dependencies.assertStagingIdentity(transaction);
        await dependencies.commitTransaction(transaction, publicationProof);
        const committedPublication = await dependencies.finalizeTransaction(
          transaction,
          publicationProof,
        );
        await dependencies.assertGateOutputTree({
          outputPath: input.outputPath,
          persistedCaseCount: error.status === "calibration-refused" ? 2 : 3,
        });
        manifest = dependencies.requireRefusal({
          proof: error.proof,
          outputPath: input.outputPath,
          calibrationSession: error.calibrationSession,
        });
        await dependencies.completePublication(committedPublication);
      } catch (publicationError) {
        await dependencies.abandonTransaction(transaction).catch(() => undefined);
        throw new AggregateError(
          [error, publicationError],
          "Verified Page44 refusal could not atomically publish from private staging.",
          { cause: publicationError },
        );
      }
      throw new RealBuildPrefix50Step44VerifiedRealDomainRefusalError({
        outputPath: resolve(input.outputPath),
        manifest,
        proof: error.proof,
        calibrationSession: error.calibrationSession,
      });
    }
    try {
      const retainedPath = await dependencies.abandonTransaction(transaction);
      const [finalExists, retainedExists] = await Promise.all([
        pathExists(input.outputPath),
        retainedPath === null ? Promise.resolve(false) : pathExists(retainedPath),
      ]);
      throw new RealBuildPrefix50Step44CalibrationPublicationFailureError({
        outputPath: input.outputPath,
        outputRemoved: !finalExists,
        retainedPath: retainedExists ? retainedPath : finalExists ? input.outputPath : null,
        cause: error,
      });
    } catch (abandonError) {
      if (abandonError instanceof RealBuildPrefix50Step44CalibrationPublicationFailureError)
        throw abandonError;
      throw new RealBuildPrefix50Step44CalibrationPublicationFailureError({
        outputPath: input.outputPath,
        outputRemoved: !(await pathExists(input.outputPath)),
        retainedPath: (await pathExists(transaction.stagingOutputPath))
          ? transaction.stagingOutputPath
          : null,
        cause: new AggregateError(
          [error, abandonError],
          "Calibration run and private-staging helper closure both failed.",
        ),
      });
    }
  }
}

export function runRealBuildPrefix50Step44RealDomainCalibrationPublication(
  input: Readonly<{
    repositoryRoot: string;
    outputPath: string;
  }>,
): Promise<CalibrationPublicationResult> {
  return executeCalibrationPublication(input, productionDependencies);
}

export const realBuildPrefix50Step44CalibrationPublicationTestOnly = Object.freeze({
  execute(
    input: Readonly<{ repositoryRoot: string; outputPath: string }>,
    dependencies: CalibrationPublicationDependencies,
  ): Promise<CalibrationPublicationResult> {
    if (process.env.NODE_ENV !== "test")
      throw new TypeError("Calibration publication dependency injection is test-only.");
    return executeCalibrationPublication(input, dependencies);
  },
  productionDependencies,
});
