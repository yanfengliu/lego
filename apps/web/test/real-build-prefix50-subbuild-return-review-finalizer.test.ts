import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  createRealBuildBootstrapSourceManifest,
  REAL_BUILD_SOURCE_ROOT_POLICY_PATH,
  type RealBuildBootstrapSourceLockEvidence,
} from "../e2e/real-build-bootstrap-source";
import { createRealBuildPrefix50Step44ProductionPromotionAuthority } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-authority";
import { writeRealBuildPrefix50Step44PromotionArtifacts } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-artifacts";
import {
  readRealBuildPrefix50Step44FinalizationReceipt,
  writeRealBuildPrefix50Step44FinalizationReceipt,
} from "../e2e/real-build-prefix50-subbuild-return-review-finalization-receipt";
import { finalizeRealBuildPrefix50Step44SourceLockedReview } from "../e2e/real-build-prefix50-subbuild-return-review-finalizer";
import {
  preflightRealBuildPrefix50Step44ExactArtifact,
  writeOrResumeRealBuildPrefix50Step44ExactArtifact,
} from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-files";
import { writeRealBuildPrefix50Step44SourceLockedProductionReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-production";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION_ENV,
  REAL_BUILD_PREFIX50_STEP44_STABLE_PRODUCTION_SOURCE_PATHS,
  deriveRealBuildPrefix50Step44VerifiedSourceLock,
  requireRealBuildPrefix50Step44SourceLockCapability,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "../e2e/real-build-prefix50-subbuild-return-review-source-lock";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import { blindReviewTestDigest } from "./real-build-prefix50-subbuild-return-review-blind-test-support";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-result";
import { createUnbrandedRealDomainQualificationForNegativeTest } from "./real-build-prefix50-real-domain-qualification-negative-test-support.ts";

function forgedCapability(): RealBuildPrefix50Step44SourceLockCapability {
  const batchPath = "var/runs/step44-batch.json";
  const sourcePolicyDigest = blindReviewTestDigest("source-policy");
  const files = [
    { path: REAL_BUILD_SOURCE_ROOT_POLICY_PATH, digest: sourcePolicyDigest, bytes: 1 },
    ...REAL_BUILD_PREFIX50_STEP44_STABLE_PRODUCTION_SOURCE_PATHS.map((path) => ({
      path,
      digest: blindReviewTestDigest(path),
      bytes: 1,
    })),
    { path: batchPath, digest: blindReviewTestDigest("batch"), bytes: 1 },
  ];
  const manifest = createRealBuildBootstrapSourceManifest({
    files,
    sourceRootsPolicyDigest: sourcePolicyDigest,
  });
  const lock: RealBuildBootstrapSourceLockEvidence = {
    repoRoot: resolve("."),
    directory: resolve(tmpdir(), "forged-source-lock"),
    helperPid: 404,
    lockManifestDigest: blindReviewTestDigest("forged-helper"),
    lockedFiles: manifest.files.length,
    lockedBytes: manifest.files.reduce((total, row) => total + row.bytes, 0),
  };
  const verified = deriveRealBuildPrefix50Step44VerifiedSourceLock({
    repositoryRoot: resolve("."),
    operationInputRoots: [batchPath],
    batchInputPath: batchPath,
    manifest,
    lock,
  });
  return { binding: verified.binding };
}

describe("prefix-50 Step-44 source-locked finalization boundary", () => {
  it("rejects a copied source-lock binding at every authority-bearing entrypoint", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-forged-capability-"));
    const capability = forgedCapability();
    const result = createStep44ReviewTestResult(211);
    const brand = __testOnly.brandReturnResultForReviewTests;
    if (brand === undefined) throw new Error("Step-44 review test brand is unavailable.");
    brand(result);
    const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
    const realDomainQualification = createUnbrandedRealDomainQualificationForNegativeTest(
      batch.commitment,
    );
    try {
      expect(() => requireRealBuildPrefix50Step44SourceLockCapability(capability)).toThrow(
        /opaque live bootstrap source-lock capability/u,
      );
      await expect(
        writeRealBuildPrefix50Step44SourceLockedProductionReceipt({
          repositoryRoot: resolve("."),
          reviewRoot: root,
          batch,
          capability,
        }),
      ).rejects.toThrow(/opaque live bootstrap source-lock capability/u);
      await expect(
        finalizeRealBuildPrefix50Step44SourceLockedReview({
          reviewRoot: resolve(root, "review"),
          rawInputRoot: resolve(root, "raw"),
          repositoryRoot: resolve("."),
          batch,
          result,
          capability,
          realDomainQualification,
        }),
      ).rejects.toThrow(/runtime-branded persisted Steps-41\/42-qualified/u);
      expect(() =>
        createRealBuildPrefix50Step44ProductionPromotionAuthority({
          result,
          batch,
          evidence: {} as never,
          map: {} as never,
          publicationComplete: {} as never,
          productionChain: {} as never,
          repositoryRoot: resolve("."),
          reviewRoot: root,
          rawInputRoot: resolve(root, "raw"),
          capability,
        }),
      ).toThrow(/opaque live bootstrap source-lock capability/u);
      await expect(
        writeRealBuildPrefix50Step44PromotionArtifacts({
          promotionRoot: root,
          authority: {} as never,
          capability,
        }),
      ).rejects.toThrow(/opaque live bootstrap source-lock capability/u);
      expect(() =>
        writeRealBuildPrefix50Step44FinalizationReceipt({
          repositoryRoot: resolve("."),
          reviewRoot: root,
          capability,
          body: {
            status: "refused",
            productionReceiptCommitment: blindReviewTestDigest("production"),
            laneCommitments: [blindReviewTestDigest("a"), blindReviewTestDigest("b")],
            fullResolutionOutcomeCommitment: blindReviewTestDigest("outcome"),
            blindReviewClosureCommitment: blindReviewTestDigest("closure"),
            promotionReceiptCommitment: null,
          },
        }),
      ).toThrow(/opaque live bootstrap source-lock capability/u);
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it("publishes no partial final path, resumes exact bytes, and rejects races and links", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-atomic-final-"));
    const artifact = {
      root,
      path: "receipt.json",
      bytes: Buffer.from("AAAA"),
      label: "Step-44 atomic test receipt",
    };
    try {
      expect(() =>
        writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact, {
          hooks: {
            write: {
              afterTemporaryWrite: () => {
                throw new Error("helper died");
              },
            },
          },
        }),
      ).toThrow(/helper died/u);
      expect(await readdir(root)).toEqual([]);

      const temporaryName = `.receipt.json.tmp-${createHash("sha256")
        .update(artifact.bytes)
        .digest("hex")}`;
      const conflictingTemporaryName = `.receipt.json.tmp-${"0".repeat(64)}`;
      await writeFile(resolve(root, conflictingTemporaryName), artifact.bytes);
      expect(() => writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact)).toThrow(
        /conflicting deterministic temporary/u,
      );
      await rm(resolve(root, conflictingTemporaryName));
      await writeFile(resolve(root, temporaryName), artifact.bytes);
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact);
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact);
      await writeFile(resolve(root, temporaryName), artifact.bytes);
      writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact);
      expect(await readdir(root)).toEqual(["receipt.json"]);
      expect(preflightRealBuildPrefix50Step44ExactArtifact(artifact)).toBe(true);

      await writeFile(resolve(root, "receipt.json"), "BBBB");
      expect(() => preflightRealBuildPrefix50Step44ExactArtifact(artifact)).toThrow(
        /hashes to|digest/u,
      );
      await rm(resolve(root, "receipt.json"));
      expect(() =>
        writeOrResumeRealBuildPrefix50Step44ExactArtifact(artifact, {
          afterPublish: () => {
            throw new Error("helper died after publish");
          },
        }),
      ).toThrow(/helper died after publish/u);
      await expect(lstat(resolve(root, "receipt.json"))).rejects.toThrow();

      await writeFile(resolve(root, "race.json"), "AAAA");
      expect(() =>
        preflightRealBuildPrefix50Step44ExactArtifact(
          { ...artifact, path: "race.json" },
          { read: { afterPreflight: () => writeFileSync(resolve(root, "race.json"), "BBBB") } },
        ),
      ).toThrow(/hashes to|did not present|changed/u);

      const nested = resolve(root, "nested");
      const displaced = resolve(root, "nested-old");
      await mkdir(nested);
      await writeFile(resolve(nested, "same.json"), "AAAA");
      expect(() =>
        preflightRealBuildPrefix50Step44ExactArtifact(
          { ...artifact, path: "nested/same.json" },
          {
            read: {
              afterPreflight: () => {
                renameSync(nested, displaced);
                mkdirSync(nested);
                writeFileSync(resolve(nested, "same.json"), "AAAA");
              },
            },
          },
        ),
      ).toThrow(/did not present|changed|ancestor/u);

      const outside = await mkdtemp(resolve(tmpdir(), "lego-step44-junction-target-"));
      try {
        await writeFile(resolve(outside, "linked.json"), "AAAA");
        await symlink(
          outside,
          resolve(root, "linked"),
          process.platform === "win32" ? "junction" : "dir",
        );
        expect(() =>
          preflightRealBuildPrefix50Step44ExactArtifact({
            ...artifact,
            path: "linked/linked.json",
          }),
        ).toThrow(/symlink|junction|real directory/u);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("strictly rejects a malformed finalization receipt", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-final-receipt-"));
    try {
      await writeFile(
        resolve(root, "real-build-prefix50-step44-source-locked-finalization.json"),
        canonicalStringify({
          schemaVersion: "lego.real-build-prefix50-step44-source-locked-finalization/3",
          unexpected: true,
        }),
      );
      expect(() => readRealBuildPrefix50Step44FinalizationReceipt(root)).toThrow(
        /contain exactly/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("isolates the source-locked operation to its exact Playwright spec under --list", () => {
    const run = spawnSync(
      process.execPath,
      [resolve("node_modules/@playwright/test/cli.js"), "test", "--list"],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          LEGO_REAL_BUILD_REQUIRED: "0",
          [REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION_ENV]: "capture",
        },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    expect(run.status, run.stderr).toBe(0);
    const listed = run.stdout.split(/\r?\n/u).filter((line) => line.includes(".spec.ts"));
    expect(listed).not.toEqual([]);
    expect(
      listed.every((line) =>
        line.includes("real-build-prefix50-subbuild-return-review-source-locked.spec.ts"),
      ),
    ).toBe(true);
  });
});
