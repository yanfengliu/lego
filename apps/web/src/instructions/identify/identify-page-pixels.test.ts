import { afterEach, describe, expect, it, vi } from "vitest";

import { fakePdfjs, syntheticBooklet } from "./__fixtures__/synthetic-booklet";
import { identifyBooklet } from "./identify-booklet";
import { IDENTIFY_LIMITS } from "./limits";

/**
 * The limit on decoded pixels one page's pictures may be cut from
 * (`maxDecodedPixelsPerPage`, checked in collect.ts as each image decodes).
 *
 * Its real value is 64 Mi pixels, and a synthetic page reaching it would mean
 * decoding hundreds of megabytes, so this file swaps in a mutable copy of
 * `IDENTIFY_LIMITS` and sets the one limit to the synthetic booklet's own
 * heaviest page. Bound: the comparison, the order of checks and the message
 * are the product's; the threshold is not the shipped one. The mock is this
 * file's alone: every other test file sees the real, frozen limits.
 */
vi.mock("./limits", async (importOriginal) => {
  const original = await importOriginal<typeof import("./limits")>();
  return { IDENTIFY_LIMITS: { ...original.IDENTIFY_LIMITS } };
});

const BYTES = new Uint8Array([37, 80, 68, 70, 45]);
const limits = IDENTIFY_LIMITS as { maxDecodedPixelsPerPage: number };
const shipped = limits.maxDecodedPixelsPerPage;

afterEach(() => {
  limits.maxDecodedPixelsPerPage = shipped;
});

describe("the decoded-pixel limit for one page", () => {
  const pages = syntheticBooklet();
  // Every image on a synthetic page belongs to a callout or inventory picture, so each is decoded.
  const pixels = pages.map(({ images }) =>
    [...images.values()].reduce((sum, { width, height }) => sum + width * height, 0),
  );
  const heaviest = Math.max(...pixels);
  const heaviestPage = pixels.indexOf(heaviest) + 1;

  it("reads a booklet whose heaviest page decodes exactly the limit", async () => {
    limits.maxDecodedPixelsPerPage = heaviest;
    const result = await identifyBooklet(BYTES, { pdfjs: fakePdfjs(pages) });
    expect(result.summary.calloutsWithPicture).toBe(result.summary.callouts);
  });

  it("refuses the page one pixel over it, naming the page, the image and the limit, and releases the document", async () => {
    limits.maxDecodedPixelsPerPage = heaviest - 1;
    const pdfjs = fakePdfjs(pages);
    await expect(identifyBooklet(BYTES, { pdfjs })).rejects.toThrow(
      new RegExp(
        `^Page ${heaviestPage}'s callout pictures are cut from images holding ${heaviest} decoded pixels by image "[^"]+", over the ${heaviest - 1}-pixel limit for one page \\(the sample booklet's heaviest page needs 517,094\\)\\. Pass an instruction booklet\\.$`,
        "u",
      ),
    );
    expect(pdfjs.destroyed()).toBe(1);
  });
});
