import { describe, expect, it } from "vitest";

import {
  SOURCE_ART_REBOUND_CONFIDENCE,
  applyVerifiedSourceArtReboundToCoverage,
} from "./booklet-catalog-coverage-source-art-rebound.mjs";
import {
  descriptor,
  digest,
  expectationFor,
  fixture,
  manifestFor,
} from "./booklet-catalog-coverage-test-fixture.mjs";
import { __testOnly as coverageTestOnly } from "./booklet-catalog-coverage.mjs";
import { PART_TRUTH_SCHEMA } from "./part-identification-truth-key.mjs";

const ELEMENT_ID = "4160025";
const TARGET_IDENTITY = "p11|q1|x90.511|y212.112";
const REFERENCE_IDENTITY = "p11|q1|x506.064|y212.112";
const PRESERVED_IDENTITY = "p20|q1|x36.320|y430.691";

function sourceCallout(base, { identity, pageNumber, stepNumber, xPt, yPt, crop, offset }) {
  return {
    ...base,
    identity,
    pageNumber,
    stepNumber,
    xPt,
    yPt,
    box: {
      minXPt: xPt - 3,
      minYPt: yPt - 3,
      maxXPt: xPt + 3,
      maxYPt: yPt + 3,
    },
    cropRectPx: { left: offset, top: 0, right: offset, bottom: 0 },
    sourceComponent: {
      ...base.sourceComponent,
      boundsPx: { left: offset, top: 0, right: offset, bottom: 0 },
      absoluteForegroundSha256: digest(`foreground-${crop}`),
    },
    sha256: digest(crop),
  };
}

function reboundFixture(lastStep = 50) {
  const bases = fixture().manifest.callouts;
  const manifest = manifestFor([
    sourceCallout(bases[0], {
      identity: TARGET_IDENTITY,
      pageNumber: 11,
      stepNumber: 2,
      xPt: 90.511,
      yPt: 212.112,
      crop: "rebound-target",
      offset: 0,
    }),
    sourceCallout(bases[1], {
      identity: REFERENCE_IDENTITY,
      pageNumber: 11,
      stepNumber: 4,
      xPt: 506.064,
      yPt: 212.112,
      crop: "rebound-reference",
      offset: 10,
    }),
    sourceCallout(bases[0], {
      identity: PRESERVED_IDENTITY,
      pageNumber: 20,
      stepNumber: 16,
      xPt: 36.32,
      yPt: 430.691,
      crop: "rebound-preserved",
      offset: 20,
    }),
  ]);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  const features = {
    inputDigests: { pdf: manifest.sourceHash, calloutManifest: digest(manifestBytes) },
    callouts: manifest.callouts.map((callout) => ({ ...callout, descriptor: descriptor() })),
  };
  const claims = new Map([
    [0, { elementId: ELEMENT_ID, picked: "vision-member-unreviewed" }],
    [1, { elementId: ELEMENT_ID, picked: "vision-kept" }],
    [2, { elementId: ELEMENT_ID, picked: "vision-kept" }],
  ]);
  const judgedVerdicts = new Map([
    [
      1,
      {
        verdict: "same",
        judgedCrop: manifest.callouts[1].sha256,
        judgedElementId: ELEMENT_ID,
      },
    ],
  ]);
  const report = coverageTestOnly.buildBookletCatalogCoverageReport(
    {
      manifestBytes,
      features,
      claims,
      judgedVerdicts,
      elements: {
        [ELEMENT_ID]: {
          quantity: 3,
          partNum: "30503",
          name: "Wedge Plate 4 x 4 Cut Corner",
          colorId: 0,
        },
      },
      source: "adjudicated",
      model: "fixture-model",
      assignment: "one-to-one",
      lastStep,
      identificationDigests: {
        pairJudged: digest("rebound-pair-truth"),
        sourceArtRebound: digest("rebound-artifact"),
      },
    },
    expectationFor(manifest),
  );
  const members = manifest.callouts.map(({ identity, stepNumber, sha256: cropSha256 }) => ({
    identity,
    stepNumber,
    cropSha256,
  }));
  const inspectedRebound = {
    schemaVersion: "lego.part-identification-source-art-rebound/1",
    artifactSha256: digest("rebound-artifact"),
    reference: members[1],
    members,
  };
  const anchorVerdict = {
    n: 1,
    judgedCropSha256: members[1].cropSha256,
    elementId: ELEMENT_ID,
    same: true,
  };
  const pairJudgedTruth = {
    schemaVersion: PART_TRUTH_SCHEMA,
    lastStep: 50,
    pairsJudged: 1,
    pairsUnjudgeable: 0,
    verdicts: [anchorVerdict],
    unjudgeable: [],
  };
  return { anchorVerdict, inspectedRebound, lastStep, pairJudgedTruth, report };
}

const apply = (overrides = {}) => {
  const fixtureValue = reboundFixture(overrides.lastStep ?? 50);
  return applyVerifiedSourceArtReboundToCoverage({ ...fixtureValue, ...overrides });
};

describe("catalog coverage source-art rebound", () => {
  it("upgrades only the extant step-2 claim and preserves step 4 and step 16", () => {
    const input = reboundFixture();
    const beforeResolution = structuredClone(input.report.byCallout[TARGET_IDENTITY].resolution);
    const report = applyVerifiedSourceArtReboundToCoverage(input);

    expect(report.schemaVersion).toBe("lego.real-build-catalog-coverage/3");
    expect(report.byCallout[TARGET_IDENTITY]).toMatchObject({
      elementId: ELEMENT_ID,
      identificationConfidence: SOURCE_ART_REBOUND_CONFIDENCE,
      inputDigest: input.inspectedRebound.artifactSha256,
      resolution: beforeResolution,
    });
    expect(report.byCallout[REFERENCE_IDENTITY].identificationConfidence).toBe("pair-judged-same");
    expect(report.byCallout[PRESERVED_IDENTITY].identificationConfidence).toBe("vision-kept");
    expect(input.report.byCallout[TARGET_IDENTITY].identificationConfidence).toBe(
      "vision-member-unreviewed",
    );
  });

  it("uses the direct anchor without requiring a fresh model answer", () => {
    const input = reboundFixture();
    const report = {
      ...input.report,
      byCallout: {
        ...input.report.byCallout,
        [TARGET_IDENTITY]: {
          ...input.report.byCallout[TARGET_IDENTITY],
          identificationConfidence: "geometry",
        },
        [PRESERVED_IDENTITY]: {
          ...input.report.byCallout[PRESERVED_IDENTITY],
          identificationConfidence: "geometry",
        },
      },
    };

    const upgraded = applyVerifiedSourceArtReboundToCoverage({ ...input, report });
    expect(upgraded.byCallout[TARGET_IDENTITY].identificationConfidence).toBe(
      SOURCE_ART_REBOUND_CONFIDENCE,
    );
    expect(upgraded.byCallout[PRESERVED_IDENTITY].identificationConfidence).toBe("geometry");
  });

  it("does not apply before both target and direct anchor are inside the bounded prefix", () => {
    const input = reboundFixture(3);
    const report = applyVerifiedSourceArtReboundToCoverage(input);
    expect(report).toBe(input.report);
    expect(report.byCallout[TARGET_IDENTITY].identificationConfidence).toBe(
      "vision-member-unreviewed",
    );
  });

  it("upgrades step 2 at prefix 4 while retaining step 16 as index-only evidence", () => {
    const input = reboundFixture(4);
    expect(input.report.byCallout[PRESERVED_IDENTITY]).toMatchObject({
      elementId: null,
      identificationConfidence: null,
      resolution: null,
      unidentifiedBecause: null,
    });

    const report = applyVerifiedSourceArtReboundToCoverage(input);
    expect(report.byCallout[TARGET_IDENTITY].identificationConfidence).toBe(
      SOURCE_ART_REBOUND_CONFIDENCE,
    );
    expect(report.byCallout[PRESERVED_IDENTITY]).toEqual(
      input.report.byCallout[PRESERVED_IDENTITY],
    );
  });

  it("blocks negatives, missing anchors, and second anchors from relation members", () => {
    const base = reboundFixture();
    for (const verdicts of [
      [{ ...base.anchorVerdict, same: false }],
      [],
      [
        base.anchorVerdict,
        {
          ...base.anchorVerdict,
          n: 2,
          judgedCropSha256: base.inspectedRebound.members[2].cropSha256,
        },
      ],
    ]) {
      expect(() =>
        apply({
          pairJudgedTruth: {
            ...base.pairJudgedTruth,
            pairsJudged: verdicts.length,
            verdicts,
          },
        }),
      ).toThrow(/negative|exactly one direct same anchor/u);
    }
  });

  it("blocks missing, mismatched, or already rebound targets instead of chaining", () => {
    const base = reboundFixture();
    for (const target of [
      undefined,
      { ...base.report.byCallout[TARGET_IDENTITY], elementId: "999999" },
      {
        ...base.report.byCallout[TARGET_IDENTITY],
        identificationConfidence: SOURCE_ART_REBOUND_CONFIDENCE,
      },
    ]) {
      const byCallout = { ...base.report.byCallout };
      if (target === undefined) delete byCallout[TARGET_IDENTITY];
      else byCallout[TARGET_IDENTITY] = target;
      expect(() => apply({ report: { ...base.report, byCallout } })).toThrow(
        /requires extant callout|conflicts with its existing coverage claim/u,
      );
    }
  });

  it("binds the upgraded row to the exact privately verified rebound artifact", () => {
    const base = reboundFixture();
    expect(() =>
      apply({
        inspectedRebound: {
          ...base.inspectedRebound,
          artifactSha256: digest("different-rebound-artifact"),
        },
      }),
    ).toThrow(/cannot inherit a different relation's digest/u);
    expect(() =>
      apply({
        inspectedRebound: {
          ...base.inspectedRebound,
          artifactSha256: "not-a-digest",
        },
      }),
    ).toThrow(/exact bounded step-2\/4\/16 relation/u);
  });
});
