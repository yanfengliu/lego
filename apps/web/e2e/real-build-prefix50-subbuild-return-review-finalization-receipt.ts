import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";
import { relative, resolve } from "node:path";

import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { normalizeRealBuildRelativePath } from "./real-build-replay-files.ts";
import { writeOrResumeRealBuildPrefix50Step44ExactArtifact } from "./real-build-prefix50-subbuild-return-review-source-locked-files.ts";
import {
  listRealBuildPrefix50Step44LockedInputs,
  reassertRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44SourceLockBinding,
  requireRealBuildPrefix50Step44SourceLockCapability,
  requireRealBuildPrefix50Step44SourceLockRepository,
  type RealBuildPrefix50Step44LockedInputRow,
  type RealBuildPrefix50Step44SourceLockBinding,
  type RealBuildPrefix50Step44SourceLockCapability,
} from "./real-build-prefix50-subbuild-return-review-source-lock.ts";

export const REAL_BUILD_PREFIX50_STEP44_FINALIZATION_FILE =
  "real-build-prefix50-step44-source-locked-finalization.json" as const;
const MAXIMUM_FINALIZATION_BYTES = 512 * 1024;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export interface RealBuildPrefix50Step44FinalizationReceipt {
  readonly schemaVersion: "lego.real-build-prefix50-step44-source-locked-finalization/3";
  readonly sourceSetId: "6651557";
  readonly status: "promoted" | "refused";
  readonly productionReceiptCommitment: `sha256:${string}`;
  readonly laneCommitments: readonly [`sha256:${string}`, `sha256:${string}`];
  readonly fullResolutionOutcomeCommitment: `sha256:${string}`;
  readonly blindReviewClosureCommitment: `sha256:${string}`;
  readonly promotionReceiptCommitment: `sha256:${string}` | null;
  readonly finalizationSourceLock: RealBuildPrefix50Step44SourceLockBinding;
  readonly finalizationOperationInputs: readonly RealBuildPrefix50Step44LockedInputRow[];
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step44FinalizationReceiptBody = Omit<
  RealBuildPrefix50Step44FinalizationReceipt,
  | "commitment"
  | "finalizationOperationInputs"
  | "finalizationSourceLock"
  | "schemaVersion"
  | "sourceSetId"
>;

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function matchesRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export function requireRealBuildPrefix50Step44FinalizationOperationInputs(
  sourceLock: RealBuildPrefix50Step44SourceLockBinding,
  value: readonly RealBuildPrefix50Step44LockedInputRow[],
): readonly RealBuildPrefix50Step44LockedInputRow[] {
  if (!Array.isArray(value) || value.length < 1)
    throw new TypeError("Step-44 finalization requires its exact nonempty operation-input rows.");
  for (const [index, row] of value.entries()) {
    exactKeys(row, ["bytes", "digest", "path"], `Step-44 finalization input row ${index}`);
    if (
      normalizeRealBuildRelativePath(row.path, `Step-44 finalization input row ${index}`) !==
        row.path ||
      !DIGEST.test(row.digest) ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes < 1
    )
      throw new TypeError(`Step-44 finalization input row ${index} is malformed.`);
    if (index > 0 && value[index - 1]!.path.localeCompare(row.path) >= 0)
      throw new TypeError("Step-44 finalization operation-input rows must be strictly sorted.");
    if (!sourceLock.operationInputRoots.some((root) => matchesRoot(row.path, root)))
      throw new TypeError(`Step-44 finalization input ${row.path} is outside its locked roots.`);
  }
  if (
    sourceLock.operationInputRoots.some(
      (root) => !value.some(({ path }) => matchesRoot(path, root)),
    )
  )
    throw new TypeError("Step-44 finalization has an empty locked operation-input root.");
  const batchRows = value.filter(({ path }) => path === sourceLock.batchInput.path);
  if (
    batchRows.length !== 1 ||
    canonicalStringify(batchRows[0]) !== canonicalStringify(sourceLock.batchInput)
  )
    throw new TypeError(
      "Step-44 finalization batch row drifted from its committed operation-input manifest.",
    );
  const bytes = value.reduce((total, row) => total + row.bytes, 0);
  if (
    value.length !== sourceLock.operationInputFileCount ||
    bytes !== sourceLock.operationInputByteCount ||
    canonicalDigest({ roots: sourceLock.operationInputRoots, files: value }) !==
      sourceLock.operationInputsCommitment
  )
    throw new TypeError(
      "Step-44 finalization operation-input rows drifted from their committed roots, count, bytes, or digest.",
    );
  return value;
}

function parseReceipt(reviewRoot: string): RealBuildPrefix50Step44FinalizationReceipt {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    reviewRoot,
    REAL_BUILD_PREFIX50_STEP44_FINALIZATION_FILE,
    MAXIMUM_FINALIZATION_BYTES,
    "Step-44 source-locked finalization receipt",
  );
  const text = bytes.toString("utf8");
  const value: unknown = JSON.parse(text);
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  if (canonicalStringify(value) !== text)
    throw new TypeError("Step-44 source-locked finalization receipt is not canonical JSON.");
  exactKeys(
    value,
    [
      "blindReviewClosureCommitment",
      "commitment",
      "finalizationOperationInputs",
      "finalizationSourceLock",
      "fullResolutionOutcomeCommitment",
      "laneCommitments",
      "productionReceiptCommitment",
      "promotionReceiptCommitment",
      "schemaVersion",
      "sourceSetId",
      "status",
    ],
    "Step-44 source-locked finalization receipt",
  );
  const receipt = value as RealBuildPrefix50Step44FinalizationReceipt;
  requireRealBuildPrefix50Step44SourceLockBinding(receipt.finalizationSourceLock);
  requireRealBuildPrefix50Step44FinalizationOperationInputs(
    receipt.finalizationSourceLock,
    receipt.finalizationOperationInputs,
  );
  const { commitment, ...body } = receipt;
  if (
    receipt.schemaVersion !== "lego.real-build-prefix50-step44-source-locked-finalization/3" ||
    receipt.sourceSetId !== "6651557" ||
    (receipt.status !== "promoted" && receipt.status !== "refused") ||
    !Array.isArray(receipt.laneCommitments) ||
    receipt.laneCommitments.length !== 2 ||
    receipt.laneCommitments.some((digest) => !DIGEST.test(digest)) ||
    !DIGEST.test(receipt.productionReceiptCommitment) ||
    !DIGEST.test(receipt.fullResolutionOutcomeCommitment) ||
    !DIGEST.test(receipt.blindReviewClosureCommitment) ||
    (receipt.promotionReceiptCommitment !== null &&
      !DIGEST.test(receipt.promotionReceiptCommitment)) ||
    (receipt.status === "promoted") !== (receipt.promotionReceiptCommitment !== null) ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError("Step-44 source-locked finalization receipt schema drifted.");
  return deepFreeze(receipt);
}

function reassertExact(
  capability: RealBuildPrefix50Step44SourceLockCapability,
  expected: RealBuildPrefix50Step44SourceLockBinding,
): void {
  if (
    canonicalDigest(reassertRealBuildPrefix50Step44SourceLockCapability(capability)) !==
    canonicalDigest(expected)
  )
    throw new TypeError("Step-44 live capability changed before final receipt publication.");
}

export function writeRealBuildPrefix50Step44FinalizationReceipt(input: {
  readonly repositoryRoot: string;
  readonly reviewRoot: string;
  readonly capability: RealBuildPrefix50Step44SourceLockCapability;
  readonly body: RealBuildPrefix50Step44FinalizationReceiptBody;
}): RealBuildPrefix50Step44FinalizationReceipt {
  const sourceLock = requireRealBuildPrefix50Step44SourceLockCapability(input.capability);
  const finalizationOperationInputs = listRealBuildPrefix50Step44LockedInputs(input.capability);
  requireRealBuildPrefix50Step44FinalizationOperationInputs(
    sourceLock,
    finalizationOperationInputs,
  );
  requireRealBuildPrefix50Step44SourceLockRepository(input.capability, input.repositoryRoot);
  const reviewPath = relative(resolve(input.repositoryRoot), resolve(input.reviewRoot));
  if (reviewPath.length === 0 || reviewPath.startsWith(".."))
    throw new TypeError("Step-44 final receipt must remain inside its source-locked repository.");
  const receiptBody = {
    schemaVersion: "lego.real-build-prefix50-step44-source-locked-finalization/3" as const,
    sourceSetId: "6651557" as const,
    ...input.body,
    finalizationSourceLock: sourceLock,
    finalizationOperationInputs,
  };
  const receipt = deepFreeze({ ...receiptBody, commitment: canonicalDigest(receiptBody) });
  reassertExact(input.capability, sourceLock);
  writeOrResumeRealBuildPrefix50Step44ExactArtifact(
    {
      root: input.reviewRoot,
      path: REAL_BUILD_PREFIX50_STEP44_FINALIZATION_FILE,
      bytes: Buffer.from(canonicalStringify(receipt)),
      label: "Step-44 source-locked finalization receipt",
    },
    {
      beforePublish: () => reassertExact(input.capability, sourceLock),
      afterPublish: () => reassertExact(input.capability, sourceLock),
    },
  );
  reassertExact(input.capability, sourceLock);
  const reopened = parseReceipt(input.reviewRoot);
  if (canonicalStringify(reopened) !== canonicalStringify(receipt))
    throw new TypeError("Step-44 finalization restart conflicts with the exact derived receipt.");
  return reopened;
}

export function readRealBuildPrefix50Step44FinalizationReceipt(
  reviewRoot: string,
): RealBuildPrefix50Step44FinalizationReceipt {
  return parseReceipt(reviewRoot);
}
