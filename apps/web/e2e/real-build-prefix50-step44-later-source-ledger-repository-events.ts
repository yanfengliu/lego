import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver } from "./real-build-prefix50-step44-later-source-ledger-files.ts";
import type { RealBuildPrefix50Step44LaterSourceOpenLedger } from "./real-build-prefix50-step44-later-source-ledger-internal-types.ts";
import type { RealBuildPrefix50Step44LaterSourceLedgerClaim } from "./real-build-prefix50-step44-later-source-ledger-model.ts";
import {
  recordRealBuildPrefix50Step44LaterSourceRepositoryEvent,
  requireRealBuildPrefix50Step44LaterSourceQualificationReservation,
} from "./real-build-prefix50-step44-later-source-ledger-provision.ts";

export function requireRealBuildPrefix50Step44LaterSourceRepositoryGenesis(
  ledger: Pick<RealBuildPrefix50Step44LaterSourceOpenLedger, "identity" | "state">,
): void {
  requireRealBuildPrefix50Step44LaterSourceQualificationReservation({
    repositoryRoot: ledger.identity.realPath,
    qualificationCommitment: ledger.state.qualificationCommitment,
    expectedRepositoryIdentityCommitment: ledger.identity.commitment,
  });
}

export function recordRealBuildPrefix50Step44LaterSourceRepositoryLedgerEvent(
  ledger: RealBuildPrefix50Step44LaterSourceOpenLedger,
  claim: RealBuildPrefix50Step44LaterSourceLedgerClaim,
  eventKind: "issue" | "burn" | "completion",
  eventCommitment: `sha256:${string}`,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): void {
  recordRealBuildPrefix50Step44LaterSourceRepositoryEvent({
    repositoryRoot: ledger.identity.realPath,
    qualificationCommitment: claim.qualificationCommitment,
    expectedRepositoryIdentityCommitment: ledger.identity.commitment,
    claimCommitment: canonicalDigest(claim),
    eventKind,
    eventCommitment,
    observer,
  });
}
