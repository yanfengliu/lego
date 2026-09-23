import { resolve } from "node:path";

import {
  assertSameRealBuildPrefix50Step44CalibrationPublicationDescriptor as assertSameDescriptor,
  requireRealBuildPrefix50Step44CalibrationPublicationMarker,
  type RealBuildPrefix50Step44CalibrationPublicationDescriptor,
} from "./real-build-prefix50-step44-calibration-publication-marker.ts";
import { reassertRealBuildPrefix50Step44CalibrationPublicationProof as reassertPublicationProof } from "./real-build-prefix50-step44-calibration-publication-proof-loader.ts";
import {
  captureRealBuildPrefix50Step44CalibrationGuardRosterCommitment,
  captureRealBuildPrefix50Step44CalibrationTreeRosterCommitment,
  reassertRealBuildPrefix50Step44CalibrationNativeGuardActive,
} from "./real-build-prefix50-step44-calibration-directory-protocol.ts";
import {
  exactRealBuildPrefix50Step44PublishedDirectoryIdentity,
  type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
  type RealBuildPrefix50Step44CalibrationDirectoryTransaction,
  type RealBuildPrefix50Step44CalibrationDirectoryTransactionState,
} from "./real-build-prefix50-step44-calibration-directory-state.ts";
import {
  assertRealBuildPrefix50Step44ClaimedDirectoryIdentity,
  type RealBuildPrefix50Step44ClaimedDirectoryIdentity,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

interface GuardedAuthorityInput {
  readonly state: RealBuildPrefix50Step44CalibrationDirectoryTransactionState;
  readonly transaction: RealBuildPrefix50Step44CalibrationDirectoryTransaction;
  readonly publicationProof: RealBuildPrefix50Step44CalibrationDirectoryPublicationProof;
  readonly identity: RealBuildPrefix50Step44ClaimedDirectoryIdentity;
  readonly descriptor: RealBuildPrefix50Step44CalibrationPublicationDescriptor;
  readonly expectedFinalOutputPath: string;
}

export async function reassertRealBuildPrefix50Step44GuardedCalibrationAuthority(
  input: GuardedAuthorityInput,
): Promise<void> {
  const path = resolve(input.expectedFinalOutputPath);
  const current = exactRealBuildPrefix50Step44PublishedDirectoryIdentity(input.state, path);
  if (
    input.state.phase !== "guarded" ||
    input.state.child.exitCode !== null ||
    input.state.child.signalCode !== null ||
    path !== input.transaction.finalOutputPath ||
    current?.device !== input.identity.device ||
    current?.inode !== input.identity.inode ||
    input.state.preparedTreeRosterCommitment === undefined ||
    input.state.lockedRosterCommitment === undefined
  )
    throw new TypeError(
      "Calibration qualification requires its live TxF-guarded final-directory capability.",
    );
  await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(input.state.rootIdentity);
  requireRealBuildPrefix50Step44CalibrationPublicationMarker({
    finalOutputPath: path,
    expectedDirectoryIdentity: input.identity,
    expectedDescriptor: input.descriptor,
  });
  const observed = await reassertPublicationProof(input.transaction, input.publicationProof, true);
  assertSameDescriptor(input.descriptor, observed);
  if (
    captureRealBuildPrefix50Step44CalibrationTreeRosterCommitment(path) !==
    input.state.preparedTreeRosterCommitment
  )
    throw new TypeError("Calibration final tree differs from its prepared exact roster.");
  if (
    captureRealBuildPrefix50Step44CalibrationGuardRosterCommitment(input.transaction) !==
    input.state.lockedRosterCommitment
  )
    throw new TypeError("Calibration native guard roster changed after its exact lock.");
  await reassertRealBuildPrefix50Step44CalibrationNativeGuardActive(input.state);
}

export async function isExactRealBuildPrefix50Step44GuardedCalibrationPublication(
  input: Omit<GuardedAuthorityInput, "identity" | "expectedFinalOutputPath">,
): Promise<boolean> {
  const identity = exactRealBuildPrefix50Step44PublishedDirectoryIdentity(
    input.state,
    input.transaction.finalOutputPath,
  );
  if (identity === undefined || input.state.preparedTreeRosterCommitment === undefined)
    return false;
  try {
    await assertRealBuildPrefix50Step44ClaimedDirectoryIdentity(input.state.rootIdentity);
    requireRealBuildPrefix50Step44CalibrationPublicationMarker({
      finalOutputPath: input.transaction.finalOutputPath,
      expectedDirectoryIdentity: identity,
      expectedDescriptor: input.descriptor,
    });
    const observed = await reassertPublicationProof(
      input.transaction,
      input.publicationProof,
      true,
    );
    assertSameDescriptor(input.descriptor, observed);
    if (
      captureRealBuildPrefix50Step44CalibrationTreeRosterCommitment(
        input.transaction.finalOutputPath,
      ) !== input.state.preparedTreeRosterCommitment
    )
      return false;
    const roster = captureRealBuildPrefix50Step44CalibrationGuardRosterCommitment(
      input.transaction,
    );
    if (
      input.state.lockedRosterCommitment !== undefined &&
      roster !== input.state.lockedRosterCommitment
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
