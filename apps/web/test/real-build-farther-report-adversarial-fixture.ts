import { inspectFrozenLegacyBrowserOutputV2 } from "../e2e/real-build-artifact-legacy-browser-v2";
import type { RealBuildOptions } from "../e2e/real-build-safety";
import {
  completeReport,
  DIGEST,
  documentJson,
  PNG,
  options,
} from "./real-build-adversarial-fixtures";

const frozenLegacyBrowserOutput = (lastStep: number) => ({
  schemaVersion: "lego.real-build-browser-output/2" as const,
  status: "executed" as const,
  reports: Array.from({ length: lastStep }, (_, index) =>
    Object.fromEntries(
      Object.entries(completeReport(index + 1)).filter(([key]) => key !== "panelCamera"),
    ),
  ),
  documentJson: documentJson(lastStep),
  identityBindings: [],
  fetchedPdfDigest: DIGEST,
  totalElapsedMs: lastStep,
});

export const isFrozenLegacyBrowserOutput = (
  value: unknown,
  preparedOptions: RealBuildOptions,
): boolean => {
  try {
    inspectFrozenLegacyBrowserOutputV2(value, preparedOptions);
    return true;
  } catch {
    return false;
  }
};

export const frozenLegacyFailure = (value: unknown, preparedOptions: RealBuildOptions): string => {
  try {
    inspectFrozenLegacyBrowserOutputV2(value, preparedOptions);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "Legacy inspection failed without an Error.";
  }
};

export function createFartherReportAdversarialFixture() {
  const basePrepared = options(2);
  const originPiece = {
    identityKey: "origin-piece",
    designId: "3024",
    materialId: "21",
    catalogPartId: "builtin:plate-1x1",
    colorId: "builtin:red",
    calloutKey: "origin-callout",
    identificationConfidence: "vision-kept" as const,
    cropDigest: DIGEST,
    identificationInputDigest: DIGEST,
    expectedTransform: { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-0" },
  };
  const interveningPiece = {
    identityKey: "intervening-piece",
    designId: "3005",
    materialId: "1",
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:black",
    calloutKey: "intervening-callout",
    identificationConfidence: "vision-kept" as const,
    cropDigest: DIGEST,
    identificationInputDigest: DIGEST,
    expectedTransform: { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-0" },
  };
  const prepared: RealBuildOptions = {
    ...basePrepared,
    panels: basePrepared.panels.map((panel) =>
      panel.stepNumber === 2
        ? {
            ...panel,
            action: {
              kind: "place-callouts" as const,
              assembledPieces: 1,
              evidenceDigest: DIGEST,
            },
            pieces: [interveningPiece],
            omittedPieces: [],
            mappedCalloutKeys: [interveningPiece.calloutKey],
            calloutPieces: 1,
            classifiedPhysicalCalloutPieces: 1,
          }
        : panel,
    ),
  };
  const honest = frozenLegacyBrowserOutput(2);
  const terminalReport = {
    ...honest.reports[1]!,
    calloutPieces: 1,
    expectedAssembledPieces: 1,
    action: prepared.panels[1]!.action,
  };
  const originDeferral = {
    trigger: "unseparated-by-own-panel" as const,
    ownPanelMargin: 0.1,
    ownPanelMinimumMargin: 0.2,
    lookaheadStepNumber: 2,
    reachSteps: 1,
    lookaheadUpSign: 1 as const,
    lookaheadMeasure: "iou" as const,
    lookaheadTurnDegrees: 0,
    lookaheadTurnAnchorIou: 0.8,
    lookaheadTurnMargin: 0.2,
    narrowingRenders: 0,
    offeredPerPiece: [] as readonly number[],
    carriedPerPiece: [] as readonly number[],
    wholeStepCandidates: 2,
    rendered: 2,
    lookaheadBuiltPixels: 100,
    bestAgreement: 0.9,
    runnerUpAgreement: 0.5,
    margin: 0.4,
    minimumMargin: 0.2,
    minimumAgreement: 0.85,
    settled: false,
  };
  const originWitness = {
    catalogPartId: originPiece.catalogPartId,
    colorId: originPiece.colorId,
    transform: originPiece.expectedTransform,
  };
  const interveningWitness = {
    catalogPartId: interveningPiece.catalogPartId,
    colorId: interveningPiece.colorId,
    transform: interveningPiece.expectedTransform,
  };
  const lineage = (originCandidateId: string, candidateId: string) => ({
    candidateId,
    parentCandidateId: originCandidateId,
    originCandidateId,
    lineage: [
      { stepNumber: 1, documentHash: DIGEST, pieces: [] },
      { stepNumber: 2, documentHash: DIGEST, pieces: [interveningWitness] },
    ],
  });
  const farther = {
    origin: {
      evidence: {
        stepNumber: 1,
        status: "unseparated" as const,
        margin: 0.1,
        minimumMargin: 0.2,
      },
      candidates: [
        {
          candidateId: "origin-a",
          documentHash: DIGEST,
          pieces: [],
          lookaheadAgreement: 0.9,
          lookaheadShiftPx: [0, 0] as const,
        },
        {
          candidateId: "origin-b",
          documentHash: DIGEST,
          pieces: [],
          lookaheadAgreement: 0.5,
          lookaheadShiftPx: [0, 0] as const,
        },
      ],
    },
    carries: [
      {
        stepNumber: 2,
        parentCandidates: 2,
        parentsExpanded: 2,
        offeredCandidates: 2,
        narrowingRenders: 0,
        maximumCandidates: prepared.deferredCandidateBudget,
        maximumNarrowingRenders: prepared.deferredNarrowingRenderBudget,
        expectedAtomicPieces: [
          {
            catalogPartId: interveningPiece.catalogPartId,
            colorId: interveningPiece.colorId,
          },
        ],
        perParent: [
          {
            parentCandidateId: "origin-a",
            offeredCandidates: 1,
            narrowingRenders: 0,
            offeredPerPiece: [710],
            carriedPerPiece: [1],
          },
          {
            parentCandidateId: "origin-b",
            offeredCandidates: 1,
            narrowingRenders: 0,
            offeredPerPiece: [718],
            carriedPerPiece: [1],
          },
        ],
        measuredLineages: [lineage("origin-a", "child-a"), lineage("origin-b", "child-b")],
      },
    ],
    panels: [
      {
        stepNumber: 2,
        reachSteps: 1,
        status: "revealing" as const,
        reason: null,
        scores: [
          { candidateId: "origin-a", agreement: 0.9 },
          { candidateId: "origin-b", agreement: 0.5 },
        ],
        bestAgreement: 0.9,
        familyMargin: 0.4,
        descendantMargin: null,
      },
    ],
    budgets: {
      offeredCandidates: 2,
      maximumCandidates: prepared.deferredCandidateBudget,
      narrowingRenders: 0,
      maximumNarrowingRenders: prepared.deferredNarrowingRenderBudget,
      panelRenders: 2,
      maximumPanelRenders: prepared.fartherPanelRenderBudget,
      reachSteps: 1,
      maximumReachSteps: prepared.fartherPanelMaximumReachSteps,
      refusedReservation: false,
      failedNarrowingReservation: null,
      candidateRefusedReservation: false,
      failedCandidateReservation: null,
    },
    refusal: null,
    decision: {
      originCandidateId: "origin-a",
      revealingStepNumber: 2,
      survivingCandidateIds: ["child-a"],
      rejectedCandidateIds: ["child-b"],
      descendantSettled: true,
    },
  };
  const fartherCaptures = [
    {
      captureId: 0,
      role: "source-panel" as const,
      panelStepNumber: 2,
      candidateId: null,
      png: PNG,
    },
    {
      captureId: 1,
      role: "candidate-render" as const,
      panelStepNumber: 2,
      candidateId: "origin-a",
      png: PNG,
    },
    {
      captureId: 2,
      role: "candidate-render" as const,
      panelStepNumber: 2,
      candidateId: "origin-b",
      png: PNG,
    },
  ];
  const candidate = {
    ...honest,
    reports: [
      {
        ...honest.reports[0]!,
        outcome: {
          ...honest.reports[0]!.outcome,
          mechanism: "deferred-lookahead" as const,
        },
        deferral: originDeferral,
        farther,
        fartherCaptures,
      },
      terminalReport,
    ],
  };
  const mutateFarther = (mutation: unknown) => ({
    ...candidate,
    reports: [{ ...candidate.reports[0]!, farther: mutation }, ...candidate.reports.slice(1)],
  });

  return {
    candidate,
    farther,
    fartherCaptures,
    interveningPiece,
    lineage,
    mutateFarther,
    originDeferral,
    originPiece,
    originWitness,
    prepared,
  };
}
