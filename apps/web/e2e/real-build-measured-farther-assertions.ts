import { expect } from "@playwright/test";

import type { RealBuildResult } from "./real-build-safety";

const MEASURED_PARENT_0 =
  "step-005:sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8";
const MEASURED_PARENT_1 =
  "step-005:sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93";
const MEASURED_PARENT_1_PIECES = [
  {
    catalogPartId: "builtin:plate-2x4",
    colorId: "builtin:green",
    transform: { positionLdu: [60, 8, 0], orientationId: "upright-yaw-270" },
  },
  {
    catalogPartId: "builtin:plate-2x14",
    colorId: "builtin:black",
    transform: { positionLdu: [160, 8, 100], orientationId: "upright-yaw-270" },
  },
] as const;
const MEASURED_STEP_4_HASH =
  "sha256:0d5ff1160553a0001fbc19afae7e2e0f2c70f0e225c82288bbbe52e1621c93a9";

/**
 * Pins the calibrated private-booklet step-5 direct-origin decision without
 * turning either measured candidate transform into a search oracle.
 */
export function expectMeasuredFartherOriginDecision(result: RealBuildResult): void {
  const origin = result.steps.find(({ stepNumber }) => stepNumber === 5)!;
  expect(origin.outcome.status).toBe("complete");
  expect(origin.validation.targetDocumentHash).toBe(MEASURED_PARENT_1.slice("step-005:".length));
  expect(origin.farther?.refusal).toBeNull();
  expect(origin.farther?.origin.candidates).toHaveLength(2);
  expect(origin.farther?.origin.candidates.map(({ candidateId }) => candidateId)).toEqual([
    MEASURED_PARENT_0,
    MEASURED_PARENT_1,
  ]);
  expect(origin.farther?.carries).toEqual([]);
  expect(origin.farther?.budgets.offeredCandidates).toBe(0);
  expect(origin.farther?.budgets.narrowingRenders).toBe(0);
  expect(origin.farther?.budgets.maximumNarrowingRenders).toBe(8_192);
  expect(origin.farther?.budgets.panelRenders).toBe(4);
  expect(origin.farther?.budgets.reachSteps).toBe(2);
  expect(origin.farther?.budgets.failedNarrowingReservation).toBeNull();
  expect(origin.farther?.budgets.failedCandidateReservation).toBeNull();
  expect(origin.farther?.panels).toHaveLength(2);
  expect(origin.farther?.panels[0]?.stepNumber).toBe(6);
  expect(origin.farther?.panels[0]?.status).toBe("unrevealing");
  expect(origin.farther?.panels[0]?.scores).toHaveLength(2);
  expect(origin.farther?.panels[1]).toMatchObject({
    stepNumber: 7,
    status: "revealing",
    bestAgreement: 0.9367520589707421,
  });
  expect(origin.farther?.panels[1]?.familyMargin).toBeCloseTo(0.1201798210104021, 15);
  expect(origin.farther?.panels[1]?.scores).toEqual([
    { candidateId: MEASURED_PARENT_0, agreement: 0.81657223796034 },
    { candidateId: MEASURED_PARENT_1, agreement: 0.9367520589707421 },
  ]);
  expect(origin.farther?.decision).toEqual({
    originCandidateId: MEASURED_PARENT_1,
    revealingStepNumber: 7,
    survivingCandidateIds: [MEASURED_PARENT_1],
    rejectedCandidateIds: [MEASURED_PARENT_0],
    descendantSettled: true,
  });
  expect(
    origin.farther?.origin.candidates.find(({ candidateId }) => candidateId === MEASURED_PARENT_1)
      ?.pieces,
  ).toEqual(MEASURED_PARENT_1_PIECES);
  expect(origin.fartherCaptures.filter(({ role }) => role === "source-panel")).toHaveLength(2);
  expect(origin.fartherCaptures.filter(({ role }) => role === "candidate-render")).toHaveLength(4);
  expect(origin.placedPieces).toBe(2);
  expect(origin.documentParts).toBe(8);
  expect(origin.pieces).toHaveLength(2);
  expect(
    origin.pieces.map(({ catalogPartId, positionLdu, orientationId, blind }) => ({
      catalogPartId,
      positionLdu,
      orientationId,
      comparisonPrefixHash: blind.comparisonPrefixHash,
    })),
  ).toEqual(
    MEASURED_PARENT_1_PIECES.map(({ catalogPartId, transform }) => ({
      catalogPartId,
      positionLdu: transform.positionLdu,
      orientationId: transform.orientationId,
      comparisonPrefixHash: MEASURED_STEP_4_HASH,
    })),
  );
  expect(
    origin.pieces.every(
      ({ placed, positionLdu, orientationId, failure }) =>
        placed && positionLdu !== null && orientationId !== null && failure === null,
    ),
  ).toBe(true);
  expect(result.finalParts).toBe(0);
  expect(result.structuralHash).toBeNull();
  expect(result.documentJson).toBeNull();
  expect(result.diagnosticPrefix).toMatchObject({
    schemaVersion: "lego.real-build-diagnostic-prefix/1",
    throughStepNumber: 5,
    targetEquivalence: "unreconciled",
    structuralHash: MEASURED_PARENT_1.slice("step-005:".length),
    parts: 8,
  });
  expect(result.diagnosticPrefix?.documentJson).not.toBeNull();
  // Node has proved that the selected immutable candidate survived its exact
  // structural, identity and ownership audits. It remains diagnostic: the
  // measured placement is a mirror of the official target, not a proper world
  // rotation, so the canonical completion tuple must stay empty.
  expect(
    result.completionFailures.filter(({ code }) => code === "official-frame-calibration-missing"),
  ).toHaveLength(1);
  expect(
    result.completionFailures.filter(
      ({ code, stepNumber }) =>
        stepNumber !== undefined &&
        stepNumber <= 5 &&
        code !== "visual-evidence-unverified" &&
        code !== "official-frame-calibration-missing",
    ),
  ).toEqual([]);
  for (const stepNumber of [5, 6, 7]) {
    expect(
      result.steps.find((step) => step.stepNumber === stepNumber)?.panelPng,
      `printed step ${stepNumber} must retain its inspectable source panel`,
    ).not.toBeNull();
  }
}
