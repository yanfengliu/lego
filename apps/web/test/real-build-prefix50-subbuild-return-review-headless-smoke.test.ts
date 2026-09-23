import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input";
import {
  runRealBuildPrefix50Step44PublicationFailureProbeForTest,
  runRealBuildPrefix50Step44ThreeRowTransactionForTest,
  runRealBuildPrefix50Step44WiringFailureProbeForTest,
} from "../e2e/real-build-prefix50-subbuild-return-review-transaction-test-only";
import { REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE } from "../e2e/real-build-prefix50-subbuild-return-review-transaction";
import { createStep44ReviewHeadlessSmokeTestResult } from "./real-build-prefix50-subbuild-return-review-test-result";
import { createUnbrandedRealDomainQualificationForNegativeTest } from "./real-build-prefix50-real-domain-qualification-negative-test-support.ts";

const smokeRoots: string[] = [];
let smokeOutputSequence = 0;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

async function createSmokeRoot(prefix: string): Promise<string> {
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  smokeOutputSequence += 1;
  const root = resolve(
    REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
    `${prefix}${process.pid}-${Date.now()}-${smokeOutputSequence}`,
  );
  smokeRoots.push(root);
  return root;
}

afterAll(async () => {
  for (const root of smokeRoots) await rm(root, { recursive: true, force: true });
});

describe("prefix-50 Step-44 authority-bound transaction smoke", () => {
  let batch: ReturnType<typeof createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope>;
  let batchBytesHash: `sha256:${string}`;

  beforeAll(() => {
    const result = createStep44ReviewHeadlessSmokeTestResult();
    const brand = __testOnly.brandReturnResultForReviewTests;
    if (brand === undefined) throw new Error("Step-44 review test brand is unavailable.");
    brand(result);
    batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
    const batchBytes = Buffer.from(canonicalStringify(batch));
    batchBytesHash = sha256(batchBytes);
    expect(batch.candidateCount).toBe(211);
    expect(batch.candidates).toHaveLength(211);
  }, 120_000);

  it("refuses the non-authoritative three-row smoke before output claim or browser access", async () => {
    const root = await createSmokeRoot("test-three-row-transaction-");
    await expect(
      runRealBuildPrefix50Step44ThreeRowTransactionForTest({
        outputPath: root,
        repositoryRoot: resolve("."),
        inputBytesHash: batchBytesHash,
        batch,
        realDomainQualification: createUnbrandedRealDomainQualificationForNegativeTest(
          batch.commitment,
        ),
      }),
    ).rejects.toThrow(/runtime-branded persisted Steps-41\/42-qualified/u);
    await expect(access(root)).rejects.toThrow();
  });

  it("writes only an incomplete marker when transaction wiring fails", async () => {
    const root = await createSmokeRoot("test-three-row-wiring-failure-");
    await expect(
      runRealBuildPrefix50Step44WiringFailureProbeForTest({
        outputPath: root,
        repositoryRoot: resolve("."),
        inputBytesHash: batchBytesHash,
        batch,
      }),
    ).rejects.toThrow("Step-44 review browser lifecycle failed");
    const markerBytes = await readFile(
      resolve(root, "real-build-prefix50-step44-three-row-smoke-incomplete.json"),
    );
    const marker = JSON.parse(markerBytes.toString("utf8")) as Record<string, unknown>;
    expect(marker).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step44-three-row-headless-smoke-incomplete/1",
      authority: "none",
      status: "incomplete",
      promotionAuthority: false,
      sourceBatchCandidateCount: 211,
      expectedCapturedCandidateCount: 3,
      capturedCandidateCount: 0,
    });
    expect(marker.commitment).toBe(canonicalDigest(withoutCommitment(marker)));
    await expect(
      access(resolve(root, "public", "real-build-prefix50-step44-three-row-smoke-success.json")),
    ).rejects.toThrow();
    await expect(
      access(resolve(root, REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE)),
    ).rejects.toThrow();
  });

  it("leaves a raced output root untouched when the exclusive claim fails", async () => {
    const root = await createSmokeRoot("test-three-row-publication-failure-");
    await expect(
      runRealBuildPrefix50Step44PublicationFailureProbeForTest({
        outputPath: root,
        repositoryRoot: resolve("."),
        inputBytesHash: batchBytesHash,
        batch,
      }),
    ).rejects.toThrow(/output already exists/u);
    await expect(access(root)).resolves.toBeUndefined();
    expect(await readdir(root)).toEqual([]);
    await expect(
      access(resolve(root, REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE)),
    ).rejects.toThrow();
  });
});
