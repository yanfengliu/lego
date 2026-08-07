import {
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
import { preflightRealBuildOptions } from "./real-build-contract";
import {
  isRealBuildBrowserOutput,
  type RealBuildBrowserOutput,
  type RealBuildIdentityBinding,
} from "./real-build-browser-output";

type CanonicalDocumentShape = BrickDocumentV1;
type CanonicalPartShape = BrickDocumentV1["parts"][number];

interface ExpectedIdentity {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: CanonicalPartShape["transform"];
}

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

const exactTransform = (
  actual: CanonicalPartShape["transform"],
  expected: CanonicalPartShape["transform"],
): boolean =>
  actual.orientationId === expected.orientationId &&
  actual.positionLdu.length === 3 &&
  actual.positionLdu.every((coordinate, axis) => coordinate === expected.positionLdu[axis]);

function expectedIdentities(options: RealBuildOptions): readonly ExpectedIdentity[] {
  return options.panels
    .filter(({ stepNumber }) => stepNumber <= options.lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .flatMap((panel): readonly ExpectedIdentity[] => {
      if (panel.action.kind === "transition") return [];
      if (panel.action.kind === "multi-build-copy") {
        return panel.action.copies.map((piece) => ({
          identityKey: piece.identityKey,
          stepNumber: panel.stepNumber,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          transform: piece.transform,
        }));
      }
      return [
        ...panel.pieces.map((piece) => ({
          identityKey: piece.identityKey,
          stepNumber: panel.stepNumber,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          transform: piece.expectedTransform,
        })),
        ...panel.omittedPieces.map((piece) => ({
          identityKey: piece.identityKey,
          stepNumber: panel.stepNumber,
          designId: piece.designId,
          materialId: piece.materialId,
          catalogPartId: piece.catalogPartId,
          colorId: piece.colorId,
          transform: piece.transform,
        })),
      ];
    });
}

function auditIdentityBindings(input: {
  readonly options: RealBuildOptions;
  readonly document: CanonicalDocumentShape;
  readonly reports: readonly RealBuildStepReport[];
  readonly bindings: readonly RealBuildIdentityBinding[];
}): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  const expected = expectedIdentities(input.options);
  const expectedByIdentity = new Map(expected.map((identity) => [identity.identityKey, identity]));
  const bindingByIdentity = new Map(
    input.bindings.map((binding) => [binding.identityKey, binding]),
  );
  const uniquePartBindings = new Set(input.bindings.map(({ partId }) => partId));
  if (
    expectedByIdentity.size !== expected.length ||
    bindingByIdentity.size !== input.bindings.length ||
    uniquePartBindings.size !== input.bindings.length ||
    input.bindings.length !== expected.length
  ) {
    failures.push(
      completionFailure(
        `Trusted ledger expects ${expected.length}/${expectedByIdentity.size} unique identities, while browser ` +
          `output binds ${input.bindings.length}/${bindingByIdentity.size} identities to ` +
          `${uniquePartBindings.size} unique canonical parts.`,
      ),
    );
  }
  const partById = new Map(input.document.parts.map((part) => [part.id, part]));
  const stepIdByNumber = new Map(
    input.document.steps.map((step) => [step.index + 1, step.id] as const),
  );
  for (const identity of expected) {
    const binding = bindingByIdentity.get(identity.identityKey);
    const part = binding === undefined ? undefined : partById.get(binding.partId);
    const expectedStepId = stepIdByNumber.get(identity.stepNumber);
    if (
      binding === undefined ||
      binding.stepNumber !== identity.stepNumber ||
      binding.designId !== identity.designId ||
      binding.materialId !== identity.materialId ||
      binding.catalogPartId !== identity.catalogPartId ||
      binding.colorId !== identity.colorId ||
      part === undefined ||
      part.stepId !== expectedStepId ||
      part.catalogPartId !== identity.catalogPartId ||
      part.colorId !== identity.colorId ||
      !exactTransform(part.transform, identity.transform)
    ) {
      failures.push(
        completionFailure(
          `Identity ${identity.identityKey} at printed step ${identity.stepNumber} does not resolve to one ` +
            `canonical part with exact official-ledger design/material/catalog/color/transform/step ownership. ` +
            `Expected ${identity.designId}/${identity.materialId}/${identity.catalogPartId}/${identity.colorId}/` +
            `${JSON.stringify(identity.transform)}; binding ${JSON.stringify(binding ?? null)}; part ` +
            `${JSON.stringify(part ?? null)}.`,
          identity.stepNumber,
        ),
      );
    }
  }
  const expectedPartIdsByStep = new Map<number, string[]>();
  for (const binding of input.bindings) {
    const ids = expectedPartIdsByStep.get(binding.stepNumber) ?? [];
    ids.push(binding.partId);
    expectedPartIdsByStep.set(binding.stepNumber, ids);
  }
  for (const report of input.reports) {
    const step = input.document.steps.find(({ index }) => index === report.stepNumber - 1);
    const expectedPartIds = (expectedPartIdsByStep.get(report.stepNumber) ?? []).sort();
    const actualPartIds = [...(step?.partIds ?? [])].sort();
    if (
      expectedPartIds.length !== actualPartIds.length ||
      expectedPartIds.some((partId, index) => partId !== actualPartIds[index])
    ) {
      failures.push(
        completionFailure(
          `Canonical step ${report.stepNumber} part ownership does not equal its exact ledger identity binding.`,
          report.stepNumber,
        ),
      );
    }
  }
  return failures;
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
            transform: piece.transform,
          }))
        : [
            ...panel.pieces.map((piece) => ({
              catalogPartId: piece.catalogPartId,
              transform: piece.expectedTransform,
            })),
            ...panel.omittedPieces.map((piece) => ({
              catalogPartId: piece.catalogPartId,
              transform: piece.transform,
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
        observed.orientationId !== expected.transform.orientationId ||
        observed.positionLdu === null ||
        observed.positionLdu.some(
          (coordinate, axis) => coordinate !== expected.transform.positionLdu[axis],
        ) ||
        !isSha256Digest(observed.blind.comparisonPrefixHash)
      );
    })
  ) {
    failures.push(
      completionFailure(
        `Printed step ${panel.stepNumber} retained piece reports do not match every exact ledger catalog part, ` +
          `fixed/selected transform, successful placement, and comparison-prefix hash.`,
        panel.stepNumber,
      ),
    );
  }
  const expectedMechanisms: readonly string[] =
    panel.action.kind === "transition"
      ? ["instruction-transition"]
      : panel.action.kind === "multi-build-copy" || panel.pieces.length === 0
        ? ["official-ledger"]
        : ["anchor-orientation", "highlight", "arrow", "exhaustive", "deferred-lookahead"];
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
  failures.push(...auditIdentityBindings(input));
  return failures;
}

function malformedBrowserOutputFailure(message: string): StepFailure {
  return {
    code: "run-incomplete",
    stage: "validation",
    message: `Browser output is hostile or malformed: ${message}`,
  };
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
      schemaVersion: "lego.real-build-result/3",
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
      documentJson: null,
      structuralHash: null,
      finalParts: 0,
      totalElapsedMs: 0,
    });
  }
  if (!isRealBuildBrowserOutput(input.browserOutput, input.options)) {
    completionFailures = [
      malformedBrowserOutputFailure("schema, reports, or identity bindings are invalid."),
    ];
  } else if (input.browserOutput.status === "failed") {
    documentJson = input.browserOutput.documentJson;
    completionFailures = [input.browserOutput.failure];
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
    documentJson = input.browserOutput.documentJson;
    try {
      const document = parseCanonicalDocument(input.browserOutput.documentJson);
      structuralHash = documentStructuralHash(document);
      finalParts = document.parts.length;
      completionFailures = auditReportAndDocument({
        options: input.options,
        reports: input.browserOutput.reports,
        document,
        bindings: input.browserOutput.identityBindings,
        structuralHash,
      });
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
    schemaVersion: "lego.real-build-result/3",
    authority: LOCAL_REAL_BUILD_AUTHORITY,
    status,
    requestedLastStep: input.options.lastStep,
    expectedPrintedSteps: input.options.expectedPrintedSteps,
    assembledTargetParts: input.options.targetPartCount,
    inputDigests: input.options.inputDigests,
    inputFailures: [],
    completionFailures,
    steps: isRealBuildBrowserOutput(input.browserOutput, input.options)
      ? input.browserOutput.reports
      : [],
    documentJson,
    structuralHash,
    finalParts,
    totalElapsedMs: isRealBuildBrowserOutput(input.browserOutput, input.options)
      ? input.browserOutput.totalElapsedMs
      : 0,
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
