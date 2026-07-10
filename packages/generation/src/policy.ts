import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

export const GENERATION_VERSION = "lego.generation/1" as const;

export const RANKING_POLICY = deepFreeze({
  schemaVersion: "lego.generation-ranking-policy/1",
  policyVersion: "deterministic-lean-ranking/1",
  scoreScale: 10_000,
  weightsPercent: {
    colorMatch: 35,
    shapeMatch: 35,
    partCountFit: 20,
    diversity: 10,
  },
  diversity: {
    additionalPartTypePoints: 5_000,
    additionalColorPoints: 2_500,
    countedAdditionalColors: 2,
  },
  tieBreakOrder: [
    "weightedScorePermyriad",
    "colorMatchPermyriad",
    "shapeMatchPermyriad",
    "partCountFitPermyriad",
    "diversityPermyriad",
    "structuralHash-ascending",
    "candidateId-ascending",
  ],
} as const);

export const RANKING_POLICY_HASH = canonicalDigest(RANKING_POLICY);
