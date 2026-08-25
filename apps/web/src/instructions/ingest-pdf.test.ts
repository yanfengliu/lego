import { describe, expect, it, vi } from "vitest";

import { ingestInstructionPdf, type PdfDocument, type PdfPage } from "./ingest-pdf";
import {
  INSTRUCTION_PDF_LIMITS,
  InstructionIngestError,
  summarizeInstructionSource,
} from "./instruction-source";

function fakeFile(name: string, byteLength: number) {
  return {
    name,
    arrayBuffer: async () => new ArrayBuffer(byteLength),
  };
}

function fakePage(width: number, height: number, text: string): PdfPage {
  return {
    getViewport: () => ({ width, height }),
    getTextContent: async () => ({ items: text.split(" ").map((str) => ({ str })) }),
    cleanup: vi.fn(),
  };
}

function fakeDocument(pages: readonly PdfPage[]): PdfDocument {
  return {
    numPages: pages.length,
    getPage: async (pageNumber) => pages[pageNumber - 1]!,
    destroy: vi.fn(),
  };
}

const loaderFor = (document: PdfDocument) => async () => document;

describe("ingestInstructionPdf", () => {
  it("reads pages, their sizes, and their text into a content-addressed source", async () => {
    const source = await ingestInstructionPdf(fakeFile("set.pdf", 2048), {
      loadPdf: loaderFor(
        fakeDocument([fakePage(595, 842, "Step 1 place 2x4"), fakePage(595, 842, "Step 2")]),
      ),
    });

    expect(source.pageCount).toBe(2);
    expect(source.fileName).toBe("set.pdf");
    expect(source.byteLength).toBe(2048);
    expect(source.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(source.pages[0]).toMatchObject({
      pageNumber: 1,
      widthPt: 595,
      heightPt: 842,
      text: "Step 1 place 2x4",
      textTruncated: false,
    });
    expect(source.provenance).toEqual({
      origin: "user-supplied",
      ingestedBy: "lego-studio:pdf-ingest/1",
    });
  });

  it("addresses identical bytes identically and different bytes differently", async () => {
    const loadPdf = loaderFor(fakeDocument([fakePage(100, 100, "a")]));
    const first = await ingestInstructionPdf(fakeFile("a.pdf", 64), { loadPdf });
    const same = await ingestInstructionPdf(fakeFile("a.pdf", 64), { loadPdf });
    const other = await ingestInstructionPdf(fakeFile("a.pdf", 65), { loadPdf });

    expect(first.contentHash).toBe(same.contentHash);
    expect(first.contentHash).not.toBe(other.contentHash);
  });

  it("refuses a file over the byte limit before parsing a single page", async () => {
    const loadPdf = vi.fn();
    await expect(
      ingestInstructionPdf(fakeFile("huge.pdf", INSTRUCTION_PDF_LIMITS.maxBytes + 1), {
        loadPdf: loadPdf as never,
      }),
    ).rejects.toThrow(/huge\.pdf is \d+ MB, over the \d+ MB instruction limit/);
    expect(loadPdf).not.toHaveBeenCalled();
  });

  it("refuses an empty file by name", async () => {
    await expect(ingestInstructionPdf(fakeFile("blank.pdf", 0))).rejects.toThrow(
      /blank\.pdf is empty, so it holds no steps/,
    );
  });

  it("refuses more pages than instructions are read in", async () => {
    const page = fakePage(100, 100, "");
    const tooMany = Array.from({ length: INSTRUCTION_PDF_LIMITS.maxPages + 1 }, () => page);

    await expect(
      ingestInstructionPdf(fakeFile("long.pdf", 1024), {
        loadPdf: loaderFor(fakeDocument(tooMany)),
      }),
    ).rejects.toThrow(/has \d+ pages, over the 400-page instruction limit/);
  });

  it("refuses a page that claims an impossible size, naming the page", async () => {
    await expect(
      ingestInstructionPdf(fakeFile("wide.pdf", 1024), {
        loadPdf: loaderFor(fakeDocument([fakePage(100, 100, ""), fakePage(99_999, 100, "")])),
      }),
    ).rejects.toThrow(/Page 2 measures 99999 x 100 pt, outside the 0 to 5000 pt range/);
  });

  it("truncates an oversized text layer rather than carrying it whole", async () => {
    const huge = "x ".repeat(INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage);
    const source = await ingestInstructionPdf(fakeFile("wordy.pdf", 1024), {
      loadPdf: loaderFor(fakeDocument([fakePage(595, 842, huge)])),
    });

    expect(source.pages[0]!.text).toHaveLength(INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage);
    expect(source.pages[0]!.textTruncated).toBe(true);
    expect(summarizeInstructionSource(source).truncatedPages).toEqual([1]);
  });

  it("bounds positioned element characters rather than only their element count", async () => {
    const oversizedToken = "x".repeat(INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage + 1);
    const source = await ingestInstructionPdf(fakeFile("one-token.pdf", 1024), {
      loadPdf: loaderFor(fakeDocument([fakePage(595, 842, oversizedToken)])),
    });

    expect(source.pages[0]!.text).toHaveLength(INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage);
    expect(source.pages[0]!.textElements).toEqual([]);
    expect(source.pages[0]!.textTruncated).toBe(true);
  });

  it("drops positioned geometry outside the same finite page-space ceiling", async () => {
    const page: PdfPage = {
      getViewport: () => ({ width: 595, height: 842 }),
      getTextContent: async () => ({
        items: [
          { str: "hostile", height: 1e308, transform: [1, 0, 0, 1, 1e308, 1e308] },
          { str: "step", height: 26, transform: [1, 0, 0, 1, 40, 500] },
        ],
      }),
      cleanup: vi.fn(),
    };
    const source = await ingestInstructionPdf(fakeFile("geometry.pdf", 1024), {
      loadPdf: loaderFor(fakeDocument([page])),
    });

    expect(source.pages[0]!.text).toBe("hostile step");
    expect(source.pages[0]!.textElements).toEqual([
      { text: "step", heightPt: 26, xPt: 40, yPt: 500 },
    ]);
  });

  it("stops when the whole document's text exceeds its budget", async () => {
    const page = fakePage(595, 842, "y ".repeat(INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage));
    const many = Array.from(
      {
        length:
          Math.ceil(
            INSTRUCTION_PDF_LIMITS.maxTotalTextChars / INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage,
          ) + 1,
      },
      () => page,
    );

    await expect(
      ingestInstructionPdf(fakeFile("dense.pdf", 4096), { loadPdf: loaderFor(fakeDocument(many)) }),
    ).rejects.toThrow(/text layer exceeds the 2000000-character instruction budget/);
  });

  it("reports an unreadable document as such rather than crashing", async () => {
    await expect(
      ingestInstructionPdf(fakeFile("broken.pdf", 1024), {
        loadPdf: async () => {
          throw new Error("Invalid PDF structure");
        },
      }),
    ).rejects.toThrow(/broken\.pdf could not be read as a PDF: Invalid PDF structure/);

    await expect(
      ingestInstructionPdf(fakeFile("broken.pdf", 1024), {
        loadPdf: async () => {
          throw new Error("x");
        },
      }),
    ).rejects.toBeInstanceOf(InstructionIngestError);
  });

  it("releases the document even when a page is rejected", async () => {
    const document = fakeDocument([fakePage(99_999, 100, "")]);
    await expect(
      ingestInstructionPdf(fakeFile("wide.pdf", 1024), { loadPdf: loaderFor(document) }),
    ).rejects.toThrow();
    expect(document.destroy).toHaveBeenCalled();
  });

  it("reports progress so a long booklet does not look frozen", async () => {
    const onProgress = vi.fn();
    await ingestInstructionPdf(fakeFile("set.pdf", 1024), {
      loadPdf: loaderFor(fakeDocument([fakePage(1, 1, "a"), fakePage(1, 1, "b")])),
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});

describe("summarizeInstructionSource", () => {
  it("counts only the pages that actually carry text", async () => {
    const source = await ingestInstructionPdf(fakeFile("set.pdf", 1024), {
      loadPdf: loaderFor(
        fakeDocument([fakePage(1, 1, "Step 1"), fakePage(1, 1, ""), fakePage(1, 1, "Step 3")]),
      ),
    });
    const summary = summarizeInstructionSource(source);

    expect(summary.pageCount).toBe(3);
    expect(summary.pagesWithText).toBe(2);
    expect(summary.totalTextChars).toBe("Step 1".length + "Step 3".length);
  });
});
