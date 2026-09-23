import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import { canonicalDigest, canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50SubBuildReturnReviewBatchEnvelope } from "./real-build-prefix50-subbuild-return-contract.ts";
import { readRealBuildPrefix50Step44ReviewArtifact } from "./real-build-prefix50-subbuild-return-review-artifact-io.ts";
import {
  createRealBuildPrefix50Step44WithheldUnblindingMap,
  sha256RealBuildPrefix50Step44BlindBytes,
  type RealBuildPrefix50Step44BlindDispatchPlan,
} from "./real-build-prefix50-subbuild-return-review-blind.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
  REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
  REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  type RealBuildPrefix50Step44BlindContactSheetPage,
  type RealBuildPrefix50Step44BlindReferenceReceipt,
  type RealBuildPrefix50Step44BlindReviewPacket,
} from "./real-build-prefix50-subbuild-return-review-blind-contract.ts";
import { realBuildPrefix50Step44BlindPacketCoreCommitment } from "./real-build-prefix50-subbuild-return-review-blind-packet.ts";
import { persistRealBuildPrefix50Step44BlindFixedCameraBaseline } from "./real-build-prefix50-subbuild-return-review-contact-sheet-baseline.ts";
import { drawRealBuildPrefix50Step44Contained } from "./real-build-prefix50-subbuild-return-review-contact-sheet-layout.ts";
import type { RealBuildPrefix50Step44WithheldSourceReferenceReceipt } from "./real-build-prefix50-subbuild-return-review-contact-sheet-reference-contract.ts";
import {
  verifyRealBuildPrefix50Step44ContactSheetSources,
  type RealBuildPrefix50Step44BatchCaptureRow,
} from "./real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "./real-build-prefix50-subbuild-return-review-png.ts";
import { rerenderRealBuildPrefix50Step44PdfPage } from "./real-build-prefix50-subbuild-return-review-pdf.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views.ts";
import type { RealBuildPrefix50Step44Page45CameraInstrument } from "./real-build-prefix50-subbuild-return-review-camera.ts";
import type { RealBuildPrefix50Step44RealDomainQualificationBinding } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-gate-contract.ts";
import { issueRealBuildPrefix50Step44LaterSourceReadCapability } from "./real-build-prefix50-step44-later-source-authority.ts";

export type { RealBuildPrefix50Step44BatchCaptureRow } from "./real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";
export { fitRealBuildPrefix50Step44ContainedRect } from "./real-build-prefix50-subbuild-return-review-contact-sheet-layout.ts";

const ROWS_PER_PAGE = 16;
const LABEL_WIDTH = 320;
const CELL_WIDTH = 144;
const CELL_HEIGHT = 108;
const ROW_HEIGHT = 120;
const HEADER_HEIGHT = 230;
const MAXIMUM_CONTACT_SHEET_PIXELS = 4_000_000;

export async function requireRealBuildPrefix50Step44SeparatedReviewRoots(input: {
  readonly publicOutputPath: string;
  readonly withheldOutputPath: string;
}): Promise<void> {
  const [publicRoot, withheldRoot] = await Promise.all([
    realpath(input.publicOutputPath),
    realpath(input.withheldOutputPath),
  ]);
  if (
    publicRoot === withheldRoot ||
    dirname(publicRoot) !== dirname(withheldRoot) ||
    basename(publicRoot) !== "public" ||
    basename(withheldRoot) !== "withheld"
  )
    throw new TypeError(
      "Step-44 blinded review requires distinct sibling public/ and withheld/ roots.",
    );
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

export async function createRealBuildPrefix50Step44ContactSheetReference(input: {
  readonly repositoryRoot: string;
  readonly outputPath: string;
  readonly realDomainQualification: RealBuildPrefix50Step44RealDomainQualificationBinding;
}) {
  if (arguments.length !== 1)
    throw new TypeError("Step-44 contact reference accepts only its closed repository input.");
  const sourcePdfArtifactPath = REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH;
  const page = await rerenderRealBuildPrefix50Step44PdfPage({
    capability: issueRealBuildPrefix50Step44LaterSourceReadCapability({
      repositoryRoot: input.repositoryRoot,
      qualification: input.realDomainQualification,
      purpose: "page45-contact-raster",
      physicalPageNumber: 45,
    }),
    purpose: "page45-contact-raster",
    densityDpi: 180,
    retainDecodedBytes: true,
  });
  if (page.width !== 1_914 || page.height !== 1_361 || page.rgba === undefined)
    throw new TypeError(
      "Step-44 contact-sheet reference requires exact page-45 dimensions 1914x1361 at 180 DPI.",
    );
  const cropX = 850 as const;
  const cropY = 350 as const;
  const width = 720 as const;
  const height = 470 as const;
  const rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((cropY + row) * page.width + cropX) * 4;
    rgba.set(page.rgba.subarray(sourceStart, sourceStart + width * 4), row * width * 4);
  }
  const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width, height, rgba });
  const artifactFile = "real-build-prefix50-step44-reference-page45-crop.png" as const;
  await writeFile(resolve(input.outputPath, artifactFile), pngBytes, { flag: "wx" });
  const body: Omit<RealBuildPrefix50Step44WithheldSourceReferenceReceipt, "commitment"> = {
    schemaVersion: "lego.real-build-prefix50-step44-contact-sheet-reference/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    sourcePdfArtifactPath,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    pageNumber: 45 as const,
    renderer: "poppler-pdftoppm" as const,
    rendererVersion: page.rendererVersion,
    densityDpi: 180 as const,
    sourcePagePngDigest: page.pngDigest,
    sourcePagePixelDigest: page.pixelDigest,
    x: cropX,
    y: cropY,
    width,
    height,
    artifactFile,
    pngDigest: sha256(pngBytes),
    pixelDigest: sha256(rgba),
  };
  const evidence: RealBuildPrefix50Step44WithheldSourceReferenceReceipt = deepFreeze({
    ...body,
    commitment: canonicalDigest(body),
  });
  return { evidence, pngBytes };
}

async function verifyFinishedSheet(
  publicOutputPath: string,
  page: RealBuildPrefix50Step44BlindContactSheetPage,
) {
  const bytes = readRealBuildPrefix50Step44ReviewArtifact(
    publicOutputPath,
    page.artifactFile,
    16 * 1024 * 1024,
    `Step-44 finished blind sheet ${page.pageNumber}`,
  );
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(
    bytes,
    MAXIMUM_CONTACT_SHEET_PIXELS,
    `Step-44 finished blind sheet ${page.pageNumber}`,
  );
  if (
    page.pngDigest !== sha256(bytes) ||
    page.pixelDigest !== sha256(decoded.rgba) ||
    page.width !== decoded.width ||
    page.height !== decoded.height
  )
    throw new TypeError(
      `Step-44 finished blind sheet ${page.pageNumber} failed independent byte/pixel/dimension verification.`,
    );
  const body = {
    artifactFile: page.artifactFile,
    pageCommitment: page.commitment,
    pngDigest: page.pngDigest,
    pixelDigest: page.pixelDigest,
    width: page.width,
    height: page.height,
  };
  return deepFreeze({ ...body, commitment: canonicalDigest(body) });
}

export async function writeRealBuildPrefix50Step44ReviewContactSheets(input: {
  readonly publicOutputPath: string;
  readonly withheldOutputPath: string;
  readonly batch: RealBuildPrefix50SubBuildReturnReviewBatchEnvelope;
  readonly plan: RealBuildPrefix50Step44BlindDispatchPlan;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly reference: Awaited<
    ReturnType<typeof createRealBuildPrefix50Step44ContactSheetReference>
  >;
  readonly cameraInstrument: RealBuildPrefix50Step44Page45CameraInstrument;
}) {
  const { publicOutputPath, withheldOutputPath, batch, plan, captures, reference } = input;
  await requireRealBuildPrefix50Step44SeparatedReviewRoots({
    publicOutputPath,
    withheldOutputPath,
  });
  const referenceBytes = readRealBuildPrefix50Step44ReviewArtifact(
    publicOutputPath,
    reference.evidence.artifactFile,
    16 * 1024 * 1024,
    "Step-44 blind-sheet page-45 reference",
  );
  const referenceDecoded = decodeRealBuildPrefix50Step44ReviewPng(
    referenceBytes,
    reference.evidence.width * reference.evidence.height,
    "Step-44 blind-sheet page-45 reference",
  );
  if (
    reference.evidence.commitment !== canonicalDigest(withoutCommitment(reference.evidence)) ||
    reference.evidence.pngDigest !== sha256(referenceBytes) ||
    reference.evidence.pixelDigest !== sha256(referenceDecoded.rgba) ||
    reference.evidence.width !== referenceDecoded.width ||
    reference.evidence.height !== referenceDecoded.height
  )
    throw new TypeError("Step-44 blind-sheet page-45 reference bytes or pixels drifted.");
  const publicReferenceBody: Omit<RealBuildPrefix50Step44BlindReferenceReceipt, "commitment"> = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-reference/1",
    authority: "none",
    sourceSetId: "6651557",
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    pageNumber: 45,
    renderer: "poppler-pdftoppm",
    rendererVersion: reference.evidence.rendererVersion,
    densityDpi: 180,
    sourcePagePngDigest: reference.evidence.sourcePagePngDigest,
    sourcePagePixelDigest: reference.evidence.sourcePagePixelDigest,
    x: 850,
    y: 350,
    width: 720,
    height: 470,
    artifactFile: "real-build-prefix50-step44-reference-page45-crop.png",
    pngDigest: reference.evidence.pngDigest,
    pixelDigest: reference.evidence.pixelDigest,
  };
  const publicReference = deepFreeze({
    ...publicReferenceBody,
    commitment: canonicalDigest(publicReferenceBody),
  });
  const verifiedSources = await verifyRealBuildPrefix50Step44ContactSheetSources({
    outputPath: withheldOutputPath,
    batch,
    plan,
    captures,
    realDomainQualification: input.cameraInstrument.realDomainQualification,
    page45Reference: reference.evidence,
  });
  const verified = verifiedSources.rows;
  const fixedCameraBaseline = await persistRealBuildPrefix50Step44BlindFixedCameraBaseline({
    publicOutputPath,
    withheldOutputPath,
    verified,
  });
  const pageCount = Math.ceil(verified.length / ROWS_PER_PAGE);
  const referenceCanvas = canvasFromRgba(
    referenceDecoded.width,
    referenceDecoded.height,
    referenceDecoded.rgba,
  );
  const pages: RealBuildPrefix50Step44BlindContactSheetPage[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const firstRow = pageIndex * ROWS_PER_PAGE;
    const pageRows = verified.slice(firstRow, firstRow + ROWS_PER_PAGE);
    const width =
      LABEL_WIDTH + CELL_WIDTH * REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS.length;
    const height = HEADER_HEIGHT + ROW_HEIGHT * pageRows.length;
    if (width * height > MAXIMUM_CONTACT_SHEET_PIXELS)
      throw new RangeError("Step-44 blind contact-sheet page exceeded its pixel bound.");
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#f7f7f7";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#111111";
    context.font = "12px monospace";
    context.fillText(
      `Step 44 blind review ${pageRows[0]!.binding.blindId}-${pageRows.at(-1)!.binding.blindId}`,
      8,
      22,
    );
    drawRealBuildPrefix50Step44Contained(context, referenceCanvas, 8, 30, LABEL_WIDTH - 24, 188);
    for (const [
      viewIndex,
      { canonicalViewName },
    ] of REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS.entries())
      context.fillText(canonicalViewName, LABEL_WIDTH + viewIndex * CELL_WIDTH + 6, 22);
    const committedRows = [];
    for (const [localIndex, { binding, cells, fixedCameraEvidence }] of pageRows.entries()) {
      const top = HEADER_HEIGHT + localIndex * ROW_HEIGHT;
      context.fillStyle = localIndex % 2 === 0 ? "#ffffff" : "#eeeeee";
      context.fillRect(0, top, width, ROW_HEIGHT);
      context.fillStyle = "#111111";
      context.font = "bold 18px monospace";
      context.fillText(binding.blindId, 12, top + 38);
      await mkdir(resolve(publicOutputPath, binding.blindId), { recursive: false });
      for (const [viewIndex, cell] of cells.entries()) {
        const rawView =
          cell.fixtureKey === "page45MatchedAfter"
            ? undefined
            : REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.find(
                ({ fixtureKey }) => fixtureKey === cell.fixtureKey,
              );
        if (cell.fixtureKey !== "page45MatchedAfter" && rawView === undefined)
          throw new TypeError(
            `Step-44 ${binding.blindId} has an unknown blind-safe source cell ${cell.fixtureKey}.`,
          );
        const artifactFile =
          cell.fixtureKey === "page45MatchedAfter"
            ? "real-build-prefix50-step44-page45-fixed-camera.png"
            : `real-build-prefix50-step44-${rawView!.reviewedView}.png`;
        const sourceBytes = readRealBuildPrefix50Step44ReviewArtifact(
          withheldOutputPath,
          `${binding.artifactDirectory}/${artifactFile}`,
          16 * 1024 * 1024,
          `Step-44 ${binding.blindId} ${cell.canonicalViewName} contact source`,
        );
        const decoded = decodeRealBuildPrefix50Step44ReviewPng(
          sourceBytes,
          cell.sourceWidth * cell.sourceHeight,
          `Step-44 ${binding.blindId} ${cell.canonicalViewName} contact source`,
        );
        if (
          sha256(sourceBytes) !== cell.sourcePngDigest ||
          sha256(decoded.rgba) !== cell.sourcePixelDigest ||
          decoded.width !== cell.sourceWidth ||
          decoded.height !== cell.sourceHeight
        )
          throw new TypeError(
            `Step-44 ${binding.blindId} ${cell.canonicalViewName} drifted after verification and before downsampling.`,
          );
        await writeFile(resolve(publicOutputPath, cell.artifactPath), sourceBytes, {
          flag: "wx",
        });
        drawRealBuildPrefix50Step44Contained(
          context,
          canvasFromRgba(decoded.width, decoded.height, decoded.rgba),
          LABEL_WIDTH + viewIndex * CELL_WIDTH,
          top + 6,
          CELL_WIDTH,
          CELL_HEIGHT,
        );
      }
      const deltaBytes = readRealBuildPrefix50Step44ReviewArtifact(
        withheldOutputPath,
        `${binding.artifactDirectory}/real-build-prefix50-step44-page45-fixed-camera-delta.png`,
        16 * 1024 * 1024,
        `Step-44 ${binding.blindId} fixed-camera delta public source`,
      );
      const delta = decodeRealBuildPrefix50Step44ReviewPng(
        deltaBytes,
        fixedCameraEvidence.deltaWidth * fixedCameraEvidence.deltaHeight,
        `Step-44 ${binding.blindId} fixed-camera delta public source`,
      );
      if (
        sha256(deltaBytes) !== fixedCameraEvidence.deltaPngDigest ||
        sha256(delta.rgba) !== fixedCameraEvidence.deltaPixelDigest ||
        delta.width !== fixedCameraEvidence.deltaWidth ||
        delta.height !== fixedCameraEvidence.deltaHeight
      )
        throw new TypeError(
          `Step-44 ${binding.blindId} fixed-camera delta drifted before public copy.`,
        );
      await writeFile(
        resolve(publicOutputPath, fixedCameraEvidence.deltaArtifactPath),
        deltaBytes,
        {
          flag: "wx",
        },
      );
      const rowBody = { blindId: binding.blindId, cells, fixedCameraEvidence };
      committedRows.push(deepFreeze({ ...rowBody, commitment: canonicalDigest(rowBody) }));
    }
    const pixels = context.getImageData(0, 0, width, height).data;
    const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({
      width,
      height,
      rgba: new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
    });
    const artifactFile = `real-build-prefix50-step44-blind-contact-sheet-${String(pageIndex + 1).padStart(3, "0")}.png`;
    await writeFile(resolve(publicOutputPath, artifactFile), pngBytes, { flag: "wx" });
    const pageBody = {
      schemaVersion: "lego.real-build-prefix50-step44-blind-contact-sheet-page/1" as const,
      authority: "none" as const,
      selectionAuthority: false as const,
      sourceSetId: "6651557" as const,
      pageNumber: pageIndex + 1,
      pageCount,
      firstBlindId: pageRows[0]!.binding.blindId,
      rowCount: pageRows.length,
      cellRoster: REAL_BUILD_PREFIX50_STEP44_BLIND_REVIEW_CELL_ROWS,
      width,
      height,
      artifactFile,
      pngDigest: sha256(pngBytes),
      pixelDigest: sha256(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)),
      rows: committedRows,
      referenceCommitment: publicReference.commitment,
    };
    pages.push(deepFreeze({ ...pageBody, commitment: canonicalDigest(pageBody) }));
  }
  const finishedSheetVerifications = [];
  for (const page of pages)
    finishedSheetVerifications.push(await verifyFinishedSheet(publicOutputPath, page));
  const reviewIsolationInstructionFile = "REVIEW-INSTRUCTIONS.txt" as const;
  const reviewIsolationInstructionBytes = Buffer.from(
    REAL_BUILD_PREFIX50_STEP44_REVIEW_ISOLATION_INSTRUCTION,
  );
  await writeFile(
    resolve(publicOutputPath, reviewIsolationInstructionFile),
    reviewIsolationInstructionBytes,
    { flag: "wx" },
  );
  const packetCore = {
    schemaVersion: "lego.real-build-prefix50-step44-blind-review-packet/1" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    fixturePromotionAuthority: false as const,
    sourceSetId: "6651557" as const,
    reviewIsolationInstructionFile,
    reviewIsolationInstructionDigest: sha256(reviewIsolationInstructionBytes),
    candidateCount: REAL_BUILD_PREFIX50_STEP44_BLIND_CANDIDATE_COUNT,
    blindIds: verified.map(({ binding }) => binding.blindId),
    page45SourcePolicy: {
      ...REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY,
      criteria: REAL_BUILD_PREFIX50_STEP44_PAGE45_REVIEW_CRITERIA,
    },
    page45SourcePolicyCommitment: REAL_BUILD_PREFIX50_STEP44_PAGE45_SOURCE_POLICY_COMMITMENT,
    reference: publicReference,
    fixedCameraBaseline,
    rowsPerPage: ROWS_PER_PAGE,
    pageCount: pages.length,
    pages,
    finishedSheetVerifications,
  };
  const publicPacketCoreCommitment = realBuildPrefix50Step44BlindPacketCoreCommitment(packetCore);
  const withheldMap = createRealBuildPrefix50Step44WithheldUnblindingMap({
    batch,
    plan,
    captures: verified.map(({ binding }) => binding),
    publicPacketCoreCommitment,
  });
  const withheldMapFile = "real-build-prefix50-step44-unblinding-map.json";
  const withheldMapBytes = Buffer.from(canonicalStringify(withheldMap));
  await writeFile(resolve(withheldOutputPath, withheldMapFile), withheldMapBytes, { flag: "wx" });
  const packetBody = {
    ...packetCore,
    publicPacketCoreCommitment,
    withheldUnblindingMapCommitment: withheldMap.commitment,
  };
  const index: RealBuildPrefix50Step44BlindReviewPacket = deepFreeze({
    ...packetBody,
    commitment: canonicalDigest(packetBody),
  });
  const indexBytes = Buffer.from(canonicalStringify(index));
  const indexFile = "real-build-prefix50-step44-blind-review-packet.json";
  await writeFile(resolve(publicOutputPath, indexFile), indexBytes, { flag: "wx" });
  return deepFreeze({
    indexFile,
    byteDigest: sha256RealBuildPrefix50Step44BlindBytes(indexBytes),
    index,
    withheldMapFile,
    withheldMapByteDigest: sha256RealBuildPrefix50Step44BlindBytes(withheldMapBytes),
    withheldMap,
  });
}
