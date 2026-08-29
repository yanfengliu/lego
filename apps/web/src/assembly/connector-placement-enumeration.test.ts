import { PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import {
  createCollisionWorld,
  createEmptyBrickDocument,
  createPartInstance,
  rotateLduVector,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, RigidTransform } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { assessSupport } from "../placement";
import {
  createPlacementConnectorIndexes,
  discoverIndexedConnections,
  enumerateConnectorOrigins,
} from "./connector-placement-enumeration";
import { enumeratePlacements } from "./enumerate-placements";
import {
  protocolConnectionKindForCatalogPorts,
  protocolConnectionKindForDiscoveredConnection,
} from "./placement-connection-kind";

const AXLE = "builtin:axle-1x3";
const BLIND_HOLDER = "builtin:brick-1x2x2-inside-axle-holder";
const ONE_WIDE_THROUGH_HOLDER = "builtin:technic-brick-1x1-axle-hole";
const THROUGH_HOLDER = "builtin:technic-brick-1x2-axle-hole";
const STEP_45_ORIENTATION = "proper-m-00pp000p0";

function orientationMappingPositiveXTo(target: readonly [number, number, number]): string {
  const orientation = PROPER_ORIENTATIONS.find(({ matrix }) =>
    rotateLduVector(matrix, [1, 0, 0]).every((value, axis) => value === target[axis]),
  );
  if (orientation === undefined) throw new Error(`No proper orientation maps +X to ${target}`);
  return orientation.id;
}

function receiptFor(
  targetCatalogPartId: string,
  candidateCatalogPartId: string,
  orientationId: string,
) {
  const target = createPartInstance({ id: "target", catalogPartId: targetCatalogPartId });
  const candidate = getPartDefinition(candidateCatalogPartId)!;
  const indexes = createPlacementConnectorIndexes([target], new Set(), candidate, [orientationId]);
  const origins: { positionLdu: readonly number[]; orientationId: string }[] = [];
  const counts = enumerateConnectorOrigins(indexes, [orientationId], (positionLdu, id) => {
    origins.push({ positionLdu, orientationId: id });
  });
  return { target, indexes, origins, counts };
}

describe("connector-aware placement enumeration", () => {
  it("keeps through axle holes collinear while blind sockets admit only opposed axes", () => {
    const through = receiptFor(THROUGH_HOLDER, AXLE, "upright-yaw-0");
    expect(
      through.counts.seedReceipt.find(
        ({ targetKind, candidateKind }) => targetKind === "axleHole" && candidateKind === "axle",
      ),
    ).toEqual({
      targetKind: "axleHole",
      candidateKind: "axle",
      freeTargetPorts: 1,
      candidatePortsPerOrientation: 3,
      axisCompatibleSeeds: 3,
    });
    expect(
      discoverIndexedConnections(
        through.indexes,
        { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
        "enumeration-candidate",
      ),
    ).toEqual([
      {
        targetPartId: "target",
        targetPortId: "axleHole:0",
        candidatePortId: "axle:0",
      },
    ]);
    expect(
      discoverIndexedConnections(
        through.indexes,
        { positionLdu: [-20, -2, 0], orientationId: "upright-yaw-0" },
        "enumeration-candidate",
      ),
    ).toEqual([
      {
        targetPartId: "target",
        targetPortId: "axleHole:0",
        candidatePortId: "axle:2",
      },
    ]);

    const intoMouth = receiptFor(BLIND_HOLDER, AXLE, orientationMappingPositiveXTo([0, -1, 0]));
    const awayFromMouth = receiptFor(BLIND_HOLDER, AXLE, orientationMappingPositiveXTo([0, 1, 0]));
    const blindSeeds = (value: typeof intoMouth): number =>
      value.counts.seedReceipt.find(
        ({ targetKind, candidateKind }) =>
          targetKind === "blindAxleHole" && candidateKind === "axle",
      )!.axisCompatibleSeeds;
    expect(blindSeeds(intoMouth)).toBe(2);
    expect(blindSeeds(awayFromMouth)).toBe(1);
    expect(intoMouth.counts.rawFromOtherConnectorPairs).toBe(2);
    expect(awayFromMouth.counts.rawFromOtherConnectorPairs).toBe(1);
  });

  it("derives the protocol discriminator from exact compatible endpoints", () => {
    expect(
      protocolConnectionKindForCatalogPorts(BLIND_HOLDER, "blindAxleHole:0", AXLE, "axle:1"),
    ).toBe("stud-tube");
    expect(() =>
      protocolConnectionKindForCatalogPorts(BLIND_HOLDER, "stud:0", AXLE, "axle:1"),
    ).toThrow(/no compatible pair rule/u);
    expect(() =>
      protocolConnectionKindForCatalogPorts(BLIND_HOLDER, "blindAxleHole:forged", AXLE, "axle:1"),
    ).toThrow(/both exact catalog ports must exist/u);
    expect(() =>
      protocolConnectionKindForDiscoveredConnection([], AXLE, {
        targetPartId: "forged-target",
        targetPortId: "blindAxleHole:0",
        candidatePortId: "axle:1",
      }),
    ).toThrow(/targets missing part/u);
  });

  it("reaches and publicly accepts the three exact snapped step-45 axle seats", () => {
    const targetRows = [
      {
        id: "step-39-part-265",
        catalogPartId: ONE_WIDE_THROUGH_HOLDER,
        positionLdu: [410, -98, -94] as const,
        orientationId: "proper-m-00nn000p0",
      },
      {
        id: "step-39-part-261",
        catalogPartId: ONE_WIDE_THROUGH_HOLDER,
        positionLdu: [270, -98, -94] as const,
        orientationId: "proper-m-00nn000p0",
      },
      {
        id: "step-39-part-264",
        catalogPartId: THROUGH_HOLDER,
        positionLdu: [340, -98, -94] as const,
        orientationId: STEP_45_ORIENTATION,
      },
    ];
    const targets = targetRows.map(({ id, catalogPartId, positionLdu, orientationId }) =>
      createPartInstance({
        id,
        catalogPartId,
        transform: { positionLdu, orientationId },
      }),
    );
    const axle = getPartDefinition(AXLE)!;
    expect(axle.legalOrientationIds).toContain(STEP_45_ORIENTATION);
    expect(
      targetRows.map(({ catalogPartId }) =>
        getPartDefinition(catalogPartId)!.collision.throughAxleBoreAllowances?.map(
          ({ portId }) => portId,
        ),
      ),
    ).toEqual([["axleHole:0"], ["axleHole:0"], ["axleHole:0"]]);
    const indexes = createPlacementConnectorIndexes(targets, new Set(), axle, [
      STEP_45_ORIENTATION,
    ]);
    const seeded: RigidTransform[] = [];
    const counts = enumerateConnectorOrigins(
      indexes,
      [STEP_45_ORIENTATION],
      (positionLdu, orientationId) => seeded.push({ positionLdu, orientationId }),
    );
    const snapped = targetRows.map(({ positionLdu }) => ({
      positionLdu: [positionLdu[0], -118, -96] as const,
      orientationId: STEP_45_ORIENTATION,
    }));

    expect(
      counts.seedReceipt.find(
        ({ targetKind, candidateKind }) => targetKind === "axleHole" && candidateKind === "axle",
      ),
    ).toEqual({
      targetKind: "axleHole",
      candidateKind: "axle",
      freeTargetPorts: 3,
      candidatePortsPerOrientation: 3,
      axisCompatibleSeeds: 9,
    });
    expect(seeded.filter(({ positionLdu }) => positionLdu[1] === -118)).toEqual(snapped);

    const sourceCenters = [
      [410, -118, -96.5],
      [270, -118, -96.5],
      [340, -118, -96.5],
    ] as const;
    const collisionWorld = createCollisionWorld(targets);
    for (const [index, transform] of snapped.entries()) {
      const target = targetRows[index]!;
      const candidate = createPartInstance({
        id: `step-45-axle-${index}`,
        catalogPartId: AXLE,
        transform,
      });
      const connections = discoverIndexedConnections(indexes, transform, candidate.id);
      expect(connections).toEqual([
        {
          targetPartId: target.id,
          targetPortId: "axleHole:0",
          candidatePortId: "axle:2",
        },
      ]);
      const sourceCenter = sourceCenters[index]!;
      expect([
        transform.positionLdu[0] - sourceCenter[0],
        transform.positionLdu[1] - sourceCenter[1],
        transform.positionLdu[2] - sourceCenter[2],
      ]).toEqual([0, 0, 0.5]);
      expect(assessSupport(candidate, connections)).toEqual({
        supported: true,
        held: "connections",
      });
      const edges: ConnectionEdge[] = connections.map((connection, edgeIndex) => ({
        id: `step-45-edge-${index}-${edgeIndex}`,
        kind: protocolConnectionKindForCatalogPorts(
          target.catalogPartId,
          connection.targetPortId,
          AXLE,
          connection.candidatePortId,
        ),
        a: { partId: connection.targetPartId, portId: connection.targetPortId },
        b: { partId: candidate.id, portId: connection.candidatePortId },
        provenance: { source: "manual" },
      }));
      expect(
        collisionWorld.findCollisionsWith(candidate, edges).map(({ code }) => code),
      ).not.toContain("PART_BODY_COLLISION");
    }

    const base = createEmptyBrickDocument({ id: "step-45-seats", name: "Step 45 seats" });
    const document: BrickDocumentV1 = {
      ...base,
      parts: targets,
      connections: [],
      submodels: [{ ...base.submodels[0]!, partIds: targets.map(({ id }) => id) }],
      steps: [{ ...base.steps[0]!, partIds: targets.map(({ id }) => id) }],
    };
    const enumeration = enumeratePlacements(document, AXLE, {
      orientationIds: [STEP_45_ORIENTATION],
      includeBuildPlate: false,
    });
    expect(enumeration.connectorSeedReceipt).toEqual(counts.seedReceipt);
    expect(enumeration.counts).toMatchObject({
      distinctTransforms: 9,
      rejectedColliding: 0,
      accepted: 9,
    });
    expect(
      enumeration.candidates.filter(({ transform }) => transform.positionLdu[1] === -118),
    ).toEqual(
      [...snapped]
        .sort((left, right) => left.positionLdu[0] - right.positionLdu[0])
        .map((transform) =>
          expect.objectContaining({
            catalogPartId: AXLE,
            transform,
            connections: [expect.objectContaining({ candidatePortId: "axle:2" })],
          }),
        ),
    );
  });
});
