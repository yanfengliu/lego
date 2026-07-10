import { getColorDefinition, getPartDefinition, type PartDefinition } from "@lego-studio/catalog";
import {
  TEMPLATE_SNAPSHOT_ADMISSION_REQUIREMENT,
  validateTemplateSnapshotV1,
  type BrickDocumentV1,
  type TemplateSnapshotV1,
  type ValidationReportV1,
} from "@lego-studio/protocol";

import { canonicalDigest, deepFreeze } from "./canonical.ts";
import { createBuiltinTruthSnapshot } from "./factory.ts";
import { clearanceContainsTransformedPartBounds } from "./template-admission-bounds.ts";
import { canonicalTemplateSnapshot, isBoundedDataOnlyJson } from "./template-admission-input.ts";
import { validateBrickDocument } from "./validation.ts";

export const MAX_TEMPLATE_ADMISSION_ISSUES = 128 as const;
export const MAX_TEMPLATE_ADMISSION_DATA_DEPTH = 32 as const;
export const MAX_TEMPLATE_ADMISSION_DATA_NODES = 50_000 as const;
export const TEMPLATE_ADMISSION_POLICY_VERSION = "lego.template-admission/1" as const;

export const TEMPLATE_ADMISSION_MANIFEST = deepFreeze({
  schemaVersion: "lego.template-admission-manifest/1",
  policyVersion: TEMPLATE_ADMISSION_POLICY_VERSION,
  intrinsicProtocolRequirement: TEMPLATE_SNAPSHOT_ADMISSION_REQUIREMENT,
  rules: [
    "data-only-descriptor-preflight-before-clone",
    "intrinsic-protocol-valid-first",
    "content-normalization-before-admission-evidence",
    "active-admission-policy-catalog-and-truth-pins",
    "catalog-parts-colors-parameter-domains-orientations-and-ports",
    "authoritative-transformed-clearance-bounds",
    "parameter-default-or-lexicographic-color-projection",
    "projected-document-connection-graph-collision-validity",
    "deterministically-sorted-and-bounded-admission-evidence",
  ],
  limits: {
    maxIssues: MAX_TEMPLATE_ADMISSION_ISSUES,
    maxDataDepth: MAX_TEMPLATE_ADMISSION_DATA_DEPTH,
    maxDataNodes: MAX_TEMPLATE_ADMISSION_DATA_NODES,
  },
} as const);

export const TEMPLATE_ADMISSION_SNAPSHOT_HASH = canonicalDigest(TEMPLATE_ADMISSION_MANIFEST);

export type TemplateAdmissionIssueCode =
  | "TEMPLATE_PROTOCOL_INVALID"
  | "TEMPLATE_ADMISSION_POLICY_HASH_MISMATCH"
  | "TEMPLATE_CATALOG_HASH_MISMATCH"
  | "TEMPLATE_TRUTH_HASH_MISMATCH"
  | "TEMPLATE_PART_UNKNOWN"
  | "TEMPLATE_COLOR_UNKNOWN"
  | "TEMPLATE_COLOR_NOT_AVAILABLE"
  | "TEMPLATE_ORIENTATION_ILLEGAL"
  | "TEMPLATE_PORT_UNKNOWN"
  | "TEMPLATE_CLEARANCE_EXCEEDED"
  | "TEMPLATE_PROJECTED_DOCUMENT_INVALID"
  | "TEMPLATE_ADMISSION_ISSUE_BUDGET_EXCEEDED";

export interface TemplateAdmissionIssue {
  readonly code: TemplateAdmissionIssueCode;
  readonly message: string;
  readonly path: string;
  readonly partIds: readonly string[];
  readonly connectionIds: readonly string[];
  readonly validationCode?: string;
}

export interface AdmittedTemplateSnapshot {
  readonly ok: true;
  readonly admissionPolicyHash: typeof TEMPLATE_ADMISSION_SNAPSHOT_HASH;
  readonly issues: readonly [];
  readonly snapshot: TemplateSnapshotV1;
  readonly validationReport: ValidationReportV1;
}

export interface RejectedTemplateSnapshot {
  readonly ok: false;
  readonly admissionPolicyHash: typeof TEMPLATE_ADMISSION_SNAPSHOT_HASH;
  readonly issues: readonly TemplateAdmissionIssue[];
  readonly snapshot?: undefined;
  readonly validationReport?: ValidationReportV1;
}

export type TemplateSnapshotAdmissionResult = AdmittedTemplateSnapshot | RejectedTemplateSnapshot;

interface IssueInput {
  readonly code: TemplateAdmissionIssueCode;
  readonly message: string;
  readonly path: string;
  readonly partIds?: readonly string[];
  readonly connectionIds?: readonly string[];
  readonly validationCode?: string;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function makeIssue(input: IssueInput): TemplateAdmissionIssue {
  const issue = {
    code: input.code,
    message: input.message.slice(0, 256),
    path: input.path,
    partIds: sortedUnique(input.partIds ?? []),
    connectionIds: sortedUnique(input.connectionIds ?? []),
  };
  return input.validationCode === undefined
    ? issue
    : { ...issue, validationCode: input.validationCode };
}

function compareIssues(left: TemplateAdmissionIssue, right: TemplateAdmissionIssue): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.path, right.path) ||
    compareStrings(left.validationCode ?? "", right.validationCode ?? "") ||
    compareStrings(left.message, right.message) ||
    compareStrings(left.partIds.join("\u0000"), right.partIds.join("\u0000")) ||
    compareStrings(left.connectionIds.join("\u0000"), right.connectionIds.join("\u0000"))
  );
}

function finalizeIssues(
  values: readonly TemplateAdmissionIssue[],
): readonly TemplateAdmissionIssue[] {
  const issues = [...values].sort(compareIssues);
  if (issues.length > MAX_TEMPLATE_ADMISSION_ISSUES) {
    const omittedCount = issues.length - (MAX_TEMPLATE_ADMISSION_ISSUES - 1);
    issues.splice(MAX_TEMPLATE_ADMISSION_ISSUES - 1);
    issues.push(
      makeIssue({
        code: "TEMPLATE_ADMISSION_ISSUE_BUDGET_EXCEEDED",
        message: `${omittedCount} additional template admission issues were deterministically omitted`,
        path: "",
      }),
    );
    issues.sort(compareIssues);
  }
  return deepFreeze(issues);
}

function reject(
  issues: readonly TemplateAdmissionIssue[],
  validationReport?: ValidationReportV1,
): RejectedTemplateSnapshot {
  const result = {
    ok: false as const,
    admissionPolicyHash: TEMPLATE_ADMISSION_SNAPSHOT_HASH,
    issues: finalizeIssues(issues),
  };
  return deepFreeze(validationReport === undefined ? result : { ...result, validationReport });
}

function protocolFailure(error?: {
  readonly instancePath?: string;
  readonly message?: string;
}): RejectedTemplateSnapshot {
  return reject([
    makeIssue({
      code: "TEMPLATE_PROTOCOL_INVALID",
      message: `TemplateSnapshot protocol validation failed: ${error?.message ?? "invalid input"}`,
      path: error?.instancePath ?? "",
    }),
  ]);
}

function validateCatalogBindings(snapshot: TemplateSnapshotV1): readonly TemplateAdmissionIssue[] {
  const issues: TemplateAdmissionIssue[] = [];
  const parameterByName = new Map(
    snapshot.parameters.map((parameter) => [parameter.name, parameter]),
  );
  const definitionByPartId = new Map<string, PartDefinition>();

  for (let parameterIndex = 0; parameterIndex < snapshot.parameters.length; parameterIndex += 1) {
    const parameter = snapshot.parameters[parameterIndex]!;
    for (let colorIndex = 0; colorIndex < parameter.allowedColorIds.length; colorIndex += 1) {
      const colorId = parameter.allowedColorIds[colorIndex]!;
      if (!getColorDefinition(colorId)) {
        issues.push(
          makeIssue({
            code: "TEMPLATE_COLOR_UNKNOWN",
            message: `Template color parameter ${parameter.name} contains an unknown color: ${colorId}`,
            path: `/parameters/${parameterIndex}/allowedColorIds/${colorIndex}`,
          }),
        );
      }
    }
  }

  for (let partIndex = 0; partIndex < snapshot.parts.length; partIndex += 1) {
    const part = snapshot.parts[partIndex]!;
    const definition = getPartDefinition(part.catalogPartId);
    if (!definition || definition.id !== part.catalogPartId) {
      issues.push(
        makeIssue({
          code: "TEMPLATE_PART_UNKNOWN",
          message: `Template part ${part.localPartId} uses an unknown or non-canonical catalog part: ${part.catalogPartId}`,
          path: `/parts/${partIndex}/catalogPartId`,
          partIds: [part.localPartId],
        }),
      );
      continue;
    }
    definitionByPartId.set(part.localPartId, definition);

    if (!definition.legalOrientationIds.includes(part.transform.orientationId)) {
      issues.push(
        makeIssue({
          code: "TEMPLATE_ORIENTATION_ILLEGAL",
          message: `Template part ${part.localPartId} uses an orientation that is illegal for ${definition.id}`,
          path: `/parts/${partIndex}/transform/orientationId`,
          partIds: [part.localPartId],
        }),
      );
    } else if (
      !clearanceContainsTransformedPartBounds(definition, part.transform, snapshot.clearanceVolume)
    ) {
      issues.push(
        makeIssue({
          code: "TEMPLATE_CLEARANCE_EXCEEDED",
          message: `Template clearance does not contain the authoritative bounds of part ${part.localPartId}`,
          path: "/clearanceVolume",
          partIds: [part.localPartId],
        }),
      );
    }

    if (part.color.kind === "literal") {
      if (!getColorDefinition(part.color.colorId)) {
        issues.push(
          makeIssue({
            code: "TEMPLATE_COLOR_UNKNOWN",
            message: `Template part ${part.localPartId} uses an unknown color: ${part.color.colorId}`,
            path: `/parts/${partIndex}/color/colorId`,
            partIds: [part.localPartId],
          }),
        );
      } else if (!definition.availableColorIds.includes(part.color.colorId)) {
        issues.push(
          makeIssue({
            code: "TEMPLATE_COLOR_NOT_AVAILABLE",
            message: `Color ${part.color.colorId} is not available for template part ${part.localPartId}`,
            path: `/parts/${partIndex}/color/colorId`,
            partIds: [part.localPartId],
          }),
        );
      }
      continue;
    }

    const parameter = parameterByName.get(part.color.parameterName);
    if (!parameter) continue;
    for (const colorId of parameter.allowedColorIds) {
      if (getColorDefinition(colorId) && !definition.availableColorIds.includes(colorId)) {
        issues.push(
          makeIssue({
            code: "TEMPLATE_COLOR_NOT_AVAILABLE",
            message: `Parameter color ${colorId} is not available for template part ${part.localPartId}`,
            path: `/parts/${partIndex}/color/parameterName`,
            partIds: [part.localPartId],
          }),
        );
      }
    }
  }

  const checkPort = (
    localPartId: string,
    portId: string,
    path: string,
    connectionIds: readonly string[] = [],
  ): void => {
    const definition = definitionByPartId.get(localPartId);
    if (definition && !definition.connectors.some(({ id }) => id === portId)) {
      issues.push(
        makeIssue({
          code: "TEMPLATE_PORT_UNKNOWN",
          message: `Template endpoint references unknown port ${portId} on ${definition.id}`,
          path,
          partIds: [localPartId],
          connectionIds,
        }),
      );
    }
  };

  for (
    let connectionIndex = 0;
    connectionIndex < snapshot.internalConnections.length;
    connectionIndex += 1
  ) {
    const connection = snapshot.internalConnections[connectionIndex]!;
    checkPort(
      connection.a.localPartId,
      connection.a.portId,
      `/internalConnections/${connectionIndex}/a/portId`,
      [connection.localConnectionId],
    );
    checkPort(
      connection.b.localPartId,
      connection.b.portId,
      `/internalConnections/${connectionIndex}/b/portId`,
      [connection.localConnectionId],
    );
  }
  for (let portIndex = 0; portIndex < snapshot.externalPorts.length; portIndex += 1) {
    const externalPort = snapshot.externalPorts[portIndex]!;
    checkPort(
      externalPort.endpoint.localPartId,
      externalPort.endpoint.portId,
      `/externalPorts/${portIndex}/endpoint/portId`,
    );
  }

  return issues;
}

function selectedColorId(
  snapshot: TemplateSnapshotV1,
  part: TemplateSnapshotV1["parts"][number],
): string {
  if (part.color.kind === "literal") return part.color.colorId;
  const parameterName = part.color.parameterName;
  const parameter = snapshot.parameters.find(({ name }) => name === parameterName)!;
  return parameter.defaultColorId ?? [...parameter.allowedColorIds].sort(compareStrings)[0]!;
}

function projectTemplateDocument(snapshot: TemplateSnapshotV1): BrickDocumentV1 {
  const truth = createBuiltinTruthSnapshot();
  const parts = snapshot.parts.map((part) => ({
    id: part.localPartId,
    catalogPartId: part.catalogPartId,
    colorId: selectedColorId(snapshot, part),
    transform: {
      positionLdu: [...part.transform.positionLdu] as [number, number, number],
      orientationId: part.transform.orientationId,
    },
    submodelId: "root",
    stepId: "step-1",
    semanticTags: [...part.semanticTags],
    provenance: { source: "template" as const, sourceId: snapshot.id },
  }));
  const partIds = parts.map(({ id }) => id);

  return {
    schemaVersion: "lego.brick-document/1",
    id: "template-admission",
    revision: "revision-0",
    truth,
    name: "Template admission",
    parts,
    connections: snapshot.internalConnections.map((connection) => ({
      id: connection.localConnectionId,
      kind: connection.kind,
      a: { partId: connection.a.localPartId, portId: connection.a.portId },
      b: { partId: connection.b.localPartId, portId: connection.b.portId },
      provenance: { source: "template", sourceId: snapshot.id },
    })),
    submodels: [{ id: "root", name: "Root", partIds }],
    steps: [{ id: "step-1", index: 0, name: "Step 1", partIds }],
    semanticRegions: [],
    constraints: {
      maxParts: parts.length,
      allowedCatalogPartIds: sortedUnique(parts.map(({ catalogPartId }) => catalogPartId)),
      allowedColorIds: sortedUnique(parts.map(({ colorId }) => colorId)),
    },
    provenance: { origin: "manual" },
  };
}

/**
 * Admits protocol-valid fixed template data only when its pins and every
 * catalog-dependent claim agree with the active kernel truth. The projection
 * exists solely to reuse the authoritative document graph, connector, and
 * collision validators; it does not enable template compilation.
 */
export function validateTemplateSnapshotAgainstTruth(
  value: unknown,
): TemplateSnapshotAdmissionResult {
  if (
    !isBoundedDataOnlyJson(value, {
      maxDepth: MAX_TEMPLATE_ADMISSION_DATA_DEPTH,
      maxNodes: MAX_TEMPLATE_ADMISSION_DATA_NODES,
    })
  ) {
    return protocolFailure({ message: "input must be bounded data-only JSON" });
  }
  let detached: unknown;
  try {
    detached = structuredClone(value);
  } catch {
    return protocolFailure();
  }
  let intrinsicallyValid: boolean;
  try {
    intrinsicallyValid = validateTemplateSnapshotV1(detached);
  } catch {
    return protocolFailure();
  }
  if (!intrinsicallyValid) {
    return protocolFailure(validateTemplateSnapshotV1.errors?.[0]);
  }
  const snapshot = canonicalTemplateSnapshot(detached as TemplateSnapshotV1);
  const truth = createBuiltinTruthSnapshot();
  const pinIssues: TemplateAdmissionIssue[] = [];
  if (snapshot.admissionPolicyHash !== TEMPLATE_ADMISSION_SNAPSHOT_HASH) {
    pinIssues.push(
      makeIssue({
        code: "TEMPLATE_ADMISSION_POLICY_HASH_MISMATCH",
        message: "Template admission policy hash does not match the active admission policy",
        path: "/admissionPolicyHash",
      }),
    );
  }
  if (snapshot.catalogHash !== truth.catalog.hash) {
    pinIssues.push(
      makeIssue({
        code: "TEMPLATE_CATALOG_HASH_MISMATCH",
        message: "Template catalog hash does not match the active catalog truth",
        path: "/catalogHash",
      }),
    );
  }
  if (snapshot.truthSnapshotHash !== canonicalDigest(truth)) {
    pinIssues.push(
      makeIssue({
        code: "TEMPLATE_TRUTH_HASH_MISMATCH",
        message: "Template truth snapshot hash does not match the active kernel truth",
        path: "/truthSnapshotHash",
      }),
    );
  }
  if (pinIssues.length > 0) return reject(pinIssues);

  const catalogIssues = validateCatalogBindings(snapshot);
  if (catalogIssues.length > 0) return reject(catalogIssues);

  const validationReport = validateBrickDocument(projectTemplateDocument(snapshot));
  if (!validationReport.documentGloballyValid) {
    return reject(
      validationReport.issues.map((issue) =>
        makeIssue({
          code: "TEMPLATE_PROJECTED_DOCUMENT_INVALID",
          validationCode: issue.code,
          message: issue.message,
          path: issue.path,
          partIds: issue.partIds,
          connectionIds: issue.connectionIds,
        }),
      ),
      validationReport,
    );
  }

  return deepFreeze({
    ok: true,
    admissionPolicyHash: TEMPLATE_ADMISSION_SNAPSHOT_HASH,
    issues: [] as const,
    snapshot,
    validationReport,
  });
}
