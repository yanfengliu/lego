import { describe, expect, it } from "vitest";

import { bindCalloutSourceArtMeasurement } from "./part-identification-source-art-binding.mjs";

const DIGESTS = {
  crop: `sha256:${"1".repeat(64)}`,
  component: `sha256:${"2".repeat(64)}`,
  decoded: `sha256:${"3".repeat(64)}`,
  embedded: `sha256:${"4".repeat(64)}`,
  pdf: `sha256:${"5".repeat(64)}`,
};

const component = (changes = {}) => ({
  rasterScale: 8,
  boundsPx: { left: 236, top: 181, right: 421, bottom: 303 },
  foregroundPixels: 13_592,
  rawComponentCount: 1,
  absoluteForegroundSha256: DIGESTS.component,
  ...changes,
});

const row = (changes = {}) => ({
  key: "3023-source",
  identity: "p18|q1|x29.480|y498.751",
  pageNumber: 18,
  stepNumber: 14,
  quantity: 1,
  xPt: 29.4803,
  yPt: 498.75079,
  heightPt: 8,
  expectedOperatorIndex: 22,
  expectedCropSha256: DIGESTS.crop,
  sourceComponent: component(),
  ...changes,
});

function fixture() {
  const exactRow = row();
  return {
    rows: [exactRow],
    measurement: {
      admissionAuthority: "none",
      claim: "embedded-source-art-only",
      observedPdfSha256: DIGESTS.pdf,
      pageNumberConvention: "pdf-one-based",
      pdfjsVersion: "5.4.149",
      schemaVersion: "lego.pdf-embedded-source-art-measurement/1",
      semanticIdentityClaimed: false,
      witnesses: [
        {
          componentBoundsPxAtScale8: exactRow.sourceComponent.boundsPx,
          decodedBytes: 5_355,
          decodedPixelSha256: DIGESTS.decoded,
          embeddedSourceArtSha256: DIGESTS.embedded,
          height: 35,
          identity: exactRow.identity,
          key: exactRow.key,
          kind: 2,
          label: "1x",
          labelTransformPt: [exactRow.xPt, exactRow.yPt],
          operatorIndex: exactRow.expectedOperatorIndex,
          pageNumber: exactRow.pageNumber,
          projectedBoundsPxAtScale8: { left: 232, top: 177, right: 425, bottom: 308 },
          transform: [24.23026, 0, 0, 16.29094, 29.00519, 505.74934],
          width: 51,
        },
      ],
    },
    manifestCallouts: [
      {
        identity: exactRow.identity,
        pageNumber: exactRow.pageNumber,
        stepNumber: exactRow.stepNumber,
        quantity: exactRow.quantity,
        xPt: exactRow.xPt,
        yPt: exactRow.yPt,
        heightPt: exactRow.heightPt,
        cropStrategy: "ranked-component",
        evidenceKind: "part-art",
        regionKind: "isolated-component",
        sha256: exactRow.expectedCropSha256,
        foregroundPixels: exactRow.sourceComponent.foregroundPixels,
        widthPx: 196,
        heightPx: 133,
        sourceComponent: exactRow.sourceComponent,
      },
    ],
    renderedCrops: [
      {
        identity: exactRow.identity,
        sha256: exactRow.expectedCropSha256,
        crop: {
          strategy: "ranked-component",
          evidenceKind: "part-art",
          regionKind: "isolated-component",
          widthPx: 196,
          heightPx: 133,
          foregroundPixels: exactRow.sourceComponent.foregroundPixels,
          sourceComponent: exactRow.sourceComponent,
        },
      },
    ],
  };
}

describe("embedded source-art callout binding", () => {
  it("binds one authority-free measurement to exact manifest and fresh crop records", () => {
    expect(bindCalloutSourceArtMeasurement(fixture())).toMatchObject({
      admissionAuthority: "none",
      coverageTrustGranted: false,
      rows: [
        {
          cropSha256: DIGESTS.crop,
          decodedPixelSha256: DIGESTS.decoded,
          embeddedSourceArtSha256: DIGESTS.embedded,
          identity: row().identity,
          key: row().key,
          operatorIndex: 22,
          pageNumber: 18,
          stepNumber: 14,
        },
      ],
      schemaVersion: "lego.callout-source-art-binding/1",
      semanticIdentityClaimed: false,
    });
  });

  it("refuses a coherent operator and rectangle redirect away from the authenticated crop", () => {
    const value = fixture();
    const redirected = component({
      boundsPx: { left: 900, top: 700, right: 980, bottom: 760 },
    });
    value.rows[0] = row({ expectedOperatorIndex: 39, sourceComponent: redirected });
    value.measurement.witnesses[0] = {
      ...value.measurement.witnesses[0],
      componentBoundsPxAtScale8: redirected.boundsPx,
      operatorIndex: 39,
    };
    expect(() => bindCalloutSourceArtMeasurement(value)).toThrow(
      /manifest\.sourceComponent was .*; expected .*boundsPx.*900/,
    );
  });

  it("refuses page and step metadata mutations", () => {
    const movedPage = fixture();
    movedPage.rows[0] = row({ pageNumber: 19 });
    movedPage.measurement.witnesses[0] = {
      ...movedPage.measurement.witnesses[0],
      pageNumber: 19,
    };
    expect(() => bindCalloutSourceArtMeasurement(movedPage)).toThrow(
      /manifest\.pageNumber was 18; expected 19/,
    );

    const movedStep = fixture();
    movedStep.rows[0] = row({ stepNumber: 15 });
    expect(() => bindCalloutSourceArtMeasurement(movedStep)).toThrow(
      /manifest\.stepNumber was 14; expected 15/,
    );
  });

  it("refuses fresh crop digest, component, and authority mutations", () => {
    const changedDigest = fixture();
    changedDigest.renderedCrops[0].sha256 = `sha256:${"6".repeat(64)}`;
    expect(() => bindCalloutSourceArtMeasurement(changedDigest)).toThrow(
      /fresh\.sha256 was "sha256:6{64}"; expected "sha256:1{64}"/,
    );

    const changedComponent = fixture();
    changedComponent.renderedCrops[0].crop.sourceComponent = component({
      foregroundPixels: 13_591,
    });
    expect(() => bindCalloutSourceArtMeasurement(changedComponent)).toThrow(
      /fresh\.crop\.sourceComponent was .*13591.*; expected .*13592/,
    );

    const grantedAuthority = fixture();
    grantedAuthority.measurement.admissionAuthority = "trusted";
    expect(() => bindCalloutSourceArtMeasurement(grantedAuthority)).toThrow(
      /Source-art measurement admissionAuthority was "trusted"; expected "none"/,
    );
  });

  it("names collection count, missing key, duplicate key, and duplicate identity failures", () => {
    const wrongCount = fixture();
    wrongCount.renderedCrops = [];
    expect(() => bindCalloutSourceArtMeasurement(wrongCount)).toThrow(
      /Fresh rendered crops record count was 0; expected 1/,
    );

    const missingKey = fixture();
    delete missingKey.measurement.witnesses[0].key;
    expect(() => bindCalloutSourceArtMeasurement(missingKey)).toThrow(
      /Measured witnesses record 0 key was undefined; expected one string key/,
    );

    const duplicateKey = fixture();
    duplicateKey.rows = [row(), row({ key: "other", identity: "other-identity" })];
    duplicateKey.measurement.witnesses = [
      duplicateKey.measurement.witnesses[0],
      { ...duplicateKey.measurement.witnesses[0] },
    ];
    expect(() => bindCalloutSourceArtMeasurement(duplicateKey)).toThrow(
      /Measured witnesses record 1 key was "3023-source"; expected "a unique key"/,
    );

    const duplicateIdentity = fixture();
    duplicateIdentity.rows = [row(), row({ key: "other" })];
    expect(() => bindCalloutSourceArtMeasurement(duplicateIdentity)).toThrow(
      /identity was "p18\|q1\|x29\.480\|y498\.751"; expected "a unique callout identity"/,
    );
  });
});
