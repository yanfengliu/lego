import { describe, expect, it } from "vitest";

import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import type { BrickDocumentV1, BuildProgramV1, ScopeCapabilityV1 } from "@lego-studio/protocol";

import { compileBuildProgramCandidate, isBuildProgramCandidateDraft } from "./index.ts";
import { compileBuildProgram } from "./compiler.ts";
import { documentStructuralHash } from "./document.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";

function scopeFor(
  base: BrickDocumentV1,
  overrides: Partial<ScopeCapabilityV1> = {},
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "candidate-scope",
    baseRevision: base.revision,
    baseDocumentHash: documentStructuralHash(base),
    frozenPartIds: [],
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-1000, -1000, -1000], maxLdu: [1000, 1000, 1000] },
    allowedCatalogPartIds: PART_DEFINITIONS.map(({ id }) => id),
    allowedColorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    budgets: { maxAddedParts: 200, maxRemovedParts: 10, maxOperations: 300 },
    ...overrides,
  };
}

function candidate(base: BrickDocumentV1, program: unknown, scope = scopeFor(base)) {
  return compileBuildProgramCandidate(base, program, {
    scope,
    candidateId: "candidate-draft-1",
  });
}

function twoPartProgram(secondPositionLdu: readonly [number, number, number]): BuildProgramV1 {
  return {
    schemaVersion: "lego.build-program/1",
    operations: [
      {
        kind: "placePart",
        operationId: "place-first",
        localPartId: "first",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:red",
        transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: ["candidate"],
      },
      {
        kind: "placePart",
        operationId: "place-second",
        localPartId: "second",
        catalogPartId: "builtin:brick-1x1",
        colorId: "builtin:blue",
        transform: { positionLdu: secondPositionLdu, orientationId: "upright-yaw-0" },
        submodelId: "root",
        stepId: "step-1",
        semanticTags: ["candidate"],
      },
    ],
  };
}

describe("authority-free BuildProgram candidate expansion", () => {
  it("returns a branded disconnected draft with a complete hard report and no patch authority", () => {
    const base = createEmptyBrickDocument({ id: "candidate-disconnected", name: "Candidate" });
    const program = twoPartProgram([40, 0, 0]);
    const result = candidate(base, program);

    expect(result).toMatchObject({
      kind: "buildProgramCandidate",
      status: "draft",
      authority: "none",
      hardValidationComplete: true,
    });
    expect(Object.hasOwn(result, "ok")).toBe(false);
    expect(Object.hasOwn(result, "patch")).toBe(false);
    expect(isBuildProgramCandidateDraft(result)).toBe(true);
    expect(isBuildProgramCandidateDraft(structuredClone(result))).toBe(false);
    if (result.status !== "draft") return;

    expect(result.operations).toHaveLength(2);
    expect(result.validationReport.patchValid).toBe(false);
    expect(result.validationReport.issues.map(({ code }) => code)).toContain(
      "DISCONNECTED_ASSEMBLY",
    );
    expect(result.introducedBlockingIssues.map(({ code }) => code)).toContain(
      "DISCONNECTED_ASSEMBLY",
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.document)).toBe(true);
    expect(Object.isFrozen(result.validationReport)).toBe(true);

    const ordinary = compileBuildProgram(base, program, {
      scope: scopeFor(base),
      jobId: "ordinary-job",
      candidateId: "candidate-draft-1",
    });
    expect(ordinary).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "PATCH_INTRODUCES_BLOCKING_ISSUE" }),
      ]),
    });
  });

  it("reports collision evidence without converting the draft into acceptance authority", () => {
    const base = createEmptyBrickDocument({ id: "candidate-collision", name: "Collision" });
    const result = candidate(base, twoPartProgram([0, 0, 0]));

    expect(result.status).toBe("draft");
    expect(result.authority).toBe("none");
    expect(Object.hasOwn(result, "patch")).toBe(false);
    if (result.status !== "draft") return;
    expect(result.introducedBlockingIssues.some(({ code }) => code.includes("COLLISION"))).toBe(
      true,
    );
    expect(result.validationReport.patchValid).toBe(false);
  });

  it("rejects scope and truth failures before exposing a draft", () => {
    const base = createEmptyBrickDocument({ id: "candidate-policy", name: "Policy" });
    const scopeRejected = candidate(
      base,
      twoPartProgram([40, 0, 0]),
      scopeFor(base, {
        budgets: { maxAddedParts: 0, maxRemovedParts: 10, maxOperations: 300 },
      }),
    );
    expect(scopeRejected).toMatchObject({
      status: "rejected",
      authority: "none",
      issues: [{ code: "SCOPE_ADDITION_BUDGET_EXCEEDED" }],
    });

    const unsupportedTruth = {
      ...base,
      truth: {
        ...base.truth,
        collisionModel: { ...base.truth.collisionModel, version: "retired/1" },
      },
    } satisfies BrickDocumentV1;
    const truthRejected = candidate(
      unsupportedTruth,
      twoPartProgram([40, 0, 0]),
      scopeFor(unsupportedTruth),
    );
    expect(truthRejected).toMatchObject({
      status: "rejected",
      authority: "none",
      issues: [{ code: "BASE_TRUTH_SNAPSHOT_UNSUPPORTED" }],
    });
  });

  it("refuses to label an incomplete hard-validation run as a draft", () => {
    const empty = createEmptyBrickDocument({ id: "candidate-incomplete", name: "Incomplete" });
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
    const result = candidate(base, program, scopeFor(base, { mutablePartIds: [parts[0]!.id] }));

    expect(result).toMatchObject({
      status: "rejected",
      authority: "none",
      issues: [{ code: "HARD_VALIDATION_INCOMPLETE" }],
    });
  });
});
