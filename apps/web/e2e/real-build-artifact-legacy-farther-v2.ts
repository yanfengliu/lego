import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import {
  exactPinnedLegacyDirectK,
  frozenLegacyDecisionPieces,
  frozenLegacyFartherCaptures,
} from "./real-build-artifact-legacy-farther-v2-evidence";
import {
  parseLegacyFartherCarryV2,
  parseLegacyFartherPanelV2,
  type LegacyFartherPanelCandidate,
  type LegacyFartherParent,
  type LegacyValidatedPanel,
} from "./real-build-artifact-legacy-farther-v2-support";
import {
  coherentRefusal,
  failedReservation,
} from "./real-build-artifact-legacy-farther-v2-refusal";
import {
  LEGACY_DIGEST_PATTERN,
  legacyDenseArray,
  legacyExactAtomicPieces,
  legacyExactKeys,
  legacyFartherId,
  legacyNullableFinite,
  legacyRecord,
  legacySameJson,
  legacyTuple,
  legacyUnitInterval,
  legacyWitnesses,
} from "./real-build-artifact-legacy-browser-v2-values";

export function assertFrozenLegacyFartherV2(input: {
  readonly report: Record<string, unknown>;
  readonly panel: RealBuildPanelSpec;
  readonly options: RealBuildOptions;
}): void {
  const { report, panel, options } = input;
  const deferral = legacyRecord(report.deferral) ? report.deferral : null;
  if (report.farther === null) {
    const actionable =
      deferral !== null &&
      deferral.settled === false &&
      Number.isSafeInteger(deferral.wholeStepCandidates) &&
      Number.isSafeInteger(deferral.rendered) &&
      ((deferral.wholeStepCandidates as number) >= 2 ||
        (deferral.rendered as number) >= 2 ||
        (legacyUnitInterval(deferral.bestAgreement) &&
          legacyUnitInterval(deferral.runnerUpAgreement))) &&
      deferral.lookaheadStepNumber === (report.stepNumber as number) + 1 &&
      options.panels.some(({ stepNumber }) => stepNumber === deferral.lookaheadStepNumber) &&
      options.fartherPanelMaximumReachSteps >= 2;
    if (actionable || !frozenLegacyFartherCaptures(report.fartherCaptures, null)) {
      throw new TypeError(
        "Legacy browser-output /2 omitted an actionable farther proof or retained orphan captures.",
      );
    }
    return;
  }
  const value = report.farther;
  if (
    !legacyRecord(value) ||
    deferral === null ||
    !legacyExactKeys(value, ["origin", "carries", "panels", "budgets", "refusal", "decision"]) ||
    !legacyRecord(value.origin) ||
    !legacyExactKeys(value.origin, ["evidence", "candidates"]) ||
    !legacyRecord(value.origin.evidence) ||
    !legacyExactKeys(value.origin.evidence, ["stepNumber", "status", "margin", "minimumMargin"]) ||
    value.origin.evidence.stepNumber !== report.stepNumber ||
    !["no-local-signal", "unseparated"].includes(String(value.origin.evidence.status)) ||
    !legacyNullableFinite(value.origin.evidence.margin) ||
    !legacyNullableFinite(value.origin.evidence.minimumMargin) ||
    !legacyDenseArray(value.origin.candidates, options.deferredCandidateBudget) ||
    value.origin.candidates.length < 2 ||
    !legacyDenseArray(value.carries, options.fartherPanelMaximumReachSteps) ||
    !legacyDenseArray(value.panels, options.fartherPanelMaximumReachSteps) ||
    !legacyRecord(value.budgets)
  ) {
    throw new TypeError("Legacy browser-output /2 farther proof violates its frozen root schema.");
  }
  const outcome = legacyRecord(report.outcome) ? report.outcome : null;
  const completedDecision =
    outcome?.status === "complete" &&
    outcome.mechanism === "deferred-lookahead" &&
    value.decision !== null &&
    value.refusal === null;
  const failedRefusal =
    outcome?.status === "failed" && value.decision === null && value.refusal !== null;
  if (!completedDecision && !failedRefusal) {
    throw new TypeError(
      "Legacy browser-output /2 farther proof must retain its selected decision for a completed " +
        "deferred-lookahead outcome, or its refusal for a failed outcome.",
    );
  }
  const expectedStatus = deferral.trigger === "no-local-signal" ? "no-local-signal" : "unseparated";
  const origins = value.origin.candidates as readonly Record<string, unknown>[];
  const originIds = new Set<string>();
  for (const origin of origins) {
    const pieces = legacyRecord(origin) ? origin.pieces : undefined;
    if (
      !legacyRecord(origin) ||
      !legacyExactKeys(origin, [
        "candidateId",
        "documentHash",
        "pieces",
        "lookaheadAgreement",
        "lookaheadShiftPx",
      ]) ||
      !legacyFartherId(origin.candidateId) ||
      originIds.has(origin.candidateId) ||
      typeof origin.documentHash !== "string" ||
      !LEGACY_DIGEST_PATTERN.test(origin.documentHash) ||
      !legacyWitnesses(pieces, options.maxParts) ||
      pieces.length !== report.expectedAssembledPieces ||
      !legacyUnitInterval(origin.lookaheadAgreement) ||
      !legacyTuple(origin.lookaheadShiftPx, 2) ||
      origin.lookaheadShiftPx.some((coordinate) => Math.abs(coordinate) > 1_000_000)
    ) {
      throw new TypeError(
        "Legacy browser-output /2 farther origin candidate is malformed or duplicated.",
      );
    }
    originIds.add(origin.candidateId);
  }
  const preparedPieces =
    panel.action.kind === "place-callouts"
      ? panel.pieces.map(({ catalogPartId, colorId }) => ({ catalogPartId, colorId }))
      : [];
  const agreements = origins
    .map(({ lookaheadAgreement }) => lookaheadAgreement as number)
    .sort((a, b) => b - a);
  if (
    value.origin.evidence.status !== expectedStatus ||
    value.origin.evidence.margin !== deferral.ownPanelMargin ||
    value.origin.evidence.minimumMargin !== deferral.ownPanelMinimumMargin ||
    origins.length !== deferral.wholeStepCandidates ||
    deferral.settled !== false ||
    origins.some(
      ({ pieces }) => !legacyExactAtomicPieces(pieces as readonly unknown[], preparedPieces),
    ) ||
    deferral.bestAgreement !== (agreements[0] ?? null) ||
    deferral.runnerUpAgreement !== (agreements[1] ?? null) ||
    deferral.margin !== (agreements.length < 2 ? null : agreements[0]! - agreements[1]!)
  ) {
    throw new TypeError("Legacy browser-output /2 deferral and farther origin are incoherent.");
  }
  let parents = new Map<string, LegacyFartherParent>(
    origins.map((origin) => [
      origin.candidateId as string,
      {
        candidateId: origin.candidateId as string,
        originCandidateId: origin.candidateId as string,
        lineage: [
          {
            stepNumber: report.stepNumber,
            documentHash: origin.documentHash,
            pieces: origin.pieces,
          },
        ],
      },
    ]),
  );
  const carries = value.carries as readonly Record<string, unknown>[];
  const allowPrefix =
    value.decision === null &&
    legacyRecord(value.refusal) &&
    [
      "incomplete-parent-expansion",
      "aggregate-candidate-budget-exhausted",
      "aggregate-narrowing-budget-exhausted",
    ].includes(String(value.refusal.code));
  for (let index = 0; index < carries.length; index += 1) {
    const next = parseLegacyFartherCarryV2({
      value: carries[index],
      index,
      originStep: report.stepNumber as number,
      options,
      parents,
      allowParentPrefix: allowPrefix,
    });
    const carry = carries[index]!;
    const prepared = options.panels.find(({ stepNumber }) => stepNumber === carry.stepNumber);
    const atomic =
      prepared?.action.kind === "place-callouts"
        ? prepared.pieces.map(({ catalogPartId, colorId }) => ({ catalogPartId, colorId }))
        : null;
    if (
      next === null ||
      atomic === null ||
      !legacyExactAtomicPieces(carry.expectedAtomicPieces as readonly unknown[], atomic) ||
      (carry.parentsExpanded !== carry.parentCandidates &&
        (!allowPrefix || index !== carries.length - 1))
    ) {
      throw new TypeError(
        "Legacy browser-output /2 farther carry violates its frozen lineage proof.",
      );
    }
    parents = new Map(next);
  }
  const finalCandidates: LegacyFartherPanelCandidate[] =
    carries.length === 0
      ? origins.map(({ candidateId }) => ({
          candidateId: candidateId as string,
          originCandidateId: candidateId as string,
        }))
      : [...parents.values()].map(({ candidateId, originCandidateId }) => ({
          candidateId,
          originCandidateId,
        }));
  const panels = value.panels as readonly Record<string, unknown>[];
  const validated: LegacyValidatedPanel[] = [];
  for (let index = 0; index < panels.length; index += 1) {
    const parsed = parseLegacyFartherPanelV2({
      value: panels[index],
      index,
      originStep: report.stepNumber as number,
      originCandidates: origins,
      finalCandidates,
      options,
    });
    if (parsed === null)
      throw new TypeError("Legacy browser-output /2 farther panel score proof is incoherent.");
    validated.push(parsed);
  }
  const budgets = value.budgets;
  const offered = carries.reduce((sum, carry) => sum + (carry.offeredCandidates as number), 0);
  const narrowing = carries.reduce((sum, carry) => sum + (carry.narrowingRenders as number), 0);
  const panelRenders = panels.reduce(
    (sum, candidatePanel) => sum + (candidatePanel.scores as readonly unknown[]).length,
    0,
  );
  const reach = Math.max(
    0,
    ...carries.map(({ stepNumber }) => (stepNumber as number) - (report.stepNumber as number)),
    ...panels.map(({ reachSteps }) => reachSteps as number),
  );
  if (
    !legacyExactKeys(budgets, [
      "offeredCandidates",
      "maximumCandidates",
      "narrowingRenders",
      "maximumNarrowingRenders",
      "panelRenders",
      "maximumPanelRenders",
      "reachSteps",
      "maximumReachSteps",
      "refusedReservation",
      "failedNarrowingReservation",
      "candidateRefusedReservation",
      "failedCandidateReservation",
    ]) ||
    budgets.offeredCandidates !== offered ||
    budgets.maximumCandidates !== options.deferredCandidateBudget ||
    budgets.narrowingRenders !== narrowing ||
    budgets.maximumNarrowingRenders !== options.deferredNarrowingRenderBudget ||
    budgets.panelRenders !== panelRenders ||
    budgets.maximumPanelRenders !== options.fartherPanelRenderBudget ||
    budgets.reachSteps !== reach ||
    budgets.maximumReachSteps !== options.fartherPanelMaximumReachSteps ||
    typeof budgets.refusedReservation !== "boolean" ||
    typeof budgets.candidateRefusedReservation !== "boolean" ||
    !(
      budgets.failedNarrowingReservation === null ||
      failedReservation(
        budgets.failedNarrowingReservation,
        budgets.narrowingRenders,
        budgets.maximumNarrowingRenders,
        false,
      )
    ) ||
    !(
      budgets.failedCandidateReservation === null ||
      failedReservation(
        budgets.failedCandidateReservation,
        budgets.offeredCandidates,
        budgets.maximumCandidates,
        true,
      )
    ) ||
    (value.refusal === null) === (value.decision === null)
  ) {
    throw new TypeError("Legacy browser-output /2 farther budget ledger is incoherent.");
  }
  if (
    value.refusal !== null &&
    !coherentRefusal({
      refusal: value.refusal,
      originStep: report.stepNumber as number,
      carries,
      panels,
      statuses: validated.map(({ status }) => status),
      budgets,
      maximumReach: options.fartherPanelMaximumReachSteps,
      originCount: origins.length,
      finalCount: finalCandidates.length,
    })
  ) {
    throw new TypeError("Legacy browser-output /2 farther refusal is not proved by its ledger.");
  }
  if (value.decision !== null) {
    const decision = value.decision;
    if (
      !legacyRecord(decision) ||
      !legacyExactKeys(decision, [
        "originCandidateId",
        "revealingStepNumber",
        "survivingCandidateIds",
        "rejectedCandidateIds",
        "descendantSettled",
      ])
    ) {
      throw new TypeError("Legacy browser-output /2 farther decision schema is malformed.");
    }
    const first = validated.find(({ status }) => status === "revealing");
    const decisionPanel = validated.find(
      ({ stepNumber }) => stepNumber === decision.revealingStepNumber,
    );
    if (
      first === undefined ||
      first !== decisionPanel ||
      validated.at(-1) !== decisionPanel ||
      decision.originCandidateId !== decisionPanel.winningOriginCandidateId ||
      !legacySameJson(decision.survivingCandidateIds, decisionPanel.survivingCandidateIds) ||
      !legacySameJson(decision.rejectedCandidateIds, decisionPanel.rejectedCandidateIds) ||
      decision.descendantSettled !== (decisionPanel.survivingCandidateIds.length === 1)
    ) {
      throw new TypeError(
        "Legacy browser-output /2 farther decision does not reproduce its first revealing panel.",
      );
    }
  }
  if (
    !exactPinnedLegacyDirectK({
      originStep: report.stepNumber as number,
      origins,
      panels,
      decision: value.decision,
      options,
    }) ||
    !frozenLegacyDecisionPieces(value, report, panel) ||
    !frozenLegacyFartherCaptures(report.fartherCaptures, value)
  ) {
    throw new TypeError(
      "Legacy browser-output /2 farther direct-K, selected pieces, or captures differ.",
    );
  }
}
