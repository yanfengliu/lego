import {
  extractBookletStructure,
  selectStepNumberHeight,
} from "../src/instructions/booklet-structure";
import { ingestInstructionPdf, type PdfDocument } from "../src/instructions/ingest-pdf";
import {
  INSTRUCTION_PDF_LIMITS,
  type InstructionSourceV1,
} from "../src/instructions/instruction-source";
import { extractPageShapes, type OperatorList } from "../src/instructions/page-shapes";
import {
  deriveStepPanels,
  type PanelCalloutBox,
  type StepPanel,
} from "../src/instructions/step-panels";
import { readBoundedRegularFile } from "./bounded-file-read";
import { SAMPLE_BOOKLET_PATH } from "./sample-booklet";

/**
 * Reading the sample booklet the way every probe needs it.
 *
 * Ingest, structure, panels and callout boxes were copied between probes, which
 * is how one of them ended up with a stale step-number height. They live here
 * once so a fix reaches every caller.
 */

export interface SampleBooklet {
  readonly bytes: Buffer;
  readonly source: InstructionSourceV1;
}

export const SAMPLE_BOOKLET_MAXIMUM_BYTES = INSTRUCTION_PDF_LIMITS.maxBytes;

export function readSampleBookletBytes(path: string): Buffer {
  return readBoundedRegularFile(path, {
    label: "Sample instruction booklet 6651557.pdf",
    maximumBytes: SAMPLE_BOOKLET_MAXIMUM_BYTES,
  });
}

export function exactSampleBookletArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function readSampleBooklet(): Promise<SampleBooklet> {
  if (SAMPLE_BOOKLET_PATH === null) {
    throw new Error(
      "readSampleBooklet needs recipes/6651557.pdf, which is uncommitted and absent from this checkout; guard the caller with hasSampleBooklet.",
    );
  }
  const bytes = readSampleBookletBytes(SAMPLE_BOOKLET_PATH);
  const source = await ingestInstructionPdf(
    {
      name: "6651557.pdf",
      arrayBuffer: async () => exactSampleBookletArrayBuffer(bytes),
    },
    {
      loadPdf: async () => {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        return (await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
          .promise) as unknown as PdfDocument;
      },
    },
  );
  return { bytes, source };
}

/**
 * Every printed step, with the cell of its page it owns.
 *
 * Pass callout boxes where they are known: they put a row cut between one
 * step's artwork and the next step's callout box instead of at the midpoint
 * between step numbers, which lands inside the artwork above it.
 */
export function sampleBookletPanels(
  source: InstructionSourceV1,
  calloutBoxesByPage?: ReadonlyMap<number, readonly PanelCalloutBox[]> | undefined,
): readonly StepPanel[] {
  extractBookletStructure(source);
  const sightings = source.pages.flatMap((page) =>
    page.textElements
      .filter(({ text }) => /^\d{1,4}$/.test(text))
      .map(({ text, heightPt }) => ({
        value: Number(text),
        pageNumber: page.pageNumber,
        heightPt: Math.round(heightPt * 10) / 10,
      })),
  );
  const stepNumberHeightPt = selectStepNumberHeight(sightings);
  if (stepNumberHeightPt === null) {
    throw new Error(
      "No step-number glyph height stood out in the booklet's bare integers, so panels cannot be derived; the booklet may not be an instruction booklet.",
    );
  }
  return deriveStepPanels(source, { stepNumberHeightPt, calloutBoxesByPage });
}

export interface SampleCallout {
  readonly pageNumber: number;
  /** The panel whose band the label sits in, or null if it sits in none. */
  readonly stepNumber: number | null;
  readonly quantity: number;
  readonly box: {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  };
}

/**
 * The `Nx` callouts printed on the given pages, each bounded by the smallest
 * filled shape containing it and attributed to the step whose panel it lies in.
 */
export async function sampleBookletCallouts(
  bytes: Buffer,
  source: InstructionSourceV1,
  pages: readonly number[],
): Promise<readonly SampleCallout[]> {
  const boxesByPage = await sampleBookletCalloutBoxes(bytes, source, pages);
  // Panels second: the cells depend on where the callout boxes are.
  const panels = sampleBookletPanels(
    source,
    new Map([...boxesByPage].map(([page, entries]) => [page, entries.map(({ box }) => box)])),
  );
  return [...boxesByPage].flatMap(([pageNumber, boxes]) =>
    boxes.map((entry) => {
      const panel = panels.find(
        ({ pageNumber: page, bounds }) =>
          page === pageNumber &&
          entry.labelXPt >= bounds.minXPt &&
          entry.labelXPt < bounds.maxXPt &&
          entry.labelYPt >= bounds.minYPt &&
          entry.labelYPt < bounds.maxYPt,
      );
      return {
        pageNumber,
        stepNumber: panel?.stepNumber ?? null,
        quantity: entry.quantity,
        box: entry.box,
      };
    }),
  );
}

export interface SampleCalloutBox {
  readonly quantity: number;
  readonly labelXPt: number;
  readonly labelYPt: number;
  readonly box: PanelCalloutBox;
}

/**
 * The `Nx` callouts on the given pages with the box each sits in, before any
 * step is known. Panels need these to place their row cuts, so this cannot
 * itself depend on panels.
 */
export async function sampleBookletCalloutBoxes(
  bytes: Buffer,
  source: InstructionSourceV1,
  pages: readonly number[],
): Promise<ReadonlyMap<number, readonly SampleCalloutBox[]>> {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false })
    .promise;
  const codes = {
    setFillRGBColor: OPS.setFillRGBColor,
    constructPath: OPS.constructPath,
    fill: OPS.fill,
    eoFill: OPS.eoFill,
    fillStroke: OPS.fillStroke,
    save: OPS.save,
    restore: OPS.restore,
    transform: OPS.transform,
  };

  const byPage = new Map<number, SampleCalloutBox[]>();
  for (const pageNumber of pages) {
    const sourcePage = source.pages.find((page) => page.pageNumber === pageNumber);
    if (!sourcePage) continue;

    // The text layer draws a label's glyph run more than once at the very same
    // spot — six "4x" at one point on page 111 — and each repeat would become
    // its own callout for the same picture.
    const seen = new Set<string>();
    const labels = sourcePage.textElements
      .map((element) => ({ element, match: /^(\d{1,3})x$/.exec(element.text) }))
      .filter(({ match }) => match !== null)
      .map(({ element, match }) => ({
        quantity: Number(match![1]),
        xPt: element.xPt,
        yPt: element.yPt,
      }))
      .filter(({ quantity, xPt, yPt }) => {
        const key = `${quantity}@${xPt.toFixed(1)},${yPt.toFixed(1)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (labels.length === 0) continue;

    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const pageArea = viewport.width * viewport.height;
    const boxes = extractPageShapes(
      (await page.getOperatorList()) as unknown as OperatorList,
      codes,
    ).filter(({ bounds }) => {
      const width = bounds.maxXPt - bounds.minXPt;
      const height = bounds.maxYPt - bounds.minYPt;
      return width > 25 && height > 25 && width * height < pageArea * 0.5;
    });

    const entries: SampleCalloutBox[] = [];
    for (const label of labels) {
      const containing = boxes
        .filter(
          ({ bounds }) =>
            label.xPt >= bounds.minXPt &&
            label.xPt <= bounds.maxXPt &&
            label.yPt >= bounds.minYPt &&
            label.yPt <= bounds.maxYPt,
        )
        .sort(
          (left, right) =>
            (left.bounds.maxXPt - left.bounds.minXPt) * (left.bounds.maxYPt - left.bounds.minYPt) -
            (right.bounds.maxXPt - right.bounds.minXPt) *
              (right.bounds.maxYPt - right.bounds.minYPt),
        );
      const box = containing[0]?.bounds;
      if (!box) continue;
      entries.push({ quantity: label.quantity, labelXPt: label.xPt, labelYPt: label.yPt, box });
    }
    byPage.set(pageNumber, entries);
  }
  await document.destroy();
  return byPage;
}
