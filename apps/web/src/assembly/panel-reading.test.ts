import { getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import { applyBuildOperations, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../manual-commands";
import { panelProjectionFromFit } from "./arrow-placement";
import { enumeratePlacements } from "./enumerate-placements";
import {
  classifyPageDirection,
  directionLine,
  narrowByPanelReading,
  resolveAnchor,
  worldBox,
  type PartFacts,
  type PieceReading,
  type PlacedPart,
} from "./panel-reading";

/**
 * The converter is measured against the one thing that makes it worth having:
 * a wrong reading has to be caught. A reading that narrows correctly is only
 * useful if the reading that narrows to the wrong place is refused instead of
 * believed, so every test below that shows a narrowing working has a sibling
 * that feeds it a lie.
 */

const FIT = { azimuthDegrees: 54.6, elevationDegrees: 34.8, pixelsPerUnit: 41.16 } as const;
const PROJECTION = panelProjectionFromFit(FIT);

function facts(...catalogPartIds: readonly string[]): Map<string, PartFacts> {
  const map = new Map<string, PartFacts>();
  for (const id of catalogPartIds) {
    const definition = getPartDefinition(id);
    if (definition === undefined) throw new Error(`no part ${id}`);
    map.set(id, { boundsLdu: definition.boundsLdu, colorName: "Black" });
  }
  return map;
}

function build(placements: readonly { part: string; at: LduVector3; orientationId?: string }[]): {
  document: BrickDocumentV1;
  placed: PlacedPart[];
} {
  let document = createEmptyBrickDocument({ id: "reading", name: "Panel reading fixture" });
  const placed: PlacedPart[] = [];
  for (const placement of placements) {
    const transform = {
      positionLdu: placement.at,
      orientationId: placement.orientationId ?? "upright-yaw-0",
    };
    const transaction = createPlacePartTransaction(document, {
      catalogPartId: placement.part,
      colorId: "builtin:black",
      transform,
    });
    document = applyBuildOperations(document, transaction.operations);
    const partId = document.parts[document.parts.length - 1]!.id;
    placed.push({ partId, catalogPartId: placement.part, colorId: "builtin:black", transform });
  }
  return { document, placed };
}

const READING = (over: Partial<PieceReading> = {}): PieceReading => ({
  id: "P1",
  visible: true,
  longAxis: "cannot-tell",
  anchorId: null,
  relation: "cannot-tell",
  side: "cannot-tell",
  overlapStuds: null,
  confidence: 0.9,
  ...over,
});

describe("page directions", () => {
  it("names the quadrant a projected vector points into, with the page y running down", () => {
    expect(classifyPageDirection({ xPx: 10, yPx: -10 })).toBe("up-and-right");
    expect(classifyPageDirection({ xPx: 10, yPx: 10 })).toBe("down-and-right");
    expect(classifyPageDirection({ xPx: -10, yPx: 10 })).toBe("down-and-left");
    expect(classifyPageDirection({ xPx: -10, yPx: -10 })).toBe("up-and-left");
    expect(classifyPageDirection({ xPx: 0.5, yPx: -40 })).toBe("straight-up");
  });

  it("treats a long axis as a line, because a plate has no far end", () => {
    expect(directionLine("up-and-right")).toBe(directionLine("down-and-left"));
    expect(directionLine("up-and-left")).toBe(directionLine("down-and-right"));
    expect(directionLine("up-and-right")).not.toBe(directionLine("up-and-left"));
  });

  it("projects one stud of world X and one of world Z into different page quadrants", () => {
    const alongX = classifyPageDirection({ xPx: PROJECTION.a.xPx, yPx: PROJECTION.a.yPx });
    const alongZ = classifyPageDirection({ xPx: PROJECTION.b.xPx, yPx: PROJECTION.b.yPx });
    expect(alongX).not.toBe(alongZ);
    expect(directionLine(alongX!)).not.toBe(directionLine(alongZ!));
  });
});

describe("anchor resolution", () => {
  const { placed } = build([
    { part: "builtin:plate-2x4", at: [0, 8, 0] },
    { part: "builtin:plate-2x4", at: [0, 8, 80] },
  ]);
  const map = facts("builtin:plate-2x4");

  it("resolves a colour and a stud size to every placed piece that could be it", () => {
    const resolved = resolveAnchor("built:Black 4x2", placed, map);
    expect(resolved.refusal).toBeNull();
    expect(resolved.matches).toHaveLength(2);
  });

  it("accepts the two stud counts in either order, because a reader may count either first", () => {
    expect(resolveAnchor("built:Black 2x4", placed, map).matches).toHaveLength(2);
  });

  it("refuses a description that names nothing rather than guessing what was meant", () => {
    const resolved = resolveAnchor("built:Black 6x6", placed, map);
    expect(resolved.matches).toHaveLength(0);
    expect(resolved.refusal).toContain("names no piece that has been placed");
  });

  it("refuses a colour that was never placed", () => {
    expect(resolveAnchor("built:Green 4x2", placed, map).refusal).toContain("no piece");
  });
});

describe("narrowing one piece against a placed anchor", () => {
  // A 2x4 plate on the build plate, and a 1x8 plate to place against it.
  const { document, placed } = build([{ part: "builtin:plate-2x4", at: [0, 8, 0] }]);
  const map = facts("builtin:plate-2x4", "builtin:plate-1x8");
  const enumeration = enumeratePlacements(document, "builtin:plate-1x8");
  const candidates = enumeration.candidates.map((candidate) => ({
    transform: candidate.transform,
    connections: candidate.connections,
  }));
  const pieces = [{ id: "P1", catalogPartId: "builtin:plate-1x8" }];

  const narrow = (reading: PieceReading, maximumProduct = 4096) =>
    narrowByPanelReading({
      reading: { panel: { viewpoint: "from-above" }, pieces: [reading] },
      pieces,
      candidatesByPiece: [candidates],
      placed,
      facts: map,
      projection: PROJECTION,
      panelFace: "studs-up",
      maximumProduct,
    });

  it("has something to narrow", () => {
    expect(candidates.length).toBeGreaterThan(100);
  });

  it("keeps only the placements whose long axis runs the way the reader saw it", () => {
    const alongX = classifyPageDirection({ xPx: PROJECTION.a.xPx, yPx: PROJECTION.a.yPx })!;
    const result = narrow(READING({ longAxis: alongX }));
    expect(result.perPiece[0]!.kept).toBeGreaterThan(0);
    expect(result.perPiece[0]!.kept).toBeLessThan(candidates.length);
    for (const kept of result.perPiece[0]!.keptCandidates) {
      // A 1x8's long side is local Z; yaw 90 and 270 carry it onto world X.
      expect(["upright-yaw-90", "upright-yaw-270"]).toContain(kept.transform.orientationId);
    }
  });

  it("separates on-top-of from underneath, which is the one plate a printed panel cannot", () => {
    // A long plate laid across a short one overhangs it at both ends, so the
    // overhang has free underside clutches and "underneath" is a placement that
    // exists. On the simpler fixture above it is not: the anchor rests on the
    // build plate and nothing can go under it, which is the enumerator refusing
    // rather than the reading being wrong.
    const stack = build([
      { part: "builtin:plate-2x4", at: [0, 8, 0] },
      { part: "builtin:plate-2x14", at: [0, 0, 0] },
    ]);
    const stackFacts = facts("builtin:plate-2x4", "builtin:plate-2x14", "builtin:plate-1x8");
    const stackCandidates = enumeratePlacements(stack.document, "builtin:plate-1x8").candidates.map(
      (candidate) => ({ transform: candidate.transform, connections: candidate.connections }),
    );
    const narrowStack = (reading: PieceReading) =>
      narrowByPanelReading({
        reading: { panel: { viewpoint: "from-above" }, pieces: [reading] },
        pieces,
        candidatesByPiece: [stackCandidates],
        placed: stack.placed,
        facts: stackFacts,
        projection: PROJECTION,
        panelFace: "studs-up",
        maximumProduct: 65_536,
      });
    const above = narrowStack(READING({ anchorId: "built:Black 14x2", relation: "on-top-of" }));
    const below = narrowStack(READING({ anchorId: "built:Black 14x2", relation: "underneath" }));
    expect(above.perPiece[0]!.kept).toBeGreaterThan(0);
    expect(below.perPiece[0]!.kept).toBeGreaterThan(0);
    const aboveKeys = new Set(
      above.perPiece[0]!.keptCandidates.map(
        (entry) => `${entry.transform.positionLdu.join(",")}|${entry.transform.orientationId}`,
      ),
    );
    for (const kept of below.perPiece[0]!.keptCandidates) {
      expect(
        aboveKeys.has(`${kept.transform.positionLdu.join(",")}|${kept.transform.orientationId}`),
      ).toBe(false);
    }
  });

  it("counts the studs of overlap exactly, from the connections the kernel discovered", () => {
    const anchorPartId = placed[0]!.partId;
    const two = narrow(
      READING({ anchorId: "built:Black 4x2", relation: "on-top-of", overlapStuds: 2 }),
    );
    expect(two.perPiece[0]!.kept).toBeGreaterThan(0);
    for (const kept of two.perPiece[0]!.keptCandidates) {
      expect(kept.connections.filter((c) => c.targetPartId === anchorPartId)).toHaveLength(2);
    }
  });

  it("refuses a reading that keeps nothing, rather than repairing it", () => {
    // Nine studs of overlap between a 1x8 and a 2x4 is not a placement that
    // exists. The reading is arithmetically self-consistent and simply false.
    const result = narrow(
      READING({ anchorId: "built:Black 4x2", relation: "on-top-of", overlapStuds: 9 }),
    );
    expect(result.usable).toBe(false);
    expect(result.perPiece[0]!.kept).toBe(0);
    expect(result.refusals.map((refusal) => refusal.code)).toContain(
      "reading-contradicts-enumeration",
    );
  });

  it("refuses a reading that is right about everything except the side it sits on", () => {
    const anchorCentre = worldBox(map.get("builtin:plate-2x4")!.boundsLdu, placed[0]!.transform);
    expect(anchorCentre.min[1]).toBeLessThan(anchorCentre.max[1]);
    const truthful = narrow(
      READING({ anchorId: "built:Black 4x2", relation: "on-top-of", side: "up-and-right" }),
    );
    const inverted = narrow(
      READING({ anchorId: "built:Black 4x2", relation: "on-top-of", side: "down-and-left" }),
    );
    // Both sides exist on a symmetric fixture; what matters is that they are
    // disjoint, so a reader who names the wrong one cannot land on the right
    // placement by accident.
    const keys = (result: ReturnType<typeof narrow>) =>
      new Set(
        result.perPiece[0]!.keptCandidates.map(
          (entry) => `${entry.transform.positionLdu.join(",")}|${entry.transform.orientationId}`,
        ),
      );
    const left = keys(truthful);
    for (const key of keys(inverted)) expect(left.has(key)).toBe(false);
  });

  it("declines rather than narrowing when the reader could not see the piece", () => {
    const result = narrow(READING({ visible: false, cannotTell: "hidden behind the hull" }));
    expect(result.perPiece[0]!.kept).toBe(candidates.length);
    expect(result.refusals.map((refusal) => refusal.code)).toContain("reading-declined");
  });

  it("refuses a whole panel whose viewpoint contradicts the booklet's own icon", () => {
    const result = narrowByPanelReading({
      reading: {
        panel: { viewpoint: "from-above" },
        pieces: [READING({ anchorId: "built:Black 4x2", relation: "on-top-of" })],
      },
      pieces,
      candidatesByPiece: [candidates],
      placed,
      facts: map,
      projection: PROJECTION,
      panelFace: "underside",
      maximumProduct: 4096,
    });
    expect(result.usable).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain("panel-viewpoint-disagrees");
  });

  it("refuses to call an under-determined reading a proposal", () => {
    const result = narrow(READING({}), 4);
    expect(result.usable).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain("reading-under-determined");
  });

  it("never proposes a placement the enumerator did not offer", () => {
    const offered = new Set(
      candidates.map(
        (entry) => `${entry.transform.positionLdu.join(",")}|${entry.transform.orientationId}`,
      ),
    );
    const result = narrow(READING({ anchorId: "built:Black 4x2", relation: "on-top-of" }));
    for (const kept of result.perPiece[0]!.keptCandidates) {
      expect(
        offered.has(`${kept.transform.positionLdu.join(",")}|${kept.transform.orientationId}`),
      ).toBe(true);
    }
  });
});
