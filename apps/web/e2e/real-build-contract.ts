import {
  isSha256Digest,
  reconcileStepCoverage,
  stepPrerequisiteFacts,
  type RealBuildAccounting,
  type RealBuildInputDigests,
  type RealBuildOptions,
  type RealBuildPanelSpec,
  type RealBuildResult,
  type RealBuildStepReport,
  type SearchStrategy,
  type SearchStrategyEvidence,
  type StepCoverageCalloutClaim,
  type StepFailure,
  type WholeStepVisualEvidence,
} from "./real-build-safety";
import { LOCAL_REAL_BUILD_AUTHORITY } from "./real-build-authority";

/**
 * Set 6651557's inventory and assembled model are not the same quantity.
 *
 * Every figure here is read from a printed source, not reconciled to fit.
 * The step pages carry 881 distinct Nx labels totalling 1512: 859 set in the
 * 8pt parts-bin face totalling 1464, and 22 set in the 16/24/40pt multiplier
 * face totalling 48 (see `FULL_BOOKLET_CALLOUT_ACCOUNTING`). The back-matter
 * inventory on pages 221-222 totals 1465, one more than 1464 because the loose
 * 31510 separator is never placed. The official Builder XML independently
 * yields 1395 direct + 69 MultiBuild = 1464 instruction identities from 1465
 * Bricks, with that same separator unmatched — see
 * `validateOfficialModelAccounting`.
 *
 * `omittedPhysicalPieces` is therefore 0 and not a spare degree of freedom: the
 * bin quantities already cover every assembled piece. Raising it to absorb a
 * shortfall would let a callout over-read pay for itself and silence the very
 * conservation this constant exists to enforce.
 */
export const OFFICIAL_REAL_BUILD_ACCOUNTING = {
  rawCalloutQuantity: 1_512,
  classifiedPhysicalCalloutPieces: 1_464,
  semanticMultiplierQuantity: 48,
  omittedPhysicalPieces: 0,
  directCalloutPieces: 1_395,
  multiBuildCopyPieces: 69,
  looseInventoryPieces: 1,
  assembledTargetPieces: 1_464,
  inventoryPieces: 1_465,
} as const;

/** Returns every input-contract problem so the scoreboard can retain them together. */
export function preflightRealBuildOptions(input: {
  readonly panels: readonly RealBuildPanelSpec[];
  readonly expectedPrintedSteps: number;
  readonly lastStep: number;
  readonly accounting: RealBuildAccounting;
  readonly targetPartCount: number;
  readonly maxParts: number;
  readonly inputDigests: RealBuildInputDigests;
  readonly coverageInputBindings: {
    readonly pdf: string | null;
    readonly calloutManifest: string | null;
  };
  readonly minimumWholeStepScore: number;
  readonly minimumExclusiveHighlightPixelsPerPiece: number;
  readonly highlightCalibrationDigest: string | null;
  readonly maxRendersPerPiece: number;
  readonly blindRenderBudget: number;
  readonly deferredCandidateBudget: number;
  readonly explodedGhostRenderBudget: number;
  readonly coverageByCallout: Readonly<Record<string, StepCoverageCalloutClaim>>;
}): readonly StepFailure[] {
  const failures: StepFailure[] = [];
  // An exploded step renders its whole-step candidate set once per member of
  // the arrow's travel family, so its render count is the product of the two.
  // A render budget below the candidate budget could therefore refuse a step
  // whose candidate set the run had already agreed to enumerate — one budget
  // admitting a set the other cannot look at. They are different resources and
  // both are explicit, but the render budget has to be able to cover the
  // candidates at least once.
  if (
    !Number.isInteger(input.deferredCandidateBudget) ||
    !Number.isInteger(input.explodedGhostRenderBudget) ||
    input.deferredCandidateBudget < 1 ||
    input.explodedGhostRenderBudget < input.deferredCandidateBudget
  ) {
    failures.push({
      code: "benchmark-policy-mismatch",
      stage: "input",
      inputKey: "explodedGhostRenderBudget",
      message:
        `The exploded-step render budget is ${input.explodedGhostRenderBudget} against a whole-step candidate ` +
        `budget of ${input.deferredCandidateBudget}. An exploded step renders every candidate at least once, ` +
        `so a render budget under the candidate budget refuses a set the run had already agreed to enumerate ` +
        `and the step fails on a resource it was configured to have. Both must be positive integers with the ` +
        `render budget at least the candidate budget.`,
    });
  }
  // The pruned candidate set is a subset of the exhaustive one by construction:
  // the proximity filter only removes. So a pruned budget below the exhaustive
  // one can only ever refuse renders the exhaustive strategy then performs
  // anyway — the step fails for want of a pruned winner while the run spends
  // strictly more time than the refusal saved. Measured on printed step 2: 47
  // eligible against a pruned budget of 24, refused, and 88 rendered
  // exhaustively in the same step. It is a configuration that cannot bind in the
  // direction it intends, so it is refused as input rather than left to produce
  // a benchmark disagreement between a strategy that looked and one that did not.
  if (
    !Number.isInteger(input.maxRendersPerPiece) ||
    !Number.isInteger(input.blindRenderBudget) ||
    input.maxRendersPerPiece < 1 ||
    input.blindRenderBudget < 1 ||
    input.maxRendersPerPiece < input.blindRenderBudget
  ) {
    failures.push({
      code: "benchmark-policy-mismatch",
      stage: "input",
      inputKey: "maxRendersPerPiece",
      message:
        `The pruned per-piece render budget is ${input.maxRendersPerPiece} against an exhaustive budget of ` +
        `${input.blindRenderBudget}. The pruned set is a subset of the exhaustive one, so a smaller pruned ` +
        `budget refuses only renders the exhaustive strategy performs regardless: it cannot save the work ` +
        `it exists to save, and it turns a scorable step into a disagreement between a strategy that ` +
        `scored and one that declined to. Both budgets must be positive integers with the pruned one at ` +
        `least the exhaustive one.`,
    });
  }
  const numbers = input.panels.map(({ stepNumber }) => stepNumber);
  const unique = new Set(numbers);
  const expected = Array.from({ length: input.expectedPrintedSteps }, (_, index) => index + 1);
  if (
    input.expectedPrintedSteps !== 359 ||
    numbers.length !== expected.length ||
    unique.size !== numbers.length ||
    expected.some((step) => !unique.has(step))
  ) {
    const missing = expected.filter((step) => !unique.has(step));
    const duplicates = [...unique].filter(
      (step) => numbers.filter((candidate) => candidate === step).length > 1,
    );
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        `The real build requires one panel for every printed step 1..359; received ${numbers.length} ` +
        `panels and ${unique.size} unique numbers. Missing: ${missing.join(", ") || "none"}; ` +
        `duplicates: ${duplicates.join(", ") || "none"}. Rotation and attachment steps must be explicit ` +
        `zero-piece transitions rather than omitted.`,
    });
  }
  if (
    !Number.isInteger(input.lastStep) ||
    input.lastStep < 1 ||
    input.lastStep > input.expectedPrintedSteps
  ) {
    failures.push({
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "lastStep",
      message:
        `The requested real-build prefix must end at an integer printed step from 1 through ` +
        `${input.expectedPrintedSteps}; received ${input.lastStep}.`,
    });
  }
  const requestedPanels = input.panels.filter(({ stepNumber }) => stepNumber <= input.lastStep);
  const identityStep = new Map<string, number>();
  for (const panel of requestedPanels) {
    failures.push(
      ...panel.coverageFailures.map((failure) => ({ ...failure, stepNumber: panel.stepNumber })),
    );
    const reconciliation = reconcileStepCoverage(input.coverageByCallout, {
      pageNumber: panel.pageNumber,
      stepNumber: panel.stepNumber,
      mappedKeys: panel.mappedCalloutKeys,
    });
    if (reconciliation.failure !== null) {
      failures.push({ ...reconciliation.failure, stepNumber: panel.stepNumber });
    } else if (reconciliation.expectedPieces !== panel.calloutPieces) {
      failures.push({
        code: "coverage-key-mismatch",
        stage: "coverage",
        stepNumber: panel.stepNumber,
        message:
          `Step ${panel.stepNumber} retained coverage assigns ${reconciliation.expectedPieces} raw pieces to ` +
          `its exact mapped keys, but the panel/action ledger declares ${panel.calloutPieces}. Quantity-only ` +
          `panel claims cannot bypass the retained coverage index.`,
      });
    }
    if (panel.action.kind === "place-callouts") {
      const mapped = new Set(panel.mappedCalloutKeys);
      const pieceKeys = new Set(panel.pieces.map(({ calloutKey }) => calloutKey));
      if (
        pieceKeys.size !== mapped.size ||
        [...pieceKeys].some((key) => !mapped.has(key)) ||
        [...mapped].some((key) => !pieceKeys.has(key))
      ) {
        failures.push({
          code: "coverage-key-mismatch",
          stage: "coverage",
          stepNumber: panel.stepNumber,
          message:
            `Step ${panel.stepNumber} direct piece identities cite [${[...pieceKeys].join(", ") || "none"}], ` +
            `but its exact mapped coverage keys are [${[...mapped].join(", ") || "none"}]. Every direct ` +
            `identity must originate in one retained callout; omitted official identities stay separate.`,
        });
      }
    }
    if (!isSha256Digest(panel.action.evidenceDigest)) {
      failures.push({
        code:
          panel.action.kind === "transition"
            ? "transition-evidence-missing"
            : "action-ledger-incomplete",
        stage: "input",
        stepNumber: panel.stepNumber,
        inputKey: `step-${panel.stepNumber}.action.evidenceDigest`,
        message:
          `Printed step ${panel.stepNumber} ${panel.action.kind} action is not bound to retained content: ` +
          `${JSON.stringify(panel.action.evidenceDigest ?? "missing")}. A quantity or label without exact ` +
          `source evidence cannot define a canonical build action.`,
      });
    }
    if (panel.action.kind === "transition" && panel.action.transition === "unclassified") {
      failures.push({
        code: "unsupported-instruction-action",
        stage: "input",
        stepNumber: panel.stepNumber,
        inputKey: `step-${panel.stepNumber}`,
        message:
          `Printed step ${panel.stepNumber} has zero classified pieces but its panel action is unclassified. ` +
          `Identify it as rotation, attachment, or final view; omission is not a zero-piece action.`,
      });
    }
    if (panel.action.kind === "transition" && !isSha256Digest(panel.action.panelEvidenceDigest)) {
      failures.push({
        code: "transition-evidence-missing",
        stage: "input",
        stepNumber: panel.stepNumber,
        inputKey: `step-${panel.stepNumber}.action.panelEvidenceDigest`,
        message:
          `Printed transition step ${panel.stepNumber} is not bound to its exact retained PDF panel. ` +
          `Classification without panel evidence cannot define rotation, attachment, or final-view semantics.`,
      });
    }
    if (
      panel.action.kind === "transition" &&
      (!isSha256Digest(panel.action.classificationEvidenceDigest) ||
        panel.action.classificationEvidenceDigest === panel.action.panelEvidenceDigest)
    ) {
      failures.push({
        code: "transition-classification-unverified",
        stage: "input",
        stepNumber: panel.stepNumber,
        inputKey: `step-${panel.stepNumber}.action.classificationEvidenceDigest`,
        message:
          `Printed transition step ${panel.stepNumber} lacks a separate local classification-claim digest ` +
          `distinct from its panel digest. This self-hashed claim remains explicitly unauthenticated; panel ` +
          `pixels and a ledger label cannot certify their own transition semantics.`,
      });
    }
    if (panel.omittedPieces.length !== panel.omittedPhysicalPieces) {
      failures.push({
        code: "omitted-piece-identity-missing",
        stage: "input",
        stepNumber: panel.stepNumber,
        inputKey: `step-${panel.stepNumber}.omittedPieces`,
        message:
          `Printed step ${panel.stepNumber} declares ${panel.omittedPhysicalPieces} physical piece(s) omitted ` +
          `from callout crops but supplies ${panel.omittedPieces.length} content-bound identities. Every omitted ` +
          `piece needs its catalog part, color, stable identity, and evidence digest before it can count.`,
      });
    }
    const directIdentities =
      panel.action.kind === "place-callouts" ? [...panel.pieces, ...panel.omittedPieces] : [];
    for (const piece of directIdentities) {
      const evidenceDigest = "evidenceDigest" in piece ? piece.evidenceDigest : piece.cropDigest;
      if (piece.identityKey.trim().length === 0 || !isSha256Digest(evidenceDigest)) {
        failures.push({
          code: "action-ledger-incomplete",
          stage: "input",
          stepNumber: panel.stepNumber,
          inputKey: `step-${panel.stepNumber}.identity`,
          message: `Printed step ${panel.stepNumber} has an unbound direct-piece identity ${JSON.stringify(piece.identityKey)}.`,
        });
      } else if (identityStep.has(piece.identityKey)) {
        failures.push({
          code: "action-ledger-incomplete",
          stage: "input",
          stepNumber: panel.stepNumber,
          inputKey: piece.identityKey,
          message:
            `Piece identity ${piece.identityKey} is reused by steps ${identityStep.get(piece.identityKey)} and ` +
            `${panel.stepNumber}; one physical piece may enter the canonical model only once.`,
        });
      } else identityStep.set(piece.identityKey, panel.stepNumber);
      const transform = "expectedTransform" in piece ? piece.expectedTransform : piece.transform;
      if (
        transform.positionLdu.length !== 3 ||
        transform.positionLdu.some((coordinate) => !Number.isInteger(coordinate)) ||
        !/^upright-yaw-(?:0|90|180|270)$/u.test(transform.orientationId)
      ) {
        failures.push({
          code: "official-transform-unrepresentable",
          stage: "input",
          stepNumber: panel.stepNumber,
          inputKey: piece.identityKey,
          message:
            `Direct identity ${piece.identityKey} has no exact integer-LDU canonical transform resolved from ` +
            `its official Bone: ${JSON.stringify(transform)}.`,
        });
      }
    }
    if (panel.action.kind === "multi-build-copy") {
      if (panel.action.copies.length !== panel.action.assembledPieces) {
        failures.push({
          code: "action-ledger-incomplete",
          stage: "input",
          stepNumber: panel.stepNumber,
          inputKey: `step-${panel.stepNumber}.action.copies`,
          message:
            `Printed step ${panel.stepNumber} declares ${panel.action.assembledPieces} MultiBuild pieces but ` +
            `supplies ${panel.action.copies.length} copy identities. A multiplier is not a copy ledger.`,
        });
      }
      for (const copy of panel.action.copies) {
        const sourceStep = identityStep.get(copy.sourceIdentityKey);
        if (
          sourceStep === undefined ||
          sourceStep >= panel.stepNumber ||
          copy.identityKey.trim().length === 0 ||
          !isSha256Digest(copy.evidenceDigest) ||
          identityStep.has(copy.identityKey)
        ) {
          failures.push({
            code: "multi-build-source-invalid",
            stage: "input",
            stepNumber: panel.stepNumber,
            inputKey: copy.identityKey || `step-${panel.stepNumber}.copy`,
            message:
              `MultiBuild copy ${JSON.stringify(copy.identityKey)} at step ${panel.stepNumber} cites source ` +
              `${JSON.stringify(copy.sourceIdentityKey)} from ${sourceStep ?? "no prior step"}. Each copy needs ` +
              `a unique content-bound identity and a source identity established by an earlier printed step.`,
          });
        } else identityStep.set(copy.identityKey, panel.stepNumber);
        if (
          copy.transform.positionLdu.length !== 3 ||
          copy.transform.positionLdu.some((coordinate) => !Number.isInteger(coordinate)) ||
          !/^upright-yaw-(?:0|90|180|270)$/u.test(copy.transform.orientationId)
        ) {
          failures.push({
            code: "official-transform-unrepresentable",
            stage: "input",
            stepNumber: panel.stepNumber,
            inputKey: copy.identityKey,
            message:
              `MultiBuild identity ${copy.identityKey} has no exact protocol-representable transform: ` +
              `${JSON.stringify(copy.transform)}.`,
          });
        }
      }
    }
  }

  const directActions = requestedPanels
    .filter(({ action }) => action.kind === "place-callouts")
    .reduce((total, panel) => total + panel.pieces.length + panel.omittedPieces.length, 0);
  const multiBuildActions = requestedPanels.reduce(
    (total, { action }) => total + (action.kind === "multi-build-copy" ? action.copies.length : 0),
    0,
  );
  const rawCalloutQuantity = requestedPanels.reduce(
    (total, panel) => total + panel.calloutPieces,
    0,
  );
  const classifiedPhysicalCalloutPieces = requestedPanels.reduce(
    (total, panel) => total + panel.classifiedPhysicalCalloutPieces,
    0,
  );
  const semanticMultiplierQuantity = requestedPanels.reduce(
    (total, panel) => total + panel.semanticMultiplierQuantity,
    0,
  );
  const omittedPhysicalPieces = requestedPanels.reduce(
    (total, panel) => total + panel.omittedPhysicalPieces,
    0,
  );
  const inconsistentSteps = requestedPanels.filter((panel) => {
    const physical = panel.classifiedPhysicalCalloutPieces + panel.omittedPhysicalPieces;
    const ledgerPieces =
      panel.action.kind === "place-callouts"
        ? panel.pieces.length + panel.omittedPieces.length
        : panel.action.kind === "multi-build-copy"
          ? panel.action.copies.length
          : 0;
    return (
      !Number.isInteger(panel.calloutPieces) ||
      !Number.isInteger(panel.classifiedPhysicalCalloutPieces) ||
      !Number.isInteger(panel.semanticMultiplierQuantity) ||
      !Number.isInteger(panel.omittedPhysicalPieces) ||
      panel.calloutPieces !==
        panel.classifiedPhysicalCalloutPieces + panel.semanticMultiplierQuantity ||
      physical !== panel.action.assembledPieces ||
      ledgerPieces !== panel.action.assembledPieces ||
      (panel.action.kind === "transition" &&
        (panel.action.transition === "unclassified" || panel.calloutPieces !== 0))
    );
  });
  const declared = input.accounting;
  const official = OFFICIAL_REAL_BUILD_ACCOUNTING;
  const declarationMatches =
    declared.rawCalloutQuantity === official.rawCalloutQuantity &&
    declared.classifiedPhysicalCalloutPieces === official.classifiedPhysicalCalloutPieces &&
    declared.semanticMultiplierQuantity === official.semanticMultiplierQuantity &&
    declared.omittedPhysicalPieces === official.omittedPhysicalPieces &&
    declared.directCalloutPieces === official.directCalloutPieces &&
    declared.multiBuildCopyPieces === official.multiBuildCopyPieces &&
    declared.looseInventoryPieces === official.looseInventoryPieces &&
    declared.assembledTargetPieces === official.assembledTargetPieces &&
    declared.inventoryPieces === official.inventoryPieces &&
    declared.assembledTargetPieces + declared.looseInventoryPieces === declared.inventoryPieces &&
    input.targetPartCount === declared.assembledTargetPieces &&
    Number.isInteger(input.maxParts) &&
    input.maxParts >= declared.assembledTargetPieces;
  const prefixMatches =
    rawCalloutQuantity === classifiedPhysicalCalloutPieces + semanticMultiplierQuantity &&
    inconsistentSteps.length === 0;
  const fullSetMatches =
    rawCalloutQuantity === declared.rawCalloutQuantity &&
    classifiedPhysicalCalloutPieces === declared.classifiedPhysicalCalloutPieces &&
    semanticMultiplierQuantity === declared.semanticMultiplierQuantity &&
    omittedPhysicalPieces === declared.omittedPhysicalPieces &&
    classifiedPhysicalCalloutPieces + omittedPhysicalPieces === declared.assembledTargetPieces &&
    directActions === declared.directCalloutPieces &&
    multiBuildActions === declared.multiBuildCopyPieces &&
    directActions + multiBuildActions === declared.assembledTargetPieces;
  const fullSetRequired = input.lastStep >= input.expectedPrintedSteps;
  const matches = declarationMatches && prefixMatches && (!fullSetRequired || fullSetMatches);
  // Naming the failed clause is the difference between "some number moved" and a
  // repairable report: the three clauses have three different causes and fixes.
  const failedClauses = [
    declarationMatches ? null : "declaration (the supplied accounting is not the official one)",
    prefixMatches
      ? null
      : "prefix (the requested panels do not internally conserve raw = physical + semantic)",
    !fullSetRequired || fullSetMatches
      ? null
      : "full-set (panel and action totals do not reach the official set totals)",
  ].filter((clause): clause is string => clause !== null);
  if (!matches) {
    failures.push({
      code: "set-accounting-mismatch",
      stage: "input",
      inputKey: "accounting",
      message:
        `Set 6651557 must classify raw crops as ${official.rawCalloutQuantity} = ` +
        `${official.classifiedPhysicalCalloutPieces} physical-piece quantities + ` +
        `${official.semanticMultiplierQuantity} semantic repeat/subassembly multipliers, then add ` +
        `${official.omittedPhysicalPieces} omitted physical pieces to reach ` +
        `${official.assembledTargetPieces} assembled. Its action ledger must independently conserve ` +
        `${official.directCalloutPieces} direct pieces + ${official.multiBuildCopyPieces} MultiBuild copies = ` +
        `${official.assembledTargetPieces}, plus ${official.looseInventoryPieces} loose separator = ` +
        `${official.inventoryPieces} inventory. Supplied panels total raw/classified/semantic/omitted ` +
        `${rawCalloutQuantity}/${classifiedPhysicalCalloutPieces}/${semanticMultiplierQuantity}/` +
        `${omittedPhysicalPieces}; actions account for ${directActions} direct and ${multiBuildActions} copied ` +
        `pieces; declarations are ${declared.directCalloutPieces} + ${declared.multiBuildCopyPieces} = ` +
        `${declared.assembledTargetPieces}, plus ${declared.looseInventoryPieces} = ` +
        `${declared.inventoryPieces}; targetPartCount/maxParts are ${input.targetPartCount}/${input.maxParts}. ` +
        `Requested prefix 1..${input.lastStep} totals raw/classified/semantic/omitted ` +
        `${rawCalloutQuantity}/${classifiedPhysicalCalloutPieces}/${semanticMultiplierQuantity}/` +
        `${omittedPhysicalPieces}; per-step inconsistencies: ` +
        `${inconsistentSteps.map(({ stepNumber }) => stepNumber).join(", ") || "none"}. Failed clause(s): ` +
        `${failedClauses.join("; ")}. Full-set action totals ` +
        `are required only when step 359 is requested; an earlier prefix remains explicitly unexecuted beyond ` +
        `its requested boundary. ` +
        `Classify the discrepant callouts and MultiBuild actions. Three things are not fixes: changing the ` +
        `target, accepting the quantity sum as assembled truth, and raising omittedPhysicalPieces to absorb a ` +
        `shortfall — the printed inventory is ${official.inventoryPieces} pieces and no parse may claim more.`,
    });
  }

  for (const [key, value] of Object.entries(input.inputDigests)) {
    if (!isSha256Digest(value)) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: key,
        message: `Real-build input ${key} is not bound to a lowercase sha256 digest: ${JSON.stringify(value)}.`,
      });
    }
  }
  for (const key of ["pdf", "calloutManifest"] as const) {
    const actual = input.inputDigests[key];
    const bound = input.coverageInputBindings[key];
    if (bound !== actual) {
      failures.push({
        code: "input-digest-mismatch",
        stage: "input",
        inputKey: `coverage.${key}`,
        message:
          `Coverage binds ${key} to ${JSON.stringify(bound ?? "missing")}, but this run reads ${actual}. ` +
          `Regenerate identification and coverage from the exact PDF and callout manifest before rebuilding.`,
      });
    }
  }
  if (!Number.isFinite(input.minimumWholeStepScore) || input.minimumWholeStepScore < 0.4) {
    failures.push({
      code: "whole-step-score-too-low",
      stage: "input",
      inputKey: "minimumWholeStepScore",
      message:
        `Whole-step visual threshold ${input.minimumWholeStepScore} is below the measured nontrivial floor 0.4. ` +
        `A positive epsilon is not evidence; calibrate against retained real-panel scoring before lowering it.`,
    });
  }
  if (
    !Number.isInteger(input.minimumExclusiveHighlightPixelsPerPiece) ||
    input.minimumExclusiveHighlightPixelsPerPiece < 2 ||
    !isSha256Digest(input.highlightCalibrationDigest) ||
    input.highlightCalibrationDigest !== input.inputDigests.highlightCalibration
  ) {
    failures.push({
      code: "highlight-calibration-missing",
      stage: "input",
      inputKey: "highlightCalibration",
      message:
        `Whole-step evidence requires at least two exclusive highlight pixels per piece and a retained ` +
        `calibration digest; received threshold ${input.minimumExclusiveHighlightPixelsPerPiece} and ` +
        `${JSON.stringify(input.highlightCalibrationDigest ?? "missing")} against input ` +
        `${input.inputDigests.highlightCalibration}. One coincident pixel is not ` +
        `independent visual evidence.`,
    });
  }
  return failures;
}

export function unexecutedStepReport(
  panel: RealBuildPanelSpec,
  failure: StepFailure,
  input: {
    readonly blockingStep?: number | null;
    readonly documentParts?: number;
    readonly elapsedMs?: number;
    readonly reason?: string;
  } = {},
): RealBuildStepReport {
  const prerequisites = stepPrerequisiteFacts({
    stepNumber: panel.stepNumber,
    actionKind: panel.action.kind,
    blockingStep: input.blockingStep ?? null,
    coverageFailures: panel.coverageFailures,
    unresolvedCallouts: panel.unresolvedCallouts,
    missingDesigns: panel.missingDesigns,
    calloutPieces: panel.calloutPieces,
    expectedAssembledPieces: panel.action.assembledPieces,
    resolvedPieces: panel.pieces.length + panel.omittedPieces.length,
  });
  return {
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    panelFace: panel.panelFace,
    calloutPieces: panel.calloutPieces,
    expectedAssembledPieces: panel.action.assembledPieces,
    attemptedPieces: 0,
    placedPieces: 0,
    action: panel.action,
    actionEvidenceDigest: panel.action.evidenceDigest,
    canonicalStepId: null,
    prerequisites,
    outcome: {
      status: "failed",
      mechanism: "deferred",
      attemptedMechanism: null,
      failure,
    },
    validation: {
      attempted: false,
      targetDocumentHash: null,
      truthSnapshotHash: null,
      validatorSetHash: null,
      documentGloballyValid: null,
      blockingIssues: [],
      failure: input.reason ?? "Input preflight rejected the run before canonical execution.",
    },
    fit: {
      azimuthDegrees: null,
      elevationDegrees: null,
      pixelsPerUnit: null,
      residualPx: null,
      coherence: 0,
      failure: input.reason ?? "Input preflight rejected the run before panel processing.",
    },
    camera: null,
    highlight: { regions: 0, closedContourRate: 0, strokePx: 0, boundsPx: null },
    arrows: {
      kept: 0,
      redPx: 0,
      rejected: 0,
      displacementFamily: 0,
      displacementFamilyLdu: [],
    },
    pieces: [],
    jointVisual: null,
    deferral: null,
    explodedGhost: null,
    documentParts: input.documentParts ?? 0,
    elapsedMs: input.elapsedMs ?? 0,
    panelPng: null,
    buildPng: null,
  };
}

/** Retains a typed row for every requested printed step even when preflight refuses execution. */
export function inputRejectedRealBuildResult(
  options: RealBuildOptions,
  inputFailures: readonly StepFailure[],
): RealBuildResult {
  const selected = options.panels
    .filter(({ stepNumber }) => stepNumber <= options.lastStep)
    .sort((left, right) => left.stepNumber - right.stepNumber);
  const first = inputFailures[0] ?? {
    code: "run-incomplete" as const,
    stage: "input" as const,
    message:
      "Real-build input was rejected without a retained failure; this is a contract violation.",
  };
  return {
    schemaVersion: "lego.real-build-result/3",
    authority: LOCAL_REAL_BUILD_AUTHORITY,
    status: "input-rejected",
    requestedLastStep: options.lastStep,
    expectedPrintedSteps: options.expectedPrintedSteps,
    assembledTargetParts: options.targetPartCount,
    inputDigests: options.inputDigests,
    inputFailures,
    completionFailures: [],
    steps: selected.map((panel) => {
      const local = inputFailures.find(({ stepNumber }) => stepNumber === panel.stepNumber);
      return unexecutedStepReport(panel, local ?? { ...first, stepNumber: panel.stepNumber });
    }),
    documentJson: null,
    structuralHash: null,
    finalParts: 0,
    totalElapsedMs: 0,
  };
}

export function selectRequestedPanelPages(options: RealBuildOptions): {
  readonly panels: readonly RealBuildPanelSpec[];
  readonly pages: readonly number[];
} {
  const panels = options.panels.filter(({ stepNumber }) => stepNumber <= options.lastStep);
  const pages = [...new Set(panels.map(({ pageNumber }) => pageNumber))].sort(
    (left, right) => left - right,
  );
  return { panels, pages };
}

export function executeCanonicalTransition<T>(input: {
  readonly baseDocument: T;
  readonly printedStepNumber: number;
  readonly transition: "rotation" | "attachment" | "final-view";
  readonly panelEvidenceDigest: string;
  readonly steps: readonly {
    readonly id: string;
    readonly index: number;
    readonly name: string;
    readonly partIds: readonly string[];
  }[];
  readonly applyOperations: (base: T, operations: readonly unknown[]) => T;
  readonly validate: (document: T) => {
    readonly targetDocumentHash: string;
    readonly truthSnapshotHash: string;
    readonly validatorSetHash: string;
    readonly documentGloballyValid: boolean;
    readonly issues: readonly {
      readonly code: string;
      readonly severity: "blocking" | "advisory";
      readonly message: string;
      readonly path: string;
      readonly partIds: readonly string[];
    }[];
  };
}): {
  readonly document: T;
  readonly stepId: string | null;
  readonly validation: RealBuildStepReport["validation"];
  readonly failure: StepFailure | null;
} {
  try {
    const existing = input.steps.find(({ index }) => index === input.printedStepNumber - 1);
    if (existing !== undefined && existing.partIds.length > 0) {
      throw new TypeError(
        `Printed transition step ${input.printedStepNumber} collides with canonical step ${existing.id}, ` +
          `which already owns ${existing.partIds.length} part(s).`,
      );
    }
    const semanticName =
      `Step ${input.printedStepNumber} [transition:${input.transition};` +
      `panel=${input.panelEvidenceDigest}]`;
    if (existing !== undefined && existing.name !== semanticName) {
      throw new TypeError(
        `Printed transition step ${input.printedStepNumber} collides with canonical step ${existing.id}, ` +
          `whose name ${JSON.stringify(existing.name)} does not encode ${input.transition}.`,
      );
    }
    const stepId = existing?.id ?? `real-build-step-${input.printedStepNumber}`;
    const document =
      existing === undefined
        ? input.applyOperations(input.baseDocument, [
            {
              kind: "addStep",
              operationId: `real-build-transition-${input.printedStepNumber}`,
              step: {
                id: stepId,
                index: input.printedStepNumber - 1,
                name: semanticName,
                partIds: [],
              },
            },
          ])
        : input.baseDocument;
    const report = input.validate(document);
    const blockingIssues = report.issues
      .filter(({ severity }) => severity === "blocking")
      .map(({ code, message, path, partIds }) => ({ code, message, path, partIds }));
    const validation = {
      attempted: true,
      targetDocumentHash: report.targetDocumentHash,
      truthSnapshotHash: report.truthSnapshotHash,
      validatorSetHash: report.validatorSetHash,
      documentGloballyValid: report.documentGloballyValid,
      blockingIssues,
      failure: null,
    };
    if (report.documentGloballyValid && blockingIssues.length === 0) {
      return { document, stepId, validation, failure: null };
    }
    return {
      document: input.baseDocument,
      stepId: null,
      validation,
      failure: {
        code: "hard-validation-failed",
        stage: "validation",
        message:
          `Transition step ${input.printedStepNumber} created canonical BuildStep ${stepId}, but the resulting ` +
          `document has ${blockingIssues.length} blocking issue(s). The empty step was rolled back rather ` +
          `than called complete.`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      document: input.baseDocument,
      stepId: null,
      validation: {
        attempted: true,
        targetDocumentHash: null,
        truthSnapshotHash: null,
        validatorSetHash: null,
        documentGloballyValid: null,
        blockingIssues: [],
        failure: message,
      },
      failure: {
        code: "hard-validation-error",
        stage: "validation",
        message:
          `Transition step ${input.printedStepNumber} could not create and validate its canonical empty ` +
          `BuildStep: ${message}.`,
      },
    };
  }
}

export function validateRealBuildCandidate<T>(input: {
  readonly stepNumber: number;
  readonly document: T;
  readonly validate: (document: T) => {
    readonly targetDocumentHash: string;
    readonly truthSnapshotHash: string;
    readonly validatorSetHash: string;
    readonly documentGloballyValid: boolean;
    readonly issues: readonly {
      readonly code: string;
      readonly severity: "blocking" | "advisory";
      readonly message: string;
      readonly path: string;
      readonly partIds: readonly string[];
    }[];
  };
}): {
  readonly passed: boolean;
  readonly validation: RealBuildStepReport["validation"];
  readonly failure: StepFailure | null;
} {
  try {
    const report = input.validate(input.document);
    const blockingIssues = report.issues
      .filter(({ severity }) => severity === "blocking")
      .map(({ code, message, path, partIds }) => ({ code, message, path, partIds }));
    const passed = report.documentGloballyValid && blockingIssues.length === 0;
    return {
      passed,
      validation: {
        attempted: true,
        targetDocumentHash: report.targetDocumentHash,
        truthSnapshotHash: report.truthSnapshotHash,
        validatorSetHash: report.validatorSetHash,
        documentGloballyValid: report.documentGloballyValid,
        blockingIssues,
        failure: null,
      },
      failure: passed
        ? null
        : {
            code: "hard-validation-failed",
            stage: "validation",
            message:
              `Step ${input.stepNumber} produced ${blockingIssues.length} blocking hard-validator issue(s): ` +
              `${blockingIssues.map(({ code }) => code).join(", ") || "documentGloballyValid was false"}. ` +
              `The complete printed step was rolled back.`,
          },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      validation: {
        attempted: true,
        targetDocumentHash: null,
        truthSnapshotHash: null,
        validatorSetHash: null,
        documentGloballyValid: null,
        blockingIssues: [],
        failure: message,
      },
      failure: {
        code: "hard-validation-error",
        stage: "validation",
        message:
          `Step ${input.stepNumber} could not be hard-validated: ${message}. Validator failure cannot be ` +
          `treated as a valid document.`,
      },
    };
  }
}

export function assessWholeStepVisualEvidence(input: {
  readonly stepNumber: number;
  readonly score: number;
  readonly minimumScore: number;
  readonly minimumExclusiveHighlightPixelsPerPiece: number;
  readonly calibrationDigest: string | null;
  readonly unionHighlightPixels: number;
  readonly summedPieceHighlightPixels: number;
  readonly exclusiveHighlightPixelsByPiece: readonly number[];
}): WholeStepVisualEvidence {
  const facts = {
    score: Number.isFinite(input.score) ? input.score : null,
    minimumScore: input.minimumScore,
    minimumExclusiveHighlightPixelsPerPiece: input.minimumExclusiveHighlightPixelsPerPiece,
    calibrationDigest: input.calibrationDigest,
    unionHighlightPixels: input.unionHighlightPixels,
    summedPieceHighlightPixels: input.summedPieceHighlightPixels,
    exclusiveHighlightPixelsByPiece: input.exclusiveHighlightPixelsByPiece,
  };
  if (
    !Number.isFinite(input.minimumScore) ||
    input.minimumScore < 0.4 ||
    !Number.isFinite(input.score) ||
    input.score < input.minimumScore
  ) {
    return {
      ...facts,
      failure: {
        code: "whole-step-score-too-low",
        stage: "evidence",
        message:
          `Step ${input.stepNumber} joint visual score is ${input.score}, below the measured threshold ` +
          `${input.minimumScore}. The whole printed step is refused; a positive score alone is not evidence.`,
      },
    };
  }
  const calibrationValid =
    Number.isInteger(input.minimumExclusiveHighlightPixelsPerPiece) &&
    input.minimumExclusiveHighlightPixelsPerPiece >= 2 &&
    isSha256Digest(input.calibrationDigest);
  const unexplained = input.exclusiveHighlightPixelsByPiece
    .map((pixels, pieceIndex) => ({ pixels, pieceIndex }))
    .filter(
      ({ pixels }) =>
        !Number.isInteger(pixels) || pixels < input.minimumExclusiveHighlightPixelsPerPiece,
    );
  if (
    !calibrationValid ||
    input.unionHighlightPixels <= 0 ||
    input.summedPieceHighlightPixels < input.unionHighlightPixels ||
    unexplained.length > 0
  ) {
    const pieceIndex = unexplained[0]?.pieceIndex;
    return {
      ...facts,
      failure: {
        code: "highlight-reuse-unexplained",
        stage: "evidence",
        ...(pieceIndex === undefined ? {} : { pieceIndex }),
        message:
          `Step ${input.stepNumber} cannot explain its joint highlight coverage: union ` +
          `${input.unionHighlightPixels}px, summed per-piece ${input.summedPieceHighlightPixels}px, ` +
          `exclusive pixels [${input.exclusiveHighlightPixelsByPiece.join(", ")}], required minimum ` +
          `${input.minimumExclusiveHighlightPixelsPerPiece}px per piece, calibration ` +
          `${JSON.stringify(input.calibrationDigest ?? "missing")}. Every placed piece must explain a ` +
          `calibrated amount of distinct printed evidence; several greedy pieces cannot reuse one highlight.`,
      },
    };
  }
  return { ...facts, failure: null };
}

export function measureWholeStepMaskEvidence(
  pieceMasks: readonly Uint8Array[],
  highlightMask: Uint8Array,
): {
  readonly unionHighlightPixels: number;
  readonly summedPieceHighlightPixels: number;
  readonly exclusiveHighlightPixelsByPiece: readonly number[];
} {
  let unionHighlightPixels = 0;
  let summedPieceHighlightPixels = 0;
  const exclusiveHighlightPixelsByPiece = pieceMasks.map(() => 0);
  for (let pixel = 0; pixel < highlightMask.length; pixel += 1) {
    if (highlightMask[pixel] !== 1) continue;
    const owners: number[] = [];
    for (let owner = 0; owner < pieceMasks.length; owner += 1) {
      if (pieceMasks[owner]?.[pixel] === 1) owners.push(owner);
    }
    if (owners.length > 0) unionHighlightPixels += 1;
    summedPieceHighlightPixels += owners.length;
    if (owners.length === 1) {
      const owner = owners[0]!;
      exclusiveHighlightPixelsByPiece[owner] = (exclusiveHighlightPixelsByPiece[owner] ?? 0) + 1;
    }
  }
  return {
    unionHighlightPixels,
    summedPieceHighlightPixels,
    exclusiveHighlightPixelsByPiece,
  };
}

export function maskCentroid(mask: Uint8Array, width: number, height: number) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      sumX += x;
      sumY += y;
      count += 1;
    }
  }
  return count === 0 ? null : { x: sumX / count, y: sumY / count, count };
}

export function shiftedMaskIou(input: {
  readonly mask: Uint8Array;
  readonly target: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly dx: number;
  readonly dy: number;
}): number {
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < input.height; y += 1) {
    const sourceY = y - input.dy;
    for (let x = 0; x < input.width; x += 1) {
      const sourceX = x - input.dx;
      const here =
        sourceX < 0 || sourceX >= input.width || sourceY < 0 || sourceY >= input.height
          ? 0
          : input.mask[sourceY * input.width + sourceX]!;
      const there = input.target[y * input.width + x]!;
      if (here === 1 && there === 1) intersection += 1;
      if (here === 1 || there === 1) union += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

export function instructionSilhouetteMasks(
  pixels: Uint8Array,
  width: number,
  height: number,
  probeHex: number,
): { readonly all: Uint8Array; readonly probe: Uint8Array } {
  const all = new Uint8Array(width * height);
  const probe = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const red = pixels[index * 4]!;
    const green = pixels[index * 4 + 1]!;
    const blue = pixels[index * 4 + 2]!;
    const key = (red << 16) | (green << 8) | blue;
    const isBackground =
      Math.abs(red - 0x89) <= 6 && Math.abs(green - 0x90) <= 6 && Math.abs(blue - 0x93) <= 6;
    if (!isBackground) all[index] = 1;
    if (key === probeHex) probe[index] = 1;
  }
  return { all, probe };
}

export function adjudicateSearchBenchmark(input: {
  readonly stepNumber: number;
  readonly pruned: SearchStrategyEvidence;
  readonly exhaustive: SearchStrategyEvidence;
}): { readonly accepted: SearchStrategy | null; readonly failure: StepFailure | null } {
  const comparableScores =
    input.pruned.bestScore !== null &&
    input.exhaustive.bestScore !== null &&
    Number.isFinite(input.pruned.bestScore) &&
    Number.isFinite(input.exhaustive.bestScore) &&
    Math.abs(input.pruned.bestScore - input.exhaustive.bestScore) <= 1e-12;
  if (
    input.pruned.failure === null &&
    input.exhaustive.failure === null &&
    input.pruned.winnerKey !== null &&
    input.pruned.winnerKey === input.exhaustive.winnerKey &&
    input.pruned.rendered > 0 &&
    input.exhaustive.rendered > 0 &&
    comparableScores
  ) {
    return { accepted: "pruned", failure: null };
  }
  // Each strategy reports its own outcome in its own words. A strategy that
  // refused has a message saying what it refused over — how many candidates were
  // eligible, what budget they passed — and interpolating only its failure code
  // throws that away, leaving a disagreement nobody can act on without rerunning
  // the step.
  const summarise = (evidence: SearchStrategyEvidence): string =>
    `${evidence.strategy}: ${evidence.winnerKey ?? evidence.failure?.code ?? "none"} score ` +
    `${evidence.bestScore ?? "none"} from ${evidence.rendered} renders in ${evidence.elapsedMs}ms` +
    `${evidence.failure === null ? "" : ` — ${evidence.failure.message}`}`;
  return {
    accepted: null,
    failure: {
      code: "benchmark-disagreement",
      stage: "benchmark",
      message:
        `Step ${input.stepNumber} pruned and exhaustive search do not establish the same independently ` +
        `scored winner at the same quality. ${summarise(input.pruned)}; ${summarise(input.exhaustive)}. ` +
        `A digest or declared policy cannot turn unresolved visual disagreement into reconstruction truth.`,
    },
  };
}
