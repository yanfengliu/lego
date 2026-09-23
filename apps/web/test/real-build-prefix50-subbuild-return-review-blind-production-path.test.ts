import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  createRealBuildPrefix50Step44BlindDispositionLane,
  createRealBuildPrefix50Step44FullResolutionOutcome,
  realBuildPrefix50Step44BlindTestOnly,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind";
import type { RealBuildPrefix50Step44BlindReviewPacket } from "../e2e/real-build-prefix50-subbuild-return-review-blind-contract";
import {
  readRealBuildPrefix50Step44CompletedBlindRun,
  readRealBuildPrefix50Step44BlindReviewPacket,
  requireRealBuildPrefix50Step44BlindPublicSuccessForPacket,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-io";
import {
  createRealBuildPrefix50Step44BlindReviewClosure,
  readRealBuildPrefix50Step44PersistedBlindClosure,
  writeRealBuildPrefix50Step44BlindLaneOutput,
  writeRealBuildPrefix50Step44FullResolutionOutput,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-persisted";
import { createRealBuildPrefix50Step44BlindPromotionReceipt } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion";
import { verifyRealBuildPrefix50Step44ProductionCaptureChain } from "../e2e/real-build-prefix50-subbuild-return-review-blind-production-chain";
import { readRealBuildPrefix50Step44PublicationComplete } from "../e2e/real-build-prefix50-subbuild-return-review-blind-publication-complete";
import { readRealBuildPrefix50Step44WithheldUnblindingMap } from "../e2e/real-build-prefix50-subbuild-return-review-blind-unblinding";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE,
  REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-success";
import { REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE } from "../e2e/real-build-prefix50-subbuild-return-review-transaction";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  selectBlindReviewedRealBuildPrefix50SubBuildReturn,
} from "../e2e/real-build-prefix50-subbuild-return";
import {
  blindReviewTestCriteria,
  blindReviewTestDigest,
  createBlindReviewTestFullResolutionRows,
  createBlindReviewTestLaneRows,
  type DeepMutable,
  recommitBlindReviewTestPacket,
  recommitBlindReviewTestValue,
} from "./real-build-prefix50-subbuild-return-review-blind-test-support";
import {
  createBlindProductionReviewTree,
  writeBlindProductionPublicEnvelope,
} from "./real-build-prefix50-subbuild-return-review-blind-production-tree";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-result";
import { createUnbrandedRealDomainQualificationForNegativeTest } from "./real-build-prefix50-real-domain-qualification-negative-test-support.ts";

async function directoryIdentity(path: string) {
  const stats = await lstat(path, { bigint: true });
  return {
    lexicalPath: path,
    realPath: await realpath(path),
    device: stats.dev.toString(10),
    inode: stats.ino.toString(10),
  };
}

describe("prefix-50 Step-44 production blind-review promotion path", () => {
  it("refuses a self-consistent synthetic production tree and every persisted trust-boundary mutation", async () => {
    const reviewRoot = await mkdtemp(resolve(tmpdir(), "lego-step44-production-blind-"));
    try {
      const result = createStep44ReviewTestResult(211);
      const brand = __testOnly.brandReturnResultForReviewTests;
      if (brand === undefined) throw new Error("Step-44 result brand test hook is unavailable.");
      brand(result);
      const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
      const realDomainQualification = createUnbrandedRealDomainQualificationForNegativeTest(
        batch.commitment,
      );
      const plan = realBuildPrefix50Step44BlindTestOnly.createDispatchPlan(
        batch,
        new Uint8Array(32).fill(0x5a),
      );
      const tree = await createBlindProductionReviewTree({ reviewRoot, batch, plan });
      const completed = readRealBuildPrefix50Step44CompletedBlindRun({
        reviewRoot,
        publicRoot: tree.layout.publicRoot,
        withheldRoot: resolve(reviewRoot, "withheld"),
        batch,
      });
      const { packet, publicSuccess: success, publicationComplete } = completed;
      expect(success.status).toBe("complete");
      expect(requireRealBuildPrefix50Step44BlindPublicSuccessForPacket(packet)).toBe(success);
      const completePath = resolve(
        reviewRoot,
        REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
      );
      const completeBytes = await readFile(completePath);
      const cloneRoot = resolve(reviewRoot, "cloned-run");
      const clonePublicRoot = resolve(cloneRoot, "public");
      const cloneWithheldRoot = resolve(cloneRoot, "withheld");
      await mkdir(clonePublicRoot, { recursive: true });
      await mkdir(cloneWithheldRoot);
      await Promise.all([
        copyFile(
          resolve(tree.layout.publicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE),
          resolve(clonePublicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_MANIFEST_FILE),
        ),
        copyFile(
          resolve(tree.layout.publicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE),
          resolve(clonePublicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE),
        ),
        copyFile(
          resolve(
            reviewRoot,
            "withheld/real-build-prefix50-step44-withheld-batch-capture-manifest.json",
          ),
          resolve(
            cloneWithheldRoot,
            "real-build-prefix50-step44-withheld-batch-capture-manifest.json",
          ),
        ),
        copyFile(
          resolve(reviewRoot, "withheld/real-build-prefix50-step44-unblinding-map.json"),
          resolve(cloneWithheldRoot, "real-build-prefix50-step44-unblinding-map.json"),
        ),
      ]);
      const cloneMarker = JSON.parse(completeBytes.toString("utf8")) as Record<string, unknown>;
      cloneMarker.publicationDirectories = {
        run: await directoryIdentity(cloneRoot),
        public: await directoryIdentity(clonePublicRoot),
        withheld: await directoryIdentity(cloneWithheldRoot),
      };
      Reflect.deleteProperty(cloneMarker, "commitment");
      cloneMarker.commitment = canonicalDigest(cloneMarker);
      await writeFile(
        resolve(cloneRoot, REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE),
        canonicalStringify(cloneMarker),
      );
      const cloneComplete = readRealBuildPrefix50Step44PublicationComplete({
        reviewRoot: cloneRoot,
        publicRoot: clonePublicRoot,
        withheldRoot: cloneWithheldRoot,
        success,
        batch,
      });
      expect(cloneComplete.commitment).not.toBe(publicationComplete.commitment);
      const originalMap = readRealBuildPrefix50Step44WithheldUnblindingMap({
        withheldRoot: resolve(reviewRoot, "withheld"),
        packet,
        batch,
        publicationComplete,
      });
      await expect(
        verifyRealBuildPrefix50Step44ProductionCaptureChain({
          publicRoot: clonePublicRoot,
          withheldRoot: cloneWithheldRoot,
          packet,
          success,
          batch,
          map: originalMap,
          publicationComplete: cloneComplete,
          realDomainQualification,
        }),
      ).rejects.toThrow(/persisted map belongs to another exact COMPLETE receipt/u);
      const cloneMap = readRealBuildPrefix50Step44WithheldUnblindingMap({
        withheldRoot: cloneWithheldRoot,
        packet,
        batch,
        publicationComplete: cloneComplete,
      });
      await expect(
        verifyRealBuildPrefix50Step44ProductionCaptureChain({
          publicRoot: clonePublicRoot,
          withheldRoot: cloneWithheldRoot,
          packet,
          success,
          batch,
          map: cloneMap,
          publicationComplete: cloneComplete,
          realDomainQualification,
        }),
      ).rejects.toThrow(/packet's exact completed-run receipt/u);

      const laneA = createRealBuildPrefix50Step44BlindDispositionLane({
        packet,
        lane: "lane-a",
        reviewerId: "independent-reviewer-alpha",
        reviewSessionId: "independent-session-alpha",
        rows: createBlindReviewTestLaneRows(["B001"]),
      });
      const laneB = createRealBuildPrefix50Step44BlindDispositionLane({
        packet,
        lane: "lane-b",
        reviewerId: "independent-reviewer-beta",
        reviewSessionId: "independent-session-beta",
        rows: createBlindReviewTestLaneRows(["B001"]),
      });
      const outcome = createRealBuildPrefix50Step44FullResolutionOutcome({
        packet,
        lanes: [laneA, laneB],
        fullResolutionReviews: createBlindReviewTestFullResolutionRows(packet, ["B001"], ["B001"]),
        disposition: {
          kind: "selected-one",
          blindId: "B001",
          note: "B001 is the sole fully observed page-45 survivor.",
        },
      });
      await writeRealBuildPrefix50Step44BlindLaneOutput({
        publicRoot: tree.layout.publicRoot,
        laneRoot: tree.layout.laneARoot,
        lane: laneA,
      });
      await writeRealBuildPrefix50Step44BlindLaneOutput({
        publicRoot: tree.layout.publicRoot,
        laneRoot: tree.layout.laneBRoot,
        lane: laneB,
      });
      await writeRealBuildPrefix50Step44FullResolutionOutput({
        publicRoot: tree.layout.publicRoot,
        fullResolutionRoot: tree.layout.fullResolutionRoot,
        outcome,
      });
      await unlink(completePath);
      await expect(
        createRealBuildPrefix50Step44BlindReviewClosure(tree.layout, batch),
      ).rejects.toThrow();
      await writeFile(completePath, completeBytes, { flag: "wx" });
      const closure = await createRealBuildPrefix50Step44BlindReviewClosure(tree.layout, batch);
      expect(readRealBuildPrefix50Step44PersistedBlindClosure(tree.layout, batch).commitment).toBe(
        closure.commitment,
      );
      expect(
        readRealBuildPrefix50Step44WithheldUnblindingMap({
          withheldRoot: resolve(reviewRoot, "withheld"),
          packet,
          batch,
          publicationComplete,
        }).commitment,
      ).toBe(tree.map.commitment);
      const foreignWithheldRoot = resolve(reviewRoot, "foreign-withheld");
      await mkdir(foreignWithheldRoot);
      expect(() =>
        readRealBuildPrefix50Step44WithheldUnblindingMap({
          withheldRoot: foreignWithheldRoot,
          packet,
          batch,
          publicationComplete,
        }),
      ).toThrow(/committed directory identity|exact committed directory identity/u);

      await expect(
        createRealBuildPrefix50Step44BlindPromotionReceipt({
          layout: tree.layout,
          withheldRoot: resolve(reviewRoot, "withheld"),
          repositoryRoot: resolve("."),
          batch,
          result,
          realDomainQualification,
        }),
      ).rejects.toThrow(/opaque live finalization capability/u);

      const rendererTamper = structuredClone(packet) as DeepMutable<typeof packet>;
      rendererTamper.reference.rendererVersion = "Poppler 24.08.0";
      recommitBlindReviewTestPacket(rendererTamper);
      await writeBlindProductionPublicEnvelope({
        publicRoot: tree.layout.publicRoot,
        withheldRoot: resolve(reviewRoot, "withheld"),
        packet: rendererTamper,
        batch,
        plan,
        map: tree.map,
      });
      expect(() => readRealBuildPrefix50Step44BlindReviewPacket(tree.layout.publicRoot)).toThrow(
        /exact page-45 crop contract/u,
      );
      await writeBlindProductionPublicEnvelope({
        publicRoot: tree.layout.publicRoot,
        withheldRoot: resolve(reviewRoot, "withheld"),
        packet,
        batch,
        plan,
        map: tree.map,
      });

      const nonUnionDeltaTamper = structuredClone(packet) as DeepMutable<typeof packet>;
      const nonUnionFixed = nonUnionDeltaTamper.pages[13]!.rows[2]!.fixedCameraEvidence;
      nonUnionFixed.changedPixelCount = 1;
      nonUnionFixed.changedPixelBounds = {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 1,
        height: 1,
      };
      recommitBlindReviewTestPacket(nonUnionDeltaTamper);
      await writeBlindProductionPublicEnvelope({
        publicRoot: tree.layout.publicRoot,
        withheldRoot: resolve(reviewRoot, "withheld"),
        packet: nonUnionDeltaTamper,
        batch,
        plan,
        map: tree.map,
      });
      expect(() => readRealBuildPrefix50Step44BlindReviewPacket(tree.layout.publicRoot)).toThrow(
        /B211 fixed-camera delta was not recomputed/u,
      );
      await writeBlindProductionPublicEnvelope({
        publicRoot: tree.layout.publicRoot,
        withheldRoot: resolve(reviewRoot, "withheld"),
        packet,
        batch,
        plan,
        map: tree.map,
      });

      const successTamper = JSON.parse(tree.successBytes) as {
        cleanup: { serverClosed: boolean };
        commitment: `sha256:${string}`;
        [key: string]: unknown;
      };
      successTamper.cleanup.serverClosed = false;
      recommitBlindReviewTestValue(successTamper);
      await writeFile(
        resolve(tree.layout.publicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE),
        canonicalStringify(successTamper),
      );
      expect(() =>
        readRealBuildPrefix50Step44CompletedBlindRun({
          reviewRoot,
          publicRoot: tree.layout.publicRoot,
          withheldRoot: resolve(reviewRoot, "withheld"),
          batch,
        }),
      ).toThrow(/post-cleanup 211-capture success receipt/u);
      await writeFile(
        resolve(tree.layout.publicRoot, REAL_BUILD_PREFIX50_STEP44_PUBLIC_SUCCESS_FILE),
        tree.successBytes,
      );

      const closureTamper = structuredClone(closure) as DeepMutable<typeof closure>;
      if (closureTamper.disposition.kind !== "selected-one")
        throw new Error("Step-44 positive closure unexpectedly refused.");
      closureTamper.disposition.note = "A self-committed but forged closure note.";
      recommitBlindReviewTestValue(closureTamper);
      await writeFile(
        resolve(tree.layout.closureRoot, "real-build-prefix50-step44-blind-review-closure.json"),
        canonicalStringify(closureTamper),
      );
      expect(() => readRealBuildPrefix50Step44PersistedBlindClosure(tree.layout, batch)).toThrow(
        /persisted blind closure drifted/u,
      );
      await writeFile(
        resolve(tree.layout.closureRoot, "real-build-prefix50-step44-blind-review-closure.json"),
        canonicalStringify(closure),
      );

      const mapTamper = structuredClone(tree.map) as DeepMutable<typeof tree.map>;
      mapTamper.rows[0]!.sourceRowCommitment = blindReviewTestDigest("forged-selected-source-row");
      recommitBlindReviewTestValue(mapTamper.rows[0]!);
      recommitBlindReviewTestValue(mapTamper);
      await writeFile(
        resolve(reviewRoot, "withheld/real-build-prefix50-step44-unblinding-map.json"),
        canonicalStringify(mapTamper),
      );
      expect(() =>
        readRealBuildPrefix50Step44WithheldUnblindingMap({
          withheldRoot: resolve(reviewRoot, "withheld"),
          packet: {
            ...packet,
            withheldUnblindingMapCommitment: mapTamper.commitment,
          } as RealBuildPrefix50Step44BlindReviewPacket,
          batch,
          publicationComplete,
        }),
      ).toThrow(/withheld map row B001/u);
      await writeFile(
        resolve(reviewRoot, "withheld/real-build-prefix50-step44-unblinding-map.json"),
        canonicalStringify(tree.map),
      );

      expect(() =>
        selectBlindReviewedRealBuildPrefix50SubBuildReturn({
          result: structuredClone(result),
          layout: tree.layout,
          withheldRoot: resolve(reviewRoot, "withheld"),
          repositoryRoot: resolve("."),
          batch,
          realDomainQualification,
        }),
      ).toThrow(/runtime-branded enumeration receipt/u);
      expect(
        outcome.fullResolutionReviews[0]!.criteria.every(({ outcome: value }) => value === "same"),
      ).toBe(true);
      expect(blindReviewTestCriteria("same")).toHaveLength(6);
    } finally {
      await rm(reviewRoot, { recursive: true, force: true });
    }
  }, 240_000);
});
