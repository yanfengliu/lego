import {
  canonicalDigest,
  canonicalStringify,
  compileBuildProgram,
  deepFreeze,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import { STUD_PITCH_LDU } from "@lego-studio/catalog";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { normalizeRestrictedTextBrief, validateMakerJobId } from "./brief.ts";
import { cloneBoundedDataOnlyJson } from "./data-only.ts";
import { GENERATION_VERSION, RANKING_POLICY, RANKING_POLICY_HASH } from "./policy.ts";
import { generateDeterministicPrograms, type GeneratedProgramDraft } from "./recipes.ts";
import type {
  CandidateAttempt,
  CandidateLineage,
  CandidateMetrics,
  DeterministicMakerPopulationInput,
  DuplicateCandidateAttempt,
  FailedCandidateAttempt,
  HardValidCandidate,
  MakerPopulationResult,
  NormalizedTextBrief,
  SupportedShape,
} from "./types.ts";

interface UnrankedHardValidCandidate extends Omit<HardValidCandidate, "rank"> {
  readonly rank: 0;
}

function candidateIdentity(
  jobId: string,
  strategyId: string,
  index: number,
  programHash: string | null,
): { readonly candidateId: string; readonly lineage: CandidateLineage } {
  const digest = canonicalDigest({ jobId, strategyId, index, programHash });
  const candidateId = `candidate-${index + 1}-${digest.slice(7, 23)}`;
  return {
    candidateId,
    lineage: { candidateId, parentCandidateId: null, generation: 0, strategyId },
  };
}

function permyriad(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator * RANKING_POLICY.scoreScale) / denominator);
}

function scoreCandidate(
  document: BrickDocumentV1,
  shape: SupportedShape,
  brief: NormalizedTextBrief,
): CandidateMetrics {
  const candidateColors = new Set(document.parts.map(({ colorId }) => colorId));
  const requestedColors = new Set(brief.requestedColorIds);
  const colorUnion = new Set([...candidateColors, ...requestedColors]);
  const colorIntersection = [...candidateColors].filter((colorId) => requestedColors.has(colorId));
  const partTypes = new Set(document.parts.map(({ catalogPartId }) => catalogPartId));
  const colorMatchPermyriad =
    brief.colorIntent === "explicit" ? permyriad(colorIntersection.length, colorUnion.size) : 0;
  const positions = document.parts.map(({ transform }) => transform.positionLdu);
  const spread = (axis: 0 | 1 | 2): number => {
    const values = positions.map((position) => position[axis]);
    return Math.max(...values) - Math.min(...values);
  };
  const partIds = document.parts.map(({ catalogPartId }) => catalogPartId);
  const geometryMatchesShape =
    shape === "tower"
      ? partIds.every((partId) => partId === "builtin:brick-1x2") &&
        spread(0) === 0 &&
        spread(2) === 0
      : shape === "staircase"
        ? spread(2) >= (document.parts.length - 1) * STUD_PITCH_LDU
        : shape === "spire"
          ? new Set(partIds).has("builtin:brick-1x1") &&
            new Set(partIds).has("builtin:plate-1x1") &&
            spread(0) === 0 &&
            spread(2) === 0
          : partIds.every((partId) => partId === "builtin:brick-2x2") &&
            spread(0) === 0 &&
            spread(2) === 0;
  const shapeMatchPermyriad =
    shape === brief.requestedShape && geometryMatchesShape ? RANKING_POLICY.scoreScale : 0;
  const partCountFitPermyriad = Math.max(
    0,
    RANKING_POLICY.scoreScale -
      permyriad(Math.abs(document.parts.length - brief.targetPartCount), brief.targetPartCount),
  );
  const diversityPermyriad = Math.min(
    RANKING_POLICY.scoreScale,
    Math.max(0, partTypes.size - 1) * RANKING_POLICY.diversity.additionalPartTypePoints +
      Math.min(RANKING_POLICY.diversity.countedAdditionalColors, candidateColors.size - 1) *
        RANKING_POLICY.diversity.additionalColorPoints,
  );
  return {
    partCount: document.parts.length,
    connectionCount: document.connections.length,
    partTypeDiversityCount: partTypes.size,
    colorDiversityCount: candidateColors.size,
    colorMatchPermyriad,
    shapeMatchPermyriad,
    partCountFitPermyriad,
    diversityPermyriad,
    weightedScorePermyriad: Math.floor(
      (colorMatchPermyriad * RANKING_POLICY.weightsPercent.colorMatch +
        shapeMatchPermyriad * RANKING_POLICY.weightsPercent.shapeMatch +
        partCountFitPermyriad * RANKING_POLICY.weightsPercent.partCountFit +
        diversityPermyriad * RANKING_POLICY.weightsPercent.diversity) /
        100,
    ),
  };
}

function compareCandidates(
  left: UnrankedHardValidCandidate,
  right: UnrankedHardValidCandidate,
): number {
  const metricKeys: readonly (keyof CandidateMetrics)[] = [
    "weightedScorePermyriad",
    "colorMatchPermyriad",
    "shapeMatchPermyriad",
    "partCountFitPermyriad",
    "diversityPermyriad",
  ];
  for (const key of metricKeys) {
    const difference = right.metrics[key] - left.metrics[key];
    if (difference !== 0) return difference;
  }
  return left.structuralHash < right.structuralHash
    ? -1
    : left.structuralHash > right.structuralHash
      ? 1
      : left.candidateId < right.candidateId
        ? -1
        : left.candidateId > right.candidateId
          ? 1
          : 0;
}

function compileCandidate(
  jobId: string,
  index: number,
  draft: GeneratedProgramDraft,
  document: BrickDocumentV1,
  scope: Parameters<typeof compileBuildProgram>[2]["scope"],
  brief: NormalizedTextBrief,
  firstByHash: ReadonlyMap<string, UnrankedHardValidCandidate>,
): FailedCandidateAttempt | DuplicateCandidateAttempt | UnrankedHardValidCandidate {
  const identity = candidateIdentity(jobId, draft.strategyId, index, draft.programHash);
  const common = {
    ...identity,
    strategyId: draft.strategyId,
    shape: draft.shape,
    program: draft.program,
    programHash: draft.programHash,
  } as const;
  const result = compileBuildProgram(document, draft.program, {
    scope,
    jobId,
    candidateId: identity.candidateId,
  });
  if (!result.ok) {
    return {
      ...common,
      status: "failed",
      structuralHash: null,
      document: null,
      patch: null,
      validationReport: null,
      metrics: null,
      rank: null,
      failure: {
        stage: "compile",
        code: "COMPILATION_REJECTED",
        message: "Trusted compiler rejected the generated build program",
        issues: result.issues,
      },
    };
  }
  if (!result.validationReport.patchValid || !result.validationReport.documentGloballyValid) {
    return {
      ...common,
      status: "failed",
      structuralHash: null,
      document: null,
      patch: null,
      validationReport: null,
      metrics: null,
      rank: null,
      failure: {
        stage: "validation",
        code: "HARD_VALIDATION_REJECTED",
        message: "Trusted compiler returned a candidate that did not pass every hard validator",
      },
    };
  }
  const structuralHash = documentStructuralHash(result.document);
  const metrics = scoreCandidate(result.document, draft.shape, brief);
  const duplicateOf = firstByHash.get(structuralHash);
  if (duplicateOf) {
    return {
      ...common,
      status: "duplicate",
      structuralHash,
      document: null,
      patch: null,
      validationReport: null,
      metrics: null,
      rank: null,
      failure: {
        stage: "deduplication",
        code: "DUPLICATE_STRUCTURAL_HASH",
        message: "Candidate has the same canonical document structure as an earlier candidate",
        duplicateOfCandidateId: duplicateOf.candidateId,
      },
    };
  }
  return {
    ...common,
    status: "hard-valid",
    structuralHash,
    document: result.document,
    patch: result.patch,
    validationReport: result.validationReport,
    metrics,
    rank: 0,
    failure: null,
  };
}

export function runDeterministicMakerPopulation(
  input: DeterministicMakerPopulationInput,
): MakerPopulationResult {
  const detachedInput = cloneBoundedDataOnlyJson(input, {
    maxDepth: 24,
    maxNodes: 12_000,
    maxStringChars: 8_192,
    maxKeyChars: 128,
    maxTotalChars: 256_000,
  });
  if (
    detachedInput === null ||
    typeof detachedInput !== "object" ||
    !("jobId" in detachedInput) ||
    typeof detachedInput.jobId !== "string" ||
    !("document" in detachedInput) ||
    !("brief" in detachedInput) ||
    !("scope" in detachedInput)
  ) {
    return deepFreeze({
      ok: false,
      failure: {
        stage: "input",
        code: "INPUT_NOT_DATA_ONLY",
        message: "Maker population input must be bounded, detached, data-only JSON",
        path: "",
      },
    });
  }
  const jobId = detachedInput.jobId;
  const jobFailure = validateMakerJobId(jobId);
  if (jobFailure) return deepFreeze({ ok: false, failure: jobFailure });
  const normalized = normalizeRestrictedTextBrief({
    document: detachedInput.document,
    brief: detachedInput.brief,
    scope: detachedInput.scope,
  });
  if (!normalized.ok) return normalized;

  const generated = generateDeterministicPrograms(
    normalized.brief,
    normalized.scope.budgets.maxOperations,
  );
  const attempts: (
    FailedCandidateAttempt | DuplicateCandidateAttempt | UnrankedHardValidCandidate
  )[] = [];
  const firstByHash = new Map<string, UnrankedHardValidCandidate>();
  for (let index = 0; index < generated.length; index += 1) {
    const generatedCandidate = generated[index]!;
    if ("failure" in generatedCandidate) {
      const identity = candidateIdentity(jobId, generatedCandidate.strategyId, index, null);
      attempts.push({
        ...identity,
        strategyId: generatedCandidate.strategyId,
        shape: generatedCandidate.shape,
        status: "failed",
        program: null,
        programHash: null,
        structuralHash: null,
        document: null,
        patch: null,
        validationReport: null,
        metrics: null,
        rank: null,
        failure: generatedCandidate.failure,
      });
      continue;
    }
    const attempt = compileCandidate(
      jobId,
      index,
      generatedCandidate,
      normalized.document,
      normalized.scope,
      normalized.brief,
      firstByHash,
    );
    attempts.push(attempt);
    if (attempt.status === "hard-valid") firstByHash.set(attempt.structuralHash, attempt);
  }

  const rankedCandidates = attempts
    .filter((attempt): attempt is UnrankedHardValidCandidate => attempt.status === "hard-valid")
    .sort(compareCandidates)
    .map((candidate, index): HardValidCandidate => ({ ...candidate, rank: index + 1 }));
  const rankedById = new Map(
    rankedCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const finalizedAttempts: CandidateAttempt[] = attempts.map((attempt) =>
    attempt.status === "hard-valid" ? rankedById.get(attempt.candidateId)! : attempt,
  );
  const population = {
    ok: true,
    makerVersion: GENERATION_VERSION,
    rankingPolicyHash: RANKING_POLICY_HASH,
    jobId,
    normalizedBrief: normalized.brief,
    attempts: finalizedAttempts,
    rankedCandidates,
  } as const;
  let retainedBytes: number;
  try {
    retainedBytes = new TextEncoder().encode(canonicalStringify(population)).byteLength;
  } catch {
    retainedBytes = Number.POSITIVE_INFINITY;
  }
  if (retainedBytes > normalized.sourceBrief.budgets.maxStoredBytes) {
    return deepFreeze({
      ok: false,
      failure: {
        stage: "input",
        code: "OUTPUT_STORAGE_BUDGET_EXCEEDED",
        message: `Canonical population evidence needs ${retainedBytes} bytes but the run budget allows ${normalized.sourceBrief.budgets.maxStoredBytes}`,
        path: "/brief/budgets/maxStoredBytes",
      },
    });
  }
  return deepFreeze(population);
}
