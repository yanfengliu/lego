import { resolve } from "node:path";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { bindRealBuildPrefix50Step44VerifiedRealDomainQualification } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { runRealBuildPrefix50Step44ProductionTransaction } from "./real-build-prefix50-subbuild-return-review-transaction-production.ts";
import { runRealBuildPrefix50Step44RealDomainCalibrationPublication } from "./real-build-prefix50-step44-real-domain-calibration-publication.ts";

export async function runRealBuildPrefix50Step44CameraQualifiedProduction(input: {
  readonly outputPath: string;
  readonly repositoryRoot: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}) {
  const repositoryRoot = resolve(input.repositoryRoot);
  const calibrationOutputPath = `${resolve(input.outputPath)}.page44-real-domain-calibration`;
  const qualification = await runRealBuildPrefix50Step44RealDomainCalibrationPublication({
    repositoryRoot,
    outputPath: calibrationOutputPath,
  });
  const realDomainQualification = await bindRealBuildPrefix50Step44VerifiedRealDomainQualification({
    proof: qualification.proof,
    repositoryRoot,
    outputPath: qualification.outputPath,
    calibrationSession: qualification.calibrationSession,
    committedPublication: qualification.committedPublication,
  });
  return runRealBuildPrefix50Step44ProductionTransaction({
    ...input,
    repositoryRoot,
    realDomainQualification,
  });
}
