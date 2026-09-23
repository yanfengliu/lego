import type {
  InstructionPage,
  InstructionSourceV1,
  InstructionTextElement,
} from "../../apps/web/src/instructions/instruction-source.ts";

/**
 * Where on a page each printed label belongs.
 *
 * The booklet draws some labels more than once at the same spot (a "1x" three
 * times over itself on page 12), and word-level extraction reports every
 * drawing. Those overprints are removed first, or every count built on the
 * text layer is inflated.
 *
 * A step's parts callout is the box printed directly above its step number,
 * starting at the number's left edge. So a quantity label belongs to the step
 * number in the nearest column at or left of it that sits below it; ties in a
 * column go to the closest number underneath.
 */
export const LAYOUT_TOLERANCES = Object.freeze({
  /** Two drawings of one label: same text and size, positions within this many points. */
  overprintPt: 1,
  /** A callout may start this far left of its step number's left edge. */
  columnSlackPt: 2,
});

const QUANTITY = /^(\d{1,3})x$/u;
const BARE_NUMBER = /^\d{1,4}$/u;

export interface Overprints {
  readonly source: InstructionSourceV1;
  readonly removed: number;
  readonly removedByPage: ReadonlyMap<number, number>;
}

function sameDrawing(left: InstructionTextElement, right: InstructionTextElement): boolean {
  return (
    left.text === right.text &&
    Math.abs(left.heightPt - right.heightPt) < 0.01 &&
    Math.abs(left.xPt - right.xPt) < LAYOUT_TOLERANCES.overprintPt &&
    Math.abs(left.yPt - right.yPt) < LAYOUT_TOLERANCES.overprintPt
  );
}

/** Keeps the first drawing of every label drawn more than once over itself. */
export function removeOverprints(source: InstructionSourceV1): Overprints {
  let removed = 0;
  const removedByPage = new Map<number, number>();
  const pages: InstructionPage[] = source.pages.map((page) => {
    const kept: InstructionTextElement[] = [];
    for (const element of page.textElements) {
      if (kept.some((other) => sameDrawing(other, element))) {
        removed += 1;
        removedByPage.set(page.pageNumber, (removedByPage.get(page.pageNumber) ?? 0) + 1);
        continue;
      }
      kept.push(element);
    }
    return { ...page, textElements: kept };
  });
  return { source: { ...source, pages }, removed, removedByPage };
}

export interface StepSighting {
  readonly step: number;
  readonly page: number;
  readonly xPt: number;
  readonly yPt: number;
}

export interface QuantityLabel {
  readonly page: number;
  readonly quantity: number;
  readonly heightPt: number;
  readonly xPt: number;
  readonly yPt: number;
}

export function quantityLabels(page: InstructionPage): QuantityLabel[] {
  return page.textElements.flatMap((element) => {
    const match = QUANTITY.exec(element.text);
    return match
      ? [
          {
            page: page.pageNumber,
            quantity: Number(match[1]),
            heightPt: Math.round(element.heightPt * 100) / 100,
            xPt: element.xPt,
            yPt: element.yPt,
          },
        ]
      : [];
  });
}

/** The glyph size used most often for "Nx" labels outside `excludedPages`: the callout size. */
export function calloutHeight(
  source: InstructionSourceV1,
  excludedPages: ReadonlySet<number>,
): number | null {
  const counts = new Map<number, number>();
  for (const page of source.pages) {
    if (excludedPages.has(page.pageNumber)) continue;
    for (const label of quantityLabels(page)) {
      counts.set(label.heightPt, (counts.get(label.heightPt) ?? 0) + 1);
    }
  }
  let best: [number, number] | null = null;
  for (const entry of counts) {
    if (!best || entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0])) best = entry;
  }
  return best?.[0] ?? null;
}

/**
 * The step number a callout label belongs to, or null when no step number on
 * its page sits below it in its column.
 */
export function owningStep(
  label: Pick<QuantityLabel, "xPt" | "yPt">,
  stepsOnPage: readonly StepSighting[],
): StepSighting | null {
  let best: StepSighting | null = null;
  for (const step of stepsOnPage) {
    if (step.yPt >= label.yPt) continue;
    if (step.xPt > label.xPt + LAYOUT_TOLERANCES.columnSlackPt) continue;
    if (
      !best ||
      step.xPt > best.xPt + LAYOUT_TOLERANCES.columnSlackPt ||
      (Math.abs(step.xPt - best.xPt) <= LAYOUT_TOLERANCES.columnSlackPt &&
        label.yPt - step.yPt < label.yPt - best.yPt)
    ) {
      best = step;
    }
  }
  return best;
}

/** Large bare numbers that are not step numbers: the bag number printed on a bag-opening page. */
export function bagNumberOn(
  page: InstructionPage,
  stepHeightPt: number | null,
  minimumBagHeightPt: number,
): number | null {
  const candidates = page.textElements.filter(
    (element) =>
      BARE_NUMBER.test(element.text) &&
      element.heightPt >= minimumBagHeightPt &&
      (stepHeightPt === null || Math.abs(element.heightPt - stepHeightPt) > 0.05),
  );
  return candidates.length === 0 ? null : Number(candidates[0]!.text);
}
