import { createHash } from "node:crypto";

import { decodeCanonicalCardRgba } from "./part-thumbnail-image-guard.mjs";

const MAX_PIXELS = 4_000_000;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function assertDecodedRgba({ width, height, data }, label) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_PIXELS ||
    !(data instanceof Uint8Array) ||
    data.byteLength !== width * height * 4
  ) {
    throw new Error(
      `${label} must be a bounded positive RGBA8 raster of at most ${MAX_PIXELS} pixels.`,
    );
  }
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] !== 255) {
      throw new Error(`${label} pixel ${Math.floor(offset / 4)} is not exactly opaque.`);
    }
  }
}

function rgbaAt(data, pixel) {
  const offset = pixel * 4;
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
}

function sameRgbaAt(data, pixel, expected) {
  const offset = pixel * 4;
  return (
    data[offset] === expected[0] &&
    data[offset + 1] === expected[1] &&
    data[offset + 2] === expected[2] &&
    data[offset + 3] === expected[3]
  );
}

function frameRgba(width, height, rgba) {
  const framed = Buffer.allocUnsafe(8 + rgba.byteLength);
  framed.writeUInt32BE(width, 0);
  framed.writeUInt32BE(height, 4);
  Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(framed, 8);
  return framed;
}

/**
 * Removes only complete exact-background edge rows and columns. The returned
 * half-open bounds retain every non-background pixel and the hash framing is
 * uint32be(width) || uint32be(height) || row-major RGBA8.
 */
export function canonicalizeOpaqueGroundRgba(decoded, label = "Callout crop") {
  assertDecodedRgba(decoded, label);
  const { width, height, data } = decoded;
  const backgroundRgba = rgbaAt(data, 0);
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  if (corners.some((pixel) => !sameRgbaAt(data, pixel, backgroundRgba))) {
    throw new Error(`${label} does not have one exact opaque RGBA value at all four corners.`);
  }

  const rowIsBackground = (y, left, right) => {
    for (let x = left; x < right; x += 1) {
      if (!sameRgbaAt(data, y * width + x, backgroundRgba)) return false;
    }
    return true;
  };
  const columnIsBackground = (x, top, bottom) => {
    for (let y = top; y < bottom; y += 1) {
      if (!sameRgbaAt(data, y * width + x, backgroundRgba)) return false;
    }
    return true;
  };

  let left = 0;
  let top = 0;
  let right = width;
  let bottom = height;
  while (top < bottom && rowIsBackground(top, left, right)) top += 1;
  while (bottom > top && rowIsBackground(bottom - 1, left, right)) bottom -= 1;
  if (top === bottom) {
    throw new Error(`${label} contains only its exact corner background.`);
  }
  while (left < right && columnIsBackground(left, top, bottom)) left += 1;
  while (right > left && columnIsBackground(right - 1, top, bottom)) right -= 1;
  if (left === right) {
    throw new Error(`${label} contains no non-background pixels after exact edge trimming.`);
  }

  const canonicalWidth = right - left;
  const canonicalHeight = bottom - top;
  const canonicalRgba = new Uint8Array(canonicalWidth * canonicalHeight * 4);
  const sourceStride = width * 4;
  const canonicalStride = canonicalWidth * 4;
  for (let y = top; y < bottom; y += 1) {
    canonicalRgba.set(
      data.subarray(y * sourceStride + left * 4, y * sourceStride + right * 4),
      (y - top) * canonicalStride,
    );
  }
  return {
    backgroundRgba,
    boundsHalfOpen: { left, top, right, bottom },
    canonicalHeight,
    canonicalRgba,
    canonicalRgbaSha256: sha256(canonicalRgba),
    canonicalWidth,
    framedSha256: sha256(frameRgba(canonicalWidth, canonicalHeight, canonicalRgba)),
    originalHeight: height,
    originalWidth: width,
  };
}

export function canonicalizeCalloutPng(bytes, label = "Callout crop PNG") {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${label} must be PNG bytes.`);
  }
  return canonicalizeOpaqueGroundRgba(decodeCanonicalCardRgba(bytes, label), label);
}

export function measureExactBottomBackgroundRecut(legacy, current, label = "Callout recut") {
  assertDecodedRgba(legacy, `${label} legacy crop`);
  assertDecodedRgba(current, `${label} current crop`);
  if (legacy.width !== current.width || legacy.height <= current.height) {
    throw new Error(`${label} must remove one or more complete bottom rows at the same width.`);
  }
  const backgroundRgba = rgbaAt(legacy.data, 0);
  if (
    rgbaAt(current.data, 0).some((value, index) => value !== backgroundRgba[index]) ||
    current.data.some((value, index) => value !== legacy.data[index])
  ) {
    throw new Error(`${label} current decoded RGBA is not an exact prefix of the legacy crop.`);
  }
  const removedRgba = legacy.data.subarray(current.data.byteLength);
  for (let pixel = 0; pixel < removedRgba.byteLength / 4; pixel += 1) {
    if (!sameRgbaAt(removedRgba, pixel, backgroundRgba)) {
      throw new Error(`${label} removed suffix contains a non-background pixel at ${pixel}.`);
    }
  }
  return {
    backgroundRgba,
    currentPrefixBytes: current.data.byteLength,
    currentPrefixSha256: sha256(current.data),
    removedBytes: removedRgba.byteLength,
    removedRows: legacy.height - current.height,
    removedRgbaSha256: sha256(removedRgba),
  };
}

export const __testOnly = Object.freeze({ assertDecodedRgba, frameRgba });
