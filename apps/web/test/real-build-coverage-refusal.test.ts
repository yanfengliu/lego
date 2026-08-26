import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { describeUnboundCoverageRefusal } from "../e2e/real-build-coverage-refusal";
import { validateRealBuildActionLedger } from "../e2e/real-build-ledger";
import type { StepFailure } from "../e2e/real-build-safety";
import { realBuildLedgerTestFixture } from "./real-build-ledger-test-fixture";

/**
 * A run whose catalog-coverage closure did not bind used to substitute an empty
 * index and then let every coverage-derived check describe the substitute. One
 * unbound input role printed as 68 further failures, each of them a false claim
 * about the artifact on disk. These pin the distinction the fix rests on: an
 * empty index is a bound index that is empty, and `null` is no index at all.
 */
describe("unbound catalog coverage", () => {
  const validate = (
    coverageByCallout: Parameters<typeof validateRealBuildActionLedger>[0]["coverageByCallout"],
  ) => {
    const fixture = realBuildLedgerTestFixture();
    return validateRealBuildActionLedger({
      ledger: fixture.ledger,
      ledgerDigest: sha256Digest(JSON.stringify(fixture.ledger)),
      requestedLastStep: 50,
      lastStep: 50,
      official: fixture.official,
      pdfDigest: fixture.pdfDigest,
      coverageDigest: fixture.coverageDigest,
      calloutManifestDigest: fixture.manifestDigest,
      sourceArtReboundDigest: fixture.sourceArtReboundDigest,
      builderCalibrationDigest: fixture.builderCalibrationDigest,
      transitionClassificationsDigest: fixture.transitionClassificationsDigest,
      coverageByCallout,
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
    });
  };

  it("keeps failing a bound but empty index, and evaluates nothing against no index", () => {
    const fixture = realBuildLedgerTestFixture();
    expect(validate(fixture.coverageByCallout)).toEqual([]);
    // A bound index that is empty really does disagree with the ledger.
    const emptyIndexFailures = validate({});
    expect(emptyIndexFailures).toEqual([
      {
        code: "action-ledger-incomplete",
        stage: "input",
        stepNumber: 1,
        message:
          "Bound coverage contains zero retained callouts for printed step 1, so the ledger must " +
          "retain its reproduced transition action and classification instead of place-callouts.",
      },
      {
        code: "action-ledger-incomplete",
        stage: "input",
        stepNumber: 2,
        message:
          "Bound coverage contains zero retained callouts for printed step 2, so the ledger must " +
          "retain its reproduced transition action and classification instead of multi-build-copy.",
      },
    ]);
    // No index at all is not a disagreement: there is nothing to disagree with.
    expect(validate(null)).toEqual([]);
  });

  it("names its own cause and reads its ceiling out of the checks that never touch coverage", () => {
    const otherFailures: StepFailure[] = [
      {
        code: "official-frame-calibration-missing",
        stage: "input",
        stepNumber: 7,
        message: "Design revision 3020;L has no code-pinned Builder frame.",
      },
      {
        code: "official-frame-calibration-missing",
        stage: "input",
        stepNumber: 5,
        message: "Design revision 3020;L has no code-pinned Builder frame.",
      },
    ];
    const refusal = describeUnboundCoverageRefusal({
      rejection:
        "identification-answers binding failed: schemaVersion observed /3 but required /4.",
      coveragePath: "output/real-build/catalog-coverage.json",
      requestedLastStep: 8,
      requestedPanels: [
        { stepNumber: 1, mappedCalloutKeys: ["a", "b"] },
        { stepNumber: 2, mappedCalloutKeys: ["c"] },
      ],
      otherFailures,
    });
    expect(refusal.code).toBe("coverage-closure-unbound");
    expect(refusal.message).toContain("schemaVersion observed /3 but required /4");
    // Derived, not written down: two panels carrying three mapped keys.
    expect(refusal.message).toContain("2 requested printed steps and the 3 callout keys");
    // The lowest independently blocked step is 5, so the ceiling is 4 — not 8.
    expect(refusal.message).toContain("Ceiling once that role binds: printed step 4.");
    expect(refusal.message).toContain("official-frame-calibration-missing");
    expect(refusal.message).not.toContain("printed step 8.");
  });

  it("raises the ceiling to the whole prefix when nothing else names a step", () => {
    const refusal = describeUnboundCoverageRefusal({
      rejection: "closure rejected.",
      coveragePath: "coverage.json",
      requestedLastStep: 8,
      requestedPanels: [{ stepNumber: 1, mappedCalloutKeys: [] }],
      otherFailures: [{ code: "set-accounting-mismatch", stage: "input", message: "prefix." }],
    });
    expect(refusal.message).toContain("printed step 8, the whole requested prefix");
  });
});
