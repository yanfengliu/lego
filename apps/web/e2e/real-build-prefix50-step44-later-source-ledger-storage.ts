import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  writeRealBuildPrefix50Step44LaterSourceLedgerFileAtomic,
  type RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  type RealBuildPrefix50Step44LaterSourceLedgerPaths,
  type RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
} from "./real-build-prefix50-step44-later-source-ledger-files.ts";
import type {
  RealBuildPrefix50Step44LaterSourceLedgerClaim,
  RealBuildPrefix50Step44LaterSourceLedgerPurpose,
} from "./real-build-prefix50-step44-later-source-ledger-model.ts";
import { sealRealBuildPrefix50Step44LaterSourceLedgerValue } from "./real-build-prefix50-step44-later-source-ledger-seal.ts";

export interface RealBuildPrefix50Step44LaterSourceLedgerArtifacts extends RealBuildPrefix50Step44LaterSourceLedgerPaths {
  readonly issuance: string;
  readonly burn: string;
  readonly completion: string;
}

function eventPath(
  paths: RealBuildPrefix50Step44LaterSourceLedgerPaths,
  event: "issue" | "burn" | "completion",
  purpose: RealBuildPrefix50Step44LaterSourceLedgerPurpose,
): string {
  return `${paths.ledgerDirectory}/${event}-${purpose}.sealed.json`;
}

export function realBuildPrefix50Step44LaterSourceLedgerArtifactsForPaths(
  paths: RealBuildPrefix50Step44LaterSourceLedgerPaths,
  claim: RealBuildPrefix50Step44LaterSourceLedgerClaim,
): RealBuildPrefix50Step44LaterSourceLedgerArtifacts {
  return Object.freeze({
    ...paths,
    issuance: eventPath(paths, "issue", claim.purpose),
    burn: eventPath(paths, "burn", claim.purpose),
    completion: eventPath(paths, "completion", claim.purpose),
  });
}

export function requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(
  expected: RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
): void {
  const current = captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(expected.realPath);
  if (canonicalDigest(current) !== canonicalDigest(expected))
    throw new TypeError("Later-source ledger canonical repository identity changed.");
}

export function writeRealBuildPrefix50Step44LaterSourceSealed(input: {
  path: string;
  value: object;
  key: Uint8Array;
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
  boundary: string;
  replace: boolean;
  exactParentMode?: boolean;
}): void {
  writeRealBuildPrefix50Step44LaterSourceLedgerFileAtomic({
    path: input.path,
    bytes: sealRealBuildPrefix50Step44LaterSourceLedgerValue(input.value, input.key),
    observer: input.observer,
    boundary: input.boundary,
    replace: input.replace,
    ...(input.exactParentMode === undefined ? {} : { exactParentMode: input.exactParentMode }),
  });
}
