import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { createCanvas } from "@napi-rs/canvas";
import { canonicalDigest } from "@lego-studio/brick-kernel";

import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import {
  cameraBranches,
  deriveRealBuildPrefix50Step44Page45CameraReceipt,
  type RealBuildPrefix50Step44Page45CameraReceipt,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence";
import {
  createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest,
  requireRealBuildPrefix50Step44BrandedPage45CameraSource,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-source";
import {
  compareRealBuildPrefix50Step43To44FixedCamera,
  createRealBuildPrefix50Step43FixedCameraBaseline,
  createRealBuildPrefix50Step44FixedCameraAfter,
  createRealBuildPrefix50Step44FixedCameraDeltaArtifact,
  deriveRealBuildPrefix50Step44FixedCameraDeltaPixels,
} from "../e2e/real-build-prefix50-subbuild-return-review-fixed-camera";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-replay";
import { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-support";
import { createUnbrandedRealDomainQualificationForNegativeTest } from "./real-build-prefix50-real-domain-qualification-negative-test-support.ts";

const WIDTH = 720;
const HEIGHT = 470;
const result = createStep44ReviewTestResult(211);
let batch: ReturnType<typeof createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope>;

function image(): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const background = [0x89, 0x90, 0x93, 0xff] as const;
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) rgba.set(background, index * 4);
  return rgba;
}

function pngFromRgba(rgba: Uint8Array): Uint8Array {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(WIDTH, HEIGHT);
  imageData.data.set(rgba);
  context.putImageData(imageData, 0, 0);
  return canvas.toBuffer("image/png");
}

function pixel(
  rgba: Uint8Array,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  rgba.set(color, (y * WIDTH + x) * 4);
}

function rectangle(
  rgba: Uint8Array,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) pixel(rgba, x, y, color);
}

function circle(
  rgba: Uint8Array,
  centerX: number,
  centerY: number,
  radius: number,
  color: readonly [number, number, number, number],
): void {
  for (let y = -radius; y <= radius; y += 1)
    for (let x = -radius; x <= radius; x += 1)
      if (x * x + y * y <= radius * radius) pixel(rgba, centerX + x, centerY + y, color);
}

function drawParent(rgba: Uint8Array, offsetX = 0, offsetY = 0): void {
  const black = [0x1a, 0x1d, 0x1b, 0xff] as const;
  rectangle(rgba, 45 + offsetX, 374 + offsetY, 325 + offsetX, 440 + offsetY, black);
  rectangle(rgba, 535 + offsetX, 330 + offsetY, 680 + offsetX, 440 + offsetY, black);
  rectangle(rgba, 245 + offsetX, 405 + offsetY, 610 + offsetX, 440 + offsetY, black);
  for (let m = -45; m <= 45; m += 1)
    for (let n = -45; n <= 45; n += 1) {
      const x = Math.round(360 + m * 18 - n * 12) + offsetX;
      const y = Math.round(235 + m * 7 + n * 10) + offsetY;
      if (x >= 30 && x < WIDTH - 30 && y >= 150 && y < HEIGHT - 30) circle(rgba, x, y, 4, black);
    }
}

function syntheticPage45Crop(): Uint8Array {
  const rgba = image();
  drawParent(rgba);
  rectangle(rgba, 140, 150, 547, 333, [0x2b, 0x9d, 0xc6, 0xff]);
  const yellow = [0xff, 0xd8, 0x00, 0xff] as const;
  rectangle(rgba, 120, 132, 567, 135, yellow);
  rectangle(rgba, 120, 350, 567, 353, yellow);
  rectangle(rgba, 120, 132, 123, 353, yellow);
  rectangle(rgba, 564, 132, 567, 353, yellow);
  rectangle(rgba, 190, 20, 196, 131, [0xff, 0xff, 0xff, 0xff]);
  return rgba;
}

beforeAll(() => {
  const brand = __testOnly.brandReturnResultForReviewTests;
  if (brand === undefined) throw new Error("Step-44 result-brand test hook is unavailable.");
  brand(result);
  batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(result);
}, 120_000);

describe("prefix-50 Step-44 candidate-independent page-45 camera", () => {
  it("keeps both lattice hands on the physical face named by every stable branch key", () => {
    const branches = cameraBranches({
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
      residualPx: 0,
    });
    expect(branches).toHaveLength(16);
    expect(new Set(branches.map(({ parameters }) => canonicalDigest(parameters))).size).toBe(16);
    for (const branch of branches) {
      const expectedStudsUp = branch.branchKey.startsWith("face:studs-up/");
      expect(branch.parameters.elevationDegrees > 0, branch.branchKey).toBe(expectedStudsUp);
    }
  });

  it("changes both raster and crop commitments when only face-prefix evidence changes", () => {
    const crop = syntheticPage45Crop();
    const studsUp = createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest(crop);
    const underside = createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest(
      crop,
      Array.from({ length: 44 }, (_, index) => ({
        stepNumber: index + 1,
        pageNumber: 45,
        rotationIconPresent: index === 43,
      })),
    );
    expect(studsUp.panelPixelDigest).toBe(underside.panelPixelDigest);
    expect(studsUp.expectedPanelFace).toBe("studs-up");
    expect(underside.expectedPanelFace).toBe("underside");
    expect(studsUp.panelFacePrefixEvidenceCommitment).not.toBe(
      underside.panelFacePrefixEvidenceCommitment,
    );
    expect(studsUp.sourcePageRasterCommitment).not.toBe(underside.sourcePageRasterCommitment);
    expect(studsUp.panelCropCommitment).not.toBe(underside.panelCropCommitment);
  });

  it("rejects post-brand raster and mask mutations at the immutable source boundary", () => {
    for (const key of [
      "rgba",
      "eligibleMask",
      "parentOnlyForegroundMask",
      "highlightedChildExclusionMask",
    ] as const) {
      const source =
        createRealBuildPrefix50Step44SyntheticPage45CameraSourceForTest(syntheticPage45Crop());
      source[key][0] = source[key][0]! ^ 1;
      expect(() => requireRealBuildPrefix50Step44BrandedPage45CameraSource(source)).toThrow(
        /pixels, masks, or PDF\/face commitments drifted/u,
      );
    }
  }, 120_000);

  it("rejects omitted, cloned, matching-structure, and cross-batch qualification before page or filesystem access", async () => {
    const matchingStructure = createUnbrandedRealDomainQualificationForNegativeTest(
      batch.commitment,
    );
    const wrongBatchQualification = createUnbrandedRealDomainQualificationForNegativeTest(
      canonicalDigest({ differentRuntimeReviewBatch: true }),
    );
    const qualifications = [
      undefined,
      matchingStructure,
      { ...matchingStructure },
      wrongBatchQualification,
    ] as unknown as RealBuildPrefix50Step44RealDomainQualificationBinding[];
    const impossibleOutput = resolve(
      "output/playwright/real-build-prefix50-step44-return-review",
      `camera-qualification-no-fs-${process.pid}`,
    );
    expect(existsSync(impossibleOutput)).toBe(false);
    for (const realDomainQualification of qualifications) {
      let pageAccesses = 0;
      const page = new Proxy(Object.create(null) as object, {
        get() {
          pageAccesses += 1;
          throw new Error("Qualification rejection must precede page access.");
        },
      });
      await expect(
        deriveRealBuildPrefix50Step44Page45CameraReceipt({
          page: page as never,
          repositoryRoot: resolve("missing-camera-source-root"),
          outputPath: impossibleOutput,
          reviewBatch: batch,
          realDomainQualification,
        }),
      ).rejects.toThrow(/qualification|runtime-branded/u);
      expect(pageAccesses).toBe(0);
      expect(existsSync(impossibleOutput)).toBe(false);
    }
  }, 60_000);

  it("binds exact shared-parent baseline, roster after-frame, delta, and visible delta artifact", async () => {
    const receipt = {
      sharedParentDocumentHash: batch.sourceDocumentHash,
      selectedCameraCommitment: `sha256:${"1".repeat(64)}`,
      commitment: `sha256:${"2".repeat(64)}`,
      returnResultCommitment: batch.returnResultCommitment,
      candidateRosterCommitment: batch.candidateRosterCommitment,
      sourceDocumentHash: batch.sourceDocumentHash,
    } as RealBuildPrefix50Step44Page45CameraReceipt;
    const envelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, batch.candidates[0]!);
    const baselineRgba = new Uint8Array(WIDTH * HEIGHT * 4);
    const afterRgba = new Uint8Array(baselineRgba);
    afterRgba[0] = 255;
    const baseline = createRealBuildPrefix50Step43FixedCameraBaseline({
      receipt,
      cameraCommitment: receipt.selectedCameraCommitment,
      pngBytes: Uint8Array.of(1),
      rgba: baselineRgba,
      width: WIDTH,
      height: HEIGHT,
    });
    const after = createRealBuildPrefix50Step44FixedCameraAfter({
      receipt,
      envelope,
      cameraCommitment: receipt.selectedCameraCommitment,
      pngBytes: Uint8Array.of(2),
      rgba: afterRgba,
      width: WIDTH,
      height: HEIGHT,
    });
    const delta = compareRealBuildPrefix50Step43To44FixedCamera(baseline, after);
    const deltaPixels = deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(
      baselineRgba,
      afterRgba,
    );
    const artifact = createRealBuildPrefix50Step44FixedCameraDeltaArtifact({
      delta,
      baseline,
      after,
      artifactFile: "real-build-prefix50-step44-page45-fixed-camera-delta.png",
      pngBytes: pngFromRgba(deltaPixels.rgba),
    });
    expect(baseline.evidence.documentHash).toBe(receipt.sharedParentDocumentHash);
    expect(after.evidence).toMatchObject({
      documentHash: envelope.selectedDocumentHash,
      selectedDocumentCommitment: envelope.selectedDocumentCommitment,
      reviewHarnessEnvelopeCommitment: envelope.commitment,
    });
    expect(delta).toMatchObject({
      changedPixelCount: 1,
      changedPixelBounds: { width: 1, height: 1 },
    });
    expect(artifact).toMatchObject({
      deltaCommitment: delta.commitment,
      candidateKey: envelope.candidateKey,
      selectedDocumentHash: envelope.selectedDocumentHash,
      width: WIDTH,
      height: HEIGHT,
    });
    expect(() =>
      createRealBuildPrefix50Step44FixedCameraDeltaArtifact({
        delta,
        baseline,
        after,
        artifactFile: "real-build-prefix50-step44-page45-fixed-camera-delta.png",
        pngBytes: pngFromRgba(afterRgba),
      }),
    ).toThrow(/must be derived from its exact baseline and after frames/u);
    const hostile = {
      ...envelope,
      selectedDocument: { ...envelope.selectedDocument, revision: "caller-revision" },
    };
    expect(() =>
      createRealBuildPrefix50Step44FixedCameraAfter({
        receipt,
        envelope: hostile,
        cameraCommitment: receipt.selectedCameraCommitment,
        pngBytes: Uint8Array.of(2),
        rgba: afterRgba,
        width: WIDTH,
        height: HEIGHT,
      }),
    ).toThrow(/exact receipt-bound roster envelope/u);
  }, 120_000);
});
