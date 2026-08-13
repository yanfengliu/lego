export interface PreparedRealBuildSourceParityDiagnostic {
  readonly digest: string;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export function expectedRealBuildSourceParityDiagnosticDimensions(
  width: number,
  height: number,
): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, 128 / width, 128 / height);
  const cellWidth = Math.max(1, Math.round(width * scale));
  const cellHeight = Math.max(1, Math.round(height * scale));
  return { width: cellWidth * 4, height: cellHeight };
}

export function validateRealBuildSourceParityDiagnosticContent(input: {
  readonly stepNumber: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly capture: PreparedRealBuildSourceParityDiagnostic;
  readonly production: Uint8Array;
  readonly candidate: Uint8Array;
  readonly xor: Uint8Array;
}): void {
  const cellWidth = input.capture.width / 4;
  const cellHeight = input.capture.height;
  for (let cellY = 0; cellY < cellHeight; cellY += 1) {
    const minY = Math.floor((cellY * input.sourceHeight) / cellHeight);
    const maxY = Math.floor(((cellY + 1) * input.sourceHeight) / cellHeight);
    for (let cellX = 0; cellX < cellWidth; cellX += 1) {
      const minX = Math.floor((cellX * input.sourceWidth) / cellWidth);
      const maxX = Math.floor(((cellX + 1) * input.sourceWidth) / cellWidth);
      let productionOn = false;
      let candidateOn = false;
      let xorOn = false;
      for (let y = minY; y < maxY; y += 1) {
        for (let x = minX; x < maxX; x += 1) {
          const pixel = y * input.sourceWidth + x;
          productionOn ||= input.production[pixel] === 1;
          candidateOn ||= input.candidate[pixel] === 1;
          xorOn ||= input.xor[pixel] === 1;
        }
      }
      const states = [productionOn, candidateOn, xorOn];
      for (let column = 1; column < 4; column += 1) {
        const target = (cellY * input.capture.width + column * cellWidth + cellX) * 4;
        const on = states[column - 1]!;
        const expected = on
          ? column === 3
            ? [224, 0, 126, 255]
            : [14, 34, 44, 255]
          : [255, 255, 255, 255];
        if (expected.some((value, offset) => input.capture.rgba[target + offset] !== value)) {
          throw new TypeError(
            `Printed step ${input.stepNumber} diagnostic mask columns do not reproduce retained masks.`,
          );
        }
      }
      const sourceAlpha = (cellY * input.capture.width + cellX) * 4 + 3;
      if (input.capture.rgba[sourceAlpha] !== 255) {
        throw new TypeError(
          `Printed step ${input.stepNumber} diagnostic point-sampled work-RGBA column is not opaque.`,
        );
      }
    }
  }
}
