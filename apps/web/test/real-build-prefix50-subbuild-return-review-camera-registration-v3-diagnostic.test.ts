import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock(
  "../e2e/real-build-prefix50-step44-later-source-authority.ts",
  () => import("./real-build-prefix50-step44-later-source-authority-test-seam.ts"),
);

import { searchRealBuildPrefix50EligibleMaskSimilarity } from "../e2e/real-build-prefix50-subbuild-return-review-camera-registration.ts";
import { foregroundMask } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import { loadRealBuildPrefix50Step44RepositoryPage45CameraSource } from "../e2e/real-build-prefix50-subbuild-return-review-camera-source.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest } from "./real-build-prefix50-step44-later-source-authority-test-seam.ts";

const WIDTH = 720;
const HEIGHT = 470;
const V3_ROOT = resolve(
  "output/playwright/real-build-prefix50-step44-return-review/camera-only-page45-gate-20260830-v3",
);
const HAS_PRESERVED_V3 = existsSync(V3_ROOT);

describe("preserved v3 Step-44 expected-face registration diagnostics", () => {
  it.skipIf(!HAS_PRESERVED_V3)(
    "preserves the old-cap refusals and completes all eight domains under the raster ceiling",
    async () => {
      const common = {
        repositoryRoot: resolve("."),
        sourcePdfArtifactPath: "recipes/6651557.pdf",
        sourcePdfDigest:
          "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
        maximumSourceBytes: 80 * 1024 * 1024,
        physicalPageNumber: 45 as const,
      };
      const source = await loadRealBuildPrefix50Step44RepositoryPage45CameraSource({
        panelFaceCapability: issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
          ...common,
          purpose: "page45-step44-vector",
        }),
        rasterCapability: issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
          ...common,
          purpose: "page45-camera-raster",
        }),
      });
      const oldCapRows = [];
      const rows = [];
      for (let branchIndex = 0; branchIndex < 8; branchIndex += 1) {
        const artifactFile = `real-build-prefix50-step44-page45-camera-branch-${branchIndex
          .toString()
          .padStart(2, "0")}-seed.png`;
        const decoded = decodeRealBuildPrefix50Step44ReviewPng(
          readFileSync(resolve(V3_ROOT, artifactFile)),
          WIDTH * HEIGHT,
          artifactFile,
        );
        const request = {
          source: { width: WIDTH, height: HEIGHT, mask: foregroundMask(decoded.rgba) },
          target: {
            width: WIDTH,
            height: HEIGHT,
            mask: source.parentOnlyForegroundMask,
          },
          eligibleTarget: { width: WIDTH, height: HEIGHT, mask: source.eligibleMask },
        };
        oldCapRows.push(
          searchRealBuildPrefix50EligibleMaskSimilarity({
            ...request,
            options: { maximumCandidates: 100_000 },
          }),
        );
        rows.push(searchRealBuildPrefix50EligibleMaskSimilarity(request));
      }
      expect(oldCapRows.map((row) => row.status)).toEqual(new Array(8).fill("refused"));
      expect(oldCapRows.map((row) => (row.status === "refused" ? row.reason : null))).toEqual(
        new Array(8).fill("incomplete-coarse-domain"),
      );
      expect(
        oldCapRows.every(
          (row) =>
            row.diagnostics.candidateEvaluationMethod === "full-resolution-row-span-prefix-sum" &&
            row.diagnostics.translationDomainAuthority ===
              "source-target-foreground-overlap-complete" &&
            row.diagnostics.coarseCandidatesExpected === 133_274 &&
            row.diagnostics.coarseCandidatesExpected > row.diagnostics.maximumCandidates &&
            row.diagnostics.coarseCandidatesEvaluated === 0 &&
            row.diagnostics.coarsePixelVisitUpperBound !== null &&
            !row.diagnostics.coarsePreflightPassed &&
            !row.diagnostics.coarseDomainComplete &&
            row.diagnostics.refinementStarts === 0 &&
            !row.diagnostics.localFinalCellContainmentComplete,
        ),
      ).toBe(true);
      expect(
        oldCapRows.every(
          (row) =>
            row.diagnostics.coarseScaleTranslationDomains.reduce(
              (count, domain) => count + domain.candidateCount,
              0,
            ) === row.diagnostics.coarseCandidatesExpected,
        ),
      ).toBe(true);
      expect(
        rows.every(
          (row) =>
            row.diagnostics.coarseCandidatesExpected === 133_274 &&
            row.diagnostics.coarseCandidatesEvaluated === 133_274 &&
            row.diagnostics.coarsePreflightPassed &&
            row.diagnostics.coarseDomainComplete,
        ),
        JSON.stringify(
          rows.map((row, branchIndex) => ({
            branchIndex,
            status: row.status,
            reason: row.status === "refused" ? row.reason : null,
            coarseExpected: row.diagnostics.coarseCandidatesExpected,
            coarseEvaluated: row.diagnostics.coarseCandidatesEvaluated,
            coarseWorkBound: row.diagnostics.coarsePixelVisitUpperBound,
            sampled: row.diagnostics.sampledCandidatesTried,
            exact: row.diagnostics.fullResolutionCandidatesTried,
            sampledVisits: row.diagnostics.sampledPixelVisits,
            fullVisits: row.diagnostics.fullResolutionPixelVisits,
            totalVisits: row.diagnostics.totalPixelVisits,
            localComplete: row.diagnostics.localFinalCellContainmentComplete,
            iou: row.diagnostics.predictedIntersectionOverUnion,
          })),
        ),
      ).toBe(true);
      expect(
        rows.map((row) => row.status),
        JSON.stringify(
          rows.map((row, branchIndex) => ({
            branchIndex,
            status: row.status,
            reason: row.status === "refused" ? row.reason : null,
            sampled: row.diagnostics.sampledCandidatesTried,
            exact: row.diagnostics.fullResolutionCandidatesTried,
            sampledVisits: row.diagnostics.sampledPixelVisits,
            fullVisits: row.diagnostics.fullResolutionPixelVisits,
            totalVisits: row.diagnostics.totalPixelVisits,
            localComplete: row.diagnostics.localFinalCellContainmentComplete,
            scaleBoundary: row.diagnostics.scaleBoundaryHit,
            iou: row.diagnostics.predictedIntersectionOverUnion,
          })),
        ),
      ).toEqual(new Array(8).fill("locally-contained"));
      expect(
        rows.every(
          (row) =>
            row.diagnostics.localNeighborOptimal &&
            row.diagnostics.equivalenceComponentComplete &&
            row.diagnostics.localFinalCellContainmentComplete,
        ),
      ).toBe(true);
    },
    180_000,
  );
});
