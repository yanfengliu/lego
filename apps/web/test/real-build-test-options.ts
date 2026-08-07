import { OFFICIAL_REAL_BUILD_ACCOUNTING } from "../e2e/real-build-contract";
import {
  DEFERRED_STEP_MINIMUM_AGREEMENT,
  DEFERRED_STEP_MINIMUM_MARGIN,
} from "../e2e/real-build-deferral";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";

export const REAL_BUILD_TEST_DIGEST = `sha256:${"a".repeat(64)}`;
export const REAL_BUILD_TEST_CLASSIFICATION_DIGEST = `sha256:${"b".repeat(64)}`;
export const REAL_BUILD_TEST_INPUT_DIGESTS = {
  pdf: REAL_BUILD_TEST_DIGEST,
  calloutManifest: REAL_BUILD_TEST_DIGEST,
  coverage: REAL_BUILD_TEST_DIGEST,
  officialModel: REAL_BUILD_TEST_DIGEST,
  actionLedger: REAL_BUILD_TEST_DIGEST,
  highlightCalibration: REAL_BUILD_TEST_DIGEST,
  builderCalibration: REAL_BUILD_TEST_DIGEST,
  builderGeometry: REAL_BUILD_TEST_DIGEST,
  transitionClassifications: REAL_BUILD_TEST_DIGEST,
};

export const realBuildTransitionPanel = (stepNumber: number): RealBuildPanelSpec => ({
  stepNumber,
  pageNumber: stepNumber,
  panelFace: "studs-up",
  minXPt: 0,
  maxXPt: 1,
  minYPt: 0,
  maxYPt: 1,
  calloutBoxes: [],
  mappedCalloutKeys: [],
  action: {
    kind: "transition",
    assembledPieces: 0,
    transition: "rotation",
    panelEvidenceDigest: REAL_BUILD_TEST_DIGEST,
    classificationEvidenceDigest: REAL_BUILD_TEST_CLASSIFICATION_DIGEST,
    evidenceDigest: REAL_BUILD_TEST_DIGEST,
  },
  pieces: [],
  omittedPieces: [],
  calloutPieces: 0,
  classifiedPhysicalCalloutPieces: 0,
  semanticMultiplierQuantity: 0,
  omittedPhysicalPieces: 0,
  coverageFailures: [],
  missingDesigns: [],
  unresolvedCallouts: [],
});

function completePanels(): readonly RealBuildPanelSpec[] {
  const panels = Array.from({ length: 359 }, (_, index) => realBuildTransitionPanel(index + 1));
  // Mirrors OFFICIAL_REAL_BUILD_ACCOUNTING: 1395 direct + 69 MultiBuild = 1464
  // assembled, with no omitted class, and raw 1512 = 1464 physical + 48 semantic.
  const directPieces = Array.from({ length: 1_395 }, (_, index) => ({
    identityKey: `direct-${index}`,
    designId: "3005",
    materialId: "1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    calloutKey: `fixture-direct-${index}`,
    identificationConfidence: "vision-kept" as const,
    cropDigest: REAL_BUILD_TEST_DIGEST,
    identificationInputDigest: REAL_BUILD_TEST_DIGEST,
    expectedTransform: {
      positionLdu: [index * 20, 0, 0] as const,
      orientationId: "upright-yaw-0",
    },
  }));
  panels[357] = {
    ...realBuildTransitionPanel(358),
    action: {
      kind: "place-callouts",
      assembledPieces: 1_395,
      evidenceDigest: REAL_BUILD_TEST_DIGEST,
    },
    pieces: directPieces,
    omittedPieces: [],
    mappedCalloutKeys: directPieces.map(({ calloutKey }) => calloutKey),
    calloutPieces: 1_395,
    classifiedPhysicalCalloutPieces: 1_395,
    omittedPhysicalPieces: 0,
  };
  panels[358] = {
    ...realBuildTransitionPanel(359),
    action: {
      kind: "multi-build-copy",
      assembledPieces: 69,
      sourceStepNumber: 358,
      evidenceDigest: REAL_BUILD_TEST_DIGEST,
      copies: Array.from({ length: 69 }, (_, index) => ({
        identityKey: `copy-${index}`,
        sourceIdentityKey: `direct-${index}`,
        designId: "3005",
        materialId: "1",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:black",
        evidenceDigest: REAL_BUILD_TEST_DIGEST,
        transform: {
          positionLdu: [index * 20, 24, 0] as const,
          orientationId: "upright-yaw-0",
        },
      })),
    },
    calloutPieces: 117,
    classifiedPhysicalCalloutPieces: 69,
    semanticMultiplierQuantity: 48,
    mappedCalloutKeys: ["fixture-copy-callout"],
  };
  return panels;
}

function completeCoverage(): RealBuildOptions["coverageByCallout"] {
  return {
    ...Object.fromEntries(
      Array.from({ length: 1_395 }, (_, index) => [
        `fixture-direct-${index}`,
        {
          pageNumber: 358,
          stepNumber: 358,
          quantity: 1,
          identificationConfidence: "vision-kept",
          cropDigest: REAL_BUILD_TEST_DIGEST,
          inputDigest: REAL_BUILD_TEST_DIGEST,
        },
      ]),
    ),
    "fixture-copy-callout": {
      pageNumber: 359,
      stepNumber: 359,
      quantity: 117,
      identificationConfidence: "official-model",
      cropDigest: null,
      inputDigest: REAL_BUILD_TEST_DIGEST,
    },
  };
}

export function completeRealBuildTestOptions(lastStep: number): RealBuildOptions {
  return {
    pdfjsUrl: "fixture:pdfjs",
    workerUrl: "fixture:worker",
    pdfUrl: "fixture:pdf",
    latticeUrl: "fixture:lattice",
    renderingUrl: "fixture:rendering",
    kernelUrl: "fixture:kernel",
    commandsUrl: "fixture:commands",
    assemblyUrl: "fixture:assembly",
    panels: completePanels(),
    expectedPrintedSteps: 359,
    lastStep,
    renderScale: 6,
    panelWidth: 1_000,
    workFactor: 2,
    maxRendersPerPiece: 220,
    blindRenderBudget: 220,
    deferredCandidateBudget: 512,
    explodedGhostRenderBudget: 4_096,
    minimumDeferredAgreementMargin: DEFERRED_STEP_MINIMUM_MARGIN,
    minimumDeferredAgreement: DEFERRED_STEP_MINIMUM_AGREEMENT,
    proximityMarginPx: 14,
    targetPartCount: 1_464,
    maxParts: 1_464,
    minimumScoreMargin: 0.01,
    minimumWholeStepScore: 0.45,
    minimumExclusiveHighlightPixelsPerPiece: 8,
    highlightCalibrationDigest: REAL_BUILD_TEST_DIGEST,
    accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
    inputDigests: REAL_BUILD_TEST_INPUT_DIGESTS,
    coverageInputBindings: {
      pdf: REAL_BUILD_TEST_DIGEST,
      calloutManifest: REAL_BUILD_TEST_DIGEST,
    },
    coverageByCallout: completeCoverage(),
  };
}
