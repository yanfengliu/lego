import type { InstructionSourceV1 } from "./instruction-source";

/**
 * Reads a booklet's step scaffolding out of its text layer.
 *
 * A real instruction booklet prints, per page, a step number, the quantity of
 * each part that step consumes ("2x", "8x"), and the page number. That is
 * enough to check an interpretation long before any model is built, because the
 * booklet is internally redundant: step numbers must run 1..N without a gap,
 * and the quantities must add up to the set's piece count. Both are cheap,
 * global, and falsifiable, so they can be iterated against directly.
 *
 * Nothing here claims to understand the pictures. It reads only what the
 * document states in text, and reports what it could not account for.
 */
export const BOOKLET_STRUCTURE_SCHEMA_VERSION = "lego.booklet-structure/1" as const;

/** "2x", "12x" — how many of a part a step calls for. */
const QUANTITY = /^(\d{1,3})x$/;
/** A bare integer: a step number, a page number, or an inset label. */
const BARE_NUMBER = /^\d{1,4}$/;

export interface PageTokens {
  readonly pageNumber: number;
  readonly quantities: readonly number[];
  readonly bareNumbers: readonly number[];
  /** Tokens that are neither, kept so nothing is silently discarded. */
  readonly other: readonly string[];
}

export function classifyPageTokens(pageNumber: number, items: readonly string[]): PageTokens {
  const quantities: number[] = [];
  const bareNumbers: number[] = [];
  const other: string[] = [];

  for (const item of items) {
    const quantity = QUANTITY.exec(item);
    if (quantity) {
      quantities.push(Number(quantity[1]));
      continue;
    }
    if (BARE_NUMBER.test(item)) {
      bareNumbers.push(Number(item));
      continue;
    }
    other.push(item);
  }
  return { pageNumber, quantities, bareNumbers, other };
}

export interface BookletStep {
  readonly stepNumber: number;
  readonly pageNumber: number;
  /** Quantities called out on the page this step appears on. */
  readonly quantities: readonly number[];
}

export interface BookletStructure {
  readonly schemaVersion: typeof BOOKLET_STRUCTURE_SCHEMA_VERSION;
  readonly sourceHash: string;
  readonly pageCount: number;
  readonly steps: readonly BookletStep[];
  readonly totalCalloutPieces: number;
  readonly pages: readonly PageTokens[];
}

/**
 * A booklet prints its own page number on the page. Treating the token that
 * equals the page's position as the page number, and the rest as candidate
 * step numbers, is a guess — which is exactly why the contiguity check exists
 * to confirm or refute it over the whole document.
 */
export function extractBookletStructure(source: InstructionSourceV1): BookletStructure {
  const pages = source.pages.map((page) => classifyPageTokens(page.pageNumber, page.textItems));
  const steps: BookletStep[] = [];

  for (const page of pages) {
    // The page prints its own number exactly once. Dropping every token that
    // matches would also drop the step whose number happens to equal the page's
    // — which is the common case early in a booklet.
    const candidates = [...page.bareNumbers];
    const printedPageNumber = candidates.indexOf(page.pageNumber);
    if (printedPageNumber >= 0) candidates.splice(printedPageNumber, 1);
    for (const stepNumber of candidates) {
      steps.push({ stepNumber, pageNumber: page.pageNumber, quantities: page.quantities });
    }
  }

  const ordered = [...steps].sort(
    (left, right) => left.stepNumber - right.stepNumber || left.pageNumber - right.pageNumber,
  );
  return {
    schemaVersion: BOOKLET_STRUCTURE_SCHEMA_VERSION,
    sourceHash: source.contentHash,
    pageCount: source.pageCount,
    steps: ordered,
    totalCalloutPieces: pages.reduce(
      (total, page) => total + page.quantities.reduce((sum, value) => sum + value, 0),
      0,
    ),
    pages,
  };
}

export interface ConsistencyFinding {
  readonly code:
    | "STEP_SEQUENCE_GAP"
    | "STEP_SEQUENCE_DUPLICATE"
    | "STEP_SEQUENCE_EMPTY"
    | "STEP_DOES_NOT_START_AT_ONE"
    | "PIECE_COUNT_MISMATCH";
  readonly message: string;
}

export interface BookletConsistency {
  readonly stepCount: number;
  readonly highestStep: number;
  /** Steps run 1..N with no gap and no repeat. */
  readonly sequenceContiguous: boolean;
  readonly totalCalloutPieces: number;
  /** Set when a declared piece count was supplied to check against. */
  readonly pieceCountMatches: boolean | null;
  readonly findings: readonly ConsistencyFinding[];
  /**
   * Fraction of 1..highestStep actually accounted for. The number to drive to 1
   * while the parse is being improved.
   */
  readonly sequenceCoverage: number;
}

/**
 * Checks a parse against itself. None of this needs a ground-truth model, so it
 * is available the moment a booklet is read.
 */
export function checkBookletConsistency(
  structure: BookletStructure,
  declaredPieceCount?: number,
): BookletConsistency {
  const findings: ConsistencyFinding[] = [];
  const stepNumbers = structure.steps.map(({ stepNumber }) => stepNumber);
  const unique = [...new Set(stepNumbers)].sort((left, right) => left - right);
  const highestStep = unique.at(-1) ?? 0;

  if (unique.length === 0) {
    findings.push({
      code: "STEP_SEQUENCE_EMPTY",
      message: "No step numbers were recovered from the booklet's text layer",
    });
  } else {
    if (unique[0] !== 1) {
      findings.push({
        code: "STEP_DOES_NOT_START_AT_ONE",
        message: `The lowest recovered step is ${unique[0]}, but a booklet starts at step 1`,
      });
    }
    const duplicates = [
      ...new Set(stepNumbers.filter((value, index) => stepNumbers.indexOf(value) !== index)),
    ];
    if (duplicates.length > 0) {
      findings.push({
        code: "STEP_SEQUENCE_DUPLICATE",
        message: `${duplicates.length} step number(s) appear more than once, starting with ${duplicates[0]}`,
      });
    }
    const missing: number[] = [];
    for (let step = 1; step <= highestStep; step += 1) {
      if (!unique.includes(step)) missing.push(step);
    }
    if (missing.length > 0) {
      findings.push({
        code: "STEP_SEQUENCE_GAP",
        message: `${missing.length} of ${highestStep} steps are missing, starting with ${missing[0]}`,
      });
    }
  }

  let pieceCountMatches: boolean | null = null;
  if (declaredPieceCount !== undefined) {
    pieceCountMatches = structure.totalCalloutPieces === declaredPieceCount;
    if (!pieceCountMatches) {
      findings.push({
        code: "PIECE_COUNT_MISMATCH",
        message: `Callouts add up to ${structure.totalCalloutPieces} pieces but the set declares ${declaredPieceCount}`,
      });
    }
  }

  return {
    stepCount: unique.length,
    highestStep,
    sequenceContiguous: findings.every(({ code }) => !code.startsWith("STEP_")),
    totalCalloutPieces: structure.totalCalloutPieces,
    pieceCountMatches,
    findings,
    sequenceCoverage: highestStep === 0 ? 0 : unique.length / highestStep,
  };
}
