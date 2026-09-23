import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  requireRealBuildPrefix50Step44CalibrationPublicationMarker,
  withStableRealBuildPrefix50Step44CalibrationPublicationMarker,
} from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import type { RealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import type {
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "./real-build-prefix50-subbuild-return-contract.ts";
import {
  captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment,
  withStableRealBuildPrefix50Step44RealDomainGateOutputTree,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";
import type { RealBuildPrefix50Step44OfflineRealDomainQualificationVerification } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts";

export async function readCommittedRealBuildPrefix50Step44PersistedQualification(input: {
  readonly qualificationOutputPath: string;
  readonly repositoryRoot: string;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly returnResult: RealBuildPrefix50SubBuildReturnResult;
  readonly reviewBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): Promise<
  Readonly<{
    result: RealBuildPrefix50Step44OfflineRealDomainQualificationVerification;
    treeCommitment: Sha256Digest;
  }>
> {
  return withStableRealBuildPrefix50Step44CalibrationPublicationMarker(
    input.qualificationOutputPath,
    async () =>
      withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
        { outputPath: input.qualificationOutputPath, persistedCaseCount: 3 },
        async () => {
          const persisted =
            await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts");
          const result =
            await persisted.verifyPersistedRealBuildPrefix50Step44RealDomainQualificationOffline(
              input,
            );
          const treeCommitment = captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment({
            outputPath: result.outputPath,
            persistedCaseCount: 3,
          });
          requireRealBuildPrefix50Step44CalibrationPublicationMarker({
            finalOutputPath: result.outputPath,
            expectedDescriptor: {
              evidenceStatus: "qualified-and-validated",
              persistedCaseCount: 3,
              proofCommitment: result.binding.qualificationProofCommitment,
              persistedManifestCommitment: result.binding.persistedManifestCommitment,
              evidenceTreeCommitment: treeCommitment,
            },
          });
          return Object.freeze({ result, treeCommitment });
        },
      ),
  );
}
