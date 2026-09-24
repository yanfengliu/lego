import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { PartDefinition } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import {
  diffConnectionSemantics,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";
import {
  createBuiltinTruthSnapshot,
  createEmptyBrickDocument,
  createPartInstance,
} from "./factory.ts";
import { getReviewedHistoricalCatalogRoster } from "./historical-catalog-rosters.ts";
import type { ReviewedCarriedEndpointDelta } from "./historical-connection-carry-forward.ts";
import {
  CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS,
  carriedEndpointDeltaProofFailures,
} from "./historical-connection-carry-forward.ts";
import {
  REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
  assessHistoricalConnectionSemantics,
} from "./historical-connection-semantics.ts";
import {
  EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES,
  REVIEWED_TRUTH_V29,
  REVIEWED_TRUTHS_V4,
} from "./migration-historical-fixtures.test-support.ts";
import { migrateDocumentTruth } from "./migration.ts";
import { validateBrickDocument } from "./validation.ts";

/**
 * A saved edge on a 15573 grid clutch carries across /30, from any source
 * truth that has the part, and only because the one reviewed class holds:
 * the clutch gains nothing but a capacity group whose other member is the
 * centre seat no saved document can use.
 *
 * Bound: the carried documents are one jumper on a 1 x 2 plate, saved at /29
 * and at the first /4 truth; the refusals use a hand-built row and hand-built
 * source parts, so they prove the checks, not any real historical catalog.
 * `npm run migration-history:check` runs the proof over every real row.
 */
const JUMPER = "builtin:jumper-plate-1x2";
const V29_TRUTH_HASH = canonicalDigest(REVIEWED_TRUTH_V29);
const FIRST_V4 = REVIEWED_TRUTHS_V4[0]!;

/** 15573 seated on a 1 x 2 plate by both grid clutches, as LDraw subset /1 files wrote it. */
function jumperOnPlate(truth: BrickDocumentV1["truth"]): BrickDocumentV1 {
  const current = createEmptyBrickDocument({ id: "jumper-on-plate", name: "Jumper on a plate" });
  const roster = getReviewedHistoricalCatalogRoster(canonicalDigest(truth));
  if (roster === undefined) throw new Error("The reviewed roster fixture is missing.");
  const plate = createPartInstance({
    id: "plate",
    catalogPartId: "builtin:plate-1x2",
    transform: { positionLdu: [10, 8, 0], orientationId: "upright-yaw-0" },
  });
  const jumper = createPartInstance({
    id: "jumper",
    catalogPartId: JUMPER,
    transform: { positionLdu: [10, 0, 0], orientationId: "upright-yaw-0" },
  });
  const edge = (id: string, stud: string, clutch: string): ConnectionEdge => ({
    id,
    kind: "stud-tube",
    a: { partId: plate.id, portId: stud },
    b: { partId: jumper.id, portId: clutch },
    provenance: { source: "manual" },
  });
  const partIds = [plate.id, jumper.id];
  return {
    ...current,
    truth,
    parts: [plate, jumper],
    connections: [
      edge("near", "stud:0:0", "undersideClutch:0:0"),
      edge("far", "stud:0:1", "undersideClutch:0:1"),
    ],
    submodels: [{ ...current.submodels[0]!, partIds }],
    steps: [{ ...current.steps[0]!, partIds }],
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: roster.catalogPartIds,
      allowedColorIds: roster.colorIds,
    },
  };
}

const CARRIED = [
  {
    connectionId: "near",
    partId: "jumper",
    catalogPartId: JUMPER,
    portId: "undersideClutch:0:0",
    deltaClass: "capacity-cells-added-shared-only-with-endpoints-absent-from-source",
    addedSharedCapacityGroupIds: ["15573:negative-z-half"],
  },
  {
    connectionId: "far",
    partId: "jumper",
    catalogPartId: JUMPER,
    portId: "undersideClutch:0:1",
    deltaClass: "capacity-cells-added-shared-only-with-endpoints-absent-from-source",
    addedSharedCapacityGroupIds: ["15573:positive-z-half"],
  },
];

describe("15573 grid-clutch edges across /30", () => {
  for (const [label, truth] of [
    ["/29", REVIEWED_TRUTH_V29],
    ["/4 (first reviewed truth with 15573)", FIRST_V4.truth],
  ] as const) {
    it(`carries both grid-clutch edges from ${label}, reports them, and validates`, () => {
      const saved = jumperOnPlate(truth);

      const { document, report } = migrateDocumentTruth(saved);

      expect(report.blockingReasons).toEqual([]);
      expect(report.migrated).toBe(true);
      // Migration normalizes the document, which orders connections by id.
      expect(document.connections).toEqual(
        [...saved.connections].sort((left, right) => left.id.localeCompare(right.id)),
      );
      const reporting = report.catalogInterpretationChanges.filter(
        ({ carriedConnectionEndpoints }) => carriedConnectionEndpoints !== undefined,
      );
      expect(reporting).toEqual([
        {
          fromCatalogVersion: "builtin.basic-parts/29",
          toCatalogVersion: "builtin.basic-parts/30",
          affectedCatalogPartIds: [JUMPER],
          changedFields: ["connector-semantics", "collision-semantics"],
          carriedConnectionEndpoints: CARRIED,
        },
      ]);
      const validation = validateBrickDocument(document);
      expect(validation.issues.filter(({ severity }) => severity === "blocking")).toEqual([]);
      expect(validation.documentGloballyValid).toBe(true);
    });
  }

  it("still refuses the edge when a group peer existed in the source, and says how to recover", () => {
    // A row that claims the centre seat already existed at /29: then a saved
    // edge on it could share the grid clutch's cell, so the carry must not hold.
    const reviewed = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[V29_TRUTH_HASH]!;
    const peerExisted = {
      ...reviewed,
      endpointDeltas: reviewed.endpointDeltas.map((delta) =>
        delta.portId === "undersideClutch:center"
          ? { ...delta, sourceDigest: `sha256:${"0".repeat(64)}` as const }
          : delta,
      ),
    };
    const saved = jumperOnPlate(REVIEWED_TRUTH_V29);

    const assessment = assessHistoricalConnectionSemantics(
      saved,
      V29_TRUTH_HASH,
      canonicalDigest(createBuiltinTruthSnapshot()),
      undefined,
      { [V29_TRUTH_HASH]: peerExisted },
    );

    expect(assessment.carriedEndpoints).toEqual([]);
    expect(assessment.blockingReasons).toEqual(
      ["near", "far"].map(
        (id, index) =>
          `Connection ${id} endpoint jumper/undersideClutch:0:${index} changed after reviewed source truth ${V29_TRUTH_HASH}, and its reviewed carry-forward does not hold (undersideClutch:center shares capacity group 15573:${index === 0 ? "negative" : "positive"}-z-half and existed in the source truth, so a saved edge on it could already fill that cell); migration cannot preserve its connector semantics, so remove connection ${id} from the saved document and re-attach the parts after migration`,
      ),
    );
  });

  it("refuses the edge when the row holds no reviewed carry for it", () => {
    const reviewed = REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[V29_TRUTH_HASH]!;
    const unreviewed = Object.fromEntries(
      Object.entries(reviewed).filter(([name]) => name !== "carriedEndpointDeltas"),
    ) as unknown as typeof reviewed;
    const saved = jumperOnPlate(REVIEWED_TRUTH_V29);

    const assessment = assessHistoricalConnectionSemantics(
      saved,
      V29_TRUTH_HASH,
      canonicalDigest(createBuiltinTruthSnapshot()),
      undefined,
      { [V29_TRUTH_HASH]: unreviewed },
    );

    expect(assessment.blockingReasons).toEqual(
      ["near", "far"].map(
        (id, index) =>
          `Connection ${id} endpoint jumper/undersideClutch:0:${index} changed after reviewed source truth ${V29_TRUTH_HASH}; migration cannot preserve its connector semantics, so remove connection ${id} from the saved document and re-attach the parts after migration`,
      ),
    );
  });
});

describe("carried-endpoint proof", () => {
  const live = PART_DEFINITIONS.find(({ id }) => id === JUMPER)!;
  const kinds = [
    ...new Set(
      PART_DEFINITIONS.flatMap(({ connectors }) =>
        connectors.flatMap(({ kind, compatibleKinds }) => [kind, ...compatibleKinds]),
      ),
    ),
  ];
  const ungrouped = (connector: PartDefinition["connectors"][number]) =>
    Object.fromEntries(
      Object.entries(connector).filter(([name]) => name !== "sharedCapacityGroupIds"),
    ) as unknown as PartDefinition["connectors"][number];
  /** What `migration-history:check` computes for one row, over the one part. */
  function prove(source: PartDefinition, carriedFor: (ports: string[]) => string[][]) {
    const project = (parts: readonly PartDefinition[]) =>
      projectConnectionSemantics(parts, CONNECTOR_PAIR_RULES, "live-strict", {
        semanticConnectorKinds: kinds,
      });
    const endpointDeltas = diffConnectionSemantics(project([source]), project([live]));
    const ports = ["undersideClutch:0:0", "undersideClutch:0:1"];
    const groups = carriedFor(ports);
    const carried = ports.map((portId, index) => {
      const delta = endpointDeltas.find((entry) => entry.portId === portId)!;
      return {
        ...delta,
        deltaClass: CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS,
        addedSharedCapacityGroupIds: groups[index]!,
        reportedUnderCatalogVersion: "builtin.basic-parts/30",
      } as ReviewedCarriedEndpointDelta;
    });
    return carriedEndpointDeltaProofFailures({
      truthHash: "synthetic",
      carried,
      endpointDeltas,
      sourceParts: [source],
      targetParts: [live],
      pairRules: CONNECTOR_PAIR_RULES,
      semanticConnectorKinds: kinds,
    });
  }
  const groupsOf = () => [["15573:negative-z-half"], ["15573:positive-z-half"]];

  it("proves the reviewed class against a /29-shaped source, and reproduces the reviewed digests", () => {
    const source = {
      ...live,
      connectors: live.connectors
        .filter(({ id }) => id !== "undersideClutch:center")
        .map(ungrouped),
    } as PartDefinition;

    expect(prove(source, groupsOf)).toEqual([]);
    // The instrument agrees with the committed rows: same digests for the part.
    const endpointDeltas = diffConnectionSemantics(
      projectConnectionSemantics([source], CONNECTOR_PAIR_RULES, "live-strict", {
        semanticConnectorKinds: kinds,
      }),
      projectConnectionSemantics([live], CONNECTOR_PAIR_RULES, "live-strict", {
        semanticConnectorKinds: kinds,
      }),
    );
    expect(endpointDeltas).toEqual(EXPECTED_JUMPER_1X2_CENTRE_SEAT_CHANGES);
  });

  it("fails when a group peer existed in the source", () => {
    const source = { ...live, connectors: live.connectors.map(ungrouped) } as PartDefinition;

    expect(prove(source, groupsOf)).toEqual(
      ["0:0", "0:1"].map(
        (port, index) =>
          `synthetic ${JUMPER}/undersideClutch:${port}: group 15573:${index === 0 ? "negative" : "positive"}-z-half member undersideClutch:center existed in the source (${String(
            diffConnectionSemantics(
              projectConnectionSemantics([source], CONNECTOR_PAIR_RULES, "live-strict", {
                semanticConnectorKinds: kinds,
              }),
              projectConnectionSemantics([live], CONNECTOR_PAIR_RULES, "live-strict", {
                semanticConnectorKinds: kinds,
              }),
            ).find(({ portId }) => portId === "undersideClutch:center")?.sourceDigest,
          )}), so a saved edge on it could already fill the shared cell`,
      ),
    );
  });

  it("fails when the change is more than the added groups", () => {
    const source = {
      ...live,
      connectors: live.connectors
        .filter(({ id }) => id !== "undersideClutch:center")
        .map((connector) =>
          connector.id === "undersideClutch:0:0"
            ? { ...ungrouped(connector), profileId: "stud-tube/0" }
            : ungrouped(connector),
        ),
    } as PartDefinition;

    expect(prove(source, groupsOf)).toEqual([
      expect.stringMatching(
        /^synthetic builtin:jumper-plate-1x2\/undersideClutch:0:0: current truth minus groups 15573:negative-z-half digests to sha256:[0-9a-f]{64}, not the source sha256:[0-9a-f]{64}, so more than capacity cells changed$/u,
      ),
    ]);
  });

  it("fails when an entry claims a group the connector does not join", () => {
    const source = {
      ...live,
      connectors: live.connectors
        .filter(({ id }) => id !== "undersideClutch:center")
        .map(ungrouped),
    } as PartDefinition;

    expect(prove(source, () => [["15573:positive-z-half"], ["15573:positive-z-half"]])).toEqual([
      `synthetic ${JUMPER}/undersideClutch:0:0: added groups ["15573:positive-z-half"] are not distinct members of the current connector's groups ["15573:negative-z-half"]`,
    ]);
  });
});
