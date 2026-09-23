import { readFileSync } from "node:fs";

import {
  selectStepNumberHeight,
  withoutPrintedPageNumbers,
  type NumberSighting,
} from "../../apps/web/src/instructions/booklet-structure.ts";
import {
  ingestInstructionPdf,
  type PdfDocument,
} from "../../apps/web/src/instructions/ingest-pdf.ts";
import type { InstructionSourceV1 } from "../../apps/web/src/instructions/instruction-source.ts";
import {
  checkInventoryConsistency,
  extractPartsInventory,
  findInventoryPages,
  PARTS_INVENTORY_DEFAULTS,
} from "../../apps/web/src/instructions/parts-inventory.ts";
import {
  bagNumberOn,
  calloutHeight,
  owningStep,
  quantityLabels,
  removeOverprints,
  type StepSighting,
} from "./read-layout.ts";

/**
 * Stage 1: what the booklet's text layer says, checked against itself.
 *
 * Step numbers must run 1..N once each in page order, and every parts-callout
 * quantity must belong to exactly one step or be explained. What the text
 * layer cannot explain on its own — inventory pieces no step calls out — is
 * left for the answer key to name (stage 2), never guessed.
 */
export const READ_STAGE_VERSION = "lego.booklet-read/1";

export interface PrintedStep {
  readonly step: number;
  readonly page: number;
  /** Callout quantities, top row first, left to right. */
  readonly callouts: readonly number[];
  readonly pieces: number;
}

export interface CalloutException {
  readonly kind: "bag-panel" | "multiplier" | "orphan-callout";
  readonly page: number;
  readonly quantities: readonly number[];
  readonly pieces: number;
  readonly explanation: string;
}

export interface BookletRead {
  readonly version: typeof READ_STAGE_VERSION;
  readonly sourceHash: string;
  readonly pageCount: number;
  readonly overprintsRemoved: number;
  readonly stepHeightPt: number | null;
  readonly calloutHeightPt: number | null;
  readonly steps: readonly PrintedStep[];
  readonly sequence: {
    readonly highest: number;
    readonly contiguous: boolean;
    readonly missing: readonly number[];
    readonly duplicates: readonly number[];
    /** Steps printed on an earlier page than the step before them. */
    readonly outOfPageOrder: readonly number[];
    readonly firstPage: number | null;
    readonly lastPage: number | null;
  };
  /** Every callout-size "Nx" label outside the inventory pages. */
  readonly calloutLabels: { readonly tokens: number; readonly pieces: number };
  /** The subset owned by a step. */
  readonly stepCallouts: { readonly tokens: number; readonly pieces: number };
  /** Pages that print a bag number, the page each numbered bag is opened on. */
  readonly bagOpenings: readonly { readonly bag: number; readonly page: number }[];
  readonly exceptions: readonly CalloutException[];
  readonly inventory: {
    readonly pages: readonly number[];
    readonly rows: number;
    readonly pieces: number;
    readonly distinctElements: number;
    readonly unpaired: number;
    readonly findings: readonly string[];
    readonly quantities: Readonly<Record<string, number>>;
  };
}

function sequenceOf(steps: readonly PrintedStep[]): BookletRead["sequence"] {
  const numbers = steps.map(({ step }) => step);
  const highest = numbers.length === 0 ? 0 : Math.max(...numbers);
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const value of numbers) (seen.has(value) ? duplicates : seen).add(value);
  const missing: number[] = [];
  for (let step = 1; step <= highest; step += 1) if (!seen.has(step)) missing.push(step);
  const pageOf = new Map(steps.map(({ step, page }) => [step, page] as const));
  const outOfPageOrder = [...seen]
    .sort((left, right) => left - right)
    .filter((step) => pageOf.has(step - 1) && pageOf.get(step)! < pageOf.get(step - 1)!);
  return {
    highest,
    contiguous:
      highest > 0 && missing.length === 0 && duplicates.size === 0 && outOfPageOrder.length === 0,
    missing,
    duplicates: [...duplicates].sort((left, right) => left - right),
    outOfPageOrder,
    firstPage: steps.length === 0 ? null : Math.min(...steps.map(({ page }) => page)),
    lastPage: steps.length === 0 ? null : Math.max(...steps.map(({ page }) => page)),
  };
}

/** Reads a booklet already ingested to text. Pure, so fixtures can drive it. */
export function readBookletSource(ingested: InstructionSourceV1): BookletRead {
  const { source, removed } = removeOverprints(ingested);
  const inventoryPages = new Set(findInventoryPages(source, PARTS_INVENTORY_DEFAULTS));

  const sightings: (NumberSighting & { xPt: number; yPt: number })[] = source.pages.flatMap(
    (page) =>
      page.textElements
        .filter(({ text }) => /^\d{1,4}$/u.test(text))
        .map(({ text, heightPt, xPt, yPt }) => ({
          value: Number(text),
          pageNumber: page.pageNumber,
          heightPt: Math.round(heightPt * 10) / 10,
          xPt,
          yPt,
        })),
  );
  const stepHeightPt = selectStepNumberHeight(sightings);
  const stepSightings: StepSighting[] =
    stepHeightPt === null
      ? []
      : (withoutPrintedPageNumbers(sightings) as typeof sightings)
          .filter(({ heightPt }) => heightPt === stepHeightPt)
          .map(({ value, pageNumber, xPt, yPt }) => ({ step: value, page: pageNumber, xPt, yPt }));

  const calloutHeightPt = calloutHeight(source, inventoryPages);
  const owned = new Map<StepSighting, { quantity: number; xPt: number; yPt: number }[]>(
    stepSightings.map((sighting) => [sighting, []]),
  );
  const exceptions: CalloutException[] = [];
  let calloutTokens = 0;
  let calloutPieces = 0;
  for (const page of source.pages) {
    if (inventoryPages.has(page.pageNumber)) continue;
    const labels = quantityLabels(page);
    const stepsHere = stepSightings.filter(({ page: at }) => at === page.pageNumber);
    const multipliers = labels.filter(
      ({ heightPt }) => calloutHeightPt !== null && heightPt > calloutHeightPt,
    );
    for (const label of multipliers) {
      exceptions.push({
        kind: "multiplier",
        page: page.pageNumber,
        quantities: [label.quantity],
        pieces: 0,
        explanation: `"${label.quantity}x" set at ${label.heightPt}pt, larger than the ${calloutHeightPt}pt callouts: a sub-build repeat count, not a part quantity`,
      });
    }
    const callouts = labels.filter(({ heightPt }) => heightPt === calloutHeightPt);
    calloutTokens += callouts.length;
    calloutPieces += callouts.reduce((sum, { quantity }) => sum + quantity, 0);
    if (stepsHere.length === 0 && callouts.length > 0) {
      const bag = bagNumberOn(page, stepHeightPt, (stepHeightPt ?? 0) + 4);
      exceptions.push({
        kind: "bag-panel",
        page: page.pageNumber,
        quantities: callouts.map(({ quantity }) => quantity),
        pieces: callouts.reduce((sum, { quantity }) => sum + quantity, 0),
        explanation: `page ${page.pageNumber} prints no step number${bag === null ? "" : ` and opens bag ${bag}`}; its callouts show parts packed outside the numbered bags, which later step callouts list again`,
      });
      continue;
    }
    for (const label of callouts) {
      const step = owningStep(label, stepsHere);
      if (step === null) {
        exceptions.push({
          kind: "orphan-callout",
          page: page.pageNumber,
          quantities: [label.quantity],
          pieces: label.quantity,
          explanation: `"${label.quantity}x" at (${label.xPt.toFixed(1)}, ${label.yPt.toFixed(1)}) on page ${page.pageNumber} has no step number below it in its column`,
        });
        continue;
      }
      owned.get(step)!.push(label);
    }
  }

  const steps: PrintedStep[] = [...owned.entries()]
    .map(([sighting, labels]) => {
      const ordered = [...labels].sort(
        (left, right) => right.yPt - left.yPt || left.xPt - right.xPt,
      );
      return {
        step: sighting.step,
        page: sighting.page,
        callouts: ordered.map(({ quantity }) => quantity),
        pieces: ordered.reduce((sum, { quantity }) => sum + quantity, 0),
      };
    })
    .sort((left, right) => left.step - right.step || left.page - right.page);

  const bagOpenings = source.pages.flatMap((page) => {
    if (inventoryPages.has(page.pageNumber)) return [];
    const bag = bagNumberOn(page, stepHeightPt, (stepHeightPt ?? 0) + 4);
    return bag === null ? [] : [{ bag, page: page.pageNumber }];
  });
  const inventory = extractPartsInventory(source);
  const consistency = checkInventoryConsistency(inventory);
  const quantities: Record<string, number> = {};
  for (const entry of inventory.entries) {
    quantities[entry.elementId] = (quantities[entry.elementId] ?? 0) + entry.quantity;
  }
  return {
    version: READ_STAGE_VERSION,
    sourceHash: ingested.contentHash,
    pageCount: ingested.pageCount,
    overprintsRemoved: removed,
    stepHeightPt,
    calloutHeightPt,
    steps,
    sequence: sequenceOf(steps),
    calloutLabels: { tokens: calloutTokens, pieces: calloutPieces },
    stepCallouts: {
      tokens: steps.reduce((sum, { callouts }) => sum + callouts.length, 0),
      pieces: steps.reduce((sum, { pieces }) => sum + pieces, 0),
    },
    bagOpenings,
    exceptions,
    inventory: {
      pages: inventory.pageNumbers,
      rows: inventory.entries.length,
      pieces: inventory.totalPieces,
      distinctElements: inventory.distinctElements,
      unpaired: inventory.unpaired.length,
      findings: consistency.findings.map(({ message }) => message),
      quantities,
    },
  };
}

/** Reads the booklet PDF at `path` with pdf.js, the rasterizer and text reader of record. */
export async function readBookletPdf(path: string): Promise<BookletRead> {
  const bytes = readFileSync(path);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const source = await ingestInstructionPdf(
    { name: path, arrayBuffer: async () => buffer },
    {
      loadPdf: async (data) =>
        (await pdfjs.getDocument({ data, isEvalSupported: false, verbosity: 0 })
          .promise) as unknown as PdfDocument,
    },
  );
  return readBookletSource(source);
}
