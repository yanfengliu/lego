import { describe, expect, it } from "vitest";

import {
  assembleRealBuildActionLedger,
  emittedRealBuildActionLedger,
  encodeRealBuildActionLedger,
  type RealBuildActionLedgerBindings,
} from "../e2e/real-build-action-ledger";
import type { CalloutResolution } from "../e2e/real-build-input-files";
import { realBuildLedgerTestFixture } from "./real-build-ledger-test-fixture";

function fixtureBindings(
  fixture: ReturnType<typeof realBuildLedgerTestFixture>,
): RealBuildActionLedgerBindings {
  return {
    pdfDigest: fixture.pdfDigest,
    coverageDigest: fixture.coverageDigest,
    calloutManifestDigest: fixture.manifestDigest,
    sourceArtReboundDigest: fixture.sourceArtReboundDigest,
    builderCalibrationDigest: fixture.builderCalibrationDigest,
    transitionClassificationsDigest: fixture.transitionClassificationsDigest,
  };
}

function fixtureCoverage(
  fixture: ReturnType<typeof realBuildLedgerTestFixture>,
): Readonly<Record<string, CalloutResolution>> {
  return Object.fromEntries(
    Object.entries(fixture.coverageByCallout).map(([key, claim]) => [
      key,
      {
        pageNumber: claim.pageNumber,
        stepNumber: claim.stepNumber ?? null,
        quantity: claim.quantity,
        elementId: claim.elementId ?? null,
        identificationConfidence: claim.identificationConfidence ?? null,
        cropDigest: claim.cropDigest ?? null,
        inputDigest: claim.inputDigest ?? null,
        resolution:
          claim.resolution === undefined || claim.resolution === null
            ? null
            : { ...claim.resolution, name: `Fixture ${claim.resolution.partNum}` },
      } satisfies CalloutResolution,
    ]),
  );
}

describe("bounded action-ledger prefix", () => {
  it("assembles only the requested prefix while retaining the 359-step source/index contract", () => {
    const fixture = realBuildLedgerTestFixture();
    const assembled = assembleRealBuildActionLedger({
      official: fixture.official,
      bindings: fixtureBindings(fixture),
      coverageByCallout: fixtureCoverage(fixture),
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      expectedPrintedSteps: 359,
      requestedLastStep: 1,
    });

    expect(assembled.expectedPrintedSteps).toBe(359);
    expect(assembled.requestedLastStep).toBe(1);
    expect(assembled.alignedThroughStep).toBe(1);
    expect(assembled.ledger.steps.map(({ stepNumber }) => stepNumber)).toEqual([1]);
    expect(
      assembled.ledger.steps.flatMap((step) =>
        step.action.kind === "place-callouts"
          ? step.action.pieces.map(({ brickRef }) => brickRef)
          : [],
      ),
    ).toEqual(["brick-a"]);
    expect(assembled.stopReason).toContain("requested printed step 1");
    expect(assembled.stopReason).toContain("359-step source/index contract");
    expect(assembled.stopReason).toContain(
      "printed steps 2..359 remain in that declared contract and were intentionally not assembled",
    );

    const emitted = emittedRealBuildActionLedger(assembled);
    expect(emitted.provenance).toMatchObject({
      expectedPrintedSteps: 359,
      requestedLastStep: 1,
      alignedThroughStep: 1,
    });
    expect(JSON.stringify(emitted)).not.toContain("brick-b");
  });

  it.each([
    { expectedPrintedSteps: 359, requestedLastStep: 0 },
    { expectedPrintedSteps: 359, requestedLastStep: 360 },
    { expectedPrintedSteps: 359, requestedLastStep: 1.5 },
    { expectedPrintedSteps: 360, requestedLastStep: 1 },
  ])(
    "refuses invalid assembly bounds $expectedPrintedSteps/$requestedLastStep",
    ({ expectedPrintedSteps, requestedLastStep }) => {
      const fixture = realBuildLedgerTestFixture();
      expect(() =>
        assembleRealBuildActionLedger({
          official: fixture.official,
          bindings: fixtureBindings(fixture),
          coverageByCallout: fixtureCoverage(fixture),
          panelEvidenceByStep: fixture.panelEvidenceByStep,
          transitionClassificationsByStep: fixture.transitionClassificationsByStep,
          expectedPrintedSteps,
          requestedLastStep,
        }),
      ).toThrow(/fixed 359-step source\/index|safe integer from 1 through/u);
    },
  );

  it("emits reproducible prefix bytes with refusals only as unauthenticated provenance", () => {
    const fixture = realBuildLedgerTestFixture();
    const coverage = fixtureCoverage(fixture);
    const direct = coverage["p1-c0.png"]!;
    const assembled = assembleRealBuildActionLedger({
      official: fixture.official,
      bindings: fixtureBindings(fixture),
      coverageByCallout: {
        ...coverage,
        "p1-c0.png": { ...direct, identificationConfidence: "refused" },
      },
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
      expectedPrintedSteps: 359,
      requestedLastStep: 1,
    });
    const emitted = emittedRealBuildActionLedger(assembled);
    expect(emitted.provenance.authenticated).toBe(false);
    expect(emitted.provenance.refusals).toHaveLength(1);
    expect(encodeRealBuildActionLedger(emitted).equals(encodeRealBuildActionLedger(emitted))).toBe(
      true,
    );
  });
});
