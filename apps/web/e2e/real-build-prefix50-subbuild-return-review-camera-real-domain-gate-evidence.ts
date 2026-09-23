import { resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import { REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT } from "./real-build-prefix50-subbuild-return-review-poppler-toolchain.ts";
import {
  requireRealBuildPrefix50Step44QualifiedRealDomainCalibration,
  requireRealBuildPrefix50Step44ValidatedRealDomainHeldOut,
  type RealBuildPrefix50Step44RealDomainHeldOutReceipt,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  requireRealBuildPrefix50Step44RealDomainOutputChild,
  requireRealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
  type RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import type {
  PersistedGateManifest,
  RealBuildPrefix50Step44RealDomainQualificationBinding,
  RealBuildPrefix50Step44VerifiedRealDomainQualification,
  RealDomainCleanupEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
import {
  requireRealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainHeldOutPair,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import {
  captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment,
  withStableRealBuildPrefix50Step44RealDomainGateOutputTree,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";
import {
  completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath,
  requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";
import { provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis } from "./real-build-prefix50-step44-later-source-ledger-provision.ts";

export { assertRealBuildPrefix50Step44RealDomainGateOutputTree } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";
export type {
  PersistedGateManifest,
  PersistedRefusalManifest,
  RealBuildPrefix50Step44RealDomainQualificationBinding,
  RealBuildPrefix50Step44VerifiedRealDomainQualification,
  RealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
export {
  persistAndVerifyRealBuildPrefix50Step44RealDomainRefusal,
  requireRealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-refusal-evidence.ts";

const GATE_MANIFEST_FILE = "real-domain-camera-gate.json";
interface QualificationProofAuthority {
  readonly manifest: PersistedGateManifest;
  readonly heldOutPair: RealBuildPrefix50Step44RealDomainHeldOutPair;
  readonly treeCommitment: Sha256Digest;
}
interface QualificationBindingGuard {
  readonly outputPath: string;
  readonly treeCommitment: Sha256Digest;
}
const qualificationProofBrands = new WeakMap<object, QualificationProofAuthority>();
const qualificationBindingBrands = new WeakMap<object, QualificationBindingGuard>();

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function gateTreeCommitment(outputPath: string, persistedCaseCount: 2 | 3): Sha256Digest {
  return captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment({
    outputPath,
    persistedCaseCount,
  });
}

export async function persistAndVerifyRealBuildPrefix50Step44RealDomainQualification(input: {
  readonly outputPath: string;
  readonly publicationTransaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly heldOutReceipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt;
  readonly heldOutPair: RealBuildPrefix50Step44RealDomainHeldOutPair;
  readonly caseProofs: readonly [
    RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
    RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
    RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
  ];
  readonly cleanup: RealDomainCleanupEvidence;
}): Promise<RealBuildPrefix50Step44VerifiedRealDomainQualification> {
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(input.outputPath);
  const proofOutputPath = prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
    input.publicationTransaction,
    outputPath,
  );
  const session = requireRealBuildPrefix50Step44RealDomainCalibrationSession(
    input.calibrationSession,
  );
  const calibration = requireRealBuildPrefix50Step44QualifiedRealDomainCalibration(
    session.calibrationReceipt,
  );
  const heldOut = requireRealBuildPrefix50Step44ValidatedRealDomainHeldOut(input.heldOutReceipt);
  const captures = input.caseProofs.map((proof, index) => {
    const capture = requireRealBuildPrefix50Step44VerifiedPersistedRealDomainCase(proof);
    if (
      capture === undefined ||
      capture.panelStep !== index + 41 ||
      proof.outputRealPathCommitment !==
        canonicalDigest({ realPath: resolve(proofOutputPath, `step-${index + 41}`) })
    )
      throw new TypeError(
        "Real-domain qualification requires verified Steps 41, 42, then 43 case proofs.",
      );
    return capture;
  });
  if (
    calibration.observations.some(
      (observation, index) =>
        observation.observationCommitment !== captures[index]!.observation.observationCommitment,
    ) ||
    heldOut.observation.observationCommitment !== captures[2]!.observation.observationCommitment ||
    heldOut.calibrationSessionCommitment !== input.calibrationSession.commitment
  )
    throw new TypeError(
      "Real-domain receipts drifted from their exact persisted live observations.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-camera-gate/1" as const,
    authority: "none" as const,
    status: "qualified-and-validated" as const,
    reviewBatchEnvelopeCommitment: input.calibrationSession.reviewBatchEnvelopeCommitment,
    sourceLock: session.sourceLock.evidence,
    calibrationSessionCommitment: input.calibrationSession.commitment,
    calibrationReceipt: calibration,
    heldOutReceipt: heldOut,
    caseProofCommitments: input.caseProofs.map(({ commitment }) => commitment) as [
      Sha256Digest,
      Sha256Digest,
      Sha256Digest,
    ],
    thresholdsChanged: false as const,
    cleanup: input.cleanup,
  };
  const manifest = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  writeContainedRegularFileAtomic(outputPath, GATE_MANIFEST_FILE, manifestBytes, {
    label: "real-domain qualification authority manifest",
  });
  const persisted =
    await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts");
  const verified = await withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
    { outputPath, persistedCaseCount: 3 },
    async () => {
      const result =
        await persisted.verifyPersistedRealBuildPrefix50Step44RealDomainQualificationFromLiveSession(
          {
            qualificationOutputPath: outputPath,
            calibrationSession: input.calibrationSession,
            heldOutPair: input.heldOutPair,
            publicationTransaction: input.publicationTransaction,
          },
        );
      if (canonicalDigest(result.manifest) !== canonicalDigest(manifest))
        throw new TypeError(
          "Persisted real-domain qualification manifest drifted after strict reopen.",
        );
      return Object.freeze({
        result,
        treeCommitment: gateTreeCommitment(outputPath, 3),
      });
    },
  );
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-verified-real-domain-qualification/1" as const,
    outputRealPathCommitment: canonicalDigest({ realPath: proofOutputPath }),
    reviewBatchEnvelopeCommitment: input.calibrationSession.reviewBatchEnvelopeCommitment,
    sourceLockCommitment: session.sourceLock.evidence.commitment,
    calibrationSessionCommitment: input.calibrationSession.commitment,
    calibrationReceiptCommitment: calibration.commitment,
    heldOutReceiptCommitment: heldOut.commitment,
    persistedManifestCommitment: manifest.commitment,
  };
  const proof = Object.freeze({ ...proofBody, commitment: canonicalDigest(proofBody) });
  qualificationProofBrands.set(
    proof,
    Object.freeze({
      manifest: verified.result.manifest,
      heldOutPair: input.heldOutPair,
      treeCommitment: verified.treeCommitment,
    }),
  );
  return proof;
}

export function requireRealBuildPrefix50Step44VerifiedRealDomainQualification(input: {
  readonly proof: RealBuildPrefix50Step44VerifiedRealDomainQualification;
  readonly outputPath: string;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly publicationTransaction?: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): PersistedGateManifest {
  const session = requireRealBuildPrefix50Step44RealDomainCalibrationSession(
    input.calibrationSession,
  );
  const authority = qualificationProofBrands.get(input.proof);
  const manifest = authority?.manifest;
  if (
    authority === undefined ||
    manifest === undefined ||
    input.proof.outputRealPathCommitment !==
      canonicalDigest({
        realPath:
          input.publicationTransaction === undefined
            ? resolve(input.outputPath)
            : prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
                input.publicationTransaction,
                input.outputPath,
              ),
      }) ||
    input.proof.reviewBatchEnvelopeCommitment !==
      input.calibrationSession.reviewBatchEnvelopeCommitment ||
    input.proof.sourceLockCommitment !== session.sourceLock.evidence.commitment ||
    input.proof.calibrationSessionCommitment !== input.calibrationSession.commitment ||
    input.proof.commitment !== canonicalDigest(withoutCommitment(input.proof)) ||
    input.proof.persistedManifestCommitment !== manifest.commitment ||
    gateTreeCommitment(input.outputPath, 3) !== authority.treeCommitment
  )
    throw new TypeError(
      "Step-44 camera gate requires the exact runtime-branded persisted real-domain qualification proof.",
    );
  return manifest;
}

export async function bindRealBuildPrefix50Step44VerifiedRealDomainQualification(input: {
  readonly proof: RealBuildPrefix50Step44VerifiedRealDomainQualification;
  readonly repositoryRoot: string;
  readonly outputPath: string;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly committedPublication: RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication;
}): Promise<RealBuildPrefix50Step44RealDomainQualificationBinding> {
  const committedPublication =
    await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
      input.committedPublication,
      input.outputPath,
    );
  try {
    const manifest = requireRealBuildPrefix50Step44VerifiedRealDomainQualification(input);
    const authority = qualificationProofBrands.get(input.proof)!;
    const persisted =
      await import("./real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts");
    const verified =
      await persisted.verifyPersistedRealBuildPrefix50Step44RealDomainQualificationFromLiveSession({
        qualificationOutputPath: input.outputPath,
        calibrationSession: input.calibrationSession,
        heldOutPair: authority.heldOutPair,
      });
    if (verified.proof.commitment !== input.proof.commitment)
      throw new TypeError("Committed real-domain qualification did not reproduce its live proof.");
    await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
      committedPublication,
      input.outputPath,
    );
    const body = {
      schemaVersion: "lego.real-build-prefix50-step44-real-domain-qualification-binding/1" as const,
      qualificationOutputRealPathCommitment: input.proof.outputRealPathCommitment,
      reviewBatchEnvelopeCommitment: input.proof.reviewBatchEnvelopeCommitment,
      sourceLockCommitment: input.proof.sourceLockCommitment,
      calibrationSessionCommitment: input.calibrationSession.commitment,
      calibrationReceiptCommitment: manifest.calibrationReceipt.commitment,
      heldOutReceiptCommitment: manifest.heldOutReceipt.commitment,
      persistedManifestCommitment: manifest.commitment,
      qualificationProofCommitment: input.proof.commitment,
      popplerToolchainCommitment: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT,
    };
    const binding = Object.freeze({ ...body, commitment: canonicalDigest(body) });
    qualificationBindingBrands.set(
      binding,
      Object.freeze({
        outputPath: resolve(input.outputPath),
        treeCommitment: authority.treeCommitment,
      }),
    );
    const verifiedBinding = requireRealBuildPrefix50Step44RealDomainQualificationBinding(binding);
    provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis({
      repositoryRoot: input.repositoryRoot,
      qualificationCommitment: verifiedBinding.commitment,
    });
    return verifiedBinding;
  } finally {
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
      committedPublication,
    );
  }
}

export async function readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification(input: {
  readonly qualificationOutputPath: string;
  readonly repositoryRoot: string;
  readonly sourceLock: import("./real-build-prefix50-step44-camera-only-source-lock.ts").RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
  readonly returnResult: import("./real-build-prefix50-subbuild-return-contract.ts").RealBuildPrefix50SubBuildReturnResult;
  readonly reviewBatch: import("./real-build-prefix50-subbuild-return-contract.ts").RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): Promise<RealBuildPrefix50Step44RealDomainQualificationBinding> {
  const persisted = await import("./real-build-prefix50-step44-calibration-persisted-binding.ts");
  const verified =
    await persisted.readCommittedRealBuildPrefix50Step44PersistedQualification(input);
  qualificationBindingBrands.set(
    verified.result.binding,
    Object.freeze({
      outputPath: resolve(verified.result.outputPath),
      treeCommitment: verified.treeCommitment,
    }),
  );
  return requireRealBuildPrefix50Step44RealDomainQualificationBinding(verified.result.binding);
}

export function requireRealBuildPrefix50Step44RealDomainQualificationBinding(
  binding: RealBuildPrefix50Step44RealDomainQualificationBinding,
): RealBuildPrefix50Step44RealDomainQualificationBinding {
  if (binding === null || typeof binding !== "object")
    throw new TypeError(
      "Step-44 page-45 camera execution requires a runtime-branded persisted Steps-41/42-qualified and Step-43-validated real-domain binding.",
    );
  const { commitment, ...body } = binding;
  const guard = qualificationBindingBrands.get(binding);
  if (
    guard === undefined ||
    binding.popplerToolchainCommitment !==
      REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT ||
    commitment !== canonicalDigest(body) ||
    gateTreeCommitment(guard.outputPath, 3) !== guard.treeCommitment
  )
    throw new TypeError(
      "Step-44 page-45 camera execution requires a runtime-branded persisted Steps-41/42-qualified and Step-43-validated real-domain binding.",
    );
  return binding;
}
