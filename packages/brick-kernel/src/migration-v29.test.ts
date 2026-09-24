import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { BUILTIN_CATALOG_VERSION, PART_DEFINITIONS } from "@lego-studio/catalog";
import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  PartPortRef,
} from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { extractTarArchive } from "../../../scripts/tar-archive.mjs";
import { canonicalDigest } from "./canonical.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS } from "./historical-connection-carry-forward.ts";
import { REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH } from "./historical-connection-semantics.ts";
import {
  EXPECTED_JUMPER_1X2_CARRIED_ENDPOINT_DELTAS,
  EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES,
  EXPECTED_V30_INTERPRETATION_CHANGES,
  EXPECTED_V30_LDRAW_FRAME_PART_IDS,
  REVIEWED_TRUTH_V29,
} from "./migration-historical-fixtures.test-support.ts";
import {
  REVIEWED_CATALOG_INTERPRETATION_CHANGES,
  REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS,
  migrateDocumentTruth,
} from "./migration.ts";
import { validateBrickDocument } from "./validation.ts";

/**
 * A document saved at builtin.basic-parts/29 carries forward to /30. /30 adds
 * no part: it gives every parametric part its measured LDraw interchange frame
 * and 15573 a centre seat whose capacity its two grid clutches share.
 *
 * Bound: the "names exactly" case diffs source commit 982634d against the live
 * catalog, so a later truth change to any part shows up here too and must be
 * reviewed into its own row.
 */
const V29_TRUTH_HASH = "sha256:54762419e4779c6c15566052062fcaa432cb45e3a13704b5af1563b4fa94e8eb";
const V29_SOURCE_COMMIT = "982634de7ddcb75310a802b9cc4dbba9d19d3d9c";
const JUMPER = "builtin:jumper-plate-1x2";

function documentSavedAtV29(
  parts: readonly PartInstance[] = [],
  connections: readonly ConnectionEdge[] = [],
): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v29", name: "Saved at /29" });
  const roster = getReviewedHistoricalCatalogRoster(V29_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /29 roster fixture is missing.");
  const partIds = parts.map(({ id }) => id);
  return {
    ...current,
    truth: REVIEWED_TRUTH_V29,
    parts,
    connections,
    submodels: [{ ...current.submodels[0]!, partIds }],
    steps: [{ ...current.steps[0]!, partIds }],
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: roster.catalogPartIds,
      allowedColorIds: roster.colorIds,
    },
  };
}

/**
 * 15573 on a 1 x 1 plate that sits in its negative-z grid clutch, with a 1 x 1
 * tile on its stud, which /30 left unchanged.
 */
function jumperOnGridClutch() {
  const jumper = createPartInstance({
    id: "v29-jumper",
    catalogPartId: JUMPER,
    transform: { positionLdu: [10, 0, 0], orientationId: "upright-yaw-0" },
  });
  const plate = createPartInstance({
    id: "v29-plate",
    catalogPartId: "builtin:plate-1x1",
    transform: { positionLdu: [10, 8, -10], orientationId: "upright-yaw-0" },
  });
  const tile = createPartInstance({
    id: "v29-tile",
    catalogPartId: "builtin:tile-1x1",
    transform: { positionLdu: [10, -8, 0], orientationId: "upright-yaw-0" },
  });
  const edge = (id: string, stud: PartPortRef, clutch: PartPortRef): ConnectionEdge => ({
    id,
    kind: "stud-tube",
    a: stud,
    b: clutch,
    provenance: { source: "manual" },
  });
  return {
    parts: [jumper, plate, tile],
    gridEdge: edge(
      "v29-grid-clutch-edge",
      { partId: plate.id, portId: "stud:0:0" },
      { partId: jumper.id, portId: "undersideClutch:0:0" },
    ),
    studEdge: edge(
      "v29-stud-edge",
      { partId: jumper.id, portId: "stud:0" },
      { partId: tile.id, portId: "undersideClutch:0:0" },
    ),
  };
}

async function partDefinitionsAt(commit: string): Promise<readonly Record<string, unknown>[]> {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const outputRoot = resolve(repositoryRoot, "output");
  mkdirSync(outputRoot, { recursive: true });
  const temporaryRoot = realpathSync(mkdtempSync(join(outputRoot, "migration-v29-catalog-")));
  const relation = relative(realpathSync(outputRoot), temporaryRoot);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`)) {
    throw new Error(`Refusing cleanup outside ignored output root; resolved ${temporaryRoot}.`);
  }
  try {
    const archivePath = join(temporaryRoot, `${commit}.tar`);
    const extractionRoot = join(temporaryRoot, commit);
    mkdirSync(extractionRoot, { recursive: true });
    const args = ["-c", `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`, "archive"];
    args.push("--format=tar", `--output=${archivePath}`, commit, "package.json");
    args.push("packages/catalog/package.json", "packages/catalog/src");
    const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(
        `git archive of ${commit} failed with exit ${result.status}: ${result.stderr}`,
      );
    }
    extractTarArchive(archivePath, extractionRoot);
    const catalogUrl = pathToFileURL(join(extractionRoot, "packages/catalog/src/catalog.ts"));
    const historical = (await import(`${catalogUrl.href}?commit=${commit}`)) as {
      readonly PART_DEFINITIONS?: readonly Record<string, unknown>[];
    };
    if (!Array.isArray(historical.PART_DEFINITIONS)) {
      throw new Error(`${commit} did not export PART_DEFINITIONS from catalog.ts.`);
    }
    return historical.PART_DEFINITIONS;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

describe("builtin.basic-parts/29 migration", () => {
  it("pins the complete /29 truth the reviewed snapshot names", () => {
    expect(canonicalDigest(REVIEWED_TRUTH_V29)).toBe(V29_TRUTH_HASH);
  });

  it("pins the complete /29 connector authority that /30 reinterprets", () => {
    expect(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[V29_TRUTH_HASH]).toEqual({
      sourceCommit: V29_SOURCE_COMMIT,
      sourceEndpointCount: 2339,
      sourceEndpointMapDigest:
        "sha256:3ee33ad94b3f4ff2ea0024c27753d871f26b7bbe0cd8d74c7309287c804d2be9",
      sourcePairCount: 4,
      sourcePairMapDigest:
        "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731",
      endpointDeltas: EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES,
      pairDeltas: [],
      carriedEndpointDeltas: EXPECTED_JUMPER_1X2_CARRIED_ENDPOINT_DELTAS,
    });
  });

  it("carries 15573's three /30 deltas in every source truth that has 15573, and only those", () => {
    for (const { truthHash } of REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS) {
      const roster = getReviewedHistoricalCatalogRoster(truthHash);
      const row = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[truthHash];
      expect(
        row?.endpointDeltas.filter(({ partId }) => partId === JUMPER),
        truthHash,
      ).toEqual(
        roster?.catalogPartIds.includes(JUMPER) ? EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES : [],
      );
      // Every such row carries saved edges on the two grid clutches; no other row carries any.
      expect(row?.carriedEndpointDeltas, truthHash).toEqual(
        roster?.catalogPartIds.includes(JUMPER)
          ? EXPECTED_JUMPER_1X2_CARRIED_ENDPOINT_DELTAS
          : undefined,
      );
    }
  });

  it("carries a /29 document to /30 and names the frame and 15573 reinterpretations", () => {
    const jumper = createPartInstance({ id: "v29-jumper", catalogPartId: JUMPER });
    const longPlate = createPartInstance({
      id: "v29-long-plate",
      catalogPartId: "builtin:plate-2x14",
      transform: { positionLdu: [0, 40, 0], orientationId: "upright-yaw-90" },
    });
    const saved = documentSavedAtV29([jumper, longPlate]);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(report.fromTruthHash).toBe(V29_TRUTH_HASH);
    expect(report.toCatalogVersion).toBe(BUILTIN_CATALOG_VERSION);
    expect(report.addedCatalogPartIds).toEqual([]);
    expect(report.addedColorIds).toEqual([]);
    expect(EXPECTED_V30_LDRAW_FRAME_PART_IDS).toHaveLength(61);
    expect(report.catalogInterpretationChanges).toEqual(EXPECTED_V30_INTERPRETATION_CHANGES);
    // Only the catalog label moves: /30 keeps the /29 connector taxonomy,
    // collision model, transform policy and validator set versions.
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/29",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
    expect(document.connections).toEqual([]);
  });

  it("carries a /29 edge on a 15573 grid clutch, reports it under the /30 row, and validates", () => {
    const { parts, gridEdge, studEdge } = jumperOnGridClutch();
    const connected = documentSavedAtV29(parts, [gridEdge, studEdge]);

    const { document, report } = migrateDocumentTruth(connected);

    // The grid clutch changed only by sharing a cell with the new centre seat,
    // which no /29 document can use, so the edge keeps its meaning.
    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(document.connections).toEqual([gridEdge, studEdge]);
    expect(report.catalogInterpretationChanges).toEqual([
      EXPECTED_V30_INTERPRETATION_CHANGES[0],
      {
        ...EXPECTED_V30_INTERPRETATION_CHANGES[1],
        carriedConnectionEndpoints: [
          {
            connectionId: gridEdge.id,
            partId: "v29-jumper",
            catalogPartId: JUMPER,
            portId: "undersideClutch:0:0",
            deltaClass: CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS,
            addedSharedCapacityGroupIds: ["15573:negative-z-half"],
          },
        ],
      },
    ]);
    const validation = validateBrickDocument(document);
    expect(validation.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);
    expect(validation.documentGloballyValid).toBe(true);
  });

  it("names exactly the parts whose interpretation moved since /29 source commit 982634d", async () => {
    const historical = await partDefinitionsAt(V29_SOURCE_COMMIT);
    const historicalById = new Map(historical.map((part) => [part["id"], part]));
    // Project-authored provenance carries the catalog label, so compare under
    // the /29 label; JSON round trips drop undefined keys on both sides.
    const plain = (value: unknown): unknown =>
      value === undefined
        ? undefined
        : JSON.parse(
            JSON.stringify(value).replaceAll(BUILTIN_CATALOG_VERSION, "builtin.basic-parts/29"),
          );
    const moved = (field: string) =>
      PART_DEFINITIONS.filter((part) => {
        const before = historicalById.get(part.id);
        return !isDeepStrictEqual(
          plain((part as unknown as Record<string, unknown>)[field]),
          plain(before?.[field]),
        );
      }).map(({ id }) => id);
    const fields = new Set([
      ...historical.flatMap((part) => Object.keys(part)),
      ...PART_DEFINITIONS.flatMap((part) => Object.keys(part)),
    ]);

    expect(
      REVIEWED_CATALOG_INTERPRETATION_CHANGES.filter(
        ({ fromCatalogVersion }) => fromCatalogVersion === "builtin.basic-parts/29",
      ),
    ).toEqual(EXPECTED_V30_INTERPRETATION_CHANGES);
    expect(historical.map((part) => part["id"])).toEqual(PART_DEFINITIONS.map(({ id }) => id));
    expect(moved("ldrawFrame")).toEqual(EXPECTED_V30_LDRAW_FRAME_PART_IDS);
    expect(moved("connectors")).toEqual([JUMPER]);
    expect(moved("collision")).toEqual([JUMPER]);
    // 15573's recipe records its new seat, so its geometry content hash moves.
    expect(moved("geometry")).toEqual([JUMPER]);
    for (const field of fields) {
      if (["ldrawFrame", "connectors", "collision", "geometry"].includes(field)) continue;
      expect(moved(field), field).toEqual([]);
    }
  });
});
