import {
  MAX_SOURCE_REPLAY_BOX_PIXELS,
  replayComponentGroupDigest,
  replaySha256,
  type ReplayBounds,
} from "./callout-source-replay-digest";
import { boundedReplayRaster } from "./callout-source-replay-bounds";
import {
  MAX_SOURCE_REPLAY_RAW_COMPONENTS,
  singletonContainedComponentGroups,
} from "./callout-source-replay-coalescing";
import { fetchBoundedReplayPdf } from "./callout-source-replay-fetch";
import {
  assertBoundedReplayTextItems,
  buildBoundedReplayTextMask,
} from "./callout-source-replay-text";
import type { SourceReplayInput, SourceReplayResult } from "./callout-source-replay-types";

type Bounds = ReplayBounds;

interface Blob extends Bounds {
  readonly size: number;
  readonly filled: ReadonlySet<number>;
  readonly overflowed: boolean;
}

interface TextWitness {
  readonly str: string;
  readonly transformPt: readonly [number, number];
  readonly bounds: Bounds;
}

export async function replayStepSourceComponents(
  input: SourceReplayInput,
): Promise<SourceReplayResult> {
  if (!Array.isArray(input.targets) || input.targets.length !== 2) {
    const targetCount = Array.isArray(input.targets) ? input.targets.length : "non-array";
    throw new Error(
      `Independent source replay received ${targetCount} targets; this bounded proof requires exactly 2 before imports, fetches, or raster work.`,
    );
  }
  const pdfjs = await import(/* @vite-ignore */ input.pdfjsUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = input.workerUrl;
  const pdfBytes = await fetchBoundedReplayPdf(input.pdfUrl, input.expectedPdfBytes);
  const observedPdfSha256 = await replaySha256(pdfBytes);
  if (observedPdfSha256 !== input.expectedPdfSha256) {
    throw new Error(
      `Independent source replay fetched PDF ${observedPdfSha256}, not exact source ${input.expectedPdfSha256}.`,
    );
  }
  const documentHandle = await pdfjs.getDocument({ data: pdfBytes }).promise;
  try {
    const page = await documentHandle.getPage(input.pageNumber);
    const viewport = page.getViewport({ scale: input.scale });
    const {
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
    } = boundedReplayRaster(viewport.width, viewport.height, input.scale, input.box);
    const clipCanvas = document.createElement("canvas");
    clipCanvas.width = clipWidth;
    clipCanvas.height = clipHeight;
    const clipContext = clipCanvas.getContext("2d")!;
    await page.render({
      canvasContext: clipContext,
      viewport,
      transform: [1, 0, 0, 1, -clipRenderBoxPx.left, -clipRenderBoxPx.top],
      background: "#ffffff",
    }).promise;
    const clipped = clipContext.getImageData(
      sourceBoxPx.left - clipRenderBoxPx.left,
      sourceBoxPx.top - clipRenderBoxPx.top,
      width,
      height,
    ).data;

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = pageWidthPx;
    fullCanvas.height = pageHeightPx;
    const fullContext = fullCanvas.getContext("2d")!;
    await page.render({ canvasContext: fullContext, viewport, background: "#ffffff" }).promise;
    const fullSlice = fullContext.getImageData(
      sourceBoxPx.left,
      sourceBoxPx.top,
      width,
      height,
    ).data;
    let firstMismatch = -1;
    let mismatchedBytes = 0;
    let mismatchedPixels = 0;
    let previousMismatchPixel = -1;
    let maximumChannelDelta = 0;
    const mismatchedAbsolutePixels = new Set<number>();
    let mismatchBoundsPx: Bounds = {
      left: pageWidthPx,
      top: pageHeightPx,
      right: -1,
      bottom: -1,
    };
    for (let index = 0; index < clipped.length; index += 1) {
      if (clipped[index] !== fullSlice[index]) {
        if (firstMismatch < 0) firstMismatch = index;
        mismatchedBytes += 1;
        const pixel = Math.floor(index / 4);
        if (pixel !== previousMismatchPixel) {
          mismatchedPixels += 1;
          const x = sourceBoxPx.left + (pixel % width);
          const y = sourceBoxPx.top + Math.floor(pixel / width);
          mismatchedAbsolutePixels.add(y * pageWidthPx + x);
          mismatchBoundsPx = {
            left: Math.min(mismatchBoundsPx.left, x),
            top: Math.min(mismatchBoundsPx.top, y),
            right: Math.max(mismatchBoundsPx.right, x),
            bottom: Math.max(mismatchBoundsPx.bottom, y),
          };
        }
        previousMismatchPixel = pixel;
        maximumChannelDelta = Math.max(
          maximumChannelDelta,
          Math.abs(clipped[index]! - fullSlice[index]!),
        );
      }
    }
    const [clippedRgbaSha256, fullPageSliceRgbaSha256] = await Promise.all([
      replaySha256(clipped),
      replaySha256(fullSlice),
    ]);
    const firstPixel = firstMismatch < 0 ? -1 : Math.floor(firstMismatch / 4);
    const rgbaMismatch =
      firstMismatch < 0 && clipped.length === fullSlice.length
        ? null
        : {
            mismatchedBytes,
            mismatchedPixels,
            maximumChannelDelta,
            firstByte: firstMismatch,
            firstPixel,
            absoluteX: firstPixel < 0 ? -1 : sourceBoxPx.left + (firstPixel % width),
            absoluteY: firstPixel < 0 ? -1 : sourceBoxPx.top + Math.floor(firstPixel / width),
            channel: firstMismatch < 0 ? -1 : firstMismatch % 4,
            clippedValue: firstMismatch < 0 ? -1 : clipped[firstMismatch]!,
            fullPageValue: firstMismatch < 0 ? -1 : fullSlice[firstMismatch]!,
            mismatchBoundsPx,
          };

    const textContent = await page.getTextContent();
    assertBoundedReplayTextItems(textContent.items);
    const clamp = (bounds: Bounds): Bounds => ({
      left: Math.max(0, Math.min(pageWidthPx - 1, bounds.left)),
      top: Math.max(0, Math.min(pageHeightPx - 1, bounds.top)),
      right: Math.max(0, Math.min(pageWidthPx - 1, bounds.right)),
      bottom: Math.max(0, Math.min(pageHeightPx - 1, bounds.bottom)),
    });
    const textItems: TextWitness[] = textContent.items.flatMap((raw: unknown) => {
      const item = raw as {
        str?: unknown;
        width?: unknown;
        height?: unknown;
        transform?: unknown;
      };
      if (typeof item.str !== "string" || !Array.isArray(item.transform)) return [];
      const transformed = pdfjs.Util.transform(viewport.transform, item.transform);
      const textHeight = Math.max(
        1,
        Math.ceil(
          Math.hypot(transformed[2] ?? 0, transformed[3] ?? 0) ||
            (typeof item.height === "number" ? item.height * input.scale : 0),
        ),
      );
      const textWidth = Math.max(
        1,
        Math.ceil(typeof item.width === "number" ? Math.abs(item.width * input.scale) : textHeight),
      );
      const originX = Number(transformed[4] ?? 0);
      const baselineY = Number(transformed[5] ?? 0);
      return [
        {
          str: item.str,
          transformPt: [Number(item.transform[4]), Number(item.transform[5])] as const,
          bounds: clamp({
            left: Math.floor(originX) - 1,
            top: Math.floor(baselineY - textHeight) - 1,
            right: Math.ceil(originX + textWidth) + 1,
            bottom: Math.ceil(baselineY) + 1,
          }),
        },
      ];
    });
    const labels = input.targets.map((target) => {
      const exact = textItems.find(
        (item) =>
          item.str === target.expectedLabel &&
          Math.abs(item.transformPt[0] - target.xPt) < 0.001 &&
          Math.abs(item.transformPt[1] - target.yPt) < 0.001,
      );
      if (!exact) {
        const nearby = textItems
          .filter((item) => Math.abs(item.transformPt[1] - target.yPt) < 2)
          .map((item) => `${JSON.stringify(item.str)}@${item.transformPt.join(",")}`)
          .join("; ");
        throw new Error(
          `Independent target ${target.key} did not match PDF text ${JSON.stringify(target.expectedLabel)} at ${target.xPt},${target.yPt}; nearby: ${nearby || "none"}.`,
        );
      }
      return exact;
    });

    const textMask = buildBoundedReplayTextMask({
      sourceBoxPx,
      width,
      height,
      textBounds: textItems.map(({ bounds }) => bounds),
    });
    const pixelOffset = (x: number, y: number): number =>
      ((y - sourceBoxPx.top) * width + x - sourceBoxPx.left) * 4;
    const inText = (x: number, y: number): boolean =>
      textMask[(y - sourceBoxPx.top) * width + x - sourceBoxPx.left] === 1;
    const colourAt = (x: number, y: number): readonly [number, number, number] => {
      const at = pixelOffset(x, y);
      return [clipped[at]!, clipped[at + 1]!, clipped[at + 2]!];
    };
    const tally = new Map<string, number>();
    const stepX = Math.max(1, Math.floor((sourceBoxPx.right - sourceBoxPx.left) / 60));
    const stepY = Math.max(1, Math.floor((sourceBoxPx.bottom - sourceBoxPx.top) / 60));
    for (let y = sourceBoxPx.top; y <= sourceBoxPx.bottom; y += stepY) {
      for (let x = sourceBoxPx.left; x <= sourceBoxPx.right; x += stepX) {
        const [red, green, blue] = colourAt(x, y);
        const key = `${red >> 3},${green >> 3},${blue >> 3}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
    }
    const commonest = [...tally].sort((left, right) => right[1] - left[1])[0]?.[0];
    if (!commonest) throw new Error("Independent source replay found no background samples.");
    const background = commonest.split(",").map((channel) => (Number(channel) << 3) + 4) as [
      number,
      number,
      number,
    ];
    const differs = (x: number, y: number): boolean => {
      if (inText(x, y)) return false;
      const [red, green, blue] = colourAt(x, y);
      return (
        Math.abs(red - background[0]) +
          Math.abs(green - background[1]) +
          Math.abs(blue - background[2]) >
        30
      );
    };
    const flood = (seedX: number, seedY: number): Blob | null => {
      const seen = new Set<number>();
      const filled = new Set<number>();
      const stack = [seedY * pageWidthPx + seedX];
      let left = seedX;
      let top = seedY;
      let right = seedX;
      let bottom = seedY;
      while (stack.length > 0 && filled.size < MAX_SOURCE_REPLAY_BOX_PIXELS) {
        const at = stack.pop()!;
        if (seen.has(at)) continue;
        seen.add(at);
        const x = at % pageWidthPx;
        const y = (at - x) / pageWidthPx;
        if (
          x < sourceBoxPx.left ||
          x > sourceBoxPx.right ||
          y < sourceBoxPx.top ||
          y > sourceBoxPx.bottom ||
          !differs(x, y)
        )
          continue;
        filled.add(at);
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        if (x > sourceBoxPx.left) stack.push(at - 1);
        if (x < sourceBoxPx.right) stack.push(at + 1);
        if (y > sourceBoxPx.top) stack.push(at - pageWidthPx);
        if (y < sourceBoxPx.bottom) stack.push(at + pageWidthPx);
      }
      return filled.size === 0
        ? null
        : { left, top, right, bottom, size: filled.size, filled, overflowed: stack.length > 0 };
    };
    const visited = new Set<number>();
    const rawBlobs: Blob[] = [];
    enumerateRawComponents: for (let y = sourceBoxPx.bottom; y >= sourceBoxPx.top; y -= 1) {
      for (let x = sourceBoxPx.left; x <= sourceBoxPx.right; x += 1) {
        const at = y * pageWidthPx + x;
        if (visited.has(at) || !differs(x, y)) continue;
        const blob = flood(x, y);
        if (!blob) continue;
        for (const pixel of blob.filled) visited.add(pixel);
        const area = (blob.right - blob.left + 1) * (blob.bottom - blob.top + 1);
        const valid =
          !blob.overflowed &&
          blob.size >= input.scale * input.scale &&
          area >= 16 * 16 &&
          blob.size / area >= 0.015 &&
          blob.left > sourceBoxPx.left + 2 &&
          blob.right < sourceBoxPx.right - 2 &&
          blob.top > sourceBoxPx.top + 2 &&
          blob.bottom < sourceBoxPx.bottom - 2;
        if (valid) {
          rawBlobs.push(blob);
          if (rawBlobs.length === MAX_SOURCE_REPLAY_RAW_COMPONENTS + 1)
            break enumerateRawComponents;
        }
      }
    }
    const anchors = input.targets.map((target) => ({
      key: target.key,
      rasterX: Math.round(target.xPt * input.scale),
      labelTop: Math.round((pageHeightPt - target.yPt - 9) * input.scale),
      maximumHorizontalGap: Math.round(target.heightPt * input.scale),
    }));
    const groups = singletonContainedComponentGroups(anchors, rawBlobs);
    const blobs: (Blob & { readonly sourceMembers: number })[] = groups.map((group) => {
      const members = group.map((index) => rawBlobs[index]!);
      const filled = new Set<number>();
      for (const member of members) for (const pixel of member.filled) filled.add(pixel);
      return {
        left: Math.min(...members.map(({ left }) => left)),
        top: Math.min(...members.map(({ top }) => top)),
        right: Math.max(...members.map(({ right }) => right)),
        bottom: Math.max(...members.map(({ bottom }) => bottom)),
        size: filled.size,
        filled,
        overflowed: false,
        sourceMembers: members.length,
      };
    });

    const candidates: { readonly cost: number; readonly columns: readonly number[] }[] = [];
    const choose = (
      row: number,
      used: ReadonlySet<number>,
      columns: readonly number[],
      cost: number,
    ) => {
      if (row === input.targets.length) {
        candidates.push({ cost, columns });
        return;
      }
      const target = input.targets[row]!;
      const rasterX = Math.round(target.xPt * input.scale);
      const labelTop = Math.round((pageHeightPt - target.yPt - 9) * input.scale);
      const maximumHorizontalGap = Math.round(target.heightPt * input.scale);
      for (let column = 0; column < blobs.length; column += 1) {
        if (used.has(column)) continue;
        const blob = blobs[column]!;
        const gap =
          rasterX < blob.left
            ? blob.left - rasterX
            : rasterX > blob.right
              ? rasterX - blob.right
              : 0;
        if (gap > maximumHorizontalGap || blob.top > labelTop) continue;
        choose(
          row + 1,
          new Set([...used, column]),
          [...columns, column],
          cost + Math.abs(blob.left - rasterX) * 100 + Math.abs(blob.bottom - labelTop),
        );
      }
    };
    choose(0, new Set(), [], 0);
    candidates.sort((left, right) => left.cost - right.cost);
    if (
      candidates.length === 0 ||
      (candidates[1] && Math.abs(candidates[1].cost - candidates[0]!.cost) < 1e-9)
    ) {
      throw new Error(
        `Independent source replay could not make a unique one-to-one assignment from ${blobs.length} components (${candidates.length} feasible assignments).`,
      );
    }

    const components = await Promise.all(
      input.targets.map(async (target, row) => {
        const blob = blobs[candidates[0]!.columns[row]!]!;
        const records = new Uint32Array(blob.size * 2);
        let record = 0;
        for (let y = blob.top; y <= blob.bottom; y += 1) {
          for (let x = blob.left; x <= blob.right; x += 1) {
            const absolutePixel = y * pageWidthPx + x;
            if (!blob.filled.has(absolutePixel)) continue;
            const from = pixelOffset(x, y);
            records[record] = absolutePixel;
            records[record + 1] =
              ((clipped[from]! << 24) |
                (clipped[from + 1]! << 16) |
                (clipped[from + 2]! << 8) |
                clipped[from + 3]!) >>>
              0;
            record += 2;
          }
        }
        const boundsPx = {
          left: blob.left,
          top: blob.top,
          right: blob.right,
          bottom: blob.bottom,
        };
        return {
          targetKey: target.key,
          label: labels[row]!.str,
          labelTransformPt: labels[row]!.transformPt,
          boundsPx,
          foregroundPixels: blob.size,
          recordBytes: records.byteLength,
          coalescedRawComponents: blob.sourceMembers,
          rgbaMismatchedPixelsInComponent: [...blob.filled].filter((pixel) =>
            mismatchedAbsolutePixels.has(pixel),
          ).length,
          absoluteForegroundSha256: await replayComponentGroupDigest(
            input.pageNumber,
            input.scale,
            pageWidthPx,
            pageHeightPx,
            boundsPx,
            blob.sourceMembers,
            records,
          ),
        };
      }),
    );
    page.cleanup();
    return {
      observedPdfSha256,
      pageNumber: input.pageNumber,
      scale: input.scale,
      pageWidthPx,
      pageHeightPx,
      pagePixels,
      sourceBoxPx,
      sourceBoxPixels,
      clipRenderBoxPx,
      clipRenderPixels,
      rawComponentCount: rawBlobs.length,
      coalescedComponentCount: blobs.length,
      sourceBoxRgbaBytes: clipped.byteLength,
      clippedRgbaSha256,
      fullPageSliceRgbaSha256,
      exactRgbaParity: rgbaMismatch === null,
      rgbaMismatch,
      components,
    };
  } finally {
    await documentHandle.destroy();
  }
}
