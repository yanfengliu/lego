import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { stepPanelEvidenceDigest } from "./real-build-panel-evidence-digest";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import {
  MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES,
  parseRealBuildPreparedRunInput,
} from "./real-build-prepared-run-input-parser";
import type {
  RealBuildPreparedBrowserOutputBoundaryInspection,
  RealBuildPreparedObservationPolicyInspection,
  RealBuildPreparedPanelInspection,
  RealBuildPreparedRunInputInspection,
  RealBuildPreparedStepAuthority,
  RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority-types";

export type {
  RealBuildPreparedAtomicPiece,
  RealBuildPreparedBrowserOutputBoundaryInspection,
  RealBuildPreparedObservationPolicyInspection,
  RealBuildPreparedPanelBoundsInspection,
  RealBuildPreparedPanelInspection,
  RealBuildPreparedRunInputInspection,
  RealBuildPreparedStepAuthority,
  RealBuildPreparedStepCompilerMetadata,
  RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority-types";

export { MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES };
export const MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES = 1_024;

const preparedSteps = new WeakSet<object>();
const inspections = new WeakSet<object>();
const observationPolicies = new WeakSet<object>();
const panelInspections = new WeakSet<object>();
const browserOutputBoundaryInspections = new WeakSet<object>();
const preparedRunInspections = new WeakMap<
  object,
  { readonly options: RealBuildOptions; readonly canonical: string }
>();

function requirePreparedPanel(panel: RealBuildPanelSpec, stepNumber: number): void {
  if (panel.action.kind !== "place-callouts") {
    throw new TypeError(
      `Prepared step ${stepNumber} uses ${panel.action.kind}; this authority currently admits only exact place-callouts steps.`,
    );
  }
  if (panel.panelFace === null) {
    throw new TypeError(
      `Prepared step ${stepNumber} has no booklet-derived panel face; placement search remains refused.`,
    );
  }
  if (
    panel.action.evidenceDigest === null ||
    !/^sha256:[0-9a-f]{64}$/u.test(panel.action.evidenceDigest)
  ) {
    throw new TypeError(
      `Prepared step ${stepNumber} requires one exact action evidence digest before compiler metadata can be derived.`,
    );
  }
  if (panel.pieces.length < 1 || panel.pieces.length > MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES) {
    throw new RangeError(
      `Prepared step ${stepNumber} declares ${panel.pieces.length} direct pieces; required 1 through ${MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES}.`,
    );
  }
  if (panel.omittedPieces.length !== 0 || panel.omittedPhysicalPieces !== 0) {
    throw new TypeError(
      `Prepared step ${stepNumber} includes omitted physical pieces; this search authority cannot silently reinterpret fixed-ledger placements as searched pieces.`,
    );
  }
  if (
    panel.coverageFailures.length !== 0 ||
    panel.missingDesigns.length !== 0 ||
    panel.unresolvedCallouts.length !== 0
  ) {
    throw new TypeError(
      `Prepared step ${stepNumber} retains unresolved coverage, catalog, or callout prerequisites; placement search remains refused.`,
    );
  }
}

/**
 * Inspects how a complete run input would bind one step. Successful authority
 * issuance intentionally has no public producer until PDF/action-ledger
 * preparation itself is nonforgeable; caller bytes cannot certify themselves.
 */
export function inspectRealBuildPreparedRunInput(
  preparedRunInputBytes: unknown,
): RealBuildPreparedRunInputInspection {
  const prepared = parseRealBuildPreparedRunInput(preparedRunInputBytes);
  const inspection = Object.freeze({
    preparedRunInputDigest: canonicalDigest({
      schemaVersion: "lego.real-build-prepared-run-input/1",
      canonicalRunInput: prepared.canonical,
    }),
    lastStep: prepared.options.lastStep,
    authority: "absent" as const,
  });
  preparedRunInspections.set(inspection, prepared);
  return inspection;
}

function requirePreparedRunInputInspection(
  value: unknown,
): readonly [RealBuildPreparedRunInputInspection, RealBuildOptions] {
  if (value === null || typeof value !== "object") {
    throw new TypeError(
      "Prepared run input inspection must be the exact result of one bounded byte parse.",
    );
  }
  const prepared = preparedRunInspections.get(value);
  if (prepared === undefined) {
    throw new TypeError(
      "Prepared run input inspection must be the exact result of one bounded byte parse.",
    );
  }
  return [value as RealBuildPreparedRunInputInspection, prepared.options];
}

export function inspectRealBuildPreparedStepFromRunInput(
  preparedRunInputInspection: unknown,
  stepNumber: unknown,
): RealBuildPreparedStepInspection {
  const validatedStepNumber = requirePreparedStepNumber(stepNumber);
  const [preparedRun, options] = requirePreparedRunInputInspection(preparedRunInputInspection);
  if (validatedStepNumber > options.lastStep) {
    throw new RangeError(
      `Prepared step ${String(validatedStepNumber)} lies beyond requested lastStep ${options.lastStep}.`,
    );
  }
  const panel = options.panels.find(
    ({ stepNumber: candidate }) => candidate === validatedStepNumber,
  );
  if (panel === undefined) {
    throw new TypeError(
      `Prepared run input has no exact panel for printed step ${String(validatedStepNumber)}.`,
    );
  }
  requirePreparedPanel(panel, validatedStepNumber);
  const preparedRunInputDigest = preparedRun.preparedRunInputDigest;
  const printedStepIdentity = canonicalDigest({
    schemaVersion: "lego.real-build-prepared-step/1",
    preparedRunInputDigest,
    panel,
  });
  const expectedAtomicPieces = Object.freeze(
    panel.pieces.map(({ identityKey, catalogPartId, colorId }) =>
      Object.freeze({ identityKey, catalogPartId, colorId }),
    ),
  );
  const compilerMetadata = Object.freeze({
    name: `Printed step ${String(validatedStepNumber)}`,
    sourceActionDigest: panel.action.evidenceDigest as Sha256Digest,
  });
  const inspection = Object.freeze({
    stepNumber: validatedStepNumber,
    preparedRunInputDigest,
    printedStepIdentity,
    compilerMetadata,
    expectedAtomicPieces,
    authority: "absent",
  });
  inspections.add(inspection);
  return inspection;
}

function optionalDigest(value: string | null): Sha256Digest | null {
  return value === null ? null : (value as Sha256Digest);
}

/**
 * Reads one panel from the exact already-parsed run input without granting placement,
 * source, camera, or completion authority. This works for placement and zero-piece
 * transition panels; placementPrintedStepIdentity is present only when the existing
 * prepared-step boundary would admit that panel for inspection.
 */
export function inspectRealBuildPreparedPanelFromRunInput(
  preparedRunInputInspection: unknown,
  stepNumber: unknown,
): RealBuildPreparedPanelInspection {
  const validatedStepNumber = requirePreparedStepNumber(stepNumber);
  const [preparedRun, options] = requirePreparedRunInputInspection(preparedRunInputInspection);
  if (validatedStepNumber > options.lastStep) {
    throw new RangeError(
      `Prepared panel ${String(validatedStepNumber)} lies beyond requested lastStep ${options.lastStep}.`,
    );
  }
  const panel = options.panels.find(
    ({ stepNumber: candidate }) => candidate === validatedStepNumber,
  );
  if (panel === undefined) {
    throw new TypeError(
      `Prepared run input has no exact panel for printed step ${String(validatedStepNumber)}.`,
    );
  }
  const bounds = intrinsicRealBuildFreeze({
    minXPt: panel.minXPt,
    maxXPt: panel.maxXPt,
    minYPt: panel.minYPt,
    maxYPt: panel.maxYPt,
  });
  const calloutBoxes = intrinsicRealBuildFreeze(
    panel.calloutBoxes.map((box) =>
      intrinsicRealBuildFreeze({
        minXPt: box.minXPt,
        maxXPt: box.maxXPt,
        minYPt: box.minYPt,
        maxYPt: box.maxYPt,
      }),
    ),
  );
  const expectedAtomicPieces = intrinsicRealBuildFreeze(
    panel.pieces.map(({ identityKey, catalogPartId, colorId }) =>
      intrinsicRealBuildFreeze({ identityKey, catalogPartId, colorId }),
    ),
  );
  const prerequisiteFailureCounts = intrinsicRealBuildFreeze({
    coverageFailures: panel.coverageFailures.length,
    unresolvedCallouts: panel.unresolvedCallouts.length,
    missingDesigns: panel.missingDesigns.length,
  });
  const preparedRunInputDigest = preparedRun.preparedRunInputDigest;
  const pdfDigest = options.inputDigests.pdf as Sha256Digest;
  const panelEvidenceDigest = stepPanelEvidenceDigest({
    pdfDigest,
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    bounds,
    calloutBoxes,
  }) as Sha256Digest;
  const cropDigest = canonicalDigest(bounds);
  const actionCanonicalJson = canonicalStringify(panel.action);
  let placementPrintedStepIdentity: Sha256Digest | null = null;
  if (panel.action.kind === "place-callouts") {
    try {
      requirePreparedPanel(panel, validatedStepNumber);
      placementPrintedStepIdentity = canonicalDigest({
        schemaVersion: "lego.real-build-prepared-step/1",
        preparedRunInputDigest,
        panel,
      });
    } catch {
      // The panel remains inspectable, but cannot masquerade as a placement-ready step.
    }
  }
  const inspection = intrinsicRealBuildFreeze({
    stepNumber: validatedStepNumber,
    preparedRunInputDigest,
    preparedPanelIdentity: canonicalDigest({
      schemaVersion: "lego.real-build-prepared-panel/1",
      preparedRunInputDigest,
      panel,
    }),
    placementPrintedStepIdentity,
    pdfDigest,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    bounds,
    calloutBoxes,
    panelEvidenceDigest,
    cropDigest,
    actionKind: panel.action.kind,
    assembledPieces: panel.action.assembledPieces,
    actionEvidenceDigest: optionalDigest(panel.action.evidenceDigest),
    actionCanonicalJson,
    actionDigest: canonicalDigest({
      schemaVersion: "lego.real-build-prepared-panel-action/1",
      action: panel.action,
    }),
    expectedAtomicPieces,
    prerequisiteFailureCounts,
    authority: "absent" as const,
  });
  panelInspections.add(inspection);
  return inspection;
}

export function requireRealBuildPreparedPanelInspection(
  value: unknown,
): RealBuildPreparedPanelInspection {
  if (value === null || typeof value !== "object" || !panelInspections.has(value)) {
    throw new TypeError(
      "Prepared panel inspection must be the exact authority-free result of one retained run-input lookup.",
    );
  }
  return value as RealBuildPreparedPanelInspection;
}

/** Refuses replay of a panel whose exact prepared input still names unresolved prerequisites. */
export function requireRealBuildPreparedPanelResolvedPrerequisites(
  value: unknown,
): RealBuildPreparedPanelInspection {
  const panel = requireRealBuildPreparedPanelInspection(value);
  const counts = panel.prerequisiteFailureCounts;
  if (
    counts.coverageFailures !== 0 ||
    counts.unresolvedCallouts !== 0 ||
    counts.missingDesigns !== 0
  ) {
    throw new TypeError(
      `Prepared panel ${panel.stepNumber} retains ${counts.coverageFailures} coverage failure(s), ${counts.unresolvedCallouts} unresolved callout(s), and ${counts.missingDesigns} missing design(s); browser-output /4 cannot erase or advance unresolved prepared prerequisites.`,
    );
  }
  return panel;
}

function requirePreparedStepNumber(stepNumber: unknown): number {
  if (
    !Number.isSafeInteger(stepNumber) ||
    (stepNumber as number) < 1 ||
    (stepNumber as number) > 359
  ) {
    throw new RangeError("Prepared step number must be a safe integer from 1 through 359.");
  }
  return stepNumber as number;
}

export function inspectRealBuildPreparedStepInput(
  preparedRunInputBytes: unknown,
  stepNumber: unknown,
): RealBuildPreparedStepInspection {
  requirePreparedStepNumber(stepNumber);
  return inspectRealBuildPreparedStepFromRunInput(
    inspectRealBuildPreparedRunInput(preparedRunInputBytes),
    stepNumber,
  );
}

/** Bounded inspection of the exact thresholds committed by prepared run input bytes. */
export function inspectRealBuildPreparedObservationPolicy(
  preparedRunInputBytes: unknown,
): RealBuildPreparedObservationPolicyInspection {
  return inspectRealBuildPreparedObservationPolicyFromRunInput(
    inspectRealBuildPreparedRunInput(preparedRunInputBytes),
  );
}

export function inspectRealBuildPreparedObservationPolicyFromRunInput(
  preparedRunInputInspection: unknown,
): RealBuildPreparedObservationPolicyInspection {
  const [preparedRun, options] = requirePreparedRunInputInspection(preparedRunInputInspection);
  if (
    !Number.isFinite(options.minimumDeferredAgreement) ||
    options.minimumDeferredAgreement <= 0 ||
    options.minimumDeferredAgreement > 1 ||
    !Number.isFinite(options.minimumDeferredAgreementMargin) ||
    options.minimumDeferredAgreementMargin < 0 ||
    options.minimumDeferredAgreementMargin > 1
  ) {
    throw new RangeError(
      "Prepared observation policy requires finite unit-interval minimumDeferredAgreement and minimumDeferredAgreementMargin values.",
    );
  }
  const inspection = Object.freeze({
    preparedRunInputDigest: preparedRun.preparedRunInputDigest,
    minimumScore: options.minimumDeferredAgreement,
    minimumMargin: options.minimumDeferredAgreementMargin,
    authority: "absent" as const,
  });
  observationPolicies.add(inspection);
  return inspection;
}

/**
 * Projects only the detached fields consumed by complete report-shape validation.
 * The parsed run graph is already deep-frozen; this projection grants no execution,
 * placement, source, camera, acceptance, or completion authority.
 */
export function inspectRealBuildPreparedBrowserOutputBoundaryFromRunInput(
  preparedRunInputInspection: unknown,
): RealBuildPreparedBrowserOutputBoundaryInspection {
  const [preparedRun, options] = requirePreparedRunInputInspection(preparedRunInputInspection);
  const inspection = intrinsicRealBuildFreeze({
    preparedRunInputDigest: preparedRun.preparedRunInputDigest,
    lastStep: options.lastStep,
    maxParts: options.maxParts,
    inputDigests: options.inputDigests,
    panels: options.panels,
    blindRenderBudget: options.blindRenderBudget,
    explodedGhostRenderBudget: options.explodedGhostRenderBudget,
    deferredCandidateBudget: options.deferredCandidateBudget,
    deferredNarrowingRenderBudget: options.deferredNarrowingRenderBudget,
    fartherPanelMaximumReachSteps: options.fartherPanelMaximumReachSteps,
    fartherPanelRenderBudget: options.fartherPanelRenderBudget,
    minimumDeferredAgreement: options.minimumDeferredAgreement,
    minimumDeferredAgreementMargin: options.minimumDeferredAgreementMargin,
    renderScale: options.renderScale,
    panelWidth: options.panelWidth,
    workFactor: options.workFactor,
    measuredFartherOriginSourceAttestation: options.measuredFartherOriginSourceAttestation,
    panelCameraBranchBudget: options.panelCameraBranchBudget,
    authority: "absent" as const,
  });
  browserOutputBoundaryInspections.add(inspection);
  return inspection;
}

export function requireRealBuildPreparedBrowserOutputBoundaryInspection(
  value: unknown,
): RealBuildPreparedBrowserOutputBoundaryInspection {
  if (value === null || typeof value !== "object" || !browserOutputBoundaryInspections.has(value)) {
    throw new TypeError(
      "Prepared browser-output boundary must be the exact authority-free projection of one retained run-input parse.",
    );
  }
  return value as RealBuildPreparedBrowserOutputBoundaryInspection;
}

export function requireRealBuildPreparedObservationPolicyInspection(
  value: unknown,
): RealBuildPreparedObservationPolicyInspection {
  if (value === null || typeof value !== "object" || !observationPolicies.has(value)) {
    throw new TypeError(
      "Prepared observation policy must be the exact non-authoritative result of bounded run-input inspection.",
    );
  }
  return value as RealBuildPreparedObservationPolicyInspection;
}

/**
 * Retains the prepared-run binding while making a multi-shard observation policy
 * deliberately incapable of selecting within any shard that has a runner-up.
 */
export function deferRealBuildPreparedObservationPolicyForGlobalAggregation(
  value: unknown,
): RealBuildPreparedObservationPolicyInspection {
  const policy = requireRealBuildPreparedObservationPolicyInspection(value);
  const deferred = Object.freeze({
    preparedRunInputDigest: policy.preparedRunInputDigest,
    minimumScore: 1,
    minimumMargin: 1,
    authority: "absent" as const,
  });
  observationPolicies.add(deferred);
  return deferred;
}

export function requireRealBuildPreparedStepInspection(
  value: unknown,
): RealBuildPreparedStepInspection {
  if (value === null || typeof value !== "object" || !inspections.has(value)) {
    throw new TypeError(
      "Prepared step inspection must be the exact non-authoritative result of bounded run-input inspection.",
    );
  }
  return value as RealBuildPreparedStepInspection;
}

export function requireRealBuildPreparedStepAuthority(
  value: unknown,
  stepNumber?: number,
): RealBuildPreparedStepAuthority {
  if (
    value === null ||
    typeof value !== "object" ||
    !preparedSteps.has(value) ||
    (stepNumber !== undefined &&
      (value as RealBuildPreparedStepAuthority).stepNumber !== stepNumber)
  ) {
    throw new TypeError(
      "Prepared step authority must be the exact private result of bounded run-input preflight.",
    );
  }
  return value as RealBuildPreparedStepAuthority;
}
