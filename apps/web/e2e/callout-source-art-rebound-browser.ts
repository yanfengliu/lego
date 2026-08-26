interface Bounds {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

interface BrowserOperatorList {
  readonly argsArray: readonly unknown[];
  readonly fnArray: readonly number[];
}

interface BrowserPdfPage {
  readonly recordedGroups?: readonly {
    readonly dependencies: readonly number[];
    readonly idx: number;
  }[];
  cleanup(): void;
  getOperatorList(): Promise<BrowserOperatorList>;
  getViewport(input: { readonly scale: number }): {
    readonly height: number;
    readonly width: number;
  };
  render(options: unknown): { readonly promise: Promise<void> };
}

interface BrowserPdfDocument {
  destroy(): Promise<void>;
  getPage(pageNumber: number): Promise<BrowserPdfPage>;
}

export interface SourceArtReboundBrowserTarget {
  readonly componentBoundsPxAtScale8: Bounds;
  readonly identity: string;
  readonly pageNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
}

export interface SourceArtReboundBrowserInput {
  readonly expectedPdfjsVersion: string;
  readonly expectedPdfSha256: string;
  readonly expectedSourceBytes: number;
  readonly pdfjsUrl: string;
  readonly pdfUrl: string;
  readonly rendererRole: "chromium-pdfjs-build" | "chromium-pdfjs-legacy-build";
  readonly targets: readonly SourceArtReboundBrowserTarget[];
  readonly workerUrl: string;
}

export interface SourceArtReboundBrowserCapture {
  readonly evidenceRole: "diagnostic-visual-only-no-native-renderer-equivalence";
  readonly fullPng: string;
  readonly fullRgbaSha256: string;
  readonly identity: string;
  readonly isolatedPng: string;
  readonly isolatedRgbaSha256: string;
  readonly noOutsidePaintInterference: true;
  readonly operationClosureCount: number;
  readonly pageNumber: number;
  readonly pdfjsVersion: string;
  readonly rendererRole: SourceArtReboundBrowserInput["rendererRole"];
  readonly stepWindow: Bounds;
}

const SCALE = 8;
const BACKGROUND = "#899093";
const WIDTH = 344;
const HEIGHT = 368;
const FIXED_LINEAR_MILLI = [41_034, 0, 0, 37_908] as const;

function equalNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function contains(outer: Bounds | null, inner: Bounds): boolean {
  return (
    outer !== null &&
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const owned = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(owned).set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", owned));
  return `sha256:${[...digest].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function shownText(args: unknown): string | null {
  const glyphs = Array.isArray(args) ? args[0] : null;
  if (!Array.isArray(glyphs)) return null;
  let text = "";
  for (const glyph of glyphs) {
    if (typeof glyph === "number") continue;
    if (typeof glyph !== "object" || glyph === null || !("unicode" in glyph)) return null;
    const unicode = (glyph as { readonly unicode?: unknown }).unicode;
    if (typeof unicode !== "string") return null;
    text += unicode;
  }
  return text;
}

function enumerateImages(
  pdfjs: {
    readonly OPS: Readonly<Record<string, number>>;
    readonly Util: { transform(left: readonly number[], right: readonly number[]): number[] };
  },
  operatorList: { readonly fnArray: readonly number[]; readonly argsArray: readonly unknown[] },
  pageHeightPt: number,
): readonly {
  readonly objectId: string;
  readonly operatorIndex: number;
  readonly projectedBounds: Bounds | null;
  readonly transform: readonly number[];
}[] {
  let transform = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const images = [];
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    if (fn === pdfjs.OPS.save) stack.push([...transform]);
    else if (fn === pdfjs.OPS.restore) {
      const restored = stack.pop();
      if (restored === undefined) throw new Error(`Unmatched PDF restore at ${index}.`);
      transform = restored;
    } else if (fn === pdfjs.OPS.transform) {
      if (!Array.isArray(args) || args.length !== 6) {
        throw new Error(`Invalid PDF transform at ${index}.`);
      }
      transform = pdfjs.Util.transform(transform, args as number[]);
    } else if (fn === pdfjs.OPS.paintImageXObject) {
      const objectId = Array.isArray(args) ? args[0] : null;
      if (typeof objectId !== "string") throw new Error(`Invalid image paint at ${index}.`);
      const [a, b, c, d, e, f] = transform;
      if (
        a === undefined ||
        b === undefined ||
        c === undefined ||
        d === undefined ||
        e === undefined ||
        f === undefined
      ) {
        throw new Error(`Invalid accumulated PDF transform at ${index}.`);
      }
      const projectedBounds =
        b === 0 && c === 0 && a > 0 && d > 0
          ? {
              bottom: Math.ceil((pageHeightPt - f) * SCALE) - 1,
              left: Math.floor(e * SCALE),
              right: Math.ceil((e + a) * SCALE) - 1,
              top: Math.floor((pageHeightPt - (f + d)) * SCALE),
            }
          : null;
      images.push({ objectId, operatorIndex: index, projectedBounds, transform: [...transform] });
    }
  }
  if (stack.length !== 0) throw new Error(`PDF page retained ${stack.length} unmatched saves.`);
  return images;
}

function terminalPaints(
  OPS: Readonly<Record<string, number>>,
  operatorList: { readonly fnArray: readonly number[]; readonly argsArray: readonly unknown[] },
  imageIndex: number,
  label: string,
): readonly number[] {
  const outlines: number[] = [];
  let textIndex: number | null = null;
  const limit = Math.min(operatorList.fnArray.length, imageIndex + 33);
  for (let index = imageIndex + 1; index < limit; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    if (fn === OPS.paintImageXObject) break;
    if (fn === OPS.constructPath) {
      outlines.push(index);
    } else if (fn === OPS.showText && shownText(args) === label) {
      textIndex = index;
      break;
    }
  }
  const secondOutline = outlines.at(1);
  if (
    outlines.length !== 2 ||
    secondOutline === undefined ||
    textIndex === null ||
    textIndex <= secondOutline
  ) {
    const observed = operatorList.fnArray.slice(imageIndex + 1, limit).map((fn, offset) => {
      const index = imageIndex + offset + 1;
      const args = operatorList.argsArray[index];
      return {
        fn,
        index,
        isConstructPath: fn === OPS.constructPath,
        isPaintImage: fn === OPS.paintImageXObject,
        isShowText: fn === OPS.showText,
        shownText: shownText(args),
      };
    });
    throw new Error(
      `Image ${imageIndex} does not lead to exactly two outlines and ${label} text; observed ${JSON.stringify(observed)}.`,
    );
  }
  return [imageIndex, ...outlines, textIndex];
}

function windowFor(
  context: CanvasRenderingContext2D,
  pageHeightPt: number,
  target: SourceArtReboundBrowserTarget,
): { readonly bounds: Bounds; readonly image: ImageData } {
  const left = Math.floor((target.xPt - 1) * SCALE);
  const top = Math.floor((pageHeightPt - (target.yPt + 45)) * SCALE);
  const bounds = { bottom: top + HEIGHT - 1, left, right: left + WIDTH - 1, top };
  if (!contains(bounds, target.componentBoundsPxAtScale8)) {
    throw new Error(`${target.identity} capture window does not contain its manifest component.`);
  }
  return { bounds, image: context.getImageData(left, top, WIDTH, HEIGHT) };
}

function pngUrl(image: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  try {
    canvas.getContext("2d", { alpha: false })!.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function captureSourceArtRebound(
  input: SourceArtReboundBrowserInput,
): Promise<readonly SourceArtReboundBrowserCapture[]> {
  const response = await fetch(input.pdfUrl, { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error(`PDF fetch failed with ${response.status}.`);
  const pdfBytes = new Uint8Array(await response.arrayBuffer());
  if (pdfBytes.byteLength !== input.expectedSourceBytes) {
    throw new Error(
      `PDF bytes were ${pdfBytes.byteLength}; expected ${input.expectedSourceBytes}.`,
    );
  }
  const pdfDigest = await sha256(pdfBytes);
  if (pdfDigest !== input.expectedPdfSha256) {
    throw new Error(`PDF digest was ${pdfDigest}; expected ${input.expectedPdfSha256}.`);
  }
  const pdfjs = (await import(/* @vite-ignore */ input.pdfjsUrl)) as {
    readonly GlobalWorkerOptions: { workerSrc: string };
    readonly OPS: Readonly<Record<string, number>>;
    readonly Util: { transform(left: readonly number[], right: readonly number[]): number[] };
    readonly version: string;
    getDocument(options: unknown): { readonly promise: Promise<BrowserPdfDocument> };
  };
  if (pdfjs.version !== input.expectedPdfjsVersion) {
    throw new Error(
      `${input.rendererRole} loaded PDF.js ${pdfjs.version}; expected ${input.expectedPdfjsVersion}.`,
    );
  }
  pdfjs.GlobalWorkerOptions.workerSrc = input.workerUrl;
  const documentHandle = await pdfjs.getDocument({ data: pdfBytes, isEvalSupported: false })
    .promise;
  const captures: SourceArtReboundBrowserCapture[] = [];
  try {
    for (const pageNumber of [...new Set(input.targets.map(({ pageNumber }) => pageNumber))].sort(
      (left, right) => left - right,
    )) {
      const page = await documentHandle.getPage(pageNumber);
      try {
        const operatorList = await page.getOperatorList();
        const pageHeightPt = page.getViewport({ scale: 1 }).height;
        const images = enumerateImages(pdfjs, operatorList, pageHeightPt);
        const targets = input.targets.filter((target) => target.pageNumber === pageNumber);
        const viewport = page.getViewport({ scale: SCALE });
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = Math.ceil(viewport.width);
        fullCanvas.height = Math.ceil(viewport.height);
        const fullContext = fullCanvas.getContext("2d")!;
        await page.render({
          background: BACKGROUND,
          canvasContext: fullContext,
          recordOperations: true,
          viewport,
        }).promise;
        const recordedGroups = page.recordedGroups;
        if (recordedGroups === undefined) {
          throw new Error(`Page ${pageNumber} produced no recorded PDF operation groups.`);
        }
        const groups = new Map(recordedGroups.map((group) => [group.idx, group]));
        try {
          for (const target of targets) {
            const fixed = images.filter(
              (image) =>
                contains(image.projectedBounds, target.componentBoundsPxAtScale8) &&
                equalNumbers(
                  image.transform.slice(0, 4).map((value) => Math.round(value * 1_000)),
                  FIXED_LINEAR_MILLI,
                ),
            );
            if (fixed.length !== 1) {
              throw new Error(`${target.identity} selected ${fixed.length} fixed image paints.`);
            }
            const selected = fixed[0];
            if (selected === undefined) {
              throw new Error(`${target.identity} did not select a fixed image paint.`);
            }
            const operationIndexes = new Set<number>();
            for (const terminal of terminalPaints(
              pdfjs.OPS,
              operatorList,
              selected.operatorIndex,
              `${target.quantity}x`,
            )) {
              const group = groups.get(terminal);
              if (group === undefined) throw new Error(`Missing recorded group ${terminal}.`);
              operationIndexes.add(group.idx);
              group.dependencies.forEach((dependency) => operationIndexes.add(dependency));
            }
            const isolatedCanvas = document.createElement("canvas");
            isolatedCanvas.width = fullCanvas.width;
            isolatedCanvas.height = fullCanvas.height;
            const isolatedContext = isolatedCanvas.getContext("2d")!;
            try {
              await page.render({
                background: BACKGROUND,
                canvasContext: isolatedContext,
                filteredOperationIndexes: operationIndexes,
                viewport,
              }).promise;
              const full = windowFor(fullContext, pageHeightPt, target);
              const isolated = windowFor(isolatedContext, pageHeightPt, target);
              const fullBytes = new Uint8Array(full.image.data);
              const isolatedBytes = new Uint8Array(isolated.image.data);
              const [fullRgbaSha256, isolatedRgbaSha256] = await Promise.all([
                sha256(fullBytes),
                sha256(isolatedBytes),
              ]);
              if (
                fullRgbaSha256 !== isolatedRgbaSha256 ||
                fullBytes.some((value, index) => value !== isolatedBytes[index])
              ) {
                throw new Error(`${target.identity} full and isolated windows differ.`);
              }
              captures.push({
                evidenceRole: "diagnostic-visual-only-no-native-renderer-equivalence",
                fullPng: pngUrl(full.image),
                fullRgbaSha256,
                identity: target.identity,
                isolatedPng: pngUrl(isolated.image),
                isolatedRgbaSha256,
                noOutsidePaintInterference: true,
                operationClosureCount: operationIndexes.size,
                pageNumber,
                pdfjsVersion: pdfjs.version,
                rendererRole: input.rendererRole,
                stepWindow: full.bounds,
              });
            } finally {
              isolatedCanvas.width = 1;
              isolatedCanvas.height = 1;
            }
          }
        } finally {
          fullCanvas.width = 1;
          fullCanvas.height = 1;
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await documentHandle.destroy();
  }
  return captures;
}
