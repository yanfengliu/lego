import type { InstructionSourceV1, InstructionTextElement } from "./instruction-source";

/**
 * Divides a booklet page into the step panels printed on it.
 *
 * A page carries one or two steps side by side. Each is announced by its step
 * number, and the artwork, callout quantities and highlight belonging to that
 * step sit nearer that number than the other. Splitting on the midpoint between
 * consecutive step numbers is therefore enough, and needs no page furniture.
 *
 * The split is what lets everything else be per-step rather than per-page: a
 * callout, a highlight region and a step number only mean something together.
 */
export const STEP_PANELS_SCHEMA_VERSION = "lego.step-panels/1" as const;

export interface PanelBounds {
  readonly minXPt: number;
  readonly maxXPt: number;
}

export interface StepPanel {
  readonly stepNumber: number;
  readonly pageNumber: number;
  /** Horizontal band of the page this step owns. */
  readonly bounds: PanelBounds;
  /** Where the step number itself is printed, in PDF points. */
  readonly labelXPt: number;
  readonly labelYPt: number;
  readonly quantities: readonly number[];
}

export interface RegionLike {
  readonly minXPt: number;
  readonly maxXPt: number;
}

/**
 * Splits a page at the midpoint between neighbouring step numbers. With one
 * step the panel is the whole page; the panels always tile it with no gap, so
 * nothing on the page can fall outside every panel.
 */
export function panelBoundsFor(
  labelXs: readonly number[],
  pageWidthPt: number,
): readonly PanelBounds[] {
  const sorted = [...labelXs].sort((left, right) => left - right);
  return sorted.map((labelX, index) => ({
    minXPt: index === 0 ? 0 : (sorted[index - 1]! + labelX) / 2,
    maxXPt: index === sorted.length - 1 ? pageWidthPt : (labelX + sorted[index + 1]!) / 2,
  }));
}

export interface DerivePanelsOptions {
  /** Glyph height the booklet sets step numbers in, from the structure pass. */
  readonly stepNumberHeightPt: number;
}

const BARE_NUMBER = /^\d{1,4}$/;
const QUANTITY = /^(\d{1,3})x$/;

function isStepLabel(element: InstructionTextElement, heightPt: number): boolean {
  return BARE_NUMBER.test(element.text) && Math.abs(element.heightPt - heightPt) < 0.5;
}

/** Every step panel in a booklet, in page then reading order. */
export function deriveStepPanels(
  source: InstructionSourceV1,
  { stepNumberHeightPt }: DerivePanelsOptions,
): readonly StepPanel[] {
  const panels: StepPanel[] = [];

  for (const page of source.pages) {
    const labels = page.textElements
      .filter((element) => isStepLabel(element, stepNumberHeightPt))
      .sort((left, right) => left.xPt - right.xPt);
    if (labels.length === 0) continue;

    const bounds = panelBoundsFor(
      labels.map((label) => label.xPt),
      page.widthPt,
    );
    labels.forEach((label, index) => {
      const band = bounds[index]!;
      // A quantity belongs to the step whose band it is printed in.
      const quantities = page.textElements
        .filter((element) => element.xPt >= band.minXPt && element.xPt < band.maxXPt)
        .map((element) => QUANTITY.exec(element.text))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => Number(match[1]));

      panels.push({
        stepNumber: Number(label.text),
        pageNumber: page.pageNumber,
        bounds: band,
        labelXPt: label.xPt,
        labelYPt: label.yPt,
        quantities,
      });
    });
  }

  return panels;
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
    const centre = (region.minXPt + region.maxXPt) / 2;
    const panel =
      panels.find(({ bounds }) => centre >= bounds.minXPt && centre < bounds.maxXPt) ?? panels[0];
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
