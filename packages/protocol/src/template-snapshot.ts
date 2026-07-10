import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type {
  TemplateColorParameterV1,
  TemplateFixedPartV1,
  TemplateInternalConnectionV1,
  TemplateLocalPortRefV1,
  TemplateSnapshotV1,
} from "./generated/public-types.generated.js";

export interface TemplateSnapshotSemanticError {
  readonly instancePath: string;
  readonly message: string;
}

/** Intrinsic validation never substitutes for catalog- and truth-bound admission. */
export const TEMPLATE_SNAPSHOT_ADMISSION_REQUIREMENT =
  "pinned-catalog-truth-and-admission-policy-validation-required/1" as const;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value))
        throw new TypeError("Template content contains a non-finite number");
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "object":
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
      return `{${Object.keys(value)
        .sort(compareStrings)
        .map(
          (key) =>
            `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
        )
        .join(",")}}`;
    default:
      throw new TypeError(`Template content contains unsupported ${typeof value} data`);
  }
}

function endpointKey(endpoint: TemplateLocalPortRefV1): string {
  return `${endpoint.localPartId}\u0000${endpoint.portId}`;
}

function normalizeParameter(parameter: TemplateColorParameterV1) {
  return {
    kind: parameter.kind,
    name: parameter.name,
    allowedColorIds: [...parameter.allowedColorIds].sort(compareStrings),
    ...(parameter.defaultColorId === undefined ? {} : { defaultColorId: parameter.defaultColorId }),
  };
}

function normalizePart(part: TemplateFixedPartV1) {
  return {
    localPartId: part.localPartId,
    catalogPartId: part.catalogPartId,
    color:
      part.color.kind === "literal"
        ? { kind: part.color.kind, colorId: part.color.colorId }
        : { kind: part.color.kind, parameterName: part.color.parameterName },
    transform: {
      positionLdu: [...part.transform.positionLdu],
      orientationId: part.transform.orientationId,
    },
    semanticTags: [...part.semanticTags].sort(compareStrings),
  };
}

function normalizeConnection(connection: TemplateInternalConnectionV1) {
  const a = { ...connection.a };
  const b = { ...connection.b };
  const [first, second] = endpointKey(a) <= endpointKey(b) ? [a, b] : [b, a];
  return {
    localConnectionId: connection.localConnectionId,
    kind: connection.kind,
    a: first,
    b: second,
  };
}

/**
 * Returns the canonical hash input for an immutable fixed-graph snapshot.
 * Array order without domain meaning is normalized and contentHash is excluded.
 */
export function normalizeTemplateSnapshotContent(snapshot: TemplateSnapshotV1): unknown {
  return {
    schemaVersion: snapshot.schemaVersion,
    id: snapshot.id,
    version: snapshot.version,
    ...(snapshot.parentId === undefined ? {} : { parentId: snapshot.parentId }),
    status: snapshot.status,
    catalogHash: snapshot.catalogHash,
    truthSnapshotHash: snapshot.truthSnapshotHash,
    admissionPolicyHash: snapshot.admissionPolicyHash,
    parameters: snapshot.parameters
      .map(normalizeParameter)
      .sort((left, right) => compareStrings(left.name, right.name)),
    parts: snapshot.parts
      .map(normalizePart)
      .sort((left, right) => compareStrings(left.localPartId, right.localPartId)),
    internalConnections: snapshot.internalConnections
      .map(normalizeConnection)
      .sort((left, right) => compareStrings(left.localConnectionId, right.localConnectionId)),
    externalPorts: snapshot.externalPorts
      .map(({ name, endpoint }) => ({ name, endpoint: { ...endpoint } }))
      .sort((left, right) => compareStrings(left.name, right.name)),
    clearanceVolume: {
      minLdu: [...snapshot.clearanceVolume.minLdu],
      maxLdu: [...snapshot.clearanceVolume.maxLdu],
    },
    evidenceRunIds: [...snapshot.evidenceRunIds].sort(compareStrings),
    counterexampleRunIds: [...snapshot.counterexampleRunIds].sort(compareStrings),
    benchmarkReportIds: [...snapshot.benchmarkReportIds].sort(compareStrings),
    provenance: { ...snapshot.provenance },
    license: { ...snapshot.license },
  };
}

export function templateSnapshotContentHash(snapshot: TemplateSnapshotV1): `sha256:${string}` {
  const bytes = utf8ToBytes(canonicalJson(normalizeTemplateSnapshotContent(snapshot)));
  return `sha256:${bytesToHex(sha256(bytes))}`;
}

function duplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  return values.find((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

function semanticError(instancePath: string, message: string): TemplateSnapshotSemanticError {
  return { instancePath, message };
}

/**
 * Runs intrinsic semantic checks that JSON Schema cannot express. This does
 * not prove that catalog IDs, colors, transforms, or ports exist in the pinned
 * truth or admission policy; admission must satisfy
 * TEMPLATE_SNAPSHOT_ADMISSION_REQUIREMENT too.
 */
export function checkTemplateSnapshotSemantics(
  snapshot: TemplateSnapshotV1,
): TemplateSnapshotSemanticError | null {
  const duplicateParameter = duplicate(snapshot.parameters.map(({ name }) => name));
  if (duplicateParameter !== undefined) {
    return semanticError("/parameters", `Duplicate template parameter: ${duplicateParameter}`);
  }
  const duplicatePart = duplicate(snapshot.parts.map(({ localPartId }) => localPartId));
  if (duplicatePart !== undefined) {
    return semanticError("/parts", `Duplicate local part identifier: ${duplicatePart}`);
  }
  const duplicateConnection = duplicate(
    snapshot.internalConnections.map(({ localConnectionId }) => localConnectionId),
  );
  if (duplicateConnection !== undefined) {
    return semanticError(
      "/internalConnections",
      `Duplicate local connection identifier: ${duplicateConnection}`,
    );
  }
  const partIds = new Set(snapshot.parts.map(({ localPartId }) => localPartId));
  if (
    snapshot.internalConnections.some(({ localConnectionId }) => partIds.has(localConnectionId))
  ) {
    return semanticError(
      "/internalConnections",
      "Local part and connection identifiers must not overlap",
    );
  }
  const duplicateExternalName = duplicate(snapshot.externalPorts.map(({ name }) => name));
  if (duplicateExternalName !== undefined) {
    return semanticError(
      "/externalPorts",
      `Duplicate external port name: ${duplicateExternalName}`,
    );
  }

  const parameters = new Map(snapshot.parameters.map((parameter) => [parameter.name, parameter]));
  for (let index = 0; index < snapshot.parameters.length; index += 1) {
    const parameter = snapshot.parameters[index]!;
    if (
      parameter.defaultColorId !== undefined &&
      !parameter.allowedColorIds.includes(parameter.defaultColorId)
    ) {
      return semanticError(
        `/parameters/${index}/defaultColorId`,
        "Template color default must be one of its allowed colors",
      );
    }
  }
  for (let index = 0; index < snapshot.parts.length; index += 1) {
    const color = snapshot.parts[index]!.color;
    if (color.kind === "parameter" && !parameters.has(color.parameterName)) {
      return semanticError(
        `/parts/${index}/color/parameterName`,
        `Template part references unknown color parameter: ${color.parameterName}`,
      );
    }
  }

  const usedEndpoints = new Set<string>();
  for (let index = 0; index < snapshot.internalConnections.length; index += 1) {
    const connection = snapshot.internalConnections[index]!;
    for (const endpointName of ["a", "b"] as const) {
      const endpoint = connection[endpointName];
      if (!partIds.has(endpoint.localPartId)) {
        return semanticError(
          `/internalConnections/${index}/${endpointName}/localPartId`,
          `Template connection references unknown local part: ${endpoint.localPartId}`,
        );
      }
      const key = endpointKey(endpoint);
      if (usedEndpoints.has(key)) {
        return semanticError(
          `/internalConnections/${index}/${endpointName}`,
          "A template local port can participate in only one connection or external exposure",
        );
      }
      usedEndpoints.add(key);
    }
  }
  for (let index = 0; index < snapshot.externalPorts.length; index += 1) {
    const endpoint = snapshot.externalPorts[index]!.endpoint;
    if (!partIds.has(endpoint.localPartId)) {
      return semanticError(
        `/externalPorts/${index}/endpoint/localPartId`,
        `External port references unknown local part: ${endpoint.localPartId}`,
      );
    }
    const key = endpointKey(endpoint);
    if (usedEndpoints.has(key)) {
      return semanticError(
        `/externalPorts/${index}/endpoint`,
        "A template local port can participate in only one connection or external exposure",
      );
    }
    usedEndpoints.add(key);
  }

  if (
    snapshot.clearanceVolume.minLdu.some(
      (minimum, axis) => minimum > snapshot.clearanceVolume.maxLdu[axis]!,
    )
  ) {
    return semanticError(
      "/clearanceVolume",
      "Template clearance minimum must not exceed its maximum",
    );
  }
  if (snapshot.contentHash !== templateSnapshotContentHash(snapshot)) {
    return semanticError(
      "/contentHash",
      "Template content hash does not match canonical normalized snapshot content",
    );
  }
  return null;
}
