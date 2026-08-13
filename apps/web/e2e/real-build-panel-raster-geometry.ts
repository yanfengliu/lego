import {
  MAXIMUM_PANEL_ART_STAGE_CALLOUT_RECTANGLES,
  MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS,
  MAXIMUM_PANEL_ART_STAGE_WORK_FACTOR,
  MAXIMUM_PANEL_ART_STAGE_WORK_PIXELS,
  type PanelArtStagePixelRectangle,
} from "../src/assembly/panel-art-stages";
import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

export type PageCanvas = HTMLCanvasElement;
export const MAXIMUM_REAL_BUILD_PAGE_RASTER_PIXELS = 33_554_432;

export interface PanelCropGeometry {
  readonly stepNumber: number;
  readonly panelFace: RealBuildPanelSpec["panelFace"];
  readonly sourceX: number;
  readonly sourceY: number;
  readonly sourceW: number;
  readonly sourceH: number;
  readonly ratio: number;
  readonly fitWidth: number;
  readonly fitHeight: number;
  readonly workWidth: number;
  readonly workHeight: number;
  readonly renderScale: number;
  readonly workFactor: number;
  readonly pageHeight: number;
  readonly calloutBoxes: RealBuildPanelSpec["calloutBoxes"];
}

const PANEL_SPEC_KEYS = [
  "stepNumber",
  "panelFace",
  "minXPt",
  "maxXPt",
  "minYPt",
  "maxYPt",
  "calloutBoxes",
] as const;
const CALLOUT_KEYS = ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const;

function ordinaryDescriptors(value: unknown, path: string): PropertyDescriptorMap {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be one ordinary plain object of own data properties.`);
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    throw new TypeError(`${path} prototype could not be inspected before crop allocation.`);
  }
  if (prototype !== Object.prototype) {
    throw new TypeError(`${path} must be one ordinary plain object of own data properties.`);
  }
  try {
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError(`${path} properties could not be inspected before crop allocation.`);
  }
}

function dataProperty(
  descriptors: { readonly [key: string]: PropertyDescriptor | undefined },
  key: string,
  path: string,
): unknown {
  const descriptor = descriptors[key];
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(
      `${path}.${key} must be one exact own data property before crop allocation.`,
    );
  }
  return descriptor.value;
}

function snapshotCalloutBox(
  value: unknown,
  path: string,
): RealBuildPanelSpec["calloutBoxes"][number] {
  const descriptors = ordinaryDescriptors(value, path);
  const actualKeys = Reflect.ownKeys(descriptors);
  if (
    actualKeys.length !== CALLOUT_KEYS.length ||
    !CALLOUT_KEYS.every((key) => Object.hasOwn(descriptors, key))
  ) {
    throw new TypeError(
      `${path} must contain exactly ${CALLOUT_KEYS.join(", ")}; observed keys ${actualKeys.map(String).join(", ")}.`,
    );
  }
  const minXPt = dataProperty(descriptors, "minXPt", path);
  const maxXPt = dataProperty(descriptors, "maxXPt", path);
  const minYPt = dataProperty(descriptors, "minYPt", path);
  const maxYPt = dataProperty(descriptors, "maxYPt", path);
  const values = [minXPt, maxXPt, minYPt, maxYPt];
  if (!values.every((item) => typeof item === "number" && Number.isFinite(item))) {
    throw new RangeError(
      `${path} observed bounds ${values.map(String).join(", ")}; expected four finite PDF-point coordinates.`,
    );
  }
  if ((maxXPt as number) <= (minXPt as number) || (maxYPt as number) <= (minYPt as number)) {
    throw new RangeError(
      `${path} observed ${String(minXPt)},${String(minYPt)} through ${String(maxXPt)},${String(maxYPt)}; expected strictly positive ordered width and height.`,
    );
  }
  return Object.freeze({
    minXPt: minXPt as number,
    maxXPt: maxXPt as number,
    minYPt: minYPt as number,
    maxYPt: maxYPt as number,
  });
}

function snapshotCalloutBoxes(
  value: unknown,
  stepNumber: number,
): RealBuildPanelSpec["calloutBoxes"] {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `Real-build panel ${stepNumber} calloutBoxes must be one exact ordinary dense array before crop allocation.`,
    );
  }
  let prototype: object | null;
  let descriptors: ReturnType<typeof Object.getOwnPropertyDescriptors<unknown[]>>;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new TypeError(
      `Real-build panel ${stepNumber} calloutBoxes could not be inspected before crop allocation.`,
    );
  }
  const length = dataProperty(descriptors, "length", `Real-build panel ${stepNumber} calloutBoxes`);
  if (prototype !== Array.prototype || !Number.isSafeInteger(length) || (length as number) < 0) {
    throw new TypeError(
      `Real-build panel ${stepNumber} calloutBoxes must be one exact ordinary dense array before crop allocation.`,
    );
  }
  if ((length as number) > MAXIMUM_PANEL_ART_STAGE_CALLOUT_RECTANGLES) {
    throw new RangeError(
      `Real-build panel ${stepNumber} retains ${String(length)} callout boxes; expected at most ${MAXIMUM_PANEL_ART_STAGE_CALLOUT_RECTANGLES} before crop allocation.`,
    );
  }
  const actualKeys = Reflect.ownKeys(descriptors);
  if (actualKeys.length !== (length as number) + 1) {
    throw new TypeError(
      `Real-build panel ${stepNumber} calloutBoxes must be one exact ordinary dense array; observed ${actualKeys.length - 1} indexed or extra properties for length ${String(length)}.`,
    );
  }
  const boxes: RealBuildPanelSpec["calloutBoxes"][number][] = [];
  for (let index = 0; index < (length as number); index += 1) {
    const item = dataProperty(
      descriptors,
      String(index),
      `Real-build panel ${stepNumber} calloutBoxes`,
    );
    boxes.push(snapshotCalloutBox(item, `Real-build panel ${stepNumber} calloutBoxes[${index}]`));
  }
  return Object.freeze(boxes);
}

function positiveFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `Real-build panel raster ${label} must be a positive finite number; received ${String(value)}.`,
    );
  }
  return value;
}

/** Pure bounds preflight usable before any page or crop canvas allocation. */
export function inspectRealBuildPanelCropGeometry(
  pageWidth: number,
  pageHeight: number,
  spec: RealBuildPanelSpec,
  options: Pick<RealBuildOptions, "renderScale" | "panelWidth" | "workFactor">,
): PanelCropGeometry {
  const renderScale = positiveFinite(options.renderScale, "renderScale");
  const panelWidth = positiveFinite(options.panelWidth, "panelWidth");
  const workFactor = options.workFactor;
  positiveFinite(pageWidth, "page canvas width");
  positiveFinite(pageHeight, "page canvas height");
  if (
    !Number.isSafeInteger(workFactor) ||
    workFactor < 1 ||
    workFactor > MAXIMUM_PANEL_ART_STAGE_WORK_FACTOR
  ) {
    throw new RangeError(
      `Real-build panel raster workFactor must be a safe integer from 1 through ${MAXIMUM_PANEL_ART_STAGE_WORK_FACTOR}; received ${String(workFactor)}.`,
    );
  }
  const specDescriptors = ordinaryDescriptors(spec, "Real-build panel spec");
  const specValues = Object.fromEntries(
    PANEL_SPEC_KEYS.map((key) => [
      key,
      dataProperty(specDescriptors, key, "Real-build panel spec"),
    ]),
  );
  const stepNumber = specValues.stepNumber;
  if (!Number.isSafeInteger(stepNumber) || (stepNumber as number) < 1) {
    throw new RangeError(
      `Real-build panel spec.stepNumber must be a positive safe integer; received ${String(stepNumber)}.`,
    );
  }
  const panelFace = specValues.panelFace as RealBuildPanelSpec["panelFace"];
  const minXPt = specValues.minXPt;
  const maxXPt = specValues.maxXPt;
  const minYPt = specValues.minYPt;
  const maxYPt = specValues.maxYPt;
  const bounds = [minXPt, maxXPt, minYPt, maxYPt];
  if (bounds.some((value) => !Number.isFinite(value))) {
    throw new RangeError(
      `Real-build panel ${String(stepNumber)} bounds must contain four finite PDF-point coordinates.`,
    );
  }
  const panelWidthPt = (maxXPt as number) - (minXPt as number);
  const panelHeightPt = (maxYPt as number) - (minYPt as number);
  if (panelWidthPt <= 0 || panelHeightPt <= 0) {
    throw new RangeError(
      `Real-build panel ${String(stepNumber)} bounds must have positive width and height; received ${panelWidthPt} by ${panelHeightPt} points.`,
    );
  }
  const calloutBoxes = snapshotCalloutBoxes(specValues.calloutBoxes, stepNumber as number);
  const sourceX = (minXPt as number) * renderScale;
  const sourceW = panelWidthPt * renderScale;
  const sourceY = pageHeight - (maxYPt as number) * renderScale;
  const sourceH = panelHeightPt * renderScale;
  const sourceRight = sourceX + sourceW;
  const sourceBottom = sourceY + sourceH;
  if (
    ![sourceX, sourceW, sourceY, sourceH, sourceRight, sourceBottom].every(Number.isFinite) ||
    sourceX < 0 ||
    sourceY < 0 ||
    sourceRight > pageWidth ||
    sourceBottom > pageHeight
  ) {
    throw new RangeError(
      `Real-build panel ${String(stepNumber)} source rectangle [x=${String(sourceX)}, y=${String(sourceY)}, width=${String(sourceW)}, height=${String(sourceH)}] must lie entirely within rendered page [width=${String(pageWidth)}, height=${String(pageHeight)}] before canvas allocation.`,
    );
  }
  const ratio = panelWidth / sourceW;
  const fitWidth = Math.max(1, Math.round(panelWidth));
  const fitHeight = Math.max(1, Math.round(sourceH * ratio));
  const fitPixels = fitWidth * fitHeight;
  if (
    !Number.isFinite(ratio) ||
    !Number.isSafeInteger(fitWidth) ||
    !Number.isSafeInteger(fitHeight) ||
    !Number.isSafeInteger(fitPixels) ||
    fitPixels > MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS
  ) {
    throw new RangeError(
      `Real-build panel ${String(stepNumber)} crop ${String(fitWidth)}x${String(fitHeight)} must cover at most ${MAXIMUM_PANEL_ART_STAGE_HIGH_PIXELS} pixels before canvas allocation.`,
    );
  }
  const workWidth = Math.ceil(fitWidth / workFactor);
  const workHeight = Math.ceil(fitHeight / workFactor);
  const workPixels = workWidth * workHeight;
  if (
    !Number.isSafeInteger(workWidth) ||
    !Number.isSafeInteger(workHeight) ||
    !Number.isSafeInteger(workPixels) ||
    workPixels > MAXIMUM_PANEL_ART_STAGE_WORK_PIXELS
  ) {
    throw new RangeError(
      `Real-build panel ${String(stepNumber)} work raster ${String(workWidth)}x${String(workHeight)} must equal ceil(${fitWidth}/${workFactor}) by ceil(${fitHeight}/${workFactor}) and cover at most ${MAXIMUM_PANEL_ART_STAGE_WORK_PIXELS} pixels before canvas allocation.`,
    );
  }
  return Object.freeze({
    stepNumber: stepNumber as number,
    panelFace,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    ratio,
    fitWidth,
    fitHeight,
    workWidth,
    workHeight,
    renderScale,
    workFactor,
    pageHeight,
    calloutBoxes,
  });
}

export function mappedPanelCalloutRectangles(input: {
  readonly width: number;
  readonly height: number;
  readonly renderScale: number;
  readonly sourceXPx: number;
  readonly sourceYPx: number;
  readonly ratio: number;
  readonly pageHeightPx: number;
  readonly boxes: RealBuildPanelSpec["calloutBoxes"];
}): readonly PanelArtStagePixelRectangle[] {
  const margin = 4;
  const rectangles: PanelArtStagePixelRectangle[] = [];
  for (const box of input.boxes) {
    const minX = Math.max(
      0,
      Math.floor((box.minXPt * input.renderScale - input.sourceXPx) * input.ratio) - margin,
    );
    const maxX = Math.min(
      input.width - 1,
      Math.ceil((box.maxXPt * input.renderScale - input.sourceXPx) * input.ratio) + margin,
    );
    const minY = Math.max(
      0,
      Math.floor(
        (input.pageHeightPx - box.maxYPt * input.renderScale - input.sourceYPx) * input.ratio,
      ) - margin,
    );
    const maxY = Math.min(
      input.height - 1,
      Math.ceil(
        (input.pageHeightPx - box.minYPt * input.renderScale - input.sourceYPx) * input.ratio,
      ) + margin,
    );
    if (maxX < minX || maxY < minY) continue;
    rectangles.push(Object.freeze({ minX, maxX, minY, maxY }));
  }
  return Object.freeze(rectangles);
}

/** Rasterises one bounded PDF page. Caller owns and disposes the returned canvas. */
export async function renderRealBuildPageCanvas(
  pdf: PreparedRealBuildModules["pdfjs"],
  pageNumber: number,
  renderScale: number,
): Promise<{ readonly canvas: PageCanvas; readonly dispose: () => void }> {
  positiveFinite(renderScale, "page renderScale");
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    throw new RangeError(
      `Real-build pageNumber must be a positive safe integer; received ${String(pageNumber)}.`,
    );
  }
  const pdfPage = await pdf.getPage(pageNumber);
  let canvas: PageCanvas | null = null;
  try {
    const viewport = pdfPage.getViewport({ scale: renderScale });
    const canvasWidth = Math.ceil(viewport.width as number);
    const canvasHeight = Math.ceil(viewport.height as number);
    const pagePixels = canvasWidth * canvasHeight;
    if (
      !Number.isSafeInteger(canvasWidth) ||
      !Number.isSafeInteger(canvasHeight) ||
      canvasWidth < 1 ||
      canvasHeight < 1 ||
      !Number.isSafeInteger(pagePixels) ||
      pagePixels > MAXIMUM_REAL_BUILD_PAGE_RASTER_PIXELS
    ) {
      throw new RangeError(
        `Real-build page ${pageNumber} viewport ${String(canvasWidth)}x${String(canvasHeight)} must cover at most ${MAXIMUM_REAL_BUILD_PAGE_RASTER_PIXELS} pixels before canvas allocation.`,
      );
    }
    canvas = document.createElement("canvas");
    canvas.className = "page-probe";
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const pageContext = canvas.getContext("2d", { willReadFrequently: true })!;
    await pdfPage.render({
      canvas,
      canvasContext: pageContext,
      viewport,
      background: "#ffffff",
    }).promise;
    let disposed = false;
    return {
      canvas,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        canvas!.width = 0;
        canvas!.height = 0;
        canvas!.remove();
        pdfPage.cleanup?.();
      },
    };
  } catch (error) {
    if (canvas !== null) {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    }
    pdfPage.cleanup?.();
    throw error;
  }
}
