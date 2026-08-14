import type { PixelBounds } from "./callout-types";

export const MAX_CALLOUT_PDF_BYTES = 96 * 1024 * 1024;
export const MAX_CALLOUT_PAGE_RASTER_DIMENSION = 16_384;
export const MAX_CALLOUT_PAGE_RASTER_PIXELS = 32_000_000;
export const MAX_CALLOUT_TEXT_ITEMS = 4_096;
export const MAX_CALLOUT_TEXT_CHARACTERS = 20_000;
export const MAX_CALLOUT_TEXT_MASK_PIXELS = 64_000_000;
export const MAX_CALLOUT_CROP_DIMENSION = 4_096;
export const MAX_CALLOUT_CROP_PIXELS = 16 * 1024 * 1024;
export const MAX_CALLOUT_CROP_BYTES = 2 * 1024 * 1024;
export const MAX_CALLOUT_COMPONENT_BOX_PIXELS = 4_000_000;
export const MAX_CALLOUT_COMPONENT_CACHE_PIXELS = 16_000_000;
/** The pinned 881-callout booklet peaks at 11 targets on one page. */
export const MAX_CALLOUT_TARGETS_PER_PAGE = 16;

type FetchPdf = (url: string) => Promise<Response>;

async function cancelCalloutResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve the source-authentication refusal if transport cleanup itself fails.
  }
}

export function snapshotBoundedCalloutTargets<T>(targets: readonly T[]): readonly T[] {
  const count = Array.isArray(targets) ? targets.length : -1;
  if (!Array.isArray(targets) || count < 1 || count > MAX_CALLOUT_TARGETS_PER_PAGE) {
    throw new Error(
      `Callout browser rendering requires 1..${MAX_CALLOUT_TARGETS_PER_PAGE} targets on one page before PDF work.`,
    );
  }
  const snapshot: T[] = [];
  for (let index = 0; index < count; index += 1) snapshot.push(targets[index]!);
  return snapshot;
}

export function snapshotBoundedCalloutTextItems(items: readonly unknown[]): readonly unknown[] {
  const count = Array.isArray(items) ? items.length : -1;
  if (!Array.isArray(items) || count > MAX_CALLOUT_TEXT_ITEMS) {
    throw new Error(
      `Callout PDF text extraction requires 0..${MAX_CALLOUT_TEXT_ITEMS} items before mask work.`,
    );
  }
  const snapshot: unknown[] = [];
  let characters = 0;
  for (let index = 0; index < count; index += 1) {
    const item = items[index];
    const str = (item as { readonly str?: unknown } | null)?.str;
    if (typeof str === "string") characters += str.length;
    if (!Number.isSafeInteger(characters) || characters > MAX_CALLOUT_TEXT_CHARACTERS) {
      throw new Error(
        `Callout PDF text extraction exceeds ${MAX_CALLOUT_TEXT_CHARACTERS} characters before mask work.`,
      );
    }
    snapshot.push(item);
  }
  return snapshot;
}

export function assertBoundedCalloutTextMasks(masks: readonly PixelBounds[]): void {
  const count = Array.isArray(masks) ? masks.length : -1;
  if (!Array.isArray(masks) || count > MAX_CALLOUT_TEXT_ITEMS) {
    throw new Error(`Callout PDF text-mask count must stay within 0..${MAX_CALLOUT_TEXT_ITEMS}.`);
  }
  let pixels = 0;
  for (let index = 0; index < count; index += 1) {
    const bounds = masks[index]!;
    const width = bounds.right - bounds.left + 1;
    const height = bounds.bottom - bounds.top + 1;
    pixels += width * height;
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      !Number.isSafeInteger(pixels) ||
      pixels > MAX_CALLOUT_TEXT_MASK_PIXELS
    ) {
      throw new Error(
        `Callout PDF text masks require more than ${MAX_CALLOUT_TEXT_MASK_PIXELS} bounded fill pixels.`,
      );
    }
  }
}

function assertExpectedPdfBytes(expectedBytes: number): void {
  if (
    !Number.isSafeInteger(expectedBytes) ||
    expectedBytes < 1 ||
    expectedBytes > MAX_CALLOUT_PDF_BYTES
  ) {
    throw new Error(
      `Callout PDF expected byte length must be a safe integer in 1..${MAX_CALLOUT_PDF_BYTES} before fetching.`,
    );
  }
}

function declaredContentLength(response: Response): number | null {
  const header = response.headers.get("content-length");
  if (header === null) return null;
  if (!/^(?:0|[1-9]\d*)$/u.test(header)) {
    throw new Error(
      `Callout PDF Content-Length ${JSON.stringify(header)} is not a decimal byte count.`,
    );
  }
  const bytes = Number(header);
  if (!Number.isSafeInteger(bytes)) {
    throw new Error(`Callout PDF Content-Length ${header} exceeds the safe integer range.`);
  }
  return bytes;
}

/** Fetches one PDF into a single exact-size allocation without an unbounded arrayBuffer copy. */
export async function fetchExactCalloutPdfBytes(
  url: string,
  expectedBytes: number,
  fetchPdf: FetchPdf = fetch,
): Promise<Uint8Array<ArrayBuffer>> {
  assertExpectedPdfBytes(expectedBytes);
  const response = await fetchPdf(url);
  if (!response.ok) {
    await cancelCalloutResponseBody(response);
    throw new Error(
      `Callout PDF fetch ${url} failed with HTTP ${response.status} ${response.statusText || "(no status text)"}.`,
    );
  }
  let declaredBytes: number | null;
  try {
    declaredBytes = declaredContentLength(response);
  } catch (error) {
    await cancelCalloutResponseBody(response);
    throw error;
  }
  if (declaredBytes !== null && declaredBytes !== expectedBytes) {
    await cancelCalloutResponseBody(response);
    throw new Error(
      `Callout PDF Content-Length ${declaredBytes} does not match the Node-ingested ${expectedBytes} bytes.`,
    );
  }
  if (response.body === null) {
    throw new Error(`Callout PDF fetch ${url} returned no readable response body.`);
  }

  const bytes = new Uint8Array(expectedBytes);
  const reader = response.body.getReader();
  let received = 0;
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        completed = true;
        break;
      }
      if (chunk.value.byteLength === 0) {
        throw new Error("Callout PDF response produced an empty streaming chunk without progress.");
      }
      if (received + chunk.value.byteLength > expectedBytes) {
        throw new Error(
          `Callout PDF response exceeded the Node-ingested ${expectedBytes} bytes while streaming.`,
        );
      }
      bytes.set(chunk.value, received);
      received += chunk.value.byteLength;
    }
    if (received !== expectedBytes) {
      throw new Error(
        `Callout PDF response ended after ${received} bytes, not the Node-ingested ${expectedBytes} bytes.`,
      );
    }
    return bytes;
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function boundedCalloutPageRaster(
  viewportWidth: number,
  viewportHeight: number,
): { readonly width: number; readonly height: number } {
  const width = Math.ceil(viewportWidth);
  const height = Math.ceil(viewportHeight);
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    width > MAX_CALLOUT_PAGE_RASTER_DIMENSION ||
    height < 1 ||
    height > MAX_CALLOUT_PAGE_RASTER_DIMENSION ||
    !Number.isSafeInteger(pixels) ||
    pixels > MAX_CALLOUT_PAGE_RASTER_PIXELS
  ) {
    throw new Error(
      `Callout PDF page raster ${String(width)}x${String(height)} must stay within ${MAX_CALLOUT_PAGE_RASTER_DIMENSION} pixels per side and 1..${MAX_CALLOUT_PAGE_RASTER_PIXELS} pixels before canvas or text-mask allocation.`,
    );
  }
  return { width, height };
}

export function assertBoundedCalloutCropRaster(width: number, height: number, label: string): void {
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    width > MAX_CALLOUT_CROP_DIMENSION ||
    height < 1 ||
    height > MAX_CALLOUT_CROP_DIMENSION ||
    !Number.isSafeInteger(pixels) ||
    pixels > MAX_CALLOUT_CROP_PIXELS
  ) {
    throw new Error(
      `${label} raster ${String(width)}x${String(height)} must stay within ${MAX_CALLOUT_CROP_DIMENSION} pixels per side and 1..${MAX_CALLOUT_CROP_PIXELS} pixels before crop-canvas allocation.`,
    );
  }
}

export function assertCalloutComponentBoxBound(bounds: PixelBounds): void {
  const width = bounds.right - bounds.left + 1;
  const height = bounds.bottom - bounds.top + 1;
  if (
    !Number.isSafeInteger(bounds.left) ||
    !Number.isSafeInteger(bounds.top) ||
    !Number.isSafeInteger(bounds.right) ||
    !Number.isSafeInteger(bounds.bottom) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_CALLOUT_COMPONENT_BOX_PIXELS
  ) {
    throw new Error(
      `Callout source box must contain 1..${MAX_CALLOUT_COMPONENT_BOX_PIXELS} bounded raster pixels before component enumeration.`,
    );
  }
}

export function createCalloutComponentCacheBudget(): {
  readonly charge: (bounds: PixelBounds) => void;
} {
  let pixels = 0;
  return {
    charge(bounds) {
      assertCalloutComponentBoxBound(bounds);
      const next = pixels + (bounds.right - bounds.left + 1) * (bounds.bottom - bounds.top + 1);
      if (!Number.isSafeInteger(next) || next > MAX_CALLOUT_COMPONENT_CACHE_PIXELS) {
        throw new Error(
          `Callout page component caches exceed ${MAX_CALLOUT_COMPONENT_CACHE_PIXELS} source-box pixels before retaining component sets.`,
        );
      }
      pixels = next;
    },
  };
}

export async function calloutSha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Encodes only after the bounded crop raster exists, then refuses oversized PNG bytes before base64. */
export async function boundedCalloutPngDataUrl(
  canvas: HTMLCanvasElement,
  label: string,
): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (
    blob === null ||
    blob.type !== "image/png" ||
    blob.size < 1 ||
    blob.size > MAX_CALLOUT_CROP_BYTES
  ) {
    throw new Error(
      `${label} encoded PNG must contain 1..${MAX_CALLOUT_CROP_BYTES} bytes before browser-result retention.`,
    );
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength !== blob.size) {
    throw new Error(`${label} encoded PNG changed byte length while being retained.`);
  }
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
