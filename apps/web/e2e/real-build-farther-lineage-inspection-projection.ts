import {
  REAL_BUILD_LINEAGE_ID_PATTERN,
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  MAXIMUM_LINEAGED_FARTHER_LINEAGES,
  MAXIMUM_LINEAGED_FARTHER_SNAPSHOT_BYTES,
  type FartherPlacementWitness,
} from "./real-build-farther-panel-types";
import {
  chargeLineagedFartherInspectionStringUnits,
  failLineagedFartherInspection,
  lineagedFartherInspectionArrayEntry,
  lineagedFartherInspectionArrayLength,
  lineagedFartherInspectionBoundedString,
  lineagedFartherInspectionData,
  lineagedFartherInspectionSafeInteger,
} from "./real-build-farther-lineage-inspection-primitives";
import type {
  InspectedLineagedFartherCandidate,
  InspectedLineagedFartherFrontier,
  InspectedLineagedFartherNode,
  InspectedLineagedFartherOrigin,
  LineagedFartherProjectionContext,
} from "./real-build-farther-lineage-inspection-types";

const MAXIMUM_INSPECTION_WITNESSES = 32_768;
const data = lineagedFartherInspectionData;
const arrayLength = lineagedFartherInspectionArrayLength;
const arrayEntry = lineagedFartherInspectionArrayEntry;
const boundedString = lineagedFartherInspectionBoundedString;
const safeInteger = lineagedFartherInspectionSafeInteger;
const fail = failLineagedFartherInspection;

export function projectLineagedFartherIdentity(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): RealBuildLineageIdentity {
  if (value === null || typeof value !== "object")
    return fail(`${label} is not an identity object`);
  const cached = context.identities.get(value);
  if (cached !== undefined) return cached;
  let result: RealBuildLineageIdentity;
  try {
    result = snapshotRealBuildLineageIdentity(value);
  } catch {
    return fail(`${label} is not a digest-valid bounded lineage identity`);
  }
  context.identities.set(value, result);
  chargeLineagedFartherInspectionStringUnits(
    context,
    result.candidateId.length +
      result.documentHash.length +
      result.lineageId.length +
      result.originLineageId.length +
      (result.parentLineageId?.length ?? 0) +
      result.localIdentity.id.length,
    label,
  );
  return result;
}

export function projectLineagedFartherOriginId(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): string {
  const result = boundedString(value, label, context);
  if (
    !REAL_BUILD_LINEAGE_ID_PATTERN.test(result) ||
    !/^lineage:sha256:[0-9a-f]{64}$/u.test(result)
  ) {
    return fail(`${label} must be a generated lineage digest identifier`);
  }
  return result;
}

export function projectLineagedFartherDocumentSnapshot(
  rawSnapshot: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
  candidateId?: string,
  expectedDocumentHash?: string,
): RealBuildCandidateDocumentSnapshot {
  let documentSnapshot: RealBuildCandidateDocumentSnapshot;
  try {
    documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(rawSnapshot);
  } catch {
    return fail(`${label} is not an exact module-created document snapshot`);
  }
  if (
    expectedDocumentHash !== undefined &&
    documentSnapshot.documentHash !== expectedDocumentHash
  ) {
    return fail(`${label} does not match the expected documentHash`);
  }
  const resolvedCandidateId = candidateId ?? `document:${documentSnapshot.documentHash}`;
  const establishedCandidate = context.snapshotsByCandidateId.get(resolvedCandidateId);
  if (establishedCandidate !== undefined && establishedCandidate !== documentSnapshot) {
    return fail(`${label} maps one candidateId to a different document-snapshot object`);
  }
  context.snapshotsByCandidateId.set(resolvedCandidateId, documentSnapshot);
  const establishedDigest = context.snapshotsByBytesHash.get(documentSnapshot.canonicalBytesHash);
  if (establishedDigest !== undefined && establishedDigest !== documentSnapshot) {
    return fail(`${label} maps one canonicalBytesHash to a different document-snapshot object`);
  }
  context.snapshotsByBytesHash.set(documentSnapshot.canonicalBytesHash, documentSnapshot);
  if (!context.chargedSnapshots.has(documentSnapshot)) {
    const bytes = documentSnapshot.canonicalByteLength;
    if (bytes > MAXIMUM_LINEAGED_FARTHER_SNAPSHOT_BYTES - context.retainedSnapshotBytes) {
      return fail(`${label} exceeds the aggregate unique document-snapshot byte budget`);
    }
    context.retainedSnapshotBytes += bytes;
    context.chargedSnapshots.add(documentSnapshot);
  }
  return documentSnapshot;
}

function candidate(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherCandidate {
  if (value === null || typeof value !== "object") return fail(`${label} must be an object`);
  const cached = context.candidates.get(value);
  if (cached !== undefined) return cached;
  const identity = projectLineagedFartherIdentity(
    data(value, "identity", label),
    `${label}.identity`,
    context,
  );
  const fartherOriginLineageId = projectLineagedFartherOriginId(
    data(value, "fartherOriginLineageId", label),
    `${label}.fartherOriginLineageId`,
    context,
  );
  const result = Object.freeze({
    identity,
    fartherOriginLineageId:
      fartherOriginLineageId as InspectedLineagedFartherCandidate["fartherOriginLineageId"],
    documentSnapshot: projectLineagedFartherDocumentSnapshot(
      data(value, "documentSnapshot", label),
      `${label}.documentSnapshot`,
      context,
      identity.candidateId,
      identity.documentHash,
    ),
  });
  context.candidates.set(value, result);
  return result;
}

function witness(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): FartherPlacementWitness {
  if (value === null || typeof value !== "object") return fail(`${label} must be an object`);
  const cached = context.witnesses.get(value);
  if (cached !== undefined) return cached;
  const transform = data(value, "transform", label);
  const position = data(transform, "positionLdu", `${label}.transform`);
  const positionLength = arrayLength(position, `${label}.transform.positionLdu`, 3, context);
  if (positionLength !== 3) {
    return fail(`${label}.transform.positionLdu must contain exactly 3 coordinates`);
  }
  const coordinates = [0, 1, 2].map((index) => {
    const coordinate = arrayEntry(position, index, `${label}.transform.positionLdu`);
    if (!Number.isSafeInteger(coordinate)) {
      return fail(`${label}.transform.positionLdu[${index}] must be a safe integer`);
    }
    return coordinate as number;
  }) as [number, number, number];
  const result = Object.freeze({
    catalogPartId: boundedString(
      data(value, "catalogPartId", label),
      `${label}.catalogPartId`,
      context,
    ),
    colorId: boundedString(data(value, "colorId", label), `${label}.colorId`, context),
    transform: Object.freeze({
      positionLdu: Object.freeze(coordinates),
      orientationId: boundedString(
        data(transform, "orientationId", `${label}.transform`),
        `${label}.transform.orientationId`,
        context,
      ),
    }),
  });
  context.witnesses.set(value, result);
  return result;
}

export function projectLineagedFartherWitnesses(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): readonly FartherPlacementWitness[] {
  if (value !== null && typeof value === "object") {
    const cached = context.witnessArrays.get(value);
    if (cached !== undefined) {
      if (cached.length > MAXIMUM_INSPECTION_WITNESSES - context.budget.witnesses) {
        return fail(`${label} exceeds the aggregate farther-inspection witness budget`);
      }
      lineagedFartherInspectionArrayLength(cached, label, cached.length, context);
      context.budget.witnesses += cached.length;
      return cached;
    }
  }
  const remaining = MAXIMUM_INSPECTION_WITNESSES - context.budget.witnesses;
  const count = arrayLength(value, label, remaining, context);
  context.budget.witnesses += count;
  const result: FartherPlacementWitness[] = [];
  for (let index = 0; index < count; index += 1) {
    result.push(witness(arrayEntry(value, index, label), `${label}[${index}]`, context));
  }
  const frozen = Object.freeze(result);
  context.witnessArrays.set(value as object, frozen);
  return frozen;
}

function node(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherNode {
  if (value === null || typeof value !== "object") return fail(`${label} must be an object`);
  const cached = context.nodes.get(value);
  if (cached !== undefined) return cached;
  const identity = projectLineagedFartherIdentity(
    data(value, "identity", label),
    `${label}.identity`,
    context,
  );
  const documentSnapshot = projectLineagedFartherDocumentSnapshot(
    data(value, "documentSnapshot", label),
    `${label}.documentSnapshot`,
    context,
    identity.candidateId,
    identity.documentHash,
  );
  const rawPieces = data(value, "pieces", label);
  const result = Object.freeze({
    identity,
    documentSnapshot,
    pieces:
      rawPieces === null
        ? null
        : projectLineagedFartherWitnesses(rawPieces, `${label}.pieces`, context),
  });
  context.nodes.set(value, result);
  return result;
}

function projectCandidateAndNodeArrays(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
) {
  const rawCandidates = data(value, "candidates", label);
  const rawNodes = data(value, "nodes", label);
  const candidateCount = arrayLength(
    rawCandidates,
    `${label}.candidates`,
    MAXIMUM_LINEAGED_FARTHER_LINEAGES,
    context,
  );
  const nodeCount = arrayLength(
    rawNodes,
    `${label}.nodes`,
    MAXIMUM_LINEAGED_FARTHER_LINEAGES,
    context,
  );
  const candidates: InspectedLineagedFartherCandidate[] = [];
  const nodes: InspectedLineagedFartherNode[] = [];
  for (let index = 0; index < candidateCount; index += 1) {
    candidates.push(
      candidate(
        arrayEntry(rawCandidates, index, `${label}.candidates`),
        `${label}.candidates[${index}]`,
        context,
      ),
    );
  }
  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push(
      node(arrayEntry(rawNodes, index, `${label}.nodes`), `${label}.nodes[${index}]`, context),
    );
  }
  return { candidates: Object.freeze(candidates), nodes: Object.freeze(nodes) };
}

export function projectLineagedFartherFrontier(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherFrontier {
  const originStepNumber = safeInteger(
    data(value, "originStepNumber", label),
    `${label}.originStepNumber`,
  );
  const throughStepNumber = safeInteger(
    data(value, "throughStepNumber", label),
    `${label}.throughStepNumber`,
  );
  const observationPanelStepNumber = safeInteger(
    data(value, "observationPanelStepNumber", label),
    `${label}.observationPanelStepNumber`,
  );
  const panelRendersUsed = safeInteger(
    data(value, "panelRendersUsed", label),
    `${label}.panelRendersUsed`,
  );
  const rows = projectCandidateAndNodeArrays(value, label, context);
  return Object.freeze({
    originStepNumber,
    throughStepNumber,
    observationPanelStepNumber,
    panelRendersUsed,
    ...rows,
  });
}

export function projectLineagedFartherOrigin(
  value: unknown,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherOrigin {
  const label = "lineaged origin";
  const stepNumber = safeInteger(data(value, "stepNumber", label), `${label}.stepNumber`);
  const observationPanelStepNumber = safeInteger(
    data(value, "observationPanelStepNumber", label),
    `${label}.observationPanelStepNumber`,
  );
  const panelRendersUsed = safeInteger(
    data(value, "panelRendersUsed", label),
    `${label}.panelRendersUsed`,
  );
  const rows = projectCandidateAndNodeArrays(value, label, context);
  return Object.freeze({
    stepNumber,
    observationPanelStepNumber,
    panelRendersUsed,
    ...rows,
  });
}
