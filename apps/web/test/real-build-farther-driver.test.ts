import { describe, expect, it, vi } from "vitest";

import { createNarrowingRenderBudgetLedger } from "../e2e/real-build-deferral";
import { createNarrowingSubjectRenderBudgetLedger } from "../e2e/real-build-narrowing-subject-budget";
import {
  runFartherPanelDriver,
  type FartherDriverChild,
  type FartherDriverExpansionOutput,
  type FartherDriverInput,
  type FartherDriverOrigin,
  type FartherPanelRenderReservation,
} from "../e2e/real-build-farther-driver";
import type {
  FartherPanelObservationInput,
  FartherPlacementWitness,
} from "../e2e/real-build-farther-panel";
import measured from "./fixtures/real-build-farther/measured-step-5-6-7.json";

type Document = { id: string; revision: number };
type Origin = FartherDriverOrigin<Document> & {
  readonly partIds: readonly string[];
  readonly stepId: string;
};
type Child = FartherDriverChild<Document> & {
  readonly partIds: readonly string[];
  readonly stepId: string;
  readonly registrations: readonly { readonly partId: string }[];
};

const documentHash = (document: Document): string => `sha256:${document.id}:${document.revision}`;
const witnesses = (step: number, count: number): readonly FartherPlacementWitness[] =>
  Array.from({ length: count }, (_, index) => ({
    catalogPartId: `builtin:probe-${step}-${index}`,
    colorId: "builtin:black",
    transform: {
      positionLdu: [step * 20, index * 8, index * 20] as const,
      orientationId: `upright-yaw-${(index % 4) * 90}`,
    },
  }));

const makeOrigins = (): Origin[] =>
  [0, 1].map((index) => {
    const document = { id: `step5-parent-${index}`, revision: 0 };
    return {
      candidateId: document.id,
      document,
      documentHash: documentHash(document),
      pieces: witnesses(5, 2),
      lookaheadAgreement: measured.origins[index]!.lookaheadAgreement,
      partIds: [`step5-part-${index}-0`, `step5-part-${index}-1`],
      stepId: "step-005",
    };
  });

const step6Pieces = witnesses(6, 4);
const expectedAtomicPieces = step6Pieces.map(({ catalogPartId, colorId }) => ({
  catalogPartId,
  colorId,
}));
const familyScores = new Map<string, number>(Object.entries(measured.frontierScores));

const makeChildren = (family: number, count: number): Child[] =>
  Array.from({ length: count }, (_, index) => {
    const candidateId = `step6-${family}-${index}`;
    const document = { id: candidateId, revision: 0 };
    return {
      candidateId,
      document,
      documentHash: documentHash(document),
      pieces: step6Pieces,
      partIds: Array.from({ length: 4 }, (_unused, piece) => `${candidateId}-part-${piece}`),
      stepId: "step-006",
      registrations: Array.from({ length: 4 }, (_unused, piece) => ({
        partId: `${candidateId}-part-${piece}`,
      })),
    };
  });

type HarnessOptions = {
  readonly budget?: number;
  readonly maximumCandidates?: number;
  readonly maximumPanelRenders?: number;
  readonly childrenPerFamily?: readonly [number, number];
  readonly secondParentReservationBatches?: readonly number[];
  readonly retainedSecondParentChildrenOnNarrowingRefusal?: number;
  readonly nPlusOne?: "occluded" | "scored";
  readonly kScores?: "measured" | "weak";
  readonly onScoreFrontier?: (
    origins: Origin[],
    alternatives: readonly { readonly document: Document }[],
  ) => void;
  readonly throwFromScoreFrontier?: Error;
  readonly mutateAfterExpansion?: (
    origins: Origin[],
    family: number,
    children: Child[],
    previouslyCompleted: readonly Child[],
  ) => void;
  readonly alterOutput?: (
    output: FartherDriverExpansionOutput<Document, Child>,
    family: number,
  ) => FartherDriverExpansionOutput<Document, Child>;
};

const harness = (options: HarnessOptions = {}) => {
  const origins = makeOrigins();
  const ledger = createNarrowingRenderBudgetLedger(options.budget ?? 8_609);
  const narrowingWork = [vi.fn(), vi.fn()];
  const previouslyCompleted: Child[] = [];
  const originPanelObservation =
    options.nPlusOne === "occluded"
      ? ({
          stepNumber: measured.interveningStepNumber,
          status: "not-observable",
          reason: "occluded",
        } satisfies FartherPanelObservationInput)
      : ({
          stepNumber: measured.interveningStepNumber,
          status: "scored",
          subject: "origin",
          scores: origins.map(({ candidateId, lookaheadAgreement }) => ({
            candidateId,
            agreement: lookaheadAgreement,
          })),
        } satisfies FartherPanelObservationInput);
  const scoreFrontierPanel = vi.fn(
    ({
      stepNumber,
      alternatives,
    }: {
      stepNumber: number;
      alternatives: readonly {
        readonly candidateId: string;
        readonly document: Document;
      }[];
      reservation: FartherPanelRenderReservation;
    }): FartherPanelObservationInput => {
      options.onScoreFrontier?.(origins, alternatives);
      if (options.throwFromScoreFrontier !== undefined) throw options.throwFromScoreFrontier;
      return {
        stepNumber,
        status: "scored",
        subject: "frontier",
        scores: alternatives.map(({ candidateId }) => ({
          candidateId,
          agreement:
            options.kScores === "weak"
              ? 0.7
              : (familyScores.get(candidateId) ??
                (candidateId.startsWith("step6-1-") ? 0.86 : 0.68)),
        })),
      };
    },
  );
  const expandParent: FartherDriverInput<Document, Origin, Child>["expandParent"] = ({
    parent,
    ledger: shared,
    candidateLedger,
  }) => {
    const family = Number(parent.candidateId.at(-1));
    const measurement = measured.origins[family]!;
    const required = measurement.narrowingRenders;
    const reservedBefore = shared.reserved;
    const children: Child[] = [];
    let admitted = true;
    const reservationBatches =
      family === 1 && options.secondParentReservationBatches !== undefined
        ? options.secondParentReservationBatches
        : [required];
    for (const batch of reservationBatches) {
      if (!shared.tryReserve(batch)) {
        admitted = false;
        break;
      }
      narrowingWork[family]!();
    }
    let candidateBudgetExhausted = false;
    const generatedChildren = admitted
      ? (options.childrenPerFamily?.[family] ?? measurement.childIds.length)
      : family === 1
        ? (options.retainedSecondParentChildrenOnNarrowingRefusal ?? 0)
        : 0;
    if (generatedChildren > 0) {
      const generated = makeChildren(family, generatedChildren);
      for (const child of generated) {
        if (!candidateLedger.tryReserve(1)) {
          candidateBudgetExhausted = true;
          break;
        }
        children.push(child);
      }
    }
    let output: FartherDriverExpansionOutput<Document, Child> = {
      expansion: {
        parentCandidateId: parent.candidateId,
        narrowingRenders: shared.reserved - reservedBefore,
        offeredPerPiece: measurement.offeredPerPiece,
        carriedPerPiece: measurement.carriedPerPiece,
        children: children.map(({ candidateId, document, documentHash: hash, pieces }) => ({
          candidateId,
          document,
          documentHash: hash,
          pieces,
        })),
      },
      children,
      narrowingBudgetExhausted: !admitted,
      candidateBudgetExhausted,
      failure: null,
    };
    options.mutateAfterExpansion?.(origins, family, children, previouslyCompleted);
    output = options.alterOutput?.(output, family) ?? output;
    previouslyCompleted.push(...children);
    return output;
  };
  const input: FartherDriverInput<Document, Origin, Child> = {
    originStepNumber: measured.originStepNumber,
    origins,
    originEvidence: {
      stepNumber: 5,
      status: "unseparated",
      margin: 0.002799160251924393,
      minimumMargin: 0.01,
    },
    interveningStepNumber: measured.interveningStepNumber,
    expectedAtomicPieces,
    maximumCandidates: options.maximumCandidates ?? 512,
    narrowingLedger: ledger,
    minimumAgreement: measured.minimumAgreement,
    minimumMargin: measured.minimumMargin,
    maximumPanelRenders: options.maximumPanelRenders ?? 16,
    maximumReachSteps: 2,
    fartherPanelsAvailableAfterK: false,
    hashDocument: documentHash,
    expandParent,
    originPanelObservation,
    scoreFrontierPanel,
  };
  return { input, ledger, narrowingWork, origins, scoreFrontierPanel };
};

describe("real-build farther driver", () => {
  it("refuses measured 8,609 work at 8,192 before the over-budget narrowing batch runs", () => {
    const probe = harness({ budget: 8_192 });
    const result = runFartherPanelDriver(probe.input);

    expect(result.refusal?.code).toBe("aggregate-narrowing-budget-exhausted");
    expect(result.frontier).toBeNull();
    expect(probe.ledger.reserved).toBe(2_628);
    expect(probe.narrowingWork.map((spy) => spy.mock.calls.length)).toEqual([1, 0]);
    expect(result.parentAttempts.map(({ status }) => status)).toEqual(["complete", "refused"]);
    expect(result.completedAlternatives).toHaveLength(5);
    expect(result.evidence.carry).toMatchObject({
      parentCandidates: 2,
      parentsExpanded: 2,
      offeredCandidates: 5,
      narrowingRenders: 2_628,
      maximumNarrowingRenders: 8_192,
    });
    expect(result.evidence.narrowingLedger).toEqual({
      maximum: 8_192,
      reserved: 2_628,
      refusedReservation: true,
      failedReservation: {
        reservedBefore: 2_628,
        requested: 5_981,
        budget: 8_192,
      },
    });
    expect(result.evidence.candidateLedger.failedReservation).toBeNull();
    expect(result.evidence.panels).toMatchObject({
      panelRenders: 2,
      panels: [{ stepNumber: 6, status: "unrevealing" }],
    });
    expect(result.rejectedAlternatives).toEqual([]);
    expect(result.unresolvedAlternatives).toHaveLength(5);
    expect(probe.scoreFrontierPanel).not.toHaveBeenCalled();
  });

  it("retains the exact 8,037 live-shaped prefix when parent two's next batch is refused", () => {
    const live = measured.productionBudgetObservation;
    const probe = harness({
      budget: 8_192,
      secondParentReservationBatches: [2_000, 2_000, 1_409, 572],
      retainedSecondParentChildrenOnNarrowingRefusal: live.secondParentChildrenBeforeRefusal,
    });
    const result = runFartherPanelDriver(probe.input);

    expect(result.refusal?.code).toBe("aggregate-narrowing-budget-exhausted");
    expect(result.frontier).toBeNull();
    expect(probe.ledger.reserved).toBe(live.aggregateReservedNarrowingRenders);
    expect(probe.narrowingWork.map((spy) => spy.mock.calls.length)).toEqual([1, 3]);
    expect(result.parentAttempts.map(({ expansion }) => expansion.narrowingRenders)).toEqual([
      live.firstParentNarrowingRenders,
      live.secondParentReservedNarrowingRenders,
    ]);
    expect(result.parentAttempts.map(({ alternatives }) => alternatives.length)).toEqual([
      live.firstParentChildren,
      live.secondParentChildrenBeforeRefusal,
    ]);
    expect(result.evidence.carry?.perParent).toMatchObject([
      {
        narrowingRenders: live.firstParentNarrowingRenders,
        offeredCandidates: live.firstParentChildren,
      },
      {
        narrowingRenders: live.secondParentReservedNarrowingRenders,
        offeredCandidates: live.secondParentChildrenBeforeRefusal,
      },
    ]);
    expect(result.completedAlternatives).toHaveLength(
      live.firstParentChildren + live.secondParentChildrenBeforeRefusal,
    );
    expect(result.rejectedAlternatives).toEqual([]);
    expect(result.unresolvedAlternatives).toHaveLength(
      live.firstParentChildren + live.secondParentChildrenBeforeRefusal,
    );
    expect(result.frontier === null).toBe(live.admittedFrontier === false);
    expect(result.evidence.narrowingLedger.refusedReservation).toBe(live.refusedNextReservation);
    expect(result.evidence.narrowingLedger.failedReservation).toEqual({
      reservedBefore: live.aggregateReservedNarrowingRenders,
      requested: 572,
      budget: 8_192,
    });
    expect(result.evidence.candidateLedger.failedReservation).toBeNull();
    expect(probe.scoreFrontierPanel).not.toHaveBeenCalled();
  });

  it("shares one complete-candidate budget across parents and retains the reserved prefix", () => {
    const probe = harness({ maximumCandidates: 7 });
    const result = runFartherPanelDriver(probe.input);

    expect(result.refusal?.code).toBe("aggregate-candidate-budget-exhausted");
    expect(result.frontier).toBeNull();
    expect(result.parentAttempts.map(({ alternatives }) => alternatives.length)).toEqual([5, 2]);
    expect(result.parentAttempts.map(({ status }) => status)).toEqual(["complete", "refused"]);
    expect(result.completedAlternatives).toHaveLength(7);
    expect(result.unresolvedAlternatives).toHaveLength(7);
    expect(result.rejectedAlternatives).toEqual([]);
    expect(result.evidence.candidateLedger).toEqual({
      maximum: 7,
      reserved: 7,
      refusedReservation: true,
      failedReservation: {
        reservedBefore: 7,
        requested: 1,
        budget: 7,
      },
    });
    expect(result.evidence.narrowingLedger.failedReservation).toBeNull();
    expect(result.evidence.carry?.perParent).toMatchObject([
      { offeredCandidates: 5 },
      { offeredCandidates: 2 },
    ]);
    expect(probe.scoreFrontierPanel).not.toHaveBeenCalled();
  });

  it("classifies an equal-limit shared candidate refusal as budget evidence", () => {
    const probe = harness({ maximumCandidates: 4 });
    const result = runFartherPanelDriver(probe.input);

    expect(result.refusal).toMatchObject({
      code: "aggregate-candidate-budget-exhausted",
      stage: "budget",
    });
    expect(result.parentAttempts).toHaveLength(1);
    expect(result.parentAttempts[0]!.alternatives).toHaveLength(4);
    expect(result.completedAlternatives).toHaveLength(4);
    expect(result.frontier).toBeNull();
    expect(result.evidence.candidateLedger).toEqual({
      maximum: 4,
      reserved: 4,
      refusedReservation: true,
      failedReservation: {
        reservedBefore: 4,
        requested: 1,
        budget: 4,
      },
    });
    expect(result.evidence.narrowingLedger.failedReservation).toBeNull();
    expect(probe.scoreFrontierPanel).not.toHaveBeenCalled();
  });

  it("admits the exact 8,609 boundary and lets K=7 choose a family, not a descendant", () => {
    const probe = harness();
    const result = runFartherPanelDriver(probe.input);

    expect(probe.ledger.reserved).toBe(8_609);
    expect(probe.narrowingWork.map((spy) => spy.mock.calls.length)).toEqual([1, 1]);
    expect(result.refusal).toBeNull();
    expect(result.frontier?.candidates).toHaveLength(9);
    expect(result.decision).toEqual({
      originCandidateId: "step5-parent-1",
      revealingStepNumber: 7,
      survivingCandidateIds: ["step6-1-1", "step6-1-3", "step6-1-0", "step6-1-2"],
      rejectedCandidateIds: ["step6-0-0", "step6-0-1", "step6-0-2", "step6-0-3", "step6-0-4"],
      descendantSettled: false,
      unresolvedDescendantIds: ["step6-1-1", "step6-1-3", "step6-1-0", "step6-1-2"],
    });
    expect(result.unresolvedAlternatives.map(({ source }) => source.stepId)).toEqual(
      Array.from({ length: 4 }, () => "step-006"),
    );
    expect(result.rejectedAlternatives).toHaveLength(5);
    expect(Object.isFrozen(result.completedAlternatives)).toBe(true);
    expect(Object.isFrozen(result.completedAlternatives[0]!.lineage)).toBe(true);
    expect(result.evidence.narrowingLedger.failedReservation).toBeNull();
    expect(result.evidence.candidateLedger.failedReservation).toBeNull();
  });

  it("uses the opted-in subject ledger as the authoritative physical-render budget", () => {
    const probe = harness({ budget: 8_192 });
    const depthNarrowingLedger = createNarrowingSubjectRenderBudgetLedger(8_192);
    const physicalRenders = [3_000, 3_559] as const;
    const subjectWork = [vi.fn(), vi.fn()];
    const result = runFartherPanelDriver({
      ...probe.input,
      depthNarrowingLedger,
      expandParent: ({ parent, depthNarrowingLedger: sharedSubject, candidateLedger }) => {
        expect(sharedSubject).toBe(depthNarrowingLedger);
        const family = Number(parent.candidateId.at(-1));
        const measurement = measured.origins[family]!;
        const committedBefore = sharedSubject!.committed;
        const attempt = sharedSubject!.tryLease(physicalRenders[family]!, (lease) => {
          subjectWork[family]!();
          lease.charge(physicalRenders[family]!);
        });
        expect(attempt.admitted).toBe(true);
        const children = makeChildren(family, measurement.childIds.length);
        for (let index = 0; index < children.length; index += 1) {
          expect(candidateLedger.tryReserve(1)).toBe(true);
        }
        return {
          expansion: {
            parentCandidateId: parent.candidateId,
            narrowingRenders: sharedSubject!.committed - committedBefore,
            offeredPerPiece: measurement.offeredPerPiece,
            carriedPerPiece: measurement.carriedPerPiece,
            children: children.map(({ candidateId, document, documentHash: hash, pieces }) => ({
              candidateId,
              document,
              documentHash: hash,
              pieces,
            })),
          },
          children,
          narrowingBudgetExhausted: false,
          candidateBudgetExhausted: false,
          failure: null,
        };
      },
    });

    expect(result.refusal).toBeNull();
    expect(probe.ledger.reserved).toBe(0);
    expect(depthNarrowingLedger.committed).toBe(6_559);
    expect(result.parentAttempts.map(({ expansion }) => expansion.narrowingRenders)).toEqual([
      3_000, 3_559,
    ]);
    expect(result.evidence.narrowingLedger).toEqual({
      maximum: 8_192,
      reserved: 6_559,
      refusedReservation: false,
      failedReservation: null,
    });
    expect(subjectWork.map((spy) => spy.mock.calls.length)).toEqual([1, 1]);
  });

  it("continues from occluded N+1 to K and returns typed not-observable when K reveals none", () => {
    const occluded = runFartherPanelDriver(harness({ nPlusOne: "occluded" }).input);
    expect(occluded.decision?.originCandidateId).toBe("step5-parent-1");
    expect(occluded.evidence.panels?.panels[0]).toMatchObject({
      stepNumber: 6,
      status: "not-observable",
      reason: "occluded",
    });

    const absentProbe = harness({ nPlusOne: "occluded", kScores: "weak" });
    const absent = runFartherPanelDriver(absentProbe.input);
    expect(absent.decision).toBeNull();
    expect(absent.frontier).toBeNull();
    expect(absent.refusal?.code).toBe("not-observable");
    expect(absent.completedAlternatives).toHaveLength(9);
    expect(absent.rejectedAlternatives).toEqual([]);
    expect(absent.unresolvedAlternatives).toHaveLength(9);
  });

  it("refuses tampered origin, parent binding, child hash, or live document before scoring", () => {
    const originTamper = harness();
    (originTamper.origins[0] as { documentHash: string }).documentHash = "sha256:tampered";
    const originResult = runFartherPanelDriver(originTamper.input);
    expect(originResult.refusal?.code).toBe("farther-input-invalid");
    expect(originTamper.narrowingWork[0]).not.toHaveBeenCalled();

    const parentTamper = harness({
      alterOutput: (output, family) =>
        family === 0
          ? {
              ...output,
              expansion: { ...output.expansion, parentCandidateId: "substituted-parent" },
            }
          : output,
    });
    expect(runFartherPanelDriver(parentTamper.input).refusal?.code).toBe("farther-input-invalid");
    expect(parentTamper.scoreFrontierPanel).not.toHaveBeenCalled();

    const childHashTamper = harness({
      alterOutput: (output, family) => {
        if (family !== 0) return output;
        const first = output.children[0]!;
        const children = [
          { ...first, documentHash: "sha256:tampered" },
          ...output.children.slice(1),
        ];
        return { ...output, children };
      },
    });
    expect(runFartherPanelDriver(childHashTamper.input).refusal?.code).toBe(
      "farther-input-invalid",
    );
    expect(childHashTamper.scoreFrontierPanel).not.toHaveBeenCalled();

    const liveDocumentTamper = harness({
      mutateAfterExpansion: (origins, family) => {
        if (family === 1) origins[0]!.document.revision += 1;
      },
    });
    const liveResult = runFartherPanelDriver(liveDocumentTamper.input);
    expect(liveResult.refusal?.code).toBe("farther-input-invalid");
    expect(liveResult.refusal?.message).toContain("hashDocument returned");
    expect(liveDocumentTamper.scoreFrontierPanel).not.toHaveBeenCalled();
  });

  it("rehashes origins and prior completed alternatives after refused expansion callbacks", () => {
    const budgetMutation = harness({
      budget: 8_192,
      mutateAfterExpansion: (_origins, family, _children, previous) => {
        if (family === 1) previous[0]!.document.revision += 1;
      },
    });
    const budgetResult = runFartherPanelDriver(budgetMutation.input);
    expect(budgetResult.refusal?.code).toBe("farther-input-invalid");
    expect(budgetResult.refusal?.message).toContain('Candidate "step6-0-0"');
    expect(budgetResult.evidence.carry).toBeNull();
    expect(budgetResult.rejectedAlternatives).toEqual([]);
    expect(budgetResult.unresolvedAlternatives).toHaveLength(5);

    const failureMutation = harness({
      mutateAfterExpansion: (origins, family) => {
        if (family === 1) origins[0]!.document.revision += 1;
      },
      alterOutput: (output, family) =>
        family === 1 ? { ...output, failure: { message: "synthetic failure" } } : output,
    });
    const failureResult = runFartherPanelDriver(failureMutation.input);
    expect(failureResult.refusal?.code).toBe("farther-input-invalid");
    expect(failureResult.refusal?.message).toContain('Candidate "step5-parent-0"');
    expect(failureResult.evidence.carry).toBeNull();
  });

  it("reserves the exact aggregate panel rows before invoking K and admits no partial panel", () => {
    const exact = harness({ childrenPerFamily: [7, 7] });
    const exactResult = runFartherPanelDriver(exact.input);
    expect(exact.scoreFrontierPanel).toHaveBeenCalledOnce();
    expect(exact.scoreFrontierPanel.mock.calls[0]![0].reservation).toEqual({
      renderedBefore: 2,
      reservedForPanel: 14,
      renderedAfter: 16,
      maximumPanelRenders: 16,
    });
    expect(exactResult.evidence.panels?.panelRenders).toBe(16);

    const over = harness({ childrenPerFamily: [7, 8] });
    const overResult = runFartherPanelDriver(over.input);
    expect(over.scoreFrontierPanel).not.toHaveBeenCalled();
    expect(overResult.refusal?.code).toBe("panel-render-budget-exhausted");
    expect(overResult.refusal?.message).toContain("from 2 to 17");
    expect(overResult.frontier).toBeNull();
    expect(overResult.evidence.panels).toMatchObject({
      panelRenders: 2,
      panels: [{ stepNumber: 6, status: "unrevealing" }],
    });
    expect(overResult.completedAlternatives).toHaveLength(15);
    expect(overResult.rejectedAlternatives).toEqual([]);
    expect(overResult.unresolvedAlternatives).toHaveLength(15);
  });

  it("binds narrowing exhaustion claims to the shared ledger's refused reservation", () => {
    const concealedRefusal = harness({
      budget: 8_192,
      alterOutput: (output, family) =>
        family === 1 ? { ...output, narrowingBudgetExhausted: false } : output,
    });
    const concealedResult = runFartherPanelDriver(concealedRefusal.input);
    expect(concealedResult.refusal?.code).toBe("farther-input-invalid");
    expect(concealedResult.refusal?.message).toContain("shared narrowing ledger recorded true");

    const fabricatedRefusal = harness({
      alterOutput: (output, family) =>
        family === 0 ? { ...output, narrowingBudgetExhausted: true } : output,
    });
    const fabricatedResult = runFartherPanelDriver(fabricatedRefusal.input);
    expect(fabricatedResult.refusal?.code).toBe("farther-input-invalid");
    expect(fabricatedResult.refusal?.message).toContain("shared narrowing ledger recorded false");
    expect(fabricatedRefusal.scoreFrontierPanel).not.toHaveBeenCalled();
  });

  it("contains K callback failures and rehashes documents after return or throw", () => {
    const thrown = harness({ throwFromScoreFrontier: new Error("synthetic renderer loss") });
    const thrownResult = runFartherPanelDriver(thrown.input);
    expect(thrownResult.refusal).toMatchObject({
      code: "incomplete-panel-evidence",
      stage: "evidence",
      stepNumber: 7,
    });
    expect(thrownResult.refusal?.message).toContain("synthetic renderer loss");
    expect(thrownResult.frontier).toBeNull();
    expect(thrownResult.evidence.carry).not.toBeNull();
    expect(thrownResult.evidence.panels?.panels).toHaveLength(1);
    expect(thrownResult.completedAlternatives).toHaveLength(9);
    expect(thrownResult.rejectedAlternatives).toEqual([]);
    expect(thrownResult.unresolvedAlternatives).toHaveLength(9);

    const returnedMutation = harness({
      onScoreFrontier: (_origins, alternatives) => {
        alternatives[0]!.document.revision += 1;
      },
    });
    const returnedMutationResult = runFartherPanelDriver(returnedMutation.input);
    expect(returnedMutationResult.refusal?.code).toBe("farther-input-invalid");
    expect(returnedMutationResult.refusal?.message).toContain('Candidate "step6-0-0"');

    const thrownMutation = harness({
      onScoreFrontier: (origins) => {
        origins[0]!.document.revision += 1;
      },
      throwFromScoreFrontier: new Error("mutation then throw"),
    });
    const thrownMutationResult = runFartherPanelDriver(thrownMutation.input);
    expect(thrownMutationResult.refusal?.code).toBe("farther-input-invalid");
    expect(thrownMutationResult.refusal?.message).toContain('Candidate "step5-parent-0"');
    expect(thrownMutationResult.refusal?.message).not.toContain("mutation then throw");
  });

  it("makes the exact next reservation atomic at the boundary", () => {
    const below = harness({ budget: 8_608 });
    runFartherPanelDriver(below.input);
    expect(below.ledger.reserved).toBe(2_628);
    expect(below.ledger.failedReservation).toEqual({
      reservedBefore: 2_628,
      requested: 5_981,
      budget: 8_608,
    });
    expect(below.narrowingWork[1]).not.toHaveBeenCalled();

    const exact = harness({ budget: 8_609 });
    runFartherPanelDriver(exact.input);
    expect(exact.ledger.reserved).toBe(8_609);
    expect(exact.ledger.failedReservation).toBeNull();
    expect(exact.narrowingWork[1]).toHaveBeenCalledOnce();
  });

  it("rejects a failed-reservation witness that does not match the terminal ledger state", () => {
    const probe = harness({ budget: 8_192 });
    const narrowingLedger: typeof probe.input.narrowingLedger = Object.freeze({
      budget: probe.ledger.budget,
      get reserved() {
        return probe.ledger.reserved;
      },
      get refusedReservation() {
        return probe.ledger.refusedReservation;
      },
      get failedReservation() {
        const failure = probe.ledger.failedReservation;
        return failure === null ? null : { ...failure, reservedBefore: failure.reservedBefore + 1 };
      },
      tryReserve: (count: number) => probe.ledger.tryReserve(count),
    });

    const result = runFartherPanelDriver({ ...probe.input, narrowingLedger });
    expect(result.refusal).toMatchObject({ code: "farther-input-invalid", stage: "input" });
    expect(result.refusal?.message).toContain("shared narrowing ledger recorded");
    expect(result.completedAlternatives).toHaveLength(5);
  });

  it("rejects non-atomic candidate-ledger failure witnesses", () => {
    for (const firstReservation of [1, 2]) {
      const probe = harness({ maximumCandidates: 2 });
      const result = runFartherPanelDriver({
        ...probe.input,
        expandParent: ({ parent, candidateLedger }) => {
          expect(candidateLedger.tryReserve(firstReservation)).toBe(true);
          expect(candidateLedger.tryReserve(2)).toBe(false);
          return {
            expansion: {
              parentCandidateId: parent.candidateId,
              narrowingRenders: 0,
              offeredPerPiece: [],
              carriedPerPiece: [],
              children: [],
            },
            children: [],
            narrowingBudgetExhausted: false,
            candidateBudgetExhausted: true,
            failure: null,
          };
        },
      });

      expect(result.refusal).toMatchObject({ code: "farther-input-invalid", stage: "input" });
      expect(result.refusal?.message).toContain("shared candidate ledger recorded");
    }
  });
});
