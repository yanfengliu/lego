import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import {
  createCollisionWorld,
  type CollisionFinding,
  type CollisionWorldWork,
} from "./collisions.ts";
import {
  boundsOverlap,
  type PrimitiveBounds,
  type WorldBody,
  type WorldPrimitive,
  type WorldStud,
} from "./collision-prism-geometry.ts";
import {
  collectAllowedPenetrations,
  makeWorldPrimitives,
  primitivesCollide,
} from "./collision-world-primitives.ts";
import { MAX_COLLISION_FINDINGS } from "./truth-manifests.ts";

const part = (
  id: string,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
): PartInstance => ({
  id,
  catalogPartId,
  colorId: "builtin:light-bluish-gray",
  transform: { positionLdu, orientationId },
  submodelId: "root",
  stepId: "step-1",
  semanticTags: [],
  provenance: { source: "manual" },
});

function collisionFinding(left: WorldPrimitive, right: WorldPrimitive): CollisionFinding {
  const partIds = [left.part.id, right.part.id].sort();
  if (left.kind === "body" && right.kind === "body") {
    return {
      validatorId: "kernel.collision",
      code: "PART_BODY_COLLISION",
      message: `Part bodies overlap: ${partIds[0]} and ${partIds[1]}`,
      path: "/parts",
      partIds,
    };
  }
  if (left.kind === "stud" && right.kind === "stud") {
    return {
      validatorId: "kernel.collision",
      code: "PART_STUD_COLLISION",
      message: `Part studs overlap: ${left.part.id}/${left.primitiveId} and ${right.part.id}/${right.primitiveId}`,
      path: "/parts",
      partIds,
    };
  }
  const stud = left.kind === "stud" ? left : (right as WorldStud);
  const body = left.kind === "body" ? left : (right as WorldBody);
  return {
    validatorId: "kernel.collision",
    code: "PART_STUD_BODY_COLLISION",
    message: `Stud ${stud.part.id}/${stud.primitiveId} overlaps body ${body.part.id}/${body.primitiveId}`,
    path: "/parts",
    partIds,
  };
}

function legacyCellKeys(bounds: PrimitiveBounds): readonly string[] {
  const keys: string[] = [];
  for (let x = Math.floor(bounds.min[0] / 100); x <= Math.floor(bounds.max[0] / 100); x += 1) {
    for (let z = Math.floor(bounds.min[2] / 100); z <= Math.floor(bounds.max[2] / 100); z += 1) {
      keys.push(`${x}:${z}`);
    }
  }
  return keys;
}

/** Exact pre-change 100-LDU x/z query, retained only as a differential oracle. */
function legacyFindCollisionsWith(
  parts: readonly PartInstance[],
  candidate: PartInstance,
  candidateConnections: readonly ConnectionEdge[],
): CollisionFinding[] {
  const primitives = makeWorldPrimitives(parts);
  const cells = new Map<string, WorldPrimitive[]>();
  for (const primitive of primitives) {
    for (const key of legacyCellKeys(primitive)) {
      const members = cells.get(key);
      if (members) members.push(primitive);
      else cells.set(key, [primitive]);
    }
  }
  const candidatePrimitives = makeWorldPrimitives([candidate]);
  const partById = new Map(parts.map((source) => [source.id, source]));
  const roster = [candidate];
  for (const connection of candidateConnections) {
    for (const endpoint of [connection.a, connection.b]) {
      const connected = partById.get(endpoint.partId);
      if (connected && !roster.includes(connected)) roster.push(connected);
    }
  }
  const allowedPenetrations = collectAllowedPenetrations(roster, candidateConnections);
  const neighbourhood = new Set<WorldPrimitive>();
  for (const primitive of candidatePrimitives) {
    for (const key of legacyCellKeys(primitive)) {
      for (const other of cells.get(key) ?? []) neighbourhood.add(other);
    }
  }

  const findings: CollisionFinding[] = [];
  const classes = new Set<string>();
  for (const left of candidatePrimitives) {
    for (const right of neighbourhood) {
      if (!boundsOverlap(left, right)) continue;
      if (!primitivesCollide(left, right, allowedPenetrations)) continue;
      const finding = collisionFinding(left, right);
      const key = `${finding.code}\u0000${finding.partIds.join("\u0001")}`;
      if (classes.has(key)) continue;
      classes.add(key);
      findings.push(finding);
      if (findings.length >= MAX_COLLISION_FINDINGS) return findings;
    }
  }
  return findings;
}

function expectLegacyFindingBytes(
  parts: readonly PartInstance[],
  candidate: PartInstance,
  candidateConnections: readonly ConnectionEdge[] = [],
): readonly CollisionFinding[] {
  const expected = legacyFindCollisionsWith(parts, candidate, candidateConnections);
  const actual = createCollisionWorld(parts).findCollisionsWith(candidate, candidateConnections);
  expect(actual).toEqual(expected);
  return actual;
}

describe("immutable 3-D collision world", () => {
  it("preserves the exact legacy finding order while removing y-separated neighbours", () => {
    const near = [
      part("near-c", "builtin:brick-2x4", [0, 0, 0]),
      part("near-a", "builtin:brick-1x2", [-20, 0, 0]),
      part("near-b", "builtin:plate-2x4", [20, 0, 0]),
    ];
    const verticalNoise = Array.from({ length: 40 }, (_, index) =>
      part(`noise-${String(index).padStart(2, "0")}`, "builtin:brick-2x2", [
        0,
        240 + index * 48,
        0,
      ]),
    );
    const worldParts = [...near, ...verticalNoise];
    const candidates = [
      part("candidate", "builtin:brick-2x4", [0, 0, 0]),
      part("candidate", "builtin:brick-1x2", [20, 0, 0], "upright-yaw-90"),
      part("candidate", "builtin:plate-1x4", [400, 0, 400]),
    ];
    const work: Readonly<CollisionWorldWork>[] = [];
    const indexed = createCollisionWorld(worldParts, (delta) => work.push(delta));

    for (const candidate of candidates) {
      expect(indexed.findCollisionsWith(candidate, [])).toEqual(
        legacyFindCollisionsWith(worldParts, candidate, []),
      );
    }
    expect(work).toHaveLength(1 + candidates.length);
    expect(work.every(Object.isFrozen)).toBe(true);
    expect(work[0]).toMatchObject({
      worldParts: worldParts.length,
      worldPrimitives: expect.any(Number),
      worldCellInsertions: expect.any(Number),
      legacyOrderWorldCellKeys: expect.any(Number),
    });
    expect(work[0]!.legacyOrderWorldCellKeys).toBeGreaterThan(0);
    expect(work.slice(1).every(({ collisionQueries }) => collisionQueries === 1)).toBe(true);
    expect(
      work.slice(1).reduce((sum, delta) => sum + delta.legacyOrderCandidateCellKeys, 0),
    ).toBeGreaterThan(0);
    expect(
      work.slice(1).reduce((sum, delta) => sum + delta.legacyOrderSetInsertions, 0),
    ).toBeGreaterThan(0);
  });

  it("matches legacy bytes for proper frames, allowances, cell boundaries, and duplicate classes", () => {
    expectLegacyFindingBytes(
      [part("turned", "builtin:brick-1x1", [0, 0, 0], "proper-m-p0000p0n0")],
      part("proper-candidate", "builtin:brick-1x1", [0, 0, 0]),
    );

    const ring = part("ring", "builtin:corner-plate-5x5-quarter-ring", [0, 0, 0]);
    const edgeProbe = part("probe", "builtin:plate-1x1", [30, 8, -70]);
    const edgeConnection: ConnectionEdge = {
      id: "edge-seat-2",
      kind: "stud-tube",
      a: { partId: "probe", portId: "stud:0:0" },
      b: { partId: "ring", portId: "undersideClutch:2" },
      provenance: { source: "manual" },
    };
    expect(expectLegacyFindingBytes([ring], edgeProbe).map(({ code }) => code)).toContain(
      "PART_STUD_BODY_COLLISION",
    );
    expect(
      expectLegacyFindingBytes([ring], edgeProbe, [edgeConnection]).map(({ code }) => code),
    ).not.toContain("PART_STUD_BODY_COLLISION");

    const boundaryWorld = [
      part("boundary-40", "builtin:brick-2x4", [40, 0, 0]),
      part("boundary-100", "builtin:brick-2x4", [100, 0, 0]),
      part("boundary-negative", "builtin:plate-1x4", [-100, 0, 0], "upright-yaw-90"),
    ];
    expectLegacyFindingBytes(
      boundaryWorld,
      part("boundary-candidate", "builtin:brick-2x4", [80, 0, 0], "upright-yaw-90"),
    );

    const duplicateFindings = expectLegacyFindingBytes(
      [
        part("duplicate-a", "builtin:brick-2x4", [0, 0, 0]),
        part("duplicate-b", "builtin:brick-2x4", [0, 0, 0]),
      ],
      part("duplicate-candidate", "builtin:brick-2x4", [0, 0, 0]),
    );
    expect(duplicateFindings.length).toBeGreaterThan(3);
    expect(
      new Set(
        duplicateFindings.map(
          (finding) => `${finding.code}\u0000${finding.partIds.join("\u0001")}`,
        ),
      ).size,
    ).toBe(duplicateFindings.length);
  });

  it("preserves the exact legacy prefix at the 5000-finding cap", () => {
    const worldParts = Array.from({ length: MAX_COLLISION_FINDINGS + 1 }, (_, index) =>
      part(`cap-${String(index).padStart(4, "0")}`, "builtin:brick-1x1", [0, 0, 0]),
    );
    const findings = expectLegacyFindingBytes(
      worldParts,
      part("cap-candidate", "builtin:brick-1x1", [0, 0, 0]),
    );
    expect(findings).toHaveLength(MAX_COLLISION_FINDINGS);
  });
});
