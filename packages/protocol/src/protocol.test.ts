import { describe, expect, it } from "vitest";

import {
  ProtocolValidationError,
  assertProtocolValue,
  validateAssemblyPatchV1,
  validateBrickDocumentV1,
  validateBuildProgramV1,
  validateRigidTransform,
  validateScopeCapabilityV1,
  validateTruthSnapshot,
  validateValidationReportV1,
  type AssemblyPatchV1,
  type BrickDocumentV1,
  type BuildProgramV1,
  type PartInstance,
  type ScopeCapabilityV1,
  type TruthSnapshot,
  type ValidationReportV1,
} from "./index.js";

const HASH = `sha256:${"a".repeat(64)}`;

const truth = {
  schemaVersion: "lego.truth-snapshot/1",
  catalog: { id: "basic-bricks", version: "1", hash: HASH },
  connectorTaxonomy: { id: "stud-tube", version: "1", hash: HASH },
  collisionModel: { id: "aabb-basic", version: "1", hash: HASH },
  transformPolicy: { id: "upright-yaw", version: "1", hash: HASH },
  validatorSet: { id: "gate-1", version: "1", hash: HASH },
} satisfies TruthSnapshot;

const part = {
  id: "part-1",
  catalogPartId: "lego:brick/2x2",
  colorId: "red",
  transform: { positionLdu: [0, 0, 0], orientationId: "yaw-0" },
  submodelId: "root",
  stepId: "step-0",
  semanticTags: ["body"],
  provenance: { source: "manual" },
} satisfies PartInstance;

const document = {
  schemaVersion: "lego.brick-document/1",
  id: "model-1",
  revision: "revision-1",
  truth,
  name: "Protocol fixture",
  parts: [part],
  connections: [],
  submodels: [{ id: "root", name: "Root", partIds: [part.id] }],
  steps: [{ id: "step-0", index: 0, name: "Step 1", partIds: [part.id] }],
  semanticRegions: [{ id: "body", label: "Body", partIds: [part.id] }],
  constraints: {
    maxParts: 40,
    allowedCatalogPartIds: [part.catalogPartId],
    allowedColorIds: [part.colorId],
  },
  provenance: { origin: "manual" },
} satisfies BrickDocumentV1;

const program = {
  schemaVersion: "lego.build-program/1",
  operations: [
    {
      kind: "placePart",
      operationId: "instruction-1",
      localPartId: "new-part",
      catalogPartId: "lego:brick/2x2",
      colorId: "blue",
      transform: { positionLdu: [20, -24, 0], orientationId: "yaw-0" },
      submodelId: "root",
      stepId: "step-0",
      semanticTags: ["roof"],
    },
  ],
} satisfies BuildProgramV1;

const scope = {
  schemaVersion: "lego.scope-capability/1",
  capabilityId: "scope-1",
  baseRevision: document.revision,
  baseDocumentHash: HASH,
  frozenPartIds: [part.id],
  mutablePartIds: [],
  requiredAttachmentPorts: [{ partId: part.id, portId: "stud-0-0" }],
  allowedVolume: { minLdu: [-100, -100, -100], maxLdu: [100, 100, 100] },
  allowedCatalogPartIds: ["lego:brick/2x2"],
  allowedColorIds: ["red", "blue"],
  budgets: { maxAddedParts: 10, maxRemovedParts: 0, maxOperations: 20 },
} satisfies ScopeCapabilityV1;

const patch = {
  schemaVersion: "lego.assembly-patch/1",
  baseRevision: document.revision,
  baseDocumentHash: HASH,
  truthSnapshotHash: HASH,
  scopeCapabilityId: scope.capabilityId,
  scopeDigest: HASH,
  operations: [{ kind: "addPart", operationId: "operation-1", part, semanticRegionIds: ["body"] }],
  provenance: {
    jobId: "job-1",
    candidateId: "candidate-1",
    compilerSnapshotHash: HASH,
    buildProgramHash: HASH,
  },
} satisfies AssemblyPatchV1;

const report = {
  schemaVersion: "lego.validation-report/1",
  targetDocumentHash: HASH,
  truthSnapshotHash: HASH,
  validatorSetHash: HASH,
  patchValid: true,
  documentGloballyValid: true,
  issues: [],
} satisfies ValidationReportV1;

describe("generated protocol validators", () => {
  it("accepts every version-1 root contract", () => {
    expect(validateTruthSnapshot(truth)).toBe(true);
    expect(validateRigidTransform(part.transform)).toBe(true);
    expect(validateBrickDocumentV1(document)).toBe(true);
    expect(validateBuildProgramV1(program)).toBe(true);
    expect(validateScopeCapabilityV1(scope)).toBe(true);
    expect(validateAssemblyPatchV1(patch)).toBe(true);
    expect(validateValidationReportV1(report)).toBe(true);
  });

  it("rejects unknown properties at both document and nested boundaries", () => {
    expect(validateBrickDocumentV1({ ...document, providerPrompt: "untrusted" })).toBe(false);
    expect(
      validateBrickDocumentV1({
        ...document,
        parts: [{ ...part, transform: { ...part.transform, matrix: [] } }],
      }),
    ).toBe(false);
  });

  it("rejects unsupported versions and non-integral transforms", () => {
    expect(validateBrickDocumentV1({ ...document, schemaVersion: "lego.brick-document/2" })).toBe(
      false,
    );
    expect(validateRigidTransform({ positionLdu: [0, 0.5, 0], orientationId: "yaw-0" })).toBe(
      false,
    );
  });

  it("rejects executable-looking and unknown program operations", () => {
    expect(
      validateBuildProgramV1({
        schemaVersion: "lego.build-program/1",
        operations: [{ kind: "javascript", operationId: "bad-1", source: "process.exit()" }],
      }),
    ).toBe(false);
  });

  it("accepts the complete closed set of declarative program operations", () => {
    const operationFixtures: BuildProgramV1["operations"] = [
      program.operations[0]!,
      {
        kind: "attach",
        operationId: "instruction-2",
        a: { partId: "part-1", portId: "stud-0-0" },
        b: { partId: "new-part", portId: "tube-0-0" },
        connectionKind: "stud-tube",
      },
      { kind: "removePart", operationId: "instruction-3", partId: "part-1" },
      {
        kind: "replacePart",
        operationId: "instruction-4",
        partId: "part-1",
        catalogPartId: "lego:plate/2x2",
        colorId: "blue",
      },
      {
        kind: "movePart",
        operationId: "instruction-5",
        partId: "part-1",
        transform: { positionLdu: [0, -8, 0], orientationId: "yaw-90" },
      },
      {
        kind: "recolorPart",
        operationId: "instruction-6",
        partId: "part-1",
        colorId: "blue",
      },
      {
        kind: "assignStep",
        operationId: "instruction-7",
        partId: "part-1",
        stepId: "step-1",
      },
      {
        kind: "instantiateTemplate",
        operationId: "instruction-8",
        instanceLocalId: "wheel-pair",
        templateId: "template:wheel-pair/1",
        parameters: [{ name: "spacing", value: 40 }],
        transform: { positionLdu: [0, 0, 0], orientationId: "yaw-0" },
        submodelId: "root",
        stepId: "step-0",
      },
    ];

    expect(
      validateBuildProgramV1({
        schemaVersion: "lego.build-program/1",
        operations: operationFixtures,
      }),
    ).toBe(true);
  });

  it("enforces scope and patch bounds", () => {
    expect(
      validateScopeCapabilityV1({
        ...scope,
        budgets: { ...scope.budgets, maxOperations: 10001 },
      }),
    ).toBe(false);
    expect(validateAssemblyPatchV1({ ...patch, operations: [] })).toBe(false);
  });

  it("reports schema errors through the assertion boundary", () => {
    expect(() =>
      assertProtocolValue(
        validateAssemblyPatchV1,
        { ...patch, scopeCapabilityId: "" },
        "Assembly patch",
      ),
    ).toThrowError(ProtocolValidationError);

    try {
      assertProtocolValue(
        validateAssemblyPatchV1,
        { ...patch, scopeCapabilityId: "" },
        "Assembly patch",
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ProtocolValidationError);
      expect((error as ProtocolValidationError).validationErrors.length).toBeGreaterThan(0);
    }
  });

  it("validates deterministic issue records without allowing extra evidence", () => {
    const issue = {
      issueId: "issue-1",
      validatorId: "collision-validator",
      code: "PART_COLLISION",
      severity: "blocking",
      message: "Two part bodies overlap.",
      path: "/parts/0",
      partIds: ["part-1", "part-2"],
      connectionIds: [],
      scope: "document",
    } as const;

    expect(validateValidationReportV1({ ...report, issues: [issue] })).toBe(true);
    expect(
      validateValidationReportV1({
        ...report,
        issues: [{ ...issue, screenshot: "cannot-prove-structure.png" }],
      }),
    ).toBe(false);
  });

  it("exposes deeply readonly generated public types", () => {
    const typedDocument: BrickDocumentV1 = document;
    const compileTimeReadonlyCheck = (candidate: BrickDocumentV1) => {
      // @ts-expect-error Generated public arrays must not be mutable.
      candidate.parts.push(part);
      // @ts-expect-error Generated public nested fields must not be mutable.
      candidate.parts[0].transform.orientationId = "yaw-90";
    };

    expect(typedDocument.parts).toHaveLength(1);
    expect(compileTimeReadonlyCheck).toBeTypeOf("function");
  });
});
