import type {
  FartherAtomicPieceIdentity,
  FartherCarryInput,
  FartherFrontier,
  FartherOriginInput,
  FartherPanelObservationInput,
  FartherPlacementWitness,
  FirstRevealingPanelInput,
} from "./real-build-farther-panel-types";

export const shown = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

export const firstDuplicate = (values: readonly string[]): string | undefined =>
  values.find((value, index) => values.indexOf(value) !== index);

export const atomicPieceKey = ({ catalogPartId, colorId }: FartherAtomicPieceIdentity): string =>
  JSON.stringify([catalogPartId, colorId]);

function describeWitnessArrayError(
  pieces: readonly FartherPlacementWitness[],
  path: string,
): string | null {
  if (pieces.length < 1) return `${path} has length 0; required at least 1 placement witness`;
  for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
    const piece = pieces[pieceIndex]!;
    if (piece.catalogPartId.length === 0 || piece.colorId.length === 0) {
      return `${path}[${pieceIndex}] has catalogPartId/colorId ${shown(piece.catalogPartId)}/${shown(piece.colorId)}; both must be non-empty`;
    }
    if (piece.transform.orientationId.length === 0) {
      return `${path}[${pieceIndex}].transform.orientationId is empty; required a non-empty orientation id`;
    }
    const invalidPosition = piece.transform.positionLdu.findIndex(
      (value) => !Number.isFinite(value),
    );
    if (invalidPosition >= 0) {
      return `${path}[${pieceIndex}].transform.positionLdu[${invalidPosition}] is ${shown(piece.transform.positionLdu[invalidPosition])}; required a finite number`;
    }
  }
  return null;
}

export function describeOriginInputError<D>(input: FartherOriginInput<D>): string | null {
  if (!Number.isSafeInteger(input.stepNumber) || input.stepNumber < 1) {
    return `origin.stepNumber is ${shown(input.stepNumber)}; required a positive safe integer`;
  }
  if (input.candidates.length < 2) {
    return `origin.candidates has length ${input.candidates.length}; required at least 2`;
  }
  const duplicateId = firstDuplicate(input.candidates.map(({ candidateId }) => candidateId));
  if (duplicateId !== undefined) {
    return `origin candidateId ${shown(duplicateId)} appears more than once; required unique ids`;
  }
  for (let index = 0; index < input.candidates.length; index += 1) {
    const candidate = input.candidates[index]!;
    if (candidate.candidateId.length === 0) {
      return `origin.candidates[${index}].candidateId is empty; required a non-empty id`;
    }
    if (candidate.documentHash.length === 0) {
      return `origin.candidates[${index}].documentHash is empty; required a non-empty hash`;
    }
    const witnessError = describeWitnessArrayError(
      candidate.pieces,
      `origin.candidates[${index}].pieces`,
    );
    if (witnessError !== null) return witnessError;
  }
  return null;
}

export function describeFrontierInputError<D>(
  frontier: FartherFrontier<D>,
  path: string,
): string | null {
  if (!Number.isSafeInteger(frontier.originStepNumber) || frontier.originStepNumber < 1) {
    return `${path}.originStepNumber is ${shown(frontier.originStepNumber)}; required a positive safe integer`;
  }
  if (
    !Number.isSafeInteger(frontier.throughStepNumber) ||
    frontier.throughStepNumber < frontier.originStepNumber
  ) {
    return `${path}.throughStepNumber is ${shown(frontier.throughStepNumber)}; required a safe integer at least originStepNumber ${frontier.originStepNumber}`;
  }
  if (frontier.candidates.length < 1) {
    return `${path}.candidates has length 0; required at least 1 candidate`;
  }
  const candidateIds = frontier.candidates.map(({ candidateId }) => candidateId);
  const duplicateId = firstDuplicate(candidateIds);
  if (duplicateId !== undefined) {
    return `${path} candidateId ${shown(duplicateId)} appears more than once; required unique ids`;
  }
  const expectedLineageLength = frontier.throughStepNumber - frontier.originStepNumber + 1;
  for (let candidateIndex = 0; candidateIndex < frontier.candidates.length; candidateIndex += 1) {
    const candidate = frontier.candidates[candidateIndex]!;
    const candidatePath = `${path}.candidates[${candidateIndex}]`;
    if (candidate.candidateId.length === 0 || candidate.originCandidateId.length === 0) {
      return `${candidatePath} has candidateId/originCandidateId ${shown(candidate.candidateId)}/${shown(candidate.originCandidateId)}; both must be non-empty`;
    }
    if (frontier.throughStepNumber === frontier.originStepNumber) {
      if (
        candidate.parentCandidateId !== null ||
        candidate.originCandidateId !== candidate.candidateId
      ) {
        return `${candidatePath} is an origin candidate with parent/origin ${shown(candidate.parentCandidateId)}/${shown(candidate.originCandidateId)}; required null/${shown(candidate.candidateId)}`;
      }
    } else if (candidate.parentCandidateId === null || candidate.parentCandidateId.length === 0) {
      return `${candidatePath}.parentCandidateId is ${shown(candidate.parentCandidateId)}; a carried candidate requires a non-empty parent id`;
    }
    if (candidate.lineage.length !== expectedLineageLength) {
      return `${candidatePath}.lineage has length ${candidate.lineage.length}; required ${expectedLineageLength} contiguous steps`;
    }
    for (let lineageIndex = 0; lineageIndex < candidate.lineage.length; lineageIndex += 1) {
      const step = candidate.lineage[lineageIndex]!;
      const stepPath = `${candidatePath}.lineage[${lineageIndex}]`;
      const requiredStep = frontier.originStepNumber + lineageIndex;
      if (!Number.isSafeInteger(step.stepNumber) || step.stepNumber !== requiredStep) {
        return `${stepPath}.stepNumber is ${shown(step.stepNumber)}; required contiguous step ${requiredStep}`;
      }
      if (step.documentHash.length === 0) {
        return `${stepPath}.documentHash is empty; required a non-empty hash`;
      }
      const witnessError = describeWitnessArrayError(step.pieces, `${stepPath}.pieces`);
      if (witnessError !== null) return witnessError;
    }
  }
  return null;
}

export function atomicPiecesMatch(
  expected: readonly FartherAtomicPieceIdentity[],
  observed: readonly FartherPlacementWitness[],
): boolean {
  const expectedKeys = expected.map(atomicPieceKey).sort();
  const observedKeys = observed.map(atomicPieceKey).sort();
  return (
    expectedKeys.length === observedKeys.length &&
    expectedKeys.every((key, index) => key === observedKeys[index])
  );
}

export function describeCarryInputError<D>(
  input: FartherCarryInput<D>,
  candidateIds: readonly string[],
  narrowingRenders: number,
): string | null {
  const frontierError = describeFrontierInputError(input.frontier, "frontier");
  if (frontierError !== null) return frontierError;
  const requiredStep = input.frontier.throughStepNumber + 1;
  if (!Number.isSafeInteger(input.stepNumber) || input.stepNumber !== requiredStep) {
    return `stepNumber is ${shown(input.stepNumber)}; required exactly ${requiredStep}, the next intervening step`;
  }
  if (input.expectedAtomicPieces.length < 1) {
    return `expectedAtomicPieces has length 0; required at least 1 identity`;
  }
  const invalidIdentity = input.expectedAtomicPieces.findIndex(
    ({ catalogPartId, colorId }) => catalogPartId.length === 0 || colorId.length === 0,
  );
  if (invalidIdentity >= 0) {
    return `expectedAtomicPieces[${invalidIdentity}] is ${JSON.stringify(input.expectedAtomicPieces[invalidIdentity])}; catalogPartId and colorId must both be non-empty`;
  }
  for (let expansionIndex = 0; expansionIndex < input.expansions.length; expansionIndex += 1) {
    const expansion = input.expansions[expansionIndex]!;
    if (expansion.parentCandidateId.length === 0) {
      return `expansions[${expansionIndex}].parentCandidateId is empty; required a non-empty id`;
    }
    for (let childIndex = 0; childIndex < expansion.children.length; childIndex += 1) {
      const child = expansion.children[childIndex]!;
      const childPath = `expansions[${expansionIndex}].children[${childIndex}]`;
      if (child.documentHash.length === 0) {
        return `${childPath}.documentHash is empty; required a non-empty hash`;
      }
      const witnessError = describeWitnessArrayError(child.pieces, `${childPath}.pieces`);
      if (witnessError !== null) return witnessError;
    }
  }
  if (!Number.isSafeInteger(input.maximumCandidates) || input.maximumCandidates < 1) {
    return `maximumCandidates is ${shown(input.maximumCandidates)}; required a positive safe integer`;
  }
  if (!Number.isSafeInteger(input.maximumNarrowingRenders) || input.maximumNarrowingRenders < 1) {
    return `maximumNarrowingRenders is ${shown(input.maximumNarrowingRenders)}; required a positive safe integer`;
  }
  const invalidCountLength = input.expansions.findIndex(
    ({ offeredPerPiece, carriedPerPiece }) =>
      offeredPerPiece.length !== input.expectedAtomicPieces.length ||
      carriedPerPiece.length !== input.expectedAtomicPieces.length,
  );
  if (invalidCountLength >= 0) {
    const expansion = input.expansions[invalidCountLength]!;
    return `expansions[${invalidCountLength}] offeredPerPiece/carriedPerPiece lengths are ${expansion.offeredPerPiece.length}/${expansion.carriedPerPiece.length}; each must equal expectedAtomicPieces length ${input.expectedAtomicPieces.length}`;
  }
  const invalidCount = input.expansions
    .flatMap((expansion, expansionIndex) => [
      {
        field: `expansions[${expansionIndex}].narrowingRenders`,
        value: expansion.narrowingRenders,
      },
      ...expansion.offeredPerPiece.map((value, index) => ({
        field: `expansions[${expansionIndex}].offeredPerPiece[${index}]`,
        value,
      })),
      ...expansion.carriedPerPiece.map((value, index) => ({
        field: `expansions[${expansionIndex}].carriedPerPiece[${index}]`,
        value,
      })),
    ])
    .find(({ value }) => !Number.isSafeInteger(value) || value < 0);
  if (invalidCount !== undefined) {
    return `${invalidCount.field} is ${shown(invalidCount.value)}; required a non-negative safe integer`;
  }
  if (!Number.isSafeInteger(narrowingRenders)) {
    return `aggregate narrowingRenders is ${shown(narrowingRenders)}; required a safe integer sum`;
  }
  const invalidChildId = candidateIds.findIndex((candidateId) => candidateId.length === 0);
  if (invalidChildId >= 0) {
    return `child candidateIds[${invalidChildId}] is empty; required a non-empty id`;
  }
  const duplicateChildId = firstDuplicate(candidateIds);
  return duplicateChildId === undefined
    ? null
    : `child candidateId ${shown(duplicateChildId)} appears more than once; required unique ids`;
}

export function describePanelInputError<D>(
  input: FirstRevealingPanelInput<D>,
  ordered: readonly FartherPanelObservationInput[],
  frontierIds: readonly string[],
  originIds: readonly string[],
): string | null {
  const frontierError = describeFrontierInputError(input.frontier, "frontier");
  if (frontierError !== null) return frontierError;
  if (input.originEvidence.stepNumber !== input.frontier.originStepNumber) {
    return `originEvidence.stepNumber is ${shown(input.originEvidence.stepNumber)}; required ${input.frontier.originStepNumber}`;
  }
  const originValuesValid =
    input.originEvidence.status === "no-local-signal"
      ? input.originEvidence.margin === null && input.originEvidence.minimumMargin === null
      : input.originEvidence.margin !== null &&
        input.originEvidence.minimumMargin !== null &&
        input.originEvidence.margin >= 0 &&
        input.originEvidence.margin <= input.originEvidence.minimumMargin &&
        input.originEvidence.minimumMargin <= 1;
  if (!originValuesValid) {
    return (
      `originEvidence status ${shown(input.originEvidence.status)} has margin/minimumMargin ` +
      `${shown(input.originEvidence.margin)}/${shown(input.originEvidence.minimumMargin)}; ` +
      `no-local-signal requires null/null and unseparated requires 0 <= margin <= minimumMargin <= 1`
    );
  }
  if (originIds.length < 2) {
    return `frontier has ${originIds.length} origin family; required at least 2 unresolved families`;
  }
  const invalidFrontierId = frontierIds.findIndex((id) => id.length === 0);
  if (invalidFrontierId >= 0) {
    return `frontier.candidates[${invalidFrontierId}].candidateId is empty`;
  }
  const duplicateFrontierId = firstDuplicate(frontierIds);
  if (duplicateFrontierId !== undefined) {
    return `frontier candidateId ${shown(duplicateFrontierId)} appears more than once; required unique ids`;
  }
  if (
    !Number.isFinite(input.minimumAgreement) ||
    input.minimumAgreement <= 0 ||
    input.minimumAgreement > 1
  ) {
    return `minimumAgreement is ${shown(input.minimumAgreement)}; required 0 < value <= 1`;
  }
  if (!Number.isFinite(input.minimumMargin) || input.minimumMargin < 0 || input.minimumMargin > 1) {
    return `minimumMargin is ${shown(input.minimumMargin)}; required 0 <= value <= 1`;
  }
  if (!Number.isSafeInteger(input.maximumPanelRenders) || input.maximumPanelRenders < 1) {
    return `maximumPanelRenders is ${shown(input.maximumPanelRenders)}; required a positive safe integer`;
  }
  if (!Number.isSafeInteger(input.maximumReachSteps) || input.maximumReachSteps < 1) {
    return `maximumReachSteps is ${shown(input.maximumReachSteps)}; required a positive safe integer`;
  }
  if (typeof input.fartherPanelsAvailable !== "boolean") {
    return `fartherPanelsAvailable is ${shown(input.fartherPanelsAvailable)}; required boolean`;
  }
  const invalidPanelStep = ordered.findIndex(
    (panel, index) =>
      !Number.isSafeInteger(panel.stepNumber) ||
      panel.stepNumber !== input.frontier.originStepNumber + index + 1,
  );
  if (invalidPanelStep >= 0) {
    return `panels[${invalidPanelStep}].stepNumber is ${shown(ordered[invalidPanelStep]!.stepNumber)}; required contiguous step ${input.frontier.originStepNumber + invalidPanelStep + 1}`;
  }
  const invalidSubject = ordered.findIndex(
    (panel) =>
      panel.status === "scored" &&
      ((panel.subject === "origin" && panel.stepNumber !== input.frontier.originStepNumber + 1) ||
        (panel.subject === "frontier" &&
          panel.stepNumber !== input.frontier.throughStepNumber + 1)),
  );
  if (invalidSubject >= 0) {
    const panel = ordered[invalidSubject] as Extract<
      FartherPanelObservationInput,
      { status: "scored" }
    >;
    return `panels[${invalidSubject}] subject ${shown(panel.subject)} at step ${panel.stepNumber} is not bound to origin N+1 or constructed frontier throughStep+1`;
  }
  const lastPanelStep = ordered.at(-1)?.stepNumber ?? input.frontier.originStepNumber;
  return lastPanelStep > input.frontier.throughStepNumber + 1
    ? `last panel step ${lastPanelStep} requires construction through ${lastPanelStep - 1}; frontier stops at ${input.frontier.throughStepNumber}`
    : null;
}
