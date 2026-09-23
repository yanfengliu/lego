import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it, vi } from "vitest";

import {
  REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE,
  writeRealBuildPrefix50Step44PromotionArtifacts,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-artifacts";
import { createRealBuildPrefix50Step44ProductionPromotionAuthority } from "../e2e/real-build-prefix50-subbuild-return-review-blind-promotion-authority";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-replay";
import { REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE } from "../e2e/real-build-prefix50-subbuild-return-review-source-locked-production";
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-result";
import { withRealStep44SourceLock } from "./real-build-prefix50-source-lock-test-helper";

vi.mock("../e2e/real-build-prefix50-subbuild-return", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requireRealBuildPrefix50SubBuildReturnResult: (value: unknown) => value,
}));
vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-blind-persisted",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    requireRealBuildPrefix50Step44PersistedPromotionEvidence: () => undefined,
  }),
);
vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-blind-production-chain",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    requireRealBuildPrefix50Step44ProductionCaptureChain: () => undefined,
  }),
);
vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-blind-publication-complete",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    requireRealBuildPrefix50Step44PublicationComplete: () => undefined,
  }),
);
vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-blind-provenance",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    requireRealBuildPrefix50Step44PhysicalPage45Verification: () => undefined,
  }),
);
vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-blind-unblinding",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    requireRealBuildPrefix50Step44PersistedUnblindingMap: () => undefined,
  }),
);

const repositoryRoot = resolve(".");
const digest = (label: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(label).digest("hex")}`;
const logical = (path: string): string => relative(repositoryRoot, path).replaceAll("\\", "/");

function noReceipt(path: string): void {
  expect(existsSync(resolve(path, REAL_BUILD_PREFIX50_STEP44_PROMOTION_RECEIPT_FILE))).toBe(false);
}

describe.runIf(process.platform === "win32")(
  "prefix-50 Step-44 promotion publication directory integration",
  () => {
    it("publishes no authority receipt across ordinary and junction replacement attempts after payload", async () => {
      mkdirSync(resolve(repositoryRoot, "tmp"), { recursive: true });
      const root = mkdtempSync(resolve(repositoryRoot, "tmp/step44-promotion-integration-"));
      const reviewRoot = resolve(root, "review");
      const promotionRoot = resolve(reviewRoot, "promotion");
      const publicRoot = resolve(reviewRoot, "public");
      const withheldRoot = resolve(reviewRoot, "withheld");
      const rawRoot = resolve(root, "raw");
      const batchPath = resolve(root, "batch.json");
      const productionReceiptPath = resolve(
        reviewRoot,
        REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_PRODUCTION_FILE,
      );
      for (const path of [promotionRoot, publicRoot, withheldRoot, rawRoot])
        mkdirSync(path, { recursive: true });
      writeFileSync(resolve(publicRoot, "capture.json"), "public-capture");
      writeFileSync(resolve(withheldRoot, "capture.json"), "withheld-capture");
      writeFileSync(resolve(rawRoot, "lane.json"), "raw-lane");
      writeFileSync(productionReceiptPath, "prior-production-receipt");
      const result = createStep44ReviewTestResult(211);
      const brand = __testOnly.brandReturnResultForReviewTests;
      if (brand === undefined) throw new Error("Step-44 review result test brand is unavailable.");
      brand(result);
      const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
      writeFileSync(batchPath, canonicalStringify(batch));
      const compact = batch.candidates[0]!;
      const selectedEnvelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, compact);
      const selectedDocument = selectedEnvelope.selectedDocument;
      const roots = [batchPath, rawRoot, publicRoot, withheldRoot, productionReceiptPath]
        .map(logical)
        .sort((left, right) => left.localeCompare(right));
      try {
        await withRealStep44SourceLock({
          repositoryRoot,
          operationInputRoots: roots,
          batchInputPath: logical(batchPath),
          action: async (capability) => {
            const mapRow = {
              blindId: "B001" as const,
              batchIndex: 0,
              rosterIndex: compact.rosterIndex,
              candidateKey: compact.candidateKey,
              selectedDocumentHash: selectedEnvelope.selectedDocumentHash,
              selectedDocumentCommitment: canonicalDigest(selectedDocument),
              reviewHarnessEnvelopeCommitment: selectedEnvelope.commitment,
              compactCandidateCommitment: compact.commitment,
              captureManifestCommitment: digest("capture-manifest"),
              sourceRowCommitment: digest("source-row"),
              commitment: digest("map-row"),
            };
            const publicationComplete = {
              commitment: digest("publication-complete"),
              publicationDirectories: { withheld: { lexicalPath: withheldRoot } },
            };
            const map = { rows: [mapRow], commitment: digest("map") };
            const closure = {
              disposition: {
                kind: "selected-one" as const,
                blindId: "B001" as const,
                note: "Sole six-criterion integration-test survivor.",
              },
              laneCommitments: [digest("lane-a"), digest("lane-b")] as const,
              publicPixelVerificationCommitment: digest("pixels"),
              commitment: digest("closure"),
            };
            const evidence = {
              closure,
              outcome: {
                fullResolutionReviews: [
                  {
                    blindId: "B001",
                    survives: true,
                    criteria: Array.from({ length: 6 }, () => ({ outcome: "same" as const })),
                  },
                ],
                commitment: digest("outcome"),
              },
              physicalPage45Verification: { commitment: digest("physical-page45") },
              packet: { commitment: digest("packet") },
              publicSuccess: { commitment: digest("public-success") },
              publicationComplete,
            };
            const productionChain = {
              commitment: digest("production-chain"),
              publicationCompleteCommitment: publicationComplete.commitment,
              withheldUnblindingMapCommitment: map.commitment,
              publicHarnessSuccessCommitment: evidence.publicSuccess.commitment,
            };
            const runReplacement = async (kind: "ordinary" | "junction") => {
              const displaced = resolve(reviewRoot, `promotion-${kind}-displaced`);
              const aliasTarget = resolve(root, `promotion-${kind}-target`);
              let hookRan = false;
              let replacementApplied = false;
              let replacementBlockCode: string | null = null;
              const authority = createRealBuildPrefix50Step44ProductionPromotionAuthority({
                result,
                batch,
                evidence: evidence as never,
                map: map as never,
                publicationComplete: publicationComplete as never,
                productionChain: productionChain as never,
                repositoryRoot,
                reviewRoot,
                rawInputRoot: rawRoot,
                capability,
              });
              await expect(
                writeRealBuildPrefix50Step44PromotionArtifacts({
                  promotionRoot,
                  authority,
                  capability,
                  __testHooks: {
                    afterPayloadBeforeReceipt: () => {
                      hookRan = true;
                      try {
                        renameSync(promotionRoot, displaced);
                      } catch (error) {
                        replacementBlockCode = (error as NodeJS.ErrnoException).code ?? null;
                        throw error;
                      }
                      if (kind === "ordinary") mkdirSync(promotionRoot);
                      else {
                        mkdirSync(aliasTarget);
                        symlinkSync(aliasTarget, promotionRoot, "junction");
                      }
                      replacementApplied = true;
                    },
                  },
                }),
              ).rejects.toThrow();
              expect(hookRan).toBe(true);
              noReceipt(promotionRoot);
              if (existsSync(displaced)) noReceipt(displaced);
              if (existsSync(aliasTarget)) noReceipt(aliasTarget);
              expect(
                replacementApplied ||
                  ["EBUSY", "EACCES", "EPERM"].includes(replacementBlockCode ?? ""),
              ).toBe(true);
              rmSync(promotionRoot, { recursive: true, force: true });
              rmSync(displaced, { recursive: true, force: true });
              rmSync(aliasTarget, { recursive: true, force: true });
              mkdirSync(promotionRoot);
            };
            await runReplacement("ordinary");
            await runReplacement("junction");
          },
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }, 180_000);
  },
);
