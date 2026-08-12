import type { RealBuildOptions } from "./real-build-safety";
import {
  LEGACY_DIGEST_PATTERN,
  legacyBoundedInteger,
  legacyDenseArray,
  legacyExactAtomicPieces,
  legacyExactKeys,
  legacyFartherId,
  legacyNullableFinite,
  legacyRecord,
  legacySameIds,
  legacySameJson,
  legacyUnitInterval,
  legacyWitnesses,
} from "./real-build-artifact-legacy-browser-v2-values";

export interface LegacyFartherParent {
  readonly candidateId: string;
  readonly originCandidateId: string;
  readonly lineage: readonly Record<string, unknown>[];
}

export interface LegacyFartherPanelCandidate {
  readonly candidateId: string;
  readonly originCandidateId: string;
}

export interface LegacyValidatedPanel {
  readonly stepNumber: number;
  readonly status: "not-observable" | "unrevealing" | "revealing";
  readonly winningOriginCandidateId: string | null;
  readonly survivingCandidateIds: readonly string[];
  readonly rejectedCandidateIds: readonly string[];
}

function lineageStep(value: unknown, stepNumber: number, maximumPieces: number): boolean {
  return (
    legacyRecord(value) &&
    legacyExactKeys(value, ["stepNumber", "documentHash", "pieces"]) &&
    value.stepNumber === stepNumber &&
    typeof value.documentHash === "string" &&
    LEGACY_DIGEST_PATTERN.test(value.documentHash) &&
    legacyWitnesses(value.pieces, maximumPieces)
  );
}

export function parseLegacyFartherCarryV2(input: {
  readonly value: unknown;
  readonly index: number;
  readonly originStep: number;
  readonly options: RealBuildOptions;
  readonly parents: ReadonlyMap<string, LegacyFartherParent>;
  readonly allowParentPrefix: boolean;
}): ReadonlyMap<string, LegacyFartherParent> | null {
  const { value, index, originStep, options, parents, allowParentPrefix } = input;
  if (
    !legacyRecord(value) ||
    !legacyExactKeys(value, [
      "stepNumber",
      "parentCandidates",
      "parentsExpanded",
      "offeredCandidates",
      "narrowingRenders",
      "maximumCandidates",
      "maximumNarrowingRenders",
      "expectedAtomicPieces",
      "perParent",
      "measuredLineages",
    ]) ||
    value.stepNumber !== originStep + index + 1 ||
    (value.stepNumber as number) - originStep > options.fartherPanelMaximumReachSteps ||
    value.parentCandidates !== parents.size ||
    !legacyBoundedInteger(value.parentsExpanded, value.parentCandidates as number) ||
    !legacyBoundedInteger(value.offeredCandidates, options.deferredCandidateBudget + 1) ||
    !legacyBoundedInteger(value.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
    value.maximumCandidates !== options.deferredCandidateBudget ||
    value.maximumNarrowingRenders !== options.deferredNarrowingRenderBudget ||
    !legacyDenseArray(value.expectedAtomicPieces, options.maxParts) ||
    !value.expectedAtomicPieces.every(
      (piece) =>
        legacyRecord(piece) &&
        legacyExactKeys(piece, ["catalogPartId", "colorId"]) &&
        legacyFartherId(piece.catalogPartId) &&
        legacyFartherId(piece.colorId),
    ) ||
    !legacyDenseArray(value.perParent, options.deferredCandidateBudget) ||
    !legacyDenseArray(value.measuredLineages, options.deferredCandidateBudget + 1)
  )
    return null;

  const expectedParentIds = [...parents.keys()];
  const observedParents = new Set<string>();
  let offered = 0;
  let rendered = 0;
  for (const parent of value.perParent) {
    const offeredPerPiece = legacyRecord(parent) ? parent.offeredPerPiece : undefined;
    const carriedPerPiece = legacyRecord(parent) ? parent.carriedPerPiece : undefined;
    if (
      !legacyRecord(parent) ||
      !legacyExactKeys(parent, [
        "parentCandidateId",
        "offeredCandidates",
        "narrowingRenders",
        "offeredPerPiece",
        "carriedPerPiece",
      ]) ||
      !legacyFartherId(parent.parentCandidateId) ||
      observedParents.has(parent.parentCandidateId) ||
      !legacyBoundedInteger(parent.offeredCandidates, options.deferredCandidateBudget + 1) ||
      !legacyBoundedInteger(parent.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
      !legacyDenseArray(offeredPerPiece, options.maxParts) ||
      !legacyDenseArray(carriedPerPiece, options.maxParts) ||
      offeredPerPiece.length !== value.expectedAtomicPieces.length ||
      carriedPerPiece.length !== value.expectedAtomicPieces.length ||
      !offeredPerPiece.every((count) => legacyBoundedInteger(count, Number.MAX_SAFE_INTEGER)) ||
      !carriedPerPiece.every((count, pieceIndex) =>
        legacyBoundedInteger(count, offeredPerPiece[pieceIndex] as number),
      )
    )
      return null;
    observedParents.add(parent.parentCandidateId);
    offered += parent.offeredCandidates as number;
    rendered += parent.narrowingRenders as number;
  }
  if (
    (allowParentPrefix
      ? !legacySameJson([...observedParents], expectedParentIds.slice(0, observedParents.size))
      : !legacySameIds(observedParents, new Set(expectedParentIds))) ||
    value.parentsExpanded !== observedParents.size ||
    (!allowParentPrefix && value.parentsExpanded !== parents.size) ||
    value.offeredCandidates !== offered ||
    value.narrowingRenders !== rendered
  )
    return null;

  const next = new Map<string, LegacyFartherParent>();
  for (const measured of value.measuredLineages) {
    const retained = legacyRecord(measured)
      ? parents.get(String(measured.parentCandidateId))
      : undefined;
    const lineage = legacyRecord(measured) ? measured.lineage : undefined;
    if (
      !legacyRecord(measured) ||
      !legacyExactKeys(measured, [
        "candidateId",
        "parentCandidateId",
        "originCandidateId",
        "lineage",
      ]) ||
      !legacyFartherId(measured.candidateId) ||
      !legacyFartherId(measured.parentCandidateId) ||
      !legacyFartherId(measured.originCandidateId) ||
      retained === undefined ||
      measured.originCandidateId !== retained.originCandidateId ||
      next.has(measured.candidateId) ||
      !legacyDenseArray(lineage, options.fartherPanelMaximumReachSteps + 1) ||
      lineage.length !== index + 2 ||
      !lineage.every((step, lineageIndex) =>
        lineageStep(step, originStep + lineageIndex, options.maxParts),
      ) ||
      !retained.lineage.every((step, lineageIndex) =>
        legacySameJson(step, lineage[lineageIndex]),
      ) ||
      !legacyExactAtomicPieces(
        (lineage.at(-1) as Record<string, unknown>).pieces as readonly unknown[],
        value.expectedAtomicPieces,
      )
    )
      return null;
    next.set(measured.candidateId, {
      candidateId: measured.candidateId,
      originCandidateId: measured.originCandidateId,
      lineage: lineage as readonly Record<string, unknown>[],
    });
  }
  return next.size === value.offeredCandidates ? next : null;
}

export function parseLegacyFartherPanelV2(input: {
  readonly value: unknown;
  readonly index: number;
  readonly originStep: number;
  readonly originCandidates: readonly Record<string, unknown>[];
  readonly finalCandidates: readonly LegacyFartherPanelCandidate[];
  readonly options: RealBuildOptions;
}): LegacyValidatedPanel | null {
  const { value, index, originStep, originCandidates, finalCandidates, options } = input;
  if (
    !legacyRecord(value) ||
    !legacyExactKeys(value, [
      "stepNumber",
      "reachSteps",
      "status",
      "reason",
      "scores",
      "bestAgreement",
      "familyMargin",
      "descendantMargin",
    ]) ||
    value.stepNumber !== originStep + index + 1 ||
    value.reachSteps !== index + 1 ||
    !legacyDenseArray(value.scores, options.deferredCandidateBudget + 1) ||
    !legacyNullableFinite(value.bestAgreement) ||
    !legacyNullableFinite(value.familyMargin) ||
    !legacyNullableFinite(value.descendantMargin)
  )
    return null;
  const scored =
    index === 0
      ? originCandidates.map((candidate) => ({
          candidateId: candidate.candidateId as string,
          originCandidateId: candidate.candidateId as string,
        }))
      : finalCandidates;
  const expectedIds = new Set(scored.map(({ candidateId }) => candidateId));
  const agreements = new Map<string, number>();
  for (const score of value.scores) {
    if (
      !legacyRecord(score) ||
      !legacyExactKeys(score, ["candidateId", "agreement"]) ||
      !legacyFartherId(score.candidateId) ||
      agreements.has(score.candidateId) ||
      !legacyUnitInterval(score.agreement)
    )
      return null;
    agreements.set(score.candidateId, score.agreement);
  }
  if (value.status === "not-observable") {
    return ["occluded", "no-built-art", "camera-unresolved"].includes(String(value.reason)) &&
      value.scores.length === 0 &&
      value.bestAgreement === null &&
      value.familyMargin === null &&
      value.descendantMargin === null
      ? {
          stepNumber: value.stepNumber as number,
          status: "not-observable",
          winningOriginCandidateId: null,
          survivingCandidateIds: [],
          rejectedCandidateIds: [],
        }
      : null;
  }
  if (
    !legacySameIds(new Set(agreements.keys()), expectedIds) ||
    (index === 0 &&
      originCandidates.some(
        (candidate) =>
          agreements.get(candidate.candidateId as string) !== candidate.lookaheadAgreement,
      ))
  )
    return null;
  const families = originCandidates
    .map((origin) => {
      const scores = scored
        .filter(({ originCandidateId }) => originCandidateId === origin.candidateId)
        .map(({ candidateId }) => agreements.get(candidateId)!);
      return scores.length === 0
        ? null
        : {
            originCandidateId: origin.candidateId as string,
            agreement: Math.max(...scores),
          };
    })
    .filter((family): family is { originCandidateId: string; agreement: number } => family !== null)
    .sort((left, right) => right.agreement - left.agreement);
  if (families.length !== originCandidates.length || families.length < 2) return null;
  const winner = families[0]!;
  const familyMargin = winner.agreement - families[1]!.agreement;
  const winnerLeaves = finalCandidates.filter(
    ({ originCandidateId }) => originCandidateId === winner.originCandidateId,
  );
  const orderedLeaves =
    index === 0
      ? winnerLeaves
      : [...winnerLeaves].sort(
          (left, right) => agreements.get(right.candidateId)! - agreements.get(left.candidateId)!,
        );
  const descendantMargin =
    index === 0 || orderedLeaves.length < 2
      ? null
      : agreements.get(orderedLeaves[0]!.candidateId)! -
        agreements.get(orderedLeaves[1]!.candidateId)!;
  const revealing =
    winner.agreement >= options.minimumDeferredAgreement &&
    familyMargin > options.minimumDeferredAgreementMargin;
  const status = revealing ? "revealing" : "unrevealing";
  const reason = revealing
    ? null
    : winner.agreement < options.minimumDeferredAgreement
      ? "weak-agreement"
      : "ambiguous-family";
  if (
    value.status !== status ||
    value.reason !== reason ||
    value.bestAgreement !== winner.agreement ||
    value.familyMargin !== familyMargin ||
    value.descendantMargin !== descendantMargin
  )
    return null;
  const surviving = revealing
    ? index === 0
      ? winnerLeaves.map(({ candidateId }) => candidateId)
      : orderedLeaves
          .filter(
            ({ candidateId }) =>
              winner.agreement - agreements.get(candidateId)! <=
              options.minimumDeferredAgreementMargin,
          )
          .map(({ candidateId }) => candidateId)
    : [];
  const survivingSet = new Set(surviving);
  return {
    stepNumber: value.stepNumber as number,
    status,
    winningOriginCandidateId: winner.originCandidateId,
    survivingCandidateIds: surviving,
    rejectedCandidateIds: revealing
      ? finalCandidates
          .filter(({ candidateId }) => !survivingSet.has(candidateId))
          .map(({ candidateId }) => candidateId)
      : [],
  };
}
