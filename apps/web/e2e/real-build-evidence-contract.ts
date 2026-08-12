import {
  isSha256Digest,
  type SearchStrategy,
  type SearchStrategyEvidence,
  type StepFailure,
  type WholeStepEvidenceKind,
  type WholeStepVisualEvidence,
} from "./real-build-safety";

/**
 * The joint gate on a whole printed step, over whichever evidence its panel drew.
 *
 * Two different questions are asked here and they must not be confused.
 *
 * **Reuse** — every placed piece explains a calibrated amount of printed
 * evidence that no other piece in the step explains. It is what stops several
 * greedy pieces from all claiming one blob, and it is the same question on both
 * kinds of panel.
 *
 * **Explanation** is not asked here, and where it went is the point.
 *
 * On a `region` panel the drawing encloses an area and the exploded road's
 * containment decides: the candidate must have no pixel outside the printed
 * region, which works because the yellow is drawn *outward* of the silhouette so
 * the truth is strictly inside it.
 *
 * On a `stroke` panel there is no enclosed area, and **neither one-sided pixel
 * test survives measurement.** Both were tried on printed step 5 of the sample
 * booklet, whose two contours are both open, against all 374 distinct placements
 * of its Plate 2 x 14 and all 174 of its Plate 2 x 4:
 *
 * - "every printed pixel is explained" — the best placement of the 2 x 14 is the
 *   unique maximum at 907 of the 1081 pixels its own contour prints, and the 174
 *   it misses are the *outer row* of a two-pixel printed stroke drawn outward of
 *   the true silhouette by more than `tolerancePx`. The residue is the artist's
 *   offset, not the placement, and no placement of that part does better.
 * - "no printed pixel lies inside the piece" — the same best placement has 433
 *   printed pixels inside its own silhouette, because a two-pixel line straddling
 *   a boundary is half inside it. And 166 of the 374 placements cross nothing at
 *   all, being nowhere near the drawing, so the test does not discriminate even
 *   where it holds.
 *
 * A stroke straddles the boundary it marks; it is not on one side of it. So the
 * hard test moved to where the evidence supports one: the placement search ranks
 * an open contour by `rankStepDelta` — the printed line the candidate explains,
 * with no precision term to buy by spilling — and the accepted placement must
 * beat the runner-up by the run's own `minimumScoreMargin` or the step defers to
 * the next panel, which is the same machinery printed step 4 already uses. That
 * is threshold-free in containment's way (an argmax and an existing separation
 * bar rather than a new cut), falsifiable by a single better candidate, and it
 * keeps containment's essential property: a candidate spilling outside the
 * printed contour cannot win, because spilled boundary explains no printed pixel.
 * Measured on step 5 the margin is 907 against 709 on the 2 x 14 and 347 against
 * 265 on the 2 x 4, against a margin bar of 0.01.
 *
 * What remains here is reuse, and making it askable at all on an open contour is
 * the change: measured against the region mask both pieces of step 5 explained
 * 0px, because an open contour encloses nothing.
 */
export function assessWholeStepVisualEvidence(input: {
  readonly stepNumber: number;
  readonly score: number;
  readonly minimumScore: number;
  readonly minimumExclusiveHighlightPixelsPerPiece: number;
  readonly calibrationDigest: string | null;
  readonly evidenceKind: WholeStepEvidenceKind;
  readonly printedEvidencePixels: number;
  readonly unionHighlightPixels: number;
  readonly summedPieceHighlightPixels: number;
  readonly exclusiveHighlightPixelsByPiece: readonly number[];
  readonly unexplainedBoundsPx: readonly [number, number, number, number] | null;
}): WholeStepVisualEvidence {
  const facts = {
    score: Number.isFinite(input.score) ? input.score : null,
    minimumScore: input.minimumScore,
    minimumExclusiveHighlightPixelsPerPiece: input.minimumExclusiveHighlightPixelsPerPiece,
    calibrationDigest: input.calibrationDigest,
    evidenceKind: input.evidenceKind,
    printedEvidencePixels: input.printedEvidencePixels,
    unionHighlightPixels: input.unionHighlightPixels,
    summedPieceHighlightPixels: input.summedPieceHighlightPixels,
    exclusiveHighlightPixelsByPiece: input.exclusiveHighlightPixelsByPiece,
    unexplainedBoundsPx: input.unexplainedBoundsPx,
  };
  if (
    !Number.isFinite(input.minimumScore) ||
    input.minimumScore < 0.4 ||
    !Number.isFinite(input.score) ||
    input.score < input.minimumScore
  ) {
    return {
      ...facts,
      failure: {
        code: "whole-step-score-too-low",
        stage: "evidence",
        message:
          `Step ${input.stepNumber} joint visual score is ${input.score}, below the measured threshold ` +
          `${input.minimumScore}. The whole printed step is refused; a positive score alone is not evidence.`,
      },
    };
  }
  const calibrationValid =
    Number.isInteger(input.minimumExclusiveHighlightPixelsPerPiece) &&
    input.minimumExclusiveHighlightPixelsPerPiece >= 2 &&
    isSha256Digest(input.calibrationDigest);
  const unexplained = input.exclusiveHighlightPixelsByPiece
    .map((pixels, pieceIndex) => ({ pixels, pieceIndex }))
    .filter(
      ({ pixels }) =>
        !Number.isInteger(pixels) || pixels < input.minimumExclusiveHighlightPixelsPerPiece,
    );
  if (
    !calibrationValid ||
    input.unionHighlightPixels <= 0 ||
    input.summedPieceHighlightPixels < input.unionHighlightPixels ||
    unexplained.length > 0
  ) {
    const pieceIndex = unexplained[0]?.pieceIndex;
    return {
      ...facts,
      failure: {
        code: "highlight-reuse-unexplained",
        stage: "evidence",
        ...(pieceIndex === undefined ? {} : { pieceIndex }),
        message:
          // Which evidence, and how much of it there was, before any of the
          // counts. This refusal used to open with "union 0px" against a panel
          // whose contours were all open, so the region mask it measured was
          // empty by construction and the 1429px the booklet drew were never
          // in the comparison — a reader has to be told what was measured
          // before a zero means anything.
          `Step ${input.stepNumber} cannot explain its joint highlight coverage. Measured against ` +
          `${input.printedEvidencePixels}px of printed ` +
          `${input.evidenceKind === "stroke" ? "open contour, none of whose contours closed" : "enclosed highlight region"}` +
          `: union ${input.unionHighlightPixels}px, summed per-piece ` +
          `${input.summedPieceHighlightPixels}px, exclusive pixels ` +
          `[${input.exclusiveHighlightPixelsByPiece.join(", ")}], required minimum ` +
          `${input.minimumExclusiveHighlightPixelsPerPiece}px per piece, calibration ` +
          `${JSON.stringify(input.calibrationDigest ?? "missing")}, printed evidence no piece claimed ` +
          `inside panel box ` +
          `${input.unexplainedBoundsPx === null ? "nowhere" : `[${input.unexplainedBoundsPx.join(",")}]`}` +
          `. Every placed piece must explain a calibrated amount of distinct printed evidence; several ` +
          `greedy pieces cannot reuse one highlight.`,
      },
    };
  }
  return { ...facts, failure: null };
}

/**
 * How the printed evidence divides between the pieces a step placed.
 *
 * `pieceClaims` is what each piece can account for on this panel, and it is not
 * the same set on both kinds of panel. Against an enclosed region it is the
 * piece's own visible silhouette: area explains area. Against an open contour
 * there is no area, and a filled silhouette would claim stroke by *covering* it
 * rather than by lying along it — a wrongly enlarged piece would then explain a
 * contour it does not trace. So the claim there is the piece's visible boundary
 * widened by the run's boundary tolerance, and stroke is explained by boundary.
 *
 * Both callers pass masks in the same raster, and the counting is identical:
 * that is the point of the shared shape, because "which piece owns this printed
 * pixel" is one question whatever the pixel is a pixel of.
 */
export function measureWholeStepMaskEvidence(
  pieceClaims: readonly Uint8Array[],
  highlightMask: Uint8Array,
  widthPx: number,
): {
  readonly unionHighlightPixels: number;
  readonly summedPieceHighlightPixels: number;
  readonly exclusiveHighlightPixelsByPiece: readonly number[];
  readonly unexplainedBoundsPx: readonly [number, number, number, number] | null;
} {
  let unionHighlightPixels = 0;
  let summedPieceHighlightPixels = 0;
  const exclusiveHighlightPixelsByPiece = pieceClaims.map(() => 0);
  // Where the printed evidence nothing claimed actually is. A count alone sends
  // a reader looking for it; a box on the panel says which contour it is, and
  // the panel raster is the only place that answer lives.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let pixel = 0; pixel < highlightMask.length; pixel += 1) {
    if (highlightMask[pixel] !== 1) continue;
    const owners: number[] = [];
    for (let owner = 0; owner < pieceClaims.length; owner += 1) {
      if (pieceClaims[owner]?.[pixel] === 1) owners.push(owner);
    }
    if (owners.length > 0) unionHighlightPixels += 1;
    else if (Number.isSafeInteger(widthPx) && widthPx > 0) {
      const x = pixel % widthPx;
      const y = (pixel - x) / widthPx;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    summedPieceHighlightPixels += owners.length;
    if (owners.length === 1) {
      const owner = owners[0]!;
      exclusiveHighlightPixelsByPiece[owner] = (exclusiveHighlightPixelsByPiece[owner] ?? 0) + 1;
    }
  }
  return {
    unionHighlightPixels,
    summedPieceHighlightPixels,
    exclusiveHighlightPixelsByPiece,
    unexplainedBoundsPx:
      maxX < minX ? null : ([minX, minY, maxX, maxY] as readonly [number, number, number, number]),
  };
}

export function maskCentroid(mask: Uint8Array, width: number, height: number) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  return count === 0 ? null : { x: sumX / count, y: sumY / count, count };
}

export function shiftedMaskIou(input: {
  readonly mask: Uint8Array;
  readonly target: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly dx: number;
  readonly dy: number;
  /**
   * Pixels where neither side is defined, in target space. Omitted counts them
   * all.
   *
   * A panel draws the part a step adds *over* what the steps before it built, so
   * inside its highlight the target simply stops reporting the model — and
   * charging the model for that bite measures the drawing's occlusion rather
   * than the model's agreement. Measured on the sample booklet's printed step 3:
   * without the exclusion the correct quarter turn scores 0.6267 and a wrong one
   * 0.6435, so the choice inverts; with it they are 0.8898 and 0.7762.
   */
  readonly excluded?: Uint8Array | null;
}): number {
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < input.height; y += 1) {
    const sourceY = y - input.dy;
    for (let x = 0; x < input.width; x += 1) {
      if (input.excluded != null && input.excluded[y * input.width + x] === 1) continue;
      const sourceX = x - input.dx;
      const here =
        sourceX < 0 || sourceX >= input.width || sourceY < 0 || sourceY >= input.height
          ? 0
          : input.mask[sourceY * input.width + sourceX]!;
      const there = input.target[y * input.width + x]!;
      if (here === 1 && there === 1) intersection += 1;
      if (here === 1 || there === 1) union += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

export function instructionSilhouetteMasks(
  pixels: Uint8Array,
  width: number,
  height: number,
  probeHex: number,
): { readonly all: Uint8Array; readonly probe: Uint8Array } {
  const all = new Uint8Array(width * height);
  const probe = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const red = pixels[index * 4]!;
    const green = pixels[index * 4 + 1]!;
    const blue = pixels[index * 4 + 2]!;
    const key = (red << 16) | (green << 8) | blue;
    const isBackground =
      Math.abs(red - 0x89) <= 6 && Math.abs(green - 0x90) <= 6 && Math.abs(blue - 0x93) <= 6;
    if (!isBackground) all[index] = 1;
    if (key === probeHex) probe[index] = 1;
  }
  return { all, probe };
}

export function adjudicateSearchBenchmark(input: {
  readonly stepNumber: number;
  readonly pruned: SearchStrategyEvidence;
  readonly exhaustive: SearchStrategyEvidence;
}): { readonly accepted: SearchStrategy | null; readonly failure: StepFailure | null } {
  const comparableScores =
    input.pruned.bestScore !== null &&
    input.exhaustive.bestScore !== null &&
    Number.isFinite(input.pruned.bestScore) &&
    Number.isFinite(input.exhaustive.bestScore) &&
    Math.abs(input.pruned.bestScore - input.exhaustive.bestScore) <= 1e-12;
  if (
    input.pruned.failure === null &&
    input.exhaustive.failure === null &&
    input.pruned.winnerKey !== null &&
    input.pruned.winnerKey === input.exhaustive.winnerKey &&
    input.pruned.rendered > 0 &&
    input.exhaustive.rendered > 0 &&
    comparableScores
  ) {
    return { accepted: "pruned", failure: null };
  }
  // Each strategy reports its own outcome in its own words. A strategy that
  // refused has a message saying what it refused over — how many candidates were
  // eligible, what budget they passed — and interpolating only its failure code
  // throws that away, leaving a disagreement nobody can act on without rerunning
  // the step.
  const summarise = (evidence: SearchStrategyEvidence): string =>
    `${evidence.strategy}: ${evidence.winnerKey ?? evidence.failure?.code ?? "none"} score ` +
    `${evidence.bestScore ?? "none"} from ${evidence.rendered} renders in ${evidence.elapsedMs}ms` +
    `${evidence.failure === null ? "" : ` — ${evidence.failure.message}`}`;
  return {
    accepted: null,
    failure: {
      code: "benchmark-disagreement",
      stage: "benchmark",
      message:
        `Step ${input.stepNumber} pruned and exhaustive search do not establish the same independently ` +
        `scored winner at the same quality. ${summarise(input.pruned)}; ${summarise(input.exhaustive)}. ` +
        `A digest or declared policy cannot turn unresolved visual disagreement into reconstruction truth.`,
    },
  };
}
