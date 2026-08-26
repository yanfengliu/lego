import { createHash } from "node:crypto";

import { canvasApi } from "./part-thumbnail-canvas.mjs";
import { measurePdfSourceArtContribution } from "./part-identification-source-art-contribution.mjs";

export const PDF_SOURCE_ART_REBOUND_RENDER_SCHEMA = "lego.pdf-source-art-rebound-render/1";

const RASTER_SCALE = 8;
const BACKGROUND = "#899093";
const WINDOW_LEFT_PT = -1;
const WINDOW_BOTTOM_PT = -1;
const WINDOW_RIGHT_PT = 42;
const WINDOW_TOP_PT = 45;
const WINDOW_WIDTH = (WINDOW_RIGHT_PT - WINDOW_LEFT_PT) * RASTER_SCALE;
const WINDOW_HEIGHT = (WINDOW_TOP_PT - WINDOW_BOTTOM_PT) * RASTER_SCALE;
const MAX_PAGE_PIXELS = 32 * 1024 * 1024;
const MAX_TARGETS_PER_PAGE = 16;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function contains(outer, inner) {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

function assertTargets(targets) {
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > MAX_TARGETS_PER_PAGE) {
    throw new Error(
      `Source-art rebound render requires 1..${MAX_TARGETS_PER_PAGE} targets on one page.`,
    );
  }
  for (const [position, target] of targets.entries()) {
    if (
      typeof target?.key !== "string" ||
      target.key.length < 1 ||
      target.key.length > 128 ||
      typeof target.label !== "string" ||
      !Array.isArray(target.labelTransformPt) ||
      target.labelTransformPt.length !== 2 ||
      target.labelTransformPt.some((value) => !Number.isFinite(value)) ||
      !Number.isSafeInteger(target.imageOperator?.operatorIndex) ||
      target.imageOperator.operatorIndex < 0 ||
      target.imageOperator.projectedBoundsPxAtScale8 === null
    ) {
      throw new Error(`Source-art rebound render target ${position} is malformed.`);
    }
  }
}

async function renderPage(
  page,
  viewport,
  createCanvas,
  filteredOperationIndexes,
  recordOperations,
) {
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  const task = page.render({
    background: BACKGROUND,
    canvasContext: context,
    recordOperations,
    viewport,
    ...(filteredOperationIndexes === null ? {} : { filteredOperationIndexes }),
  });
  await task.promise;
  return { canvas, context };
}

function captureWindow(context, viewport, labelTransformPt, sourceComponentBounds) {
  const pageHeightPt = viewport.height / RASTER_SCALE;
  const left = Math.floor((labelTransformPt[0] + WINDOW_LEFT_PT) * RASTER_SCALE);
  const top = Math.floor((pageHeightPt - (labelTransformPt[1] + WINDOW_TOP_PT)) * RASTER_SCALE);
  const bounds = {
    bottom: top + WINDOW_HEIGHT - 1,
    left,
    right: left + WINDOW_WIDTH - 1,
    top,
  };
  if (
    left < 0 ||
    top < 0 ||
    bounds.right >= context.canvas.width ||
    bounds.bottom >= context.canvas.height ||
    !contains(bounds, sourceComponentBounds)
  ) {
    throw new Error(
      `Source-art rebound render window ${JSON.stringify(bounds)} must stay on-page and wholly contain manifest component ${JSON.stringify(sourceComponentBounds)}.`,
    );
  }
  return { bounds, imageData: context.getImageData(left, top, WINDOW_WIDTH, WINDOW_HEIGHT) };
}

function disposeCanvas(canvas) {
  try {
    canvas.width = 1;
    canvas.height = 1;
  } catch {
    // @napi-rs/canvas has no explicit destroy contract. Dropping the final
    // reference remains the fallback cleanup path; failures do not hide proof.
  }
}

/**
 * Renders one full PDF page once with PDF.js operation recording, then renders
 * each contribution from only the union of its four dependency closures.
 */
export async function renderPdfSourceArtContributionPage({
  page,
  pdfjs,
  operatorList,
  targets,
  capturePng = false,
}) {
  assertTargets(targets);
  let createCanvas;
  try {
    ({ createCanvas } = await canvasApi());
  } catch (cause) {
    throw new Error(
      "Source-art rebound native render could not load @napi-rs/canvas. Install the workspace dependencies for the pinned lockfile; if the optional native package is still absent, add it through the repository dependency/BOM workflow before treating render parity as a gate.",
      { cause },
    );
  }
  if (typeof createCanvas !== "function") {
    throw new Error(
      "Source-art rebound native render loaded @napi-rs/canvas without createCanvas; reinstall the pinned native package for this Node/platform pair.",
    );
  }
  const viewport = page.getViewport({ scale: RASTER_SCALE });
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    Math.ceil(viewport.width) * Math.ceil(viewport.height) > MAX_PAGE_PIXELS
  ) {
    throw new Error(
      `Source-art rebound page raster is unbounded: ${viewport.width}x${viewport.height}; maximum is ${MAX_PAGE_PIXELS} pixels.`,
    );
  }

  const full = await renderPage(page, viewport, createCanvas, null, true);
  try {
    if (!Array.isArray(page.recordedGroups)) {
      throw new Error(
        "Source-art rebound full render produced no PDF.js recorded operation groups; the pinned renderer instrument is unavailable.",
      );
    }
    const rows = [];
    for (const target of targets) {
      const contribution = measurePdfSourceArtContribution({
        imageOperatorIndex: target.imageOperator.operatorIndex,
        label: target.label,
        labelTransformPt: target.labelTransformPt,
        operatorList,
        pdfjs,
        recordedGroups: page.recordedGroups,
      });
      const isolated = await renderPage(
        page,
        viewport,
        createCanvas,
        contribution.operationIndexes,
        false,
      );
      try {
        const fullWindow = captureWindow(
          full.context,
          viewport,
          target.labelTransformPt,
          target.sourceComponentBoundsPxAtScale8,
        );
        const isolatedWindow = captureWindow(
          isolated.context,
          viewport,
          target.labelTransformPt,
          target.sourceComponentBoundsPxAtScale8,
        );
        const fullBytes = Buffer.from(
          fullWindow.imageData.data.buffer,
          fullWindow.imageData.data.byteOffset,
          fullWindow.imageData.data.byteLength,
        );
        const isolatedBytes = Buffer.from(
          isolatedWindow.imageData.data.buffer,
          isolatedWindow.imageData.data.byteOffset,
          isolatedWindow.imageData.data.byteLength,
        );
        const fullRgbaSha256 = sha256(fullBytes);
        const isolatedRgbaSha256 = sha256(isolatedBytes);
        if (fullRgbaSha256 !== isolatedRgbaSha256 || !fullBytes.equals(isolatedBytes)) {
          throw new Error(
            `Source-art rebound ${JSON.stringify(target.key)} isolated contribution ${isolatedRgbaSha256} differs from full-page window ${fullRgbaSha256}; outside paint interference is not absent.`,
          );
        }
        let fullPngBytes = null;
        let isolatedPngBytes = null;
        if (capturePng) {
          const fullCrop = createCanvas(WINDOW_WIDTH, WINDOW_HEIGHT);
          const isolatedCrop = createCanvas(WINDOW_WIDTH, WINDOW_HEIGHT);
          try {
            fullCrop.getContext("2d").putImageData(fullWindow.imageData, 0, 0);
            isolatedCrop.getContext("2d").putImageData(isolatedWindow.imageData, 0, 0);
            fullPngBytes = Buffer.from(fullCrop.toBuffer("image/png"));
            isolatedPngBytes = Buffer.from(isolatedCrop.toBuffer("image/png"));
          } finally {
            disposeCanvas(fullCrop);
            disposeCanvas(isolatedCrop);
          }
        }
        rows.push({
          contribution,
          fullPngBytes,
          isolatedPngBytes,
          proof: {
            backgroundRgb: BACKGROUND,
            fullRgbaSha256,
            heightPx: WINDOW_HEIGHT,
            isolatedRgbaSha256,
            noOutsidePaintInterference: true,
            operationClosureCount: contribution.operationIndexes.size,
            schemaVersion: PDF_SOURCE_ART_REBOUND_RENDER_SCHEMA,
            terminalPaintCount: contribution.terminalPaintCount,
            widthPx: WINDOW_WIDTH,
            windowBoundsPxAtScale8: fullWindow.bounds,
          },
          targetKey: target.key,
        });
      } finally {
        disposeCanvas(isolated.canvas);
      }
    }
    return rows;
  } finally {
    disposeCanvas(full.canvas);
  }
}
