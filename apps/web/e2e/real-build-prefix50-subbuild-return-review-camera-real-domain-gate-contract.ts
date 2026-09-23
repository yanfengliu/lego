import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44CameraOnlySourceLockEvidence } from "./real-build-prefix50-step44-camera-only-source-lock.ts";
import type {
  RealBuildPrefix50Step44RealDomainCalibrationReceipt,
  RealBuildPrefix50Step44RealDomainHeldOutReceipt,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";

export interface RealDomainCleanupEvidence {
  readonly browserClosed: boolean;
  readonly browserProcessTreeClosed: boolean;
  readonly serverClosed: boolean;
}

export interface PersistedGateManifest {
  readonly schemaVersion: "lego.real-build-prefix50-real-domain-camera-gate/1";
  readonly authority: "none";
  readonly status: "qualified-and-validated";
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
  readonly heldOutReceipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt;
  readonly caseProofCommitments: readonly [Sha256Digest, Sha256Digest, Sha256Digest];
  readonly thresholdsChanged: false;
  readonly cleanup: RealDomainCleanupEvidence;
  readonly commitment: Sha256Digest;
}

export interface PersistedRefusalManifest {
  readonly schemaVersion: "lego.real-build-prefix50-real-domain-camera-gate/1";
  readonly authority: "none";
  readonly status: "calibration-refused" | "heldout-refused";
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly sourceLock: RealBuildPrefix50Step44CameraOnlySourceLockEvidence;
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly calibrationReceipt: RealBuildPrefix50Step44RealDomainCalibrationReceipt;
  readonly heldOutReceipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt | null;
  readonly caseProofCommitments: readonly Sha256Digest[];
  readonly thresholdsChanged: false;
  readonly cleanup: RealDomainCleanupEvidence;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44VerifiedRealDomainQualification {
  readonly schemaVersion: "lego.real-build-prefix50-verified-real-domain-qualification/1";
  readonly outputRealPathCommitment: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly sourceLockCommitment: Sha256Digest;
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly calibrationReceiptCommitment: Sha256Digest;
  readonly heldOutReceiptCommitment: Sha256Digest;
  readonly persistedManifestCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44VerifiedRealDomainRefusal {
  readonly schemaVersion: "lego.real-build-prefix50-verified-real-domain-refusal/1";
  readonly status: "calibration-refused" | "heldout-refused";
  readonly outputRealPathCommitment: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly sourceLockCommitment: Sha256Digest;
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly calibrationReceiptCommitment: Sha256Digest;
  readonly heldOutReceiptCommitment: Sha256Digest | null;
  readonly persistedManifestCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}

export interface RealBuildPrefix50Step44RealDomainQualificationBinding {
  readonly schemaVersion: "lego.real-build-prefix50-step44-real-domain-qualification-binding/1";
  readonly qualificationOutputRealPathCommitment: Sha256Digest;
  readonly reviewBatchEnvelopeCommitment: Sha256Digest;
  readonly sourceLockCommitment: Sha256Digest;
  readonly calibrationSessionCommitment: Sha256Digest;
  readonly calibrationReceiptCommitment: Sha256Digest;
  readonly heldOutReceiptCommitment: Sha256Digest;
  readonly persistedManifestCommitment: Sha256Digest;
  readonly qualificationProofCommitment: Sha256Digest;
  readonly popplerToolchainCommitment: Sha256Digest;
  readonly commitment: Sha256Digest;
}
