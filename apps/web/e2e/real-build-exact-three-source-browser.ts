import type { RealBuildSourceParityBounds } from "./real-build-observation-source-parity-types";

const EXACT_STEPS = Object.freeze([2, 3, 4] as const);
const EXACT_PAGE = 11;
const PDF_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAXIMUM_PDF_BYTES = 96 * 1024 * 1024;
const MAXIMUM_CALLOUTS = 1_024;
const HIGH_WIDTH = 1_000;
const RENDER_SCALE = 6;
const WORK_FACTOR = 2;
const PROXIMITY_MARGIN_PX = 14;

const INPUT_KEYS = ["urls", "expectedPdfDigest", "expectedPdfBytes", "panels"] as const;
const URL_KEYS = [
  "pdfjsUrl",
  "workerUrl",
  "pdfUrl",
  "latticeUrl",
  "assemblyUrl",
  "panelRasterUrl",
] as const;
const PANEL_KEYS = [
  "stepNumber",
  "pageNumber",
  "minXPt",
  "maxXPt",
  "minYPt",
  "maxYPt",
  "calloutBoxes",
  "panelEvidenceDigest",
] as const;
const BOUNDS_KEYS = ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const;

type ExactThree<T> = readonly [T, T, T];

export interface RealBuildExactThreeSourcePanel extends RealBuildSourceParityBounds {
  readonly stepNumber: 2 | 3 | 4;
  readonly pageNumber: 11;
  readonly calloutBoxes: readonly RealBuildSourceParityBounds[];
  readonly panelEvidenceDigest: string;
}

export interface RealBuildExactThreeSourceBrowserInput {
  readonly urls: Readonly<Record<(typeof URL_KEYS)[number], string>>;
  readonly expectedPdfDigest: string;
  readonly expectedPdfBytes: number;
  readonly panels: ExactThree<RealBuildExactThreeSourcePanel>;
}

interface RealBuildExactThreeSourceRgbaRow {
  readonly highRgba: Uint8ClampedArray;
  readonly workRgba: Uint8ClampedArray;
}

type DataValues = Readonly<Record<string, unknown>>;

function shown(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80));
  if (value === null || typeof value !== "object") return String(value);
  return Array.isArray(value) ? `Array(length=${value.length})` : typeof value;
}

function exactDataObject(value: unknown, keys: readonly string[], path: string): DataValues {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} observed ${shown(value)}; expected one plain data object.`);
  }
  let descriptors: PropertyDescriptorMap;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must use Object.prototype or null.`);
    }
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(path)) throw error;
    throw new TypeError(`${path} refused descriptor inspection before field access.`, {
      cause: error,
    });
  }
  const observedKeys = Reflect.ownKeys(descriptors);
  if (
    observedKeys.length !== keys.length ||
    observedKeys.some((key) => typeof key !== "string" || !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(descriptors, key))
  ) {
    throw new TypeError(
      `${path} observed fields [${observedKeys.map(String).sort().join(", ")}]; expected exactly [${keys.join(", ")}].`,
    );
  }
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(
        `${path}.${key} must be one enumerable own data field; accessors and hidden fields are refused without invocation.`,
      );
    }
    result[key] = descriptor.value;
  }
  return result;
}

function denseArray(value: unknown, length: number, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an Array.`);
  let descriptors: PropertyDescriptorMap;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(`${path} must use Array.prototype.`);
    }
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(path)) throw error;
    throw new TypeError(`${path} refused dense-array descriptor inspection.`, { cause: error });
  }
  const lengthDescriptor = descriptors.length;
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) {
    throw new TypeError(`${path}.length must be one own data field.`);
  }
  if (lengthDescriptor.value !== length || Reflect.ownKeys(descriptors).length !== length + 1) {
    throw new RangeError(`${path} must contain exactly ${length} dense entries and no extras.`);
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${path}[${index}] must be an enumerable own data field, not a hole.`);
    }
    result.push(descriptor.value);
  }
  return result;
}

function finiteBounds(value: unknown, path: string) {
  const fields = exactDataObject(value, BOUNDS_KEYS, path);
  const result = {} as Record<(typeof BOUNDS_KEYS)[number], number>;
  for (const key of BOUNDS_KEYS) {
    const coordinate = fields[key];
    if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
      throw new RangeError(`${path}.${key} observed ${shown(coordinate)}; expected finite.`);
    }
    if (coordinate < 0 || coordinate > 5_000) {
      throw new RangeError(`${path}.${key} must be inside the bounded 0..5000 pt page extent.`);
    }
    result[key] = coordinate;
  }
  if (result.maxXPt <= result.minXPt || result.maxYPt <= result.minYPt) {
    throw new RangeError(`${path} must have positive width and height.`);
  }
  return Object.freeze(result);
}

function snapshotPanel(value: unknown, index: number): RealBuildExactThreeSourcePanel {
  const path = `Exact-three source input.panels[${index}]`;
  const fields = exactDataObject(value, PANEL_KEYS, path);
  const stepNumber = fields.stepNumber;
  if (stepNumber !== EXACT_STEPS[index]) {
    throw new TypeError(
      `${path}.stepNumber observed ${shown(stepNumber)}; expected ${EXACT_STEPS[index]}.`,
    );
  }
  if (fields.pageNumber !== EXACT_PAGE) {
    throw new TypeError(
      `${path}.pageNumber observed ${shown(fields.pageNumber)}; expected page 11.`,
    );
  }
  const bounds = finiteBounds(
    Object.fromEntries(BOUNDS_KEYS.map((key) => [key, fields[key]])),
    path,
  );
  const calloutValues = denseArray(
    fields.calloutBoxes,
    Array.isArray(fields.calloutBoxes) ? fields.calloutBoxes.length : -1,
    `${path}.calloutBoxes`,
  );
  if (calloutValues.length > MAXIMUM_CALLOUTS) {
    throw new RangeError(`${path}.calloutBoxes exceeds ${MAXIMUM_CALLOUTS} entries.`);
  }
  const calloutBoxes = calloutValues.map((box, calloutIndex) =>
    finiteBounds(box, `${path}.calloutBoxes[${calloutIndex}]`),
  );
  const panelEvidenceDigest = fields.panelEvidenceDigest;
  if (typeof panelEvidenceDigest !== "string" || !PDF_DIGEST.test(panelEvidenceDigest)) {
    throw new TypeError(`${path}.panelEvidenceDigest must be one lowercase SHA-256 digest.`);
  }
  const highHeight = Math.max(
    1,
    Math.round(((bounds.maxYPt - bounds.minYPt) * HIGH_WIDTH) / (bounds.maxXPt - bounds.minXPt)),
  );
  if (!Number.isSafeInteger(highHeight) || HIGH_WIDTH * highHeight > 4_194_304) {
    throw new RangeError(`${path} exceeds the bounded high-raster geometry.`);
  }
  return Object.freeze({
    stepNumber: stepNumber as 2 | 3 | 4,
    pageNumber: EXACT_PAGE,
    ...bounds,
    calloutBoxes: Object.freeze(calloutBoxes),
    panelEvidenceDigest,
  });
}

function snapshotInput(value: unknown): RealBuildExactThreeSourceBrowserInput {
  const fields = exactDataObject(value, INPUT_KEYS, "Exact-three source input");
  const rawUrls = exactDataObject(fields.urls, URL_KEYS, "Exact-three source input.urls");
  const urls: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const key of URL_KEYS) {
    const url = rawUrls[key];
    if (typeof url !== "string" || url.length < 1 || url.length > 4_096) {
      throw new TypeError(`Exact-three source input.urls.${key} must be 1..4096 characters.`);
    }
    urls[key] = url;
  }
  const expectedPdfDigest = fields.expectedPdfDigest;
  if (typeof expectedPdfDigest !== "string" || !PDF_DIGEST.test(expectedPdfDigest)) {
    throw new TypeError(
      "Exact-three source input.expectedPdfDigest must be one lowercase SHA-256 digest.",
    );
  }
  const expectedPdfBytes = fields.expectedPdfBytes;
  if (
    !Number.isSafeInteger(expectedPdfBytes) ||
    (expectedPdfBytes as number) < 1 ||
    (expectedPdfBytes as number) > MAXIMUM_PDF_BYTES
  ) {
    throw new RangeError(`Exact-three source PDF bytes must be 1..${MAXIMUM_PDF_BYTES}.`);
  }
  const panels = denseArray(fields.panels, 3, "Exact-three source input.panels").map(snapshotPanel);
  return Object.freeze({
    urls: Object.freeze(urls) as RealBuildExactThreeSourceBrowserInput["urls"],
    expectedPdfDigest,
    expectedPdfBytes: expectedPdfBytes as number,
    panels: Object.freeze(panels) as unknown as RealBuildExactThreeSourceBrowserInput["panels"],
  });
}

async function fetchedPdf(url: string, expectedBytes: number): Promise<Uint8Array> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || response.body === null) {
    await response.body?.cancel();
    throw new Error(
      `Exact-three source PDF fetch returned HTTP ${response.status} without usable bytes.`,
    );
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/u.test(declared) || Number(declared) !== expectedBytes)) {
    await response.body.cancel();
    throw new RangeError(
      `Exact-three source PDF declared ${shown(declared)} bytes; expected ${expectedBytes}.`,
    );
  }
  const bytes = new Uint8Array(expectedBytes);
  const reader = response.body.getReader();
  let offset = 0;
  let ended = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        ended = true;
        break;
      }
      if (chunk.value === undefined || chunk.value.byteLength === 0) continue;
      if (offset + chunk.value.byteLength > expectedBytes) {
        throw new RangeError(`Exact-three source PDF exceeds the expected ${expectedBytes} bytes.`);
      }
      bytes.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
  } finally {
    if (!ended) await reader.cancel();
    reader.releaseLock();
  }
  if (offset !== expectedBytes) {
    throw new RangeError(
      `Exact-three source PDF ended at ${offset} bytes; expected ${expectedBytes}.`,
    );
  }
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", owned.buffer));
  return `sha256:${Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function panelSpec(panel: RealBuildExactThreeSourcePanel): Record<string, unknown> {
  return {
    ...panel,
    panelFace: "studs-up",
    mappedCalloutKeys: [],
    action: {
      kind: "transition",
      assembledPieces: 0,
      transition: "unclassified",
      panelEvidenceDigest: null,
      classificationEvidenceDigest: null,
      evidenceDigest: null,
    },
    pieces: [],
    omittedPieces: [],
    calloutPieces: 0,
    classifiedPhysicalCalloutPieces: 0,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  };
}

/** Fresh, authority-absent browser pixels for the fixed registration panels 2, 3 and 4. */
export async function captureRealBuildExactThreeSourceInBrowser(
  rawInput: RealBuildExactThreeSourceBrowserInput | unknown,
) {
  const input = snapshotInput(rawInput);
  const [pdfjs, lattice, assembly, panelRaster] = await Promise.all([
    import(/* @vite-ignore */ input.urls.pdfjsUrl),
    import(/* @vite-ignore */ input.urls.latticeUrl),
    import(/* @vite-ignore */ input.urls.assemblyUrl),
    import(/* @vite-ignore */ input.urls.panelRasterUrl),
  ]);
  let loadingTask: { promise: Promise<unknown>; destroy(): Promise<void> | void } | null = null;
  let pdf: { destroy(): Promise<void> | void } | null = null;
  let renderedPage: { canvas: HTMLCanvasElement; dispose(): void } | null = null;
  let ownedPageCanvas: HTMLCanvasElement | null = null;
  let rows: RealBuildExactThreeSourceRgbaRow[] | null = null;
  let observedPdfDigest: string | null = null;
  let primaryFailure: unknown = null;
  const cleanupFailures: unknown[] = [];
  let pageRenderCount = 0;
  let pageDisposeCount = 0;
  let pdfDestroyCount = 0;
  let loadingTaskDestroyCount = 0;
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = input.urls.workerUrl;
    const pdfBytes = await fetchedPdf(input.urls.pdfUrl, input.expectedPdfBytes);
    observedPdfDigest = await sha256(pdfBytes);
    if (observedPdfDigest !== input.expectedPdfDigest) {
      throw new TypeError(
        `Exact-three browser fetched ${observedPdfDigest}; expected ${input.expectedPdfDigest}.`,
      );
    }
    const openedTask = pdfjs.getDocument({ data: pdfBytes, isEvalSupported: false }) as {
      promise: Promise<{ destroy(): Promise<void> | void }>;
      destroy(): Promise<void> | void;
    };
    loadingTask = openedTask;
    const openedPdf = await openedTask.promise;
    pdf = openedPdf;
    const pageRaster = await panelRaster.renderRealBuildPageCanvas(
      openedPdf,
      EXACT_PAGE,
      RENDER_SCALE,
    );
    renderedPage = pageRaster;
    ownedPageCanvas = pageRaster.canvas;
    pageRenderCount += 1;
    rows = input.panels.map((panel) => {
      const production = panelRaster.derivePanelRasterEvidence({
        pageCanvas: pageRaster.canvas,
        spec: panelSpec(panel),
        options: {
          renderScale: RENDER_SCALE,
          panelWidth: HIGH_WIDTH,
          workFactor: WORK_FACTOR,
          proximityMarginPx: PROXIMITY_MARGIN_PX,
        },
        modules: { lattice, assembly },
        retainCalibrationHighRgba: true,
      });
      if (production.calibrationHighRgba === undefined) {
        throw new TypeError(`Exact-three source step ${panel.stepNumber} omitted high RGBA.`);
      }
      return Object.freeze({
        highRgba: panelRaster.copyRealBuildPanelCalibrationHighRgba(production.calibrationHighRgba),
        workRgba: new Uint8ClampedArray(production.workPixels),
      });
    });
  } catch (error) {
    primaryFailure = error;
  } finally {
    if (renderedPage !== null) {
      try {
        renderedPage.dispose();
        pageDisposeCount += 1;
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    if (ownedPageCanvas?.isConnected) {
      ownedPageCanvas.width = 0;
      ownedPageCanvas.height = 0;
      ownedPageCanvas.remove();
      cleanupFailures.push(new Error("Exact-three source page disposal leaked its owned canvas."));
    }
    if (pdf !== null) {
      try {
        await pdf.destroy();
        pdfDestroyCount += 1;
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    if (loadingTask !== null) {
      try {
        await loadingTask.destroy();
        loadingTaskDestroyCount += 1;
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
  }
  if (primaryFailure !== null || cleanupFailures.length > 0) {
    const failures = [...(primaryFailure === null ? [] : [primaryFailure]), ...cleanupFailures];
    throw new AggregateError(
      failures,
      `Exact-three source capture ${primaryFailure === null ? "cleanup" : "measurement and cleanup"} failed: ${failures
        .map((failure) => (failure instanceof Error ? failure.message : String(failure)))
        .join(" | ")}`,
      { cause: primaryFailure ?? cleanupFailures[0] },
    );
  }
  if (rows === null || rows.length !== 3 || observedPdfDigest === null) {
    throw new Error("Exact-three source capture completed without exactly three detached rows.");
  }
  if (
    pageRenderCount !== 1 ||
    pageDisposeCount !== 1 ||
    pdfDestroyCount !== 1 ||
    loadingTaskDestroyCount !== 1
  ) {
    throw new Error(
      `Exact-three source lifecycle observed render/dispose/pdf/task ${pageRenderCount}/${pageDisposeCount}/${pdfDestroyCount}/${loadingTaskDestroyCount}; expected 1/1/1/1.`,
    );
  }
  const highRgbaBytes = rows.reduce((total, row) => total + row.highRgba.byteLength, 0);
  const workRgbaBytes = rows.reduce((total, row) => total + row.workRgba.byteLength, 0);
  return Object.freeze({
    schemaVersion: "lego.real-build-exact-three-source-browser/1" as const,
    authority: Object.freeze({
      sourceExecution: "absent" as const,
      preparedRun: "absent" as const,
      placement: "absent" as const,
      completion: "absent" as const,
    }),
    pdfDigest: observedPdfDigest,
    pdfBytes: input.expectedPdfBytes,
    rows: Object.freeze(rows) as ExactThree<RealBuildExactThreeSourceRgbaRow>,
    metrics: Object.freeze({
      requestedPanelCount: 3 as const,
      returnedPanelCount: 3 as const,
      distinctPageCount: 1 as const,
      pageNumber: EXACT_PAGE,
      moduleImportCount: 4 as const,
      pdfFetchCount: 1 as const,
      pageRenderCount,
      pageDisposeCount,
      pdfDestroyCount,
      loadingTaskDestroyCount,
      highRgbaBytes,
      workRgbaBytes,
    }),
  });
}
