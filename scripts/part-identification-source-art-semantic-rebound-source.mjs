import { createHash } from "node:crypto";

import { canvasApi } from "./part-thumbnail-canvas.mjs";
import { measurePdfSourceArtImageContribution } from "./part-identification-source-art-semantic-rebound-program.mjs";

export {
  PDF_SOURCE_ART_IMAGE_CONTRIBUTION_SCHEMA,
  digestPdfSourceArtImageContribution,
  measurePdfSourceArtImageContribution,
} from "./part-identification-source-art-semantic-rebound-program.mjs";
export const SOURCE_ART_SEMANTIC_REBOUND_RASTER_SCALE = 8;
export const SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS = 1_048_576;
export const SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES = 3_145_728;
export const SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS = 16_777_216;

const BACKGROUND = "#899093";
const CONTROL_BACKGROUND = "#102030";
const MAX_PAGE_PIXELS = 32 * 1024 * 1024;
const MAX_COMPONENT_PIXELS = 1_048_576;

export function createSourceArtWorkLedger() {
  let decodedPixels = 0;
  let decodedBytes = 0;
  let componentPixels = 0;
  return Object.freeze({
    chargeComponent(width, height, label) {
      const pixels = width * height;
      if (
        !Number.isSafeInteger(pixels) ||
        pixels < 1 ||
        pixels > MAX_COMPONENT_PIXELS ||
        componentPixels + pixels > SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS
      ) {
        throw new Error(
          `${label} would charge ${pixels} source-component pixels after ${componentPixels}; ` +
            `per-component/aggregate limits are ${MAX_COMPONENT_PIXELS}/${SOURCE_ART_SEMANTIC_REBOUND_MAX_COMPONENT_PIXELS}. Narrow the exact evidence population instead of raising the limits.`,
        );
      }
      componentPixels += pixels;
    },
    chargeDecoded(width, height, byteLength, label) {
      const pixels = width * height;
      if (
        !Number.isSafeInteger(pixels) ||
        pixels < 1 ||
        !Number.isSafeInteger(byteLength) ||
        byteLength !== pixels * 3 ||
        decodedPixels + pixels > SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS ||
        decodedBytes + byteLength > SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES
      ) {
        throw new Error(
          `${label} would charge ${pixels}/${byteLength} decoded RGB24 pixels/bytes after ` +
            `${decodedPixels}/${decodedBytes}; fixed aggregate limits are ` +
            `${SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_PIXELS}/${SOURCE_ART_SEMANTIC_REBOUND_MAX_DECODE_BYTES}. Narrow the exact evidence population instead of raising the limits.`,
        );
      }
      decodedPixels += pixels;
      decodedBytes += byteLength;
    },
    inspection() {
      return Object.freeze({ componentPixels, decodedBytes, decodedPixels });
    },
  });
}

function disposeCanvas(canvas) {
  try {
    canvas.width = 1;
    canvas.height = 1;
  } catch {
    // Dropping the final @napi-rs/canvas reference remains the cleanup fallback.
  }
}

async function renderPage(
  page,
  viewport,
  createCanvas,
  filteredOperationIndexes,
  recordOperations,
  background = BACKGROUND,
) {
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  const task = page.render({
    background,
    canvasContext: context,
    recordOperations,
    viewport,
    ...(filteredOperationIndexes === null ? {} : { filteredOperationIndexes }),
  });
  await task.promise;
  return { canvas, context };
}

function imageOnlyProof(fullBytes, isolatedBytes, controlBytes, label) {
  if (
    fullBytes.length !== isolatedBytes.length ||
    fullBytes.length !== controlBytes.length ||
    fullBytes.length % 4 !== 0
  ) {
    throw new Error(`${label} image-only proof buffers must have one exact RGBA extent.`);
  }
  const background = [0x89, 0x90, 0x93, 0xff];
  const controlBackground = [0x10, 0x20, 0x30, 0xff];
  const maskHash = createHash("sha256");
  const isolatedHash = createHash("sha256");
  const fullHash = createHash("sha256");
  const position = Buffer.allocUnsafe(4);
  let imageSupportPixels = 0;
  let imageSupportInterferencePixels = 0;
  let outsideImageDifferencePixels = 0;
  for (let offset = 0; offset < fullBytes.length; offset += 4) {
    const isolatedIsBackground = background.every(
      (channel, index) => isolatedBytes[offset + index] === channel,
    );
    const controlIsBackground = controlBackground.every(
      (channel, index) => controlBytes[offset + index] === channel,
    );
    const onImageSupport = !isolatedIsBackground || !controlIsBackground;
    const fullEqualsIsolated =
      fullBytes[offset] === isolatedBytes[offset] &&
      fullBytes[offset + 1] === isolatedBytes[offset + 1] &&
      fullBytes[offset + 2] === isolatedBytes[offset + 2] &&
      fullBytes[offset + 3] === isolatedBytes[offset + 3];
    if (!onImageSupport) {
      if (!fullEqualsIsolated) outsideImageDifferencePixels += 1;
      continue;
    }
    imageSupportPixels += 1;
    position.writeUInt32LE(offset / 4);
    maskHash.update(position);
    isolatedHash.update(isolatedBytes.subarray(offset, offset + 4));
    fullHash.update(fullBytes.subarray(offset, offset + 4));
    if (!fullEqualsIsolated) imageSupportInterferencePixels += 1;
  }
  if (imageSupportPixels < 1) {
    throw new Error(`${label} exact image closure paints no pixels inside its source component.`);
  }
  return {
    fullImageSupportRgbaSha256: `sha256:${fullHash.digest("hex")}`,
    imageSupportMaskSha256: `sha256:${maskHash.digest("hex")}`,
    imageSupportPixels,
    imageSupportInterferencePixels,
    isolatedImageSupportRgbaSha256: `sha256:${isolatedHash.digest("hex")}`,
    isolatedAndFullRenderProof: true,
    outsideImageDifferencePixels,
  };
}

function captureComponent(context, bounds, ledger, label) {
  const width = bounds.right - bounds.left + 1;
  const height = bounds.bottom - bounds.top + 1;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    bounds.left < 0 ||
    bounds.top < 0 ||
    bounds.right >= context.canvas.width ||
    bounds.bottom >= context.canvas.height
  ) {
    throw new Error(`${label} source-component bounds ${JSON.stringify(bounds)} are off-page.`);
  }
  ledger.chargeComponent(width, height, label);
  const image = context.getImageData(bounds.left, bounds.top, width, height);
  return Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
}

export async function renderPdfSourceArtImageProofPage({
  page,
  pdfjs,
  operatorList,
  targets,
  ledger,
}) {
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 187) {
    throw new Error("Source-art image proof page requires 1..187 exact targets.");
  }
  const { createCanvas } = await canvasApi();
  if (typeof createCanvas !== "function") {
    throw new Error("Source-art image proof requires @napi-rs/canvas createCanvas.");
  }
  const viewport = page.getViewport({ scale: SOURCE_ART_SEMANTIC_REBOUND_RASTER_SCALE });
  const pagePixels = Math.ceil(viewport.width) * Math.ceil(viewport.height);
  if (!Number.isSafeInteger(pagePixels) || pagePixels < 1 || pagePixels > MAX_PAGE_PIXELS) {
    throw new Error(
      `Source-art image proof page is ${viewport.width}x${viewport.height}; maximum is ${MAX_PAGE_PIXELS} pixels.`,
    );
  }
  const full = await renderPage(page, viewport, createCanvas, null, true);
  try {
    if (!Array.isArray(page.recordedGroups)) {
      throw new Error("Source-art image proof full render produced no recorded operation groups.");
    }
    const contributions = targets.map((target) => ({
      target,
      contribution: measurePdfSourceArtImageContribution({
        imageOperatorIndex: target.operatorIndex,
        operatorList,
        pdfjs,
        recordedGroups: page.recordedGroups,
      }),
    }));
    const rows = [];
    for (const { contribution, target } of contributions) {
      const isolated = await renderPage(
        page,
        viewport,
        createCanvas,
        contribution.operationIndexes,
        false,
      );
      const control = await renderPage(
        page,
        viewport,
        createCanvas,
        contribution.operationIndexes,
        false,
        CONTROL_BACKGROUND,
      );
      try {
        const fullBytes = captureComponent(
          full.context,
          target.sourceComponent.boundsPx,
          ledger,
          `${target.identity} full`,
        );
        const isolatedBytes = captureComponent(
          isolated.context,
          target.sourceComponent.boundsPx,
          { chargeComponent() {} },
          `${target.identity} isolated`,
        );
        const controlBytes = captureComponent(
          control.context,
          target.sourceComponent.boundsPx,
          { chargeComponent() {} },
          `${target.identity} isolated control`,
        );
        const imageProof = imageOnlyProof(
          fullBytes,
          isolatedBytes,
          controlBytes,
          `Source-art image proof ${target.identity}`,
        );
        rows.push({
          contribution,
          identity: target.identity,
          proof: {
            backgroundRgb: BACKGROUND,
            componentBoundsPxAtScale8: { ...target.sourceComponent.boundsPx },
            controlBackgroundRgb: CONTROL_BACKGROUND,
            ...imageProof,
            operationClosureCount: contribution.operationClosureCount,
          },
        });
      } finally {
        disposeCanvas(control.canvas);
        disposeCanvas(isolated.canvas);
      }
    }
    return rows;
  } finally {
    disposeCanvas(full.canvas);
  }
}

export const __testOnly = Object.freeze({
  captureComponent,
  imageOnlyProof,
});
