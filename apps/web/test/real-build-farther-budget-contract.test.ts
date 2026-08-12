import { describe, expect, it } from "vitest";

import type { DeferralEvidence } from "../e2e/real-build-deferral";
import { inspectFrozenLegacyBrowserOutputV2 } from "../e2e/real-build-artifact-legacy-browser-v2";
import { isRealBuildFartherEvidence } from "../e2e/real-build-farther-report-parser";
import type { RealBuildFartherEvidence } from "../e2e/real-build-farther-report-types";
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

const isFrozenLegacyBrowserOutput = (
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

const basePrepared = options(1);
const prepared = {
  ...basePrepared,
  deferredCandidateBudget: 2,
  panels: basePrepared.panels.map((panel) =>
    panel.stepNumber === 2
      ? {
          ...panel,
          action: {
            kind: "place-callouts" as const,
            assembledPieces: 0,
            evidenceDigest: DIGEST,
          },
          pieces: [],
          omittedPieces: [],
          mappedCalloutKeys: [],
          calloutPieces: 0,
          classifiedPhysicalCalloutPieces: 0,
        }
      : panel,
  ),
};
const deferral: DeferralEvidence = {
  trigger: "unseparated-by-own-panel",
  ownPanelMargin: 0.1,
  ownPanelMinimumMargin: 0.2,
  lookaheadStepNumber: 2,
  reachSteps: 1,
  lookaheadUpSign: 1,
  lookaheadMeasure: "iou",
  lookaheadTurnDegrees: 0,
  lookaheadTurnAnchorIou: 0.8,
  lookaheadTurnMargin: 0.2,
  narrowingRenders: 0,
  offeredPerPiece: [],
  carriedPerPiece: [],
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

const carry = {
  stepNumber: 2,
  parentCandidates: 2,
  parentsExpanded: 1,
  offeredCandidates: 2,
  narrowingRenders: 0,
  maximumCandidates: prepared.deferredCandidateBudget,
  maximumNarrowingRenders: prepared.deferredNarrowingRenderBudget,
  expectedAtomicPieces: [],
  perParent: [
    {
      parentCandidateId: "origin-a",
      offeredCandidates: 2,
      narrowingRenders: 0,
      offeredPerPiece: [],
      carriedPerPiece: [],
    },
  ],
  measuredLineages: [
    {
      candidateId: "child-a",
      parentCandidateId: "origin-a",
      originCandidateId: "origin-a",
      lineage: [
        { stepNumber: 1, documentHash: DIGEST, pieces: [] },
        { stepNumber: 2, documentHash: DIGEST, pieces: [] },
      ],
    },
    {
      candidateId: "child-a-2",
      parentCandidateId: "origin-a",
      originCandidateId: "origin-a",
      lineage: [
        { stepNumber: 1, documentHash: DIGEST, pieces: [] },
        { stepNumber: 2, documentHash: DIGEST, pieces: [] },
      ],
    },
  ],
} as const;

const evidence = (
  refusalCode: "aggregate-candidate-budget-exhausted" | "aggregate-narrowing-budget-exhausted",
): RealBuildFartherEvidence => {
  const candidateRefused = refusalCode === "aggregate-candidate-budget-exhausted";
  return {
    origin: {
      evidence: { stepNumber: 1, status: "unseparated", margin: 0.1, minimumMargin: 0.2 },
      candidates: [
        {
          candidateId: "origin-a",
          documentHash: DIGEST,
          pieces: [],
          lookaheadAgreement: 0.9,
          lookaheadShiftPx: [0, 0],
        },
        {
          candidateId: "origin-b",
          documentHash: DIGEST,
          pieces: [],
          lookaheadAgreement: 0.5,
          lookaheadShiftPx: [0, 0],
        },
      ],
    },
    carries: [carry],
    panels: [
      {
        stepNumber: 2,
        reachSteps: 1,
        status: "revealing",
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
      refusedReservation: !candidateRefused,
      failedNarrowingReservation: candidateRefused
        ? null
        : {
            reservedBefore: 0,
            requested: prepared.deferredNarrowingRenderBudget + 1,
            budget: prepared.deferredNarrowingRenderBudget,
          },
      candidateRefusedReservation: candidateRefused,
      failedCandidateReservation: candidateRefused
        ? {
            reservedBefore: prepared.deferredCandidateBudget,
            requested: 1,
            budget: prepared.deferredCandidateBudget,
          }
        : null,
    },
    refusal: {
      code: refusalCode,
      stage: "budget",
      stepNumber: 2,
      message: "The next aggregate reservation was refused atomically.",
    },
    decision: null,
  };
};

const parses = (value: unknown): boolean =>
  isRealBuildFartherEvidence(value, 1, 0, deferral, prepared);

const retainedOutput = () => {
  const base = frozenLegacyBrowserOutput(1);
  const farther = evidence("aggregate-candidate-budget-exhausted");
  return {
    ...base,
    reports: [
      {
        ...base.reports[0]!,
        outcome: {
          status: "failed" as const,
          mechanism: "deferred" as const,
          attemptedMechanism: "deferred-lookahead" as const,
          failure: farther.refusal,
        },
        deferral,
        farther,
        fartherCaptures: [
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
        ],
      },
    ],
  };
};

describe("real-build farther aggregate reservation witnesses", () => {
  it("requires the exact first failed candidate reservation", () => {
    const honest = evidence("aggregate-candidate-budget-exhausted");
    expect(parses(honest)).toBe(true);

    for (const failedCandidateReservation of [
      { ...honest.budgets.failedCandidateReservation!, reservedBefore: 1 },
      { ...honest.budgets.failedCandidateReservation!, requested: 2 },
    ]) {
      expect(
        parses({
          ...honest,
          budgets: { ...honest.budgets, failedCandidateReservation },
        }),
      ).toBe(false);
    }
    expect(
      parses({
        ...honest,
        budgets: { ...honest.budgets, candidateRefusedReservation: false },
      }),
    ).toBe(false);
  });

  it("requires the exact first failed narrowing reservation and no unrelated witness", () => {
    const honest = evidence("aggregate-narrowing-budget-exhausted");
    expect(parses(honest)).toBe(true);

    expect(
      parses({
        ...honest,
        budgets: { ...honest.budgets, failedNarrowingReservation: null },
      }),
    ).toBe(false);
    expect(
      parses({
        ...honest,
        budgets: {
          ...honest.budgets,
          failedNarrowingReservation: {
            ...honest.budgets.failedNarrowingReservation!,
            requested: prepared.deferredNarrowingRenderBudget,
          },
        },
      }),
    ).toBe(false);
    expect(
      parses({
        ...honest,
        budgets: {
          ...honest.budgets,
          failedCandidateReservation: {
            reservedBefore: prepared.deferredCandidateBudget,
            requested: 1,
            budget: prepared.deferredCandidateBudget,
          },
        },
      }),
    ).toBe(false);
  });

  it("does not let cosmetic deferral mutations make required farther evidence deletable", () => {
    const honest = retainedOutput();
    expect(isFrozenLegacyBrowserOutput(honest, prepared)).toBe(true);

    const deferralMutations = [
      {},
      { wholeStepCandidates: 1 },
      { rendered: 0 },
      { bestAgreement: null },
      { runnerUpAgreement: null },
      { margin: null },
      { margin: 0.3 },
      { lookaheadTurnDegrees: null },
      { lookaheadUpSign: null },
      { reachSteps: 0 },
    ];
    const deletableMutations = deferralMutations.filter((deferralMutation) =>
      isFrozenLegacyBrowserOutput(
        {
          ...honest,
          reports: [
            {
              ...honest.reports[0]!,
              deferral: { ...deferral, ...deferralMutation },
              farther: null,
              fartherCaptures: [],
            },
          ],
        },
        prepared,
      ),
    );
    expect(deletableMutations).toEqual([]);
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...honest,
          reports: [
            {
              ...honest.reports[0]!,
              deferral: null,
              farther: null,
              fartherCaptures: [],
            },
          ],
        },
        prepared,
      ),
    ).toBe(false);
  });

  it("allows null farther evidence for a one-panel search or an early candidate refusal", () => {
    const honest = retainedOutput();
    const withoutFarther = {
      ...honest,
      reports: [{ ...honest.reports[0]!, farther: null, fartherCaptures: [] }],
    };
    expect(
      isFrozenLegacyBrowserOutput(withoutFarther, {
        ...prepared,
        fartherPanelMaximumReachSteps: 1,
      }),
    ).toBe(true);

    const earlyRefusal: DeferralEvidence = {
      ...deferral,
      lookaheadStepNumber: null,
      reachSteps: 0,
      lookaheadUpSign: null,
      lookaheadMeasure: null,
      lookaheadTurnDegrees: null,
      lookaheadTurnAnchorIou: null,
      lookaheadTurnMargin: null,
      wholeStepCandidates: 0,
      rendered: 0,
      lookaheadBuiltPixels: 0,
      bestAgreement: null,
      runnerUpAgreement: null,
      margin: null,
    };
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...withoutFarther,
          reports: [{ ...withoutFarther.reports[0]!, deferral: earlyRefusal }],
        },
        prepared,
      ),
    ).toBe(true);
  });

  it("does not let an outcome relabel erase deferral evidence named by a piece failure", () => {
    const honest = retainedOutput();
    const weakDeferredPiece = {
      catalogPartId: "builtin:brick-1x1",
      blind: {
        comparisonPrefixHash: DIGEST,
        distinctCandidates: 0,
        feasible: false,
        rendered: 0,
        bestScore: null,
        runnerUpScore: null,
        agreesWithHighlight: null,
        refusal: "The deferred panel did not clear the required agreement.",
        elapsedMs: 0,
      },
      enumerated: 0,
      afterProximity: 0,
      rendered: 0,
      bestScore: null,
      runnerUpScore: null,
      placed: false,
      positionLdu: null,
      orientationId: null,
      failure: {
        code: "weak-deferred-agreement" as const,
        stage: "scoring" as const,
        message: "The deferred score did not clear the required agreement.",
      },
    };
    const failed = {
      ...honest,
      reports: [
        {
          ...honest.reports[0]!,
          outcome: {
            status: "failed" as const,
            mechanism: "deferred" as const,
            attemptedMechanism: "deferred-lookahead" as const,
            failure: weakDeferredPiece.failure,
          },
          pieces: [weakDeferredPiece],
        },
      ],
    };
    expect(isFrozenLegacyBrowserOutput(failed, prepared)).toBe(true);
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...failed,
          reports: [
            {
              ...failed.reports[0]!,
              outcome: { ...failed.reports[0]!.outcome, attemptedMechanism: "highlight" },
              deferral: null,
              farther: null,
              fartherCaptures: [],
            },
          ],
        },
        prepared,
      ),
    ).toBe(false);
  });
});
