import { sampleBookletPageShapes } from "./booklet-fixture";
import {
  DEFERRED_STEP_MINIMUM_AGREEMENT,
  DEFERRED_STEP_MINIMUM_MARGIN,
} from "./real-build-deferral";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import {
  REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
  REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
  REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS as EXPECTED_PRINTED_STEPS,
  REAL_BUILD_PRODUCTION_MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE as MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE,
  REAL_BUILD_PRODUCTION_MINIMUM_WHOLE_STEP_SCORE as MINIMUM_WHOLE_STEP_SCORE,
} from "./real-build-production-policy";
import { deriveTransitionPanelFeatures } from "./real-build-transition-features";
import { bookletProbeUrls } from "./sample-booklet";
import { OFFICIAL_REAL_BUILD_ACCOUNTING, preflightRealBuildOptions } from "./real-build-contract";
import { describeUnboundCoverageRefusal } from "./real-build-coverage-refusal";
import { COVERAGE_PATH } from "./real-build-input-files";
import { validateRealBuildActionLedger } from "./real-build-ledger";
import type { PreparedRealBuildInputs } from "./real-build-run-input-preparation";
import { bindCalloutsToBookletPanels, type RealBuildOptions } from "./real-build-safety";
import { planRealBuildRunPanelWindow } from "./real-build-run-panel-window";
import { produceRealBuildRunPanelInputs } from "./real-build-run-panel-production";
import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

const CALLOUT_DIRECTORY = process.env.LEGO_REAL_BUILD_CALLOUTS ?? "output/callout-thumbnails";

export async function prepareRealBuildPanelPlan(input: PreparedRealBuildInputs) {
  const {
    pdfBytes,
    source,
    inputDigests,
    lastStep,
    manifestRows,
    preparationFailures,
    officialModel,
    ledgerInput,
    ledgerSteps,
    byCallout,
    transitionClassificationsByStep,
    highlightCalibrationDigest,
    verifiedCoverage,
    coverageClosureRejection,
    sourceArtReboundInput,
  } = input;
  const requestedLastStep = lastStep;
  const fartherPanelMaximumReachSteps = 2;
  const { panels, calloutBoxesByStep, panelEvidenceByStep } = await deriveRealBuildPanelEvidence({
    pdfBytes,
    source,
    pdfDigest: inputDigests.pdf,
  });
  const panelWindow = planRealBuildRunPanelWindow({
    panels,
    requestedLastStep,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
    maximumPassiveLookaheadSteps: fartherPanelMaximumReachSteps,
  });
  const panelBindings = bindCalloutsToBookletPanels({
    lastStep: requestedLastStep,
    manifestCallouts: manifestRows.trusted,
    panels,
    sourcePages: source.pages,
  });
  preparationFailures.push(...panelBindings.failures);
  if (officialModel !== null) {
    preparationFailures.push(
      ...validateRealBuildActionLedger({
        ledger: ledgerInput.value,
        ledgerDigest: inputDigests.actionLedger,
        requestedLastStep,
        lastStep: requestedLastStep,
        official: officialModel,
        pdfDigest: inputDigests.pdf,
        coverageDigest: inputDigests.coverage,
        // Deliberately nullable: with no bound coverage the ledger's own
        // structure is still checked, but nothing is compared to a claim.
        calloutManifestDigest: inputDigests.calloutManifest,
        sourceArtReboundDigest: sourceArtReboundInput.digest,
        builderCalibrationDigest: inputDigests.builderCalibration,
        transitionClassificationsDigest: inputDigests.transitionClassifications,
        coverageByCallout: byCallout,
        panelEvidenceByStep,
        transitionClassificationsByStep,
      }),
    );
  }

  // Which face each panel is drawn from, folded from the booklet's own
  // rotate-the-model icon. Derived here from the booklet bytes this run already
  // holds rather than read from a side artifact, so it cannot drift from the
  // pages being scored.
  //
  // Fold through only the requested prefix plus its bounded passive observation
  // suffix. A final requested placement may need N+1 (and the existing bounded
  // farther policy may inspect N+2), but those suffix rows never enter execution.
  const facePanels = panelWindow.observationPanels;
  const faceShapesByPage = await sampleBookletPageShapes(
    pdfBytes,
    facePanels.map(({ pageNumber }) => pageNumber),
  );
  const faceFeatures = deriveTransitionPanelFeatures({
    panels: facePanels,
    calloutBoxesByStep,
    panelEvidenceByStep,
    shapesByPage: faceShapesByPage,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
  });
  const facesByStep = new Map(
    faceFeatures.map(({ stepNumber, panelFace }) => [stepNumber, panelFace]),
  );

  const producedPanels = produceRealBuildRunPanelInputs({
    repoRoot: process.cwd(),
    calloutDirectory: CALLOUT_DIRECTORY,
    panelWindow,
    requestedLastStep,
    facesByStep,
    calloutBoxesByStep,
    stepByCalloutIdentity: panelBindings.stepByIdentity,
    manifestCallouts: manifestRows.trusted,
    ledgerSteps,
    officialModel,
    coverageByCallout: byCallout,
    inputDigests,
  });
  const { specs, passivePanels } = producedPanels;

  const options: RealBuildOptions = {
    ...bookletProbeUrls(),
    latticeUrl: workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts"),
    renderingUrl: RENDERING_MODULE_URL,
    kernelUrl: BRICK_KERNEL_MODULE_URL,
    commandsUrl: MANUAL_COMMANDS_MODULE_URL,
    assemblyUrl: ASSEMBLY_MODULE_URL,
    measuredFartherOriginSourceAttestation: null,
    panels: specs,
    passivePanels,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
    lastStep: requestedLastStep,
    renderScale: 6,
    panelWidth: 1_000,
    workFactor: 2,
    // Both budgets are per piece, and the pruned candidate set is a subset of
    // the exhaustive one, so they are the same number: see the coherence check
    // in `preflightRealBuildOptions`.
    //
    // 220 could not bind on printed step 4, whose two pieces enumerate 240 and
    // 334 placements — the same 240 x 334 the deferred-narrowing budget below
    // was already sized against. Both strategies refused with
    // `resource-budget-exhausted` before rendering anything, so the step was
    // decided by a cost ceiling rather than by its panel. Sized from the run's
    // own measured render cost of about 21ms, 1024 is roughly twenty seconds a
    // piece, in the same range as the two budgets below. It is a cost ceiling
    // and not a correctness bar: exceeding it still refuses rather than
    // truncating, so no step is ever scored against a set that was silently cut.
    maxRendersPerPiece: 1_024,
    blindRenderBudget: 1_024,
    // Step 1 alone is a 400-candidate product: four yaws of the quarter ring on
    // the empty plate times a hundred distinct seats for the round plate on each.
    deferredCandidateBudget: REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
    // Provisional aggregate ceiling for retained candidate/camera lineage slots
    // across the run. D4 groups reserve eight slots atomically. This does not
    // bound renders: multiple parent lineages may share one candidate render.
    panelCameraBranchBudget: 8_192,
    // An exploded step renders every whole-step candidate once per member of
    // the arrow's travel family, so this bounds a product rather than a set:
    // printed step 2 is 105 candidates by 22 members. Sized from measured cost —
    // the run's own step lines report 88 renders in 1435ms, so 4096 is about a
    // minute of rendering for one printed step.
    explodedGhostRenderBudget: 4_096,
    // Printed step 4 defers because its own panel cannot separate its best
    // two placements, and narrowing against that same panel is what keeps its
    // 240 x 334 product finite.
    //
    // 4096 could not bind on printed step 6, whose four pieces narrow
    // 1 of 187, then 2 of 534, then 2 of 627, then 10 of 553 — 4187 renders,
    // eighty behind the ceiling. Like `maxRendersPerPiece` above this is a cost
    // ceiling and not a correctness bar: exceeding it refuses rather than
    // truncating, so no step is ever narrowed against a set that was silently
    // cut, and nothing about which candidate wins changes with it. Sized from
    // the same measured render cost of about 21ms, 8192 is roughly three minutes
    // of rendering for one printed step.
    deferredNarrowingRenderBudget: REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
    fartherPanelMaximumReachSteps,
    fartherPanelRenderBudget: 16,
    minimumDeferredAgreementMargin: DEFERRED_STEP_MINIMUM_MARGIN,
    minimumDeferredAgreement: DEFERRED_STEP_MINIMUM_AGREEMENT,
    proximityMarginPx: 14,
    targetPartCount: OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces,
    maxParts: OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces,
    minimumScoreMargin: 0.01,
    minimumWholeStepScore: MINIMUM_WHOLE_STEP_SCORE,
    minimumExclusiveHighlightPixelsPerPiece: MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE,
    highlightCalibrationDigest,
    accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
    inputDigests,
    coverageInputBindings: {
      pdf: verifiedCoverage?.inputDigests?.pdf ?? null,
      calloutManifest: verifiedCoverage?.inputDigests?.calloutManifest ?? null,
    },
    // Execution never sees an unbound closure — the refusal below is unconditional
    // — so the executable options carry the ordinary index shape and the nullable
    // verdict is handed to preflight, which is the code that must not evaluate.
    coverageByCallout: producedPanels.coverageByCallout ?? {},
  };
  const evaluatedFailures = [
    ...preparationFailures,
    ...preflightRealBuildOptions({
      ...options,
      coverageByCallout: producedPanels.coverageByCallout,
    }),
  ];
  const inputFailures =
    coverageClosureRejection === null
      ? evaluatedFailures
      : [
          describeUnboundCoverageRefusal({
            rejection: coverageClosureRejection,
            coveragePath: COVERAGE_PATH,
            requestedLastStep: options.lastStep,
            requestedPanels: specs.filter(({ stepNumber }) => stepNumber <= options.lastStep),
            otherFailures: evaluatedFailures,
          }),
          ...evaluatedFailures,
        ];

  const panelFaceSourcePageShapes = Object.freeze(
    [...faceShapesByPage.entries()].map(([pageNumber, shapes]) =>
      Object.freeze({ pageNumber, shapes }),
    ),
  );
  return { ...input, specs, options, panelFaceSourcePageShapes, inputFailures };
}

export type PreparedRealBuildPanelPlan = Awaited<ReturnType<typeof prepareRealBuildPanelPlan>>;
