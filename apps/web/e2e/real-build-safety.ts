import type { CoverageInputBindings, StepCoverageCalloutClaim } from "./real-build-coverage";
import type { TrustedIdentificationConfidence } from "./real-build-identification-trust";

export {
  bindCalloutsToBookletPanels,
  CoverageContractError,
  coverageCalloutKey,
  isV5ManifestCallout,
  reconcileStepCoverage,
  requireCoverageCallout,
  requireCoverageIndex,
  resolveCoverageCallout,
} from "./real-build-coverage";
export type {
  CoverageCalloutClaim,
  CoverageContractFailureCode,
  CoverageInputBindings,
  StepCoverageCalloutClaim,
  V5ManifestCallout,
} from "./real-build-coverage";

export type SuccessfulStepMechanism =
  | "anchor-orientation"
  | "highlight"
  | "arrow"
  | "exhaustive"
  | "instruction-transition"
  | "official-ledger";

export type StepFailureStage =
  | "coverage"
  | "callout-resolution"
  | "catalog"
  | "budget"
  | "camera-fit"
  | "evidence"
  | "camera-registration"
  | "placement"
  | "benchmark"
  | "validation"
  | "rendering"
  | "atomicity"
  | "causality"
  | "loading"
  | "replay"
  | "publication"
  | "input";

export type StepFailureCode =
  | "coverage-key-mismatch"
  | "unresolved-callout"
  | "missing-catalog-part"
  | "camera-fit-failed"
  | "no-placement-signal"
  | "camera-anchor-failed"
  | "no-placement-candidate"
  | "resource-budget-exhausted"
  | "placement-error"
  | "incomplete-placement-scoring"
  | "zero-placement-score"
  | "tied-placement-score"
  | "ambiguous-placement-score"
  | "benchmark-prefix-mismatch"
  | "hard-validation-failed"
  | "hard-validation-error"
  | "rendering-error"
  | "piece-placement-failed"
  | "atomic-step-rollback"
  | "blocked-by-prior-step"
  | "set-accounting-mismatch"
  | "printed-step-sequence-invalid"
  | "untrusted-identification"
  | "input-digest-mismatch"
  | "unsupported-instruction-action"
  | "whole-step-score-too-low"
  | "visual-evidence-unverified"
  | "highlight-reuse-unexplained"
  | "benchmark-policy-mismatch"
  | "benchmark-disagreement"
  | "action-ledger-incomplete"
  | "omitted-piece-identity-missing"
  | "multi-build-source-invalid"
  | "transition-evidence-missing"
  | "highlight-calibration-missing"
  | "builder-calibration-invalid"
  | "official-frame-calibration-missing"
  | "official-transform-unrepresentable"
  | "official-model-accounting-mismatch"
  | "transition-classification-unverified"
  | "dynamic-import-failed"
  | "pdf-fetch-failed"
  | "pdf-load-failed"
  | "source-drift-detected"
  | "replay-closure-invalid"
  | "path-policy-violation"
  | "artifact-publish-failed"
  | "run-incomplete";

export interface StepFailure {
  readonly code: StepFailureCode;
  readonly stage: StepFailureStage;
  readonly message: string;
  readonly causedByStep?: number;
  readonly pieceIndex?: number;
  readonly catalogPartId?: string;
  readonly inputKey?: string;
  readonly stepNumber?: number;
}

export type StepOutcome =
  | {
      readonly status: "complete";
      readonly mechanism: SuccessfulStepMechanism;
      readonly failure: null;
    }
  | {
      readonly status: "failed";
      readonly mechanism: "deferred" | "blocked";
      readonly attemptedMechanism: SuccessfulStepMechanism | null;
      readonly failure: StepFailure;
    };

export interface StepPrerequisiteInput {
  readonly stepNumber: number;
  readonly actionKind?: RealBuildStepAction["kind"];
  readonly blockingStep: number | null;
  readonly coverageFailures: readonly StepFailure[];
  readonly unresolvedCallouts: readonly string[];
  readonly missingDesigns: readonly string[];
  readonly calloutPieces: number;
  readonly expectedAssembledPieces?: number;
  readonly resolvedPieces: number;
}

export interface StepPrerequisiteFacts {
  readonly blockingStep: number | null;
  readonly coverageFailures: readonly StepFailure[];
  readonly unresolvedCallouts: readonly string[];
  readonly missingDesigns: readonly string[];
  readonly calloutPieces: number;
  readonly expectedAssembledPieces: number;
  readonly resolvedPieces: number;
  /** Local evidence is retained even when an earlier failure blocks execution. */
  readonly localFailure: StepFailure | null;
}

function localPrerequisiteFailure(input: StepPrerequisiteInput): StepFailure | null {
  const expectedAssembledPieces = input.expectedAssembledPieces ?? input.calloutPieces;
  if (input.coverageFailures.length > 0) return input.coverageFailures[0]!;
  if (input.unresolvedCallouts.length > 0) {
    return {
      code: "unresolved-callout",
      stage: "callout-resolution",
      message:
        `Step ${input.stepNumber} has unresolved callout evidence: ` +
        `${input.unresolvedCallouts.join(", ")}. No catalog lookup or placement was attempted because an ` +
        `unidentified drawing is not evidence for a specific part.`,
    };
  }
  if (input.missingDesigns.length > 0) {
    return {
      code: "missing-catalog-part",
      stage: "catalog",
      message:
        `Step ${input.stepNumber} places ${input.calloutPieces} piece(s), but the catalog has no part for ` +
        `${input.missingDesigns.join(", ")}. Nothing was placed or substituted; a different shape would make ` +
        `the reconstruction structurally false.`,
    };
  }
  if (input.resolvedPieces === 0 && input.actionKind === "transition") return null;
  if (input.resolvedPieces === 0) {
    return {
      code: "unresolved-callout",
      stage: "callout-resolution",
      message:
        `Step ${input.stepNumber} has unresolved callout evidence: no printed callout was resolved. No catalog ` +
        `lookup or placement was attempted because an unidentified drawing is not evidence for a specific part.`,
    };
  }
  if (input.resolvedPieces !== expectedAssembledPieces) {
    return {
      code: "unresolved-callout",
      stage: "callout-resolution",
      message:
        `Step ${input.stepNumber} requires ${expectedAssembledPieces} assembled piece(s) after semantic and ` +
        `omitted-piece classification, but only ${input.resolvedPieces} were resolved to catalog parts. A ` +
        `partial callout cannot pass as a complete printed step.`,
    };
  }
  return null;
}

export function stepPrerequisiteFacts(input: StepPrerequisiteInput): StepPrerequisiteFacts {
  return {
    blockingStep: input.blockingStep,
    coverageFailures: input.coverageFailures,
    unresolvedCallouts: input.unresolvedCallouts,
    missingDesigns: input.missingDesigns,
    calloutPieces: input.calloutPieces,
    expectedAssembledPieces: input.expectedAssembledPieces ?? input.calloutPieces,
    resolvedPieces: input.resolvedPieces,
    localFailure: localPrerequisiteFailure(input),
  };
}

export function stepPrerequisiteFailure(
  input: StepPrerequisiteInput,
): Extract<StepOutcome, { status: "failed" }> | null {
  const facts = stepPrerequisiteFacts(input);
  if (input.blockingStep !== null) {
    return {
      status: "failed",
      mechanism: "blocked",
      attemptedMechanism: null,
      failure: {
        code: "blocked-by-prior-step",
        stage: "causality",
        causedByStep: input.blockingStep,
        message:
          `Step ${input.stepNumber} was not attempted because step ${input.blockingStep} failed. The canonical ` +
          `document still represents the base of step ${input.blockingStep}; attempting a later printed step ` +
          `against it would measure a different build history.` +
          (facts.localFailure === null
            ? " Its own callout and catalog prerequisites are locally satisfied."
            : ` Its own local prerequisite also fails with ${facts.localFailure.code}: ${facts.localFailure.message}`),
      },
    };
  }
  if (facts.localFailure !== null) {
    return {
      status: "failed",
      mechanism: facts.localFailure.stage === "catalog" ? "blocked" : "deferred",
      attemptedMechanism: null,
      failure: facts.localFailure,
    };
  }
  return null;
}

export interface PlacementSignalInput {
  readonly stepNumber: number;
  readonly hasHighlight: boolean;
  readonly detectedArrowCount: number;
  readonly usableArrowPlacementCount: number;
  readonly independentPlacementSignalCount: number;
}

/** A detected arrow counts only after a strategy turns it into candidate constraints. */
export function placementSignalFailure(input: PlacementSignalInput): StepFailure | null {
  if (
    input.hasHighlight ||
    input.usableArrowPlacementCount > 0 ||
    input.independentPlacementSignalCount > 0
  ) {
    return null;
  }
  return {
    code: "no-placement-signal",
    stage: "evidence",
    message:
      `Step ${input.stepNumber} has no enclosed highlight, no usable arrow placement, and no independent ` +
      `placement signal. ${input.detectedArrowCount} arrow drawing(s) were detected, but detections that have ` +
      `not been converted into candidate constraints cannot justify choosing the first enumerated placement.`,
  };
}

export interface AtomicStepInput<T> {
  readonly stepNumber: number;
  readonly baseDocument: T;
  readonly candidateDocument: T;
  readonly expectedPieces: number;
  readonly candidatePieces: number;
  readonly attemptedMechanism: SuccessfulStepMechanism;
  readonly firstPieceFailure: StepFailure | null;
  readonly hardValidationPassed: boolean;
}

export interface AtomicStepDecision<T> {
  readonly document: T;
  readonly acceptedPieces: number;
  readonly outcome: StepOutcome;
}

/** Commits all pieces in a printed step, or keeps the exact step base. */
export function settleAtomicStep<T>(input: AtomicStepInput<T>): AtomicStepDecision<T> {
  if (
    input.firstPieceFailure === null &&
    input.hardValidationPassed &&
    input.expectedPieces > 0 &&
    input.candidatePieces === input.expectedPieces
  ) {
    return {
      document: input.candidateDocument,
      acceptedPieces: input.candidatePieces,
      outcome: {
        status: "complete",
        mechanism: input.attemptedMechanism,
        failure: null,
      },
    };
  }

  const failure =
    input.firstPieceFailure ??
    (input.hardValidationPassed
      ? {
          code: "piece-placement-failed" as const,
          stage: "placement" as const,
          message:
            `Step ${input.stepNumber} produced ${input.candidatePieces}/${input.expectedPieces} candidate piece ` +
            `placements. A printed step is atomic, so none of them were accepted.`,
        }
      : {
          code: "hard-validation-failed" as const,
          stage: "validation" as const,
          message:
            `Step ${input.stepNumber} produced the expected piece count but did not pass the hard document ` +
            `validator. A printed step is atomic, so none of its candidate placements were accepted.`,
        });
  return {
    document: input.baseDocument,
    acceptedPieces: 0,
    outcome: {
      status: "failed",
      mechanism: "deferred",
      attemptedMechanism: input.attemptedMechanism,
      failure,
    },
  };
}

export interface AtomicStepCompletionFacts {
  readonly outcome: StepOutcome;
  readonly placedPieces: number;
  readonly expectedAssembledPieces: number;
  readonly canonicalStepId: string | null;
  readonly actionEvidenceDigest: string | null;
}

export function isSha256Digest(value: string | null): value is string {
  return value !== null && /^sha256:[0-9a-f]{64}$/u.test(value);
}

export function isAtomicStepComplete(step: AtomicStepCompletionFacts): boolean {
  return (
    step.outcome.status === "complete" &&
    step.placedPieces === step.expectedAssembledPieces &&
    step.canonicalStepId !== null &&
    isSha256Digest(step.actionEvidenceDigest)
  );
}

export class RealBuildConfigurationError extends Error {
  readonly code = "target-part-budget-too-small" as const;

  constructor(maxParts: number, targetPartCount: number) {
    super(
      `Real-build maxParts is ${maxParts}, below the declared ${targetPartCount}-part target. ` +
        `Raise the explicit document budget before running; a truncated budget is not reconstruction evidence.`,
    );
    this.name = "RealBuildConfigurationError";
  }
}

export function assertTargetPartBudget(maxParts: number, targetPartCount: number): void {
  if (
    !Number.isInteger(maxParts) ||
    !Number.isInteger(targetPartCount) ||
    targetPartCount < 1 ||
    maxParts < targetPartCount
  ) {
    throw new RealBuildConfigurationError(maxParts, targetPartCount);
  }
}

export interface RealBuildAccounting {
  readonly rawCalloutQuantity: number;
  readonly classifiedPhysicalCalloutPieces: number;
  readonly semanticMultiplierQuantity: number;
  readonly omittedPhysicalPieces: number;
  readonly directCalloutPieces: number;
  readonly multiBuildCopyPieces: number;
  readonly looseInventoryPieces: number;
  readonly assembledTargetPieces: number;
  readonly inventoryPieces: number;
}

export type RealBuildStepAction =
  | {
      readonly kind: "place-callouts";
      readonly assembledPieces: number;
      readonly evidenceDigest: string | null;
    }
  | {
      readonly kind: "multi-build-copy";
      readonly assembledPieces: number;
      readonly sourceStepNumber: number;
      readonly evidenceDigest: string | null;
      readonly copies: readonly {
        readonly identityKey: string;
        readonly sourceIdentityKey: string;
        readonly designId: string;
        readonly materialId: string;
        readonly catalogPartId: string;
        readonly colorId: string;
        readonly evidenceDigest: string;
        readonly transform: {
          readonly positionLdu: readonly [number, number, number];
          readonly orientationId: string;
        };
      }[];
    }
  | {
      readonly kind: "transition";
      readonly assembledPieces: 0;
      readonly transition: "rotation" | "attachment" | "final-view" | "unclassified";
      readonly panelEvidenceDigest: string | null;
      readonly classificationEvidenceDigest: string | null;
      readonly evidenceDigest: string | null;
    };

export interface RealBuildInputDigests {
  readonly pdf: string;
  readonly calloutManifest: string;
  readonly coverage: string;
  readonly officialModel: string;
  readonly actionLedger: string;
  readonly highlightCalibration: string;
  readonly builderCalibration: string;
  readonly builderGeometry: string;
  readonly transitionClassifications: string;
}

export interface PlacementScoreEntry<T> {
  readonly candidate: T;
  readonly score: number;
}

export interface PlacementScoreDecision<T> {
  readonly winner: PlacementScoreEntry<T> | null;
  readonly runnerUp: PlacementScoreEntry<T> | null;
  readonly failure: StepFailure | null;
}

/** Refuses a visual choice unless every eligible candidate was scored and one wins clearly. */
export function selectUniquePlacementScore<T>(input: {
  readonly stepNumber: number;
  readonly pieceIndex: number;
  readonly catalogPartId: string;
  readonly eligibleCandidates: number;
  readonly scores: readonly PlacementScoreEntry<T>[];
  readonly minimumMargin: number;
}): PlacementScoreDecision<T> {
  const fail = (code: StepFailureCode, message: string): PlacementScoreDecision<T> => ({
    winner: null,
    runnerUp: null,
    failure: {
      code,
      stage: "evidence",
      pieceIndex: input.pieceIndex,
      catalogPartId: input.catalogPartId,
      message,
    },
  });
  if (input.scores.length !== input.eligibleCandidates) {
    return fail(
      "incomplete-placement-scoring",
      `Step ${input.stepNumber} scored ${input.scores.length}/${input.eligibleCandidates} eligible placements ` +
        `for ${input.catalogPartId}. An arbitrary scored prefix cannot visually confirm a winner.`,
    );
  }
  if (input.scores.length === 0) {
    return fail(
      "no-placement-candidate",
      `Step ${input.stepNumber} has no eligible placement to score for ${input.catalogPartId}.`,
    );
  }
  if (
    !Number.isFinite(input.minimumMargin) ||
    input.minimumMargin < 0 ||
    input.scores.some(({ score }) => !Number.isFinite(score))
  ) {
    return fail(
      "ambiguous-placement-score",
      `Step ${input.stepNumber} produced non-finite scoring evidence or an invalid minimum margin for ${input.catalogPartId}.`,
    );
  }

  const ordered = [...input.scores].sort((left, right) => right.score - left.score);
  const winner = ordered[0]!;
  const runnerUp = ordered[1] ?? null;
  if (winner.score <= 0) {
    return fail(
      "zero-placement-score",
      `Step ${input.stepNumber} gave the best placement of ${input.catalogPartId} score ${winner.score}; zero evidence cannot confirm a placement.`,
    );
  }
  if (runnerUp !== null && winner.score === runnerUp.score) {
    return fail(
      "tied-placement-score",
      `Step ${input.stepNumber} has tied best placements for ${input.catalogPartId} at score ${winner.score}.`,
    );
  }
  if (runnerUp !== null && winner.score - runnerUp.score < input.minimumMargin) {
    return fail(
      "ambiguous-placement-score",
      `Step ${input.stepNumber} separated the best two placements of ${input.catalogPartId} by ` +
        `${winner.score - runnerUp.score}, below the required margin ${input.minimumMargin}.`,
    );
  }
  return { winner, runnerUp, failure: null };
}

export function benchmarkPrefixFailure(input: {
  readonly stepNumber: number;
  readonly highlightPrefixHash: string;
  readonly blindPrefixHash: string;
}): StepFailure | null {
  if (input.highlightPrefixHash === input.blindPrefixHash) return null;
  return {
    code: "benchmark-prefix-mismatch",
    stage: "benchmark",
    message:
      `Step ${input.stepNumber} cannot compare highlight and blind search: highlight started at ` +
      `${input.highlightPrefixHash}, while blind started at ${input.blindPrefixHash}.`,
  };
}

export interface WholeStepVisualEvidence {
  readonly score: number | null;
  readonly minimumScore: number;
  readonly minimumExclusiveHighlightPixelsPerPiece: number;
  readonly calibrationDigest: string | null;
  readonly unionHighlightPixels: number;
  readonly summedPieceHighlightPixels: number;
  readonly exclusiveHighlightPixelsByPiece: readonly number[];
  readonly failure: StepFailure | null;
}

export type SearchStrategy = "pruned" | "exhaustive";

export interface SearchStrategyEvidence {
  readonly strategy: SearchStrategy;
  readonly winnerKey: string | null;
  readonly bestScore: number | null;
  readonly runnerUpScore: number | null;
  readonly rendered: number;
  readonly elapsedMs: number;
  readonly failure: StepFailure | null;
}

interface PlacementOperationShape {
  readonly kind: string;
  readonly operationId: string;
  readonly part?: { readonly stepId: string; readonly [key: string]: unknown };
  readonly step?: {
    readonly id: string;
    readonly index: number;
    readonly name: string;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

/** Reuses one step for every piece in a printed step and preserves its printed number. */
export function groupPlacementOperationsInPrintedStep<T extends PlacementOperationShape>(
  operations: readonly T[],
  input: { readonly printedStepNumber: number; readonly targetStepId: string | null },
): { readonly operations: readonly T[]; readonly stepId: string } {
  const addPart = operations.find(({ kind }) => kind === "addPart");
  if (addPart?.part === undefined) {
    throw new TypeError(
      "A placement transaction must contain one addPart operation with a stepId.",
    );
  }
  const transactionStepId = addPart.part.stepId;
  const stepId = input.targetStepId ?? transactionStepId;
  const grouped = operations
    .filter((operation) => input.targetStepId === null || operation.kind !== "addStep")
    .map((operation) => {
      if (operation.kind === "addPart" && operation.part !== undefined) {
        return { ...operation, part: { ...operation.part, stepId } } as T;
      }
      if (operation.kind === "addStep" && operation.step !== undefined) {
        return {
          ...operation,
          step: {
            ...operation.step,
            index: input.printedStepNumber - 1,
            name: `Step ${input.printedStepNumber}`,
          },
        } as T;
      }
      return operation;
    });
  return { operations: grouped, stepId };
}

export interface RealBuildPanelSpec {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly minXPt: number;
  readonly maxXPt: number;
  readonly minYPt: number;
  readonly maxYPt: number;
  readonly calloutBoxes: readonly {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  }[];
  readonly mappedCalloutKeys: readonly string[];
  readonly action: RealBuildStepAction;
  readonly pieces: readonly {
    readonly identityKey: string;
    readonly designId: string;
    readonly materialId: string;
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly calloutKey: string;
    readonly identificationConfidence: TrustedIdentificationConfidence;
    readonly cropDigest: string | null;
    readonly identificationInputDigest: string | null;
    readonly expectedTransform: {
      readonly positionLdu: readonly [number, number, number];
      readonly orientationId: string;
    };
  }[];
  readonly omittedPieces: readonly {
    readonly identityKey: string;
    readonly designId: string;
    readonly materialId: string;
    readonly catalogPartId: string;
    readonly colorId: string;
    readonly evidenceDigest: string;
    readonly transform: {
      readonly positionLdu: readonly [number, number, number];
      readonly orientationId: string;
    };
  }[];
  readonly calloutPieces: number;
  readonly classifiedPhysicalCalloutPieces: number;
  readonly semanticMultiplierQuantity: number;
  readonly omittedPhysicalPieces: number;
  readonly coverageFailures: readonly StepFailure[];
  readonly missingDesigns: readonly string[];
  readonly unresolvedCallouts: readonly string[];
}

export interface RealBuildOptions {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly latticeUrl: string;
  readonly renderingUrl: string;
  readonly kernelUrl: string;
  readonly commandsUrl: string;
  readonly assemblyUrl: string;
  readonly panels: readonly RealBuildPanelSpec[];
  readonly expectedPrintedSteps: 359;
  readonly lastStep: number;
  readonly renderScale: number;
  readonly panelWidth: number;
  readonly workFactor: number;
  readonly maxRendersPerPiece: number;
  readonly blindRenderBudget: number;
  readonly proximityMarginPx: number;
  readonly targetPartCount: number;
  readonly maxParts: number;
  readonly minimumScoreMargin: number;
  readonly minimumWholeStepScore: number;
  readonly minimumExclusiveHighlightPixelsPerPiece: number;
  readonly highlightCalibrationDigest: string | null;
  readonly accounting: RealBuildAccounting;
  readonly inputDigests: RealBuildInputDigests;
  readonly coverageInputBindings: CoverageInputBindings;
  readonly coverageByCallout: Readonly<Record<string, StepCoverageCalloutClaim>>;
}

export interface BlindSearchReport {
  readonly comparisonPrefixHash: string;
  readonly distinctCandidates: number;
  readonly feasible: boolean;
  readonly rendered: number;
  readonly bestScore: number | null;
  readonly runnerUpScore: number | null;
  readonly agreesWithHighlight: boolean | null;
  readonly refusal: string | null;
  readonly elapsedMs: number;
}

export interface RealBuildPieceReport {
  readonly catalogPartId: string;
  readonly blind: BlindSearchReport;
  readonly enumerated: number;
  readonly afterProximity: number;
  readonly rendered: number;
  readonly bestScore: number | null;
  readonly runnerUpScore: number | null;
  readonly placed: boolean;
  readonly positionLdu: readonly [number, number, number] | null;
  readonly orientationId: string | null;
  readonly failure: StepFailure | null;
}

export interface RealBuildStepReport {
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly calloutPieces: number;
  readonly expectedAssembledPieces: number;
  readonly attemptedPieces: number;
  readonly placedPieces: number;
  readonly action: RealBuildStepAction;
  readonly actionEvidenceDigest: string | null;
  readonly canonicalStepId: string | null;
  readonly prerequisites: StepPrerequisiteFacts;
  readonly outcome: StepOutcome;
  readonly validation: {
    readonly attempted: boolean;
    readonly targetDocumentHash: string | null;
    readonly truthSnapshotHash: string | null;
    readonly validatorSetHash: string | null;
    readonly documentGloballyValid: boolean | null;
    readonly blockingIssues: readonly {
      readonly code: string;
      readonly message: string;
      readonly path: string;
      readonly partIds: readonly string[];
    }[];
    readonly failure: string | null;
  };
  readonly fit: {
    readonly azimuthDegrees: number | null;
    readonly elevationDegrees: number | null;
    readonly pixelsPerUnit: number | null;
    readonly residualPx: number | null;
    readonly coherence: number;
    readonly failure: string | null;
  };
  readonly camera: {
    readonly azimuthDegrees: number;
    readonly elevationDegrees: number;
    readonly pixelsPerUnit: number;
    readonly residualPx: number;
    readonly coherence: number;
    readonly centerXPx: number;
    readonly centerYPx: number;
    readonly anchorIou: number | null;
    readonly anchorShiftPx: readonly [number, number] | null;
  } | null;
  readonly highlight: {
    readonly regions: number;
    readonly closedContourRate: number;
    readonly strokePx: number;
    readonly boundsPx: readonly [number, number, number, number] | null;
  };
  readonly arrows: {
    readonly kept: number;
    readonly redPx: number;
    readonly rejected: number;
    /**
     * Whole-grid displacements whose projection matches the corrected arrow.
     *
     * The count, not a winner. On a printed panel's projection several triples
     * agree to within the measurement, so this says how far the arrow narrowed
     * the placement and not which one it chose — one means the arrow settled the
     * step by itself, and more means something else has to.
     */
    readonly displacementFamily: number;
    /**
     * The family's own displacements in LDU, closest projection first, bounded.
     *
     * The count says how far the arrow narrowed the step; these say to what. An
     * authored source can then be asked whether the placement it records is one
     * of them, which is a comparison between a reading of printed pixels and
     * something that never saw them.
     */
    readonly displacementFamilyLdu: readonly (readonly [number, number, number])[];
  };
  readonly pieces: readonly RealBuildPieceReport[];
  readonly jointVisual: WholeStepVisualEvidence | null;
  readonly documentParts: number;
  readonly elapsedMs: number;
  readonly panelPng: string | null;
  readonly buildPng: string | null;
}

export interface RealBuildResult {
  readonly schemaVersion: "lego.real-build-result/3";
  readonly authority: {
    readonly kind: "local-diagnostic";
    readonly authenticated: false;
    readonly trustSealDigest: null;
    readonly reason: "released-companion-broker-unavailable";
  };
  readonly status: "completed" | "prefix-complete" | "incomplete" | "input-rejected";
  readonly requestedLastStep: number;
  readonly expectedPrintedSteps: number;
  readonly assembledTargetParts: number;
  readonly inputDigests: RealBuildInputDigests;
  readonly inputFailures: readonly StepFailure[];
  readonly completionFailures: readonly StepFailure[];
  readonly steps: readonly RealBuildStepReport[];
  readonly documentJson: string | null;
  readonly structuralHash: string | null;
  readonly finalParts: number;
  readonly totalElapsedMs: number;
}
