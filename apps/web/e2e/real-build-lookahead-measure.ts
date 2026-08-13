export const REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_SCHEMA_VERSION =
  "lego.real-build-lookahead-measure-classifier/1" as const;

export const REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_RULE =
  "containment-iff-highlight-evidence-and-zero-non-stroke-fill/1" as const;

export interface RealBuildLookaheadHighlightMeasureInput {
  readonly mask: Uint8Array;
  readonly strokeMask: Uint8Array;
  readonly regions: readonly unknown[];
  readonly keyedPx: number;
}

export interface RealBuildLookaheadMeasureClassification {
  readonly schemaVersion: typeof REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_SCHEMA_VERSION;
  readonly rule: typeof REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_RULE;
  readonly measure: "iou" | "containment";
  readonly hasHighlightEvidence: boolean;
  readonly keyedPx: number;
  readonly regionCount: number;
  /** Null means the live classifier intentionally did not inspect absent evidence. */
  readonly strokePx: number | null;
  /** Highlight fill excluding pixels that are also printed stroke. */
  readonly fillPx: number | null;
}

/**
 * Chooses the exact comparison used by live deferred lookahead settlement.
 *
 * A highlighted panel with no non-stroke fill is an open-contour observation:
 * the target is a superset of the prefix, so containment is the supported
 * question. Closed fill and a panel with no highlight evidence both retain IoU.
 */
export function classifyRealBuildLookaheadMeasure(
  highlight: RealBuildLookaheadHighlightMeasureInput,
): RealBuildLookaheadMeasureClassification {
  const regionCount = highlight.regions.length;
  const hasHighlightEvidence = regionCount !== 0 || highlight.keyedPx !== 0;
  if (!hasHighlightEvidence) {
    return Object.freeze({
      schemaVersion: REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_SCHEMA_VERSION,
      rule: REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_RULE,
      measure: "iou",
      hasHighlightEvidence,
      keyedPx: highlight.keyedPx,
      regionCount,
      strokePx: null,
      fillPx: null,
    });
  }

  let strokePx = 0;
  let fillPx = 0;
  for (let index = 0; index < highlight.strokeMask.length; index += 1) {
    if (highlight.strokeMask[index] === 1) strokePx += 1;
    else if (highlight.mask[index] === 1) fillPx += 1;
  }
  return Object.freeze({
    schemaVersion: REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_SCHEMA_VERSION,
    rule: REAL_BUILD_LOOKAHEAD_MEASURE_CLASSIFIER_RULE,
    measure: fillPx === 0 ? "containment" : "iou",
    hasHighlightEvidence,
    keyedPx: highlight.keyedPx,
    regionCount,
    strokePx,
    fillPx,
  });
}
