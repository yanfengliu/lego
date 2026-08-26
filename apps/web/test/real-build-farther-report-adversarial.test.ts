import { describe, expect, it } from "vitest";

import {
  isRealBuildFartherCaptures,
  isRealBuildFartherEvidence,
} from "../e2e/real-build-farther-report-parser";
import type { RealBuildOptions } from "../e2e/real-build-safety";
import { DIGEST, PNG } from "./real-build-adversarial-fixtures";
import {
  createFartherReportAdversarialFixture,
  frozenLegacyFailure,
  isFrozenLegacyBrowserOutput,
} from "./real-build-farther-report-adversarial-fixture";

describe("real build farther report adversarial contracts", () => {
  it("accepts only exact, bounded, lineage-complete farther evidence and captures", () => {
    const {
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
    } = createFartherReportAdversarialFixture();

    expect(isFrozenLegacyBrowserOutput(candidate, prepared)).toBe(true);

    const partialCarry = {
      ...farther.carries[0]!,
      parentsExpanded: 1,
      offeredCandidates: 1,
      perParent: [farther.carries[0]!.perParent[0]!],
      measuredLineages: [farther.carries[0]!.measuredLineages[0]!],
    };
    const partialRefusal = {
      ...farther,
      carries: [partialCarry],
      budgets: { ...farther.budgets, offeredCandidates: 1 },
      refusal: {
        code: "incomplete-parent-expansion" as const,
        stage: "evidence" as const,
        stepNumber: 2,
        message: "The first parent expansion refused before the second parent was attempted.",
      },
      decision: null,
    };
    expect(isRealBuildFartherEvidence(partialRefusal, 1, 0, originDeferral, prepared)).toBe(true);
    expect(
      isRealBuildFartherEvidence(
        {
          ...partialRefusal,
          refusal: {
            code: "not-observable" as const,
            stage: "evidence" as const,
            stepNumber: 2,
            message: "A non-expansion refusal may not retain a partial parent prefix.",
          },
        },
        1,
        0,
        originDeferral,
        prepared,
      ),
    ).toBe(false);
    expect(
      isRealBuildFartherEvidence(
        {
          ...partialRefusal,
          carries: [{ ...partialCarry, measuredLineages: [] }],
        },
        1,
        0,
        originDeferral,
        prepared,
      ),
    ).toBe(false);
    expect(
      isRealBuildFartherEvidence(
        {
          ...partialRefusal,
          refusal: { ...partialRefusal.refusal, stage: "input" as const },
        },
        1,
        0,
        originDeferral,
        prepared,
      ),
    ).toBe(false);
    expect(
      isRealBuildFartherEvidence(
        {
          ...partialRefusal,
          refusal: { ...partialRefusal.refusal, stepNumber: 3 },
        },
        1,
        0,
        originDeferral,
        prepared,
      ),
    ).toBe(false);

    const prePanelOrigins = Array.from({ length: 17 }, (_, index) => ({
      candidateId: `pre-panel-origin-${index}`,
      documentHash: DIGEST,
      pieces: [],
      lookaheadAgreement: index === 0 ? 0.9 : index === 1 ? 0.5 : 0.25,
      lookaheadShiftPx: [0, 0] as const,
    }));
    const prePanelDeferral = {
      ...originDeferral,
      wholeStepCandidates: prePanelOrigins.length,
      rendered: prePanelOrigins.length,
    };
    const prePanelFarther = {
      ...farther,
      origin: { ...farther.origin, candidates: prePanelOrigins },
      carries: [],
      panels: [],
      budgets: {
        ...farther.budgets,
        offeredCandidates: 0,
        narrowingRenders: 0,
        panelRenders: 0,
        reachSteps: 0,
      },
      refusal: {
        code: "panel-render-budget-exhausted" as const,
        stage: "budget" as const,
        stepNumber: 2,
        message: "The 17 origin renders exceed the aggregate 16-render farther-panel budget.",
      },
      decision: null,
    };
    const prePanelCandidate = {
      ...candidate,
      reports: [
        {
          ...candidate.reports[0]!,
          outcome: {
            status: "failed" as const,
            mechanism: "deferred" as const,
            attemptedMechanism: "deferred-lookahead" as const,
            failure: prePanelFarther.refusal,
          },
          deferral: prePanelDeferral,
          farther: prePanelFarther,
          fartherCaptures: [],
        },
        ...candidate.reports.slice(1),
      ],
    };
    expect(isFrozenLegacyBrowserOutput(prePanelCandidate, prepared)).toBe(true);
    for (const mutation of [
      {
        ...prePanelFarther,
        refusal: { ...prePanelFarther.refusal, code: "not-observable" as const },
      },
      { ...prePanelFarther, budgets: { ...prePanelFarther.budgets, panelRenders: 1 } },
      { ...prePanelFarther, budgets: { ...prePanelFarther.budgets, reachSteps: 1 } },
      {
        ...prePanelFarther,
        budgets: { ...prePanelFarther.budgets, refusedReservation: true },
      },
      {
        ...prePanelFarther,
        origin: { ...prePanelFarther.origin, candidates: prePanelOrigins.slice(0, 16) },
      },
    ]) {
      expect(
        isFrozenLegacyBrowserOutput(
          {
            ...prePanelCandidate,
            reports: [
              { ...prePanelCandidate.reports[0]!, farther: mutation },
              ...prePanelCandidate.reports.slice(1),
            ],
          },
          prepared,
        ),
      ).toBe(false);
    }
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...prePanelCandidate,
          reports: [
            {
              ...prePanelCandidate.reports[0]!,
              deferral: { ...prePanelDeferral, bestAgreement: 0.8 },
            },
            ...prePanelCandidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...prePanelCandidate,
          reports: [
            {
              ...prePanelCandidate.reports[0]!,
              fartherCaptures: [fartherCaptures[0]!],
            },
            ...prePanelCandidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);

    const originBoundPrepared: RealBuildOptions = {
      ...prepared,
      panels: prepared.panels.map((panel) =>
        panel.stepNumber === 1
          ? {
              ...panel,
              action: {
                kind: "place-callouts" as const,
                assembledPieces: 1,
                evidenceDigest: DIGEST,
              },
              pieces: [originPiece],
              omittedPieces: [],
              mappedCalloutKeys: [originPiece.calloutKey],
              calloutPieces: 1,
              classifiedPhysicalCalloutPieces: 1,
            }
          : panel,
      ),
    };
    const originBoundFarther = {
      ...farther,
      origin: {
        ...farther.origin,
        candidates: farther.origin.candidates.map((origin) => ({
          ...origin,
          pieces: [originWitness],
        })),
      },
      carries: farther.carries.map((carry) => ({
        ...carry,
        measuredLineages: carry.measuredLineages.map((measured) => ({
          ...measured,
          lineage: measured.lineage.map((step, index) =>
            index === 0 ? { ...step, pieces: [originWitness] } : step,
          ),
        })),
      })),
    };
    expect(
      isRealBuildFartherEvidence(originBoundFarther, 1, 1, originDeferral, originBoundPrepared),
    ).toBe(true);
    const forgedOriginWitness = {
      ...originWitness,
      catalogPartId: "forged-origin-part",
      colorId: "forged-origin-color",
    };
    expect(
      isRealBuildFartherEvidence(
        {
          ...originBoundFarther,
          origin: {
            ...originBoundFarther.origin,
            candidates: originBoundFarther.origin.candidates.map((origin) => ({
              ...origin,
              pieces: [forgedOriginWitness],
            })),
          },
          carries: originBoundFarther.carries.map((carry) => ({
            ...carry,
            measuredLineages: carry.measuredLineages.map((measured) => ({
              ...measured,
              lineage: measured.lineage.map((step, index) =>
                index === 0 ? { ...step, pieces: [forgedOriginWitness] } : step,
              ),
            })),
          })),
        },
        1,
        1,
        originDeferral,
        originBoundPrepared,
      ),
    ).toBe(false);

    const deferralWithoutEnumeration = { ...originDeferral } as Record<string, unknown>;
    delete deferralWithoutEnumeration.narrowingRenders;
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            { ...candidate.reports[0]!, deferral: deferralWithoutEnumeration },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);

    const fartherMutations: readonly unknown[] = [
      {
        ...farther,
        carries: [
          {
            ...farther.carries[0]!,
            perParent: farther.carries[0]!.perParent.map((parent, index) =>
              index === 0 ? { ...parent, parentCandidateId: "fabricated-parent" } : parent,
            ),
          },
        ],
      },
      {
        ...farther,
        carries: [
          {
            ...farther.carries[0]!,
            measuredLineages: farther.carries[0]!.measuredLineages.map((measured, index) =>
              index === 0
                ? {
                    ...measured,
                    lineage: measured.lineage.map((step, lineageIndex) =>
                      lineageIndex === 0
                        ? { ...step, documentHash: `sha256:${"1".repeat(64)}` }
                        : step,
                    ),
                  }
                : measured,
            ),
          },
        ],
      },
      {
        ...farther,
        carries: [
          {
            ...farther.carries[0]!,
            expectedAtomicPieces: [],
            perParent: farther.carries[0]!.perParent.map((parent) => ({
              ...parent,
              offeredPerPiece: [1, 1, 1, 1],
              carriedPerPiece: [1, 1, 1, 1],
            })),
          },
        ],
      },
      {
        ...farther,
        panels: farther.panels.map((panel) => ({
          ...panel,
          scores: [
            { candidateId: "unrelated-a", agreement: 0.9 },
            { candidateId: "unrelated-b", agreement: 0.5 },
          ],
        })),
      },
      {
        ...farther,
        carries: farther.carries.map((carry) => ({
          ...carry,
          expectedAtomicPieces: [{ catalogPartId: "forged-part", colorId: "forged-color" }],
          measuredLineages: carry.measuredLineages.map((measured) => ({
            ...measured,
            lineage: measured.lineage.map((step, index) =>
              index === 0
                ? step
                : {
                    ...step,
                    pieces: step.pieces.map((piece) => ({
                      ...piece,
                      catalogPartId: "forged-part",
                      colorId: "forged-color",
                    })),
                  },
            ),
          })),
        })),
      },
      {
        ...farther,
        origin: {
          ...farther.origin,
          evidence: {
            ...farther.origin.evidence,
            status: "no-local-signal" as const,
            margin: null,
            minimumMargin: null,
          },
        },
      },
    ];
    for (const mutation of fartherMutations) {
      expect(isFrozenLegacyBrowserOutput(mutateFarther(mutation), prepared)).toBe(false);
    }
    expect(frozenLegacyFailure(mutateFarther({ ...farther, extra: true }), prepared)).toContain(
      "farther",
    );
    expect(
      frozenLegacyFailure(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              deferral: { ...originDeferral, ownPanelMargin: 0.2 },
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toContain("deferral");
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              deferral: { ...originDeferral, offeredPerPiece: [1], carriedPerPiece: [2] },
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);
    expect(
      frozenLegacyFailure(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              fartherCaptures: fartherCaptures.filter(
                ({ candidateId }) => candidateId !== "origin-b",
              ),
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toContain("captures");
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              fartherCaptures: fartherCaptures.filter(
                ({ candidateId }) => candidateId !== "origin-b",
              ),
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);

    const rawAtomicPieces = [
      { catalogPartId: interveningPiece.catalogPartId, colorId: interveningPiece.colorId },
    ];
    const rawWitnesses = rawAtomicPieces.map(({ catalogPartId, colorId }, index) => ({
      catalogPartId,
      colorId,
      transform: {
        positionLdu: [index * 20, 0, 0] as const,
        orientationId: "upright-yaw-0",
      },
    }));
    const rawLineage = (originCandidateId: string, candidateId: string) => ({
      ...lineage(originCandidateId, candidateId),
      lineage: [
        { stepNumber: 1, documentHash: DIGEST, pieces: [] },
        { stepNumber: 2, documentHash: DIGEST, pieces: rawWitnesses },
      ],
    });
    const carryWithRawPlacementOffers = {
      ...farther.carries[0]!,
      offeredCandidates: 5,
      expectedAtomicPieces: rawAtomicPieces,
      perParent: [
        {
          ...farther.carries[0]!.perParent[0]!,
          offeredCandidates: 2,
          offeredPerPiece: [710],
          carriedPerPiece: [2],
        },
        {
          ...farther.carries[0]!.perParent[1]!,
          offeredCandidates: 3,
          offeredPerPiece: [772],
          carriedPerPiece: [3],
        },
      ],
      measuredLineages: [
        rawLineage("origin-a", "child-a"),
        rawLineage("origin-a", "child-a-2"),
        rawLineage("origin-b", "child-b"),
        rawLineage("origin-b", "child-b-2"),
        rawLineage("origin-b", "child-b-3"),
      ],
    };
    expect(
      isFrozenLegacyBrowserOutput(
        mutateFarther({
          ...farther,
          carries: [carryWithRawPlacementOffers],
          budgets: { ...farther.budgets, offeredCandidates: 5 },
          decision: {
            ...farther.decision,
            survivingCandidateIds: ["child-a", "child-a-2"],
            rejectedCandidateIds: ["child-b", "child-b-2", "child-b-3"],
            descendantSettled: false,
          },
        }),
        prepared,
      ),
    ).toBe(true);
    expect(isFrozenLegacyBrowserOutput(mutateFarther({ ...farther, extra: true }), prepared)).toBe(
      false,
    );
    expect(
      isFrozenLegacyBrowserOutput(
        mutateFarther({
          ...farther,
          carries: [
            {
              ...farther.carries[0]!,
              measuredLineages: [
                { ...farther.carries[0]!.measuredLineages[0]!, candidateId: "child-b" },
                farther.carries[0]!.measuredLineages[1]!,
              ],
            },
          ],
        }),
        prepared,
      ),
    ).toBe(false);
    expect(
      isFrozenLegacyBrowserOutput(
        mutateFarther({
          ...farther,
          decision: { ...farther.decision, descendantSettled: false },
        }),
        prepared,
      ),
    ).toBe(false);
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              fartherCaptures: Array.from({ length: 19 }, (_, captureId) => ({
                ...fartherCaptures[0]!,
                captureId,
              })),
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              fartherCaptures: fartherCaptures.map((capture, index) =>
                index === 0 ? { ...capture, candidateId: "child-a" } : capture,
              ),
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);

    const fartherWithK = {
      ...farther,
      panels: [
        farther.panels[0]!,
        {
          stepNumber: 3,
          reachSteps: 2,
          status: "revealing" as const,
          reason: null,
          scores: [
            { candidateId: "child-a", agreement: 0.9 },
            { candidateId: "child-b", agreement: 0.5 },
          ],
          bestAgreement: 0.9,
          familyMargin: 0.4,
          descendantMargin: null,
        },
      ],
      budgets: { ...farther.budgets, panelRenders: 4, reachSteps: 2 },
      decision: { ...farther.decision, revealingStepNumber: 3 },
    };
    const fartherCapturesWithK = [
      ...fartherCaptures,
      {
        captureId: 3,
        role: "source-panel" as const,
        panelStepNumber: 3,
        candidateId: null,
        png: PNG,
      },
      {
        captureId: 4,
        role: "candidate-render" as const,
        panelStepNumber: 3,
        candidateId: "child-a",
        png: PNG,
      },
      {
        captureId: 5,
        role: "candidate-render" as const,
        panelStepNumber: 3,
        candidateId: "child-b",
        png: PNG,
      },
    ];
    expect(isRealBuildFartherCaptures(fartherCapturesWithK, fartherWithK)).toBe(true);
    expect(isRealBuildFartherCaptures(fartherCapturesWithK.slice(0, 4), fartherWithK)).toBe(false);

    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              farther: null,
              fartherCaptures: [],
            },
            ...candidate.reports.slice(1),
          ],
        },
        prepared,
      ),
    ).toBe(false);
    const noKOptions = { ...prepared, fartherPanelMaximumReachSteps: 1 };
    expect(
      isFrozenLegacyBrowserOutput(
        {
          ...candidate,
          reports: [
            {
              ...candidate.reports[0]!,
              farther: null,
              fartherCaptures: [],
            },
            ...candidate.reports.slice(1),
          ],
        },
        noKOptions,
      ),
    ).toBe(true);

    const unrevealingNPlusOne = {
      ...farther,
      origin: {
        ...farther.origin,
        candidates: farther.origin.candidates.map((origin, index) =>
          index === 0 ? { ...origin, lookaheadAgreement: 0.8 } : origin,
        ),
      },
      panels: [
        {
          ...farther.panels[0]!,
          status: "unrevealing" as const,
          reason: "weak-agreement" as const,
          scores: [
            { candidateId: "origin-a", agreement: 0.8 },
            { candidateId: "origin-b", agreement: 0.5 },
          ],
          bestAgreement: 0.8,
          familyMargin: 0.8 - 0.5,
        },
      ],
      budgets: { ...farther.budgets, maximumReachSteps: 1 },
      refusal: {
        code: "farther-panel-limit-reached" as const,
        stage: "budget" as const,
        stepNumber: 3,
        message: "The configured one-step reach ended before panel 3.",
      },
      decision: null,
    };
    const unrevealingDeferral = {
      ...originDeferral,
      bestAgreement: 0.8,
      runnerUpAgreement: 0.5,
      margin: 0.8 - 0.5,
    };
    expect(
      isRealBuildFartherEvidence(unrevealingNPlusOne, 1, 0, unrevealingDeferral, noKOptions),
    ).toBe(true);
    for (const refusal of [
      { ...unrevealingNPlusOne.refusal, stage: "evidence" as const },
      { ...unrevealingNPlusOne.refusal, stepNumber: 2 },
      {
        ...unrevealingNPlusOne.refusal,
        code: "not-observable" as const,
        stage: "evidence" as const,
      },
    ]) {
      expect(
        isRealBuildFartherEvidence(
          { ...unrevealingNPlusOne, refusal },
          1,
          0,
          unrevealingDeferral,
          noKOptions,
        ),
      ).toBe(false);
    }

    for (const refusal of [
      {
        ...partialRefusal.refusal,
        code: "farther-input-invalid" as const,
        stage: "input" as const,
      },
      { ...partialRefusal.refusal, code: "incomplete-atomic-step" as const },
      { ...partialRefusal.refusal, stage: "budget" as const },
    ]) {
      expect(
        isRealBuildFartherEvidence({ ...partialRefusal, refusal }, 1, 0, originDeferral, prepared),
      ).toBe(false);
    }
  });
});
