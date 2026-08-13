import { canonicalDigest, sha256Hex } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
  realBuildSourceParityPreparedPanelsManifest,
  realBuildSourceParityWorkGeometry,
} from "./real-build-observation-source-parity-contract";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import type { RealBuildSourceParityBrowserModuleUrls } from "./real-build-observation-source-parity-browser-types";
import type { RealBuildSourceParityProbePanel } from "./real-build-observation-source-parity-types";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const validatedCalibrationInputs = new WeakSet<object>();

export interface RealBuildSourceParityCalibrationBrowserInput {
  readonly urls: RealBuildSourceParityBrowserModuleUrls;
  readonly expectedPdfDigest: string;
  readonly expectedPdfBytes: number;
  readonly fullPreparedPanelsDigest: string;
  readonly calibrationPreparedPanelsDigest: string;
  readonly calibrationDigest: string;
  readonly panels: readonly RealBuildSourceParityProbePanel[];
}

function describe(value: unknown): string {
  if (typeof value === "string")
    return JSON.stringify(value.length > 80 ? `${value.slice(0, 77)}...` : value);
  if (value === null || typeof value !== "object") return String(value);
  return Array.isArray(value) ? `Array(length=${value.length})` : typeof value;
}

function digest(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new TypeError(
      `${path} observed ${describe(value)}; expected one lowercase sha256:<64 hex> digest.`,
    );
  }
}

function positiveInteger(value: unknown, maximum: number, path: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new RangeError(
      `${path} observed ${describe(value)}; expected a safe integer from 1 through ${maximum}.`,
    );
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} observed ${describe(value)}; expected one plain data object.`);
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch (error) {
    throw new TypeError(`${path} refused safe descriptor inspection before any field access.`, {
      cause: error,
    });
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(
      `${path} observed a non-plain prototype; expected Object.prototype or null.`,
    );
  }
  const observed = Reflect.ownKeys(descriptors);
  const wanted = [...keys].sort();
  if (
    observed.some((key) => typeof key !== "string") ||
    observed.length !== wanted.length ||
    (observed as string[]).sort().some((key, index) => key !== wanted[index])
  ) {
    throw new TypeError(
      `${path} observed fields [${observed.map(String).sort().join(", ")}]; expected exactly [${wanted.join(", ")}].`,
    );
  }
  for (const key of wanted) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError(
        `${path}.${key} must be one enumerable own data field, not an accessor or hidden value.`,
      );
    }
  }
  return Object.fromEntries(wanted.map((key) => [key, descriptors[key]!.value]));
}

function denseArray(value: unknown, minimum: number, maximum: number, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(
      `${path} observed ${describe(value)}; expected one Array of ${minimum} through ${maximum} rows.`,
    );
  }
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch (error) {
    throw new TypeError(`${path} refused safe dense-array descriptor inspection.`, {
      cause: error,
    });
  }
  const lengthDescriptor = descriptors.length;
  const rawLength =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : undefined;
  if (
    typeof rawLength !== "number" ||
    !Number.isSafeInteger(rawLength) ||
    rawLength < minimum ||
    rawLength > maximum
  ) {
    throw new RangeError(
      `${path}.length observed ${String(rawLength)}; expected ${minimum} through ${maximum}.`,
    );
  }
  const length = rawLength;
  const keys = Reflect.ownKeys(descriptors);
  if (
    prototype !== Array.prototype ||
    keys.length !== length + 1 ||
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" && (!/^\d+$/u.test(key) || Number(key) >= length)) ||
        !("value" in descriptors[key as string]!) ||
        (key !== "length" && descriptors[key]!.enumerable !== true),
    )
  ) {
    throw new TypeError(
      `${path} must be a dense accessor-free standard Array with no extra fields.`,
    );
  }
  return Array.from({ length: length as number }, (_, index) => descriptors[String(index)]!.value);
}

function panel(value: unknown, index: number): RealBuildSourceParityProbePanel {
  const expected = REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES[index]!;
  const path = `Calibration browser input.panels[${index}]`;
  const fields = exactRecord(
    value,
    [
      "stepNumber",
      "pageNumber",
      "minXPt",
      "maxXPt",
      "minYPt",
      "maxYPt",
      "calloutBoxes",
      "panelEvidenceDigest",
    ],
    path,
  );
  if (fields.stepNumber !== expected.stepNumber) {
    throw new TypeError(
      `${path}.stepNumber observed ${describe(fields.stepNumber)}; expected fixed calibration step ${expected.stepNumber}.`,
    );
  }
  if (fields.pageNumber !== expected.pageNumber) {
    throw new TypeError(
      `${path}.pageNumber observed ${describe(fields.pageNumber)}; expected booklet page ${expected.pageNumber} for step ${expected.stepNumber}.`,
    );
  }
  for (const [minimumKey, maximumKey] of [
    ["minXPt", "maxXPt"],
    ["minYPt", "maxYPt"],
  ] as const) {
    const minimum = fields[minimumKey];
    const maximum = fields[maximumKey];
    if (typeof minimum !== "number" || !Number.isFinite(minimum)) {
      throw new RangeError(
        `${path}.${minimumKey} observed ${describe(minimum)}; expected one finite number.`,
      );
    }
    if (typeof maximum !== "number" || !Number.isFinite(maximum)) {
      throw new RangeError(
        `${path}.${maximumKey} observed ${describe(maximum)}; expected one finite number.`,
      );
    }
    if (maximum <= minimum) {
      throw new RangeError(
        `${path}.${maximumKey} observed ${maximum}; expected greater than ${minimumKey} ${minimum}.`,
      );
    }
  }
  digest(fields.panelEvidenceDigest, `${path}.panelEvidenceDigest`);
  const rawCallouts = denseArray(
    fields.calloutBoxes,
    0,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_CALLOUTS,
    `${path}.calloutBoxes`,
  );
  const calloutBoxes = rawCallouts.map((box, calloutIndex) => {
    const boxPath = `${path}.calloutBoxes[${calloutIndex}]`;
    const boxFields = exactRecord(box, ["minXPt", "maxXPt", "minYPt", "maxYPt"], boxPath);
    for (const [minimumKey, maximumKey] of [
      ["minXPt", "maxXPt"],
      ["minYPt", "maxYPt"],
    ] as const) {
      const minimum = boxFields[minimumKey];
      const maximum = boxFields[maximumKey];
      if (typeof minimum !== "number" || !Number.isFinite(minimum)) {
        throw new RangeError(
          `${boxPath}.${minimumKey} observed ${describe(minimum)}; expected one finite number.`,
        );
      }
      if (typeof maximum !== "number" || !Number.isFinite(maximum)) {
        throw new RangeError(
          `${boxPath}.${maximumKey} observed ${describe(maximum)}; expected one finite number.`,
        );
      }
      if (maximum <= minimum) {
        throw new RangeError(
          `${boxPath}.${maximumKey} observed ${maximum}; expected greater than ${minimumKey} ${minimum}.`,
        );
      }
    }
    return Object.freeze({
      minXPt: boxFields.minXPt as number,
      maxXPt: boxFields.maxXPt as number,
      minYPt: boxFields.minYPt as number,
      maxYPt: boxFields.maxYPt as number,
    });
  });
  const candidate = Object.freeze({
    stepNumber: fields.stepNumber as number,
    pageNumber: fields.pageNumber as number,
    minXPt: fields.minXPt as number,
    maxXPt: fields.maxXPt as number,
    minYPt: fields.minYPt as number,
    maxYPt: fields.maxYPt as number,
    calloutBoxes: Object.freeze(calloutBoxes),
    panelEvidenceDigest: fields.panelEvidenceDigest,
  }) as RealBuildSourceParityProbePanel;
  const geometry = realBuildSourceParityWorkGeometry(candidate);
  if (
    !Number.isSafeInteger(geometry.pixels) ||
    geometry.pixels < 1 ||
    geometry.pixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS
  ) {
    throw new RangeError(
      `${path} derives ${String(geometry.pixels)} work pixels; expected 1 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS}.`,
    );
  }
  return candidate;
}

export function snapshotRealBuildSourceParityCalibrationBrowserInput(
  raw: unknown,
): RealBuildSourceParityCalibrationBrowserInput {
  const input = exactRecord(
    raw,
    [
      "urls",
      "expectedPdfDigest",
      "expectedPdfBytes",
      "fullPreparedPanelsDigest",
      "calibrationPreparedPanelsDigest",
      "calibrationDigest",
      "panels",
    ],
    "Calibration browser input",
  );
  digest(input.expectedPdfDigest, "Calibration browser input.expectedPdfDigest");
  positiveInteger(
    input.expectedPdfBytes,
    REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES,
    "Calibration browser input.expectedPdfBytes",
  );
  digest(input.fullPreparedPanelsDigest, "Calibration browser input.fullPreparedPanelsDigest");
  digest(
    input.calibrationPreparedPanelsDigest,
    "Calibration browser input.calibrationPreparedPanelsDigest",
  );
  digest(input.calibrationDigest, "Calibration browser input.calibrationDigest");
  const panels = denseArray(
    input.panels,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length,
    "Calibration browser input.panels",
  ).map(panel);
  const reproducedSubset = `sha256:${sha256Hex(JSON.stringify(realBuildSourceParityPreparedPanelsManifest(input.expectedPdfDigest, panels)))}`;
  if (reproducedSubset !== input.calibrationPreparedPanelsDigest) {
    throw new TypeError(
      `Calibration browser input panels reproduce ${reproducedSubset}; expected declared subset ${input.calibrationPreparedPanelsDigest}.`,
    );
  }
  const reproducedCalibrationDigest = canonicalDigest({
    schemaVersion: "lego.real-build-observation-source-parity-calibration-contract/1",
    authority: "absent",
    pdfDigest: input.expectedPdfDigest,
    fullPreparedPanelsDigest: input.fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest: input.calibrationPreparedPanelsDigest,
    panels: panels.map(({ stepNumber, pageNumber, ...bounds }) => {
      const geometry = realBuildSourceParityWorkGeometry(bounds);
      return {
        stepNumber,
        pageNumber,
        width: geometry.width,
        height: geometry.height,
        pixelCount: geometry.pixels,
        workFactor: 2 as const,
      };
    }),
  });
  if (reproducedCalibrationDigest !== input.calibrationDigest) {
    throw new TypeError(
      `Calibration browser input contract reproduces ${reproducedCalibrationDigest}; expected declared calibrationDigest ${input.calibrationDigest}.`,
    );
  }
  const urls = exactRecord(
    input.urls,
    [
      "pdfjsUrl",
      "workerUrl",
      "pdfUrl",
      "latticeUrl",
      "assemblyUrl",
      "panelRasterUrl",
      "candidateUrl",
    ],
    "Calibration browser input.urls",
  );
  for (const key of Object.keys(urls)) {
    if (typeof urls[key] !== "string" || urls[key].length < 1 || urls[key].length > 4_096) {
      throw new TypeError(
        `Calibration browser input.urls.${key} observed ${describe(urls[key])}; expected a non-empty URL string of at most 4096 characters.`,
      );
    }
  }
  const snapshot = Object.freeze({
    urls: Object.freeze(urls) as unknown as RealBuildSourceParityBrowserModuleUrls,
    expectedPdfDigest: input.expectedPdfDigest,
    expectedPdfBytes: input.expectedPdfBytes,
    fullPreparedPanelsDigest: input.fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest: input.calibrationPreparedPanelsDigest,
    calibrationDigest: input.calibrationDigest,
    panels: Object.freeze(panels),
  });
  validatedCalibrationInputs.add(snapshot);
  return snapshot;
}

export function requireValidatedRealBuildSourceParityCalibrationBrowserInput(
  input: RealBuildSourceParityCalibrationBrowserInput,
): void {
  if (input === null || typeof input !== "object" || !validatedCalibrationInputs.has(input)) {
    throw new TypeError(
      "Calibration source-parity measurement requires the exact snapshot admitted by snapshotRealBuildSourceParityCalibrationBrowserInput before any fetch or page work.",
    );
  }
}
