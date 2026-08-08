import { expect, test } from "@playwright/test";

import { readSampleBooklet, sampleBookletPageShapes } from "./booklet-fixture";
import {
  DEFERRED_STEP_MINIMUM_AGREEMENT,
  DEFERRED_STEP_MINIMUM_MARGIN,
  summariseDeferrals,
} from "./real-build-deferral";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { readTransitionClassificationBundle } from "./real-build-transition-classification";
import { deriveTransitionPanelFeatures } from "./real-build-transition-features";
import { bookletProbeUrls, hasSampleBooklet } from "./sample-booklet";
import {
  beginAtomicRun,
  createRealBuildScore,
  createRealBuildRunContract,
  enumerateRealBuildCodeRoots,
  planAtomicRunDirectory,
  sha256Digest,
  snapshotRealBuildCodeRoots,
  validateRealBuildOutputRoot,
  verifyRealBuildArtifactManifest,
  validateRealBuildArtifactFilePlan,
  writeRealBuildArtifactManifest,
} from "./real-build-artifacts";
import {
  OFFICIAL_REAL_BUILD_ACCOUNTING,
  inputRejectedRealBuildResult,
  preflightRealBuildOptions,
} from "./real-build-contract";
import { describeUnboundCoverageRefusal } from "./real-build-coverage-refusal";
import { finalizeExecutedRealBuildResult, realBuildExecutionFailure } from "./real-build-finalize";
import { captureHighlightExclusivityRenderCases } from "./real-build-highlight-browser";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import {
  ACTION_LEDGER_PATH,
  assertHighlightRendererCasesReproduced,
  BUILDER_CALIBRATION_PATH,
  BUILDER_GEOMETRY_PATH,
  contractFailure,
  COVERAGE_PATH,
  ELEMENT_RESOLUTION_PATH,
  encodeHighlightRendererCompatibilityInputClosure,
  HIGHLIGHT_RENDERER_CASES_PATH,
  HIGHLIGHT_RENDERER_COMPATIBILITY_PATH,
  IDENTIFICATION_DISTANCES_PATH,
  IDENTIFICATION_FEATURES_PATH,
  IDENTIFICATION_MATCH_PATH,
  MANIFEST_PATH,
  OFFICIAL_MODEL_PATH,
  PAIR_JUDGED_TRUTH_PATH,
  readBinaryInput,
  readJsonArtifact,
  readIdentificationAdjudicationInputs,
  TRANSITION_CLASSIFICATIONS_PATH,
  verifyHighlightRendererCompatibilityInput,
  type CalloutManifest,
  type CalloutResolution,
  type TransitionClassificationBundle,
} from "./real-build-input-files";
import {
  identifyRealBuildIdentificationMode,
  verifyRealBuildIdentificationClosure,
  type RealBuildIdentificationMode,
} from "./real-build-identification-closure";
import {
  applyBuilderCanonicalCalibration,
  parseOfficialModelIndex,
  validateOfficialModelAccounting,
  validateRealBuildActionLedger,
  type BuilderCanonicalCalibration,
  type OfficialModelIndex,
  type RealBuildActionLedger,
} from "./real-build-ledger";
import {
  bindCalloutsToBookletPanels,
  isAtomicStepComplete,
  isV5ManifestCallout,
  type RealBuildOptions,
  type RealBuildResult,
  type StepFailure,
  type V5ManifestCallout,
} from "./real-build-safety";
import {
  decodeRealBuildPngCapture,
  type RealBuildBrowserOutput,
} from "./real-build-browser-output";
import {
  captureRealBuildSourceBundle,
  materializeRealBuildSourceMirror,
  planRealBuildSourceMirrorBundle,
  resolveRealBuildPath,
  sourceDriftFailures,
  writeRealBuildReplayClosure,
} from "./real-build-replay";
import { acquireRealBuildSourceLock } from "./real-build-source-lock";
import { createRealBuildServedResponseRecorder } from "./real-build-served-responses";
import { REAL_BUILD_SOURCE_ROOTS } from "./real-build-source-roots";
import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import {
  realBuildRunBudgets,
  realBuildRunThresholds,
  type RealBuildIdentificationClosureDigests,
} from "./real-build-run-contract";
import { buildRealBuildPanelSpecs } from "./real-build-panel-specs";
import {
  ASSEMBLY_MODULE_URL,
  BRICK_KERNEL_MODULE_URL,
  MANUAL_COMMANDS_MODULE_URL,
  RENDERING_MODULE_URL,
  workspaceModuleUrl,
} from "./workspace-module";

const OUTPUT_ROOT = process.env.LEGO_REAL_BUILD_OUT ?? "output/real-build";
const CALLOUT_DIRECTORY = process.env.LEGO_REAL_BUILD_CALLOUTS ?? "output/callout-thumbnails";
const EXPECTED_PRINTED_STEPS = 359 as const;
const MINIMUM_WHOLE_STEP_SCORE = 0.45;
const REAL_BUILD_REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";
const MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE = 8;

test("rebuilds the real booklet from its own printed steps", async ({ page, browserName }) => {
  test.setTimeout(3_600_000);
  test.skip(
    !REAL_BUILD_REQUIRED,
    "set LEGO_REAL_BUILD_REQUIRED=1 to execute the retained real-booklet probe",
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const bootstrapSource = readRequiredRealBuildBootstrapSourceManifest();
  assertRealBuildBootstrapSourceLockHeld();

  const preparationFailures: StepFailure[] = [];
  let effectiveOutputRoot = OUTPUT_ROOT;
  try {
    validateRealBuildOutputRoot(OUTPUT_ROOT);
  } catch (error) {
    preparationFailures.push(contractFailure("LEGO_REAL_BUILD_OUT", String(error)));
    effectiveOutputRoot = "output/real-build";
  }
  const lastStep = Number(process.env.LEGO_REAL_BUILD_LAST_STEP ?? 12);
  if (!Number.isInteger(lastStep) || lastStep < 1 || lastStep > EXPECTED_PRINTED_STEPS) {
    preparationFailures.push(
      contractFailure(
        "LEGO_REAL_BUILD_LAST_STEP",
        `LEGO_REAL_BUILD_LAST_STEP must be an integer from 1 through 359; received ${lastStep}.`,
      ),
    );
  }
  const requestedLastStep = Number.isInteger(lastStep) ? lastStep : 1;
  const coverageInput = readJsonArtifact<{
    readonly schemaVersion?: string;
    readonly byCallout?: unknown;
    readonly inputDigests?: { readonly pdf?: string; readonly calloutManifest?: string };
  }>(COVERAGE_PATH, preparationFailures);
  const manifestInput = readJsonArtifact<CalloutManifest>(MANIFEST_PATH, preparationFailures);
  const highlightCompatibilityInput = readJsonArtifact<unknown>(
    HIGHLIGHT_RENDERER_COMPATIBILITY_PATH,
    preparationFailures,
  );
  const highlightCasesInput = readJsonArtifact<unknown>(
    HIGHLIGHT_RENDERER_CASES_PATH,
    preparationFailures,
  );
  const ledgerInput = readJsonArtifact<RealBuildActionLedger>(
    ACTION_LEDGER_PATH,
    preparationFailures,
  );
  const builderCalibrationInput = readJsonArtifact<BuilderCanonicalCalibration>(
    BUILDER_CALIBRATION_PATH,
    preparationFailures,
  );
  const transitionInput = readJsonArtifact<TransitionClassificationBundle>(
    TRANSITION_CLASSIFICATIONS_PATH,
    preparationFailures,
  );
  const identificationFeaturesInput = readJsonArtifact<unknown>(
    IDENTIFICATION_FEATURES_PATH,
    preparationFailures,
  );
  const identificationMatchInput = readJsonArtifact<unknown>(
    IDENTIFICATION_MATCH_PATH,
    preparationFailures,
  );
  const identificationDistancesInput = readJsonArtifact<unknown>(
    IDENTIFICATION_DISTANCES_PATH,
    preparationFailures,
  );
  const elementResolutionInput = readJsonArtifact<unknown>(
    ELEMENT_RESOLUTION_PATH,
    preparationFailures,
  );
  const pairJudgedTruthInput = readJsonArtifact<unknown>(
    PAIR_JUDGED_TRUTH_PATH,
    preparationFailures,
  );
  let identificationMode: RealBuildIdentificationMode | null = null;
  try {
    identificationMode = identifyRealBuildIdentificationMode(coverageInput, requestedLastStep);
  } catch (error) {
    preparationFailures.push(
      contractFailure(
        COVERAGE_PATH,
        `Catalog coverage could not select its source-exact identification roles from its bounded bytes: ${error instanceof Error ? error.message : String(error)}.`,
      ),
    );
  }
  const adjudicationInputs = readIdentificationAdjudicationInputs(
    identificationMode?.source ?? null,
    preparationFailures,
  );
  const identificationCardsInput = adjudicationInputs.cards;
  const identificationCardImagesInput = adjudicationInputs.cardImages;
  const identificationAnswersInput = adjudicationInputs.answers;
  const officialModelBytes = readBinaryInput(OFFICIAL_MODEL_PATH, preparationFailures);
  const builderGeometryBytes = readBinaryInput(BUILDER_GEOMETRY_PATH, preparationFailures);
  const { bytes: pdfBytes, source } = await readSampleBooklet();
  const highlightCompatibilityRoleBytes = encodeHighlightRendererCompatibilityInputClosure(
    highlightCasesInput.bytes,
    highlightCompatibilityInput.bytes,
  );
  const inputDigests = {
    pdf: sha256Digest(pdfBytes),
    calloutManifest: manifestInput.digest,
    coverage: coverageInput.digest,
    officialModel: sha256Digest(officialModelBytes),
    actionLedger: ledgerInput.digest,
    highlightCalibration: sha256Digest(highlightCompatibilityRoleBytes),
    builderCalibration: builderCalibrationInput.digest,
    builderGeometry: sha256Digest(builderGeometryBytes),
    transitionClassifications: transitionInput.digest,
  };
  const identificationClosureDigests: RealBuildIdentificationClosureDigests = {
    source: identificationMode?.source ?? "deterministic",
    features: identificationFeaturesInput.digest,
    match: identificationMatchInput.digest,
    distances: identificationDistancesInput.digest,
    elements: elementResolutionInput.digest,
    pairJudged: pairJudgedTruthInput.digest,
    cards: identificationCardsInput?.digest ?? null,
    cardImages: identificationCardImagesInput?.digest ?? null,
    answers: identificationAnswersInput?.digest ?? null,
  };
  if (
    manifestInput.value.schemaVersion !== "lego.callout-thumbnails/5" ||
    manifestInput.value.sourceHash !== inputDigests.pdf
  ) {
    preparationFailures.push(
      contractFailure(
        MANIFEST_PATH,
        `Callout input must use lego.callout-thumbnails/5 and bind the exact booklet PDF. Manifest ` +
          `${JSON.stringify(manifestInput.value.schemaVersion ?? "missing")}/` +
          `${JSON.stringify(manifestInput.value.sourceHash ?? "missing")}; live PDF ${inputDigests.pdf}.`,
      ),
    );
  }
  let officialModel: OfficialModelIndex | null = null;
  if (
    officialModelBytes.length > 0 &&
    builderCalibrationInput.bytes.length > 0 &&
    builderGeometryBytes.length > 0
  ) {
    try {
      officialModel = applyBuilderCanonicalCalibration(
        parseOfficialModelIndex(officialModelBytes),
        builderCalibrationInput.bytes,
        inputDigests.builderCalibration,
        builderGeometryBytes,
        inputDigests.builderGeometry,
      );
      preparationFailures.push(...validateOfficialModelAccounting(officialModel));
    } catch (error) {
      preparationFailures.push({
        code: "builder-calibration-invalid",
        stage: "input",
        inputKey: BUILDER_CALIBRATION_PATH,
        message:
          `Official model Bone transforms could not be resolved through the exact versioned Builder ` +
          `calibration and separate raw Builder Shell geometry role: ` +
          `${error instanceof Error ? error.message : String(error)}.`,
      });
    }
  }
  let highlightCompatibilityVerified = false;
  try {
    const compatibility = verifyHighlightRendererCompatibilityInput({
      renderCasesBytes: highlightCasesInput.bytes,
      summaryBytes: highlightCompatibilityInput.bytes,
    });
    if (
      compatibility.roleDigest !== inputDigests.highlightCalibration ||
      compatibility.summary.policyMinimumExclusiveHighlightPixelsPerPiece !==
        MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE
    ) {
      throw new TypeError(
        `The compatibility closure must bind policy ${MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE} and reproduce role digest ${inputDigests.highlightCalibration}.`,
      );
    }
    highlightCompatibilityVerified = true;
  } catch (error) {
    preparationFailures.push(
      contractFailure(
        HIGHLIGHT_RENDERER_COMPATIBILITY_PATH,
        `Highlight renderer/source compatibility must reproduce the summary from the exact bounded raw ` +
          `case bytes and support the explicit ${MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE}px policy: ` +
          `${error instanceof Error ? error.message : String(error)}. This compatibility evidence does not ` +
          `authenticate the PDF, source origin, or visual correctness.`,
      ),
    );
  }
  // Legacy contract field name: this digest binds raw cases plus their reproducible compatibility summary.
  const highlightCalibrationDigest = highlightCompatibilityVerified
    ? inputDigests.highlightCalibration
    : null;
  const transitions = readTransitionClassificationBundle(transitionInput.value, inputDigests.pdf);
  const transitionClassificationsByStep = transitions.byStep;
  if (transitionInput.bytes.length > 0 && transitions.rejections.length > 0) {
    preparationFailures.push({
      code: "transition-classification-unverified",
      stage: "input",
      inputKey: TRANSITION_CLASSIFICATIONS_PATH,
      message:
        `Transition classification input must use lego.transition-classifications/1, bind the exact PDF, ` +
        `contain unique typed step/page/panel rows, and contain a bounded explicitly unauthenticated local ` +
        `classification claim whose decision and canonical digest reproduce exactly. Rejected because: ` +
        `${transitions.rejections.slice(0, 8).join(" ")}${
          transitions.rejections.length > 8
            ? ` (+${transitions.rejections.length - 8} further rejections)`
            : ""
        }`,
    });
  }
  // `null` is not an empty coverage index. It records that the closure never
  // bound, so nothing downstream has a coverage to read. Substituting `{}` here
  // is what turned one unbound input role into dozens of further "failures",
  // every one of them a false statement about the artifact on disk: the run
  // reported that coverage bound its PDF to "missing" and carried no callout
  // claims while the file it had just read bound the exact PDF digest and 859
  // claims. The substitute, not the artifact, was what those checks described.
  let verifiedCoverage: {
    readonly schemaVersion?: string;
    readonly byCallout?: unknown;
    readonly inputDigests?: { readonly pdf?: string; readonly calloutManifest?: string };
  } | null = null;
  let coverageClosureRejection: string | null = null;
  try {
    const reproduced = verifyRealBuildIdentificationClosure({
      coverage: coverageInput,
      manifest: manifestInput,
      features: identificationFeaturesInput,
      match: identificationMatchInput,
      distances: identificationDistancesInput,
      cards: identificationCardsInput,
      cardImages: identificationCardImagesInput,
      answers: identificationAnswersInput,
      elementResolution: elementResolutionInput,
      pairJudged: pairJudgedTruthInput,
      requestedLastStep,
    });
    if (typeof reproduced !== "object" || reproduced === null || Array.isArray(reproduced)) {
      throw new TypeError("The identification compiler returned a non-object coverage report.");
    }
    const candidate = reproduced as { readonly schemaVersion?: string };
    if (candidate.schemaVersion !== "lego.real-build-catalog-coverage/1") {
      throw new TypeError(
        `Reproduced coverage must use lego.real-build-catalog-coverage/1; received ${JSON.stringify(candidate.schemaVersion ?? "missing")}.`,
      );
    }
    verifiedCoverage = candidate;
  } catch (error) {
    // `verifiedCoverage` is still null: it is assigned only after the reproduced
    // report has passed its schema check, so no partial closure can leak past here.
    coverageClosureRejection = error instanceof Error ? error.message : String(error);
    preparationFailures.push(
      contractFailure(
        COVERAGE_PATH,
        `Catalog coverage was rejected before use because the bounded manifest, features, match, ` +
          `distances, cards, answers, and element-resolution bytes did not reproduce its exact closure: ` +
          `${coverageClosureRejection}.`,
      ),
    );
  }

  const rawCoverageIndex = verifiedCoverage?.byCallout;
  /** The bound callout index, or `null` when the closure never bound one. */
  const byCallout: Readonly<Record<string, CalloutResolution>> | null =
    verifiedCoverage === null
      ? null
      : typeof rawCoverageIndex === "object" &&
          rawCoverageIndex !== null &&
          !Array.isArray(rawCoverageIndex)
        ? (rawCoverageIndex as Readonly<Record<string, CalloutResolution>>)
        : {};
  if (byCallout !== null && Object.keys(byCallout).length === 0) {
    preparationFailures.push(
      contractFailure(
        `${COVERAGE_PATH}#byCallout`,
        `Coverage has no object-valued byCallout index; regenerate it from the bound callout manifest.`,
      ),
    );
  }
  const rawManifestCallouts = Array.isArray(manifestInput.value.callouts)
    ? manifestInput.value.callouts
    : [];
  const manifestCallouts: V5ManifestCallout[] = rawManifestCallouts.filter(isV5ManifestCallout);
  if (manifestCallouts.length === 0) {
    preparationFailures.push(
      contractFailure(
        `${MANIFEST_PATH}#callouts`,
        `The callout manifest has no callout array; regenerate the full 359-step manifest.`,
      ),
    );
  }
  if (
    manifestCallouts.length !== rawManifestCallouts.length ||
    manifestInput.value.calloutCount !== manifestCallouts.length ||
    new Set(manifestCallouts.map(({ identity }) => identity)).size !== manifestCallouts.length
  ) {
    preparationFailures.push(
      contractFailure(
        `${MANIFEST_PATH}#callouts`,
        `The v5 callout manifest must contain exactly calloutCount unique, typed identity records; received ` +
          `${manifestCallouts.length}/${rawManifestCallouts.length} typed rows for declared count ` +
          `${JSON.stringify(manifestInput.value.calloutCount ?? "missing")}.`,
      ),
    );
  }
  const ledgerSteps: readonly unknown[] = Array.isArray(ledgerInput.value.steps)
    ? ledgerInput.value.steps
    : [];
  const { panels, calloutBoxesByStep, panelEvidenceByStep } = await deriveRealBuildPanelEvidence({
    pdfBytes,
    source,
    pdfDigest: inputDigests.pdf,
  });
  const panelBindings = bindCalloutsToBookletPanels({
    lastStep: Number.isInteger(lastStep) ? lastStep : 1,
    manifestCallouts,
    panels,
    sourcePages: source.pages,
  });
  preparationFailures.push(...panelBindings.failures);
  if (officialModel !== null) {
    preparationFailures.push(
      ...validateRealBuildActionLedger({
        ledger: ledgerInput.value,
        ledgerDigest: inputDigests.actionLedger,
        lastStep: Number.isInteger(lastStep) ? lastStep : 1,
        official: officialModel,
        pdfDigest: inputDigests.pdf,
        coverageDigest: inputDigests.coverage,
        // Deliberately nullable: with no bound coverage the ledger's own
        // structure is still checked, but nothing is compared to a claim.
        calloutManifestDigest: inputDigests.calloutManifest,
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
  // Only over the requested prefix: the fold is a running parity from step 1, so
  // it is meaningful exactly on a contiguous run of steps whose icons have all
  // been read. Steps past the prefix get no face and the run refuses them, which
  // is why the panels are filtered by step and not merely by page.
  const facePanels = panels.filter(
    ({ stepNumber }) => stepNumber <= (Number.isInteger(lastStep) ? lastStep : 1),
  );
  const faceFeatures = deriveTransitionPanelFeatures({
    panels: facePanels,
    calloutBoxesByStep,
    panelEvidenceByStep,
    shapesByPage: await sampleBookletPageShapes(
      pdfBytes,
      facePanels.map(({ pageNumber }) => pageNumber),
    ),
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
  });
  const facesByStep = new Map(
    faceFeatures.map(({ stepNumber, panelFace }) => [stepNumber, panelFace]),
  );

  const specs = buildRealBuildPanelSpecs({
    repoRoot: process.cwd(),
    calloutDirectory: CALLOUT_DIRECTORY,
    panels,
    facesByStep,
    calloutBoxesByStep,
    stepByCalloutIdentity: panelBindings.stepByIdentity,
    manifestCallouts,
    ledgerSteps,
    officialModel,
    coverageByCallout: byCallout,
    inputDigests,
  });

  const options: RealBuildOptions = {
    ...bookletProbeUrls(),
    latticeUrl: workspaceModuleUrl("packages/rendering/src/camera-fit-lattice.ts"),
    renderingUrl: RENDERING_MODULE_URL,
    kernelUrl: BRICK_KERNEL_MODULE_URL,
    commandsUrl: MANUAL_COMMANDS_MODULE_URL,
    assemblyUrl: ASSEMBLY_MODULE_URL,
    panels: specs,
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
    lastStep: Number.isInteger(lastStep) ? lastStep : 1,
    renderScale: 6,
    panelWidth: 1_000,
    workFactor: 2,
    // Both budgets are per piece, and the pruned candidate set is a subset of
    // the exhaustive one, so they are the same number: see the coherence check
    // in `preflightRealBuildOptions`.
    maxRendersPerPiece: 220,
    blindRenderBudget: 220,
    // Step 1 alone is a 400-candidate product: four yaws of the quarter ring on
    // the empty plate times a hundred distinct seats for the round plate on each.
    deferredCandidateBudget: 512,
    // An exploded step renders every whole-step candidate once per member of
    // the arrow's travel family, so this bounds a product rather than a set:
    // printed step 2 is 105 candidates by 22 members. Sized from measured cost —
    // the run's own step lines report 88 renders in 1435ms, so 4096 is about a
    // minute of rendering for one printed step.
    explodedGhostRenderBudget: 4_096,
    // Printed step 4 defers because its own panel cannot separate its best
    // two placements, and narrowing against that same panel is what keeps its
    // 240 x 334 product finite. Sized from the same measured render cost as
    // the budget above: about a minute and a half.
    deferredNarrowingRenderBudget: 4_096,
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
    coverageByCallout: byCallout ?? {},
  };
  const evaluatedFailures = [
    ...preparationFailures,
    ...preflightRealBuildOptions({ ...options, coverageByCallout: byCallout }),
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
  const sourceFiles = enumerateRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
  const preImportSourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
  const bootstrapDrift = sourceDriftFailures(bootstrapSource.files, preImportSourceBundle);
  if (bootstrapDrift.length > 0) {
    throw new TypeError(
      `Pre-discovery locked source differs from the test-time source capture: ${bootstrapDrift.slice(0, 8).join("; ")}.`,
    );
  }
  const originalCodeSnapshots = Object.fromEntries(
    preImportSourceBundle.map(({ path, digest }) => [path, digest]),
  );
  const executionSourceBundle = planRealBuildSourceMirrorBundle({
    sourceFiles: preImportSourceBundle,
    fixedInputs: [
      { path: "inputs/booklet.pdf", digest: sha256Digest(pdfBytes), bytes: pdfBytes.length },
    ],
  });
  const codeSnapshots = Object.fromEntries(
    executionSourceBundle.map(({ path, digest }) => [path, digest]),
  );
  const runContract = createRealBuildRunContract({
    inputDigests,
    identificationClosure: identificationClosureDigests,
    panels: specs,
    budgets: realBuildRunBudgets(options),
    thresholds: realBuildRunThresholds(options),
    codeSnapshots,
  });
  const plan = planAtomicRunDirectory({
    outputRoot: effectiveOutputRoot,
    inputDigests,
    runContractDigest: runContract.contractDigest,
  });
  const run = beginAtomicRun(plan);
  const sourceMirror = materializeRealBuildSourceMirror({
    directory: run.directory,
    repoRoot: process.cwd(),
    sourceFiles,
    fixedInputs: [{ path: "inputs/booklet.pdf", bytes: pdfBytes }],
  });
  const initialMirrorDrift = sourceDriftFailures(executionSourceBundle, sourceMirror.files);
  if (initialMirrorDrift.length > 0) {
    throw new TypeError(
      `Real-build source mirror differs from its exact pre-import bundle: ${initialMirrorDrift.slice(0, 8).join("; ")}.`,
    );
  }
  const sourceLock = await acquireRealBuildSourceLock(sourceMirror);
  const servedResponses = createRealBuildServedResponseRecorder({
    page,
    mirror: sourceMirror,
    sourceLock,
    repoRoot: process.cwd(),
  });
  let result!: RealBuildResult;
  try {
    await servedResponses.install();
    sourceLock.assertHeld();
    const mirrorUrl = (path: string): string => {
      const resolved = resolveRealBuildPath(sourceMirror.root, path, {
        mustExist: true,
        label: "materialized real-build module",
      });
      return `/@fs/${resolved.replaceAll("\\", "/")}`;
    };
    const executionOptions: RealBuildOptions = {
      ...options,
      pdfjsUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.mjs"),
      workerUrl: mirrorUrl("node_modules/pdfjs-dist/build/pdf.worker.mjs"),
      pdfUrl: mirrorUrl("inputs/booklet.pdf"),
      latticeUrl: mirrorUrl("packages/rendering/src/camera-fit-lattice.ts"),
      renderingUrl: mirrorUrl("packages/rendering/src/index.ts"),
      kernelUrl: mirrorUrl("packages/brick-kernel/src/index.ts"),
      commandsUrl: mirrorUrl("apps/web/src/manual-commands.ts"),
      assemblyUrl: mirrorUrl("apps/web/src/assembly/index.ts"),
    };
    const executionDriverUrl = mirrorUrl("apps/web/e2e/real-build-run.ts");

    let retainedBrowserOutput: RealBuildBrowserOutput | null = null;
    if (inputFailures.length === 0) {
      await page.addInitScript(() => {
        Object.defineProperty(window, "WebSocket", { value: class {}, writable: true });
      });
      try {
        await page.goto("/__real_build_runner__");
        const reproducedHighlightCases = await captureHighlightExclusivityRenderCases(page, {
          contractUrl: mirrorUrl("apps/web/e2e/real-build-contract.ts"),
          kernelUrl: mirrorUrl("packages/brick-kernel/src/index.ts"),
          commandsUrl: mirrorUrl("apps/web/src/manual-commands.ts"),
          renderingUrl: mirrorUrl("packages/rendering/src/index.ts"),
        });
        assertHighlightRendererCasesReproduced(highlightCasesInput.bytes, reproducedHighlightCases);
      } catch (error) {
        inputFailures.push(
          contractFailure(
            HIGHLIGHT_RENDERER_CASES_PATH,
            `The materialized source-mirror renderer did not independently reproduce the bounded raw ` +
              `highlight compatibility cases: ${error instanceof Error ? error.message : String(error)}. ` +
              `This refuses renderer/source incompatibility; it does not authenticate the instruction PDF, ` +
              `the checkout's origin, or visual correctness.`,
          ),
        );
      }
    }
    if (inputFailures.length > 0) {
      result = inputRejectedRealBuildResult(executionOptions, inputFailures);
    } else {
      let browserOutput: RealBuildBrowserOutput;
      try {
        browserOutput = (await page.evaluate(
          async ({ driverUrl, driverOptions }) => {
            const driver = await import(/* @vite-ignore */ driverUrl);
            return driver.runRealBuild(driverOptions);
          },
          { driverUrl: executionDriverUrl, driverOptions: executionOptions },
        )) as RealBuildBrowserOutput;
      } catch (error) {
        browserOutput = {
          schemaVersion: "lego.real-build-browser-output/2",
          status: "failed",
          reports: [],
          documentJson: null,
          identityBindings: [],
          fetchedPdfDigest: null,
          failure: {
            code: "dynamic-import-failed",
            stage: "loading",
            inputKey: "browser-driver",
            message:
              `Playwright could not load and invoke the digest-bound real-build browser driver: ` +
              `${error instanceof Error ? error.message : String(error)}.`,
          },
          totalElapsedMs: 0,
        };
      }
      const postRunSnapshots = snapshotRealBuildCodeRoots(REAL_BUILD_SOURCE_ROOTS);
      const postRunSourceBundle = captureRealBuildSourceBundle(process.cwd(), sourceFiles);
      const mirrorPostRunBundle = captureRealBuildSourceBundle(
        sourceMirror.root,
        sourceMirror.files.map(({ path }) => path),
      );
      // The snapshot comparison used to be a bare JSON.stringify inequality, so
      // when it fired alone the message fell back to "digest map changed" and
      // named nothing. Both halves of this check now say which path moved and
      // what it moved from, which is the difference between a two-minute run
      // that tells you the answer and one that starts a search.
      const snapshotDrift = [
        ...Object.entries(originalCodeSnapshots).flatMap(([path, digest]) => {
          const observed = postRunSnapshots[path];
          return observed === digest
            ? []
            : [`${path}: captured ${digest}, observed ${observed ?? "missing"}`];
        }),
        ...Object.keys(postRunSnapshots)
          .filter((path) => originalCodeSnapshots[path] === undefined)
          .map((path) => `${path}: appeared during the run`),
      ];
      const drift = [
        ...snapshotDrift,
        ...sourceDriftFailures(preImportSourceBundle, postRunSourceBundle),
        ...sourceDriftFailures(executionSourceBundle, mirrorPostRunBundle),
      ];
      if (drift.length > 0) {
        browserOutput = {
          schemaVersion: "lego.real-build-browser-output/2",
          status: "failed",
          reports: browserOutput.reports,
          documentJson: browserOutput.documentJson,
          identityBindings: browserOutput.identityBindings,
          fetchedPdfDigest: browserOutput.fetchedPdfDigest,
          failure: {
            code: "source-drift-detected",
            stage: "replay",
            inputKey: "codeSnapshots",
            message:
              `Result-determining source changed between immutable pre-import capture, execution mirror, and ` +
              `post-run verification (${drift.length} entr${drift.length === 1 ? "y" : "ies"}): ` +
              `${drift.slice(0, 8).join("; ")}. The browser output is retained diagnostically but cannot be finalized.`,
          },
          totalElapsedMs: browserOutput.totalElapsedMs,
        };
      }
      retainedBrowserOutput = browserOutput;
      result = finalizeExecutedRealBuildResult({ options: executionOptions, browserOutput });
    }

    // The deferral's own measurable, printed as soon as a result exists rather
    // than with the rest of the summary at the end. Everything after this point —
    // the artifact plan, the replay closure, the manifest — can refuse a
    // partially-complete prefix and throw, and a number that only prints on runs
    // that did not need it is not a measurement.
    const deferrals = summariseDeferrals(result.steps);
    console.log(
      `deferral: ${deferrals.deferredSteps} printed step(s) had no scoring signal of their own, ` +
        `${deferrals.settledByLookahead} settled by a later panel, deepest settlement reach ` +
        `${deferrals.deepestSettlementReachSteps} printed step(s); ` +
        `${result.steps.reduce((total, step) => total + step.placedPieces, 0)} piece(s) placed.`,
    );

    const servedResponseEvidence = await servedResponses.writeEvidence(run.directory);
    sourceLock.assertHeld();
    const stepArtifactFiles = result.steps.flatMap((step) => {
      const tag = String(step.stepNumber).padStart(3, "0");
      return [
        ...(step.panelPng === null ? [] : [`step-${tag}-panel.png`]),
        ...(step.buildPng === null ? [] : [`step-${tag}-build.png`]),
      ];
    });
    const artifactFiles = validateRealBuildArtifactFilePlan([
      ...servedResponseEvidence.files,
      ...stepArtifactFiles,
      ...(result.documentJson === null || result.structuralHash === null ? [] : ["document.json"]),
      "score.json",
    ]);
    for (const step of result.steps) {
      const tag = String(step.stepNumber).padStart(3, "0");
      for (const [kind, png] of [
        ["panel", step.panelPng],
        ["build", step.buildPng],
      ] as const) {
        if (png !== null) {
          const file = `step-${tag}-${kind}.png`;
          writeContainedRegularFileAtomic(run.directory, file, decodeRealBuildPngCapture(png), {
            label: "real-build step capture",
          });
        }
      }
    }
    if (result.documentJson !== null && result.structuralHash !== null) {
      writeContainedRegularFileAtomic(run.directory, "document.json", result.documentJson, {
        label: "real-build document",
      });
    }
    const score = createRealBuildScore({
      runId: plan.runId,
      result,
      accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
      lastStep: options.lastStep,
    });
    writeContainedRegularFileAtomic(
      run.directory,
      "score.json",
      `${JSON.stringify(score, null, 1)}\n`,
      { label: "real-build score" },
    );
    const replayRoles = [
      { role: "pdf", bytes: pdfBytes },
      { role: "callout-manifest", bytes: manifestInput.bytes },
      { role: "coverage", bytes: coverageInput.bytes },
      { role: "official-model", bytes: officialModelBytes },
      { role: "action-ledger", bytes: ledgerInput.bytes },
      { role: "highlight-calibration", bytes: highlightCompatibilityRoleBytes },
      { role: "builder-calibration", bytes: builderCalibrationInput.bytes },
      { role: "builder-geometry", bytes: builderGeometryBytes },
      { role: "transition-classifications", bytes: transitionInput.bytes },
      { role: "identification-features", bytes: identificationFeaturesInput.bytes },
      { role: "identification-match", bytes: identificationMatchInput.bytes },
      { role: "identification-distances", bytes: identificationDistancesInput.bytes },
      { role: "element-resolution", bytes: elementResolutionInput.bytes },
      { role: "pair-judged-truth", bytes: pairJudgedTruthInput.bytes },
      ...(identificationMode?.source === "adjudicated" &&
      identificationCardsInput !== null &&
      identificationCardImagesInput !== null &&
      identificationAnswersInput !== null
        ? [
            { role: "identification-cards", bytes: identificationCardsInput.bytes },
            {
              role: "identification-card-images",
              bytes: identificationCardImagesInput.bytes,
            },
            { role: "identification-answers", bytes: identificationAnswersInput.bytes },
          ]
        : []),
      { role: "run-contract", bytes: Buffer.from(JSON.stringify(runContract)) },
      { role: "prepared-options", bytes: Buffer.from(JSON.stringify(executionOptions)) },
      ...(retainedBrowserOutput === null
        ? []
        : [
            {
              role: "browser-output",
              bytes: Buffer.from(JSON.stringify(retainedBrowserOutput)),
            },
          ]),
    ];
    sourceLock.assertHeld();
    const replayClosure = writeRealBuildReplayClosure({
      directory: run.directory,
      repoRoot: sourceMirror.root,
      roles: replayRoles,
      sourceFiles: sourceMirror.files.map(({ path }) => path),
      environment: {
        schemaVersion: "lego.real-build-environment/1",
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        browser: {
          name: browserName,
          version: page.context().browser()?.version() ?? "unavailable",
        },
        playwright: "@playwright/test (exact package bytes retained in source bundle)",
        replayProtocol: 1,
        bootstrapSourceManifestDigest: bootstrapSource.manifestDigest,
        runContractDigest: runContract.contractDigest,
        servedResponseManifestDigest: servedResponseEvidence.manifestDigest,
      },
      browserOutputRetained: retainedBrowserOutput !== null,
    });
    writeRealBuildArtifactManifest({
      directory: run.directory,
      runId: plan.runId,
      runContract,
      result,
      artifactFiles,
      replayClosure,
    });
    sourceLock.assertHeld();
  } finally {
    try {
      await servedResponses.dispose();
    } finally {
      await sourceLock.release();
    }
  }
  assertRealBuildBootstrapSourceLockHeld();
  const published = await run.publish(verifyRealBuildArtifactManifest);
  console.log(
    `${result.authority.kind}/${result.status}: ${result.steps.filter(isAtomicStepComplete).length}/${result.steps.length} steps complete; ` +
      `${result.steps.reduce((total, step) => total + step.placedPieces, 0)} piece(s) placed; ` +
      `retained unauthenticated evidence ${published}`,
  );

  expect(result.schemaVersion).toBe("lego.real-build-result/3");
  expect(result.inputDigests).toEqual(inputDigests);
  const executionFailure = realBuildExecutionFailure(result);
  expect(executionFailure, executionFailure?.message).toBeNull();
  if (result.status === "completed") {
    expect(options.lastStep).toBe(EXPECTED_PRINTED_STEPS);
    expect(result.steps).toHaveLength(EXPECTED_PRINTED_STEPS);
    expect(result.finalParts).toBe(OFFICIAL_REAL_BUILD_ACCOUNTING.assembledTargetPieces);
    expect(result.documentJson).not.toBeNull();
    for (const step of result.steps) {
      expect(isAtomicStepComplete(step)).toBe(true);
      expect(step.validation.documentGloballyValid).toBe(true);
    }
  } else {
    expect(result.status).toBe("prefix-complete");
    expect(result.steps).toHaveLength(options.lastStep);
  }
});
