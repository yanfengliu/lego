import { crc32, inflateSync } from "node:zlib";

export const MAX_THUMBNAIL_DIMENSION = 4_096;
export const MAX_THUMBNAIL_PIXELS = 16 * 1024 * 1024;
export const MAX_CANVAS_DIMENSION = 16_384;
export const MAX_CANVAS_PIXELS = 32 * 1024 * 1024;
export const MAX_AGGREGATE_PNG_DECODE_PIXELS = 256 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_BIT_DEPTHS = new Map([
  [0, new Set([1, 2, 4, 8, 16])],
  [2, new Set([8, 16])],
  [3, new Set([1, 2, 4, 8])],
  [4, new Set([8, 16])],
  [6, new Set([8, 16])],
]);

export function assertBoundedImageDimensions(width, height, label = "Thumbnail image") {
  if (
    !Number.isSafeInteger(width) ||
    width < 1 ||
    width > MAX_THUMBNAIL_DIMENSION ||
    !Number.isSafeInteger(height) ||
    height < 1 ||
    height > MAX_THUMBNAIL_DIMENSION ||
    width * height > MAX_THUMBNAIL_PIXELS
  ) {
    throw new Error(
      `${label} dimensions must be positive integers no larger than ${MAX_THUMBNAIL_DIMENSION} per side and ${MAX_THUMBNAIL_PIXELS} pixels total; received ${JSON.stringify(width)} x ${JSON.stringify(height)}. Resize or regenerate the retained PNG before decoding it.`,
    );
  }
  return { width, height };
}

/** Generated sheets may be wide, but every native canvas allocation still has a hard ceiling. */
export function assertBoundedCanvasDimensions(width, height, label = "Generated canvas") {
  if (
    !Number.isSafeInteger(width) ||
    width < 1 ||
    width > MAX_CANVAS_DIMENSION ||
    !Number.isSafeInteger(height) ||
    height < 1 ||
    height > MAX_CANVAS_DIMENSION ||
    width * height > MAX_CANVAS_PIXELS
  ) {
    throw new Error(
      `${label} dimensions must be positive integers no larger than ${MAX_CANVAS_DIMENSION} per side and ${MAX_CANVAS_PIXELS} pixels total; received ${JSON.stringify(width)} x ${JSON.stringify(height)}. Reduce the card or sheet layout before allocating its canvas.`,
    );
  }
  return { width, height };
}

/** Authenticate the PNG IHDR before asking a native decoder to allocate its raster. */
export function assertBoundedPngDimensions(bytes, label = "Thumbnail PNG", limits = {}) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${label} must be supplied as bounded retained bytes, not a filesystem path.`);
  }
  const held = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    held.length < 33 ||
    !held.subarray(0, 8).equals(PNG_SIGNATURE) ||
    held.readUInt32BE(8) !== 13 ||
    held.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(
      `${label} does not begin with a canonical PNG signature and 13-byte IHDR chunk. Regenerate the retained thumbnail as PNG before decoding it.`,
    );
  }
  const bitDepth = held[24];
  const colourType = held[25];
  const expectedCrc = crc32(held.subarray(12, 29)) >>> 0;
  if (
    !PNG_BIT_DEPTHS.get(colourType)?.has(bitDepth) ||
    held[26] !== 0 ||
    held[27] !== 0 ||
    (held[28] !== 0 && held[28] !== 1) ||
    held.readUInt32BE(29) !== expectedCrc
  ) {
    throw new Error(
      `${label} has an invalid or unauthenticated PNG IHDR (bit depth, colour type, compression, filter, interlace, or CRC). Regenerate the retained thumbnail as a canonical PNG before decoding it.`,
    );
  }
  const width = held.readUInt32BE(16);
  const height = held.readUInt32BE(20);
  const maxDimension = limits.maxDimension ?? MAX_THUMBNAIL_DIMENSION;
  const maxPixels = limits.maxPixels ?? MAX_THUMBNAIL_PIXELS;
  if (
    !Number.isSafeInteger(maxDimension) ||
    maxDimension < 1 ||
    !Number.isSafeInteger(maxPixels) ||
    maxPixels < 1 ||
    width < 1 ||
    width > maxDimension ||
    height < 1 ||
    height > maxDimension ||
    width * height > maxPixels
  ) {
    throw new Error(
      `${label} dimensions must be positive integers no larger than ${maxDimension} per side and ${maxPixels} pixels total; received ${JSON.stringify(width)} x ${JSON.stringify(height)}. Resize or regenerate the retained PNG before decoding it.`,
    );
  }
  return { width, height };
}

/** Charge every planned native PNG decode before allocation against one bounded workflow. */
export function createPngDecodeBudget(
  label = "PNG decode workflow",
  maxPixels = MAX_AGGREGATE_PNG_DECODE_PIXELS,
) {
  if (!Number.isSafeInteger(maxPixels) || maxPixels < 1) {
    throw new Error(
      `${label} pixel budget must be a positive safe integer; received ${JSON.stringify(maxPixels)}.`,
    );
  }
  let usedPixels = 0;
  return {
    charge(bytes, imageLabel = "PNG image", limits = {}) {
      const dimensions = assertBoundedPngDimensions(bytes, imageLabel, limits);
      const next = usedPixels + dimensions.width * dimensions.height;
      if (!Number.isSafeInteger(next) || next > maxPixels) {
        throw new Error(
          `${label} would decode ${next} pixels after ${imageLabel}, above its ${maxPixels}-pixel aggregate work limit. Reduce the bounded image set before invoking the native decoder.`,
        );
      }
      usedPixels = next;
      return dimensions;
    },
    get usedPixels() {
      return usedPixels;
    },
  };
}

export function assertCanonicalCardPngHeader(bytes, label = "Vision card PNG") {
  const dimensions = assertBoundedPngDimensions(bytes, label, {
    maxDimension: MAX_CANVAS_DIMENSION,
    maxPixels: MAX_CANVAS_PIXELS,
  });
  const held = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (held[24] !== 8 || held[25] !== 6 || held[28] !== 0) {
    throw new Error(
      `${label} must be the canonical 8-bit RGBA non-interlaced PNG emitted by the card renderer; received bit depth ${held[24]}, colour type ${held[25]}, interlace ${held[28]}. Regenerate cards instead of transcoding retained evidence.`,
    );
  }
  return dimensions;
}

/** Fully validate the exact non-interlaced RGBA PNG emitted for adjudication cards. */
export function assertCanonicalCardPng(bytes, label = "Vision card PNG") {
  const dimensions = assertCanonicalCardPngHeader(bytes, label);
  const held = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idat = [];
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  let dataEnded = false;
  let sawEnd = false;
  while (offset < held.length) {
    if (offset + 12 > held.length) {
      throw new Error(`${label} ends inside a PNG chunk header at byte ${offset}.`);
    }
    const length = held.readUInt32BE(offset);
    const type = held.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/u.test(type) || end > held.length || end < offset) {
      throw new Error(
        `${label} has an invalid ${JSON.stringify(type)} chunk length ${length} at byte ${offset}.`,
      );
    }
    const expectedCrc = crc32(held.subarray(offset + 4, offset + 8 + length)) >>> 0;
    if (held.readUInt32BE(offset + 8 + length) !== expectedCrc) {
      throw new Error(`${label} ${type} chunk at byte ${offset} failed its PNG CRC.`);
    }
    if (type === "IHDR") {
      if (sawHeader || offset !== 8 || length !== 13) {
        throw new Error(`${label} must contain exactly one first 13-byte IHDR chunk.`);
      }
      sawHeader = true;
    } else if (type === "IDAT") {
      if (!sawHeader || dataEnded || sawEnd) {
        throw new Error(`${label} IDAT chunks must be consecutive after IHDR and before IEND.`);
      }
      sawData = true;
      idat.push(held.subarray(offset + 8, offset + 8 + length));
    } else if (type === "IEND") {
      if (!sawData || sawEnd || length !== 0 || end !== held.length) {
        throw new Error(`${label} must end exactly once with a zero-byte IEND after IDAT data.`);
      }
      sawEnd = true;
    } else {
      if (!sawHeader || sawEnd || /^[A-Z]/u.test(type)) {
        throw new Error(
          `${label} contains unsupported critical or out-of-order PNG chunk ${JSON.stringify(type)}. Regenerate it with the canonical card renderer.`,
        );
      }
      if (sawData) dataEnded = true;
    }
    offset = end;
  }
  if (!sawHeader || !sawData || !sawEnd) {
    throw new Error(`${label} is incomplete; canonical card PNGs require IHDR, IDAT, and IEND.`);
  }
  const rowBytes = dimensions.width * 4 + 1;
  const expectedInflatedBytes = rowBytes * dimensions.height;
  let raster;
  try {
    raster = inflateSync(Buffer.concat(idat), { maxOutputLength: expectedInflatedBytes });
  } catch (cause) {
    throw new Error(
      `${label} IDAT data does not decode within its authenticated ${dimensions.width} x ${dimensions.height} RGBA raster bound: ${cause instanceof Error ? cause.message : String(cause)}.`,
      { cause },
    );
  }
  if (
    raster.length !== expectedInflatedBytes ||
    Array.from({ length: dimensions.height }, (_, row) => raster[row * rowBytes]).some(
      (filter) => filter > 4,
    )
  ) {
    throw new Error(
      `${label} decoded to ${raster.length} scanline bytes or uses an invalid row filter; required exactly ${expectedInflatedBytes} bounded bytes with filters 0..4.`,
    );
  }
  return dimensions;
}
