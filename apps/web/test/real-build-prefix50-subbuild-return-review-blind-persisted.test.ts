import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  createRealBuildPrefix50Step44BlindDispositionLane,
  createRealBuildPrefix50Step44FullResolutionOutcome,
  createRealBuildPrefix50Step44WithheldUnblindingMap,
  realBuildPrefix50Step44BlindTestOnly,
  requireRealBuildPrefix50Step44BlindDispatchPlan,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind";
import type { RealBuildPrefix50Step44BlindReviewPacket } from "../e2e/real-build-prefix50-subbuild-return-review-blind-contract";
import { requireRealBuildPrefix50Step44BlindPublicSuccessForPacket } from "../e2e/real-build-prefix50-subbuild-return-review-blind-io";
import {
  realBuildPrefix50Step44BlindPersistedTestOnly,
  requireRealBuildPrefix50Step44PersistedBlindClosure,
  writeRealBuildPrefix50Step44BlindLaneOutput,
  writeRealBuildPrefix50Step44FullResolutionOutput,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-persisted";
import { requireRealBuildPrefix50Step44BlindPromotionReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion";
import {
  readRealBuildPrefix50Step44WithheldUnblindingMap,
  requireRealBuildPrefix50Step44PersistedUnblindingMap,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-unblinding";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import {
  blindReviewTestDigest,
  createBlindReviewTestFullResolutionRows,
  createBlindReviewTestLaneRows,
  createBlindReviewTestPacket,
  type DeepMutable,
  recommitBlindReviewTestValue,
} from "./real-build-prefix50-subbuild-return-review-blind-test-support";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-support";

describe("prefix-50 Step-44 persisted blind-review bridge", () => {
  it("reopens isolated canonical lane/full-resolution files and rejects self-committed forgeries", async () => {
    const blindPacket = createBlindReviewTestPacket();
    const laneA = createRealBuildPrefix50Step44BlindDispositionLane({
      packet: blindPacket,
      lane: "lane-a",
      reviewerId: "reviewer-persisted-a",
      reviewSessionId: "session-persisted-a",
      rows: createBlindReviewTestLaneRows(["B001"]),
    });
    const laneB = createRealBuildPrefix50Step44BlindDispositionLane({
      packet: blindPacket,
      lane: "lane-b",
      reviewerId: "reviewer-persisted-b",
      reviewSessionId: "session-persisted-b",
      rows: createBlindReviewTestLaneRows(["B001"]),
    });
    const outcome = createRealBuildPrefix50Step44FullResolutionOutcome({
      packet: blindPacket,
      lanes: [laneA, laneB],
      fullResolutionReviews: createBlindReviewTestFullResolutionRows(
        blindPacket,
        ["B001"],
        ["B001"],
      ),
      disposition: {
        kind: "selected-one",
        blindId: "B001",
        note: "B001 is the sole fully observed page-45 survivor.",
      },
    });
    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-persisted-review-"));
    try {
      const publicRoot = resolve(root, "public");
      const laneARoot = resolve(root, "lane-a");
      const laneBRoot = resolve(root, "lane-b");
      const fullRoot = resolve(root, "full-resolution");
      await mkdir(publicRoot);
      await writeFile(
        resolve(publicRoot, "real-build-prefix50-step44-blind-review-packet.json"),
        canonicalStringify(blindPacket),
      );
      await writeRealBuildPrefix50Step44BlindLaneOutput({
        publicRoot,
        laneRoot: laneARoot,
        lane: laneA,
      });
      await writeRealBuildPrefix50Step44BlindLaneOutput({
        publicRoot,
        laneRoot: laneBRoot,
        lane: laneB,
      });
      await writeRealBuildPrefix50Step44FullResolutionOutput({
        publicRoot,
        fullResolutionRoot: fullRoot,
        outcome,
      });
      expect((await readdir(laneARoot)).sort()).toEqual([
        "real-build-prefix50-step44-blind-disposition.json",
        "real-build-prefix50-step44-blind-review-packet-copy.json",
      ]);
      expect((await readdir(laneBRoot)).sort()).toEqual([
        "real-build-prefix50-step44-blind-disposition.json",
        "real-build-prefix50-step44-blind-review-packet-copy.json",
      ]);
      const reopenedA = realBuildPrefix50Step44BlindPersistedTestOnly.readLane(
        laneARoot,
        blindPacket,
        "lane-a",
      );
      const reopenedB = realBuildPrefix50Step44BlindPersistedTestOnly.readLane(
        laneBRoot,
        blindPacket,
        "lane-b",
      );
      expect(
        realBuildPrefix50Step44BlindPersistedTestOnly.readOutcome(fullRoot, blindPacket, [
          reopenedA,
          reopenedB,
        ]).commitment,
      ).toBe(outcome.commitment);

      const forgedLane = structuredClone(laneA) as DeepMutable<typeof laneA>;
      forgedLane.rows.pop();
      recommitBlindReviewTestValue(forgedLane as unknown as { commitment: `sha256:${string}` });
      const forgedLaneRoot = resolve(root, "forged-lane");
      await mkdir(forgedLaneRoot);
      const constants = realBuildPrefix50Step44BlindPersistedTestOnly.constants;
      await writeFile(
        resolve(forgedLaneRoot, constants.PACKET_COPY_FILE),
        canonicalStringify(blindPacket),
      );
      await writeFile(resolve(forgedLaneRoot, constants.LANE_FILE), canonicalStringify(forgedLane));
      expect(() =>
        realBuildPrefix50Step44BlindPersistedTestOnly.readLane(
          forgedLaneRoot,
          blindPacket,
          "lane-a",
        ),
      ).toThrow(/header, attestation, or commitment|exact ordered B001\.\.B211|211 rows/u);

      const forgedOutcome = structuredClone(outcome) as DeepMutable<typeof outcome>;
      const firstRow = forgedOutcome.fullResolutionReviews[0]!;
      [firstRow.criteria[0], firstRow.criteria[1]] = [firstRow.criteria[1]!, firstRow.criteria[0]!];
      recommitBlindReviewTestValue(firstRow as unknown as { commitment: `sha256:${string}` });
      recommitBlindReviewTestValue(forgedOutcome as unknown as { commitment: `sha256:${string}` });
      const forgedFullRoot = resolve(root, "forged-full");
      await mkdir(forgedFullRoot);
      await writeFile(
        resolve(forgedFullRoot, constants.FULL_RESOLUTION_FILE),
        canonicalStringify(forgedOutcome),
      );
      expect(() =>
        realBuildPrefix50Step44BlindPersistedTestOnly.readOutcome(fullRoot, blindPacket, [
          reopenedA,
          reopenedB,
        ]),
      ).not.toThrow();
      expect(() =>
        realBuildPrefix50Step44BlindPersistedTestOnly.readOutcome(forgedFullRoot, blindPacket, [
          reopenedA,
          reopenedB,
        ]),
      ).toThrow(/criterion|full-resolution outcome/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unbranded closure, map, and promotion lookalikes", () => {
    expect(() =>
      requireRealBuildPrefix50Step44BlindPublicSuccessForPacket(createBlindReviewTestPacket()),
    ).toThrow(/runtime-branded by its exact root COMPLETE reader/u);
    expect(() => requireRealBuildPrefix50Step44PersistedBlindClosure({} as never)).toThrow(
      /runtime-branded persisted closure/u,
    );
    expect(() => requireRealBuildPrefix50Step44PersistedUnblindingMap({} as never)).toThrow(
      /runtime-branded withheld map/u,
    );
    expect(() => requireRealBuildPrefix50Step44BlindPromotionReceipt({} as never)).toThrow(
      /persisted promotion reader brand/u,
    );
  });

  it("rejects a self-recommitted withheld map whose blind rows were swapped", async () => {
    const result = createStep44ReviewTestResult(211);
    const brand = __testOnly.brandReturnResultForReviewTests;
    if (brand === undefined) throw new Error("Step-44 result brand test hook is unavailable.");
    brand(result);
    const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
    const plan = realBuildPrefix50Step44BlindTestOnly.createDispatchPlan(
      batch,
      new Uint8Array(32).fill(0x44),
    );
    const publicPacketCoreCommitment = blindReviewTestDigest("map-test-public-core");
    const publicRows = plan.assignments.map(({ blindId }, index) => ({
      blindId,
      cells: [{ commitment: blindReviewTestDigest(`map-test-${index}-cell`) }],
      fixedCameraEvidence: { commitment: blindReviewTestDigest(`map-test-${index}-fixed`) },
    }));
    const capturesFor = (dispatchPlan: typeof plan) =>
      dispatchPlan.assignments.map(({ blindId, batchIndex }, index) => {
        const compact = batch.candidates[batchIndex]!;
        const roster = batch.rosterSummary.candidates[compact.rosterIndex]!;
        const captureManifestByteDigest = blindReviewTestDigest(`map-test-${index}-manifest-bytes`);
        const captureManifestCommitment = blindReviewTestDigest(`map-test-${index}-manifest`);
        const sourceRowCommitment = canonicalDigest({
          blindId,
          batchIndex,
          captureManifestByteDigest,
          captureManifestCommitment,
          reviewHarnessEnvelopeCommitment: roster.reviewHarnessEnvelopeCommitment,
          candidateKey: compact.candidateKey,
          selectedDocumentHash: roster.selectedDocumentHash,
          cells: publicRows[index]!.cells.map(({ commitment }) => commitment),
          fixedCameraEvidenceCommitment: publicRows[index]!.fixedCameraEvidence.commitment,
        });
        return {
          blindId,
          batchIndex,
          artifactDirectory: blindId,
          rosterIndex: compact.rosterIndex,
          candidateKey: compact.candidateKey,
          operationsCommitment: compact.operationsCommitment,
          compactCandidateCommitment: compact.commitment,
          selectedDocumentHash: roster.selectedDocumentHash,
          selectedDocumentCommitment: roster.selectedDocumentCommitment,
          reviewHarnessEnvelopeCommitment: roster.reviewHarnessEnvelopeCommitment,
          captureManifestFile: "capture-manifest.json",
          captureManifestByteDigest,
          captureManifestCommitment,
          sourceRowCommitment,
        };
      });
    const captures = capturesFor(plan);
    const swappedPlan = structuredClone(plan) as DeepMutable<typeof plan>;
    const first = swappedPlan.assignments[0]!;
    const second = swappedPlan.assignments[1]!;
    [first.batchIndex, second.batchIndex] = [second.batchIndex, first.batchIndex];
    [first.rankDigest, second.rankDigest] = [second.rankDigest, first.rankDigest];
    recommitBlindReviewTestValue(swappedPlan);
    const swappedMap = createRealBuildPrefix50Step44WithheldUnblindingMap({
      batch,
      plan: swappedPlan,
      captures: capturesFor(swappedPlan),
      publicPacketCoreCommitment,
    });
    expect(swappedMap.dispatchPlanCommitment).toBe(swappedPlan.commitment);
    expect(() => requireRealBuildPrefix50Step44BlindDispatchPlan(swappedPlan, batch)).toThrow(
      /exact seed-ranked batch permutation/u,
    );
    const map = createRealBuildPrefix50Step44WithheldUnblindingMap({
      batch,
      plan,
      captures,
      publicPacketCoreCommitment,
    });
    const mapPacket = {
      publicPacketCoreCommitment,
      withheldUnblindingMapCommitment: map.commitment,
      pages: [{ rows: publicRows }],
    } as unknown as RealBuildPrefix50Step44BlindReviewPacket;
    const root = await mkdtemp(resolve(tmpdir(), "lego-step44-unblinding-"));
    try {
      const validRoot = resolve(root, "valid");
      const forgedRoot = resolve(root, "forged");
      await mkdir(validRoot);
      await mkdir(forgedRoot);
      const mapFile = "real-build-prefix50-step44-unblinding-map.json";
      await writeFile(resolve(validRoot, mapFile), canonicalStringify(map));
      expect(() =>
        readRealBuildPrefix50Step44WithheldUnblindingMap({
          withheldRoot: validRoot,
          packet: mapPacket,
          batch,
          publicationComplete: {} as never,
        }),
      ).toThrow(/root COMPLETE receipt/u);
      const forged = structuredClone(map) as DeepMutable<typeof map>;
      [forged.rows[0], forged.rows[1]] = [forged.rows[1]!, forged.rows[0]!];
      recommitBlindReviewTestValue(forged as unknown as { commitment: `sha256:${string}` });
      const forgedPacket = {
        ...mapPacket,
        withheldUnblindingMapCommitment: forged.commitment,
      } as RealBuildPrefix50Step44BlindReviewPacket;
      await writeFile(resolve(forgedRoot, mapFile), canonicalStringify(forged));
      expect(() =>
        readRealBuildPrefix50Step44WithheldUnblindingMap({
          withheldRoot: forgedRoot,
          packet: forgedPacket,
          batch,
          publicationComplete: {} as never,
        }),
      ).toThrow(/root COMPLETE receipt/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
