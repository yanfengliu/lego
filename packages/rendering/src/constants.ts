export const RENDERING_VERSION = "lego.rendering/1" as const;
export const CANONICAL_CAMERA_POLICY_VERSION = "lego.canonical-cameras/1" as const;

/**
 * The page colour LEGO prints step art on, measured as the most common pixel
 * over rendered pages of `recipes/6651557.pdf` (47% of page 120, 67% of page
 * 40). An instruction-finish render fills its background with this so a render
 * and a booklet panel differ in the model, not in the paper.
 */
export const INSTRUCTION_BACKGROUND_HEX = 0x899093 as const;

/** Booklet art outlines every visible edge in near-black; this is that ink. */
export const INSTRUCTION_EDGE_HEX = 0x1a1a1a as const;

/**
 * Below this dihedral angle an edge is a tessellation seam rather than a
 * feature, which is what keeps a 24-segment stud from printing 24 vertical
 * lines. Box corners are 90 degrees and stud rims are 90 degrees, so both
 * survive.
 */
export const INSTRUCTION_EDGE_THRESHOLD_DEGREES = 30 as const;
