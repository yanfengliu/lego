import { createNarrowingRenderBudgetLedger } from "./real-build-deferral";
import { createNarrowingSubjectRenderBudgetLedger } from "./real-build-narrowing-subject-budget";
import type { DeferredUnresolvedCandidate } from "./real-build-deferred-step";
import { runFartherPanelDriver } from "./real-build-farther-driver";
import { attemptMeasuredFartherOrigin, fartherFailure } from "./real-build-farther-origin-attempt";
import { findFirstRevealingPanel } from "./real-build-farther-panel";
import type { FartherRefusal, FartherPlacementWitness } from "./real-build-farther-panel-types";
import {
  scoreFartherDocumentsAgainstPanel,
  type FartherPanelScoreResult,
} from "./real-build-farther-scoring";
import {
  expandFartherPrintedStep,
  type FartherStepChildMetadata,
  type FartherStepPlace,
} from "./real-build-farther-step-expansion";
import type { FartherPrintedStepAttempt } from "./real-build-farther-step-attempt-types";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import { rgbaPngDataUrl, type PreparedRealBuildModules } from "./real-build-browser-preflight";
import type {
  RealBuildFartherCapture,
  RealBuildFartherEvidence,
  RealBuildOptions,
  RealBuildPanelSpec,
} from "./real-build-safety";

/**
 * Browser binding for the first complete N/N+1/K farther search.
 *
 * The exact measured step-5 policy may score the two origins directly at K
 * before constructing N+1. Every other input deliberately admits one
 * intervening atomic step first. The generic coordinator owns deeper lineage;
 * this adapter owns production rendering, placement and capture bytes for the
 * booklet driver. Every parent uses one shared narrowing ledger, and an
 * over-limit batch is rejected before its scoring callback runs.
 */
export async function attemptFartherPrintedStep<D>(input: {
  readonly originSpec: RealBuildPanelSpec;
  readonly originStatus: "no-local-signal" | "unseparated";
  readonly originMargin: number | null;
  readonly originMinimumMargin: number | null;
  readonly baseDocument: D;
  readonly origins: readonly DeferredUnresolvedCandidate<D>[];
  readonly interveningSpec: RealBuildPanelSpec;
  readonly interveningEvidence: PanelRasterEvidence;
  readonly fartherSpec: RealBuildPanelSpec | null;
  readonly loadFartherEvidence: (() => Promise<PanelRasterEvidence>) | null;
  readonly options: RealBuildOptions;
  readonly modules: Pick<PreparedRealBuildModules, "rendering" | "kernel" | "assembly">;
  readonly place: FartherStepPlace<D>;
  readonly scoreMeasuredOriginPanel?: typeof scoreFartherDocumentsAgainstPanel;
}): Promise<FartherPrintedStepAttempt<D>> {
  const { originSpec, interveningSpec, options, modules } = input;
  // The asynchronous K loader is outside the deterministic driver. Snapshot
  // every origin field it could otherwise rewrite while preserving the exact
  // document object whose structural hash is rechecked around the await.
  const origins = Object.freeze(
    input.origins.map((origin) =>
      Object.freeze({
        ...origin,
        partIds: Object.freeze([...origin.partIds]),
        registrations: Object.freeze(
          origin.registrations.map((registration) => Object.freeze({ ...registration })),
        ),
        pieces: Object.freeze(
          origin.pieces.map((piece) =>
            Object.freeze({
              ...piece,
              transform: Object.freeze({
                ...piece.transform,
                positionLdu: Object.freeze([...piece.transform.positionLdu]) as readonly [
                  number,
                  number,
                  number,
                ],
              }),
            }),
          ),
        ),
        lookaheadShiftPx: Object.freeze([...origin.lookaheadShiftPx]) as readonly [number, number],
        lookaheadPixels:
          origin.lookaheadPixels === null ? null : new Uint8Array(origin.lookaheadPixels),
      }),
    ),
  );
  const baseDocumentHash = modules.kernel.documentStructuralHash(input.baseDocument) as string;
  const originEvidence = Object.freeze({
    stepNumber: originSpec.stepNumber,
    status: input.originStatus,
    margin: input.originMargin,
    minimumMargin: input.originMinimumMargin,
  });
  // K is deliberately not loaded eagerly. The source-bound measured branch
  // below may authorize it against exact origins; otherwise the synchronous
  // coordinator must complete every intervening parent and reserve the exact K
  // score rows before its continuation authorizes the asynchronous PDF load.
  let fartherEvidence: PanelRasterEvidence | null = null;
  const ledger = createNarrowingRenderBudgetLedger(options.deferredNarrowingRenderBudget);
  const depthNarrowingLedger = createNarrowingSubjectRenderBudgetLedger(
    options.deferredNarrowingRenderBudget,
  );
  // N+1 was already scored by `settleDeferredPrintedStep`; use those exact
  // document-bound numbers and score-bearing renders instead of repeating the
  // work. They remain inspectable even if aggregate carry refuses before the
  // coordinator reaches its observation callback.
  const originScores = Object.freeze(
    origins.map(({ candidateId, lookaheadAgreement }) => ({
      candidateId,
      agreement: lookaheadAgreement,
    })),
  );
  const interveningScore: FartherPanelScoreResult = {
    observation: {
      stepNumber: interveningSpec.stepNumber,
      status: "scored",
      subject: "origin",
      scores: originScores,
    },
    candidatePngs: Object.freeze(
      origins.flatMap(({ candidateId, lookaheadPixels }) =>
        lookaheadPixels === null
          ? []
          : [
              {
                candidateId,
                png: rgbaPngDataUrl(
                  lookaheadPixels,
                  input.interveningEvidence.width,
                  input.interveningEvidence.height,
                ),
              },
            ],
      ),
    ),
  };
  const measuredOriginAttempt = await attemptMeasuredFartherOrigin({
    originSpec,
    baseDocument: input.baseDocument,
    baseDocumentHash,
    origins,
    originEvidence,
    interveningSpec,
    interveningEvidence: input.interveningEvidence,
    interveningScore,
    fartherSpec: input.fartherSpec,
    loadFartherEvidence: input.loadFartherEvidence,
    options,
    modules,
    ...(input.scoreMeasuredOriginPanel === undefined
      ? {}
      : { scoreMeasuredOriginPanel: input.scoreMeasuredOriginPanel }),
  });
  if (measuredOriginAttempt !== null) return measuredOriginAttempt;
  let fartherScore: FartherPanelScoreResult | null = null;
  type PendingK = {
    readonly alternatives: readonly {
      readonly candidateId: string;
      readonly parentCandidateId: string;
      readonly originCandidateId: string;
      readonly document: D;
      readonly documentHash: string;
      readonly lineage: readonly {
        readonly stepNumber: number;
        readonly documentHash: string;
        readonly pieces: readonly FartherPlacementWitness[];
      }[];
    }[];
    readonly reservedPanelRenders: number;
  };
  const pendingK: { value: PendingK | null } = { value: null };
  const lazyKContinuation = new Error("farther K evidence awaits asynchronous continuation");
  const driven = runFartherPanelDriver<
    D,
    DeferredUnresolvedCandidate<D>,
    FartherStepChildMetadata<D>
  >({
    originStepNumber: originSpec.stepNumber,
    origins,
    originEvidence,
    interveningStepNumber: interveningSpec.stepNumber,
    expectedAtomicPieces: interveningSpec.pieces.map(({ catalogPartId, colorId }) => ({
      catalogPartId,
      colorId,
    })),
    maximumCandidates: options.deferredCandidateBudget,
    narrowingLedger: ledger,
    depthNarrowingLedger,
    minimumAgreement: options.minimumDeferredAgreement,
    minimumMargin: options.minimumDeferredAgreementMargin,
    maximumPanelRenders: options.fartherPanelRenderBudget,
    maximumReachSteps: options.fartherPanelMaximumReachSteps,
    fartherPanelsAvailableAfterK: false,
    hashDocument: (document) => modules.kernel.documentStructuralHash(document) as string,
    expandParent: ({ parent, ledger: sharedLedger, depthNarrowingLedger, candidateLedger }) =>
      expandFartherPrintedStep<D>({
        parentCandidateId: parent.candidateId,
        parentDocument: parent.document,
        // The parent owns printed step N. Passing its stepId here would append
        // the intervening pieces to N; null makes the first placement open the
        // distinct atomic N+1 step that this lineage edge claims to represent.
        parentStepId: null,
        spec: interveningSpec,
        evidence: input.interveningEvidence,
        options,
        modules,
        ledger: sharedLedger,
        ...(depthNarrowingLedger === undefined ? {} : { depthNarrowingLedger }),
        candidateLedger,
        place: input.place,
      }),
    originPanelObservation: interveningScore.observation,
    scoreFrontierPanel:
      input.fartherSpec === null || input.loadFartherEvidence === null
        ? null
        : ({ alternatives, reservation }) => {
            pendingK.value = {
              alternatives,
              reservedPanelRenders: reservation.reservedForPanel,
            };
            throw lazyKContinuation;
          },
  });
  type ReportDecision = NonNullable<RealBuildFartherEvidence["decision"]>;
  let resolvedPanels = driven.evidence.panels;
  let resolvedRefusal: FartherRefusal | null = driven.refusal;
  let resolvedDecision: ReportDecision | null =
    driven.decision === null
      ? null
      : {
          originCandidateId: driven.decision.originCandidateId,
          revealingStepNumber: driven.decision.revealingStepNumber,
          survivingCandidateIds: driven.decision.survivingCandidateIds,
          rejectedCandidateIds: driven.decision.rejectedCandidateIds,
          descendantSettled: driven.decision.descendantSettled,
        };
  const continuation = pendingK.value;
  if (continuation !== null && input.fartherSpec !== null && input.loadFartherEvidence !== null) {
    const describeThrown = (error: unknown): string => {
      try {
        return error instanceof Error ? error.message : String(error);
      } catch {
        return "an uninspectable thrown value";
      }
    };
    const verifyKnownDocuments = (): string | null => {
      let actualBaseHash: string;
      try {
        actualBaseHash = modules.kernel.documentStructuralHash(input.baseDocument) as string;
      } catch (error) {
        return `The base document could not be hashed after K continuation: ${describeThrown(error)}.`;
      }
      if (actualBaseHash !== baseDocumentHash) {
        return (
          `The K scoring anchor declares base document hash ${JSON.stringify(baseDocumentHash)}, but ` +
          `documentStructuralHash returned ${JSON.stringify(actualBaseHash)} after K continuation.`
        );
      }
      for (const candidate of origins) {
        let actual: string;
        try {
          actual = modules.kernel.documentStructuralHash(candidate.document) as string;
        } catch (error) {
          return `Candidate ${JSON.stringify(candidate.candidateId)} could not be hashed after K continuation: ${describeThrown(error)}.`;
        }
        if (actual !== candidate.documentHash) {
          return (
            `Candidate ${JSON.stringify(candidate.candidateId)} declares document hash ` +
            `${JSON.stringify(candidate.documentHash)}, but documentStructuralHash returned ${JSON.stringify(actual)} after K continuation.`
          );
        }
      }
      for (const alternative of continuation.alternatives) {
        let actual: string;
        try {
          actual = modules.kernel.documentStructuralHash(alternative.document) as string;
        } catch (error) {
          return `Candidate ${JSON.stringify(alternative.candidateId)} could not be hashed after K continuation: ${describeThrown(error)}.`;
        }
        if (actual !== alternative.documentHash) {
          return (
            `Candidate ${JSON.stringify(alternative.candidateId)} declares document hash ` +
            `${JSON.stringify(alternative.documentHash)}, but documentStructuralHash returned ${JSON.stringify(actual)} after K continuation.`
          );
        }
      }
      return null;
    };
    const inputRefusal = (message: string): FartherRefusal =>
      Object.freeze({
        code: "farther-input-invalid",
        stage: "input",
        stepNumber: input.fartherSpec!.stepNumber,
        message,
      });
    const incompletePanelRefusal = (phase: "loading" | "scoring", error: unknown): FartherRefusal =>
      Object.freeze({
        code: "incomplete-panel-evidence",
        stage: "evidence",
        stepNumber: input.fartherSpec!.stepNumber,
        message:
          `Panel ${input.fartherSpec!.stepNumber} ${phase} callback threw: ${describeThrown(error)}. ` +
          `Required one complete raster and exactly one finite agreement score for each of the ` +
          `${continuation.reservedPanelRenders} reserved frontier candidates; prior N+1 and carry evidence ` +
          `were retained and no partial K panel was admitted.`,
      });
    const beforeLoadHashError = verifyKnownDocuments();
    if (beforeLoadHashError !== null) {
      resolvedRefusal = inputRefusal(beforeLoadHashError);
      resolvedDecision = null;
    } else {
      let phase: "loading" | "scoring" = "loading";
      let continuationInputRefusal: FartherRefusal | null = null;
      try {
        fartherEvidence = await input.loadFartherEvidence();
        const afterLoadHashError = verifyKnownDocuments();
        if (afterLoadHashError !== null) {
          continuationInputRefusal = inputRefusal(afterLoadHashError);
          throw lazyKContinuation;
        }
        phase = "scoring";
        fartherScore = scoreFartherDocumentsAgainstPanel({
          spec: input.fartherSpec,
          evidence: fartherEvidence,
          anchorDocument: input.baseDocument,
          candidates: continuation.alternatives,
          reservedPanelRenders: continuation.reservedPanelRenders,
          subject: "frontier",
          options,
          rendering: modules.rendering,
        });
        const afterScoreHashError = verifyKnownDocuments();
        if (afterScoreHashError !== null) {
          continuationInputRefusal = inputRefusal(afterScoreHashError);
          throw lazyKContinuation;
        }
        const continuedFrontier = Object.freeze({
          originStepNumber: originSpec.stepNumber,
          throughStepNumber: interveningSpec.stepNumber,
          candidates: Object.freeze(
            continuation.alternatives.map((alternative) =>
              Object.freeze({
                candidateId: alternative.candidateId,
                parentCandidateId: alternative.parentCandidateId,
                originCandidateId: alternative.originCandidateId,
                document: alternative.document,
                lineage: alternative.lineage,
              }),
            ),
          ),
        });
        const continued = findFirstRevealingPanel({
          frontier: continuedFrontier,
          originEvidence,
          panels: [interveningScore.observation, fartherScore.observation],
          minimumAgreement: options.minimumDeferredAgreement,
          minimumMargin: options.minimumDeferredAgreementMargin,
          maximumPanelRenders: options.fartherPanelRenderBudget,
          maximumReachSteps: options.fartherPanelMaximumReachSteps,
          fartherPanelsAvailable: false,
        });
        resolvedPanels = continued.evidence;
        resolvedRefusal = continued.refusal;
        resolvedDecision =
          continued.decision === null
            ? null
            : {
                originCandidateId: continued.decision.originCandidateId,
                revealingStepNumber: continued.decision.revealingStepNumber,
                survivingCandidateIds: continued.decision.survivingCandidateIds,
                rejectedCandidateIds: continued.decision.rejectedCandidateIds,
                descendantSettled: continued.decision.descendantSettled,
              };
      } catch (error) {
        const afterFailureHashError = verifyKnownDocuments();
        if (afterFailureHashError !== null) {
          resolvedRefusal = inputRefusal(afterFailureHashError);
        } else if (continuationInputRefusal !== null) {
          resolvedRefusal = continuationInputRefusal;
        } else {
          resolvedRefusal = incompletePanelRefusal(phase, error);
        }
        resolvedDecision = null;
      }
    }
  }
  const originCandidateReports = origins.map(
    ({ candidateId, documentHash, pieces, lookaheadAgreement, lookaheadShiftPx }) => ({
      candidateId,
      documentHash,
      pieces,
      lookaheadAgreement,
      lookaheadShiftPx,
    }),
  );
  const captures: RealBuildFartherCapture[] = [];
  const pushCapture = (
    role: RealBuildFartherCapture["role"],
    panelStepNumber: number,
    candidateId: string | null,
    png: string,
  ) => captures.push({ captureId: captures.length, role, panelStepNumber, candidateId, png });
  const addScoreCaptures = (
    score: FartherPanelScoreResult | null,
    panelEvidence: PanelRasterEvidence,
    retainEveryCandidate: boolean,
  ) => {
    if (score === null) return;
    pushCapture(
      "source-panel",
      score.observation.stepNumber,
      null,
      rgbaPngDataUrl(panelEvidence.workPixels, panelEvidence.width, panelEvidence.height),
    );
    const retained = retainEveryCandidate ? score.candidatePngs : score.candidatePngs.slice(0, 1);
    for (const candidate of retained) {
      pushCapture(
        "candidate-render",
        score.observation.stepNumber,
        candidate.candidateId,
        candidate.png,
      );
    }
  };
  const admittedPanelSteps = new Set(
    resolvedPanels?.panels.map(({ stepNumber }) => stepNumber) ?? [],
  );
  if (admittedPanelSteps.has(interveningSpec.stepNumber)) {
    addScoreCaptures(interveningScore, input.interveningEvidence, true);
  }
  if (
    fartherEvidence !== null &&
    input.fartherSpec !== null &&
    admittedPanelSteps.has(input.fartherSpec.stepNumber)
  ) {
    addScoreCaptures(fartherScore, fartherEvidence, true);
  }

  const carry = driven.evidence.carry;
  const orderedOriginScores = [...originScores].sort(
    (left, right) => right.agreement - left.agreement,
  );
  const originBest = orderedOriginScores[0]?.agreement ?? 0;
  const originFamilyMargin =
    orderedOriginScores.length < 2
      ? 0
      : originBest - (orderedOriginScores[1]?.agreement ?? originBest);
  const originRevealing =
    originBest >= options.minimumDeferredAgreement &&
    originFamilyMargin > options.minimumDeferredAgreementMargin;
  const retainedPanels =
    resolvedPanels?.panels ??
    Object.freeze([
      {
        stepNumber: interveningSpec.stepNumber,
        reachSteps: interveningSpec.stepNumber - originSpec.stepNumber,
        status: originRevealing ? ("revealing" as const) : ("unrevealing" as const),
        reason: originRevealing
          ? null
          : originBest < options.minimumDeferredAgreement
            ? ("weak-agreement" as const)
            : ("ambiguous-family" as const),
        scores: originScores,
        bestAgreement: originBest,
        familyMargin: originFamilyMargin,
        descendantMargin: null,
      },
    ]);
  const decision = resolvedDecision;
  const refusal = resolvedRefusal;
  const evidence: RealBuildFartherEvidence = {
    origin: { evidence: originEvidence, candidates: originCandidateReports },
    carries: carry === null ? [] : [{ ...carry, stepNumber: interveningSpec.stepNumber }],
    panels: retainedPanels,
    budgets: {
      offeredCandidates: driven.evidence.candidateLedger.reserved,
      maximumCandidates: options.deferredCandidateBudget,
      narrowingRenders: driven.evidence.narrowingLedger.reserved,
      maximumNarrowingRenders: options.deferredNarrowingRenderBudget,
      panelRenders: retainedPanels.reduce((total, panel) => total + panel.scores.length, 0),
      maximumPanelRenders: options.fartherPanelRenderBudget,
      reachSteps: Math.max(carry === null ? 0 : 1, retainedPanels.at(-1)?.reachSteps ?? 0),
      maximumReachSteps: options.fartherPanelMaximumReachSteps,
      refusedReservation: driven.evidence.narrowingLedger.refusedReservation,
      failedNarrowingReservation: driven.evidence.narrowingLedger.failedReservation,
      candidateRefusedReservation: driven.evidence.candidateLedger.refusedReservation,
      failedCandidateReservation: driven.evidence.candidateLedger.failedReservation,
    },
    refusal,
    decision,
  };
  return {
    evidence,
    captures,
    selectedOrigin:
      decision === null
        ? null
        : (origins.find(({ candidateId }) => candidateId === decision.originCandidateId) ?? null),
    failure: fartherFailure(originSpec.stepNumber, refusal),
  };
}
