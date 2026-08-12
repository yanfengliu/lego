import {
  panelCameraMeasurementDefect,
  parseRealBuildPanelCameraEvidence,
  realBuildPanelCameraEvidenceMaximumEntries,
  type RealBuildPanelCameraEvidence,
} from "./real-build-panel-camera-evidence";
import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import {
  type AcceptedCanonicalStepSemantics,
  canonicalTransitionAdvance,
  type PanelCameraCanonicalTransitionWitness,
} from "./real-build-browser-output-transition-continuity";
import {
  priorBlockDefect,
  recordAcceptedStep,
  rootSeedRefusalIsPrePlacement,
} from "./real-build-browser-output-blocked-policy";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export interface PanelCameraLineageContinuityState {
  readonly eligibleParents: Set<string>;
  readonly seenLineages: Set<string>;
  readonly expectedRootDocumentHash: string;
  readonly canonicalTransitionWitnesses: ReadonlyMap<number, PanelCameraCanonicalTransitionWitness>;
  readonly acceptedSteps: Map<number, AcceptedCanonicalStepSemantics>;
  acceptedDocumentHash: string;
  acceptedDocumentParts: number;
  seededRoot: boolean;
  reservedAfter: number;
  blockingStep: number | null;
}

export function createPanelCameraLineageContinuityState(
  expectedRootDocumentHash: string,
  canonicalTransitionWitnesses: ReadonlyMap<
    number,
    PanelCameraCanonicalTransitionWitness
  > = new Map(),
): PanelCameraLineageContinuityState {
  return {
    eligibleParents: new Set(),
    seenLineages: new Set(),
    expectedRootDocumentHash,
    canonicalTransitionWitnesses,
    acceptedSteps: new Map(),
    acceptedDocumentHash: expectedRootDocumentHash,
    acceptedDocumentParts: 0,
    seededRoot: false,
    reservedAfter: 0,
    blockingStep: null,
  };
}

function retainBlockingStep(
  report: Record<string, unknown>,
  index: number,
  state: PanelCameraLineageContinuityState,
): void {
  const outcome = isRecord(report.outcome) ? report.outcome : null;
  if (state.blockingStep === null && outcome?.status === "failed") {
    state.blockingStep = index + 1;
  }
}

function lineageContinuityDefect(
  evidence: RealBuildPanelCameraEvidence,
  index: number,
  report: Record<string, unknown>,
  state: PanelCameraLineageContinuityState,
): string | null {
  const root = evidence.status === "seeded";
  const transition = canonicalTransitionAdvance({
    report,
    evidence,
    reportIndex: index,
    acceptedDocumentHash: state.acceptedDocumentHash,
    acceptedDocumentParts: state.acceptedDocumentParts,
    witnesses: state.canonicalTransitionWitnesses,
  });
  if (transition.kind === "rejected") return transition.defect;
  if (evidence.reservation.reservedBefore !== state.reservedAfter) {
    return (
      `Replay browser-output report[${index}].panelCamera resets or skips the cumulative branch ledger: ` +
      `reservedBefore ${evidence.reservation.reservedBefore} does not equal prior reservedAfter ${state.reservedAfter}.`
    );
  }
  if (root && (index !== 0 || state.seededRoot || state.seenLineages.size !== 0)) {
    return `Replay browser-output report[${index}].panelCamera introduces a second or non-initial step-0 camera root.`;
  }
  if (!root && !state.seededRoot) {
    return `Replay browser-output report[${index}].panelCamera has no earlier retained eight-way camera root.`;
  }
  if (
    root &&
    (evidence.throughStepNumber !== 0 ||
      evidence.registrationPanelStepNumber !== 1 ||
      evidence.candidates[0]?.documentHash !== state.expectedRootDocumentHash)
  ) {
    return (
      `Replay browser-output report[0].panelCamera root must bind the deterministic canonical empty ` +
      `real-build document ${state.expectedRootDocumentHash} at prefix 0/panel 1.`
    );
  }
  if (evidence.status === "budget-refused") {
    const expectedRequest = state.eligibleParents.size * 8;
    if (evidence.reservation.requested !== expectedRequest) {
      return (
        `Replay browser-output report[${index}].panelCamera budget refusal requests ` +
        `${evidence.reservation.requested} branches, but the complete retained frontier has ` +
        `${state.eligibleParents.size} parent lineage(s) and therefore requires ${expectedRequest}.`
      );
    }
    state.reservedAfter = evidence.reservation.reservedAfter;
    return null;
  }
  if (!root) {
    const retainedParents = new Set<string>();
    for (const candidate of evidence.candidates) {
      for (const parent of candidate.parentLineageIds) {
        retainedParents.add(parent);
        if (!state.eligibleParents.has(parent)) {
          return (
            `Replay browser-output report[${index}].panelCamera candidate ${JSON.stringify(candidate.candidateId)} ` +
            `names parent ${JSON.stringify(parent)} that was not a root seed or selected lineage in an earlier readable report.`
          );
        }
      }
    }
    if (retainedParents.size !== state.eligibleParents.size) {
      return (
        `Replay browser-output report[${index}].panelCamera does not carry the complete preceding ` +
        `camera frontier: expected ${state.eligibleParents.size} parent lineages but retained ${retainedParents.size}.`
      );
    }
  }
  for (const observation of evidence.observations) {
    if (state.seenLineages.has(observation.lineageId)) {
      return `Replay browser-output report[${index}].panelCamera repeats earlier lineage ${JSON.stringify(observation.lineageId)}.`;
    }
  }
  for (const observation of evidence.observations) state.seenLineages.add(observation.lineageId);
  state.reservedAfter = evidence.reservation.reservedAfter;
  if (root) {
    state.seededRoot = true;
    for (const observation of evidence.observations) {
      state.eligibleParents.add(observation.lineageId);
    }
    if (transition.kind === "accepted") {
      state.acceptedDocumentHash = transition.targetDocumentHash;
      recordAcceptedStep(report, index, state);
    } else if (isRecord(report.outcome) && report.outcome.status === "complete") {
      const validation = isRecord(report.validation) ? report.validation : null;
      if (typeof validation?.targetDocumentHash !== "string") {
        return `Replay browser-output report[${index}] accepted root transition has no validated target hash.`;
      }
      state.acceptedDocumentHash = validation.targetDocumentHash;
    }
  } else if (transition.kind === "accepted") {
    state.eligibleParents.clear();
    for (const observation of evidence.observations) {
      state.eligibleParents.add(observation.lineageId);
    }
    state.acceptedDocumentHash = transition.targetDocumentHash;
    recordAcceptedStep(report, index, state);
  } else if (isRecord(report.outcome) && report.outcome.status === "complete") {
    const validation = isRecord(report.validation) ? report.validation : null;
    const completedTarget = validation?.targetDocumentHash;
    if (typeof completedTarget !== "string") {
      return `Replay browser-output report[${index}] completes without a validated target document hash for camera-lineage continuity.`;
    }
    if (
      !Number.isSafeInteger(report.documentParts) ||
      report.documentParts !==
        state.acceptedDocumentParts + (report.expectedAssembledPieces as number)
    ) {
      return (
        `Replay browser-output report[${index}] completed placement reports documentParts ` +
        `${String(report.documentParts)}, but accepted continuity requires ` +
        `${state.acceptedDocumentParts + (report.expectedAssembledPieces as number)}.`
      );
    }
    if (report.expectedAssembledPieces === 0 && completedTarget !== state.acceptedDocumentHash) {
      return (
        `Replay browser-output report[${index}] zero-piece transition changes accepted document hash from ` +
        `${state.acceptedDocumentHash} to ${completedTarget}.`
      );
    }
    const selectedCandidates = evidence.candidates.filter(
      ({ documentHash, selectedObservationId, selectedLineageIds }) =>
        documentHash === completedTarget &&
        selectedObservationId !== null &&
        selectedLineageIds.length > 0,
    );
    if (selectedCandidates.length !== 1) {
      return `Replay browser-output report[${index}] must promote exactly one selected candidate at validated target ${completedTarget}.`;
    }
    state.eligibleParents.clear();
    for (const selected of selectedCandidates[0]!.selectedLineageIds) {
      state.eligibleParents.add(selected.lineageId);
    }
    state.acceptedDocumentHash = completedTarget;
    recordAcceptedStep(report, index, state);
  }
  return null;
}

/** Cross-field policy for the panel-camera evidence nested in a /3 step report. */
function panelCameraEvidenceDefectUnchecked(
  value: unknown,
  report: unknown,
  index: number,
  branchBudget: number,
  continuity: PanelCameraLineageContinuityState,
  measurementBoundary?: {
    readonly pdfDigest: string;
    readonly panels: readonly {
      readonly stepNumber: number;
      readonly pageNumber: number;
      readonly minXPt: number;
      readonly maxXPt: number;
      readonly minYPt: number;
      readonly maxYPt: number;
      readonly panelFace: "studs-up" | "underside" | null;
    }[];
  },
): string | null {
  if (!isRecord(report)) {
    return `Replay browser-output report[${index}] must be an object before panel-camera evidence can be bound to it.`;
  }
  const outcome = isRecord(report.outcome) ? report.outcome : null;
  const prerequisites = isRecord(report.prerequisites) ? report.prerequisites : null;
  const placementStep =
    Number.isSafeInteger(report.expectedAssembledPieces) &&
    (report.expectedAssembledPieces as number) > 0;

  const blocked = priorBlockDefect(report, index, continuity);
  if (blocked !== null) return blocked;
  if (continuity.blockingStep !== null && value !== null) {
    return (
      `Replay browser-output report[${index}].panelCamera must be null after failed printed step ` +
      `${continuity.blockingStep}; an unattempted blocked row cannot retain later camera work.`
    );
  }

  if (value === null) {
    if (index === 0) {
      return "Replay browser-output report[0].panelCamera must retain the eight-way step-0 root even when printed step 1 places no pieces.";
    }
    const neverAttemptedByPriorFailure =
      outcome?.status === "failed" &&
      outcome.attemptedMechanism === null &&
      continuity.blockingStep !== null &&
      prerequisites?.blockingStep === continuity.blockingStep;
    if (placementStep && !neverAttemptedByPriorFailure) {
      return `Replay browser-output report[${index}].panelCamera is null for a placement step that is not causally blocked by an earlier accepted failed report.`;
    }
    retainBlockingStep(report, index, continuity);
    return null;
  }

  let evidence: RealBuildPanelCameraEvidence;
  try {
    evidence = parseRealBuildPanelCameraEvidence(
      value,
      realBuildPanelCameraEvidenceMaximumEntries(branchBudget),
    );
  } catch (error) {
    return `Replay browser-output report[${index}].panelCamera is invalid: ${describeBrowserThrown(error)}`;
  }
  const expectedStep = index + 1;
  const ownPanelPrefix =
    evidence.throughStepNumber === expectedStep - 1 &&
    evidence.registrationPanelStepNumber === expectedStep;
  const laterPanelWitness =
    evidence.throughStepNumber === expectedStep &&
    evidence.registrationPanelStepNumber > expectedStep;
  if ((!ownPanelPrefix && !laterPanelWitness) || evidence.reservation.budget !== branchBudget) {
    return (
      `Replay browser-output report[${index}].panelCamera must bind either prefix ${expectedStep - 1} ` +
      `to its own panel ${expectedStep}, or candidate step ${expectedStep} to a strictly later witness, ` +
      `under run branch budget ${branchBudget}; received prefix ` +
      `${String(evidence.throughStepNumber)}, panel ${evidence.registrationPanelStepNumber}, and budget ` +
      `${evidence.reservation.budget}.`
    );
  }
  if (
    ownPanelPrefix &&
    evidence.status !== "seeded" &&
    evidence.status !== "budget-refused" &&
    evidence.candidates.some(({ documentHash }) => documentHash !== continuity.acceptedDocumentHash)
  ) {
    return (
      `Replay browser-output report[${index}].panelCamera own-panel prefix must keep accepted ` +
      `document hash ${continuity.acceptedDocumentHash}; a camera observation cannot rewrite structure.`
    );
  }
  const selected =
    evidence.status === "observed" &&
    evidence.candidates.some(
      ({ selectedObservationId, selectedLineageIds }) =>
        selectedObservationId !== null && selectedLineageIds.length > 0,
    );
  if (placementStep && outcome?.status === "complete" && !selected) {
    return (
      `Replay browser-output report[${index}] claims a complete placement while panelCamera ` +
      `${evidence.status} selects no observation lineage. An unselected, seed-only, failed, or ` +
      `unresolved D4 frontier cannot authorize scalar placement.`
    );
  }
  if (placementStep && outcome?.status === "complete") {
    const validation = isRecord(report.validation) ? report.validation : null;
    const target = validation?.targetDocumentHash;
    const selectedTarget = evidence.candidates.find(
      ({ documentHash, selectedObservationId, selectedLineageIds }) =>
        documentHash === target && selectedObservationId !== null && selectedLineageIds.length > 0,
    );
    if (
      validation?.attempted !== true ||
      validation.documentGloballyValid !== true ||
      !Array.isArray(validation.blockingIssues) ||
      validation.blockingIssues.length !== 0 ||
      validation.failure !== null ||
      typeof target !== "string" ||
      selectedTarget === undefined ||
      report.placedPieces !== report.expectedAssembledPieces ||
      typeof report.canonicalStepId !== "string" ||
      report.canonicalStepId.length === 0
    ) {
      return (
        `Replay browser-output report[${index}] complete placement must bind its successful validation ` +
        `target hash, complete piece count, and canonical step to the selected panel-camera candidate.`
      );
    }
  }
  if (evidence.measurement !== null) {
    if (measurementBoundary === undefined) {
      return `Replay browser-output report[${index}].panelCamera measurement has no prepared PDF/panel boundary.`;
    }
    const measurementPanel = measurementBoundary.panels.find(
      ({ stepNumber }) => stepNumber === evidence.registrationPanelStepNumber,
    );
    if (measurementPanel === undefined) {
      return (
        `Replay browser-output report[${index}].panelCamera measurement names registration panel ` +
        `${evidence.registrationPanelStepNumber}, but that panel is absent from the prepared run.`
      );
    }
    const measurementDefect = panelCameraMeasurementDefect(evidence.measurement, {
      pdfDigest: measurementBoundary.pdfDigest,
      panel: measurementPanel,
      report,
    });
    if (measurementDefect !== null) {
      return `Replay browser-output report[${index}].panelCamera ${measurementDefect}.`;
    }
  }
  if (
    evidence.status === "seeded" &&
    (() => {
      const failedSeed = rootSeedRefusalIsPrePlacement(report, outcome);
      const acceptedTransition = canonicalTransitionAdvance({
        report,
        evidence,
        reportIndex: index,
        acceptedDocumentHash: continuity.acceptedDocumentHash,
        acceptedDocumentParts: continuity.acceptedDocumentParts,
        witnesses: continuity.canonicalTransitionWitnesses,
      });
      return !failedSeed && acceptedTransition.kind !== "accepted";
    })()
  ) {
    return (
      `Replay browser-output report[${index}] retains only unregistered panel-camera seeds but does not ` +
      `retain an unattempted zero-placement refusal. Seed-only evidence cannot authorize a placement or ` +
      `stand in for an independently reconstructed canonical transition.`
    );
  }
  if (index === 0 && evidence.status !== "seeded") {
    return "Replay browser-output report[0].panelCamera must be the eight-way step-0 seeded root; a later witness or budget refusal cannot replace it.";
  }
  if (evidence.status === "budget-refused") {
    const outcomeFailure =
      outcome?.status === "failed" && isRecord(outcome.failure) ? outcome.failure : null;
    const evidenceFailure = evidence.failure;
    if (
      evidenceFailure === null ||
      outcomeFailure === null ||
      outcomeFailure.code !== evidenceFailure.code ||
      outcomeFailure.stage !== evidenceFailure.stage ||
      outcomeFailure.stepNumber !== evidenceFailure.stepNumber ||
      outcomeFailure.message !== evidenceFailure.message ||
      report.placedPieces !== 0 ||
      report.canonicalStepId !== null
    ) {
      return (
        `Replay browser-output report[${index}].panelCamera budget refusal must reproduce its exact typed ` +
        `failure in a zero-placement failed outcome and cannot retain a canonical step.`
      );
    }
  }
  const continuityDefect = lineageContinuityDefect(evidence, index, report, continuity);
  if (continuityDefect !== null) return continuityDefect;
  retainBlockingStep(report, index, continuity);
  return null;
}

/** Contains every hostile descriptor/array trap at the untrusted evidence boundary. */
export function panelCameraEvidenceDefect(
  value: unknown,
  report: unknown,
  index: number,
  branchBudget: number,
  continuity: PanelCameraLineageContinuityState,
  measurementBoundary?: {
    readonly pdfDigest: string;
    readonly panels: readonly {
      readonly stepNumber: number;
      readonly pageNumber: number;
      readonly minXPt: number;
      readonly maxXPt: number;
      readonly minYPt: number;
      readonly maxYPt: number;
      readonly panelFace: "studs-up" | "underside" | null;
    }[];
  },
): string | null {
  try {
    const scratch: PanelCameraLineageContinuityState = {
      eligibleParents: new Set(continuity.eligibleParents),
      seenLineages: new Set(continuity.seenLineages),
      expectedRootDocumentHash: continuity.expectedRootDocumentHash,
      canonicalTransitionWitnesses: continuity.canonicalTransitionWitnesses,
      acceptedSteps: new Map(continuity.acceptedSteps),
      acceptedDocumentHash: continuity.acceptedDocumentHash,
      acceptedDocumentParts: continuity.acceptedDocumentParts,
      seededRoot: continuity.seededRoot,
      reservedAfter: continuity.reservedAfter,
      blockingStep: continuity.blockingStep,
    };
    const defect = panelCameraEvidenceDefectUnchecked(
      value,
      report,
      index,
      branchBudget,
      scratch,
      measurementBoundary,
    );
    if (defect !== null) return defect;
    continuity.eligibleParents.clear();
    for (const parent of scratch.eligibleParents) continuity.eligibleParents.add(parent);
    continuity.seenLineages.clear();
    for (const lineage of scratch.seenLineages) continuity.seenLineages.add(lineage);
    continuity.acceptedDocumentHash = scratch.acceptedDocumentHash;
    continuity.acceptedDocumentParts = scratch.acceptedDocumentParts;
    continuity.acceptedSteps.clear();
    for (const [stepNumber, step] of scratch.acceptedSteps) {
      continuity.acceptedSteps.set(stepNumber, step);
    }
    continuity.seededRoot = scratch.seededRoot;
    continuity.reservedAfter = scratch.reservedAfter;
    continuity.blockingStep = scratch.blockingStep;
    return null;
  } catch (error) {
    return (
      `Replay browser-output report[${index}].panelCamera could not be safely inspected: ` +
      `${describeBrowserThrown(error)}.`
    );
  }
}
