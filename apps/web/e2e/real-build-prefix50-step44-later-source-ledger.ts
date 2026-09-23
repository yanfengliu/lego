import { randomBytes } from "node:crypto";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  createRealBuildPrefix50Step44LaterSourceTransactionLock,
  readRealBuildPrefix50Step44LaterSourceLedgerFile,
  realBuildPrefix50Step44LaterSourceLedgerPathExists,
  realBuildPrefix50Step44LaterSourceLedgerPaths,
  removeRealBuildPrefix50Step44LaterSourceTransactionLock,
  requireRealBuildPrefix50Step44LaterSourceLedgerDirectory,
  type RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  type RealBuildPrefix50Step44LaterSourceLedgerPaths,
  type RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
} from "./real-build-prefix50-step44-later-source-ledger-files.ts";
import type {
  RealBuildPrefix50Step44LaterSourceActiveTransaction,
  RealBuildPrefix50Step44LaterSourceOpenLedger,
} from "./real-build-prefix50-step44-later-source-ledger-internal-types.ts";
import {
  openRealBuildPrefix50Step44LaterSourceLedgerKey,
  openRealBuildPrefix50Step44LaterSourceLedgerValue,
  sealRealBuildPrefix50Step44LaterSourceLedgerValue,
} from "./real-build-prefix50-step44-later-source-ledger-seal.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256,
  requireRealBuildPrefix50Step44LaterSourceDerivedEvidence,
  requireRealBuildPrefix50Step44LaterSourceExactKeys,
  requireRealBuildPrefix50Step44LaterSourceLedgerClaim,
  requireRealBuildPrefix50Step44LaterSourceLedgerState,
  type RealBuildPrefix50Step44LaterSourceDerivedEvidence,
  type RealBuildPrefix50Step44LaterSourceInternalTransaction,
  type RealBuildPrefix50Step44LaterSourceLedgerClaim,
  type RealBuildPrefix50Step44LaterSourceLedgerEntry,
  type RealBuildPrefix50Step44LaterSourceLedgerPurpose,
  type RealBuildPrefix50Step44LaterSourceLedgerState,
  type RealBuildPrefix50Step44LaterSourceTransactionEvidence,
} from "./real-build-prefix50-step44-later-source-ledger-model.ts";
import {
  realBuildPrefix50Step44LaterSourceLedgerArtifactsForPaths,
  requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  writeRealBuildPrefix50Step44LaterSourceSealed,
  type RealBuildPrefix50Step44LaterSourceLedgerArtifacts,
} from "./real-build-prefix50-step44-later-source-ledger-storage.ts";
import {
  recordRealBuildPrefix50Step44LaterSourceRepositoryLedgerEvent,
  requireRealBuildPrefix50Step44LaterSourceRepositoryGenesis,
} from "./real-build-prefix50-step44-later-source-ledger-repository-events.ts";

export type {
  RealBuildPrefix50Step44LaterSourceDerivedEvidence,
  RealBuildPrefix50Step44LaterSourceInternalTransaction,
  RealBuildPrefix50Step44LaterSourceLedgerClaim,
  RealBuildPrefix50Step44LaterSourceLedgerPurpose,
  RealBuildPrefix50Step44LaterSourceTransactionEvidence,
} from "./real-build-prefix50-step44-later-source-ledger-model.ts";

export type { RealBuildPrefix50Step44LaterSourceLedgerArtifacts } from "./real-build-prefix50-step44-later-source-ledger-storage.ts";

const noopObserver: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver = () => {};
type ActiveTransaction = RealBuildPrefix50Step44LaterSourceActiveTransaction;
const activeTransactions = new WeakMap<object, ActiveTransaction>();
function openExisting(
  identity: RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  paths: RealBuildPrefix50Step44LaterSourceLedgerPaths,
  qualificationCommitment: `sha256:${string}`,
): RealBuildPrefix50Step44LaterSourceOpenLedger {
  requireRealBuildPrefix50Step44LaterSourceLedgerDirectory(paths.ledgerDirectory);
  if (!realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.marker))
    throw new TypeError("Later-source ledger anchor is unavailable; issuance remains closed.");
  const material = openRealBuildPrefix50Step44LaterSourceLedgerKey(
    readRealBuildPrefix50Step44LaterSourceLedgerFile(paths.key, "later-source ledger key"),
    identity.commitment,
  );
  try {
    const anchor = openRealBuildPrefix50Step44LaterSourceLedgerValue(
      readRealBuildPrefix50Step44LaterSourceLedgerFile(paths.marker, "later-source ledger anchor"),
      material.key,
    );
    if (anchor === null || typeof anchor !== "object" || Array.isArray(anchor))
      throw new TypeError("Later-source ledger anchor is invalid.");
    requireRealBuildPrefix50Step44LaterSourceExactKeys(
      anchor,
      [
        "schemaVersion",
        "namespaceCommitment",
        "repositoryIdentityCommitment",
        "qualificationCommitment",
        "keyCommitment",
      ],
      "Later-source ledger anchor",
    );
    const typed = anchor as Record<string, unknown>;
    if (
      typed.schemaVersion !== "lego.real-build-prefix50-step44-later-source-ledger-anchor/2" ||
      typed.namespaceCommitment !== paths.namespaceCommitment ||
      typed.repositoryIdentityCommitment !== identity.commitment ||
      typed.qualificationCommitment !== qualificationCommitment ||
      typed.keyCommitment !== material.keyCommitment
    )
      throw new TypeError("Later-source ledger anchor binding changed.");
    const partial = { identity, paths, key: material.key };
    const state = requireRealBuildPrefix50Step44LaterSourceLedgerState(
      openRealBuildPrefix50Step44LaterSourceLedgerValue(
        readRealBuildPrefix50Step44LaterSourceLedgerFile(paths.state, "later-source ledger state"),
        material.key,
      ),
      {
        namespaceCommitment: paths.namespaceCommitment,
        repositoryIdentityCommitment: identity.commitment,
        qualificationCommitment,
      },
    );
    if (state.qualificationCommitment !== qualificationCommitment)
      throw new TypeError("Later-source ledger qualification binding changed.");
    requireRealBuildPrefix50Step44LaterSourceRepositoryGenesis({ identity, state });
    requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(identity);
    return { ...partial, state };
  } catch (error) {
    material.key.fill(0);
    throw error;
  }
}

function openLedger(
  repositoryRoot: string,
  qualificationCommitment: `sha256:${string}`,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): RealBuildPrefix50Step44LaterSourceOpenLedger {
  const identity = captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(repositoryRoot);
  const paths = realBuildPrefix50Step44LaterSourceLedgerPaths(
    identity,
    qualificationCommitment,
    observer,
  );
  if (
    !realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.marker) ||
    !realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.ledgerDirectory)
  )
    throw new TypeError(
      "Later-source ledger has no stable preprovisioned qualification genesis; access remains closed.",
    );
  return openExisting(identity, paths, qualificationCommitment);
}

function nextState(
  ledger: RealBuildPrefix50Step44LaterSourceOpenLedger,
  purpose: RealBuildPrefix50Step44LaterSourceLedgerPurpose,
  entry: RealBuildPrefix50Step44LaterSourceLedgerEntry,
): RealBuildPrefix50Step44LaterSourceLedgerState {
  if (ledger.state.revision >= Number.MAX_SAFE_INTEGER)
    throw new RangeError("Later-source ledger revision limit was exhausted.");
  return Object.freeze({
    ...ledger.state,
    revision: ledger.state.revision + 1,
    entries: Object.freeze({ ...ledger.state.entries, [purpose]: entry }),
  });
}

function requireClaimEntry(
  claim: RealBuildPrefix50Step44LaterSourceLedgerClaim,
  entry: RealBuildPrefix50Step44LaterSourceLedgerEntry,
): void {
  if (
    entry.claimCommitment !== canonicalDigest(claim) ||
    entry.capabilityCommitment !== claim.capabilityCommitment ||
    entry.sourceLockCommitment !== claim.sourceLockCommitment ||
    entry.physicalPageNumber !== claim.physicalPageNumber
  )
    throw new TypeError("Later-source ledger claim conflicts with its sealed issuance.");
}

function lockLedger(
  ledger: RealBuildPrefix50Step44LaterSourceOpenLedger,
  claim: RealBuildPrefix50Step44LaterSourceLedgerClaim,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): void {
  createRealBuildPrefix50Step44LaterSourceTransactionLock({
    path: ledger.paths.transactionLock,
    bytes: sealRealBuildPrefix50Step44LaterSourceLedgerValue(
      {
        schemaVersion: "lego.real-build-prefix50-step44-later-source-transaction-lock/2",
        namespaceCommitment: ledger.paths.namespaceCommitment,
        claimCommitment: canonicalDigest(claim),
        nonceCommitment: canonicalDigest(randomBytes(32).toString("base64")),
      },
      ledger.key,
    ),
    observer,
  });
}

function unlockLedger(
  ledger: RealBuildPrefix50Step44LaterSourceOpenLedger,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): void {
  removeRealBuildPrefix50Step44LaterSourceTransactionLock({
    path: ledger.paths.transactionLock,
    observer,
  });
}

export function realBuildPrefix50Step44LaterSourceLedgerArtifacts(input: {
  readonly repositoryRoot: string;
  readonly claim: RealBuildPrefix50Step44LaterSourceLedgerClaim;
}): RealBuildPrefix50Step44LaterSourceLedgerArtifacts {
  const claim = requireRealBuildPrefix50Step44LaterSourceLedgerClaim(input.claim);
  const identity = captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(
    input.repositoryRoot,
  );
  return realBuildPrefix50Step44LaterSourceLedgerArtifactsForPaths(
    realBuildPrefix50Step44LaterSourceLedgerPaths(
      identity,
      claim.qualificationCommitment,
      noopObserver,
    ),
    claim,
  );
}

export function claimRealBuildPrefix50Step44LaterSourceIssuance(input: {
  readonly repositoryRoot: string;
  readonly claim: RealBuildPrefix50Step44LaterSourceLedgerClaim;
  readonly observer?: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): Readonly<{ namespaceCommitment: `sha256:${string}`; claimCommitment: `sha256:${string}` }> {
  const claim = requireRealBuildPrefix50Step44LaterSourceLedgerClaim(input.claim);
  const observer = input.observer ?? noopObserver;
  const ledger = openLedger(input.repositoryRoot, claim.qualificationCommitment, observer);
  try {
    const files = realBuildPrefix50Step44LaterSourceLedgerArtifactsForPaths(ledger.paths, claim);
    if (
      ledger.state.entries[claim.purpose] !== undefined ||
      realBuildPrefix50Step44LaterSourceLedgerPathExists(files.issuance)
    )
      throw new TypeError(
        `This qualification has already issued its one ${claim.purpose} operation.`,
      );
    lockLedger(ledger, claim, observer);
    try {
      const event = {
        schemaVersion: "lego.real-build-prefix50-step44-later-source-issue/2",
        namespaceCommitment: ledger.paths.namespaceCommitment,
        claim,
        claimCommitment: canonicalDigest(claim),
      };
      recordRealBuildPrefix50Step44LaterSourceRepositoryLedgerEvent(
        ledger,
        claim,
        "issue",
        canonicalDigest(event),
        observer,
      );
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path: files.issuance,
        value: event,
        key: ledger.key,
        observer,
        boundary: "later-source issue",
        replace: false,
      });
      const entry: RealBuildPrefix50Step44LaterSourceLedgerEntry = Object.freeze({
        claimCommitment: canonicalDigest(claim),
        capabilityCommitment: claim.capabilityCommitment,
        sourceLockCommitment: claim.sourceLockCommitment,
        physicalPageNumber: claim.physicalPageNumber,
        status: "issued",
        operationCommitment: null,
        resultCommitment: null,
      });
      const state = nextState(ledger, claim.purpose, entry);
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path: ledger.paths.state,
        value: state,
        key: ledger.key,
        observer,
        boundary: "later-source issue-state",
        replace: true,
      });
      requireRealBuildPrefix50Step44LaterSourceRepositoryGenesis({ ...ledger, state });
      requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(ledger.identity);
      unlockLedger(ledger, observer);
      return Object.freeze({
        namespaceCommitment: ledger.paths.namespaceCommitment,
        claimCommitment: entry.claimCommitment,
      });
    } catch (error) {
      if (realBuildPrefix50Step44LaterSourceLedgerPathExists(ledger.paths.transactionLock))
        unlockLedger(ledger, observer);
      throw error;
    }
  } finally {
    ledger.key.fill(0);
  }
}

export function beginRealBuildPrefix50Step44LaterSourceInternalTransaction(input: {
  readonly repositoryRoot: string;
  readonly claim: RealBuildPrefix50Step44LaterSourceLedgerClaim;
  readonly operationCommitment: `sha256:${string}`;
  readonly observer?: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): RealBuildPrefix50Step44LaterSourceInternalTransaction {
  const claim = requireRealBuildPrefix50Step44LaterSourceLedgerClaim(input.claim);
  if (!REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(input.operationCommitment))
    throw new TypeError("Later-source operation is not one exact bounded transaction.");
  const observer = input.observer ?? noopObserver;
  const ledger = openLedger(input.repositoryRoot, claim.qualificationCommitment, observer);
  try {
    const files = realBuildPrefix50Step44LaterSourceLedgerArtifactsForPaths(ledger.paths, claim);
    const prior = ledger.state.entries[claim.purpose];
    if (prior === undefined || !realBuildPrefix50Step44LaterSourceLedgerPathExists(files.issuance))
      throw new TypeError("Later-source operation has no intact durable issuance.");
    requireClaimEntry(claim, prior);
    if (prior.status !== "issued" || realBuildPrefix50Step44LaterSourceLedgerPathExists(files.burn))
      throw new TypeError("This later-source operation has already been consumed.");
    lockLedger(ledger, claim, observer);
    try {
      const burnEvent = {
        schemaVersion: "lego.real-build-prefix50-step44-later-source-burn/2",
        namespaceCommitment: ledger.paths.namespaceCommitment,
        claimCommitment: prior.claimCommitment,
        operationCommitment: input.operationCommitment,
      };
      recordRealBuildPrefix50Step44LaterSourceRepositoryLedgerEvent(
        ledger,
        claim,
        "burn",
        canonicalDigest(burnEvent),
        observer,
      );
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path: files.burn,
        value: burnEvent,
        key: ledger.key,
        observer,
        boundary: "later-source burn",
        replace: false,
      });
      const burned: RealBuildPrefix50Step44LaterSourceLedgerEntry = Object.freeze({
        ...prior,
        status: "burned",
        operationCommitment: input.operationCommitment,
        resultCommitment: null,
      });
      const burnState = nextState(ledger, claim.purpose, burned);
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path: ledger.paths.state,
        value: burnState,
        key: ledger.key,
        observer,
        boundary: "later-source burn-state",
        replace: true,
      });
      requireRealBuildPrefix50Step44LaterSourceRepositoryGenesis({
        ...ledger,
        state: burnState,
      });
      requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(ledger.identity);
      const body = Object.freeze({
        schemaVersion:
          "lego.real-build-prefix50-step44-later-source-internal-transaction/2" as const,
        namespaceCommitment: ledger.paths.namespaceCommitment,
        claimCommitment: prior.claimCommitment,
        operationCommitment: input.operationCommitment,
      });
      const transaction = Object.freeze({ ...body, commitment: canonicalDigest(body) });
      activeTransactions.set(transaction, {
        ledger: { ...ledger, state: burnState },
        claim,
        files,
        burnState,
        observer,
      });
      return transaction;
    } catch (error) {
      if (realBuildPrefix50Step44LaterSourceLedgerPathExists(ledger.paths.transactionLock))
        unlockLedger(ledger, observer);
      ledger.key.fill(0);
      throw error;
    }
  } catch (error) {
    ledger.key.fill(0);
    throw error;
  }
}

function activeTransaction(
  transaction: RealBuildPrefix50Step44LaterSourceInternalTransaction,
): RealBuildPrefix50Step44LaterSourceActiveTransaction {
  const active = activeTransactions.get(transaction);
  const { commitment, ...body } = transaction;
  if (
    active === undefined ||
    transaction.schemaVersion !==
      "lego.real-build-prefix50-step44-later-source-internal-transaction/2" ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Later-source completion requires its exact active transaction.");
  return active;
}

export function completeRealBuildPrefix50Step44LaterSourceInternalTransaction(input: {
  readonly transaction: RealBuildPrefix50Step44LaterSourceInternalTransaction;
  readonly evidence: RealBuildPrefix50Step44LaterSourceDerivedEvidence;
}): RealBuildPrefix50Step44LaterSourceTransactionEvidence {
  const active = activeTransaction(input.transaction);
  const result = requireRealBuildPrefix50Step44LaterSourceDerivedEvidence(input.evidence);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-later-source-transaction-evidence/2" as const,
    operationCommitment: input.transaction.operationCommitment,
    ...result,
  };
  const evidence = Object.freeze({ ...body, transactionCommitment: canonicalDigest(body) });
  try {
    recordRealBuildPrefix50Step44LaterSourceRepositoryLedgerEvent(
      active.ledger,
      active.claim,
      "completion",
      evidence.transactionCommitment,
      active.observer,
    );
    writeRealBuildPrefix50Step44LaterSourceSealed({
      path: active.files.completion,
      value: {
        schemaVersion: "lego.real-build-prefix50-step44-later-source-completion/2",
        namespaceCommitment: active.ledger.paths.namespaceCommitment,
        claimCommitment: input.transaction.claimCommitment,
        evidence,
      },
      key: active.ledger.key,
      observer: active.observer,
      boundary: "later-source completion",
      replace: false,
    });
    const prior = active.burnState.entries[active.claim.purpose]!;
    const completed: RealBuildPrefix50Step44LaterSourceLedgerEntry = Object.freeze({
      ...prior,
      status: "completed",
      resultCommitment: evidence.transactionCommitment,
    });
    const completedState = nextState(active.ledger, active.claim.purpose, completed);
    writeRealBuildPrefix50Step44LaterSourceSealed({
      path: active.ledger.paths.state,
      value: completedState,
      key: active.ledger.key,
      observer: active.observer,
      boundary: "later-source completion-state",
      replace: true,
    });
    requireRealBuildPrefix50Step44LaterSourceRepositoryGenesis({
      ...active.ledger,
      state: completedState,
    });
    requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(active.ledger.identity);
    unlockLedger(active.ledger, active.observer);
    activeTransactions.delete(input.transaction);
    active.ledger.key.fill(0);
    return evidence;
  } catch (error) {
    abandonRealBuildPrefix50Step44LaterSourceInternalTransaction(input.transaction);
    throw error;
  }
}

export function abandonRealBuildPrefix50Step44LaterSourceInternalTransaction(
  transaction: RealBuildPrefix50Step44LaterSourceInternalTransaction,
): void {
  const active = activeTransactions.get(transaction);
  if (active === undefined) return;
  activeTransactions.delete(transaction);
  try {
    if (realBuildPrefix50Step44LaterSourceLedgerPathExists(active.ledger.paths.transactionLock))
      unlockLedger(active.ledger, active.observer);
  } finally {
    active.ledger.key.fill(0);
  }
}
