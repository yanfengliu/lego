import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  canonicalDigest,
  canonicalStringify,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "../e2e/real-build-prefix50-subbuild-return-contract";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  createRealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
  createRealBuildPrefix50SubBuildReturnReviewRosterSummary,
} from "../e2e/real-build-prefix50-subbuild-return";
import {
  realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment,
  realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment,
  realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment,
  realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment,
} from "../e2e/real-build-prefix50-subbuild-return-review-batch";
import { requireRealBuildPrefix50Step44ReviewBatchEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-input";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-replay";
import { exportRealBuildPrefix50Step44ReturnReviewArtifacts } from "../e2e/real-build-prefix50-subbuild-return-review-export";
import {
  REAL_BUILD_PREFIX50_STEP44_MAXIMUM_COMPACT_BATCH_BYTES,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  readRealBuildPrefix50Step44ReviewHarnessInput,
} from "../e2e/real-build-prefix50-subbuild-return-review-harness-input";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-support";

type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : T[Key] extends object
      ? Mutable<T[Key]>
      : T[Key];
};
type MutableBatch = Mutable<RealBuildPrefix50SubBuildReturnReviewBatchEnvelope>;

const runId = `${process.pid}-${Date.now()}`;
const temporaryPaths: string[] = [];
let fullBatch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
const fullResult = createStep44ReviewTestResult(211);

function inputDigest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function mutableBatch(): MutableBatch {
  return structuredClone(fullBatch) as unknown as MutableBatch;
}

function recommitRow(row: MutableBatch["candidates"][number]): void {
  row.operationsCommitment = canonicalDigest(row.operations);
  const body = { ...row } as typeof row & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  row.commitment = realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment(
    body as unknown as Parameters<
      typeof realBuildPrefix50SubBuildReturnCompactReviewCandidateCommitment
    >[0],
  );
}

function recommitRoster(batch: MutableBatch): void {
  const body = { ...batch.rosterSummary } as typeof batch.rosterSummary & {
    commitment?: unknown;
  };
  Reflect.deleteProperty(body, "commitment");
  batch.rosterSummary.commitment = realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment(
    body as unknown as Parameters<
      typeof realBuildPrefix50SubBuildReturnReviewRosterSummaryCommitment
    >[0],
  );
}

function recommitReceipt(batch: MutableBatch): void {
  const body = { ...batch.enumerationReceipt } as typeof batch.enumerationReceipt & {
    commitment?: unknown;
  };
  Reflect.deleteProperty(body, "commitment");
  batch.enumerationReceipt.commitment =
    realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment(
      body as unknown as Parameters<
        typeof realBuildPrefix50SubBuildReturnReviewEnumerationReceiptCommitment
      >[0],
    );
}

function recommitBatch(batch: MutableBatch): MutableBatch {
  const body = { ...batch } as typeof batch & { commitment?: unknown };
  Reflect.deleteProperty(body, "commitment");
  batch.commitment = realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment(
    body as unknown as Parameters<
      typeof realBuildPrefix50SubBuildReturnReviewBatchEnvelopeCommitment
    >[0],
  );
  return batch;
}

async function writeTemporaryInput(label: string, bytes: string): Promise<string> {
  const path = resolve(
    REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
    `compact-v2-${label}-${runId}.json`,
  );
  temporaryPaths.push(path);
  await writeFile(path, bytes, { flag: "wx" });
  return path;
}

beforeAll(async () => {
  const brand = __testOnly.brandReturnResultForReviewTests;
  if (brand === undefined) throw new Error("Step-44 result-brand test hook is unavailable.");
  brand(fullResult);
  fullBatch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(fullResult);
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
}, 120_000);

afterAll(async () => {
  for (const path of temporaryPaths) await rm(path, { force: true });
});

describe("prefix-50 Step-44 compact complete candidate-review batch", () => {
  it("keeps joint export materials byte-equivalent to the public review constructors", () => {
    const brand = __testOnly.brandReturnResultForReviewTests;
    const createMaterials = __testOnly.createReviewExportMaterialsForTest;
    if (brand === undefined || createMaterials === undefined)
      throw new Error("Step-44 review-material test hooks are unavailable.");
    const result = createStep44ReviewTestResult(3);
    brand(result);
    const joint = createMaterials(result);

    expect(joint.result).toBe(result);
    expect(joint.rosterSummary).toEqual(
      createRealBuildPrefix50SubBuildReturnReviewRosterSummary(result),
    );
    expect(joint.reviewBatch).toEqual(
      createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result),
    );
  });

  it("replays all 211 candidates exactly while storing the shared source document once", () => {
    const createCandidateEnvelope = __testOnly.createCandidateReviewEnvelopeForTest;
    if (createCandidateEnvelope === undefined)
      throw new Error("Step-44 candidate-review test hook is unavailable.");
    const bytes = Buffer.from(canonicalStringify(fullBatch));

    expect(fullBatch).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-subbuild-return-review-batch-input/2",
      authority: "none",
      selectionAuthority: false,
      fixturePromotionAuthority: false,
      candidateCount: 211,
      ordering: "candidate-key-lexicographic",
    });
    expect(bytes.byteLength).toBeLessThan(8 * 1024 * 1024);
    expect(bytes.byteLength).toBeLessThan(REAL_BUILD_PREFIX50_STEP44_MAXIMUM_COMPACT_BATCH_BYTES);
    expect(fullBatch.reviewReplayBaseDocument).toMatchObject({
      revision: expect.stringMatching(/^revision-step44-review-[0-9a-f]{24}$/u),
      parts: expect.arrayContaining([expect.objectContaining({ id: "part-280" })]),
    });
    expect(documentStructuralHash(fullBatch.reviewReplayBaseDocument)).toBe(
      fullResult.sourceDocumentHash,
    );
    expect(fullBatch.enumerationReceipt).toMatchObject({
      sourceDocumentHash: fullResult.sourceDocumentHash,
      childPartIds: fullResult.enumeration.childPartIds,
      counts: { accepted: 211, parentParts: 257, childParts: 23 },
    });
    expect(fullBatch.candidates.map(({ candidateKey }) => candidateKey)).toEqual(
      [...fullBatch.candidates.map(({ candidateKey }) => candidateKey)].sort(),
    );
    expect(fullBatch.candidates.every(({ operations }) => operations.length === 24)).toBe(true);
    for (const row of fullBatch.candidates) {
      const hydrated = hydrateRealBuildPrefix50Step44ReviewEnvelope(fullBatch, row);
      const expected = createCandidateEnvelope(fullResult, row.candidateKey);
      expect(hydrated).toEqual(expected);
    }
    expect(() => createCandidateEnvelope(fullResult, "0".repeat(64))).toThrow(
      /exact candidate from a complete/u,
    );
    expect(() => createRealBuildPrefix50SubBuildReturnReviewHarnessEnvelope(fullResult)).toThrow(
      /runtime-branded enumeration receipt/u,
    );
  }, 120_000);

  it("round-trips exact canonical bytes and rejects reordered, subset, and duplicate-key JSON", async () => {
    const canonical = canonicalStringify(fullBatch);
    const validPath = await writeTemporaryInput("valid", canonical);
    const read = await readRealBuildPrefix50Step44ReviewHarnessInput(
      validPath,
      inputDigest(canonical),
    );
    expect(read.input).toEqual(fullBatch);
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(validPath, `sha256:${"0".repeat(64)}`),
    ).rejects.toThrow(/externally pinned/u);

    const reordered = mutableBatch();
    reordered.candidates.reverse();
    recommitBatch(reordered);
    const reorderedPath = await writeTemporaryInput("reordered", canonicalStringify(reordered));
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(
        reorderedPath,
        inputDigest(canonicalStringify(reordered)),
      ),
    ).rejects.toThrow(/lexicographically ordered/u);

    const subset = mutableBatch();
    subset.candidates.pop();
    subset.candidateCount = 210;
    subset.candidateKeysCommitment = canonicalDigest(
      subset.candidates.map(({ candidateKey }) => candidateKey),
    );
    recommitBatch(subset);
    const subsetPath = await writeTemporaryInput("subset", canonicalStringify(subset));
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(
        subsetPath,
        inputDigest(canonicalStringify(subset)),
      ),
    ).rejects.toThrow(/complete bounded authority-none candidate roster/u);

    const whitespacePath = await writeTemporaryInput("whitespace", `${canonical}\n`);
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(whitespacePath, inputDigest(`${canonical}\n`)),
    ).rejects.toThrow(/exact canonical JSON bytes/u);
    const duplicateTopPath = await writeTemporaryInput(
      "duplicate-top",
      `{"authority":"none",${canonical.slice(1)}`,
    );
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(
        duplicateTopPath,
        inputDigest(`{"authority":"none",${canonical.slice(1)}`),
      ),
    ).rejects.toThrow(/exact canonical JSON bytes/u);
    const duplicateNestedPath = await writeTemporaryInput(
      "duplicate-nested",
      canonical.replace('"candidates":[{', '"candidates":[{"candidateKey":"invalid",'),
    );
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(
        duplicateNestedPath,
        inputDigest(
          canonical.replace('"candidates":[{', '"candidates":[{"candidateKey":"invalid",'),
        ),
      ),
    ).rejects.toThrow(/exact canonical JSON bytes/u);
    const duplicateTopInvalidPath = await writeTemporaryInput(
      "duplicate-top-invalid",
      `${canonical.slice(0, -1)},"authority":"caller"}`,
    );
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(
        duplicateTopInvalidPath,
        inputDigest(`${canonical.slice(0, -1)},"authority":"caller"}`),
      ),
    ).rejects.toThrow(/exact canonical JSON bytes/u);
    const firstCandidateKey = fullBatch.candidates[0]!.candidateKey;
    const duplicateNestedInvalidPath = await writeTemporaryInput(
      "duplicate-nested-invalid",
      canonical.replace(
        `"candidateKey":"${firstCandidateKey}"`,
        `"candidateKey":"${firstCandidateKey}","candidateKey":"invalid"`,
      ),
    );
    await expect(
      readRealBuildPrefix50Step44ReviewHarnessInput(
        duplicateNestedInvalidPath,
        inputDigest(
          canonical.replace(
            `"candidateKey":"${firstCandidateKey}"`,
            `"candidateKey":"${firstCandidateKey}","candidateKey":"invalid"`,
          ),
        ),
      ),
    ).rejects.toThrow(/exact canonical JSON bytes/u);
  }, 120_000);

  it("rejects recomputed replay, roster-index, revision, edge, key, and document tampering", () => {
    const hostileBatches: MutableBatch[] = [];

    const staleBefore = mutableBatch();
    const staleUpdate = staleBefore.candidates[0]!.operations.find(
      (operation) => operation.kind === "updatePart",
    );
    if (staleUpdate?.kind !== "updatePart") throw new Error("Missing synthetic updatePart.");
    staleUpdate.before.transform.positionLdu[0] =
      (staleUpdate.before.transform.positionLdu[0] ?? 0) + 1;
    recommitRow(staleBefore.candidates[0]!);
    hostileBatches.push(recommitBatch(staleBefore));

    const childMutation = mutableBatch();
    const childUpdate = childMutation.candidates[0]!.operations.find(
      (operation) => operation.kind === "updatePart",
    );
    if (childUpdate?.kind !== "updatePart") throw new Error("Missing synthetic updatePart.");
    childUpdate.after.colorId = "hostile-color";
    recommitRow(childMutation.candidates[0]!);
    hostileBatches.push(recommitBatch(childMutation));

    const internalEdge = mutableBatch();
    const addition = internalEdge.candidates[0]!.operations.find(
      (operation) => operation.kind === "addConnection",
    );
    if (addition?.kind !== "addConnection") throw new Error("Missing synthetic addConnection.");
    addition.connection.a.partId = "part-259";
    recommitRow(internalEdge.candidates[0]!);
    hostileBatches.push(recommitBatch(internalEdge));

    const revision = mutableBatch();
    revision.candidates[0]!.selectedDocumentRevision = `revision-${"f".repeat(24)}`;
    recommitRow(revision.candidates[0]!);
    hostileBatches.push(recommitBatch(revision));

    const operationOrder = mutableBatch();
    const operations = operationOrder.candidates[0]!.operations;
    const firstOperation = operations[0]!;
    operations[0] = operations[operations.length - 1]!;
    operations[operations.length - 1] = firstOperation;
    recommitRow(operationOrder.candidates[0]!);
    hostileBatches.push(recommitBatch(operationOrder));

    const operationIdentity = mutableBatch();
    operationIdentity.candidates[0]!.operations[0]!.operationId =
      "rigid-return-update-000000000000000000000000";
    recommitRow(operationIdentity.candidates[0]!);
    hostileBatches.push(recommitBatch(operationIdentity));

    const provenance = mutableBatch();
    const provenanceAddition = provenance.candidates[0]!.operations.find(
      (operation) => operation.kind === "addConnection",
    );
    if (provenanceAddition?.kind !== "addConnection")
      throw new Error("Missing synthetic addConnection.");
    provenanceAddition.connection.provenance = {
      source: "ai",
      sourceId: "rigid-return:hostile",
    };
    recommitRow(provenance.candidates[0]!);
    hostileBatches.push(recommitBatch(provenance));

    const duplicateIndex = mutableBatch();
    duplicateIndex.candidates[0]!.rosterIndex = duplicateIndex.candidates[1]!.rosterIndex;
    recommitRow(duplicateIndex.candidates[0]!);
    hostileBatches.push(recommitBatch(duplicateIndex));

    const staleKey = mutableBatch();
    staleKey.candidates[0]!.candidateKey = "0".repeat(64);
    recommitRow(staleKey.candidates[0]!);
    staleKey.candidateKeysCommitment = canonicalDigest(
      staleKey.candidates.map(({ candidateKey }) => candidateKey),
    );
    hostileBatches.push(recommitBatch(staleKey));

    const documentHash = mutableBatch();
    const rosterIndex = documentHash.candidates[0]!.rosterIndex;
    documentHash.rosterSummary.candidates[rosterIndex]!.selectedDocumentHash =
      canonicalDigest("hostile-document");
    recommitRoster(documentHash);
    hostileBatches.push(recommitBatch(documentHash));

    const childRoster = mutableBatch();
    childRoster.enumerationReceipt.childPartIds.reverse();
    recommitReceipt(childRoster);
    hostileBatches.push(recommitBatch(childRoster));

    const impossibleAccounting = mutableBatch();
    impossibleAccounting.enumerationReceipt.counts.connectorPairingChecks += 1;
    recommitReceipt(impossibleAccounting);
    hostileBatches.push(recommitBatch(impossibleAccounting));

    const groupDelta = mutableBatch();
    const groupRosterIndex = groupDelta.candidates[0]!.rosterIndex;
    const delta = groupDelta.rosterSummary.candidates[groupRosterIndex]!.groupDelta;
    delta.positionLdu[0] = (delta.positionLdu[0] ?? 0) + 20;
    const candidateRosterCommitment = canonicalDigest(
      groupDelta.rosterSummary.candidates.map(({ candidateKey, crossPorts, groupDelta }) => ({
        candidateKey,
        groupDelta,
        crossPorts,
      })),
    );
    groupDelta.rosterSummary.candidateRosterCommitment = candidateRosterCommitment;
    groupDelta.candidateRosterCommitment = candidateRosterCommitment;
    recommitRoster(groupDelta);
    hostileBatches.push(recommitBatch(groupDelta));

    for (const hostile of hostileBatches)
      expect(() => requireRealBuildPrefix50Step44ReviewBatchEnvelope(hostile)).toThrow();
  }, 120_000);

  it("keeps synthetic review results outside the production export boundary", async () => {
    await expect(exportRealBuildPrefix50Step44ReturnReviewArtifacts(fullResult)).rejects.toThrow(
      /runtime-branded enumeration receipt/u,
    );
    await expect(
      exportRealBuildPrefix50Step44ReturnReviewArtifacts({ ...fullResult }),
    ).rejects.toThrow(/runtime-branded enumeration receipt/u);
  });
});
