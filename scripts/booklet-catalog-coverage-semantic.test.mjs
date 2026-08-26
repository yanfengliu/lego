import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { beforeAll, describe, expect, it } from "vitest";

import {
  __testOnly as cliTestOnly,
  runSemanticBookletCatalogCoverageCli,
  semanticBookletCatalogCoverageUsage,
} from "./booklet-catalog-coverage-semantic-cli.mjs";
import {
  PREFIX50_SEMANTIC_IDENTIFICATION_CONFIDENCE,
  SEMANTIC_CATALOG_COVERAGE_SCHEMA,
  __testOnly as coverageTestOnly,
  compileSemanticBookletCatalogCoverage,
  encodeSemanticBookletCatalogCoverage,
  verifySemanticBookletCatalogCoverage,
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
        version: "builtin.basic-parts/27",
        digest: "sha256:ffb0eb6e68edcb91298b04a3c899a11417b70b07aac062c42f4c1051c20f50ee",
      },
      inputDigests: {
        catalog: "sha256:ffb0eb6e68edcb91298b04a3c899a11417b70b07aac062c42f4c1051c20f50ee",
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

  it("documents the bounded prefix and validates it before replaying source evidence", async () => {
    let output = "";
    await expect(
      runSemanticBookletCatalogCoverageCli(["--last-step", "51"], {
        stdout: (value) => {
          output += value;
        },
      }),
    ).rejects.toThrow(/safe integer from 1 through 50/u);
    expect(output).toBe("");
    expect(semanticBookletCatalogCoverageUsage()).toContain("--last-step 1..50");
  });

  it("preserves differing counterevidence once and refuses an eight-digit collision", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-semantic-coverage-"));
    try {
      const current = Buffer.from("old coverage\n");
      const next = Buffer.from("new coverage\n");
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "catalog-coverage.json"), current);

      const first = cliTestOnly.archiveCounterevidence(next, root);
      expect(first).toMatchObject({ bytes: current.length, digest: digest(current) });
      expect(readFileSync(first.archivePath)).toEqual(current);
      expect(cliTestOnly.archiveCounterevidence(next, root)).toEqual(first);

      writeFileSync(first.archivePath, Buffer.from("collision\n"));
      expect(() => cliTestOnly.archiveCounterevidence(next, root)).toThrow(
        /already exists with different bytes/u,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
        catalog: "sha256:ffb0eb6e68edcb91298b04a3c899a11417b70b07aac062c42f4c1051c20f50ee",
      },
      catalog: {
        version: "builtin.basic-parts/27",
        digest: "sha256:ffb0eb6e68edcb91298b04a3c899a11417b70b07aac062c42f4c1051c20f50ee",
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

  it("measures only the two remaining catalog blockers without substituting a part", () => {
    expect(report.coverage).toMatchObject({
      stepsCovered: 44,
      stepsTotal: 49,
      coveredPrefixLength: 29,
      piecesPlaceable: 308,
      piecesTotal: 320,
    });
    expect(report.coverage.missingDesigns).toEqual([
      expect.objectContaining({
        partNum: "3245c",
        callouts: 3,
        pieces: 7,
        steps: [30, 31, 32],
      }),
      expect.objectContaining({
        partNum: "2453b",
        callouts: 2,
        pieces: 5,
        steps: [49, 50],
      }),
    ]);
    expect(
      Object.values(report.byCallout).filter(({ resolution }) => resolution?.outcome === "absent"),
    ).toHaveLength(5);
  });

  it("independently reproduces exact bytes and rejects a one-byte report edit", async () => {
    expect(bytes).toHaveLength(592_243);
    expect(digest(bytes)).toBe(
      "sha256:c7dd0ef1e5783384a44e123546efce82bb0da2ebc69364dc7780b2bddfa53e0b",
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
