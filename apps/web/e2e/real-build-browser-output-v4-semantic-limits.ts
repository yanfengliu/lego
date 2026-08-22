import { MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS } from "./real-build-compiled-observation-closure-types";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS } from "./real-build-prepared-search-boundary";

/** Cross-step row ceilings applied before lineage reconstruction or replay. */
export const REAL_BUILD_BROWSER_BRANCH_SEMANTIC_ROW_LIMITS = Object.freeze({
  searchParents: MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  sources: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS,
  cameras: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS,
  selectedLineageReferences: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS,
  acceptedLineageReferences: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS,
  acceptedTransitionReferences: MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_TABLE_ROWS,
});
