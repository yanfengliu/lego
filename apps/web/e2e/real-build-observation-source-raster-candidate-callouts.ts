export const MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_GRID_CELLS = 2_097_154;
export const MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_RECTANGLES = 1_024;

export const OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_CLEARING_POLICY =
  "clipped-pixel-rectangle-union-via-signed-area-grid/1" as const;

export interface ObservationSourceCandidatePdfBox {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface ObservationSourceCandidatePanelBounds {
  readonly panelMinXPt: number;
  readonly panelMaxXPt: number;
  readonly panelMinYPt: number;
  readonly panelMaxYPt: number;
}

export interface ObservationSourceCandidatePixelRectangle {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function boundedDenseDataRows(value: unknown, maximum: number, label: string): readonly unknown[] {
  let array: boolean;
  let lengthDescriptor: PropertyDescriptor | undefined;
  let keys: readonly PropertyKey[];
  try {
    array = Array.isArray(value);
    lengthDescriptor =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "length")
        : undefined;
    keys = value !== null && typeof value === "object" ? Reflect.ownKeys(value) : [];
  } catch {
    throw new TypeError(`${label} refused safe dense-array inspection.`);
  }
  const length = lengthDescriptor?.value;
  if (
    !array ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximum ||
    keys.length !== length + 1
  ) {
    throw new RangeError(`${label} must be one dense exact array with at most ${maximum} rows.`);
  }
  const rows: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new TypeError(`${label}[${index}] refused safe data inspection.`);
    }
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label}[${index}] must be one enumerable own data row.`);
    }
    rows.push(descriptor.value);
  }
  return rows;
}

function numericOwnData(value: unknown, key: string, label: string): number {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, key)
        : undefined;
  } catch {
    throw new TypeError(`${label}.${key} refused safe data inspection.`);
  }
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "number"
  ) {
    throw new TypeError(`${label}.${key} must be one numeric own data field.`);
  }
  return descriptor.value;
}

function finitePositiveSpan(maximum: number, minimum: number, axis: "X" | "Y"): number {
  const span = maximum - minimum;
  if (!Number.isFinite(span) || span <= 0) {
    throw new RangeError(
      `Observation source candidate panel ${axis} span ${String(maximum)} - ${String(minimum)} is ${String(span)}, not a finite positive PDF-point distance. Pass bounds whose subtraction does not overflow.`,
    );
  }
  return span;
}

function mappedCoordinate(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `${label} mapped to ${String(value)}, not a finite work-raster coordinate. Use finite panel spans and callout bounds that can be represented before clearing the panel.`,
    );
  }
  return value;
}

/** Maps PDF boxes into the exact inclusive pixel rectangles clearPdfBoxes historically cleared. */
export function mapObservationSourceCandidateCalloutRectangles(input: {
  readonly width: number;
  readonly height: number;
  readonly marginPx: number;
  readonly panelBounds: ObservationSourceCandidatePanelBounds;
  readonly callouts: readonly ObservationSourceCandidatePdfBox[];
}): readonly ObservationSourceCandidatePixelRectangle[] {
  const { width, height, marginPx, panelBounds } = input;
  const panelWidthPt = finitePositiveSpan(panelBounds.panelMaxXPt, panelBounds.panelMinXPt, "X");
  const panelHeightPt = finitePositiveSpan(panelBounds.panelMaxYPt, panelBounds.panelMinYPt, "Y");
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(marginPx) ||
    marginPx < 0
  ) {
    throw new RangeError(
      `Observation source candidate callout clearing needs positive safe-integer dimensions and a non-negative safe-integer margin; received ${String(width)}x${String(height)} with margin ${String(marginPx)}.`,
    );
  }

  const rectangles: ObservationSourceCandidatePixelRectangle[] = [];
  const callouts = boundedDenseDataRows(
    input.callouts,
    MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_RECTANGLES,
    "Observation source candidate callouts",
  );
  for (const [index, row] of callouts.entries()) {
    const callout = {
      minXPt: numericOwnData(row, "minXPt", `Observation source candidate callout ${index}`),
      maxXPt: numericOwnData(row, "maxXPt", `Observation source candidate callout ${index}`),
      minYPt: numericOwnData(row, "minYPt", `Observation source candidate callout ${index}`),
      maxYPt: numericOwnData(row, "maxYPt", `Observation source candidate callout ${index}`),
    };
    const clippedMinX = Math.max(panelBounds.panelMinXPt, callout.minXPt);
    const clippedMaxX = Math.min(panelBounds.panelMaxXPt, callout.maxXPt);
    const clippedMinY = Math.max(panelBounds.panelMinYPt, callout.minYPt);
    const clippedMaxY = Math.min(panelBounds.panelMaxYPt, callout.maxYPt);
    if (clippedMaxX <= clippedMinX || clippedMaxY <= clippedMinY) continue;

    const mappedMinX = mappedCoordinate(
      ((clippedMinX - panelBounds.panelMinXPt) / panelWidthPt) * width,
      `Observation source candidate callout ${index} minX`,
    );
    const mappedMaxX = mappedCoordinate(
      ((clippedMaxX - panelBounds.panelMinXPt) / panelWidthPt) * width,
      `Observation source candidate callout ${index} maxX`,
    );
    const mappedMinY = mappedCoordinate(
      ((clippedMinY - panelBounds.panelMinYPt) / panelHeightPt) * height,
      `Observation source candidate callout ${index} minY`,
    );
    const mappedMaxY = mappedCoordinate(
      ((clippedMaxY - panelBounds.panelMinYPt) / panelHeightPt) * height,
      `Observation source candidate callout ${index} maxY`,
    );
    const rectangle = Object.freeze({
      minX: Math.max(0, Math.floor(mappedMinX) - marginPx),
      maxX: Math.min(width - 1, Math.ceil(mappedMaxX) + marginPx),
      minY: Math.max(0, Math.floor(height - mappedMaxY) - marginPx),
      maxY: Math.min(height - 1, Math.ceil(height - mappedMinY) + marginPx),
    });
    if (rectangle.maxX >= rectangle.minX && rectangle.maxY >= rectangle.minY) {
      rectangles.push(rectangle);
    }
  }
  return Object.freeze(rectangles);
}

/** Clears the union once, bounding work by four updates per box plus one mask traversal. */
export function clearObservationSourceCandidateCalloutRectangles(
  mask: Uint8Array,
  width: number,
  height: number,
  rectangles: readonly ObservationSourceCandidatePixelRectangle[],
): void {
  const pixelCount = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(pixelCount) ||
    mask.length !== pixelCount
  ) {
    throw new RangeError(
      `Observation source candidate callout mask holds ${mask.length} pixels but ${String(width)}x${String(height)} requires ${String(pixelCount)}; dimensions must be positive safe integers.`,
    );
  }
  const rows = boundedDenseDataRows(
    rectangles,
    MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_RECTANGLES,
    "Observation source candidate callout rectangles",
  );
  if (rows.length === 0) return;
  const stride = width + 1;
  const gridCells = stride * (height + 1);
  if (
    !Number.isSafeInteger(gridCells) ||
    gridCells > MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_GRID_CELLS
  ) {
    throw new RangeError(
      `Observation source candidate callout union needs ${String(gridCells)} signed-area cells, exceeding the ${MAXIMUM_OBSERVATION_SOURCE_RASTER_CANDIDATE_CALLOUT_GRID_CELLS}-cell bound. Reject or resample the retained panel before clearing callouts.`,
    );
  }
  const differences = new Int32Array(gridCells);
  for (const [index, row] of rows.entries()) {
    const rectangle = {
      minX: numericOwnData(row, "minX", `Observation source candidate callout rectangle ${index}`),
      maxX: numericOwnData(row, "maxX", `Observation source candidate callout rectangle ${index}`),
      minY: numericOwnData(row, "minY", `Observation source candidate callout rectangle ${index}`),
      maxY: numericOwnData(row, "maxY", `Observation source candidate callout rectangle ${index}`),
    };
    if (
      !Number.isSafeInteger(rectangle.minX) ||
      !Number.isSafeInteger(rectangle.maxX) ||
      !Number.isSafeInteger(rectangle.minY) ||
      !Number.isSafeInteger(rectangle.maxY) ||
      rectangle.minX < 0 ||
      rectangle.maxX < rectangle.minX ||
      rectangle.maxX >= width ||
      rectangle.minY < 0 ||
      rectangle.maxY < rectangle.minY ||
      rectangle.maxY >= height
    ) {
      throw new RangeError(
        `Observation source candidate callout rectangle ${index} must contain safe-integer inclusive coordinates inside ${width}x${height}; received ${String(rectangle.minX)},${String(rectangle.maxX)},${String(rectangle.minY)},${String(rectangle.maxY)}.`,
      );
    }
    const afterX = rectangle.maxX + 1;
    const afterY = rectangle.maxY + 1;
    const topLeft = rectangle.minY * stride + rectangle.minX;
    const topRight = rectangle.minY * stride + afterX;
    const bottomLeft = afterY * stride + rectangle.minX;
    const bottomRight = afterY * stride + afterX;
    differences[topLeft] = differences[topLeft]! + 1;
    differences[topRight] = differences[topRight]! - 1;
    differences[bottomLeft] = differences[bottomLeft]! - 1;
    differences[bottomRight] = differences[bottomRight]! + 1;
  }
  for (let y = 0; y < height; y += 1) {
    let rowDelta = 0;
    for (let x = 0; x < width; x += 1) {
      const gridIndex = y * stride + x;
      rowDelta += differences[gridIndex]!;
      const coverage = rowDelta + (y === 0 ? 0 : differences[gridIndex - stride]!);
      differences[gridIndex] = coverage;
      if (coverage > 0) mask[y * width + x] = 0;
    }
  }
}
