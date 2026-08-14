import { describe, expect, it } from "vitest";

import { __testOnly } from "./booklet-catalog-coverage.mjs";
import {
  artifact,
  build,
  closureFixture,
  digest,
  identificationArtifactsFor,
  pairJudgedArtifactFor,
} from "./booklet-catalog-coverage-test-fixture.mjs";
import { PART_TRUTH_SCHEMA, cropDigestKey } from "./part-identification-truth-key.mjs";
import { pairJudgedVerdictsByCalloutIndexFromParsedJson as pairJudgedVerdictsByCalloutIndex } from "./part-identification-pair-judged.mjs";

/**
 * Blind pair judging as a bound trust source.
 *
 * Two properties are worth more than the rest of this file put together, and
 * both have their own case below: a "different" verdict has to refuse rather
 * than merely fail to trust, and the verdicts have to stay digest-bound into the
 * report's own provenance. Either one silently reverting turns the label set
 * into something that can only ever add trust, which is the shape of every
 * self-certifying evidence source this repo has already paid to remove.
 */

/** The single synthetic callout, and the crop key a verdict about it carries. */
const LEAD_CROP = digest("crop-one");
const LEAD_CROP_KEY = cropDigestKey(LEAD_CROP);
const ELEMENT_ID = "300501";

const verdict = (same, overrides = {}) => ({
  n: 1,
  judgedCropSha256: LEAD_CROP_KEY,
  elementId: ELEMENT_ID,
  same,
  note: "synthetic",
  ...overrides,
});

function compile(verdicts, overrides = {}) {
  const fixture = closureFixture();
  return __testOnly.compileBookletCatalogCoverageClosure(
    { ...fixture, pairJudgedArtifact: pairJudgedArtifactFor(verdicts), ...overrides },
    fixture.manifestExpectation,
  );
}

const onlyClaim = (report) => Object.values(report.byCallout)[0];

describe("pair-judged identity as a coverage trust source", () => {
  it("emits its own confidence rather than masquerading as vision-kept", () => {
    const judged = onlyClaim(compile([verdict(true)]));
    const unjudged = onlyClaim(compile([]));

    expect(judged.identificationConfidence).toBe("pair-judged-same");
    expect(judged.resolution).not.toBeNull();
    // The label the vision pass would have published on its own, kept distinct
    // so a later reader can still tell which mechanism carried the identity.
    expect(unjudged.identificationConfidence).toBe("vision-kept");
  });

  it("refuses the identity when the verdict says the two drawings are different parts", () => {
    const report = compile([verdict(false)]);
    const claim = onlyClaim(report);

    expect(claim.identificationConfidence).toBe("pair-judged-different");
    expect(claim.resolution).toBeNull();
    expect(report.calloutsUnidentified).toBe(1);
    expect(report.coverage.piecesPlaceable).toBe(0);
    // Names what happened, which input caused it, and what would satisfy it.
    expect(claim.unidentifiedBecause).toContain(LEAD_CROP_KEY);
    expect(claim.unidentifiedBecause).toContain(`element ${ELEMENT_ID}`);
    expect(claim.unidentifiedBecause).toMatch(/re-asserting element 300501 cannot/u);
  });

  it("refuses even a claim the vision pass kept, because judging saw more than agreement", () => {
    const kept = onlyClaim(compile([]));
    const refused = onlyClaim(compile([verdict(false)]));

    expect(kept.identificationConfidence).toBe("vision-kept");
    expect(kept.resolution).not.toBeNull();
    expect(refused.resolution).toBeNull();
  });

  it("binds the judged bytes into the report's published provenance", () => {
    const bound = pairJudgedArtifactFor([verdict(true)]);
    const report = compile([verdict(true)]);

    expect(report.inputDigests.pairJudged).toBe(bound.digest);
    // A different verdict file is a different report, even when the outcome is
    // the same: the trust source is part of what produced these bytes.
    expect(compile([]).inputDigests.pairJudged).not.toBe(bound.digest);
  });

  it("refuses to publish a pair-judged confidence with no bound judged digest", () => {
    expect(() =>
      build({
        judgedVerdicts: new Map([
          [
            0,
            {
              verdict: "same",
              judgedCrop: LEAD_CROP_KEY,
              judgedElementId: ELEMENT_ID,
            },
          ],
        ]),
      }),
    ).toThrow(/no pairJudged digest/u);
  });

  it("refuses to compile coverage at all without the judged role", () => {
    const fixture = closureFixture();
    const { manifestExpectation, ...withJudged } = fixture;
    const withoutJudged = { ...withJudged, pairJudgedArtifact: null };

    expect(() =>
      __testOnly.compileBookletCatalogCoverageClosure(withoutJudged, manifestExpectation),
    ).toThrow(/part-identification-truth-first50\.json/u);
  });

  it("stops binding when the crop or the claim moves, instead of inheriting the verdict", () => {
    const otherCrop = onlyClaim(
      compile([verdict(true, { judgedCropSha256: digest("elsewhere") })]),
    );
    const otherElement = onlyClaim(compile([verdict(true, { elementId: "999999" })]));

    expect(otherCrop.identificationConfidence).toBe("vision-kept");
    expect(otherElement.identificationConfidence).toBe("vision-kept");
  });

  it("binds only byte-identical crops, even when full digests share a prefix", () => {
    const prefix = "a".repeat(16);
    const leadSha256 = `sha256:${prefix}${"1".repeat(48)}`;
    const nearSha256 = `sha256:${prefix}${"2".repeat(48)}`;
    const callout = (sha256) => ({
      evidenceKind: "part-art",
      stepNumber: 1,
      quantity: 1,
      file: `${sha256.slice(-1)}.png`,
      identity: sha256,
      sha256,
    });
    const claims = new Map([
      [0, { clusterIndex: 0, elementId: ELEMENT_ID }],
      [1, { clusterIndex: 0, elementId: ELEMENT_ID }],
    ]);
    const truth = {
      schemaVersion: PART_TRUTH_SCHEMA,
      lastStep: 1,
      pairsJudged: 1,
      pairsUnjudgeable: 0,
      verdicts: [verdict(true, { judgedCropSha256: leadSha256 })],
      unjudgeable: [],
    };
    const bind = (memberSha256) =>
      pairJudgedVerdictsByCalloutIndex({
        truth,
        features: { callouts: [callout(leadSha256), callout(memberSha256)] },
        claims,
      });

    expect([...bind(nearSha256).keys()]).toEqual([0]);
    expect([...bind(leadSha256).keys()]).toEqual([0, 1]);

    const recutClaims = new Map([[0, { clusterIndex: 0, elementId: ELEMENT_ID }]]);
    expect(
      pairJudgedVerdictsByCalloutIndex({
        truth,
        features: { callouts: [callout(nearSha256)] },
        claims: recutClaims,
      }).size,
    ).toBe(0);

    const memberJudged = pairJudgedVerdictsByCalloutIndex({
      truth: {
        ...truth,
        pairsJudged: 2,
        verdicts: [
          verdict(true, { n: 1, judgedCropSha256: leadSha256 }),
          verdict(false, { n: 2, judgedCropSha256: nearSha256 }),
        ],
      },
      features: { callouts: [callout(leadSha256), callout(nearSha256)] },
      claims,
    });
    expect([...memberJudged.values()].map(({ verdict: outcome }) => outcome)).toEqual([
      "same",
      "different",
    ]);
    expect([...memberJudged.values()].map(({ judgedCrop }) => judgedCrop)).toEqual([
      leadSha256,
      nearSha256,
    ]);
  });

  it("does not reproduce coverage whose pair-judged trust the retained verdicts contradict", () => {
    const fixture = closureFixture();
    const trusted = __testOnly.compileBookletCatalogCoverageClosure(
      { ...fixture, pairJudgedArtifact: pairJudgedArtifactFor([verdict(true)]) },
      fixture.manifestExpectation,
    );
    const coverageBytes = Buffer.from(`${JSON.stringify(trusted, null, 1)}\n`);

    expect(() =>
      __testOnly.verifyBookletCatalogCoverageClosure(
        {
          ...fixture,
          coverageBytes,
          pairJudgedArtifact: pairJudgedArtifactFor([verdict(false)]),
        },
        fixture.manifestExpectation,
      ),
    ).toThrow(/do not exactly reproduce/u);
  });

  it("rejects a verdict map that names a crop nobody was shown", () => {
    expect(() =>
      build({
        identificationDigests: { pairJudged: digest("judged") },
        judgedVerdicts: new Map([[0, { verdict: "same" }]]),
      }),
    ).toThrow(/names judged crop "missing"/u);
  });

  it("rejects a detached full-crop verdict even when its element matches", () => {
    expect(() =>
      build({
        identificationDigests: { pairJudged: digest("judged") },
        judgedVerdicts: new Map([
          [
            0,
            {
              verdict: "different",
              judgedCrop: cropDigestKey(digest("unrelated")),
              judgedElementId: ELEMENT_ID,
            },
          ],
        ]),
      }),
    ).toThrow(/binds crop\/element.*this exact feature and claim bind/u);
  });
});

/**
 * The shipped verdicts cover printed steps 1..50 only. Nothing may read them as
 * evidence about step 51, so the range is enforced by the judged file's own
 * `lastStep` rather than by whoever compiles coverage.
 */
describe("judged verdicts do not extrapolate past the range that was judged", () => {
  /** A coherent deterministic closure whose one callout sits on the given printed step. */
  function closureAtStep(stepNumber, judgedLastStep) {
    const fixture = closureFixture();
    const manifest = JSON.parse(fixture.manifestBytes.toString("utf8"));
    const manifestBytes = Buffer.from(
      `${JSON.stringify(
        { ...manifest, callouts: manifest.callouts.map((entry) => ({ ...entry, stepNumber })) },
        null,
        1,
      )}\n`,
    );
    const featuresArtifact = artifact({
      ...fixture.featuresArtifact.value,
      inputDigests: {
        ...fixture.featuresArtifact.value.inputDigests,
        calloutManifest: digest(manifestBytes),
      },
      callouts: fixture.featuresArtifact.value.callouts.map((callout) => ({
        ...callout,
        stepNumber,
      })),
    });
    const { matchArtifact, distancesArtifact } = identificationArtifactsFor(featuresArtifact);
    return __testOnly.compileBookletCatalogCoverageClosure(
      {
        manifestBytes,
        featuresArtifact,
        matchArtifact,
        distancesArtifact,
        cardsArtifact: null,
        cardImagesArtifact: null,
        answersArtifact: null,
        pairJudgedArtifact: artifact({
          schemaVersion: PART_TRUTH_SCHEMA,
          lastStep: judgedLastStep,
          pairsJudged: 1,
          pairsUnjudgeable: 0,
          verdicts: [verdict(true)],
          unjudgeable: [],
        }),
        elementsArtifact: fixture.elementsArtifact,
        source: "deterministic",
        model: null,
        assignment: "nearest",
        lastStep: stepNumber,
      },
      fixture.manifestExpectation,
    );
  }

  it("binds inside the judged range and falls back to geometry outside it", () => {
    expect(onlyClaim(closureAtStep(2, 2)).identificationConfidence).toBe("pair-judged-same");
    expect(onlyClaim(closureAtStep(3, 2)).identificationConfidence).toBe("geometry");
  });
});
