import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

/**
 * Human-reviewed booklet observations for the exact suffix that starts after
 * the authenticated Step-44 return. These observations classify replay
 * boundaries only; they grant no placement, document, or completion authority.
 */
export const REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE = deepFreeze({
  schemaVersion: "lego.real-build-prefix50-suffix-panel-fixture/1" as const,
  authority: "none" as const,
  sourceSetId: "6651557" as const,
  sourcePdf: {
    logicalPath: "recipes/6651557.pdf" as const,
    digest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" as const,
  },
  exactBoundary: {
    firstPrintedStep: 45 as const,
    lastPrintedStep: 50 as const,
    firstPhysicalPage: 46 as const,
    lastPhysicalPage: 53 as const,
    step51Inspected: false as const,
    suffixReturnInferred: false as const,
  },
  observations: [
    {
      printedStepNumber: 45 as const,
      physicalPages: [46] as const,
      disposition: "three-root-axles-placed-directly" as const,
    },
    {
      printedStepNumber: 46 as const,
      physicalPages: [47] as const,
      disposition: "two-distinct-child-insets-each-return-to-root-before-step-end" as const,
    },
    {
      printedStepNumber: 47 as const,
      physicalPages: [48] as const,
      disposition: "one-three-stage-child-returns-to-root-before-step-end" as const,
    },
    {
      printedStepNumber: 48 as const,
      physicalPages: [49] as const,
      disposition: "one-four-stage-child-returns-to-root-before-step-end" as const,
    },
    {
      printedStepNumber: 49 as const,
      physicalPages: [50, 51, 52] as const,
      disposition: "one-six-stage-child-returns-to-root-on-final-step-page" as const,
    },
    {
      printedStepNumber: 50 as const,
      physicalPages: [53] as const,
      disposition: "one-four-stage-nine-part-child-remains-detached-at-prefix-boundary" as const,
    },
  ],
});

export const REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE_COMMITMENT = canonicalDigest(
  REAL_BUILD_PREFIX50_SUFFIX_PANEL_FIXTURE,
);
