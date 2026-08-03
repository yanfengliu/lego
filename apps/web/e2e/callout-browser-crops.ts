import type {
  BrowserCrop,
  BrowserResult,
  CalloutTarget,
  CropStrategy,
  PixelBounds,
} from "./callout-types";

export interface BrowserCropInput {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly pageNumber: number;
  readonly targets: readonly CalloutTarget[];
}

/** Self-contained because Playwright serializes this function into the page. */
export async function renderCalloutCrops(input: BrowserCropInput): Promise<BrowserResult[]> {
  const pdfjs = await import(/* @vite-ignore */ input.pdfjsUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = input.workerUrl;
  const data = new Uint8Array(await (await fetch(input.pdfUrl)).arrayBuffer());
  const documentHandle = await pdfjs.getDocument({ data }).promise;
  try {
    const pdfPage = await documentHandle.getPage(input.pageNumber);
    const scale = 8;
    const viewport = pdfPage.getViewport({ scale });
    document.querySelectorAll("canvas.callout-probe").forEach((node) => node.remove());
    const canvas = document.createElement("canvas");
    canvas.className = "callout-probe";
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    document.body.append(canvas);
    const context = canvas.getContext("2d")!;
    await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const textContent = await pdfPage.getTextContent();

    const clampBounds = (bounds: PixelBounds): PixelBounds => ({
      left: Math.max(0, Math.min(canvas.width - 1, bounds.left)),
      top: Math.max(0, Math.min(canvas.height - 1, bounds.top)),
      right: Math.max(0, Math.min(canvas.width - 1, bounds.right)),
      bottom: Math.max(0, Math.min(canvas.height - 1, bounds.bottom)),
    });
    const textMasks: PixelBounds[] = textContent.items.flatMap((raw: unknown) => {
      const item = raw as { width?: unknown; height?: unknown; transform?: unknown };
      if (!Array.isArray(item.transform) || item.transform.length < 6) return [];
      const transform = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.max(
        1,
        Math.ceil(
          Math.hypot(transform[2] ?? 0, transform[3] ?? 0) ||
            (typeof item.height === "number" ? item.height * scale : 0),
        ),
      );
      const width = Math.max(
        1,
        Math.ceil(typeof item.width === "number" ? Math.abs(item.width * scale) : height),
      );
      const originX = Number(transform[4] ?? 0);
      const baselineY = Number(transform[5] ?? 0);
      return [
        clampBounds({
          left: Math.floor(originX) - 1,
          top: Math.floor(baselineY - height) - 1,
          right: Math.ceil(originX + width) + 1,
          bottom: Math.ceil(baselineY) + 1,
        }),
      ];
    });
    const inside = (bounds: PixelBounds, x: number, y: number): boolean =>
      x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    const inAnyText = (x: number, y: number): boolean =>
      textMasks.some((bounds) => inside(bounds, x, y));
    const colourAt = (x: number, y: number): [number, number, number] => {
      const at = (y * canvas.width + x) * 4;
      return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
    };
    const backgroundFor = (box: PixelBounds): [number, number, number] => {
      const tally = new Map<string, number>();
      const stepX = Math.max(1, Math.floor((box.right - box.left) / 60));
      const stepY = Math.max(1, Math.floor((box.bottom - box.top) / 60));
      for (let y = box.top; y <= box.bottom; y += stepY) {
        for (let x = box.left; x <= box.right; x += stepX) {
          const [red, green, blue] = colourAt(x, y);
          const key = `${red >> 3},${green >> 3},${blue >> 3}`;
          tally.set(key, (tally.get(key) ?? 0) + 1);
        }
      }
      const commonest = [...tally].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "31,31,31";
      return commonest.split(",").map((channel) => (Number(channel) << 3) + 4) as [
        number,
        number,
        number,
      ];
    };
    const differs = (
      x: number,
      y: number,
      background: readonly [number, number, number],
      maskText: boolean,
    ): boolean => {
      if (maskText && inAnyText(x, y)) return false;
      const [red, green, blue] = colourAt(x, y);
      return (
        Math.abs(red - background[0]) +
          Math.abs(green - background[1]) +
          Math.abs(blue - background[2]) >
        30
      );
    };

    type Blob = {
      left: number;
      top: number;
      right: number;
      bottom: number;
      size: number;
      filled: Set<number>;
      overflowed: boolean;
    };
    const floodFrom = (
      seedX: number,
      seedY: number,
      background: readonly [number, number, number],
      limit: PixelBounds,
      maskText: boolean,
    ): Blob | null => {
      const seen = new Set<number>();
      const filled = new Set<number>();
      const stack = [seedY * canvas.width + seedX];
      let left = seedX;
      let right = seedX;
      let top = seedY;
      let bottom = seedY;
      const budget = 4_000_000;
      while (stack.length > 0 && filled.size < budget) {
        const at = stack.pop()!;
        if (seen.has(at)) continue;
        seen.add(at);
        const x = at % canvas.width;
        const y = (at - x) / canvas.width;
        if (!inside(limit, x, y) || !differs(x, y, background, maskText)) continue;
        filled.add(at);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        if (x > limit.left) stack.push(at - 1);
        if (x < limit.right) stack.push(at + 1);
        if (y > limit.top) stack.push(at - canvas.width);
        if (y < limit.bottom) stack.push(at + canvas.width);
      }
      return filled.size === 0
        ? null
        : { left, top, right, bottom, size: filled.size, filled, overflowed: stack.length > 0 };
    };
    const validBlob = (blob: Blob | null, minimum: number, density = 0.08): blob is Blob => {
      if (!blob || blob.size < minimum || blob.overflowed) return false;
      const blobArea = (blob.right - blob.left + 1) * (blob.bottom - blob.top + 1);
      return blobArea >= 16 * 16 && blob.size / blobArea >= density;
    };

    const componentCrop = (
      blob: Blob,
      box: PixelBounds,
      background: readonly [number, number, number],
      strategy: CropStrategy,
      quantityMask: PixelBounds,
    ): BrowserCrop => {
      const contamination: string[] = [];
      const boundaryMargin = Math.max(2, Math.round(scale * 0.25));
      if (
        blob.left <= box.left + boundaryMargin ||
        blob.right >= box.right - boundaryMargin ||
        blob.top <= box.top + boundaryMargin ||
        blob.bottom >= box.bottom - boundaryMargin
      )
        contamination.push("touches-cell-boundary");
      let sourceTextGlyphPixels = 0;
      let sourceQuantityGlyphPixels = 0;
      for (const pixel of blob.filled) {
        const x = pixel % canvas.width;
        const y = (pixel - x) / canvas.width;
        if (inAnyText(x, y)) sourceTextGlyphPixels += 1;
        if (inside(quantityMask, x, y)) sourceQuantityGlyphPixels += 1;
      }
      if (sourceTextGlyphPixels > Math.max(16, blob.size * 0.25))
        contamination.push("contains-pdf-text-glyph");
      if (sourceQuantityGlyphPixels > Math.max(16, blob.size * 0.25))
        contamination.push("contains-quantity-glyph");
      if (blob.overflowed) contamination.push("flood-budget-exhausted");

      const pad = Math.round(0.6 * scale);
      const cropRectPx = clampBounds({
        left: blob.left - pad,
        top: blob.top - pad,
        right: blob.right + pad,
        bottom: blob.bottom + pad,
      });
      const width = cropRectPx.right - cropRectPx.left + 1;
      const height = cropRectPx.bottom - cropRectPx.top + 1;
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const cellContext = cell.getContext("2d")!;
      const image = cellContext.createImageData(width, height);
      let foregroundPixels = 0;
      let foregroundLeft = width;
      let foregroundTop = height;
      let foregroundRight = -1;
      let foregroundBottom = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const sourceX = cropRectPx.left + x;
          const sourceY = cropRectPx.top + y;
          const from = (sourceY * canvas.width + sourceX) * 4;
          const to = (y * width + x) * 4;
          const keep =
            blob.filled.has(sourceY * canvas.width + sourceX) && !inAnyText(sourceX, sourceY);
          if (keep) {
            foregroundPixels += 1;
            foregroundLeft = Math.min(foregroundLeft, x);
            foregroundTop = Math.min(foregroundTop, y);
            foregroundRight = Math.max(foregroundRight, x);
            foregroundBottom = Math.max(foregroundBottom, y);
          }
          image.data[to] = keep ? pixels[from]! : background[0];
          image.data[to + 1] = keep ? pixels[from + 1]! : background[1];
          image.data[to + 2] = keep ? pixels[from + 2]! : background[2];
          image.data[to + 3] = 255;
        }
      }
      cellContext.putImageData(image, 0, 0);
      return {
        url: cell.toDataURL("image/png"),
        widthPx: width,
        heightPx: height,
        strategy,
        evidenceKind: "part-art",
        regionKind: "isolated-component",
        masksApplied: ["all-pdf-text"],
        contamination,
        foregroundPixels,
        sourceTextGlyphPixels,
        sourceQuantityGlyphPixels,
        textGlyphOverlapPixels: 0,
        quantityGlyphOverlapPixels: 0,
        quantityGlyphPixelsMasked: sourceQuantityGlyphPixels,
        cropRectPx,
        boundaryClearancePx:
          foregroundPixels === 0
            ? { left: 0, top: 0, right: 0, bottom: 0 }
            : {
                left: foregroundLeft,
                top: foregroundTop,
                right: width - 1 - foregroundRight,
                bottom: height - 1 - foregroundBottom,
              },
      };
    };

    const semanticCrop = (
      target: CalloutTarget,
      box: PixelBounds,
      background: readonly [number, number, number],
      quantityMask: PixelBounds,
    ): BrowserCrop | null => {
      const inset = Math.round(2 * scale);
      const actionPadding = Math.round(16 * scale);
      const region =
        target.regionKind === "panel-neighbor-action"
          ? {
              left: box.left + Math.max(inset, Math.round((box.right - box.left) * 0.08)),
              right: box.right - inset,
              top: box.top - actionPadding,
              bottom: Math.min(box.bottom - inset, quantityMask.bottom + actionPadding),
            }
          : {
              left: box.left + inset,
              right: box.right - inset,
              top: box.top + inset,
              bottom: box.bottom - inset,
            };
      const cropRectPx = clampBounds(region);
      const width = cropRectPx.right - cropRectPx.left + 1;
      const height = cropRectPx.bottom - cropRectPx.top + 1;
      if (width < 16 || height < 16) return null;
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const cellContext = cell.getContext("2d")!;
      cellContext.drawImage(
        canvas,
        cropRectPx.left,
        cropRectPx.top,
        width,
        height,
        0,
        0,
        width,
        height,
      );
      let sourceTextGlyphPixels = 0;
      let sourceQuantityGlyphPixels = 0;
      let foregroundPixels = 0;
      let textGlyphOverlapPixels = 0;
      let foregroundLeft = width;
      let foregroundTop = height;
      let foregroundRight = -1;
      let foregroundBottom = -1;
      for (let y = cropRectPx.top; y <= cropRectPx.bottom; y += 1) {
        for (let x = cropRectPx.left; x <= cropRectPx.right; x += 1) {
          if (!differs(x, y, background, false)) continue;
          const text = inAnyText(x, y);
          const quantity = inside(quantityMask, x, y);
          if (text) sourceTextGlyphPixels += 1;
          if (quantity) sourceQuantityGlyphPixels += 1;
          else {
            foregroundPixels += 1;
            if (text) textGlyphOverlapPixels += 1;
            const relativeX = x - cropRectPx.left;
            const relativeY = y - cropRectPx.top;
            foregroundLeft = Math.min(foregroundLeft, relativeX);
            foregroundTop = Math.min(foregroundTop, relativeY);
            foregroundRight = Math.max(foregroundRight, relativeX);
            foregroundBottom = Math.max(foregroundBottom, relativeY);
          }
        }
      }
      const maskLeft = Math.max(0, quantityMask.left - cropRectPx.left);
      const maskTop = Math.max(0, quantityMask.top - cropRectPx.top);
      const maskRight = Math.min(width, quantityMask.right - cropRectPx.left + 1);
      const maskBottom = Math.min(height, quantityMask.bottom - cropRectPx.top + 1);
      if (maskRight > maskLeft && maskBottom > maskTop) {
        cellContext.fillStyle = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
        cellContext.fillRect(maskLeft, maskTop, maskRight - maskLeft, maskBottom - maskTop);
      }
      const contamination: string[] = [];
      if (sourceQuantityGlyphPixels === 0) contamination.push("quantity-mask-empty");
      if (foregroundPixels === 0) contamination.push("action-region-empty");
      return {
        url: cell.toDataURL("image/png"),
        widthPx: width,
        heightPx: height,
        strategy: "semantic-action-region",
        evidenceKind: target.evidenceKind,
        regionKind: target.regionKind,
        masksApplied: ["quantity-label"],
        contamination,
        foregroundPixels,
        sourceTextGlyphPixels,
        sourceQuantityGlyphPixels,
        textGlyphOverlapPixels,
        quantityGlyphOverlapPixels: 0,
        quantityGlyphPixelsMasked: sourceQuantityGlyphPixels,
        cropRectPx,
        boundaryClearancePx:
          foregroundPixels === 0
            ? { left: 0, top: 0, right: 0, bottom: 0 }
            : {
                left: foregroundLeft,
                top: foregroundTop,
                right: width - 1 - foregroundRight,
                bottom: height - 1 - foregroundBottom,
              },
      };
    };

    const output: BrowserResult[] = [];
    const pageHeightPt = viewport.height / scale;
    for (const target of input.targets) {
      const box = clampBounds({
        left: Math.round(target.box.minXPt * scale),
        right: Math.round(target.box.maxXPt * scale),
        top: Math.round((pageHeightPt - target.box.maxYPt) * scale),
        bottom: Math.round((pageHeightPt - target.box.minYPt) * scale),
      });
      const background = backgroundFor(box);
      const rasterY = pageHeightPt - target.yPt;
      const labelTop = Math.round((rasterY - 9) * scale);
      const rasterX = Math.round(target.xPt * scale);
      const quantityMask = clampBounds({
        left: Math.round((target.xPt - 2) * scale),
        right: Math.round((target.xPt + target.heightPt * 2) * scale),
        top: Math.round((rasterY - target.heightPt - 2) * scale),
        bottom: Math.round((rasterY + 2) * scale),
      });
      const firstSeed = (minimum: number, broad: boolean, maskText: boolean): Blob | null => {
        const left = broad ? box.left : Math.max(box.left, rasterX - Math.round(10 * scale));
        const right = broad ? box.right : Math.min(box.right, rasterX + Math.round(96 * scale));
        const top = broad ? box.top : Math.max(box.top, labelTop - Math.round(52 * scale));
        for (let y = Math.min(labelTop, box.bottom); y >= top; y -= 1) {
          for (let x = left; x <= right; x += 1) {
            if (!differs(x, y, background, maskText)) continue;
            const found = floodFrom(x, y, background, box, maskText);
            if (validBlob(found, minimum)) return found;
          }
        }
        return null;
      };
      const componentCandidates = (minimum: number): { blob: Blob; score: number }[] => {
        const visited = new Set<number>();
        const candidates: { blob: Blob; score: number }[] = [];
        for (let y = Math.min(labelTop, box.bottom); y >= box.top; y -= 1) {
          for (let x = box.left; x <= box.right; x += 1) {
            const at = y * canvas.width + x;
            if (visited.has(at) || !differs(x, y, background, true)) continue;
            const found = floodFrom(x, y, background, box, true);
            if (!found) continue;
            for (const pixel of found.filled) visited.add(pixel);
            const touchesBoundary =
              found.left <= box.left + 2 ||
              found.right >= box.right - 2 ||
              found.top <= box.top + 2 ||
              found.bottom >= box.bottom - 2;
            if (!validBlob(found, minimum, 0.015) || touchesBoundary) continue;
            const horizontalGap =
              rasterX < found.left
                ? found.left - rasterX
                : rasterX > found.right
                  ? rasterX - found.right
                  : 0;
            const verticalGap = Math.max(0, labelTop - found.bottom);
            const centreBias = Math.abs((found.left + found.right) / 2 - rasterX) * 0.1;
            candidates.push({ blob: found, score: verticalGap * 1.5 + horizontalGap + centreBias });
          }
        }
        return candidates;
      };
      const legacyBlob =
        target.boxMethod === "vector-smallest" ? firstSeed(90 * scale * scale, false, false) : null;
      const legacy = legacyBlob
        ? componentCrop(legacyBlob, box, background, "legacy-seed", quantityMask)
        : null;
      const needsRecovery =
        legacy === null || legacy.contamination.length > 0 || target.evidenceKind !== "part-art";
      const adaptiveBlob = needsRecovery ? firstSeed(scale * scale, true, true) : null;
      const rankedBlob = needsRecovery
        ? componentCandidates(scale * scale).sort((left, right) => left.score - right.score)[0]
            ?.blob
        : undefined;
      output.push({
        identity: target.identity,
        targetEvidenceKind: target.evidenceKind,
        legacy,
        adaptive: adaptiveBlob
          ? componentCrop(adaptiveBlob, box, background, "adaptive-seed", quantityMask)
          : null,
        ranked: rankedBlob
          ? componentCrop(rankedBlob, box, background, "ranked-component", quantityMask)
          : null,
        action:
          target.evidenceKind === "part-art"
            ? null
            : semanticCrop(target, box, background, quantityMask),
      });
    }
    return output;
  } finally {
    await documentHandle.destroy();
  }
}
