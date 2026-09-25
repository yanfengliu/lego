import { isDeepStrictEqual } from "node:util";

import { BUILTIN_CATALOG_VERSION, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import {
  HISTORICAL_CATALOG_TEST_TIMEOUT_MS,
  partDefinitionsAt,
} from "./historical-catalog-archive.test-support.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import { REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH } from "./historical-connection-semantics.ts";
import {
  EXPECTED_V32_INTERPRETATION_CHANGE,
  EXPECTED_V32_RECESS_CLUTCH_ADDITIONS,
  REVIEWED_TRUTH_V31,
  V32_BRACKET_PART_ID,
} from "./migration-v32-fixtures.test-support.ts";
import {
  REVIEWED_CATALOG_INTERPRETATION_CHANGES,
  REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS,
  migrateDocumentTruth,
} from "./migration.ts";
import { getConnectorWorldFrame } from "./transforms.ts";
import { validateBrickDocument } from "./validation.ts";

/**
 * A document saved at builtin.basic-parts/31 carries forward to /32. /32 adds
 * no part: bracket 41682 gains the two clutch seats of its wall's back recess,
 * facing +Z (undersideClutch:4 and :5), and solid-interval collision boxes.
 * Its studs and four underside clutches keep their frames, capacity and
 * allowances, so an edge on any of them migrates unchanged, and no /31
 * document can name the two new seats.
 *
 * Bound: the carried document is one bracket with a 2 x 2 plate on its four
 * underside clutches and a round-end plate on its two side studs; the
 * "names exactly" case diffs source commit 1299598 against the live catalog,
 * so a later truth change shows up here and must get its own row.
 */
const V31_TRUTH_HASH = "sha256:b2ca21fb0fefefa18c17229cdcf1235475031bc2892d5d514103d45473a7d474";
const V31_SOURCE_COMMIT = "12995985b8a151b5e4bec84076e717e050be0fb3";

function documentSavedAtV31(
  parts: readonly PartInstance[] = [],
  connections: readonly ConnectionEdge[] = [],
): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v31", name: "Saved at /31" });
  const roster = getReviewedHistoricalCatalogRoster(V31_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /31 roster fixture is missing.");
  const partIds = parts.map(({ id }) => id);
  return {
    ...current,
    truth: REVIEWED_TRUTH_V31,
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

/** Every stud-tube edge between two parts whose ports coincide and face each other. */
function edgesBetween(host: PartInstance, other: PartInstance, hostPortIds: readonly string[]) {
  const otherPorts = PART_DEFINITIONS.find(({ id }) => id === other.catalogPartId)!.connectors;
  return hostPortIds.map((hostPortId, index): ConnectionEdge => {
    const hostFrame = getConnectorWorldFrame(host, hostPortId);
    const match = otherPorts.find(({ id }) => {
      const frame = getConnectorWorldFrame(other, id);
      return (
        frame.kind !== hostFrame.kind &&
        frame.positionLdu.every((value, axis) => value === hostFrame.positionLdu[axis]) &&
        frame.normal.every((value, axis) => value === -hostFrame.normal[axis]!)
      );
    });
    if (match === undefined) throw new Error(`${other.id} has no port facing ${hostPortId}`);
    return {
      id: `${other.id}-${index}`,
      kind: "stud-tube",
      a: { partId: host.id, portId: hostPortId },
      b: { partId: other.id, portId: match.id },
      provenance: { source: "manual" },
    };
  });
}

/** A bracket on a 2 x 2 plate by its four underside clutches, with a round-end plate on its side studs. */
function bracketOnItsExistingPorts() {
  const bracket = createPartInstance({ id: "v31-bracket", catalogPartId: V32_BRACKET_PART_ID });
  const base = createPartInstance({
    id: "v31-base",
    catalogPartId: "builtin:plate-2x2",
    transform: { positionLdu: [0, 18, 0], orientationId: "upright-yaw-0" },
  });
  const front = createPartInstance({
    id: "v31-front",
    catalogPartId: "builtin:plate-1x2-round-end",
    transform: { positionLdu: [0, -4, -8], orientationId: "proper-m-00nn000p0" },
  });
  const connections = [
    ...edgesBetween(
      bracket,
      base,
      [0, 1, 2, 3].map((index) => `undersideClutch:${index}`),
    ),
    ...edgesBetween(bracket, front, ["stud:0", "stud:1"]),
  ];
  return { parts: [bracket, base, front], connections };
}

describe("builtin.basic-parts/31 migration", () => {
  it("pins the complete /31 truth and the snapshot that names it", () => {
    expect(canonicalDigest(REVIEWED_TRUTH_V31)).toBe(V31_TRUTH_HASH);
    expect(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.at(-1)).toEqual({
      catalogVersion: "builtin.basic-parts/31",
      sourceCommit: V31_SOURCE_COMMIT,
      truthHash: V31_TRUTH_HASH,
    });
  });

  it("pins the complete /31 connector authority that /32 extends", () => {
    expect(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[V31_TRUTH_HASH]).toEqual({
      sourceCommit: V31_SOURCE_COMMIT,
      sourceEndpointCount: 2340,
      sourceEndpointMapDigest:
        "sha256:d1b8e31895ee0eef012019fcfbcccea0d359097afa1d151a3cf0e049e8a12f8a",
      sourcePairCount: 4,
      sourcePairMapDigest:
        "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731",
      // Two additions and nothing else: no carry class, no changed endpoint.
      endpointDeltas: EXPECTED_V32_RECESS_CLUTCH_ADDITIONS,
      pairDeltas: [],
    });
  });

  it("adds 41682's two recess seats to every source truth that has the part, and only those", () => {
    for (const { truthHash } of REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS) {
      const roster = getReviewedHistoricalCatalogRoster(truthHash)!;
      const row = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[truthHash]!;
      const bracketDeltas = row.endpointDeltas.filter(
        ({ partId, portId }) =>
          partId === V32_BRACKET_PART_ID && portId.startsWith("undersideClutch:"),
      );
      expect(bracketDeltas, truthHash).toEqual(
        roster.catalogPartIds.includes(V32_BRACKET_PART_ID)
          ? EXPECTED_V32_RECESS_CLUTCH_ADDITIONS
          : [],
      );
      expect(
        (row.carriedEndpointDeltas ?? []).filter(({ portId }) =>
          ["undersideClutch:4", "undersideClutch:5"].includes(portId),
        ),
        truthHash,
      ).toEqual([]);
    }
  });

  it("migrates a /31 document with edges on 41682's existing ports unchanged, and validates", () => {
    const { parts, connections } = bracketOnItsExistingPorts();
    const saved = documentSavedAtV31(parts, connections);
    // Four underside clutches and both side studs: every port 41682 had at /31.
    expect(connections).toHaveLength(6);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(report.fromTruthHash).toBe(V31_TRUTH_HASH);
    expect(report.toCatalogVersion).toBe(BUILTIN_CATALOG_VERSION);
    expect(report.addedCatalogPartIds).toEqual([]);
    // Unchanged endpoints need no carry class, so the row lists no carried edge.
    expect(report.catalogInterpretationChanges).toEqual([EXPECTED_V32_INTERPRETATION_CHANGE]);
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/31",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    // Migration normalizes part, edge and endpoint order, so compare without it.
    const byId = <T extends { id: string }>(rows: readonly T[]) =>
      [...rows].sort((left, right) => (left.id < right.id ? -1 : 1));
    const edgeKeys = (edges: readonly ConnectionEdge[]) =>
      edges
        .map(
          ({ id, a, b }) =>
            `${id}|${[`${a.partId}/${a.portId}`, `${b.partId}/${b.portId}`].sort().join("|")}`,
        )
        .sort();
    expect(byId(document.parts)).toEqual(byId(saved.parts));
    expect(edgeKeys(document.connections)).toEqual(edgeKeys(connections));
    const validation = validateBrickDocument(document);
    expect(validation.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);
    expect(validation.documentGloballyValid).toBe(true);
  });

  it("refuses a /31 edge that names a recess seat /31 never had", () => {
    const { parts, connections } = bracketOnItsExistingPorts();
    const forged: ConnectionEdge = {
      ...connections[0]!,
      id: "v31-forged",
      a: { partId: "v31-bracket", portId: "undersideClutch:4" },
    };

    const { report } = migrateDocumentTruth(documentSavedAtV31(parts, [forged]));

    expect(report.migrated).toBe(false);
    expect(report.blockingReasons.join("\n")).toContain("undersideClutch:4");
  });

  it(
    "names exactly the parts whose interpretation moved since /31 source commit 1299598",
    async () => {
      const historical = await partDefinitionsAt(V31_SOURCE_COMMIT);
      const historicalById = new Map(historical.map((part) => [part["id"], part]));
      // Project-authored provenance carries the catalog label, so compare under
      // the /31 label; JSON round trips drop undefined keys on both sides.
      const plain = (value: unknown): unknown =>
        value === undefined
          ? undefined
          : JSON.parse(
              JSON.stringify(value).replaceAll(BUILTIN_CATALOG_VERSION, "builtin.basic-parts/31"),
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
          ({ fromCatalogVersion }) => fromCatalogVersion === "builtin.basic-parts/31",
        ),
      ).toEqual([EXPECTED_V32_INTERPRETATION_CHANGE]);
      expect(historical.map((part) => part["id"])).toEqual(PART_DEFINITIONS.map(({ id }) => id));
      // Connectors and collision moved for 41682 alone; no geometry, frame or other field did.
      expect(moved("connectors")).toEqual([V32_BRACKET_PART_ID]);
      expect(moved("collision")).toEqual([V32_BRACKET_PART_ID]);
      for (const field of fields) {
        if (field === "connectors" || field === "collision") continue;
        expect(moved(field), field).toEqual([]);
      }
      // The four underside clutches and both studs read exactly as they did.
      const before = historicalById.get(V32_BRACKET_PART_ID)!["connectors"] as unknown[];
      const now = PART_DEFINITIONS.find(({ id }) => id === V32_BRACKET_PART_ID)!.connectors;
      expect(now.slice(0, before.length)).toEqual(before);
    },
    HISTORICAL_CATALOG_TEST_TIMEOUT_MS,
  );
});
