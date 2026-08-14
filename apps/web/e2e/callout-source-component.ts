import type { PixelBounds } from "./callout-types";

const DOMAIN = new TextEncoder().encode("lego.callout-source-component-group/1\0");
const MAX_FOREGROUND_PIXELS = 4_000_000;
const UINT32_MAX = 0xffff_ffff;

export interface SourceComponentDigestInput {
  readonly pageNumber: number;
  readonly rasterScale: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly boundsPx: PixelBounds;
  readonly rawComponentCount: number;
  /** Row-major pairs of absolute linear pixel index then packed RGBA. */
  readonly records: Uint32Array;
}

export async function absoluteForegroundSha256(input: SourceComponentDigestInput): Promise<string> {
  const { boundsPx: bounds, records } = input;
  const count = records.length / 2;
  const integers = [
    input.pageNumber,
    input.rasterScale,
    input.canvasWidth,
    input.canvasHeight,
    bounds.left,
    bounds.top,
    bounds.right,
    bounds.bottom,
    count,
    input.rawComponentCount,
  ];
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_FOREGROUND_PIXELS ||
    integers.some((value) => !Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) ||
    input.pageNumber < 1 ||
    input.rasterScale < 1 ||
    input.canvasWidth < 1 ||
    input.canvasHeight < 1 ||
    bounds.left > bounds.right ||
    bounds.top > bounds.bottom ||
    !Number.isSafeInteger(input.rawComponentCount) ||
    input.rawComponentCount < 1 ||
    input.rawComponentCount > 64 ||
    input.rawComponentCount > count
  ) {
    throw new Error(
      "Source-component-group digest input requires positive uint32 page/canvas fields, bounded uint32 geometry, 1..64 nonempty raw components no greater than the union pixel count, and 1..4,000,000 pixels.",
    );
  }
  const bytes = new Uint8Array(DOMAIN.length + (integers.length + records.length) * 4);
  bytes.set(DOMAIN);
  const view = new DataView(bytes.buffer);
  let offset = DOMAIN.length;
  for (const value of integers) {
    view.setUint32(offset, value);
    offset += 4;
  }
  let previous = -1;
  let left = input.canvasWidth;
  let top = input.canvasHeight;
  let right = -1;
  let bottom = -1;
  for (let index = 0; index < records.length; index += 2) {
    const pixel = records[index]!;
    const x = pixel % input.canvasWidth;
    const y = (pixel - x) / input.canvasWidth;
    if (
      pixel <= previous ||
      pixel >= input.canvasWidth * input.canvasHeight ||
      x < bounds.left ||
      x > bounds.right ||
      y < bounds.top ||
      y > bounds.bottom
    ) {
      throw new Error(
        "Source-component-group pixels must be unique row-major members of their bounds.",
      );
    }
    previous = pixel;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    view.setUint32(offset, pixel);
    view.setUint32(offset + 4, records[index + 1]!);
    offset += 8;
  }
  if (JSON.stringify({ left, top, right, bottom }) !== JSON.stringify(bounds)) {
    throw new Error(
      "Source-component-group bounds do not tightly enclose their foreground pixels.",
    );
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
