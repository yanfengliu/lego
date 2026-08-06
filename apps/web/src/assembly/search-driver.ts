import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { HighlightExtraction, HighlightRegionBounds } from "../instructions/highlight-region";
import { placementOccupancyKey, type PlacementCandidate } from "./enumerate-placements";
import type { StepDeltaScore } from "./step-score";

/**
 * The closed loop, one step at a time.
 *
 * An open-loop pipeline makes 359 decisions and finds out at the end; at 99%
 * per-step accuracy that is a 3% chance of a correct build. Checking each step
 * against the booklet's own picture catches an error where it is born, so
 * errors never compound.
 *
 * Two things keep it affordable. Most candidates are rejected without rendering
 * anything: the step's highlight says where on the page the new part is, and a
 * candidate whose projected bounding box lands nowhere near it cannot be the
 * one drawn, which is decided by projecting eight corners rather than by
 * rasterising a model. And the beam carries several live candidates instead of
 * committing, so an ambiguous step is settled by the next step's picture rather
 * than by unwinding.
 *
 * The driver never renders, never enumerates and never validates. It is handed
 * those as callbacks, which is what lets the search logic be tested without a
 * graphics context and what keeps its determinism honest: the search is a
 * generator, and its output is a build program that replays with no rendering
 * and no search at all.
 */
export const SEARCH_DRIVER_SCHEMA_VERSION = "lego.build-search-driver/1" as const;

export interface BeamEntry {
  /** Node in the build tree this branch has reached, null before the first step. */
  readonly nodeId: string | null;
  readonly document: BrickDocumentV1;
  /** Sum of the per-step scores along this branch. */
  readonly cumulativeScore: number;
  /** Per-step scores in build order, so a branch can say where it got weak. */
  readonly stepScores: readonly number[];
}

export interface ScoredCandidate {
  readonly candidate: PlacementCandidate;
  readonly score: StepDeltaScore;
}

export interface StepTarget {
  readonly stepNumber: number;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly highlight: HighlightExtraction;
}

export interface SearchDriverDeps {
  /** Every legal placement of the step's part on this branch's document. */
  enumerate(document: BrickDocumentV1, catalogPartId: string): readonly PlacementCandidate[];
  /**
   * Screen-space box a candidate would occupy on this branch, or null when it
   * projects entirely off the panel. Cheap: eight corners, no rasterisation.
   */
  projectBounds(
    document: BrickDocumentV1,
    candidate: PlacementCandidate,
  ): HighlightRegionBounds | null;
  /** Visible pixels of the candidate once placed, in the panel's raster. */
  renderCandidateMask(document: BrickDocumentV1, candidate: PlacementCandidate): Uint8Array;
  score(mask: Uint8Array, highlight: HighlightExtraction): StepDeltaScore;
  /** Applies an accepted placement, returning the document and its tree node. */
  apply(
    entry: BeamEntry,
    candidate: PlacementCandidate,
    stepNumber: number,
  ): { readonly document: BrickDocumentV1; readonly nodeId: string };
}

export interface SearchDriverOptions {
  /** How many branches survive each step. One is commit-and-backtrack. */
  readonly beamWidth?: number;
  /**
   * How far outside the highlight's box a candidate may project and still be
   * rendered, in pixels. It absorbs the camera fit's residual and the width of
   * the printed stroke; it is not a search radius.
   */
  readonly proximityMarginPx?: number;
  /**
   * Most candidates a single branch renders per step, after the cheap prune.
   * Exceeded means the prune failed to localise, which is a fact about the step
   * worth reporting rather than a budget to silently spend.
   */
  readonly maxRendersPerBranch?: number;
}

export interface StepOutcome {
  readonly stepNumber: number;
  readonly beam: readonly BeamEntry[];
  readonly enumerated: number;
  readonly rendered: number;
  readonly prunedByProximity: number;
  /** Candidates that occupy exactly what an earlier candidate already did. */
  readonly duplicateSpellings: number;
  readonly bestScore: number;
  /** Set when the whole beam died, which is when backtracking is the fallback. */
  readonly failure: string | null;
}

export class SearchDriverError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SearchDriverError";
  }
}

const DEFAULT_BEAM_WIDTH = 3;
const DEFAULT_PROXIMITY_MARGIN_PX = 12;
const DEFAULT_MAX_RENDERS_PER_BRANCH = 24;

function boxesOverlap(
  left: HighlightRegionBounds,
  right: HighlightRegionBounds,
  marginPx: number,
): boolean {
  return (
    left.minXPx - marginPx <= right.maxXPx &&
    right.minXPx - marginPx <= left.maxXPx &&
    left.minYPx - marginPx <= right.maxYPx &&
    right.minYPx - marginPx <= left.maxYPx
  );
}

/** The box every highlight on this step falls inside. */
export function highlightBounds(highlight: HighlightExtraction): HighlightRegionBounds | null {
  if (highlight.regions.length === 0) return null;
  return highlight.regions.reduce<HighlightRegionBounds>(
    (union, region) => ({
      minXPx: Math.min(union.minXPx, region.bounds.minXPx),
      minYPx: Math.min(union.minYPx, region.bounds.minYPx),
      maxXPx: Math.max(union.maxXPx, region.bounds.maxXPx),
      maxYPx: Math.max(union.maxYPx, region.bounds.maxYPx),
    }),
    highlight.regions[0]!.bounds,
  );
}

export interface StepExpansion {
  /** Every candidate this branch rendered, best score first. */
  readonly scored: readonly ScoredCandidate[];
  readonly enumerated: number;
  readonly rendered: number;
  readonly prunedByProximity: number;
  readonly duplicateSpellings: number;
  /** Candidates the picture localised to but the render budget could not reach. */
  readonly overflowed: number;
}

/**
 * Everything one branch can do at one step: enumerate, prune against the
 * printed highlight, render what survives, and score it.
 *
 * Factored out because the beam and the backtracking driver differ only in what
 * they do with this list — the beam keeps its best few and moves on, the
 * backtracker keeps the whole list so it can come back for the next one.
 */
export function expandStep(
  entry: BeamEntry,
  target: StepTarget,
  deps: SearchDriverDeps,
  options: SearchDriverOptions = {},
): StepExpansion {
  const proximityMarginPx = options.proximityMarginPx ?? DEFAULT_PROXIMITY_MARGIN_PX;
  const maxRendersPerBranch = options.maxRendersPerBranch ?? DEFAULT_MAX_RENDERS_PER_BRANCH;
  const targetBounds = highlightBounds(target.highlight);
  const candidates = deps.enumerate(entry.document, target.catalogPartId);

  // The picture says where on the page the step's part is. A candidate that
  // projects nowhere near it is rejected for the cost of eight corners.
  //
  // Equivalent spellings collapse here rather than in the enumerator: a 2x4
  // brick at yaw 0 and at yaw 180 occupy the same studs and would render
  // identically, so rendering both is pure waste. The enumerator keeps both
  // because its completeness is checked against a brute-force sweep that also
  // keeps both, and that check is worth more than the saving.
  const seenOccupancy = new Set<string>();
  const near: PlacementCandidate[] = [];
  let prunedByProximity = 0;
  let duplicateSpellings = 0;
  for (const candidate of candidates) {
    const occupancy = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seenOccupancy.has(occupancy)) {
      duplicateSpellings += 1;
      continue;
    }
    seenOccupancy.add(occupancy);
    if (targetBounds === null) {
      near.push(candidate);
      continue;
    }
    const projected = deps.projectBounds(entry.document, candidate);
    if (projected === null || !boxesOverlap(projected, targetBounds, proximityMarginPx)) {
      prunedByProximity += 1;
      continue;
    }
    near.push(candidate);
  }

  // Closest projection first, so a truncated budget spends itself on the
  // candidates the picture points at rather than on an arbitrary prefix.
  const overflowed = Math.max(0, near.length - maxRendersPerBranch);
  if (targetBounds !== null && overflowed > 0) {
    const centreX = (targetBounds.minXPx + targetBounds.maxXPx) / 2;
    const centreY = (targetBounds.minYPx + targetBounds.maxYPx) / 2;
    const distance = (placement: PlacementCandidate): number => {
      const box = deps.projectBounds(entry.document, placement);
      if (box === null) return Number.POSITIVE_INFINITY;
      return Math.hypot(
        (box.minXPx + box.maxXPx) / 2 - centreX,
        (box.minYPx + box.maxYPx) / 2 - centreY,
      );
    };
    const ranked = near.map((placement) => ({ placement, distance: distance(placement) }));
    ranked.sort((left, right) => left.distance - right.distance);
    near.length = 0;
    near.push(...ranked.map((entryRanked) => entryRanked.placement));
  }

  const scored: ScoredCandidate[] = [];
  for (const candidate of near.slice(0, maxRendersPerBranch)) {
    const mask = deps.renderCandidateMask(entry.document, candidate);
    scored.push({ candidate, score: deps.score(mask, target.highlight) });
  }
  scored.sort((left, right) => right.score.score - left.score.score);
  return {
    scored,
    enumerated: candidates.length,
    rendered: scored.length,
    prunedByProximity,
    duplicateSpellings,
    overflowed,
  };
}

/**
 * Advances every branch of the beam by one step and keeps the best branches.
 *
 * A branch that finds no candidate simply does not continue; only when every
 * branch fails is the step a failure, and then the caller backtracks. That
 * asymmetry is the point of a beam: an ambiguous step costs a wider frontier
 * rather than an unwind.
 */
export function advanceBeam(
  beam: readonly BeamEntry[],
  target: StepTarget,
  deps: SearchDriverDeps,
  options: SearchDriverOptions = {},
): StepOutcome {
  if (beam.length === 0) {
    throw new SearchDriverError(
      `Cannot advance an empty beam at step ${target.stepNumber}. ` +
        `Seed it with one entry holding the base document before the first step; an exhausted beam is reported as a step failure, not passed back in.`,
    );
  }
  const beamWidth = options.beamWidth ?? DEFAULT_BEAM_WIDTH;
  if (!Number.isInteger(beamWidth) || beamWidth < 1) {
    throw new SearchDriverError(
      `beamWidth must be a positive integer, received ${String(beamWidth)}. ` +
        `A width of 1 is commit-and-backtrack; widen it when a step is ambiguous rather than disabling the beam.`,
    );
  }

  const target_bounds = highlightBounds(target.highlight);
  const next: BeamEntry[] = [];
  let enumerated = 0;
  let rendered = 0;
  let prunedByProximity = 0;
  let duplicateSpellings = 0;

  for (const entry of beam) {
    const expansion = expandStep(entry, target, deps, options);
    enumerated += expansion.enumerated;
    rendered += expansion.rendered;
    prunedByProximity += expansion.prunedByProximity;
    duplicateSpellings += expansion.duplicateSpellings;

    for (const { candidate, score } of expansion.scored.slice(0, beamWidth)) {
      const applied = deps.apply(entry, candidate, target.stepNumber);
      next.push({
        nodeId: applied.nodeId,
        document: applied.document,
        cumulativeScore: entry.cumulativeScore + score.score,
        stepScores: [...entry.stepScores, score.score],
      });
    }
  }

  next.sort((left, right) => right.cumulativeScore - left.cumulativeScore);
  const kept = next.slice(0, beamWidth);

  return {
    stepNumber: target.stepNumber,
    beam: kept,
    enumerated,
    rendered,
    prunedByProximity,
    duplicateSpellings,
    bestScore: kept[0]?.stepScores.at(-1) ?? 0,
    failure:
      kept.length > 0
        ? null
        : `Step ${target.stepNumber} killed the whole beam: ${enumerated} placements of ${target.catalogPartId} were enumerated across ${beam.length} branch(es), ` +
          `${prunedByProximity} were pruned as projecting away from the highlight, and ${rendered} were rendered and scored. ` +
          (target_bounds === null
            ? `The step's highlight enclosed nothing, so nothing localised the search.`
            : `Either the part is wrong for this step, or the branch this step was reached on already diverged.`),
  };
}

export interface BuildSearchResult {
  readonly schemaVersion: typeof SEARCH_DRIVER_SCHEMA_VERSION;
  readonly steps: readonly StepOutcome[];
  readonly beam: readonly BeamEntry[];
  /** Step the beam died on, or null when every step advanced. */
  readonly failedAtStep: number | null;
  readonly totalEnumerated: number;
  readonly totalRendered: number;
}

/** Runs the loop over a whole booklet, stopping at the first step it cannot pass. */
export function runBuildSearch(
  seed: BeamEntry,
  targets: readonly StepTarget[],
  deps: SearchDriverDeps,
  options: SearchDriverOptions = {},
): BuildSearchResult {
  const steps: StepOutcome[] = [];
  let beam: readonly BeamEntry[] = [seed];
  let failedAtStep: number | null = null;

  for (const target of targets) {
    const outcome = advanceBeam(beam, target, deps, options);
    steps.push(outcome);
    if (outcome.failure !== null) {
      failedAtStep = target.stepNumber;
      break;
    }
    beam = outcome.beam;
  }

  return {
    schemaVersion: SEARCH_DRIVER_SCHEMA_VERSION,
    steps,
    beam,
    failedAtStep,
    totalEnumerated: steps.reduce((sum, step) => sum + step.enumerated, 0),
    totalRendered: steps.reduce((sum, step) => sum + step.rendered, 0),
  };
}
