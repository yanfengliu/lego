import { expect } from "@playwright/test";

import type { RealBuildResult } from "./real-build-safety";

/**
 * Pins the retained private-booklet step 5/6 refusal without turning measured
 * transforms into an oracle for the deterministic search.
 */
export function expectMeasuredFartherBudgetRefusal(result: RealBuildResult): void {
  const origin = result.steps.find(({ stepNumber }) => stepNumber === 5)!;
  expect(origin.outcome.status).toBe("failed");
  expect(origin.farther?.refusal?.code).toBe("aggregate-narrowing-budget-exhausted");
  expect(origin.farther?.decision).toBeNull();
  expect(origin.farther?.origin.candidates).toHaveLength(2);
  expect(origin.farther?.carries).toHaveLength(1);
  expect(origin.farther?.carries[0]?.parentCandidates).toBe(2);
  expect(origin.farther?.carries[0]?.parentsExpanded).toBe(2);
  expect(origin.farther?.carries[0]?.perParent).toHaveLength(2);
  expect(origin.farther?.carries[0]?.perParent[0]).toMatchObject({
    offeredCandidates: 5,
    narrowingRenders: 2_628,
  });
  expect(origin.farther?.carries[0]?.perParent[1]).toMatchObject({
    offeredCandidates: 3,
    narrowingRenders: 5_409,
  });
  expect(origin.farther?.budgets.offeredCandidates).toBe(8);
  expect(origin.farther?.carries[0]?.measuredLineages).toHaveLength(8);
  expect(origin.farther?.budgets.maximumNarrowingRenders).toBe(8_192);
  expect(origin.farther?.budgets.narrowingRenders).toBe(8_037);
  expect(origin.farther?.budgets.failedNarrowingReservation).toEqual({
    reservedBefore: 8_037,
    requested: 572,
    budget: 8_192,
  });
  expect(origin.farther?.budgets.failedCandidateReservation).toBeNull();
  expect(origin.farther?.panels).toHaveLength(1);
  expect(origin.farther?.panels[0]?.stepNumber).toBe(6);
  expect(origin.farther?.panels[0]?.status).toBe("unrevealing");
  expect(origin.farther?.panels[0]?.scores).toHaveLength(2);
  expect(origin.fartherCaptures.filter(({ role }) => role === "source-panel")).toHaveLength(1);
  expect(origin.fartherCaptures.filter(({ role }) => role === "candidate-render")).toHaveLength(2);
  expect(origin.placedPieces).toBe(0);
  expect(origin.documentParts).toBe(6);
  expect(result.steps.reduce((total, step) => total + step.placedPieces, 0)).toBe(6);
  expect(result.finalParts).toBe(0);
  expect(result.documentJson).toBeNull();
  for (const stepNumber of [5, 6, 7]) {
    expect(
      result.steps.find((step) => step.stepNumber === stepNumber)?.panelPng,
      `printed step ${stepNumber} must retain its inspectable source panel`,
    ).not.toBeNull();
  }
}
