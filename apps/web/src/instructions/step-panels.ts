import type {
  InstructionPage,
  InstructionSourceV1,
  InstructionTextElement,
} from "./instruction-source";

/**
 * Divides a booklet page into the step panels printed on it.
 *
 * A page carries a grid of steps — this booklet prints up to six. Each is
 * announced by its step number, and the artwork, callout quantities and
 * highlight belonging to that step sit nearer that number than any other. So
 * the page is cut into cells: columns from the step numbers' x positions, rows
 * from their y positions within a column.
 *
 * Cutting on x alone was wrong and looked right for a long time, because most
 * pages carry one step or a left/right pair. On a page that stacks steps —
 * page 11 prints steps 1 and 2 in the left column, 3 and 4 in the right — the
 * two labels in a column sit at almost the same x, so the midpoint between them
 * is a slice a few points wide. Four of the first fifty panels came out that
 * way, one of them 38 times taller than it was wide.
 *
 * The split is what lets everything else be per-step rather than per-page: a
 * callout, a highlight region and a step number only mean something together.
 */
export const STEP_PANELS_SCHEMA_VERSION = "lego.step-panels/2" as const;

export interface PanelBounds {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface StepPanel {
  readonly stepNumber: number;
  readonly pageNumber: number;
  /** The cell of the page this step owns. */
  readonly bounds: PanelBounds;
  /** Where the step number itself is printed, in PDF points. */
  readonly labelXPt: number;
  readonly labelYPt: number;
  readonly quantities: readonly number[];
}

export interface StepPanelPageIndexEntry {
  readonly stepNumber: number;
  readonly pageNumber: number;
}

export interface RegionLike {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

export interface PanelLabelPosition {
  readonly xPt: number;
  readonly yPt: number;
}

/** A callout box, used only to place a row cut where the reader would see one. */
export interface PanelCalloutBox {
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
}

/**
 * Labels sitting within this fraction of the page width of each other are one
 * column. A stacked pair is left-aligned to within a point or two; separate
 * columns are most of a page apart, so the gap between the two cases is wide.
 */
const COLUMN_TOLERANCE_FRACTION = 0.08;
/** Keeps a row cut clear of the callout box border it is placed above. */
const CUT_MARGIN_PT = 2;
/**
 * How far left of a column's step number that column starts.
 *
 * A step number is printed at the top left of its block, not in the middle of
 * it, so the boundary between columns belongs just before the next column's
 * number — not at the midpoint between the two, which cuts through the left
 * step's artwork. On page 11 the midpoint falls at 223pt and the printed
 * divider at 392pt, and the left panel came out two and a half times taller
 * than it was wide as a result.
 */
const COLUMN_MARGIN_PT = 10;

function groupIntoColumns(
  labels: readonly PanelLabelPosition[],
  pageWidthPt: number,
): readonly (readonly number[])[] {
  const order = labels.map((_, index) => index).sort((a, b) => labels[a]!.xPt - labels[b]!.xPt);
  const tolerance = pageWidthPt * COLUMN_TOLERANCE_FRACTION;
  const columns: number[][] = [];
  for (const index of order) {
    const current = columns[columns.length - 1];
    const previous = current === undefined ? undefined : labels[current[current.length - 1]!]!;
    if (
      current === undefined ||
      previous === undefined ||
      labels[index]!.xPt - previous.xPt > tolerance
    ) {
      columns.push([index]);
    } else {
      current.push(index);
    }
  }
  return columns;
}

/**
 * Where to cut between two vertically adjacent steps in a column.
 *
 * Going down the page a step reads as callout box, then step number, then
 * artwork, so the boundary belongs between one step's artwork and the next
 * step's callout box. The midpoint between the two step numbers lands inside
 * the upper step's artwork instead — on page 11 it clips its bottom edge — so
 * the cut is placed just above the callout box between them where there is one.
 */
function rowCut(
  upperYPt: number,
  lowerYPt: number,
  boxesBetween: readonly PanelCalloutBox[],
): number {
  const tops = boxesBetween
    .map(({ maxYPt }) => maxYPt)
    .filter((top) => top > lowerYPt && top < upperYPt);
  if (tops.length === 0) return (upperYPt + lowerYPt) / 2;
  return Math.min(upperYPt, Math.max(...tops) + CUT_MARGIN_PT);
}

/**
 * The cell each step number owns, in the order the labels were given. Cells
 * tile the page with no gap, so nothing printed on it falls outside every cell.
 */
export function panelCellsFor(
  labels: readonly PanelLabelPosition[],
  pageWidthPt: number,
  pageHeightPt: number,
  calloutBoxes: readonly PanelCalloutBox[] = [],
): readonly PanelBounds[] {
  const columns = groupIntoColumns(labels, pageWidthPt);
  const anchors = columns.map(
    (column) => column.reduce((total, index) => total + labels[index]!.xPt, 0) / column.length,
  );
  const cells = new Array<PanelBounds>(labels.length);

  columns.forEach((column, columnIndex) => {
    const minXPt = columnIndex === 0 ? 0 : Math.max(0, anchors[columnIndex]! - COLUMN_MARGIN_PT);
    const maxXPt =
      columnIndex === columns.length - 1
        ? pageWidthPt
        : Math.max(minXPt, anchors[columnIndex + 1]! - COLUMN_MARGIN_PT);

    // Top of the page first: PDF y grows upward.
    const stacked = [...column].sort((a, b) => labels[b]!.yPt - labels[a]!.yPt);
    const boxesInColumn = calloutBoxes.filter((box) => {
      const centre = (box.minXPt + box.maxXPt) / 2;
      return centre >= minXPt && centre < maxXPt;
    });

    stacked.forEach((labelIndex, row) => {
      const above = row === 0 ? null : stacked[row - 1]!;
      const below = row === stacked.length - 1 ? null : stacked[row + 1]!;
      cells[labelIndex] = {
        minXPt,
        maxXPt,
        maxYPt:
          above === null
            ? pageHeightPt
            : rowCut(labels[above]!.yPt, labels[labelIndex]!.yPt, boxesInColumn),
        minYPt:
          below === null ? 0 : rowCut(labels[labelIndex]!.yPt, labels[below]!.yPt, boxesInColumn),
      };
    });
  });

  return cells;
}

export interface DerivePanelsOptions {
  /** Glyph height the booklet sets step numbers in, from the structure pass. */
  readonly stepNumberHeightPt: number;
  /**
   * Callout boxes per page number. Optional: without them a row cut falls back
   * to the midpoint between step numbers, which is right to within the height
   * of one callout box.
   */
  readonly calloutBoxesByPage?: ReadonlyMap<number, readonly PanelCalloutBox[]> | undefined;
}

const BARE_NUMBER = /^\d{1,4}$/;
const QUANTITY = /^(\d{1,3})x$/;

function isStepLabel(element: InstructionTextElement, heightPt: number): boolean {
  return BARE_NUMBER.test(element.text) && Math.abs(element.heightPt - heightPt) < 0.5;
}

function contains(bounds: PanelBounds, xPt: number, yPt: number): boolean {
  return xPt >= bounds.minXPt && xPt < bounds.maxXPt && yPt >= bounds.minYPt && yPt < bounds.maxYPt;
}

function deriveStepPanelsFromPages(
  pages: readonly InstructionPage[],
  { stepNumberHeightPt, calloutBoxesByPage }: DerivePanelsOptions,
): readonly StepPanel[] {
  const panels: StepPanel[] = [];

  for (const page of pages) {
    const labels = page.textElements
      .filter((element) => isStepLabel(element, stepNumberHeightPt))
      .sort((left, right) => left.xPt - right.xPt);
    if (labels.length === 0) continue;

    const cells = panelCellsFor(
      labels.map(({ xPt, yPt }) => ({ xPt, yPt })),
      page.widthPt,
      page.heightPt,
      calloutBoxesByPage?.get(page.pageNumber) ?? [],
    );

    labels.forEach((label, index) => {
      const bounds = cells[index]!;
      // A quantity belongs to the step whose cell it is printed in.
      const quantities = page.textElements
        .filter((element) => contains(bounds, element.xPt, element.yPt))
        .map((element) => QUANTITY.exec(element.text))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => Number(match[1]));

      panels.push({
        stepNumber: Number(label.text),
        pageNumber: page.pageNumber,
        bounds,
        labelXPt: label.xPt,
        labelYPt: label.yPt,
        quantities,
      });
    });
  }

  return panels;
}

/**
 * The page carrying each step label, without deriving panel cells or quantities.
 *
 * This uses the same label predicate as full panel derivation so a caller can
 * select complete pages before paying to derive their joint geometry.
 */
export function indexStepPanelPages(
  source: InstructionSourceV1,
  stepNumberHeightPt: number,
): readonly StepPanelPageIndexEntry[] {
  return source.pages.flatMap((page) =>
    page.textElements
      .filter((element) => isStepLabel(element, stepNumberHeightPt))
      .map(({ text }) => ({ stepNumber: Number(text), pageNumber: page.pageNumber })),
  );
}

/** Every step panel in a booklet, in page then reading order. */
export function deriveStepPanels(
  source: InstructionSourceV1,
  options: DerivePanelsOptions,
): readonly StepPanel[] {
  return deriveStepPanelsFromPages(source.pages, options);
}

/**
 * Every panel on selected pages, using the same booklet-global step glyph size.
 *
 * Callers must select pages only after deriving that global size. Keeping every
 * panel on each selected page is essential: row and column cuts are joint facts
 * of all labels and callout boxes printed on that page, even when a later stage
 * emits only a subset of its steps.
 */
export function deriveStepPanelsForPages(
  source: InstructionSourceV1,
  pageNumbers: readonly number[],
  options: DerivePanelsOptions,
): readonly StepPanel[] {
  if (pageNumbers.length < 1 || pageNumbers.length > source.pageCount) {
    throw new RangeError(
      `Selected panel pages must contain 1 through ${source.pageCount} page numbers; observed ${pageNumbers.length}.`,
    );
  }
  const selected = new Set<number>();
  for (const pageNumber of pageNumbers) {
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > source.pageCount ||
      selected.has(pageNumber)
    ) {
      throw new RangeError(
        `Selected panel page ${String(pageNumber)} must be one unique safe integer from 1 through ${source.pageCount}.`,
      );
    }
    selected.add(pageNumber);
  }
  const pages = source.pages.filter(({ pageNumber }) => selected.has(pageNumber));
  if (pages.length !== selected.size) {
    throw new TypeError(
      "Selected panel pages name a page absent from the exact instruction source.",
    );
  }
  return deriveStepPanelsFromPages(pages, options);
}

/**
 * Assigns highlight regions to the panel they sit in, by their centre. A region
 * straddling a boundary belongs to whichever step its middle falls under, which
 * is the same rule a reader applies.
 */
export function assignRegionsToPanels<Region extends RegionLike>(
  panels: readonly StepPanel[],
  regions: readonly Region[],
): ReadonlyMap<number, readonly Region[]> {
  const byStep = new Map<number, Region[]>();
  for (const panel of panels) byStep.set(panel.stepNumber, []);

  for (const region of regions) {
    const centreX = (region.minXPt + region.maxXPt) / 2;
    const centreY = (region.minYPt + region.maxYPt) / 2;
    const panel = panels.find(({ bounds }) => contains(bounds, centreX, centreY)) ?? panels[0];
    if (panel) byStep.get(panel.stepNumber)?.push(region);
  }
  return byStep;
}

export interface PanelCoverage {
  readonly panelCount: number;
  readonly pagesWithPanels: number;
  /** Steps whose panel carries no callout quantity at all. */
  readonly panelsWithoutQuantities: readonly number[];
  readonly totalQuantityPieces: number;
  readonly panelsPerPage: Readonly<Record<string, number>>;
}

export function summarizePanels(panels: readonly StepPanel[]): PanelCoverage {
  const perPage = new Map<number, number>();
  for (const panel of panels) {
    perPage.set(panel.pageNumber, (perPage.get(panel.pageNumber) ?? 0) + 1);
  }
  const distribution: Record<string, number> = {};
  for (const count of perPage.values()) {
    distribution[String(count)] = (distribution[String(count)] ?? 0) + 1;
  }

  return {
    panelCount: panels.length,
    pagesWithPanels: perPage.size,
    panelsWithoutQuantities: panels
      .filter(({ quantities }) => quantities.length === 0)
      .map(({ stepNumber }) => stepNumber),
    totalQuantityPieces: panels.reduce(
      (total, { quantities }) => total + quantities.reduce((sum, value) => sum + value, 0),
      0,
    ),
    panelsPerPage: distribution,
  };
}
