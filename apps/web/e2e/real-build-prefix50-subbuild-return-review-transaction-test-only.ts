import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import type { RealBuildPrefix50Step44CaptureManifestV3 } from "./real-build-prefix50-subbuild-return-review-artifact-contract.ts";
import { realBuildPrefix50Step44BatchDispatchTestOnly } from "./real-build-prefix50-subbuild-return-review-batch-dispatch.ts";
import { deriveRealBuildPrefix50Step44Page45CameraInstrument } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import {
  requireRealBuildPrefix50Step44RealDomainQualificationBinding,
  type RealBuildPrefix50Step44RealDomainQualificationBinding,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import { drawRealBuildPrefix50Step44Contained } from "./real-build-prefix50-subbuild-return-review-contact-sheet-layout.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
  runRealBuildPrefix50Step44ReviewTransaction,
  type RealBuildPrefix50Step44TransactionComposeInput,
  type RealBuildPrefix50Step44TransactionDefinition,
} from "./real-build-prefix50-subbuild-return-review-transaction.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views.ts";

const CAPTURE_COUNT = 3 as const;
const CELL_WIDTH = 144;
const CELL_HEIGHT = 108;
const LABEL_WIDTH = 240;
const HEADER_HEIGHT = 180;
const ROW_HEIGHT = 120;

function requireTestRuntime(): void {
  if (process.env.NODE_ENV !== "test")
    throw new TypeError("Step-44 three-row transaction is available only to the test runtime.");
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function canvasFromRgba(width: number, height: number, rgba: Uint8Array) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  image.data.set(rgba);
  context.putImageData(image, 0, 0);
  return canvas;
}

async function readCaptureCells(input: {
  readonly withheldOutputPath: string;
  readonly artifactDirectory: string;
  readonly captureManifestFile: string;
  readonly captureManifestByteDigest: `sha256:${string}`;
  readonly captureManifestCommitment: `sha256:${string}`;
}) {
  const candidatePath = resolve(input.withheldOutputPath, input.artifactDirectory);
  const manifestBytes = await readFile(resolve(candidatePath, input.captureManifestFile));
  const manifest = JSON.parse(
    manifestBytes.toString("utf8"),
  ) as RealBuildPrefix50Step44CaptureManifestV3;
  if (
    sha256(manifestBytes) !== input.captureManifestByteDigest ||
    manifest.commitment !== input.captureManifestCommitment ||
    manifest.commitment !== canonicalDigest(withoutCommitment(manifest))
  )
    throw new TypeError("Step-44 three-row transaction capture manifest drifted on reopen.");
  const descriptors = [
    {
      file: "real-build-prefix50-step44-page45-fixed-camera.png",
      width: 720,
      height: 470,
      pngDigest: manifest.fixedCameraAfter.pngDigest,
      pixelDigest: manifest.fixedCameraAfter.pixelDigest,
    },
    ...REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(({ fixtureKey, reviewedView }) => {
      const row = manifest.captures[fixtureKey];
      if (row === undefined)
        throw new TypeError(`Step-44 three-row transaction omitted ${fixtureKey}.`);
      return {
        file: `real-build-prefix50-step44-${reviewedView}.png`,
        width: 640,
        height: 480,
        pngDigest: row.pngDigest,
        pixelDigest: row.pixelDigest,
      };
    }),
    {
      file: "real-build-prefix50-step44-page45-fixed-camera-delta.png",
      width: 720,
      height: 470,
      pngDigest: manifest.fixedCameraDeltaArtifact.pngDigest,
      pixelDigest: manifest.fixedCameraDeltaArtifact.pixelDigest,
    },
  ];
  const cells = [];
  for (const descriptor of descriptors) {
    const bytes = await readFile(resolve(candidatePath, descriptor.file));
    const decoded = decodeRealBuildPrefix50Step44ReviewPng(
      bytes,
      descriptor.width * descriptor.height,
      `Step-44 three-row transaction ${descriptor.file}`,
    );
    if (
      decoded.width !== descriptor.width ||
      decoded.height !== descriptor.height ||
      sha256(bytes) !== descriptor.pngDigest ||
      sha256(decoded.rgba) !== descriptor.pixelDigest
    )
      throw new TypeError(
        `Step-44 three-row transaction ${descriptor.file} bytes or pixels drifted.`,
      );
    cells.push({ ...descriptor, rgba: decoded.rgba });
  }
  return { manifest, cells };
}

async function composeThreeRowContact(input: RealBuildPrefix50Step44TransactionComposeInput) {
  requireTestRuntime();
  if (input.captures.length !== CAPTURE_COUNT)
    throw new TypeError("Step-44 three-row contact requires exactly three dispatched captures.");
  const baselineArtifact = input.cameraInstrument.fixedCameraBaselineArtifact;
  const baselineBytes = await readFile(
    resolve(input.withheldOutputPath, baselineArtifact.artifactFile),
  );
  const baseline = decodeRealBuildPrefix50Step44ReviewPng(
    baselineBytes,
    baselineArtifact.width * baselineArtifact.height,
    "Step-44 three-row transaction shared baseline",
  );
  if (
    sha256(baselineBytes) !== baselineArtifact.pngDigest ||
    sha256(baseline.rgba) !== baselineArtifact.pixelDigest
  )
    throw new TypeError("Step-44 three-row transaction baseline bytes or pixels drifted.");
  const rows = [];
  for (const capture of input.captures) {
    const reopened = await readCaptureCells({
      withheldOutputPath: input.withheldOutputPath,
      artifactDirectory: capture.artifactDirectory,
      captureManifestFile: capture.captureManifestFile,
      captureManifestByteDigest: capture.captureManifestByteDigest,
      captureManifestCommitment: capture.captureManifestCommitment,
    });
    rows.push({ capture, ...reopened });
  }
  const cellCount = rows[0]!.cells.length;
  const width = LABEL_WIDTH + cellCount * CELL_WIDTH;
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#f7f7f7";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111111";
  context.font = "12px monospace";
  context.fillText("NONPROMOTABLE three-row Step 44 transaction smoke", 8, 22);
  const reference = decodeRealBuildPrefix50Step44ReviewPng(
    input.reference.pngBytes,
    input.reference.evidence.width * input.reference.evidence.height,
    "Step-44 three-row transaction page-45 reference",
  );
  drawRealBuildPrefix50Step44Contained(
    context,
    canvasFromRgba(reference.width, reference.height, reference.rgba),
    8,
    30,
    LABEL_WIDTH - 16,
    HEADER_HEIGHT - 38,
  );
  for (const [rowIndex, row] of rows.entries()) {
    const top = HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
    context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#eeeeee";
    context.fillRect(0, top, width, ROW_HEIGHT);
    context.fillStyle = "#111111";
    context.font = "bold 18px monospace";
    context.fillText(row.capture.blindId, 12, top + 38);
    for (const [cellIndex, cell] of row.cells.entries())
      drawRealBuildPrefix50Step44Contained(
        context,
        canvasFromRgba(cell.width, cell.height, cell.rgba),
        LABEL_WIDTH + cellIndex * CELL_WIDTH,
        top + 6,
        CELL_WIDTH,
        CELL_HEIGHT,
      );
  }
  const pngBytes = canvas.toBuffer("image/png");
  const pixels = context.getImageData(0, 0, width, height).data;
  const artifactFile = "real-build-prefix50-step44-three-row-smoke-contact.png";
  await writeFile(resolve(input.publicOutputPath, artifactFile), pngBytes, { flag: "wx" });
  const reopened = decodeRealBuildPrefix50Step44ReviewPng(
    pngBytes,
    width * height,
    "Step-44 three-row transaction contact output",
  );
  const pixelDigest = sha256(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
  if (
    reopened.width !== width ||
    reopened.height !== height ||
    sha256(reopened.rgba) !== pixelDigest
  )
    throw new TypeError("Step-44 three-row transaction contact dimensions drifted on reopen.");
  const body = {
    schemaVersion: "lego.real-build-prefix50-step44-three-row-smoke-contact/1" as const,
    authority: "none" as const,
    promotionAuthority: false as const,
    sourceBatchCandidateCount: 211 as const,
    capturedCandidateCount: CAPTURE_COUNT,
    blindIds: rows.map(({ capture }) => capture.blindId),
    artifactFile,
    width,
    height,
    pngDigest: sha256(pngBytes),
    pixelDigest,
    referenceCommitment: input.reference.evidence.commitment,
    fixedCameraBaselineArtifactCommitment: baselineArtifact.commitment,
    captureManifestCommitments: rows.map(({ capture }) => capture.captureManifestCommitment),
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

type ThreeRowContact = Awaited<ReturnType<typeof composeThreeRowContact>>;

// The exact production contact and manifest definitions require 211 capture rows, so this nonpromotable definition replaces only those cardinality-bound leaves while retaining the shared transaction, real capture path, first-three dispatch core, PNG reopen checks, cleanup, and COMPLETE-last publication.
const THREE_ROW_DEFINITION: RealBuildPrefix50Step44TransactionDefinition<ThreeRowContact> = {
  mode: "test-only-three-row",
  captureCount: CAPTURE_COUNT,
  publicManifestFile: "real-build-prefix50-step44-three-row-smoke-manifest.json",
  withheldManifestFile: "real-build-prefix50-step44-three-row-smoke-withheld-manifest.json",
  successFile: "real-build-prefix50-step44-three-row-smoke-success.json",
  completeFile: REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
  deriveCamera: deriveRealBuildPrefix50Step44Page45CameraInstrument,
  dispatch: realBuildPrefix50Step44BatchDispatchTestOnly.dispatchFirstThree,
  composeContact: composeThreeRowContact,
  publicManifestBody: ({ plan, captures, contact }) => ({
    schemaVersion: "lego.real-build-prefix50-step44-three-row-headless-smoke/2" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    promotionAuthority: false as const,
    sourceBatchCandidateCount: 211 as const,
    capturedCandidateCount: CAPTURE_COUNT,
    dispatchPlanCommitment: plan.commitment,
    blindIds: captures.map(({ blindId }) => blindId),
    contact,
  }),
  withheldManifestBody: ({ inputBytesHash, batch, plan, planBytes, captures, publicManifest }) => ({
    schemaVersion: "lego.real-build-prefix50-step44-three-row-headless-smoke-withheld/1" as const,
    authority: "none" as const,
    publicDuringReview: false as const,
    promotionAuthority: false as const,
    sourceBatchCandidateCount: 211 as const,
    capturedCandidateCount: CAPTURE_COUNT,
    expectedHarnessInputBytesHash: inputBytesHash,
    reviewBatchEnvelopeCommitment: batch.commitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    dispatchPlanFile: "real-build-prefix50-step44-blind-dispatch-plan.json" as const,
    dispatchPlanByteDigest: sha256(planBytes),
    dispatchPlanCommitment: plan.commitment,
    captures,
    publicManifest,
  }),
  successBody: ({ publicManifest, withheldManifest, contact, cleanup }) => ({
    schemaVersion: "lego.real-build-prefix50-step44-three-row-headless-smoke-success/2" as const,
    authority: "none" as const,
    status: "complete" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    promotionAuthority: false as const,
    sourceBatchCandidateCount: 211 as const,
    capturedCandidateCount: CAPTURE_COUNT,
    publicManifestFile: publicManifest.artifactFile,
    publicManifestByteDigest: publicManifest.byteDigest,
    publicManifestCommitment: publicManifest.commitment,
    withheldManifestFile: withheldManifest.artifactFile,
    withheldManifestByteDigest: withheldManifest.byteDigest,
    withheldManifestCommitment: withheldManifest.commitment,
    contactArtifactFile: contact.artifactFile,
    contactPngDigest: contact.pngDigest,
    contactPixelDigest: contact.pixelDigest,
    cleanup,
  }),
  completeBody: ({
    inputBytesHash,
    batch,
    publicManifest,
    withheldManifest,
    success,
    cleanup,
    publicationDirectories,
  }) => ({
    schemaVersion: "lego.real-build-prefix50-step44-three-row-publication-complete/2" as const,
    authority: "none" as const,
    status: "complete" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    promotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    expectedHarnessInputBytesHash: inputBytesHash,
    reviewBatchEnvelopeCommitment: batch.commitment,
    candidateRosterCommitment: batch.candidateRosterCommitment,
    candidateKeysCommitment: batch.candidateKeysCommitment,
    sourceBatchCandidateCount: 211 as const,
    capturedCandidateCount: CAPTURE_COUNT,
    publicDirectory: "public" as const,
    withheldDirectory: "withheld" as const,
    publicationDirectories,
    publicManifestFile: publicManifest.artifactFile,
    publicManifestByteDigest: publicManifest.byteDigest,
    publicManifestCommitment: publicManifest.commitment,
    withheldManifestFile: withheldManifest.artifactFile,
    withheldManifestByteDigest: withheldManifest.byteDigest,
    withheldManifestCommitment: withheldManifest.commitment,
    publicSuccessFile: success.artifactFile,
    publicSuccessByteDigest: success.byteDigest,
    publicSuccessCommitment: success.commitment,
    cleanup,
  }),
};

export async function runRealBuildPrefix50Step44ThreeRowTransactionForTest(input: {
  readonly outputPath: string;
  readonly repositoryRoot: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}) {
  requireTestRuntime();
  requireRealBuildPrefix50Step44RealDomainQualificationBinding(input.realDomainQualification);
  return runRealBuildPrefix50Step44ReviewTransaction({
    ...input,
    definition: THREE_ROW_DEFINITION,
  });
}

export async function runRealBuildPrefix50Step44WiringFailureProbeForTest(input: {
  readonly outputPath: string;
  readonly repositoryRoot: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): Promise<never> {
  requireTestRuntime();
  const failureDefinition: RealBuildPrefix50Step44TransactionDefinition<ThreeRowContact> = {
    ...THREE_ROW_DEFINITION,
    runLifecycle: async () => ({
      status: "failed",
      primaryError: new Error("Injected test-only Step-44 transaction wiring failure."),
      cleanupErrors: [],
      cleanup: {
        browserClosed: true,
        browserProcessTreeClosed: true,
        serverClosed: true,
      },
    }),
  };
  await runRealBuildPrefix50Step44ReviewTransaction({
    ...input,
    definition: failureDefinition,
  });
  throw new Error("Injected Step-44 transaction wiring failure unexpectedly completed.");
}

export async function runRealBuildPrefix50Step44PublicationFailureProbeForTest(input: {
  readonly outputPath: string;
  readonly repositoryRoot: string;
  readonly inputBytesHash: `sha256:${string}`;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
}): Promise<never> {
  requireTestRuntime();
  await mkdir(input.outputPath, { recursive: false });
  await runRealBuildPrefix50Step44ReviewTransaction({
    ...input,
    definition: THREE_ROW_DEFINITION,
  });
  throw new Error("Injected Step-44 publication collision unexpectedly completed.");
}
