import { UNLIMITED, type Budget } from "./budget";
import { IDENTIFY_LIMITS } from "./limits";
import {
  decodeImage,
  scanPage,
  textRunsOf,
  type PdfjsDocumentLike,
  type PdfjsLike,
} from "./pdf-scan";
import { extractPictures, type Picture } from "./pictures";
import { compositeRegion } from "./raster";
import { framingBox, planRegions, type LabelBox } from "./regions";
import {
  calloutLabels,
  inventoryLabels,
  inventoryPages,
  stepNumbers,
  type CountLabel,
  type InventoryLabel,
  type StepNumber,
} from "./text-tokens";
import type { DecodedImage, IdentifyParameters, PageScan, Rect, UnpairedElementId } from "./types";

/**
 * Reads the booklet twice: once for text, which decides which pages matter and
 * what every label says, and once for images, only on the pages that print a
 * count label. Each page's decoded images are dropped as soon as its pictures are
 * cut, so memory stays at one page of artwork. Every pdf.js call is raced against
 * the run's time limit, and every page is held to `IDENTIFY_LIMITS`.
 */
export interface CollectedCallout {
  readonly label: CountLabel;
  readonly box: Rect | null;
  readonly step: number | null;
  readonly picture: Picture | null;
}

export interface CollectedInventory {
  readonly label: InventoryLabel;
  readonly picture: Picture | null;
}

export interface Collected {
  readonly pageCount: number;
  readonly inventoryPages: readonly number[];
  readonly unpairedElementIds: readonly UnpairedElementId[];
  readonly inventory: readonly CollectedInventory[];
  readonly callouts: readonly CollectedCallout[];
  readonly labelSizePt: number | null;
  readonly duplicateRuns: number;
  readonly otherSizeCountLabels: number;
  readonly stepNumbers: readonly StepNumber[];
  readonly timingsMs: Readonly<Record<string, number>>;
}

export type Progress = (stage: string, done: number, total: number) => void;

const EXPECTED_RISE_RATIO = 0.93;

/** The printed step whose number sits under a callout box, aligned with its left edge. */
export function stepForBox(
  box: Rect | null,
  page: number,
  steps: readonly StepNumber[],
): number | null {
  if (box === null) return null;
  let best: StepNumber | null = null;
  for (const s of steps) {
    if (s.page !== page || Math.abs(s.xPt - box.x0) > 3) continue;
    if (s.yPt + 0.75 * s.sizePt > box.y0 + 2) continue;
    if (best === null || s.yPt > best.yPt) best = s;
  }
  return best?.step ?? null;
}

function checkPageExtent(pageNumber: number, viewport: { width: number; height: number }): void {
  const limit = IDENTIFY_LIMITS.maxPageExtentPt;
  const readable = [viewport.width, viewport.height].every(
    (extent) => Number.isFinite(extent) && extent > 0 && extent <= limit,
  );
  if (!readable) {
    throw new Error(
      `Page ${pageNumber} measures ${viewport.width} x ${viewport.height} pt, outside the 0 to ${limit} pt a booklet page is read at (the sample booklet's pages are 765 x 544 pt). Pass an instruction booklet.`,
    );
  }
}

/** Adds one page's text to the running total, refusing a page or a booklet over its limit. */
function countText(scan: PageScan, before: number): number {
  const chars = scan.texts.reduce((sum, run) => sum + run.text.length, 0);
  if (chars > IDENTIFY_LIMITS.maxTextCharsPerPage) {
    throw new Error(
      `Page ${scan.pageNumber}'s text layer holds ${chars} characters, over the ${IDENTIFY_LIMITS.maxTextCharsPerPage}-character limit for one page (the sample booklet's busiest page holds 1,350). Pass an instruction booklet.`,
    );
  }
  const total = before + chars;
  if (total > IDENTIFY_LIMITS.maxTotalTextChars) {
    throw new Error(
      `The text layer reaches ${total} characters by page ${scan.pageNumber}, over the ${IDENTIFY_LIMITS.maxTotalTextChars}-character limit for a booklet (the sample booklet holds 14,228). Pass a single instruction booklet.`,
    );
  }
  return total;
}

/** Refuses a page, or a booklet, printing more count labels than any booklet does. */
function checkLabelCounts(labelsByPage: ReadonlyMap<number, number>): void {
  let total = 0;
  for (const [page, count] of labelsByPage) {
    if (count > IDENTIFY_LIMITS.maxCountLabelsPerPage) {
      throw new Error(
        `Page ${page} prints ${count} count labels such as "2x", over the ${IDENTIFY_LIMITS.maxCountLabelsPerPage} one page is read with (the sample booklet's busiest page, in its inventory, prints 152). Pass an instruction booklet.`,
      );
    }
    total += count;
  }
  if (total > IDENTIFY_LIMITS.maxCountLabels) {
    throw new Error(
      `The PDF prints ${total} count labels such as "2x", over the ${IDENTIFY_LIMITS.maxCountLabels} a booklet is read with (the sample booklet prints 1,140). Pass a single instruction booklet.`,
    );
  }
}

interface PageWork {
  readonly pdfjs: PdfjsLike;
  readonly document: PdfjsDocumentLike;
  readonly params: IdentifyParameters;
  readonly budget: Budget;
}

async function pagePictures(
  { pdfjs, document, params, budget }: PageWork,
  pageNumber: number,
  labels: readonly LabelBox[],
  useBoxes: boolean,
  pxPerPt: number,
): Promise<{ scan: PageScan; pictures: Map<number, Picture> }> {
  const where = `page ${pageNumber} (cutting pictures)`;
  const page = await budget.race(document.getPage(pageNumber), where);
  try {
    const scan = await budget.race(scanPage(pdfjs, page, pageNumber), where);
    const plans = planRegions(scan, labels, { useBoxes });
    const images = new Map<string, DecodedImage>();
    let decoded = 0;
    for (const key of new Set(plans.flatMap((plan) => plan.paints.map((p) => p.imageKey)))) {
      const image = await budget.race(decodeImage(page, key, pageNumber), where);
      decoded += image.width * image.height;
      if (decoded > IDENTIFY_LIMITS.maxDecodedPixelsPerPage) {
        throw new Error(
          `Page ${pageNumber}'s callout pictures are cut from images holding ${decoded} decoded pixels by image ${JSON.stringify(key)}, over the ${IDENTIFY_LIMITS.maxDecodedPixelsPerPage}-pixel limit for one page (the sample booklet's heaviest page needs 517,094). Pass an instruction booklet.`,
        );
      }
      images.set(key, image);
    }
    const pictures = new Map<number, Picture>();
    for (const plan of plans) {
      budget.check(where);
      const raster = compositeRegion(
        plan.rect,
        pxPerPt,
        plan.paints,
        images,
        params.backgroundTolerance,
        { pageNumber, labels: plan.labels.length },
      );
      const cut = extractPictures(plan, labels, raster, images, {
        pageNumber,
        backgroundTolerance: params.backgroundTolerance,
        expectedRiseRatio: EXPECTED_RISE_RATIO,
        minComponentPx: 3,
      });
      for (const [label, picture] of cut) pictures.set(label, picture);
    }
    return { scan, pictures };
  } finally {
    page.cleanup();
  }
}

async function readText(
  document: PdfjsDocumentLike,
  budget: Budget,
  onProgress: Progress,
): Promise<PageScan[]> {
  const textScans: PageScan[] = [];
  let totalChars = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const where = `page ${pageNumber} (reading text)`;
    const page = await budget.race(document.getPage(pageNumber), where);
    try {
      const viewport = page.getViewport({ scale: 1 });
      checkPageExtent(pageNumber, viewport);
      const content = await budget.race(page.getTextContent(), where);
      const scan = scanTextOnly(pageNumber, viewport, content.items);
      totalChars = countText(scan, totalChars);
      textScans.push(scan);
    } finally {
      page.cleanup();
    }
    onProgress("text", pageNumber, document.numPages);
  }
  return textScans;
}

export async function collectBooklet(
  pdfjs: PdfjsLike,
  document: PdfjsDocumentLike,
  params: IdentifyParameters,
  onProgress: Progress = () => {},
  now: () => number = () => performance.now(),
  budget: Budget = UNLIMITED,
): Promise<Collected> {
  const started = now();
  const textScans = await readText(document, budget, onProgress);
  const textDone = now();

  const inventoryPageList = inventoryPages(textScans);
  const inventorySet = new Set(inventoryPageList);
  const inventoryByPage = new Map<number, InventoryLabel[]>();
  const unpaired: UnpairedElementId[] = [];
  for (const scan of textScans) {
    if (!inventorySet.has(scan.pageNumber)) continue;
    const { labels, unpairedIds } = inventoryLabels(scan);
    inventoryByPage.set(scan.pageNumber, labels);
    for (const elementId of unpairedIds) unpaired.push({ elementId, page: scan.pageNumber });
  }
  if ([...inventoryByPage.values()].every((labels) => labels.length === 0)) {
    throw new Error(
      `identifyBooklet found no parts inventory in the ${document.numPages} pages of this PDF: no page prints at least 8 element ids, each under a count label such as "2x". Callouts are matched against that inventory; pass an instruction booklet that ends with its parts list.`,
    );
  }
  const callouts = calloutLabels(textScans, inventorySet);
  const steps = stepNumbers(textScans.filter((scan) => !inventorySet.has(scan.pageNumber)));
  // A callout's step is on its own page, so each callout looks through that page's numbers only.
  const stepsByPage = new Map<number, StepNumber[]>();
  for (const step of steps) {
    const here = stepsByPage.get(step.page);
    if (here) here.push(step);
    else stepsByPage.set(step.page, [step]);
  }
  const calloutsByPage = new Map<number, CountLabel[]>();
  for (const label of callouts.labels) {
    const here = calloutsByPage.get(label.page);
    if (here) here.push(label);
    else calloutsByPage.set(label.page, [label]);
  }
  const labelsByPage = new Map<number, number>();
  for (const [page, labels] of [...inventoryByPage, ...calloutsByPage])
    labelsByPage.set(page, (labelsByPage.get(page) ?? 0) + labels.length);
  checkLabelCounts(labelsByPage);

  const work: PageWork = { pdfjs, document, params, budget };
  const inventory: CollectedInventory[] = [];
  const collected: CollectedCallout[] = [];
  const pages = [...labelsByPage.keys()].sort((a, b) => a - b);
  for (const [done, pageNumber] of pages.entries()) {
    const inventoryLabelsHere = inventoryByPage.get(pageNumber);
    if (inventoryLabelsHere) {
      const { pictures } = await pagePictures(
        work,
        pageNumber,
        inventoryLabelsHere,
        false,
        params.gridPxPerPt,
      );
      inventoryLabelsHere.forEach((label, i) =>
        inventory.push({ label, picture: pictures.get(i) ?? null }),
      );
    }
    const calloutLabelsHere = calloutsByPage.get(pageNumber);
    if (calloutLabelsHere) {
      const { scan, pictures } = await pagePictures(
        work,
        pageNumber,
        calloutLabelsHere,
        true,
        params.gridPxPerPt / params.calloutScale,
      );
      calloutLabelsHere.forEach((label, i) => {
        const box = framingBox(scan, label);
        collected.push({
          label,
          box,
          step: stepForBox(box, pageNumber, stepsByPage.get(pageNumber) ?? []),
          picture: pictures.get(i) ?? null,
        });
      });
    }
    onProgress("images", done + 1, pages.length);
  }
  return {
    pageCount: document.numPages,
    inventoryPages: inventoryPageList,
    unpairedElementIds: unpaired,
    inventory,
    callouts: collected,
    labelSizePt: callouts.sizePt,
    duplicateRuns: callouts.duplicates,
    otherSizeCountLabels: callouts.otherSizes,
    stepNumbers: steps,
    timingsMs: { text: Math.round(textDone - started), images: Math.round(now() - textDone) },
  };
}

function scanTextOnly(
  pageNumber: number,
  viewport: { readonly width: number; readonly height: number },
  items: readonly unknown[],
): PageScan {
  return {
    pageNumber,
    widthPt: viewport.width,
    heightPt: viewport.height,
    texts: textRunsOf(items),
    paints: [],
    fills: [],
  };
}
