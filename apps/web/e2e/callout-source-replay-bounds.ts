import {
  MAX_SOURCE_REPLAY_BOX_PIXELS,
  MAX_SOURCE_REPLAY_PAGE_PIXELS,
  type ReplayBounds,
} from "./callout-source-replay-digest";
import type { SourceReplayInput } from "./callout-source-replay-types";

export const MAX_SOURCE_REPLAY_RASTER_EXTENT = 16_384;

export function boundedReplayRaster(
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
  box: SourceReplayInput["box"],
): {
  readonly pageWidthPx: number;
  readonly pageHeightPx: number;
  readonly pagePixels: number;
  readonly pageHeightPt: number;
  readonly sourceBoxPx: ReplayBounds;
  readonly width: number;
  readonly height: number;
  readonly sourceBoxPixels: number;
  readonly clipRenderBoxPx: ReplayBounds;
  readonly clipWidth: number;
  readonly clipHeight: number;
  readonly clipRenderPixels: number;
} {
  const pageWidthPx = Math.ceil(viewportWidth);
  const pageHeightPx = Math.ceil(viewportHeight);
  const pagePixels = pageWidthPx * pageHeightPx;
  if (
    !Number.isSafeInteger(pagePixels) ||
    pageWidthPx < 1 ||
    pageHeightPx < 1 ||
    pageWidthPx > MAX_SOURCE_REPLAY_RASTER_EXTENT ||
    pageHeightPx > MAX_SOURCE_REPLAY_RASTER_EXTENT ||
    pagePixels > MAX_SOURCE_REPLAY_PAGE_PIXELS
  ) {
    throw new Error(
      `Independent source replay page is ${pageWidthPx}x${pageHeightPx}=${pagePixels} pixels; expected each axis in 1..${MAX_SOURCE_REPLAY_RASTER_EXTENT} and total area in 1..${MAX_SOURCE_REPLAY_PAGE_PIXELS} before canvas allocation.`,
    );
  }
  const pageHeightPt = viewportHeight / scale;
  const sourceBoxPx: ReplayBounds = {
    left: Math.round(box.minXPt * scale),
    top: Math.round((pageHeightPt - box.maxYPt) * scale),
    right: Math.round(box.maxXPt * scale),
    bottom: Math.round((pageHeightPt - box.minYPt) * scale),
  };
  const width = sourceBoxPx.right - sourceBoxPx.left + 1;
  const height = sourceBoxPx.bottom - sourceBoxPx.top + 1;
  const sourceBoxPixels = width * height;
  if (
    !Object.values(sourceBoxPx).every(Number.isSafeInteger) ||
    sourceBoxPx.left < 0 ||
    sourceBoxPx.top < 0 ||
    sourceBoxPx.right >= pageWidthPx ||
    sourceBoxPx.bottom >= pageHeightPx ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(sourceBoxPixels) ||
    sourceBoxPixels > MAX_SOURCE_REPLAY_BOX_PIXELS
  ) {
    throw new Error(
      `Independent source replay box ${JSON.stringify(sourceBoxPx)} is ${width}x${height}=${sourceBoxPixels} pixels on ${pageWidthPx}x${pageHeightPx}; expected an in-page box of 1..${MAX_SOURCE_REPLAY_BOX_PIXELS} pixels.`,
    );
  }
  const guard = 16 * scale;
  const clipRenderBoxPx: ReplayBounds = {
    left: Math.max(0, sourceBoxPx.left - guard),
    top: Math.max(0, sourceBoxPx.top - guard),
    right: Math.min(pageWidthPx - 1, sourceBoxPx.right + guard),
    bottom: Math.min(pageHeightPx - 1, sourceBoxPx.bottom + guard),
  };
  const clipWidth = clipRenderBoxPx.right - clipRenderBoxPx.left + 1;
  const clipHeight = clipRenderBoxPx.bottom - clipRenderBoxPx.top + 1;
  const clipRenderPixels = clipWidth * clipHeight;
  if (
    !Number.isSafeInteger(clipWidth) ||
    !Number.isSafeInteger(clipHeight) ||
    !Number.isSafeInteger(clipRenderPixels) ||
    clipWidth < 1 ||
    clipHeight < 1 ||
    clipRenderPixels < 1 ||
    clipRenderPixels > MAX_SOURCE_REPLAY_BOX_PIXELS
  ) {
    throw new Error(
      `Independent guarded clip is ${clipWidth}x${clipHeight}=${clipRenderPixels} pixels; expected 1..${MAX_SOURCE_REPLAY_BOX_PIXELS} before canvas allocation.`,
    );
  }
  return {
    pageWidthPx,
    pageHeightPx,
    pagePixels,
    pageHeightPt,
    sourceBoxPx,
    width,
    height,
    sourceBoxPixels,
    clipRenderBoxPx,
    clipWidth,
    clipHeight,
    clipRenderPixels,
  };
}
