import {
  documentStructuralHash,
  validBrickConnections,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ValidationReportV1 } from "@lego-studio/protocol";

import { fail, incompleteValidation, isConnected } from "./rigid-subassembly-return-support";

const ALLOWED_CROSS_COMPONENT_COLLISIONS = new Set([
  "PART_BODY_COLLISION",
  "PART_STUD_BODY_COLLISION",
  "PART_STUD_COLLISION",
]);

function restrictDocument(
  document: BrickDocumentV1,
  includedPartIds: ReadonlySet<string>,
): BrickDocumentV1 {
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => includedPartIds.has(partId)),
  });
  return {
    ...document,
    parts: document.parts.filter(({ id }) => includedPartIds.has(id)),
    connections: document.connections.filter(
      ({ a, b }) => includedPartIds.has(a.partId) && includedPartIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    steps: document.steps.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
}

function requireHardValidComponent(document: BrickDocumentV1, label: "parent" | "child"): void {
  const report = validateBrickDocument(document);
  if (incompleteValidation(report))
    fail(
      "BASE_VALIDATION_INCOMPLETE",
      `Restricted ${label} hard validation exceeded its issue budget; no return enumeration was attempted.`,
    );
  const validConnections = validBrickConnections(document);
  const partIds = document.parts.map(({ id }) => id);
  const blockingCodes = report.issues
    .filter(({ severity }) => severity === "blocking")
    .map(({ code }) => code);
  if (
    !report.documentGloballyValid ||
    blockingCodes.length !== 0 ||
    report.targetDocumentHash !== documentStructuralHash(document) ||
    validConnections.length !== document.connections.length ||
    !isConnected(partIds, validConnections)
  )
    fail(
      "BASE_BLOCKER_INVALID",
      `Restricted ${label} component must be complete, hash-bound, connected, and globally hard-valid; blockers=[${blockingCodes.join(", ")}].`,
    );
}

function allowedCombinedIssue(
  issue: ValidationReportV1["issues"][number],
  childPartIds: ReadonlySet<string>,
): boolean {
  if (issue.severity !== "blocking") return true;
  if (issue.code === "DISCONNECTED_ASSEMBLY") return true;
  return (
    ALLOWED_CROSS_COMPONENT_COLLISIONS.has(issue.code) &&
    issue.partIds.length === 2 &&
    childPartIds.has(issue.partIds[0]!) !== childPartIds.has(issue.partIds[1]!)
  );
}

/**
 * Accepts a staged overlap only when it is exactly between two independently
 * hard-valid connected components. Candidate validation receives no waiver.
 */
export function requireRigidSubassemblyReturnBaseWorld(
  document: BrickDocumentV1,
  baseReport: ValidationReportV1,
  childPartIds: ReadonlySet<string>,
): void {
  const blocking = baseReport.issues.filter(({ severity }) => severity === "blocking");
  const blockingCodes = blocking.map(({ code }) => code);
  if (
    !blocking.some(({ code }) => code === "DISCONNECTED_ASSEMBLY") ||
    !baseReport.issues.every((issue) => allowedCombinedIssue(issue, childPartIds))
  )
    fail(
      "BASE_BLOCKER_INVALID",
      `Base draft may contain only DISCONNECTED_ASSEMBLY and exact two-part cross-boundary staged collision blockers; received [${blockingCodes.join(", ")}].`,
    );
  const parentPartIds = new Set(
    document.parts.filter(({ id }) => !childPartIds.has(id)).map(({ id }) => id),
  );
  requireHardValidComponent(restrictDocument(document, parentPartIds), "parent");
  requireHardValidComponent(restrictDocument(document, childPartIds), "child");
}
