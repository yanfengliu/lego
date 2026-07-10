import {
  validateAssemblyPatchV1,
  validateBrickDocumentV1,
  validateValidationReportV1,
} from "@lego-studio/protocol";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  ValidationIssue,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalDigest, canonicalStringify, deepFreeze, type Sha256Digest } from "./canonical.ts";
import { documentStructuralHash, normalizeBrickDocument } from "./document.ts";
import { applyBuildOperations } from "./operations.ts";

export type PatchDiffErrorCode =
  | "BASE_SCHEMA_INVALID"
  | "PATCH_SCHEMA_INVALID"
  | "VALIDATION_REPORT_SCHEMA_INVALID"
  | "BASE_REVISION_MISMATCH"
  | "BASE_DOCUMENT_HASH_MISMATCH"
  | "TRUTH_SNAPSHOT_HASH_MISMATCH"
  | "PATCH_APPLICATION_FAILED"
  | "VALIDATION_TARGET_MISMATCH"
  | "VALIDATION_TRUTH_MISMATCH"
  | "VALIDATION_VALIDATOR_SET_MISMATCH";

export class PatchDiffError extends Error {
  public readonly code: PatchDiffErrorCode;

  public constructor(code: PatchDiffErrorCode, message: string) {
    super(message);
    this.name = "PatchDiffError";
    this.code = code;
  }
}

export type PatchPartChangedField =
  | "catalogPartId"
  | "colorId"
  | "transform"
  | "submodelId"
  | "stepId"
  | "semanticTags"
  | "provenance";

export interface PatchPartUpdate {
  readonly partId: string;
  readonly before: PartInstance;
  readonly after: PartInstance;
  readonly changedFields: readonly PatchPartChangedField[];
}

export interface SemanticMembershipChange {
  readonly semanticRegionId: string;
  readonly addedPartIds: readonly string[];
  readonly removedPartIds: readonly string[];
}

export interface PatchDiffSummary {
  readonly schemaVersion: "lego.patch-diff-summary/1";
  readonly patchHash: Sha256Digest;
  readonly base: {
    readonly revision: string;
    readonly documentHash: Sha256Digest;
    readonly truthSnapshotHash: Sha256Digest;
  };
  readonly result: {
    readonly revision: string;
    readonly documentHash: Sha256Digest;
  };
  readonly parts: {
    readonly added: readonly PartInstance[];
    readonly removed: readonly PartInstance[];
    readonly updated: readonly PatchPartUpdate[];
  };
  readonly connections: {
    readonly added: readonly ConnectionEdge[];
    readonly removed: readonly ConnectionEdge[];
  };
  readonly affectedPartIds: readonly string[];
  readonly semanticMembershipChanges: readonly SemanticMembershipChange[];
  readonly validationAdvisories: readonly ValidationIssue[];
  readonly counts: {
    readonly operationCount: number;
    readonly addedPartCount: number;
    readonly removedPartCount: number;
    readonly updatedPartCount: number;
    readonly addedConnectionCount: number;
    readonly removedConnectionCount: number;
    readonly affectedPartCount: number;
    readonly changedSemanticRegionCount: number;
    readonly semanticMembershipChangeCount: number;
    readonly validationAdvisoryCount: number;
  };
}

const PART_FIELD_ORDER = [
  "catalogPartId",
  "colorId",
  "transform",
  "submodelId",
  "stepId",
  "semanticTags",
  "provenance",
] as const satisfies readonly PatchPartChangedField[];

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

function detachedClone(
  value: unknown,
  code: Extract<
    PatchDiffErrorCode,
    "BASE_SCHEMA_INVALID" | "PATCH_SCHEMA_INVALID" | "VALIDATION_REPORT_SCHEMA_INVALID"
  >,
  label: string,
): unknown {
  try {
    return structuredClone(value);
  } catch {
    throw new PatchDiffError(code, `${label} must be detached structured-cloneable data`);
  }
}

function assertValidBase(value: unknown): asserts value is BrickDocumentV1 {
  let valid = false;
  try {
    valid = validateBrickDocumentV1(value);
  } catch {
    // Hostile or otherwise unreadable values fail closed.
  }
  if (!valid) {
    throw new PatchDiffError(
      "BASE_SCHEMA_INVALID",
      `Base document failed schema validation: ${validateBrickDocumentV1.errors?.[0]?.message ?? "unreadable input"}`,
    );
  }
}

function assertValidPatch(value: unknown): asserts value is AssemblyPatchV1 {
  let valid = false;
  try {
    valid = validateAssemblyPatchV1(value);
  } catch {
    // Hostile or otherwise unreadable values fail closed.
  }
  if (!valid) {
    throw new PatchDiffError(
      "PATCH_SCHEMA_INVALID",
      `Assembly patch failed schema validation: ${validateAssemblyPatchV1.errors?.[0]?.message ?? "unreadable input"}`,
    );
  }
}

function assertValidReport(value: unknown): asserts value is ValidationReportV1 {
  let valid = false;
  try {
    valid = validateValidationReportV1(value);
  } catch {
    // Hostile or otherwise unreadable values fail closed.
  }
  if (!valid) {
    throw new PatchDiffError(
      "VALIDATION_REPORT_SCHEMA_INVALID",
      `Validation report failed schema validation: ${validateValidationReportV1.errors?.[0]?.message ?? "unreadable input"}`,
    );
  }
}

function changedPartFields(before: PartInstance, after: PartInstance): PatchPartChangedField[] {
  return PART_FIELD_ORDER.filter((field) => !sameCanonicalValue(before[field], after[field]));
}

function compareConnections(left: ConnectionEdge, right: ConnectionEdge): number {
  return (
    compareStrings(left.id, right.id) ||
    compareStrings(canonicalStringify(left), canonicalStringify(right))
  );
}

function partChanges(base: BrickDocumentV1, result: BrickDocumentV1) {
  const baseById = new Map(base.parts.map((part) => [part.id, part]));
  const resultById = new Map(result.parts.map((part) => [part.id, part]));
  const added = result.parts.filter(({ id }) => !baseById.has(id));
  const removed = base.parts.filter(({ id }) => !resultById.has(id));
  const updated = base.parts.flatMap((before): PatchPartUpdate[] => {
    const after = resultById.get(before.id);
    if (!after || sameCanonicalValue(before, after)) return [];
    return [{ partId: before.id, before, after, changedFields: changedPartFields(before, after) }];
  });
  return { added, removed, updated };
}

function connectionChanges(base: BrickDocumentV1, result: BrickDocumentV1) {
  const baseById = new Map(base.connections.map((connection) => [connection.id, connection]));
  const resultById = new Map(result.connections.map((connection) => [connection.id, connection]));
  const added: ConnectionEdge[] = [];
  const removed: ConnectionEdge[] = [];

  for (const before of base.connections) {
    const after = resultById.get(before.id);
    if (!after) removed.push(before);
    else if (!sameCanonicalValue(before, after)) {
      removed.push(before);
      added.push(after);
    }
  }
  for (const after of result.connections) {
    if (!baseById.has(after.id)) added.push(after);
  }
  added.sort(compareConnections);
  removed.sort(compareConnections);
  return { added, removed };
}

function semanticMembershipChanges(
  base: BrickDocumentV1,
  result: BrickDocumentV1,
): SemanticMembershipChange[] {
  const baseRegions = new Map(base.semanticRegions.map((region) => [region.id, region]));
  const resultRegions = new Map(result.semanticRegions.map((region) => [region.id, region]));
  const regionIds = [...new Set([...baseRegions.keys(), ...resultRegions.keys()])].sort(
    compareStrings,
  );

  return regionIds.flatMap((semanticRegionId): SemanticMembershipChange[] => {
    const before = new Set(baseRegions.get(semanticRegionId)?.partIds ?? []);
    const after = new Set(resultRegions.get(semanticRegionId)?.partIds ?? []);
    const addedPartIds = [...after].filter((partId) => !before.has(partId)).sort(compareStrings);
    const removedPartIds = [...before].filter((partId) => !after.has(partId)).sort(compareStrings);
    return addedPartIds.length === 0 && removedPartIds.length === 0
      ? []
      : [{ semanticRegionId, addedPartIds, removedPartIds }];
  });
}

function normalizeAdvisory(issue: ValidationIssue): ValidationIssue {
  return {
    ...issue,
    partIds: [...issue.partIds].sort(compareStrings),
    connectionIds: [...issue.connectionIds].sort(compareStrings),
  };
}

function boundValidationAdvisories(
  reportValue: unknown,
  result: BrickDocumentV1,
  resultDocumentHash: Sha256Digest,
  truthSnapshotHash: Sha256Digest,
): ValidationIssue[] {
  if (reportValue === undefined) return [];
  const detachedReport = detachedClone(
    reportValue,
    "VALIDATION_REPORT_SCHEMA_INVALID",
    "Validation report",
  );
  assertValidReport(detachedReport);
  if (detachedReport.targetDocumentHash !== resultDocumentHash) {
    throw new PatchDiffError(
      "VALIDATION_TARGET_MISMATCH",
      "Validation report does not target the patch result document",
    );
  }
  if (detachedReport.truthSnapshotHash !== truthSnapshotHash) {
    throw new PatchDiffError(
      "VALIDATION_TRUTH_MISMATCH",
      "Validation report does not use the patch truth snapshot",
    );
  }
  if (detachedReport.validatorSetHash !== result.truth.validatorSet.hash) {
    throw new PatchDiffError(
      "VALIDATION_VALIDATOR_SET_MISMATCH",
      "Validation report does not use the base validator-set snapshot",
    );
  }
  return detachedReport.issues
    .filter(({ severity }) => severity === "advisory")
    .map(normalizeAdvisory)
    .sort(
      (left, right) =>
        compareStrings(left.issueId, right.issueId) ||
        compareStrings(canonicalStringify(left), canonicalStringify(right)),
    );
}

/** Creates an immutable net preview of a patch against the exact base it names. */
export function summarizeAssemblyPatch(
  baseValue: unknown,
  patchValue: unknown,
  validationReportValue?: unknown,
): PatchDiffSummary {
  const detachedBase = detachedClone(baseValue, "BASE_SCHEMA_INVALID", "Base document");
  const detachedPatch = detachedClone(patchValue, "PATCH_SCHEMA_INVALID", "Assembly patch");
  assertValidBase(detachedBase);
  assertValidPatch(detachedPatch);

  const base = normalizeBrickDocument(detachedBase);
  const baseDocumentHash = documentStructuralHash(base);
  const truthSnapshotHash = canonicalDigest(base.truth);
  if (detachedPatch.baseRevision !== base.revision) {
    throw new PatchDiffError(
      "BASE_REVISION_MISMATCH",
      "Assembly patch does not name the base document revision",
    );
  }
  if (detachedPatch.baseDocumentHash !== baseDocumentHash) {
    throw new PatchDiffError(
      "BASE_DOCUMENT_HASH_MISMATCH",
      "Assembly patch does not name the base document structural hash",
    );
  }
  if (detachedPatch.truthSnapshotHash !== truthSnapshotHash) {
    throw new PatchDiffError(
      "TRUTH_SNAPSHOT_HASH_MISMATCH",
      "Assembly patch does not name the base truth snapshot",
    );
  }

  let result: BrickDocumentV1;
  try {
    result = applyBuildOperations(base, detachedPatch.operations);
  } catch (error) {
    throw new PatchDiffError(
      "PATCH_APPLICATION_FAILED",
      `Assembly patch cannot apply to its claimed base: ${error instanceof Error ? error.message : "unknown operation failure"}`,
    );
  }

  const parts = partChanges(base, result);
  const connections = connectionChanges(base, result);
  const membershipChanges = semanticMembershipChanges(base, result);
  const affectedPartIds = [
    ...new Set([
      ...parts.added.map(({ id }) => id),
      ...parts.removed.map(({ id }) => id),
      ...parts.updated.map(({ partId }) => partId),
      ...connections.added.flatMap(({ a, b }) => [a.partId, b.partId]),
      ...connections.removed.flatMap(({ a, b }) => [a.partId, b.partId]),
      ...membershipChanges.flatMap(({ addedPartIds, removedPartIds }) => [
        ...addedPartIds,
        ...removedPartIds,
      ]),
    ]),
  ].sort(compareStrings);
  const resultDocumentHash = documentStructuralHash(result);
  const validationAdvisories = boundValidationAdvisories(
    validationReportValue,
    result,
    resultDocumentHash,
    truthSnapshotHash,
  );
  const semanticMembershipChangeCount = membershipChanges.reduce(
    (total, { addedPartIds, removedPartIds }) =>
      total + addedPartIds.length + removedPartIds.length,
    0,
  );

  return deepFreeze({
    schemaVersion: "lego.patch-diff-summary/1",
    patchHash: canonicalDigest(detachedPatch),
    base: {
      revision: base.revision,
      documentHash: baseDocumentHash,
      truthSnapshotHash,
    },
    result: {
      revision: result.revision,
      documentHash: resultDocumentHash,
    },
    parts,
    connections,
    affectedPartIds,
    semanticMembershipChanges: membershipChanges,
    validationAdvisories,
    counts: {
      operationCount: detachedPatch.operations.length,
      addedPartCount: parts.added.length,
      removedPartCount: parts.removed.length,
      updatedPartCount: parts.updated.length,
      addedConnectionCount: connections.added.length,
      removedConnectionCount: connections.removed.length,
      affectedPartCount: affectedPartIds.length,
      changedSemanticRegionCount: membershipChanges.length,
      semanticMembershipChangeCount,
      validationAdvisoryCount: validationAdvisories.length,
    },
  });
}
