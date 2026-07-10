import { describe, expect, it } from "vitest";

import type { BrickDocumentV1, BuildOperation, ConnectionEdge } from "@lego-studio/protocol";

import { canonicalBrickDocument } from "./document";
import { createEmptyBrickDocument, createPartInstance } from "./factory";
import {
  MAX_BUILD_OPERATIONS,
  OperationApplicationError,
  applyBuildOperations,
  invertBuildOperations,
} from "./operations";

function baseDocument(): BrickDocumentV1 {
  return createEmptyBrickDocument({ id: "operation-document", name: "Operations" });
}

const lower = createPartInstance({ id: "lower" });
const upper = createPartInstance({
  id: "upper",
  colorId: "builtin:blue",
  transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
});
const edge: ConnectionEdge = {
  id: "connection-1",
  kind: "stud-tube",
  a: { partId: "lower", portId: "stud:0:0" },
  b: { partId: "upper", portId: "undersideClutch:0:0" },
  provenance: { source: "manual" },
};

const buildStack: readonly BuildOperation[] = [
  { kind: "addPart", operationId: "add-lower", part: lower, semanticRegionIds: [] },
  { kind: "addPart", operationId: "add-upper", part: upper, semanticRegionIds: [] },
  { kind: "addConnection", operationId: "connect", connection: edge },
];

describe("invertible build operations", () => {
  it("applies operations immutably and maintains membership annotations", () => {
    const base = baseDocument();
    const result = applyBuildOperations(base, buildStack);

    expect(result.parts.map(({ id }) => id)).toEqual(["lower", "upper"]);
    expect(result.submodels[0]?.partIds).toEqual(["lower", "upper"]);
    expect(result.steps[0]?.partIds).toEqual(["lower", "upper"]);
    expect(result.connections).toEqual([edge]);
    expect(base.parts).toEqual([]);
    expect(result.revision).toMatch(/^revision-[0-9a-f]{24}$/);
  });

  it("round-trips through the exact inverse without overwriting history", () => {
    const base = baseDocument();
    const built = applyBuildOperations(base, buildStack);
    const restored = applyBuildOperations(built, invertBuildOperations(buildStack));

    expect(canonicalBrickDocument({ ...restored, revision: base.revision })).toBe(
      canonicalBrickDocument(base),
    );
    expect(restored.revision).not.toBe(base.revision);
  });

  it("round-trips semantically canonicalized part and connection payloads", () => {
    const tagged = createPartInstance({ id: "tagged", semanticTags: ["z", "a"] });
    const rawPartOperation: BuildOperation = {
      kind: "addPart",
      operationId: "add-tagged",
      part: tagged,
      semanticRegionIds: [],
    };
    const partBuilt = applyBuildOperations(baseDocument(), [rawPartOperation]);
    expect(partBuilt.parts[0]?.semanticTags).toEqual(["a", "z"]);
    expect(() =>
      applyBuildOperations(partBuilt, invertBuildOperations([rawPartOperation])),
    ).not.toThrow();

    const withParts = applyBuildOperations(baseDocument(), buildStack.slice(0, 2));
    const reversedEdge = { ...edge, a: edge.b, b: edge.a };
    const rawConnectionOperation: BuildOperation = {
      kind: "addConnection",
      operationId: "connect-reversed",
      connection: reversedEdge,
    };
    const connected = applyBuildOperations(withParts, [rawConnectionOperation]);
    expect(connected.connections[0]?.a.portId).toBe("stud:0:0");
    expect(() =>
      applyBuildOperations(connected, invertBuildOperations([rawConnectionOperation])),
    ).not.toThrow();
  });

  it("preserves semantic-region membership through an exact inverse", () => {
    const base = {
      ...baseDocument(),
      semanticRegions: [{ id: "body", label: "Body", partIds: [] }],
    } satisfies BrickDocumentV1;
    const operations: readonly BuildOperation[] = [
      {
        kind: "addPart",
        operationId: "add-region-part",
        part: lower,
        semanticRegionIds: ["body"],
      },
    ];
    const built = applyBuildOperations(base, operations);
    expect(built.semanticRegions[0]?.partIds).toEqual(["lower"]);

    const restored = applyBuildOperations(built, invertBuildOperations(operations));
    expect(canonicalBrickDocument({ ...restored, revision: base.revision })).toBe(
      canonicalBrickDocument(base),
    );
  });

  it("round-trips removal of a schema-valid orphaned draft part", () => {
    const part = createPartInstance({ id: "orphan", submodelId: "missing", stepId: "missing" });
    const base = { ...baseDocument(), parts: [part] } satisfies BrickDocumentV1;
    const operations: readonly BuildOperation[] = [
      {
        kind: "removePart",
        operationId: "remove-orphan",
        part,
        semanticRegionIds: [],
      },
    ];
    const removed = applyBuildOperations(base, operations);
    const restored = applyBuildOperations(removed, invertBuildOperations(operations));

    expect(canonicalBrickDocument({ ...restored, revision: base.revision })).toBe(
      canonicalBrickDocument(base),
    );
  });

  it("rejects stale before-values", () => {
    const built = applyBuildOperations(baseDocument(), buildStack);
    const stale = { ...upper, colorId: "builtin:yellow" };
    expect(() =>
      applyBuildOperations(built, [
        {
          kind: "updatePart",
          operationId: "stale-update",
          before: stale,
          after: { ...stale, colorId: "builtin:white" },
        },
      ]),
    ).toThrowError(expect.objectContaining({ code: "PART_BEFORE_MISMATCH" }));
  });

  it("requires incident connections to be removed before their parts", () => {
    const built = applyBuildOperations(baseDocument(), buildStack);
    expect(() =>
      applyBuildOperations(built, [
        { kind: "removePart", operationId: "remove-upper", part: upper, semanticRegionIds: [] },
      ]),
    ).toThrowError(expect.objectContaining({ code: "PART_STILL_CONNECTED" }));

    const removed = applyBuildOperations(built, [
      { kind: "removeConnection", operationId: "disconnect", connection: edge },
      { kind: "removePart", operationId: "remove-upper", part: upper, semanticRegionIds: [] },
    ]);
    expect(removed.parts.map(({ id }) => id)).toEqual(["lower"]);
  });

  it("orders inverse dependencies for edges recorded before their endpoint parts", () => {
    const operations: readonly BuildOperation[] = [
      { kind: "addConnection", operationId: "early-edge", connection: edge },
      { kind: "addPart", operationId: "late-lower", part: lower, semanticRegionIds: [] },
      { kind: "addPart", operationId: "late-upper", part: upper, semanticRegionIds: [] },
    ];
    const built = applyBuildOperations(baseDocument(), operations);
    const restored = applyBuildOperations(built, invertBuildOperations(operations));
    expect(restored.parts).toEqual([]);
    expect(restored.connections).toEqual([]);
  });

  it("restores a removed dangling edge in a schema-valid draft", () => {
    const base = { ...baseDocument(), connections: [edge] } satisfies BrickDocumentV1;
    const operations: readonly BuildOperation[] = [
      { kind: "removeConnection", operationId: "remove-dangling", connection: edge },
    ];
    const removed = applyBuildOperations(base, operations);
    const restored = applyBuildOperations(removed, invertBuildOperations(operations));
    expect(canonicalBrickDocument({ ...restored, revision: base.revision })).toBe(
      canonicalBrickDocument(base),
    );
  });

  it("moves step membership as part of an authoritative part update", () => {
    const base = {
      ...baseDocument(),
      steps: [
        { id: "step-1", index: 0, name: "Step 1", partIds: [] },
        { id: "step-2", index: 1, name: "Step 2", partIds: [] },
      ],
    } satisfies BrickDocumentV1;
    const built = applyBuildOperations(base, [
      { kind: "addPart", operationId: "add", part: lower, semanticRegionIds: [] },
    ]);
    const moved = applyBuildOperations(built, [
      {
        kind: "updatePart",
        operationId: "move-step",
        before: lower,
        after: { ...lower, stepId: "step-2" },
      },
    ]);
    expect(moved.steps[0]?.partIds).toEqual([]);
    expect(moved.steps[1]?.partIds).toEqual(["lower"]);
  });

  it("rejects duplicate operation identifiers deterministically", () => {
    expect(() =>
      applyBuildOperations(baseDocument(), [
        { kind: "addPart", operationId: "same", part: lower, semanticRegionIds: [] },
        { kind: "addPart", operationId: "same", part: upper, semanticRegionIds: [] },
      ]),
    ).toThrowError(OperationApplicationError);
  });

  it("fails closed on unknown runtime operations before mutating the document", () => {
    const base = baseDocument();
    expect(() =>
      applyBuildOperations(base, [
        { kind: "executeScript", operationId: "hostile" } as unknown as BuildOperation,
      ]),
    ).toThrowError(expect.objectContaining({ code: "OPERATION_SCHEMA_INVALID" }));
    expect(base.parts).toEqual([]);
    expect(base.revision).toBe("revision-0");
  });

  it("fails closed on schema-invalid base documents", () => {
    const base = {
      ...baseDocument(),
      parts: [
        {
          ...lower,
          transform: { positionLdu: [0, 0.5, 0], orientationId: "upright-yaw-0" },
        },
      ],
    } as unknown as BrickDocumentV1;
    expect(() => applyBuildOperations(base, [])).toThrowError(
      expect.objectContaining({ code: "BASE_SCHEMA_INVALID" }),
    );
  });

  it("requires explicit migration for an unsupported truth snapshot", () => {
    const base = baseDocument();
    const unsupported: BrickDocumentV1 = {
      ...base,
      truth: {
        ...base.truth,
        catalog: { ...base.truth.catalog, hash: `sha256:${"f".repeat(64)}` },
      },
    };

    expect(() => applyBuildOperations(unsupported, [])).toThrowError(
      expect.objectContaining({ code: "BASE_TRUTH_SNAPSHOT_UNSUPPORTED" }),
    );
  });

  it("rejects hostile wrappers before applying or rereading operations", () => {
    const base = baseDocument();
    expect(() => applyBuildOperations(new Proxy(base, {}), [])).toThrowError(
      expect.objectContaining({ code: "BASE_SCHEMA_INVALID" }),
    );
    expect(() =>
      applyBuildOperations(base, new Proxy(buildStack, {}) as readonly BuildOperation[]),
    ).toThrowError(expect.objectContaining({ code: "OPERATION_SCHEMA_INVALID" }));
  });

  it.each([
    [
      "submodel",
      "BASE_DUPLICATE_SUBMODEL_ID",
      (base: BrickDocumentV1) => ({
        ...base,
        submodels: [
          { id: "root", name: "First", partIds: [] },
          { id: "root", name: "Second", partIds: [] },
        ],
      }),
    ],
    [
      "step",
      "BASE_DUPLICATE_STEP_ID",
      (base: BrickDocumentV1) => ({
        ...base,
        steps: [
          { id: "step-1", index: 0, name: "First", partIds: [] },
          { id: "step-1", index: 1, name: "Second", partIds: [] },
        ],
      }),
    ],
    [
      "semantic region",
      "BASE_DUPLICATE_SEMANTIC_REGION_ID",
      (base: BrickDocumentV1) => ({
        ...base,
        semanticRegions: [
          { id: "body", label: "First", partIds: [] },
          { id: "body", label: "Second", partIds: [] },
        ],
      }),
    ],
  ])("rejects duplicate %s identifiers before map construction", (_label, code, mutate) => {
    expect(() => applyBuildOperations(mutate(baseDocument()), [])).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  it("rejects operation batches above the deterministic hard limit", () => {
    const operation: BuildOperation = {
      kind: "addPart",
      operationId: "over-limit",
      part: lower,
      semanticRegionIds: [],
    };
    expect(() =>
      applyBuildOperations(baseDocument(), Array(MAX_BUILD_OPERATIONS + 1).fill(operation)),
    ).toThrowError(expect.objectContaining({ code: "OPERATION_LIMIT_EXCEEDED" }));
  });

  it("derives the same result revision for the same base and operation bytes", () => {
    expect(applyBuildOperations(baseDocument(), buildStack)).toEqual(
      applyBuildOperations(baseDocument(), buildStack),
    );
  });
});
