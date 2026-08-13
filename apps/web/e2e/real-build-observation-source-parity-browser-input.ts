import { deepFreeze } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS,
  realBuildSourceParityWorkGeometry,
} from "./real-build-observation-source-parity-contract";
import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityBounds,
  type RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";
import type {
  RealBuildSourceParityBrowserModuleUrls,
  RealBuildSourceParityMeasurementInput,
} from "./real-build-observation-source-parity-browser-types";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
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
const URL_KEYS = [
  "pdfjsUrl",
  "workerUrl",
  "pdfUrl",
  "latticeUrl",
  "assemblyUrl",
  "panelRasterUrl",
  "candidateUrl",
] as const;
const validatedDenseInputs = new WeakSet<object>();

export interface RealBuildSourceParityBrowserInputShape {
  readonly expectedPdfDigest: string;
  readonly expectedPdfBytes: number;
  readonly preparedPanelsDigest: string;
  readonly panels: readonly RealBuildSourceParityProbePanel[];
}

function observed(value: unknown): string {
  if (typeof value === "string") {
    const bounded = value.length <= 80 ? value : `${value.slice(0, 77)}...`;
    return JSON.stringify(bounded);
  }
  if (value === null || typeof value !== "object") return String(value);
  return Array.isArray(value) ? `Array(length=${value.length})` : typeof value;
}

function descriptors(value: unknown, path: string): PropertyDescriptorMap {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} observed ${observed(value)}; expected one plain data object.`);
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        `${path} observed a non-plain prototype; expected Object.prototype or null.`,
      );
    }
    return Object.getOwnPropertyDescriptors(value);
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(path)) throw error;
    throw new TypeError(`${path} refused safe descriptor inspection before any field access.`, {
      cause: error,
    });
  }
}

function exactFields(
  map: PropertyDescriptorMap,
  expected: readonly string[],
  path: string,
  optional: readonly string[] = [],
): void {
  const keys = Reflect.ownKeys(map);
  const allowed = new Set([...expected, ...optional]);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    expected.some((key) => !Object.hasOwn(map, key))
  ) {
    throw new TypeError(
      `${path} observed fields [${keys.map(String).sort().join(", ")}]; expected [${expected.join(", ")}]${optional.length === 0 ? "" : ` plus optional [${optional.join(", ")}]`}.`,
    );
  }
  for (const key of keys as string[]) {
    const descriptor = map[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(
        `${path}.${key} must be one enumerable own data field; accessors and hidden fields are refused without invocation.`,
      );
    }
  }
}

function arrayValues(value: unknown, minimum: number, maximum: number, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} observed ${observed(value)}; expected an Array.`);
  }
  let map: PropertyDescriptorMap;
  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(`${path} must use Array.prototype.`);
    }
    map = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(path)) throw error;
    throw new TypeError(`${path} refused safe dense-array descriptor inspection.`, {
      cause: error,
    });
  }
  const lengthDescriptor = map.length;
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) {
    throw new TypeError(`${path}.length must be one own data field.`);
  }
  const length = lengthDescriptor.value as number;
  if (!Number.isSafeInteger(length) || length < minimum || length > maximum) {
    throw new RangeError(
      `${path}.length observed ${String(length)}; expected ${minimum} through ${maximum}.`,
    );
  }
  const keys = Reflect.ownKeys(map);
  if (keys.length !== length + 1) {
    throw new TypeError(`${path} must be dense and contain no extra or symbol fields.`);
  }
  const result = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = map[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(
        `${path}[${index}] must be one enumerable own data field, not a hole or accessor.`,
      );
    }
    result[index] = descriptor.value;
  }
  return result;
}

function finiteBounds(value: unknown, path: string): RealBuildSourceParityBounds {
  const map = descriptors(value, path);
  exactFields(map, BOUNDS_KEYS, path);
  const values = Object.fromEntries(BOUNDS_KEYS.map((key) => [key, map[key]!.value])) as Record<
    (typeof BOUNDS_KEYS)[number],
    unknown
  >;
  for (const key of BOUNDS_KEYS) {
    if (typeof values[key] !== "number" || !Number.isFinite(values[key])) {
      throw new RangeError(
        `${path}.${key} observed ${observed(values[key])}; expected one finite number.`,
      );
    }
  }
  if ((values.maxXPt as number) <= (values.minXPt as number)) {
    throw new RangeError(
      `${path}.maxXPt observed ${values.maxXPt}; expected greater than ${path}.minXPt observed ${values.minXPt}.`,
    );
  }
  if ((values.maxYPt as number) <= (values.minYPt as number)) {
    throw new RangeError(
      `${path}.maxYPt observed ${values.maxYPt}; expected greater than ${path}.minYPt observed ${values.minYPt}.`,
    );
  }
  return values as RealBuildSourceParityBounds;
}

function panelSnapshot(value: unknown, index: number): RealBuildSourceParityProbePanel {
  const path = `Source-parity browser input.panels[${index}]`;
  const map = descriptors(value, path);
  exactFields(map, PANEL_KEYS, path);
  const bounds = finiteBounds(
    Object.fromEntries(BOUNDS_KEYS.map((key) => [key, map[key]!.value])),
    path,
  );
  const stepNumber = map.stepNumber!.value;
  const pageNumber = map.pageNumber!.value;
  const panelEvidenceDigest = map.panelEvidenceDigest!.value;
  if (stepNumber !== index + 1) {
    throw new TypeError(
      `${path}.stepNumber observed ${observed(stepNumber)}; expected exactly ${index + 1}.`,
    );
  }
  if (
    !Number.isSafeInteger(pageNumber) ||
    (pageNumber as number) < 1 ||
    (pageNumber as number) > 400
  ) {
    throw new RangeError(
      `${path}.pageNumber observed ${observed(pageNumber)}; expected a safe integer from 1 through 400.`,
    );
  }
  if (typeof panelEvidenceDigest !== "string" || !DIGEST.test(panelEvidenceDigest)) {
    throw new TypeError(
      `${path}.panelEvidenceDigest observed ${observed(panelEvidenceDigest)}; expected an exact lowercase sha256:<64 hex> digest.`,
    );
  }
  const callouts = arrayValues(
    map.calloutBoxes!.value,
    0,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
    `${path}.calloutBoxes`,
  ).map((box, calloutIndex) => finiteBounds(box, `${path}.calloutBoxes[${calloutIndex}]`));
  return {
    stepNumber: stepNumber as number,
    pageNumber: pageNumber as number,
    ...bounds,
    calloutBoxes: callouts,
    panelEvidenceDigest,
  };
}

function snapshotUrls(value: unknown): RealBuildSourceParityBrowserModuleUrls {
  const urlMap = descriptors(value, "Source-parity browser input.urls");
  exactFields(urlMap, URL_KEYS, "Source-parity browser input.urls");
  const urls = Object.fromEntries(
    URL_KEYS.map((key) => {
      const url = urlMap[key]!.value;
      if (typeof url !== "string" || url.length < 1 || url.length > 4_096) {
        throw new TypeError(
          `Source-parity browser input.urls.${key} observed ${observed(url)}; expected a non-empty URL string of at most 4096 characters.`,
        );
      }
      return [key, url];
    }),
  );
  return urls as unknown as RealBuildSourceParityBrowserModuleUrls;
}

function snapshotInput(
  input: RealBuildSourceParityBrowserInputShape,
  requireUrls: boolean,
): RealBuildSourceParityBrowserInputShape & {
  readonly urls?: RealBuildSourceParityBrowserModuleUrls;
} {
  const map = descriptors(input, "Source-parity browser input");
  exactFields(
    map,
    [
      "expectedPdfDigest",
      "expectedPdfBytes",
      "preparedPanelsDigest",
      "panels",
      ...(requireUrls ? ["urls"] : []),
    ],
    "Source-parity browser input",
    requireUrls ? [] : ["urls"],
  );
  const expectedPdfDigest = map.expectedPdfDigest!.value;
  const expectedPdfBytes = map.expectedPdfBytes!.value;
  const preparedPanelsDigest = map.preparedPanelsDigest!.value;
  const panelValues = arrayValues(
    map.panels!.value,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    REAL_BUILD_SOURCE_PARITY_EXPECTED_STEPS,
    "Source-parity browser input.panels",
  );
  const panels = panelValues.map(panelSnapshot);
  if (typeof expectedPdfDigest !== "string" || !DIGEST.test(expectedPdfDigest)) {
    throw new TypeError(
      `Source-parity browser input.expectedPdfDigest observed ${observed(expectedPdfDigest)}; expected an exact lowercase sha256:<64 hex> digest.`,
    );
  }
  if (typeof preparedPanelsDigest !== "string" || !DIGEST.test(preparedPanelsDigest)) {
    throw new TypeError(
      `Source-parity browser input.preparedPanelsDigest observed ${observed(preparedPanelsDigest)}; expected an exact lowercase sha256:<64 hex> digest.`,
    );
  }
  if (
    !Number.isSafeInteger(expectedPdfBytes) ||
    (expectedPdfBytes as number) < 1 ||
    (expectedPdfBytes as number) > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES
  ) {
    throw new RangeError(
      `Source-parity browser input.expectedPdfBytes observed ${observed(expectedPdfBytes)}; expected a safe integer from 1 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES}.`,
    );
  }
  let previousPage = 0;
  let totalPanelPixels = 0;
  for (const [index, panel] of panels.entries()) {
    if (panel.pageNumber < previousPage) {
      throw new RangeError(
        `Source-parity browser input.panels[${index}].pageNumber observed ${panel.pageNumber}; expected at least prior page ${previousPage}.`,
      );
    }
    previousPage = panel.pageNumber;
    totalPanelPixels += realBuildSourceParityWorkGeometry(panel).pixels;
    if (
      totalPanelPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS ||
      totalPanelPixels * REAL_BUILD_SOURCE_PARITY_CLASSES.length >
        REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS ||
      realBuildSourceParityWorkGeometry(panel).pixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS
    ) {
      throw new RangeError(
        `Source-parity browser input.panels[${index}] derived cumulative work pixels ${totalPanelPixels}; expected this row and running total within bounds.`,
      );
    }
  }
  const base: Record<string, unknown> = {
    expectedPdfDigest,
    expectedPdfBytes,
    preparedPanelsDigest,
    panels,
  };
  if (map.urls !== undefined) {
    base.urls = snapshotUrls(map.urls.value);
  }
  return base as unknown as RealBuildSourceParityBrowserInputShape & {
    readonly urls?: RealBuildSourceParityBrowserModuleUrls;
  };
}

export function assertRealBuildSourceParityBrowserInput(
  input: RealBuildSourceParityBrowserInputShape,
): void {
  snapshotInput(input, false);
}

export function snapshotRealBuildSourceParityBrowserInput(
  input: RealBuildSourceParityMeasurementInput,
): RealBuildSourceParityMeasurementInput {
  const snapshot = deepFreeze(snapshotInput(input, true)) as RealBuildSourceParityMeasurementInput;
  validatedDenseInputs.add(snapshot as object);
  return snapshot;
}

export function requireValidatedRealBuildSourceParityBrowserInput(
  input: RealBuildSourceParityMeasurementInput,
): void {
  if (input === null || typeof input !== "object" || !validatedDenseInputs.has(input as object)) {
    throw new TypeError(
      "Dense source-parity measurement requires the exact detached input snapshot admitted before any fetch or page work.",
    );
  }
}
