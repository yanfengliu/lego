import type { RealBuildCompiledGraphIndex } from "./real-build-compiled-placement-lineage-validation-graph";
import type {
  RealBuildCompiledObservationByteReference,
  RealBuildCompiledObservationReference,
  RealBuildCompiledPlacementLineageEvidence,
} from "./real-build-compiled-placement-lineage-types";

interface RangedReference {
  readonly path: string;
  readonly reference: RealBuildCompiledObservationByteReference;
}

function sameReference(
  left: RealBuildCompiledObservationByteReference,
  right: RealBuildCompiledObservationByteReference,
): boolean {
  return (
    left.role === right.role &&
    left.offset === right.offset &&
    left.bytes === right.bytes &&
    left.digest === right.digest &&
    left.encoding === right.encoding &&
    left.widthPx === right.widthPx &&
    left.heightPx === right.heightPx
  );
}

function validateReferenceRanges(
  references: readonly RangedReference[],
  evidence: RealBuildCompiledPlacementLineageEvidence,
): void {
  if (references.length === 0) {
    if (evidence.observationBytes !== null) {
      throw new TypeError(
        "compiledLineage.observationBytes must be null when no observation retains mask byte references.",
      );
    }
    return;
  }
  if (evidence.observationBytes === null) {
    throw new TypeError(
      "compiledLineage.observationBytes must bind the complete role when mask references are retained.",
    );
  }
  const uniqueByRange = new Map<string, RangedReference>();
  for (let index = 0; index < references.length; index += 1) {
    const entry = references[index]!;
    const key = `${entry.reference.offset}:${entry.reference.bytes}`;
    const prior = uniqueByRange.get(key);
    if (prior !== undefined && !sameReference(prior.reference, entry.reference)) {
      throw new TypeError(
        `${entry.path} aliases ${prior.path} but changes the exact digest, encoding, or dimensions.`,
      );
    }
    if (prior === undefined) uniqueByRange.set(key, entry);
  }
  const ordered = [...uniqueByRange.values()].sort(
    (left, right) => left.reference.offset - right.reference.offset,
  );
  let nextOffset = 0;
  let previous: RangedReference | undefined;
  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index]!;
    if (
      previous !== undefined &&
      entry.reference.offset < previous.reference.offset + previous.reference.bytes
    ) {
      throw new TypeError(
        `${entry.path} partially overlaps ${previous.path}; only exact immutable byte-range aliases are permitted.`,
      );
    }
    if (entry.reference.offset !== nextOffset) {
      throw new TypeError(
        `${entry.path} starts at ${entry.reference.offset}; complete role coverage requires the next unique mask range at ${nextOffset}.`,
      );
    }
    nextOffset = entry.reference.offset + entry.reference.bytes;
    previous = entry;
  }
  if (nextOffset !== evidence.observationBytes.bytes) {
    throw new TypeError(
      `compiledLineage.observationBytes declares ${evidence.observationBytes.bytes} bytes but unique mask ranges cover exactly ${nextOffset}.`,
    );
  }
}

function sameDimensions(
  references: readonly (RealBuildCompiledObservationByteReference | null)[],
): boolean {
  const retained = references.filter(
    (reference): reference is RealBuildCompiledObservationByteReference => reference !== null,
  );
  return retained.every(
    (reference) =>
      reference.widthPx === retained[0]?.widthPx && reference.heightPx === retained[0]?.heightPx,
  );
}

function validateObservationShape(
  observation: RealBuildCompiledObservationReference,
  index: number,
  evidence: RealBuildCompiledPlacementLineageEvidence,
): void {
  const path = `compiledLineage.observationRefs[${index}]`;
  if (observation.registrationPanelStepNumber <= evidence.throughStepNumber) {
    throw new TypeError(
      `${path}.registrationPanelStepNumber must be later than the compiled document prefix.`,
    );
  }
  if (
    !sameDimensions([observation.sourceMask, observation.candidateMask, observation.excludedMask])
  ) {
    throw new TypeError(`${path} mask references must retain one exact raster extent.`);
  }
  if (observation.status === "scored") {
    if (
      observation.score === null ||
      observation.cameraEvidenceId === null ||
      observation.sourceMask === null ||
      observation.candidateMask === null
    ) {
      throw new TypeError(
        `${path} may be scored only with an exact score, camera, source-mask byte reference, and candidate-mask byte reference.`,
      );
    }
  } else if (observation.status === "not-observable") {
    if (
      observation.score !== null ||
      observation.sourceMask === null ||
      observation.candidateMask !== null ||
      observation.excludedMask !== null
    ) {
      throw new TypeError(
        `${path} not-observable evidence must retain the exact source-mask bytes but no score or candidate/excluded masks.`,
      );
    }
  } else if (
    observation.score !== null ||
    observation.sourceMask !== null ||
    observation.candidateMask !== null ||
    observation.excludedMask !== null
  ) {
    throw new TypeError(`${path} failed evidence cannot retain a score or claim mask byte refs.`);
  }
}

function equalScore(left: number | null, right: number | null): boolean {
  return left === right;
}

function validateSelectionScores(
  evidence: RealBuildCompiledPlacementLineageEvidence,
  observations: readonly RealBuildCompiledObservationReference[],
  graph: RealBuildCompiledGraphIndex,
): void {
  const selection = evidence.selection;
  const scored = observations.filter(({ status }) => status === "scored");
  if (selection.decisionPanelStepNumber === null) {
    if (
      scored.length !== 0 ||
      selection.bestScore !== null ||
      selection.runnerUpScore !== null ||
      selection.margin !== null
    ) {
      throw new TypeError(
        "compiledLineage.selection without a decision panel cannot retain scored observations or ranking values.",
      );
    }
    if (selection.status === "selected") {
      throw new TypeError("compiledLineage.selection.selected requires an exact decision panel.");
    }
    return;
  }
  if (selection.decisionPanelStepNumber <= evidence.throughStepNumber) {
    throw new TypeError(
      "compiledLineage.selection.decisionPanelStepNumber must be later than the compiled prefix.",
    );
  }
  const decisionRows = scored.filter(
    ({ registrationPanelStepNumber }) =>
      registrationPanelStepNumber === selection.decisionPanelStepNumber,
  );
  if (decisionRows.length === 0) {
    throw new TypeError("compiledLineage.selection decision panel has no fully bound scored rows.");
  }
  const orderedScores = decisionRows.map(({ score }) => score!).sort((a, b) => b - a);
  const bestScore = orderedScores[0]!;
  const runnerUpScore =
    selection.status === "selected"
      ? (orderedScores.find((score) => score < bestScore) ?? null)
      : (orderedScores[1] ?? null);
  const margin = runnerUpScore === null ? null : bestScore - runnerUpScore;
  if (
    !equalScore(selection.bestScore, bestScore) ||
    !equalScore(selection.runnerUpScore, runnerUpScore) ||
    !equalScore(selection.margin, margin)
  ) {
    throw new TypeError(
      "compiledLineage.selection best, runner-up, and margin do not reproduce its exact decision-panel observations.",
    );
  }
  if (selection.status !== "selected") return;
  const winningRows = decisionRows.filter(({ score }) => score === bestScore);
  const winningLineages = winningRows.map(({ lineageId }) => lineageId);
  if (
    selection.selectedLineageIds.length !== winningLineages.length ||
    !selection.selectedLineageIds.every((lineageId, index) => lineageId === winningLineages[index])
  ) {
    throw new TypeError(
      "compiledLineage.selection.selectedLineageIds must exactly retain every best-scoring lineage in observation order.",
    );
  }
  const candidateIds = new Set<string>();
  for (let index = 0; index < winningLineages.length; index += 1) {
    candidateIds.add(graph.edgesByChildLineage.get(winningLineages[index]!)!.child.candidateId);
  }
  if (
    candidateIds.size !== 1 ||
    selection.selectedCandidateId === null ||
    !candidateIds.has(selection.selectedCandidateId)
  ) {
    throw new TypeError(
      "compiledLineage.selection can select tied lineages only when they converge on its exact candidate.",
    );
  }
}

export function validateRealBuildCompiledObservations(
  evidence: RealBuildCompiledPlacementLineageEvidence,
  graph: RealBuildCompiledGraphIndex,
): void {
  const observationIds = new Set<string>();
  const lineagePanels = new Set<string>();
  const references: RangedReference[] = [];
  for (let index = 0; index < evidence.observationRefs.length; index += 1) {
    const observation = evidence.observationRefs[index]!;
    const path = `compiledLineage.observationRefs[${index}]`;
    if (observationIds.has(observation.observationId)) {
      throw new TypeError(`${path}.observationId duplicates an earlier observation.`);
    }
    if (!graph.edgesByChildLineage.has(observation.lineageId)) {
      throw new TypeError(`${path}.lineageId does not name a retained compiled child edge.`);
    }
    const lineagePanel = `${observation.lineageId}:${observation.registrationPanelStepNumber}`;
    if (lineagePanels.has(lineagePanel)) {
      throw new TypeError(`${path} duplicates an earlier lineage and registration-panel pair.`);
    }
    validateObservationShape(observation, index, evidence);
    observationIds.add(observation.observationId);
    lineagePanels.add(lineagePanel);
    const fields = [
      ["sourceMask", observation.sourceMask],
      ["candidateMask", observation.candidateMask],
      ["excludedMask", observation.excludedMask],
    ] as const;
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const field = fields[fieldIndex]![0];
      const reference = fields[fieldIndex]![1];
      if (reference !== null) references.push({ path: `${path}.${field}`, reference });
    }
  }
  validateReferenceRanges(references, evidence);
  validateSelectionScores(evidence, evidence.observationRefs, graph);
}
