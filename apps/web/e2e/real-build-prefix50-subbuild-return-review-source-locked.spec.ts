import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { canonicalStringify } from "@lego-studio/brick-kernel";

import { finalizeRealBuildPrefix50Step44SourceLockedReview } from "./real-build-prefix50-subbuild-return-review-finalizer.ts";
import {
  readRealBuildPrefix50Step44ReviewHarnessInput,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { rederiveRealBuildPrefix50Step44ProductionMaterials } from "./real-build-prefix50-subbuild-return-review-production-materials.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_ENV,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION_ENV,
  acquireRealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
  writeRealBuildPrefix50Step44SourceLockedProductionReceipt,
} from "./real-build-prefix50-subbuild-return-review-source-locked-production.ts";
import { runRealBuildPrefix50Step44CameraQualifiedProduction } from "./real-build-prefix50-subbuild-return-review-camera-qualified-production.ts";
import { readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "./real-build-prefix50-step44-camera-only-source-lock.ts";

const BATCH_PATH_ENV = "LEGO_REAL_BUILD_PREFIX50_STEP44_BATCH_PATH" as const;
const BATCH_DIGEST_ENV = "LEGO_REAL_BUILD_PREFIX50_STEP44_BATCH_SHA256" as const;
const OUTPUT_NAME_ENV = "LEGO_REAL_BUILD_PREFIX50_STEP44_PRODUCTION_OUTPUT" as const;
const REVIEW_ROOT_ENV = "LEGO_REAL_BUILD_PREFIX50_STEP44_REVIEW_ROOT" as const;
const RAW_INPUT_ROOT_ENV = "LEGO_REAL_BUILD_PREFIX50_STEP44_RAW_INPUT_ROOT" as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

const operation = process.env[REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION_ENV];
const required = operation === "capture" || operation === "finalize";

test.describe.configure({ mode: "serial", timeout: 7_200_000 });
test.skip(
  !required || process.env.LEGO_REAL_BUILD_REQUIRED !== "1",
  `set LEGO_REAL_BUILD_REQUIRED=1 and ${REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION_ENV}=capture|finalize to run the exact source-locked Step-44 production path`,
);

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0)
    throw new TypeError(`Step-44 source-locked production requires ${name}.`);
  return value;
}

function repositoryRelative(path: string): string {
  const value = relative(resolve("."), resolve(path)).replaceAll("\\", "/");
  if (value.length === 0 || value.startsWith("../"))
    throw new TypeError(`Step-44 source-locked input escaped the repository: ${path}.`);
  return value;
}

function lockedInputs(): readonly string[] {
  const encoded = requiredEnvironment(REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_ENV);
  const value: unknown = JSON.parse(encoded);
  if (!Array.isArray(value) || value.some((path) => typeof path !== "string"))
    throw new TypeError(`${REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_ENV} is malformed.`);
  return (value as string[]).slice().sort((left, right) => left.localeCompare(right));
}

function exactLockedInputs(expected: readonly string[]): readonly string[] {
  const wanted = expected.slice().sort((left, right) => left.localeCompare(right));
  const actual = lockedInputs();
  if (actual.length !== wanted.length || actual.some((path, index) => path !== wanted[index]))
    throw new TypeError(
      `${REAL_BUILD_PREFIX50_STEP44_LOCKED_INPUTS_ENV} must name exactly ${wanted.join(", ")}.`,
    );
  return wanted;
}

async function rederiveExactBatch() {
  const batchPath = resolve(requiredEnvironment(BATCH_PATH_ENV));
  const expectedDigest = requiredEnvironment(BATCH_DIGEST_ENV);
  if (!SHA256.test(expectedDigest))
    throw new TypeError(`${BATCH_DIGEST_ENV} must be an exact sha256 digest.`);
  const read = await readRealBuildPrefix50Step44ReviewHarnessInput(
    batchPath,
    expectedDigest as `sha256:${string}`,
  );
  if (read.input.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-batch-input/2")
    throw new TypeError("Step-44 source-locked production requires the exact compact batch input.");
  const materials = await rederiveRealBuildPrefix50Step44ProductionMaterials();
  const rederivedBytes = Buffer.from(canonicalStringify(materials.batch));
  const rederivedDigest = `sha256:${createHash("sha256").update(rederivedBytes).digest("hex")}`;
  if (
    canonicalStringify(read.input) !== canonicalStringify(materials.batch) ||
    rederivedDigest !== read.bytesHash
  )
    throw new TypeError(
      "Step-44 source-locked production batch is not byte-identical to the fresh runtime-branded enumeration.",
    );
  return { ...materials, batchPath };
}

test("runs or finalizes the exact source-locked 211-candidate Step-44 review", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  const repositoryRoot = resolve(".");
  const batchPath = resolve(requiredEnvironment(BATCH_PATH_ENV));
  if (operation === "capture") {
    const batchInputPath = repositoryRelative(batchPath);
    const operationInputRoots = exactLockedInputs([batchInputPath]);
    const capability = acquireRealBuildPrefix50Step44SourceLockCapability({
      repositoryRoot,
      operationInputRoots,
      batchInputPath,
    });
    const materials = await rederiveExactBatch();
    const outputName = requiredEnvironment(OUTPUT_NAME_ENV);
    if (!/^[A-Za-z0-9._-]+$/u.test(outputName))
      throw new TypeError(`${OUTPUT_NAME_ENV} must be one strict direct-child name.`);
    const reviewRoot = resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, outputName);
    const transaction = await runRealBuildPrefix50Step44CameraQualifiedProduction({
      outputPath: reviewRoot,
      repositoryRoot,
      inputBytesHash: requiredEnvironment(BATCH_DIGEST_ENV) as `sha256:${string}`,
      batch: materials.batch,
    });
    const receipt = await writeRealBuildPrefix50Step44SourceLockedProductionReceipt({
      repositoryRoot,
      reviewRoot,
      batch: materials.batch,
      capability,
    });
    expect(transaction.capturedCandidateCount).toBe(211);
    await testInfo.attach("real-build-prefix50-step44-source-locked-production.json", {
      path: resolve(reviewRoot, "real-build-prefix50-step44-source-locked-production.json"),
      contentType: "application/json",
    });
    expect(receipt.sourceLock.commitment).toMatch(SHA256);
    return;
  }
  if (operation !== "finalize") throw new TypeError("Unsupported Step-44 source-locked operation.");
  const reviewRoot = resolve(requiredEnvironment(REVIEW_ROOT_ENV));
  const rawInputRoot = resolve(requiredEnvironment(RAW_INPUT_ROOT_ENV));
  const batchInputPath = repositoryRelative(batchPath);
  const operationInputRoots = exactLockedInputs([
    batchInputPath,
    repositoryRelative(rawInputRoot),
    repositoryRelative(resolve(reviewRoot, "public")),
    repositoryRelative(resolve(reviewRoot, "withheld")),
    repositoryRelative(
      resolve(reviewRoot, REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE),
    ),
  ]);
  const capability = acquireRealBuildPrefix50Step44SourceLockCapability({
    repositoryRoot,
    operationInputRoots,
    batchInputPath,
  });
  const materials = await rederiveExactBatch();
  const realDomainQualification =
    await readAndBindPersistedRealBuildPrefix50Step44RealDomainQualification({
      qualificationOutputPath: `${reviewRoot}.page44-real-domain-calibration`,
      repositoryRoot,
      sourceLock: captureRealBuildPrefix50Step44CameraOnlyLiveSourceLock(repositoryRoot),
      returnResult: materials.result,
      reviewBatch: materials.batch,
    });
  const receipt = await finalizeRealBuildPrefix50Step44SourceLockedReview({
    reviewRoot,
    rawInputRoot,
    repositoryRoot,
    batch: materials.batch,
    result: materials.result,
    capability,
    realDomainQualification,
  });
  await testInfo.attach("real-build-prefix50-step44-source-locked-finalization.json", {
    path: resolve(reviewRoot, "real-build-prefix50-step44-source-locked-finalization.json"),
    contentType: "application/json",
  });
  expect(receipt.commitment).toMatch(SHA256);
});
