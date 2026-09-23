import type { RealBuildPrefix50Step44BlindId } from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";

export interface RealBuildPrefix50Step44BlindDispatchAssignment {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly batchIndex: number;
  readonly rankDigest: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44BlindDispatchPlan {
  readonly schemaVersion: "lego.real-build-prefix50-step44-blind-dispatch-plan/1";
  readonly authority: "none";
  readonly blindingSeedHex: string;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly assignments: readonly RealBuildPrefix50Step44BlindDispatchAssignment[];
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44WithheldUnblindingRow {
  readonly blindId: RealBuildPrefix50Step44BlindId;
  readonly batchIndex: number;
  readonly rankDigest: `sha256:${string}`;
  readonly artifactDirectory: string;
  readonly rosterIndex: number;
  readonly candidateKey: string;
  readonly operationsCommitment: `sha256:${string}`;
  readonly compactCandidateCommitment: `sha256:${string}`;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly captureManifestFile: string;
  readonly captureManifestByteDigest: `sha256:${string}`;
  readonly captureManifestCommitment: `sha256:${string}`;
  readonly sourceRowCommitment: `sha256:${string}`;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50Step44WithheldUnblindingMap {
  readonly schemaVersion: "lego.real-build-prefix50-step44-withheld-unblinding-map/1";
  readonly authority: "none";
  readonly publicDuringReview: false;
  readonly sourceSetId: "6651557";
  readonly dispatchPlanCommitment: `sha256:${string}`;
  readonly blindingSeedHex: string;
  readonly reviewBatchEnvelopeCommitment: `sha256:${string}`;
  readonly returnResultCommitment: `sha256:${string}`;
  readonly candidateRosterCommitment: `sha256:${string}`;
  readonly candidateKeysCommitment: `sha256:${string}`;
  readonly publicPacketCoreCommitment: `sha256:${string}`;
  readonly candidateCount: 211;
  readonly rows: readonly RealBuildPrefix50Step44WithheldUnblindingRow[];
  readonly commitment: `sha256:${string}`;
}
