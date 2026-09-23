import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  requireRealBuildPrefix50OfflineFinalization,
  requireRealBuildPrefix50OfflineProductionReceipt,
} from "../e2e/real-build-prefix50-offline-finalized-promotion-lock-validation.ts";
import type { RealBuildPrefix50Step44FinalizationReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-finalization-receipt.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE,
  REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE,
} from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-decision.ts";
import { REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE } from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-production.ts";

type Digest = `sha256:${string}`;
type Row = Readonly<{ path: string; digest: Digest; bytes: number }>;

function sha256(bytes: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function digest(label: string): Digest {
  return sha256(Buffer.from(label));
}

function commit<T extends object>(body: T): T & { readonly commitment: Digest } {
  return { ...body, commitment: canonicalDigest(body) };
}

function sourceLock(input: {
  readonly roots: readonly string[];
  readonly rows: readonly Row[];
  readonly batch: Row;
  readonly stable?: Digest;
  readonly policy?: Digest;
}) {
  const roots = [...input.roots].sort();
  const rows = [...input.rows].sort((left, right) => left.path.localeCompare(right.path));
  const bytes = rows.reduce((total, row) => total + row.bytes, 0);
  return commit({
    schemaVersion: "lego.real-build-prefix50-step44-source-lock-binding/2" as const,
    sourceRootsPolicyDigest: input.policy ?? digest("policy"),
    stableSourceCommitment: input.stable ?? digest("stable"),
    operationSourceManifestDigest: digest("manifest"),
    operationLockManifestDigest: digest("lock"),
    lockedFileCount: rows.length + 1,
    lockedByteCount: bytes + 1,
    operationInputRoots: roots,
    operationInputFileCount: rows.length,
    operationInputByteCount: bytes,
    operationInputsCommitment: canonicalDigest({ roots, files: rows }),
    batchInput: input.batch,
  });
}

interface FixtureOptions {
  readonly productionStable?: Digest;
  readonly productionPolicy?: Digest;
  readonly productionBatch?: Partial<Row>;
  readonly productionReviewBatchCommitment?: Digest;
  readonly mutateRoots?: (roots: readonly string[]) => readonly string[];
  readonly mutateRows?: (rows: readonly Row[]) => readonly Row[];
}

function fixture(options: FixtureOptions = {}) {
  const repositoryRoot = resolve(".");
  const reviewRelative = "var/runs/offline-finalized-test";
  const reviewRoot = resolve(repositoryRoot, reviewRelative);
  const batchCommitment = digest("review-batch");
  const harnessDigest = digest("harness");
  const batch: Row = {
    path: `${reviewRelative}/review-batch.json`,
    digest: harnessDigest,
    bytes: 11,
  };
  const productionBatch = { ...batch, ...options.productionBatch };
  const productionLock = sourceLock({
    roots: [productionBatch.path],
    rows: [productionBatch],
    batch: productionBatch,
    ...(options.productionStable === undefined ? {} : { stable: options.productionStable }),
    ...(options.productionPolicy === undefined ? {} : { policy: options.productionPolicy }),
  });
  const evidence = {
    publicationComplete: {
      expectedHarnessInputBytesHash: harnessDigest,
      commitment: digest("publication"),
    },
    publicSuccess: { commitment: digest("success") },
  };
  const productionReceipt = commit({
    schemaVersion: "lego.real-build-prefix50-step44-source-locked-production/2" as const,
    sourceSetId: "6651557" as const,
    authority: "none" as const,
    reviewBatchEnvelopeCommitment: options.productionReviewBatchCommitment ?? batchCommitment,
    expectedHarnessInputBytesHash: harnessDigest,
    publicHarnessSuccessCommitment: evidence.publicSuccess.commitment,
    publicationCompleteCommitment: evidence.publicationComplete.commitment,
    sourceLock: productionLock,
  });
  const productionBytes = Buffer.from(canonicalStringify(productionReceipt));
  const rawRoot = `${reviewRelative}/raw`;
  const productionPath = `${reviewRelative}/${REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE}`;
  const baseRoots = [
    batch.path,
    rawRoot,
    `${reviewRelative}/public`,
    `${reviewRelative}/withheld`,
    productionPath,
  ];
  const baseRows: readonly Row[] = [
    batch,
    {
      path: `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_A_FILE}`,
      digest: digest("lane-a"),
      bytes: 1,
    },
    {
      path: `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_LANE_B_FILE}`,
      digest: digest("lane-b"),
      bytes: 1,
    },
    {
      path: `${rawRoot}/${REAL_BUILD_PREFIX50_STEP44_RAW_FULL_RESOLUTION_FILE}`,
      digest: digest("full"),
      bytes: 1,
    },
    { path: `${reviewRelative}/public/capture.json`, digest: digest("public"), bytes: 1 },
    { path: `${reviewRelative}/withheld/map.json`, digest: digest("withheld"), bytes: 1 },
    { path: productionPath, digest: sha256(productionBytes), bytes: productionBytes.byteLength },
  ];
  const roots = options.mutateRoots?.(baseRoots) ?? baseRoots;
  const rows = options.mutateRows?.(baseRows) ?? baseRows;
  const finalizationLock = sourceLock({ roots, rows, batch });
  const finalization = commit({
    schemaVersion: "lego.real-build-prefix50-step44-source-locked-finalization/3" as const,
    sourceSetId: "6651557" as const,
    status: "promoted" as const,
    productionReceiptCommitment: productionReceipt.commitment,
    laneCommitments: [digest("lane-a-receipt"), digest("lane-b-receipt")] as const,
    fullResolutionOutcomeCommitment: digest("outcome"),
    blindReviewClosureCommitment: digest("closure"),
    promotionReceiptCommitment: digest("promotion"),
    finalizationSourceLock: finalizationLock,
    finalizationOperationInputs: rows
      .slice()
      .sort((left, right) => left.path.localeCompare(right.path)),
  }) as RealBuildPrefix50Step44FinalizationReceipt;
  return {
    repositoryRoot,
    reviewRoot,
    batch: { commitment: batchCommitment } as never,
    evidence: evidence as never,
    productionReceipt,
    productionBytes,
    productionPath,
    roots,
    finalization,
  };
}

function requireFinalization(value: ReturnType<typeof fixture>): void {
  requireRealBuildPrefix50OfflineFinalization({
    receipt: value.finalization,
    repositoryRoot: value.repositoryRoot,
    reviewRoot: value.reviewRoot,
  });
}

function requireProduction(value: ReturnType<typeof fixture>): void {
  requireRealBuildPrefix50OfflineProductionReceipt({
    receipt: value.productionReceipt,
    finalization: value.finalization,
    evidence: value.evidence,
    batch: value.batch,
    productionReceiptBytes: value.productionBytes,
    repositoryRoot: value.repositoryRoot,
    reviewRoot: value.reviewRoot,
  });
}

describe("prefix-50 offline finalization source-lock closure", () => {
  it("accepts distinct one-root capture and exact five-root finalization bindings", () => {
    const value = fixture();
    expect(value.productionReceipt.sourceLock.operationInputRoots).toHaveLength(1);
    expect(value.finalization.finalizationSourceLock.operationInputRoots).toHaveLength(5);
    expect(() => requireFinalization(value)).not.toThrow();
    expect(() => requireProduction(value)).not.toThrow();
  });

  it("rejects mutation or removal of every finalization root and the prior receipt row", () => {
    for (let index = 0; index < 5; index += 1)
      expect(() =>
        requireFinalization(
          fixture({
            mutateRoots: (roots) =>
              roots.map((root, at) => (at === index ? `${root}-drift` : root)),
          }),
        ),
      ).toThrow();
    expect(() =>
      requireFinalization(
        fixture({
          mutateRows: (rows) =>
            rows.filter(
              ({ path }) =>
                !path.endsWith(REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE),
            ),
        }),
      ),
    ).toThrow();
    for (const field of ["digest", "bytes"] as const)
      expect(() => {
        const value = fixture({
          mutateRows: (rows) =>
            rows.map((row) =>
              row.path.endsWith(REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE)
                ? { ...row, [field]: field === "digest" ? digest("wrong") : row.bytes + 1 }
                : row,
            ),
        });
        requireFinalization(value);
        requireProduction(value);
      }).toThrow(/production receipt drifted/u);
  });

  it("rejects a recommitted prior production-receipt row moved to another descendant path", () => {
    const baseline = fixture();
    const moved = fixture({
      mutateRows: (rows) =>
        rows.map((row) =>
          row.path.endsWith(REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE)
            ? { ...row, path: `${row.path}/recommitted-lookalike.json` }
            : row,
        ),
    });
    expect(moved.finalization.finalizationSourceLock.operationInputsCommitment).not.toBe(
      baseline.finalization.finalizationSourceLock.operationInputsCommitment,
    );
    expect(moved.finalization.finalizationSourceLock.commitment).not.toBe(
      baseline.finalization.finalizationSourceLock.commitment,
    );
    expect(moved.finalization.commitment).not.toBe(baseline.finalization.commitment);
    expect(() => requireFinalization(moved)).not.toThrow();
    expect(() => requireProduction(moved)).toThrow(/production receipt drifted/u);
  });

  it("rejects stable source, policy, batch path/digest/bytes, and review-batch drift", () => {
    const variants: readonly FixtureOptions[] = [
      { productionStable: digest("other-stable") },
      { productionPolicy: digest("other-policy") },
      { productionBatch: { path: "var/runs/other/review-batch.json" } },
      { productionBatch: { digest: digest("other-batch") } },
      { productionBatch: { bytes: 12 } },
      { productionReviewBatchCommitment: digest("other-review-batch") },
    ];
    for (const options of variants)
      expect(() => requireProduction(fixture(options))).toThrow(/production receipt drifted/u);
  });
});
