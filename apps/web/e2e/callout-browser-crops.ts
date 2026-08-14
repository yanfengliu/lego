import type {
  BrowserCrop,
  BrowserCropInput,
  BrowserResult,
  CropStrategy,
  PixelBounds,
} from "./callout-types";
import {
  assignTargetBoxComponents,
  calloutSourceBoxKey,
  coalesceContainedComponentGroups,
  type FilledMatchableComponent,
} from "./callout-component-matching";
import * as conservation from "./callout-component-conservation";
import { absoluteForegroundSha256 } from "./callout-source-component";
import { renderSemanticCrop } from "./callout-semantic-crop";
import {
  clampCalloutPixelBounds,
  discardEmptyLegacyComponent,
  insideCalloutPixelBounds,
  sampledCalloutBackground,
} from "./callout-browser-pixels";
import {
  assertBoundedCalloutCropRaster,
  assertBoundedCalloutTextMasks,
  assertCalloutComponentBoxBound,
  boundedCalloutPngDataUrl,
  boundedCalloutPageRaster,
  calloutSha256,
  createCalloutComponentCacheBudget,
  fetchExactCalloutPdfBytes,
  MAX_CALLOUT_COMPONENT_BOX_PIXELS,
  snapshotBoundedCalloutTextItems,
  snapshotBoundedCalloutTargets,
} from "./callout-browser-resource-bounds";

export async function renderCalloutCrops(input: BrowserCropInput): Promise<BrowserResult[]> {
  const targets = snapshotBoundedCalloutTargets(input.targets);
  const pdfjs = await import(/* @vite-ignore */ input.pdfjsUrl);
  pdfjs.GlobalWorkerOptions.workerSrc = input.workerUrl;
  const data = await fetchExactCalloutPdfBytes(input.pdfUrl, input.expectedSourceBytes);
  const sourceDigest = await calloutSha256(data);
  if (sourceDigest !== input.expectedSourceHash) {
    throw new Error(
      `Browser callout renderer fetched PDF digest ${sourceDigest}, not the Node-ingested ${input.expectedSourceHash}. Refuse mixed-source crop evidence and retry from one immutable PDF snapshot.`,
    );
  }
  const documentHandle = await pdfjs.getDocument({ data }).promise;
  try {
    const pdfPage = await documentHandle.getPage(input.pageNumber);
    const scale = 8;
    const viewport = pdfPage.getViewport({ scale });
    const raster = boundedCalloutPageRaster(viewport.width, viewport.height);
    document.querySelectorAll("canvas.callout-probe").forEach((node) => node.remove());
    const canvas = document.createElement("canvas");
    canvas.className = "callout-probe";
    canvas.width = raster.width;
    canvas.height = raster.height;
    document.body.append(canvas);
    const context = canvas.getContext("2d")!;
    await pdfPage.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const textContent = await pdfPage.getTextContent();
    const textItems = snapshotBoundedCalloutTextItems(textContent.items);
    const clampBounds = (bounds: PixelBounds): PixelBounds =>
      clampCalloutPixelBounds(bounds, canvas.width, canvas.height);
    const textMasks: PixelBounds[] = textItems.flatMap((raw: unknown) => {
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
    assertBoundedCalloutTextMasks(textMasks);
    const textPixels = new Uint8Array(canvas.width * canvas.height);
    for (const bounds of textMasks) {
      for (let y = bounds.top; y <= bounds.bottom; y += 1) {
        textPixels.fill(1, y * canvas.width + bounds.left, y * canvas.width + bounds.right + 1);
      }
    }
    const inAnyText = (x: number, y: number): boolean => textPixels[y * canvas.width + x] === 1;
    const colourAt = (x: number, y: number): [number, number, number] => {
      const at = (y * canvas.width + x) * 4;
      return [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!];
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
    type Blob = FilledMatchableComponent;
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
        if (!insideCalloutPixelBounds(limit, x, y) || !differs(x, y, background, maskText))
          continue;
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
        : {
            left,
            top,
            right,
            bottom,
            size: filled.size,
            filled,
            overflowed: stack.length > 0,
            rawComponentCount: 1,
          };
    };
    const validBlob = (blob: Blob | null, minimum: number, density = 0.08): blob is Blob => {
      if (!blob || blob.size < minimum || blob.overflowed) return false;
      const blobArea = (blob.right - blob.left + 1) * (blob.bottom - blob.top + 1);
      return blobArea >= 16 * 16 && blob.size / blobArea >= density;
    };
    const componentCrop = async (
      blob: Blob,
      box: PixelBounds,
      background: readonly [number, number, number],
      strategy: CropStrategy,
      quantityMask: PixelBounds,
      identity: string,
    ): Promise<BrowserCrop | null> => {
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
      let componentPixels = 0;
      let componentLeft = canvas.width;
      let componentTop = canvas.height;
      let componentRight = -1;
      let componentBottom = -1;
      for (const pixel of blob.filled) {
        const x = pixel % canvas.width;
        const y = (pixel - x) / canvas.width;
        const text = inAnyText(x, y);
        if (text) sourceTextGlyphPixels += 1;
        if (text && insideCalloutPixelBounds(quantityMask, x, y)) sourceQuantityGlyphPixels += 1;
        if (!text) {
          componentPixels += 1;
          componentLeft = Math.min(componentLeft, x);
          componentTop = Math.min(componentTop, y);
          componentRight = Math.max(componentRight, x);
          componentBottom = Math.max(componentBottom, y);
        }
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
      assertBoundedCalloutCropRaster(width, height, `${identity} physical callout crop`);
      const cell = document.createElement("canvas");
      cell.width = width;
      cell.height = height;
      const cellContext = cell.getContext("2d")!;
      const image = cellContext.createImageData(width, height);
      const componentWidth = componentRight - componentLeft + 1;
      const componentHeight = componentBottom - componentTop + 1;
      const componentArea = componentWidth * componentHeight;
      if (discardEmptyLegacyComponent(strategy, componentPixels)) return null;
      if (componentPixels === 0 || componentArea > 4_000_000) {
        throw new Error(
          `Physical component retained ${componentPixels} pixels in a ${componentWidth}x${componentHeight} raster; expected 1..4000000 bounded pixels.`,
        );
      }
      const componentRecords = new Uint32Array(componentPixels * 2);
      let componentRecord = 0;
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
            componentRecords[componentRecord] = sourceY * canvas.width + sourceX;
            componentRecords[componentRecord + 1] =
              ((pixels[from]! << 24) |
                (pixels[from + 1]! << 16) |
                (pixels[from + 2]! << 8) |
                pixels[from + 3]!) >>>
              0;
            componentRecord += 2;
          }
          image.data[to] = keep ? pixels[from]! : background[0];
          image.data[to + 1] = keep ? pixels[from + 1]! : background[1];
          image.data[to + 2] = keep ? pixels[from + 2]! : background[2];
          image.data[to + 3] = 255;
        }
      }
      cellContext.putImageData(image, 0, 0);
      const componentDigest = await absoluteForegroundSha256({
        pageNumber: input.pageNumber,
        rasterScale: scale,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        boundsPx: {
          left: componentLeft,
          top: componentTop,
          right: componentRight,
          bottom: componentBottom,
        },
        rawComponentCount: blob.rawComponentCount,
        records: componentRecords,
      });
      const url = await boundedCalloutPngDataUrl(cell, `${identity} physical callout crop`);
      return {
        url,
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
        sourceComponent: {
          rasterScale: 8,
          boundsPx: {
            left: componentLeft,
            top: componentTop,
            right: componentRight,
            bottom: componentBottom,
          },
          foregroundPixels: componentPixels,
          rawComponentCount: blob.rawComponentCount,
          absoluteForegroundSha256: componentDigest,
        },
      };
    };

    const output: BrowserResult[] = [];
    let rankedComponentClaims: readonly conservation.AssignedComponentPixels[] = [];
    const pageHeightPt = viewport.height / scale;
    const componentCache = new Map<string, Blob[]>();
    const componentCacheBudget = createCalloutComponentCacheBudget();
    const assignmentCache = new Map<string, ReturnType<typeof assignTargetBoxComponents<Blob>>>();
    for (const target of targets) {
      const box = clampBounds({
        left: Math.round(target.box.minXPt * scale),
        right: Math.round(target.box.maxXPt * scale),
        top: Math.round((pageHeightPt - target.box.maxYPt) * scale),
        bottom: Math.round((pageHeightPt - target.box.minYPt) * scale),
      });
      if (target.evidenceKind === "part-art") assertCalloutComponentBoxBound(box);
      const background = sampledCalloutBackground(box, colourAt);
      const rasterY = pageHeightPt - target.yPt;
      const labelTop = Math.round((rasterY - 9) * scale);
      const rasterX = Math.round(target.xPt * scale);
      const quantityMask = clampBounds({
        left: Math.round((target.xPt - 2) * scale),
        right: Math.round((target.xPt + target.heightPt * 2) * scale),
        top: Math.round((rasterY - target.heightPt - 2) * scale),
        bottom: Math.round((rasterY + 2) * scale),
      });
      const firstSeed = (minimum: number): Blob | null => {
        const left = Math.max(box.left, rasterX - Math.round(10 * scale));
        const right = Math.min(box.right, rasterX + Math.round(96 * scale));
        const top = Math.max(box.top, labelTop - Math.round(52 * scale));
        const visited = new Set<number>();
        for (let y = Math.min(labelTop, box.bottom); y >= top; y -= 1) {
          for (let x = left; x <= right; x += 1) {
            const at = y * canvas.width + x;
            if (visited.has(at)) continue;
            if (!differs(x, y, background, false)) continue;
            const found = floodFrom(x, y, background, box, false);
            if (found?.overflowed) {
              throw new Error(
                `Callout source component exceeds the ${MAX_CALLOUT_COMPONENT_BOX_PIXELS}-pixel flood bound.`,
              );
            }
            if (found) for (const pixel of found.filled) visited.add(pixel);
            if (validBlob(found, minimum)) return found;
          }
        }
        return null;
      };
      const componentsFor = (minimum: number): Blob[] => {
        const cacheKey = `${calloutSourceBoxKey(target)}|${box.left}|${box.top}|${box.right}|${box.bottom}|${minimum}`;
        let components = componentCache.get(cacheKey);
        if (!components) {
          componentCacheBudget.charge(box);
          const visited = new Set<number>();
          components = [];
          enumerateComponents: for (let y = box.bottom; y >= box.top; y -= 1) {
            for (let x = box.left; x <= box.right; x += 1) {
              const at = y * canvas.width + x;
              if (visited.has(at) || !differs(x, y, background, true)) continue;
              const found = floodFrom(x, y, background, box, true);
              if (!found) continue;
              if (found.overflowed) {
                throw new Error(
                  `Callout source component exceeds the ${MAX_CALLOUT_COMPONENT_BOX_PIXELS}-pixel flood bound.`,
                );
              }
              for (const pixel of found.filled) visited.add(pixel);
              const touchesBoundary =
                found.left <= box.left + 2 ||
                found.right >= box.right - 2 ||
                found.top <= box.top + 2 ||
                found.bottom >= box.bottom - 2;
              if (validBlob(found, minimum, 0.015) && !touchesBoundary) {
                components.push(found);
                if (components.length === 65) break enumerateComponents;
              }
            }
          }
          const peerAnchors = targets
            .filter(
              (peer) =>
                peer.evidenceKind === "part-art" &&
                calloutSourceBoxKey(peer) === calloutSourceBoxKey(target),
            )
            .map((peer) => ({
              identity: peer.identity,
              rasterX: Math.round(peer.xPt * scale),
              labelTop: Math.round((pageHeightPt - peer.yPt - 9) * scale),
              maximumHorizontalGap: Math.round(peer.heightPt * scale),
            }));
          const rawComponents = components;
          components = coalesceContainedComponentGroups(peerAnchors, rawComponents);
          componentCache.set(cacheKey, components);
        }
        return components;
      };
      const legacyBlob =
        target.evidenceKind === "part-art" && target.boxMethod === "vector-smallest"
          ? firstSeed(90 * scale * scale)
          : null;
      const legacy = legacyBlob
        ? await componentCrop(
            legacyBlob,
            box,
            background,
            "legacy-seed",
            quantityMask,
            target.identity,
          )
        : null;
      const assignmentKey = `${calloutSourceBoxKey(target)}|${scale}`;
      let assignments = assignmentCache.get(assignmentKey);
      if (!assignments && target.evidenceKind === "part-art") {
        const components = componentsFor(scale * scale);
        assignments = assignTargetBoxComponents(target, targets, components, pageHeightPt, scale);
        assignmentCache.set(assignmentKey, assignments);
        componentCache.clear();
      }
      const rankedBlob = assignments?.byIdentity.get(target.identity) ?? null;
      if (rankedBlob) {
        rankedComponentClaims = conservation.retainDisjointAssignedComponent(
          rankedComponentClaims,
          {
            identity: target.identity,
            filled: rankedBlob.filled,
          },
        );
      }
      output.push({
        identity: target.identity,
        targetEvidenceKind: target.evidenceKind,
        legacy,
        ranked: rankedBlob
          ? await componentCrop(
              rankedBlob,
              box,
              background,
              "ranked-component",
              quantityMask,
              target.identity,
            )
          : null,
        rankedFailure: target.evidenceKind === "part-art" ? (assignments?.failure ?? null) : null,
        action:
          target.evidenceKind === "part-art"
            ? null
            : await renderSemanticCrop({
                target,
                box,
                background,
                quantityMask,
                scale,
                canvas,
                pixels,
                textPixels,
              }),
      });
    }
    return output;
  } finally {
    await documentHandle.destroy();
  }
}
