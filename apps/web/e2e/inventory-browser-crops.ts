import type { PixelBounds, PixelClearance } from "./gallery-crop-contract";

/**
 * The pixel half of the inventory gallery, and only the pixel half.
 *
 * Both functions here are serialised into the page by Playwright, so neither
 * can import anything and neither decides anything: the page is rasterised and
 * labelled into connected components here, while scoring, assignment and the
 * contamination verdict stay in `gallery-crop-contract.ts` where they are
 * ordinary tested Node code.
 *
 * The page is labelled once, not once per cell. The inventory is a gallery —
 * a component belongs to exactly one element — and the two bad crops this
 * replaces were both the same per-cell mistake: `383228`'s 2x8 plate overflows
 * its column, so a column-pitch rectangle cut its right end off, and the same
 * overflow sat inside `302028`'s rectangle one column over.
 */

/**
 * Bounds and thresholds arrive in the input rather than as module constants,
 * because Playwright serialises only the function body: a constant declared
 * beside it is simply not defined in the page.
 */
export const INVENTORY_PAGE_LIMITS = Object.freeze({
  maximumPagePixels: 40_000_000,
  maximumPageComponents: 200_000,
  /** Ink is a pixel this far from the page's own background in summed channels. */
  inkThreshold: 28,
});

export interface InventoryLabelAnchor {
  readonly elementId: string;
  readonly quantity: number;
  /** Where the element id is printed, in pdfjs text space, which grows upward. */
  readonly xPt: number;
  readonly yPt: number;
}

export interface InventoryPageComponent {
  readonly index: number;
  readonly leftPx: number;
  readonly topPx: number;
  readonly rightPx: number;
  readonly bottomPx: number;
  readonly pixels: number;
}

export interface InventoryLabelGeometry {
  readonly elementId: string;
  readonly labelXPx: number;
  readonly labelTopPx: number;
  /** The Nx box printed above this element id, or null when none was found. */
  readonly quantityMaskPx: PixelBounds | null;
}

export interface InventoryPageAnalysis {
  readonly pageNumber: number;
  /**
   * Identifies the exact raster the components were labelled on. Cropping
   * refuses a cache that does not carry the same one, so a second analysis at a
   * different scale or threshold cannot be cropped against an assignment made
   * from the first.
   */
  readonly rasterId: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Ink components before the part-picture threshold; the difference is dropped. */
  readonly componentsFound: number;
  readonly components: readonly InventoryPageComponent[];
  readonly labels: readonly InventoryLabelGeometry[];
}

export interface InventoryPageInput {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly pageNumber: number;
  readonly scale: number;
  /** Smallest component that can be a part picture rather than print noise. */
  readonly minimumComponentPixels: number;
  readonly limits: typeof INVENTORY_PAGE_LIMITS;
  readonly anchors: readonly InventoryLabelAnchor[];
}

export interface InventoryCropRequest {
  readonly elementId: string;
  readonly componentIndex: number;
  /** The component's own bounds, carried in so cropping never rescans the page. */
  readonly componentBoundsPx: PixelBounds;
  /** Its pixel count, recounted while cropping so a stale raster cannot pass. */
  readonly componentPixels: number;
  readonly padPx: number;
}

export interface InventoryCropResult {
  readonly elementId: string;
  readonly url: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly cropRectPx: PixelBounds;
  readonly foregroundPixels: number;
  readonly componentPixels: number;
  /** Other components whose ink falls inside the rectangle, largest first. */
  readonly rivalComponents: readonly { readonly index: number; readonly pixels: number }[];
  /** Ink inside this cell's own Nx box; zero means the label was never located. */
  readonly quantityGlyphInkPixels: number;
  /** How much of that label ink the rectangle covers and the isolation removed. */
  readonly quantityGlyphPixelsInCropRect: number;
  readonly sourceTextGlyphPixels: number;
  readonly touchesPageBoundary: boolean;
  readonly boundaryClearancePx: PixelClearance;
}

interface InventoryPageCache {
  readonly pageNumber: number;
  readonly rasterId: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly pixels: Uint8ClampedArray;
  /** 0 background, 1 ink outside any text box, 2 ink inside a text box. */
  readonly classification: Uint8Array;
  /** Component number per pixel, 1-based; 0 where the pixel is not part art. */
  readonly componentAt: Int32Array;
  readonly background: readonly [number, number, number];
  readonly labels: readonly InventoryLabelGeometry[];
}

declare global {
  var __legoInventoryPage: InventoryPageCache | undefined;
}

/** Rasterises one inventory page and labels its part pictures. Self-contained. */
export async function analyseInventoryPage(
  input: InventoryPageInput,
): Promise<InventoryPageAnalysis> {
  const pdfjs = await import(/* @vite-ignore */ input.pdfjsUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = input.workerUrl;
  const data = new Uint8Array(await (await fetch(input.pdfUrl)).arrayBuffer());
  const documentHandle = await pdfjs.getDocument({ data }).promise;
  try {
    const pdfPage = await documentHandle.getPage(input.pageNumber);
    const viewport = pdfPage.getViewport({ scale: input.scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    if (width * height > input.limits.maximumPagePixels) {
      throw new Error(
        `Inventory page ${input.pageNumber} rasterises to ${width}x${height} = ${width * height} pixels, ` +
          `over the ${input.limits.maximumPagePixels} bound. Lower the scale rather than raising the bound.`,
      );
    }
    document.querySelectorAll("canvas.inventory-probe").forEach((node) => node.remove());
    const canvas = document.createElement("canvas");
    canvas.className = "inventory-probe";
    canvas.width = width;
    canvas.height = height;
    document.body.append(canvas);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
    const pixels = context.getImageData(0, 0, width, height).data;
    const textContent = await pdfPage.getTextContent();

    const clamp = (bounds: PixelBounds): PixelBounds => ({
      left: Math.max(0, Math.min(width - 1, bounds.left)),
      top: Math.max(0, Math.min(height - 1, bounds.top)),
      right: Math.max(0, Math.min(width - 1, bounds.right)),
      bottom: Math.max(0, Math.min(height - 1, bounds.bottom)),
    });

    // Text boxes, in raster space. Painted into a mask rather than tested as a
    // list: a page holds hundreds of them and a per-pixel scan over a list is
    // hundreds of millions of comparisons.
    const textBoxes: { bounds: PixelBounds; text: string; xPt: number; baselineYPt: number }[] = [];
    for (const raw of textContent.items as unknown[]) {
      const item = raw as { str?: unknown; width?: unknown; height?: unknown; transform?: unknown };
      if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
      const transform = pdfjs.Util.transform(viewport.transform, item.transform);
      const glyphHeight = Math.max(
        1,
        Math.ceil(
          Math.hypot(transform[2] ?? 0, transform[3] ?? 0) ||
            (typeof item.height === "number" ? item.height * input.scale : 0),
        ),
      );
      const glyphWidth = Math.max(
        1,
        Math.ceil(
          typeof item.width === "number" ? Math.abs(item.width * input.scale) : glyphHeight,
        ),
      );
      const originX = Number(transform[4] ?? 0);
      const baselineY = Number(transform[5] ?? 0);
      textBoxes.push({
        bounds: clamp({
          left: Math.floor(originX) - 1,
          top: Math.floor(baselineY - glyphHeight) - 1,
          right: Math.ceil(originX + glyphWidth) + 1,
          bottom: Math.ceil(baselineY) + 1,
        }),
        text: typeof item.str === "string" ? item.str.trim() : "",
        xPt: Number(item.transform[4] ?? 0),
        baselineYPt: Number(item.transform[5] ?? 0),
      });
    }

    const classification = new Uint8Array(width * height);
    const background = ((): [number, number, number] => {
      const tally = new Map<string, number>();
      const stepX = Math.max(1, Math.floor(width / 200));
      const stepY = Math.max(1, Math.floor(height / 200));
      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const at = (y * width + x) * 4;
          tally.set(
            `${pixels[at]! >> 3},${pixels[at + 1]! >> 3},${pixels[at + 2]! >> 3}`,
            (tally.get(`${pixels[at]! >> 3},${pixels[at + 1]! >> 3},${pixels[at + 2]! >> 3}`) ??
              0) + 1,
          );
        }
      }
      const commonest = [...tally].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "31,31,31";
      return commonest.split(",").map((channel) => (Number(channel) << 3) + 4) as [
        number,
        number,
        number,
      ];
    })();

    for (let index = 0; index < width * height; index += 1) {
      const at = index * 4;
      const delta =
        Math.abs(pixels[at]! - background[0]) +
        Math.abs(pixels[at + 1]! - background[1]) +
        Math.abs(pixels[at + 2]! - background[2]);
      classification[index] = delta > input.limits.inkThreshold ? 1 : 0;
    }
    for (const box of textBoxes) {
      for (let y = box.bounds.top; y <= box.bounds.bottom; y += 1) {
        for (let x = box.bounds.left; x <= box.bounds.right; x += 1) {
          const index = y * width + x;
          if (classification[index] === 1) classification[index] = 2;
        }
      }
    }

    // Connected components over ink that is not text. Iterative, on typed
    // arrays: a Set-of-indices flood over a whole page is far too slow.
    //
    // A pixel is numbered before it is pushed, so it is pushed at most once and
    // the stack can never hold more than the page. There is therefore no flood
    // budget to exhaust here, unlike the per-cell floods the callout gallery
    // runs; the only real bound is how many components a page may hold.
    const componentAt = new Int32Array(width * height);
    const components: InventoryPageComponent[] = [];
    const stack = new Int32Array(width * height);
    for (let seed = 0; seed < width * height; seed += 1) {
      if (classification[seed] !== 1 || componentAt[seed] !== 0) continue;
      if (components.length >= input.limits.maximumPageComponents) {
        throw new Error(
          `Inventory page ${input.pageNumber} labelled more than ${input.limits.maximumPageComponents} ink components, ` +
            `which means the ink threshold is finding print noise rather than part pictures.`,
        );
      }
      const number = components.length + 1;
      componentAt[seed] = number;
      stack[0] = seed;
      let top = 1;
      let left = seed % width;
      let right = left;
      let upper = (seed - left) / width;
      let lower = upper;
      let size = 0;
      while (top > 0) {
        top -= 1;
        const at = stack[top]!;
        const x = at % width;
        const y = (at - x) / width;
        size += 1;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < upper) upper = y;
        if (y > lower) lower = y;
        const neighbours = [
          x > 0 ? at - 1 : -1,
          x < width - 1 ? at + 1 : -1,
          y > 0 ? at - width : -1,
          y < height - 1 ? at + width : -1,
        ];
        for (const neighbour of neighbours) {
          if (neighbour < 0 || classification[neighbour] !== 1 || componentAt[neighbour] !== 0)
            continue;
          componentAt[neighbour] = number;
          stack[top] = neighbour;
          top += 1;
        }
      }
      components.push({
        index: number,
        leftPx: left,
        topPx: upper,
        rightPx: right,
        bottomPx: lower,
        pixels: size,
      });
    }

    const pageHeightPt = height / input.scale;
    const labels: InventoryLabelGeometry[] = input.anchors.map((anchor) => {
      const rasterY = pageHeightPt - anchor.yPt;
      // The Nx belongs to the element id printed directly beneath it in the
      // same column: same reading as `parts-inventory.ts`, applied to the boxes
      // rather than to the text, so the glyph can be masked where it is drawn.
      const quantity = textBoxes
        .filter(
          (box) =>
            box.text === `${anchor.quantity}x` &&
            Math.abs(box.xPt - anchor.xPt) <= 0.6 &&
            box.baselineYPt - anchor.yPt >= 4 &&
            box.baselineYPt - anchor.yPt <= 11,
        )
        .sort((first, second) => first.baselineYPt - second.baselineYPt)[0];
      // The centre of the printed id, not its left edge. The score measures a
      // component's centre against this, so an edge biases every cell by half
      // the width of its id string in one direction — enough, on a denser
      // inventory, to walk a whole column one cell sideways with every margin
      // still comfortably positive and nothing reporting a thing.
      const identifier = textBoxes.find(
        (box) =>
          box.text === anchor.elementId &&
          Math.abs(box.xPt - anchor.xPt) <= 0.6 &&
          Math.abs(box.baselineYPt - anchor.yPt) <= 0.6,
      );
      return {
        elementId: anchor.elementId,
        labelXPx:
          identifier === undefined
            ? Math.round(anchor.xPt * input.scale)
            : Math.round((identifier.bounds.left + identifier.bounds.right) / 2),
        labelTopPx: Math.round((rasterY - 9) * input.scale),
        quantityMaskPx: quantity === undefined ? null : quantity.bounds,
      };
    });

    const rasterId =
      `p${input.pageNumber}s${input.scale}m${input.minimumComponentPixels}` +
      `i${input.limits.inkThreshold}w${width}h${height}c${components.length}`;
    globalThis.__legoInventoryPage = {
      pageNumber: input.pageNumber,
      rasterId,
      widthPx: width,
      heightPx: height,
      pixels,
      classification,
      componentAt,
      background,
      labels,
    };
    return {
      pageNumber: input.pageNumber,
      rasterId,
      widthPx: width,
      heightPx: height,
      componentsFound: components.length,
      components: components.filter(({ pixels: size }) => size >= input.minimumComponentPixels),
      labels,
    };
  } finally {
    await documentHandle.destroy();
  }
}

/**
 * Cuts the assigned component out of the page it was labelled on.
 *
 * Everything outside the component is painted to the page background, so the
 * published picture holds one part and nothing else — a neighbour that
 * overlaps the rectangle is measured and removed rather than shipped.
 * Self-contained.
 */
export function cropAssignedInventoryComponents(input: {
  readonly pageNumber: number;
  readonly rasterId: string;
  readonly requests: readonly InventoryCropRequest[];
}): readonly InventoryCropResult[] {
  const cache = globalThis.__legoInventoryPage;
  if (cache === undefined || cache.pageNumber !== input.pageNumber) {
    throw new Error(
      `No labelled raster is cached for inventory page ${input.pageNumber}; analyse the page in the same browser context before cropping it.`,
    );
  }
  // The cache is keyed on the page alone, and a page analysed twice at
  // different settings would pass that. The raster id carries the settings, so
  // an assignment made against one raster cannot be cropped from another.
  if (cache.rasterId !== input.rasterId) {
    throw new Error(
      `Inventory page ${input.pageNumber} is cached as raster ${cache.rasterId} but the assignment was ` +
        `made against ${input.rasterId}; the page was re-analysed with different settings between the two.`,
    );
  }
  const { widthPx, heightPx, pixels, classification, componentAt, background } = cache;
  const labelByElement = new Map(cache.labels.map((label) => [label.elementId, label]));

  return input.requests.map((request) => {
    // Bounds come from the labelling pass. Rediscovering them here would be a
    // whole-page scan per element, which at 276 elements is a page scanned 276
    // times over to learn something already measured once.
    const { left, top, right, bottom } = {
      left: request.componentBoundsPx.left,
      top: request.componentBoundsPx.top,
      right: request.componentBoundsPx.right,
      bottom: request.componentBoundsPx.bottom,
    };
    if (
      right < left ||
      bottom < top ||
      left < 0 ||
      top < 0 ||
      right >= widthPx ||
      bottom >= heightPx
    ) {
      throw new Error(
        `Inventory component ${request.componentIndex} for element ${request.elementId} carries bounds ` +
          `${left},${top},${right},${bottom} that do not lie inside the ${widthPx}x${heightPx} page ${input.pageNumber} raster.`,
      );
    }
    const touchesPageBoundary =
      left === 0 || top === 0 || right === widthPx - 1 || bottom === heightPx - 1;
    const cropRectPx: PixelBounds = {
      left: Math.max(0, left - request.padPx),
      top: Math.max(0, top - request.padPx),
      right: Math.min(widthPx - 1, right + request.padPx),
      bottom: Math.min(heightPx - 1, bottom + request.padPx),
    };
    const cropWidth = cropRectPx.right - cropRectPx.left + 1;
    const cropHeight = cropRectPx.bottom - cropRectPx.top + 1;
    const cell = document.createElement("canvas");
    cell.width = cropWidth;
    cell.height = cropHeight;
    const cellContext = cell.getContext("2d")!;
    const image = cellContext.createImageData(cropWidth, cropHeight);

    const quantityMask = labelByElement.get(request.elementId)?.quantityMaskPx ?? null;
    let foregroundPixels = 0;
    let sourceTextGlyphPixels = 0;
    let quantityGlyphPixelsInCropRect = 0;
    const rivalPixelsByComponent = new Map<number, number>();
    for (let y = 0; y < cropHeight; y += 1) {
      for (let x = 0; x < cropWidth; x += 1) {
        const sourceX = cropRectPx.left + x;
        const sourceY = cropRectPx.top + y;
        const source = sourceY * widthPx + sourceX;
        const mine = componentAt[source] === request.componentIndex;
        if (mine) foregroundPixels += 1;
        else if (componentAt[source] !== 0) {
          rivalPixelsByComponent.set(
            componentAt[source]!,
            (rivalPixelsByComponent.get(componentAt[source]!) ?? 0) + 1,
          );
        }
        if (classification[source] === 2) {
          sourceTextGlyphPixels += 1;
          if (
            quantityMask !== null &&
            sourceX >= quantityMask.left &&
            sourceX <= quantityMask.right &&
            sourceY >= quantityMask.top &&
            sourceY <= quantityMask.bottom
          ) {
            quantityGlyphPixelsInCropRect += 1;
          }
        }
        const from = source * 4;
        const to = (y * cropWidth + x) * 4;
        image.data[to] = mine ? pixels[from]! : background[0];
        image.data[to + 1] = mine ? pixels[from + 1]! : background[1];
        image.data[to + 2] = mine ? pixels[from + 2]! : background[2];
        image.data[to + 3] = 255;
      }
    }
    // The crop rectangle is the component's own bounds plus padding, so the
    // whole component is inside it, and this recount must agree. It is an
    // internal consistency assertion over one array, not a guard against a
    // stale raster — the raster id above is that guard.
    if (foregroundPixels !== request.componentPixels) {
      throw new Error(
        `Inventory component ${request.componentIndex} for element ${request.elementId} held ` +
          `${request.componentPixels} pixel(s) when the page was labelled and ${foregroundPixels} when it was cropped.`,
      );
    }
    // Whether the Nx label was located at all, measured over the label's own
    // box rather than over the crop rectangle. Isolating a component lifts the
    // picture clear of its label, so counting inside the rectangle answers
    // "did the art happen to reach down as far as its caption" — which is not
    // a defect, and reported 86 good crops as broken when it was asked.
    let quantityGlyphInkPixels = 0;
    if (quantityMask !== null) {
      for (let y = quantityMask.top; y <= quantityMask.bottom; y += 1) {
        for (let x = quantityMask.left; x <= quantityMask.right; x += 1) {
          if (classification[y * widthPx + x] === 2) quantityGlyphInkPixels += 1;
        }
      }
    }
    cellContext.putImageData(image, 0, 0);
    return {
      elementId: request.elementId,
      url: cell.toDataURL("image/png"),
      widthPx: cropWidth,
      heightPx: cropHeight,
      cropRectPx,
      foregroundPixels,
      componentPixels: request.componentPixels,
      rivalComponents: [...rivalPixelsByComponent]
        .map(([index, count]) => ({ index, pixels: count }))
        .sort((first, second) => second.pixels - first.pixels || first.index - second.index),
      quantityGlyphInkPixels,
      quantityGlyphPixelsInCropRect,
      sourceTextGlyphPixels,
      touchesPageBoundary,
      boundaryClearancePx: {
        left: left - cropRectPx.left,
        top: top - cropRectPx.top,
        right: cropRectPx.right - right,
        bottom: cropRectPx.bottom - bottom,
      },
    };
  });
}
