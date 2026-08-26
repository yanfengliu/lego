import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { resolveCoverageCallout } from "../e2e/real-build-coverage";
import {
  TRUSTED_IDENTIFICATION_CONFIDENCES,
  isTrustedIdentificationConfidence,
  requireTrustedIdentificationConfidence,
} from "../e2e/real-build-identification-trust";
import {
  pieceEvidenceDigest,
  validateRealBuildActionLedger,
  type LedgerPieceIdentity,
  type RealBuildActionLedger,
} from "../e2e/real-build-ledger";
import { realBuildLedgerTestFixture } from "./real-build-ledger-test-fixture";

/**
 * The trust boundary blind pair judging crosses.
 *
 * `pair-judged-same` is trusted at both gates and `pair-judged-different` is
 * refused at both, and the ledger may not relabel one as the other. If any of
 * these three reverts, a judged mismatch stops costing anything and a judged
 * agreement stops being distinguishable from a model agreeing with itself.
 */

const identity = "p11|q1|x43.074|y486.271";
const crop = `sha256:${"a".repeat(64)}`;
const inputDigest = `sha256:${"b".repeat(64)}`;
const coverageClaim = {
  identity,
  pageNumber: 11,
  stepNumber: 1,
  quantity: 1,
  cropDigest: crop,
  inputDigest,
};
const resolve = (identificationConfidence: string) =>
  resolveCoverageCallout(
    { [identity]: { ...coverageClaim, identificationConfidence } },
    {
      identity,
      pageNumber: 11,
      quantity: 1,
      cropDigest: crop,
      identificationInputDigest: inputDigest,
    },
  );

describe("identification confidences a placement may be built on", () => {
  it("names both trust sources and keeps them distinguishable", () => {
    expect([...TRUSTED_IDENTIFICATION_CONFIDENCES]).toEqual(["vision-kept", "pair-judged-same"]);
    expect(isTrustedIdentificationConfidence("pair-judged-different")).toBe(false);
    expect(isTrustedIdentificationConfidence("geometry")).toBe(false);
  });

  it("resolves a pair-judged callout and refuses a judged mismatch", () => {
    expect(resolve("pair-judged-same").failure).toBeNull();
    expect(resolve("pair-judged-same").claim).not.toBeNull();
    expect(resolve("vision-kept").failure).toBeNull();

    for (const refused of [
      "pair-judged-different",
      "self-contradicted",
      "refused",
      "description-unverifiable",
      "vision-overruled",
      "geometry",
      "unanswered",
      // A card that displayed both hands of a mirror pair cannot be separated by
      // kind, stud size and colour, so a pick there is not built on until the
      // answer names the mirror candidate. Four picks in the last full run were
      // stamped trusted by a check that provably could not discriminate.
      "handedness-unverified",
      // The call declaring that the query differs from the candidate it named is
      // the call saying that candidate is not the query. It proposes nothing to
      // build on, and the reason travels in the label rather than being
      // flattened into a bare refusal.
      "differs-mirrored",
      "differs-size",
      "differs-colour",
      "differs-detail",
      "differs-other",
    ]) {
      expect(resolve(refused).failure).toMatchObject({
        code: "untrusted-identification",
        inputKey: identity,
      });
      expect(resolve(refused).failure?.message).toContain(JSON.stringify(refused));
    }
  });

  it("refuses to carry an untrusted confidence into a generated record", () => {
    expect(requireTrustedIdentificationConfidence("pair-judged-same", identity)).toBe(
      "pair-judged-same",
    );
    expect(() => requireTrustedIdentificationConfidence("pair-judged-different", identity)).toThrow(
      /may only carry the confidence its coverage claim published/u,
    );
  });
});

describe("action ledger validation across both trust sources", () => {
  /** Restates the fixture's one direct piece under a different identification confidence. */
  function withDirectConfidence(
    ledgerConfidence: LedgerPieceIdentity["identificationConfidence"],
    coverageConfidence: string,
  ) {
    const fixture = realBuildLedgerTestFixture();
    const step = fixture.ledger.steps[0]!;
    if (step.action.kind !== "place-callouts") throw new TypeError("fixture step 1 changed shape");
    const piece = step.action.pieces[0]!;
    const base: Omit<LedgerPieceIdentity, "evidenceDigest"> & { evidenceDigest?: string } = {
      ...piece,
    };
    delete base.evidenceDigest;
    const restated: Omit<LedgerPieceIdentity, "evidenceDigest"> = {
      ...base,
      identificationConfidence: ledgerConfidence,
    };
    const ledger: RealBuildActionLedger = {
      ...fixture.ledger,
      steps: fixture.ledger.steps.map((entry) =>
        entry.stepNumber === step.stepNumber && entry.action.kind === "place-callouts"
          ? {
              ...entry,
              action: {
                ...entry.action,
                pieces: [
                  {
                    ...restated,
                    evidenceDigest: pieceEvidenceDigest({
                      pdfDigest: fixture.pdfDigest,
                      panelEvidenceDigest: entry.panelEvidenceDigest,
                      officialModelDigest: fixture.official.digest,
                      coverageDigest: fixture.coverageDigest,
                      calloutManifestDigest: fixture.manifestDigest,
                      builderCalibrationDigest: fixture.builderCalibrationDigest,
                      stepNumber: entry.stepNumber,
                      pageNumber: entry.pageNumber,
                      piece: restated,
                    }),
                  },
                ],
              },
            }
          : entry,
      ),
    };
    return validateRealBuildActionLedger({
      ledger,
      ledgerDigest: sha256Digest(JSON.stringify(ledger)),
      requestedLastStep: 359,
      lastStep: 359,
      official: fixture.official,
      pdfDigest: fixture.pdfDigest,
      coverageDigest: fixture.coverageDigest,
      calloutManifestDigest: fixture.manifestDigest,
      builderCalibrationDigest: fixture.builderCalibrationDigest,
      transitionClassificationsDigest: fixture.transitionClassificationsDigest,
      coverageByCallout: Object.fromEntries(
        Object.entries(fixture.coverageByCallout).map(([key, claim]) => [
          key,
          key === piece.calloutKey
            ? { ...claim, identificationConfidence: coverageConfidence }
            : claim,
        ]),
      ),
      panelEvidenceByStep: fixture.panelEvidenceByStep,
      transitionClassificationsByStep: fixture.transitionClassificationsByStep,
    });
  }

  it("accepts a direct piece established by blind pair judging", () => {
    expect(withDirectConfidence("vision-kept", "vision-kept")).toEqual([]);
    expect(withDirectConfidence("pair-judged-same", "pair-judged-same")).toEqual([]);
  });

  it("refuses a direct piece whose callout was judged to be a different part", () => {
    const failures = withDirectConfidence(
      "pair-judged-different" as LedgerPieceIdentity["identificationConfidence"],
      "pair-judged-different",
    );
    expect(failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "action-ledger-incomplete" })]),
    );
    expect(failures.map(({ message }) => message).join(" ")).toContain("pair-judged-different");
  });

  it("refuses a ledger that relabels a pair-judged identity as vision-kept", () => {
    expect(withDirectConfidence("vision-kept", "pair-judged-same")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("does not exactly match coverage claim"),
        }),
      ]),
    );
  });
});
