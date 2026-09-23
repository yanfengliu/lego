import { getPartDefinition } from "@lego-studio/catalog";
import {
  canonicalDigest,
  composeRigidTransforms,
  createCollisionWorld,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
} from "@lego-studio/protocol";

import {
  enumeratePlacements,
  type PlacementCandidate,
  type PlacementEnumeration,
  type PlacementEnumerationOptions,
  type PlacementEnumerationWork,
} from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForDiscoveredConnection } from "../src/assembly/placement-connection-kind";
import {
  requireExactDataKeys,
  requireStep45CompleteEnumeration,
  sameSequence,
} from "./real-build-prefix50-step45-relational-accounting";
import {
  STEP45_AXLE,
  STEP45_AXLE_PORT,
  STEP45_EXPECTED_DOCUMENT_PARTS,
  STEP45_EXPECTED_ROWS,
  STEP45_MAX_CANDIDATE_CONNECTIONS,
  STEP45_MAX_DISTINCT_TRANSFORMS,
  STEP45_MAX_DOCUMENT_CONNECTIONS,
  STEP45_MAX_RECORDED_WORK,
  STEP45_MAX_SEED_RECEIPT_ROWS,
  STEP45_RECEIVER_PORT,
  type RealBuildPrefix50Step45RelationalResolution,
  type RealBuildPrefix50Step45RelationalResolverInput,
  type RealBuildPrefix50Step45RelationalRow,
} from "./real-build-prefix50-step45-relational-contract";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";
import { inverseRealBuildPrefix50Step45Transform } from "./real-build-prefix50-step45-transform";
export type {
  RealBuildPrefix50Step45OrdinalPartRow,
  RealBuildPrefix50Step45RelationalResolution,
  RealBuildPrefix50Step45RelationalResolverInput,
  RealBuildPrefix50Step45RelationalRow,
} from "./real-build-prefix50-step45-relational-contract";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const resolutions = new WeakSet<object>();
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

function brandRealBuildPrefix50Step45RelationalResolution(
  resolution: RealBuildPrefix50Step45RelationalResolution,
): void {
  SAFE_APPLY(SAFE_WEAK_SET_ADD, resolutions, [resolution]);
}

type Enumerator = (
  document: BrickDocumentV1,
  catalogPartId: string,
  options: PlacementEnumerationOptions,
) => PlacementEnumeration;

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId && sameSequence(left.positionLdu, right.positionLdu)
  );
}

function requireSourceRepairs(
  repairs: readonly RealBuildPrefix50SourcePlacementRepairProposal[],
): void {
  if (!Array.isArray(repairs) || repairs.length !== STEP45_EXPECTED_ROWS.length) {
    throw new TypeError(
      "Step-45 relational resolution requires exactly three fixed source repairs.",
    );
  }
  for (const [index, expected] of STEP45_EXPECTED_ROWS.entries()) {
    const repair = repairs[index];
    requireExactDataKeys(
      repair,
      [
        "catalogPartId",
        "expectedCandidatePortId",
        "expectedReceiverCatalogPartId",
        "expectedReceiverColorId",
        "expectedReceiverOrdinal",
        "expectedReceiverPortId",
        "expectedReceiverSourceWorldTransform",
        "occurrenceOrdinal",
        "printedStepNumber",
        "provisionalBasis",
        "repairedSourceWorldTransform",
        "schemaVersion",
        "sourceResidualLdu",
        "sourceWorldTransform",
      ],
      `Step-45 source repair[${index}]`,
    );
    if (
      repair?.schemaVersion !== "lego.real-build-prefix50-source-placement-repair/1" ||
      repair.occurrenceOrdinal !== expected.occurrenceOrdinal ||
      repair.printedStepNumber !== 45 ||
      repair.catalogPartId !== STEP45_AXLE ||
      repair.expectedReceiverOrdinal !== expected.receiverOrdinal ||
      repair.expectedReceiverCatalogPartId !== expected.receiverCatalogPartId ||
      repair.expectedReceiverColorId !== expected.receiverColorId ||
      repair.expectedCandidatePortId !== STEP45_AXLE_PORT ||
      repair.expectedReceiverPortId !== STEP45_RECEIVER_PORT ||
      repair.provisionalBasis !== "occurrence-scoped-source-residual-awaiting-connector-proof" ||
      repair.sourceWorldTransform.orientationId !== "proper-m-00pp000p0" ||
      repair.repairedSourceWorldTransform.orientationId !== "proper-m-00pp000p0" ||
      !sameSequence(repair.sourceWorldTransform.positionLdu, expected.sourcePositionLdu) ||
      !sameSequence(
        repair.repairedSourceWorldTransform.positionLdu,
        expected.repairedPositionLdu,
      ) ||
      !sameSequence(repair.sourceResidualLdu, [0, 0, 0.5]) ||
      repair.expectedReceiverSourceWorldTransform.orientationId !==
        expected.receiverSourceOrientationId ||
      !sameSequence(
        repair.expectedReceiverSourceWorldTransform.positionLdu,
        expected.receiverSourcePositionLdu,
      )
    ) {
      throw new TypeError(
        `Step-45 source repair ${expected.occurrenceOrdinal} does not match its fixed occurrence, receiver, ports, or repaired source transform.`,
      );
    }
  }
}

function requireBase(
  input: RealBuildPrefix50Step45RelationalResolverInput,
): ReadonlyMap<number, string> {
  requireExactDataKeys(
    input,
    [
      "ordinalPartRows",
      "selectedStep44Document",
      "selectedStep44EvidenceCommitment",
      "sourceRepairs",
    ],
    "Step-45 relational resolver input",
  );
  if (!SHA256.test(input.selectedStep44EvidenceCommitment)) {
    throw new TypeError("Step-45 resolution requires one exact Step-44 evidence commitment.");
  }
  const document = input.selectedStep44Document;
  const report = validateBrickDocument(document);
  if (
    document.parts.length !== STEP45_EXPECTED_DOCUMENT_PARTS ||
    document.connections.length > STEP45_MAX_DOCUMENT_CONNECTIONS ||
    document.steps.length !== 44 ||
    document.submodels.length < 1 ||
    document.steps.some(({ index }, stepIndex) => index !== stepIndex) ||
    document.steps[43]?.partIds.length !== 0 ||
    !report.documentGloballyValid
  ) {
    throw new TypeError(
      `Step-45 resolution requires the exact hard-valid 280-part selected Step-44 document; parts/connections/blockers=${document.parts.length}/${document.connections.length}/${report.issues.filter(({ severity }) => severity === "blocking").length}.`,
    );
  }
  if (!Array.isArray(input.ordinalPartRows) || input.ordinalPartRows.length !== 280) {
    throw new TypeError(
      "Step-45 resolution requires an exact ordinal-to-part roster 1 through 280.",
    );
  }
  const documentPartIds = new Set(document.parts.map(({ id }) => id));
  const mapped = new Set<string>();
  const byOrdinal = new Map<number, string>();
  for (const [index, row] of input.ordinalPartRows.entries()) {
    requireExactDataKeys(row, ["ordinal", "partId"], `Step-45 ordinal part row[${index}]`);
    if (
      row.ordinal !== index + 1 ||
      typeof row.partId !== "string" ||
      !documentPartIds.has(row.partId) ||
      mapped.has(row.partId)
    ) {
      throw new TypeError(
        `Step-45 ordinal part row ${index + 1} must map exactly once to one selected-document part.`,
      );
    }
    mapped.add(row.partId);
    byOrdinal.set(row.ordinal, row.partId);
  }
  if (mapped.size !== documentPartIds.size) {
    throw new TypeError(
      "Step-45 ordinal part rows do not cover the selected document exactly once.",
    );
  }
  requireSourceRepairs(input.sourceRepairs);
  return byOrdinal;
}

function exactPair(candidate: PlacementCandidate, receiverPartId: string): boolean {
  const axlePortConnections = candidate.connections.filter(
    ({ candidatePortId }) => candidatePortId === STEP45_AXLE_PORT,
  );
  return (
    axlePortConnections.length === 1 &&
    axlePortConnections[0]!.targetPartId === receiverPartId &&
    axlePortConnections[0]!.targetPortId === STEP45_RECEIVER_PORT
  );
}

function prospectiveValidation(
  document: BrickDocumentV1,
  selected: readonly {
    readonly occurrenceOrdinal: number;
    readonly candidate: PlacementCandidate;
  }[],
) {
  const rootSubmodel = document.submodels[0]!;
  const prospectiveStep = {
    id: "step45-relational-proof",
    index: 44,
    name: "Printed step 45 relational proof",
    partIds: [] as string[],
  };
  if (document.steps.some(({ id }) => id === prospectiveStep.id)) {
    throw new TypeError(`Step-45 prospective step id ${prospectiveStep.id} already exists.`);
  }
  const axle = getPartDefinition(STEP45_AXLE)!;
  const candidateParts: PartInstance[] = [];
  const candidateEdges: ConnectionEdge[] = [];
  const baseWorld = createCollisionWorld(document.parts);
  for (const { occurrenceOrdinal, candidate } of selected) {
    const partId = `step45-relational-${occurrenceOrdinal}`;
    if (document.parts.some(({ id }) => id === partId)) {
      throw new TypeError(`Step-45 prospective part id ${partId} already exists.`);
    }
    const part: PartInstance = {
      id: partId,
      catalogPartId: STEP45_AXLE,
      colorId: axle.availableColorIds[0]!,
      transform: candidate.transform,
      submodelId: rootSubmodel.id,
      stepId: prospectiveStep.id,
      semanticTags: [],
      provenance: { source: "manual" },
    };
    const edges = candidate.connections.map((connection, index): ConnectionEdge => ({
      id: `step45-relational-edge-${occurrenceOrdinal}-${index + 1}`,
      kind: protocolConnectionKindForDiscoveredConnection(document.parts, STEP45_AXLE, connection),
      a: { partId: connection.targetPartId, portId: connection.targetPortId },
      b: { partId, portId: connection.candidatePortId },
      provenance: { source: "manual" },
    }));
    if (baseWorld.findCollisionsWith(part, edges).length !== 0) {
      throw new TypeError(
        `Step-45 occurrence ${occurrenceOrdinal} is not collision-free against its base.`,
      );
    }
    candidateParts.push(part);
    candidateEdges.push(...edges);
  }
  const candidateIds = candidateParts.map(({ id }) => id);
  prospectiveStep.partIds.push(...candidateIds);
  const prospective: BrickDocumentV1 = {
    ...document,
    parts: [...document.parts, ...candidateParts],
    connections: [...document.connections, ...candidateEdges],
    submodels: document.submodels.map((submodel, index) =>
      index === 0 ? { ...submodel, partIds: [...submodel.partIds, ...candidateIds] } : submodel,
    ),
    steps: [...document.steps, prospectiveStep],
  };
  const collisions = findCatalogCollisions(prospective.parts, prospective.connections);
  const report = validateBrickDocument(prospective);
  const blockers = report.issues.filter(({ severity }) => severity === "blocking");
  if (collisions.length !== 0 || blockers.length !== 0 || !report.documentGloballyValid) {
    throw new TypeError(
      `Step-45 combined prospective placements are unsafe; collisions/blockers=${collisions.length}/${blockers.length}.`,
    );
  }
  return deepFreeze({
    candidatePartCount: 3 as const,
    candidateConnectionCount: candidateEdges.length,
    combinedPartCount: 283 as const,
    combinedBuildStepCount: 45 as const,
    prospectivePrintedStepNumber: 45 as const,
    collisionFindingCount: 0 as const,
    blockingIssueCount: 0 as const,
    documentGloballyValid: true as const,
    prospectiveDocumentHash: documentStructuralHash(prospective),
  });
}

function resolveWithEnumerator(
  input: RealBuildPrefix50Step45RelationalResolverInput,
  enumerate: Enumerator,
): RealBuildPrefix50Step45RelationalResolution {
  const ordinalPartIds = requireBase(input);
  const document = input.selectedStep44Document;
  const beforeHash = documentStructuralHash(document);
  const beforeCommitment = canonicalDigest(document);
  let observedWork: PlacementEnumerationWork | undefined;
  let observationCount = 0;
  const enumeration = enumerate(document, STEP45_AXLE, {
    includeBuildPlate: false,
    allowDetached: false,
    maxDistinctTransforms: STEP45_MAX_DISTINCT_TRANSFORMS,
    observeWork: (work) => {
      observationCount += 1;
      observedWork = work;
    },
  });
  if (observationCount !== 1 || observedWork === undefined) {
    throw new TypeError(
      `Step-45 fresh enumeration must report deterministic work exactly once; observed ${observationCount}.`,
    );
  }
  if (
    documentStructuralHash(document) !== beforeHash ||
    canonicalDigest(document) !== beforeCommitment
  ) {
    throw new TypeError("Step-45 enumeration mutated its selected Step-44 document.");
  }
  const roster = requireStep45CompleteEnumeration(enumeration, observedWork, document);
  const selected: { occurrenceOrdinal: number; candidate: PlacementCandidate }[] = [];
  const rows: RealBuildPrefix50Step45RelationalRow[] = [];
  let coherentTransform: RigidTransform | undefined;
  const receiverIds = new Set<string>();
  const selectedTransformKeys = new Set<string>();
  for (const [index, expected] of STEP45_EXPECTED_ROWS.entries()) {
    const repair = input.sourceRepairs[index]!;
    const receiverPartId = ordinalPartIds.get(expected.receiverOrdinal)!;
    const receiver = document.parts.find(({ id }) => id === receiverPartId);
    if (
      receiver?.catalogPartId !== expected.receiverCatalogPartId ||
      receiver.colorId !== expected.receiverColorId ||
      receiverIds.has(receiverPartId)
    ) {
      throw new TypeError(
        `Step-45 occurrence ${expected.occurrenceOrdinal} receiver ordinal ${expected.receiverOrdinal} has the wrong identity, color, or duplicate part id.`,
      );
    }
    receiverIds.add(receiverPartId);
    const matches = enumeration.candidates
      .map((candidate, candidateRosterIndex) => ({ candidate, candidateRosterIndex }))
      .filter(({ candidate }) => exactPair(candidate, receiverPartId));
    if (matches.length !== 1) {
      throw new TypeError(
        `Step-45 occurrence ${expected.occurrenceOrdinal} requires exactly one accepted ${STEP45_AXLE_PORT} to ordinal-${expected.receiverOrdinal} ${STEP45_RECEIVER_PORT} candidate; found ${matches.length}.`,
      );
    }
    const { candidate, candidateRosterIndex } = matches[0]!;
    const transformKey = `${candidate.transform.positionLdu.join(",")}|${candidate.transform.orientationId}`;
    if (selectedTransformKeys.has(transformKey)) {
      throw new TypeError("Step-45 relational rows resolved to a duplicate placement transform.");
    }
    selectedTransformKeys.add(transformKey);
    const sourceToResolvedTransform = composeRigidTransforms(
      candidate.transform,
      inverseRealBuildPrefix50Step45Transform(repair.repairedSourceWorldTransform),
    );
    const expectedReceiverTransform = composeRigidTransforms(
      sourceToResolvedTransform,
      repair.expectedReceiverSourceWorldTransform,
    );
    if (!sameTransform(expectedReceiverTransform, receiver.transform)) {
      throw new TypeError(
        `Step-45 occurrence ${expected.occurrenceOrdinal} live receiver ordinal ${expected.receiverOrdinal} drifted from its exact source-to-resolved transform.`,
      );
    }
    if (
      coherentTransform !== undefined &&
      !sameTransform(coherentTransform, sourceToResolvedTransform)
    ) {
      throw new TypeError(
        `Step-45 occurrence ${expected.occurrenceOrdinal} does not share one rigid source-to-resolved relation with the other two rows.`,
      );
    }
    coherentTransform ??= sourceToResolvedTransform;
    const normalizedCandidate = roster[candidateRosterIndex]!;
    rows.push(
      deepFreeze({
        occurrenceOrdinal: expected.occurrenceOrdinal,
        receiverOrdinal: expected.receiverOrdinal,
        receiverPartId,
        receiverCatalogPartId: receiver.catalogPartId,
        receiverTransform: receiver.transform,
        candidatePortId: STEP45_AXLE_PORT,
        receiverPortId: STEP45_RECEIVER_PORT,
        connectionKind: "stud-tube" as const,
        candidateRosterIndex,
        enumeratedTransform: candidate.transform,
        connections: normalizedCandidate.connections,
        sourceToResolvedTransform,
        connectionWitnessCommitment: canonicalDigest(normalizedCandidate.connections),
        candidateCommitment: canonicalDigest(normalizedCandidate),
      }),
    );
    selected.push({ occurrenceOrdinal: expected.occurrenceOrdinal, candidate });
  }
  if (rows.length !== 3 || receiverIds.size !== 3 || selectedTransformKeys.size !== 3) {
    throw new TypeError("Step-45 relational resolution did not retain three distinct exact pairs.");
  }
  const combinedValidation = prospectiveValidation(document, selected);
  const candidateRosterCommitment = canonicalDigest(roster);
  const enumerationBody = deepFreeze({
    schemaVersion: enumeration.schemaVersion,
    orientationIds: [...enumeration.orientationIds],
    connectorSeedReceipt: enumeration.connectorSeedReceipt,
    counts: enumeration.counts,
    work: observedWork,
    candidateRosterCommitment,
  });
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step45-relational-resolution/1" as const,
    authority: "none" as const,
    selectionAuthority: false as const,
    placementAuthority: false as const,
    completionAuthority: false as const,
    sourceSetId: "6651557" as const,
    printedStepNumber: 45 as const,
    selectedStep44EvidenceCommitment: input.selectedStep44EvidenceCommitment,
    selectedStep44DocumentHash: beforeHash,
    selectedStep44DocumentCommitment: beforeCommitment,
    selectedStep44BuildStepCount: 44 as const,
    limits: {
      exactDocumentPartCount: STEP45_EXPECTED_DOCUMENT_PARTS,
      maxDocumentConnections: STEP45_MAX_DOCUMENT_CONNECTIONS,
      maxDistinctTransforms: STEP45_MAX_DISTINCT_TRANSFORMS,
      maxRecordedWorkPerCounter: STEP45_MAX_RECORDED_WORK,
      maxSeedReceiptRows: STEP45_MAX_SEED_RECEIPT_ROWS,
      maxCandidateConnections: STEP45_MAX_CANDIDATE_CONNECTIONS,
    },
    ordinalPartRowsCommitment: canonicalDigest(input.ordinalPartRows),
    sourceRepairsCommitment: canonicalDigest(input.sourceRepairs),
    query: {
      schemaVersion: "lego.real-build-prefix50-step45-relational-query/1" as const,
      catalogPartId: STEP45_AXLE,
      includeBuildPlate: false as const,
      allowDetached: false as const,
      maxDistinctTransforms: STEP45_MAX_DISTINCT_TRANSFORMS,
      orientationIdsOmitted: true as const,
      freshEnumeration: true as const,
      enumerationCallCount: 1 as const,
    },
    enumeration: {
      ...enumerationBody,
      enumerationCommitment: canonicalDigest(enumerationBody),
      complete: true as const,
      bounded: true as const,
    },
    rows,
    coherentSourceToResolvedTransform: coherentTransform!,
    coherentTransformCommitment: canonicalDigest(coherentTransform),
    combinedValidation,
  });
  const resolution = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  brandRealBuildPrefix50Step45RelationalResolution(resolution);
  return resolution;
}

export function resolveRealBuildPrefix50Step45RelationalPlacements(
  input: RealBuildPrefix50Step45RelationalResolverInput,
): RealBuildPrefix50Step45RelationalResolution {
  return resolveWithEnumerator(input, enumeratePlacements);
}

export function requireRealBuildPrefix50Step45RelationalResolution(
  value: unknown,
): RealBuildPrefix50Step45RelationalResolution {
  if (
    value === null ||
    typeof value !== "object" ||
    !SAFE_APPLY(SAFE_WEAK_SET_HAS, resolutions, [value])
  ) {
    throw new TypeError(
      "Step-45 relational use requires the exact runtime-branded authority-free resolution; caller clones carry no authority.",
    );
  }
  return value as RealBuildPrefix50Step45RelationalResolution;
}

export const __testOnly: Readonly<{
  resolveWithEnumerator?: typeof resolveWithEnumerator;
}> = deepFreeze(TEST_MODE ? { resolveWithEnumerator } : {});
