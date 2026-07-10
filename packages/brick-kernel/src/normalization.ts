import type {
  BuildProgramV1,
  PartPortRef,
  ProgramOperation,
  RigidTransform,
  ScopeCapabilityV1,
  TemplateParameter,
} from "@lego-studio/protocol";

import { canonicalStringify } from "./canonical.ts";

export const BUILD_PROGRAM_NORMALIZATION_VERSION = "lego.build-program-normalization/1" as const;
export const SCOPE_CAPABILITY_NORMALIZATION_VERSION =
  "lego.scope-capability-normalization/1" as const;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedStrings(values: readonly string[]): string[] {
  return [...values].sort(compareStrings);
}

function cloneTransform(transform: RigidTransform): RigidTransform {
  return {
    positionLdu: [...transform.positionLdu],
    orientationId: transform.orientationId,
  };
}

function clonePortRef(reference: PartPortRef): PartPortRef {
  return { partId: reference.partId, portId: reference.portId };
}

function comparePortRefs(left: PartPortRef, right: PartPortRef): number {
  return compareStrings(left.partId, right.partId) || compareStrings(left.portId, right.portId);
}

function compareTemplateParameters(left: TemplateParameter, right: TemplateParameter): number {
  return (
    compareStrings(left.name, right.name) ||
    compareStrings(canonicalStringify(left.value), canonicalStringify(right.value))
  );
}

function normalizeProgramOperation(operation: ProgramOperation): ProgramOperation {
  switch (operation.kind) {
    case "placePart":
      return {
        ...operation,
        transform: cloneTransform(operation.transform),
        semanticTags: sortedStrings(operation.semanticTags),
      };
    case "attach":
      return {
        ...operation,
        a: clonePortRef(operation.a),
        b: clonePortRef(operation.b),
      };
    case "movePart":
      return { ...operation, transform: cloneTransform(operation.transform) };
    case "instantiateTemplate":
      return {
        ...operation,
        parameters: operation.parameters
          .map((parameter) => ({ ...parameter }))
          .sort(compareTemplateParameters),
        transform: cloneTransform(operation.transform),
      };
    case "removePart":
    case "replacePart":
    case "recolorPart":
    case "assignStep":
      return { ...operation };
  }
}

/**
 * Clones provider-authored data and canonicalizes only arrays whose order has no
 * domain meaning. Program operation order remains authoritative.
 */
export function normalizeBuildProgram(program: BuildProgramV1): BuildProgramV1 {
  return {
    schemaVersion: program.schemaVersion,
    operations: program.operations.map(normalizeProgramOperation),
  };
}

/** Clone and normalize the broker-authored scope capability before use or hashing. */
export function normalizeScopeCapability(scope: ScopeCapabilityV1): ScopeCapabilityV1 {
  return {
    ...scope,
    frozenPartIds: sortedStrings(scope.frozenPartIds),
    mutablePartIds: sortedStrings(scope.mutablePartIds),
    requiredAttachmentPorts: scope.requiredAttachmentPorts.map(clonePortRef).sort(comparePortRefs),
    allowedVolume: {
      minLdu: [...scope.allowedVolume.minLdu],
      maxLdu: [...scope.allowedVolume.maxLdu],
    },
    allowedCatalogPartIds: sortedStrings(scope.allowedCatalogPartIds),
    allowedColorIds: sortedStrings(scope.allowedColorIds),
    budgets: { ...scope.budgets },
  };
}
