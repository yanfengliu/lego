import { readSampleBooklet } from "./booklet-fixture";
import { sha256Digest } from "./real-build-artifacts";
import {
  assembleRealBuildActionLedger,
  emittedRealBuildActionLedger,
  encodeRealBuildActionLedger,
  MAXIMUM_REAL_BUILD_ACTION_LEDGER_REQUESTED_LAST_STEP,
  type AssembledRealBuildActionLedger,
  type EmittedRealBuildActionLedger,
} from "./real-build-action-ledger";
import { realBuildActionLedgerCurrentPrefixFailures } from "./real-build-action-ledger-provenance";
import { preflightRealBuildActionLedger } from "./real-build-ledger-bounds";
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
  SOURCE_ART_REBOUND_PATH,
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
import { REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS } from "./real-build-production-policy";
import { readTransitionClassificationBundle } from "./real-build-transition-classification";
import type { StepFailure } from "./real-build-safety";

/**
 * Reads exactly what the real-build probe reads, and compiles one action ledger.
 *
 * The publisher never writes a ledger it has not first pushed back through
 * `validateRealBuildActionLedger`, the same function the probe applies, so a
 * file the probe would reject on its own bindings must not reach the output
 * root. Compilation returns bounded failure records for diagnosis; every
 * publisher applies `requirePublishableRealBuildActionLedger` before writing.
 */

export const REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS = REAL_BUILD_PRODUCTION_EXPECTED_PRINTED_STEPS;

export interface CompiledRealBuildActionLedger {
  readonly assembled: AssembledRealBuildActionLedger;
  readonly emitted: EmittedRealBuildActionLedger;
  readonly encoded: Buffer;
  readonly encodedDigest: string;
  readonly inputFailures: readonly StepFailure[];
  readonly validationFailures: readonly StepFailure[];
  readonly expectedPrintedSteps: typeof REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS;
  readonly requestedLastStep: number;
  readonly validatedThroughStep: number;
}

const MAXIMUM_PUBLISH_FAILURE_CATEGORIES = 8;

export function requirePublishableRealBuildActionLedger(
  compiled: Pick<
    CompiledRealBuildActionLedger,
    | "encoded"
    | "emitted"
    | "expectedPrintedSteps"
    | "requestedLastStep"
    | "validatedThroughStep"
    | "validationFailures"
  >,
): void {
  if (compiled.expectedPrintedSteps !== REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS) {
    throw new TypeError(
      `Refusing to publish an action ledger without the fixed ` +
        `${REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS}-step source/index contract; no ledger file was written.`,
    );
  }
  if (
    !Number.isSafeInteger(compiled.requestedLastStep) ||
    compiled.requestedLastStep < 1 ||
    compiled.requestedLastStep > MAXIMUM_REAL_BUILD_ACTION_LEDGER_REQUESTED_LAST_STEP
  ) {
    throw new TypeError(
      `Refusing to publish an action ledger with invalid requestedLastStep ` +
        `${JSON.stringify(compiled.requestedLastStep)}; expected one safe integer from 1 through ` +
        `${MAXIMUM_REAL_BUILD_ACTION_LEDGER_REQUESTED_LAST_STEP} while the source/index contract remains ` +
        `${REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS}, and no ledger file was written.`,
    );
  }
  if (compiled.validatedThroughStep === 0) {
    throw new TypeError(
      `Refusing to publish an empty action ledger for requested printed steps ` +
        `1..${compiled.requestedLastStep}. The first requested step was not corroborated, so no assembled ` +
        `prefix exists and no ledger file was written.`,
    );
  }
  if (
    !Number.isSafeInteger(compiled.validatedThroughStep) ||
    compiled.validatedThroughStep < 0 ||
    compiled.validatedThroughStep > compiled.requestedLastStep
  ) {
    throw new TypeError(
      `Refusing to publish an action ledger whose validated prefix ${compiled.validatedThroughStep} is ` +
        `outside requested printed steps 1..${compiled.requestedLastStep}; no ledger file was written.`,
    );
  }
  const shape = preflightRealBuildActionLedger(compiled.emitted);
  if (shape.failure !== null) {
    throw new TypeError(
      `Refusing to publish an action ledger outside the closed current /4 schema: ` +
        `${shape.failure.message} No ledger file was written.`,
    );
  }
  const canonicalBytes = encodeRealBuildActionLedger(shape.ledger);
  if (!canonicalBytes.equals(Buffer.from(compiled.encoded))) {
    throw new TypeError(
      `Refusing to publish action-ledger bytes that are not the exact canonical re-encoding of the ` +
        `closed current /4 object; no ledger file was written.`,
    );
  }
  const boundaryFailures = realBuildActionLedgerCurrentPrefixFailures({
    schemaVersion: shape.ledger.schemaVersion,
    provenance: shape.ledger.provenance,
    steps: shape.ledger.steps,
    requestedLastStep: compiled.requestedLastStep,
    validationLastStep: compiled.validatedThroughStep,
  });
  if (boundaryFailures.length > 0) {
    throw new TypeError(
      `Refusing to publish an action ledger outside the current closed /4 prefix contract: ` +
        `${boundaryFailures[0]} No ledger file was written.`,
    );
  }
  if (compiled.validationFailures.length === 0) return;
  const counts = new Map<string, number>();
  for (const failure of compiled.validationFailures) {
    const category = /^[a-z0-9-]{1,80}$/u.test(failure.code)
      ? failure.code
      : "invalid-failure-code";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const categories = [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  const shown = categories
    .slice(0, MAXIMUM_PUBLISH_FAILURE_CATEGORIES)
    .map(([category, count]) => `${category}=${count}`)
    .join(", ");
  const omitted = categories.length - MAXIMUM_PUBLISH_FAILURE_CATEGORIES;
  throw new TypeError(
    `Refusing to publish an action ledger with ${compiled.validationFailures.length} validation failure(s) ` +
      `through its complete assembled prefix ending at printed step ${compiled.validatedThroughStep}. ` +
      `Bounded categories: ${shown}${omitted > 0 ? `, ${omitted} more categories omitted` : ""}. ` +
      `Resolve the named evidence categories and recompile; no ledger file was written.`,
  );
}

export function requireRealBuildActionLedgerRequestedLastStep(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 50) {
    throw new TypeError(
      `Action-ledger compiler requestedLastStep must be a safe integer from 1 through ` +
        `50 while the source/index contract remains ${REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS}; received ` +
        `${JSON.stringify(value)}.`,
    );
  }
  return value as number;
}

export function requireRealBuildActionLedgerCoveragePrefix(
  coverageLastStep: number,
  requestedLastStep: number,
): void {
  if (coverageLastStep === requestedLastStep) return;
  throw new TypeError(
    `Action-ledger compilation requested printed steps 1..${requestedLastStep}, but retained catalog ` +
      `coverage was compiled through step ${coverageLastStep}. Republish ${COVERAGE_PATH} with ` +
      `--last-step ${requestedLastStep}; the full 359-step callout manifest remains the source/index ` +
      `contract, while identity compilation and verification stay inside the requested prefix.`,
  );
}

export function parseRealBuildActionLedgerRequestedLastStep(value: string | undefined): number {
  const boundedValue =
    value === undefined
      ? "missing"
      : JSON.stringify(value.length <= 80 ? value : `${value.slice(0, 80)}...`);
  if (value === undefined || !/^[1-9][0-9]?$/u.test(value)) {
    throw new TypeError(
      `LEGO_REAL_BUILD_LAST_STEP must be set explicitly to an integer from 1 through ` +
        `${MAXIMUM_REAL_BUILD_ACTION_LEDGER_REQUESTED_LAST_STEP} while the source/index contract remains ` +
        `${REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS}; no implicit full-booklet prefix is selected. ` +
        `Received ${boundedValue}.`,
    );
  }
  return requireRealBuildActionLedgerRequestedLastStep(Number(value));
}

export interface CompileRealBuildActionLedgerOptions {
  readonly requestedLastStep: number;
}

/** Compiles the ledger for the requested prefix and re-validates the exact bytes it would write. */
export async function compileRealBuildActionLedger(
  options: CompileRealBuildActionLedgerOptions,
): Promise<CompiledRealBuildActionLedger> {
  const requestedLastStep = requireRealBuildActionLedgerRequestedLastStep(
    options.requestedLastStep,
  );
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
  const sourceArtReboundInput = readJsonArtifact<unknown>(SOURCE_ART_REBOUND_PATH, inputFailures);
  const officialModelBytes = readBinaryInput(OFFICIAL_MODEL_PATH, inputFailures);
  const builderGeometryBytes = readBinaryInput(BUILDER_GEOMETRY_PATH, inputFailures);
  const mode = identifyRealBuildIdentificationMode(coverageInput, requestedLastStep);
  requireRealBuildActionLedgerCoveragePrefix(mode.lastStep, requestedLastStep);
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
    sourceArtReboundDigest: sourceArtReboundInput.digest,
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
  const reproducedCoverage = (await verifyRealBuildIdentificationClosure({
    coverage: coverageInput,
    pdf: { bytes: pdfBytes, digest: bindings.pdfDigest },
    manifest: manifestInput,
    sourceArtRebound: sourceArtReboundInput,
    features: featuresInput,
    match: matchInput,
    distances: distancesInput,
    cards: adjudication.cards,
    cardImages: adjudication.cardImages,
    answers: adjudication.answers,
    elementResolution: elementsInput,
    pairJudged: pairJudgedInput,
    requestedLastStep,
  })) as { readonly byCallout?: unknown };
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
    requestedLastStep,
  });
  const emitted = emittedRealBuildActionLedger(assembled);
  const encoded = encodeRealBuildActionLedger(emitted);
  const encodedDigest = sha256Digest(encoded);
  const validatedThroughStep = assembled.alignedThroughStep;
  const validationFailures: readonly StepFailure[] =
    validatedThroughStep === 0
      ? [
          {
            code: "action-ledger-incomplete",
            stage: "input",
            message:
              `Action-ledger assembly corroborated no requested printed step within 1..${requestedLastStep}. ` +
              `${assembled.stopReason}`,
          },
        ]
      : validateRealBuildActionLedger({
          ledger: emitted,
          ledgerDigest: encodedDigest,
          requestedLastStep,
          lastStep: validatedThroughStep,
          official,
          pdfDigest: bindings.pdfDigest,
          coverageDigest: bindings.coverageDigest,
          calloutManifestDigest: bindings.calloutManifestDigest,
          sourceArtReboundDigest: bindings.sourceArtReboundDigest,
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
    expectedPrintedSteps: REAL_BUILD_ACTION_LEDGER_PRINTED_STEPS,
    requestedLastStep,
    validatedThroughStep,
  };
}
