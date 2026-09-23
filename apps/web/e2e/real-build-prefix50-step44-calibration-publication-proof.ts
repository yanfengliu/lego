import { resolve } from "node:path";

import type { RealBuildPrefix50Step44CalibrationPublicationDescriptor } from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import type {
  RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";
import {
  requireRealBuildPrefix50Step44VerifiedRealDomainQualification,
  requireRealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";

export function reassertRealBuildPrefix50Step44CalibrationDirectoryPublicationProof(input: {
  readonly transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly publicationProof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof;
  readonly final: boolean;
}): RealBuildPrefix50Step44CalibrationPublicationDescriptor {
  const outputPath = input.final
    ? input.transaction.finalOutputPath
    : input.transaction.stagingOutputPath;
  const location = input.final
    ? { outputPath }
    : { outputPath, publicationTransaction: input.transaction };
  if (input.publicationProof.kind === "qualification") {
    const manifest = requireRealBuildPrefix50Step44VerifiedRealDomainQualification({
      ...location,
      proof: input.publicationProof.proof,
      calibrationSession: input.publicationProof.calibrationSession,
    });
    return Object.freeze({
      evidenceStatus: manifest.status,
      persistedCaseCount: 3,
      proofCommitment: input.publicationProof.proof.commitment,
      persistedManifestCommitment: manifest.commitment,
      evidenceTreeCommitment: captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment({
        outputPath: resolve(outputPath),
        persistedCaseCount: 3,
      }),
    });
  }
  const manifest = requireRealBuildPrefix50Step44VerifiedRealDomainRefusal({
    ...location,
    proof: input.publicationProof.proof,
    calibrationSession: input.publicationProof.calibrationSession,
  });
  const persistedCaseCount = manifest.status === "calibration-refused" ? 2 : 3;
  return Object.freeze({
    evidenceStatus: manifest.status,
    persistedCaseCount,
    proofCommitment: input.publicationProof.proof.commitment,
    persistedManifestCommitment: manifest.commitment,
    evidenceTreeCommitment: captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment({
      outputPath: resolve(outputPath),
      persistedCaseCount,
    }),
  });
}
