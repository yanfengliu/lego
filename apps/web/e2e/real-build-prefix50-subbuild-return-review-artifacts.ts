import { basename, resolve } from "node:path";

import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import {
  CANONICAL_CAPTURE_POLICY,
  CANONICAL_CAPTURE_POLICY_HASH,
  CANONICAL_VIEW_NAMES,
} from "@lego-studio/rendering";

import type { RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "./real-build-prefix50-subbuild-return-contract";
import {
  realBuildPrefix50Step44PanelCropCommitment,
  realBuildPrefix50Step44RenderReviewCommitment,
  realBuildPrefix50Step44SourcePageRasterCommitment,
} from "./real-build-prefix50-subbuild-return-review-commitments";
import {
  readRealBuildPrefix50Step44ReviewArtifact,
  sha256RealBuildPrefix50Step44ReviewBytes,
} from "./real-build-prefix50-subbuild-return-review-artifact-io";
import type { RealBuildPrefix50Step44ReviewedReturnFixture } from "./real-build-prefix50-subbuild-return-review-fixture";
import { preflightRealBuildPrefix50Step44ReviewJsonStructure } from "./real-build-prefix50-subbuild-return-review-harness-input";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  requireExactRealBuildPrefix50Step44ReviewCrop,
} from "./real-build-prefix50-subbuild-return-review-png";
import { rerenderRealBuildPrefix50Step44PdfPage } from "./real-build-prefix50-subbuild-return-review-pdf";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views";
import type {
  RealBuildPrefix50Step44ArtifactVerification,
  RealBuildPrefix50Step44ArtifactVerificationOptions,
  RealBuildPrefix50Step44CaptureManifest as CaptureManifest,
  RealBuildPrefix50Step44CaptureRenderPacket as CaptureRenderPacket,
} from "./real-build-prefix50-subbuild-return-review-artifact-contract";

export type {
  RealBuildPrefix50Step44ArtifactVerification,
  RealBuildPrefix50Step44ArtifactVerificationOptions,
} from "./real-build-prefix50-subbuild-return-review-artifact-contract";

const MAXIMUM_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_PAGE_RASTER_BYTES = 32 * 1024 * 1024;
const MAXIMUM_PNG_BYTES = CANONICAL_CAPTURE_POLICY.maxArtifactBytes;
const MAXIMUM_PAGE_PIXELS = 10_000_000;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const PRODUCTION_REVIEW_ROOT =
  "output/playwright/real-build-prefix50-step44-return-review/reviewed";

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be a data object.`);
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

function withoutCommitment<T extends { readonly commitment: unknown }>(
  value: T,
): Omit<T, "commitment"> {
  const copy = { ...value } as T & { commitment?: unknown };
  Reflect.deleteProperty(copy, "commitment");
  return copy;
}

function requireProductionArtifactPath(
  actual: string,
  expected: string,
  allowTestArtifactPaths: boolean,
  label: string,
): void {
  if (!allowTestArtifactPaths && actual !== expected)
    throw new TypeError(`${label} must use repository-owned artifact ${expected}.`);
}

function parseManifest(bytes: Uint8Array): CaptureManifest {
  const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  preflightRealBuildPrefix50Step44ReviewJsonStructure(value);
  exactKeys(
    value,
    [
      "authority",
      "browserVersion",
      "buildStepCount",
      "candidateKey",
      "candidateRosterCommitment",
      "canonicalCapturePolicy",
      "canonicalCapturePolicyHash",
      "captures",
      "childSubBuildWindowCommitment",
      "commitment",
      "detachedStateCommitment",
      "fixturePromotionAuthority",
      "inputBytesHash",
      "partCount",
      "projectionCommitment",
      "renderPacket",
      "renderPacketCommitment",
      "returnResultCommitment",
      "reviewHarnessEnvelopeCommitment",
      "reviewStatus",
      "schemaVersion",
      "selectedDocumentCommitment",
      "selectedDocumentHash",
      "selectionAuthority",
      "sourceDocumentHash",
      "sourceMemberRowsCommitment",
      "sourceSetId",
      "step42_43RepairCommitment",
      "step43PredecessorCommitment",
      "userAgent",
      "viewPacket",
      "viewPacketCommitment",
    ],
    "Step-44 capture manifest",
  );
  return value as CaptureManifest;
}

function captureManifestBody(manifest: CaptureManifest): Omit<CaptureManifest, "commitment"> {
  return withoutCommitment(manifest);
}

function captureRenderPacketBody(
  packet: CaptureRenderPacket,
): Omit<CaptureRenderPacket, "commitment"> {
  return withoutCommitment(packet);
}

export async function verifyRepositoryRealBuildPrefix50Step44ReviewArtifacts(
  fixture: RealBuildPrefix50Step44ReviewedReturnFixture,
  envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
  options: RealBuildPrefix50Step44ArtifactVerificationOptions = {},
): Promise<RealBuildPrefix50Step44ArtifactVerification> {
  const repositoryRoot = resolve(options.repositoryRoot ?? ".");
  const allowTestArtifactPaths = options.allowTestArtifactPaths === true;
  const sourcePdfDigest = fixture.source.digest;
  const physicalPageRerender = await rerenderRealBuildPrefix50Step44PdfPage({
    capability:
      options.laterSourceReadCapability ??
      (() => {
        throw new TypeError(
          "Step-44 review artifact rerender requires an opaque post-Step-43 source-read capability.",
        );
      })(),
    purpose: "page45-review-artifact-raster",
    densityDpi: fixture.sourcePageRaster.densityDpi,
    retainDecodedBytes: false,
  });

  requireProductionArtifactPath(
    fixture.sourcePageRaster.artifactPath,
    `${PRODUCTION_REVIEW_ROOT}/real-build-prefix50-step44-page-45-raster.png`,
    allowTestArtifactPaths,
    "Step-44 source-page raster",
  );
  const pageBytes = readRealBuildPrefix50Step44ReviewArtifact(
    repositoryRoot,
    fixture.sourcePageRaster.artifactPath,
    MAXIMUM_PAGE_RASTER_BYTES,
    "Step-44 source-page raster",
  );
  const page = decodeRealBuildPrefix50Step44ReviewPng(
    pageBytes,
    MAXIMUM_PAGE_PIXELS,
    "Step-44 source-page raster",
  );
  const pageBody = withoutCommitment(fixture.sourcePageRaster);
  if (
    fixture.sourcePageRaster.commitment !==
      realBuildPrefix50Step44SourcePageRasterCommitment(pageBody) ||
    fixture.sourcePageRaster.pngDigest !== sha256RealBuildPrefix50Step44ReviewBytes(pageBytes) ||
    fixture.sourcePageRaster.pixelDigest !== sha256RealBuildPrefix50Step44ReviewBytes(page.rgba) ||
    fixture.sourcePageRaster.sourcePdfDigest !== sourcePdfDigest ||
    fixture.sourcePageRaster.pageNumber !== 45 ||
    fixture.sourcePageRaster.renderer !== "poppler-pdftoppm" ||
    fixture.sourcePageRaster.rendererVersion.trim().length === 0 ||
    !Number.isSafeInteger(fixture.sourcePageRaster.densityDpi) ||
    fixture.sourcePageRaster.densityDpi < 1 ||
    fixture.sourcePageRaster.width !== page.width ||
    fixture.sourcePageRaster.height !== page.height
  )
    throw new TypeError(
      "Step-44 source-page raster byte, pixel, dimension, or commitment drifted.",
    );
  if (
    !allowTestArtifactPaths &&
    (fixture.sourcePageRaster.densityDpi !== 180 || page.width !== 1_914 || page.height !== 1_361)
  )
    throw new TypeError(
      "Step-44 source-page raster must retain the reviewed 180-DPI 1914x1361 page-45 frame.",
    );
  if (
    physicalPageRerender.rendererVersion !== fixture.sourcePageRaster.rendererVersion ||
    physicalPageRerender.width !== page.width ||
    physicalPageRerender.height !== page.height ||
    physicalPageRerender.pngDigest !== fixture.sourcePageRaster.pngDigest ||
    physicalPageRerender.pixelDigest !== fixture.sourcePageRaster.pixelDigest
  )
    throw new TypeError(
      "Step-44 retained source-page raster does not equal a fresh Poppler rerender of physical PDF page 45.",
    );

  requireProductionArtifactPath(
    fixture.panelCrop.artifactPath,
    `${PRODUCTION_REVIEW_ROOT}/real-build-prefix50-step44-panel-crop.png`,
    allowTestArtifactPaths,
    "Step-44 panel crop",
  );
  const cropBytes = readRealBuildPrefix50Step44ReviewArtifact(
    repositoryRoot,
    fixture.panelCrop.artifactPath,
    MAXIMUM_PNG_BYTES,
    "Step-44 panel crop",
  );
  const crop = decodeRealBuildPrefix50Step44ReviewPng(
    cropBytes,
    MAXIMUM_PAGE_PIXELS,
    "Step-44 panel crop",
  );
  const cropBody = withoutCommitment(fixture.panelCrop);
  if (
    fixture.panelCrop.sourcePageRasterCommitment !== fixture.sourcePageRaster.commitment ||
    fixture.panelCrop.commitment !== realBuildPrefix50Step44PanelCropCommitment(cropBody) ||
    fixture.panelCrop.pngDigest !== sha256RealBuildPrefix50Step44ReviewBytes(cropBytes) ||
    fixture.panelCrop.pixelDigest !== sha256RealBuildPrefix50Step44ReviewBytes(crop.rgba) ||
    fixture.panelCrop.width !== crop.width ||
    fixture.panelCrop.height !== crop.height ||
    fixture.panelCrop.renderer !== "poppler-pdftoppm" ||
    fixture.panelCrop.rendererVersion.trim().length === 0 ||
    fixture.panelCrop.renderer !== fixture.sourcePageRaster.renderer ||
    fixture.panelCrop.rendererVersion !== fixture.sourcePageRaster.rendererVersion ||
    fixture.panelCrop.densityDpi !== fixture.sourcePageRaster.densityDpi ||
    !Number.isSafeInteger(fixture.panelCrop.densityDpi) ||
    fixture.panelCrop.densityDpi < 1
  )
    throw new TypeError(
      "Step-44 panel crop byte, pixel, dimension, renderer, or commitment drifted.",
    );
  requireExactRealBuildPrefix50Step44ReviewCrop(
    page,
    crop,
    fixture.panelCrop.x,
    fixture.panelCrop.y,
  );
  if (
    !allowTestArtifactPaths &&
    (fixture.panelCrop.x !== 850 ||
      fixture.panelCrop.y !== 350 ||
      crop.width !== 720 ||
      crop.height !== 470)
  )
    throw new TypeError(
      "Step-44 panel crop must retain reviewed page-45 bounds x850/y350/720x470 at 180 DPI.",
    );

  requireProductionArtifactPath(
    fixture.captureManifest.artifactPath,
    `${PRODUCTION_REVIEW_ROOT}/real-build-prefix50-step44-capture-manifest.json`,
    allowTestArtifactPaths,
    "Step-44 capture manifest",
  );
  const manifestBytes = readRealBuildPrefix50Step44ReviewArtifact(
    repositoryRoot,
    fixture.captureManifest.artifactPath,
    MAXIMUM_MANIFEST_BYTES,
    "Step-44 capture manifest",
  );
  const manifest = parseManifest(manifestBytes);
  const manifestByteDigest = sha256RealBuildPrefix50Step44ReviewBytes(manifestBytes);
  const exactBindings = [
    manifest.reviewHarnessEnvelopeCommitment === envelope.commitment,
    manifest.returnResultCommitment === envelope.returnResultCommitment,
    manifest.candidateRosterCommitment === envelope.candidateRosterCommitment,
    manifest.projectionCommitment === envelope.projectionCommitment,
    manifest.childSubBuildWindowCommitment === envelope.childSubBuildWindowCommitment,
    manifest.sourceMemberRowsCommitment === envelope.sourceMemberRowsCommitment,
    manifest.detachedStateCommitment === envelope.detachedStateCommitment,
    manifest.step42_43RepairCommitment === envelope.step42_43RepairCommitment,
    manifest.step43PredecessorCommitment === envelope.step43PredecessorCommitment,
    manifest.sourceDocumentHash === envelope.sourceDocumentHash,
    manifest.candidateKey === envelope.candidateKey,
    manifest.selectedDocumentHash === envelope.selectedDocumentHash,
    manifest.selectedDocumentCommitment === envelope.selectedDocumentCommitment,
  ];
  const viewNames = manifest.viewPacket.views.map(({ name }) => name).sort();
  const expectedViewNames = [...CANONICAL_VIEW_NAMES].sort();
  exactKeys(
    manifest.renderPacket,
    [
      "authority",
      "capturePolicyHash",
      "capturesCommitment",
      "commitment",
      "documentHash",
      "rendererSnapshot",
      "rendererSnapshotCommitment",
      "schemaVersion",
      "validationReport",
      "validationReportCommitment",
      "viewPacketCommitment",
    ],
    "Step-44 capture manifest.renderPacket",
  );
  if (
    manifest.renderPacket.validationReport === null ||
    typeof manifest.renderPacket.validationReport !== "object" ||
    Array.isArray(manifest.renderPacket.validationReport) ||
    manifest.renderPacket.rendererSnapshot === null ||
    typeof manifest.renderPacket.rendererSnapshot !== "object" ||
    Array.isArray(manifest.renderPacket.rendererSnapshot)
  )
    throw new TypeError(
      "Step-44 render packet must retain its bounded validation report and renderer snapshot.",
    );
  const retainedValidation = manifest.renderPacket.validationReport as Record<string, unknown>;
  const retainedRenderer = manifest.renderPacket.rendererSnapshot as Record<string, unknown>;
  if (
    manifest.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-capture/2" ||
    manifest.authority !== "none" ||
    manifest.selectionAuthority !== false ||
    manifest.fixturePromotionAuthority !== false ||
    manifest.sourceSetId !== "6651557" ||
    manifest.partCount !== 280 ||
    manifest.buildStepCount !== 43 ||
    manifest.reviewStatus !== "unreviewed" ||
    manifest.canonicalCapturePolicy !== CANONICAL_CAPTURE_POLICY.version ||
    manifest.canonicalCapturePolicyHash !== CANONICAL_CAPTURE_POLICY_HASH ||
    manifest.browserVersion.trim().length === 0 ||
    manifest.userAgent.trim().length === 0 ||
    !SHA256.test(manifest.inputBytesHash) ||
    exactBindings.some((matches) => !matches) ||
    manifest.viewPacket.schemaVersion !== "lego.canonical-view-packet/1" ||
    manifest.viewPacket.rendererVersion !== "lego.rendering/1" ||
    manifest.viewPacket.cameraPolicyVersion !== "lego.canonical-cameras/1" ||
    manifest.viewPacket.coordinateSystem !== "three-plus-y-up" ||
    manifest.viewPacket.sourceCoordinateSystem !== "ldu-minus-y-up" ||
    viewNames.length !== expectedViewNames.length ||
    viewNames.some((name, index) => name !== expectedViewNames[index]) ||
    manifest.viewPacketCommitment !== canonicalDigest(manifest.viewPacket) ||
    manifest.viewPacket.documentHash !== envelope.selectedDocumentHash ||
    manifest.renderPacket.schemaVersion !== "lego.real-build-prefix50-step44-render-packet/1" ||
    manifest.renderPacket.authority !== "none" ||
    manifest.renderPacket.documentHash !== envelope.selectedDocumentHash ||
    manifest.renderPacket.validationReportCommitment !==
      canonicalDigest(manifest.renderPacket.validationReport) ||
    manifest.renderPacket.rendererSnapshotCommitment !==
      canonicalDigest(manifest.renderPacket.rendererSnapshot) ||
    retainedValidation.targetDocumentHash !== envelope.selectedDocumentHash ||
    retainedValidation.documentGloballyValid !== true ||
    retainedRenderer.contextLost !== false ||
    canonicalDigest(retainedRenderer.viewPacket) !== manifest.viewPacketCommitment ||
    manifest.renderPacket.capturePolicyHash !== CANONICAL_CAPTURE_POLICY_HASH ||
    manifest.renderPacket.viewPacketCommitment !== manifest.viewPacketCommitment ||
    manifest.renderPacket.capturesCommitment !== canonicalDigest(manifest.captures) ||
    manifest.renderPacket.commitment !==
      canonicalDigest(captureRenderPacketBody(manifest.renderPacket)) ||
    manifest.renderPacketCommitment !== manifest.renderPacket.commitment ||
    manifest.commitment !== canonicalDigest(captureManifestBody(manifest)) ||
    fixture.captureManifest.byteDigest !== manifestByteDigest ||
    fixture.captureManifest.commitment !== manifest.commitment ||
    fixture.captureManifest.viewPacketCommitment !== manifest.viewPacketCommitment ||
    fixture.captureManifest.renderPacketCommitment !== manifest.renderPacketCommitment ||
    fixture.captureManifest.reviewHarnessEnvelopeCommitment !== envelope.commitment
  )
    throw new TypeError(
      "Step-44 capture manifest bytes, self commitment, camera/render packet, or exact return bindings drifted.",
    );

  exactKeys(
    manifest.captures,
    REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(({ fixtureKey }) => fixtureKey),
    "Step-44 capture manifest.captures",
  );
  const renderCommitments: Record<string, `sha256:${string}`> = {};
  const cameraCommitments = new Set<string>();
  for (const {
    fixtureKey,
    reviewedView,
    canonicalViewName,
  } of REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS) {
    const review = fixture.renderReviews[fixtureKey];
    const capture = manifest.captures[fixtureKey];
    const view = manifest.viewPacket.views.find(({ name }) => name === canonicalViewName);
    if (capture === undefined || view === undefined)
      throw new TypeError(`Step-44 capture manifest omitted ${canonicalViewName}.`);
    exactKeys(
      capture,
      [
        "artifactFile",
        "cameraCommitment",
        "candidateKey",
        "canonicalViewName",
        "height",
        "pixelDigest",
        "pngDigest",
        "reviewNote",
        "reviewOutcome",
        "selectedDocumentHash",
        "view",
        "width",
      ],
      `Step-44 capture manifest.${fixtureKey}`,
    );
    const expectedCameraCommitment = canonicalDigest({
      capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
      viewPacketCommitment: manifest.viewPacketCommitment,
      view,
    });
    requireProductionArtifactPath(
      review.artifactPath,
      `${PRODUCTION_REVIEW_ROOT}/real-build-prefix50-step44-${reviewedView}.png`,
      allowTestArtifactPaths,
      `Step-44 ${reviewedView}`,
    );
    const renderBytes = readRealBuildPrefix50Step44ReviewArtifact(
      repositoryRoot,
      review.artifactPath,
      MAXIMUM_PNG_BYTES,
      `Step-44 ${reviewedView}`,
    );
    const render = decodeRealBuildPrefix50Step44ReviewPng(
      renderBytes,
      CANONICAL_CAPTURE_POLICY.width * CANONICAL_CAPTURE_POLICY.height,
      `Step-44 ${reviewedView}`,
    );
    const reviewBody = withoutCommitment(review);
    if (
      review.view !== reviewedView ||
      review.canonicalViewName !== canonicalViewName ||
      review.commitment !== realBuildPrefix50Step44RenderReviewCommitment(reviewBody) ||
      basename(review.artifactPath) !== capture.artifactFile ||
      review.pngDigest !== capture.pngDigest ||
      review.pixelDigest !== capture.pixelDigest ||
      review.width !== capture.width ||
      review.height !== capture.height ||
      review.candidateKey !== envelope.candidateKey ||
      review.selectedDocumentHash !== envelope.selectedDocumentHash ||
      review.cameraCommitment !== capture.cameraCommitment ||
      review.cameraCommitment !== expectedCameraCommitment ||
      review.pngDigest !== sha256RealBuildPrefix50Step44ReviewBytes(renderBytes) ||
      review.pixelDigest !== sha256RealBuildPrefix50Step44ReviewBytes(render.rgba) ||
      review.width !== render.width ||
      review.height !== render.height ||
      render.width !== CANONICAL_CAPTURE_POLICY.width ||
      render.height !== CANONICAL_CAPTURE_POLICY.height ||
      capture.view !== reviewedView ||
      capture.canonicalViewName !== canonicalViewName ||
      capture.candidateKey !== envelope.candidateKey ||
      capture.selectedDocumentHash !== envelope.selectedDocumentHash ||
      capture.reviewOutcome !== null ||
      capture.reviewNote !== null ||
      review.outcome === "different" ||
      review.reviewNote.trim().length === 0
    )
      throw new TypeError(
        `Step-44 ${reviewedView} bytes, pixels, camera, manifest row, or review commitment drifted.`,
      );
    cameraCommitments.add(review.cameraCommitment);
    renderCommitments[fixtureKey] = review.commitment;
  }
  if (fixture.renderReviews.canonicalIsometric.outcome !== "same")
    throw new TypeError("Step-44 canonical-isometric review must visibly match PDF page 45.");
  if (cameraCommitments.size !== REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.length)
    throw new TypeError("Step-44 review requires seven distinct canonical camera commitments.");

  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-artifact-verification/1" as const,
    authority: "none" as const,
    sourcePdfDigest,
    physicalPageRerenderCommitment: canonicalDigest(physicalPageRerender),
    sourcePageRasterCommitment: fixture.sourcePageRaster.commitment,
    panelCropCommitment: fixture.panelCrop.commitment,
    captureManifestByteDigest: manifestByteDigest,
    captureManifestCommitment: manifest.commitment,
    viewPacketCommitment: manifest.viewPacketCommitment,
    renderPacketCommitment: manifest.renderPacketCommitment,
    reviewHarnessEnvelopeCommitment: envelope.commitment,
    returnResultCommitment: envelope.returnResultCommitment,
    candidateRosterCommitment: envelope.candidateRosterCommitment,
    step42_43RepairCommitment: envelope.step42_43RepairCommitment,
    step43PredecessorCommitment: envelope.step43PredecessorCommitment,
    selectedDocumentHash: envelope.selectedDocumentHash,
    selectedDocumentCommitment: envelope.selectedDocumentCommitment,
    renderCommitments: deepFreeze(renderCommitments),
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}
