import { createEmptyBrickDocument } from "@lego-studio/brick-kernel";

export const REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_ID =
  "prefix50-current-diagnostic" as const;
export const REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_NAME =
  "Prefix 50 current diagnostic" as const;

/** One factory owns the exact Step-1 base bytes consumed by every prefix-50 replay. */
export function createRealBuildPrefix50ProductionBaseDocument() {
  return createEmptyBrickDocument({
    id: REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_ID,
    name: REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_NAME,
  });
}
