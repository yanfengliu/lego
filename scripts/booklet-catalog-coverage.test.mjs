import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildBookletCatalogCoverageReport } from "./booklet-catalog-coverage.mjs";
import { FULL_CALLOUT_MANIFEST_EXPECTATION } from "./part-identification-artifacts.mjs";

const digest = (label) => `sha256:${createHash("sha256").update(label).digest("hex")}`;

function manifestFor(callouts) {
  const rawQuantity = callouts.reduce((total, { quantity }) => total + quantity, 0);
  const physical = callouts.filter(({ evidenceKind }) => evidenceKind === "part-art");
  const semantic = callouts.filter(({ evidenceKind }) => evidenceKind !== "part-art");
  const identityDigest = digest(
    callouts
      .map(({ identity }) => identity)
      .sort()
      .join("\n"),
  );
  return {
    schemaVersion: "lego.callout-thumbnails/4",
    sourceHash: digest("booklet"),
    pageSelection: "full booklet",
    pagesCropped: new Set(callouts.map(({ pageNumber }) => pageNumber)).size,
    calloutCount: callouts.length,
    accounting: {
      rawNxIdentityCount: callouts.length,
      rawNxQuantityTotal: rawQuantity,
      physicalPartArtIdentityCount: physical.length,
      physicalPartArtQuantityTotal: physical.reduce((total, { quantity }) => total + quantity, 0),
      semanticIdentityCount: semantic.length,
      semanticQuantityTotal: semantic.reduce((total, { quantity }) => total + quantity, 0),
    },
    conservation: {
      expectedIdentityCount: callouts.length,
      expectedRawNxQuantityTotal: rawQuantity,
      expectedIdentitySetSha256: identityDigest,
      publishedIdentityCount: callouts.length,
      publishedRawNxQuantityTotal: rawQuantity,
      publishedIdentitySetSha256: identityDigest,
    },
    failures: [],
    callouts,
  };
}

const expectationFor = (manifest) => ({
  sourceHash: manifest.sourceHash,
  pagesCropped: manifest.pagesCropped,
  identityCount: manifest.calloutCount,
  rawQuantity: manifest.accounting.rawNxQuantityTotal,
  identitySetDigest: manifest.conservation.expectedIdentitySetSha256,
  accounting: manifest.accounting,
});

function fixture() {
  const callouts = [
    {
      identity: "p11|q1|x43.074|y486.271",
      file: "runs/0123456789abcdef01234567/p11-q1-x43d074-y486d271.png",
      pageNumber: 11,
      stepNumber: 1,
      quantity: 1,
      xPt: 43.074,
      yPt: 486.271,
      evidenceKind: "part-art",
      sha256: digest("crop-one"),
    },
    {
      identity: "p11|q1|x108.908|y486.271",
      file: "runs/0123456789abcdef01234567/p11-q1-x108d908-y486d271.png",
      pageNumber: 11,
      stepNumber: 1,
      quantity: 1,
      xPt: 108.908,
      yPt: 486.271,
      evidenceKind: "part-art",
      sha256: digest("crop-two"),
    },
  ];
  const manifest = manifestFor(callouts);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  const features = {
    callouts: callouts.map((callout, index) => ({
      ...callout,
      descriptor: { pixels: index + 1 },
    })),
  };
  const claims = new Map([
    [0, { elementId: "300501", clusterIndex: 0, picked: "vision-kept" }],
    [1, { elementId: null, clusterIndex: 1, picked: "refused" }],
  ]);
  const elements = {
    300501: {
      quantity: 1,
      partNum: "3005",
      name: "Brick 1 x 1",
      colorId: 0,
    },
  };
  return {
    manifest,
    manifestBytes,
    manifestExpectation: expectationFor(manifest),
    features,
    claims,
    elements,
  };
}

function build(overrides = {}) {
  const base = fixture();
  return buildBookletCatalogCoverageReport({
    manifestBytes: base.manifestBytes,
    features: base.features,
    claims: base.claims,
    elements: base.elements,
    source: "adjudicated",
    model: "fixture-model",
    assignment: "one-to-one",
    lastStep: 1,
    manifestExpectation: base.manifestExpectation,
    ...overrides,
  });
}

describe("booklet catalog coverage producer", () => {
  it("binds stable v4 identities and exact PDF, manifest, crop, and claim evidence", () => {
    const input = fixture();
    const report = buildBookletCatalogCoverageReport({
      manifestBytes: input.manifestBytes,
      features: input.features,
      claims: input.claims,
      elements: input.elements,
      source: "adjudicated",
      model: "fixture-model",
      assignment: "one-to-one",
      lastStep: 1,
      manifestExpectation: input.manifestExpectation,
    });
    const manifestDigest = digest(input.manifestBytes);

    expect(report).toMatchObject({
      schemaVersion: "lego.real-build-catalog-coverage/1",
      inputDigests: {
        pdf: input.manifest.sourceHash,
        calloutManifest: manifestDigest,
      },
      identification: {
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
      },
      lastStep: 1,
      calloutsConsidered: 1,
      calloutsUnidentified: 1,
    });
    expect(Object.keys(report.byCallout)).toEqual(
      input.manifest.callouts.map(({ identity }) => identity),
    );
    expect(report.byCallout[input.manifest.callouts[0].identity]).toMatchObject({
      identity: input.manifest.callouts[0].identity,
      file: input.manifest.callouts[0].file,
      cropDigest: input.manifest.callouts[0].sha256,
      inputDigest: manifestDigest,
      identificationConfidence: "vision-kept",
      elementId: "300501",
      resolution: { catalogPartId: "builtin:brick-1x1", outcome: "exact" },
    });
    expect(report.byCallout[input.manifest.callouts[1].identity]).toMatchObject({
      identity: input.manifest.callouts[1].identity,
      file: input.manifest.callouts[1].file,
      cropDigest: input.manifest.callouts[1].sha256,
      inputDigest: manifestDigest,
      identificationConfidence: "refused",
      elementId: null,
      resolution: null,
    });
  });

  it("rejects stale feature identity, file, ordering, or crop metadata", () => {
    const cases = [
      ["identity", "p11|q1|x44.000|y486.271"],
      ["file", "runs/ffffffffffffffffffffffff/stale.png"],
      ["pageNumber", 12],
      ["stepNumber", 2],
      ["quantity", 2],
      ["sha256", digest("tampered-crop")],
      ["evidenceKind", "assembly-action"],
    ];
    for (const [field, value] of cases) {
      const input = fixture();
      input.features.callouts[0] = { ...input.features.callouts[0], [field]: value };
      expect(() =>
        build({
          manifestBytes: input.manifestBytes,
          features: input.features,
          claims: input.claims,
          elements: input.elements,
        }),
      ).toThrow(new RegExp(`feature callout 0 field ${field}`));
    }

    const reordered = fixture();
    reordered.features.callouts.reverse();
    expect(() =>
      build({
        manifestBytes: reordered.manifestBytes,
        features: reordered.features,
        claims: reordered.claims,
        elements: reordered.elements,
      }),
    ).toThrow(/feature callout 0 field identity/);

    const truncated = fixture();
    truncated.features.callouts.pop();
    expect(() =>
      build({
        manifestBytes: truncated.manifestBytes,
        features: truncated.features,
        claims: truncated.claims,
        elements: truncated.elements,
      }),
    ).toThrow(/features contain 1 callouts, but the exact v4 manifest contains 2/);
  });

  it("keeps semantic multiplier/action identities out of catalog-part coverage", () => {
    const input = fixture();
    const semantic = {
      ...input.manifest.callouts[1],
      identity: "p33|q4|x274.854|y340.077",
      file: "runs/0123456789abcdef01234567/p33-q4-x274d854-y340d077.png",
      pageNumber: 33,
      stepNumber: 29,
      quantity: 4,
      xPt: 274.854,
      yPt: 340.077,
      evidenceKind: "subassembly-repeat",
      sha256: digest("semantic-action"),
    };
    const manifest = manifestFor([...input.manifest.callouts, semantic]);
    const features = {
      callouts: [...input.features.callouts, { ...semantic, descriptor: { pixels: 3 } }],
    };
    const report = build({
      manifestBytes: Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`),
      features,
      manifestExpectation: expectationFor(manifest),
      claims: new Map([...input.claims, [2, { elementId: null, picked: "refused" }]]),
      elements: input.elements,
    });

    expect(report.byCallout[semantic.identity]).toBeUndefined();
    expect(report.calloutsUnidentified).toBe(1);
  });

  it("rejects arbitrary evidence kinds and every stale accounting or conservation field", () => {
    const input = fixture();
    const arbitrary = structuredClone(input.manifest);
    arbitrary.callouts[0].evidenceKind = "attacker-controlled";
    expect(() => build({ manifestBytes: Buffer.from(JSON.stringify(arbitrary)) })).toThrow(
      /fixed evidence contract/,
    );

    for (const section of ["accounting", "conservation"]) {
      for (const field of Object.keys(input.manifest[section])) {
        const stale = structuredClone(input.manifest);
        stale[section][field] =
          typeof stale[section][field] === "number" ? stale[section][field] + 1 : digest(field);
        expect(() => build({ manifestBytes: Buffer.from(JSON.stringify(stale)) })).toThrow(
          /accounting or conservation/,
        );
      }
    }
  });

  it("rejects a self-consistent fragment that calls itself the full pinned booklet", () => {
    const input = fixture();
    const truncated = manifestFor([input.manifest.callouts[0]]);
    truncated.sourceHash = FULL_CALLOUT_MANIFEST_EXPECTATION.sourceHash;
    expect(() =>
      build({
        manifestBytes: Buffer.from(JSON.stringify(truncated)),
        manifestExpectation: undefined,
      }),
    ).toThrow(/independently pinned full-booklet publication/);
  });

  it("rejects a same-count stable identity substitution with a recomputed published digest", () => {
    const input = fixture();
    const substituted = structuredClone(input.manifest);
    substituted.callouts[0].identity = "p11|q1|x44.000|y486.271";
    substituted.callouts[0].xPt = 44;
    substituted.conservation.publishedIdentitySetSha256 = digest(
      substituted.callouts
        .map(({ identity }) => identity)
        .sort()
        .join("\n"),
    );
    expect(() => build({ manifestBytes: Buffer.from(JSON.stringify(substituted)) })).toThrow(
      /identity-set digests cannot self-certify/,
    );
  });

  it("rejects non-v4, malformed, duplicate, and count-stale manifests", () => {
    const input = fixture();
    const bytes = (manifest) => Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);

    expect(() =>
      build({ manifestBytes: bytes({ ...input.manifest, schemaVersion: "legacy" }) }),
    ).toThrow(/lego\.callout-thumbnails\/4/);
    expect(() => build({ manifestBytes: Buffer.from("not-json") })).toThrow(/not valid JSON/);
    expect(() =>
      build({
        manifestBytes: bytes({
          ...input.manifest,
          callouts: [input.manifest.callouts[0], input.manifest.callouts[0]],
        }),
      }),
    ).toThrow(/unique stable identity/);
    expect(() => build({ manifestBytes: bytes({ ...input.manifest, calloutCount: 3 }) })).toThrow(
      /declared callout count/,
    );
  });
});
