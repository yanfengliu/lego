import { describe, expect, it } from "vitest";

import type { RealBuildPanelSpec } from "../e2e/real-build-safety";
import {
  OFFICIAL_REAL_BUILD_ACCOUNTING,
  adjudicateSearchBenchmark,
  preflightRealBuildOptions,
} from "../e2e/real-build-contract";
import {
  createRealBuildRunContract,
  planAtomicRunDirectory,
  sha256Digest,
} from "../e2e/real-build-artifacts";
import { evaluateSearchBenchmark } from "../e2e/real-build-search";

const TEST_DIGEST = `sha256:${"a".repeat(64)}`;
const TEST_CLASSIFICATION_DIGEST = `sha256:${"b".repeat(64)}`;

const allInputDigests = (value = TEST_DIGEST) => ({
  pdf: value,
  calloutManifest: value,
  coverage: value,
  officialModel: value,
  actionLedger: value,
  highlightCalibration: value,
  builderCalibration: value,
  builderGeometry: value,
  transitionClassifications: value,
});

const transitionPanel = (stepNumber: number): RealBuildPanelSpec => ({
  stepNumber,
  pageNumber: stepNumber,
  panelFace: "studs-up",
  minXPt: 0,
  maxXPt: 1,
  minYPt: 0,
  maxYPt: 1,
  calloutBoxes: [],
  mappedCalloutKeys: [],
  action: {
    kind: "transition",
    assembledPieces: 0,
    transition: "rotation",
    panelEvidenceDigest: TEST_DIGEST,
    classificationEvidenceDigest: TEST_CLASSIFICATION_DIGEST,
    evidenceDigest: TEST_DIGEST,
  },
  pieces: [],
  omittedPieces: [],
  calloutPieces: 0,
  classifiedPhysicalCalloutPieces: 0,
  semanticMultiplierQuantity: 0,
  omittedPhysicalPieces: 0,
  coverageFailures: [],
  missingDesigns: [],
  unresolvedCallouts: [],
});

describe("real booklet run policy and artifacts", () => {
  it("refuses pruned/exhaustive disagreement even with a forged digest policy", () => {
    const evidence = (strategy: "pruned" | "exhaustive", winnerKey: string) => ({
      strategy,
      winnerKey,
      bestScore: 0.8,
      runnerUpScore: 0.5,
      rendered: strategy === "pruned" ? 2 : 20,
      elapsedMs: strategy === "pruned" ? 3 : 30,
      failure: null,
    });
    const disagreement = {
      stepNumber: 8,
      pruned: evidence("pruned", "a"),
      exhaustive: evidence("exhaustive", "b"),
    };
    expect(adjudicateSearchBenchmark(disagreement).failure?.code).toBe("benchmark-disagreement");
    const forgedPolicy = {
      ...disagreement,
      policy: {
        winner: "exhaustive",
        evidenceDigest: `sha256:${"f".repeat(64)}`,
        rationale: "A syntactically valid digest is not independent quality evidence.",
      },
    };
    expect(adjudicateSearchBenchmark(forgedPolicy).failure?.code).toBe("benchmark-disagreement");
  });

  it("applies the same score refusal rules to identical pruned and exhaustive searches", () => {
    const candidates = [
      { id: "a", score: 0.8 },
      { id: "b", score: 0.5 },
    ];
    let scoreCalls = 0;
    const result = evaluateSearchBenchmark({
      stepNumber: 9,
      pieceIndex: 0,
      catalogPartId: "builtin:plate-1x1",
      prefixHash: `sha256:${"1".repeat(64)}`,
      prunedCandidates: candidates,
      exhaustiveCandidates: candidates,
      maxPrunedRenders: 2,
      exhaustiveRenderBudget: 2,
      minimumMargin: 0.1,
      score: (candidate) => {
        scoreCalls += 1;
        return { candidate, score: candidate.score };
      },
      key: (candidate) => candidate?.id ?? null,
    });
    expect(result.failure).toBeNull();
    expect(result.winner?.candidate.id).toBe("a");
    expect(result.blind).toMatchObject({ rendered: 2, agreesWithHighlight: true });
    expect(scoreCalls).toBe(4);
  });

  /** The refusal retains both the eligible count and the explicit bound. */
  it("says how many placements the pruned budget refused, and how many it allowed", () => {
    const candidates = Array.from({ length: 7 }, (_, index) => ({
      id: `c${index}`,
      score: 1 - index / 10,
    }));
    const result = evaluateSearchBenchmark({
      stepNumber: 2,
      pieceIndex: 0,
      catalogPartId: "builtin:wedge-plate-4x4-cut-corner",
      prefixHash: `sha256:${"2".repeat(64)}`,
      prunedCandidates: candidates,
      exhaustiveCandidates: candidates,
      maxPrunedRenders: 3,
      exhaustiveRenderBudget: 20,
      minimumMargin: 0.01,
      score: (candidate) => ({ candidate, score: candidate.score }),
      key: (candidate) => candidate?.id ?? null,
    });

    expect(result.failure?.code).toBe("benchmark-disagreement");
    expect(result.failure?.message).toContain("7 eligible placements");
    expect(result.failure?.message).toContain("over the explicit 3 per-piece render budget");
    expect(result.prunedScores).toHaveLength(0);
  });

  it("refuses a pruned render budget smaller than the exhaustive one", () => {
    const panels = Array.from({ length: 359 }, (_, index) => transitionPanel(index + 1));
    const digest = `sha256:${"a".repeat(64)}`;
    const coherent = {
      panels,
      expectedPrintedSteps: 359,
      lastStep: 1,
      accounting: OFFICIAL_REAL_BUILD_ACCOUNTING,
      targetPartCount: 1_464,
      maxParts: 1_464,
      inputDigests: allInputDigests(digest),
      coverageInputBindings: { pdf: digest, calloutManifest: digest },
      minimumWholeStepScore: 0.45,
      minimumExclusiveHighlightPixelsPerPiece: 8,
      maxRendersPerPiece: 220,
      blindRenderBudget: 220,
      deferredCandidateBudget: 512,
      panelCameraBranchBudget: 8_192,
      deferredNarrowingRenderBudget: 4_096,
      fartherPanelMaximumReachSteps: 2,
      fartherPanelRenderBudget: 16,
      explodedGhostRenderBudget: 4_096,
      highlightCalibrationDigest: digest,
      coverageByCallout: {},
    };

    expect(
      preflightRealBuildOptions(coherent).filter(
        ({ code }) => code === "benchmark-policy-mismatch",
      ),
    ).toEqual([]);
    const refused = preflightRealBuildOptions({ ...coherent, maxRendersPerPiece: 24 });
    expect(refused).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "benchmark-policy-mismatch",
          inputKey: "maxRendersPerPiece",
        }),
      ]),
    );
    expect(refused.find(({ code }) => code === "benchmark-policy-mismatch")?.message).toContain(
      "subset of the exhaustive one",
    );
  });

  it("plans digest-bound unique run directories so interrupted attempts cannot mix", () => {
    const digests = {
      pdf: sha256Digest("pdf"),
      calloutManifest: sha256Digest("manifest"),
      coverage: sha256Digest("coverage"),
      officialModel: sha256Digest("official-model"),
      actionLedger: sha256Digest("action-ledger"),
      highlightCalibration: sha256Digest("highlight-calibration"),
      builderCalibration: sha256Digest("builder-calibration"),
      builderGeometry: sha256Digest("builder-geometry"),
      transitionClassifications: sha256Digest("transition-classifications"),
    };
    const first = planAtomicRunDirectory({
      outputRoot: "output/real-build",
      inputDigests: digests,
      runContractDigest: sha256Digest("contract-one"),
      timestamp: "2026-08-02T12:00:00.000Z",
      nonce: "11111111-1111-4111-8111-111111111111",
    });
    const second = planAtomicRunDirectory({
      outputRoot: "output/real-build",
      inputDigests: digests,
      runContractDigest: sha256Digest("contract-one"),
      timestamp: "2026-08-02T12:00:00.000Z",
      nonce: "22222222-2222-4222-8222-222222222222",
    });
    expect(first.runId).not.toBe(second.runId);
    expect(first.temporaryDirectory).toContain(".tmp-");
    expect(first.finalDirectory).not.toBe(first.temporaryDirectory);
  });

  it("binds panels, action identities, budgets, thresholds, policy, and code into the run contract", () => {
    const base = {
      inputDigests: allInputDigests(sha256Digest("inputs")),
      identificationClosure: {
        source: "deterministic" as const,
        features: sha256Digest("features"),
        match: sha256Digest("match"),
        distances: sha256Digest("distances"),
        elements: sha256Digest("elements"),
        cards: null,
        cardImages: null,
        answers: null,
        pairJudged: sha256Digest("pair-judged"),
      },
      panels: [transitionPanel(1)],
      budgets: {
        lastStep: 1,
        expectedPrintedSteps: 359,
        maxParts: 1_464,
        targetPartCount: 1_464,
        maxRendersPerPiece: 4_096,
        blindRenderBudget: 4_096,
        deferredCandidateBudget: 4_096,
        panelCameraBranchBudget: 8_192,
        explodedGhostRenderBudget: 4_096,
        deferredNarrowingRenderBudget: 4_096,
        fartherPanelMaximumReachSteps: 2,
        fartherPanelRenderBudget: 16,
      },
      thresholds: {
        minimumWholeStepScore: 0.45,
        highlightCalibrationDigest: TEST_DIGEST,
      },
      codeSnapshots: { "real-build-run.ts": sha256Digest("code") },
    };
    const first = createRealBuildRunContract(base);
    const changed = createRealBuildRunContract({
      ...base,
      budgets: { ...base.budgets, maxParts: 1_465 },
    });

    expect(first.actionLedger).toHaveLength(1);
    expect(first.policy.searchDisagreement).toBe("refuse");
    expect(first.contractDigest).not.toBe(changed.contractDigest);
  });
});
