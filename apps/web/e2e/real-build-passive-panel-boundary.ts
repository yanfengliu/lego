import type { PanelFace } from "../src/assembly/panel-face";
import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import type { RealBuildPanelRasterSpec } from "./real-build-safety";

const PASSIVE_PANEL_KEYS = [
  "stepNumber",
  "pageNumber",
  "panelFace",
  "minXPt",
  "maxXPt",
  "minYPt",
  "maxYPt",
  "calloutBoxes",
] as const;
const SOURCE_PANEL_KEYS = [
  "stepNumber",
  "pageNumber",
  "bounds",
  "labelXPt",
  "labelYPt",
  "quantities",
] as const;
const BOUNDS_KEYS = ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const;
const PRODUCER_INPUT_KEYS = ["panel", "panelFace", "calloutBoxes"] as const;
const MAXIMUM_PASSIVE_CALLOUT_BOXES = 2_048;

type DataSnapshot = Readonly<Record<string, unknown>>;

function displayedKey(key: PropertyKey): string {
  return typeof key === "symbol" ? key.toString() : JSON.stringify(key);
}

function exactOwnDataObject(value: unknown, label: string, keys: readonly string[]): DataSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be one exact object of enumerable own data properties.`);
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(`${label} own property descriptors could not be inspected safely.`);
  }
  const actualKeys = Reflect.ownKeys(descriptors);
  const unexpected = actualKeys.find((key) => typeof key !== "string" || !keys.includes(key));
  if (unexpected !== undefined) {
    throw new TypeError(
      `${label} contains unsupported own field ${displayedKey(unexpected)}; expected exactly ` +
        `[${keys.join(", ")}].`,
    );
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined) {
      throw new TypeError(`${label}.${key} is missing; expected one enumerable own data property.`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}.${key} must be one enumerable own data property.`);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function exactDenseDataArray(
  value: unknown,
  label: string,
  maximumRows: number,
): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be one exact ordinary dense data array.`);
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(`${label} own property descriptors could not be inspected safely.`);
  }
  const lengthDescriptor = descriptors.length;
  const length =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : Number.NaN;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximumRows) {
    throw new TypeError(
      `${label}.length must be one non-negative safe integer no greater than ${maximumRows}.`,
    );
  }
  const expectedIndices = Array.from({ length }, (_, index) => String(index));
  const unexpected = Reflect.ownKeys(descriptors).find(
    (key) => key !== "length" && (typeof key !== "string" || !expectedIndices.includes(key)),
  );
  if (unexpected !== undefined) {
    throw new TypeError(
      `${label} contains unsupported own field ${displayedKey(unexpected)}; expected only length ` +
        `and dense indices 0..${Math.max(0, length - 1)}.`,
    );
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${label}[${index}] must be one enumerable own data property.`);
    }
    snapshot.push(descriptor.value);
  }
  return snapshot;
}

function snapshotCalloutBox(value: unknown, label: string): PanelCalloutBox {
  const fields = exactOwnDataObject(value, label, BOUNDS_KEYS);
  return Object.freeze({
    minXPt: fields.minXPt as number,
    maxXPt: fields.maxXPt as number,
    minYPt: fields.minYPt as number,
    maxYPt: fields.maxYPt as number,
  });
}

function snapshotCalloutBoxes(value: unknown, label: string): readonly PanelCalloutBox[] {
  const rows = exactDenseDataArray(value, label, MAXIMUM_PASSIVE_CALLOUT_BOXES);
  return Object.freeze(rows.map((box, index) => snapshotCalloutBox(box, `${label}[${index}]`)));
}

/** Admits one already-produced passive descriptor without projecting away any caller field. */
export function snapshotRealBuildPassivePanel(
  value: unknown,
  label: string,
): RealBuildPanelRasterSpec {
  const fields = exactOwnDataObject(value, label, PASSIVE_PANEL_KEYS);
  return Object.freeze({
    stepNumber: fields.stepNumber as number,
    pageNumber: fields.pageNumber as number,
    panelFace: fields.panelFace as PanelFace | null,
    minXPt: fields.minXPt as number,
    maxXPt: fields.maxXPt as number,
    minYPt: fields.minYPt as number,
    maxYPt: fields.maxYPt as number,
    calloutBoxes: snapshotCalloutBoxes(fields.calloutBoxes, `${label}.calloutBoxes`),
  });
}

/** Produces one passive descriptor only from exact accessor-free source rows. */
export function produceRealBuildPassivePanel(input: {
  readonly panel: StepPanel;
  readonly panelFace: PanelFace | null;
  readonly calloutBoxes: readonly PanelCalloutBox[];
}): RealBuildPanelRasterSpec {
  const inputFields = exactOwnDataObject(
    input,
    "Real-build passive panel producer input",
    PRODUCER_INPUT_KEYS,
  );
  const panel = exactOwnDataObject(
    inputFields.panel,
    "Real-build passive source panel",
    SOURCE_PANEL_KEYS,
  );
  const bounds = exactOwnDataObject(
    panel.bounds,
    "Real-build passive source panel.bounds",
    BOUNDS_KEYS,
  );
  return Object.freeze({
    stepNumber: panel.stepNumber as number,
    pageNumber: panel.pageNumber as number,
    panelFace: inputFields.panelFace as PanelFace | null,
    minXPt: bounds.minXPt as number,
    maxXPt: bounds.maxXPt as number,
    minYPt: bounds.minYPt as number,
    maxYPt: bounds.maxYPt as number,
    calloutBoxes: snapshotCalloutBoxes(
      inputFields.calloutBoxes,
      "Real-build passive source calloutBoxes",
    ),
  });
}

export const __testOnly = Object.freeze({ exactDenseDataArray, exactOwnDataObject });
