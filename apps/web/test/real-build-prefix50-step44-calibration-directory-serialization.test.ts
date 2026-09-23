import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  beginRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  commitRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly,
  requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
} from "../e2e/real-build-prefix50-step44-calibration-directory-transaction.ts";
import {
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
} from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const proofBrands = vi.hoisted(() => new WeakSet<object>());
vi.mock("../e2e/real-build-prefix50-step44-calibration-publication-proof.ts", () => ({
  reassertRealBuildPrefix50Step44CalibrationDirectoryPublicationProof(input: {
    publicationProof: { proof: object };
  }) {
    if (!proofBrands.has(input.publicationProof.proof)) throw new TypeError("unbranded proof");
    return Object.freeze({
      evidenceStatus: "qualified-and-validated",
      persistedCaseCount: 3,
      proofCommitment: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      persistedManifestCommitment:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      evidenceTreeCommitment:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });
  },
}));

const taskPaths: string[] = [];
afterAll(async () => {
  for (const path of taskPaths) await rm(path, { recursive: true, force: true });
});

function proof(): RealBuildPrefix50Step44CalibrationDirectoryPublicationProof {
  const value = Object.freeze({});
  proofBrands.add(value);
  return Object.freeze({
    kind: "qualification",
    proof: value,
    calibrationSession: Object.freeze({}),
  }) as unknown as RealBuildPrefix50Step44CalibrationDirectoryPublicationProof;
}

async function begin(finalPath: string) {
  const publication = await prepareRealBuildPrefix50Step44ReviewOutputPublication(finalPath);
  const transaction =
    await beginRealBuildPrefix50Step44CalibrationDirectoryTransaction(publication);
  taskPaths.push(
    transaction.stagingOutputPath,
    transaction.finalOutputPath,
    transaction.finalPublicationMarkerPath,
    transaction.stagingPublicationMarkerPath,
    transaction.retainedPublicationMarkerPath,
  );
  return transaction;
}

function observeMutexWait(transaction: Awaited<ReturnType<typeof begin>>): Promise<void> {
  return new Promise<void>((resolveWaiting) => {
    realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.observeRootMutexWait(
      transaction,
      resolveWaiting,
    );
  });
}

const describeWindowsTxF = process.platform === "win32" ? describe : describe.skip;

describeWindowsTxF("page44 calibration root serialization", () => {
  it("holds a second helper at its exact mutex acquisition point until completion", async () => {
    const prefix = `calibration-concurrent-root-${process.pid}-${Date.now()}`;
    const paths = ["a", "b"].map((label) =>
      resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `${prefix}-${label}`),
    );
    const transactions = await Promise.all(paths.map((path) => begin(path)));
    const proofs = transactions.map(() => proof());
    await Promise.all(
      transactions.map((transaction, index) =>
        writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), `tree-${index}`),
      ),
    );
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[0]!,
      proofs[0]!,
    );
    const secondWaiting = observeMutexWait(transactions[1]!);
    let secondReserved = false;
    const secondReservation = commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[1]!,
      proofs[1]!,
    ).then(() => {
      secondReserved = true;
    });
    await secondWaiting;
    expect(secondReserved).toBe(false);
    const firstReceipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[0]!,
      proofs[0]!,
    );
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(firstReceipt);
    await secondReservation;
    const secondReceipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[1]!,
      proofs[1]!,
    );
    expect(
      await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
        secondReceipt,
        paths[1]!,
      ),
    ).toBe(secondReceipt);
    expect(
      await Promise.all(paths.map((path) => readFile(resolve(path, "complete.bin"), "utf8"))),
    ).toEqual(["tree-0", "tree-1"]);
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(secondReceipt);
  });

  it("releases the mutex after exceptional owner-pipe cleanup so a waiter can publish", async () => {
    const prefix = `calibration-abandoned-owner-${process.pid}-${Date.now()}`;
    const paths = ["old", "next"].map((label) =>
      resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `${prefix}-${label}`),
    );
    const transactions = await Promise.all(paths.map((path) => begin(path)));
    const proofs = transactions.map(() => proof());
    await Promise.all(
      transactions.map((transaction, index) =>
        writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), `owner-${index}`),
      ),
    );
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[0]!,
      proofs[0]!,
    );
    const abandonedReceipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[0]!,
      proofs[0]!,
    );
    const secondWaiting = observeMutexWait(transactions[1]!);
    const secondReservation = commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[1]!,
      proofs[1]!,
    );
    await secondWaiting;
    await realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.injectProtectedCloseFailure(
      transactions[0]!,
    );
    await expect(
      realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.closeProtocolPipe(
        transactions[0]!,
      ),
    ).rejects.toThrow(/Injected calibration native-close failure/u);
    await secondReservation;
    await expect(
      requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
        abandonedReceipt,
        paths[0]!,
      ),
    ).rejects.toThrow(/live TxF-guarded/u);
    await writeFile(resolve(paths[0]!, "after-owner-exit.bin"), "unlocked");
    const secondReceipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transactions[1]!,
      proofs[1]!,
    );
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(secondReceipt);
    expect(await readFile(resolve(paths[1]!, "complete.bin"), "utf8")).toBe("owner-1");
  });
});
