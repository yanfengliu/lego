import { describe, expect, it } from "vitest";

import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  BuildOperation,
  ConnectionEdge,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalDigest, canonicalStringify } from "./canonical.ts";
import { documentStructuralHash, normalizeBrickDocument } from "./document.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";
import { PatchDiffError, summarizeAssemblyPatch, type PatchDiffErrorCode } from "./index.ts";
import { applyBuildOperations } from "./operations.ts";

function connection(
  id: string,
  aPartId: string,
  aPortId: string,
  bPartId: string,
  bPortId: string,
): ConnectionEdge {
  return {
    id,
    kind: "stud-tube",
    a: { partId: aPartId, portId: aPortId },
    b: { partId: bPartId, portId: bPortId },
    provenance: { source: "manual" },
  };
}

function fixture(): {
  readonly base: BrickDocumentV1;
  readonly patch: AssemblyPatchV1;
  readonly result: BrickDocumentV1;
} {
  const anchor = createPartInstance({
    id: "anchor",
    catalogPartId: "builtin:brick-1x2",
  });
  const removed = createPartInstance({
    id: "removed",
    catalogPartId: "builtin:brick-1x2",
    transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
  });
  const updated = createPartInstance({
    id: "updated",
    semanticTags: ["before"],
    transform: { positionLdu: [100, 0, 0], orientationId: "upright-yaw-0" },
  });
  const oldConnection = connection(
    "connection-old",
    "anchor",
    "stud:0:0",
    "removed",
    "undersideClutch:0:0",
  );
  const empty = createEmptyBrickDocument({ id: "patch-diff", name: "Patch diff" });
  const base = normalizeBrickDocument({
    ...empty,
    parts: [updated, removed, anchor],
    connections: [oldConnection],
    submodels: [{ ...empty.submodels[0]!, partIds: ["updated", "removed", "anchor"] }],
    steps: [
      { ...empty.steps[0]!, partIds: ["updated", "removed", "anchor"] },
      { id: "step-2", index: 1, name: "Step 2", partIds: [] },
    ],
    semanticRegions: [
      { id: "region-z", label: "Z region", partIds: ["updated", "removed"] },
      { id: "region-a", label: "A region", partIds: ["removed"] },
    ],
  });
  const added = createPartInstance({
    id: "added",
    catalogPartId: "builtin:brick-1x2",
    source: "ai",
    sourceId: "candidate-1",
    transform: { positionLdu: [20, -24, 0], orientationId: "upright-yaw-0" },
  });
  const updatedAfter = {
    ...updated,
    colorId: "builtin:yellow",
    stepId: "step-2",
    semanticTags: ["after"],
    provenance: { source: "ai", sourceId: "candidate-1" },
  } as const;
  const newConnection = {
    ...connection("connection-new", "anchor", "stud:0:1", "added", "undersideClutch:0:0"),
    provenance: { source: "ai", sourceId: "candidate-1" },
  } as const;
  const operations: BuildOperation[] = [
    { kind: "removeConnection", operationId: "remove-connection", connection: oldConnection },
    {
      kind: "removePart",
      operationId: "remove-part",
      part: removed,
      semanticRegionIds: ["region-z", "region-a"],
    },
    {
      kind: "updatePart",
      operationId: "update-part",
      before: updated,
      after: updatedAfter,
    },
    {
      kind: "addPart",
      operationId: "add-part",
      part: added,
      semanticRegionIds: ["region-a"],
    },
    { kind: "addConnection", operationId: "add-connection", connection: newConnection },
  ];
  const patch: AssemblyPatchV1 = {
    schemaVersion: "lego.assembly-patch/1",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    truthSnapshotHash: canonicalDigest(base.truth),
    scopeCapabilityId: "scope-1",
    scopeDigest: canonicalDigest({ scope: 1 }),
    operations,
    provenance: {
      jobId: "job-1",
      candidateId: "candidate-1",
      compilerSnapshotHash: canonicalDigest({ compiler: 1 }),
      buildProgramHash: canonicalDigest({ program: 1 }),
    },
  };
  return { base, patch, result: applyBuildOperations(base, operations) };
}

function reportFor(result: BrickDocumentV1): ValidationReportV1 {
  return {
    schemaVersion: "lego.validation-report/1",
    targetDocumentHash: documentStructuralHash(result),
    truthSnapshotHash: canonicalDigest(result.truth),
    validatorSetHash: result.truth.validatorSet.hash,
    patchValid: true,
    documentGloballyValid: true,
    issues: [
      {
        issueId: "advisory-z",
        validatorId: "test.support",
        code: "SUPPORT_ADVISORY",
        severity: "advisory",
        message: "Support is uncertain",
        path: "/parts/2",
        partIds: ["updated"],
        connectionIds: [],
        scope: "patch",
      },
      {
        issueId: "blocking-a",
        validatorId: "test.blocking",
        code: "BLOCKING_TEST",
        severity: "blocking",
        message: "Excluded from advisory summary",
        path: "/parts/0",
        partIds: ["added"],
        connectionIds: [],
        scope: "patch",
      },
      {
        issueId: "advisory-a",
        validatorId: "test.cost",
        code: "COST_ADVISORY",
        severity: "advisory",
        message: "Cost is uncertain",
        path: "/parts/0",
        partIds: ["added"],
        connectionIds: [],
        scope: "document",
      },
    ],
  };
}

function expectDeeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    expectDeeplyFrozen(Reflect.get(value, key), seen);
  }
}

function expectPatchDiffError(action: () => unknown, code: PatchDiffErrorCode): void {
  try {
    action();
    throw new Error("Expected patch diff creation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PatchDiffError);
    expect(error).toMatchObject({ code });
  }
}

describe("assembly patch diff summary", () => {
  it("produces a deterministic, deeply frozen net diff with advisories", () => {
    const { base, patch, result } = fixture();
    const report = reportFor(result);

    const summary = summarizeAssemblyPatch(base, patch, report);
    const repeated = summarizeAssemblyPatch(
      structuredClone(base),
      structuredClone(patch),
      structuredClone(report),
    );

    expect(canonicalStringify(summary)).toBe(canonicalStringify(repeated));
    expect(summary).toMatchObject({
      schemaVersion: "lego.patch-diff-summary/1",
      patchHash: canonicalDigest(patch),
      base: {
        revision: base.revision,
        documentHash: documentStructuralHash(base),
        truthSnapshotHash: canonicalDigest(base.truth),
      },
      result: {
        revision: result.revision,
        documentHash: documentStructuralHash(result),
      },
      counts: {
        operationCount: 5,
        addedPartCount: 1,
        removedPartCount: 1,
        updatedPartCount: 1,
        addedConnectionCount: 1,
        removedConnectionCount: 1,
        affectedPartCount: 4,
        changedSemanticRegionCount: 2,
        semanticMembershipChangeCount: 3,
        validationAdvisoryCount: 2,
      },
    });
    expect(summary.parts.added.map(({ id }) => id)).toEqual(["added"]);
    expect(summary.parts.removed.map(({ id }) => id)).toEqual(["removed"]);
    expect(summary.parts.updated).toMatchObject([
      {
        partId: "updated",
        changedFields: ["colorId", "stepId", "semanticTags", "provenance"],
      },
    ]);
    expect(summary.connections.added.map(({ id }) => id)).toEqual(["connection-new"]);
    expect(summary.connections.removed.map(({ id }) => id)).toEqual(["connection-old"]);
    expect(summary.affectedPartIds).toEqual(["added", "anchor", "removed", "updated"]);
    expect(summary.semanticMembershipChanges).toEqual([
      { semanticRegionId: "region-a", addedPartIds: ["added"], removedPartIds: ["removed"] },
      { semanticRegionId: "region-z", addedPartIds: [], removedPartIds: ["removed"] },
    ]);
    expect(summary.validationAdvisories.map(({ issueId }) => issueId)).toEqual([
      "advisory-a",
      "advisory-z",
    ]);
    expectDeeplyFrozen(summary);
    expect(() => (summary.affectedPartIds as unknown as string[]).push("mutated")).toThrow(
      TypeError,
    );
  });

  it("rejects patch identity that does not match the exact base", () => {
    const { base, patch } = fixture();
    const cases: Array<readonly [PatchDiffErrorCode, AssemblyPatchV1]> = [
      ["BASE_REVISION_MISMATCH", { ...patch, baseRevision: "revision-other" }],
      ["BASE_DOCUMENT_HASH_MISMATCH", { ...patch, baseDocumentHash: canonicalDigest("other") }],
      ["TRUTH_SNAPSHOT_HASH_MISMATCH", { ...patch, truthSnapshotHash: canonicalDigest("other") }],
    ];

    for (const [code, mismatchedPatch] of cases) {
      expectPatchDiffError(() => summarizeAssemblyPatch(base, mismatchedPatch), code);
    }
  });

  it("rejects malformed base, patch, validation report, and stale operations", () => {
    const { base, patch } = fixture();
    expectPatchDiffError(() => summarizeAssemblyPatch({}, patch), "BASE_SCHEMA_INVALID");
    expectPatchDiffError(() => summarizeAssemblyPatch(base, {}), "PATCH_SCHEMA_INVALID");
    expectPatchDiffError(
      () => summarizeAssemblyPatch(base, patch, {}),
      "VALIDATION_REPORT_SCHEMA_INVALID",
    );

    const stalePart = createPartInstance({ id: "updated", colorId: "builtin:blue" });
    const stalePatch: AssemblyPatchV1 = {
      ...patch,
      operations: [
        {
          kind: "updatePart",
          operationId: "stale-update",
          before: stalePart,
          after: { ...stalePart, colorId: "builtin:yellow" },
        },
      ],
    };
    expectPatchDiffError(
      () => summarizeAssemblyPatch(base, stalePatch),
      "PATCH_APPLICATION_FAILED",
    );
  });

  it("rejects a validation report bound to different result or truth", () => {
    const { base, patch, result } = fixture();
    const report = reportFor(result);
    const cases: Array<readonly [PatchDiffErrorCode, ValidationReportV1]> = [
      [
        "VALIDATION_TARGET_MISMATCH",
        { ...report, targetDocumentHash: canonicalDigest("other-result") },
      ],
      ["VALIDATION_TRUTH_MISMATCH", { ...report, truthSnapshotHash: canonicalDigest("other") }],
      [
        "VALIDATION_VALIDATOR_SET_MISMATCH",
        { ...report, validatorSetHash: canonicalDigest("other-validator") },
      ],
    ];

    for (const [code, mismatchedReport] of cases) {
      expectPatchDiffError(() => summarizeAssemblyPatch(base, patch, mismatchedReport), code);
    }
  });

  it("reports the net delta when operations cancel or replace the same identity", () => {
    const base = createEmptyBrickDocument({ id: "net", name: "Net" });
    const temporary = createPartInstance({ id: "temporary", source: "ai", sourceId: "candidate" });
    const operations: BuildOperation[] = [
      {
        kind: "addPart",
        operationId: "add-temporary",
        part: temporary,
        semanticRegionIds: [],
      },
      {
        kind: "removePart",
        operationId: "remove-temporary",
        part: temporary,
        semanticRegionIds: [],
      },
    ];
    const patch: AssemblyPatchV1 = {
      schemaVersion: "lego.assembly-patch/1",
      baseRevision: base.revision,
      baseDocumentHash: documentStructuralHash(base),
      truthSnapshotHash: canonicalDigest(base.truth),
      scopeCapabilityId: "scope-net",
      scopeDigest: canonicalDigest({ scope: "net" }),
      operations,
      provenance: {
        jobId: "job-net",
        candidateId: "candidate-net",
        compilerSnapshotHash: canonicalDigest({ compiler: 1 }),
        buildProgramHash: canonicalDigest({ program: "net" }),
      },
    };

    const summary = summarizeAssemblyPatch(base, patch);
    expect(summary.parts).toEqual({ added: [], removed: [], updated: [] });
    expect(summary.affectedPartIds).toEqual([]);
    expect(summary.counts).toMatchObject({ operationCount: 2, affectedPartCount: 0 });
  });
});
