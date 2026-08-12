import { describe, expect, it, vi } from "vitest";

import { runFartherOriginPanelProbe } from "../e2e/real-build-farther-origin-probe";
import measured from "./fixtures/real-build-farther/measured-step-5-6-7.json";

type Document = { id: string; revision: number };

const hashDocument = (document: Document): string => {
  const digit = document.id === "origin-a" || document.id.endsWith("-0") ? "a" : "b";
  return `sha256:${digit.repeat(63)}${document.revision.toString(16)}`;
};

const origin = (id: string) => {
  const document = { id, revision: 0 };
  return {
    candidateId: id,
    document,
    documentHash: hashDocument(document),
    pieces: [
      {
        catalogPartId: "builtin:plate-1x1",
        colorId: "bright-red",
        transform: { orientationId: "identity", positionLdu: [0, 0, 0] as const },
      },
    ],
    mutableClaim: "caller-owned",
  };
};

const input = () => ({
  originStepNumber: 5,
  origins: [origin("origin-a"), origin("origin-b")],
  originEvidence: {
    stepNumber: 5,
    status: "unseparated" as const,
    margin: 0.001,
    minimumMargin: 0.01,
  },
  originPanelObservation: {
    stepNumber: 6,
    status: "scored" as const,
    subject: "origin" as const,
    scores: [
      { candidateId: "origin-a", agreement: 0.7 },
      { candidateId: "origin-b", agreement: 0.71 },
    ],
  },
  fartherStepNumber: 7,
  minimumAgreement: 0.85,
  minimumMargin: 0.02,
  maximumPanelRenders: 16,
  maximumReachSteps: 2,
  hashDocument,
});

describe("farther origin panel probe", () => {
  it("binds the measured step-5 origin decision to the preregistered panel-7 observation", async () => {
    const observed = measured.directOriginPanel7Observation;
    const measuredOrigins = measured.origins.map(({ candidateId }) => origin(candidateId));
    const scores = measuredOrigins.map(({ candidateId }) => ({
      candidateId,
      agreement: observed.scores[candidateId as keyof typeof observed.scores],
    }));

    const result = await runFartherOriginPanelProbe({
      ...input(),
      origins: measuredOrigins,
      originPanelObservation: {
        stepNumber: measured.interveningStepNumber,
        status: "scored",
        subject: "origin",
        scores: measured.origins.map(({ candidateId, lookaheadAgreement }) => ({
          candidateId,
          agreement: lookaheadAgreement,
        })),
      },
      scoreOriginPanel: async () => ({
        observation: {
          stepNumber: measured.revealingStepNumber,
          status: "scored" as const,
          subject: "origin" as const,
          scores,
        },
      }),
    });

    expect(observed.measure).toBe("containment");
    expect(scores[1]!.agreement - scores[0]!.agreement).toBeCloseTo(observed.familyMargin, 15);
    expect(observed.revealingBeforeInterveningCarry).toBe(true);
    expect(result.decision?.originCandidateId).toBe(measured.selectedOriginCandidateId);
    const bestConstructedFrontier = Object.entries(measured.frontierScores).sort(
      ([, left], [, right]) => right - left,
    )[0]![0];
    expect(
      measured.origins.find(({ candidateId }) => candidateId === measured.selectedOriginCandidateId)
        ?.childIds,
    ).toContain(bestConstructedFrontier);
    expect(result.evidence.panels[1]).toMatchObject({
      stepNumber: measured.revealingStepNumber,
      status: "revealing",
    });
    expect(result.evidence.panels[1]?.familyMargin).toBeCloseTo(observed.familyMargin, 15);
  });

  it("reserves exact rows and settles one origin without constructing descendants", async () => {
    const probe = input();
    const scoreOriginPanel = vi.fn(async ({ reservation }) => {
      expect(reservation).toEqual({
        renderedBefore: 2,
        reservedForPanel: 2,
        renderedAfter: 4,
        maximumPanelRenders: 16,
      });
      return {
        observation: {
          stepNumber: 7,
          status: "scored" as const,
          subject: "origin" as const,
          scores: [
            { candidateId: "origin-a", agreement: 0.8 },
            { candidateId: "origin-b", agreement: 0.94 },
          ],
        },
      };
    });

    const result = await runFartherOriginPanelProbe({ ...probe, scoreOriginPanel });

    expect(scoreOriginPanel).toHaveBeenCalledOnce();
    expect(result.decision).toEqual({
      originCandidateId: "origin-b",
      revealingStepNumber: 7,
      survivingCandidateIds: ["origin-b"],
      rejectedCandidateIds: ["origin-a"],
      descendantSettled: true,
    });
    expect(result.evidence.panelRenders).toBe(4);
    expect(result.frontier?.throughStepNumber).toBe(5);
  });

  it("refuses before the callback when the exact K reservation exceeds budget", async () => {
    const probe = input();
    const scoreOriginPanel = vi.fn(async () => {
      throw new Error("must not run");
    });

    const result = await runFartherOriginPanelProbe({
      ...probe,
      maximumPanelRenders: 3,
      scoreOriginPanel,
    });

    expect(scoreOriginPanel).not.toHaveBeenCalled();
    expect(result.refusal).toMatchObject({
      code: "panel-render-budget-exhausted",
      stage: "budget",
      stepNumber: 7,
    });
    expect(result.evidence.panelRenders).toBe(2);
  });

  it("rehashes immutable claims after a callback mutates the caller object on return or throw", async () => {
    for (const mode of ["return", "throw"] as const) {
      const probe = input();
      const scoreOriginPanel = vi.fn(async () => {
        probe.origins[0]!.document.revision += 1;
        probe.origins[0]!.documentHash = hashDocument(probe.origins[0]!.document);
        if (mode === "throw") throw new Error("mutated then threw");
        return {
          observation: {
            stepNumber: 7,
            status: "scored" as const,
            subject: "origin" as const,
            scores: [
              { candidateId: "origin-a", agreement: 0.9 },
              { candidateId: "origin-b", agreement: 0.6 },
            ],
          },
        };
      });

      const result = await runFartherOriginPanelProbe({ ...probe, scoreOriginPanel });

      expect(result.refusal?.code, mode).toBe("farther-input-invalid");
      expect(result.decision, mode).toBeNull();
      expect(result.frontier, mode).toBeNull();
      expect(
        result.evidence.panels.map(({ stepNumber }) => stepNumber),
        mode,
      ).toEqual([6]);
    }
  });
});
