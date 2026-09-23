import { createHash } from "node:crypto";
import { mkdir, open, realpath } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import { createRealBuildPrefix50SubBuildReturnReviewExportMaterials } from "./real-build-prefix50-subbuild-return.ts";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-review-batch-input.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

const MAXIMUM_BATCH_EXPORT_BYTES = 16 * 1024 * 1024;
const MAXIMUM_RAW_RESULT_BYTES = 128 * 1024 * 1024;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function writeExactArtifact(
  path: string,
  bytes: Uint8Array,
  maximumBytes: number,
): Promise<void> {
  if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes)
    throw new RangeError(
      `Step-44 review export ${basename(path)} must contain 1..${maximumBytes} bytes; received ${bytes.byteLength}.`,
    );
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, "wx");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existingHandle = await open(path, "r");
    try {
      const stats = await existingHandle.stat();
      if (!stats.isFile() || stats.size !== bytes.byteLength || stats.size > maximumBytes)
        throw new TypeError(
          `Step-44 deterministic review export already exists with different bounds: ${path}.`,
          { cause: error },
        );
      const existing = await existingHandle.readFile();
      if (!existing.equals(Buffer.from(bytes)))
        throw new TypeError(
          `Step-44 deterministic review export already exists with different bytes: ${path}.`,
          { cause: error },
        );
    } finally {
      await existingHandle.close();
    }
    return;
  }
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function requireArtifactBytes(artifactFile: string, bytes: Uint8Array, maximumBytes: number): void {
  if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes)
    throw new RangeError(
      `Step-44 review export ${artifactFile} must contain 1..${maximumBytes} bytes; received ${bytes.byteLength}.`,
    );
}

/**
 * Writes the exact complete authority-free receipt, structural roster, and visual batch under the
 * repository's ignored Step-44 output root. No caller path, key, ordering, or subset is accepted.
 */
export async function exportRealBuildPrefix50Step44ReturnReviewArtifacts(resultValue: unknown) {
  if (arguments.length !== 1)
    throw new TypeError(
      "Prefix-50 Step 44 deterministic review export accepts only one runtime-branded return receipt.",
    );
  const {
    result,
    rosterSummary,
    reviewBatch: reviewBatchValue,
  } = createRealBuildPrefix50SubBuildReturnReviewExportMaterials(resultValue);
  const reviewBatch = requireRealBuildPrefix50Step44ReviewBatchEnvelope(reviewBatchValue);
  if (rosterSummary.commitment !== reviewBatch.rosterSummary.commitment)
    throw new TypeError(
      "Step-44 deterministic review export roster and compact batch were not derived from identical complete result bytes.",
    );
  const receiptId = result.commitment.slice("sha256:".length);
  if (!/^[0-9a-f]{64}$/u.test(receiptId))
    throw new TypeError("Step-44 return-result commitment cannot name a deterministic export.");
  const resultFile = `return-result-${receiptId}.json`;
  const rosterFile = `return-roster-${receiptId}.json`;
  const batchFile = `return-review-batch-v2-${receiptId}.json`;
  const indexFile = `return-review-export-v2-${receiptId}.json`;
  const resultBytes = Buffer.from(canonicalStringify(result));
  const rosterBytes = Buffer.from(canonicalStringify(rosterSummary));
  const batchBytes = Buffer.from(canonicalStringify(reviewBatch));
  const expectedHarnessInputBytesHash = sha256(batchBytes);
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-return-review-export/2" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    outcome: "step44-visual-selection-required" as const,
    returnResultCommitment: result.commitment,
    candidateRosterCommitment: result.candidateRosterCommitment,
    rosterSummaryCommitment: rosterSummary.commitment,
    reviewBatchEnvelopeCommitment: reviewBatch.commitment,
    expectedHarnessInputBytesHash,
    candidateCount: reviewBatch.candidateCount,
    artifacts: {
      rawReturnResult: {
        artifactFile: resultFile,
        byteSize: resultBytes.byteLength,
        byteDigest: sha256(resultBytes),
      },
      rosterSummary: {
        artifactFile: rosterFile,
        byteSize: rosterBytes.byteLength,
        byteDigest: sha256(rosterBytes),
      },
      reviewBatch: {
        artifactFile: batchFile,
        byteSize: batchBytes.byteLength,
        byteDigest: expectedHarnessInputBytesHash,
      },
    },
  };
  const index = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  const indexBytes = Buffer.from(canonicalStringify(index));
  for (const [artifactFile, bytes, maximumBytes] of [
    [resultFile, resultBytes, MAXIMUM_RAW_RESULT_BYTES],
    [rosterFile, rosterBytes, MAXIMUM_BATCH_EXPORT_BYTES],
    [batchFile, batchBytes, MAXIMUM_BATCH_EXPORT_BYTES],
    [indexFile, indexBytes, MAXIMUM_BATCH_EXPORT_BYTES],
  ] as const)
    requireArtifactBytes(artifactFile, bytes, maximumBytes);
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const realRoot = await realpath(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT);
  if (resolve(realRoot) !== REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT)
    throw new TypeError(
      "Step-44 deterministic review-export root may not be a symlink or junction.",
    );
  await writeExactArtifact(resolve(realRoot, resultFile), resultBytes, MAXIMUM_RAW_RESULT_BYTES);
  await writeExactArtifact(resolve(realRoot, rosterFile), rosterBytes, MAXIMUM_BATCH_EXPORT_BYTES);
  await writeExactArtifact(resolve(realRoot, batchFile), batchBytes, MAXIMUM_BATCH_EXPORT_BYTES);
  await writeExactArtifact(resolve(realRoot, indexFile), indexBytes, MAXIMUM_BATCH_EXPORT_BYTES);
  return deepFreeze({
    outputRoot: realRoot,
    indexPath: resolve(realRoot, indexFile),
    resultPath: resolve(realRoot, resultFile),
    rosterPath: resolve(realRoot, rosterFile),
    batchPath: resolve(realRoot, batchFile),
    index,
  });
}
