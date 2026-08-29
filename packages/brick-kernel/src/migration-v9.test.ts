import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import {
  REVIEWED_TRUTHS_V4,
  REVIEWED_TRUTH_V1,
  documentAtReviewedTruth,
} from "./migration-historical-fixtures.test-support.ts";
import { REVIEWED_CATALOG_INTERPRETATION_CHANGES, migrateDocumentTruth } from "./migration.ts";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUTPUT_ROOT = resolve(REPOSITORY_ROOT, "output");
const VERSION_10_SOURCE_COMMIT = "081bd53edccf4c0c62691660c94eed5c723dc152";

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${String(result.status)}${detail === "" ? "" : `:\n${detail}`}`,
    );
  }
}

async function deriveVersion10ShellPartIds(): Promise<readonly string[]> {
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  const temporaryRoot = mkdtempSync(join(OUTPUT_ROOT, "migration-v9-catalog-check-"));
  const canonicalOutput = realpathSync(OUTPUT_ROOT);
  const canonicalTemporary = realpathSync(temporaryRoot);
  const relation = relative(canonicalOutput, canonicalTemporary);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`)) {
    throw new Error(
      `Refusing cleanup outside ignored output root ${canonicalOutput}; resolved ${canonicalTemporary}.`,
    );
  }
  try {
    const extractionRoot = join(canonicalTemporary, VERSION_10_SOURCE_COMMIT);
    const archivePath = join(canonicalTemporary, `${VERSION_10_SOURCE_COMMIT}.tar`);
    mkdirSync(extractionRoot, { recursive: true });
    run("git", [
      "-c",
      `safe.directory=${REPOSITORY_ROOT.replaceAll("\\", "/")}`,
      "archive",
      "--format=tar",
      `--output=${archivePath}`,
      VERSION_10_SOURCE_COMMIT,
      "package.json",
      "packages/catalog/package.json",
      "packages/catalog/src",
    ]);
    run("tar", ["-xf", archivePath, "-C", extractionRoot]);
    const catalogUrl = pathToFileURL(join(extractionRoot, "packages/catalog/src/catalog.ts"));
    const historical = (await import(`${catalogUrl.href}?commit=${VERSION_10_SOURCE_COMMIT}`)) as {
      readonly PART_DEFINITIONS?: readonly {
        readonly id: string;
        readonly geometry?: { readonly shellCavity?: unknown };
      }[];
    };
    if (!Array.isArray(historical.PART_DEFINITIONS)) {
      throw new Error(`${VERSION_10_SOURCE_COMMIT} did not export PART_DEFINITIONS.`);
    }
    return historical.PART_DEFINITIONS.filter(
      ({ geometry }) => geometry?.shellCavity !== undefined,
    ).map(({ id }) => id);
  } finally {
    rmSync(canonicalTemporary, { recursive: true, force: true });
  }
}

let version10ShellPartIdsPromise: Promise<readonly string[]> | undefined;
const getVersion10ShellPartIds = (): Promise<readonly string[]> =>
  (version10ShellPartIdsPromise ??= deriveVersion10ShellPartIds());

const VERSION_11_CONSTRUCTION_PART_IDS = [
  "builtin:tile-1x2-cut-right-45",
  "builtin:plate-1x2-round-end",
  "builtin:wedge-plate-2x4-wing",
  "builtin:corner-plate-3x3",
  "builtin:curved-slope-1x4-double",
  "builtin:plate-3x3-corner-round",
  "builtin:wedge-plate-3x3-cut-corner",
  "builtin:corner-plate-2x2-round",
] as const;

function reviewedTruth(options: {
  readonly catalogVersion: string;
  readonly catalogHash: BrickDocumentV1["truth"]["catalog"]["hash"];
  readonly connectorHash: BrickDocumentV1["truth"]["connectorTaxonomy"]["hash"];
  readonly collisionVersion: string;
  readonly collisionHash: BrickDocumentV1["truth"]["collisionModel"]["hash"];
  readonly transformHash: BrickDocumentV1["truth"]["transformPolicy"]["hash"];
  readonly validatorVersion: string;
  readonly validatorHash: BrickDocumentV1["truth"]["validatorSet"]["hash"];
}): BrickDocumentV1["truth"] {
  return {
    schemaVersion: "lego.truth-snapshot/1",
    catalog: {
      id: "builtin.basic-parts",
      version: options.catalogVersion,
      hash: options.catalogHash,
    },
    connectorTaxonomy: {
      id: "stud-tube",
      version: "stud-tube/1",
      hash: options.connectorHash,
    },
    collisionModel: {
      id: "rectilinear-stud-clearance",
      version: options.collisionVersion,
      hash: options.collisionHash,
    },
    transformPolicy: {
      id: "upright-quarter-turns-negative-y-up",
      version: "upright-quarter-turns-negative-y-up/1",
      hash: options.transformHash,
    },
    validatorSet: {
      id: "lego.kernel-validators",
      version: options.validatorVersion,
      hash: options.validatorHash,
    },
  };
}

const REVIEWED_TRUTH_V5 = reviewedTruth({
  catalogVersion: "builtin.basic-parts/5",
  catalogHash: "sha256:4fa0d526206cad697216ae205e3b7f3ec0948adc99ed8987a59b20bc16059dbf",
  connectorHash: "sha256:6159d702f87b47daf3b33ada3a4510973defbe307c7a73c5af29c9d985cfd189",
  collisionVersion: "rectilinear-stud-clearance/1",
  collisionHash: "sha256:40e3d3a92d37faa4d2d9a91d52e8f9a6172fb4a37007d6573a54363114d16ad5",
  transformHash: "sha256:9c5f5fcce76f51e86da80226f130654586c81a94226b0ab26779e06f0589d3c0",
  validatorVersion: "lego.kernel-validators/1",
  validatorHash: "sha256:287a04704c5f94930242b85dda7198b22f6eed195334b55a448a5e60d65e517b",
});

const POST_V8_TRUTH = {
  connectorHash: "sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2",
  transformHash: "sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6",
  validatorVersion: "lego.kernel-validators/2",
  validatorHash: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
} as const;

const REVIEWED_TRUTH_V8 = reviewedTruth({
  ...POST_V8_TRUTH,
  catalogVersion: "builtin.basic-parts/8",
  catalogHash: "sha256:a9adf38bfad3c73d47524100f4e3891ac32a8e6cdd7865a37ec00eccf31281e2",
  collisionVersion: "rectilinear-stud-clearance/2",
  collisionHash: "sha256:8f181d6f69af1cbe385a1d91fa07477bb75df9ef6b5af21b4e1f5bcb3a96b878",
});

const REVIEWED_TRUTH_V9 = reviewedTruth({
  ...POST_V8_TRUTH,
  catalogVersion: "builtin.basic-parts/9",
  catalogHash: "sha256:37044e203031a9efc791ed9d9d41468796e57522e4a048d3403eac1a958386ff",
  collisionVersion: "rectilinear-stud-clearance/2",
  collisionHash: "sha256:be31c76510a2ccefc2904a858accd2f2fcc162ed8ae723a3c285a5d3dbc5ea3b",
});

const REVIEWED_TRUTH_V10 = reviewedTruth({
  ...POST_V8_TRUTH,
  catalogVersion: "builtin.basic-parts/10",
  catalogHash: "sha256:c41d4c2faf78534bcfab3142907a4271210d9dc855ce1103f12390b0d2c0709e",
  collisionVersion: "rectilinear-stud-clearance/2",
  collisionHash: "sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb",
});

type MigrationReport = ReturnType<typeof migrateDocumentTruth>["report"];

function reportAt(truth: BrickDocumentV1["truth"]): MigrationReport {
  const historical = documentAtReviewedTruth({
    id: truth.catalog.version,
    name: "Historical",
    truth,
  });
  const { report } = migrateDocumentTruth(historical);
  expect(report.fromTruthHash).toBe(canonicalDigest(truth));
  expect(report.migrated).toBe(true);
  expect(report.blockingReasons).toEqual([]);
  return report;
}

function changesAt(report: MigrationReport, from: string, to: string) {
  return report.catalogInterpretationChanges.filter(
    (change) => change.fromCatalogVersion === from && change.toCatalogVersion === to,
  );
}

describe("reviewed /4 through /11 catalog reinterpretations", () => {
  it("pins the complete measured interpretation table", async () => {
    const version10ShellPartIds = await getVersion10ShellPartIds();
    expect(REVIEWED_CATALOG_INTERPRETATION_CHANGES).toEqual(
      expect.arrayContaining([
        {
          fromCatalogVersion: "builtin.basic-parts/4",
          toCatalogVersion: "builtin.basic-parts/4",
          fromTruthHashes: [
            "sha256:f48bb1cae251f592923d94b4b992a55c06e74ea49b0f81be9ff4d416bb38e843",
          ],
          affectedCatalogPartIds: ["builtin:jumper-plate-1x3"],
          changedFields: ["render-geometry", "connector-semantics", "collision-semantics"],
        },
        {
          fromCatalogVersion: "builtin.basic-parts/4",
          toCatalogVersion: "builtin.basic-parts/5",
          affectedCatalogPartIds: ["builtin:axle-1x2"],
          changedFields: ["connector-semantics"],
        },
        {
          fromCatalogVersion: "builtin.basic-parts/5",
          toCatalogVersion: "builtin.basic-parts/6",
          affectedCatalogPartIds: [
            "builtin:wedge-plate-2x4-left",
            "builtin:wedge-plate-2x4-right",
            "builtin:wedge-plate-2x3-left",
            "builtin:wedge-plate-2x3-right",
          ],
          changedFields: ["connector-semantics", "collision-semantics"],
        },
        {
          fromCatalogVersion: "builtin.basic-parts/8",
          toCatalogVersion: "builtin.basic-parts/9",
          affectedCatalogPartIds: ["builtin:plate-2x4"],
          changedFields: ["render-geometry", "collision-semantics"],
        },
        {
          fromCatalogVersion: "builtin.basic-parts/9",
          toCatalogVersion: "builtin.basic-parts/10",
          affectedCatalogPartIds: version10ShellPartIds,
          changedFields: ["render-geometry", "collision-semantics"],
        },
        {
          fromCatalogVersion: "builtin.basic-parts/10",
          toCatalogVersion: "builtin.basic-parts/11",
          affectedCatalogPartIds: VERSION_11_CONSTRUCTION_PART_IDS,
          changedFields: ["construction-semantics"],
        },
      ]),
    );
    expect(version10ShellPartIds).toHaveLength(58);
  });

  it("discriminates the same-version /4 jumper repair by exact predecessor truth", () => {
    const [first, second, third] = REVIEWED_TRUTHS_V4.map(({ truth }) => reportAt(truth));

    expect(changesAt(first!, "builtin.basic-parts/4", "builtin.basic-parts/4")).toHaveLength(1);
    expect(changesAt(second!, "builtin.basic-parts/4", "builtin.basic-parts/4")).toEqual([]);
    expect(changesAt(third!, "builtin.basic-parts/4", "builtin.basic-parts/4")).toEqual([]);
    expect(changesAt(first!, "builtin.basic-parts/4", "builtin.basic-parts/5")).toEqual([]);
    expect(changesAt(second!, "builtin.basic-parts/4", "builtin.basic-parts/5")).toEqual([]);
    expect(changesAt(third!, "builtin.basic-parts/4", "builtin.basic-parts/5")).toEqual([
      {
        fromCatalogVersion: "builtin.basic-parts/4",
        toCatalogVersion: "builtin.basic-parts/5",
        affectedCatalogPartIds: ["builtin:axle-1x2"],
        changedFields: ["connector-semantics"],
      },
    ]);
    expect(changesAt(first!, "builtin.basic-parts/5", "builtin.basic-parts/6")).toEqual([]);
    expect(changesAt(second!, "builtin.basic-parts/5", "builtin.basic-parts/6")[0]).toMatchObject({
      affectedCatalogPartIds: [
        "builtin:wedge-plate-2x4-left",
        "builtin:wedge-plate-2x4-right",
        "builtin:wedge-plate-2x3-left",
        "builtin:wedge-plate-2x3-right",
      ],
    });
  });

  it("reports each later measured boundary from its exact historical source", async () => {
    const version10ShellPartIds = await getVersion10ShellPartIds();
    const v5 = reportAt(REVIEWED_TRUTH_V5);
    const v8 = reportAt(REVIEWED_TRUTH_V8);
    const v9 = reportAt(REVIEWED_TRUTH_V9);
    const v10 = reportAt(REVIEWED_TRUTH_V10);

    expect(changesAt(v5, "builtin.basic-parts/5", "builtin.basic-parts/6")[0]).toMatchObject({
      affectedCatalogPartIds: [
        "builtin:wedge-plate-2x4-left",
        "builtin:wedge-plate-2x4-right",
        "builtin:wedge-plate-2x3-left",
        "builtin:wedge-plate-2x3-right",
      ],
      changedFields: ["connector-semantics", "collision-semantics"],
    });
    expect(changesAt(v8, "builtin.basic-parts/8", "builtin.basic-parts/9")[0]).toMatchObject({
      affectedCatalogPartIds: ["builtin:plate-2x4"],
      changedFields: ["render-geometry", "collision-semantics"],
    });
    expect(changesAt(v8, "builtin.basic-parts/9", "builtin.basic-parts/10")[0]).toMatchObject({
      affectedCatalogPartIds: version10ShellPartIds,
    });
    expect(changesAt(v9, "builtin.basic-parts/8", "builtin.basic-parts/9")).toEqual([]);
    expect(changesAt(v9, "builtin.basic-parts/9", "builtin.basic-parts/10")[0]).toMatchObject({
      affectedCatalogPartIds: version10ShellPartIds,
    });
    expect(changesAt(v10, "builtin.basic-parts/9", "builtin.basic-parts/10")).toEqual([]);
    expect(changesAt(v10, "builtin.basic-parts/10", "builtin.basic-parts/11")[0]).toMatchObject({
      affectedCatalogPartIds: VERSION_11_CONSTRUCTION_PART_IDS,
      changedFields: ["construction-semantics"],
    });
  });

  it("filters later interpretation rows through the exact old source roster", async () => {
    const version10ShellPartIds = await getVersion10ShellPartIds();
    const report = reportAt(REVIEWED_TRUTH_V1);
    const sourceRoster = getReviewedHistoricalCatalogRoster(report.fromTruthHash);
    expect(sourceRoster).toBeDefined();
    const version10IdsPresentAtV1 = version10ShellPartIds.filter((partId) =>
      sourceRoster!.catalogPartIds.includes(partId),
    );
    expect(version10IdsPresentAtV1).toHaveLength(14);

    expect(changesAt(report, "builtin.basic-parts/4", "builtin.basic-parts/4")).toEqual([]);
    expect(changesAt(report, "builtin.basic-parts/4", "builtin.basic-parts/5")).toEqual([]);
    expect(changesAt(report, "builtin.basic-parts/5", "builtin.basic-parts/6")).toEqual([]);
    expect(changesAt(report, "builtin.basic-parts/8", "builtin.basic-parts/9")[0]).toMatchObject({
      affectedCatalogPartIds: ["builtin:plate-2x4"],
    });
    expect(changesAt(report, "builtin.basic-parts/9", "builtin.basic-parts/10")[0]).toMatchObject({
      affectedCatalogPartIds: version10IdsPresentAtV1,
    });
    expect(changesAt(report, "builtin.basic-parts/10", "builtin.basic-parts/11")).toEqual([]);
  });
});
