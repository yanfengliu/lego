import { describe, expect, it } from "vitest";

import type { InstructionSourceV1, InstructionTextElement } from "./instruction-source";
import {
  checkInventoryConsistency,
  extractPartsInventory,
  findInventoryPages,
  PARTS_INVENTORY_DEFAULTS,
} from "./parts-inventory";

function element(text: string, xPt: number, yPt: number): InstructionTextElement {
  return { text, heightPt: 6, xPt, yPt };
}

/**
 * One inventory cell as the booklet prints it: the quantity above, the element
 * id 7.2pt below it in the same column. `yPt` grows upward, as pdfjs reports it.
 */
function cell(elementId: string, quantity: number, xPt: number, yPt: number) {
  return [element(`${quantity}x`, xPt, yPt + 7.2), element(elementId, xPt, yPt)];
}

function sourceOf(pages: readonly (readonly InstructionTextElement[])[]): InstructionSourceV1 {
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: `sha256:${"0".repeat(64)}`,
    fileName: "fixture.pdf",
    byteLength: 2048,
    pageCount: pages.length,
    pages: pages.map((textElements, index) => ({
      pageNumber: index + 1,
      widthPt: 765,
      heightPt: 544,
      text: textElements.map(({ text }) => text).join(" "),
      textElements,
      textTruncated: false,
    })),
    provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
  };
}

/** A full inventory page: `count` cells laid out over a few columns. */
function inventoryPage(count: number, startAt = 0): InstructionTextElement[] {
  return Array.from({ length: count }, (_, index) => {
    const at = startAt + index;
    return cell(
      String(6000000 + at),
      (at % 5) + 1,
      34 + (at % 6) * 58.4,
      500 - Math.floor(at / 6) * 29,
    );
  }).flat();
}

describe("findInventoryPages", () => {
  it("finds the pages by where element ids are printed, not by position", () => {
    const source = sourceOf([
      [element("1", 20, 500), element("2x", 40, 400)],
      inventoryPage(12),
      [element("224", 700, 20)],
      inventoryPage(9, 100),
    ]);
    expect(findInventoryPages(source, PARTS_INVENTORY_DEFAULTS)).toEqual([2, 4]);
  });

  it("does not mistake a build page that prints one long number for an inventory", () => {
    const source = sourceOf([[element("6341465", 34, 500), element("1x", 34, 507.2)]]);
    expect(findInventoryPages(source, PARTS_INVENTORY_DEFAULTS)).toEqual([]);
  });
});

describe("extractPartsInventory", () => {
  it("pairs each element id with the quantity printed above it", () => {
    const source = sourceOf([
      [
        ...cell("6341465", 2, 34, 500),
        ...cell("614101", 8, 92.5, 500),
        ...cell("6605469", 1, 150.9, 500),
        ...cell("4518400", 1, 34, 471),
        ...cell("6593092", 10, 92.5, 471),
        ...cell("6186681", 2, 150.9, 471),
        ...cell("6446788", 5, 34, 442),
        ...cell("6454713", 1, 92.5, 442),
      ],
    ]);
    const inventory = extractPartsInventory(source);
    expect(inventory.unpaired).toEqual([]);
    expect(inventory.entries).toHaveLength(8);
    expect(inventory.totalPieces).toBe(30);
    expect(inventory.distinctElements).toBe(8);
    expect(inventory.entries[0]).toMatchObject({
      elementId: "6341465",
      quantity: 2,
      pageNumber: 1,
    });
  });

  it("does not let one quantity be claimed by two element ids in the same column", () => {
    const source = sourceOf([
      [
        ...inventoryPage(8),
        // A second id directly under the first cell's id, with no quantity of its own.
        element("9999999", 34, 500 - 7.2),
      ],
    ]);
    const inventory = extractPartsInventory(source);
    const ids = inventory.entries.map(({ elementId }) => elementId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(inventory.unpaired.map(({ elementId }) => elementId)).toContain("9999999");
  });

  it("reports an element whose column carries no quantity rather than guessing", () => {
    const source = sourceOf([[...inventoryPage(8), element("7777777", 700, 500)]]);
    const inventory = extractPartsInventory(source);
    const orphan = inventory.unpaired.find(({ elementId }) => elementId === "7777777");
    expect(orphan).toBeDefined();
    expect(orphan!.reason).toContain("700.0");
    expect(orphan!.reason).toContain("No quantity is printed");
  });

  it("ignores a quantity printed below its element id, which is a different layout", () => {
    const source = sourceOf([
      [...inventoryPage(8), element("8888888", 500, 300), element("4x", 500, 292)],
    ]);
    const inventory = extractPartsInventory(source);
    expect(inventory.entries.map(({ elementId }) => elementId)).not.toContain("8888888");
    expect(inventory.unpaired.map(({ elementId }) => elementId)).toContain("8888888");
  });

  it("reads an inventory spread over more than one page", () => {
    const source = sourceOf([inventoryPage(10), inventoryPage(10, 50)]);
    const inventory = extractPartsInventory(source);
    expect(inventory.pageNumbers).toEqual([1, 2]);
    expect(inventory.entries).toHaveLength(20);
  });

  it("treats a bare step number as neither a quantity nor an element id", () => {
    const source = sourceOf([[...inventoryPage(8), element("221", 700, 20)]]);
    const inventory = extractPartsInventory(source);
    expect(inventory.entries).toHaveLength(8);
    expect(inventory.unpaired).toEqual([]);
  });
});

describe("checkInventoryConsistency", () => {
  it("confirms a total against the count the set declares", () => {
    const inventory = extractPartsInventory(sourceOf([inventoryPage(12)]));
    const check = checkInventoryConsistency(inventory, inventory.totalPieces);
    expect(check.pieceCountMatches).toBe(true);
    expect(check.pairedFraction).toBe(1);
    expect(check.findings).toEqual([]);
  });

  it("names both numbers when the total disagrees with the declared count", () => {
    const inventory = extractPartsInventory(sourceOf([inventoryPage(12)]));
    const check = checkInventoryConsistency(inventory, inventory.totalPieces + 15);
    expect(check.pieceCountMatches).toBe(false);
    expect(check.findings[0]!.code).toBe("PIECE_COUNT_MISMATCH");
    expect(check.findings[0]!.message).toContain(String(inventory.totalPieces));
    expect(check.findings[0]!.message).toContain(String(inventory.totalPieces + 15));
  });

  it("reports an unpaired element rather than quietly losing it from the total", () => {
    const source = sourceOf([[...inventoryPage(8), element("7777777", 700, 500)]]);
    const check = checkInventoryConsistency(extractPartsInventory(source));
    expect(check.pairedFraction).toBeLessThan(1);
    expect(check.findings.map(({ code }) => code)).toContain("ELEMENT_UNPAIRED");
    expect(check.findings[0]!.message).toContain("7777777");
  });

  it("says so when there is no inventory at all", () => {
    const check = checkInventoryConsistency(
      extractPartsInventory(sourceOf([[element("1", 20, 500)]])),
    );
    expect(check.findings.map(({ code }) => code)).toContain("INVENTORY_NOT_FOUND");
  });
});
