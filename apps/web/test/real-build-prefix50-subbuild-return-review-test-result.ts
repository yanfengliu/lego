import {
  applyBuildOperations,
  canonicalDigest,
  canonicalSha256,
  composeRigidTransforms,
  createEmptyBrickDocument,
  createPartInstance,
  deepFreeze,
  documentStructuralHash,
  getConnectorWorldFrame,
  rotateLduVector,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { getPartDefinition, PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import type {
  BrickDocumentV1,
  BuildOperation,
  ConnectionEdge,
  PartInstance,
  RigidTransform,
} from "@lego-studio/protocol";

import {
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
  type RealBuildPrefix50SubBuildReturnResult,
} from "../e2e/real-build-prefix50-subbuild-return-contract";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const CHILD_SOURCE_XZ_LDU = 1_000;
const PLATFORM_POSITION_LDU = [70, -2_040, 150] as const;
const CHILD_FIRST_POSITION_LDU = [CHILD_SOURCE_XZ_LDU, -2_048, CHILD_SOURCE_XZ_LDU] as const;

function asymmetricParentCatalog(index: number): {
  readonly catalogPartId: string;
  readonly orientationId: string;
} {
  if (index % 13 === 0)
    return {
      catalogPartId: "builtin:plate-2x4",
      orientationId: index % 26 === 0 ? "upright-yaw-0" : "upright-yaw-90",
    };
  if (index % 17 === 0)
    return {
      catalogPartId: "builtin:plate-1x4",
      orientationId: index % 34 === 0 ? "upright-yaw-270" : "upright-yaw-180",
    };
  return { catalogPartId: "builtin:plate-1x1", orientationId: "upright-yaw-0" };
}

function alignedBelow(
  previous: PartInstance,
  index: number,
  catalogPartId: string,
  orientationId: string,
): PartInstance {
  const draft = createPartInstance({
    id: `part-${(index + 1).toString().padStart(3, "0")}`,
    catalogPartId,
    transform: { positionLdu: [0, 0, 0], orientationId },
    stepId: "step-1",
  });
  const target = getConnectorWorldFrame(previous, "stud:0:0").positionLdu;
  const source = getConnectorWorldFrame(draft, "undersideClutch:0:0").positionLdu;
  return {
    ...draft,
    transform: {
      ...draft.transform,
      positionLdu: [target[0] - source[0], target[1] - source[1], target[2] - source[2]],
    },
  };
}

function sourceDocument(asymmetricParent = false): BrickDocumentV1 {
  const base = createEmptyBrickDocument({
    id: "step44-review-test-document",
    name: "Synthetic Step 44 detached review source",
    maxParts: 500,
  });
  const steps = Array.from({ length: 43 }, (_, index) => ({
    id: `step-${index + 1}`,
    index,
    name: `Printed step ${index + 1}`,
    partIds: [] as string[],
  }));
  const parts: PartInstance[] = [];
  for (let index = 0; index < 280; index += 1) {
    const isPlatform = index === 256;
    const isChild = index >= 257;
    if (asymmetricParent && index < 257) {
      const selected = isPlatform
        ? { catalogPartId: "builtin:plate-8x16", orientationId: "upright-yaw-0" }
        : asymmetricParentCatalog(index);
      parts.push(
        index === 0
          ? createPartInstance({
              id: "part-001",
              catalogPartId: selected.catalogPartId,
              transform: {
                positionLdu: [0, 8, 0],
                orientationId: selected.orientationId,
              },
              stepId: steps[0]!.id,
            })
          : alignedBelow(parts[index - 1]!, index, selected.catalogPartId, selected.orientationId),
      );
      continue;
    }
    parts.push(
      createPartInstance({
        id: `part-${(index + 1).toString().padStart(3, "0")}`,
        catalogPartId: isPlatform ? "builtin:plate-8x16" : "builtin:plate-1x1",
        transform: {
          positionLdu: isPlatform
            ? PLATFORM_POSITION_LDU
            : isChild
              ? [
                  CHILD_FIRST_POSITION_LDU[0],
                  CHILD_FIRST_POSITION_LDU[1] - (index - 257) * 8,
                  CHILD_FIRST_POSITION_LDU[2],
                ]
              : [0, 8 - index * 8, 0],
          orientationId: "upright-yaw-0",
        },
        stepId: steps[0]!.id,
      }),
    );
  }
  steps[0]!.partIds.push(...parts.map(({ id }) => id));
  const connections: ConnectionEdge[] = [];
  for (let index = 0; index < 255; index += 1) {
    connections.push({
      id: `edge-${index.toString().padStart(3, "0")}`,
      kind: "stud-tube",
      a: { partId: parts[index]!.id, portId: "stud:0:0" },
      b: { partId: parts[index + 1]!.id, portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    });
  }
  connections.push({
    id: "edge-255",
    kind: "stud-tube",
    a: { partId: "part-256", portId: "stud:0:0" },
    b: { partId: "part-257", portId: "undersideClutch:0:0" },
    provenance: { source: "manual" },
  });
  for (let index = 257; index < parts.length - 1; index += 1)
    connections.push({
      id: `edge-${index.toString().padStart(3, "0")}`,
      kind: "stud-tube",
      a: { partId: parts[index]!.id, portId: "stud:0:0" },
      b: { partId: parts[index + 1]!.id, portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    });
  return deepFreeze({
    ...base,
    parts,
    connections,
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps,
  });
}

function exactCrossConnection(
  sourceDocumentHash: string,
  groupDelta: RigidTransform,
  parentPortId: string,
): ConnectionEdge {
  const connection = {
    id: `rigid-return-${canonicalSha256({
      parentPartId: "part-257",
      parentPortId,
      childPartId: "part-258",
      childPortId: "undersideClutch:0:0",
    }).slice(0, 24)}`,
    kind: "stud-tube" as const,
    a: { partId: "part-257", portId: parentPortId },
    b: { partId: "part-258", portId: "undersideClutch:0:0" },
    provenance: {
      source: "ai" as const,
      sourceId: `rigid-return:${canonicalSha256({ sourceDocumentHash, groupDelta })}`,
    },
  };
  return connection;
}

function candidateDeltas(base: BrickDocumentV1): readonly {
  groupDelta: RigidTransform;
  parentPortId: string;
}[] {
  const platform = base.parts[256]!;
  const firstChild = base.parts[257]!;
  const definition = getPartDefinition(platform.catalogPartId)!;
  const sourceFrame = getConnectorWorldFrame(firstChild, "undersideClutch:0:0");
  const uprightOrientations = PROPER_ORIENTATIONS.filter(
    ({ matrix }) => rotateLduVector(matrix, [0, 1, 0]).join(",") === "0,1,0",
  );
  return uprightOrientations.flatMap((orientation) =>
    definition.connectors
      .filter(({ kind }) => kind === "stud")
      .map(({ id }) => {
        const target = getConnectorWorldFrame(platform, id).positionLdu;
        const rotatedSource = rotateLduVector(orientation.matrix, sourceFrame.positionLdu);
        return {
          groupDelta: {
            positionLdu: [
              target[0] - rotatedSource[0],
              target[1] - rotatedSource[1],
              target[2] - rotatedSource[2],
            ],
            orientationId: orientation.id,
          },
          parentPortId: id,
        };
      }),
  );
}

function operationsFor(
  base: BrickDocumentV1,
  sourceDocumentHash: string,
  groupDelta: RigidTransform,
  parentPortId: string,
): readonly BuildOperation[] {
  const childParts = base.parts.slice(-23);
  const connection = exactCrossConnection(sourceDocumentHash, groupDelta, parentPortId);
  return [
    ...childParts.map((before): BuildOperation => ({
      kind: "updatePart",
      operationId: `rigid-return-update-${canonicalSha256({
        sourceDocumentHash,
        groupDelta,
        partId: before.id,
      }).slice(0, 24)}`,
      before,
      after: {
        ...before,
        transform: composeRigidTransforms(groupDelta, before.transform),
      },
    })),
    {
      kind: "addConnection",
      operationId: `rigid-return-connect-${canonicalSha256({
        sourceDocumentHash,
        groupDelta,
        connectionId: connection.id,
      }).slice(0, 24)}`,
      connection,
    },
  ];
}

function transformedParts(operations: readonly BuildOperation[]): readonly PartInstance[] {
  return operations.flatMap((operation) =>
    operation.kind === "updatePart" ? [operation.after] : [],
  );
}

const cache = new Map<string, RealBuildPrefix50SubBuildReturnResult>();

function createTestResult(
  candidateCount: number,
  asymmetricParent: boolean,
): RealBuildPrefix50SubBuildReturnResult {
  if (!Number.isSafeInteger(candidateCount) || candidateCount < 1 || candidateCount > 211)
    throw new RangeError(
      "Step-44 review test candidate count must be an integer from 1 through 211.",
    );
  const cacheKey = `${candidateCount}:${asymmetricParent ? "asymmetric" : "canonical"}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const source = sourceDocument(asymmetricParent);
  const sourceDocumentHash = documentStructuralHash(source);
  const plans = candidateDeltas(source);
  if (plans.length < candidateCount)
    throw new Error(`Synthetic Step-44 review source produced only ${plans.length} replay plans.`);
  const candidates = plans.slice(0, candidateCount).map(({ groupDelta, parentPortId }) => {
    const operations = operationsFor(source, sourceDocumentHash, groupDelta, parentPortId);
    const hardValidDocument = applyBuildOperations(source, operations);
    const validationReport = validateBrickDocument(hardValidDocument);
    if (!validationReport.documentGloballyValid)
      throw new Error(
        `Synthetic Step-44 review candidate is invalid: ${JSON.stringify(validationReport.issues)}.`,
      );
    const crossEdges = operations.flatMap((operation) =>
      operation.kind === "addConnection" ? [operation.connection] : [],
    );
    const childParts = transformedParts(operations);
    const candidateKey = canonicalSha256({
      groupDelta,
      transformedChildParts: childParts,
      crossEdges,
      operations,
      documentHash: validationReport.targetDocumentHash,
    });
    return {
      candidateKey,
      groupDelta,
      transformedChildParts: childParts,
      crossEdges,
      operations,
      validationReport,
      hardValidDocument,
    };
  });
  const roster = candidates.map(({ candidateKey, groupDelta: delta, crossEdges }) => ({
    candidateKey,
    groupDelta: delta,
    crossPorts: crossEdges.map(({ a, b }) => ({
      aPartId: a.partId,
      aPortId: a.portId,
      bPartId: b.partId,
      bPortId: b.portId,
    })),
  }));
  const enumeration = {
    schemaVersion: "lego.rigid-subassembly-return-enumeration/1" as const,
    sourceDocumentHash,
    childPartIds: source.parts.slice(-23).map(({ id }) => id),
    workLimits: REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
    counts: {
      properGroupOrientations: 24 as const,
      parentParts: 257,
      childParts: 23,
      existingInternalEdges: 278,
      freeParentConnectors: 256,
      freeChildConnectors: 2,
      connectorPairingChecks: 24 * 256 * 2,
      axisCompatiblePairingSeeds: candidateCount,
      rejectedNonIntegralDeltaSeeds: 0,
      duplicateDeltaSeeds: 0,
      distinctGroupDeltas: candidateCount,
      groupDeltasVisited: candidateCount,
      transformedChildPartComputations: 23 * candidateCount,
      crossConnectionChecks: candidateCount * 256 * 2,
      exactCrossEdgesDiscovered: candidateCount,
      candidateValidationRuns: candidateCount,
      rejectedTransformPolicy: 0,
      rejectedIllegalPartOrientation: 0,
      rejectedBelowGround: 0,
      rejectedNoCrossEdge: 0,
      rejectedConnectorCapacityConflict: 0,
      rejectedCollision: 0,
      rejectedDisconnected: 0,
      rejectedOtherBlockingValidation: 0,
      accepted: candidateCount,
    },
    candidates,
  };
  const body = {
    schemaVersion: "lego.real-build-prefix50-subbuild-return/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    completedPrintedStep: 43 as const,
    returnPrintedStepNumber: 44 as const,
    projectionCommitment: digest("2"),
    childSubBuildWindowCommitment: digest("3"),
    sourceMemberRowsCommitment: digest("4"),
    detachedStateCommitment: digest("5"),
    step42_43RepairCommitment: digest("7"),
    step43PredecessorCommitment: digest("8"),
    sourceDocumentHash,
    parentPartCount: 257 as const,
    childPartCount: 23 as const,
    workLimits: REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
    enumeration,
    candidateRoster: roster,
    candidateRosterCommitment: canonicalDigest(roster),
  };
  const result = deepFreeze({ ...body, commitment: canonicalDigest(body) });
  cache.set(cacheKey, result);
  return result;
}

export function createStep44ReviewTestResult(
  candidateCount = 1,
): RealBuildPrefix50SubBuildReturnResult {
  return createTestResult(candidateCount, false);
}

export function createStep44ReviewHeadlessSmokeTestResult(): RealBuildPrefix50SubBuildReturnResult {
  return createTestResult(211, true);
}
