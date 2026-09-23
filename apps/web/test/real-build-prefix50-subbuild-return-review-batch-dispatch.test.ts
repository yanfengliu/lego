import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "../e2e/real-build-prefix50-subbuild-return";
import {
  createRealBuildPrefix50Step44BlindDispatchPlan,
  realBuildPrefix50Step44BlindTestOnly,
  realBuildPrefix50Step44BlindId,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind";
import { dispatchRealBuildPrefix50Step44BlindBatch } from "../e2e/real-build-prefix50-subbuild-return-review-batch-dispatch";
import { deriveRealBuildPrefix50Step44Page45CameraInstrument } from "../e2e/real-build-prefix50-subbuild-return-review-camera";
import type { RealBuildPrefix50Step44CandidateCaptureSummary } from "../e2e/real-build-prefix50-subbuild-return-review-capture";
import { writeRealBuildPrefix50Step44ReviewContactSheets } from "../e2e/real-build-prefix50-subbuild-return-review-contact-sheet";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
  runRealBuildPrefix50Step44ReviewTransaction,
} from "../e2e/real-build-prefix50-subbuild-return-review-transaction";
import { readRealBuildPrefix50Step44ProductionTransactionBindingForTest } from "../e2e/real-build-prefix50-subbuild-return-review-transaction-production";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-support";
import { __testOnly } from "../e2e/real-build-prefix50-subbuild-return";

function summary(input: {
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
}): RealBuildPrefix50Step44CandidateCaptureSummary {
  return {
    ...input,
    schemaVersion: "lego.real-build-prefix50-step44-candidate-capture-summary/3",
    scene: "model-only",
    captureManifestFile: "real-build-prefix50-step44-capture-manifest.json",
    captureManifestByteDigest: canonicalDigest([input.candidateKey, "manifest-bytes"]),
    captureManifestCommitment: canonicalDigest([input.candidateKey, "manifest"]),
    viewPacketCommitment: canonicalDigest([input.candidateKey, "views"]),
    renderPacketCommitment: canonicalDigest([input.candidateKey, "render"]),
    cameraCommitments: {},
    captureRows: {},
    captureSceneCommitment: canonicalDigest([input.candidateKey, "scene"]),
    page45CameraReceiptCommitment: canonicalDigest("page45-camera"),
    fixedCameraBaselineCommitment: canonicalDigest("baseline"),
    fixedCameraBaselineArtifactCommitment: canonicalDigest("baseline-artifact"),
    fixedCameraAfterCommitment: canonicalDigest([input.candidateKey, "after"]),
    fixedCameraDeltaCommitment: canonicalDigest([input.candidateKey, "delta"]),
    fixedCameraDeltaArtifactCommitment: canonicalDigest([input.candidateKey, "delta-artifact"]),
  };
}

function batchAndPlan() {
  const result = createStep44ReviewTestResult(211);
  const brand = __testOnly.brandReturnResultForReviewTests;
  if (brand === undefined) throw new Error("Step-44 result-brand test hook is unavailable.");
  brand(result);
  const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
  const plan = realBuildPrefix50Step44BlindTestOnly.createDispatchPlan(
    batch,
    new Uint8Array(32).fill(17),
  );
  return { batch, plan };
}

describe("prefix-50 Step-44 callback-driven blind batch dispatch", () => {
  it("pins the production wrapper to the shared transaction and immutable exact-211 dependencies", () => {
    const binding = readRealBuildPrefix50Step44ProductionTransactionBindingForTest();
    expect(binding.sharedTransactionRunner).toBe(runRealBuildPrefix50Step44ReviewTransaction);
    expect(binding.definition).toMatchObject({
      mode: "production-211",
      captureCount: 211,
      publicManifestFile: "real-build-prefix50-step44-public-batch-manifest.json",
      withheldManifestFile: "real-build-prefix50-step44-withheld-batch-capture-manifest.json",
      successFile: "real-build-prefix50-step44-public-harness-success.json",
      completeFile: REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
    });
    expect(binding.definition.deriveCamera).toBe(
      deriveRealBuildPrefix50Step44Page45CameraInstrument,
    );
    expect(binding.definition.dispatch).toBe(dispatchRealBuildPrefix50Step44BlindBatch);
    expect(binding.definition.composeContact).toBe(writeRealBuildPrefix50Step44ReviewContactSheets);
    expect(binding.definition.runLifecycle).toBeUndefined();
    expect(Object.isFrozen(binding.definition)).toBe(true);
    expect(binding.cameraDependency).toBe(binding.definition.deriveCamera);
    expect(binding.dispatchDependency).toBe(binding.definition.dispatch);
    expect(binding.contactDependency).toBe(binding.definition.composeContact);
  });

  it("keeps deterministic seed injection behind the test-only boundary", () => {
    const { batch } = batchAndPlan();
    const invokeWithSeed = createRealBuildPrefix50Step44BlindDispatchPlan as unknown as (
      exactBatch: typeof batch,
      forbiddenSeed: Uint8Array,
    ) => unknown;
    expect(() => invokeWithSeed(batch, new Uint8Array(32))).toThrow(/closed batch input/u);
  }, 60_000);

  it("hydrates and captures exact 211 shuffled rows in B001..B211 order before one contact handoff", async () => {
    const { batch, plan } = batchAndPlan();
    const calls: { blindId: string; batchIndex: number; candidateKey: string }[] = [];
    let composeCalls = 0;
    const result = await dispatchRealBuildPrefix50Step44BlindBatch({
      batch,
      plan,
      capture: async ({ blindId, batchIndex, envelope }) => {
        calls.push({ blindId, batchIndex, candidateKey: envelope.candidateKey });
        return summary({
          ...envelope,
          reviewHarnessEnvelopeCommitment: envelope.commitment,
        });
      },
      compose: async ({ captures }) => {
        composeCalls += 1;
        expect(captures).toHaveLength(211);
        expect(captures.map(({ blindId }) => blindId)).toEqual(
          Array.from({ length: 211 }, (_, index) => realBuildPrefix50Step44BlindId(index)),
        );
        return canonicalDigest(
          captures.map(({ captureManifestCommitment }) => captureManifestCommitment),
        );
      },
    });
    expect(calls).toHaveLength(211);
    expect(composeCalls).toBe(1);
    expect(new Set(calls.map(({ batchIndex }) => batchIndex)).size).toBe(211);
    expect(calls.map(({ batchIndex }) => batchIndex)).toEqual(
      plan.assignments.map(({ batchIndex }) => batchIndex),
    );
    expect(calls.some(({ batchIndex }, index) => batchIndex !== index)).toBe(true);
    expect(result.captures[0]).toMatchObject({
      blindId: "B001",
      batchIndex: plan.assignments[0]!.batchIndex,
      artifactDirectory: "B001",
    });
  }, 60_000);

  it("rejects a drifted capture binding before contact composition", async () => {
    const { batch, plan } = batchAndPlan();
    let composeCalls = 0;
    await expect(
      dispatchRealBuildPrefix50Step44BlindBatch({
        batch,
        plan,
        capture: async ({ blindId, envelope }) =>
          summary({
            ...envelope,
            reviewHarnessEnvelopeCommitment: envelope.commitment,
            candidateKey: blindId === "B017" ? `${envelope.candidateKey}0` : envelope.candidateKey,
          }),
        compose: async () => {
          composeCalls += 1;
          return null;
        },
      }),
    ).rejects.toThrow(/B017.*hydrated envelope/u);
    expect(composeCalls).toBe(0);
  }, 60_000);
});
