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
import type { DecodedImage, IdentifyParameters, PageScan, Rect } from "./types";

/**
 * Reads the booklet twice: once for text, which decides which pages matter and
 * what every label says, and once for images, only on the pages that print a
 * count label. Each page's decoded images are dropped as soon as its pictures are
 * cut, so memory stays at one page of artwork.
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
  readonly unpairedElementIds: readonly string[];
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

async function pagePictures(
  pdfjs: PdfjsLike,
  document: PdfjsDocumentLike,
  pageNumber: number,
  labels: readonly LabelBox[],
  useBoxes: boolean,
  pxPerPt: number,
  params: IdentifyParameters,
): Promise<{ scan: PageScan; pictures: Map<number, Picture> }> {
  const page = await document.getPage(pageNumber);
  try {
    const scan = await scanPage(pdfjs, page, pageNumber);
    const plans = planRegions(scan, labels, { useBoxes });
    const images = new Map<string, DecodedImage>();
    for (const key of new Set(plans.flatMap((plan) => plan.paints.map((p) => p.imageKey)))) {
      images.set(key, await decodeImage(page, key, pageNumber));
    }
    const pictures = new Map<number, Picture>();
    for (const plan of plans) {
      const raster = compositeRegion(
        plan.rect,
        pxPerPt,
        plan.paints,
        images,
        params.backgroundTolerance,
      );
      const cut = extractPictures(plan, labels, raster, images, {
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

export async function collectBooklet(
  pdfjs: PdfjsLike,
  document: PdfjsDocumentLike,
  params: IdentifyParameters,
  onProgress: Progress = () => {},
  now: () => number = () => performance.now(),
): Promise<Collected> {
  const started = now();
  const textScans: PageScan[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    try {
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      textScans.push(scanTextOnly(pageNumber, viewport, content.items));
    } finally {
      page.cleanup();
    }
    onProgress("text", pageNumber, document.numPages);
  }
  const textDone = now();

  const inventoryPageList = inventoryPages(textScans);
  const inventorySet = new Set(inventoryPageList);
  const inventoryByPage = new Map<number, InventoryLabel[]>();
  const unpaired: string[] = [];
  for (const scan of textScans) {
    if (!inventorySet.has(scan.pageNumber)) continue;
    const { labels, unpairedIds } = inventoryLabels(scan);
    inventoryByPage.set(scan.pageNumber, labels);
    unpaired.push(...unpairedIds);
  }
  if ([...inventoryByPage.values()].every((labels) => labels.length === 0)) {
    throw new Error(
      `identifyBooklet found no parts inventory in the ${document.numPages} pages of this PDF: no page prints at least 8 element ids, each under a count label such as "2x". Callouts are matched against that inventory; pass an instruction booklet that ends with its parts list.`,
    );
  }
  const callouts = calloutLabels(textScans, inventorySet);
  const steps = stepNumbers(textScans.filter((scan) => !inventorySet.has(scan.pageNumber)));
  const calloutsByPage = new Map<number, CountLabel[]>();
  for (const label of callouts.labels) {
    calloutsByPage.set(label.page, [...(calloutsByPage.get(label.page) ?? []), label]);
  }

  const inventory: CollectedInventory[] = [];
  const collected: CollectedCallout[] = [];
  const pages = [...new Set([...inventoryByPage.keys(), ...calloutsByPage.keys()])].sort(
    (a, b) => a - b,
  );
  for (const [done, pageNumber] of pages.entries()) {
    const inventoryLabelsHere = inventoryByPage.get(pageNumber);
    if (inventoryLabelsHere) {
      const { pictures } = await pagePictures(
        pdfjs,
        document,
        pageNumber,
        inventoryLabelsHere,
        false,
        params.gridPxPerPt,
        params,
      );
      inventoryLabelsHere.forEach((label, i) =>
        inventory.push({ label, picture: pictures.get(i) ?? null }),
      );
    }
    const calloutLabelsHere = calloutsByPage.get(pageNumber);
    if (calloutLabelsHere) {
      const { scan, pictures } = await pagePictures(
        pdfjs,
        document,
        pageNumber,
        calloutLabelsHere,
        true,
        params.gridPxPerPt / params.calloutScale,
        params,
      );
      calloutLabelsHere.forEach((label, i) => {
        const box = framingBox(scan, label);
        collected.push({
          label,
          box,
          step: stepForBox(box, pageNumber, steps),
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
