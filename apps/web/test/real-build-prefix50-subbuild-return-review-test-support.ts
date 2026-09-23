import { writeFile, mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";
import { CANONICAL_CAPTURE_POLICY_HASH, createCanonicalViewPacket } from "@lego-studio/rendering";
import { Box3, Vector3 } from "three";

import { type RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "../e2e/real-build-prefix50-subbuild-return-contract";
import {
  realBuildPrefix50Step44PanelCropCommitment,
  realBuildPrefix50Step44RenderReviewCommitment,
  realBuildPrefix50Step44ReviewedFixtureCommitment,
  realBuildPrefix50Step44SourcePageRasterCommitment,
} from "../e2e/real-build-prefix50-subbuild-return-review-commitments";
import type {
  RealBuildPrefix50Step44ReviewedPanelCrop,
  RealBuildPrefix50Step44ReviewedRender,
  RealBuildPrefix50Step44ReviewedReturnFixture,
  RealBuildPrefix50Step44ReviewedSourcePageRaster,
} from "../e2e/real-build-prefix50-subbuild-return-review-fixture";
import { decodeRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "../e2e/real-build-prefix50-subbuild-return-review-views";
import type { RealBuildPrefix50Step44ReviewFixtureKey } from "../e2e/real-build-prefix50-subbuild-return-review-views";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "../e2e/real-build-prefix50-subbuild-return-review-artifact-io";
import { verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts } from "../e2e/real-build-prefix50-subbuild-return-review-artifacts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest } from "./real-build-prefix50-step44-later-source-authority-test-seam.ts";
import { createStep44HermeticPdfArtifacts } from "./real-build-prefix50-subbuild-return-review-test-pdf";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;

export { createStep44ReviewTestResult } from "./real-build-prefix50-subbuild-return-review-test-result";

function png(width: number, height: number, seed: number): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = `rgba(${seed},${(seed * 3) % 255},${(seed * 7) % 255},1)`;
  context.fillRect(0, 0, width, height);
  return canvas.toBuffer("image/png");
}

function measuredPng(bytes: Uint8Array, maximumPixels: number) {
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(bytes, maximumPixels, "test artifact");
  return {
    width: decoded.width,
    height: decoded.height,
    pngDigest: sha256RealBuildPrefix50Step44ReviewBytes(bytes),
    pixelDigest: sha256RealBuildPrefix50Step44ReviewBytes(decoded.rgba),
  };
}

function croppedPng(
  pageBytes: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
): Buffer {
  const page = decodeRealBuildPrefix50Step44ReviewPng(pageBytes, 10_000, "test PDF page");
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * page.width + x) * 4;
    const targetStart = row * width * 4;
    image.data.set(page.rgba.subarray(sourceStart, sourceStart + width * 4), targetStart);
  }
  context.putImageData(image, 0, 0);
  return canvas.toBuffer("image/png");
}

export async function createStep44ReviewTestArtifacts(
  directory: string,
  envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
): Promise<{
  fixture: RealBuildPrefix50Step44ReviewedReturnFixture;
  manifestBytes: string;
  testSourcePdfArtifactPath: string;
  alternatePdfBytes: Buffer;
}> {
  await mkdir(directory, { recursive: false });
  const relativePath = (name: string) =>
    resolve(directory, name)
      .slice(resolve(".").length + 1)
      .replaceAll("\\", "/");
  const pagePath = relativePath("page.png");
  const cropPath = relativePath("crop.png");
  const pdfPath = relativePath("source.pdf");
  const { pdfBytes, alternatePdfBytes, pageBytes, rendererVersion } =
    await createStep44HermeticPdfArtifacts(directory);
  const cropBytes = croppedPng(pageBytes, 2, 2, 4, 4);
  await writeFile(resolve(directory, "crop.png"), cropBytes, { flag: "wx" });
  const pageMeasured = measuredPng(pageBytes, 10_000);
  const sourcePdfDigest = sha256RealBuildPrefix50Step44ReviewBytes(pdfBytes);
  const pageBody = {
    artifactPath: pagePath,
    sourcePdfDigest,
    pageNumber: 45 as const,
    renderer: "poppler-pdftoppm" as const,
    rendererVersion,
    densityDpi: 180,
    ...pageMeasured,
  };
  const sourcePageRaster: RealBuildPrefix50Step44ReviewedSourcePageRaster = {
    ...pageBody,
    commitment: realBuildPrefix50Step44SourcePageRasterCommitment(pageBody),
  };
  const cropMeasured = measuredPng(cropBytes, 16);
  const cropBody = {
    artifactPath: cropPath,
    renderer: "poppler-pdftoppm" as const,
    rendererVersion,
    densityDpi: 180,
    sourcePageRasterCommitment: sourcePageRaster.commitment,
    x: 2,
    y: 2,
    ...cropMeasured,
  };
  const panelCrop: RealBuildPrefix50Step44ReviewedPanelCrop = {
    ...cropBody,
    commitment: realBuildPrefix50Step44PanelCropCommitment(cropBody),
  };
  const viewPacket = createCanonicalViewPacket({
    documentHash: envelope.selectedDocumentHash,
    bounds: new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)),
  });
  const viewPacketCommitment = canonicalDigest(viewPacket);
  const captures: Record<string, unknown> = {};
  const reviews = {} as Record<
    RealBuildPrefix50Step44ReviewFixtureKey,
    RealBuildPrefix50Step44ReviewedRender
  >;
  for (const [
    index,
    { fixtureKey, reviewedView, canonicalViewName },
  ] of REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.entries()) {
    const filename = `real-build-prefix50-step44-${reviewedView}.png`;
    const artifactPath = relativePath(filename);
    const bytes = png(640, 480, 50 + index * 20);
    await writeFile(resolve(directory, filename), bytes, { flag: "wx" });
    const measured = measuredPng(bytes, 640 * 480);
    const view = viewPacket.views.find(({ name }) => name === canonicalViewName)!;
    const cameraCommitment = canonicalDigest({
      capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
      viewPacketCommitment,
      view,
    });
    captures[fixtureKey] = {
      view: reviewedView,
      canonicalViewName,
      artifactFile: basename(artifactPath),
      ...measured,
      candidateKey: envelope.candidateKey,
      selectedDocumentHash: envelope.selectedDocumentHash,
      cameraCommitment,
      reviewOutcome: null,
      reviewNote: null,
    };
    const reviewBody = {
      view: reviewedView,
      canonicalViewName,
      artifactPath,
      ...measured,
      candidateKey: envelope.candidateKey,
      selectedDocumentHash: envelope.selectedDocumentHash,
      cameraCommitment,
      outcome: (index === 0 ? "same" : "not-observable") as "same" | "not-observable",
      reviewNote: index === 0 ? "Test isometric agrees." : "Test orthographic retained.",
    };
    reviews[fixtureKey] = {
      ...reviewBody,
      commitment: realBuildPrefix50Step44RenderReviewCommitment(reviewBody),
    };
  }
  const validationReport = {
    targetDocumentHash: envelope.selectedDocumentHash,
    documentGloballyValid: true,
  };
  const rendererSnapshot = { contextLost: false, viewPacket };
  const renderPacketBody = {
    schemaVersion: "lego.real-build-prefix50-step44-render-packet/1" as const,
    authority: "none" as const,
    documentHash: envelope.selectedDocumentHash,
    validationReport,
    validationReportCommitment: canonicalDigest(validationReport),
    rendererSnapshot,
    rendererSnapshotCommitment: canonicalDigest(rendererSnapshot),
    capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
    viewPacketCommitment,
    capturesCommitment: canonicalDigest(captures),
  };
  const renderPacket = {
    ...renderPacketBody,
    commitment: canonicalDigest(renderPacketBody),
  };
  const manifestBody = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return-review-capture/2" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    inputBytesHash: digest("6"),
    reviewHarnessEnvelopeCommitment: envelope.commitment,
    returnResultCommitment: envelope.returnResultCommitment,
    candidateRosterCommitment: envelope.candidateRosterCommitment,
    projectionCommitment: envelope.projectionCommitment,
    childSubBuildWindowCommitment: envelope.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: envelope.sourceMemberRowsCommitment,
    detachedStateCommitment: envelope.detachedStateCommitment,
    step42_43RepairCommitment: envelope.step42_43RepairCommitment,
    step43PredecessorCommitment: envelope.step43PredecessorCommitment,
    sourceDocumentHash: envelope.sourceDocumentHash,
    candidateKey: envelope.candidateKey,
    selectedDocumentHash: envelope.selectedDocumentHash,
    selectedDocumentCommitment: envelope.selectedDocumentCommitment,
    partCount: 280 as const,
    buildStepCount: 43 as const,
    canonicalCapturePolicy: "lego.canonical-capture/1" as const,
    canonicalCapturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
    browserVersion: "test-browser",
    userAgent: "test-user-agent",
    viewPacket,
    viewPacketCommitment,
    renderPacket,
    renderPacketCommitment: renderPacket.commitment,
    captures,
    reviewStatus: "unreviewed" as const,
  };
  const manifest = { ...manifestBody, commitment: canonicalDigest(manifestBody) };
  const manifestBytes = canonicalStringify(manifest);
  const manifestPath = relativePath("real-build-prefix50-step44-capture-manifest.json");
  await writeFile(resolve(directory, basename(manifestPath)), manifestBytes, { flag: "wx" });
  const fixtureCore = {
    schemaVersion: "lego.real-build-prefix50-step44-return-review-fixture/1" as const,
    reviewStatus: "reviewed" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    source: {
      logicalPath: "recipes/6651557.pdf" as const,
      digest: sourcePdfDigest,
      pageNumber: 45 as const,
      structuralEventSequence: 8 as const,
      structuralEventDigest:
        "sha256:4a4a56a9a4a802601d2fff37d8cc788cfd479e5573bf68d9013bf2aecca9f9ad" as const,
      precedingPhaseSequence: 71 as const,
      followingPhaseSequence: 72 as const,
      firstChildOccurrenceOrdinal: 258 as const,
      lastChildOccurrenceOrdinal: 280 as const,
    },
    reviewHarnessEnvelopeCommitment: envelope.commitment,
    returnResultCommitment: envelope.returnResultCommitment,
    candidateRosterCommitment: envelope.candidateRosterCommitment,
    projectionCommitment: envelope.projectionCommitment,
    childSubBuildWindowCommitment: envelope.childSubBuildWindowCommitment,
    sourceMemberRowsCommitment: envelope.sourceMemberRowsCommitment,
    detachedStateCommitment: envelope.detachedStateCommitment,
    step42_43RepairCommitment: envelope.step42_43RepairCommitment,
    step43PredecessorCommitment: envelope.step43PredecessorCommitment,
    sourceDocumentHash: envelope.sourceDocumentHash,
    candidateKey: envelope.candidateKey,
    selectedDocumentHash: envelope.selectedDocumentHash,
    selectedDocumentCommitment: envelope.selectedDocumentCommitment,
    sourcePageRaster,
    panelCrop,
    captureManifest: {
      artifactPath: manifestPath,
      byteDigest: sha256RealBuildPrefix50Step44ReviewBytes(Buffer.from(manifestBytes)),
      commitment: manifest.commitment,
      viewPacketCommitment,
      renderPacketCommitment: renderPacket.commitment,
      reviewHarnessEnvelopeCommitment: envelope.commitment,
    },
    canonicalCapturePolicy: "lego.canonical-capture/1" as const,
    canonicalCapturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
    renderReviews: reviews,
    reviewDisposition: "reviewed-page-45-subbuild-return" as const,
  };
  const provisionalFixture = {
    ...fixtureCore,
    artifactVerificationCommitment: digest("0"),
    commitment: digest("0"),
  } as unknown as RealBuildPrefix50Step44ReviewedReturnFixture;
  const artifactVerification = await verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts(
    provisionalFixture,
    envelope,
    {
      repositoryRoot: resolve("."),
      allowTestArtifactPaths: true,
      testSourcePdfArtifactPath: pdfPath,
      laterSourceReadCapability: issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
        repositoryRoot: resolve("."),
        sourcePdfArtifactPath: pdfPath,
        sourcePdfDigest: sourcePageRaster.sourcePdfDigest,
        maximumSourceBytes: 80 * 1024 * 1024,
        purpose: "page45-review-artifact-raster",
        physicalPageNumber: 45,
      }),
    },
  );
  const fixtureBody = {
    ...fixtureCore,
    artifactVerificationCommitment: artifactVerification.commitment,
  };
  const fixture = {
    ...fixtureBody,
    commitment: realBuildPrefix50Step44ReviewedFixtureCommitment(fixtureBody),
  } as unknown as RealBuildPrefix50Step44ReviewedReturnFixture;
  return {
    fixture: deepFreeze(fixture),
    manifestBytes,
    testSourcePdfArtifactPath: pdfPath,
    alternatePdfBytes,
  };
}

type DeepMutable<T> = T extends object ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> } : T;

export type MutableStep44ReviewFixture = DeepMutable<RealBuildPrefix50Step44ReviewedReturnFixture>;

export function recommitStep44ReviewFixture(
  fixture: RealBuildPrefix50Step44ReviewedReturnFixture,
): RealBuildPrefix50Step44ReviewedReturnFixture {
  const clone = structuredClone(fixture) as MutableStep44ReviewFixture;
  clone.sourcePageRaster.commitment = realBuildPrefix50Step44SourcePageRasterCommitment(
    clone.sourcePageRaster,
  );
  clone.panelCrop.commitment = realBuildPrefix50Step44PanelCropCommitment(clone.panelCrop);
  for (const { fixtureKey } of REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS)
    clone.renderReviews[fixtureKey].commitment = realBuildPrefix50Step44RenderReviewCommitment(
      clone.renderReviews[fixtureKey],
    );
  clone.commitment = realBuildPrefix50Step44ReviewedFixtureCommitment(clone);
  return deepFreeze(clone) as RealBuildPrefix50Step44ReviewedReturnFixture;
}

export { digest };
