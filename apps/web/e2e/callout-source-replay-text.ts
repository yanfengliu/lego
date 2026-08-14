import { MAX_SOURCE_REPLAY_BOX_PIXELS, type ReplayBounds } from "./callout-source-replay-digest";

export const MAX_SOURCE_REPLAY_TEXT_ITEMS = 20_000;
export const MAX_SOURCE_REPLAY_TEXT_CHARS = 20_000;
export const MAX_SOURCE_REPLAY_TEXT_MASK_WRITES = MAX_SOURCE_REPLAY_BOX_PIXELS;

export function assertBoundedReplayTextItems(value: unknown): asserts value is readonly unknown[] {
  if (!Array.isArray(value) || value.length > MAX_SOURCE_REPLAY_TEXT_ITEMS) {
    const observed = Array.isArray(value) ? value.length : "non-array";
    throw new Error(
      `Independent source replay text content has ${observed} items; expected an array of at most ${MAX_SOURCE_REPLAY_TEXT_ITEMS} before text transformation or search.`,
    );
  }
  let characters = 0;
  for (const raw of value) {
    const text = (raw as { readonly str?: unknown } | null)?.str;
    if (typeof text !== "string") continue;
    characters += text.length;
    if (characters > MAX_SOURCE_REPLAY_TEXT_CHARS) {
      throw new Error(
        `Independent source replay text content has more than ${MAX_SOURCE_REPLAY_TEXT_CHARS} aggregate string characters before text search.`,
      );
    }
  }
}

export function buildBoundedReplayTextMask(input: {
  readonly sourceBoxPx: ReplayBounds;
  readonly width: number;
  readonly height: number;
  readonly textBounds: readonly ReplayBounds[];
  readonly maximumWrites?: number;
}): Uint8Array<ArrayBuffer> {
  const maximumWrites = input.maximumWrites ?? MAX_SOURCE_REPLAY_TEXT_MASK_WRITES;
  const sourceBoxPixels = input.width * input.height;
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width < 1 ||
    input.height < 1 ||
    !Number.isSafeInteger(sourceBoxPixels) ||
    sourceBoxPixels > MAX_SOURCE_REPLAY_BOX_PIXELS ||
    input.textBounds.length > MAX_SOURCE_REPLAY_TEXT_ITEMS ||
    !Number.isSafeInteger(maximumWrites) ||
    maximumWrites < 1 ||
    maximumWrites > MAX_SOURCE_REPLAY_TEXT_MASK_WRITES
  ) {
    throw new Error(
      `Independent source replay text mask dimensions or write limit are invalid; source pixels and write limit must each be in 1..${MAX_SOURCE_REPLAY_TEXT_MASK_WRITES}.`,
    );
  }
  const spans: ReplayBounds[] = [];
  let chargedWrites = 0;
  for (const bounds of input.textBounds) {
    const left = Math.max(input.sourceBoxPx.left, bounds.left);
    const right = Math.min(input.sourceBoxPx.right, bounds.right);
    const top = Math.max(input.sourceBoxPx.top, bounds.top);
    const bottom = Math.min(input.sourceBoxPx.bottom, bounds.bottom);
    if (left > right || top > bottom) continue;
    const writes = (right - left + 1) * (bottom - top + 1);
    if (!Number.isSafeInteger(writes) || writes > maximumWrites - chargedWrites) {
      throw new Error(
        `Independent source replay text-mask rectangles exceed ${maximumWrites} aggregate pixel writes before mask mutation.`,
      );
    }
    chargedWrites += writes;
    spans.push({ left, top, right, bottom });
  }
  const mask = new Uint8Array(sourceBoxPixels);
  for (const span of spans) {
    for (let y = span.top; y <= span.bottom; y += 1) {
      mask.fill(
        1,
        (y - input.sourceBoxPx.top) * input.width + span.left - input.sourceBoxPx.left,
        (y - input.sourceBoxPx.top) * input.width + span.right - input.sourceBoxPx.left + 1,
      );
    }
  }
  return mask;
}
