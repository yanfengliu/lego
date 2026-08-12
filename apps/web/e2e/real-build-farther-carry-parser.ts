import type { RealBuildOptions } from "./real-build-safety";
import {
  DIGEST_PATTERN,
  exactKeys,
  hasExactAtomicPieces,
  isBoundedInteger,
  isDenseBoundedArray,
  isFartherId,
  isFartherWitnesses,
  isRecord,
  sameIds,
  sameJson,
} from "./real-build-farther-report-validation";

export interface FartherRetainedParent {
  readonly candidateId: string;
  readonly originCandidateId: string;
  readonly lineage: readonly Record<string, unknown>[];
}

function isFartherLineageStep(
  value: unknown,
  expectedStepNumber: number,
  maximumPieces: number,
): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["stepNumber", "documentHash", "pieces"]) &&
    value.stepNumber === expectedStepNumber &&
    typeof value.documentHash === "string" &&
    DIGEST_PATTERN.test(value.documentHash) &&
    isFartherWitnesses(value.pieces, maximumPieces)
  );
}

export function isFartherCarryEvidence(
  value: unknown,
  carryIndex: number,
  originStepNumber: number,
  options: Pick<
    RealBuildOptions,
    | "maxParts"
    | "deferredCandidateBudget"
    | "deferredNarrowingRenderBudget"
    | "fartherPanelMaximumReachSteps"
  >,
  expectedParents: ReadonlyMap<string, FartherRetainedParent>,
  allowParentPrefix: boolean,
): boolean {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
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
    value.stepNumber !== originStepNumber + carryIndex + 1 ||
    (value.stepNumber as number) - originStepNumber > options.fartherPanelMaximumReachSteps ||
    value.parentCandidates !== expectedParents.size ||
    !isBoundedInteger(value.parentsExpanded, value.parentCandidates as number) ||
    !isBoundedInteger(value.offeredCandidates, options.deferredCandidateBudget + 1) ||
    !isBoundedInteger(value.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
    !isBoundedInteger(value.maximumCandidates, options.deferredCandidateBudget) ||
    !isBoundedInteger(value.maximumNarrowingRenders, options.deferredNarrowingRenderBudget) ||
    !isDenseBoundedArray(value.expectedAtomicPieces, options.maxParts) ||
    !value.expectedAtomicPieces.every(
      (piece) =>
        isRecord(piece) &&
        exactKeys(piece, ["catalogPartId", "colorId"]) &&
        isFartherId(piece.catalogPartId) &&
        isFartherId(piece.colorId),
    ) ||
    !isDenseBoundedArray(value.perParent, options.deferredCandidateBudget) ||
    !isDenseBoundedArray(value.measuredLineages, options.deferredCandidateBudget + 1)
  ) {
    return false;
  }

  const expectedParentIds = [...expectedParents.keys()];
  const expectedAtomicPieces = value.expectedAtomicPieces as readonly unknown[];
  const parentIds = new Set<string>();
  for (const parent of value.perParent) {
    if (
      !isRecord(parent) ||
      !exactKeys(parent, [
        "parentCandidateId",
        "offeredCandidates",
        "narrowingRenders",
        "offeredPerPiece",
        "carriedPerPiece",
      ]) ||
      !isFartherId(parent.parentCandidateId) ||
      parentIds.has(parent.parentCandidateId) ||
      !isBoundedInteger(parent.offeredCandidates, options.deferredCandidateBudget + 1) ||
      !isBoundedInteger(parent.narrowingRenders, options.deferredNarrowingRenderBudget + 1) ||
      !isDenseBoundedArray(parent.offeredPerPiece, options.maxParts) ||
      !isDenseBoundedArray(parent.carriedPerPiece, options.maxParts) ||
      parent.offeredPerPiece.length !== expectedAtomicPieces.length ||
      parent.carriedPerPiece.length !== expectedAtomicPieces.length ||
      !parent.offeredPerPiece.every((count) => isBoundedInteger(count, Number.MAX_SAFE_INTEGER)) ||
      !parent.carriedPerPiece.every((count, index) =>
        isBoundedInteger(count, (parent.offeredPerPiece as readonly number[])[index] as number),
      )
    ) {
      return false;
    }
    parentIds.add(parent.parentCandidateId);
  }
  if (
    (allowParentPrefix
      ? !sameJson([...parentIds], expectedParentIds.slice(0, parentIds.size))
      : !sameIds(parentIds, new Set(expectedParentIds))) ||
    value.parentsExpanded !== parentIds.size ||
    (!allowParentPrefix && value.parentsExpanded !== expectedParents.size) ||
    (value.perParent as readonly Record<string, unknown>[]).reduce<number>(
      (total, parent) => total + ((parent as Record<string, unknown>).offeredCandidates as number),
      0,
    ) !== value.offeredCandidates ||
    (value.perParent as readonly Record<string, unknown>[]).reduce<number>(
      (total, parent) => total + ((parent as Record<string, unknown>).narrowingRenders as number),
      0,
    ) !== value.narrowingRenders
  ) {
    return false;
  }

  const lineageCandidateIds = new Set<string>();
  for (const measured of value.measuredLineages) {
    const retainedParent = isRecord(measured)
      ? expectedParents.get(String(measured.parentCandidateId))
      : undefined;
    if (
      !isRecord(measured) ||
      !exactKeys(measured, ["candidateId", "parentCandidateId", "originCandidateId", "lineage"]) ||
      !isFartherId(measured.candidateId) ||
      !isFartherId(measured.parentCandidateId) ||
      !isFartherId(measured.originCandidateId) ||
      retainedParent === undefined ||
      measured.originCandidateId !== retainedParent.originCandidateId ||
      lineageCandidateIds.has(measured.candidateId) ||
      !isDenseBoundedArray(measured.lineage, options.fartherPanelMaximumReachSteps + 1) ||
      measured.lineage.length !== carryIndex + 2 ||
      !measured.lineage.every((step, lineageIndex) =>
        isFartherLineageStep(step, originStepNumber + lineageIndex, options.maxParts),
      ) ||
      !retainedParent.lineage.every((step, index) =>
        sameJson(step, (measured.lineage as readonly unknown[])[index]),
      ) ||
      !hasExactAtomicPieces(
        (measured.lineage as readonly Record<string, unknown>[]).at(-1)!
          .pieces as readonly unknown[],
        expectedAtomicPieces,
      )
    ) {
      return false;
    }
    lineageCandidateIds.add(measured.candidateId);
  }
  return lineageCandidateIds.size === (value.offeredCandidates as number);
}
