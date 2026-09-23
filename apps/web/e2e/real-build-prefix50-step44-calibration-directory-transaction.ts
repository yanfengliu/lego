import { randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  assertSameRealBuildPrefix50Step44CalibrationPublicationDescriptor as assertSameDescriptor,
  createRealBuildPrefix50Step44CalibrationPublicationMarker,
  readExactRealBuildPrefix50Step44CalibrationPublicationMarkerBytes as readExactMarkerBytes,
  realBuildPrefix50Step44CalibrationPublicationMarkerPath,
  requireRealBuildPrefix50Step44CalibrationPublicationMarker,
} from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import { reassertRealBuildPrefix50Step44CalibrationPublicationProof as reassertPublicationProof } from "./real-build-prefix50-step44-calibration-publication-proof-loader.ts";
import {
  nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine,
  startRealBuildPrefix50Step44CalibrationDirectoryHelper,
  stopRealBuildPrefix50Step44CalibrationDirectoryHelper,
  waitForRealBuildPrefix50Step44CalibrationDirectoryHelper,
} from "./real-build-prefix50-step44-calibration-directory-process.ts";
import {
  isExactRealBuildPrefix50Step44GuardedCalibrationPublication as isExactGuardedPublication,
  reassertRealBuildPrefix50Step44GuardedCalibrationAuthority as reassertGuardedAuthority,
} from "./real-build-prefix50-step44-calibration-directory-authority.ts";
import {
  acceptRealBuildPrefix50Step44RetainedCalibrationDirectory as acceptRetained,
  captureRealBuildPrefix50Step44CalibrationTreeRosterCommitment as captureTreeRosterCommitment,
  lockRealBuildPrefix50Step44CalibrationGuardRoster as lockGuardRoster,
  releaseRealBuildPrefix50Step44ForeignCalibrationGuard as releaseForeignGuard,
} from "./real-build-prefix50-step44-calibration-directory-protocol.ts";
import {
  exactRealBuildPrefix50Step44PublishedDirectoryIdentity,
  requireRealBuildPrefix50Step44CalibrationDirectoryTransactionState as requireLiveState,
  type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  type RealBuildPrefix50Step44CalibrationDirectoryTransactionState as TransactionState,
  type RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CommittedCalibrationDirectoryState,
} from "./real-build-prefix50-step44-calibration-directory-state.ts";
import { createRealBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly } from "./real-build-prefix50-step44-calibration-directory-test-only.ts";
import {
  assertRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  captureRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  requireRealBuildPrefix50Step44ReviewOutputPublication,
  requireRealBuildPrefix50Step44ReviewOutputRootIdentity,
  type RealBuildPrefix50Step44ClaimedDirectoryIdentity,
  type RealBuildPrefix50Step44ReviewOutputPublication,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
const TRANSACTION_TIMEOUT_MS = 15 * 60 * 1_000;
const ROOT_MUTEX_TIMEOUT_MS = 10_000;
const transactions = new WeakMap<object, TransactionState>();
const committedPublications = new WeakMap<
  object,
  RealBuildPrefix50Step44CommittedCalibrationDirectoryState
>();
function requireState(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
): TransactionState {
  return requireLiveState(transactions.get(transaction));
}
export type {
  RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
} from "./real-build-prefix50-step44-calibration-directory-state.ts";
interface BeginTransactionTestHooks {
  readonly afterReady?: (stagingOutputPath: string) => Promise<void> | void;
}

interface FinalizeTransactionTestHooks {
  readonly afterPublishBeforeGuard?: () => Promise<void> | void;
  readonly afterGuardBeforeReceipt?: () => Promise<void> | void;
}
export async function beginRealBuildPrefix50Step44CalibrationDirectoryTransaction(
  publication: RealBuildPrefix50Step44ReviewOutputPublication,
  __testHooks?: BeginTransactionTestHooks,
): Promise<RealBuildPrefix50Step44CalibrationDirectoryTransaction> {
  if (process.platform !== "win32")
    throw new TypeError("Page44 calibration directory publication requires Windows TxF.");
  if (__testHooks !== undefined && import.meta.env.MODE !== "test")
    throw new TypeError("Calibration transaction lifecycle hooks are available only to tests.");
  const finalOutputPath =
    requireRealBuildPrefix50Step44ReviewOutputPublication(publication).outputPath;
  const rootIdentity = requireRealBuildPrefix50Step44ReviewOutputRootIdentity(publication);
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(rootIdentity);
  const root = rootIdentity.realPath;
  const finalPublicationMarkerPath =
    realBuildPrefix50Step44CalibrationPublicationMarkerPath(finalOutputPath);
  if (existsSync(finalPublicationMarkerPath))
    throw new TypeError(
      `Calibration publication marker already exists; choose a new run directory: ${finalPublicationMarkerPath}.`,
    );
  const stagingName = `.page44-calibration-staging-${randomUUID()}`;
  const rollbackName = `.page44-calibration-retained-${randomUUID()}`;
  const intentName = `.page44-calibration-intent-${randomUUID()}.json`;
  const stagingOutputPath = resolve(root, stagingName);
  const stagingPublicationMarkerPath = resolve(root, intentName);
  const retainedPublicationMarkerPath = resolve(root, `${rollbackName}.publication.json`);
  const spec = Buffer.from(
    JSON.stringify({
      root,
      rootDevice: rootIdentity.device,
      rootInode: rootIdentity.inode,
      rootMutexName: `Local\\lego-page44-calibration-${canonicalDigest({
        device: rootIdentity.device,
        inode: rootIdentity.inode,
      }).slice(7)}`,
      rootMutexTimeoutMilliseconds:
        import.meta.env?.MODE === "test" ? 60_000 : ROOT_MUTEX_TIMEOUT_MS,
      ownerPid: process.pid,
      testMode: import.meta.env?.MODE === "test",
      stagingName,
      rollbackName,
      intentName,
      markerName: basename(finalPublicationMarkerPath),
      retainedMarkerName: basename(retainedPublicationMarkerPath),
      finalName: basename(finalOutputPath),
      transactionTimeoutMilliseconds: TRANSACTION_TIMEOUT_MS,
    }),
  ).toString("base64");
  const provisional = startRealBuildPrefix50Step44CalibrationDirectoryHelper(spec, root);
  try {
    const ready = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(provisional);
    const match = /^READY\t(\d+)\t(\d+)\t(\d+)\t(\d+)$/u.exec(ready);
    if (match === null)
      throw new Error(`Calibration directory helper returned ${JSON.stringify(ready)}.`);
    await __testHooks?.afterReady?.(stagingOutputPath);
    const stagingIdentity = await captureRealBuildPrefix50Step44ClaimedDirectoryIdentity(
      stagingOutputPath,
      root,
    );
    if (
      rootIdentity.device !== match[1] ||
      rootIdentity.inode !== match[2] ||
      stagingIdentity.device !== match[3] ||
      stagingIdentity.inode !== match[4]
    )
      throw new Error(
        "Calibration helper identity differs from its exact reopened staging directory.",
      );
    const transaction = Object.freeze({
      stagingOutputPath,
      finalOutputPath,
      stagingPublicationMarkerPath,
      finalPublicationMarkerPath,
      retainedPublicationMarkerPath,
    });
    transactions.set(transaction, {
      ...provisional,
      rootIdentity,
      stagingIdentity,
      operation: null,
      phase: "staging",
    });
    return transaction;
  } catch (error) {
    try {
      provisional.child.stdin?.end("DISCARD\n");
      let line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(provisional);
      if (/^READY\t/u.test(line))
        line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(provisional);
      if (line !== "DISCARDED")
        throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`, {
          cause: error,
        });
      await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(provisional);
    } catch (cleanupError) {
      await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(provisional);
      throw new AggregateError(
        [error, cleanupError],
        `Calibration startup failed and exact-handle disposal of ${stagingOutputPath} could not be proved.`,
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

export function requireRealBuildPrefix50Step44CalibrationDirectoryTransaction(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
): RealBuildPrefix50Step44CalibrationDirectoryTransaction {
  requireState(transaction);
  return transaction;
}

export function prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  physicalPath: string,
): string {
  requireState(transaction);
  const stagingRealpath = realpathSync.native(transaction.stagingOutputPath);
  const physicalRealpath = realpathSync.native(physicalPath);
  const child = relative(stagingRealpath, physicalRealpath);
  if (child.startsWith("..") || isAbsolute(child))
    throw new TypeError("Calibration proof path escaped its live private staging transaction.");
  return child === "" ? transaction.finalOutputPath : resolve(transaction.finalOutputPath, child);
}

export async function assertRealBuildPrefix50Step44CalibrationStagingIdentity(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
): Promise<RealBuildPrefix50Step44ClaimedDirectoryIdentity> {
  const state = requireState(transaction);
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(state.stagingIdentity);
  return state.stagingIdentity;
}

export async function commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  publicationProof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
): Promise<RealBuildPrefix50Step44ClaimedDirectoryIdentity> {
  const state = requireState(transaction);
  if (state.phase !== "staging" || state.operation !== null)
    throw new TypeError("Calibration directory transaction was already reserved.");
  state.operation = "commit";
  try {
    const descriptor = await reassertPublicationProof(transaction, publicationProof, false);
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(state.stagingIdentity);
    state.preparedTreeRosterCommitment = captureTreeRosterCommitment(transaction.stagingOutputPath);
    const { bytes } = createRealBuildPrefix50Step44CalibrationPublicationMarker({
      finalOutputPath: transaction.finalOutputPath,
      stagingIdentity: state.stagingIdentity,
      descriptor,
    });
    state.descriptor = descriptor;
    state.markerBytes = bytes;
    state.child.stdin!.write(`PREPARE\t${bytes.toString("base64")}\n`);
    let line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
    if (line === "WAITING_ROOT_MUTEX") {
      state.rootMutexWaitObserver?.();
      delete state.rootMutexWaitObserver;
      line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
    }
    if (line !== "PREPARED")
      throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
    state.phase = "prepared";
    readExactMarkerBytes(
      dirname(transaction.finalOutputPath),
      transaction.stagingPublicationMarkerPath,
      bytes,
    );
    const reservedDescriptor = await reassertPublicationProof(transaction, publicationProof, false);
    assertSameDescriptor(descriptor, reservedDescriptor);
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(state.stagingIdentity);
    state.publicationProof = publicationProof;
    return state.stagingIdentity;
  } catch (error) {
    if (state.phase === "prepared") {
      try {
        state.child.stdin!.write("ROLLBACK\n");
        await acceptRetained(state, transaction, "ROLLED_BACK");
      } catch (rollbackError) {
        await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(state).catch(() => undefined);
        state.phase = "closed";
        throw new AggregateError(
          [error, rollbackError],
          "Calibration TxF reservation and exact-identity rollback both failed.",
          { cause: rollbackError },
        );
      }
    } else {
      await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(state).catch(() => undefined);
      state.phase = "closed";
      const retained = exactRealBuildPrefix50Step44PublishedDirectoryIdentity(
        state,
        transaction.stagingOutputPath,
      );
      if (retained !== undefined) state.retainedOutputPath = retained.lexicalPath;
    }
    throw error;
  } finally {
    state.operation = null;
  }
}

export async function finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  publicationProof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  __testHooks?: FinalizeTransactionTestHooks,
): Promise<RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication> {
  if (__testHooks !== undefined && import.meta.env.MODE !== "test")
    throw new TypeError("Calibration transaction lifecycle hooks are available only to tests.");
  const state = requireState(transaction);
  if (
    state.phase !== "prepared" ||
    state.publicationProof !== publicationProof ||
    state.descriptor === undefined ||
    state.operation !== null
  )
    throw new TypeError("Calibration directory finalization requires its pending reservation.");
  state.operation = "finalize";
  try {
    const preparedDescriptor = await reassertPublicationProof(transaction, publicationProof, false);
    assertSameDescriptor(state.descriptor, preparedDescriptor);
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(state.stagingIdentity);
    const pause = __testHooks?.afterPublishBeforeGuard !== undefined;
    state.phase = "publishing";
    state.child.stdin!.write(`${pause ? "PUBLISH_PAUSE" : "PUBLISH"}\n`);
    if (pause) {
      const committed = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
      if (committed !== "COMMITTED_UNGUARDED")
        throw new Error(`Calibration directory helper returned ${JSON.stringify(committed)}.`);
      await __testHooks.afterPublishBeforeGuard!();
      state.child.stdin!.write("CONTINUE_GUARD\n");
    }
    const guarded = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
    if (guarded !== "GUARDED")
      throw new Error(`Calibration directory helper returned ${JSON.stringify(guarded)}.`);
    state.phase = "guarded";
    const finalIdentity = exactRealBuildPrefix50Step44PublishedDirectoryIdentity(
      state,
      transaction.finalOutputPath,
    );
    if (finalIdentity === undefined) {
      await releaseForeignGuard(state);
      throw new TypeError("Calibration final path was replaced before its TxF guard was acquired.");
    }
    state.publishedIdentity = finalIdentity;
    requireRealBuildPrefix50Step44CalibrationPublicationMarker({
      finalOutputPath: transaction.finalOutputPath,
      expectedDirectoryIdentity: finalIdentity,
      expectedDescriptor: state.descriptor,
    });
    const finalDescriptor = await reassertPublicationProof(transaction, publicationProof, true);
    assertSameDescriptor(state.descriptor, finalDescriptor);
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(finalIdentity);
    await __testHooks?.afterGuardBeforeReceipt?.();
    state.lockedRosterCommitment = await lockGuardRoster(state, transaction);
    await reassertGuardedAuthority({
      state,
      transaction,
      publicationProof,
      identity: finalIdentity,
      descriptor: state.descriptor,
      expectedFinalOutputPath: transaction.finalOutputPath,
    });
    const receipt = Object.freeze({ finalOutputPath: transaction.finalOutputPath });
    committedPublications.set(receipt, {
      state,
      transaction,
      identity: finalIdentity,
      descriptor: state.descriptor,
    });
    return receipt;
  } catch (error) {
    if (state.phase === "guarded") {
      try {
        if (
          !(await isExactGuardedPublication({
            state,
            transaction,
            publicationProof,
            descriptor: state.descriptor!,
          }))
        )
          await releaseForeignGuard(state);
        else {
          state.child.stdin!.write("RETAIN\n");
          await acceptRetained(state, transaction, "RETAINED");
        }
      } catch (rollbackError) {
        await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(state).catch(() => undefined);
        state.phase = "closed";
        throw new AggregateError(
          [error, rollbackError],
          "Calibration guarded publication and exact-identity retention both failed.",
          { cause: rollbackError },
        );
      }
    } else if (state.phase === "publishing") {
      await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(state).catch(() => undefined);
      state.phase = "closed";
    }
    throw error;
  } finally {
    state.operation = null;
  }
}

export async function requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
  publication: RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  expectedFinalOutputPath: string,
): Promise<RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication> {
  const committed = committedPublications.get(publication);
  const path = resolve(expectedFinalOutputPath);
  if (
    committed === undefined ||
    committed.state.phase !== "guarded" ||
    committed.state.operation !== null ||
    publication.finalOutputPath !== path ||
    committed.state.publicationProof === undefined
  )
    throw new TypeError(
      "Calibration qualification requires its live TxF-guarded final-directory capability.",
    );
  committed.state.operation = "reassert";
  try {
    await reassertGuardedAuthority({
      state: committed.state,
      transaction: committed.transaction,
      publicationProof: committed.state.publicationProof,
      identity: committed.identity,
      descriptor: committed.descriptor,
      expectedFinalOutputPath: path,
    });
    return publication;
  } finally {
    committed.state.operation = null;
  }
}

export async function completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
  publication: RealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
): Promise<void> {
  const committed = committedPublications.get(publication);
  if (committed === undefined || committed.state.phase !== "guarded")
    throw new TypeError("Calibration publication completion requires its live guarded receipt.");
  const state = committed.state;
  if (state.operation !== null || state.publicationProof === undefined)
    throw new TypeError("Calibration directory transaction has an in-flight operation.");
  state.operation = "complete";
  try {
    await reassertGuardedAuthority({
      state,
      transaction: committed.transaction,
      publicationProof: state.publicationProof,
      identity: committed.identity,
      descriptor: committed.descriptor,
      expectedFinalOutputPath: publication.finalOutputPath,
    });
    state.child.stdin!.end("ACCEPT\n");
    const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
    if (line !== "FINALIZED")
      throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
    await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(state);
    state.phase = "closed";
    committedPublications.delete(publication);
  } catch (error) {
    committedPublications.delete(publication);
    await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(state).catch(() => undefined);
    state.phase = "closed";
    throw error;
  } finally {
    state.operation = null;
  }
}

export const realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly =
  createRealBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly(requireState);

export async function abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction(
  transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction,
): Promise<string | null> {
  const state = transactions.get(transaction);
  if (state === undefined || state.phase === "closed") return state?.retainedOutputPath ?? null;
  if (state.operation !== null)
    throw new TypeError(
      "Calibration directory transaction has an in-flight publication operation.",
    );
  try {
    if (state.phase === "prepared") {
      state.child.stdin!.write("ROLLBACK\n");
      return await acceptRetained(state, transaction, "ROLLED_BACK");
    }
    if (state.phase === "guarded") {
      if (
        state.publicationProof === undefined ||
        state.descriptor === undefined ||
        !(await isExactGuardedPublication({
          state,
          transaction,
          publicationProof: state.publicationProof,
          descriptor: state.descriptor,
        }))
      ) {
        await releaseForeignGuard(state);
        return null;
      }
      state.child.stdin!.write("RETAIN\n");
      return await acceptRetained(state, transaction, "RETAINED");
    }
    if (state.phase !== "staging") return null;
    state.child.stdin!.end("ABANDON\n");
    const line = await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(state);
    if (line !== "ABANDONED")
      throw new Error(`Calibration directory helper returned ${JSON.stringify(line)}.`);
    await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(state);
    state.phase = "closed";
    const retained = exactRealBuildPrefix50Step44PublishedDirectoryIdentity(
      state,
      transaction.stagingOutputPath,
    );
    if (retained !== undefined) state.retainedOutputPath = retained.lexicalPath;
    return retained?.lexicalPath ?? null;
  } catch (error) {
    await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(state).catch(() => undefined);
    state.phase = "closed";
    throw error;
  }
}
