export interface ReplayBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const MAX_SOURCE_REPLAY_BOX_PIXELS = 4_000_000;
export const MAX_SOURCE_REPLAY_PAGE_PIXELS = 32_000_000;
const MAX_UINT32 = 0xffff_ffff;

const DOMAIN = new TextEncoder().encode("lego.callout-source-component-group/1\0");

export async function replaySha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function equalBounds(left: ReplayBounds, right: ReplayBounds): boolean {
  return (
    left.left === right.left &&
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom
  );
}

export async function replayComponentGroupDigest(
  pageNumber: number,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
  bounds: ReplayBounds,
  rawComponentCount: number,
  records: Uint32Array,
): Promise<string> {
  const count = records.length / 2;
  const integers = [
    pageNumber,
    scale,
    canvasWidth,
    canvasHeight,
    bounds.left,
    bounds.top,
    bounds.right,
    bounds.bottom,
    count,
    rawComponentCount,
  ];
  const canvasPixels = canvasWidth * canvasHeight;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_SOURCE_REPLAY_BOX_PIXELS ||
    !Number.isSafeInteger(rawComponentCount) ||
    rawComponentCount < 1 ||
    rawComponentCount > 64 ||
    rawComponentCount > count ||
    integers.some((value) => !Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) ||
    pageNumber < 1 ||
    scale < 1 ||
    canvasWidth < 1 ||
    canvasHeight < 1 ||
    !Number.isSafeInteger(canvasPixels) ||
    canvasPixels > MAX_SOURCE_REPLAY_PAGE_PIXELS ||
    bounds.left > bounds.right ||
    bounds.top > bounds.bottom ||
    bounds.right >= canvasWidth ||
    bounds.bottom >= canvasHeight
  ) {
    throw new Error(
      `Independent source replay group digest requires unsigned 32-bit fields, 1..64 nonempty raw components no greater than the union pixel count, and 1..${MAX_SOURCE_REPLAY_BOX_PIXELS} union foreground pixels inside a positive canvas of at most ${MAX_SOURCE_REPLAY_PAGE_PIXELS} pixels.`,
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
  let observed: ReplayBounds = {
    left: canvasWidth,
    top: canvasHeight,
    right: -1,
    bottom: -1,
  };
  for (let index = 0; index < records.length; index += 2) {
    const pixel = records[index]!;
    const x = pixel % canvasWidth;
    const y = (pixel - x) / canvasWidth;
    if (
      pixel <= previous ||
      pixel >= canvasPixels ||
      x < bounds.left ||
      x > bounds.right ||
      y < bounds.top ||
      y > bounds.bottom
    ) {
      throw new Error(
        "Independent source replay records must be unique row-major pixels inside their declared bounds.",
      );
    }
    previous = pixel;
    observed = {
      left: Math.min(observed.left, x),
      top: Math.min(observed.top, y),
      right: Math.max(observed.right, x),
      bottom: Math.max(observed.bottom, y),
    };
    view.setUint32(offset, pixel);
    view.setUint32(offset + 4, records[index + 1]!);
    offset += 8;
  }
  if (!equalBounds(observed, bounds)) {
    throw new Error(
      `Independent source replay retained ${count} pixels in ${JSON.stringify(observed)}, not tight ${JSON.stringify(bounds)}.`,
    );
  }
  return replaySha256(bytes);
}
