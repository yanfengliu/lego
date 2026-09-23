import { describe, expect, it, vi } from "vitest";

import {
  FAKE_OPS,
  fakePdfjs,
  syntheticBooklet,
  type SyntheticPage,
  type SyntheticText,
} from "./__fixtures__/synthetic-booklet";
import { identifyBooklet } from "./identify-booklet";
import { IDENTIFY_LIMITS } from "./limits";
import type { PdfjsLike } from "./pdf-scan";

/**
 * A PDF is hostile input. Each test feeds identification one oversized thing and
 * checks it is refused before the work it would cause, with a message naming the
 * page, the size and the limit. Bound: one oversized dimension at a time, on the
 * synthetic booklet; the limits themselves are in limits.ts.
 */
const BYTES = new Uint8Array([37, 80, 68, 70, 45]);

function flood(labels: number): SyntheticPage {
  const texts: SyntheticText[] = Array.from({ length: labels }, (_, i) => ({
    str: "1x",
    x: 10 + (i % 50) * 11,
    y: 20 + Math.floor(i / 50) * 12,
    size: 8,
  }));
  return { width: 600, height: 800, texts, paints: [], boxes: [], images: new Map() };
}

function textPage(chars: number): SyntheticPage {
  return { ...flood(0), texts: [{ str: "x".repeat(chars), x: 10, y: 10, size: 8 }] };
}

describe("identifyBooklet on hostile input", () => {
  it("checks the PDF's size before hashing a byte of it", async () => {
    class Oversized extends Uint8Array {
      override get byteLength(): number {
        return IDENTIFY_LIMITS.maxBytes + 1;
      }
    }
    const digest = vi.spyOn(crypto.subtle, "digest");
    await expect(identifyBooklet(new Oversized(1), { pdfjs: fakePdfjs([]) })).rejects.toThrow(
      `identifyBooklet received a ${IDENTIFY_LIMITS.maxBytes + 1}-byte PDF; the limit is ${IDENTIFY_LIMITS.maxBytes} bytes. Pass a single instruction booklet.`,
    );
    expect(digest).not.toHaveBeenCalled();
  });

  it("refuses a page larger than any booklet page, naming it", async () => {
    const pages = syntheticBooklet();
    pages[1] = { ...pages[1]!, width: 6000 };
    await expect(identifyBooklet(BYTES, { pdfjs: fakePdfjs(pages) })).rejects.toThrow(
      "Page 2 measures 6000 x 800 pt, outside the 0 to 5000 pt a booklet page is read at (the sample booklet's pages are 765 x 544 pt). Pass an instruction booklet.",
    );
  });

  it("refuses a page with more text than a booklet page holds, and a booklet with more in all", async () => {
    const heavy = [...syntheticBooklet(), textPage(IDENTIFY_LIMITS.maxTextCharsPerPage + 1)];
    await expect(identifyBooklet(BYTES, { pdfjs: fakePdfjs(heavy) })).rejects.toThrow(
      `Page 4's text layer holds ${IDENTIFY_LIMITS.maxTextCharsPerPage + 1} characters, over the ${IDENTIFY_LIMITS.maxTextCharsPerPage}-character limit for one page`,
    );
    const pages = Math.ceil(IDENTIFY_LIMITS.maxTotalTextChars / 19_900);
    const long = [...syntheticBooklet(), ...Array.from({ length: pages }, () => textPage(19_900))];
    await expect(identifyBooklet(BYTES, { pdfjs: fakePdfjs(long) })).rejects.toThrow(
      new RegExp(
        `^The text layer reaches \\d+ characters by page ${3 + pages}, over the ${IDENTIFY_LIMITS.maxTotalTextChars}-character limit for a booklet`,
      ),
    );
  });

  it("refuses a page, or a booklet, printing more count labels than any booklet does", async () => {
    const perPage = IDENTIFY_LIMITS.maxCountLabelsPerPage + 1;
    await expect(
      identifyBooklet(BYTES, { pdfjs: fakePdfjs([...syntheticBooklet(), flood(perPage)]) }),
    ).rejects.toThrow(
      `Page 4 prints ${perPage} count labels such as "2x", over the ${IDENTIFY_LIMITS.maxCountLabelsPerPage} one page is read with (the sample booklet's busiest page, in its inventory, prints 152). Pass an instruction booklet.`,
    );
    const floods = Array.from({ length: 11 }, () => flood(950));
    await expect(
      identifyBooklet(BYTES, { pdfjs: fakePdfjs([...syntheticBooklet(), ...floods]) }),
    ).rejects.toThrow(
      `The PDF prints ${8 + 8 + 11 * 950} count labels such as "2x", over the ${IDENTIFY_LIMITS.maxCountLabels} a booklet is read with (the sample booklet prints 1,140). Pass a single instruction booklet.`,
    );
  });

  it("stops at its time limit, naming where, and still releases the document", async () => {
    let clock = 0;
    const pdfjs = fakePdfjs(syntheticBooklet());
    await expect(
      identifyBooklet(BYTES, { pdfjs, now: () => (clock += 1000), timeLimitMs: 3000 }),
    ).rejects.toThrow(
      /^identifyBooklet stopped at page \d \(reading text\): the run has taken \d+\.0 s, over its 3\.0 s limit \(timeLimitMs\)\. A booklet this module can read finishes far inside it; if this one is genuine and the machine is slow, raise timeLimitMs\.$/,
    );
    expect(pdfjs.destroyed()).toBe(1);
  });

  it("does not wait on a pdf.js call past the time left", async () => {
    const never = new Promise<never>(() => {});
    const store = { has: () => false, get: () => null };
    const hanging: PdfjsLike = {
      version: "hanging",
      OPS: FAKE_OPS,
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getViewport: () => ({ width: 600, height: 800 }),
            getTextContent: () => never,
            getOperatorList: () => never,
            objs: store,
            commonObjs: store,
            cleanup: () => {},
          }),
          destroy: async () => {},
        }),
      }),
    };
    await expect(identifyBooklet(BYTES, { pdfjs: hanging, timeLimitMs: 50 })).rejects.toThrow(
      /^identifyBooklet stopped at page 1 \(reading text\): the run has taken \d+\.\d s, over its \d+\.\d s limit \(timeLimitMs\)/,
    );
  });

  it("names the option and the rule when a run limit is out of range", async () => {
    const pdfjs = fakePdfjs(syntheticBooklet());
    await expect(identifyBooklet(BYTES, { pdfjs, timeLimitMs: 0 })).rejects.toThrow(
      "identifyBooklet option timeLimitMs is 0; it must be a positive number of milliseconds.",
    );
    await expect(identifyBooklet(BYTES, { pdfjs, maxAssignmentNodes: 0 })).rejects.toThrow(
      "identifyBooklet option maxAssignmentNodes is 0; it must be a whole number from 1 to 100000.",
    );
    expect(pdfjs.destroyed()).toBe(0);
  });
});
