import { PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import type { ConnectionEdge, PartInstance, RigidTransform } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { collectThroughAxleBoreReliefs } from "./axle-bore-collision-relief.ts";
import { findCatalogCollisions } from "./collisions.ts";
import { createPartInstance } from "./factory.ts";
import {
  composeRigidTransforms,
  getConnectorWorldFrame,
  getProperOrientation,
  rotateLduVector,
} from "./transforms.ts";

const AXLE = "builtin:axle-1x3";
const THROUGH_1X1 = "builtin:technic-brick-1x1-axle-hole";
const THROUGH_1X2 = "builtin:technic-brick-1x2-axle-hole";
const BLIND = "builtin:brick-1x2x2-inside-axle-holder";

function edge(
  axlePartId: string,
  borePartId: string,
  axlePortId = "axle:0",
  borePortId = "axleHole:0",
): ConnectionEdge {
  return {
    id: `${axlePartId}-to-${borePartId}`,
    kind: "stud-tube",
    a: { partId: axlePartId, portId: axlePortId },
    b: { partId: borePartId, portId: borePortId },
    provenance: { source: "manual" },
  };
}

function hasBodyCollision(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
  expectedPartIds?: readonly string[],
): boolean {
  return findCatalogCollisions(parts, connections).some(
    (finding) =>
      finding.code === "PART_BODY_COLLISION" &&
      (expectedPartIds === undefined ||
        [...finding.partIds].sort().join("\0") === [...expectedPartIds].sort().join("\0")),
  );
}

function axleTransformAt(
  targetPositionLdu: readonly [number, number, number],
  axlePortId: string,
  orientationId: string,
): RigidTransform {
  const localPort = getPartDefinition(AXLE)!.connectors.find(({ id }) => id === axlePortId)!;
  const rotated = rotateLduVector(
    getProperOrientation(orientationId).matrix,
    localPort.positionLdu,
  );
  return {
    positionLdu: [
      targetPositionLdu[0] - rotated[0],
      targetPositionLdu[1] - rotated[1],
      targetPositionLdu[2] - rotated[2],
    ],
    orientationId,
  };
}

function orientationMappingPositiveXTo(target: readonly [number, number, number]): string {
  const orientation = PROPER_ORIENTATIONS.find(({ matrix }) =>
    rotateLduVector(matrix, [1, 0, 0]).every((value, axis) => value === target[axis]),
  );
  if (!orientation) throw new Error(`No proper orientation maps +X to ${target.join(",")}`);
  return orientation.id;
}

describe("connection-gated measured through axle-bore collision relief", () => {
  it("clears both exact measured through-hole seats", () => {
    const cases = [
      {
        bore: createPartInstance({ id: "bore-32064", catalogPartId: THROUGH_1X2 }),
        axle: createPartInstance({
          id: "axle-32064",
          catalogPartId: AXLE,
          transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
        }),
        axlePortId: "axle:0",
      },
      {
        bore: createPartInstance({ id: "bore-73230", catalogPartId: THROUGH_1X1 }),
        axle: createPartInstance({
          id: "axle-73230",
          catalogPartId: AXLE,
          transform: { positionLdu: [-20, -2, 0], orientationId: "upright-yaw-0" },
        }),
        axlePortId: "axle:2",
      },
    ];
    for (const { bore, axle, axlePortId } of cases) {
      expect(hasBodyCollision([bore, axle], [])).toBe(true);
      expect(hasBodyCollision([bore, axle], [edge(axle.id, bore.id, axlePortId)])).toBe(false);
    }
  });

  it("clears all three exact snapped step-45 seats at z=-96", () => {
    const rows = [
      {
        id: "step-39-part-265",
        catalogPartId: THROUGH_1X1,
        positionLdu: [410, -98, -94] as const,
        orientationId: "proper-m-00nn000p0",
      },
      {
        id: "step-39-part-261",
        catalogPartId: THROUGH_1X1,
        positionLdu: [270, -98, -94] as const,
        orientationId: "proper-m-00nn000p0",
      },
      {
        id: "step-39-part-264",
        catalogPartId: THROUGH_1X2,
        positionLdu: [340, -98, -94] as const,
        orientationId: "proper-m-00pp000p0",
      },
    ];
    for (const [index, row] of rows.entries()) {
      const bore = createPartInstance({
        id: row.id,
        catalogPartId: row.catalogPartId,
        transform: { positionLdu: row.positionLdu, orientationId: row.orientationId },
      });
      const axle = createPartInstance({
        id: `step-45-axle-${index}`,
        catalogPartId: AXLE,
        transform: {
          positionLdu: [row.positionLdu[0], -118, -96],
          orientationId: "proper-m-00pp000p0",
        },
      });
      expect(getConnectorWorldFrame(bore, "axleHole:0").positionLdu).toEqual([
        row.positionLdu[0],
        -98,
        -96,
      ]);
      expect(getConnectorWorldFrame(axle, "axle:2").positionLdu).toEqual([
        row.positionLdu[0],
        -98,
        -96,
      ]);
      expect(hasBodyCollision([bore, axle], [])).toBe(true);
      expect(hasBodyCollision([bore, axle], [edge(axle.id, bore.id, "axle:2")])).toBe(false);
    }
  });

  it("keeps missing, wrong, forged, off-axis, out-of-depth, and misaligned edges colliding", () => {
    const bore = createPartInstance({ id: "bore", catalogPartId: THROUGH_1X2 });
    const seated = createPartInstance({
      id: "axle",
      catalogPartId: AXLE,
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    const wrongPort = edge(seated.id, bore.id, "axle:1");
    const missingPort = edge(seated.id, bore.id, "axle:forged");
    const forgedKind = { ...edge(seated.id, bore.id), kind: "forged" } as unknown as ConnectionEdge;
    for (const connections of [[], [wrongPort], [missingPort], [forgedKind]]) {
      expect(hasBodyCollision([bore, seated], connections)).toBe(true);
    }

    const offAxis: PartInstance = {
      ...seated,
      transform: { ...seated.transform, positionLdu: [20, -1, 0] },
    };
    const outOfDepth: PartInstance = {
      ...seated,
      transform: { ...seated.transform, positionLdu: [26, -2, 0] },
    };
    const misalignedOrientation = "upright-yaw-90";
    const misaligned: PartInstance = {
      ...seated,
      transform: axleTransformAt([0, -2, 0], "axle:0", misalignedOrientation),
    };
    for (const candidate of [offAxis, outOfDepth, misaligned]) {
      expect(hasBodyCollision([bore, candidate], [edge(candidate.id, bore.id)])).toBe(true);
    }
  });

  it("does not clear unrelated third bodies, non-axle bodies, or a blind socket", () => {
    const bore = createPartInstance({ id: "bore", catalogPartId: THROUGH_1X2 });
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: AXLE,
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    const blocker = createPartInstance({
      id: "blocker",
      catalogPartId: "builtin:brick-1x1",
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    expect(
      hasBodyCollision([bore, axle, blocker], [edge(axle.id, bore.id)], [axle.id, blocker.id]),
    ).toBe(true);

    const nonAxle = createPartInstance({ id: "non-axle", catalogPartId: "builtin:brick-1x1" });
    expect(
      hasBodyCollision([bore, nonAxle], [edge(nonAxle.id, bore.id)], [bore.id, nonAxle.id]),
    ).toBe(true);

    const blind = createPartInstance({ id: "blind", catalogPartId: BLIND });
    const blindFrame = getConnectorWorldFrame(blind, "blindAxleHole:0");
    const verticalOrientation = orientationMappingPositiveXTo([0, -1, 0]);
    const blindAxle = createPartInstance({
      id: "blind-axle",
      catalogPartId: AXLE,
      transform: axleTransformAt(blindFrame.positionLdu, "axle:2", verticalOrientation),
    });
    const blindEdge = edge(blindAxle.id, blind.id, "axle:2", "blindAxleHole:0");
    expect(collectThroughAxleBoreReliefs([blind, blindAxle], [blindEdge]).size).toBe(0);
    expect(findCatalogCollisions([blind, blindAxle], [blindEdge])).toEqual(
      findCatalogCollisions([blind, blindAxle], []),
    );
  });

  it("preserves relief under every proper global rotation", () => {
    const bore = createPartInstance({ id: "bore", catalogPartId: THROUGH_1X2 });
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: AXLE,
      transform: { positionLdu: [20, -2, 0], orientationId: "upright-yaw-0" },
    });
    const connection = edge(axle.id, bore.id);
    for (const { id: orientationId } of PROPER_ORIENTATIONS) {
      const global: RigidTransform = { positionLdu: [37, -53, 91], orientationId };
      const rotated = [bore, axle].map((part): PartInstance => ({
        ...part,
        transform: composeRigidTransforms(global, part.transform),
      }));
      expect(hasBodyCollision(rotated, [connection]), orientationId).toBe(false);
    }
  });
});
