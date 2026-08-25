import {
  INSTRUCTION_PDF_LIMITS,
  assertIngestableSize,
  assertPageCount,
  assertPageExtent,
  assertTotalTextBudget,
  type InstructionPage,
  type InstructionSourceV1,
  type InstructionTextElement,
} from "../src/instructions/instruction-source";

import { snapshotDenseDataArray, snapshotExactDataObject } from "./bounded-data-snapshot";

const SOURCE_KEYS = [
  "schemaVersion",
  "contentHash",
  "fileName",
  "byteLength",
  "pageCount",
  "pages",
  "provenance",
] as const;
const PAGE_KEYS = [
  "pageNumber",
  "widthPt",
  "heightPt",
  "text",
  "textElements",
  "textTruncated",
] as const;
const TEXT_ELEMENT_KEYS = ["text", "heightPt", "xPt", "yPt"] as const;
const PROVENANCE_KEYS = ["origin", "ingestedBy"] as const;
const MAXIMUM_FILE_NAME_CHARS = 1_024;

interface SourceEnvelope {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly pageCount: number;
  readonly pages: readonly unknown[];
}

function snapshotSourceEnvelope(value: unknown, label: string): SourceEnvelope {
  const fields = snapshotExactDataObject(value, label, SOURCE_KEYS);
  const pageCount = fields.pageCount;
  if (typeof pageCount !== "number") {
    throw new TypeError(`${label}.pageCount must be one number.`);
  }
  assertPageCount(pageCount);
  const pages = snapshotDenseDataArray(
    fields.pages,
    `${label}.pages`,
    INSTRUCTION_PDF_LIMITS.maxPages,
  );
  if (pages.length !== pageCount) {
    throw new TypeError(
      `${label} declares ${pageCount} pages but carries ${pages.length}. Re-ingest the exact PDF.`,
    );
  }
  return { fields, pageCount, pages };
}

function isPositionOnPage(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum;
}

function snapshotInstructionPage(
  value: unknown,
  expectedPageNumber: number,
  label: string,
): InstructionPage {
  const fields = snapshotExactDataObject(value, label, PAGE_KEYS);
  const pageNumber = fields.pageNumber;
  const widthPt = fields.widthPt;
  const heightPt = fields.heightPt;
  const text = fields.text;
  const textTruncated = fields.textTruncated;
  if (
    pageNumber !== expectedPageNumber ||
    typeof widthPt !== "number" ||
    typeof heightPt !== "number"
  ) {
    throw new TypeError(`${label} must be exact page ${expectedPageNumber}.`);
  }
  assertPageExtent(pageNumber, widthPt, heightPt);
  if (
    typeof text !== "string" ||
    text.length > INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage ||
    typeof textTruncated !== "boolean"
  ) {
    throw new TypeError(`${label} exceeds its bounded text shape. Re-ingest the exact PDF.`);
  }
  const sourceElements = snapshotDenseDataArray(
    fields.textElements,
    `${label}.textElements`,
    INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage,
  );
  const textElements: InstructionTextElement[] = [];
  let positionedTextChars = 0;
  for (let index = 0; index < sourceElements.length; index += 1) {
    const elementLabel = `${label}.textElements[${index}]`;
    const element = snapshotExactDataObject(sourceElements[index], elementLabel, TEXT_ELEMENT_KEYS);
    const elementText = element.text;
    const elementHeightPt = element.heightPt;
    const elementXPt = element.xPt;
    const elementYPt = element.yPt;
    if (
      typeof elementText !== "string" ||
      elementText.length < 1 ||
      !isPositionOnPage(elementXPt, widthPt) ||
      !isPositionOnPage(elementYPt, heightPt) ||
      typeof elementHeightPt !== "number" ||
      !Number.isFinite(elementHeightPt) ||
      elementHeightPt < 0 ||
      elementHeightPt > INSTRUCTION_PDF_LIMITS.maxPageExtentPt
    ) {
      throw new TypeError(
        `${elementLabel} must contain nonempty text, a glyph height bounded to ${INSTRUCTION_PDF_LIMITS.maxPageExtentPt} pt, and a position inside page ${pageNumber}.`,
      );
    }
    positionedTextChars += (index === 0 ? 0 : 1) + elementText.length;
    if (positionedTextChars > INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage) {
      throw new RangeError(
        `${label} positioned text exceeds the ${INSTRUCTION_PDF_LIMITS.maxTextCharsPerPage}-character page limit.`,
      );
    }
    textElements.push({
      text: elementText,
      heightPt: elementHeightPt,
      xPt: elementXPt,
      yPt: elementYPt,
    });
  }
  return { pageNumber, widthPt, heightPt, text, textElements, textTruncated };
}

/** Detaches and bounds an entire caller-supplied instruction source. */
export function snapshotBoundedInstructionSource(
  value: unknown,
  label: string,
): InstructionSourceV1 {
  const envelope = snapshotSourceEnvelope(value, label);
  const schemaVersion = envelope.fields.schemaVersion;
  const contentHash = envelope.fields.contentHash;
  const fileName = envelope.fields.fileName;
  const byteLength = envelope.fields.byteLength;
  if (
    schemaVersion !== "lego.instruction-source/1" ||
    typeof contentHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(contentHash) ||
    typeof fileName !== "string" ||
    fileName.length < 1 ||
    fileName.length > MAXIMUM_FILE_NAME_CHARS ||
    typeof byteLength !== "number" ||
    !Number.isSafeInteger(byteLength)
  ) {
    throw new TypeError(
      `${label} must carry schema /1, a 1-${MAXIMUM_FILE_NAME_CHARS} character file name, a SHA-256 content hash, and a safe byte length.`,
    );
  }
  assertIngestableSize(byteLength, fileName);
  const provenance = snapshotExactDataObject(
    envelope.fields.provenance,
    `${label}.provenance`,
    PROVENANCE_KEYS,
  );
  const origin = provenance.origin;
  const ingestedBy = provenance.ingestedBy;
  if (origin !== "user-supplied" || ingestedBy !== "lego-studio:pdf-ingest/1") {
    throw new TypeError(`${label} must carry the exact user-supplied pdf-ingest/1 provenance.`);
  }
  const pages: InstructionPage[] = [];
  let totalTextChars = 0;
  let totalPositionedTextChars = 0;
  for (let index = 0; index < envelope.pages.length; index += 1) {
    const page = snapshotInstructionPage(
      envelope.pages[index],
      index + 1,
      `${label}.pages[${index}]`,
    );
    totalTextChars += page.text.length;
    totalPositionedTextChars += page.textElements.reduce(
      (sum, element, elementIndex) => sum + (elementIndex === 0 ? 0 : 1) + element.text.length,
      0,
    );
    assertTotalTextBudget(totalTextChars);
    assertTotalTextBudget(totalPositionedTextChars);
    pages.push(page);
  }
  return {
    schemaVersion,
    contentHash,
    fileName,
    byteLength,
    pageCount: envelope.pageCount,
    pages,
    provenance: { origin, ingestedBy },
  };
}

/** Detaches only selected pages and never invokes caller-owned array iteration. */
export function snapshotBoundedInstructionPages(
  source: unknown,
  pageNumbers: unknown,
  label: string,
): readonly InstructionPage[] {
  const envelope = snapshotSourceEnvelope(source, label);
  const requested = snapshotDenseDataArray(
    pageNumbers,
    `${label} page scope`,
    INSTRUCTION_PDF_LIMITS.maxPages,
  );
  const selected = new Set<number>();
  const pages: InstructionPage[] = [];
  for (let index = 0; index < requested.length; index += 1) {
    const pageNumber = requested[index];
    if (
      typeof pageNumber !== "number" ||
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > envelope.pageCount ||
      selected.has(pageNumber)
    ) {
      const observed = typeof pageNumber === "number" ? String(pageNumber) : typeof pageNumber;
      throw new RangeError(
        `${label} page scope entry ${observed} must be one unique safe integer in 1..${envelope.pageCount}.`,
      );
    }
    selected.add(pageNumber);
    pages.push(
      snapshotInstructionPage(
        envelope.pages[pageNumber - 1],
        pageNumber,
        `${label}.pages[${pageNumber - 1}]`,
      ),
    );
  }
  return pages;
}
