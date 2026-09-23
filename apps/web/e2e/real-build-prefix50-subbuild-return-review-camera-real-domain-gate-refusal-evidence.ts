import { resolve } from "node:path";

import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read.ts";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write.ts";
import {
  requireRealBuildPrefix50Step44RealDomainHeldOutReceipt,
  type RealBuildPrefix50Step44RealDomainHeldOutReceipt,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import {
  requireRealBuildPrefix50Step44RealDomainOutputChild,
  requireRealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
  verifyPersistedRealBuildPrefix50Step44RealDomainCase,
  type RealBuildPrefix50Step44VerifiedPersistedRealDomainCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import type {
  PersistedRefusalManifest,
  RealBuildPrefix50Step44VerifiedRealDomainRefusal,
  RealDomainCleanupEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
import {
  captureRealBuildPrefix50Step44RealDomainGateOutputTreeCommitment,
  withStableRealBuildPrefix50Step44RealDomainGateOutputTree,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-tree.ts";
import {
  requireRealBuildPrefix50Step44RealDomainCalibrationSession,
  type RealBuildPrefix50Step44RealDomainCalibrationSession,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import {
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
} from "./real-build-prefix50-step44-calibration-directory-transaction.ts";

const GATE_MANIFEST_FILE = "real-domain-camera-gate.json";
const refusalProofBrands = new WeakMap<
  object,
  Readonly<{ manifest: PersistedRefusalManifest; treeCommitment: Sha256Digest }>
>();

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

export async function persistAndVerifyRealBuildPrefix50Step44RealDomainRefusal(input: {
  readonly outputPath: string;
  readonly publicationTransaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly heldOutReceipt: RealBuildPrefix50Step44RealDomainHeldOutReceipt | null;
  readonly caseProofs: readonly RealBuildPrefix50Step44VerifiedPersistedRealDomainCase[];
  readonly cleanup: RealDomainCleanupEvidence;
}): Promise<RealBuildPrefix50Step44VerifiedRealDomainRefusal> {
  const outputPath = await requireRealBuildPrefix50Step44RealDomainOutputChild(input.outputPath);
  const proofOutputPath = prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
    input.publicationTransaction,
    outputPath,
  );
  const session = requireRealBuildPrefix50Step44RealDomainCalibrationSession(
    input.calibrationSession,
  );
  const calibrationReceipt = session.calibrationReceipt;
  const status =
    calibrationReceipt.status === "refused"
      ? ("calibration-refused" as const)
      : ("heldout-refused" as const);
  const heldOutReceipt =
    input.heldOutReceipt === null
      ? null
      : requireRealBuildPrefix50Step44RealDomainHeldOutReceipt(input.heldOutReceipt);
  if (
    input.caseProofs.length !== (status === "calibration-refused" ? 2 : 3) ||
    input.caseProofs.some((proof, index) => {
      const capture = requireRealBuildPrefix50Step44VerifiedPersistedRealDomainCase(proof);
      return (
        capture === undefined ||
        capture.panelStep !== index + 41 ||
        proof.outputRealPathCommitment !==
          canonicalDigest({ realPath: resolve(proofOutputPath, `step-${index + 41}`) })
      );
    }) ||
    (status === "calibration-refused" && heldOutReceipt !== null) ||
    (status === "heldout-refused" && heldOutReceipt?.status !== "refused") ||
    calibrationReceipt.thresholdsChanged !== false ||
    (heldOutReceipt !== null &&
      (heldOutReceipt.thresholdsChanged !== false ||
        heldOutReceipt.calibrationSessionCommitment !== input.calibrationSession.commitment))
  )
    throw new TypeError(
      "Real-domain refusal must retain exact ordered persisted cases and an unchanged-threshold refused receipt.",
    );
  const body = {
    schemaVersion: "lego.real-build-prefix50-real-domain-camera-gate/1" as const,
    authority: "none" as const,
    status,
    reviewBatchEnvelopeCommitment: input.calibrationSession.reviewBatchEnvelopeCommitment,
    sourceLock: session.sourceLock.evidence,
    calibrationSessionCommitment: input.calibrationSession.commitment,
    calibrationReceipt,
    heldOutReceipt,
    caseProofCommitments: input.caseProofs.map(({ commitment }) => commitment),
    thresholdsChanged: false as const,
    cleanup: input.cleanup,
  };
  const manifest = Object.freeze({ ...body, commitment: canonicalDigest(body) });
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  writeContainedRegularFileAtomic(outputPath, GATE_MANIFEST_FILE, manifestBytes, {
    label: "real-domain refusal authority manifest",
  });
  const persisted = JSON.parse(
    readContainedBoundedRegularFile(outputPath, GATE_MANIFEST_FILE, {
      label: "real-domain refusal authority manifest",
      maximumBytes: 64 * 1024 * 1024,
      exactBytes: Buffer.byteLength(manifestBytes),
    }).toString("utf8"),
  ) as PersistedRefusalManifest;
  if (
    persisted.commitment !== canonicalDigest(withoutCommitment(persisted)) ||
    canonicalDigest(persisted) !== canonicalDigest(manifest)
  )
    throw new TypeError("Persisted real-domain refusal manifest drifted after write.");
  const persistedCaseCount = status === "calibration-refused" ? 2 : 3;
  const treeCommitment = await withStableRealBuildPrefix50Step44RealDomainGateOutputTree(
    { outputPath, persistedCaseCount },
    async () => {
      for (const proof of input.caseProofs) {
        const reopened = await verifyPersistedRealBuildPrefix50Step44RealDomainCase({
          outputPath,
          capture: requireRealBuildPrefix50Step44VerifiedPersistedRealDomainCase(proof),
          publicationTransaction: input.publicationTransaction,
        });
        if (reopened.commitment !== proof.commitment)
          throw new TypeError("Persisted real-domain refusal case drifted after strict reopen.");
      }
      const reopenedManifest = readContainedBoundedRegularFile(outputPath, GATE_MANIFEST_FILE, {
        label: "real-domain refusal authority manifest",
        maximumBytes: 64 * 1024 * 1024,
        exactBytes: Buffer.byteLength(manifestBytes),
      });
      if (!reopenedManifest.equals(Buffer.from(manifestBytes)))
        throw new TypeError("Persisted real-domain refusal manifest bytes drifted.");
      return gateTreeCommitment(outputPath, persistedCaseCount);
    },
  );
  const proofBody = {
    schemaVersion: "lego.real-build-prefix50-verified-real-domain-refusal/1" as const,
    status,
    outputRealPathCommitment: canonicalDigest({ realPath: proofOutputPath }),
    reviewBatchEnvelopeCommitment: input.calibrationSession.reviewBatchEnvelopeCommitment,
    sourceLockCommitment: session.sourceLock.evidence.commitment,
    calibrationSessionCommitment: input.calibrationSession.commitment,
    calibrationReceiptCommitment: calibrationReceipt.commitment,
    heldOutReceiptCommitment: heldOutReceipt?.commitment ?? null,
    persistedManifestCommitment: manifest.commitment,
  };
  const proof = Object.freeze({ ...proofBody, commitment: canonicalDigest(proofBody) });
  refusalProofBrands.set(
    proof,
    Object.freeze({
      manifest,
      treeCommitment,
    }),
  );
  return proof;
}

export function requireRealBuildPrefix50Step44VerifiedRealDomainRefusal(input: {
  readonly proof: RealBuildPrefix50Step44VerifiedRealDomainRefusal;
  readonly outputPath: string;
  readonly calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
  readonly publicationTransaction?: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
}): PersistedRefusalManifest {
  const session = requireRealBuildPrefix50Step44RealDomainCalibrationSession(
    input.calibrationSession,
  );
  const authority = refusalProofBrands.get(input.proof);
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
    gateTreeCommitment(input.outputPath, input.proof.status === "calibration-refused" ? 2 : 3) !==
      authority.treeCommitment
  )
    throw new TypeError("Real-domain refusal lacks its exact runtime-branded persisted proof.");
  return manifest;
}
