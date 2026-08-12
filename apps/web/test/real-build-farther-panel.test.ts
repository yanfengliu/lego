import { describe, expect, it } from "vitest";

import {
  carryFartherFrontier,
  createFartherOriginFrontier,
  findFirstRevealingPanel,
  type FartherCarryInput,
  type FartherOriginInput,
  type FartherParentExpansion,
  type FartherPlacementWitness,
  type FirstRevealingPanelInput,
} from "../e2e/real-build-farther-panel";

type ProbeDocument = { readonly hash: string };
const witnesses = (stepNumber: number, count: number): readonly FartherPlacementWitness[] =>
  Array.from({ length: count }, (_, index) => ({
    catalogPartId: `builtin:probe-${stepNumber}-${index}`,
    colorId: "builtin:black",
    transform: {
      positionLdu: [stepNumber * 20, index * 8, index * 20] as const,
      orientationId: `upright-yaw-${(index % 4) * 90}`,
    },
  }));
const origin = createFartherOriginFrontier({
  stepNumber: 5,
  candidates: [
    {
      candidateId: "step5-parent-0",
      document: { hash: "step5-parent-0" },
      documentHash: "sha256:step5-parent-0",
      pieces: witnesses(5, 2),
    },
    {
      candidateId: "step5-parent-1",
      document: { hash: "step5-parent-1" },
      documentHash: "sha256:step5-parent-1",
      pieces: witnesses(5, 2),
    },
  ],
}).frontier!;
const children = (parent: 0 | 1, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    candidateId: `step6-${parent}-${index}`,
    document: { hash: `step6-${parent}-${index}` },
    documentHash: `sha256:step6-${parent}-${index}`,
    pieces: witnesses(6, 4),
  }));
const step6AtomicPieces = witnesses(6, 4).map(({ catalogPartId, colorId }) => ({
  catalogPartId,
  colorId,
}));
/** Exact counts measured by the local /13 step-5 -> 6 -> 7 probe. */
const measuredExpansions: readonly FartherParentExpansion<ProbeDocument>[] = [
  {
    parentCandidateId: "step5-parent-0",
    narrowingRenders: 2_628,
    offeredPerPiece: [428, 710, 718, 772],
    carriedPerPiece: [1, 1, 1, 5],
    children: children(0, 5),
  },
  {
    parentCandidateId: "step5-parent-1",
    narrowingRenders: 5_981,
    offeredPerPiece: [187, 526, 614, 566],
    carriedPerPiece: [2, 2, 1, 1],
    children: children(1, 4),
  },
];
const carryInput = (maximumNarrowingRenders: number): FartherCarryInput<ProbeDocument> => ({
  frontier: origin,
  stepNumber: 6,
  expectedAtomicPieces: step6AtomicPieces,
  expansions: measuredExpansions,
  maximumCandidates: 512,
  maximumNarrowingRenders,
});
const carry = (maximumNarrowingRenders: number) =>
  carryFartherFrontier(carryInput(maximumNarrowingRenders));
const panelInput = (): FirstRevealingPanelInput<ProbeDocument> => ({
  frontier: origin,
  originEvidence: { stepNumber: 5, status: "unseparated", margin: 0, minimumMargin: 0.01 },
  panels: [{ stepNumber: 6, status: "not-observable", reason: "occluded" }],
  minimumAgreement: 0.85,
  minimumMargin: 0.02,
  maximumPanelRenders: 16,
  maximumReachSteps: 1,
  fartherPanelsAvailable: false,
});
describe("farther-panel runtime closure", () => {
  it("returns typed input refusals for malformed nested witnesses and arrays", () => {
    const nullRefusalCodes = [
      createFartherOriginFrontier(null as unknown as FartherOriginInput<ProbeDocument>).refusal
        ?.code,
      carryFartherFrontier(null as unknown as FartherCarryInput<ProbeDocument>).refusal?.code,
      findFirstRevealingPanel(null as unknown as FirstRevealingPanelInput<ProbeDocument>).refusal
        ?.code,
    ];
    expect(nullRefusalCodes).toEqual(Array.from({ length: 3 }, () => "farther-input-invalid"));
    const candidates = origin.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      document: candidate.document,
      documentHash: candidate.lineage[0]!.documentHash,
      pieces: candidate.lineage[0]!.pieces,
    }));
    const malformedOrigin = {
      stepNumber: 5,
      candidates: [
        {
          ...candidates[0]!,
          pieces: [
            {
              ...candidates[0]!.pieces[0]!,
              transform: {
                ...candidates[0]!.pieces[0]!.transform,
                positionLdu: [0, 0],
              },
            },
          ],
        },
        candidates[1]!,
      ],
    } as unknown as FartherOriginInput<ProbeDocument>;
    const originResult = createFartherOriginFrontier(malformedOrigin);
    expect(originResult.refusal?.code).toBe("farther-input-invalid");
    expect(originResult.refusal?.message).toContain(
      "origin.candidates[0].pieces[0].transform.positionLdu has length 2; required exactly 3",
    );
    const malformedCarry = {
      ...carryInput(8_609),
      expansions: [{ ...measuredExpansions[0]!, offeredPerPiece: null }, measuredExpansions[1]!],
    } as unknown as FartherCarryInput<ProbeDocument>;
    const carryResult = carryFartherFrontier(malformedCarry);
    expect(carryResult.refusal?.code).toBe("farther-input-invalid");
    expect(carryResult.refusal?.message).toContain(
      "carry.expansions[0].offeredPerPiece is null; required an array",
    );
  });
  it("closes every panel union before reading scores", () => {
    const base = panelInput();
    const invalidInputs: readonly [unknown, string][] = [
      [
        { ...base, originEvidence: { ...base.originEvidence, status: "settled" } },
        "originEvidence.status",
      ],
      [{ ...base, panels: [{ stepNumber: 6, status: "visible" }] }, 'status is "visible"'],
      [
        { ...base, panels: [{ stepNumber: 6, status: "not-observable", reason: "fog" }] },
        'reason is "fog"',
      ],
      [
        { ...base, panels: [{ stepNumber: 6, status: "scored", subject: "origin" }] },
        'missing key "scores"',
      ],
    ];
    for (const [unsafeInput, message] of invalidInputs) {
      const result = findFirstRevealingPanel(
        unsafeInput as unknown as FirstRevealingPanelInput<ProbeDocument>,
      );
      expect(result.refusal?.code).toBe("farther-input-invalid");
      expect(result.refusal?.stage).toBe("input");
      expect(result.refusal?.message).toContain(message);
      expect(result.evidence.origin).toBeNull();
    }
  });
});

describe("farther-panel frontier admission", () => {
  it("refuses the real two-parent carry at the aggregate 8,192 render limit", () => {
    const result = carry(8_192);

    expect(result.frontier).toBeNull();
    expect(result.refusal?.code).toBe("aggregate-narrowing-budget-exhausted");
    expect(result.refusal?.message).toContain("once per parent would silently multiply");
    expect(result.evidence).toMatchObject({
      parentCandidates: 2,
      parentsExpanded: 2,
      offeredCandidates: 9,
      narrowingRenders: 8_609,
      maximumNarrowingRenders: 8_192,
    });
    expect(result.evidence.perParent).toEqual([
      expect.objectContaining({
        parentCandidateId: "step5-parent-0",
        offeredCandidates: 5,
        narrowingRenders: 2_628,
      }),
      expect.objectContaining({
        parentCandidateId: "step5-parent-1",
        offeredCandidates: 4,
        narrowingRenders: 5_981,
      }),
    ]);
    // Refusal admits no live partial frontier, but retains all nine measured
    // lineages and every four-piece witness for diagnosis.
    expect(result.evidence.measuredLineages).toHaveLength(9);
    expect(
      result.evidence.measuredLineages.every(
        ({ lineage }) => lineage.length === 2 && lineage[1]!.pieces.length === 4,
      ),
    ).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.refusal)).toBe(true);
    expect(Object.isFrozen(result.evidence.measuredLineages[0])).toBe(true);
  });

  it("refuses a missing parent or a partial same-step child instead of pruning it", () => {
    const missing = carryFartherFrontier({
      frontier: origin,
      stepNumber: 6,
      expectedAtomicPieces: step6AtomicPieces,
      expansions: measuredExpansions.slice(0, 1),
      maximumCandidates: 512,
      maximumNarrowingRenders: 8_192,
    });
    expect(missing.refusal?.code).toBe("incomplete-parent-expansion");
    expect(missing.frontier).toBeNull();

    const partial = carryFartherFrontier({
      frontier: origin,
      stepNumber: 6,
      expectedAtomicPieces: step6AtomicPieces,
      expansions: [
        {
          ...measuredExpansions[0]!,
          children: [{ ...children(0, 1)[0]!, pieces: witnesses(6, 3) }],
        },
        measuredExpansions[1]!,
      ],
      maximumCandidates: 512,
      maximumNarrowingRenders: 8_192,
    });
    expect(partial.refusal?.code).toBe("incomplete-atomic-step");
    expect(partial.frontier).toBeNull();
  });

  it("retains every valid measured lineage from a three-parent refusal prefix", () => {
    const threeParentOrigin = createFartherOriginFrontier({
      stepNumber: 5,
      candidates: [0, 1, 2].map((parent) => ({
        candidateId: `three-parent-${parent}`,
        document: { hash: `three-parent-${parent}` },
        documentHash: `sha256:three-parent-${parent}`,
        pieces: witnesses(5, 2),
      })),
    }).frontier!;
    const prefixExpansions: readonly FartherParentExpansion<ProbeDocument>[] = [
      {
        parentCandidateId: "three-parent-0",
        narrowingRenders: 11,
        offeredPerPiece: [3, 3, 3, 2],
        carriedPerPiece: [1, 1, 1, 1],
        children: [0, 1].map((child) => ({
          candidateId: `three-child-0-${child}`,
          document: { hash: `three-child-0-${child}` },
          documentHash: `sha256:three-child-0-${child}`,
          pieces: witnesses(6, 4),
        })),
      },
      {
        parentCandidateId: "three-parent-1",
        narrowingRenders: 7,
        offeredPerPiece: [2, 2, 2, 1],
        carriedPerPiece: [1, 1, 1, 1],
        children: [
          {
            candidateId: "three-child-1-0",
            document: { hash: "three-child-1-0" },
            documentHash: "sha256:three-child-1-0",
            pieces: witnesses(6, 4),
          },
        ],
      },
    ];
    const result = carryFartherFrontier({
      frontier: threeParentOrigin,
      stepNumber: 6,
      expectedAtomicPieces: step6AtomicPieces,
      expansions: prefixExpansions,
      maximumCandidates: 16,
      maximumNarrowingRenders: 32,
    });

    expect(result.frontier).toBeNull();
    expect(result.refusal?.code).toBe("incomplete-parent-expansion");
    expect(result.evidence).toMatchObject({
      parentCandidates: 3,
      parentsExpanded: 2,
      offeredCandidates: 3,
      narrowingRenders: 18,
    });
    expect(
      result.evidence.measuredLineages.map(
        ({ candidateId, parentCandidateId, originCandidateId, lineage }) => ({
          candidateId,
          parentCandidateId,
          originCandidateId,
          hashes: lineage.map(({ documentHash }) => documentHash),
        }),
      ),
    ).toEqual([
      {
        candidateId: "three-child-0-0",
        parentCandidateId: "three-parent-0",
        originCandidateId: "three-parent-0",
        hashes: ["sha256:three-parent-0", "sha256:three-child-0-0"],
      },
      {
        candidateId: "three-child-0-1",
        parentCandidateId: "three-parent-0",
        originCandidateId: "three-parent-0",
        hashes: ["sha256:three-parent-0", "sha256:three-child-0-1"],
      },
      {
        candidateId: "three-child-1-0",
        parentCandidateId: "three-parent-1",
        originCandidateId: "three-parent-1",
        hashes: ["sha256:three-parent-1", "sha256:three-child-1-0"],
      },
    ]);
    expect(result.evidence.measuredLineages).toHaveLength(result.evidence.offeredCandidates);
    expect(Object.isFrozen(result.evidence.measuredLineages)).toBe(true);
    expect(Object.isFrozen(result.evidence.measuredLineages[0]!.lineage)).toBe(true);
    expect(Object.isFrozen(result.evidence.measuredLineages[0]!.lineage[1]!.pieces)).toBe(true);
  });

  it("refuses a same-count substitution and a skipped intervening step", () => {
    const substituted = carryFartherFrontier({
      frontier: origin,
      stepNumber: 6,
      expectedAtomicPieces: step6AtomicPieces,
      expansions: [
        {
          ...measuredExpansions[0]!,
          children: [
            {
              ...children(0, 1)[0]!,
              pieces: [
                ...witnesses(6, 3),
                { ...witnesses(6, 4)[3]!, catalogPartId: "builtin:substitute" },
              ],
            },
          ],
        },
        measuredExpansions[1]!,
      ],
      maximumCandidates: 512,
      maximumNarrowingRenders: 8_192,
    });
    expect(substituted.refusal?.code).toBe("incomplete-atomic-step");
    expect(substituted.refusal?.message).toContain(
      'child "step6-0-0" under parent "step5-parent-0" has piece identities',
    );
    expect(substituted.evidence.offeredCandidates).toBe(5);

    const skipped = carryFartherFrontier({
      frontier: origin,
      stepNumber: 7,
      expectedAtomicPieces: step6AtomicPieces,
      expansions: measuredExpansions,
      maximumCandidates: 512,
      maximumNarrowingRenders: 8_192,
    });
    expect(skipped.refusal?.code).toBe("farther-input-invalid");
    expect(skipped.refusal?.message).toContain(
      "stepNumber is 7; required exactly 6, the next intervening step",
    );

    const overflow = carryFartherFrontier({
      frontier: origin,
      stepNumber: 6,
      expectedAtomicPieces: step6AtomicPieces,
      expansions: measuredExpansions.map((expansion) => ({
        ...expansion,
        narrowingRenders: Number.MAX_SAFE_INTEGER,
      })),
      maximumCandidates: 512,
      maximumNarrowingRenders: Number.MAX_SAFE_INTEGER,
    });
    expect(overflow.refusal?.code).toBe("farther-input-invalid");
    expect(overflow.refusal?.message).toContain(
      "aggregate narrowingRenders is 18014398509481982; required a safe integer sum",
    );
  });
});

describe("first revealing farther panel", () => {
  it("lets K=7 settle the step-5 family while retaining all four step-6 descendants", () => {
    // The scorer is exercised over the complete measured frontier. This limit
    // is diagnostic only; the production 8,192 admission above still refuses it.
    const frontier = carry(8_609).frontier!;
    const result = findFirstRevealingPanel({
      frontier,
      originEvidence: {
        stepNumber: 5,
        status: "unseparated",
        margin: 0.002799160251924393,
        minimumMargin: 0.01,
      },
      panels: [
        {
          stepNumber: 6,
          status: "scored",
          subject: "origin",
          scores: [
            { candidateId: "step5-parent-0", agreement: 0.6006833844906468 },
            { candidateId: "step5-parent-1", agreement: 0.7635021804763502 },
          ],
        },
        {
          stepNumber: 7,
          status: "scored",
          subject: "frontier",
          scores: [
            { candidateId: "step6-1-1", agreement: 0.8646933735766223 },
            { candidateId: "step6-1-3", agreement: 0.858981722355485 },
            { candidateId: "step6-1-0", agreement: 0.8557316948979938 },
            { candidateId: "step6-1-2", agreement: 0.8491001538770322 },
            { candidateId: "step6-0-2", agreement: 0.6999400574186831 },
            { candidateId: "step6-0-0", agreement: 0.6943221546031335 },
            { candidateId: "step6-0-1", agreement: 0.677316801780321 },
            { candidateId: "step6-0-3", agreement: 0.6602800744424444 },
            { candidateId: "step6-0-4", agreement: 0.6493466938750647 },
          ],
        },
      ],
      minimumAgreement: 0.85,
      minimumMargin: 0.02,
      maximumPanelRenders: 16,
      maximumReachSteps: 2,
      fartherPanelsAvailable: true,
    });

    expect(result.refusal).toBeNull();
    expect(result.decision).toEqual({
      originCandidateId: "step5-parent-1",
      revealingStepNumber: 7,
      survivingCandidateIds: ["step6-1-1", "step6-1-3", "step6-1-0", "step6-1-2"],
      rejectedCandidateIds: ["step6-0-0", "step6-0-1", "step6-0-2", "step6-0-3", "step6-0-4"],
      descendantSettled: false,
    });
    expect(result.evidence.panelRenders).toBe(11);
    expect(
      result.evidence.panels.map(({ stepNumber, status }) => ({ stepNumber, status })),
    ).toEqual([
      { stepNumber: 6, status: "unrevealing" },
      { stepNumber: 7, status: "revealing" },
    ]);
    expect(result.evidence.panels[0]).toMatchObject({
      reason: "weak-agreement",
      bestAgreement: 0.7635021804763502,
    });
    expect(result.evidence.panels[1]!.familyMargin).toBeCloseTo(
      0.8646933735766223 - 0.6999400574186831,
      12,
    );
    expect(result.evidence.panels[1]!.descendantMargin).toBeCloseTo(0.0057116512211373, 12);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.decision)).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });

  it("admits origin scores only at N+1 or uncarried K=N+2", () => {
    const originFrontier = origin;
    const originEvidence = {
      stepNumber: 5,
      status: "unseparated" as const,
      margin: 0,
      minimumMargin: 0.01,
    };
    const scored = (stepNumber: number) => ({
      stepNumber,
      status: "scored" as const,
      subject: "origin" as const,
      scores: originFrontier.candidates.map(({ candidateId }, index) => ({
        candidateId,
        agreement: 0.7 + index / 100,
      })),
    });
    const later = findFirstRevealingPanel({
      frontier: originFrontier,
      originEvidence,
      panels: [scored(6), scored(7), scored(8)],
      minimumAgreement: 0.85,
      minimumMargin: 0.02,
      maximumPanelRenders: 16,
      maximumReachSteps: 3,
      fartherPanelsAvailable: false,
    });
    expect(later.refusal?.code).toBe("farther-input-invalid");
    expect(later.refusal?.message).toContain("origin N+1, measured uncarried origin K=N+2");

    const constructed = findFirstRevealingPanel({
      frontier: carry(8_609).frontier!,
      originEvidence,
      panels: [scored(6), scored(7)],
      minimumAgreement: 0.85,
      minimumMargin: 0.02,
      maximumPanelRenders: 16,
      maximumReachSteps: 2,
      fartherPanelsAvailable: false,
    });
    expect(constructed.refusal?.code).toBe("farther-input-invalid");
    expect(constructed.refusal?.message).toContain("origin N+1, measured uncarried origin K=N+2");
  });

  it("reports not-observable when occluded and weak panels exhaust the evidence", () => {
    const frontier = carry(8_609).frontier!;
    const result = findFirstRevealingPanel({
      frontier,
      originEvidence: {
        stepNumber: 5,
        status: "no-local-signal",
        margin: null,
        minimumMargin: null,
      },
      panels: [
        { stepNumber: 6, status: "not-observable", reason: "occluded" },
        {
          stepNumber: 7,
          status: "scored",
          subject: "frontier",
          scores: frontier.candidates.map(({ candidateId }) => ({ candidateId, agreement: 0.7 })),
        },
      ],
      minimumAgreement: 0.85,
      minimumMargin: 0.02,
      maximumPanelRenders: 16,
      maximumReachSteps: 2,
      fartherPanelsAvailable: false,
    });

    expect(result.decision).toBeNull();
    expect(result.refusal?.code).toBe("not-observable");
    expect(result.evidence.panels).toEqual([
      expect.objectContaining({ stepNumber: 6, status: "not-observable", reason: "occluded" }),
      expect.objectContaining({ stepNumber: 7, status: "unrevealing", reason: "weak-agreement" }),
    ]);
  });

  it("names the reach limit without scoring a panel beyond it", () => {
    const frontier = carry(8_609).frontier!;
    const result = findFirstRevealingPanel({
      frontier,
      originEvidence: {
        stepNumber: 5,
        status: "unseparated",
        margin: 0,
        minimumMargin: 0.01,
      },
      panels: [
        { stepNumber: 6, status: "not-observable", reason: "occluded" },
        { stepNumber: 7, status: "not-observable", reason: "occluded" },
      ],
      minimumAgreement: 0.85,
      minimumMargin: 0.02,
      maximumPanelRenders: 16,
      maximumReachSteps: 1,
      fartherPanelsAvailable: true,
    });

    expect(result.refusal?.code).toBe("farther-panel-limit-reached");
    expect(result.evidence.panels).toHaveLength(1);
    expect(result.evidence.panels[0]).toMatchObject({ stepNumber: 6, reason: "occluded" });
  });

  it("refuses skipped panels, unconstructed reach, and out-of-range agreement", () => {
    const frontier = carry(8_609).frontier!;
    const common = {
      originEvidence: {
        stepNumber: 5,
        status: "unseparated" as const,
        margin: 0.002799160251924393,
        minimumMargin: 0.01,
      },
      minimumAgreement: 0.85,
      minimumMargin: 0.02,
      maximumPanelRenders: 16,
      maximumReachSteps: 3,
      fartherPanelsAvailable: true,
    };
    const scores = frontier.candidates.map(({ candidateId }) => ({ candidateId, agreement: 0.9 }));

    const skippedPanel = findFirstRevealingPanel({
      ...common,
      frontier,
      panels: [{ stepNumber: 7, status: "scored", subject: "frontier", scores }],
    });
    expect(skippedPanel.refusal?.code).toBe("farther-input-invalid");
    expect(skippedPanel.refusal?.message).toContain(
      "panels[0].stepNumber is 7; required contiguous step 6",
    );
    expect(
      findFirstRevealingPanel({
        ...common,
        frontier: origin,
        panels: [
          { stepNumber: 6, status: "not-observable", reason: "occluded" },
          { stepNumber: 7, status: "scored", subject: "frontier", scores },
        ],
      }).refusal?.code,
    ).toBe("farther-input-invalid");
    const invalidScore = findFirstRevealingPanel({
      ...common,
      frontier,
      panels: [
        { stepNumber: 6, status: "not-observable", reason: "occluded" },
        {
          stepNumber: 7,
          status: "scored",
          subject: "frontier",
          scores: scores.map((score, index) =>
            index === 0 ? { ...score, agreement: 1.01 } : score,
          ),
        },
      ],
    });
    expect(invalidScore.refusal?.code).toBe("incomplete-panel-evidence");
    expect(invalidScore.refusal?.message).toContain(
      "scores[0].agreement is 1.01; required a finite value in [0, 1]",
    );
    expect(
      findFirstRevealingPanel({
        ...common,
        originEvidence: { ...common.originEvidence, margin: 0.03 },
        frontier,
        panels: [],
      }).refusal?.code,
    ).toBe("farther-input-invalid");
  });
});
