import { describe, expect, it } from "vitest";

import { __testOnly, buildBookletCatalogCoverageReport } from "./booklet-catalog-coverage.mjs";
import { FULL_CALLOUT_MANIFEST_EXPECTATION } from "./part-identification-artifacts.mjs";
import {
  build,
  digest,
  expectationFor,
  fixture,
  manifestFor,
} from "./booklet-catalog-coverage-test-fixture.mjs";

describe("booklet catalog coverage report builder", () => {
  it("refuses to publish a PDF digest no feature artifact ever bound", () => {
    const input = fixture();
    const unbound = {
      manifestBytes: input.manifestBytes,
      features: { callouts: input.features.callouts },
      claims: input.claims,
      elements: input.elements,
      source: "deterministic",
      model: null,
      assignment: "one-to-one",
      lastStep: 1,
    };

    // No identificationDigests.features and no features.inputDigests: the report
    // would otherwise republish the manifest's own sourceHash as provenance for
    // features nothing proved came from that PDF.
    expect(() =>
      __testOnly.buildBookletCatalogCoverageReport(unbound, input.manifestExpectation),
    ).toThrow(/features bind PDF\/manifest digests "missing"/u);
    expect(() =>
      __testOnly.buildBookletCatalogCoverageReport(
        { ...unbound, features: { callouts: input.features.callouts, inputDigests: null } },
        input.manifestExpectation,
      ),
    ).toThrow(/features bind PDF\/manifest digests/u);

    for (const [field, forged] of [
      ["pdf", digest("unrelated-pdf")],
      ["calloutManifest", digest("unrelated-manifest")],
    ]) {
      expect(() =>
        __testOnly.buildBookletCatalogCoverageReport(
          {
            ...unbound,
            features: {
              callouts: input.features.callouts,
              inputDigests: { ...input.features.inputDigests, [field]: forged },
            },
          },
          input.manifestExpectation,
        ),
      ).toThrow(/features bind PDF\/manifest digests/u);
    }

    expect(
      __testOnly.buildBookletCatalogCoverageReport(
        { ...unbound, features: input.features },
        input.manifestExpectation,
      ).inputDigests,
    ).toMatchObject({
      pdf: input.manifest.sourceHash,
      calloutManifest: digest(input.manifestBytes),
    });
  });

  it("binds stable v4 identities and exact PDF, manifest, crop, and claim evidence", () => {
    const input = fixture();
    const report = __testOnly.buildBookletCatalogCoverageReport(
      {
        manifestBytes: input.manifestBytes,
        features: input.features,
        claims: input.claims,
        elements: input.elements,
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
        lastStep: 1,
      },
      input.manifestExpectation,
    );
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

  it("retains one manifest byte snapshot and forbids reserved digest overrides", () => {
    const input = fixture();
    const heldBytes = Buffer.from(input.manifestBytes);
    let manifestReads = 0;
    const report = __testOnly.buildBookletCatalogCoverageReport(
      {
        get manifestBytes() {
          manifestReads += 1;
          return manifestReads === 1 ? heldBytes : Buffer.from('{"unrelated":true}');
        },
        features: input.features,
        claims: input.claims,
        elements: input.elements,
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
        lastStep: 1,
      },
      input.manifestExpectation,
    );
    heldBytes.fill(0);

    expect(manifestReads).toBe(1);
    expect(report.inputDigests.calloutManifest).toBe(digest(input.manifestBytes));
    expect(report.byCallout[input.manifest.callouts[0].identity].inputDigest).toBe(
      digest(input.manifestBytes),
    );
    expect(() =>
      build({
        identificationDigests: {
          pdf: digest("forged-pdf"),
          calloutManifest: digest("forged-manifest"),
        },
      }),
    ).toThrow(/pdf and calloutManifest are derived only/u);

    const canonicalRoles = {
      match: digest("match"),
      distances: digest("distances"),
      elementResolution: digest("elements"),
    };
    const reversedRoles = Object.fromEntries(Object.entries(canonicalRoles).reverse());
    const canonicalReport = build({ identificationDigests: canonicalRoles });
    const reversedReport = build({ identificationDigests: reversedRoles });
    expect(JSON.stringify(reversedReport)).toBe(JSON.stringify(canonicalReport));
    expect(Object.keys(canonicalReport.inputDigests)).toEqual([
      "pdf",
      "calloutManifest",
      "match",
      "distances",
      "elementResolution",
    ]);
  });

  it("snapshots callout arrays and every binding field before validation and publication", () => {
    const input = fixture();
    const attacker = {
      ...input.features.callouts[0],
      identity: "p99|q1|x1.000|y1.000",
      file: "runs/ffffffffffffffffffffffff/p99-q1-x1d000-y1d000.png",
      sha256: digest("attacker-crop"),
    };
    let calloutArrayReads = 0;
    const arrayReport = build({
      manifestBytes: input.manifestBytes,
      features: {
        inputDigests: input.features.inputDigests,
        get callouts() {
          calloutArrayReads += 1;
          return calloutArrayReads <= 4
            ? input.features.callouts
            : [attacker, input.features.callouts[1]];
        },
      },
      claims: input.claims,
      elements: input.elements,
    });

    expect(calloutArrayReads).toBe(1);
    expect(Object.hasOwn(arrayReport.byCallout, input.manifest.callouts[0].identity)).toBe(true);
    expect(Object.hasOwn(arrayReport.byCallout, attacker.identity)).toBe(false);

    const bindingFields = [
      "identity",
      "file",
      "pageNumber",
      "stepNumber",
      "quantity",
      "sha256",
      "evidenceKind",
    ];
    const fieldReads = Object.create(null);
    const accessorCallout = Object.fromEntries(bindingFields.map((field) => [field, undefined]));
    for (const field of bindingFields) {
      Object.defineProperty(accessorCallout, field, {
        enumerable: true,
        get() {
          fieldReads[field] = (fieldReads[field] ?? 0) + 1;
          return fieldReads[field] === 1 ? input.features.callouts[0][field] : attacker[field];
        },
      });
    }
    const fieldReport = build({
      manifestBytes: input.manifestBytes,
      features: {
        inputDigests: input.features.inputDigests,
        callouts: [accessorCallout, input.features.callouts[1]],
      },
      claims: input.claims,
      elements: input.elements,
    });

    expect(Object.fromEntries(bindingFields.map((field) => [field, fieldReads[field]]))).toEqual(
      Object.fromEntries(bindingFields.map((field) => [field, 1])),
    );
    expect(Object.hasOwn(fieldReport.byCallout, input.manifest.callouts[0].identity)).toBe(true);
    expect(Object.hasOwn(fieldReport.byCallout, attacker.identity)).toBe(false);
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
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
    const features = {
      inputDigests: { pdf: manifest.sourceHash, calloutManifest: digest(manifestBytes) },
      callouts: [...input.features.callouts, { ...semantic, descriptor: { pixels: 3 } }],
    };
    const report = build({
      manifestBytes,
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
      buildBookletCatalogCoverageReport({
        manifestBytes: Buffer.from(JSON.stringify(truncated)),
        features: input.features,
        claims: input.claims,
        elements: input.elements,
        source: "adjudicated",
        model: "fixture-model",
        assignment: "one-to-one",
        lastStep: 1,
      }),
    ).toThrow(/independently pinned full-booklet publication/);
  });

  it("rejects a same-count stable identity substitution with a recomputed published digest", () => {
    const input = fixture();
    const substituted = structuredClone(input.manifest);
    substituted.callouts[0].identity = "p11|q1|x44.000|y486.271";
    substituted.callouts[0].xPt = 44;
    substituted.callouts[0].file = "runs/0123456789abcdef01234567/p11-q1-x44d000-y486d271.png";
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
        manifestBytes: Buffer.from('{"schemaVersion":"one","schemaVersion":"two"}'),
      }),
    ).toThrow(/repeats key "schemaVersion"/);
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
