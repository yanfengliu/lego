import { describe, expect, it } from "vitest";

import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type {
  BrickDocumentV1,
  BuildOperation,
  BuildProgramV1,
  ScopeCapabilityV1,
} from "@lego-studio/protocol";
import { validateAssemblyPatchV1 } from "@lego-studio/protocol";

import {
  BUILD_PROGRAM_COMPILER_MANIFEST,
  BUILD_PROGRAM_COMPILER_VERSION,
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  compileBuildProgram,
} from "./compiler";
import { canonicalDigest } from "./canonical";
import { documentStructuralHash } from "./document";
import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { applyBuildOperations } from "./operations";

function scopeFor(
  base: BrickDocumentV1,
  overrides: Partial<ScopeCapabilityV1> = {},
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "scope-1",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-1000, -1000, -1000], maxLdu: [1000, 1000, 1000] },
    allowedCatalogPartIds: PART_DEFINITIONS.map(({ id }) => id),
    allowedColorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    budgets: { maxAddedParts: 10, maxRemovedParts: 10, maxOperations: 20 },
    ...overrides,
  };
}

function compile(base: BrickDocumentV1, program: unknown, scope = scopeFor(base)) {
  return compileBuildProgram(base, program, {
    scope,
    jobId: "job-1",
    candidateId: "candidate-1",
  });
}

const placeOne: BuildProgramV1 = {
  schemaVersion: "lego.build-program/1",
  operations: [
    {
      kind: "placePart",
      operationId: "place-1",
      localPartId: "first",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: ["body"],
    },
  ],
};

const stackProgram: BuildProgramV1 = {
  schemaVersion: "lego.build-program/1",
  operations: [
    placeOne.operations[0]!,
    {
      kind: "placePart",
      operationId: "place-2",
      localPartId: "second",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:blue",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: ["body"],
    },
    {
      kind: "attach",
      operationId: "attach-1",
      a: { partId: "first", portId: "stud:0:0" },
      b: { partId: "second", portId: "undersideClutch:0:0" },
      connectionKind: "stud-tube",
    },
  ],
};

describe("restricted BuildProgram compiler", () => {
  it("pins scope hardening behavior in compiler snapshot version 2", () => {
    expect(BUILD_PROGRAM_COMPILER_VERSION).toBe("lego.build-program-compiler/2");
    expect(BUILD_PROGRAM_COMPILER_MANIFEST).toMatchObject({
      scopeVolumePolicy: "authoritative-full-bounds-fail-closed/1",
      requiredAttachmentPolicy: "retained-base-port-and-final-surviving-edge/2",
    });
    expect(BUILTIN_COMPILER_SNAPSHOT_HASH).toBe(canonicalDigest(BUILD_PROGRAM_COMPILER_MANIFEST));
  });

  it("compiles untrusted place instructions into a schema-valid immutable patch", () => {
    const base = createEmptyBrickDocument({ id: "compile", name: "Compiler" });
    const result = compile(base, placeOne);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.parts).toHaveLength(1);
    expect(result.document.parts[0]?.id).toMatch(/^part-[0-9a-f]{24}$/);
    expect(result.document.parts[0]?.provenance).toEqual({
      source: "ai",
      sourceId: "candidate-1",
    });
    expect(
      validateAssemblyPatchV1(result.patch),
      validateAssemblyPatchV1.errors?.[0]?.message,
    ).toBe(true);
    expect(applyBuildOperations(base, result.patch.operations)).toEqual(result.document);
    expect(base.parts).toEqual([]);
  });

  it("breaks provider aliases and deeply freezes every successful compiler artifact", () => {
    const base = createEmptyBrickDocument({ id: "aliases", name: "Aliases" });
    const program = structuredClone(placeOne);
    const scope = scopeFor(base);
    const result = compileBuildProgram(base, program, {
      scope,
      jobId: "job-aliases",
      candidateId: "candidate-aliases",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const instruction = program.operations[0];
    if (instruction?.kind === "placePart") {
      (instruction.semanticTags as string[]).push("mutated-provider-tag");
    }
    (scope.allowedColorIds as string[]).length = 0;
    (base as { name: string }).name = "Mutated base";

    expect(result.document.name).toBe("Aliases");
    expect(result.document.parts[0]?.semanticTags).toEqual(["body"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.patch)).toBe(true);
    expect(Object.isFrozen(result.patch.operations)).toBe(true);
    expect(Object.isFrozen(result.patch.operations[0])).toBe(true);
    const compiledOperation = result.patch.operations[0];
    if (compiledOperation?.kind === "addPart") {
      expect(Object.isFrozen(compiledOperation.part)).toBe(true);
      expect(Object.isFrozen(compiledOperation.part.semanticTags)).toBe(true);
      expect(Object.isFrozen(compiledOperation.part.transform.positionLdu)).toBe(true);
    }
    expect(Object.isFrozen(result.document)).toBe(true);
    expect(Object.isFrozen(result.document.parts[0])).toBe(true);
    expect(Object.isFrozen(result.validationReport)).toBe(true);
    expect(Object.isFrozen(result.validationReport.issues)).toBe(true);
    expect(() => {
      (result.patch.operations as BuildOperation[]).push(result.patch.operations[0]!);
    }).toThrow(TypeError);
  });

  it("rejects non-cloneable provider wrappers before schema evaluation", () => {
    const base = createEmptyBrickDocument({ id: "provider-proxy", name: "Provider proxy" });
    const providerProxy = new Proxy(structuredClone(placeOne), {});
    const result = compileBuildProgram(base, providerProxy, {
      scope: scopeFor(base),
      jobId: "job-proxy",
      candidateId: "candidate-proxy",
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "BUILD_PROGRAM_SCHEMA_INVALID" }],
    });
  });

  it("requires explicit migration for a base pinned to unsupported truth", () => {
    const base = createEmptyBrickDocument({ id: "old-truth", name: "Old truth" });
    const unsupported = {
      ...base,
      truth: {
        ...base.truth,
        collisionModel: { ...base.truth.collisionModel, version: "retired/1" },
      },
    } satisfies BrickDocumentV1;
    const result = compileBuildProgram(unsupported, placeOne, {
      scope: scopeFor(unsupported),
      jobId: "job-old-truth",
      candidateId: "candidate-old-truth",
    });

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "BASE_TRUTH_SNAPSHOT_UNSUPPORTED" }],
    });
  });

  it("never grandfathers an incomplete hard-validator budget result", () => {
    const empty = createEmptyBrickDocument({ id: "dense-base", name: "Dense base" });
    const parts = Array.from({ length: 120 }, (_, index) =>
      createPartInstance({
        id: `dense-${index.toString().padStart(3, "0")}`,
        catalogPartId: "builtin:brick-2x4",
      }),
    );
    const base: BrickDocumentV1 = {
      ...empty,
      parts,
      submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
    };
    const program: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "recolorPart",
          operationId: "recolor-dense",
          partId: parts[0]!.id,
          colorId: "builtin:blue",
        },
      ],
    };

    expect(
      compile(base, program, scopeFor(base, { mutablePartIds: [parts[0]!.id] })),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "HARD_VALIDATION_INCOMPLETE" }],
    });
  });

  it("detects aggregate blocking-evidence changes beyond the displayed ID sample", () => {
    const empty = createEmptyBrickDocument({
      id: "aggregate-evidence",
      name: "Aggregate evidence",
    });
    const parts = Array.from({ length: 300 }, (_, index) =>
      createPartInstance({
        id: `a${index.toString().padStart(3, "0")}`,
        transform: { positionLdu: [index * 40, 0, 0], orientationId: "upright-yaw-0" },
      }),
    );
    const base: BrickDocumentV1 = {
      ...empty,
      parts,
      submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: parts.map(({ id }) => id) }],
    };
    const result = compile(base, placeOne, scopeFor(base));

    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "PATCH_INTRODUCES_BLOCKING_ISSUE" }),
      ]),
    });
  });

  it("normalizes set-like program and scope arrays before deterministic hashing", () => {
    const base = createEmptyBrickDocument({ id: "permutations", name: "Permutations" });
    const leftProgram = structuredClone(placeOne);
    const rightProgram = structuredClone(placeOne);
    const leftInstruction = leftProgram.operations[0];
    const rightInstruction = rightProgram.operations[0];
    if (leftInstruction?.kind !== "placePart" || rightInstruction?.kind !== "placePart") return;
    (leftInstruction as unknown as { semanticTags: string[] }).semanticTags = ["shell", "body"];
    (rightInstruction as unknown as { semanticTags: string[] }).semanticTags = ["body", "shell"];

    const catalogPartIds = PART_DEFINITIONS.map(({ id }) => id);
    const colorIds = COLOR_DEFINITIONS.map(({ id }) => id);
    const leftScope = scopeFor(base, {
      allowedCatalogPartIds: [...catalogPartIds].reverse(),
      allowedColorIds: [...colorIds].reverse(),
    });
    const rightScope = scopeFor(base, {
      allowedCatalogPartIds: catalogPartIds,
      allowedColorIds: colorIds,
    });

    const left = compile(base, leftProgram, leftScope);
    const right = compile(base, rightProgram, rightScope);
    expect(left).toEqual(right);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.document.parts[0]?.semanticTags).toEqual(["body", "shell"]);
  });

  it("uses the reviewed built-in compiler snapshot even when untrusted context forges a hash", () => {
    const base = createEmptyBrickDocument({ id: "compiler-hash", name: "Compiler hash" });
    const forgedHash = `sha256:${"f".repeat(64)}` as const;
    const result = compileBuildProgram(base, placeOne, {
      scope: scopeFor(base),
      jobId: "job-forged",
      candidateId: "candidate-forged",
      compilerSnapshotHash: forgedHash,
    } as Parameters<typeof compileBuildProgram>[2] & { compilerSnapshotHash: typeof forgedHash });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.provenance.compilerSnapshotHash).toBe(BUILTIN_COMPILER_SNAPSHOT_HASH);
    expect(result.patch.provenance.compilerSnapshotHash).not.toBe(forgedHash);
  });

  it("resolves local IDs and admits a connected deterministic stack", () => {
    const base = createEmptyBrickDocument({ id: "stack", name: "Stack" });
    const left = compile(base, stackProgram);
    const right = compile(base, stackProgram);
    expect(left).toEqual(right);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.document.connections).toHaveLength(1);
    expect(left.validationReport.documentGloballyValid).toBe(true);
  });

  it("rejects malformed provider data before compilation", () => {
    const base = createEmptyBrickDocument({ id: "malformed", name: "Malformed" });
    const malformed = { ...placeOne, arbitraryJavascript: "alert(1)" };
    const result = compile(base, malformed);
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "BUILD_PROGRAM_SCHEMA_INVALID" }],
    });
    expect(base.parts).toEqual([]);
  });

  it("rejects disconnected, colliding, or otherwise newly invalid output", () => {
    const base = createEmptyBrickDocument({ id: "invalid", name: "Invalid" });
    const disconnected: BuildProgramV1 = {
      ...stackProgram,
      operations: stackProgram.operations.slice(0, 2),
    };
    const result = compile(base, disconnected);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ code }) => code)).toContain("PATCH_INTRODUCES_BLOCKING_ISSUE");
  });

  it("enforces exact base binding and independent scope budgets", () => {
    const base = createEmptyBrickDocument({ id: "scope", name: "Scope" });
    expect(
      compile(base, placeOne, scopeFor(base, { baseRevision: "stale-revision" })),
    ).toMatchObject({ ok: false, issues: [{ code: "SCOPE_BASE_MISMATCH" }] });
    expect(
      compile(
        base,
        placeOne,
        scopeFor(base, {
          budgets: { maxAddedParts: 0, maxRemovedParts: 10, maxOperations: 20 },
        }),
      ),
    ).toMatchObject({ ok: false, issues: [{ code: "SCOPE_ADDITION_BUDGET_EXCEEDED" }] });
    expect(
      compile(
        base,
        stackProgram,
        scopeFor(base, {
          budgets: { maxAddedParts: 10, maxRemovedParts: 10, maxOperations: 1 },
        }),
      ),
    ).toMatchObject({ ok: false, issues: [{ code: "SCOPE_OPERATION_BUDGET_EXCEEDED" }] });

    const existing = createPartInstance({ id: "removable" });
    const removableBase = applyBuildOperations(base, [
      { kind: "addPart", operationId: "seed-removable", part: existing, semanticRegionIds: [] },
    ]);
    const remove: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [{ kind: "removePart", operationId: "remove", partId: existing.id }],
    };
    expect(
      compile(
        removableBase,
        remove,
        scopeFor(removableBase, {
          mutablePartIds: [existing.id],
          budgets: { maxAddedParts: 10, maxRemovedParts: 0, maxOperations: 20 },
        }),
      ),
    ).toMatchObject({ ok: false, issues: [{ code: "SCOPE_REMOVAL_BUDGET_EXCEEDED" }] });
  });

  it("requires each scope attachment port to be free in base and connected by the patch", () => {
    const empty = createEmptyBrickDocument({ id: "required-port", name: "Required port" });
    const lower = createPartInstance({ id: "lower" });
    const base = applyBuildOperations(empty, [
      { kind: "addPart", operationId: "seed-lower", part: lower, semanticRegionIds: [] },
    ]);
    const attach: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "placePart",
          operationId: "place-upper",
          localPartId: "upper",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
          transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
          submodelId: "root",
          stepId: "step-1",
          semanticTags: [],
        },
        {
          kind: "attach",
          operationId: "attach-upper",
          a: { partId: lower.id, portId: "stud:0:0" },
          b: { partId: "upper", portId: "undersideClutch:0:0" },
          connectionKind: "stud-tube",
        },
      ],
    };
    const requiredPort = { partId: lower.id, portId: "stud:0:0" };
    const attached = compile(
      base,
      attach,
      scopeFor(base, { frozenPartIds: [lower.id], requiredAttachmentPorts: [requiredPort] }),
    );
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;

    const upper = attached.document.parts.find(({ id }) => id !== lower.id)!;
    const recolor: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "recolorPart",
          operationId: "recolor-upper",
          partId: upper.id,
          colorId: "builtin:yellow",
        },
      ],
    };
    expect(
      compile(
        attached.document,
        recolor,
        scopeFor(attached.document, {
          mutablePartIds: [upper.id],
          requiredAttachmentPorts: [requiredPort],
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "SCOPE_REQUIRED_ATTACHMENT_OCCUPIED" }),
      ]),
    });
  });

  it("rejects a required attachment manufactured entirely by the candidate", () => {
    const base = createEmptyBrickDocument({ id: "manufactured-boundary", name: "Boundary" });
    const trial = compile(base, stackProgram);
    expect(trial.ok).toBe(true);
    if (!trial.ok) return;
    const manufacturedPort = trial.document.connections[0]!.a;

    const result = compile(
      base,
      stackProgram,
      scopeFor(base, { requiredAttachmentPorts: [manufacturedPort] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ code }) => code)).toContain("SCOPE_REQUIRED_ATTACHMENT_INVALID");
  });

  it("fails closed on changed parts without authoritative bounds but permits their removal", () => {
    const empty = createEmptyBrickDocument({ id: "draft-unbounded", name: "Draft unbounded" });
    const unbounded = createPartInstance({
      id: "unbounded-part",
      transform: { positionLdu: [0, 0, 0], orientationId: "illegal-orientation" },
    });
    const base: BrickDocumentV1 = {
      ...empty,
      parts: [unbounded],
      submodels: [{ id: "root", name: "Root", partIds: [unbounded.id] }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: [unbounded.id] }],
    };
    const scope = scopeFor(base, { mutablePartIds: [unbounded.id] });
    const move: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "movePart",
          operationId: "move-unbounded",
          partId: unbounded.id,
          transform: { positionLdu: [10, 0, 0], orientationId: "illegal-orientation" },
        },
      ],
    };
    const removal: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [{ kind: "removePart", operationId: "remove-unbounded", partId: unbounded.id }],
    };

    const moved = compile(base, move, scope);
    expect(moved.ok).toBe(false);
    if (!moved.ok) {
      expect(moved.issues.map(({ code }) => code)).toContain("SCOPE_BOUNDS_UNAVAILABLE");
    }
    const removed = compile(base, removal, scope);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.document.parts).toHaveLength(0);
  });

  it("rejects edits to locked parts and parts outside the allowed volume", () => {
    const empty = createEmptyBrickDocument({ id: "locked", name: "Locked" });
    const existing = createPartInstance({ id: "existing" });
    const base = applyBuildOperations(empty, [
      { kind: "addPart", operationId: "manual-add", part: existing, semanticRegionIds: [] },
    ]);
    const recolor: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "recolorPart",
          operationId: "recolor",
          partId: "existing",
          colorId: "builtin:blue",
        },
      ],
    };
    const locked = compile(base, recolor, scopeFor(base, { frozenPartIds: ["existing"] }));
    expect(locked).toMatchObject({ ok: false, issues: [{ code: "SCOPE_PART_LOCKED" }] });

    const tinyVolume = compile(
      empty,
      placeOne,
      scopeFor(empty, { allowedVolume: { minLdu: [-1, -1, -1], maxLdu: [1, 1, 1] } }),
    );
    expect(tinyVolume).toMatchObject({
      ok: false,
      issues: [{ code: "SCOPE_VOLUME_EXCEEDED" }],
    });
  });

  it("fails closed for templates absent from the pinned compiler snapshot", () => {
    const base = createEmptyBrickDocument({ id: "template", name: "Template" });
    const program: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "instantiateTemplate",
          operationId: "template-1",
          instanceLocalId: "instance-1",
          templateId: "unreviewed:arbitrary-template",
          parameters: [],
          transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
          submodelId: "root",
          stepId: "step-1",
        },
      ],
    };
    expect(compile(base, program)).toMatchObject({
      ok: false,
      issues: [{ code: "TEMPLATE_NOT_SUPPORTED" }],
    });
  });

  it("preserves semantic-region membership in generated remove operations", () => {
    const empty = createEmptyBrickDocument({ id: "region-remove", name: "Region remove" });
    const part = createPartInstance({ id: "region-part" });
    const base = applyBuildOperations(
      {
        ...empty,
        semanticRegions: [{ id: "region-1", label: "Region", partIds: [] }],
      },
      [
        {
          kind: "addPart",
          operationId: "seed-region-part",
          part,
          semanticRegionIds: ["region-1"],
        },
      ],
    );
    const program: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [{ kind: "removePart", operationId: "remove-region-part", partId: part.id }],
    };
    const result = compile(
      base,
      program,
      scopeFor(base, { mutablePartIds: [part.id], frozenPartIds: [] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.operations.at(-1)).toMatchObject({
      kind: "removePart",
      semanticRegionIds: ["region-1"],
    });
    expect(result.document.semanticRegions[0]?.partIds).toEqual([]);
  });
});
