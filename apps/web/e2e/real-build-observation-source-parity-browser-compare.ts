import {
  createRealBuildSourceParityBrowserEvidenceRegistry,
  sourceParityBrowserDigest,
} from "./real-build-observation-source-parity-browser-evidence";
import {
  pooledSourceParityMaskCell,
  pooledSourceParityMismatchCell,
  sourceParityDiagnosticSamplePixel,
} from "./real-build-observation-source-parity-diagnostic";
import type {
  RealBuildSourceParityClass,
  RealBuildSourceParityMaskComparison,
  RealBuildSourceParityMismatchBounds,
} from "./real-build-observation-source-parity-types";

const DIAGNOSTIC_CELL_MAXIMUM = 128;

function xorMaskAndBounds(
  production: Uint8Array,
  candidate: Uint8Array,
  width: number,
  height: number,
): { readonly xor: Uint8Array; readonly bounds: RealBuildSourceParityMismatchBounds | null } {
  const xor = new Uint8Array(production.length);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let pixel = 0; pixel < xor.length; pixel += 1) {
    if (production[pixel] === candidate[pixel]) continue;
    xor[pixel] = 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    xor,
    bounds:
      maxX < 0
        ? null
        : { minXPx: minX, minYPx: minY, maxXPxExclusive: maxX + 1, maxYPxExclusive: maxY + 1 },
  };
}

function diagnosticPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  production: Uint8Array,
  candidate: Uint8Array,
): { readonly width: number; readonly height: number; readonly png: string } {
  const scale = Math.min(1, DIAGNOSTIC_CELL_MAXIMUM / width, DIAGNOSTIC_CELL_MAXIMUM / height);
  const cellWidth = Math.max(1, Math.round(width * scale));
  const cellHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cellWidth * 4;
  canvas.height = cellHeight;
  try {
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Source-parity diagnostic canvas has no 2D context.");
    const image = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < cellHeight; y += 1) {
      const sourceY = sourceParityDiagnosticSamplePixel({
        cell: y,
        sourceLength: height,
        cellLength: cellHeight,
      });
      for (let x = 0; x < cellWidth; x += 1) {
        const sourceX = sourceParityDiagnosticSamplePixel({
          cell: x,
          sourceLength: width,
          cellLength: cellWidth,
        });
        const sourcePixel = sourceY * width + sourceX;
        const occupied = [
          pooledSourceParityMaskCell({
            mask: production,
            sourceWidth: width,
            sourceHeight: height,
            cellWidth,
            cellHeight,
            cellX: x,
            cellY: y,
          }),
          pooledSourceParityMaskCell({
            mask: candidate,
            sourceWidth: width,
            sourceHeight: height,
            cellWidth,
            cellHeight,
            cellX: x,
            cellY: y,
          }),
          pooledSourceParityMismatchCell({
            production,
            candidate,
            sourceWidth: width,
            sourceHeight: height,
            cellWidth,
            cellHeight,
            cellX: x,
            cellY: y,
          }),
        ];
        for (let column = 0; column < 4; column += 1) {
          const target = (y * canvas.width + column * cellWidth + x) * 4;
          if (column === 0) {
            const source = sourcePixel * 4;
            image.data[target] = rgba[source]!;
            image.data[target + 1] = rgba[source + 1]!;
            image.data[target + 2] = rgba[source + 2]!;
          } else {
            const on = occupied[column - 1] === 1;
            image.data[target] = on ? (column === 3 ? 224 : 14) : 255;
            image.data[target + 1] = on ? (column === 3 ? 0 : 34) : 255;
            image.data[target + 2] = on ? (column === 3 ? 126 : 44) : 255;
          }
          image.data[target + 3] = 255;
        }
      }
    }
    context.putImageData(image, 0, 0);
    return { width: canvas.width, height: canvas.height, png: canvas.toDataURL("image/png") };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
  }
}

function compareMasks(
  sourceClass: RealBuildSourceParityClass,
  production: Uint8Array,
  candidate: Uint8Array,
): Omit<
  RealBuildSourceParityMaskComparison,
  | "productionMaskDigest"
  | "candidateMaskDigest"
  | "xorMaskDigest"
  | "mismatchBounds"
  | "diagnosticCaptureDigest"
  | "xorEvidencePackedDigest"
  | "productionEvidencePackedDigest"
> {
  if (production.length !== candidate.length) throw new RangeError("Parity mask lengths differ.");
  let productionArea = 0;
  let candidateArea = 0;
  let intersectionPixels = 0;
  let unionPixels = 0;
  let mismatchPixels = 0;
  for (let index = 0; index < production.length; index += 1) {
    const left = production[index]!;
    const right = candidate[index]!;
    if ((left !== 0 && left !== 1) || (right !== 0 && right !== 1)) {
      throw new TypeError(`Source-parity ${sourceClass} pixel ${index} is not binary.`);
    }
    productionArea += left;
    candidateArea += right;
    if (left === 1 && right === 1) intersectionPixels += 1;
    if (left === 1 || right === 1) unionPixels += 1;
    if (left !== right) mismatchPixels += 1;
  }
  return {
    sourceClass,
    productionArea,
    candidateArea,
    intersectionPixels,
    unionPixels,
    mismatchPixels,
    iou: unionPixels === 0 ? 1 : intersectionPixels / unionPixels,
  };
}

export async function compareAndRetainRealBuildSourceParityMasks(input: {
  readonly registry: ReturnType<typeof createRealBuildSourceParityBrowserEvidenceRegistry>;
  readonly stepNumber: number;
  readonly sourceClass: RealBuildSourceParityClass;
  readonly production: Uint8Array;
  readonly candidate: Uint8Array;
  readonly rgba: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}): Promise<RealBuildSourceParityMaskComparison> {
  const { xor, bounds } = xorMaskAndBounds(
    input.production,
    input.candidate,
    input.width,
    input.height,
  );
  const basic = compareMasks(input.sourceClass, input.production, input.candidate);
  const [productionMaskDigest, candidateMaskDigest, xorMaskDigest] = await Promise.all([
    sourceParityBrowserDigest(input.production),
    sourceParityBrowserDigest(input.candidate),
    sourceParityBrowserDigest(xor),
  ]);
  let diagnosticCaptureDigest: string | null = null;
  let xorEvidencePackedDigest: string | null = null;
  if (basic.mismatchPixels > 0) {
    const diagnostic = diagnosticPng(
      input.rgba,
      input.width,
      input.height,
      input.production,
      input.candidate,
    );
    [diagnosticCaptureDigest, xorEvidencePackedDigest] = await Promise.all([
      input.registry.registerCapture(diagnostic.png, diagnostic.width, diagnostic.height),
      input.registry.registerPackedMask(xor, input.width, input.height),
    ]);
  }
  return {
    ...basic,
    productionMaskDigest,
    candidateMaskDigest,
    xorMaskDigest,
    mismatchBounds: bounds,
    diagnosticCaptureDigest,
    xorEvidencePackedDigest,
    productionEvidencePackedDigest: await input.registry.registerPackedMask(
      input.production,
      input.width,
      input.height,
    ),
  };
}
