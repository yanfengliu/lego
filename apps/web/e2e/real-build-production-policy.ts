/**
 * The live real-booklet runner's aggregate whole-step narrowing ceiling.
 *
 * Exceeding it must refuse an atomic batch before rendering; it is a cost
 * policy, never a correctness threshold or permission to truncate a frontier.
 */
export const REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET = 8_192 as const;

/**
 * The live real-booklet runner's aggregate retained-candidate ceiling for one
 * deferred printed step. Individual completed leaves reserve incrementally;
 * admitting the resulting frontier remains all-or-nothing.
 */
export const REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET = 512 as const;

export const REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS = 359 as const;
export const REAL_BUILD_PRODUCTION_MINIMUM_WHOLE_STEP_SCORE = 0.45 as const;
export const REAL_BUILD_PRODUCTION_MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE = 8 as const;
