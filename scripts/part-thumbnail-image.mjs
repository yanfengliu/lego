/** Reduce booklet and inventory PNGs to comparable part silhouettes and ink; nothing here identifies a part. */

import {
  assertBoundedCanvasDimensions,
  assertBoundedImageDimensions,
  createPngDecodeBudget,
} from "./part-thumbnail-image-guard.mjs";
import { canvasApi } from "./part-thumbnail-canvas.mjs";

export { canvasApi } from "./part-thumbnail-canvas.mjs";

export {
  MAX_CANVAS_DIMENSION,
  MAX_CANVAS_PIXELS,
  MAX_THUMBNAIL_DIMENSION,
  MAX_THUMBNAIL_PIXELS,
  MAX_AGGREGATE_PNG_DECODE_PIXELS,
  assertBoundedCanvasDimensions,
  assertBoundedImageDimensions,
  assertBoundedPngDimensions,
  createPngDecodeBudget,
} from "./part-thumbnail-image-guard.mjs";

export const GRID = 28;
const BACKGROUND_TOLERANCE = 34;
const COMPANION_BLOB_SHARE = 0.12;

/**
 * The commonest colour in a crop.
 *
 * Both croppers leave the part sitting on a flat ground — the callout crop
 * paints every non-part pixel with the callout box's own fill, the inventory
 * crop keeps the page under the cell — so the modal colour is the ground.
 * Sampling a corner instead breaks on any crop whose part reaches the edge.
 */
function modalColour(data, width, height) {
  const tally = new Map();
  for (let index = 0; index < width * height; index += 1) {
    const at = index * 4;
    const key = ((data[at] >> 3) << 10) | ((data[at + 1] >> 3) << 5) | (data[at + 2] >> 3);
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let best = 0;
  let seen = -1;
  for (const [key, count] of tally) {
    if (count > seen) {
      seen = count;
      best = key;
    }
  }
  return [((best >> 10) & 31) * 8 + 4, ((best >> 5) & 31) * 8 + 4, (best & 31) * 8 + 4];
}

/** Connected components of the non-background pixels, largest first. */
function components(ink, width, height) {
  const label = new Int32Array(width * height).fill(-1);
  const found = [];
  const stack = [];
  for (let seed = 0; seed < width * height; seed += 1) {
    if (!ink[seed] || label[seed] !== -1) continue;
    const id = found.length;
    let size = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    stack.push(seed);
    label[seed] = id;
    while (stack.length > 0) {
      const at = stack.pop();
      const x = at % width;
      const y = (at - x) / width;
      size += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && ink[at - 1] && label[at - 1] === -1) {
        label[at - 1] = id;
        stack.push(at - 1);
      }
      if (x < width - 1 && ink[at + 1] && label[at + 1] === -1) {
        label[at + 1] = id;
        stack.push(at + 1);
      }
      if (y > 0 && ink[at - width] && label[at - width] === -1) {
        label[at - width] = id;
        stack.push(at - width);
      }
      if (y < height - 1 && ink[at + width] && label[at + width] === -1) {
        label[at + width] = id;
        stack.push(at + width);
      }
    }
    found.push({ id, size, minX, minY, maxX, maxY });
  }
  found.sort((left, right) => right.size - left.size);
  return { label, found };
}

/**
 * One part, cut out of its crop.
 *
 * An inventory cell is a rectangle of the page, so it can catch the edge of a
 * neighbour; a callout crop is already one flood-filled blob. Taking the largest
 * connected component and whatever sits close behind it — a part drawn with a
 * detached highlight or a printed shadow arrives as two blobs — handles both,
 * and drops the neighbour that only clipped the cell.
 */
export async function readThumbnail(
  bytes,
  decodeBudget = createPngDecodeBudget("Single-thumbnail decode"),
) {
  const expected = decodeBudget.charge(bytes, "Thumbnail PNG");
  const { createCanvas, loadImage } = await canvasApi();
  const image = await loadImage(bytes);
  const width = image.width;
  const height = image.height;
  assertBoundedImageDimensions(width, height);
  if (width !== expected.width || height !== expected.height) {
    throw new Error(
      `Thumbnail decoder reported ${width} x ${height}, but the authenticated PNG IHDR declared ${expected.width} x ${expected.height}. Rejecting decoder/header disagreement before canvas allocation.`,
    );
  }
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, width, height).data;

  const ground = modalColour(data, width, height);
  const ink = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const at = index * 4;
    const delta =
      Math.abs(data[at] - ground[0]) +
      Math.abs(data[at + 1] - ground[1]) +
      Math.abs(data[at + 2] - ground[2]);
    ink[index] = delta > BACKGROUND_TOLERANCE ? 1 : 0;
  }

  const { label, found } = components(ink, width, height);
  if (found.length === 0) return null;
  // An inventory cell keeps the printed "2x" under the part, and on a 1x1 that
  // label is a fifth of the ink — enough to change the silhouette it is matched
  // by. A companion blob counts only where it touches the part's own box, so a
  // caption underneath is dropped and a detached highlight is not.
  const main = found[0];
  const margin = 0.05 * Math.max(main.maxX - main.minX, main.maxY - main.minY);
  const keep = new Set(
    found
      .filter(
        (blob) =>
          blob.id === main.id ||
          (blob.size >= main.size * COMPANION_BLOB_SHARE &&
            blob.minX <= main.maxX + margin &&
            blob.maxX >= main.minX - margin &&
            blob.minY <= main.maxY + margin &&
            blob.maxY >= main.minY - margin),
      )
      .map(({ id }) => id),
  );
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    if (label[index] === -1 || !keep.has(label[index])) continue;
    mask[index] = 1;
    const x = index % width;
    const y = (index - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < minX) return null;

  return { data, mask, width, height, ground, bounds: { minX, minY, maxX, maxY } };
}

/**
 * A thumbnail reduced to numbers that survive a change of scale.
 *
 * The silhouette is letterboxed rather than stretched to the square, because
 * aspect is most of what separates a 1x2 plate from a 1x6 one and stretching
 * throws it away.
 *
 * A silhouette alone is not enough, and the inventory says by how much: a 1x2
 * grille tile and a 1x2 tile have the same outline, and the set holds 54 of the
 * grille. What separates them is drawn *inside* the outline, so a second grid
 * carries the part's own shading normalised to its own range — grooves, stud
 * tops and printed detail survive that, and a change of ink colour does not.
 */
export function describe(thumbnail) {
  const { data, mask, width, bounds } = thumbnail;
  const boxWidth = bounds.maxX - bounds.minX + 1;
  const boxHeight = bounds.maxY - bounds.minY + 1;
  const span = Math.max(boxWidth, boxHeight);
  const offsetX = (span - boxWidth) / 2;
  const offsetY = (span - boxHeight) / 2;

  const grid = new Float32Array(GRID * GRID);
  const detail = new Float32Array(GRID * GRID);
  const weight = new Float32Array(GRID * GRID);
  const inkWeight = new Float32Array(GRID * GRID);
  const luminances = [];
  let inkPixels = 0;
  const tally = new Map();
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const cellX = Math.min(GRID - 1, Math.floor(((x - bounds.minX + offsetX) / span) * GRID));
      const cellY = Math.min(GRID - 1, Math.floor(((y - bounds.minY + offsetY) / span) * GRID));
      const cell = cellY * GRID + cellX;
      weight[cell] += 1;
      if (!mask[y * width + x]) continue;
      grid[cell] += 1;
      const at = (y * width + x) * 4;
      const luminance = 0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2];
      detail[cell] += luminance;
      inkWeight[cell] += 1;
      luminances.push(luminance);
      inkPixels += 1;
      sumR += data[at];
      sumG += data[at + 1];
      sumB += data[at + 2];
      const key = ((data[at] >> 4) << 8) | ((data[at + 1] >> 4) << 4) | (data[at + 2] >> 4);
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }
  for (let cell = 0; cell < grid.length; cell += 1) {
    if (weight[cell] > 0) grid[cell] /= weight[cell];
    if (inkWeight[cell] > 0) detail[cell] /= inkWeight[cell];
  }

  // The booklet shades one part in three tones of its colour over a near-black
  // outline, so "the part's colour" is the light face, not the average — an
  // average is dragged toward the outline and every part starts to look grey.
  luminances.sort((left, right) => left - right);
  const floor = luminances[Math.floor(luminances.length * 0.05)] ?? 0;
  const ceiling = luminances[Math.floor(luminances.length * 0.95)] ?? 255;
  const range = Math.max(1, ceiling - floor);
  for (let cell = 0; cell < detail.length; cell += 1) {
    detail[cell] =
      inkWeight[cell] === 0 ? 0 : Math.min(1, Math.max(0, (detail[cell] - floor) / range));
  }

  const colours = [...tally]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([key, count]) => ({
      rgb: [((key >> 8) & 15) * 16 + 8, ((key >> 4) & 15) * 16 + 8, (key & 15) * 16 + 8],
      share: count / Math.max(1, inkPixels),
    }));

  return {
    grid: [...grid].map((value) => Math.round(value * 255)),
    detail: [...detail].map((value) => Math.round(value * 255)),
    aspect: boxWidth / boxHeight,
    ink: inkPixels / (boxWidth * boxHeight),
    pixels: inkPixels,
    boxWidth,
    boxHeight,
    /** Mean ink colour, and the light face: together these separate the colours. */
    mean: [
      Math.round(sumR / Math.max(1, inkPixels)),
      Math.round(sumG / Math.max(1, inkPixels)),
      Math.round(sumB / Math.max(1, inkPixels)),
    ],
    lightFace: Math.round(ceiling),
    colours,
  };
}

/** Distance between two silhouettes, in [0, 1]; 0 is the same drawing. */
export function shapeDistance(left, right) {
  let intersection = 0;
  let union = 0;
  for (let cell = 0; cell < left.grid.length; cell += 1) {
    const a = left.grid[cell] / 255;
    const b = right.grid[cell] / 255;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }
  return union === 0 ? 1 : 1 - intersection / union;
}

/** Distance between what is drawn inside the two silhouettes, in [0, 1]. */
export function detailDistance(left, right) {
  if (!left.detail || !right.detail) return 0;
  let sum = 0;
  let count = 0;
  for (let cell = 0; cell < left.detail.length; cell += 1) {
    const covered = Math.min(left.grid[cell], right.grid[cell]) / 255;
    if (covered < 0.35) continue;
    sum += Math.abs(left.detail[cell] - right.detail[cell]) / 255;
    count += 1;
  }
  return count === 0 ? 1 : sum / count;
}

/**
 * Distance between the two parts' own colours.
 *
 * This is the term that decides which *element* a shape is: the set holds a 1x2
 * tile in black and the same tile in white under different element ids, and
 * nothing but colour tells them apart. An earlier version softened the distance
 * by looking for the closest pair among each part's top tones, and since every
 * part carries the same pale highlight, a black tile came within 0.11 of a
 * white one and 34 black tiles were claimed as white. The tones are compared
 * where they are, not at their nearest approach.
 */
export function colourDistance(left, right) {
  const a = left.mean ?? left.colours[0]?.rgb ?? [0, 0, 0];
  const b = right.mean ?? right.colours[0]?.rgb ?? [0, 0, 0];
  const mean = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 441;
  const dominant =
    Math.hypot(
      (left.colours[0]?.rgb[0] ?? 0) - (right.colours[0]?.rgb[0] ?? 0),
      (left.colours[0]?.rgb[1] ?? 0) - (right.colours[0]?.rgb[1] ?? 0),
      (left.colours[0]?.rgb[2] ?? 0) - (right.colours[0]?.rgb[2] ?? 0),
    ) / 441;
  const face = Math.abs((left.lightFace ?? 0) - (right.lightFace ?? 0)) / 255;
  return Math.min(1, (mean + dominant + face) / 3);
}

/**
 * How far apart two thumbnails are overall, with the terms kept separable.
 *
 * The weights were moved against the conservation check, not by eye: colour was
 * worth 0.22 and 439 pieces were over-claimed, and most of that was one colour
 * of a shape swallowing the others.
 */
export const DISTANCE_WEIGHTS = Object.freeze({
  shape: 0.34,
  detail: 0.14,
  aspect: 0.14,
  colour: 0.32,
  ink: 0.06,
});

export function thumbnailDistance(left, right, weights = DISTANCE_WEIGHTS) {
  const shape = shapeDistance(left, right);
  const detail = detailDistance(left, right);
  const aspect = Math.min(1, Math.abs(Math.log(left.aspect / right.aspect)) / Math.log(3));
  const colour = colourDistance(left, right);
  const ink = Math.min(1, Math.abs(left.ink - right.ink) * 2);
  return {
    total:
      shape * weights.shape +
      detail * weights.detail +
      aspect * weights.aspect +
      colour * weights.colour +
      ink * weights.ink,
    shape,
    detail,
    aspect,
    colour,
    ink,
  };
}

/**
 * The same crop cut down to the part.
 *
 * An inventory cell is as wide as its column, so a 1x1 plate sits in a mostly
 * empty rectangle; drawn straight onto a comparison card it comes out a
 * thumbnail of a thumbnail, far too small to count studs on. Both galleries are
 * re-cut to the ink before anything looks at them.
 */
export async function cropToContent(
  bytes,
  padding = 6,
  decodeBudget = createPngDecodeBudget("Single-thumbnail crop"),
) {
  const { createCanvas, loadImage } = await canvasApi();
  const thumbnail = await readThumbnail(bytes, decodeBudget);
  if (!thumbnail) return null;
  const { bounds, width, height } = thumbnail;
  const left = Math.max(0, bounds.minX - padding);
  const top = Math.max(0, bounds.minY - padding);
  const right = Math.min(width - 1, bounds.maxX + padding);
  const bottom = Math.min(height - 1, bounds.maxY + padding);
  const outputDimensions = assertBoundedCanvasDimensions(
    right - left + 1,
    bottom - top + 1,
    "Cropped thumbnail canvas",
  );
  const canvas = createCanvas(outputDimensions.width, outputDimensions.height);
  const context = canvas.getContext("2d");
  const expected = decodeBudget.charge(bytes, "Cropped thumbnail PNG");
  const image = await loadImage(bytes);
  if (image.width !== expected.width || image.height !== expected.height) {
    throw new Error(
      `Cropped thumbnail decoder reported ${image.width} x ${image.height}, but its authenticated PNG IHDR declared ${expected.width} x ${expected.height}.`,
    );
  }
  context.drawImage(
    image,
    left,
    top,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.encode("png");
}

/** Draws labelled thumbnails into a grid so a human can see what was matched. */
export async function contactSheet(
  cells,
  {
    columns,
    cellWidth,
    cellHeight,
    title,
    decodeBudget = createPngDecodeBudget("Contact-sheet input decode"),
  },
) {
  if (
    !Array.isArray(cells) ||
    cells.length > 4_096 ||
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    !Number.isSafeInteger(cellWidth) ||
    cellWidth < 1 ||
    !Number.isSafeInteger(cellHeight) ||
    cellHeight < 1
  ) {
    throw new Error(
      `Contact-sheet layout requires at most 4096 cells and positive safe integer columns/cell dimensions; received ${cells?.length} cells, ${columns} columns, ${cellWidth} x ${cellHeight} cells.`,
    );
  }
  const expectedImages = new Map();
  for (const [index, cell] of cells.entries()) {
    if (cell.path) {
      expectedImages.set(index, decodeBudget.charge(cell.path, `Contact-sheet image ${index + 1}`));
    }
  }
  const { createCanvas, loadImage } = await canvasApi();
  const rows = Math.max(1, Math.ceil(cells.length / columns));
  const header = 34;
  const caption = 66;
  const outputDimensions = assertBoundedCanvasDimensions(
    columns * cellWidth,
    header + rows * (cellHeight + caption),
    "Contact-sheet canvas",
  );
  const canvas = createCanvas(outputDimensions.width, outputDimensions.height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#12161a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e8eef2";
  context.font = "bold 20px sans-serif";
  context.fillText(title, 10, 24);

  for (const [index, cell] of cells.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cellWidth;
    const top = header + row * (cellHeight + caption);
    context.fillStyle = cell.tint ?? "#1d242b";
    context.fillRect(left + 2, top + 2, cellWidth - 4, cellHeight + caption - 4);
    if (cell.path) {
      const expected = expectedImages.get(index);
      const image = await loadImage(cell.path);
      assertBoundedImageDimensions(image.width, image.height, `Contact-sheet image ${index + 1}`);
      if (image.width !== expected.width || image.height !== expected.height) {
        throw new Error(
          `Contact-sheet image ${index + 1} decoded as ${image.width} x ${image.height}, but its authenticated PNG IHDR declared ${expected.width} x ${expected.height}.`,
        );
      }
      const scale = Math.min((cellWidth - 12) / image.width, (cellHeight - 12) / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(
        image,
        left + (cellWidth - drawWidth) / 2,
        top + (cellHeight - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
    }
    context.fillStyle = "#e8eef2";
    context.font = "13px sans-serif";
    for (const [line, text] of (cell.lines ?? []).entries()) {
      context.fillText(text.slice(0, 46), left + 6, top + cellHeight + 14 + line * 14);
    }
  }
  return canvas.encode("png");
}
