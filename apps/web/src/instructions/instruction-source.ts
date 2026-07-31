/**
 * An instruction PDF is hostile input: it arrives from outside the app, it can
 * be enormous, and it can claim any page count or page size it likes. Every
 * bound here is enforced before the corresponding work is done, so a malicious
 * or simply broken file cannot exhaust memory or wedge the editor.
 */
export const INSTRUCTION_PDF_LIMITS = Object.freeze({
  maxBytes: 96 * 1024 * 1024,
  maxPages: 400,
  /** PDF user-space points; roughly 69 inches, well beyond any real booklet. */
  maxPageExtentPt: 5000,
  maxTextCharsPerPage: 20_000,
  maxTotalTextChars: 2_000_000,
});

export type InstructionLimits = typeof INSTRUCTION_PDF_LIMITS;

export type InstructionIngestErrorCode =
  | "SOURCE_TOO_LARGE"
  | "SOURCE_EMPTY"
  | "TOO_MANY_PAGES"
  | "PAGE_TOO_LARGE"
  | "TEXT_BUDGET_EXCEEDED"
  | "UNREADABLE_PDF";

export class InstructionIngestError extends Error {
  public readonly code: InstructionIngestErrorCode;

  public constructor(code: InstructionIngestErrorCode, message: string) {
    super(message);
    this.name = "InstructionIngestError";
    this.code = code;
  }
}

export interface InstructionTextElement {
  readonly text: string;
  /** Glyph height in PDF points. A step number is printed far larger than an inset label. */
  readonly heightPt: number;
  readonly xPt: number;
  readonly yPt: number;
}

export interface InstructionPage {
  readonly pageNumber: number;
  readonly widthPt: number;
  readonly heightPt: number;
  /** Text layer as extracted, already truncated to the per-page budget. */
  readonly text: string;
  /** The same text as positioned elements; token boundaries and glyph size both matter. */
  readonly textElements: readonly InstructionTextElement[];
  readonly textTruncated: boolean;
}

export interface InstructionSourceV1 {
  readonly schemaVersion: "lego.instruction-source/1";
  /** Content address of the exact bytes ingested. */
  readonly contentHash: string;
  readonly fileName: string;
  readonly byteLength: number;
  readonly pageCount: number;
  readonly pages: readonly InstructionPage[];
  readonly provenance: {
    readonly origin: "user-supplied";
    readonly ingestedBy: "lego-studio:pdf-ingest/1";
  };
}

/** Rejects a file before any of its bytes are parsed. */
export function assertIngestableSize(
  byteLength: number,
  fileName: string,
  limits: InstructionLimits = INSTRUCTION_PDF_LIMITS,
): void {
  if (byteLength <= 0) {
    throw new InstructionIngestError("SOURCE_EMPTY", `${fileName} is empty, so it holds no steps`);
  }
  if (byteLength > limits.maxBytes) {
    throw new InstructionIngestError(
      "SOURCE_TOO_LARGE",
      `${fileName} is ${Math.round(byteLength / 1024 / 1024)} MB, over the ${Math.round(
        limits.maxBytes / 1024 / 1024,
      )} MB instruction limit`,
    );
  }
}

export function assertPageCount(
  pageCount: number,
  limits: InstructionLimits = INSTRUCTION_PDF_LIMITS,
): void {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new InstructionIngestError(
      "UNREADABLE_PDF",
      `The document reports ${pageCount} pages, which cannot be read as instructions`,
    );
  }
  if (pageCount > limits.maxPages) {
    throw new InstructionIngestError(
      "TOO_MANY_PAGES",
      `The document has ${pageCount} pages, over the ${limits.maxPages}-page instruction limit`,
    );
  }
}

export function assertPageExtent(
  pageNumber: number,
  widthPt: number,
  heightPt: number,
  limits: InstructionLimits = INSTRUCTION_PDF_LIMITS,
): void {
  const invalid = [widthPt, heightPt].some(
    (extent) => !Number.isFinite(extent) || extent <= 0 || extent > limits.maxPageExtentPt,
  );
  if (invalid) {
    throw new InstructionIngestError(
      "PAGE_TOO_LARGE",
      `Page ${pageNumber} measures ${widthPt} x ${heightPt} pt, outside the 0 to ${limits.maxPageExtentPt} pt range instructions are read in`,
    );
  }
}

/** Truncates a page's text to its budget, reporting whether anything was cut. */
export function boundPageText(
  text: string,
  limits: InstructionLimits = INSTRUCTION_PDF_LIMITS,
): { readonly text: string; readonly textTruncated: boolean } {
  if (text.length <= limits.maxTextCharsPerPage) return { text, textTruncated: false };
  return { text: text.slice(0, limits.maxTextCharsPerPage), textTruncated: true };
}

export function assertTotalTextBudget(
  totalChars: number,
  limits: InstructionLimits = INSTRUCTION_PDF_LIMITS,
): void {
  if (totalChars > limits.maxTotalTextChars) {
    throw new InstructionIngestError(
      "TEXT_BUDGET_EXCEEDED",
      `The document's text layer exceeds the ${limits.maxTotalTextChars}-character instruction budget at ${totalChars} characters`,
    );
  }
}

export interface InstructionSourceSummary {
  readonly pageCount: number;
  readonly pagesWithText: number;
  readonly totalTextChars: number;
  readonly truncatedPages: readonly number[];
  readonly megabytes: number;
}

export function summarizeInstructionSource(source: InstructionSourceV1): InstructionSourceSummary {
  return {
    pageCount: source.pageCount,
    pagesWithText: source.pages.filter((page) => page.text.trim().length > 0).length,
    totalTextChars: source.pages.reduce((total, page) => total + page.text.length, 0),
    truncatedPages: source.pages
      .filter((page) => page.textTruncated)
      .map((page) => page.pageNumber),
    megabytes: Math.round((source.byteLength / 1024 / 1024) * 10) / 10,
  };
}
