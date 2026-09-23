import { describe, expect, it } from "vitest";

import type {
  InstructionPage,
  InstructionSourceV1,
} from "../../apps/web/src/instructions/instruction-source.ts";
import { calloutHeight, owningStep, quantityLabels, removeOverprints } from "./read-layout.ts";

const text = (value: string, heightPt: number, xPt: number, yPt: number) => ({
  text: value,
  heightPt,
  xPt,
  yPt,
});

function page(pageNumber: number, elements: ReturnType<typeof text>[]): InstructionPage {
  return {
    pageNumber,
    widthPt: 600,
    heightPt: 800,
    text: elements.map(({ text: value }) => value).join(" "),
    textElements: elements,
    textTruncated: false,
  } as InstructionPage;
}

function source(pages: InstructionPage[]): InstructionSourceV1 {
  return {
    schemaVersion: "lego.instruction-source/1",
    contentHash: "sha256:fixture",
    pages,
    pageCount: pages.length,
  } as unknown as InstructionSourceV1;
}

describe("booklet layout", () => {
  it("removes a label drawn several times over itself, and only that", () => {
    const { source: cleaned, removed } = removeOverprints(
      source([
        page(12, [
          text("1x", 8, 100, 500),
          text("1x", 8, 100.4, 500.2),
          text("1x", 8, 100, 500),
          text("1x", 8, 140, 500),
        ]),
      ]),
    );
    expect(removed).toBe(2);
    expect(cleaned.pages[0]!.textElements.map(({ xPt }) => xPt)).toEqual([100, 140]);
  });

  it("takes the most used Nx size as the callout size, so larger sub-build multipliers stand apart", () => {
    const booklet = source([
      page(11, [text("1x", 8, 10, 700), text("2x", 8, 40, 700), text("2x", 14, 300, 300)]),
      page(12, [text("3x", 8, 10, 700)]),
    ]);
    expect(calloutHeight(booklet, new Set())).toBe(8);
    expect(
      quantityLabels(booklet.pages[0]!).map(({ quantity, heightPt }) => `${quantity}@${heightPt}`),
    ).toEqual(["1@8", "2@8", "2@14"]);
  });

  it("gives a callout to the step number below it in its column, the nearest one when several are", () => {
    const steps = [
      { step: 5, page: 20, xPt: 20, yPt: 600 },
      { step: 6, page: 20, xPt: 20, yPt: 300 },
      { step: 7, page: 20, xPt: 320, yPt: 600 },
    ];
    expect(owningStep({ xPt: 22, yPt: 650 }, steps)?.step).toBe(5);
    expect(owningStep({ xPt: 22, yPt: 350 }, steps)?.step).toBe(6);
    expect(owningStep({ xPt: 330, yPt: 700 }, steps)?.step).toBe(7);
    expect(owningStep({ xPt: 10, yPt: 700 }, steps)).toBeNull();
  });
});
