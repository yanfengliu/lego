import { createHash } from "node:crypto";

import {
  canonicalDigest,
  documentStructuralHash,
  exportBrickDocumentToLDraw,
  importBrickDocumentFromLDraw,
} from "@lego-studio/brick-kernel";
import type { OrthographicViewFrame, OrthographicViewParameters } from "@lego-studio/rendering";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import type { Dialog, Page } from "playwright";

import { decodeRealBuildPngCapture } from "./real-build-png-capture.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-preregistered-law.ts";
import type { RealBuildPrefix50Step44CameraRenderEvidence } from "./real-build-prefix50-subbuild-return-review-camera-search.ts";
import {
  cloneCameraFrame,
  cloneCameraParameters,
} from "./real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "./real-build-prefix50-subbuild-return-review-png.ts";
import {
  requireRealBuildPrefix50SemanticColorPolicy,
  type RealBuildPrefix50SemanticColorPolicy,
  type RealBuildPrefix50Step44SemanticColorRenderEvidence,
} from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";

export type { RealBuildPrefix50Step44SemanticColorRenderEvidence } from "./real-build-prefix50-subbuild-return-review-camera-semantic.ts";

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalPixelsFromPng(bytes: Uint8Array): {
  readonly pngBytes: Uint8Array;
  readonly rgba: Uint8Array;
} {
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    bytes,
    REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH *
      REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT,
    "Step-44 real-app camera render",
  );
  if (
    decoded.width !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH ||
    decoded.height !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT
  )
    throw new TypeError("Step-44 real-app camera render must decode as exactly 720x470 pixels.");
  return {
    pngBytes: encodeCanonicalRealBuildPrefix50Step44ReviewPng(decoded),
    rgba: decoded.rgba,
  };
}

export async function seedRealBuildPrefix50DocumentInApp(
  page: Page,
  parentDocument: BrickDocumentV1,
  expectedPartCount: number,
  label: string,
): Promise<void> {
  const parentHash = documentStructuralHash(parentDocument);
  const initial = await page.evaluate(() => window.get_model_snapshot?.() ?? null);
  if (initial === null)
    throw new TypeError(
      "Static review inspection hooks are unavailable; run npm run build:instruction-review and use its isolated static server.",
    );
  if (initial.structuralHash === parentHash) {
    if (initial.partCount !== expectedPartCount || !initial.documentGloballyValid)
      throw new TypeError(`Real app has an invalid or miscounted ${label}.`);
    // Structural equivalence is sufficient for camera capture. Do not start an
    // asynchronous import and mistake the existing state for its completion.
    return;
  }
  const ldraw = exportBrickDocumentToLDraw(parentDocument);
  if (documentStructuralHash(importBrickDocumentFromLDraw(ldraw)) !== parentHash)
    throw new TypeError(`The ${label} does not survive UI import with its exact structure.`);
  // The harness owns this isolated page. Use the shipped Import control, never private
  // source-module imports or direct writes into its IndexedDB project store.
  const dialogErrors: unknown[] = [];
  const dialogTasks: Promise<void>[] = [];
  const handleDialog = (dialog: Dialog): void => {
    const expected =
      dialog.type() === "confirm" &&
      dialog.message() === "Discard this unsaved session and import the selected model?";
    if (!expected)
      dialogErrors.push(new TypeError(`Unexpected import dialog: ${dialog.message()}`));
    dialogTasks.push(
      (expected ? dialog.accept() : dialog.dismiss()).catch((error: unknown) => {
        dialogErrors.push(error);
      }),
    );
  };
  page.on("dialog", handleDialog);
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Import", exact: true }).click(),
    ]);
    await chooser.setFiles({
      name: "instruction-review-parent.mpd",
      mimeType: "text/plain",
      buffer: Buffer.from(ldraw),
    });
    await page.waitForFunction(
      (expectedHash) => window.get_model_snapshot?.().structuralHash === expectedHash,
      parentHash,
    );
    await Promise.all(dialogTasks);
    if (dialogErrors.length > 0)
      throw new AggregateError(dialogErrors, `The ${label} UI import was not confirmed.`);
  } finally {
    page.off("dialog", handleDialog);
    await Promise.all(dialogTasks);
  }
  const snapshot = await page.evaluate(() => window.get_model_snapshot!());
  if (
    snapshot.partCount !== expectedPartCount ||
    !snapshot.documentGloballyValid ||
    snapshot.structuralHash !== parentHash
  )
    throw new TypeError(`Real app did not load the exact hard-valid structure for ${label}.`);
}

export async function seedRealBuildPrefix50Step44SharedParentInApp(
  page: Page,
  parentDocument: BrickDocumentV1,
): Promise<void> {
  await seedRealBuildPrefix50DocumentInApp(page, parentDocument, 257, "shared Step-43 parent");
}

export async function renderRealBuildPrefix50Step44SharedParentInApp(
  page: Page,
  parameters: OrthographicViewParameters,
  frame: OrthographicViewFrame,
): Promise<RealBuildPrefix50Step44CameraRenderEvidence> {
  const stableParameters = cloneCameraParameters(parameters);
  const stableFrame = cloneCameraFrame(frame);
  const cameraBindingRequest = {
    scene: "model-only" as const,
    backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
    parameters: stableParameters,
    frame: stableFrame,
  };
  const request = { ...cameraBindingRequest, renderMode: "instruction-art" as const };
  const capture = await page.evaluate(async (cameraRequest) => {
    if (!window.capture_instruction_view)
      throw new Error("window.capture_instruction_view is unavailable.");
    return window.capture_instruction_view(cameraRequest);
  }, request);
  if (
    capture.scene !== "model-only" ||
    capture.renderMode !== "instruction-art" ||
    capture.semanticColorMask !== null ||
    capture.backgroundHex !== REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX ||
    capture.width !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH ||
    capture.height !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT ||
    canonicalDigest(capture.parameters) !== canonicalDigest(stableParameters) ||
    canonicalDigest(capture.frame) !== canonicalDigest(stableFrame) ||
    capture.projectionMatrix.length !== 16 ||
    capture.matrixWorldInverse.length !== 16 ||
    ![...capture.projectionMatrix, ...capture.matrixWorldInverse].every(Number.isFinite)
  )
    throw new TypeError("Real app returned stale or unbounded Step-44 camera evidence.");
  const rawPngBytes = decodeRealBuildPngCapture(capture.pngDataUrl);
  const { pngBytes, rgba } = canonicalPixelsFromPng(rawPngBytes);
  const projectionMatrix = Object.freeze([...capture.projectionMatrix]);
  const matrixWorldInverse = Object.freeze([...capture.matrixWorldInverse]);
  return {
    pngBytes,
    rgba,
    pngDigest: sha256(pngBytes),
    pixelDigest: sha256(rgba),
    projectionMatrix,
    matrixWorldInverse,
    rendererCameraCommitment: canonicalDigest({
      request: cameraBindingRequest,
      projectionMatrix,
      matrixWorldInverse,
    }),
  };
}

export async function renderRealBuildPrefix50Step44SemanticColorMaskInApp<
  TPolicy extends RealBuildPrefix50SemanticColorPolicy,
>(
  page: Page,
  parameters: OrthographicViewParameters,
  frame: OrthographicViewFrame,
  inputPolicy: TPolicy,
): Promise<RealBuildPrefix50Step44SemanticColorRenderEvidence> {
  const policy = requireRealBuildPrefix50SemanticColorPolicy(inputPolicy);
  const stableParameters = cloneCameraParameters(parameters);
  const stableFrame = cloneCameraFrame(frame);
  const request = {
    scene: "model-only" as const,
    renderMode: "semantic-color-id-mask" as const,
    targetColorIds: [...policy.targetColorIds],
    backgroundHex: REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX,
    parameters: stableParameters,
    frame: stableFrame,
  };
  const capture = await page.evaluate(async (cameraRequest) => {
    if (!window.capture_instruction_view)
      throw new Error("window.capture_instruction_view is unavailable.");
    return window.capture_instruction_view(cameraRequest);
  }, request);
  if (
    capture.scene !== "model-only" ||
    capture.renderMode !== "semantic-color-id-mask" ||
    capture.semanticColorMask === null ||
    capture.backgroundHex !== REAL_BUILD_PREFIX50_STEP44_CAMERA_BACKGROUND_HEX ||
    capture.width !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_WIDTH ||
    capture.height !== REAL_BUILD_PREFIX50_STEP44_CAMERA_RASTER_HEIGHT ||
    canonicalDigest(capture.parameters) !== canonicalDigest(stableParameters) ||
    canonicalDigest(capture.frame) !== canonicalDigest(stableFrame) ||
    canonicalDigest(capture.semanticColorMask) !== policy.classificationCommitment ||
    capture.projectionMatrix.length !== 16 ||
    capture.matrixWorldInverse.length !== 16 ||
    ![...capture.projectionMatrix, ...capture.matrixWorldInverse].every(Number.isFinite)
  )
    throw new TypeError(
      "Real app returned stale, unbounded, or misclassified Step-44 semantic color evidence.",
    );
  const rawPngBytes = decodeRealBuildPngCapture(capture.pngDataUrl);
  const { pngBytes, rgba } = canonicalPixelsFromPng(rawPngBytes);
  const projectionMatrix = Object.freeze([...capture.projectionMatrix]);
  const matrixWorldInverse = Object.freeze([...capture.matrixWorldInverse]);
  const classification = Object.freeze({
    targetColorIds: Object.freeze([...capture.semanticColorMask.targetColorIds]),
    targetPartIds: Object.freeze([...capture.semanticColorMask.targetPartIds]),
    otherPartIds: Object.freeze([...capture.semanticColorMask.otherPartIds]),
  });
  const classificationCommitment = canonicalDigest(classification);
  return {
    pngBytes,
    rgba,
    pngDigest: sha256(pngBytes),
    pixelDigest: sha256(rgba),
    projectionMatrix,
    matrixWorldInverse,
    rendererCameraCommitment: canonicalDigest({
      request,
      policyCommitment: policy.commitment,
      classificationCommitment,
      projectionMatrix,
      matrixWorldInverse,
    }),
    policyCommitment: policy.commitment,
    classification,
    classificationCommitment,
  };
}
