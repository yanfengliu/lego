import {
  BRICK_HEIGHT_LDU,
  PLATE_HEIGHT_LDU,
  STUD_PITCH_LDU,
  PART_DEFINITIONS,
  getPartDefinition,
  type PartDefinition,
} from "@lego-studio/catalog";
import { createPartInstance, transformLduPoint } from "@lego-studio/brick-kernel";
import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { occupiedConnectorCapacityClaims } from "./connector-capacity";
import {
  GROUND_UNDERSIDE_LDU,
  PlacementError,
  bodyBoundsLdu,
  endpointKey,
  findBodyOverlaps,
  findStudConnections,
  partTopSurfaceLdu,
  partUndersideLdu,
  snapPlacementOrigin,
  worldFootprint,
} from "./placement";

const BRICK_2X4 = "builtin:brick-2x4";
const BRICK_2X2 = "builtin:brick-2x2";
const BRICK_1X1 = "builtin:brick-1x1";
const PLATE_2X2 = "builtin:plate-2x2";
const PLATE_1X1 = "builtin:plate-1x1";
const TILE_99563 = "builtin:tile-1x2-chamfered-indented";

function partAt(
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
): PartInstance {
  return createPartInstance({
    id,
    catalogPartId,
    transform: { positionLdu: [...positionLdu], orientationId },
  });
}

function definition(catalogPartId: string): PartDefinition {
  const found = getPartDefinition(catalogPartId);
  if (!found)
    throw new Error(`Test fixture references a part outside the catalog: ${catalogPartId}`);
  return found;
}

function studPositions(part: PartInstance): readonly (readonly [number, number, number])[] {
  return definition(part.catalogPartId)
    .connectors.filter(({ kind }) => kind === "stud")
    .map((connector) => transformLduPoint(part.transform, connector.positionLdu));
}

describe("placement footprints", () => {
  it("exchanges stud axes for quarter and three-quarter yaws", () => {
    expect(worldFootprint(definition(BRICK_2X4), "upright-yaw-0")).toMatchObject({
      studsX: 2,
      studsZ: 4,
    });
    expect(worldFootprint(definition(BRICK_2X4), "upright-yaw-90")).toMatchObject({
      studsX: 4,
      studsZ: 2,
    });
    expect(worldFootprint(definition(BRICK_2X4), "upright-yaw-180")).toMatchObject({
      studsX: 2,
      studsZ: 4,
    });
    expect(worldFootprint(definition(BRICK_2X4), "upright-yaw-270")).toMatchObject({
      studsX: 4,
      studsZ: 2,
    });
  });

  it("keeps the asymmetric 80015 source origin on the shared stud lattice at every yaw", () => {
    const catalogPartId = "builtin:corner-plate-5x5-quarter-ring";
    for (const orientationId of [
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
    ]) {
      const footprint = worldFootprint(definition(catalogPartId), orientationId);
      expect([orientationId, footprint.originOffsetX, footprint.originOffsetZ]).toEqual([
        orientationId,
        0,
        0,
      ]);
      const origin = snapPlacementOrigin({
        catalogPartId,
        orientationId,
        rawLdu: [7, 0, -7],
      });
      expect(origin.slice(0, 3)).toEqual([0, 8, 0]);
      for (const [x, , z] of studPositions(partAt("ring", catalogPartId, origin, orientationId))) {
        expect(Math.abs(x % STUD_PITCH_LDU)).toBe(STUD_PITCH_LDU / 2);
        expect(Math.abs(z % STUD_PITCH_LDU)).toBe(STUD_PITCH_LDU / 2);
      }
    }
  });
});

describe("snapPlacementOrigin", () => {
  it("rests a brick on the plate exactly where Place at origin puts it", () => {
    expect(
      snapPlacementOrigin({
        catalogPartId: BRICK_2X2,
        orientationId: "upright-yaw-0",
        rawLdu: [3, 999, -4],
      }),
    ).toEqual([0, 0, 0]);
  });

  it("keeps every resting origin on the plate-height lattice", () => {
    for (const catalogPartId of [BRICK_2X2, PLATE_2X2, BRICK_1X1, BRICK_2X4]) {
      const [, y] = snapPlacementOrigin({
        catalogPartId,
        orientationId: "upright-yaw-0",
        rawLdu: [0, 0, 0],
      });
      expect(Math.abs(y % PLATE_HEIGHT_LDU)).toBe(0);
    }
  });

  it("rests every catalog part on the build plate, whatever its height", () => {
    // It is the underside that lands on the plate lattice, not the origin. A
    // two-plate-tall part has its origin half a plate off that lattice, and
    // rounding the origin buried a cheese slope four LDU under the plate —
    // where the editor then refused its own placement as unsupported.
    for (const part of PART_DEFINITIONS) {
      const origin = snapPlacementOrigin({
        catalogPartId: part.id,
        orientationId: "upright-yaw-0",
        rawLdu: [0, 0, 0],
      });
      const underside = partUndersideLdu({
        catalogPartId: part.id,
        transform: { positionLdu: origin, orientationId: "upright-yaw-0" },
      });
      expect([part.id, underside]).toEqual([part.id, GROUND_UNDERSIDE_LDU]);
      expect([part.id, origin.every(Number.isInteger)]).toEqual([part.id, true]);
    }
  });

  it("centres even footprints on grid lines and odd footprints inside cells", () => {
    const even = snapPlacementOrigin({
      catalogPartId: BRICK_2X2,
      orientationId: "upright-yaw-0",
      rawLdu: [6, 0, -6],
    });
    const odd = snapPlacementOrigin({
      catalogPartId: BRICK_1X1,
      orientationId: "upright-yaw-0",
      rawLdu: [6, 0, -6],
    });

    expect(Math.abs(even[0] % STUD_PITCH_LDU)).toBe(0);
    expect(Math.abs(odd[0] % STUD_PITCH_LDU)).toBe(STUD_PITCH_LDU / 2);
  });

  it("lands both footprint parities on one shared stud lattice", () => {
    // A 1x1 dropped beside a 2x2 must be able to share the same stud columns.
    const even = snapPlacementOrigin({
      catalogPartId: BRICK_2X2,
      orientationId: "upright-yaw-0",
      rawLdu: [0, 0, 0],
    });
    const odd = snapPlacementOrigin({
      catalogPartId: BRICK_1X1,
      orientationId: "upright-yaw-0",
      rawLdu: [40, 0, 0],
    });
    const evenStuds = studPositions(partAt("even", BRICK_2X2, even));
    const oddStuds = studPositions(partAt("odd", BRICK_1X1, odd));

    for (const [x, , z] of [...evenStuds, ...oddStuds]) {
      expect(Math.abs(x % STUD_PITCH_LDU)).toBe(STUD_PITCH_LDU / 2);
      expect(Math.abs(z % STUD_PITCH_LDU)).toBe(STUD_PITCH_LDU / 2);
    }
  });

  it("stacks onto a supporting surface without drifting off the lattice", () => {
    const base = partAt("base", BRICK_2X2, [0, 0, 0]);
    const supportUndersideLdu = partTopSurfaceLdu(definition(base.catalogPartId), 0);
    const stacked = snapPlacementOrigin({
      catalogPartId: BRICK_2X2,
      orientationId: "upright-yaw-0",
      rawLdu: [2, 0, 2],
      supportUndersideLdu,
    });

    expect(supportUndersideLdu).toBe(-BRICK_HEIGHT_LDU / 2);
    expect(stacked).toEqual([0, -BRICK_HEIGHT_LDU, 0]);
    expect(Math.abs(stacked[1] % PLATE_HEIGHT_LDU)).toBe(0);
  });

  it("seats a plate on a brick on the same lattice", () => {
    const stacked = snapPlacementOrigin({
      catalogPartId: PLATE_2X2,
      orientationId: "upright-yaw-0",
      rawLdu: [0, 0, 0],
      supportUndersideLdu: -BRICK_HEIGHT_LDU / 2,
    });

    expect(stacked).toEqual([0, -BRICK_HEIGHT_LDU / 2 - PLATE_HEIGHT_LDU / 2, 0]);
    expect(Math.abs(stacked[1] % PLATE_HEIGHT_LDU)).toBe(0);
  });

  it("names the offending input when it cannot place", () => {
    expect(() =>
      snapPlacementOrigin({
        catalogPartId: BRICK_2X2,
        orientationId: "upright-yaw-0",
        rawLdu: [Number.NaN, 0, 0],
      }),
    ).toThrow(/finite LDU position, received \[NaN, 0, 0\]/);

    expect(() =>
      snapPlacementOrigin({
        catalogPartId: "builtin:not-a-part",
        orientationId: "upright-yaw-0",
        rawLdu: [0, 0, 0],
      }),
    ).toThrow(PlacementError);
    expect(() =>
      snapPlacementOrigin({
        catalogPartId: "builtin:not-a-part",
        orientationId: "upright-yaw-0",
        rawLdu: [0, 0, 0],
      }),
    ).toThrow(/unknown catalog part builtin:not-a-part/);
  });
});

describe("body overlap affordance", () => {
  it("reports interpenetrating bodies and ignores exact stacks", () => {
    const base = partAt("base", BRICK_2X2, [0, 0, 0]);
    const stacked = partAt("stacked", BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);
    const overlapping = partAt("overlapping", BRICK_2X2, [0, -PLATE_HEIGHT_LDU, 0]);

    expect(findBodyOverlaps(stacked, [base])).toEqual([]);
    expect(findBodyOverlaps(overlapping, [base])).toEqual(["base"]);
  });

  it("excludes the part being dragged from its own overlap test", () => {
    const moving = partAt("moving", BRICK_2X2, [0, 0, 0]);
    expect(findBodyOverlaps(moving, [moving])).toEqual(["moving"]);
    expect(findBodyOverlaps(moving, [moving], ["moving"])).toEqual([]);
  });

  it("derives world bounds from the body, never the studs", () => {
    const bounds = bodyBoundsLdu(partAt("solo", BRICK_2X2, [0, 0, 0]));
    expect(bounds.min[1]).toBe(-BRICK_HEIGHT_LDU / 2);
    expect(bounds.max[1]).toBe(BRICK_HEIGHT_LDU / 2);
  });
});

describe("stud connection discovery", () => {
  it("finds every coincident stud/clutch pair under an exact stack", () => {
    const base = partAt("base", BRICK_2X2, [0, 0, 0]);
    const stacked = partAt("stacked", BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);

    const discovered = findStudConnections(stacked, [base]);

    expect(discovered).toHaveLength(4);
    expect(discovered.every(({ targetPartId }) => targetPartId === "base")).toBe(true);
    expect(new Set(discovered.map(({ candidatePortId }) => candidatePortId)).size).toBe(4);
  });

  it("returns nothing for a part floating off the lattice", () => {
    const base = partAt("base", BRICK_2X2, [0, 0, 0]);
    const floating = partAt("floating", BRICK_2X2, [10, -BRICK_HEIGHT_LDU, 0]);
    expect(findStudConnections(floating, [base])).toEqual([]);
  });

  it("skips ports an existing connection already occupies", () => {
    const base = partAt("base", BRICK_2X2, [0, 0, 0]);
    const stacked = partAt("stacked", BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);
    const occupied = new Set([endpointKey("base", "stud:0:0"), endpointKey("base", "stud:1:1")]);

    expect(findStudConnections(stacked, [base], occupied)).toHaveLength(2);
  });

  it("orders discoveries deterministically", () => {
    const base = partAt("base", BRICK_2X2, [0, 0, 0]);
    const stacked = partAt("stacked", BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);

    const first = findStudConnections(stacked, [base]);
    const second = findStudConnections(stacked, [...[base]].reverse());

    expect(second).toEqual(first);
  });

  it("connects downward too, when a part is dropped under an existing one", () => {
    const upper = partAt("upper", BRICK_2X2, [0, -BRICK_HEIGHT_LDU, 0]);
    const lower = partAt("lower", BRICK_2X2, [0, 0, 0]);

    const discovered = findStudConnections(lower, [upper]);

    expect(discovered).toHaveLength(4);
    expect(discovered.every(({ targetPartId }) => targetPartId === "upper")).toBe(true);
  });

  it("does not mistake a 28802 side stud for an upright clutch at the same point", () => {
    const bracket = partAt("bracket", "builtin:bracket-1x2-1x4-rounded-bottom", [0, 0, 0]);
    const sideStud = definition(bracket.catalogPartId).connectors.find(
      (connector) => connector.kind === "stud" && connector.normal[2] === -1,
    )!;
    const clutch = definition(BRICK_1X1).connectors.find(
      (connector) => connector.kind === "undersideClutch",
    )!;
    const candidate = partAt("candidate", BRICK_1X1, [
      sideStud.positionLdu[0] - clutch.positionLdu[0],
      sideStud.positionLdu[1] - clutch.positionLdu[1],
      sideStud.positionLdu[2] - clutch.positionLdu[2],
    ]);

    expect(transformLduPoint(candidate.transform, clutch.positionLdu)).toEqual(
      transformLduPoint(bracket.transform, sideStud.positionLdu),
    );
    expect(findStudConnections(candidate, [bracket])).toEqual([]);
  });

  function tileEdge(tileId: string, lowerId: string, clutchIndex: 0 | 1 | 2): ConnectionEdge {
    return {
      id: `${lowerId}-to-${tileId}`,
      kind: "stud-tube",
      a: { partId: lowerId, portId: "stud:0:0" },
      b: { partId: tileId, portId: `undersideClutch:${clutchIndex}` },
      provenance: { source: "manual" },
    };
  }

  it("discovers both 99563 outer seats without also consuming their shared center", () => {
    const tile = partAt("tile", TILE_99563, [0, 0, 0]);
    const negative = partAt("negative", PLATE_1X1, [0, 8, -10]);
    const positive = partAt("positive", PLATE_1X1, [0, 8, 10]);
    const center = partAt("center", PLATE_1X1, [0, 8, 0]);

    expect(findStudConnections(tile, [positive, negative])).toEqual([
      {
        targetPartId: "negative",
        targetPortId: "stud:0:0",
        candidatePortId: "undersideClutch:0",
      },
      {
        targetPartId: "positive",
        targetPortId: "stud:0:0",
        candidatePortId: "undersideClutch:2",
      },
    ]);
    expect(findStudConnections(tile, [center])).toEqual([
      {
        targetPartId: "center",
        targetPortId: "stud:0:0",
        candidatePortId: "undersideClutch:1",
      },
    ]);
  });

  it("blocks center against either occupied outer, keeps the other outer free, and scopes groups per instance", () => {
    const tile = partAt("tile", TILE_99563, [0, 0, 0]);
    const negative = partAt("negative", PLATE_1X1, [0, 8, -10]);
    const positive = partAt("positive", PLATE_1X1, [0, 8, 10]);
    const center = partAt("center", PLATE_1X1, [0, 8, 0]);

    const negativeOccupied = occupiedConnectorCapacityClaims(
      [tile, negative],
      [tileEdge(tile.id, negative.id, 0)],
    );
    expect(findStudConnections(center, [tile], negativeOccupied)).toEqual([]);
    expect(findStudConnections(positive, [tile], negativeOccupied)).toEqual([
      {
        targetPartId: "tile",
        targetPortId: "undersideClutch:2",
        candidatePortId: "stud:0:0",
      },
    ]);

    const centerOccupied = occupiedConnectorCapacityClaims(
      [tile, center],
      [tileEdge(tile.id, center.id, 1)],
    );
    expect(findStudConnections(negative, [tile], centerOccupied)).toEqual([]);
    expect(findStudConnections(positive, [tile], centerOccupied)).toEqual([]);

    const otherTile = partAt("other-tile", TILE_99563, [40, 0, 0]);
    const otherCenter = partAt("other-center", PLATE_1X1, [40, 8, 0]);
    expect(findStudConnections(otherCenter, [otherTile], negativeOccupied)).toEqual([
      {
        targetPartId: "other-tile",
        targetPortId: "undersideClutch:1",
        candidatePortId: "stud:0:0",
      },
    ]);
  });

  it("derives the same shared occupancy and discoveries in either connection order", () => {
    const tile = partAt("tile", TILE_99563, [0, 0, 0]);
    const negative = partAt("negative", PLATE_1X1, [0, 8, -10]);
    const positive = partAt("positive", PLATE_1X1, [0, 8, 10]);
    const center = partAt("center", PLATE_1X1, [0, 8, 0]);
    const edges = [tileEdge(tile.id, negative.id, 0), tileEdge(tile.id, positive.id, 2)];
    const forward = occupiedConnectorCapacityClaims([tile, negative, positive], edges);
    const reverse = occupiedConnectorCapacityClaims(
      [positive, negative, tile],
      [...edges].reverse(),
    );

    expect([...reverse].sort()).toEqual([...forward].sort());
    expect(findStudConnections(center, [tile], reverse)).toEqual(
      findStudConnections(center, [tile], forward),
    );
    expect(findStudConnections(center, [tile], forward)).toEqual([]);
  });
});

describe("ground convention", () => {
  it("puts the plate surface half a brick below the document origin", () => {
    expect(GROUND_UNDERSIDE_LDU).toBe(BRICK_HEIGHT_LDU / 2);
  });
});
