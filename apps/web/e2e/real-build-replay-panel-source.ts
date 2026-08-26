import { createHash } from "node:crypto";

import { deepFreeze } from "@lego-studio/brick-kernel";

import type { PanelFace } from "../src/assembly/panel-face";
import {
  INSTRUCTION_PDF_LIMITS,
  type InstructionSourceV1,
} from "../src/instructions/instruction-source";
import { PAGE_SHAPE_LIMITS, type PageShape } from "../src/instructions/page-shapes";
import type { PanelBounds, PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import { snapshotDenseDataArray, snapshotExactDataObject } from "./bounded-data-snapshot";
import { snapshotBoundedInstructionSource } from "./bounded-instruction-source";
import { snapshotBoundedUint8Array } from "./bounded-uint8-snapshot";
import { sampleBookletPanelIndex, sampleBookletPanels } from "./booklet-fixture";
import { stableIdentity } from "./callout-analysis";
import {
  encodeCanonicalRealBuildJson,
  parseCanonicalRealBuildJson,
  parseDuplicateFreeRealBuildJson,
} from "./real-build-json-admission";
import { inspectRealBuildManifestRows } from "./real-build-manifest-consumption";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";
import { deriveTransitionPanelFeatures } from "./real-build-transition-features";

const EXPECTED_PRINTED_STEPS = 359;
const RETAINED_SOURCE_MAXIMUM_BYTES = 32 * 1024 * 1024;
const MANIFEST_MAXIMUM_BYTES = 16 * 1024 * 1024;
const PANEL_SOURCE_SCHEMA = "lego.real-build-panel-source/1" as const;
const PASSIVE_OBSERVATION_STEPS = 2;
const ENCODE_INPUT_KEYS = ["pdfBytes", "source", "requestedLastStep", "pageShapes"] as const;
const REPLAY_INPUT_KEYS = ["pdfBytes", "retainedSourceBytes", "manifestBytes"] as const;
const ENVELOPE_KEYS = [
  "schemaVersion",
  "pdfDigest",
  "pdfByteLength",
  "requestedLastStep",
  "source",
  "pageShapes",
] as const;
const PAGE_SHAPES_ROW_KEYS = ["pageNumber", "shapes"] as const;
const SHAPE_KEYS = ["fillHex", "bounds", "pointCount"] as const;
const BOX_KEYS = ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const;
const MAXIMUM_PAGE_SHAPE_COORDINATE_PT = INSTRUCTION_PDF_LIMITS.maxPageExtentPt * 4;

export interface RealBuildRetainedPanelShapePage {
  readonly pageNumber: number;
  readonly shapes: readonly PageShape[];
}

export interface RealBuildRetainedPanelSourceEnvelope {
  readonly schemaVersion: typeof PANEL_SOURCE_SCHEMA;
  readonly pdfDigest: string;
  readonly pdfByteLength: number;
  readonly requestedLastStep: number;
  readonly source: InstructionSourceV1;
  readonly pageShapes: readonly RealBuildRetainedPanelShapePage[];
}

export interface RealBuildReplayPanelSourceInput {
  readonly pdfBytes: Uint8Array;
  readonly retainedSourceBytes: Uint8Array;
  readonly manifestBytes: Uint8Array;
}

export interface RealBuildReplayPanelEvidenceEntry {
  readonly pageNumber: number;
  readonly digest: string;
}

export interface RealBuildReplayPanelSourceResult {
  readonly pdfDigest: string;
  readonly source: InstructionSourceV1;
  readonly requestedLastStep: number;
  readonly observationThroughStep: number;
  readonly manifestCalloutCount: number;
  readonly panels: readonly StepPanel[];
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  readonly panelEvidenceByStep: Readonly<Record<number, RealBuildReplayPanelEvidenceEntry>>;
  readonly panelFaceByStep: Readonly<Record<number, PanelFace>>;
  readonly authority: Readonly<{
    readonly sourceText: "retained-derived-local-diagnostic";
    readonly pageShapes: "retained-derived-local-diagnostic";
    readonly pdfParserReplay: "not-performed";
    readonly sourceExecution: "absent";
    readonly preparedRun: "absent";
    readonly placement: "absent";
    readonly completion: "absent";
  }>;
}

interface ParsedManifest {
  readonly schemaVersion?: unknown;
  readonly sourceHash?: unknown;
  readonly pageSelection?: unknown;
  readonly calloutCount?: unknown;
  readonly callouts?: unknown;
}

interface BoundManifestRow {
  readonly identity: string;
  readonly pageNumber: number;
  readonly stepNumber: number;
  readonly quantity: number;
  readonly xPt: number;
  readonly yPt: number;
  readonly sourceElementIndex: number;
  readonly box: PanelCalloutBox;
}

function sha256Digest(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function snapshotPdfBytes(value: unknown): Buffer {
  return snapshotBoundedUint8Array(value, {
    label: "Panel-source replay PDF bytes",
    minimumBytes: 1,
    maximumBytes: INSTRUCTION_PDF_LIMITS.maxBytes,
  });
}

function assertSourcePdfBinding(
  source: InstructionSourceV1,
  pdfBytes: Uint8Array,
  pdfDigest: string,
): void {
  if (source.contentHash !== pdfDigest || source.byteLength !== pdfBytes.byteLength) {
    throw new TypeError(
      `Retained panel source declares ${source.byteLength} PDF bytes at ${JSON.stringify(source.contentHash)}, ` +
        `but replay received ${pdfBytes.byteLength} bytes hashing to ${pdfDigest}. Retain and replay the exact ` +
        `InstructionSourceV1 snapshot produced from these PDF bytes.`,
    );
  }
}

function observationThroughStep(requestedLastStep: unknown, expectedPrintedSteps: number): number {
  if (
    !Number.isSafeInteger(requestedLastStep) ||
    (requestedLastStep as number) < 1 ||
    (requestedLastStep as number) > expectedPrintedSteps
  ) {
    throw new RangeError(
      `Retained panel source requestedLastStep must be one safe integer in 1..${expectedPrintedSteps}.`,
    );
  }
  return Math.min((requestedLastStep as number) + PASSIVE_OBSERVATION_STEPS, expectedPrintedSteps);
}

function expectedShapePages(
  source: InstructionSourceV1,
  expectedPrintedSteps: number,
  observationThrough: number,
): readonly number[] {
  const entries = densePanelIndex(source, expectedPrintedSteps);
  const pageByStep = new Map(entries.map((entry) => [entry.stepNumber, entry.pageNumber]));
  const pages = new Set<number>();
  for (let stepNumber = 1; stepNumber <= observationThrough; stepNumber += 1) {
    pages.add(pageByStep.get(stepNumber)!);
  }
  return [...pages].sort((left, right) => left - right);
}

function snapshotRetainedPageShapes(
  value: unknown,
  source: InstructionSourceV1,
  expectedPages: readonly number[] | null,
): readonly RealBuildRetainedPanelShapePage[] {
  const rows = snapshotDenseDataArray(
    value,
    "Retained panel-source pageShapes",
    INSTRUCTION_PDF_LIMITS.maxPages,
  );
  if (expectedPages !== null && rows.length !== expectedPages.length) {
    throw new TypeError(
      `Retained panel-source pageShapes must carry exactly ${expectedPages.length} observation page rows; found ${rows.length}.`,
    );
  }
  const seen = new Set<number>();
  let previousPageNumber = 0;
  return rows.map((rowValue, rowIndex) => {
    const row = snapshotExactDataObject(
      rowValue,
      `Retained panel-source pageShapes[${rowIndex}]`,
      PAGE_SHAPES_ROW_KEYS,
    );
    const pageNumber = row.pageNumber;
    const sourcePage =
      Number.isSafeInteger(pageNumber) && (pageNumber as number) >= 1
        ? source.pages[(pageNumber as number) - 1]
        : undefined;
    if (
      sourcePage === undefined ||
      sourcePage.pageNumber !== pageNumber ||
      seen.has(pageNumber as number) ||
      (pageNumber as number) <= previousPageNumber
    ) {
      throw new TypeError(
        `Retained panel-source pageShapes row ${rowIndex} must name one unique existing page in strictly increasing order.`,
      );
    }
    if (expectedPages !== null && pageNumber !== expectedPages[rowIndex]) {
      throw new TypeError(
        `Retained panel-source pageShapes row ${rowIndex} names page ${String(pageNumber)}; ` +
          `the bounded observation window requires exact page ${String(expectedPages[rowIndex])}.`,
      );
    }
    seen.add(pageNumber as number);
    previousPageNumber = pageNumber as number;
    const shapeValues = snapshotDenseDataArray(
      row.shapes,
      `Retained panel-source pageShapes[${rowIndex}].shapes`,
      PAGE_SHAPE_LIMITS.maxShapesPerPage,
    );
    const shapes = shapeValues.map((shapeValue, shapeIndex) => {
      const label = `Retained panel-source pageShapes[${rowIndex}].shapes[${shapeIndex}]`;
      const shape = snapshotExactDataObject(shapeValue, label, SHAPE_KEYS);
      const bounds = snapshotExactDataObject(shape.bounds, `${label}.bounds`, BOX_KEYS);
      const coordinates = BOX_KEYS.map((key) => bounds[key]);
      if (
        typeof shape.fillHex !== "string" ||
        !/^#[0-9a-f]{6}$/u.test(shape.fillHex) ||
        !Number.isSafeInteger(shape.pointCount) ||
        (shape.pointCount as number) < 1 ||
        (shape.pointCount as number) > PAGE_SHAPE_LIMITS.maxOperatorsPerPage * 4 ||
        !coordinates.every(
          (coordinate) =>
            finiteNumber(coordinate) && Math.abs(coordinate) <= MAXIMUM_PAGE_SHAPE_COORDINATE_PT,
        ) ||
        (bounds.minXPt as number) > (bounds.maxXPt as number) ||
        (bounds.minYPt as number) > (bounds.maxYPt as number)
      ) {
        throw new TypeError(
          `${label} must be one exact lowercase sRGB PageShape with bounded finite ordered coordinates and a bounded positive pointCount.`,
        );
      }
      return {
        fillHex: shape.fillHex,
        bounds: {
          minXPt: bounds.minXPt as number,
          maxXPt: bounds.maxXPt as number,
          minYPt: bounds.minYPt as number,
          maxYPt: bounds.maxYPt as number,
        },
        pointCount: shape.pointCount as number,
      };
    });
    return { pageNumber: pageNumber as number, shapes };
  });
}

/**
 * Encodes the canonical retained text/vector snapshot used only for local
 * synchronous replay. It does not re-run the PDF parser or authenticate source execution.
 */
function encodeWithExpectedPrintedSteps(
  input: {
    readonly pdfBytes: Uint8Array;
    readonly source: unknown;
    readonly requestedLastStep: number;
    readonly pageShapes: readonly RealBuildRetainedPanelShapePage[];
  },
  expectedPrintedSteps: number,
): Uint8Array {
  if (
    !Number.isSafeInteger(expectedPrintedSteps) ||
    expectedPrintedSteps < 1 ||
    expectedPrintedSteps > EXPECTED_PRINTED_STEPS
  ) {
    throw new RangeError(
      `Panel-source encoder expectation must be in 1..${EXPECTED_PRINTED_STEPS}.`,
    );
  }
  const fields = snapshotExactDataObject(
    input,
    "Retained panel-source encoder input",
    ENCODE_INPUT_KEYS,
  );
  const pdfBytes = snapshotPdfBytes(fields.pdfBytes);
  const pdfDigest = sha256Digest(pdfBytes);
  const source = snapshotBoundedInstructionSource(
    fields.source,
    "Retained panel instruction source",
  );
  assertSourcePdfBinding(source, pdfBytes, pdfDigest);
  const observationThrough = observationThroughStep(fields.requestedLastStep, expectedPrintedSteps);
  const pageShapes = snapshotRetainedPageShapes(
    fields.pageShapes,
    source,
    expectedShapePages(source, expectedPrintedSteps, observationThrough),
  );
  return encodeCanonicalRealBuildJson({
    schemaVersion: PANEL_SOURCE_SCHEMA,
    pdfDigest,
    pdfByteLength: pdfBytes.byteLength,
    requestedLastStep: fields.requestedLastStep as number,
    source,
    pageShapes,
  } satisfies RealBuildRetainedPanelSourceEnvelope);
}

export function encodeRealBuildRetainedPanelSource(input: {
  readonly pdfBytes: Uint8Array;
  readonly source: unknown;
  readonly requestedLastStep: number;
  readonly pageShapes: readonly RealBuildRetainedPanelShapePage[];
}): Uint8Array {
  return encodeWithExpectedPrintedSteps(input, EXPECTED_PRINTED_STEPS);
}

function parseRetainedEnvelope(
  bytes: unknown,
  expectedPrintedSteps: number,
): RealBuildRetainedPanelSourceEnvelope {
  const snapshot = snapshotBoundedUint8Array(bytes, {
    label: "Retained panel-source JSON",
    minimumBytes: 1,
    maximumBytes: RETAINED_SOURCE_MAXIMUM_BYTES,
  });
  const parsed = parseCanonicalRealBuildJson<unknown>(snapshot, "Retained panel-source JSON");
  const envelope = snapshotExactDataObject(parsed, "Retained panel-source envelope", ENVELOPE_KEYS);
  if (
    envelope.schemaVersion !== PANEL_SOURCE_SCHEMA ||
    typeof envelope.pdfDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(envelope.pdfDigest) ||
    !Number.isSafeInteger(envelope.pdfByteLength) ||
    (envelope.pdfByteLength as number) < 1
  ) {
    throw new TypeError(
      `Retained panel-source envelope must use ${PANEL_SOURCE_SCHEMA} and bind one exact positive PDF digest/length.`,
    );
  }
  const source = snapshotBoundedInstructionSource(
    envelope.source,
    "Retained panel instruction source",
  );
  observationThroughStep(envelope.requestedLastStep, expectedPrintedSteps);
  const pageShapes = snapshotRetainedPageShapes(envelope.pageShapes, source, null);
  return {
    schemaVersion: PANEL_SOURCE_SCHEMA,
    pdfDigest: envelope.pdfDigest,
    pdfByteLength: envelope.pdfByteLength as number,
    requestedLastStep: envelope.requestedLastStep as number,
    source,
    pageShapes,
  };
}

function parseManifest(
  bytes: unknown,
  pdfDigest: string,
): {
  readonly manifest: ParsedManifest;
  readonly rows: readonly unknown[];
} {
  const snapshot = snapshotBoundedUint8Array(bytes, {
    label: "Panel-source replay v6 manifest",
    minimumBytes: 1,
    maximumBytes: MANIFEST_MAXIMUM_BYTES,
  });
  // The established v6 publication has a stable compact spelling whose member
  // order predates canonical key sorting. Preserve that digest-bearing spelling,
  // but reject duplicate members and non-finite JSON before reading any field.
  const manifest = parseDuplicateFreeRealBuildJson<ParsedManifest>(
    snapshot,
    "Panel-source replay v6 manifest",
  );
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== "lego.callout-thumbnails/6" ||
    manifest.sourceHash !== pdfDigest ||
    manifest.pageSelection !== "full booklet" ||
    !Number.isSafeInteger(manifest.calloutCount) ||
    (manifest.calloutCount as number) < 1
  ) {
    throw new TypeError(
      "Panel-source replay requires one full-booklet lego.callout-thumbnails/6 manifest bound to the exact PDF digest and declaring a positive safe calloutCount.",
    );
  }
  const inspected = inspectRealBuildManifestRows(manifest.callouts, manifest.calloutCount, false);
  if (!inspected.structurallyClosed) {
    throw new TypeError(
      `Panel-source replay requires exactly ${String(manifest.calloutCount)} unique typed v6 manifest rows; ` +
        `received ${inspected.typed.length}/${inspected.rawCount} typed rows.`,
    );
  }
  return { manifest, rows: inspected.typed };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function contains(bounds: PanelBounds, xPt: number, yPt: number): boolean {
  return xPt >= bounds.minXPt && xPt < bounds.maxXPt && yPt >= bounds.minYPt && yPt < bounds.maxYPt;
}

function snapshotManifestBox(
  value: unknown,
  page: InstructionSourceV1["pages"][number],
  label: string,
  xPt: number,
  yPt: number,
): PanelCalloutBox {
  const fields = snapshotExactDataObject(value, label, BOX_KEYS);
  const minXPt = fields.minXPt;
  const maxXPt = fields.maxXPt;
  const minYPt = fields.minYPt;
  const maxYPt = fields.maxYPt;
  if (
    !finiteNumber(minXPt) ||
    !finiteNumber(maxXPt) ||
    !finiteNumber(minYPt) ||
    !finiteNumber(maxYPt) ||
    minXPt < 0 ||
    minXPt >= maxXPt ||
    maxXPt > page.widthPt ||
    minYPt < 0 ||
    minYPt >= maxYPt ||
    maxYPt > page.heightPt ||
    xPt < minXPt ||
    xPt > maxXPt ||
    yPt < minYPt ||
    yPt > maxYPt
  ) {
    throw new TypeError(
      `${label} must be one finite nonempty in-page box containing its exact quantity label.`,
    );
  }
  return { minXPt, maxXPt, minYPt, maxYPt };
}

function bindManifestRows(
  rows: readonly unknown[],
  source: InstructionSourceV1,
  expectedPrintedSteps: number,
): readonly BoundManifestRow[] {
  return rows.map((value, index) => {
    const row = value as Record<string, unknown>;
    const identity = row.identity;
    const pageNumber = row.pageNumber;
    const stepNumber = row.stepNumber;
    const quantity = row.quantity;
    const xPt = row.xPt;
    const yPt = row.yPt;
    if (
      typeof identity !== "string" ||
      !Number.isSafeInteger(pageNumber) ||
      !Number.isSafeInteger(stepNumber) ||
      (stepNumber as number) < 1 ||
      (stepNumber as number) > expectedPrintedSteps ||
      !Number.isSafeInteger(quantity) ||
      (quantity as number) < 1 ||
      (quantity as number) > 999 ||
      !finiteNumber(xPt) ||
      !finiteNumber(yPt) ||
      typeof row.file !== "string" ||
      row.file.length < 1 ||
      typeof row.evidenceKind !== "string" ||
      row.evidenceKind.length < 1 ||
      typeof row.sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(row.sha256)
    ) {
      throw new TypeError(
        `Panel-source replay manifest row ${index} must carry a bounded typed identity, page, step, quantity, label, file, evidence kind, and SHA-256 digest.`,
      );
    }
    const expectedIdentity = stableIdentity(pageNumber as number, quantity as number, xPt, yPt);
    if (identity !== expectedIdentity) {
      throw new TypeError(
        `Panel-source replay manifest row ${index} identity ${JSON.stringify(identity)} does not reproduce ` +
          `its declared page, quantity, and label position ${JSON.stringify(expectedIdentity)}.`,
      );
    }
    const page = source.pages[(pageNumber as number) - 1];
    if (page === undefined || page.pageNumber !== pageNumber) {
      throw new TypeError(
        `Panel-source replay manifest row ${index} declares absent source page ${String(pageNumber)}.`,
      );
    }
    const matchingSourceElementIndices: number[] = [];
    for (let elementIndex = 0; elementIndex < page.textElements.length; elementIndex += 1) {
      const element = page.textElements[elementIndex]!;
      if (element.text === `${String(quantity)}x` && element.xPt === xPt && element.yPt === yPt) {
        matchingSourceElementIndices.push(elementIndex);
      }
    }
    if (matchingSourceElementIndices.length < 1) {
      throw new TypeError(
        `Panel-source replay manifest row ${index} label ${JSON.stringify(identity)} must match exact retained positioned text on its declared source page ${String(pageNumber)}.`,
      );
    }
    if (xPt < 0 || xPt > page.widthPt || yPt < 0 || yPt > page.heightPt) {
      throw new TypeError(
        `Panel-source replay manifest row ${index} quantity label falls outside source page ${String(pageNumber)}.`,
      );
    }
    const box = snapshotManifestBox(
      row.box,
      page,
      `Panel-source replay manifest row ${index}.box`,
      xPt,
      yPt,
    );
    const sourceElementIndex = Math.min(...matchingSourceElementIndices);
    return {
      identity,
      pageNumber: pageNumber as number,
      stepNumber: stepNumber as number,
      quantity: quantity as number,
      xPt,
      yPt,
      sourceElementIndex,
      box,
    };
  });
}

function densePanelIndex(
  source: InstructionSourceV1,
  expectedPrintedSteps: number,
): ReturnType<typeof sampleBookletPanelIndex>["entries"] {
  const panelIndex = sampleBookletPanelIndex(source);
  if (panelIndex.entries.length !== expectedPrintedSteps) {
    throw new TypeError(
      `Panel-source replay requires exactly ${expectedPrintedSteps} indexed printed-step labels; found ${panelIndex.entries.length}.`,
    );
  }
  const indexed = new Array<boolean>(expectedPrintedSteps).fill(false);
  for (let index = 0; index < panelIndex.entries.length; index += 1) {
    const stepNumber = panelIndex.entries[index]!.stepNumber;
    if (
      !Number.isSafeInteger(stepNumber) ||
      stepNumber < 1 ||
      stepNumber > expectedPrintedSteps ||
      indexed[stepNumber - 1]
    ) {
      throw new TypeError(
        `Panel-source replay indexed label ${index} names duplicate or out-of-range step ${String(stepNumber)}; ` +
          `required the exact dense set 1..${expectedPrintedSteps}.`,
      );
    }
    indexed[stepNumber - 1] = true;
  }
  if (indexed.some((present) => !present)) {
    throw new TypeError(
      `Panel-source replay indexed labels must contain every printed step 1..${expectedPrintedSteps}.`,
    );
  }
  return panelIndex.entries;
}

function assertPanelGeometry(
  panels: readonly StepPanel[],
  source: InstructionSourceV1,
  expectedPrintedSteps: number,
): void {
  if (panels.length !== expectedPrintedSteps) {
    throw new TypeError(
      `Panel-source replay derived ${panels.length} panels; required exactly ${expectedPrintedSteps}.`,
    );
  }
  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index]!;
    const page = source.pages[panel.pageNumber - 1];
    const bounds = panel.bounds;
    if (
      panel.stepNumber !== index + 1 ||
      page === undefined ||
      page.pageNumber !== panel.pageNumber ||
      ![
        bounds.minXPt,
        bounds.maxXPt,
        bounds.minYPt,
        bounds.maxYPt,
        panel.labelXPt,
        panel.labelYPt,
      ].every(Number.isFinite) ||
      bounds.minXPt < 0 ||
      bounds.minXPt >= bounds.maxXPt ||
      bounds.maxXPt > page.widthPt ||
      bounds.minYPt < 0 ||
      bounds.minYPt >= bounds.maxYPt ||
      bounds.maxYPt > page.heightPt ||
      !contains(bounds, panel.labelXPt, panel.labelYPt) ||
      panel.quantities.some(
        (quantity) => !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999,
      )
    ) {
      throw new TypeError(
        `Panel-source replay panel ${index} must be exact ordered step ${index + 1} with finite page-bounded geometry containing its label.`,
      );
    }
  }
}

function replayWithExpectedPrintedSteps(
  input: RealBuildReplayPanelSourceInput,
  expectedPrintedSteps: number,
): RealBuildReplayPanelSourceResult {
  if (
    !Number.isSafeInteger(expectedPrintedSteps) ||
    expectedPrintedSteps < 1 ||
    expectedPrintedSteps > EXPECTED_PRINTED_STEPS
  ) {
    throw new RangeError(
      `Panel-source replay expectation must be a safe integer in 1..${EXPECTED_PRINTED_STEPS}.`,
    );
  }
  const fields = snapshotExactDataObject(input, "Panel-source replay input", REPLAY_INPUT_KEYS);
  const pdfBytes = snapshotPdfBytes(fields.pdfBytes);
  const pdfDigest = sha256Digest(pdfBytes);
  const envelope = parseRetainedEnvelope(fields.retainedSourceBytes, expectedPrintedSteps);
  if (envelope.pdfDigest !== pdfDigest || envelope.pdfByteLength !== pdfBytes.byteLength) {
    throw new TypeError(
      `Retained panel-source envelope binds ${envelope.pdfByteLength} bytes at ${JSON.stringify(envelope.pdfDigest)}, ` +
        `but replay received ${pdfBytes.byteLength} bytes hashing to ${pdfDigest}.`,
    );
  }
  const source = envelope.source;
  assertSourcePdfBinding(source, pdfBytes, pdfDigest);
  densePanelIndex(source, expectedPrintedSteps);
  const { manifest, rows } = parseManifest(fields.manifestBytes, pdfDigest);
  const boundRows = bindManifestRows(rows, source, expectedPrintedSteps);
  const orderedRows = [...boundRows].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      left.sourceElementIndex - right.sourceElementIndex ||
      left.identity.localeCompare(right.identity),
  );
  const boxesByPage = new Map<number, PanelCalloutBox[]>();
  for (const row of orderedRows) {
    const boxes = boxesByPage.get(row.pageNumber);
    if (boxes === undefined) boxesByPage.set(row.pageNumber, [row.box]);
    else boxes.push(row.box);
  }
  const panels = [...sampleBookletPanels(source, boxesByPage)].sort(
    (left, right) => left.stepNumber - right.stepNumber,
  );
  assertPanelGeometry(panels, source, expectedPrintedSteps);
  const panelByStep = new Map(panels.map((panel) => [panel.stepNumber, panel]));
  const rowsByStep = new Map<number, BoundManifestRow[]>();
  for (const row of orderedRows) {
    const containingPanels = panels.filter(
      (panel) => panel.pageNumber === row.pageNumber && contains(panel.bounds, row.xPt, row.yPt),
    );
    if (containingPanels.length !== 1) {
      throw new TypeError(
        `Panel-source replay manifest row ${JSON.stringify(row.identity)} must lie in exactly one independently derived panel; found ${containingPanels.length}.`,
      );
    }
    const derivedPanel = containingPanels[0]!;
    if (derivedPanel.stepNumber !== row.stepNumber || derivedPanel.pageNumber !== row.pageNumber) {
      throw new TypeError(
        `Panel-source replay manifest row ${JSON.stringify(row.identity)} declares step/page ` +
          `${row.stepNumber}/${row.pageNumber}, but independent retained-text containment derives ` +
          `${derivedPanel.stepNumber}/${derivedPanel.pageNumber}.`,
      );
    }
    const stepRows = rowsByStep.get(derivedPanel.stepNumber);
    if (stepRows === undefined) rowsByStep.set(derivedPanel.stepNumber, [row]);
    else stepRows.push(row);
  }
  const calloutBoxesByStep: Record<number, readonly PanelCalloutBox[]> = {};
  const panelEvidenceByStep: Record<number, RealBuildReplayPanelEvidenceEntry> = {};
  for (let stepNumber = 1; stepNumber <= expectedPrintedSteps; stepNumber += 1) {
    const panel = panelByStep.get(stepNumber);
    if (panel === undefined) {
      throw new TypeError(`Panel-source replay omitted required ordered panel ${stepNumber}.`);
    }
    const calloutBoxes = (rowsByStep.get(stepNumber) ?? []).map((row) => row.box);
    calloutBoxesByStep[stepNumber] = calloutBoxes;
    panelEvidenceByStep[stepNumber] = {
      pageNumber: panel.pageNumber,
      digest: stepPanelEvidenceDigest({
        pdfDigest,
        stepNumber,
        pageNumber: panel.pageNumber,
        bounds: panel.bounds,
        calloutBoxes,
      }),
    };
  }
  const requestedLastStep = envelope.requestedLastStep;
  const observationThrough = observationThroughStep(requestedLastStep, expectedPrintedSteps);
  const observationPanels = panels.slice(0, observationThrough);
  const requiredShapePages = [
    ...new Set(observationPanels.map(({ pageNumber }) => pageNumber)),
  ].sort((left, right) => left - right);
  const retainedPageShapes = snapshotRetainedPageShapes(
    envelope.pageShapes,
    source,
    requiredShapePages,
  );
  const transitionFeatures = deriveTransitionPanelFeatures({
    panels: observationPanels,
    calloutBoxesByStep,
    panelEvidenceByStep,
    shapesByPage: new Map(retainedPageShapes.map((row) => [row.pageNumber, row.shapes])),
    expectedPrintedSteps,
  });
  const panelFaceByStep = Object.fromEntries(
    transitionFeatures.map(({ stepNumber, panelFace }) => [stepNumber, panelFace]),
  ) as Record<number, PanelFace>;
  if (transitionFeatures.length !== observationThrough) {
    throw new TypeError(
      `Retained panel-source face replay derived ${transitionFeatures.length}/${observationThrough} bounded observation steps.`,
    );
  }
  return deepFreeze({
    pdfDigest,
    source,
    requestedLastStep,
    observationThroughStep: observationThrough,
    manifestCalloutCount: manifest.calloutCount as number,
    panels,
    calloutBoxesByStep,
    panelEvidenceByStep,
    panelFaceByStep,
    authority: {
      sourceText: "retained-derived-local-diagnostic",
      pageShapes: "retained-derived-local-diagnostic",
      pdfParserReplay: "not-performed",
      sourceExecution: "absent",
      preparedRun: "absent",
      placement: "absent",
      completion: "absent",
    },
  });
}

/** Replays the production source/index contract and permits no prefix projection. */
export function replayRealBuildPanelSource(
  input: RealBuildReplayPanelSourceInput,
): RealBuildReplayPanelSourceResult {
  return replayWithExpectedPrintedSteps(input, EXPECTED_PRINTED_STEPS);
}

export const __testOnly = Object.freeze({
  encodeRealBuildRetainedPanelSourceWithExpectedPrintedSteps(
    input: Parameters<typeof encodeRealBuildRetainedPanelSource>[0],
    expectedPrintedSteps: number,
  ): Uint8Array {
    return encodeWithExpectedPrintedSteps(input, expectedPrintedSteps);
  },
  /** Small fixtures only; production always calls replayRealBuildPanelSource's fixed 359-step path. */
  replayRealBuildPanelSourceWithExpectedPrintedSteps(
    input: RealBuildReplayPanelSourceInput,
    expectedPrintedSteps: number,
  ): RealBuildReplayPanelSourceResult {
    return replayWithExpectedPrintedSteps(input, expectedPrintedSteps);
  },
});
