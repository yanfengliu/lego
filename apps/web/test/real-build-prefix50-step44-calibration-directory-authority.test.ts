import {
  access,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  beginRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  commitRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly,
  requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
} from "../e2e/real-build-prefix50-step44-calibration-directory-transaction.ts";
import {
  nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine,
  startRealBuildPrefix50Step44CalibrationDirectoryHelper,
  stopRealBuildPrefix50Step44CalibrationDirectoryHelper,
  waitForRealBuildPrefix50Step44CalibrationDirectoryHelper,
} from "../e2e/real-build-prefix50-step44-calibration-directory-process.ts";
import {
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
} from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";
import { holdWindowsCalibrationAdversarialHandle } from "./real-build-prefix50-step44-calibration-native-handle-test-support.ts";

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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const describeWindowsTxF = process.platform === "win32" ? describe : describe.skip;

describeWindowsTxF("page44 calibration native authority", () => {
  it("rejects an ordinary output-root replacement before creating staging", async () => {
    const parent = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-root-swap-${process.pid}-${Date.now()}`,
    );
    const root = resolve(parent, "root");
    const displaced = resolve(parent, "displaced");
    const stagingName = "staging-must-not-exist";
    taskPaths.push(parent);
    await mkdir(root, { recursive: true });
    const original = await lstat(root, { bigint: true });
    await rename(root, displaced);
    await mkdir(root);
    const spec = Buffer.from(
      JSON.stringify({
        root,
        rootDevice: original.dev.toString(),
        rootInode: original.ino.toString(),
        rootMutexName: `Local\\lego-page44-root-swap-${process.pid}-${Date.now()}`,
        rootMutexTimeoutMilliseconds: 1_000,
        transactionTimeoutMilliseconds: 10_000,
        ownerPid: process.pid,
        stagingName,
        testMode: true,
      }),
      "utf8",
    ).toString("base64");
    const session = startRealBuildPrefix50Step44CalibrationDirectoryHelper(spec, parent);
    try {
      await expect(
        nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(session),
      ).rejects.toThrow(/Prepared calibration output root identity changed/u);
    } finally {
      if (session.child.exitCode === null && session.child.signalCode === null)
        await stopRealBuildPrefix50Step44CalibrationDirectoryHelper(session);
    }
    expect(await exists(resolve(root, stagingName))).toBe(false);
    expect(await exists(resolve(displaced, stagingName))).toBe(false);
  });

  it("holds the exact prepared root against replacement for the helper lifetime", async () => {
    const parent = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-root-hold-${process.pid}-${Date.now()}`,
    );
    const root = resolve(parent, "root");
    const displaced = resolve(parent, "displaced");
    taskPaths.push(parent);
    await mkdir(root, { recursive: true });
    const identity = await lstat(root, { bigint: true });
    const spec = Buffer.from(
      JSON.stringify({
        root,
        rootDevice: identity.dev.toString(),
        rootInode: identity.ino.toString(),
        rootMutexName: `Local\\lego-page44-root-hold-${process.pid}-${Date.now()}`,
        rootMutexTimeoutMilliseconds: 1_000,
        transactionTimeoutMilliseconds: 10_000,
        ownerPid: process.pid,
        stagingName: "held-staging",
        testMode: true,
      }),
      "utf8",
    ).toString("base64");
    const session = startRealBuildPrefix50Step44CalibrationDirectoryHelper(spec, parent);
    expect(await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(session)).toMatch(
      /^READY\t/u,
    );
    await expect(rename(root, displaced)).rejects.toMatchObject({
      code: expect.stringMatching(/^(?:EACCES|EBUSY|EPERM|UNKNOWN)$/u),
    });
    session.child.stdin!.end("DISCARD\n");
    expect(await nextRealBuildPrefix50Step44CalibrationDirectoryHelperLine(session)).toBe(
      "DISCARDED",
    );
    await waitForRealBuildPrefix50Step44CalibrationDirectoryHelper(session);
    expect(await exists(resolve(root, "held-staging"))).toBe(false);
  });

  it("rejects a rolled-back native guard while its helper process remains live", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-native-liveness-${process.pid}-${Date.now()}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    const receipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    expect(
      await realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.forceGuardRollback(
        transaction,
      ),
    ).toBe(true);
    await expect(
      requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt, finalPath),
    ).rejects.toThrow(/active native TxF transaction/u);
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
    await realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.closeProtocolPipe(
      transaction,
    );
    await writeFile(resolve(finalPath, "after-rollback.bin"), "unlocked");
    expect(await exists(resolve(finalPath, "after-rollback.bin"))).toBe(true);
  });

  it("holds every default stream and marker through repeated receipt reassertions", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-held-roster-${process.pid}-${Date.now()}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    const receipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    for (const path of [
      resolve(finalPath, "complete.bin"),
      transaction.finalPublicationMarkerPath,
    ]) {
      const error = await open(path, "r+").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect((error as NodeJS.ErrnoException).code).toMatch(/^(?:EACCES|EBUSY|EPERM|UNKNOWN)$/u);
    }
    expect(
      await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
        receipt,
        finalPath,
      ),
    ).toBe(receipt);
    expect(
      await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
        receipt,
        finalPath,
      ),
    ).toBe(receipt);
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt);
    await writeFile(resolve(finalPath, "complete.bin"), "released");
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("released");
  });

  it("rejects a writable default-stream handle opened before guard acquisition", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-preopen-writer-${process.pid}-${Date.now()}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    let writer: Awaited<ReturnType<typeof open>> | undefined;
    try {
      await expect(
        finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
          transaction,
          publicationProof,
          {
            async afterPublishBeforeGuard() {
              writer = await open(resolve(finalPath, "complete.bin"), "r+");
            },
          },
        ),
      ).rejects.toThrow(/roster protection|helper exited|retention/iu);
    } finally {
      await writer?.close();
    }
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
  });

  it("rejects a writable publication-marker handle opened before guard acquisition", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-preopen-marker-${process.pid}-${Date.now()}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    let writer: Awaited<ReturnType<typeof open>> | undefined;
    try {
      await expect(
        finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
          transaction,
          publicationProof,
          {
            async afterPublishBeforeGuard() {
              writer = await open(transaction.finalPublicationMarkerPath, "r+");
            },
          },
        ),
      ).rejects.toThrow(/roster protection|helper exited|retention/iu);
    } finally {
      await writer?.close();
    }
    expect(await exists(transaction.finalPublicationMarkerPath)).toBe(true);
  });

  it("rejects a pre-guard hardlink and leaves both actor-visible names in place", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-preopen-hardlink-${process.pid}-${Date.now()}`,
    );
    const hardlinkPath = `${finalPath}-foreign-hardlink.bin`;
    taskPaths.push(hardlinkPath);
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    await expect(
      finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
        transaction,
        publicationProof,
        {
          async afterPublishBeforeGuard() {
            await link(resolve(finalPath, "complete.bin"), hardlinkPath);
          },
        },
      ),
    ).rejects.toThrow(/singly linked/u);
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
    expect(await readFile(hardlinkPath, "utf8")).toBe("complete");
  });

  it("rejects a writable directory handle opened before guard acquisition", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-preopen-directory-${process.pid}-${Date.now()}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    let holder: Awaited<ReturnType<typeof holdWindowsCalibrationAdversarialHandle>> | undefined;
    try {
      await expect(
        finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
          transaction,
          publicationProof,
          {
            async afterPublishBeforeGuard() {
              holder = await holdWindowsCalibrationAdversarialHandle("directory", finalPath);
            },
          },
        ),
      ).rejects.toThrow(/guard|helper exited|reservation|retention/iu);
    } finally {
      await holder?.release();
    }
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
  });

  it("rejects a writable mapping whose source handle closed before guard acquisition", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-preopen-mapping-${process.pid}-${Date.now()}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const publicationProof = proof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
    );
    let holder: Awaited<ReturnType<typeof holdWindowsCalibrationAdversarialHandle>> | undefined;
    const outcome = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      publicationProof,
      {
        async afterPublishBeforeGuard() {
          holder = await holdWindowsCalibrationAdversarialHandle(
            "mapping",
            resolve(finalPath, "complete.bin"),
          );
        },
      },
    ).then(
      (receipt) => ({ receipt }),
      (error: unknown) => ({ error }),
    );
    if ("receipt" in outcome) {
      const mutation = await holder!.mutate().then(
        () => "mapping remained writable",
        (error: unknown) => `mapping mutation rejected: ${String(error)}`,
      );
      await realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.closeProtocolPipe(
        transaction,
      );
      await holder!.release();
      throw new Error(`Native guard accepted a pre-existing writable mapping: ${mutation}.`);
    }
    await holder!.release();
    expect(outcome.error).toBeInstanceOf(Error);
    expect(String(outcome.error)).toMatch(/guard|helper exited|roster protection|retention/iu);
  });
});
