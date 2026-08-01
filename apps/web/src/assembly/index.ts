/**
 * The closed-loop assembly engine: enumerate legal placements, score each
 * against the booklet's own picture of the step, and carry a beam of live
 * branches in a content-addressed tree of deltas.
 *
 * Re-exported from one module because the driver is handed its dependencies as
 * callbacks, so a caller wires all of these together at once.
 */
export * from "./build-tree";
export * from "./enumerate-placements";
export * from "./project-bounds";
export * from "./search-driver";
export * from "./step-score";
export { extractHighlightRegions, isHighlightPixel } from "../instructions/highlight-region";
export type {
  HighlightExtraction,
  HighlightRegion,
  HighlightRegionBounds,
} from "../instructions/highlight-region";
