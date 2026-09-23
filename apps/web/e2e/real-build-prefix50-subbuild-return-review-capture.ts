import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";
import { CANONICAL_CAPTURE_POLICY, CANONICAL_CAPTURE_POLICY_HASH } from "@lego-studio/rendering";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import type { Browser, ConsoleMessage, Page } from "playwright";

import { decodeRealBuildPngCapture } from "./real-build-png-capture.ts";
import type { RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44Page45CameraReceipt } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import {
  compareRealBuildPrefix50Step43To44FixedCamera,
  createRealBuildPrefix50Step44FixedCameraAfter,
  createRealBuildPrefix50Step44FixedCameraDeltaArtifact,
  deriveRealBuildPrefix50Step44FixedCameraDeltaPixels,
  type RealBuildPrefix50Step43FixedCameraBaselineArtifact,
  type RealBuildPrefix50Step44FixedCameraPixels,
} from "./real-build-prefix50-subbuild-return-review-fixed-camera.ts";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "./real-build-prefix50-subbuild-return-review-png.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views.ts";

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function pixelEvidence(bytes: Uint8Array): Promise<{
  width: number;
  height: number;
  pixelDigest: `sha256:${string}`;
  rgba: Uint8Array;
  canonicalPngBytes: Uint8Array;
}> {
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    bytes,
    Math.max(CANONICAL_CAPTURE_POLICY.width * CANONICAL_CAPTURE_POLICY.height, 720 * 470),
    "Step-44 browser capture",
  );
  return {
    width: decoded.width,
    height: decoded.height,
    pixelDigest: sha256(decoded.rgba),
    rgba: decoded.rgba,
    canonicalPngBytes: encodeCanonicalRealBuildPrefix50Step44ReviewPng(decoded),
  };
}

export async function seedRealBuildPrefix50Step44ReviewDocument(
  page: Page,
  document: BrickDocumentV1,
): Promise<void> {
  await page.evaluate(async (candidateDocument) => {
    const [repositoryModule, editorStateModule] = await Promise.all([
      import("../src/persistence/indexeddb-project-repository.ts"),
      import("../src/editor-state.ts"),
    ]);
    const { IndexedDbProjectRepository } = repositoryModule as {
      IndexedDbProjectRepository: new (
        factory?: IDBFactory,
        databaseName?: string,
      ) => {
        load(projectId: string): Promise<{ generation: number } | null>;
        save(projectId: string, state: unknown, generation: number): Promise<unknown>;
        close(): Promise<void>;
      };
    };
    const { createEditorState } = editorStateModule as {
      createEditorState(document: typeof candidateDocument): unknown;
    };
    const repository = new IndexedDbProjectRepository(indexedDB, "brick-studio");
    try {
      const current = await repository.load("primary-project");
      if (current === null) throw new Error("App did not initialize primary-project.");
      await repository.save(
        "primary-project",
        createEditorState(candidateDocument),
        current.generation,
      );
    } finally {
      await repository.close();
    }
  }, document);
}

async function captureFixedCameraPixels(input: {
  readonly page: Page;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
}): Promise<{ pngBytes: Uint8Array; rgba: Uint8Array; width: number; height: number }> {
  const request = {
    scene: "model-only" as const,
    renderMode: "instruction-art" as const,
    backgroundHex: 0x899093 as const,
    parameters: input.receipt.selectedParameters,
    frame: input.receipt.selectedFrame,
  };
  const capture = await input.page.evaluate(async (cameraRequest) => {
    if (!window.capture_instruction_view)
      throw new Error("window.capture_instruction_view is unavailable.");
    return window.capture_instruction_view(cameraRequest);
  }, request);
  if (
    capture.scene !== "model-only" ||
    capture.renderMode !== "instruction-art" ||
    capture.semanticColorMask !== null ||
    capture.backgroundHex !== 0x899093 ||
    capture.width !== 720 ||
    capture.height !== 470 ||
    capture.projectionMatrix.length !== 16 ||
    capture.matrixWorldInverse.length !== 16 ||
    ![...capture.projectionMatrix, ...capture.matrixWorldInverse].every(Number.isFinite) ||
    canonicalDigest({
      scene: capture.scene,
      backgroundHex: capture.backgroundHex,
      parameters: capture.parameters,
      frame: capture.frame,
      width: capture.width,
      height: capture.height,
    }) !== input.receipt.selectedCameraCommitment ||
    canonicalDigest({
      request: {
        scene: request.scene,
        backgroundHex: request.backgroundHex,
        parameters: request.parameters,
        frame: request.frame,
      },
      projectionMatrix: capture.projectionMatrix,
      matrixWorldInverse: capture.matrixWorldInverse,
    }) !== input.receipt.selectedRendererCameraCommitment
  )
    throw new TypeError("Real app fixed-camera capture drifted from the page-45 camera receipt.");
  const rawPngBytes = decodeRealBuildPngCapture(capture.pngDataUrl);
  const pixels = await pixelEvidence(rawPngBytes);
  if (pixels.width !== 720 || pixels.height !== 470)
    throw new TypeError("Real app fixed-camera PNG must decode as exactly 720x470 pixels.");
  return {
    pngBytes: pixels.canonicalPngBytes,
    rgba: pixels.rgba,
    width: pixels.width,
    height: pixels.height,
  };
}

export async function captureRealBuildPrefix50Step44FixedCameraAfter(input: {
  readonly page: Page;
  readonly receipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  readonly outputPath: string;
}): Promise<RealBuildPrefix50Step44FixedCameraPixels> {
  const pixels = await captureFixedCameraPixels(input);
  await writeFile(
    resolve(input.outputPath, "real-build-prefix50-step44-page45-fixed-camera.png"),
    pixels.pngBytes,
    { flag: "wx" },
  );
  return createRealBuildPrefix50Step44FixedCameraAfter({
    ...pixels,
    receipt: input.receipt,
    envelope: input.envelope,
    cameraCommitment: input.receipt.selectedCameraCommitment,
  });
}

function fixedCameraDeltaPng(rgba: Uint8Array): Uint8Array {
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width: 720, height: 470, rgba });
}

export interface RealBuildPrefix50Step44CandidateCaptureSummary {
  readonly schemaVersion: "lego.real-build-prefix50-step44-candidate-capture-summary/3";
  readonly scene: "model-only";
  readonly candidateKey: string;
  readonly selectedDocumentHash: `sha256:${string}`;
  readonly selectedDocumentCommitment: `sha256:${string}`;
  readonly reviewHarnessEnvelopeCommitment: `sha256:${string}`;
  readonly captureManifestFile: string;
  readonly captureManifestByteDigest: `sha256:${string}`;
  readonly captureManifestCommitment: `sha256:${string}`;
  readonly viewPacketCommitment: `sha256:${string}`;
  readonly renderPacketCommitment: `sha256:${string}`;
  readonly cameraCommitments: Readonly<Record<string, `sha256:${string}`>>;
  readonly captureRows: Readonly<Record<string, unknown>>;
  readonly captureSceneCommitment: `sha256:${string}`;
  readonly page45CameraReceiptCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineCommitment: `sha256:${string}`;
  readonly fixedCameraBaselineArtifactCommitment: `sha256:${string}`;
  readonly fixedCameraAfterCommitment: `sha256:${string}`;
  readonly fixedCameraDeltaCommitment: `sha256:${string}`;
  readonly fixedCameraDeltaArtifactCommitment: `sha256:${string}`;
}

export async function captureRealBuildPrefix50Step44ReviewCandidate(input: {
  readonly page: Page;
  readonly browser: Browser;
  readonly appUrl: string;
  readonly outputPath: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
  readonly page45CameraReceipt: RealBuildPrefix50Step44Page45CameraReceipt;
  readonly fixedCameraBaseline: RealBuildPrefix50Step44FixedCameraPixels;
  readonly fixedCameraBaselineArtifact: RealBuildPrefix50Step43FixedCameraBaselineArtifact;
}): Promise<RealBuildPrefix50Step44CandidateCaptureSummary> {
  const {
    page,
    browser,
    appUrl,
    outputPath,
    inputBytesHash,
    envelope,
    page45CameraReceipt,
    fixedCameraBaseline,
    fixedCameraBaselineArtifact,
  } = input;
  const consoleErrors: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => consoleErrors.push(String(error));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  try {
    if (page.url() === "about:blank") {
      await page.goto(appUrl);
      await page.waitForFunction(() => typeof window.get_model_snapshot === "function");
    }
    await seedRealBuildPrefix50Step44ReviewDocument(page, envelope.selectedDocument);
    await page.reload();
    await page.waitForFunction(
      (expectedHash) => window.get_model_snapshot?.().structuralHash === expectedHash,
      envelope.selectedDocumentHash,
    );
    const model = await page.evaluate(() => window.get_model_snapshot!());
    const observation = await page.evaluate(() => JSON.parse(window.render_app_to_text!()));
    if (
      model.partCount !== 280 ||
      !model.documentGloballyValid ||
      model.structuralHash !== envelope.selectedDocumentHash ||
      observation.documentHash !== envelope.selectedDocumentHash ||
      observation.validation?.targetDocumentHash !== envelope.selectedDocumentHash ||
      !observation.validation?.documentGloballyValid ||
      observation.renderer?.contextLost !== false ||
      observation.renderer?.viewPacket?.documentHash !== envelope.selectedDocumentHash
    )
      throw new TypeError(
        "Real app did not load and hard-validate the exact Step-44 returned document before capture.",
      );
    const packet = observation.renderer.viewPacket;
    const captures = await page.evaluate(() =>
      window.capture_model_views!({ scene: "model-only" }),
    );
    const exactViewNames = ["back", "front", "isometric", "left", "right", "top", "underside"];
    const actualViewNames = Object.keys(captures).sort();
    if (
      actualViewNames.length !== exactViewNames.length ||
      actualViewNames.some((name, index) => name !== exactViewNames[index])
    )
      throw new TypeError("Canonical capture hook did not return the exact seven-view roster.");
    const captureRows: Record<string, unknown> = {};
    const cameraCommitments: Record<string, `sha256:${string}`> = {};
    const viewPacketCommitment = canonicalDigest(packet);
    for (const {
      fixtureKey,
      reviewedView,
      canonicalViewName,
    } of REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS) {
      const dataUrl = captures[canonicalViewName];
      if (typeof dataUrl !== "string") throw new TypeError(`Missing ${canonicalViewName} PNG.`);
      const rawBytes = decodeRealBuildPngCapture(dataUrl);
      const pixels = await pixelEvidence(rawBytes);
      const bytes = pixels.canonicalPngBytes;
      if (
        pixels.width !== CANONICAL_CAPTURE_POLICY.width ||
        pixels.height !== CANONICAL_CAPTURE_POLICY.height
      )
        throw new TypeError(
          `${canonicalViewName} capture must be ${CANONICAL_CAPTURE_POLICY.width}x${CANONICAL_CAPTURE_POLICY.height}.`,
        );
      const view = packet.views.find((row: { name?: string }) => row.name === canonicalViewName);
      if (view === undefined) throw new TypeError(`View packet omitted ${canonicalViewName}.`);
      const filename = `real-build-prefix50-step44-${reviewedView}.png`;
      await writeFile(resolve(outputPath, filename), bytes, { flag: "wx" });
      const cameraCommitment = canonicalDigest({
        capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
        viewPacketCommitment,
        view,
      });
      cameraCommitments[fixtureKey] = cameraCommitment;
      captureRows[fixtureKey] = {
        scene: "model-only",
        view: reviewedView,
        canonicalViewName,
        artifactFile: filename,
        pngDigest: sha256(bytes),
        pixelDigest: pixels.pixelDigest,
        width: pixels.width,
        height: pixels.height,
        candidateKey: envelope.candidateKey,
        selectedDocumentHash: envelope.selectedDocumentHash,
        cameraCommitment,
        reviewOutcome: null,
        reviewNote: null,
      };
    }
    if (consoleErrors.length > 0)
      throw new Error(`Real app emitted browser errors: ${JSON.stringify(consoleErrors)}.`);
    const renderPacketBody = {
      schemaVersion: "lego.real-build-prefix50-step44-render-packet/1" as const,
      authority: "none" as const,
      documentHash: envelope.selectedDocumentHash,
      validationReport: observation.validation,
      validationReportCommitment: canonicalDigest(observation.validation),
      rendererSnapshot: observation.renderer,
      rendererSnapshotCommitment: canonicalDigest(observation.renderer),
      capturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
      viewPacketCommitment,
      capturesCommitment: canonicalDigest(captureRows),
    };
    const renderPacket = { ...renderPacketBody, commitment: canonicalDigest(renderPacketBody) };
    const fixedCameraAfter = await captureRealBuildPrefix50Step44FixedCameraAfter({
      page,
      receipt: page45CameraReceipt,
      envelope,
      outputPath,
    });
    const fixedCameraDelta = compareRealBuildPrefix50Step43To44FixedCamera(
      fixedCameraBaseline,
      fixedCameraAfter,
    );
    const deltaPixels = deriveRealBuildPrefix50Step44FixedCameraDeltaPixels(
      fixedCameraBaseline.rgba,
      fixedCameraAfter.rgba,
    );
    const deltaPngBytes = fixedCameraDeltaPng(deltaPixels.rgba);
    const deltaArtifactFile = "real-build-prefix50-step44-page45-fixed-camera-delta.png";
    await writeFile(resolve(outputPath, deltaArtifactFile), deltaPngBytes, { flag: "wx" });
    const fixedCameraDeltaArtifact = createRealBuildPrefix50Step44FixedCameraDeltaArtifact({
      delta: fixedCameraDelta,
      baseline: fixedCameraBaseline,
      after: fixedCameraAfter,
      artifactFile: deltaArtifactFile,
      pngBytes: deltaPngBytes,
    });
    const captureSceneCommitment = canonicalDigest({
      scene: "model-only",
      canonicalCapturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
      viewPacketCommitment,
      capturesCommitment: canonicalDigest(captureRows),
    });
    const body = {
      schemaVersion: "lego.real-build-prefix50-subbuild-return-review-capture/3" as const,
      authority: "none" as const,
      selectionAuthority: false as const,
      fixturePromotionAuthority: false as const,
      sourceSetId: "6651557" as const,
      captureScene: "model-only" as const,
      captureSceneCommitment,
      inputBytesHash,
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
      canonicalCapturePolicy: CANONICAL_CAPTURE_POLICY.version,
      canonicalCapturePolicyHash: CANONICAL_CAPTURE_POLICY_HASH,
      browserVersion: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewPacket: packet,
      viewPacketCommitment,
      renderPacket,
      renderPacketCommitment: renderPacket.commitment,
      captures: captureRows,
      page45CameraReceipt,
      page45CameraReceiptCommitment: page45CameraReceipt.commitment,
      fixedCameraBaselineCommitment: fixedCameraBaseline.evidence.commitment,
      fixedCameraBaselineArtifact,
      fixedCameraAfter: fixedCameraAfter.evidence,
      fixedCameraDelta,
      fixedCameraDeltaArtifact,
      reviewStatus: "unreviewed" as const,
    };
    const manifest = { ...body, commitment: canonicalDigest(body) };
    const manifestBytes = Buffer.from(canonicalStringify(manifest));
    const captureManifestFile = "real-build-prefix50-step44-capture-manifest.json";
    await writeFile(resolve(outputPath, captureManifestFile), manifestBytes, { flag: "wx" });
    return {
      schemaVersion: "lego.real-build-prefix50-step44-candidate-capture-summary/3",
      scene: "model-only",
      candidateKey: envelope.candidateKey,
      selectedDocumentHash: envelope.selectedDocumentHash,
      selectedDocumentCommitment: envelope.selectedDocumentCommitment,
      reviewHarnessEnvelopeCommitment: envelope.commitment,
      captureManifestFile,
      captureManifestByteDigest: sha256(manifestBytes),
      captureManifestCommitment: manifest.commitment,
      viewPacketCommitment,
      renderPacketCommitment: renderPacket.commitment,
      cameraCommitments,
      captureRows,
      captureSceneCommitment,
      page45CameraReceiptCommitment: page45CameraReceipt.commitment,
      fixedCameraBaselineCommitment: fixedCameraBaseline.evidence.commitment,
      fixedCameraBaselineArtifactCommitment: fixedCameraBaselineArtifact.commitment,
      fixedCameraAfterCommitment: fixedCameraAfter.evidence.commitment,
      fixedCameraDeltaCommitment: fixedCameraDelta.commitment,
      fixedCameraDeltaArtifactCommitment: fixedCameraDeltaArtifact.commitment,
    };
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}
