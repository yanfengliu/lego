import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  runSemanticBookletCatalogCoverageCli,
  semanticBookletCatalogCoverageUsage,
} from "./booklet-catalog-coverage-semantic-cli.mjs";
import {
  PREFIX50_SEMANTIC_IDENTIFICATION_CONFIDENCE,
  SEMANTIC_CATALOG_COVERAGE_SCHEMA,
  __testOnly as coverageTestOnly,
  bytesFromVerifiedSemanticBookletCatalogCoverage,
  compileSemanticBookletCatalogCoverage,
  encodeSemanticBookletCatalogCoverage,
  inspectVerifiedSemanticBookletCatalogCoverage,
  isVerifiedSemanticBookletCatalogCoverage,
  verifySemanticBookletCatalogCoverage,
  verifyOpaqueSemanticBookletCatalogCoverage,
} from "./booklet-catalog-coverage-semantic.mjs";
import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut-source.mjs";
import { CURRENT_LEGACY_RECUT_SEMANTIC_PINS } from "./part-identification-legacy-recut-semantic.mjs";
import { CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS } from "./part-identification-source-art-semantic-rebound.mjs";
import { verifyCurrentPrefix50SemanticClosure } from "./part-identification-prefix50-semantic-closure-current.mjs";
import { CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS } from "./part-identification-prefix50-semantic-closure-source.mjs";

const LEGACY_SEMANTIC_PATH = "output/part-identification/legacy-recut-semantic.json";
const SOURCE_ART_SEMANTIC_PATH = "output/part-identification/source-art-semantic-rebound.json";
const REQUIRED_PATHS = [
  CURRENT_LEGACY_RECUT_PINS.currentManifest.path,
  CURRENT_LEGACY_RECUT_PINS.legacyManifest.path,
  CURRENT_LEGACY_RECUT_PINS.truth.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path,
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path,
  CURRENT_SOURCE_ART_SEMANTIC_REBOUND_PINS.pdf.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3.path,
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.reviewOutcomes.path,
  LEGACY_SEMANTIC_PATH,
  SOURCE_ART_SEMANTIC_PATH,
];
const realDescribe = REQUIRED_PATHS.every(existsSync) ? describe : describe.skip;
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

describe("semantic booklet catalog coverage hostile boundary", () => {
  it("rejects caller-shaped semantic closure lookalikes before reading their bytes", async () => {
    await expect(
      compileSemanticBookletCatalogCoverage({
        elementResolutionBytes: Buffer.from([1]),
        lastStep: 50,
        manifestBytes: Buffer.from([1]),
        semanticClosure: {},
      }),
    ).rejects.toThrow(/opaque result/u);
  });

  it("projects a dense synthetic prefix with catalog truth and semantic mismatch evidence", () => {
    const manifestDigest = digest("synthetic-manifest");
    const semanticDigest = digest("synthetic-semantic-closure");
    const report = coverageTestOnly.projectVerifiedSemanticCoverage({
      semanticArtifact: {
        semanticIdentity: [
          {
            identity: "p1|q1|x1.000|y1.000",
            pageNumber: 1,
            stepNumber: 1,
            quantity: 1,
            elementId: "synthetic-element",
            publishedPartNum: "3005",
            publishedColorId: "0",
            officialDesignId: "official-conflict",
            evidenceMethod: "synthetic-reviewed-semantic",
          },
        ],
      },
      semanticDigest,
      manifestArtifact: {
        digest: manifestDigest,
        value: {
          sourceHash: digest("synthetic-pdf"),
          callouts: [
            {
              identity: "p1|q1|x1.000|y1.000",
              file: "prefix.png",
              pageNumber: 1,
              stepNumber: 1,
              quantity: 1,
              sha256: digest("prefix-crop"),
              evidenceKind: "part-art",
            },
            {
              identity: "p51|q1|x1.000|y1.000",
              file: "suffix.png",
              pageNumber: 51,
              stepNumber: 51,
              quantity: 1,
              sha256: digest("suffix-crop"),
              evidenceKind: "part-art",
            },
          ],
        },
      },
      elementsArtifact: {
        digest: digest("synthetic-elements"),
        value: {
          "synthetic-element": {
            partNum: "3005",
            colorId: "0",
            name: "Brick 1 x 1",
          },
        },
      },
      lastStep: 1,
      expectedPartArtRows: 2,
    });

    expect(report).toMatchObject({
      catalog: {
        version: "builtin.basic-parts/29",
        digest: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
      },
      inputDigests: {
        catalog: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
        prefix50SemanticClosure: semanticDigest,
      },
      calloutsConsidered: 1,
      coverage: { piecesPlaceable: 1, piecesTotal: 1 },
    });
    expect(report.byCallout["p1|q1|x1.000|y1.000"]).toMatchObject({
      elementId: "synthetic-element",
      identificationConfidence: PREFIX50_SEMANTIC_IDENTIFICATION_CONFIDENCE,
      semanticEvidence: {
        evidenceMethod: "synthetic-reviewed-semantic",
        officialDesignId: "official-conflict",
        publishedPartNum: "3005",
        publishedMatchesOfficialDesignId: false,
      },
      resolution: { outcome: "exact", catalogPartId: "builtin:brick-1x1" },
    });
    expect(report.byCallout["p51|q1|x1.000|y1.000"]).toMatchObject({
      inputDigest: manifestDigest,
      elementId: null,
      identificationConfidence: null,
      semanticEvidence: null,
      resolution: null,
    });
  });

  it("documents the fixed prefix and rejects argv before replaying source evidence", async () => {
    let output = "";
    await expect(
      runSemanticBookletCatalogCoverageCli(["--unexpected"], {
        stdout: (value) => {
          output += value;
        },
      }),
    ).rejects.toThrow(/accepts no caller arguments/u);
    expect(output).toBe("");
    expect(semanticBookletCatalogCoverageUsage()).toContain(
      "booklet-catalog-coverage-semantic-cli.mjs",
    );
    expect(semanticBookletCatalogCoverageUsage()).toContain("exactly the first 50 printed steps");
  });
});

realDescribe("current prefix-50 semantic booklet catalog coverage", () => {
  let current;
  let input;
  let report;
  let bytes;

  beforeAll(async () => {
    current = await verifyCurrentPrefix50SemanticClosure();
    input = {
      elementResolutionBytes: current.elementResolutionBytes,
      lastStep: 50,
      manifestBytes: current.manifestBytes,
      semanticClosure: current.verified,
    };
    report = await compileSemanticBookletCatalogCoverage(input);
    bytes = encodeSemanticBookletCatalogCoverage(report);
  }, 180_000);

  it("publishes all 187 verified prefix identities while retaining 672 authority-null suffix rows", () => {
    const rows = Object.values(report.byCallout);
    const prefixRows = rows.filter(({ stepNumber }) => stepNumber <= 50);
    const suffixRows = rows.filter(({ stepNumber }) => stepNumber > 50);

    expect(report).toMatchObject({
      schemaVersion: SEMANTIC_CATALOG_COVERAGE_SCHEMA,
      inputDigests: {
        calloutManifest: CURRENT_LEGACY_RECUT_PINS.currentManifest.digest,
        elementResolution: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution.digest,
        prefix50SemanticClosure: CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.digest,
        catalog: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
      },
      catalog: {
        version: "builtin.basic-parts/29",
        digest: "sha256:19c5e8a3f4e1d00d7747c8d3e0f377ee4391acc53915df8ead0c1830b75b8db6",
      },
      expectedPrintedSteps: 359,
      lastStep: 50,
      suffixStepsReconstructed: false,
      calloutsConsidered: 187,
      calloutsUnidentified: 0,
      identification: {
        source: "prefix50-semantic-closure",
        model: null,
        assignment: "exact-verified-semantic-identity",
      },
    });
    expect(rows).toHaveLength(859);
    expect(prefixRows).toHaveLength(187);
    expect(suffixRows).toHaveLength(672);
    expect(
      prefixRows.every(
        (row) =>
          row.identificationConfidence === PREFIX50_SEMANTIC_IDENTIFICATION_CONFIDENCE &&
          row.inputDigest === current.inspection.digest &&
          row.elementId !== null &&
          row.semanticEvidence !== null &&
          row.resolution !== null,
      ),
    ).toBe(true);
    expect(
      suffixRows.every(
        (row) =>
          row.identificationConfidence === null &&
          row.elementId === null &&
          row.semanticEvidence === null &&
          row.resolution === null &&
          row.inputDigest === report.inputDigests.calloutManifest,
      ),
    ).toBe(true);
  });

  it("retains the step-26 published-versus-official identity conflict", () => {
    expect(report.byCallout["p30|q2|x84.228|y407.699"]).toMatchObject({
      stepNumber: 26,
      quantity: 2,
      elementId: "6168620",
      semanticEvidence: {
        evidenceMethod: "verified-legacy-recut-semantic",
        officialDesignId: "10201",
        publishedPartNum: "28802",
        publishedMatchesOfficialDesignId: false,
      },
      resolution: {
        outcome: "exact",
        partNum: "28802",
        catalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
      },
    });
  });

  it("does not let occurrence-only /29 definitions rewrite published callout identity", () => {
    const bracket = report.byCallout["p30|q2|x84.228|y407.699"];
    expect(bracket.semanticEvidence).toMatchObject({
      officialDesignId: "10201",
      publishedPartNum: "28802",
      publishedMatchesOfficialDesignId: false,
    });
    expect(bracket.resolution).toMatchObject({
      partNum: "28802",
      catalogPartId: "builtin:bracket-1x2-1x4-rounded-bottom",
    });

    for (const identity of [
      "p34|q1|x62.389|y468.271",
      "p35|q2|x147.987|y481.711",
      "p36|q4|x83.269|y421.615",
    ]) {
      expect(report.byCallout[identity]).toMatchObject({
        semanticEvidence: {
          officialDesignId: "3245",
          publishedPartNum: "3245c",
          publishedMatchesOfficialDesignId: false,
        },
        resolution: {
          partNum: "3245c",
          catalogPartId: "builtin:brick-1x2x2-without-understud",
        },
      });
    }
  });

  it("measures complete prefix catalog coverage without granting exact legacy identity bindings", () => {
    expect(report.coverage).toMatchObject({
      stepsCovered: 49,
      stepsTotal: 49,
      coveredPrefixLength: 49,
      piecesPlaceable: 320,
      piecesTotal: 320,
    });
    expect(report.coverage.missingDesigns).toEqual([]);
    expect(
      Object.values(report.byCallout).filter(({ resolution }) => resolution?.outcome === "absent"),
    ).toHaveLength(0);
  });

  it("independently reproduces exact bytes and rejects a one-byte report edit", async () => {
    expect(bytes).toHaveLength(588_467);
    expect(digest(bytes)).toBe(
      "sha256:861d08a28dac94619e8c541e928d7803b4b6cab9fe9fa12da9f166fc0e46444d",
    );
    await expect(
      verifySemanticBookletCatalogCoverage({ ...input, coverageBytes: bytes }),
    ).resolves.toEqual(report);
    const changed = Buffer.from(bytes);
    changed[changed.length - 2] ^= 1;
    await expect(
      verifySemanticBookletCatalogCoverage({ ...input, coverageBytes: changed }),
    ).rejects.toThrow(/do not independently reproduce/u);
  });

  it("issues opaque publication authority only for independently reproduced bytes", async () => {
    const verified = await verifyOpaqueSemanticBookletCatalogCoverage({
      ...input,
      coverageBytes: bytes,
    });
    expect(isVerifiedSemanticBookletCatalogCoverage(verified)).toBe(true);
    expect(bytesFromVerifiedSemanticBookletCatalogCoverage(verified)).toEqual(bytes);
    expect(inspectVerifiedSemanticBookletCatalogCoverage(verified)).toMatchObject({
      artifact: report,
      digest: digest(bytes),
    });
    expect(isVerifiedSemanticBookletCatalogCoverage({})).toBe(false);
    expect(() => bytesFromVerifiedSemanticBookletCatalogCoverage({})).toThrow(
      /opaque in-memory verifier result/u,
    );
  });

  it("projects a smaller request without leaking later semantic identities", async () => {
    const bounded = await compileSemanticBookletCatalogCoverage({ ...input, lastStep: 29 });
    const later = Object.values(bounded.byCallout).filter(({ stepNumber }) => stepNumber > 29);
    expect(bounded.lastStep).toBe(29);
    expect(bounded.calloutsConsidered).toBeLessThan(187);
    expect(later).toHaveLength(859 - bounded.calloutsConsidered);
    expect(
      later.every(
        ({ elementId, identificationConfidence, resolution }) =>
          elementId === null && identificationConfidence === null && resolution === null,
      ),
    ).toBe(true);
  });

  it("rejects semantic, manifest, resolution, and prefix drift", async () => {
    for (const lastStep of [0, 51, 1.5]) {
      await expect(compileSemanticBookletCatalogCoverage({ ...input, lastStep })).rejects.toThrow(
        /safe integer from 1 through 50/u,
      );
    }
    const manifestBytes = Buffer.from(input.manifestBytes);
    manifestBytes[0] ^= 1;
    await expect(
      compileSemanticBookletCatalogCoverage({ ...input, manifestBytes }),
    ).rejects.toThrow(/exact full-booklet manifest|valid JSON/u);
    const elementResolutionBytes = Buffer.from(input.elementResolutionBytes);
    elementResolutionBytes[0] ^= 1;
    await expect(
      compileSemanticBookletCatalogCoverage({ ...input, elementResolutionBytes }),
    ).rejects.toThrow(/exact element-resolution input|valid JSON/u);
  });
});
