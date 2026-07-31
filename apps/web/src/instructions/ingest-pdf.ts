import {
  INSTRUCTION_PDF_LIMITS,
  InstructionIngestError,
  assertIngestableSize,
  assertPageCount,
  assertPageExtent,
  assertTotalTextBudget,
  boundPageText,
  type InstructionLimits,
  type InstructionPage,
  type InstructionSourceV1,
} from "./instruction-source";

/** Content address of raw bytes, via Web Crypto rather than a JSON digest. */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

/** The shape of pdfjs this module depends on, kept narrow so it can be faked. */
export interface PdfTextItem {
  readonly str?: unknown;
}
export interface PdfPage {
  getViewport(options: { scale: number }): { readonly width: number; readonly height: number };
  getTextContent(): Promise<{ readonly items: readonly PdfTextItem[] }>;
  cleanup?: () => void;
}
export interface PdfDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy?: () => Promise<void> | void;
}
export type PdfLoader = (bytes: Uint8Array) => Promise<PdfDocument>;

/**
 * Loads pdfjs only when a document is actually opened, so the editor's offline
 * bundle is not carrying a PDF engine nobody asked for.
 */
export const loadPdfWithPdfjs: PdfLoader = async (bytes) => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.mjs?url")
  ).default;
  return (await pdfjs.getDocument({
    data: bytes,
    // Instructions are read locally; never let a document pull in outside data.
    isEvalSupported: false,
    disableFontFace: false,
  }).promise) as unknown as PdfDocument;
};

function textOf(items: readonly PdfTextItem[]): string {
  return items
    .map((item) => (typeof item.str === "string" ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface IngestOptions {
  readonly limits?: InstructionLimits;
  readonly loadPdf?: PdfLoader;
  /** Reports progress so a long booklet does not look frozen. */
  readonly onProgress?: (pagesRead: number, pageCount: number) => void;
}

/**
 * Reads a PDF into an immutable, content-addressed instruction source. Nothing
 * here trusts the document: the byte length, page count, every page's extent,
 * and the total text are all bounded before the work they gate is done.
 */
export async function ingestInstructionPdf(
  file: { readonly name: string; arrayBuffer(): Promise<ArrayBuffer> },
  { limits = INSTRUCTION_PDF_LIMITS, loadPdf = loadPdfWithPdfjs, onProgress }: IngestOptions = {},
): Promise<InstructionSourceV1> {
  const buffer = await file.arrayBuffer();
  const byteLength = buffer.byteLength;
  assertIngestableSize(byteLength, file.name, limits);
  // The address must be taken before parsing: pdfjs transfers the buffer to its
  // worker and detaches it, and a byte digest is the only affordable way to
  // address tens of megabytes anyway.
  const contentHash = await sha256Hex(buffer);
  const bytes = new Uint8Array(buffer);

  let document: PdfDocument;
  try {
    document = await loadPdf(bytes);
  } catch (error) {
    throw new InstructionIngestError(
      "UNREADABLE_PDF",
      `${file.name} could not be read as a PDF: ${error instanceof Error ? error.message : "unknown parser failure"}`,
    );
  }

  try {
    assertPageCount(document.numPages, limits);
    const pages: InstructionPage[] = [];
    let totalTextChars = 0;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      assertPageExtent(pageNumber, viewport.width, viewport.height, limits);

      const content = await page.getTextContent();
      const { text, textTruncated } = boundPageText(textOf(content.items), limits);
      totalTextChars += text.length;
      assertTotalTextBudget(totalTextChars, limits);

      pages.push({
        pageNumber,
        widthPt: viewport.width,
        heightPt: viewport.height,
        text,
        textTruncated,
      });
      page.cleanup?.();
      onProgress?.(pageNumber, document.numPages);
    }

    return {
      schemaVersion: "lego.instruction-source/1",
      contentHash,
      fileName: file.name,
      byteLength,
      pageCount: document.numPages,
      pages,
      provenance: { origin: "user-supplied", ingestedBy: "lego-studio:pdf-ingest/1" },
    };
  } finally {
    await document.destroy?.();
  }
}
