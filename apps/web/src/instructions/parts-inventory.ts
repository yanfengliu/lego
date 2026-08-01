import type { InstructionSourceV1, InstructionTextElement } from "./instruction-source";

/**
 * Reads the parts inventory a booklet prints at the back.
 *
 * Those pages are the most valuable text in the document. Each cell shows a
 * part's picture with its quantity printed above and its LEGO element id below,
 * and both of those are text — so the whole parts list comes out of the text
 * layer exactly, with nothing having looked at a picture. That gives three
 * things nothing else in the pipeline can supply:
 *
 * - the closed set of elements the model is built from, which turns "what part
 *   is this" from open-ended recognition into a choice among known parts;
 * - a conservation law, since every step's callouts must sum, per element, to
 *   the quantity printed here — a reading that overspends an element is wrong;
 * - a labelled picture for each element, because the id is printed beside the
 *   thumbnail, which is what makes an image reader measurable at all.
 *
 * The pairing is positional and deliberately strict: a quantity belongs to the
 * element id printed directly beneath it in the same column. Anything that does
 * not pair is reported rather than guessed at, because a silently dropped entry
 * would corrupt the conservation law that the rest of the pipeline leans on.
 */
export const PARTS_INVENTORY_SCHEMA_VERSION = "lego.parts-inventory/1" as const;

/** "2x", "57x" — how many of an element the set contains. */
const QUANTITY = /^(\d{1,3})x$/;
/** A LEGO element id: six or seven digits, and never followed by an "x". */
const ELEMENT_ID = /^\d{6,7}$/;

export const PARTS_INVENTORY_DEFAULTS = Object.freeze({
  /** How far a quantity may sit from its element id's column, in points. */
  maxColumnDriftPt: 0.6,
  /**
   * How far above its element id the quantity is printed. `yPt` is the raw pdfjs
   * text-space value, which grows upward, so the quantity has the larger `yPt`.
   */
  minLabelRisePt: 4,
  maxLabelRisePt: 11,
  /** A page needs this many element ids before it counts as an inventory page. */
  minElementsPerPage: 8,
});

export type PartsInventoryOptions = typeof PARTS_INVENTORY_DEFAULTS;

export interface InventoryEntry {
  readonly elementId: string;
  readonly quantity: number;
  readonly pageNumber: number;
  /** Where the element id is printed, so the thumbnail's cell can be found. */
  readonly xPt: number;
  readonly yPt: number;
}

export interface UnpairedElement {
  readonly elementId: string;
  readonly pageNumber: number;
  readonly reason: string;
}

export interface PartsInventory {
  readonly schemaVersion: typeof PARTS_INVENTORY_SCHEMA_VERSION;
  readonly sourceHash: string;
  /** Pages the inventory was found on, in page order. */
  readonly pageNumbers: readonly number[];
  readonly entries: readonly InventoryEntry[];
  readonly totalPieces: number;
  readonly distinctElements: number;
  /** Element ids no quantity could be attached to, never silently dropped. */
  readonly unpaired: readonly UnpairedElement[];
}

interface Sighting extends InstructionTextElement {
  readonly pageNumber: number;
}

function sightingsOf(source: InstructionSourceV1): readonly Sighting[] {
  return source.pages.flatMap((page) =>
    page.textElements.map((element) => ({ ...element, pageNumber: page.pageNumber })),
  );
}

/**
 * The inventory pages, found by where element ids are printed rather than by
 * position in the booklet. A set with a longer or shorter parts list still
 * parses, and a build page that happens to print one long number does not.
 */
export function findInventoryPages(
  source: InstructionSourceV1,
  { minElementsPerPage }: Pick<PartsInventoryOptions, "minElementsPerPage">,
): readonly number[] {
  return source.pages
    .filter(
      (page) =>
        page.textElements.filter(({ text }) => ELEMENT_ID.test(text)).length >= minElementsPerPage,
    )
    .map(({ pageNumber }) => pageNumber);
}

/**
 * Pairs every element id with the quantity printed above it.
 *
 * A quantity is claimed by at most one element id, so a column of cells cannot
 * collapse onto a single quantity and inflate the count.
 */
export function extractPartsInventory(
  source: InstructionSourceV1,
  options: Partial<PartsInventoryOptions> = {},
): PartsInventory {
  const settings = { ...PARTS_INVENTORY_DEFAULTS, ...options };
  const pageNumbers = findInventoryPages(source, settings);
  const onInventoryPages = sightingsOf(source).filter(({ pageNumber }) =>
    pageNumbers.includes(pageNumber),
  );

  const entries: InventoryEntry[] = [];
  const unpaired: UnpairedElement[] = [];

  for (const pageNumber of pageNumbers) {
    const here = onInventoryPages.filter((sighting) => sighting.pageNumber === pageNumber);
    const quantities = here.filter(({ text }) => QUANTITY.test(text));
    const elements = here
      .filter(({ text }) => ELEMENT_ID.test(text))
      .sort((left, right) => right.yPt - left.yPt || left.xPt - right.xPt);
    const claimed = new Set<number>();

    for (const element of elements) {
      let best: { index: number; rise: number } | null = null;
      quantities.forEach((quantity, index) => {
        if (claimed.has(index)) return;
        if (Math.abs(quantity.xPt - element.xPt) > settings.maxColumnDriftPt) return;
        const rise = quantity.yPt - element.yPt;
        if (rise < settings.minLabelRisePt || rise > settings.maxLabelRisePt) return;
        if (best === null || rise < best.rise) best = { index, rise };
      });

      if (best === null) {
        const sameColumn = quantities.filter(
          (quantity) => Math.abs(quantity.xPt - element.xPt) <= settings.maxColumnDriftPt,
        ).length;
        unpaired.push({
          elementId: element.text,
          pageNumber,
          reason:
            sameColumn === 0
              ? `No quantity is printed within ${settings.maxColumnDriftPt}pt of column x=${element.xPt.toFixed(1)}, where element ${element.text} sits`
              : `All ${sameColumn} quantity label(s) in column x=${element.xPt.toFixed(1)} were either already claimed by another element or not ${settings.minLabelRisePt}-${settings.maxLabelRisePt}pt above element ${element.text}`,
        });
        continue;
      }

      const chosen: { index: number; rise: number } = best;
      claimed.add(chosen.index);
      entries.push({
        elementId: element.text,
        quantity: Number(QUANTITY.exec(quantities[chosen.index]!.text)![1]),
        pageNumber,
        xPt: element.xPt,
        yPt: element.yPt,
      });
    }
  }

  return {
    schemaVersion: PARTS_INVENTORY_SCHEMA_VERSION,
    sourceHash: source.contentHash,
    pageNumbers,
    entries,
    totalPieces: entries.reduce((total, { quantity }) => total + quantity, 0),
    distinctElements: new Set(entries.map(({ elementId }) => elementId)).size,
    unpaired,
  };
}

export interface InventoryFinding {
  readonly code:
    "INVENTORY_NOT_FOUND" | "ELEMENT_UNPAIRED" | "ELEMENT_REPEATED" | "PIECE_COUNT_MISMATCH";
  readonly message: string;
}

export interface InventoryConsistency {
  readonly totalPieces: number;
  readonly distinctElements: number;
  /** Set when a declared piece count was supplied to check against. */
  readonly pieceCountMatches: boolean | null;
  /** Fraction of element ids that got a quantity. The number to drive to 1. */
  readonly pairedFraction: number;
  readonly findings: readonly InventoryFinding[];
}

/**
 * Checks an inventory against itself and, where one is known, against the piece
 * count the set declares. The declared count is the one figure in this whole
 * pipeline that comes from outside the document, so it is worth checking.
 */
export function checkInventoryConsistency(
  inventory: PartsInventory,
  declaredPieceCount?: number,
): InventoryConsistency {
  const findings: InventoryFinding[] = [];
  const seen = inventory.entries.length + inventory.unpaired.length;

  if (inventory.entries.length === 0) {
    findings.push({
      code: "INVENTORY_NOT_FOUND",
      message: `No inventory entry was recovered: ${inventory.pageNumbers.length} page(s) carried enough element ids to look like an inventory`,
    });
  }
  if (inventory.unpaired.length > 0) {
    findings.push({
      code: "ELEMENT_UNPAIRED",
      message: `${inventory.unpaired.length} of ${seen} element id(s) got no quantity, starting with ${inventory.unpaired[0]!.elementId}: ${inventory.unpaired[0]!.reason}`,
    });
  }

  const counts = new Map<string, number>();
  for (const { elementId } of inventory.entries) {
    counts.set(elementId, (counts.get(elementId) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, count]) => count > 1);
  if (repeated.length > 0) {
    findings.push({
      code: "ELEMENT_REPEATED",
      message: `${repeated.length} element id(s) are listed more than once, starting with ${repeated[0]![0]} which appears ${repeated[0]![1]} times; an inventory lists each element once`,
    });
  }

  let pieceCountMatches: boolean | null = null;
  if (declaredPieceCount !== undefined) {
    pieceCountMatches = inventory.totalPieces === declaredPieceCount;
    if (!pieceCountMatches) {
      findings.push({
        code: "PIECE_COUNT_MISMATCH",
        message: `The inventory adds up to ${inventory.totalPieces} pieces but the set declares ${declaredPieceCount}`,
      });
    }
  }

  return {
    totalPieces: inventory.totalPieces,
    distinctElements: inventory.distinctElements,
    pieceCountMatches,
    pairedFraction: seen === 0 ? 0 : inventory.entries.length / seen,
    findings,
  };
}
