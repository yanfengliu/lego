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

export interface NumberSighting {
  readonly value: number;
  readonly pageNumber: number;
  readonly heightPt: number;
}

/**
 * How well one glyph size explains a booklet's step numbering: a run of 1..N
 * with nothing missing and nothing repeated scores 1.
 */
function scoreAsStepNumbering(sightings: readonly NumberSighting[]): number {
  if (sightings.length === 0) return 0;
  const values = sightings.map(({ value }) => value);
  const unique = new Set(values);
  const highest = Math.max(...values);
  if (!unique.has(1)) return 0;
  const contiguity = unique.size / highest;
  // Repeats are what an inset label looks like, so they cost.
  const distinctness = unique.size / values.length;
  return contiguity * distinctness;
}

/**
 * Drops the page number each page prints.
 *
 * Page numbers also run 1..N perfectly and would otherwise outscore the real
 * step numbering. They are identifiable without guessing: on each page, at most
 * one sighting both equals that page's own number and is set in the smallest
 * type on the page. A step number that happens to match its page is set larger,
 * so it survives.
 */
export function withoutPrintedPageNumbers(sightings: readonly NumberSighting[]): NumberSighting[] {
  const smallestByPage = new Map<number, number>();
  for (const { pageNumber, heightPt } of sightings) {
    const smallest = smallestByPage.get(pageNumber);
    if (smallest === undefined || heightPt < smallest) smallestByPage.set(pageNumber, heightPt);
  }

  const dropped = new Set<number>();
  return sightings.filter((sighting) => {
    const isPrintedPageNumber =
      sighting.value === sighting.pageNumber &&
      sighting.heightPt === smallestByPage.get(sighting.pageNumber) &&
      !dropped.has(sighting.pageNumber);
    if (isPrintedPageNumber) {
      dropped.add(sighting.pageNumber);
      return false;
    }
    return true;
  });
}

/**
 * Picks the glyph size the booklet prints its step numbers at.
 *
 * Step numbers, inset labels, and page numbers are all bare integers and cannot
 * be told apart by their text. They are set at different sizes, so size is the
 * discriminator — but rather than hardcode one, every size present is scored by
 * how well it explains a 1..N numbering and the best is taken. The consistency
 * check thus chooses its own parameter, and a booklet that sets its steps at
 * some other size still parses.
 */
export function selectStepNumberHeight(allSightings: readonly NumberSighting[]): number | null {
  const sightings = withoutPrintedPageNumbers(allSightings);
  const byHeight = new Map<number, NumberSighting[]>();
  for (const sighting of sightings) {
    const bucket = byHeight.get(sighting.heightPt);
    if (bucket) bucket.push(sighting);
    else byHeight.set(sighting.heightPt, [sighting]);
  }

  let best: { heightPt: number; score: number; count: number } | null = null;
  for (const [heightPt, bucket] of byHeight) {
    const score = scoreAsStepNumbering(bucket);
    if (score === 0) continue;
    // Ties go to the size that accounts for more of the booklet.
    if (!best || score > best.score || (score === best.score && bucket.length > best.count)) {
      best = { heightPt, score, count: bucket.length };
    }
  }
  return best?.heightPt ?? null;
}

/**
 * Reads the step scaffolding. Where a booklet prints its step numbers is
 * inferred from the document itself rather than assumed, and the contiguity
 * check then confirms or refutes that inference over the whole document.
 */
export function extractBookletStructure(source: InstructionSourceV1): BookletStructure {
  const pages = source.pages.map((page) =>
    classifyPageTokens(
      page.pageNumber,
      page.textElements.map(({ text }) => text),
    ),
  );
  const sightings: NumberSighting[] = source.pages.flatMap((page) =>
    page.textElements
      .filter(({ text }) => BARE_NUMBER.test(text))
      .map(({ text, heightPt }) => ({
        value: Number(text),
        pageNumber: page.pageNumber,
        heightPt: Math.round(heightPt * 10) / 10,
      })),
  );
  const stepHeight = selectStepNumberHeight(sightings);
  const stepSightings = withoutPrintedPageNumbers(sightings);
  const steps: BookletStep[] = [];

  for (const page of pages) {
    const onPage = stepSightings.filter(({ pageNumber }) => pageNumber === page.pageNumber);
    let candidates: number[];
    if (stepHeight === null) {
      // No size explains the numbering, so fall back to every bare number less
      // the page's own, and let the consistency findings say how badly that went.
      candidates = [...page.bareNumbers];
      const printed = candidates.indexOf(page.pageNumber);
      if (printed >= 0) candidates.splice(printed, 1);
    } else {
      candidates = onPage
        .filter(({ heightPt }) => heightPt === stepHeight)
        .map(({ value }) => value);
    }
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
