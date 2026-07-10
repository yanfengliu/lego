import { describe, expect, it } from "vitest";

import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  BuildOperation,
  BuildProgramV1,
  ScopeCapabilityV1,
} from "@lego-studio/protocol";

import {
  BUILTIN_COMPILER_SNAPSHOT_HASH,
  canonicalDigest,
  compileBuildProgram,
  documentStructuralHash,
  normalizeBuildProgram,
  normalizeScopeCapability,
  verifyAssemblyPatchAgainstCapability,
} from "./index";
import { createEmptyBrickDocument, createPartInstance } from "./factory";
import { applyBuildOperations } from "./operations";

function scopeFor(
  base: BrickDocumentV1,
  overrides: Partial<ScopeCapabilityV1> = {},
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "scope-acceptance-1",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-1000, -1000, -1000], maxLdu: [1000, 1000, 1000] },
    allowedCatalogPartIds: PART_DEFINITIONS.map(({ id }) => id),
    allowedColorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    budgets: { maxAddedParts: 20, maxRemovedParts: 20, maxOperations: 50 },
    ...overrides,
  };
}

function patchFor(
  base: BrickDocumentV1,
  scope: ScopeCapabilityV1,
  operations: readonly BuildOperation[],
): AssemblyPatchV1 {
  return {
    schemaVersion: "lego.assembly-patch/1",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    truthSnapshotHash: canonicalDigest(base.truth),
    scopeCapabilityId: scope.capabilityId,
    scopeDigest: canonicalDigest(normalizeScopeCapability(scope)),
    operations,
    provenance: {
      jobId: "job-acceptance-1",
      candidateId: "candidate-acceptance-1",
      compilerSnapshotHash: BUILTIN_COMPILER_SNAPSHOT_HASH,
      buildProgramHash: canonicalDigest({ schemaVersion: "fixture-program/1", operations }),
    },
  };
}

function documentWithPart(
  id: string,
  positionLdu: readonly [number, number, number] = [0, 0, 0],
): BrickDocumentV1 {
  const empty = createEmptyBrickDocument({ id: `document-${id}`, name: `Document ${id}` });
  const part = createPartInstance({
    id,
    transform: { positionLdu, orientationId: "upright-yaw-0" },
  });
  return applyBuildOperations(empty, [
    { kind: "addPart", operationId: `add-${id}`, part, semanticRegionIds: [] },
  ]);
}

function placementProgram(x = 80): BuildProgramV1 {
  return {
    schemaVersion: "lego.build-program/1",
    operations: [
      {
        kind: "placePart",
        operationId: "place-candidate-part",
        localPartId: "candidate-part",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:blue",
        transform: { positionLdu: [x, 0, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: ["shell", "candidate"],
      },
    ],
  };
}

function attachedPlacementProgram(basePartId: string): BuildProgramV1 {
  const program = placementProgram(0);
  const placement = program.operations[0]!;
  if (placement.kind !== "placePart") throw new Error("Expected placePart fixture");
  return {
    schemaVersion: "lego.build-program/1",
    operations: [
      {
        ...placement,
        transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
      },
      {
        kind: "attach",
        operationId: "attach-candidate-part",
        a: { partId: basePartId, portId: "stud:0:0" },
        b: { partId: "candidate-part", portId: "undersideClutch:0:0" },
        connectionKind: "stud-tube",
      },
    ],
  };
}

function compileCandidate(
  base: BrickDocumentV1,
  program: BuildProgramV1,
  scope: ScopeCapabilityV1,
) {
  const result = compileBuildProgram(base, program, {
    scope,
    jobId: "job-acceptance-1",
    candidateId: "candidate-acceptance-1",
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.issues.map(({ code }) => code).join(", "));
  return result;
}

describe("independent assembly-patch verification", () => {
  it("replays a compiler patch without mutating inputs and returns deeply frozen artifacts", () => {
    const base = createEmptyBrickDocument({ id: "acceptance-success", name: "Acceptance" });
    const scope = scopeFor(base);
    const compiled = compileCandidate(base, placementProgram(), scope);
    const beforeBase = structuredClone(base);
    const beforePatch = structuredClone(compiled.patch);
    const beforeScope = structuredClone(scope);

    const verified = verifyAssemblyPatchAgainstCapability(base, compiled.patch, scope);

    expect(verified).toMatchObject({ ok: true });
    if (!verified.ok) return;
    expect(verified.document).toEqual(compiled.document);
    expect(verified.validationReport).toEqual(compiled.validationReport);
    expect(base).toEqual(beforeBase);
    expect(compiled.patch).toEqual(beforePatch);
    expect(scope).toEqual(beforeScope);
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(verified.document)).toBe(true);
    expect(Object.isFrozen(verified.document.parts)).toBe(true);
    expect(Object.isFrozen(verified.validationReport)).toBe(true);
  });

  it.each([
    ["base revision", { baseRevision: "revision-forged" }, "PATCH_BASE_MISMATCH"],
    ["base hash", { baseDocumentHash: `sha256:${"0".repeat(64)}` }, "PATCH_BASE_MISMATCH"],
    ["truth hash", { truthSnapshotHash: `sha256:${"0".repeat(64)}` }, "PATCH_TRUTH_MISMATCH"],
    ["scope identity", { scopeCapabilityId: "scope-forged" }, "PATCH_SCOPE_MISMATCH"],
    ["scope digest", { scopeDigest: `sha256:${"0".repeat(64)}` }, "PATCH_SCOPE_MISMATCH"],
  ] as const)("rejects a mismatched %s", (_label, override, expectedCode) => {
    const base = createEmptyBrickDocument({ id: "binding-check", name: "Bindings" });
    const scope = scopeFor(base);
    const compiled = compileCandidate(base, placementProgram(), scope);

    expect(
      verifyAssemblyPatchAgainstCapability(base, { ...compiled.patch, ...override }, scope),
    ).toMatchObject({ ok: false, issues: [{ code: expectedCode }] });
  });

  it("rejects a retained capability that is not bound to the exact base", () => {
    const base = createEmptyBrickDocument({ id: "scope-base", name: "Scope base" });
    const scope = scopeFor(base);
    const compiled = compileCandidate(base, placementProgram(), scope);
    const mismatchedScope = {
      ...scope,
      baseDocumentHash: `sha256:${"0".repeat(64)}`,
    } satisfies ScopeCapabilityV1;
    const patch = {
      ...compiled.patch,
      scopeDigest: canonicalDigest(normalizeScopeCapability(mismatchedScope)),
    } satisfies AssemblyPatchV1;

    expect(verifyAssemblyPatchAgainstCapability(base, patch, mismatchedScope)).toMatchObject({
      ok: false,
      issues: [{ code: "SCOPE_BASE_MISMATCH" }],
    });
  });

  it("recomputes the full scope diff instead of trusting patch provenance", () => {
    const base = documentWithPart("locked-part");
    const permissiveScope = scopeFor(base, { mutablePartIds: ["locked-part"] });
    const program: BuildProgramV1 = {
      schemaVersion: "lego.build-program/1",
      operations: [
        {
          kind: "movePart",
          operationId: "move-locked-part",
          partId: "locked-part",
          transform: { positionLdu: [80, 0, 0], orientationId: "upright-yaw-0" },
        },
      ],
    };
    const compiled = compileCandidate(base, program, permissiveScope);
    const retainedScope = scopeFor(base, {
      frozenPartIds: ["locked-part"],
      mutablePartIds: [],
    });
    const forgedPatch = {
      ...compiled.patch,
      scopeDigest: canonicalDigest(normalizeScopeCapability(retainedScope)),
    } satisfies AssemblyPatchV1;

    expect(verifyAssemblyPatchAgainstCapability(base, forgedPatch, retainedScope)).toMatchObject({
      ok: false,
      issues: [{ code: "SCOPE_PART_LOCKED" }],
    });
  });

  it("requires the final connection payload to preserve every required attachment port", () => {
    const base = documentWithPart("boundary-part");
    const scope = scopeFor(base, {
      mutablePartIds: ["boundary-part"],
      requiredAttachmentPorts: [{ partId: "boundary-part", portId: "stud:0:0" }],
    });
    const addedPart = createPartInstance({
      id: "added-part",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
      source: "ai",
      sourceId: "candidate-acceptance-1",
    });
    const requiredConnection = {
      id: "reused-connection-id",
      kind: "stud-tube",
      a: { partId: "boundary-part", portId: "stud:0:0" },
      b: { partId: addedPart.id, portId: "undersideClutch:0:0" },
      provenance: { source: "ai", sourceId: "candidate-acceptance-1" },
    } as const;
    const replacementConnection = {
      ...requiredConnection,
      a: { partId: "boundary-part", portId: "undersideClutch:0:0" },
      b: { partId: addedPart.id, portId: "stud:0:0" },
    } as const;
    const operations: BuildOperation[] = [
      {
        kind: "addPart",
        operationId: "add-required-part",
        part: addedPart,
        semanticRegionIds: [],
      },
      {
        kind: "addConnection",
        operationId: "add-required-connection",
        connection: requiredConnection,
      },
      {
        kind: "removeConnection",
        operationId: "remove-required-connection",
        connection: requiredConnection,
      },
      {
        kind: "addConnection",
        operationId: "reuse-connection-id",
        connection: replacementConnection,
      },
    ];

    const verified = verifyAssemblyPatchAgainstCapability(
      base,
      patchFor(base, scope, operations),
      scope,
    );
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.issues.map(({ code }) => code)).toContain("SCOPE_REQUIRED_ATTACHMENT_MISSING");
  });

  it("rejects a required attachment boundary manufactured by added parts", () => {
    const base = createEmptyBrickDocument({ id: "manufactured-base", name: "Manufactured base" });
    const lower = createPartInstance({ id: "manufactured-lower", source: "ai" });
    const upper = createPartInstance({
      id: "manufactured-upper",
      transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
      source: "ai",
    });
    const scope = scopeFor(base, {
      requiredAttachmentPorts: [{ partId: lower.id, portId: "stud:0:0" }],
    });
    const operations: BuildOperation[] = [
      {
        kind: "addPart",
        operationId: "add-manufactured-lower",
        part: lower,
        semanticRegionIds: [],
      },
      {
        kind: "addPart",
        operationId: "add-manufactured-upper",
        part: upper,
        semanticRegionIds: [],
      },
      {
        kind: "addConnection",
        operationId: "connect-manufactured-boundary",
        connection: {
          id: "manufactured-connection",
          kind: "stud-tube",
          a: { partId: lower.id, portId: "stud:0:0" },
          b: { partId: upper.id, portId: "undersideClutch:0:0" },
          provenance: { source: "ai" },
        },
      },
    ];

    const verified = verifyAssemblyPatchAgainstCapability(
      base,
      patchFor(base, scope, operations),
      scope,
    );
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.issues.map(({ code }) => code)).toContain("SCOPE_REQUIRED_ATTACHMENT_INVALID");
  });

  it.each([
    [
      "illegal orientation",
      createPartInstance({
        id: "unbounded-part",
        transform: { positionLdu: [0, 0, 0], orientationId: "illegal-orientation" },
      }),
    ],
    [
      "unknown catalog part",
      createPartInstance({ id: "unbounded-part", catalogPartId: "unknown:part" }),
    ],
  ] as const)("fails closed on bounds unavailable for an %s", (_label, part) => {
    const empty = createEmptyBrickDocument({ id: "unbounded-base", name: "Unbounded base" });
    const base: BrickDocumentV1 = {
      ...empty,
      parts: [part],
      submodels: [{ id: "root", name: "Root", partIds: [part.id] }],
      steps: [{ id: "step-1", index: 0, name: "Step 1", partIds: [part.id] }],
    };
    const scope = scopeFor(base, {
      mutablePartIds: [part.id],
      allowedVolume: { minLdu: [-100, -100, -100], maxLdu: [100, 100, 100] },
      allowedCatalogPartIds: [...PART_DEFINITIONS.map(({ id }) => id), "unknown:part"],
    });
    const operations: BuildOperation[] = [
      {
        kind: "updatePart",
        operationId: "move-unbounded-part",
        before: part,
        after: {
          ...part,
          transform: { ...part.transform, positionLdu: [1_000_000, 0, 0] },
        },
      },
    ];

    const verified = verifyAssemblyPatchAgainstCapability(
      base,
      patchFor(base, scope, operations),
      scope,
    );
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.issues.map(({ code }) => code)).toContain("SCOPE_BOUNDS_UNAVAILABLE");
  });

  it("rejects operation-application failures before scope or hard validation", () => {
    const base = createEmptyBrickDocument({ id: "bad-operations", name: "Bad operations" });
    const scope = scopeFor(base);
    const compiled = compileCandidate(base, placementProgram(), scope);
    const operation = compiled.patch.operations[0]!;
    const duplicateOperationPatch = {
      ...compiled.patch,
      operations: [operation, structuredClone(operation)],
    } satisfies AssemblyPatchV1;

    expect(
      verifyAssemblyPatchAgainstCapability(base, duplicateOperationPatch, scope),
    ).toMatchObject({ ok: false, issues: [{ code: "PATCH_APPLICATION_FAILED" }] });
  });

  it("rejects a schema-valid patch that introduces a hard collision", () => {
    const base = documentWithPart("existing-part");
    const scope = scopeFor(base, {
      requiredAttachmentPorts: [{ partId: "existing-part", portId: "stud:0:0" }],
    });
    const compiled = compileCandidate(base, attachedPlacementProgram("existing-part"), scope);
    expect(verifyAssemblyPatchAgainstCapability(base, compiled.patch, scope)).toMatchObject({
      ok: true,
    });
    const operation = compiled.patch.operations.find(({ kind }) => kind === "addPart");
    expect(operation?.kind).toBe("addPart");
    if (operation?.kind !== "addPart") return;
    const collisionPatch = {
      ...compiled.patch,
      operations: compiled.patch.operations.map((candidateOperation) =>
        candidateOperation.kind === "addPart"
          ? {
              ...candidateOperation,
              part: {
                ...candidateOperation.part,
                transform: {
                  ...candidateOperation.part.transform,
                  positionLdu: [0, 0, 0],
                },
              },
            }
          : candidateOperation,
      ),
    } satisfies AssemblyPatchV1;

    const verified = verifyAssemblyPatchAgainstCapability(base, collisionPatch, scope);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.issues.map(({ code }) => code)).toContain("PATCH_INTRODUCES_BLOCKING_ISSUE");
    expect(verified.issues.map(({ message }) => message).join("\n")).toContain(
      "PART_BODY_COLLISION",
    );
  });

  it("permits a scoped edit on a draft-invalid base when it adds no blocking failure", () => {
    const empty = createEmptyBrickDocument({ id: "draft-invalid", name: "Draft invalid" });
    const first = createPartInstance({ id: "draft-first", colorId: "builtin:red" });
    const second = createPartInstance({ id: "draft-second", colorId: "builtin:blue" });
    const base = applyBuildOperations(empty, [
      { kind: "addPart", operationId: "add-draft-first", part: first, semanticRegionIds: [] },
      { kind: "addPart", operationId: "add-draft-second", part: second, semanticRegionIds: [] },
    ]);
    const scope = scopeFor(base, { mutablePartIds: [first.id] });
    const operations: BuildOperation[] = [
      {
        kind: "updatePart",
        operationId: "recolor-draft-first",
        before: first,
        after: { ...first, colorId: "builtin:yellow" },
      },
    ];

    const verified = verifyAssemblyPatchAgainstCapability(
      base,
      patchFor(base, scope, operations),
      scope,
    );
    expect(verified).toMatchObject({
      ok: true,
      validationReport: { patchValid: true, documentGloballyValid: false },
    });
  });

  it("fails closed when hard validation cannot produce complete evidence", () => {
    const empty = createEmptyBrickDocument({ id: "dense-acceptance", name: "Dense acceptance" });
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
    const scope = scopeFor(base, { mutablePartIds: [parts[0]!.id] });
    const before = parts[0]!;
    const operations: BuildOperation[] = [
      {
        kind: "updatePart",
        operationId: "recolor-dense-part",
        before,
        after: { ...before, colorId: "builtin:blue" },
      },
    ];

    expect(
      verifyAssemblyPatchAgainstCapability(base, patchFor(base, scope, operations), scope),
    ).toMatchObject({ ok: false, issues: [{ code: "HARD_VALIDATION_INCOMPLETE" }] });
  });

  it("rejects a schema-valid base pinned to any truth snapshot other than the active bundle", () => {
    const base = createEmptyBrickDocument({ id: "unsupported-truth", name: "Unsupported truth" });
    const scope = scopeFor(base);
    const compiled = compileCandidate(base, placementProgram(), scope);
    const unsupportedBase: BrickDocumentV1 = {
      ...base,
      truth: {
        ...base.truth,
        catalog: { ...base.truth.catalog, hash: `sha256:${"0".repeat(64)}` },
      },
    };

    expect(
      verifyAssemblyPatchAgainstCapability(unsupportedBase, compiled.patch, scope),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "BASE_TRUTH_SNAPSHOT_UNSUPPORTED" }],
    });
  });

  it("returns frozen typed failures for malformed or non-detachable inputs", () => {
    const base = createEmptyBrickDocument({ id: "invalid-input", name: "Invalid input" });
    const scope = scopeFor(base);
    const compiled = compileCandidate(base, placementProgram(), scope);
    const invalidPatch = { ...compiled.patch, workerDeclaredValid: true };

    const schemaFailure = verifyAssemblyPatchAgainstCapability(base, invalidPatch, scope);
    expect(schemaFailure).toMatchObject({ ok: false, issues: [{ code: "PATCH_SCHEMA_INVALID" }] });
    expect(Object.isFrozen(schemaFailure)).toBe(true);
    if (!schemaFailure.ok) {
      expect(Object.isFrozen(schemaFailure.issues)).toBe(true);
      expect(Object.isFrozen(schemaFailure.issues[0])).toBe(true);
    }

    const detachFailure = verifyAssemblyPatchAgainstCapability(
      new Proxy(base, {}),
      compiled.patch,
      scope,
    );
    expect(detachFailure).toMatchObject({
      ok: false,
      issues: [{ code: "BASE_DOCUMENT_SCHEMA_INVALID" }],
    });
    expect(Object.isFrozen(detachFailure)).toBe(true);

    expect(
      verifyAssemblyPatchAgainstCapability(base, compiled.patch, {
        ...scope,
        workerCanWidenScope: true,
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "SCOPE_SCHEMA_INVALID" }] });
  });
});

describe("public replay normalization", () => {
  it("exports deterministic cloning normalization for programs and retained scopes", () => {
    const base = createEmptyBrickDocument({ id: "normalization", name: "Normalization" });
    const program = placementProgram();
    const scope = scopeFor(base, {
      frozenPartIds: ["z", "a"],
      allowedColorIds: ["builtin:yellow", "builtin:blue"],
    });
    const normalizedProgram = normalizeBuildProgram(program);
    const normalizedScope = normalizeScopeCapability(scope);

    expect(normalizedProgram.operations[0]).toMatchObject({
      kind: "placePart",
      semanticTags: ["candidate", "shell"],
    });
    expect(normalizedScope.frozenPartIds).toEqual(["a", "z"]);
    expect(normalizedScope.allowedColorIds).toEqual(["builtin:blue", "builtin:yellow"]);
    expect(program.operations[0]).toMatchObject({ semanticTags: ["shell", "candidate"] });
    expect(scope.frozenPartIds).toEqual(["z", "a"]);
  });
});
