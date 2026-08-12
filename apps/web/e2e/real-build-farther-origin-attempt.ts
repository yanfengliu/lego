import type { DeferredUnresolvedCandidate } from "./real-build-deferred-step";
import { runFartherOriginPanelProbe } from "./real-build-farther-origin-probe";
import {
  measuredFartherOriginKReportIneligibility,
  measuredFartherOriginProbeIneligibility,
} from "./real-build-farther-origin-policy";
import type { FartherOriginEvidence, FartherRefusal } from "./real-build-farther-panel-types";
import {
  scoreFartherDocumentsAgainstPanel,
  type FartherPanelScoreResult,
} from "./real-build-farther-scoring";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import { rgbaPngDataUrl, type PreparedRealBuildModules } from "./real-build-browser-preflight";
import type {
  RealBuildFartherCapture,
  RealBuildFartherEvidence,
  RealBuildOptions,
  RealBuildPanelSpec,
  StepFailure,
} from "./real-build-safety";

export interface FartherOriginStepAttempt<D> {
  readonly evidence: RealBuildFartherEvidence;
  readonly captures: readonly RealBuildFartherCapture[];
  readonly selectedOrigin: DeferredUnresolvedCandidate<D> | null;
  readonly failure: StepFailure | null;
}

export const fartherFailure = (
  originStepNumber: number,
  refusal: RealBuildFartherEvidence["refusal"],
): StepFailure | null =>
  refusal === null
    ? null
    : {
        code: refusal.stage === "budget" ? "resource-budget-exhausted" : "deferred-panel-unscored",
        stage: refusal.stage === "input" ? "evidence" : refusal.stage,
        stepNumber: originStepNumber,
        message: refusal.message,
      };

/** Runs the source-bound measured step-5 origin-at-K shortcut, or returns null when ineligible. */
export async function attemptMeasuredFartherOrigin<D>(input: {
  readonly originSpec: RealBuildPanelSpec;
  readonly baseDocument: D;
  readonly baseDocumentHash: string;
  readonly origins: readonly DeferredUnresolvedCandidate<D>[];
  readonly originEvidence: FartherOriginEvidence;
  readonly interveningSpec: RealBuildPanelSpec;
  readonly interveningEvidence: PanelRasterEvidence;
  readonly interveningScore: FartherPanelScoreResult;
  readonly fartherSpec: RealBuildPanelSpec | null;
  readonly loadFartherEvidence: (() => Promise<PanelRasterEvidence>) | null;
  readonly options: RealBuildOptions;
  readonly modules: Pick<PreparedRealBuildModules, "rendering" | "kernel">;
  readonly scoreMeasuredOriginPanel?: typeof scoreFartherDocumentsAgainstPanel;
}): Promise<FartherOriginStepAttempt<D> | null> {
  const { originSpec, interveningSpec, options, modules } = input;
  if (
    measuredFartherOriginProbeIneligibility({
      originSpec,
      interveningSpec,
      fartherSpec: input.fartherSpec,
      origins: input.origins,
      options,
    }) !== null ||
    input.fartherSpec === null ||
    input.loadFartherEvidence === null
  ) {
    return null;
  }

  const fartherSpec = input.fartherSpec;
  const loadFartherEvidence = input.loadFartherEvidence;
  let directEvidence: PanelRasterEvidence | null = null;
  const direct = await runFartherOriginPanelProbe({
    originStepNumber: originSpec.stepNumber,
    origins: input.origins,
    originEvidence: input.originEvidence,
    originPanelObservation: input.interveningScore.observation,
    fartherStepNumber: fartherSpec.stepNumber,
    minimumAgreement: options.minimumDeferredAgreement,
    minimumMargin: options.minimumDeferredAgreementMargin,
    maximumPanelRenders: options.fartherPanelRenderBudget,
    maximumReachSteps: options.fartherPanelMaximumReachSteps,
    hashDocument: (document) => modules.kernel.documentStructuralHash(document) as string,
    verifyExternalState: () => {
      const actual = modules.kernel.documentStructuralHash(input.baseDocument) as string;
      return actual === input.baseDocumentHash
        ? null
        : `The K scoring anchor declares base document hash ${JSON.stringify(input.baseDocumentHash)}, but ` +
            `documentStructuralHash returned ${JSON.stringify(actual)}.`;
    },
    scoreOriginPanel: async ({ origins: exactOrigins, reservation }) => {
      const beforeBaseHash = modules.kernel.documentStructuralHash(input.baseDocument) as string;
      if (beforeBaseHash !== input.baseDocumentHash) {
        throw new Error(
          `The K scoring anchor declares base document hash ${JSON.stringify(input.baseDocumentHash)}, but ` +
            `documentStructuralHash returned ${JSON.stringify(beforeBaseHash)} before loading the panel.`,
        );
      }
      directEvidence = await loadFartherEvidence();
      const afterLoadBaseHash = modules.kernel.documentStructuralHash(input.baseDocument) as string;
      if (afterLoadBaseHash !== input.baseDocumentHash) {
        throw new Error(
          `The K scoring anchor declares base document hash ${JSON.stringify(input.baseDocumentHash)}, but ` +
            `documentStructuralHash returned ${JSON.stringify(afterLoadBaseHash)} after loading the panel.`,
        );
      }
      const score = (input.scoreMeasuredOriginPanel ?? scoreFartherDocumentsAgainstPanel)({
        spec: fartherSpec,
        evidence: directEvidence,
        anchorDocument: input.baseDocument,
        candidates: exactOrigins,
        reservedPanelRenders: reservation.reservedForPanel,
        subject: "origin",
        measure: "containment",
        options,
        rendering: modules.rendering,
      });
      const afterScoreBaseHash = modules.kernel.documentStructuralHash(
        input.baseDocument,
      ) as string;
      if (afterScoreBaseHash !== input.baseDocumentHash) {
        throw new Error(
          `The K scoring anchor declares base document hash ${JSON.stringify(input.baseDocumentHash)}, but ` +
            `documentStructuralHash returned ${JSON.stringify(afterScoreBaseHash)} after scoring the panel.`,
        );
      }
      return score;
    },
  });
  const originCandidateReports = input.origins.map(
    ({ candidateId, documentHash, pieces, lookaheadAgreement, lookaheadShiftPx }) => ({
      candidateId,
      documentHash,
      pieces,
      lookaheadAgreement,
      lookaheadShiftPx,
    }),
  );
  const captures: RealBuildFartherCapture[] = [];
  const addPanelCaptures = (score: FartherPanelScoreResult, evidence: PanelRasterEvidence) => {
    captures.push({
      captureId: captures.length,
      role: "source-panel",
      panelStepNumber: score.observation.stepNumber,
      candidateId: null,
      png: rgbaPngDataUrl(evidence.workPixels, evidence.width, evidence.height),
    });
    for (const candidate of score.candidatePngs) {
      captures.push({
        captureId: captures.length,
        role: "candidate-render",
        panelStepNumber: score.observation.stepNumber,
        candidateId: candidate.candidateId,
        png: candidate.png,
      });
    }
  };
  if (direct.evidence.panels.some(({ stepNumber }) => stepNumber === interveningSpec.stepNumber)) {
    addPanelCaptures(input.interveningScore, input.interveningEvidence);
  }
  if (
    direct.score !== null &&
    directEvidence !== null &&
    direct.evidence.panels.some(({ stepNumber }) => stepNumber === fartherSpec.stepNumber)
  ) {
    addPanelCaptures(direct.score, directEvidence);
  }
  const decision =
    direct.decision === null
      ? null
      : {
          originCandidateId: direct.decision.originCandidateId,
          revealingStepNumber: direct.decision.revealingStepNumber,
          survivingCandidateIds: direct.decision.survivingCandidateIds,
          rejectedCandidateIds: direct.decision.rejectedCandidateIds,
          descendantSettled: true as const,
        };
  const calibrationDefect =
    decision === null || direct.score === null
      ? null
      : measuredFartherOriginKReportIneligibility({
          kPanel: direct.evidence.panels.find(
            ({ stepNumber }) => stepNumber === fartherSpec.stepNumber,
          ) as unknown as Record<string, unknown> | undefined,
          decision,
        });
  const calibratedDecision = calibrationDefect === null ? decision : null;
  const calibratedRefusal: FartherRefusal | null =
    calibrationDefect === null
      ? direct.refusal
      : {
          code: "calibration-mismatch",
          stage: "evidence",
          stepNumber: fartherSpec.stepNumber,
          message:
            `Panel ${fartherSpec.stepNumber} retained both exact origin scores, but they differ from ` +
            `the source-bound measured calibration: ${calibrationDefect}. No origin was selected and the ` +
            `measured shortcut is refused until its calibration is reviewed.`,
        };
  const evidence: RealBuildFartherEvidence = {
    origin: { evidence: input.originEvidence, candidates: originCandidateReports },
    carries: [],
    panels: direct.evidence.panels,
    budgets: {
      offeredCandidates: 0,
      maximumCandidates: options.deferredCandidateBudget,
      narrowingRenders: 0,
      maximumNarrowingRenders: options.deferredNarrowingRenderBudget,
      panelRenders: direct.evidence.panelRenders,
      maximumPanelRenders: options.fartherPanelRenderBudget,
      reachSteps: direct.evidence.panels.at(-1)?.reachSteps ?? 0,
      maximumReachSteps: options.fartherPanelMaximumReachSteps,
      refusedReservation: false,
      failedNarrowingReservation: null,
      candidateRefusedReservation: false,
      failedCandidateReservation: null,
    },
    refusal: calibratedRefusal,
    decision: calibratedDecision,
  };
  return {
    evidence,
    captures,
    selectedOrigin:
      calibratedDecision === null
        ? null
        : (input.origins.find(
            ({ candidateId }) => candidateId === calibratedDecision.originCandidateId,
          ) ?? null),
    failure: fartherFailure(originSpec.stepNumber, calibratedRefusal),
  };
}
