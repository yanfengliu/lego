function footprintStart(cell: number, sourceLength: number, cellLength: number): number {
  return Math.floor((cell * sourceLength) / cellLength);
}

function footprintEnd(cell: number, sourceLength: number, cellLength: number): number {
  return Math.floor(((cell + 1) * sourceLength) / cellLength);
}

function validateDimensions(
  sourceWidth: number,
  sourceHeight: number,
  cellWidth: number,
  cellHeight: number,
): void {
  if (
    !Number.isSafeInteger(sourceWidth) ||
    !Number.isSafeInteger(sourceHeight) ||
    !Number.isSafeInteger(cellWidth) ||
    !Number.isSafeInteger(cellHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    cellWidth < 1 ||
    cellHeight < 1 ||
    cellWidth > sourceWidth ||
    cellHeight > sourceHeight
  ) {
    throw new RangeError(
      `Source-parity diagnostic dimensions ${sourceWidth}x${sourceHeight} -> ${cellWidth}x${cellHeight} must be positive integer downsampling dimensions.`,
    );
  }
}

export function pooledSourceParityMaskCell(input: {
  readonly mask: Uint8Array;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly cellX: number;
  readonly cellY: number;
}): 0 | 1 {
  const { mask, sourceWidth, sourceHeight, cellWidth, cellHeight, cellX, cellY } = input;
  validateDimensions(sourceWidth, sourceHeight, cellWidth, cellHeight);
  if (
    mask.length !== sourceWidth * sourceHeight ||
    !Number.isSafeInteger(cellX) ||
    !Number.isSafeInteger(cellY) ||
    cellX < 0 ||
    cellX >= cellWidth ||
    cellY < 0 ||
    cellY >= cellHeight
  ) {
    throw new RangeError("Source-parity diagnostic mask or cell does not match its dimensions.");
  }
  const minX = footprintStart(cellX, sourceWidth, cellWidth);
  const maxX = footprintEnd(cellX, sourceWidth, cellWidth);
  const minY = footprintStart(cellY, sourceHeight, cellHeight);
  const maxY = footprintEnd(cellY, sourceHeight, cellHeight);
  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      if (mask[y * sourceWidth + x] === 1) return 1;
    }
  }
  return 0;
}

export function pooledSourceParityMismatchCell(input: {
  readonly production: Uint8Array;
  readonly candidate: Uint8Array;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly cellX: number;
  readonly cellY: number;
}): 0 | 1 {
  const { production, candidate, sourceWidth, sourceHeight, cellWidth, cellHeight, cellX, cellY } =
    input;
  validateDimensions(sourceWidth, sourceHeight, cellWidth, cellHeight);
  if (
    production.length !== sourceWidth * sourceHeight ||
    candidate.length !== production.length ||
    !Number.isSafeInteger(cellX) ||
    !Number.isSafeInteger(cellY) ||
    cellX < 0 ||
    cellX >= cellWidth ||
    cellY < 0 ||
    cellY >= cellHeight
  ) {
    throw new RangeError("Source-parity diagnostic masks or cell do not match their dimensions.");
  }
  const minX = footprintStart(cellX, sourceWidth, cellWidth);
  const maxX = footprintEnd(cellX, sourceWidth, cellWidth);
  const minY = footprintStart(cellY, sourceHeight, cellHeight);
  const maxY = footprintEnd(cellY, sourceHeight, cellHeight);
  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const pixel = y * sourceWidth + x;
      if (production[pixel] !== candidate[pixel]) return 1;
    }
  }
  return 0;
}

export function sourceParityDiagnosticSamplePixel(input: {
  readonly cell: number;
  readonly sourceLength: number;
  readonly cellLength: number;
}): number {
  return footprintStart(input.cell, input.sourceLength, input.cellLength);
}
