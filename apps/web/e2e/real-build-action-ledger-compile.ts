import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest } from "./real-build-artifacts";
import {
  assembleRealBuildActionLedger,
  emittedRealBuildActionLedger,
  encodeRealBuildActionLedger,
  type AssembledRealBuildActionLedger,
  type EmittedRealBuildActionLedger,
} from "./real-build-action-ledger";
import {
  identifyRealBuildIdentificationMode,
  verifyRealBuildIdentificationClosure,
} from "./real-build-identification-closure";
import {
  BUILDER_CALIBRATION_PATH,
  BUILDER_GEOMETRY_PATH,
  COVERAGE_PATH,
  ELEMENT_RESOLUTION_PATH,
  IDENTIFICATION_DISTANCES_PATH,
  IDENTIFICATION_FEATURES_PATH,
  IDENTIFICATION_MATCH_PATH,
  MANIFEST_PATH,
  OFFICIAL_MODEL_PATH,
  PAIR_JUDGED_TRUTH_PATH,
  readBinaryInput,
  readIdentificationAdjudicationInputs,
  readJsonArtifact,
  TRANSITION_CLASSIFICATIONS_PATH,
  type CalloutManifest,
  type CalloutResolution,
  type TransitionClassificationBundle,
} from "./real-build-input-files";
import {
  applyBuilderCanonicalCalibration,
  parseOfficialModelIndex,
  validateOfficialModelAccounting,
  validateRealBuildActionLedger,
  type BuilderCanonicalCalibration,
} from "./real-build-ledger";
import { deriveRealBuildPanelEvidence } from "./real-build-panel-evidence";
import { readTransitionClassificationBundle } from "./real-build-transition-classification";
import type { StepFailure } from "./real-build-safety";

/**
 * Reads exactly what the real-build probe reads, and compiles one action ledger.
 *
 * The publisher never writes a ledger it has not first pushed back through
 * `validateRealBuildActionLedger`, the same function the probe applies, so a
 * file the probe would reject on its own bindings never reaches the output
 * root. The validation failures that remain are returned rather than thrown:
 * they are the honest statement of which evidence the booklet still lacks, and
 * the caller prints them.
 */

export const REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS = 359 as const;

export interface CompiledRealBuildActionLedger {
  readonly assembled: AssembledRealBuildActionLedger;
  readonly emitted: EmittedRealBuildActionLedger;
  readonly encoded: Buffer;
  readonly encodedDigest: string;
  readonly inputFailures: readonly StepFailure[];
  readonly validationFailures: readonly StepFailure[];
  readonly validatedThroughStep: number;
}

/** Compiles the ledger for the requested prefix and re-validates the exact bytes it would write. */
export async function compileRealBuildActionLedger(options?: {
  readonly validateThroughStep?: number;
}): Promise<CompiledRealBuildActionLedger> {
  const inputFailures: StepFailure[] = [];
  const coverageInput = readJsonArtifact<Record<string, unknown>>(COVERAGE_PATH, inputFailures);
  const manifestInput = readJsonArtifact<CalloutManifest>(MANIFEST_PATH, inputFailures);
  const builderCalibrationInput = readJsonArtifact<BuilderCanonicalCalibration>(
    BUILDER_CALIBRATION_PATH,
    inputFailures,
  );
  const transitionInput = readJsonArtifact<TransitionClassificationBundle>(
    TRANSITION_CLASSIFICATIONS_PATH,
    inputFailures,
  );
  const featuresInput = readJsonArtifact<unknown>(IDENTIFICATION_FEATURES_PATH, inputFailures);
  const matchInput = readJsonArtifact<unknown>(IDENTIFICATION_MATCH_PATH, inputFailures);
  const distancesInput = readJsonArtifact<unknown>(IDENTIFICATION_DISTANCES_PATH, inputFailures);
  const elementsInput = readJsonArtifact<unknown>(ELEMENT_RESOLUTION_PATH, inputFailures);
  const pairJudgedInput = readJsonArtifact<unknown>(PAIR_JUDGED_TRUTH_PATH, inputFailures);
  const officialModelBytes = readBinaryInput(OFFICIAL_MODEL_PATH, inputFailures);
  const builderGeometryBytes = readBinaryInput(BUILDER_GEOMETRY_PATH, inputFailures);
  const mode = identifyRealBuildIdentificationMode(
    coverageInput,
    REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS,
  );
  const adjudication = readIdentificationAdjudicationInputs(mode.source, inputFailures);
  if (inputFailures.length > 0) {
    throw new TypeError(
      `The action ledger cannot be compiled because required real-build inputs are missing or unreadable: ` +
        `${inputFailures.map(({ inputKey, message }) => `${inputKey}: ${message}`).join(" ")}`,
    );
  }

  const { bytes: pdfBytes, source } = await readSampleBooklet();
  const bindings = {
    pdfDigest: sha256Digest(pdfBytes),
    coverageDigest: coverageInput.digest,
    calloutManifestDigest: manifestInput.digest,
    builderCalibrationDigest: builderCalibrationInput.digest,
    transitionClassificationsDigest: transitionInput.digest,
  };
  const official = applyBuilderCanonicalCalibration(
    parseOfficialModelIndex(officialModelBytes),
    builderCalibrationInput.bytes,
    bindings.builderCalibrationDigest,
    builderGeometryBytes,
    sha256Digest(builderGeometryBytes),
  );
  const accounting = validateOfficialModelAccounting(official);
  if (accounting.length > 0) {
    throw new TypeError(
      `The official model does not account for set 6651557's identities, so no printed step can be bound ` +
        `to it: ${accounting.map(({ message }) => message).join(" ")}`,
    );
  }
  const transitions = readTransitionClassificationBundle(transitionInput.value, bindings.pdfDigest);
  if (transitions.rejections.length > 0) {
    throw new TypeError(
      `The retained transition-classification bundle is rejected by the live contract, so its transition ` +
        `steps cannot be reused: ${transitions.rejections.slice(0, 8).join(" ")}`,
    );
  }
  const reproducedCoverage = verifyRealBuildIdentificationClosure({
    coverage: coverageInput,
    manifest: manifestInput,
    features: featuresInput,
    match: matchInput,
    distances: distancesInput,
    cards: adjudication.cards,
    cardImages: adjudication.cardImages,
    answers: adjudication.answers,
    elementResolution: elementsInput,
    pairJudged: pairJudgedInput,
    requestedLastStep: REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS,
  }) as { readonly byCallout?: unknown };
  const rawIndex = reproducedCoverage.byCallout;
  if (typeof rawIndex !== "object" || rawIndex === null || Array.isArray(rawIndex)) {
    throw new TypeError(
      `Reproduced catalog coverage has no object-valued byCallout index, so no printed step carries a ` +
        `retained piece callout. Republish ${COVERAGE_PATH} from its bound identification artifacts.`,
    );
  }
  const coverageByCallout = rawIndex as Readonly<Record<string, CalloutResolution>>;
  const { panelEvidenceByStep } = await deriveRealBuildPanelEvidence({
    pdfBytes,
    source,
    pdfDigest: bindings.pdfDigest,
  });

  const assembled = assembleRealBuildActionLedger({
    official,
    bindings,
    coverageByCallout,
    panelEvidenceByStep,
    transitionClassificationsByStep: transitions.byStep,
    expectedPrintedSteps: REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS,
  });
  const emitted = emittedRealBuildActionLedger(assembled, REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS);
  const encoded = encodeRealBuildActionLedger(emitted);
  const encodedDigest = sha256Digest(encoded);
  const validatedThroughStep = Math.max(
    1,
    Math.min(options?.validateThroughStep ?? assembled.alignedThroughStep, 359),
  );
  const validationFailures = validateRealBuildActionLedger({
    ledger: assembled.ledger,
    ledgerDigest: encodedDigest,
    lastStep: validatedThroughStep,
    official,
    pdfDigest: bindings.pdfDigest,
    coverageDigest: bindings.coverageDigest,
    calloutManifestDigest: bindings.calloutManifestDigest,
    builderCalibrationDigest: bindings.builderCalibrationDigest,
    transitionClassificationsDigest: bindings.transitionClassificationsDigest,
    coverageByCallout,
    panelEvidenceByStep,
    transitionClassificationsByStep: transitions.byStep,
  });
  return {
    assembled,
    emitted,
    encoded,
    encodedDigest,
    inputFailures,
    validationFailures,
    validatedThroughStep,
  };
}
