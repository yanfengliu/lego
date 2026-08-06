/**
 * The closed-loop assembly engine: enumerate legal placements, score each
 * against the booklet's own picture of the step, and carry a beam of live
 * branches in a content-addressed tree of deltas.
 *
 * Re-exported from one module because the driver is handed its dependencies as
 * callbacks, so a caller wires all of these together at once.
 */
export * from "./arrow-placement";
export * from "./backtracking-search";
export * from "./build-tree";
export * from "./enumerate-placements";
export * from "./exploded-score";
export * from "./lattice-placements";
export * from "./panel-art";
export * from "./panel-arrows";
export * from "./panel-difference";
export * from "./panel-registration";
export * from "./project-bounds";
export * from "./search-driver";
export * from "./step-score";
export { extractHighlightRegions, isHighlightPixel } from "../instructions/highlight-region";
export type {
  HighlightExtraction,
  HighlightRegion,
  HighlightRegionBounds,
} from "../instructions/highlight-region";
