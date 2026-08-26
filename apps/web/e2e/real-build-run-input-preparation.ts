import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest, validateRealBuildOutputRoot } from "./real-build-artifacts";
import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source";
import {
  contractFailure,
  ACTION_LEDGER_PATH,
  BUILDER_CALIBRATION_PATH,
  BUILDER_GEOMETRY_PATH,
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
  readIdentificationAdjudicationInputs,
  readJsonArtifact,
  SOURCE_ART_REBOUND_PATH,
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
import { admitCanonicalRealBuildActionLedgerBytes } from "./real-build-action-ledger-admission";
import {
  applyBuilderCanonicalCalibration,
  parseOfficialModelIndex,
  validateOfficialModelAccounting,
  type BuilderCanonicalCalibration,
  type OfficialModelIndex,
  type RealBuildActionLedger,
} from "./real-build-ledger";
import { inspectRealBuildManifestRows } from "./real-build-manifest-consumption";
import { REAL_BUILD_PRODUCTION_MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE as MINIMUM_EXCLUSIVE_HIGHLIGHT_PIXELS_PER_PIECE } from "./real-build-production-policy";
import type { StepFailure } from "./real-build-safety";
import { readTransitionClassificationBundle } from "./real-build-transition-classification";
import { parseRealBuildRequestedLastStep } from "./real-build-requested-last-step";
import type { RealBuildIdentificationClosureDigests } from "./real-build-run-contract";

const OUTPUT_ROOT = process.env.LEGO_REAL_BUILD_OUT ?? "output/real-build";

export async function prepareRealBuildInputs() {
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
  const lastStep = parseRealBuildRequestedLastStep(process.env.LEGO_REAL_BUILD_LAST_STEP);
  const coverageInput = readJsonArtifact<{
    readonly schemaVersion?: string;
    readonly byCallout?: unknown;
    readonly inputDigests?: {
      readonly pdf?: string;
      readonly calloutManifest?: string;
      readonly sourceArtRebound?: string;
    };
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
  const ledgerFailureCountBeforeRead = preparationFailures.length;
  const rawLedgerInput = readJsonArtifact<unknown>(ACTION_LEDGER_PATH, preparationFailures);
  let admittedLedger = {} as RealBuildActionLedger;
  if (preparationFailures.length === ledgerFailureCountBeforeRead) {
    try {
      admittedLedger = admitCanonicalRealBuildActionLedgerBytes({
        bytes: rawLedgerInput.bytes,
        label: `Required real-build input ${ACTION_LEDGER_PATH}`,
        mode: "exact-execution",
        requestedLastStep: lastStep,
      });
    } catch (error) {
      preparationFailures.push(
        contractFailure(
          ACTION_LEDGER_PATH,
          error instanceof Error ? error.message : "Action ledger current /3 admission failed.",
        ),
      );
    }
  }
  const ledgerInput = { ...rawLedgerInput, value: admittedLedger };
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
  const sourceArtReboundInput = readJsonArtifact<unknown>(
    SOURCE_ART_REBOUND_PATH,
    preparationFailures,
  );
  let identificationMode: RealBuildIdentificationMode | null = null;
  try {
    identificationMode = identifyRealBuildIdentificationMode(coverageInput, lastStep);
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
    sourceArtRebound: sourceArtReboundInput.digest,
    cards: identificationCardsInput?.digest ?? null,
    cardImages: identificationCardImagesInput?.digest ?? null,
    answers: identificationAnswersInput?.digest ?? null,
  };
  if (
    manifestInput.value.schemaVersion !== "lego.callout-thumbnails/6" ||
    manifestInput.value.sourceHash !== inputDigests.pdf
  ) {
    preparationFailures.push(
      contractFailure(
        MANIFEST_PATH,
        `Callout input must use lego.callout-thumbnails/6 and bind the exact booklet PDF. Manifest ` +
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
    const reproduced = await verifyRealBuildIdentificationClosure({
      pdf: { bytes: pdfBytes, digest: inputDigests.pdf },
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
      sourceArtRebound: sourceArtReboundInput,
      requestedLastStep: lastStep,
    });
    if (typeof reproduced !== "object" || reproduced === null || Array.isArray(reproduced)) {
      throw new TypeError("The identification compiler returned a non-object coverage report.");
    }
    const candidate = reproduced as { readonly schemaVersion?: string };
    if (candidate.schemaVersion !== "lego.real-build-catalog-coverage/3") {
      throw new TypeError(
        `Reproduced coverage must use lego.real-build-catalog-coverage/3; received ${JSON.stringify(candidate.schemaVersion ?? "missing")}.`,
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
        `Catalog coverage was rejected before use because the bounded PDF, manifest, source-art rebound, ` +
          `features, match, distances, cards, card-images, answers, pair-judged, and element-resolution bytes did not reproduce its exact closure: ` +
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
  const manifestRows = inspectRealBuildManifestRows(
    manifestInput.value.callouts,
    manifestInput.value.calloutCount,
    verifiedCoverage !== null,
  );
  const manifestCallouts = manifestRows.typed;
  if (manifestCallouts.length === 0) {
    preparationFailures.push(
      contractFailure(
        `${MANIFEST_PATH}#callouts`,
        `The callout manifest has no callout array; regenerate the full 359-step manifest.`,
      ),
    );
  }
  if (!manifestRows.structurallyClosed) {
    preparationFailures.push(
      contractFailure(
        `${MANIFEST_PATH}#callouts`,
        `The v6 callout manifest must contain exactly calloutCount unique, typed identity records; received ` +
          `${manifestCallouts.length}/${manifestRows.rawCount} typed rows for declared count ` +
          `${JSON.stringify(manifestInput.value.calloutCount ?? "missing")}.`,
      ),
    );
  }
  const ledgerSteps: readonly unknown[] = Array.isArray(ledgerInput.value.steps)
    ? ledgerInput.value.steps
    : [];
  return {
    bootstrapSource,
    preparationFailures,
    effectiveOutputRoot,
    lastStep,
    coverageInput,
    manifestInput,
    highlightCasesInput,
    ledgerInput,
    builderCalibrationInput,
    transitionInput,
    identificationFeaturesInput,
    identificationMatchInput,
    identificationDistancesInput,
    elementResolutionInput,
    pairJudgedTruthInput,
    sourceArtReboundInput,
    identificationMode,
    identificationCardsInput,
    identificationCardImagesInput,
    identificationAnswersInput,
    officialModelBytes,
    builderGeometryBytes,
    pdfBytes,
    source,
    highlightCompatibilityRoleBytes,
    inputDigests,
    identificationClosureDigests,
    officialModel,
    highlightCalibrationDigest,
    transitionClassificationsByStep,
    verifiedCoverage,
    coverageClosureRejection,
    byCallout,
    manifestRows,
    ledgerSteps,
  };
}

export type PreparedRealBuildInputs = Awaited<ReturnType<typeof prepareRealBuildInputs>>;
