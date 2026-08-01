import { coverage, maskBoundary, overlap, silhouetteFromMask } from "@lego-studio/rendering";

import type { HighlightExtraction } from "../instructions/highlight-region";

/**
 * How well a candidate placement explains the step the booklet printed.
 *
 * The picture's job here is verification, not generation: "where does this part
 * go" is hard, "do these two agree" is easy, and this is the second question.
 *
 * It is scored two ways because the booklet supplies two things. Where a step's
 * highlight closes, it encloses a region and the candidate's visible silhouette
 * can be compared against it by area, which is the stronger signal. Where the
 * step's new parts pass behind something already built, the booklet stops the
 * yellow at the occluding edge and the contour never closes — measured over
 * twelve sampled pages of the sample booklet, only 19 of 36 contours closed. So
 * the stroke itself is always scored too: how much of the printed yellow lies
 * along the candidate's own boundary, and how much of that boundary is printed.
 *
 * Neither number can see a part that is entirely hidden. A fully occluded
 * placement contributes no pixels and scores the same whether it is right or
 * wrong; physics has to carry those, and some only resolve when a later step
 * exposes them.
 */
export const STEP_SCORE_SCHEMA_VERSION = "lego.step-delta-score/1" as const;

export interface StepDeltaScoreOptions {
  /**
   * How far apart two boundaries may be and still count as the same boundary,
   * in pixels of the compared raster. Printed strokes are one to two pixels
   * wide and a fitted camera lands within a pixel, so a couple of pixels of
   * slack measures the placement rather than the rasteriser.
   */
  readonly tolerancePx?: number;
}

export interface StepDeltaScore {
  readonly schemaVersion: typeof STEP_SCORE_SCHEMA_VERSION;
  /**
   * Area agreement with what the highlight enclosed, or null when no contour on
   * this step closed. Null is not zero: it means this evidence was unavailable,
   * not that the candidate disagreed with it.
   */
  readonly regionIou: number | null;
  /** Printed stroke lying along the candidate's boundary. */
  readonly strokeRecall: number;
  /** Candidate boundary that the booklet actually printed. */
  readonly boundaryPrecision: number;
  /** Harmonic mean of the two, so neither can be bought by ignoring the other. */
  readonly strokeF1: number;
  /** The number to rank candidates by. */
  readonly score: number;
  readonly basis: "region" | "stroke";
  readonly candidateAreaPx: number;
  readonly candidateBoundaryPx: number;
  readonly strokePx: number;
}

const DEFAULT_TOLERANCE_PX = 2;

/**
 * A region score is worth more than a stroke score, but only when a region
 * exists. Blending them at a fixed weight would let a step with no closed
 * contour score systematically lower than one that has one, which ranks steps
 * against each other rather than candidates within a step.
 */
const REGION_WEIGHT = 0.6;

export function scoreStepDelta(
  candidateMask: Uint8Array,
  highlight: HighlightExtraction,
  options: StepDeltaScoreOptions = {},
): StepDeltaScore {
  const { width, height } = highlight;
  if (candidateMask.length !== width * height) {
    throw new RangeError(
      `The candidate mask holds ${candidateMask.length} pixels but the highlight was extracted at ${width}x${height}, needing ${width * height}. ` +
        `Render the candidate through the camera fitted to this panel, at the panel's own raster size.`,
    );
  }
  const tolerancePx = options.tolerancePx ?? DEFAULT_TOLERANCE_PX;
  if (!Number.isInteger(tolerancePx) || tolerancePx < 0) {
    throw new RangeError(
      `tolerancePx must be a non-negative integer, received ${String(tolerancePx)}. ` +
        `It is how far a rendered boundary may sit from the printed one and still count as the same edge.`,
    );
  }

  const hasClosedContour = highlight.regions.some((region) => !region.leaked);
  const regionIou = hasClosedContour
    ? overlap(
        silhouetteFromMask(candidateMask, width, height),
        silhouetteFromMask(highlight.mask, width, height),
      ).iou
    : null;

  const boundary = maskBoundary(candidateMask, width, height);
  const strokeRecall = coverage(highlight.strokeMask, boundary, width, height, tolerancePx);
  const boundaryPrecision = coverage(boundary, highlight.strokeMask, width, height, tolerancePx);
  const strokeF1 =
    strokeRecall + boundaryPrecision === 0
      ? 0
      : (2 * strokeRecall * boundaryPrecision) / (strokeRecall + boundaryPrecision);

  return {
    schemaVersion: STEP_SCORE_SCHEMA_VERSION,
    regionIou,
    strokeRecall,
    boundaryPrecision,
    strokeF1,
    score:
      regionIou === null ? strokeF1 : REGION_WEIGHT * regionIou + (1 - REGION_WEIGHT) * strokeF1,
    basis: regionIou === null ? "stroke" : "region",
    candidateAreaPx: candidateMask.reduce((total, value) => total + value, 0),
    candidateBoundaryPx: boundary.reduce((total, value) => total + value, 0),
    strokePx: highlight.strokeMask.reduce((total, value) => total + value, 0),
  };
}
