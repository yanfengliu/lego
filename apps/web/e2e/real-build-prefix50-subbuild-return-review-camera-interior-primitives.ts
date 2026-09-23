export interface RealBuildPrefix50Step44InteriorHogParameters {
  readonly columns: 12;
  readonly rows: 8;
  readonly orientationBins: 9;
  readonly maximumMagnitude: 255;
  readonly minimumCellSupportPixels: 64;
  readonly luma: {
    readonly red: 0.2126;
    readonly green: 0.7152;
    readonly blue: 0.0722;
  };
}

export interface RealBuildPrefix50Step44InteriorHogDescriptor {
  readonly histograms: Float64Array;
  readonly cellSupport: Uint32Array;
  readonly usedCellCount: number;
}

interface DiskOffset {
  readonly x: number;
  readonly y: number;
}

function diskOffsets(radius: number): readonly DiskOffset[] {
  const offsets: DiskOffset[] = [];
  for (let y = -radius; y <= radius; y += 1)
    for (let x = -radius; x <= radius; x += 1)
      if (x * x + y * y <= radius * radius) offsets.push({ x, y });
  return offsets;
}

export function countExactMask(mask: Uint8Array): number {
  let count = 0;
  for (const value of mask) count += value;
  return count;
}

export function foregroundMask(
  rgba: Uint8Array,
  backgroundHex: number,
  tolerance: number,
): Uint8Array {
  const backgroundRed = (backgroundHex >> 16) & 0xff;
  const backgroundGreen = (backgroundHex >> 8) & 0xff;
  const backgroundBlue = backgroundHex & 0xff;
  const mask = new Uint8Array(rgba.byteLength / 4);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    if (
      rgba[offset + 3] !== 0 &&
      Math.max(
        Math.abs(rgba[offset]! - backgroundRed),
        Math.abs(rgba[offset + 1]! - backgroundGreen),
        Math.abs(rgba[offset + 2]! - backgroundBlue),
      ) > tolerance
    )
      mask[index] = 1;
  }
  return mask;
}

// Filling every background component except the one connected to the raster boundary is
// equivalent to filling the union of the source foreground's external contours.
export function fillExternalContours(
  foreground: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const exterior = new Uint8Array(foreground.length);
  const queue = new Int32Array(foreground.length);
  let head = 0;
  let tail = 0;
  const enqueue = (index: number): void => {
    if (foreground[index] === 1 || exterior[index] === 1) return;
    exterior[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head]!;
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let deltaY = -1; deltaY <= 1; deltaY += 1)
      for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
        if (deltaX === 0 && deltaY === 0) continue;
        const nextX = x + deltaX;
        const nextY = y + deltaY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        enqueue(nextY * width + nextX);
      }
  }
  const filled = new Uint8Array(foreground.length);
  for (let index = 0; index < filled.length; index += 1)
    if (foreground[index] === 1 || exterior[index] === 0) filled[index] = 1;
  return filled;
}

export function erodeDisk(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const offsets = diskOffsets(radius);
  const eroded = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      let retained = true;
      for (const offset of offsets) {
        const sampleX = x + offset.x;
        const sampleY = y + offset.y;
        if (
          sampleX < 0 ||
          sampleX >= width ||
          sampleY < 0 ||
          sampleY >= height ||
          mask[sampleY * width + sampleX] !== 1
        ) {
          retained = false;
          break;
        }
      }
      if (retained) eroded[index] = 1;
    }
  return eroded;
}

export function intersectMasks(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length);
  for (let index = 0; index < result.length; index += 1)
    if (left[index] === 1 && right[index] === 1) result[index] = 1;
  return result;
}

function hueDegrees(red: number, green: number, blue: number, delta: number, maximum: number) {
  if (delta === 0) return 0;
  let hue: number;
  if (maximum === red) hue = ((green - blue) / delta) % 6;
  else if (maximum === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

export function blueCyanFeatureMask(input: {
  readonly rgba: Uint8Array;
  readonly support: Uint8Array;
  readonly backgroundHex: number;
  readonly backgroundTolerance: number;
  readonly minimumSaturation: number;
  readonly minimumValue: number;
  readonly minimumHueDegrees: number;
  readonly maximumHueDegreesExclusive: number;
}): Uint8Array {
  const foreground = foregroundMask(input.rgba, input.backgroundHex, input.backgroundTolerance);
  const feature = new Uint8Array(input.support.length);
  for (let index = 0; index < feature.length; index += 1) {
    if (input.support[index] !== 1 || foreground[index] !== 1) continue;
    const offset = index * 4;
    const red = input.rgba[offset]! / 255;
    const green = input.rgba[offset + 1]! / 255;
    const blue = input.rgba[offset + 2]! / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    const saturation = maximum === 0 ? 0 : delta / maximum;
    const hue = hueDegrees(red, green, blue, delta, maximum);
    if (
      saturation >= input.minimumSaturation &&
      maximum >= input.minimumValue &&
      hue >= input.minimumHueDegrees &&
      hue < input.maximumHueDegreesExclusive
    )
      feature[index] = 1;
  }
  return feature;
}

export function dilateDisk(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const offsets = diskOffsets(radius);
  const dilated = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const offset of offsets) {
      const targetX = x + offset.x;
      const targetY = y + offset.y;
      if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height)
        dilated[targetY * width + targetX] = 1;
    }
  }
  return dilated;
}

export function tolerantFeatureAgreement(input: {
  readonly sourceFeature: Uint8Array;
  readonly renderFeature: Uint8Array;
  readonly support: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}): {
  readonly matchedSourceFeaturePixelCount: number;
  readonly matchedRenderFeaturePixelCount: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
} {
  const expandedSource = dilateDisk(input.sourceFeature, input.width, input.height, input.radius);
  const expandedRender = dilateDisk(input.renderFeature, input.width, input.height, input.radius);
  let sourceCount = 0;
  let renderCount = 0;
  let matchedSource = 0;
  let matchedRender = 0;
  for (let index = 0; index < input.support.length; index += 1) {
    if (input.support[index] !== 1) continue;
    if (input.sourceFeature[index] === 1) {
      sourceCount += 1;
      if (expandedRender[index] === 1) matchedSource += 1;
    }
    if (input.renderFeature[index] === 1) {
      renderCount += 1;
      if (expandedSource[index] === 1) matchedRender += 1;
    }
  }
  const precision = renderCount === 0 ? 0 : matchedRender / renderCount;
  const recall = matchedSource / sourceCount;
  return {
    matchedSourceFeaturePixelCount: matchedSource,
    matchedRenderFeaturePixelCount: matchedRender,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
  };
}

function lumaAt(
  rgba: Uint8Array,
  index: number,
  parameters: RealBuildPrefix50Step44InteriorHogParameters,
) {
  const offset = index * 4;
  return (
    parameters.luma.red * rgba[offset]! +
    parameters.luma.green * rgba[offset + 1]! +
    parameters.luma.blue * rgba[offset + 2]!
  );
}

export function interiorHogDescriptor(input: {
  readonly rgba: Uint8Array;
  readonly support: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly parameters: RealBuildPrefix50Step44InteriorHogParameters;
}): RealBuildPrefix50Step44InteriorHogDescriptor {
  const { parameters } = input;
  const cellCount = parameters.columns * parameters.rows;
  const histograms = new Float64Array(cellCount * parameters.orientationBins);
  const cellSupport = new Uint32Array(cellCount);
  for (let y = 1; y < input.height - 1; y += 1)
    for (let x = 1; x < input.width - 1; x += 1) {
      const index = y * input.width + x;
      if (input.support[index] !== 1) continue;
      const cellX = Math.min(
        parameters.columns - 1,
        Math.floor((x * parameters.columns) / input.width),
      );
      const cellY = Math.min(parameters.rows - 1, Math.floor((y * parameters.rows) / input.height));
      const cell = cellY * parameters.columns + cellX;
      cellSupport[cell]! += 1;
      const topLeft = lumaAt(input.rgba, index - input.width - 1, parameters);
      const top = lumaAt(input.rgba, index - input.width, parameters);
      const topRight = lumaAt(input.rgba, index - input.width + 1, parameters);
      const left = lumaAt(input.rgba, index - 1, parameters);
      const right = lumaAt(input.rgba, index + 1, parameters);
      const bottomLeft = lumaAt(input.rgba, index + input.width - 1, parameters);
      const bottom = lumaAt(input.rgba, index + input.width, parameters);
      const bottomRight = lumaAt(input.rgba, index + input.width + 1, parameters);
      const gradientX = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
      const gradientY = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
      const magnitude = Math.min(Math.hypot(gradientX, gradientY), parameters.maximumMagnitude);
      let orientation = Math.atan2(gradientY, gradientX);
      if (orientation < 0) orientation += Math.PI;
      if (orientation >= Math.PI) orientation -= Math.PI;
      const bin = Math.min(
        parameters.orientationBins - 1,
        Math.floor((orientation * parameters.orientationBins) / Math.PI),
      );
      histograms[cell * parameters.orientationBins + bin]! += magnitude;
    }
  let usedCellCount = 0;
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (cellSupport[cell]! < parameters.minimumCellSupportPixels) continue;
    let squaredMagnitude = 0;
    const offset = cell * parameters.orientationBins;
    for (let bin = 0; bin < parameters.orientationBins; bin += 1)
      squaredMagnitude += histograms[offset + bin]! ** 2;
    const norm = Math.sqrt(squaredMagnitude);
    if (norm === 0) continue;
    for (let bin = 0; bin < parameters.orientationBins; bin += 1) histograms[offset + bin]! /= norm;
    usedCellCount += 1;
  }
  return { histograms, cellSupport, usedCellCount };
}

export function interiorHogSimilarity(input: {
  readonly source: RealBuildPrefix50Step44InteriorHogDescriptor;
  readonly render: RealBuildPrefix50Step44InteriorHogDescriptor;
  readonly parameters: RealBuildPrefix50Step44InteriorHogParameters;
}): { readonly similarity: number; readonly usedCellCount: number } {
  let weightedSimilarity = 0;
  let weight = 0;
  let usedCellCount = 0;
  const cellCount = input.parameters.columns * input.parameters.rows;
  for (let cell = 0; cell < cellCount; cell += 1) {
    const cellWeight = input.source.cellSupport[cell]!;
    if (cellWeight < input.parameters.minimumCellSupportPixels) continue;
    const offset = cell * input.parameters.orientationBins;
    let sourceNorm = 0;
    let renderNorm = 0;
    let dot = 0;
    for (let bin = 0; bin < input.parameters.orientationBins; bin += 1) {
      const source = input.source.histograms[offset + bin]!;
      const render = input.render.histograms[offset + bin]!;
      sourceNorm += source * source;
      renderNorm += render * render;
      dot += source * render;
    }
    if (sourceNorm === 0 || renderNorm === 0) continue;
    weightedSimilarity += (dot / Math.sqrt(sourceNorm * renderNorm)) * cellWeight;
    weight += cellWeight;
    usedCellCount += 1;
  }
  return { similarity: weight === 0 ? 0 : weightedSimilarity / weight, usedCellCount };
}
