import { isDeepStrictEqual } from "node:util";

import {
  BUILTIN_CATALOG_VERSION,
  CONNECTOR_PAIR_RULES,
  PART_DEFINITIONS,
  getPartDefinition,
} from "@lego-studio/catalog";
import type { CollisionPrimitive, PartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import {
  diffConnectionSemantics,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { partDefinitionsAt } from "./historical-catalog-archive.test-support.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import type { ReviewedCarriedEndpointDelta } from "./historical-connection-carry-forward.ts";
import {
  VALIDATED_STUD_PROFILE_ADDED,
  carriedEndpointDeltaProofFailures,
  carriedEndpointPeerFailure,
} from "./historical-connection-carry-forward.ts";
import { REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH } from "./historical-connection-semantics.ts";
import {
  EXPECTED_V31_INTERPRETATION_CHANGE,
  EXPECTED_V31_STUD_PROFILE_CHANGES,
  EXPECTED_V31_STUD_PROFILE_PART_IDS,
  REVIEWED_TRUTH_V30,
  expectedV31CarriedDeltas,
  sortedEndpointDeltas,
} from "./migration-v31-fixtures.test-support.ts";
import {
  REVIEWED_CATALOG_INTERPRETATION_CHANGES,
  REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS,
  migrateDocumentTruth,
} from "./migration.ts";
import { validateBrickDocument } from "./validation.ts";

/**
 * A document saved at builtin.basic-parts/30 carries forward to /31. /31 adds
 * no part: seven measured parts whose stud cylinders keep the LDraw source
 * radius gain the nominal-stud-tube/1 validated-connection profile, and a saved
 * edge on one of their studs is carried because only its collision relaxes.
 *
 * Bound: the carried document is one 3023 plate on a 15254 arch (the booklet
 * step 32 case); the proof refusals use the live arch with its profile stripped
 * or its radius forged, so they prove the checks, not any real historical
 * catalog. `npm run migration-history:check` runs the proof over every real
 * row. The "names exactly" case diffs source commit c6356f7 against the live
 * catalog, so a later truth change shows up here and must get its own row.
 */
const V30_TRUTH_HASH = "sha256:cf2d67907369f85551055665b6df0f849dd978d2e63330130ec2d2db8f6ccc0b";
const V30_SOURCE_COMMIT = "c6356f76520b130c326e2a6df3917045df551085";
const ARCH = "builtin:arch-1x6-thin-top";
const PLATE = "builtin:plate-1x2";

function documentSavedAtV30(
  parts: readonly PartInstance[] = [],
  connections: readonly ConnectionEdge[] = [],
): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "v30", name: "Saved at /30" });
  const roster = getReviewedHistoricalCatalogRoster(V30_TRUTH_HASH);
  if (roster === undefined) throw new Error("The reviewed /30 roster fixture is missing.");
  const partIds = parts.map(({ id }) => id);
  return {
    ...current,
    truth: REVIEWED_TRUTH_V30,
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

/** A 3023 plate seated on the arch's first two studs, as booklet step 32 places it. */
function plateOnArch() {
  const arch = createPartInstance({ id: "v30-arch", catalogPartId: ARCH });
  const plate = createPartInstance({
    id: "v30-plate",
    catalogPartId: PLATE,
    transform: { positionLdu: [0, -28, -40], orientationId: "upright-yaw-0" },
  });
  const edge = (index: 0 | 1): ConnectionEdge => ({
    id: `v30-arch-stud-${index}`,
    kind: "stud-tube",
    a: { partId: arch.id, portId: `stud:${index}` },
    b: { partId: plate.id, portId: `undersideClutch:0:${index}` },
    provenance: { source: "manual" },
  });
  return { parts: [arch, plate], connections: [edge(0), edge(1)] };
}

/** The live arch minus its /31 profile: what source commit c6356f7 defines. */
function withoutProfile(definition: PartDefinition): PartDefinition {
  const without = <T extends object>(value: T, field: string): T =>
    Object.fromEntries(Object.entries(value).filter(([name]) => name !== field)) as T;
  const unprofiled = (primitive: CollisionPrimitive): CollisionPrimitive =>
    primitive.kind === "cylinder"
      ? without(primitive, "validatedConnectionProfileRadiusLdu")
      : primitive;
  return {
    ...definition,
    collision: {
      ...without(definition.collision, "validatedConnectionStudProfile"),
      primitives: definition.collision.primitives.map(unprofiled),
    },
  };
}

function archProofInput(sourceArch: PartDefinition, targetArch: PartDefinition) {
  const semanticConnectorKinds = [
    ...new Set(PART_DEFINITIONS.flatMap(({ connectors }) => connectors.map(({ kind }) => kind))),
  ];
  const endpointDeltas = diffConnectionSemantics(
    projectConnectionSemantics([sourceArch], CONNECTOR_PAIR_RULES, "reviewed-historical"),
    projectConnectionSemantics([targetArch], CONNECTOR_PAIR_RULES, "live-strict", {
      semanticConnectorKinds,
    }),
  );
  return { endpointDeltas, semanticConnectorKinds };
}

const ARCH_CARRIED: readonly ReviewedCarriedEndpointDelta[] = expectedV31CarriedDeltas(
  EXPECTED_V31_STUD_PROFILE_CHANGES.filter(({ partId }) => partId === ARCH),
);

describe("builtin.basic-parts/30 migration", () => {
  it("pins the complete /30 truth and the snapshot that names it", () => {
    expect(canonicalDigest(REVIEWED_TRUTH_V30)).toBe(V30_TRUTH_HASH);
    expect(REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.at(-1)).toEqual({
      catalogVersion: "builtin.basic-parts/30",
      sourceCommit: V30_SOURCE_COMMIT,
      truthHash: V30_TRUTH_HASH,
    });
  });

  it("pins the complete /30 connector authority that /31 reinterprets", () => {
    expect(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[V30_TRUTH_HASH]).toEqual({
      sourceCommit: V30_SOURCE_COMMIT,
      sourceEndpointCount: 2340,
      sourceEndpointMapDigest:
        "sha256:e831383ea4cf95204c5996eeef89010f16a3f048884a69a45e2c31a071831219",
      sourcePairCount: 4,
      sourcePairMapDigest:
        "sha256:92dd1cdfb9f34879f55a5ee5a0827b5c24c830da654c90bd3b00896025ca5731",
      endpointDeltas: sortedEndpointDeltas(EXPECTED_V31_STUD_PROFILE_CHANGES),
      pairDeltas: [],
      carriedEndpointDeltas: expectedV31CarriedDeltas(EXPECTED_V31_STUD_PROFILE_CHANGES),
    });
  });

  it("carries each /31 stud delta in every source truth that has its part, and only those", () => {
    const seven = new Set<string>(EXPECTED_V31_STUD_PROFILE_PART_IDS);
    for (const { truthHash } of REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS) {
      const roster = getReviewedHistoricalCatalogRoster(truthHash)!;
      const row = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[truthHash]!;
      const held = EXPECTED_V31_STUD_PROFILE_CHANGES.filter(({ partId }) =>
        roster.catalogPartIds.includes(partId),
      );
      expect(
        row.endpointDeltas.filter(
          ({ partId, portId }) => seven.has(partId) && portId.startsWith("stud:"),
        ),
        truthHash,
      ).toEqual(sortedEndpointDeltas(held));
      expect(
        (row.carriedEndpointDeltas ?? []).filter(
          ({ deltaClass }) => deltaClass === VALIDATED_STUD_PROFILE_ADDED,
        ),
        truthHash,
      ).toEqual(expectedV31CarriedDeltas(held));
    }
  });

  it("carries a /30 document to /31 and names the stud-profile reinterpretation", () => {
    const saved = documentSavedAtV30([createPartInstance({ id: "v30-arch", catalogPartId: ARCH })]);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(report.fromTruthHash).toBe(V30_TRUTH_HASH);
    expect(report.toCatalogVersion).toBe(BUILTIN_CATALOG_VERSION);
    expect(report.addedCatalogPartIds).toEqual([]);
    expect(report.addedColorIds).toEqual([]);
    expect(report.catalogInterpretationChanges).toEqual([EXPECTED_V31_INTERPRETATION_CHANGE]);
    // Only the catalog label moves: /31 keeps the /30 connector taxonomy,
    // collision model, transform policy and validator set versions.
    expect(report.truthComponentChanges).toEqual([
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/30",
        toVersion: BUILTIN_CATALOG_VERSION,
      },
    ]);
    expect(document.parts).toEqual(saved.parts);
  });

  it("carries a /30 plate seated on 15254's studs, reports both edges, and validates", () => {
    const { parts, connections } = plateOnArch();
    const saved = documentSavedAtV30(parts, connections);

    const { document, report } = migrateDocumentTruth(saved);

    expect(report.blockingReasons).toEqual([]);
    expect(report.migrated).toBe(true);
    expect(document.connections).toEqual(connections);
    expect(report.catalogInterpretationChanges).toEqual([
      {
        ...EXPECTED_V31_INTERPRETATION_CHANGE,
        carriedConnectionEndpoints: connections.map(({ id, a }) => ({
          connectionId: id,
          partId: "v30-arch",
          catalogPartId: ARCH,
          portId: a.portId,
          deltaClass: VALIDATED_STUD_PROFILE_ADDED,
          addedValidatedConnectionStudProfile: "nominal-stud-tube/1",
        })),
      },
    ]);
    // The step 32 defect: under /30 this plate collided with the arch's studs.
    const validation = validateBrickDocument(document);
    expect(validation.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);
    expect(validation.issues.map(({ code }) => code)).not.toContain("PART_STUD_BODY_COLLISION");
  });

  it("proves the stud-profile class on 15254 and refuses what is not that class", () => {
    const archNow = getPartDefinition(ARCH)!;
    const archThen = withoutProfile(archNow);
    const input = archProofInput(archThen, archNow);
    // Stripping the profile rebuilds exactly the reviewed /30 source digests.
    expect(input.endpointDeltas).toEqual(
      EXPECTED_V31_STUD_PROFILE_CHANGES.filter(({ partId }) => partId === ARCH),
    );
    const proof = (
      sourceParts: readonly PartDefinition[],
      targetParts: readonly PartDefinition[],
    ) =>
      carriedEndpointDeltaProofFailures({
        truthHash: V30_TRUTH_HASH,
        carried: ARCH_CARRIED,
        pairRules: CONNECTOR_PAIR_RULES,
        ...input,
        sourceParts,
        targetParts,
      });
    expect(proof([archThen], [archNow])).toEqual([]);

    // A source that already had the profile did not gain it.
    expect(proof([archNow], [archNow])).toContain(
      `${V30_TRUTH_HASH} ${ARCH}/stud:0: the source part already declared validated stud profile nominal-stud-tube/1`,
    );
    // A profile radius above the measured radius would add collision, not relax it.
    const widened: PartDefinition = {
      ...archNow,
      collision: {
        ...archNow.collision,
        primitives: archNow.collision.primitives.map((primitive) =>
          primitive.kind === "cylinder" && primitive.id === "stud:0"
            ? { ...primitive, validatedConnectionProfileRadiusLdu: 6.5 }
            : primitive,
        ),
      },
    };
    expect(proof([archThen], [widened]).join("\n")).toContain(
      "stud cylinder profile radius 6.5 is not at most its measured radius 6.0001514980873605",
    );
    // Migration re-checks the live part: without the profile the carry stops.
    expect(
      carriedEndpointPeerFailure(ARCH_CARRIED[0]!, input.endpointDeltas[0]!, [], archThen),
    ).toBe(
      `current ${ARCH} declares validated stud profile undefined, not the reviewed nominal-stud-tube/1`,
    );
  });

  it("names exactly the parts whose interpretation moved since /30 source commit c6356f7", async () => {
    const historical = await partDefinitionsAt(V30_SOURCE_COMMIT);
    const historicalById = new Map(historical.map((part) => [part["id"], part]));
    // Project-authored provenance carries the catalog label, so compare under
    // the /30 label; JSON round trips drop undefined keys on both sides.
    const plain = (value: unknown): unknown =>
      value === undefined
        ? undefined
        : JSON.parse(
            JSON.stringify(value).replaceAll(BUILTIN_CATALOG_VERSION, "builtin.basic-parts/30"),
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
        ({ fromCatalogVersion }) => fromCatalogVersion === "builtin.basic-parts/30",
      ),
    ).toEqual([EXPECTED_V31_INTERPRETATION_CHANGE]);
    expect(historical.map((part) => part["id"])).toEqual(PART_DEFINITIONS.map(({ id }) => id));
    // Only collision moved, and only for the seven: no geometry, connector or frame did.
    expect(moved("collision")).toEqual([...EXPECTED_V31_STUD_PROFILE_PART_IDS]);
    for (const field of fields) {
      if (field === "collision") continue;
      expect(moved(field), field).toEqual([]);
    }
  });
});
