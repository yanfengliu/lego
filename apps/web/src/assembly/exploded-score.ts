import { dilateMask } from "@lego-studio/rendering";

import type { HighlightExtraction, HighlightRegionBounds } from "../instructions/highlight-region";

/**
 * Where a step's part went, when the step's own picture will not say.
 *
 * Some steps are drawn exploded: the new part is printed offset from where it
 * lands, with red arrows pointing at the destination. The step highlight then
 * gives shape and orientation but not position, and `scoreStepDelta` — which
 * compares a candidate's silhouette against that highlight — scores every
 * candidate against a shape in the wrong place. Measured on a synthetic booklet
 * where the answer is known, it ranked the true placement first on none of five
 * exploded steps.
 *
 * How many real steps that is has been counted twice and the first count was
 * wrong. Keying red pixels put it at 19 of the sample booklet's first 50, but
 * red on these pages is a red part or a sub-build's own arrow as often as it is
 * this step's displacement arrow: 28 of those steps print no red at all, and of
 * the rest only a handful print an arrow that starts at what the step
 * highlighted.
 *
 * The position is in the booklet anyway, one page later. Step N+1 draws the
 * assembly with step N's part in place, so the pixels that differ between panel
 * N and panel N+1 are what step N added. Two readings of that difference are
 * kept because they fail differently.
 *
 * `emerged` is page in panel N and model in panel N+1. It needs nothing of the
 * two panels but that they agree on where the paper is, so a small registration
 * error costs it only boundary pixels. It cannot see a part that lands entirely
 * within what was already drawn — a 2x2 brick standing in the middle of a 6x6
 * plate covers plate pixels with brick pixels and emerges nowhere — and on such
 * a step it is empty, which is reported as unavailable rather than as
 * disagreement.
 *
 * `changed` is every pixel the two panels disagree on. It sees the brick on the
 * plate, because a brick's faces do not shade like a plate's top, but it asks
 * the two panels to be registered pixel for pixel and it reacts to any redraw
 * that was not a placement.
 *
 * Both drop the pixels either panel's highlight claims: panel N's highlight is
 * around this step's ghost, and a ghost vanishing is not where a part went;
 * panel N+1's is around step N+1's own part, which appeared for its own reasons.
 *
 * It has since been run on a printed booklet as well as a synthetic one, and
 * the printed answer is both weaker and much thinner.
 *
 * Registration holds up. Two consecutive panels of `recipes/6651557.pdf` drawn
 * with the same camera can be carried onto one frame by a scale and a shift,
 * and their assembly silhouettes then agree over 91% with their outlines a
 * median two pixels apart — which is the misregistration this score was already
 * stress-tested at.
 *
 * What the difference supports afterwards is a neighbourhood rather than an
 * answer, on a sample of three. Only 3 of the booklet's first 49 consecutive
 * pairs are well posed for the question at all: the rest print no arrow to
 * check against, print one belonging to a sub-build, fit no camera, or close no
 * highlight contour. On those three, sweeping the step's own printed silhouette
 * across the fitted stud grid put the top-scoring offset 0.57, 0.60 and 2.50
 * studs from where the step's red arrows point, and the do-nothing offset last
 * of its two thousand candidates on the first two and 677th of 1516 on the
 * third. None of the three ranks the arrow's own offset first — 43rd, 82nd and
 * 271st — and about seventy candidate offsets sit within a stud of any point,
 * so first place was never the right thing to ask for.
 *
 * Read it as a prior over a neighbourhood about a stud across, which physics
 * and part identity then have to resolve. It is not a placement.
 *
 * One thing this is *not*, because the name invites the mistake: it is not the
 * scorer for an exploded step's own panel. It deliberately zeroes every pixel
 * either panel's highlight claims — panel N's highlight is the ghost contour —
 * so it throws away exactly the evidence a step's own picture supplies. Reading
 * an exploded step against the ghost it draws is `ghost-placement.ts`, which
 * compares a ghost-positioned silhouette against the printed region with
 * `scoreStepDelta`'s own region agreement. This module answers the different
 * question of where the part came to rest, per the *next* panel.
 */
export const PANEL_DELTA_SCHEMA_VERSION = "lego.step-panel-delta/1" as const;
export const EXPLODED_SCORE_SCHEMA_VERSION = "lego.exploded-step-score/1" as const;

export interface PanelArt {
  readonly width: number;
  readonly height: number;
  /** RGBA, row 0 at the top, as the instruction renderer returns it. */
  readonly pixels: Uint8ClampedArray;
  /** The panel's own yellow highlight, or null for a page that carries none. */
  readonly highlight: HighlightExtraction | null;
}

export interface PanelDeltaOptions {
  /** The page colour both panels are drawn on, as 0xRRGGBB. */
  readonly backgroundHex: number;
  /**
   * Summed channel distance at which two panels are drawing different things.
   * Our own renders are unantialiased and land on exact bytes, so anything
   * below the smallest shading step serves; a scanned page needs it fitted to
   * the scan's own noise floor.
   */
  readonly differenceThresholdPx?: number;
  /** How far a highlight stroke's claim reaches past the stroke, in pixels. */
  readonly highlightMarginPx?: number;
}

export interface StepPanelDelta {
  readonly schemaVersion: typeof PANEL_DELTA_SCHEMA_VERSION;
  readonly width: number;
  readonly height: number;
  /** Page in panel N, model in panel N+1: where this step's part came to rest. */
  readonly emergedMask: Uint8Array;
  /** Every pixel the two panels disagree on, highlights excluded. */
  readonly changedMask: Uint8Array;
  /**
   * Pixels neither panel's highlight speaks for, and so the only ones that are
   * evidence. A prediction is restricted to these before it is compared, so a
   * candidate is never charged for the ghost it was drawn as or credited for
   * the next step's part.
   */
  readonly evidenceMask: Uint8Array;
  readonly emergedPx: number;
  readonly changedPx: number;
  /** Box to prune candidates against, as a highlight's box is used in place. */
  readonly emergedBounds: HighlightRegionBounds | null;
  readonly changedBounds: HighlightRegionBounds | null;
}

export interface CandidatePrediction {
  /** Pixels this candidate would cover that the assembly did not already. */
  readonly newlyVisibleMask: Uint8Array;
  /** Pixels this candidate would change about the picture at all. */
  readonly changedMask: Uint8Array;
}

export interface ExplodedStepScore {
  readonly schemaVersion: typeof EXPLODED_SCORE_SCHEMA_VERSION;
  /**
   * Agreement with what emerged between the panels, or null when nothing did.
   * Null is not zero: this step's part landed inside what was already drawn, so
   * the evidence is absent rather than against the candidate.
   */
  readonly emergenceIou: number | null;
  /** Agreement with everything the two panels disagree on. */
  readonly changeIou: number;
  /** The number to rank candidates by. */
  readonly score: number;
  readonly basis: "emergence-and-change" | "change";
  readonly predictedNewlyVisiblePx: number;
  readonly predictedChangedPx: number;
}

const DEFAULT_DIFFERENCE_THRESHOLD_PX = 8;
const DEFAULT_HIGHLIGHT_MARGIN_PX = 2;

/**
 * Emergence is the reading with the weaker assumptions, so it leads where it
 * exists; the difference reading is never dropped, because on a synthetic
 * booklet with perfect registration it separated the true placement more widely
 * than emergence on three of the four steps where both were available.
 */
const EMERGENCE_WEIGHT = 0.5;

export class ExplodedScoreError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExplodedScoreError";
  }
}

function requireSameRaster(current: PanelArt, next: PanelArt): void {
  if (current.width !== next.width || current.height !== next.height) {
    throw new ExplodedScoreError(
      `Panels must share a raster to be differenced: step N is ${current.width}x${current.height} and step N+1 is ${next.width}x${next.height}. ` +
        `Fit both panels' cameras to the same frame and render both at the same size — a difference between rasters measures the resize, not the step.`,
    );
  }
  for (const [label, panel] of [
    ["step N", current],
    ["step N+1", next],
  ] as const) {
    const needed = panel.width * panel.height * 4;
    if (panel.pixels.length !== needed) {
      throw new ExplodedScoreError(
        `The ${label} panel holds ${panel.pixels.length} bytes but ${panel.width}x${panel.height} RGBA needs ${needed}. ` +
          `Pass the renderer's own buffer at the size it was created with, not a cropped or scaled copy.`,
      );
    }
    if (
      panel.highlight &&
      (panel.highlight.width !== panel.width || panel.highlight.height !== panel.height)
    ) {
      throw new ExplodedScoreError(
        `The ${label} panel is ${panel.width}x${panel.height} but its highlight was extracted at ${panel.highlight.width}x${panel.highlight.height}. ` +
          `Extract the highlight from the same raster the panel was rendered at.`,
      );
    }
  }
}

function boundsOf(mask: Uint8Array, width: number, height: number): HighlightRegionBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (mask[row + x] !== 1) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minXPx: minX, minYPx: minY, maxXPx: maxX, maxYPx: maxY };
}

/** Stroke plus enclosed region, grown by the margin: what a highlight speaks for. */
function claimOf(
  highlight: HighlightExtraction | null,
  width: number,
  height: number,
  marginPx: number,
): Uint8Array | null {
  if (!highlight) return null;
  const claimed = dilateMask(highlight.strokeMask, width, height, marginPx);
  for (let pixel = 0; pixel < claimed.length; pixel += 1) {
    if (highlight.mask[pixel] === 1) claimed[pixel] = 1;
  }
  return claimed;
}

/** What changed between a step's panel and the next step's panel. */
export function panelDelta(
  current: PanelArt,
  next: PanelArt,
  options: PanelDeltaOptions,
): StepPanelDelta {
  requireSameRaster(current, next);
  const { width, height } = current;
  const area = width * height;
  const differenceThresholdPx = options.differenceThresholdPx ?? DEFAULT_DIFFERENCE_THRESHOLD_PX;
  const highlightMarginPx = options.highlightMarginPx ?? DEFAULT_HIGHLIGHT_MARGIN_PX;
  if (!Number.isInteger(differenceThresholdPx) || differenceThresholdPx < 0) {
    throw new ExplodedScoreError(
      `differenceThresholdPx must be a non-negative integer, received ${String(differenceThresholdPx)}. ` +
        `It is a summed distance over three 0..255 channels, so it ranges 0..765, and it is the noise floor of the two panels rather than a tolerance on the placement.`,
    );
  }

  const background = [
    (options.backgroundHex >> 16) & 0xff,
    (options.backgroundHex >> 8) & 0xff,
    options.backgroundHex & 0xff,
  ];
  const emergedMask = new Uint8Array(area);
  const changedMask = new Uint8Array(area);
  for (let pixel = 0; pixel < area; pixel += 1) {
    const at = pixel * 4;
    let currentDistanceFromPage = 0;
    let nextDistanceFromPage = 0;
    let panelDistance = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const currentValue = current.pixels[at + channel]!;
      const nextValue = next.pixels[at + channel]!;
      currentDistanceFromPage += Math.abs(currentValue - background[channel]!);
      nextDistanceFromPage += Math.abs(nextValue - background[channel]!);
      panelDistance += Math.abs(currentValue - nextValue);
    }
    if (
      currentDistanceFromPage <= differenceThresholdPx &&
      nextDistanceFromPage > differenceThresholdPx
    ) {
      emergedMask[pixel] = 1;
    }
    if (panelDistance > differenceThresholdPx) changedMask[pixel] = 1;
  }

  const nextClaim = claimOf(next.highlight, width, height, highlightMarginPx);
  const currentClaim = claimOf(current.highlight, width, height, highlightMarginPx);
  const evidenceMask = new Uint8Array(area).fill(1);
  let emergedPx = 0;
  let changedPx = 0;
  for (let pixel = 0; pixel < area; pixel += 1) {
    // Step N+1's part appeared between the panels for its own reasons, and step
    // N's ghost vanished for its own; neither is evidence about where step N's
    // part went.
    if (nextClaim?.[pixel] === 1 || currentClaim?.[pixel] === 1) {
      evidenceMask[pixel] = 0;
      emergedMask[pixel] = 0;
      changedMask[pixel] = 0;
    }
    if (emergedMask[pixel] === 1) emergedPx += 1;
    if (changedMask[pixel] === 1) changedPx += 1;
  }

  return {
    schemaVersion: PANEL_DELTA_SCHEMA_VERSION,
    width,
    height,
    emergedMask,
    changedMask,
    evidenceMask,
    emergedPx,
    changedPx,
    emergedBounds: boundsOf(emergedMask, width, height),
    changedBounds: boundsOf(changedMask, width, height),
  };
}

/** Region agreement, over the pixels that are evidence at all. */
function intersectionOverUnion(left: Uint8Array, right: Uint8Array, evidence: Uint8Array): number {
  let intersection = 0;
  let union = 0;
  for (let pixel = 0; pixel < left.length; pixel += 1) {
    if (evidence[pixel] !== 1) continue;
    const inLeft = left[pixel] === 1;
    const inRight = right[pixel] === 1;
    if (inLeft && inRight) intersection += 1;
    if (inLeft || inRight) union += 1;
  }
  return union === 0 ? 0 : intersection / union;
}

function countSet(mask: Uint8Array, evidence: Uint8Array): number {
  let total = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 1 && evidence[pixel] === 1) total += 1;
  }
  return total;
}

/**
 * How well a candidate placement explains the difference between two panels.
 *
 * The prediction is rendered by the caller, because only the caller knows the
 * camera: `newlyVisibleMask` is the candidate's visible silhouette minus what
 * the assembly already covered, and `changedMask` is the difference between a
 * render of the assembly with the candidate and one without it. Both must be
 * compared as regions rather than as coverage — a candidate hiding inside the
 * emerged region covers only pixels that emerged and would score a perfect
 * precision, which on the measured booklet put the true placement eighth.
 */
export function scoreExplodedStep(
  prediction: CandidatePrediction,
  delta: StepPanelDelta,
): ExplodedStepScore {
  const area = delta.width * delta.height;
  for (const [label, mask] of [
    ["newlyVisibleMask", prediction.newlyVisibleMask],
    ["changedMask", prediction.changedMask],
  ] as const) {
    if (mask.length !== area) {
      throw new ExplodedScoreError(
        `The prediction's ${label} holds ${mask.length} pixels but the panel delta was computed at ${delta.width}x${delta.height}, needing ${area}. ` +
          `Render the candidate through the camera fitted to these panels, at the panels' own raster size.`,
      );
    }
  }

  const emergenceIou =
    delta.emergedPx === 0
      ? null
      : intersectionOverUnion(prediction.newlyVisibleMask, delta.emergedMask, delta.evidenceMask);
  const changeIou = intersectionOverUnion(
    prediction.changedMask,
    delta.changedMask,
    delta.evidenceMask,
  );

  return {
    schemaVersion: EXPLODED_SCORE_SCHEMA_VERSION,
    emergenceIou,
    changeIou,
    score:
      emergenceIou === null
        ? changeIou
        : EMERGENCE_WEIGHT * emergenceIou + (1 - EMERGENCE_WEIGHT) * changeIou,
    basis: emergenceIou === null ? "change" : "emergence-and-change",
    predictedNewlyVisiblePx: countSet(prediction.newlyVisibleMask, delta.evidenceMask),
    predictedChangedPx: countSet(prediction.changedMask, delta.evidenceMask),
  };
}
