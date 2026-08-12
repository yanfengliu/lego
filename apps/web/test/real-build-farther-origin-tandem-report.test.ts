import { describe, expect, it } from "vitest";

import type { DeferralEvidence } from "../e2e/real-build-deferral";
import { isRealBuildFartherDecisionPieceCoherent } from "../e2e/real-build-farther-decision-piece-coherence";
import { MEASURED_FARTHER_ORIGIN_PANEL_SPECS } from "../e2e/real-build-farther-origin-policy";
import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "../e2e/real-build-farther-origin-source-manifest";
import {
  isRealBuildFartherCaptures,
  isRealBuildFartherEvidence,
} from "../e2e/real-build-farther-report-parser";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { DIGEST, PNG, options } from "./real-build-adversarial-fixtures";

const originStepNumber = 5;
const PDF_DIGEST = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const ACTION_LEDGER_DIGEST =
  "sha256:e88688b23310b9ae16039c57f0ffbf2c5cbf36385e81af6e4824ac9faf64a377";
const HIGHLIGHT_CALIBRATION_DIGEST =
  "sha256:f18939b8b9b98123868c437561113f81c44142b4004aa206dfaf7d4b954ffadf";
const TRANSITION_CLASSIFICATIONS_DIGEST =
  "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab";
const ORIGIN_HASHES = [
  "sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8",
  "sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
] as const;
const ORIGIN_IDS = [
  "step-005:sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8",
  "step-005:sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
] as const;
const nPlusOneScores = [0.6006833844906468, 0.7635021804763502] as const;
const kScores = [0.81657223796034, 0.9367520589707421] as const;

const step5Pieces = MEASURED_FARTHER_ORIGIN_PANEL_SPECS[0]!.pieces;

const basePrepared = options(7);
const prepared: RealBuildOptions = {
  ...basePrepared,
  panels: basePrepared.panels.map((panel) =>
    panel.stepNumber >= 5 && panel.stepNumber <= 7
      ? (structuredClone(
          MEASURED_FARTHER_ORIGIN_PANEL_SPECS[panel.stepNumber - 5],
        ) as RealBuildPanelSpec)
      : panel,
  ),
  inputDigests: {
    ...basePrepared.inputDigests,
    pdf: PDF_DIGEST,
    calloutManifest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
    coverage: "sha256:0ed8fb0225057ba6d36ae00f45d37921a0b590ff6de42fa96774545d62a4c3c6",
    officialModel: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
    actionLedger: ACTION_LEDGER_DIGEST,
    highlightCalibration: HIGHLIGHT_CALIBRATION_DIGEST,
    builderCalibration: "sha256:da326b44897eec7d0a3a7049c0d06cb8ae8c0fbcbcda2e3f7423d7017abd241b",
    builderGeometry: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
    transitionClassifications: TRANSITION_CLASSIFICATIONS_DIGEST,
  },
  deferredNarrowingRenderBudget: 8_192,
  fartherPanelMaximumReachSteps: 2,
  fartherPanelRenderBudget: 16,
  minimumDeferredAgreement: 0.85,
  minimumDeferredAgreementMargin: 0.02,
  renderScale: 6,
  panelWidth: 1_000,
  workFactor: 2,
  measuredFartherOriginSourceAttestation: MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION,
};

const deferral: DeferralEvidence = {
  trigger: "unseparated-by-own-panel",
  ownPanelMargin: 0.002799160251924393,
  ownPanelMinimumMargin: 0.01,
  lookaheadStepNumber: 6,
  reachSteps: 1,
  lookaheadUpSign: 1,
  lookaheadMeasure: "iou",
  lookaheadTurnDegrees: 90,
  lookaheadTurnAnchorIou: 0.5722015556307068,
  lookaheadTurnMargin: 0.07340921030340147,
  wholeStepCandidates: 2,
  narrowingRenders: 574,
  offeredPerPiece: [174, 400],
  carriedPerPiece: [1, 2],
  rendered: 2,
  lookaheadBuiltPixels: 14_331,
  bestAgreement: nPlusOneScores[1],
  runnerUpAgreement: nPlusOneScores[0],
  margin: nPlusOneScores[1] - nPlusOneScores[0],
  minimumMargin: 0.02,
  minimumAgreement: 0.85,
  settled: false,
};

const witness = (
  catalogPartId: string,
  colorId: string,
  positionLdu: readonly [number, number, number],
) => ({
  catalogPartId,
  colorId,
  transform: { positionLdu, orientationId: "upright-yaw-270" },
});

const farther = {
  origin: {
    evidence: {
      stepNumber: originStepNumber,
      status: "unseparated" as const,
      margin: deferral.ownPanelMargin,
      minimumMargin: deferral.ownPanelMinimumMargin,
    },
    candidates: [
      {
        candidateId: ORIGIN_IDS[0],
        documentHash: ORIGIN_HASHES[0],
        pieces: [
          witness("builtin:plate-2x4", "builtin:green", [60, 8, 0]),
          witness("builtin:plate-2x14", "builtin:black", [160, -8, 40]),
        ],
        lookaheadAgreement: nPlusOneScores[0],
        lookaheadShiftPx: [68, 12] as const,
      },
      {
        candidateId: ORIGIN_IDS[1],
        documentHash: ORIGIN_HASHES[1],
        pieces: [
          witness("builtin:plate-2x4", "builtin:green", [60, 8, 0]),
          witness("builtin:plate-2x14", "builtin:black", [160, 8, 100]),
        ],
        lookaheadAgreement: nPlusOneScores[1],
        lookaheadShiftPx: [102, 28] as const,
      },
    ],
  },
  carries: [],
  panels: [
    {
      stepNumber: 6,
      reachSteps: 1,
      status: "unrevealing" as const,
      reason: "weak-agreement" as const,
      scores: ORIGIN_IDS.map((candidateId, index) => ({
        candidateId,
        agreement: nPlusOneScores[index]!,
      })),
      bestAgreement: nPlusOneScores[1],
      familyMargin: nPlusOneScores[1] - nPlusOneScores[0],
      descendantMargin: null,
    },
    {
      stepNumber: 7,
      reachSteps: 2,
      status: "revealing" as const,
      reason: null,
      scores: ORIGIN_IDS.map((candidateId, index) => ({
        candidateId,
        agreement: kScores[index]!,
      })),
      bestAgreement: kScores[1],
      familyMargin: kScores[1] - kScores[0],
      descendantMargin: null,
    },
  ],
  budgets: {
    offeredCandidates: 0,
    maximumCandidates: prepared.deferredCandidateBudget,
    narrowingRenders: 0,
    maximumNarrowingRenders: prepared.deferredNarrowingRenderBudget,
    panelRenders: 4,
    maximumPanelRenders: prepared.fartherPanelRenderBudget,
    reachSteps: 2,
    maximumReachSteps: prepared.fartherPanelMaximumReachSteps,
    refusedReservation: false,
    failedNarrowingReservation: null,
    candidateRefusedReservation: false,
    failedCandidateReservation: null,
  },
  refusal: null,
  decision: {
    originCandidateId: ORIGIN_IDS[1],
    revealingStepNumber: 7,
    survivingCandidateIds: [ORIGIN_IDS[1]],
    rejectedCandidateIds: [ORIGIN_IDS[0]],
    descendantSettled: true,
  },
};

const captures = farther.panels
  .flatMap((panel) => [
    {
      captureId: 0,
      role: "source-panel" as const,
      panelStepNumber: panel.stepNumber,
      candidateId: null,
      png: PNG,
    },
    ...panel.scores.map(({ candidateId }) => ({
      captureId: 0,
      role: "candidate-render" as const,
      panelStepNumber: panel.stepNumber,
      candidateId,
      png: PNG,
    })),
  ])
  .map((capture, captureId) => ({ ...capture, captureId }));

const parses = (candidate: unknown, exactOptions: RealBuildOptions = prepared): boolean =>
  isRealBuildFartherEvidence(candidate, originStepNumber, 2, deferral, exactOptions);

const withPanel = (
  exactOptions: RealBuildOptions,
  stepNumber: number,
  mutate: (panel: RealBuildPanelSpec) => RealBuildPanelSpec,
): RealBuildOptions => ({
  ...exactOptions,
  panels: exactOptions.panels.map((panel) =>
    panel.stepNumber === stepNumber ? mutate(panel) : panel,
  ),
});

describe("real build measured direct-origin farther-panel report contract", () => {
  it("preserves a generic no-carry origin decision that reveals at N+1", () => {
    const legacyOptions = options(1);
    const legacyDeferral: DeferralEvidence = {
      ...deferral,
      ownPanelMargin: 0.01,
      ownPanelMinimumMargin: 0.02,
      lookaheadStepNumber: 2,
      lookaheadTurnDegrees: 0,
      lookaheadTurnAnchorIou: 0.8,
      lookaheadTurnMargin: 0.2,
      wholeStepCandidates: 2,
      narrowingRenders: 0,
      offeredPerPiece: [],
      carriedPerPiece: [],
      rendered: 2,
      lookaheadBuiltPixels: 100,
      bestAgreement: 0.9,
      runnerUpAgreement: 0.5,
      margin: 0.4,
    };
    const legacy = {
      origin: {
        evidence: {
          stepNumber: 1,
          status: "unseparated" as const,
          margin: 0.01,
          minimumMargin: 0.02,
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
      carries: [],
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
        offeredCandidates: 0,
        maximumCandidates: legacyOptions.deferredCandidateBudget,
        narrowingRenders: 0,
        maximumNarrowingRenders: legacyOptions.deferredNarrowingRenderBudget,
        panelRenders: 2,
        maximumPanelRenders: legacyOptions.fartherPanelRenderBudget,
        reachSteps: 1,
        maximumReachSteps: legacyOptions.fartherPanelMaximumReachSteps,
        refusedReservation: false,
        failedNarrowingReservation: null,
        candidateRefusedReservation: false,
        failedCandidateReservation: null,
      },
      refusal: null,
      decision: {
        originCandidateId: "origin-a",
        revealingStepNumber: 2,
        survivingCandidateIds: ["origin-a"],
        rejectedCandidateIds: ["origin-b"],
        descendantSettled: true,
      },
    };
    expect(isRealBuildFartherEvidence(legacy, 1, 0, legacyDeferral, legacyOptions)).toBe(true);
  });

  it("accepts only the measured step-5 origins scored at panels 6 and 7", () => {
    expect(parses(farther)).toBe(true);
    expect(isRealBuildFartherCaptures(captures, farther)).toBe(true);
  });

  it("rebinds a decision to its exact selected-origin piece rows", () => {
    type DecisionPieceRow = Parameters<
      typeof isRealBuildFartherDecisionPieceCoherent
    >[0]["reportPieces"][number];
    const reportPieces: readonly DecisionPieceRow[] = farther.origin.candidates[1]!.pieces.map(
      (piece) => ({
        catalogPartId: piece.catalogPartId,
        placed: true,
        positionLdu: piece.transform.positionLdu,
        orientationId: piece.transform.orientationId,
        failure: null,
      }),
    );
    const coherent = (pieces: readonly DecisionPieceRow[], preparedPieces = step5Pieces) =>
      isRealBuildFartherDecisionPieceCoherent({
        farther,
        reportPieces: pieces,
        preparedPieces,
      });
    expect(coherent(reportPieces)).toBe(true);
    expect(
      coherent([{ ...reportPieces[0]!, positionLdu: [0, 0, 0] as const }, reportPieces[1]!]),
    ).toBe(false);
    expect(coherent([{ ...reportPieces[0]!, placed: false }, reportPieces[1]!])).toBe(false);
    expect(coherent([{ ...reportPieces[0]!, failure: {} }, reportPieces[1]!])).toBe(false);
    expect(
      coherent([
        ...reportPieces,
        {
          ...reportPieces[0]!,
          catalogPartId: "builtin:omitted-ledger-piece",
        },
      ]),
    ).toBe(true);
    expect(
      coherent(reportPieces, [
        { ...step5Pieces[0]!, colorId: "builtin:black" as string },
        step5Pieces[1]!,
      ]),
    ).toBe(false);
  });

  it("rejects source, panel, origin, threshold, and raster substitutions", () => {
    const alternateHash = `sha256:${"c".repeat(64)}`;
    const alternateId = `step-005:${alternateHash}`;
    const substitutions: readonly [unknown, RealBuildOptions][] = [
      [farther, { ...prepared, inputDigests: { ...prepared.inputDigests, pdf: DIGEST } }],
      [farther, withPanel(prepared, 7, (panel) => ({ ...panel, panelFace: "studs-up" }))],
      [
        farther,
        withPanel(prepared, 6, (panel) => ({
          ...panel,
          action: { ...panel.action, evidenceDigest: DIGEST },
        })),
      ],
      [
        {
          ...farther,
          origin: {
            ...farther.origin,
            candidates: [
              { ...farther.origin.candidates[0]!, documentHash: alternateHash },
              farther.origin.candidates[1]!,
            ],
          },
        },
        prepared,
      ],
      [
        {
          ...farther,
          origin: {
            ...farther.origin,
            candidates: [
              {
                ...farther.origin.candidates[0]!,
                candidateId: alternateId,
                documentHash: alternateHash,
              },
              farther.origin.candidates[1]!,
            ],
          },
          panels: farther.panels.map((panel) => ({
            ...panel,
            scores: panel.scores.map((score) =>
              score.candidateId === ORIGIN_IDS[0] ? { ...score, candidateId: alternateId } : score,
            ),
          })),
          decision: {
            ...farther.decision,
            rejectedCandidateIds: [alternateId],
          },
        },
        prepared,
      ],
      [farther, { ...prepared, minimumDeferredAgreement: 0.84 }],
      [farther, { ...prepared, minimumDeferredAgreementMargin: 0.01 }],
      [farther, { ...prepared, renderScale: 5 }],
      [farther, { ...prepared, panelWidth: 999 }],
      [farther, { ...prepared, workFactor: 1 }],
    ];
    for (const [candidate, exactOptions] of substitutions) {
      expect(parses(candidate, exactOptions)).toBe(false);
    }
  });

  it("rejects panel, decision, carry, and capture substitutions", () => {
    expect(parses({ ...farther, panels: [farther.panels[1]!, farther.panels[0]!] })).toBe(false);
    expect(
      parses({
        ...farther,
        decision: {
          ...farther.decision,
          originCandidateId: ORIGIN_IDS[0],
          survivingCandidateIds: [ORIGIN_IDS[0]],
          rejectedCandidateIds: [ORIGIN_IDS[1]],
        },
      }),
    ).toBe(false);
    expect(
      parses({
        ...farther,
        origin: {
          ...farther.origin,
          candidates: [...farther.origin.candidates].reverse(),
        },
        panels: farther.panels.map((panel) => ({
          ...panel,
          scores: [...panel.scores].reverse(),
        })),
      }),
    ).toBe(false);
    expect(
      parses({
        ...farther,
        panels: [
          farther.panels[0]!,
          {
            ...farther.panels[1]!,
            scores: [
              {
                ...farther.panels[1]!.scores[0]!,
                agreement: kScores[0] + Number.EPSILON,
              },
              farther.panels[1]!.scores[1]!,
            ],
          },
        ],
      }),
    ).toBe(false);
    expect(
      parses({
        ...farther,
        panels: [
          farther.panels[0]!,
          {
            ...farther.panels[1]!,
            scores: [...farther.panels[1]!.scores].reverse(),
          },
        ],
      }),
    ).toBe(false);
    expect(
      parses({
        ...farther,
        carries: [
          {
            stepNumber: 6,
            parentCandidates: 2,
            parentsExpanded: 0,
            offeredCandidates: 0,
            narrowingRenders: 0,
            maximumCandidates: prepared.deferredCandidateBudget,
            maximumNarrowingRenders: prepared.deferredNarrowingRenderBudget,
            expectedAtomicPieces: [],
            perParent: [],
            measuredLineages: [],
          },
        ],
      }),
    ).toBe(false);
    for (let index = 0; index < captures.length; index += 1) {
      expect(
        isRealBuildFartherCaptures(
          captures.filter((_, captureIndex) => captureIndex !== index),
          farther,
        ),
      ).toBe(false);
    }
  });

  it("accepts only calibrated fact-bound no-carry refusals", () => {
    const afterNPlusOne = {
      ...farther,
      panels: [farther.panels[0]!],
      budgets: { ...farther.budgets, panelRenders: 2, reachSteps: 1 },
      decision: null,
    };
    const incomplete = {
      ...afterNPlusOne,
      refusal: {
        code: "incomplete-panel-evidence" as const,
        stage: "evidence" as const,
        stepNumber: 7,
        message: "Panel 7 scoring threw before any K evidence was admitted.",
      },
    };
    expect(parses(incomplete)).toBe(true);

    const driftedK = {
      ...farther.panels[1]!,
      scores: [
        { ...farther.panels[1]!.scores[0]!, agreement: 0.8 },
        { ...farther.panels[1]!.scores[1]!, agreement: 0.93 },
      ],
      bestAgreement: 0.93,
      familyMargin: 0.93 - 0.8,
    };
    const calibrationMismatch = {
      ...farther,
      panels: [farther.panels[0]!, driftedK],
      refusal: {
        code: "calibration-mismatch" as const,
        stage: "evidence" as const,
        stepNumber: 7,
        message: "Exact origin scores drifted from their source-bound calibration.",
      },
      decision: null,
    };
    expect(parses(calibrationMismatch)).toBe(true);
    expect(
      parses({
        ...calibrationMismatch,
        panels: [farther.panels[0]!, { ...driftedK, status: "unrevealing" as const }],
      }),
    ).toBe(false);

    const unrevealingK = {
      ...farther.panels[1]!,
      status: "unrevealing" as const,
      reason: "weak-agreement" as const,
      scores: farther.panels[0]!.scores,
      bestAgreement: nPlusOneScores[1],
      familyMargin: nPlusOneScores[1] - nPlusOneScores[0],
    };
    const notObservable = {
      ...farther,
      panels: [farther.panels[0]!, unrevealingK],
      refusal: {
        code: "not-observable" as const,
        stage: "evidence" as const,
        stepNumber: 7,
        message: "Neither measured origin-scored panel revealed step 5.",
      },
      decision: null,
    };
    // A drifted or inconclusive K row is counterevidence, not a malformed
    // envelope. It remains readable while the live calibrated assertion fails.
    expect(parses(notObservable)).toBe(true);

    for (const hostile of [
      { ...incomplete, budgets: { ...incomplete.budgets, offeredCandidates: 1 } },
      { ...incomplete, refusal: { ...incomplete.refusal, stepNumber: 6 } },
      { ...incomplete, panels: [] },
      { ...incomplete, panels: [farther.panels[0]!, unrevealingK] },
      { ...notObservable, panels: [farther.panels[0]!] },
      {
        ...notObservable,
        panels: [
          {
            ...farther.panels[0]!,
            scores: [
              { candidateId: "substitute", agreement: nPlusOneScores[0] },
              farther.panels[0]!.scores[1]!,
            ],
          },
          unrevealingK,
        ],
      },
    ]) {
      expect(parses(hostile)).toBe(false);
    }
  });
});
