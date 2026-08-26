import {
  canonicalStringify,
  deriveBuildSequence,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  isAtomicStepComplete,
  isSha256Digest,
  stepPrerequisiteFacts,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildResult,
  type RealBuildStepReport,
  type StepFailure,
} from "./real-build-safety";
import { isLocalRealBuildAuthority, LOCAL_REAL_BUILD_AUTHORITY } from "./real-build-authority";
import { preflightRealBuildOptions, unexecutedStepReport } from "./real-build-contract";
import {
  readRealBuildBrowserOutput,
  type RealBuildBrowserOutput,
  type RealBuildIdentityBinding,
} from "./real-build-browser-output";
import { createRealBuildDiagnosticPrefix } from "./real-build-diagnostic-prefix";
import { auditRealBuildIdentityBindings } from "./real-build-finalize-identity";
import type { RealBuildDiagnosticPrefix } from "./real-build-result";

type CanonicalDocumentShape = BrickDocumentV1;

const FULL_PRINTED_STEPS = 359;
const FULL_ASSEMBLED_PARTS = 1_464;
const trustedFinalizedResults = new WeakSet<RealBuildResult>();

export function isLocallyFinalizedRealBuildResult(result: RealBuildResult): boolean {
  return trustedFinalizedResults.has(result);
}

const completionFailure = (message: string, stepNumber?: number): StepFailure => ({
  code: "run-incomplete",
  stage: "validation",
  ...(stepNumber === undefined ? {} : { stepNumber }),
  message,
});

function parseCanonicalDocument(documentJson: string): CanonicalDocumentShape {
  const value: unknown = JSON.parse(documentJson);
  const validation = validateBrickDocument(value);
  const schemaIssue = validation.issues.find(({ code }) => code === "SCHEMA_INVALID");
  if (schemaIssue !== undefined) {
    throw new TypeError(`kernel rejected canonical document schema: ${schemaIssue.message}`);
  }
  const candidate = value as CanonicalDocumentShape;
  if (!Array.isArray(candidate.parts) || !Array.isArray(candidate.steps)) {
    throw new TypeError("document must contain parts and steps arrays");
  }
  return candidate;
}

function expectedStepName(panel: RealBuildPanelSpec): string {
  return panel.action.kind === "transition"
    ? `Step ${panel.stepNumber} [transition:${panel.action.transition};` +
        `panel=${panel.action.panelEvidenceDigest}]`
    : `Step ${panel.stepNumber}`;
}

function canonicalPrefixDocument(
  document: CanonicalDocumentShape,
  lastStepNumber: number,
): CanonicalDocumentShape {
  const steps = document.steps.filter(({ index }) => index < lastStepNumber);
  const stepIds = new Set(steps.map(({ id }) => id));
  const parts = document.parts.filter(({ stepId }) => stepIds.has(stepId));
  const partIds = new Set(parts.map(({ id }) => id));
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => partIds.has(partId)),
  });
  return {
    ...document,
    parts,
    steps,
    connections: document.connections.filter(
      ({ a, b }) => partIds.has(a.partId) && partIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
}

export function auditRealBuildReportEvidence(
  options: RealBuildOptions,
  panel: RealBuildPanelSpec,
  report: RealBuildStepReport,
): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  // Reserved for the deterministic Node visual audit, which will consume the bound thresholds.
  void options;
  const resolvedPieces =
    panel.action.kind === "multi-build-copy"
      ? panel.action.copies.length
      : panel.pieces.length + panel.omittedPieces.length;
  const prerequisites = stepPrerequisiteFacts({
    stepNumber: panel.stepNumber,
    actionKind: panel.action.kind,
    blockingStep: null,
    coverageFailures: panel.coverageFailures,
    unresolvedCallouts: panel.unresolvedCallouts,
    missingDesigns: panel.missingDesigns,
    calloutPieces: panel.calloutPieces,
    expectedAssembledPieces: panel.action.assembledPieces,
    resolvedPieces,
  });
  if (
    JSON.stringify(report.prerequisites) !== JSON.stringify(prerequisites) ||
    prerequisites.localFailure !== null ||
    report.calloutPieces !== panel.calloutPieces ||
    report.attemptedPieces !== resolvedPieces
  ) {
    failures.push(
      completionFailure(
        `Printed step ${panel.stepNumber} browser prerequisites/attempt counts do not reproduce the trusted ` +
          `panel, coverage, identity, and prior-step facts.`,
        panel.stepNumber,
      ),
    );
  }
  const expectedPieces =
    panel.action.kind === "transition"
      ? []
      : panel.action.kind === "multi-build-copy"
        ? panel.action.copies.map((piece) => ({
            catalogPartId: piece.catalogPartId,
            fixedTransform: piece.transform,
          }))
        : [
            ...panel.pieces.map((piece) => ({
              catalogPartId: piece.catalogPartId,
              fixedTransform: null,
            })),
            ...panel.omittedPieces.map((piece) => ({
              catalogPartId: piece.catalogPartId,
              fixedTransform: piece.transform,
            })),
          ];
  if (
    report.pieces.length !== expectedPieces.length ||
    expectedPieces.some((expected, index) => {
      const observed = report.pieces[index];
      return (
        observed === undefined ||
        observed.catalogPartId !== expected.catalogPartId ||
        observed.placed !== true ||
        observed.failure !== null ||
        typeof observed.orientationId !== "string" ||
        observed.positionLdu === null ||
        (expected.fixedTransform !== null &&
          (observed.orientationId !== expected.fixedTransform.orientationId ||
            observed.positionLdu.some(
              (coordinate, axis) => coordinate !== expected.fixedTransform!.positionLdu[axis],
            ))) ||
        !isSha256Digest(observed.blind.comparisonPrefixHash)
      );
    })
  ) {
    failures.push(
      completionFailure(
        `Printed step ${panel.stepNumber} retained piece reports do not match every exact prepared catalog part, ` +
          `fixed-ledger transform, successful searched transform, and comparison-prefix hash.`,
        panel.stepNumber,
      ),
    );
  }
  if (report.farther?.decision !== null && report.farther?.decision !== undefined) {
    const selected = report.farther.origin.candidates.find(
      ({ candidateId }) => candidateId === report.farther!.decision!.originCandidateId,
    );
    if (selected === undefined || report.validation.targetDocumentHash !== selected.documentHash) {
      failures.push(
        completionFailure(
          `Printed step ${panel.stepNumber} farther decision does not bind the selected immutable origin ` +
            `document hash to the Node-reconstructed canonical prefix validation target.`,
          panel.stepNumber,
        ),
      );
    }
  }
  const expectedMechanisms: readonly string[] =
    panel.action.kind === "transition"
      ? ["instruction-transition"]
      : panel.action.kind === "multi-build-copy" || panel.pieces.length === 0
        ? ["official-ledger"]
        : [
            "anchor-orientation",
            "highlight",
            "arrow",
            "exhaustive",
            "deferred-lookahead",
            "exploded-ghost",
          ];
  if (
    report.outcome.status !== "complete" ||
    !expectedMechanisms.includes(report.outcome.mechanism)
  ) {
    failures.push(
      completionFailure(
        `Printed step ${panel.stepNumber} completion mechanism does not match its transition, fixed-ledger, ` +
          `or visual-search action class.`,
        panel.stepNumber,
      ),
    );
  }
  if (panel.action.assembledPieces > 0) {
    failures.push({
      code: "visual-evidence-unverified",
      stage: "evidence",
      stepNumber: panel.stepNumber,
      message:
        `Printed step ${panel.stepNumber} assembles physical pieces, but the Node finalizer cannot ` +
        `independently recompute the PDF crop, lattice fit, camera registration, highlight masks, rendered ` +
        `candidate scores, or decoded PNG pixels from retained raw rasters. Browser-supplied metrics and image ` +
        `headers remain diagnostic only, so completion is unavailable until a deterministic Node visual audit ` +
        `derives panel pixels from the pinned PDF and renders the canonical document.`,
    });
  }
  if (
    !Number.isFinite(report.elapsedMs) ||
    report.elapsedMs < 0 ||
    report.validation.failure !== null
  ) {
    failures.push(
      completionFailure(
        `Printed step ${panel.stepNumber} has malformed elapsed-time or validation-failure evidence.`,
        panel.stepNumber,
      ),
    );
  }
  return failures;
}

function auditReportAndDocument(input: {
  readonly options: RealBuildOptions;
  readonly reports: readonly RealBuildStepReport[];
  readonly document: CanonicalDocumentShape;
  readonly bindings: readonly RealBuildIdentityBinding[];
  readonly structuralHash: string;
}): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  const requestedPanels = input.options.panels
    .filter(({ stepNumber }) => stepNumber <= input.options.lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  if (
    input.reports.length !== requestedPanels.length ||
    input.reports.some(
      (report, index) =>
        report.stepNumber !== requestedPanels[index]?.stepNumber ||
        report.pageNumber !== requestedPanels[index]?.pageNumber,
    )
  ) {
    failures.push(
      completionFailure(
        `Step reports do not align one-for-one and in order with the prepared requested printed-panel prefix ` +
          `1..${input.options.lastStep}.`,
      ),
    );
  }
  const validation = validateBrickDocument(input.document);
  const recomputedHash = documentStructuralHash(input.document);
  const sequence = deriveBuildSequence(input.document);
  if (
    !validation.documentGloballyValid ||
    validation.issues.some(({ severity }) => severity === "blocking") ||
    validation.targetDocumentHash !== recomputedHash ||
    input.structuralHash !== recomputedHash
  ) {
    failures.push(
      completionFailure(
        `Trusted Node kernel validation/hash disagree or reject the canonical document: validator ` +
          `${validation.targetDocumentHash}, structural ${recomputedHash}, supplied audit ${input.structuralHash}, ` +
          `${validation.issues.filter(({ severity }) => severity === "blocking").length} blocking issues.`,
      ),
    );
  }
  if (!sequence.buildable) {
    failures.push(
      completionFailure(
        `Trusted Node build-sequence derivation rejects an earlier prefix at step index ` +
          `${sequence.firstUnbuildableStepIndex ?? "unknown"}; final validity cannot waive prefix validity.`,
      ),
    );
  }
  const uniqueStepIds = new Set(input.document.steps.map(({ id }) => id));
  const uniqueStepIndexes = new Set(input.document.steps.map(({ index }) => index));
  const uniquePartIds = new Set(input.document.parts.map(({ id }) => id));
  if (
    input.document.steps.length !== input.reports.length ||
    uniqueStepIds.size !== input.document.steps.length ||
    uniqueStepIndexes.size !== input.document.steps.length ||
    uniquePartIds.size !== input.document.parts.length
  ) {
    failures.push(
      completionFailure(
        `Canonical document must contain exactly one unique BuildStep per requested report and unique part IDs; ` +
          `received ${input.document.steps.length} steps/${uniqueStepIds.size} IDs/` +
          `${uniqueStepIndexes.size} indexes and ${input.document.parts.length}/${uniquePartIds.size} part IDs.`,
      ),
    );
  }
  let cumulativeParts = 0;
  for (const [index, panel] of requestedPanels.entries()) {
    const report = input.reports[index];
    const canonical = input.document.steps.find(({ index: stepIndex }) => stepIndex === index);
    if (report === undefined || canonical === undefined) continue;
    const prefix = canonicalPrefixDocument(input.document, panel.stepNumber);
    const prefixValidation = validateBrickDocument(prefix);
    failures.push(...auditRealBuildReportEvidence(input.options, panel, report));
    if (!isAtomicStepComplete(report)) {
      failures.push(
        completionFailure(
          `Printed step ${panel.stepNumber} is not atomic-complete.`,
          panel.stepNumber,
        ),
      );
    }
    if (
      report.canonicalStepId !== canonical.id ||
      canonical.index !== panel.stepNumber - 1 ||
      canonical.name !== expectedStepName(panel) ||
      canonical.partIds.length !== panel.action.assembledPieces ||
      report.expectedAssembledPieces !== panel.action.assembledPieces ||
      report.placedPieces !== panel.action.assembledPieces ||
      report.actionEvidenceDigest !== panel.action.evidenceDigest ||
      JSON.stringify(report.action) !== JSON.stringify(panel.action)
    ) {
      failures.push(
        completionFailure(
          `Printed step ${panel.stepNumber} does not match the prepared option/ledger action, semantic ` +
            `BuildStep, evidence digest, exact part count, and canonical ownership. Browser report semantics ` +
            `cannot override the bound option.`,
          panel.stepNumber,
        ),
      );
    }
    cumulativeParts += canonical.partIds.length;
    if (report.documentParts !== cumulativeParts) {
      failures.push(
        completionFailure(
          `Printed step ${panel.stepNumber} reports documentParts=${report.documentParts}, but trusted ` +
            `canonical ownership yields ${cumulativeParts}.`,
          panel.stepNumber,
        ),
      );
    }
    if (
      !report.validation.attempted ||
      !prefixValidation.documentGloballyValid ||
      prefixValidation.issues.some(({ severity }) => severity === "blocking") ||
      report.validation.targetDocumentHash !== prefixValidation.targetDocumentHash ||
      report.validation.targetDocumentHash !== documentStructuralHash(prefix) ||
      report.validation.truthSnapshotHash !== prefixValidation.truthSnapshotHash ||
      report.validation.validatorSetHash !== prefixValidation.validatorSetHash ||
      report.validation.documentGloballyValid !== prefixValidation.documentGloballyValid ||
      JSON.stringify(report.validation.blockingIssues) !==
        JSON.stringify(
          prefixValidation.issues
            .filter(({ severity }) => severity === "blocking")
            .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
        )
    ) {
      failures.push(
        completionFailure(
          `Printed step ${panel.stepNumber} browser validation report does not reproduce the trusted Node ` +
            `kernel's exact independently reconstructed prefix truth/hash tuple. A tandem report/document ` +
            `hash assertion is not authority.`,
          panel.stepNumber,
        ),
      );
    }
  }
  failures.push(...auditRealBuildIdentityBindings(input));
  return failures;
}

interface AuditedCanonicalOutput {
  readonly failures: readonly StepFailure[];
  readonly diagnosticPrefix: RealBuildDiagnosticPrefix | null;
  readonly documentJson: string | null;
  readonly structuralHash: string | null;
  readonly finalParts: number;
}

/** Retains canonical bytes only after every non-visual Node audit has passed. */
function auditCanonicalOutput(
  input: Omit<Parameters<typeof auditReportAndDocument>[0], "structuralHash">,
): AuditedCanonicalOutput {
  const candidateHash = documentStructuralHash(input.document);
  const failures = auditReportAndDocument({ ...input, structuralHash: candidateHash });
  const structurallyTrusted = failures.every(
    ({ code }) =>
      code === "visual-evidence-unverified" || code === "official-frame-calibration-missing",
  );
  const targetTrusted = failures.every(({ code }) => code === "visual-evidence-unverified");
  return {
    failures,
    diagnosticPrefix:
      structurallyTrusted && !targetTrusted
        ? createRealBuildDiagnosticPrefix(input.document)
        : null,
    documentJson: targetTrusted ? canonicalStringify(input.document) : null,
    structuralHash: targetTrusted ? candidateHash : null,
    finalParts: targetTrusted ? input.document.parts.length : 0,
  };
}

function malformedBrowserOutputFailure(message: string): StepFailure {
  return {
    code: "run-incomplete",
    stage: "validation",
    message: `Browser output is hostile or malformed: ${message}`,
  };
}

/** The printed step a retained report index belongs to, or undefined past the requested prefix. */
function requestedPanelStepNumber(options: RealBuildOptions, index: number): number | undefined {
  return options.panels
    .filter(({ stepNumber }) => stepNumber <= options.lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber)[index]?.stepNumber;
}

/**
 * One typed row per requested printed step, whatever the browser managed to say.
 *
 * A row the browser retained and that matches its prepared panel is kept
 * verbatim — the refusal code, its message, the panel face, the highlight's
 * closure and region count, the candidate counts and the placed-against-expected
 * pieces are already in it, and that is what a census reads. A row the browser
 * never produced, or produced in a shape that does not describe the panel it
 * claims, becomes an *unreadable* row built from the trusted panel and naming
 * the defect verbatim. It does not become silence, and it does not take its
 * neighbours with it: erasing forty-nine measured steps because the fiftieth is
 * unreadable is how this loop spent two days answering "what is the next single
 * blocker" instead of "what are all of them".
 */
function retainedStepRows(input: {
  readonly options: RealBuildOptions;
  readonly reports: readonly RealBuildStepReport[];
  readonly reportDefects: readonly (string | null)[];
}): readonly RealBuildStepReport[] {
  const requestedPanels = input.options.panels
    .filter(({ stepNumber }) => stepNumber <= input.options.lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  return requestedPanels.map((panel, index) => {
    const defect =
      index >= input.reports.length
        ? `The browser retained no report for printed step ${panel.stepNumber}; ` +
          `${input.reports.length} of ${requestedPanels.length} requested step(s) reported at all.`
        : input.reportDefects[index];
    if (defect === null || defect === undefined) return input.reports[index]!;
    return unexecutedStepReport(
      panel,
      {
        code: "run-incomplete",
        stage: "validation",
        stepNumber: panel.stepNumber,
        message: `Printed step ${panel.stepNumber} evidence is unreadable and was not trusted: ${defect}`,
      },
      { reason: defect },
    );
  });
}

function deepFreezeDiagnosticValue(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreezeDiagnosticValue(nested, seen);
  Object.freeze(value);
}

function trustFinalizedResult(result: RealBuildResult): RealBuildResult {
  deepFreezeDiagnosticValue(result);
  trustedFinalizedResults.add(result);
  return result;
}

export function finalizeExecutedRealBuildResult(input: {
  readonly options: RealBuildOptions;
  readonly browserOutput: RealBuildBrowserOutput;
}): RealBuildResult {
  let diagnosticPrefix: RealBuildDiagnosticPrefix | null = null;
  let finalParts = 0;
  let structuralHash: string | null = null;
  let documentJson: string | null = null;
  let completionFailures: readonly StepFailure[];
  let optionFailures: readonly StepFailure[];
  try {
    optionFailures = preflightRealBuildOptions(input.options);
  } catch (error) {
    optionFailures = [
      completionFailure(
        `Trusted finalizer cannot parse retained run options: ` +
          `${error instanceof Error ? error.message : String(error)}. Regenerate the run contract; browser ` +
          `output cannot repair or override malformed prepared options.`,
      ),
    ];
  }
  if (optionFailures.length > 0) {
    const completionFailures = optionFailures.map((failure) => ({
      ...failure,
      message: `Trusted finalizer rejected retained run options: ${failure.message}`,
    }));
    return trustFinalizedResult({
      schemaVersion: "lego.real-build-result/5",
      authority: LOCAL_REAL_BUILD_AUTHORITY,
      status: "incomplete",
      requestedLastStep: 0,
      expectedPrintedSteps: FULL_PRINTED_STEPS,
      assembledTargetParts: FULL_ASSEMBLED_PARTS,
      inputDigests: {
        pdf: "invalid",
        calloutManifest: "invalid",
        coverage: "invalid",
        officialModel: "invalid",
        actionLedger: "invalid",
        highlightCalibration: "invalid",
        builderCalibration: "invalid",
        builderGeometry: "invalid",
        transitionClassifications: "invalid",
      },
      inputFailures: [],
      completionFailures,
      steps: [],
      diagnosticPrefix: null,
      documentJson: null,
      structuralHash: null,
      finalParts: 0,
      totalElapsedMs: 0,
    });
  }
  // Read once, then decide separately what each half of the reading means.
  // `envelopeDefect` says these bytes are not a browser output, so nothing in
  // them may be retained. `reproductionDefect` says an executed run did not
  // account for every declared piece — the ordinary state of an unfinished
  // prefix, and a finding rather than a reason to discard the prefix's evidence.
  const reading = readRealBuildBrowserOutput(input.browserOutput, input.options);
  const readable = reading.envelopeDefect === null;
  const retainedRows = readable
    ? retainedStepRows({
        options: input.options,
        reports: input.browserOutput.reports,
        reportDefects: reading.reportDefects,
      })
    : [];
  if (!readable) {
    completionFailures = [malformedBrowserOutputFailure(reading.envelopeDefect!)];
  } else if (input.browserOutput.status === "failed") {
    completionFailures = [input.browserOutput.failure];
  } else if (reading.reproductionDefect !== null) {
    // The run executed and did not account for everything its panels declare.
    // That refuses completion — `prefixPassed` is false below and no status can
    // read as complete — but it is not a reason to drop the rows that say why.
    const reproductionFailures = [
      completionFailure(reading.reproductionDefect),
      ...reading.reportDefects.flatMap((defect, index) =>
        defect === null
          ? []
          : [completionFailure(defect, requestedPanelStepNumber(input.options, index))],
      ),
    ];
    completionFailures = reproductionFailures;
    const completePrefixReports: RealBuildStepReport[] = [];
    for (const [index, report] of retainedRows.entries()) {
      if (reading.reportDefects[index] !== null || !isAtomicStepComplete(report)) break;
      completePrefixReports.push(report);
    }
    if (
      completePrefixReports.length > 0 &&
      input.browserOutput.fetchedPdfDigest === input.options.inputDigests.pdf &&
      typeof input.browserOutput.documentJson === "string"
    ) {
      try {
        const lastCompleteStep = completePrefixReports.at(-1)!.stepNumber;
        const browserDocument = parseCanonicalDocument(input.browserOutput.documentJson);
        const prefixDocument = canonicalPrefixDocument(browserDocument, lastCompleteStep);
        const prefixOptions = { ...input.options, lastStep: lastCompleteStep };
        const prefixBindings = input.browserOutput.identityBindings.filter(
          ({ stepNumber }) => stepNumber <= lastCompleteStep,
        );
        const audited = auditCanonicalOutput({
          options: prefixOptions,
          reports: completePrefixReports,
          document: prefixDocument,
          bindings: prefixBindings,
        });
        ({ diagnosticPrefix, documentJson, structuralHash, finalParts } = audited);
        completionFailures = [...reproductionFailures, ...audited.failures];
      } catch (error) {
        completionFailures = [
          ...reproductionFailures,
          completionFailure(
            `Trusted Node could not independently audit the longest atomic-complete document prefix: ` +
              `${error instanceof Error ? error.message : String(error)}.`,
          ),
        ];
      }
    }
  } else if (input.browserOutput.fetchedPdfDigest !== input.options.inputDigests.pdf) {
    completionFailures = [
      {
        code: "input-digest-mismatch",
        stage: "loading",
        inputKey: "pdf",
        message:
          `Browser executed PDF bytes ${input.browserOutput.fetchedPdfDigest}, but the prepared run contract ` +
          `binds ${input.options.inputDigests.pdf}.`,
      },
    ];
  } else {
    try {
      const document = parseCanonicalDocument(input.browserOutput.documentJson);
      const audited = auditCanonicalOutput({
        options: input.options,
        reports: retainedRows,
        document,
        bindings: input.browserOutput.identityBindings,
      });
      ({ diagnosticPrefix, documentJson, structuralHash, finalParts } = audited);
      completionFailures = audited.failures;
    } catch (error) {
      completionFailures = [
        malformedBrowserOutputFailure(
          `canonical bytes could not be independently parsed by the Node kernel: ` +
            `${error instanceof Error ? error.message : String(error)}.`,
        ),
      ];
    }
  }
  const prefixPassed = completionFailures.length === 0;
  const fullPassed =
    prefixPassed &&
    input.options.lastStep === FULL_PRINTED_STEPS &&
    input.options.expectedPrintedSteps === FULL_PRINTED_STEPS &&
    input.options.targetPartCount === FULL_ASSEMBLED_PARTS &&
    finalParts === FULL_ASSEMBLED_PARTS;
  const requestedFull = input.options.lastStep === FULL_PRINTED_STEPS;
  const status = fullPassed
    ? "completed"
    : requestedFull || !prefixPassed
      ? "incomplete"
      : "prefix-complete";
  const result: RealBuildResult = {
    schemaVersion: "lego.real-build-result/5",
    authority: LOCAL_REAL_BUILD_AUTHORITY,
    status,
    requestedLastStep: input.options.lastStep,
    expectedPrintedSteps: input.options.expectedPrintedSteps,
    assembledTargetParts: input.options.targetPartCount,
    inputDigests: input.options.inputDigests,
    inputFailures: [],
    completionFailures,
    steps: retainedRows,
    diagnosticPrefix,
    documentJson,
    structuralHash,
    finalParts,
    totalElapsedMs: readable ? input.browserOutput.totalElapsedMs : 0,
  };
  return trustFinalizedResult(result);
}

/** Local diagnostic completion is accepted only from this process's Node finalizer, never deserialized browser JSON. */
export function realBuildExecutionFailure(result: RealBuildResult): StepFailure | null {
  if (result.status === "input-rejected") {
    return completionFailure(
      `Real-build execution was rejected with ${result.inputFailures.length} input failure(s); ` +
        `${result.steps.length} refusal rows were retained but no prefix completed.`,
    );
  }
  if (!trustedFinalizedResults.has(result)) {
    return completionFailure(
      "Completed-looking result was not produced by the local Node finalizer in this process. Diagnostic replay must re-run finalization from raw-role-bound prepared inputs; authoritative replay additionally requires an external broker seal.",
    );
  }
  if (!isLocalRealBuildAuthority(result.authority)) {
    return completionFailure(
      "Locally finalized result authority was mutated or is malformed; this repository cannot emit an authenticated or sealed completion.",
    );
  }
  if (result.inputFailures.length > 0 || result.completionFailures.length > 0) {
    return result.inputFailures[0] ?? result.completionFailures[0]!;
  }
  const invalidDigest = Object.entries(result.inputDigests).find(
    ([, value]) => !isSha256Digest(value),
  );
  if (invalidDigest !== undefined) {
    return completionFailure(
      `Trusted result has malformed ${invalidDigest[0]} digest ${invalidDigest[1]}.`,
    );
  }
  if (result.documentJson === null || result.structuralHash === null) {
    return completionFailure("Trusted result lacks canonical document bytes or structural hash.");
  }
  if (result.steps.length !== result.requestedLastStep) {
    return completionFailure(
      `Result retains ${result.steps.length}/${result.requestedLastStep} requested rows.`,
    );
  }
  if (result.requestedLastStep === result.expectedPrintedSteps) {
    if (
      result.requestedLastStep !== FULL_PRINTED_STEPS ||
      result.assembledTargetParts !== FULL_ASSEMBLED_PARTS ||
      result.status !== "completed" ||
      result.finalParts !== FULL_ASSEMBLED_PARTS
    ) {
      return completionFailure(
        `Full run must be completed at printed step ${FULL_PRINTED_STEPS} with ${FULL_ASSEMBLED_PARTS} ` +
          `parts; received ${result.assembledTargetParts}/${result.status}/${result.finalParts}.`,
      );
    }
  } else if (result.status !== "prefix-complete") {
    return completionFailure(
      `Requested prefix ended with status ${result.status}, not prefix-complete.`,
    );
  }
  return null;
}

/** Production authority is unavailable until the released companion broker verifies a signed seal. */
export function authoritativeRealBuildFailure(result: RealBuildResult): StepFailure {
  return {
    code: "replay-closure-invalid",
    stage: "publication",
    message:
      `Real-build result ${result.status} is ${result.authority.kind} evidence with authenticated=` +
      `${result.authority.authenticated}; it has no released companion-broker namespace seal. ` +
      `Local hashes and a retained finalizer cannot authorize production completion.`,
  };
}
