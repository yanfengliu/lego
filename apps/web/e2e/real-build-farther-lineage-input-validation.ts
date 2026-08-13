import {
  assertRealBuildLineageParent,
  REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER,
} from "./real-build-candidate-lineage-identity";
import { MAXIMUM_LINEAGED_FARTHER_LINEAGES } from "./real-build-farther-panel-types";
import { requireLineagedFartherInspectionSnapshot } from "./real-build-farther-lineage-inspection";
import { realBuildLineageAttemptEvidenceId } from "./real-build-lineage-attempt-evidence-id";
import type {
  InspectedLineagedFartherCandidate,
  InspectedLineagedFartherPanelScore,
  LineagedFartherInspectionSnapshot,
} from "./real-build-farther-lineage-inspection-types";
import { describeInspectedLineagedFartherFrontierError } from "./real-build-farther-lineage-frontier-validation";

const CAMERA_EVIDENCE_ID_PATTERN =
  /^(?:panel-camera-observation-v[1-9][0-9]*|camera-evidence):[0-9a-f]{64}$/u;

const shown = (value: string | number | null): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

const atomicKey = (piece: { readonly catalogPartId: string; readonly colorId: string }): string =>
  `${piece.catalogPartId.length}:${piece.catalogPartId}${piece.colorId}`;

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function matchesAtomicPieces(
  expectedLength: number,
  expected: ReadonlyMap<string, number>,
  observed: readonly { readonly catalogPartId: string; readonly colorId: string }[],
): boolean {
  if (observed.length !== expectedLength) return false;
  const remaining = new Map(expected);
  for (const piece of observed) {
    const key = atomicKey(piece);
    const count = remaining.get(key);
    if (count === undefined) return false;
    if (count === 1) remaining.delete(key);
    else remaining.set(key, count - 1);
  }
  return remaining.size === 0;
}

export function describeLineagedFartherCarryError(
  inspected: LineagedFartherInspectionSnapshot<"carry">,
): string | null {
  const input = requireLineagedFartherInspectionSnapshot(inspected, "carry").value;
  const frontierDefect = describeInspectedLineagedFartherFrontierError(
    input.frontier,
    "lineaged carry.frontier",
  );
  if (frontierDefect !== null) return frontierDefect;
  const requiredStep = input.frontier.throughStepNumber + 1;
  if (
    input.stepNumber !== requiredStep ||
    input.stepNumber > REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER
  ) {
    return `lineaged carry.stepNumber is ${shown(input.stepNumber)}; required ${requiredStep}`;
  }
  if (input.expectedAtomicPieces.length === 0) {
    return "lineaged carry expectedAtomicPieces is empty";
  }
  if (input.maximumLineages < 1 || input.maximumLineages > MAXIMUM_LINEAGED_FARTHER_LINEAGES) {
    return `lineaged carry.maximumLineages must be a safe integer from 1 through ${MAXIMUM_LINEAGED_FARTHER_LINEAGES}`;
  }
  if (
    input.maximumNarrowingRenders < 0 ||
    input.maximumNarrowingRenders > MAXIMUM_LINEAGED_FARTHER_LINEAGES
  ) {
    return `lineaged carry.maximumNarrowingRenders must be a safe integer from 0 through ${MAXIMUM_LINEAGED_FARTHER_LINEAGES}`;
  }
  const expectedMultiset = new Map<string, number>();
  for (const piece of input.expectedAtomicPieces) increment(expectedMultiset, atomicKey(piece));
  const parentById = new Map(
    input.frontier.candidates.map((candidate) => [candidate.identity.lineageId, candidate]),
  );
  const expanded = new Set<string>();
  let totalChildren = 0;
  let totalRenders = 0;
  for (let index = 0; index < input.expansions.length; index += 1) {
    const expansion = input.expansions[index]!;
    const parent = parentById.get(expansion.parentLineageId);
    if (parent === undefined || expanded.has(expansion.parentLineageId)) {
      return `lineaged carry.expansions[${index}] has an unknown or repeated parentLineageId`;
    }
    expanded.add(expansion.parentLineageId);
    if (
      expansion.narrowingRenders < 0 ||
      expansion.offeredPerPiece.length !== input.expectedAtomicPieces.length ||
      expansion.carriedPerPiece.length !== input.expectedAtomicPieces.length
    ) {
      return `lineaged carry.expansions[${index}] has invalid render or per-piece counts`;
    }
    for (let pieceIndex = 0; pieceIndex < expansion.offeredPerPiece.length; pieceIndex += 1) {
      const offered = expansion.offeredPerPiece[pieceIndex]!;
      const carried = expansion.carriedPerPiece[pieceIndex]!;
      if (offered < 0 || carried < 0 || carried > offered) {
        return `lineaged carry.expansions[${index}] per-piece counts require 0 <= carried <= offered`;
      }
    }
    if (expansion.narrowingRenders > input.maximumNarrowingRenders - totalRenders) {
      return "lineaged carry exceeds its aggregate narrowing-render budget";
    }
    totalRenders += expansion.narrowingRenders;
    if (expansion.children.length === 0) {
      return `lineaged carry.expansions[${index}] has no complete child lineage`;
    }
    if (expansion.children.length > input.maximumLineages - totalChildren) {
      return "lineaged carry exceeds its aggregate child-lineage budget";
    }
    totalChildren += expansion.children.length;
    const childHashes = new Set<string>();
    for (let childIndex = 0; childIndex < expansion.children.length; childIndex += 1) {
      const child = expansion.children[childIndex]!;
      if (childHashes.has(child.documentSnapshot.documentHash)) {
        return `lineaged carry parent ${shown(expansion.parentLineageId)} repeats one parent-candidate result`;
      }
      childHashes.add(child.documentSnapshot.documentHash);
      if (child.parentLineageId !== expansion.parentLineageId) {
        return `lineaged carry.expansions[${index}].children[${childIndex}] does not bind its exact parent lineage`;
      }
      if (child.throughStepNumber !== input.stepNumber) {
        return `lineaged carry.expansions[${index}].children[${childIndex}].throughStepNumber is not step ${input.stepNumber}`;
      }
      if (child.documentSnapshot === parent.documentSnapshot) {
        return `lineaged carry.expansions[${index}].children[${childIndex}] does not advance to a different candidate document`;
      }
      if (!matchesAtomicPieces(input.expectedAtomicPieces.length, expectedMultiset, child.pieces)) {
        return `lineaged carry.expansions[${index}].children[${childIndex}] does not retain the exact atomic pieces`;
      }
    }
  }
  return expanded.size === parentById.size
    ? null
    : "lineaged carry parent expansions do not cover every current lineage";
}

function evidenceChildError(
  score: {
    readonly identity: InspectedLineagedFartherCandidate["identity"];
    readonly fartherOriginLineageId: InspectedLineagedFartherCandidate["fartherOriginLineageId"];
  },
  parent: InspectedLineagedFartherCandidate,
): boolean {
  try {
    assertRealBuildLineageParent(score.identity, parent.identity);
  } catch {
    return true;
  }
  return (
    score.identity.localIdentity.kind !== "evidence" ||
    score.identity.candidateId !== parent.identity.candidateId ||
    score.identity.documentHash !== parent.identity.documentHash ||
    score.identity.throughStepNumber !== parent.identity.throughStepNumber ||
    score.fartherOriginLineageId !== parent.fartherOriginLineageId
  );
}

function sameCandidateMeasurement(
  left: InspectedLineagedFartherPanelScore,
  right: InspectedLineagedFartherPanelScore,
): boolean {
  return (
    left.cameraEvidenceId === right.cameraEvidenceId &&
    left.measure === right.measure &&
    left.candidateMaskDigest === right.candidateMaskDigest &&
    left.builtMaskDigest === right.builtMaskDigest &&
    left.excludedMaskDigest === right.excludedMaskDigest &&
    left.shiftPx[0] === right.shiftPx[0] &&
    left.shiftPx[1] === right.shiftPx[1] &&
    left.agreement === right.agreement
  );
}

export function describeFirstLineagedPanelError(
  inspected: LineagedFartherInspectionSnapshot<"panel">,
): string | null {
  const input = requireLineagedFartherInspectionSnapshot(inspected, "panel").value;
  const frontierDefect = describeInspectedLineagedFartherFrontierError(
    input.frontier,
    "lineaged panel.frontier",
  );
  if (frontierDefect !== null) return frontierDefect;
  if (input.minimumAgreement <= 0 || input.minimumAgreement > 1) {
    return "lineaged panel.minimumAgreement must be finite in (0, 1]";
  }
  if (input.minimumMargin < 0 || input.minimumMargin > 1) {
    return "lineaged panel.minimumMargin must be finite in [0, 1]";
  }
  if (
    new Set(input.frontier.candidates.map(({ fartherOriginLineageId }) => fartherOriginLineageId))
      .size < 2
  ) {
    return "lineaged panel requires at least two unresolved farther-origin families";
  }
  if (
    input.maximumPanelRenders < Math.max(1, input.frontier.panelRendersUsed) ||
    input.maximumPanelRenders > MAXIMUM_LINEAGED_FARTHER_LINEAGES
  ) {
    return "lineaged panel.maximumPanelRenders is outside the aggregate render budget";
  }
  if (
    input.maximumReachSteps < 1 ||
    input.maximumReachSteps > REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER ||
    input.frontier.observationPanelStepNumber - input.frontier.originStepNumber >
      input.maximumReachSteps ||
    (input.panels.at(-1)?.stepNumber ?? input.frontier.observationPanelStepNumber) -
      input.frontier.originStepNumber >
      input.maximumReachSteps
  ) {
    return "lineaged panel exceeds its maximum farther-panel reach";
  }
  let expected = new Map(
    input.frontier.candidates.map((candidate) => [candidate.identity.lineageId, candidate]),
  );
  const allEvidenceLineageIds = new Set<string>();
  let renders = input.frontier.panelRendersUsed;
  for (let panelIndex = 0; panelIndex < input.panels.length; panelIndex += 1) {
    const panel = input.panels[panelIndex]!;
    if (
      panel.stepNumber !== input.frontier.observationPanelStepNumber + panelIndex + 1 ||
      panel.stepNumber > REAL_BUILD_LINEAGE_MAXIMUM_STEP_NUMBER
    ) {
      return `lineaged panel.panels[${panelIndex}] is not the next contiguous observation panel`;
    }
    if (panel.scores.length !== expected.size) {
      return `lineaged panel.panels[${panelIndex}] does not score every current lineage exactly once`;
    }
    const minimumUniqueCandidateRenders = new Set(
      [...expected.values()].map(({ identity }) => identity.candidateId),
    ).size;
    if (panel.renderCount < minimumUniqueCandidateRenders) {
      return `lineaged panel.panels[${panelIndex}].renderCount is ${panel.renderCount}; required at least ${minimumUniqueCandidateRenders} unique candidate renders`;
    }
    if (panel.renderCount > input.maximumPanelRenders - renders) {
      return `lineaged panel.panels[${panelIndex}].renderCount exceeds the aggregate render budget`;
    }
    renders += panel.renderCount;
    const observedParents = new Set<string>();
    const next = new Map<string, InspectedLineagedFartherCandidate>();
    const measurementByCandidateId = new Map<string, InspectedLineagedFartherPanelScore>();
    const sharedMeasure = panel.scores[0]?.measure;
    const sharedBuiltMaskDigest = panel.scores[0]?.builtMaskDigest;
    const sharedExcludedMaskDigest = panel.scores[0]?.excludedMaskDigest;
    for (let scoreIndex = 0; scoreIndex < panel.scores.length; scoreIndex += 1) {
      const score = panel.scores[scoreIndex]!;
      const parentId = score.identity.parentLineageId;
      const parent = parentId === null ? undefined : expected.get(parentId);
      if (
        parentId === null ||
        parent === undefined ||
        observedParents.has(parentId) ||
        allEvidenceLineageIds.has(score.identity.lineageId) ||
        evidenceChildError(score, parent)
      ) {
        return `lineaged panel.panels[${panelIndex}].scores[${scoreIndex}] is not the unique exact evidence child of one current lineage`;
      }
      const expectedEvidenceId = realBuildLineageAttemptEvidenceId({
        candidateId: parent.identity.candidateId,
        parentLineageId: parent.identity.lineageId,
        throughStepNumber: parent.identity.throughStepNumber,
        registrationPanelStepNumber: panel.stepNumber,
        status: "scored",
        sourceEvidenceId: score.cameraEvidenceId,
      });
      const priorCandidateMeasurement = measurementByCandidateId.get(parent.identity.candidateId);
      if (score.agreement < 0 || score.agreement > 1) {
        return `lineaged panel.panels[${panelIndex}].scores[${scoreIndex}].agreement must be in [0, 1]`;
      }
      if (!CAMERA_EVIDENCE_ID_PATTERN.test(score.cameraEvidenceId)) {
        return `lineaged panel.panels[${panelIndex}].scores[${scoreIndex}].cameraEvidenceId is not a recognized camera measurement digest`;
      }
      if (score.identity.localIdentity.id !== expectedEvidenceId) {
        return `lineaged panel.panels[${panelIndex}].scores[${scoreIndex}] identity does not bind its exact parent, panel, and camera evidence`;
      }
      if (
        score.measure !== sharedMeasure ||
        score.builtMaskDigest !== sharedBuiltMaskDigest ||
        score.excludedMaskDigest !== sharedExcludedMaskDigest
      ) {
        return `lineaged panel.panels[${panelIndex}] mixes comparison measures or printed-panel masks`;
      }
      if (
        priorCandidateMeasurement !== undefined &&
        !sameCandidateMeasurement(score, priorCandidateMeasurement)
      ) {
        return `lineaged panel.panels[${panelIndex}] assigns conflicting measurements to one converged candidate document`;
      }
      measurementByCandidateId.set(parent.identity.candidateId, score);
      observedParents.add(parentId);
      allEvidenceLineageIds.add(score.identity.lineageId);
      next.set(score.identity.lineageId, {
        identity: score.identity,
        fartherOriginLineageId: score.fartherOriginLineageId,
        documentSnapshot: parent.documentSnapshot,
      });
    }
    if (observedParents.size !== expected.size) {
      return `lineaged panel.panels[${panelIndex}] does not score every current lineage exactly once`;
    }
    expected = next as typeof expected;
  }
  return null;
}
