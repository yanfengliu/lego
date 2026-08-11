/** Standalone, non-driver evidence primitives for bounded farther-panel search. */

import type {
  FartherCandidate,
  FartherCarryEvidence,
  FartherCarryInput,
  FartherCarryResult,
  FartherOriginInput,
  FartherOriginResult,
  FartherPanelEvidence,
  FartherRefusal,
  FartherRefusalCode,
  FirstRevealingPanelInput,
  FirstRevealingPanelResult,
} from "./real-build-farther-panel-types";
import { freezeArray, freezeLineageStep } from "./real-build-farther-panel-freeze";
import {
  parseFartherCarryInput,
  parseFartherOriginInput,
  parseFirstRevealingPanelInput,
} from "./real-build-farther-panel-runtime";
import {
  atomicPieceKey,
  atomicPiecesMatch,
  describeCarryInputError,
  describeOriginInputError,
  describePanelInputError,
  firstDuplicate,
  shown,
} from "./real-build-farther-panel-validation";

export type * from "./real-build-farther-panel-types";

export function createFartherOriginFrontier<D>(
  unsafeInput: FartherOriginInput<D>,
): FartherOriginResult<D> {
  const parsed = parseFartherOriginInput<D>(unsafeInput);
  if (parsed.value === null) {
    return Object.freeze({
      frontier: null,
      refusal: Object.freeze({
        code: "farther-input-invalid",
        stage: "input",
        stepNumber: 0,
        message: `Farther-panel origin refused: ${parsed.error}.`,
      }),
    });
  }
  const input = parsed.value;
  const inputError = describeOriginInputError(input);
  if (inputError !== null) {
    return Object.freeze({
      frontier: null,
      refusal: Object.freeze({
        code: "farther-input-invalid",
        stage: "input",
        stepNumber: Number.isSafeInteger(input.stepNumber) ? input.stepNumber : 0,
        message: `Farther-panel origin refused: ${inputError}.`,
      }),
    });
  }
  const candidates = input.candidates.map(({ candidateId, document, documentHash, pieces }) =>
    Object.freeze({
      candidateId,
      parentCandidateId: null,
      originCandidateId: candidateId,
      document,
      lineage: freezeArray([
        freezeLineageStep({ stepNumber: input.stepNumber, documentHash, pieces }),
      ]),
    }),
  );
  return Object.freeze({
    frontier: Object.freeze({
      originStepNumber: input.stepNumber,
      throughStepNumber: input.stepNumber,
      candidates: freezeArray(candidates),
    }),
    refusal: null,
  });
}

export function carryFartherFrontier<D>(unsafeInput: FartherCarryInput<D>): FartherCarryResult<D> {
  const parsed = parseFartherCarryInput<D>(unsafeInput);
  if (parsed.value === null) {
    const evidence: FartherCarryEvidence = Object.freeze({
      parentCandidates: 0,
      parentsExpanded: 0,
      offeredCandidates: 0,
      narrowingRenders: 0,
      maximumCandidates: 0,
      maximumNarrowingRenders: 0,
      expectedAtomicPieces: freezeArray([]),
      perParent: freezeArray([]),
      measuredLineages: freezeArray([]),
    });
    return Object.freeze({
      frontier: null,
      refusal: Object.freeze({
        code: "farther-input-invalid",
        stage: "input",
        stepNumber: 0,
        message: `Farther carry input refused: ${parsed.error}.`,
      }),
      evidence,
    });
  }
  const input = parsed.value;
  const parentById = new Map(
    input.frontier.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const expansionIds = input.expansions.map(({ parentCandidateId }) => parentCandidateId);
  const candidateIds = input.expansions.flatMap(({ children }) =>
    children.map(({ candidateId }) => candidateId),
  );
  const completeParents =
    expansionIds.length === parentById.size &&
    new Set(expansionIds).size === expansionIds.length &&
    expansionIds.every((id) => parentById.has(id));
  const duplicateParentId = firstDuplicate(expansionIds);
  const unknownParentId = expansionIds.find((id) => !parentById.has(id));
  const missingParentId = [...parentById.keys()].find((id) => !expansionIds.includes(id));
  const atomicMismatch = input.expansions
    .flatMap((expansion) =>
      expansion.children.map((child) => ({
        parentCandidateId: expansion.parentCandidateId,
        child,
      })),
    )
    .find(({ child }) => !atomicPiecesMatch(input.expectedAtomicPieces, child.pieces));
  const atomic = atomicMismatch === undefined;
  const nonempty = input.expansions.every(({ children }) => children.length > 0);
  const measuredCandidates: FartherCandidate<D>[] = [];
  if (completeParents && atomic && candidateIds.length === new Set(candidateIds).size) {
    for (const expansion of input.expansions) {
      const parent = parentById.get(expansion.parentCandidateId)!;
      for (const child of expansion.children) {
        measuredCandidates.push(
          Object.freeze({
            candidateId: child.candidateId,
            parentCandidateId: parent.candidateId,
            originCandidateId: parent.originCandidateId,
            document: child.document,
            lineage: freezeArray([
              ...parent.lineage,
              freezeLineageStep({
                stepNumber: input.stepNumber,
                documentHash: child.documentHash,
                pieces: child.pieces,
              }),
            ]),
          }),
        );
      }
    }
  }
  const narrowingRenders = input.expansions.reduce(
    (total, expansion) => total + expansion.narrowingRenders,
    0,
  );
  const inputError = describeCarryInputError(input, candidateIds, narrowingRenders);
  const evidence: FartherCarryEvidence = Object.freeze({
    parentCandidates: parentById.size,
    parentsExpanded: new Set(expansionIds.filter((id) => parentById.has(id))).size,
    offeredCandidates: candidateIds.length,
    narrowingRenders,
    maximumCandidates: input.maximumCandidates,
    maximumNarrowingRenders: input.maximumNarrowingRenders,
    expectedAtomicPieces: freezeArray(
      input.expectedAtomicPieces.map((piece) => Object.freeze({ ...piece })),
    ),
    perParent: freezeArray(
      input.expansions.map((expansion) =>
        Object.freeze({
          parentCandidateId: expansion.parentCandidateId,
          offeredCandidates: expansion.children.length,
          narrowingRenders: expansion.narrowingRenders,
          offeredPerPiece: freezeArray(expansion.offeredPerPiece),
          carriedPerPiece: freezeArray(expansion.carriedPerPiece),
        }),
      ),
    ),
    measuredLineages: freezeArray(
      measuredCandidates.map(({ candidateId, parentCandidateId, originCandidateId, lineage }) =>
        Object.freeze({ candidateId, parentCandidateId, originCandidateId, lineage }),
      ),
    ) as readonly Omit<FartherCandidate<never>, "document">[],
  });
  const refuse = (
    code: FartherRefusalCode,
    stage: FartherRefusal["stage"],
    message: string,
  ): FartherCarryResult<D> =>
    Object.freeze({
      frontier: null,
      refusal: Object.freeze({ code, stage, stepNumber: input.stepNumber, message }),
      evidence,
    });

  if (inputError !== null) {
    return refuse(
      "farther-input-invalid",
      "input",
      `Step ${input.stepNumber} farther carry refused: ${inputError}.`,
    );
  }
  if (!completeParents) {
    return refuse(
      "incomplete-parent-expansion",
      "evidence",
      duplicateParentId !== undefined
        ? `Step ${input.stepNumber} parent ${shown(duplicateParentId)} has duplicate expansions; required exactly one.`
        : unknownParentId !== undefined
          ? `Step ${input.stepNumber} expansion names unknown parent ${shown(unknownParentId)}.`
          : `Step ${input.stepNumber} is missing required parent ${shown(missingParentId)}; expanded ` +
            `${evidence.parentsExpanded} of ${evidence.parentCandidates}.`,
    );
  }
  if (!atomic) {
    return refuse(
      "incomplete-atomic-step",
      "evidence",
      `Step ${input.stepNumber} child ${shown(atomicMismatch!.child.candidateId)} under parent ` +
        `${shown(atomicMismatch!.parentCandidateId)} has piece identities ` +
        `${JSON.stringify(atomicMismatch!.child.pieces.map(atomicPieceKey).sort())}; required exactly ` +
        `${JSON.stringify(input.expectedAtomicPieces.map(atomicPieceKey).sort())}.`,
    );
  }
  if (!nonempty) {
    const emptyParentId = input.expansions.find(
      ({ children }) => children.length === 0,
    )!.parentCandidateId;
    return refuse(
      "empty-parent-expansion",
      "evidence",
      `Step ${input.stepNumber} parent ${shown(emptyParentId)} offered 0 children; required at least 1 complete child.`,
    );
  }
  if (candidateIds.length > input.maximumCandidates) {
    return refuse(
      "aggregate-candidate-budget-exhausted",
      "budget",
      `Step ${input.stepNumber} produced ${candidateIds.length} complete children across all parents, above ` +
        `the aggregate ${input.maximumCandidates} candidate limit. No partial frontier was admitted.`,
    );
  }
  if (narrowingRenders > input.maximumNarrowingRenders) {
    return refuse(
      "aggregate-narrowing-budget-exhausted",
      "budget",
      `Step ${input.stepNumber} spent ${narrowingRenders} narrowing renders across all parents, above the ` +
        `aggregate ${input.maximumNarrowingRenders} limit. Applying that limit once per parent would silently ` +
        `multiply the run budget, so no frontier was admitted.`,
    );
  }
  return Object.freeze({
    frontier: Object.freeze({
      originStepNumber: input.frontier.originStepNumber,
      throughStepNumber: input.stepNumber,
      candidates: freezeArray(measuredCandidates),
    }),
    refusal: null,
    evidence,
  });
}

export function findFirstRevealingPanel<D>(
  unsafeInput: FirstRevealingPanelInput<D>,
): FirstRevealingPanelResult {
  const parsed = parseFirstRevealingPanelInput<D>(unsafeInput);
  if (parsed.value === null) {
    return Object.freeze({
      decision: null,
      refusal: Object.freeze({
        code: "farther-input-invalid",
        stage: "input",
        stepNumber: 0,
        message: `Farther-panel input refused: ${parsed.error}.`,
      }),
      evidence: Object.freeze({
        origin: null,
        panels: freezeArray([]),
        panelRenders: 0,
        maximumPanelRenders: 0,
        maximumReachSteps: 0,
      }),
    });
  }
  const input = parsed.value;
  const evidencePanels: FartherPanelEvidence[] = [];
  let panelRenders = 0;
  const evidence = () =>
    Object.freeze({
      origin: Object.freeze({ ...input.originEvidence }),
      panels: freezeArray(evidencePanels),
      panelRenders,
      maximumPanelRenders: input.maximumPanelRenders,
      maximumReachSteps: input.maximumReachSteps,
    });
  const refuse = (
    code: FartherRefusalCode,
    stage: FartherRefusal["stage"],
    stepNumber: number,
    message: string,
  ): FirstRevealingPanelResult =>
    Object.freeze({
      decision: null,
      refusal: Object.freeze({ code, stage, stepNumber, message }),
      evidence: evidence(),
    });
  const ordered = [...input.panels];
  const frontierIds = input.frontier.candidates.map(({ candidateId }) => candidateId);
  const originIds = [
    ...new Set(input.frontier.candidates.map(({ originCandidateId }) => originCandidateId)),
  ];
  const inputError = describePanelInputError(input, ordered, frontierIds, originIds);
  if (inputError !== null) {
    return refuse(
      "farther-input-invalid",
      "input",
      input.frontier.originStepNumber,
      `Farther-panel input refused: ${inputError}.`,
    );
  }

  for (const panel of ordered) {
    const reachSteps = panel.stepNumber - input.frontier.originStepNumber;
    if (reachSteps > input.maximumReachSteps) {
      return refuse(
        "farther-panel-limit-reached",
        "budget",
        panel.stepNumber,
        `Step ${input.frontier.originStepNumber} reached its ${input.maximumReachSteps}-step farther-panel ` +
          `limit before panel ${panel.stepNumber}; no candidate was selected.`,
      );
    }
    if (panel.status === "not-observable") {
      evidencePanels.push(
        Object.freeze({
          stepNumber: panel.stepNumber,
          reachSteps,
          status: "not-observable",
          reason: panel.reason,
          scores: freezeArray([]),
          bestAgreement: null,
          familyMargin: null,
          descendantMargin: null,
        }),
      );
      continue;
    }
    const expectedIds = panel.subject === "origin" ? originIds : frontierIds;
    const observedIds = panel.scores.map(({ candidateId }) => candidateId);
    const invalidScore = panel.scores.findIndex(
      ({ agreement }) => !Number.isFinite(agreement) || agreement < 0 || agreement > 1,
    );
    if (invalidScore >= 0) {
      return refuse(
        "incomplete-panel-evidence",
        "evidence",
        panel.stepNumber,
        `Panel ${panel.stepNumber} scores[${invalidScore}].agreement is ` +
          `${shown(panel.scores[invalidScore]!.agreement)}; required a finite value in [0, 1].`,
      );
    }
    const duplicateObservedId = firstDuplicate(observedIds);
    const missingIds = expectedIds.filter((id) => !observedIds.includes(id));
    const unexpectedIds = observedIds.filter((id) => !expectedIds.includes(id));
    if (duplicateObservedId !== undefined || missingIds.length > 0 || unexpectedIds.length > 0) {
      return refuse(
        "incomplete-panel-evidence",
        "evidence",
        panel.stepNumber,
        duplicateObservedId !== undefined
          ? `Panel ${panel.stepNumber} candidateId ${shown(duplicateObservedId)} is duplicated; required one score per ${panel.subject} candidate.`
          : `Panel ${panel.stepNumber} ${panel.subject} scores are missing ${JSON.stringify(missingIds)} ` +
              `and unexpectedly include ${JSON.stringify(unexpectedIds)}; required exactly ${JSON.stringify(expectedIds)}.`,
      );
    }
    if (panelRenders + panel.scores.length > input.maximumPanelRenders) {
      return refuse(
        "panel-render-budget-exhausted",
        "budget",
        panel.stepNumber,
        `Panel ${panel.stepNumber} would raise farther-panel renders from ${panelRenders} to ` +
          `${panelRenders + panel.scores.length}, above the aggregate ${input.maximumPanelRenders} limit.`,
      );
    }
    panelRenders += panel.scores.length;
    const scoreById = new Map(panel.scores.map((score) => [score.candidateId, score.agreement]));
    const familyScores = originIds
      .map((originCandidateId) => ({
        originCandidateId,
        agreement:
          panel.subject === "origin"
            ? scoreById.get(originCandidateId)!
            : Math.max(
                ...input.frontier.candidates
                  .filter((candidate) => candidate.originCandidateId === originCandidateId)
                  .map((candidate) => scoreById.get(candidate.candidateId)!),
              ),
      }))
      .sort((left, right) => right.agreement - left.agreement);
    const winner = familyScores[0]!;
    const familyMargin = winner.agreement - familyScores[1]!.agreement;
    const winnerLeaves = input.frontier.candidates.filter(
      ({ originCandidateId }) => originCandidateId === winner.originCandidateId,
    );
    const winnerLeafScores =
      panel.subject === "frontier"
        ? winnerLeaves
            .map((candidate) => ({
              candidateId: candidate.candidateId,
              agreement: scoreById.get(candidate.candidateId)!,
            }))
            .sort((left, right) => right.agreement - left.agreement)
        : [];
    const descendantMargin =
      winnerLeafScores.length > 1
        ? winnerLeafScores[0]!.agreement - winnerLeafScores[1]!.agreement
        : null;
    const revealing =
      winner.agreement >= input.minimumAgreement && familyMargin > input.minimumMargin;
    evidencePanels.push(
      Object.freeze({
        stepNumber: panel.stepNumber,
        reachSteps,
        status: revealing ? "revealing" : "unrevealing",
        reason: revealing
          ? null
          : winner.agreement < input.minimumAgreement
            ? "weak-agreement"
            : "ambiguous-family",
        scores: freezeArray(panel.scores.map((score) => Object.freeze({ ...score }))),
        bestAgreement: winner.agreement,
        familyMargin,
        descendantMargin,
      }),
    );
    if (!revealing) continue;
    const survivingCandidateIds =
      panel.subject === "frontier"
        ? winnerLeafScores
            .filter(({ agreement }) => winner.agreement - agreement <= input.minimumMargin)
            .map(({ candidateId }) => candidateId)
        : winnerLeaves.map(({ candidateId }) => candidateId);
    const survivorSet = new Set(survivingCandidateIds);
    return Object.freeze({
      decision: Object.freeze({
        originCandidateId: winner.originCandidateId,
        revealingStepNumber: panel.stepNumber,
        survivingCandidateIds: freezeArray(survivingCandidateIds),
        rejectedCandidateIds: freezeArray(frontierIds.filter((id) => !survivorSet.has(id))),
        descendantSettled: survivingCandidateIds.length === 1,
      }),
      refusal: null,
      evidence: evidence(),
    });
  }

  const lastStep = ordered.at(-1)?.stepNumber ?? input.frontier.originStepNumber;
  return refuse(
    input.fartherPanelsAvailable ? "farther-panel-limit-reached" : "not-observable",
    input.fartherPanelsAvailable ? "budget" : "evidence",
    lastStep,
    input.fartherPanelsAvailable
      ? `Step ${input.frontier.originStepNumber} exhausted the requested farther-panel range while later ` +
          `panels still exist; no candidate was selected.`
      : `No requested panel through step ${lastStep} revealed step ${input.frontier.originStepNumber}; ` +
          `the result is not observable, not a guessed placement.`,
  );
}
