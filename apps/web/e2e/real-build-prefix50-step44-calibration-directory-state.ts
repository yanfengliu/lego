import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import type { Sha256Digest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44CalibrationPublicationDescriptor } from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import type { RealBuildPrefix50Step44CalibrationDirectoryHelperSession } from "./real-build-prefix50-step44-calibration-directory-process.ts";
import type {
  RealBuildPrefix50Step44VerifiedRealDomainQualification,
  RealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
import type { RealBuildPrefix50Step44RealDomainCalibrationSession } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import type { RealBuildPrefix50Step44ClaimedDirectoryIdentity } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

export interface RealBuildPrefix50Step44CalibrationDirectoryTransaction {
  readonly stagingOutputPath: string;
  readonly finalOutputPath: string;
  readonly stagingPublicationMarkerPath: string;
  readonly finalPublicationMarkerPath: string;
  readonly retainedPublicationMarkerPath: string;
}

export interface RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication {
  readonly finalOutputPath: string;
}

export type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof = Readonly<
  | {
      kind: "qualification";
      proof: RealBuildPrefix50Step44VerifiedRealDomainQualification;
      calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
    }
  | {
      kind: "refusal";
      proof: RealBuildPrefix50Step44VerifiedRealDomainRefusal;
      calibrationSession: RealBuildPrefix50Step44RealDomainCalibrationSession;
    }
>;

export interface RealBuildPrefix50Step44CalibrationDirectoryTransactionState extends RealBuildPrefix50Step44CalibrationDirectoryHelperSession {
  readonly rootIdentity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly stagingIdentity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  descriptor?: RealBuildPrefix50Step44CalibrationPublicationDescriptor;
  markerBytes?: Buffer;
  publicationProof?: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof;
  publishedIdentity?: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  retainedOutputPath?: string;
  retainedMarkerPath?: string;
  preparedTreeRosterCommitment?: Sha256Digest;
  lockedRosterCommitment?: Sha256Digest;
  rootMutexWaitObserver?: () => void;
  operation: "commit" | "finalize" | "reassert" | "complete" | null;
  phase: "staging" | "prepared" | "publishing" | "guarded" | "closed";
}

export interface RealBuildPrefix50Step44CommittedCalibrationDirectoryState {
  readonly state: RealBuildPrefix50Step44CalibrationDirectoryTransactionState;
  readonly transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly identity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly descriptor: RealBuildPrefix50Step44CalibrationPublicationDescriptor;
}

export function requireRealBuildPrefix50Step44CalibrationDirectoryTransactionState(
  state: RealBuildPrefix50Step44CalibrationDirectoryTransactionState | undefined,
): RealBuildPrefix50Step44CalibrationDirectoryTransactionState {
  if (state === undefined || state.phase === "closed")
    throw new TypeError("Calibration publication requires its live opaque directory transaction.");
  if (state.child.exitCode !== null || state.child.signalCode !== null)
    throw new Error(`Calibration directory helper died before publication: ${state.stderr()}.`);
  return state;
}

export function exactRealBuildPrefix50Step44PublishedDirectoryIdentity(
  state: RealBuildPrefix50Step44CalibrationDirectoryTransactionState,
  finalOutputPath: string,
): RealBuildPrefix50Step44ClaimedDirectoryIdentity | undefined {
  try {
    const path = resolve(finalOutputPath);
    const stat = lstatSync(path, { bigint: true });
    if (
      stat.isSymbolicLink() ||
      !stat.isDirectory() ||
      realpathSync.native(path) !== path ||
      stat.dev.toString() !== state.stagingIdentity.device ||
      stat.ino.toString() !== state.stagingIdentity.inode
    )
      return undefined;
    return Object.freeze({
      lexicalPath: path,
      realPath: path,
      device: stat.dev.toString(),
      inode: stat.ino.toString(),
    });
  } catch {
    return undefined;
  }
}
