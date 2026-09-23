import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  beginRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  commitRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction,
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath,
  realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly,
  requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication,
  type RealBuildPrefix50Step44CalibrationDirectoryPublicationProof,
} from "../e2e/real-build-prefix50-step44-calibration-directory-transaction.ts";
import * as directoryStateExports from "../e2e/real-build-prefix50-step44-calibration-directory-state.ts";
import {
  claimRealBuildPrefix50Step44ReviewOutputPublication,
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
} from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const suffix = `${process.pid}-${Date.now()}`;
const taskPaths: string[] = [];
const gateProofBrands = vi.hoisted(() => new WeakSet<object>());

vi.mock("../e2e/real-build-prefix50-step44-calibration-publication-proof.ts", () => ({
  reassertRealBuildPrefix50Step44CalibrationDirectoryPublicationProof(input: {
    publicationProof: { proof: object };
    final: boolean;
  }) {
    if (!gateProofBrands.has(input.publicationProof.proof))
      throw new TypeError("Calibration publication requires its exact verified gate proof.");
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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function publicationProof(): RealBuildPrefix50Step44CalibrationDirectoryPublicationProof {
  const proof = Object.freeze({});
  gateProofBrands.add(proof);
  return Object.freeze({
    kind: "qualification",
    proof,
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
    transaction.stagingPublicationMarkerPath,
    transaction.finalPublicationMarkerPath,
    transaction.retainedPublicationMarkerPath,
  );
  return transaction;
}

afterAll(async () => {
  for (const path of taskPaths) await rm(path, { recursive: true, force: true });
});

const describeWindowsTxF = process.platform === "win32" ? describe : describe.skip;

if (process.platform !== "win32")
  describe("page44 calibration directory transaction platform gate", () => {
    it("fails closed without requiring TxF in ordinary cross-platform unit discovery", async () => {
      await expect(
        beginRealBuildPrefix50Step44CalibrationDirectoryTransaction(Object.freeze({}) as never),
      ).rejects.toThrow("requires Windows TxF");
    });
  });

describeWindowsTxF("page44 calibration directory transaction", () => {
  it("holds the exact private staging identity and abandons without a final path", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-abandon-${suffix}`,
    );
    const transaction = await begin(finalPath);
    const displaced = `${transaction.stagingOutputPath}-displaced`;
    await writeFile(resolve(transaction.stagingOutputPath, "partial.bin"), "partial");
    await expect(rename(transaction.stagingOutputPath, displaced)).rejects.toMatchObject({
      code: expect.stringMatching(/^(?:EACCES|EBUSY|EPERM)$/u),
    });
    await abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction);
    expect(await exists(finalPath)).toBe(false);
    expect(await readFile(resolve(transaction.stagingOutputPath, "partial.bin"), "utf8")).toBe(
      "partial",
    );
    await rename(transaction.stagingOutputPath, displaced);
    await rename(displaced, transaction.stagingOutputPath);
  });

  it("rejects caller-shaped publication objects before creating any directory", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-forged-${suffix}`,
    );
    taskPaths.push(finalPath);
    await expect(
      beginRealBuildPrefix50Step44CalibrationDirectoryTransaction({
        outputPath: finalPath,
      } as never),
    ).rejects.toThrow(/opaque prepared direct-child capability/u);
    await expect(
      claimRealBuildPrefix50Step44ReviewOutputPublication({ outputPath: finalPath } as never),
    ).rejects.toThrow(/opaque prepared direct-child capability/u);
    expect(await exists(finalPath)).toBe(false);
    expect(directoryStateExports).not.toHaveProperty(
      "realBuildPrefix50Step44CalibrationDirectoryTransactions",
    );
    expect(directoryStateExports).not.toHaveProperty(
      "realBuildPrefix50Step44CommittedCalibrationDirectories",
    );
  });

  it("disposes the exact empty staging identity after an injected post-READY failure", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-ready-failure-${suffix}`,
    );
    const publication = await prepareRealBuildPrefix50Step44ReviewOutputPublication(finalPath);
    let stagingPath: string | undefined;
    await expect(
      beginRealBuildPrefix50Step44CalibrationDirectoryTransaction(publication, {
        afterReady(path) {
          stagingPath = path;
          throw new Error("injected post-READY identity failure");
        },
      }),
    ).rejects.toThrow(/injected post-READY/u);
    expect(stagingPath).toBeDefined();
    expect(await exists(stagingPath!)).toBe(false);
    expect(await exists(finalPath)).toBe(false);
  });

  it("rejects an unverified direct commit route and leaves partial bytes private", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-unverified-commit-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "partial.bin"), "unverified");
    await expect(
      commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, {
        kind: "qualification",
        proof: Object.freeze({}),
        calibrationSession: Object.freeze({}),
      } as never),
    ).rejects.toThrow(/exact verified gate proof/u);
    expect(await exists(finalPath)).toBe(false);
    await abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction);
    expect(await readFile(resolve(transaction.stagingOutputPath, "partial.bin"), "utf8")).toBe(
      "unverified",
    );
  });

  it("publishes the complete staging directory through its exact held handle", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-commit-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    expect(
      prospectiveRealBuildPrefix50Step44CalibrationFinalPath(
        transaction,
        resolve(transaction.stagingOutputPath, "complete.bin"),
      ),
    ).toBe(resolve(finalPath, "complete.bin"));
    const proof = publicationProof();
    const finalIdentity = await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      proof,
    );
    expect(finalIdentity.lexicalPath).toBe(transaction.stagingOutputPath);
    expect(await exists(transaction.stagingOutputPath)).toBe(true);
    expect(await exists(finalPath)).toBe(false);
    expect(await exists(transaction.finalPublicationMarkerPath)).toBe(false);
    const receipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      proof,
    );
    expect(
      await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
        receipt,
        finalPath,
      ),
    ).toBe(receipt);
    expect(await exists(transaction.stagingOutputPath)).toBe(false);
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
    const displaced = `${finalPath}-displaced`;
    taskPaths.push(displaced);
    await expect(rename(finalPath, displaced)).rejects.toMatchObject({
      code: expect.stringMatching(/^(?:EACCES|EBUSY|EPERM|UNKNOWN)$/u),
    });
    const completion =
      completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt);
    await expect(
      requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt, finalPath),
    ).rejects.toThrow(/live TxF-guarded/u);
    await completion;
    await expect(
      requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt, finalPath),
    ).rejects.toThrow(/live TxF-guarded/u);
    await rename(finalPath, displaced);
    await rename(displaced, finalPath);
    expect(() =>
      prospectiveRealBuildPrefix50Step44CalibrationFinalPath(transaction, finalPath),
    ).toThrow(/live opaque directory transaction/u);
  });

  it("leaves a foreign gap child at the original final path and mints no receipt", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-finalize-cleanup-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const proof = publicationProof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof);
    await expect(
      finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof, {
        async afterPublishBeforeGuard() {
          await writeFile(resolve(finalPath, "foreign.bin"), "foreign gap child");
        },
      }),
    ).rejects.toThrow(/prepared exact roster/u);
    const retainedPath = transaction.retainedPublicationMarkerPath.replace(
      /\.publication\.json$/u,
      "",
    );
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
    expect(await readFile(resolve(finalPath, "foreign.bin"), "utf8")).toBe("foreign gap child");
    expect(await exists(transaction.finalPublicationMarkerPath)).toBe(true);
    expect(await exists(retainedPath)).toBe(false);
    expect(await exists(transaction.retainedPublicationMarkerPath)).toBe(false);
    expect(await abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction)).toBe(
      null,
    );
  });

  it("holds a real TxF guard against default, new-file, ADS, and directory mutations", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-txf-guard-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const proof = publicationProof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof);
    let attempted = 0;
    const displaced = `${finalPath}-displaced`;
    taskPaths.push(displaced);
    const receipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      proof,
      {
        async afterGuardBeforeReceipt() {
          for (const mutate of [
            () => writeFile(resolve(finalPath, "complete.bin"), "corrupt!"),
            () => writeFile(resolve(finalPath, "new.bin"), "new"),
            () => writeFile(`${resolve(finalPath, "complete.bin")}:foreign`, "ads"),
            () => rename(finalPath, displaced),
          ]) {
            attempted += 1;
            const error = await mutate().catch((caught: unknown) => caught);
            expect(error).toBeInstanceOf(Error);
            expect((error as NodeJS.ErrnoException).code).toMatch(
              /^(?:EACCES|EBUSY|EPERM|UNKNOWN)$/u,
            );
          }
        },
      },
    );
    expect(attempted).toBe(4);
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
    expect(await exists(resolve(finalPath, "new.bin"))).toBe(false);
    expect(await exists(`${resolve(finalPath, "complete.bin")}:foreign`)).toBe(false);
    expect(await exists(displaced)).toBe(false);
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt);
  });

  it("rolls the non-expiring live guard back when its protocol pipe closes", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-guard-pipe-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const proof = publicationProof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof);
    const receipt = await finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(
      transaction,
      proof,
    );
    await realBuildPrefix50Step44CalibrationDirectoryTransactionTestOnly!.closeProtocolPipe(
      transaction,
    );
    await expect(
      requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipt, finalPath),
    ).rejects.toThrow(/live TxF-guarded/u);
    await writeFile(resolve(finalPath, "after-pipe.bin"), "guard rolled back");
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
  });

  it("serializes concurrent commit and finalize calls without protocol interleaving", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-concurrent-lifecycle-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "complete.bin"), "complete");
    const proof = publicationProof();
    const commits = await Promise.allSettled([
      commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof),
      commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof),
    ]);
    expect(commits.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(commits.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const finalizations = await Promise.allSettled([
      finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof),
      finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof),
    ]);
    const receipts = finalizations.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    expect(receipts).toHaveLength(1);
    expect(finalizations.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      await requireRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
        receipts[0]!,
        finalPath,
      ),
    ).toBe(receipts[0]);
    expect(await readFile(resolve(finalPath, "complete.bin"), "utf8")).toBe("complete");
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(receipts[0]!);
  });

  it("atomically refuses a concurrent final claimant and preserves both identities", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-claimant-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "task.bin"), "task");
    await mkdir(finalPath);
    await writeFile(resolve(finalPath, "owner.bin"), "foreign");
    await expect(
      commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, publicationProof()),
    ).rejects.toThrow(/rename|helper|commit|publication|rollback/iu);
    expect(await readFile(resolve(finalPath, "owner.bin"), "utf8")).toBe("foreign");
    expect(await readFile(resolve(transaction.stagingOutputPath, "task.bin"), "utf8")).toBe("task");
  });

  it("rejects a directory replacement in the commit-to-guard gap without moving foreign data", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-rollback-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "proved.bin"), "proved");
    const proof = publicationProof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof);
    const displaced = `${finalPath}-displaced`;
    taskPaths.push(displaced);
    await expect(
      finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof, {
        async afterPublishBeforeGuard() {
          await rename(finalPath, displaced);
          await mkdir(finalPath);
          await writeFile(resolve(finalPath, "owner.bin"), "foreign claimant");
        },
      }),
    ).rejects.toThrow(/replaced before its TxF guard/u);
    expect(await readFile(resolve(finalPath, "owner.bin"), "utf8")).toBe("foreign claimant");
    expect(await readFile(resolve(displaced, "proved.bin"), "utf8")).toBe("proved");
    expect(await abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction)).toBe(
      null,
    );
  });

  it("rejects a marker-only gap replacement without moving either actor-controlled name", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-marker-gap-${suffix}`,
    );
    const transaction = await begin(finalPath);
    await writeFile(resolve(transaction.stagingOutputPath, "proved.bin"), "proved");
    const proof = publicationProof();
    await commitRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof);
    const displacedMarker = `${transaction.finalPublicationMarkerPath}-displaced`;
    taskPaths.push(displacedMarker);
    let genuineMarker: Buffer | undefined;
    await expect(
      finalizeRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction, proof, {
        async afterPublishBeforeGuard() {
          genuineMarker = await readFile(transaction.finalPublicationMarkerPath);
          await rename(transaction.finalPublicationMarkerPath, displacedMarker);
          await writeFile(transaction.finalPublicationMarkerPath, "foreign marker");
        },
      }),
    ).rejects.toThrow(/publication marker|helper exited/iu);
    expect(await readFile(resolve(finalPath, "proved.bin"), "utf8")).toBe("proved");
    expect(await readFile(transaction.finalPublicationMarkerPath, "utf8")).toBe("foreign marker");
    expect(await readFile(displacedMarker)).toEqual(genuineMarker);
    expect(await abandonRealBuildPrefix50Step44CalibrationDirectoryTransaction(transaction)).toBe(
      null,
    );
  });

  it("leaves final absent when the owning process hard-exits after a partial staging write", async () => {
    const finalPath = resolve(
      REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
      `calibration-transaction-crash-${suffix}`,
    );
    taskPaths.push(finalPath);
    const script = `
      const fs = await import("node:fs/promises");
      const harness = await import("./apps/web/e2e/real-build-prefix50-subbuild-return-review-harness-input.ts");
      const txModule = await import("./apps/web/e2e/real-build-prefix50-step44-calibration-directory-transaction.ts");
      const publication = await harness.prepareRealBuildPrefix50Step44ReviewOutputPublication(process.env.LEGO_CRASH_FINAL_PATH);
      const transaction = await txModule.beginRealBuildPrefix50Step44CalibrationDirectoryTransaction(publication);
      await fs.writeFile(transaction.stagingOutputPath + "/partial.bin", "partial-before-crash");
      console.log(JSON.stringify({ staging: transaction.stagingOutputPath, final: transaction.finalOutputPath }));
      process.exit(23);
    `;
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "--eval", script],
      {
        cwd: resolve("."),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, LEGO_CRASH_FINAL_PATH: finalPath },
      },
    );
    let stderr = "";
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const lines = createInterface({ input: child.stdout! })[Symbol.asyncIterator]();
    const first = await lines.next();
    if (first.done) throw new Error(`Crash worker exited before staging evidence: ${stderr}.`);
    const paths = JSON.parse(first.value) as { staging: string; final: string };
    taskPaths.push(paths.staging);
    const [code] = (await once(child, "exit")) as [number | null];
    expect(code).toBe(23);
    expect(paths.final).toBe(finalPath);
    expect(await exists(finalPath)).toBe(false);
    expect(await readFile(resolve(paths.staging, "partial.bin"), "utf8")).toBe(
      "partial-before-crash",
    );
  });
});
