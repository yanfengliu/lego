import {
  validateAssemblyPatchV1,
  validateBrickDocumentV1,
  validateScopeCapabilityV1,
} from "@lego-studio/protocol";
import type {
  AssemblyPatchV1,
  BrickDocumentV1,
  ScopeCapabilityV1,
  ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalDigest, deepFreeze } from "./canonical.ts";
import { documentStructuralHash, normalizeBrickDocument } from "./document.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";
import { normalizeScopeCapability } from "./normalization.ts";
import { applyBuildOperations, OperationApplicationError } from "./operations.ts";
import {
  assessPatchHardValidation,
  collectScopePolicyIssues,
  type ScopePolicyIssueCode,
} from "./patch-policy.ts";

export type AssemblyPatchVerificationIssueCode =
  | "BASE_DOCUMENT_SCHEMA_INVALID"
  | "BASE_TRUTH_SNAPSHOT_UNSUPPORTED"
  | "PATCH_SCHEMA_INVALID"
  | "SCOPE_SCHEMA_INVALID"
  | "PATCH_BASE_MISMATCH"
  | "SCOPE_BASE_MISMATCH"
  | "PATCH_TRUTH_MISMATCH"
  | "PATCH_SCOPE_MISMATCH"
  | "PATCH_APPLICATION_FAILED"
  | "HARD_VALIDATION_INCOMPLETE"
  | "PATCH_INTRODUCES_BLOCKING_ISSUE"
  | ScopePolicyIssueCode;

export interface AssemblyPatchVerificationIssue {
  readonly code: AssemblyPatchVerificationIssueCode;
  readonly message: string;
  readonly path: string;
  readonly operationId?: string;
}

export interface AssemblyPatchVerificationSuccess {
  readonly ok: true;
  readonly document: BrickDocumentV1;
  readonly validationReport: ValidationReportV1;
}

export interface AssemblyPatchVerificationFailure {
  readonly ok: false;
  readonly issues: readonly AssemblyPatchVerificationIssue[];
}

export type AssemblyPatchVerificationResult =
  AssemblyPatchVerificationSuccess | AssemblyPatchVerificationFailure;

function issue(
  code: AssemblyPatchVerificationIssueCode,
  message: string,
  path: string,
  operationId?: string,
): AssemblyPatchVerificationIssue {
  return operationId === undefined ? { code, message, path } : { code, message, path, operationId };
}

function failure(
  ...issues: readonly AssemblyPatchVerificationIssue[]
): AssemblyPatchVerificationFailure {
  return deepFreeze({ ok: false, issues: [...issues] });
}

function schemaFailure(
  code: "BASE_DOCUMENT_SCHEMA_INVALID" | "PATCH_SCHEMA_INVALID" | "SCOPE_SCHEMA_INVALID",
  path: string,
  errors:
    readonly { readonly instancePath?: string; readonly message?: string }[] | null | undefined,
): AssemblyPatchVerificationFailure {
  const boundedErrors = (
    errors && errors.length > 0 ? errors : [{ message: "schema validation failed" }]
  ).slice(0, 16);
  return failure(
    ...boundedErrors.map((error) =>
      issue(
        code,
        error.message ?? "schema validation failed",
        `${path}${error.instancePath ?? ""}`,
      ),
    ),
  );
}

/**
 * Independently verifies a received unsigned patch against the exact retained
 * base and scope capability. This boundary does not authorize or apply a user
 * document transaction; callers still need a verified presented envelope and
 * one-use acceptance authorization before committing its returned document.
 */
export function verifyAssemblyPatchAgainstCapability(
  baseValue: unknown,
  patchValue: unknown,
  retainedScopeValue: unknown,
): AssemblyPatchVerificationResult {
  let detachedBase: unknown;
  let detachedPatch: unknown;
  let detachedScope: unknown;
  try {
    detachedBase = structuredClone(baseValue);
  } catch {
    return failure(
      issue(
        "BASE_DOCUMENT_SCHEMA_INVALID",
        "Base document must be detached structured-cloneable data",
        "/base",
      ),
    );
  }
  try {
    detachedPatch = structuredClone(patchValue);
  } catch {
    return failure(
      issue(
        "PATCH_SCHEMA_INVALID",
        "Assembly patch must be detached structured-cloneable data",
        "/patch",
      ),
    );
  }
  try {
    detachedScope = structuredClone(retainedScopeValue);
  } catch {
    return failure(
      issue(
        "SCOPE_SCHEMA_INVALID",
        "Retained scope capability must be detached structured-cloneable data",
        "/scope",
      ),
    );
  }

  let baseSchemaValid = false;
  let patchSchemaValid = false;
  let scopeSchemaValid = false;
  try {
    baseSchemaValid = validateBrickDocumentV1(detachedBase);
  } catch {
    // Detached hostile or cyclic values fail closed at the schema boundary.
  }
  if (!baseSchemaValid) {
    return schemaFailure("BASE_DOCUMENT_SCHEMA_INVALID", "/base", validateBrickDocumentV1.errors);
  }
  try {
    patchSchemaValid = validateAssemblyPatchV1(detachedPatch);
  } catch {
    // Detached hostile or cyclic values fail closed at the schema boundary.
  }
  if (!patchSchemaValid) {
    return schemaFailure("PATCH_SCHEMA_INVALID", "/patch", validateAssemblyPatchV1.errors);
  }
  try {
    scopeSchemaValid = validateScopeCapabilityV1(detachedScope);
  } catch {
    // Detached hostile or cyclic values fail closed at the schema boundary.
  }
  if (!scopeSchemaValid) {
    return schemaFailure("SCOPE_SCHEMA_INVALID", "/scope", validateScopeCapabilityV1.errors);
  }

  const base = normalizeBrickDocument(detachedBase as BrickDocumentV1);
  const patch = detachedPatch as AssemblyPatchV1;
  const scope = normalizeScopeCapability(detachedScope as ScopeCapabilityV1);
  const activeTruthHash = canonicalDigest(createBuiltinTruthSnapshot());
  const baseTruthHash = canonicalDigest(base.truth);
  if (baseTruthHash !== activeTruthHash) {
    return failure(
      issue(
        "BASE_TRUTH_SNAPSHOT_UNSUPPORTED",
        "Base document requires an explicit truth-snapshot migration before patch verification",
        "/base/truth",
      ),
    );
  }

  const baseDocumentHash = documentStructuralHash(base);
  if (patch.baseRevision !== base.revision || patch.baseDocumentHash !== baseDocumentHash) {
    return failure(
      issue(
        "PATCH_BASE_MISMATCH",
        "Assembly patch does not match the exact base revision and structural hash",
        "/patch",
      ),
    );
  }
  if (scope.baseRevision !== base.revision || scope.baseDocumentHash !== baseDocumentHash) {
    return failure(
      issue(
        "SCOPE_BASE_MISMATCH",
        "Retained scope capability does not match the exact base revision and structural hash",
        "/scope",
      ),
    );
  }
  if (patch.truthSnapshotHash !== baseTruthHash) {
    return failure(
      issue(
        "PATCH_TRUTH_MISMATCH",
        "Assembly patch does not match the exact retained truth snapshot",
        "/patch/truthSnapshotHash",
      ),
    );
  }
  if (patch.scopeCapabilityId !== scope.capabilityId) {
    return failure(
      issue(
        "PATCH_SCOPE_MISMATCH",
        "Assembly patch does not reference the retained scope capability",
        "/patch/scopeCapabilityId",
      ),
    );
  }
  if (patch.scopeDigest !== canonicalDigest(scope)) {
    return failure(
      issue(
        "PATCH_SCOPE_MISMATCH",
        "Assembly patch does not match the exact retained scope capability",
        "/patch/scopeDigest",
      ),
    );
  }

  let resultDocument: BrickDocumentV1;
  try {
    resultDocument = applyBuildOperations(base, patch.operations);
  } catch (error) {
    const operationId = error instanceof OperationApplicationError ? error.operationId : undefined;
    return failure(
      issue(
        "PATCH_APPLICATION_FAILED",
        error instanceof Error ? error.message : "Assembly patch operations could not be applied",
        "/patch/operations",
        operationId,
      ),
    );
  }

  const scopeIssues = collectScopePolicyIssues(base, resultDocument, patch.operations, scope);
  if (scopeIssues.length > 0) return failure(...scopeIssues);

  const hardValidation = assessPatchHardValidation(base, resultDocument);
  if (hardValidation.incompleteCodes.length > 0) {
    return failure(
      issue(
        "HARD_VALIDATION_INCOMPLETE",
        `Patch verification cannot continue without complete hard validation: ${hardValidation.incompleteCodes.join(", ")}`,
        "/validation",
      ),
    );
  }
  if (!hardValidation.validationReport.patchValid || !hardValidation.globalValidityPreserved) {
    const introducedIssues = hardValidation.introducedBlockingIssues.map((introducedIssue) =>
      issue(
        "PATCH_INTRODUCES_BLOCKING_ISSUE",
        `${introducedIssue.code}: ${introducedIssue.message}`,
        introducedIssue.path,
      ),
    );
    return failure(
      ...(introducedIssues.length > 0
        ? introducedIssues
        : [
            issue(
              "PATCH_INTRODUCES_BLOCKING_ISSUE",
              "Assembly patch breaks global document validity",
              "/validation",
            ),
          ]),
    );
  }

  return deepFreeze({
    ok: true,
    document: resultDocument,
    validationReport: hardValidation.validationReport,
  });
}
