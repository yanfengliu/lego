import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  composeRigidTransforms,
  createEmptyBrickDocument,
  createPartInstance,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import {
  RigidSubassemblyReturnError,
  enumerateRigidSubassemblyReturns,
  type RigidSubassemblyReturnInput,
  type RigidSubassemblyReturnWorkLimits,
} from "./rigid-subassembly-return";
import { requireRigidSubassemblyReturnBaseWorld } from "./rigid-subassembly-return-base";

const GENEROUS_LIMITS: RigidSubassemblyReturnWorkLimits = {
  maxDocumentParts: 500,
  maxDocumentConnections: 2_000,
  maxConnectorPairingChecks: 1_000_000,
  maxDistinctGroupDeltas: 100_000,
  maxCandidateDocuments: 100_000,
  maxTransformedChildParts: 2_000_000,
  maxCrossConnectionChecks: 10_000_000,
  maxCrossEdgesPerCandidate: 2_000,
};

function plate(
  id: string,
  positionLdu: readonly [number, number, number],
  catalogPartId = "builtin:plate-1x1",
): PartInstance {
  return createPartInstance({
    id,
    catalogPartId,
    transform: { positionLdu, orientationId: "upright-yaw-0" },
    semanticTags: [`tag:${id}`],
    source: "import",
    sourceId: `source:${id}`,
  });
}

function connection(
  id: string,
  lowerPartId: string,
  lowerPortId: string,
  upperPartId: string,
  upperPortId: string,
): ConnectionEdge {
  return {
    id,
    kind: "stud-tube",
    a: { partId: lowerPartId, portId: lowerPortId },
    b: { partId: upperPartId, portId: upperPortId },
    provenance: { source: "manual" },
  };
}

function documentWith(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[] = [],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "rigid-return-fixture",
    name: "Rigid return fixture",
    maxParts: 500,
  });
  const partIds = parts.map(({ id }) => id);
  return {
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds }],
  };
}

function enumerate(
  document: BrickDocumentV1,
  childPartIds: readonly string[],
  workLimits = GENEROUS_LIMITS,
) {
  return enumerateRigidSubassemblyReturns({ document, childPartIds, workLimits });
}

function errorCode(input: RigidSubassemblyReturnInput): string | undefined {
  try {
    enumerateRigidSubassemblyReturns(input);
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(RigidSubassemblyReturnError);
    return (error as RigidSubassemblyReturnError).code;
  }
}

function identityFields(part: PartInstance) {
  return {
    id: part.id,
    catalogPartId: part.catalogPartId,
    colorId: part.colorId,
    submodelId: part.submodelId,
    stepId: part.stepId,
    semanticTags: part.semanticTags,
    provenance: part.provenance,
  };
}

function stackedChildFixture(childCount: number) {
  const parent = plate("parent", [0, 8, 0]);
  const children = Array.from({ length: childCount }, (_, index) =>
    plate(`child-${index.toString().padStart(2, "0")}`, [100, 8 - index * 8, 0]),
  );
  const internalEdges = children
    .slice(0, -1)
    .map((part, index) =>
      connection(
        `child-edge-${index.toString().padStart(2, "0")}`,
        part.id,
        "stud:0:0",
        children[index + 1]!.id,
        "undersideClutch:0:0",
      ),
    );
  return {
    document: documentWith([parent, ...children], internalEdges),
    childIds: children.map(({ id }) => id),
    children,
    parent,
  };
}

describe("rigid subassembly return enumeration", () => {
  it("returns complete hard-valid joins while preserving source identity and membership", () => {
    const parent = plate("parent", [0, 8, 0]);
    const child = plate("child", [100, 8, 0]);
    const source = documentWith([parent, child]);
    const result = enumerate(source, [child.id]);

    expect(result.counts.properGroupOrientations).toBe(24);
    expect(result.counts.groupDeltasVisited).toBe(result.counts.distinctGroupDeltas);
    expect(result.counts.accepted).toBeGreaterThan(0);
    expect(result.candidates).toHaveLength(result.counts.accepted);
    for (const candidate of result.candidates) {
      expect(candidate.validationReport.documentGloballyValid).toBe(true);
      expect(candidate.validationReport.issues).toEqual([]);
      expect(candidate.crossEdges.length).toBeGreaterThan(0);
      expect(candidate.crossEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provenance: {
              source: "ai",
              sourceId: expect.stringMatching(/^rigid-return:[a-f0-9]{64}$/),
            },
          }),
        ]),
      );
      expect(candidate.hardValidDocument.parts.find(({ id }) => id === parent.id)).toEqual(parent);
      expect(candidate.hardValidDocument.submodels[0]?.partIds).toEqual(
        [...source.submodels[0]!.partIds].sort(),
      );
      expect(candidate.hardValidDocument.steps[0]?.partIds).toEqual(
        [...source.steps[0]!.partIds].sort(),
      );
      expect(applyBuildOperations(source, candidate.operations)).toEqual(
        candidate.hardValidDocument,
      );
      expect(candidate.operations.filter(({ kind }) => kind === "updatePart")).toHaveLength(
        candidate.transformedChildParts.length,
      );
      expect(candidate.operations.filter(({ kind }) => kind === "addConnection")).toHaveLength(
        candidate.crossEdges.length,
      );
      expect(new Set(candidate.operations.map(({ operationId }) => operationId)).size).toBe(
        candidate.operations.length,
      );
      expect(identityFields(candidate.transformedChildParts[0]!)).toEqual(identityFields(child));
      expect(candidate.transformedChildParts[0]!.transform).toEqual(
        composeRigidTransforms(candidate.groupDelta, child.transform),
      );
      expect(candidate).not.toHaveProperty("authority");
      expect(candidate).not.toHaveProperty("patch");
      expect(candidate).not.toHaveProperty("acceptance");
    }
  });

  it("enumerates nonidentity rotations of the entire child group", () => {
    const fixture = stackedChildFixture(2);
    const result = enumerate(fixture.document, fixture.childIds);
    const rotated = result.candidates.find(
      ({ groupDelta }) => groupDelta.orientationId !== "upright-yaw-0",
    );

    expect(rotated).toBeDefined();
    expect(rotated!.transformedChildParts).toHaveLength(2);
    for (const original of fixture.children) {
      expect(
        rotated!.transformedChildParts.find(({ id }) => id === original.id)?.transform,
      ).toEqual(composeRigidTransforms(rotated!.groupDelta, original.transform));
    }
  });

  it("returns a complete empty result when no catalog-compatible bridge exists", () => {
    const source = documentWith([
      plate("parent", [0, 8, 0], "builtin:tile-1x1"),
      plate("child", [100, 8, 0], "builtin:tile-1x1"),
    ]);
    const result = enumerate(source, ["child"]);

    expect(result.counts.connectorPairingChecks).toBe(24);
    expect(result.counts.axisCompatiblePairingSeeds).toBe(0);
    expect(result.counts.distinctGroupDeltas).toBe(0);
    expect(result.candidates).toEqual([]);
  });

  it("allows only staged cross-component overlap between independently hard-valid components", () => {
    const staged = documentWith([plate("parent", [0, 8, 0]), plate("child", [0, 8, 0])]);
    const stagedBlockers = validateBrickDocument(staged).issues.filter(
      ({ severity }) => severity === "blocking",
    );
    expect(stagedBlockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["DISCONNECTED_ASSEMBLY", "PART_BODY_COLLISION"]),
    );
    expect(
      stagedBlockers
        .filter(({ code }) => code.includes("COLLISION"))
        .every(
          ({ partIds }) =>
            partIds.length === 2 && partIds.includes("parent") && partIds.includes("child"),
        ),
    ).toBe(true);
    const result = enumerate(staged, ["child"]);
    expect(result.counts.groupDeltasVisited).toBe(result.counts.distinctGroupDeltas);
    expect(
      result.candidates.every(({ validationReport }) => validationReport.documentGloballyValid),
    ).toBe(true);

    const internalCollision = documentWith([
      plate("parent-a", [0, 8, 0]),
      plate("parent-b", [0, 8, 0]),
      plate("child", [100, 8, 0]),
    ]);
    expect(() =>
      requireRigidSubassemblyReturnBaseWorld(
        internalCollision,
        validateBrickDocument(internalCollision),
        new Set(["child"]),
      ),
    ).toThrow(/cross-boundary staged collision blockers/u);
    expect(
      errorCode({
        document: internalCollision,
        childPartIds: ["child"],
        workLimits: GENEROUS_LIMITS,
      }),
    ).toBe("PARENT_DISCONNECTED");

    const extraBlocker = documentWith(
      [plate("parent-a", [0, 8, 0]), plate("parent-b", [100, 8, 0]), plate("child", [200, 8, 0])],
      [
        connection(
          "invalid-parent-edge",
          "parent-a",
          "stud:0:0",
          "parent-b",
          "undersideClutch:0:0",
        ),
      ],
    );
    expect(
      validateBrickDocument(extraBlocker)
        .issues.filter(({ severity }) => severity === "blocking")
        .map(({ code }) => code),
    ).toEqual(expect.arrayContaining(["DISCONNECTED_ASSEMBLY", "CONNECTION_TRANSFORM_MISMATCH"]));
    expect(
      errorCode({
        document: extraBlocker,
        childPartIds: ["child"],
        workLimits: GENEROUS_LIMITS,
      }),
    ).toBe("INTERNAL_CONNECTION_INVALID");
  });

  it("rejects connector-derived poses whose remaining geometry collides", () => {
    const lower = plate("lower", [0, 8, 0], "builtin:plate-1x2");
    const upper = plate("upper", [0, 0, -10]);
    const child = plate("child", [100, 8, 0], "builtin:plate-1x2");
    const source = documentWith(
      [lower, upper, child],
      [connection("parent-edge", lower.id, "stud:0:0", upper.id, "undersideClutch:0:0")],
    );
    const result = enumerate(source, [child.id]);

    expect(result.counts.rejectedCollision).toBeGreaterThan(0);
    expect(result.counts.accepted).toBeGreaterThan(0);
    expect(
      result.candidates.every(({ validationReport }) => validationReport.issues.length === 0),
    ).toBe(true);
  });

  it("never seeds a cross edge through already occupied shared connector capacity", () => {
    const parent = plate("parent", [0, 8, 0]);
    const tile = plate("tile", [100, 0, 0], "builtin:tile-1x2-chamfered-indented");
    const center = plate("center", [100, 8, 0]);
    const source = documentWith(
      [parent, tile, center],
      [connection("child-center", center.id, "stud:0:0", tile.id, "undersideClutch:1")],
    );
    const result = enumerate(source, [tile.id, center.id]);

    expect(result.counts.freeChildConnectors).toBe(1);
    expect(result.counts.accepted).toBeGreaterThan(0);
    expect(
      result.candidates
        .flatMap(({ crossEdges }) => crossEdges)
        .every(({ a, b }) => a.partId !== tile.id && b.partId !== tile.id),
    ).toBe(true);
  });

  it("fails closed for inexact IDs and disconnected child or parent selections", () => {
    const basic = documentWith([plate("parent", [0, 8, 0]), plate("child", [100, 8, 0])]);
    const input = (childPartIds: readonly string[]): RigidSubassemblyReturnInput => ({
      document: basic,
      childPartIds,
      workLimits: GENEROUS_LIMITS,
    });

    expect(errorCode(input([]))).toBe("CHILD_ID_INVALID");
    expect(errorCode(input(["child", "child"]))).toBe("CHILD_ID_DUPLICATE");
    expect(errorCode(input(["missing"]))).toBe("CHILD_PART_MISSING");
    expect(errorCode(input(["parent", "child"]))).toBe("PARENT_EMPTY");

    const threeLoose = documentWith([
      plate("a", [0, 8, 0]),
      plate("b", [100, 8, 0]),
      plate("c", [200, 8, 0]),
    ]);
    expect(
      errorCode({ document: threeLoose, childPartIds: ["b", "c"], workLimits: GENEROUS_LIMITS }),
    ).toBe("CHILD_DISCONNECTED");
    expect(
      errorCode({ document: threeLoose, childPartIds: ["c"], workLimits: GENEROUS_LIMITS }),
    ).toBe("PARENT_DISCONNECTED");
  });

  it("is deterministic for the same exact child set regardless of ID input order", () => {
    const fixture = stackedChildFixture(2);
    const forward = enumerate(fixture.document, fixture.childIds);
    const reverse = enumerate(fixture.document, [...fixture.childIds].reverse());

    expect(reverse).toEqual(forward);
    expect(forward.childPartIds).toEqual([...fixture.childIds].sort());
    expect(forward.candidates.map(({ groupDelta }) => groupDelta)).toEqual(
      [...forward.candidates]
        .map(({ groupDelta }) => groupDelta)
        .sort(
          (left, right) =>
            left.positionLdu[0] - right.positionLdu[0] ||
            left.positionLdu[1] - right.positionLdu[1] ||
            left.positionLdu[2] - right.positionLdu[2] ||
            left.orientationId.localeCompare(right.orientationId),
        ),
    );
  });

  it("throws instead of returning a truncated result when any explicit work limit is exceeded", () => {
    const source = documentWith([plate("parent", [0, 8, 0]), plate("child", [100, 8, 0])]);
    const workLimits = { ...GENEROUS_LIMITS, maxConnectorPairingChecks: 1 };

    expect(errorCode({ document: source, childPartIds: ["child"], workLimits })).toBe(
      "WORK_LIMIT_EXCEEDED",
    );
  });

  it("moves all 23 exact children rigidly and exposes a 22-of-23 preservation mutation", () => {
    const fixture = stackedChildFixture(23);
    const result = enumerate(fixture.document, [...fixture.childIds].reverse());
    const candidate = result.candidates[0]!;

    expect({
      accepted: result.counts.accepted,
      groupDelta: candidate.groupDelta,
      crossEdges: candidate.crossEdges.map(({ a, b }) => ({ a, b })),
    }).toEqual({
      accepted: 4,
      groupDelta: {
        orientationId: "upright-yaw-0",
        positionLdu: [-100, -8, 0],
      },
      crossEdges: [
        {
          a: { partId: "parent", portId: "stud:0:0" },
          b: { partId: "child-00", portId: "undersideClutch:0:0" },
        },
      ],
    });

    expect(result.counts.childParts).toBe(23);
    expect(candidate).toBeDefined();
    expect(candidate.transformedChildParts).toHaveLength(23);
    expect(candidate.operations.filter(({ kind }) => kind === "updatePart")).toHaveLength(23);
    expect(candidate.operations.filter(({ kind }) => kind === "addConnection")).toHaveLength(
      candidate.crossEdges.length,
    );
    expect(applyBuildOperations(fixture.document, candidate.operations)).toEqual(
      candidate.hardValidDocument,
    );
    expect(candidate.hardValidDocument.parts.find(({ id }) => id === fixture.parent.id)).toEqual(
      fixture.parent,
    );
    for (const original of fixture.children) {
      const transformed = candidate.transformedChildParts.find(({ id }) => id === original.id)!;
      expect(identityFields(transformed)).toEqual(identityFields(original));
      expect(transformed.transform).toEqual(
        composeRigidTransforms(candidate.groupDelta, original.transform),
      );
    }

    const mutated: BrickDocumentV1 = {
      ...candidate.hardValidDocument,
      parts: candidate.hardValidDocument.parts.map((part) =>
        part.id === fixture.childIds[11]
          ? { ...part, transform: fixture.children[11]!.transform }
          : part,
      ),
    };
    const mutationReport = validateBrickDocument(mutated);
    expect(mutationReport.documentGloballyValid).toBe(false);
    expect(mutationReport.issues.map(({ code }) => code)).toContain(
      "CONNECTION_TRANSFORM_MISMATCH",
    );
  });
});
