import type {
  RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  RealBuildPrefix50Step44LaterSourceLedgerPaths,
  RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
} from "./real-build-prefix50-step44-later-source-ledger-files.ts";
import type {
  RealBuildPrefix50Step44LaterSourceLedgerClaim,
  RealBuildPrefix50Step44LaterSourceLedgerState,
} from "./real-build-prefix50-step44-later-source-ledger-model.ts";
import type { RealBuildPrefix50Step44LaterSourceLedgerArtifacts } from "./real-build-prefix50-step44-later-source-ledger-storage.ts";

export interface RealBuildPrefix50Step44LaterSourceOpenLedger {
  readonly identity: RealBuildPrefix50Step44LaterSourceRepositoryIdentity;
  readonly paths: RealBuildPrefix50Step44LaterSourceLedgerPaths;
  readonly key: Buffer;
  readonly state: RealBuildPrefix50Step44LaterSourceLedgerState;
}

export interface RealBuildPrefix50Step44LaterSourceActiveTransaction {
  readonly ledger: RealBuildPrefix50Step44LaterSourceOpenLedger;
  readonly claim: RealBuildPrefix50Step44LaterSourceLedgerClaim;
  readonly files: RealBuildPrefix50Step44LaterSourceLedgerArtifacts;
  readonly burnState: RealBuildPrefix50Step44LaterSourceLedgerState;
  readonly observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}
