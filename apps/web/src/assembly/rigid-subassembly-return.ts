import { PROPER_ORIENTATIONS, getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import {
  canonicalSha256,
  composeRigidTransforms,
  deepFreeze,
  documentStructuralHash,
  applyBuildOperations,
  rotateLduVector,
  validBrickConnections,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BuildOperation, PartInstance, RigidTransform } from "@lego-studio/protocol";

import { occupiedConnectorCapacityClaims, reserveConnectorCapacity } from "../connector-capacity";
import { connectorAxesAlign } from "../connector-frame-alignment";
import { GROUND_UNDERSIDE_LDU, bodyBoundsLdu } from "../placement";
import { requireRigidSubassemblyReturnBaseWorld } from "./rigid-subassembly-return-base";
import {
  RIGID_SUBASSEMBLY_RETURN_ENUMERATION_VERSION,
  compareDeltas,
  compareStrings,
  crossEdgesFor,
  crossMatches,
  deltaKey,
  fail,
  freePorts,
  incompleteValidation,
  indexPortsByPosition,
  isConnected,
  requireWithinLimit,
  requireWorkLimits,
  safeProduct,
  type RigidSubassemblyReturnCandidate,
  type RigidSubassemblyReturnCounts,
  type RigidSubassemblyReturnEnumeration,
  type RigidSubassemblyReturnInput,
} from "./rigid-subassembly-return-support";

export {
  RIGID_SUBASSEMBLY_RETURN_ENUMERATION_VERSION,
  RigidSubassemblyReturnError,
} from "./rigid-subassembly-return-support";
export type {
  RigidSubassemblyReturnCandidate,
  RigidSubassemblyReturnCounts,
  RigidSubassemblyReturnEnumeration,
  RigidSubassemblyReturnErrorCode,
  RigidSubassemblyReturnInput,
  RigidSubassemblyReturnWorkLimits,
} from "./rigid-subassembly-return-support";

/**
 * Enumerates every hard-valid rigid return of one disconnected child component.
 * The result is diagnostic domain data only: it contains no patch, acceptance,
 * capability, or source-classifier authority.
 */
export function enumerateRigidSubassemblyReturns(
  unsafeInput: RigidSubassemblyReturnInput,
): RigidSubassemblyReturnEnumeration {
  let input: RigidSubassemblyReturnInput;
  try {
    input = structuredClone(unsafeInput);
  } catch {
    fail(
      "INPUT_NOT_DETACHABLE",
      "Rigid-subassembly return input must be detached structured-cloneable data.",
    );
  }
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    !Array.isArray(input.childPartIds)
  ) {
    fail(
      "INPUT_SHAPE_INVALID",
      "Rigid-subassembly return input must contain a document, childPartIds array, and workLimits.",
    );
  }
  const limits = requireWorkLimits(input.workLimits);
  requireWithinLimit(
    input.document?.parts?.length ?? Number.MAX_SAFE_INTEGER,
    limits.maxDocumentParts,
    "Input document parts",
  );
  requireWithinLimit(
    input.document?.connections?.length ?? Number.MAX_SAFE_INTEGER,
    limits.maxDocumentConnections,
    "Input document connections",
  );

  const baseReport = validateBrickDocument(input.document);
  if (baseReport.issues.some(({ code }) => code === "DOCUMENT_SCHEMA_INVALID")) {
    fail(
      "DOCUMENT_SCHEMA_INVALID",
      "Rigid-subassembly return requires a schema-valid draft BrickDocument.",
    );
  }
  if (incompleteValidation(baseReport)) {
    fail(
      "BASE_VALIDATION_INCOMPLETE",
      "Base hard validation exceeded its issue budget; no return enumeration was attempted.",
    );
  }
  if (input.childPartIds.length === 0) {
    fail("CHILD_ID_INVALID", "Rigid-subassembly return requires at least one exact child part ID.");
  }
  const childIds = [...input.childPartIds];
  for (const id of childIds) {
    if (typeof id !== "string" || id.length === 0) {
      fail(
        "CHILD_ID_INVALID",
        "Every rigid-subassembly child part ID must be a nonempty exact string.",
      );
    }
  }
  if (new Set(childIds).size !== childIds.length) {
    fail("CHILD_ID_DUPLICATE", "Rigid-subassembly child part IDs must be exact and unique.");
  }
  childIds.sort(compareStrings);
  const partById = new Map(input.document.parts.map((part) => [part.id, part] as const));
  for (const id of childIds) {
    if (!partById.has(id))
      fail("CHILD_PART_MISSING", `Rigid-subassembly child part ${id} is absent from the document.`);
  }
  const childSet = new Set(childIds);
  const childParts = childIds.map((id) => partById.get(id)!);
  const parentParts = input.document.parts
    .filter(({ id }) => !childSet.has(id))
    .sort((left, right) => compareStrings(left.id, right.id));
  if (parentParts.length === 0)
    fail("PARENT_EMPTY", "Rigid-subassembly return requires a nonempty parent assembly.");

  const validConnections = validBrickConnections(input.document);
  if (validConnections.length !== input.document.connections.length) {
    fail(
      "INTERNAL_CONNECTION_INVALID",
      "Every existing child and parent edge must pass exact connection and capacity validation.",
    );
  }
  for (const edge of input.document.connections) {
    if (childSet.has(edge.a.partId) !== childSet.has(edge.b.partId)) {
      fail(
        "PREEXISTING_CROSS_EDGE",
        `Existing connection ${edge.id} already crosses the parent/child boundary.`,
      );
    }
  }
  if (!isConnected(childIds, validConnections))
    fail("CHILD_DISCONNECTED", "The exact child part-ID set is not internally connected.");
  const parentIds = parentParts.map(({ id }) => id);
  if (!isConnected(parentIds, validConnections))
    fail("PARENT_DISCONNECTED", "The parent complement is not internally connected.");
  requireRigidSubassemblyReturnBaseWorld(input.document, baseReport, childSet);
  const sourceDocumentHash = documentStructuralHash(input.document);

  const occupied = occupiedConnectorCapacityClaims(input.document.parts, validConnections);
  const parentPorts = freePorts(parentParts, occupied);
  const childPorts = freePorts(childParts, occupied);
  if (PROPER_ORIENTATIONS.length !== 24) {
    fail(
      "ORIENTATION_SET_INVALID",
      `Rigid-subassembly return requires exactly 24 proper rigid orientations; received ${PROPER_ORIENTATIONS.length}.`,
    );
  }
  const properGroupOrientationCount = PROPER_ORIENTATIONS.length as 24;
  const pairingChecks = safeProduct(
    "Parent/child connector pairing checks",
    properGroupOrientationCount,
    parentPorts.length,
    childPorts.length,
  );
  requireWithinLimit(
    pairingChecks,
    limits.maxConnectorPairingChecks,
    "Parent/child connector pairing checks",
  );

  let axisCompatiblePairingSeeds = 0;
  let rejectedNonIntegralDeltaSeeds = 0;
  let duplicateDeltaSeeds = 0;
  const deltaByKey = new Map<string, RigidTransform>();
  for (const orientation of PROPER_ORIENTATIONS) {
    for (const parent of parentPorts) {
      for (const child of childPorts) {
        const rotatedNormal = rotateLduVector(orientation.matrix, child.normal);
        if (
          !connectorAxesAlign(
            { kind: parent.connector.kind, normal: parent.normal },
            { kind: child.connector.kind, normal: rotatedNormal },
          )
        ) {
          continue;
        }
        axisCompatiblePairingSeeds += 1;
        const rotatedPosition = rotateLduVector(orientation.matrix, child.positionLdu);
        const positionLdu: LduVector3 = [
          parent.positionLdu[0] - rotatedPosition[0],
          parent.positionLdu[1] - rotatedPosition[1],
          parent.positionLdu[2] - rotatedPosition[2],
        ];
        if (!positionLdu.every(Number.isSafeInteger)) {
          rejectedNonIntegralDeltaSeeds += 1;
          continue;
        }
        const delta: RigidTransform = { positionLdu, orientationId: orientation.id };
        const key = deltaKey(delta);
        if (deltaByKey.has(key)) duplicateDeltaSeeds += 1;
        else {
          requireWithinLimit(
            deltaByKey.size + 1,
            limits.maxDistinctGroupDeltas,
            "Distinct rigid group deltas",
          );
          deltaByKey.set(key, delta);
        }
      }
    }
  }
  const deltas = [...deltaByKey.values()].sort(compareDeltas);
  requireWithinLimit(deltas.length, limits.maxCandidateDocuments, "Candidate document validations");
  requireWithinLimit(
    safeProduct("Transformed child-part computations", deltas.length, childParts.length),
    limits.maxTransformedChildParts,
    "Transformed child-part computations",
  );
  requireWithinLimit(
    safeProduct("Cross-connection checks", deltas.length, parentPorts.length, childPorts.length),
    limits.maxCrossConnectionChecks,
    "Cross-connection checks",
  );

  const mutable = {
    groupDeltasVisited: 0,
    transformedChildPartComputations: 0,
    crossConnectionChecks: 0,
    exactCrossEdgesDiscovered: 0,
    candidateValidationRuns: 0,
    rejectedTransformPolicy: 0,
    rejectedIllegalPartOrientation: 0,
    rejectedBelowGround: 0,
    rejectedNoCrossEdge: 0,
    rejectedConnectorCapacityConflict: 0,
    rejectedCollision: 0,
    rejectedDisconnected: 0,
    rejectedOtherBlockingValidation: 0,
  };
  const candidates: RigidSubassemblyReturnCandidate[] = [];
  const existingConnectionIds = new Set(input.document.connections.map(({ id }) => id));
  const parentPortsByPosition = indexPortsByPosition(parentPorts);
  for (const groupDelta of deltas) {
    mutable.groupDeltasVisited += 1;
    const transformedChildParts: PartInstance[] = [];
    let transformFailed = false;
    for (const part of childParts) {
      mutable.transformedChildPartComputations += 1;
      try {
        transformedChildParts.push({
          ...part,
          transform: composeRigidTransforms(groupDelta, part.transform),
        });
      } catch {
        transformFailed = true;
        break;
      }
    }
    if (transformFailed || transformedChildParts.length !== childParts.length) {
      mutable.rejectedTransformPolicy += 1;
      continue;
    }
    if (
      transformedChildParts.some(
        (part) =>
          !getPartDefinition(part.catalogPartId)!.legalOrientationIds.includes(
            part.transform.orientationId,
          ),
      )
    ) {
      mutable.rejectedIllegalPartOrientation += 1;
      continue;
    }
    if (transformedChildParts.some((part) => bodyBoundsLdu(part).max[1] > GROUND_UNDERSIDE_LDU)) {
      mutable.rejectedBelowGround += 1;
      continue;
    }

    const transformedChildById = new Map(
      transformedChildParts.map((part) => [part.id, part] as const),
    );
    mutable.crossConnectionChecks += parentPorts.length * childPorts.length;
    const matches = crossMatches(parentPortsByPosition, childPorts, transformedChildById);
    mutable.exactCrossEdgesDiscovered += matches.length;
    if (matches.length === 0) {
      mutable.rejectedNoCrossEdge += 1;
      continue;
    }
    requireWithinLimit(
      matches.length,
      limits.maxCrossEdgesPerCandidate,
      "Exact cross edges for one candidate",
    );
    requireWithinLimit(
      input.document.connections.length + matches.length,
      limits.maxDocumentConnections,
      "Candidate document connections",
    );
    const proposedClaims = new Set(occupied);
    let capacityConflict = false;
    for (const { parent, child } of matches) {
      if (!reserveConnectorCapacity([parent.capacity, child.capacity], proposedClaims)) {
        capacityConflict = true;
        break;
      }
    }
    if (capacityConflict) {
      mutable.rejectedConnectorCapacityConflict += 1;
      continue;
    }

    const crossEdges = crossEdgesFor(
      matches,
      existingConnectionIds,
      `rigid-return:${canonicalSha256({ sourceDocumentHash, groupDelta })}`,
    );
    const operations: BuildOperation[] = [
      ...childParts.map((part): BuildOperation => ({
        kind: "updatePart",
        operationId: `rigid-return-update-${canonicalSha256({
          sourceDocumentHash,
          groupDelta,
          partId: part.id,
        }).slice(0, 24)}`,
        before: part,
        after: transformedChildById.get(part.id)!,
      })),
      ...crossEdges.map((connection): BuildOperation => ({
        kind: "addConnection",
        operationId: `rigid-return-connect-${canonicalSha256({
          sourceDocumentHash,
          groupDelta,
          connectionId: connection.id,
        }).slice(0, 24)}`,
        connection,
      })),
    ];
    const candidateDocument = applyBuildOperations(input.document, operations);
    mutable.candidateValidationRuns += 1;
    const report = validateBrickDocument(candidateDocument);
    if (incompleteValidation(report)) {
      fail(
        "CANDIDATE_VALIDATION_INCOMPLETE",
        "Candidate hard validation exceeded its issue budget; enumeration is incomplete.",
      );
    }
    const blocking = report.issues.filter(({ severity }) => severity === "blocking");
    if (blocking.length > 0) {
      if (blocking.some(({ code }) => code.includes("COLLISION"))) mutable.rejectedCollision += 1;
      else if (blocking.some(({ code }) => code === "DISCONNECTED_ASSEMBLY"))
        mutable.rejectedDisconnected += 1;
      else if (blocking.some(({ code }) => code === "PORT_CAPACITY_EXCEEDED")) {
        mutable.rejectedConnectorCapacityConflict += 1;
      } else mutable.rejectedOtherBlockingValidation += 1;
      continue;
    }
    if (
      !report.documentGloballyValid ||
      report.targetDocumentHash !== documentStructuralHash(candidateDocument)
    ) {
      mutable.rejectedOtherBlockingValidation += 1;
      continue;
    }
    candidates.push({
      candidateKey: canonicalSha256({
        groupDelta,
        transformedChildParts,
        crossEdges,
        operations,
        documentHash: report.targetDocumentHash,
      }),
      groupDelta,
      transformedChildParts,
      crossEdges,
      operations,
      validationReport: report,
      hardValidDocument: candidateDocument,
    });
  }

  const counts: RigidSubassemblyReturnCounts = {
    properGroupOrientations: properGroupOrientationCount,
    parentParts: parentParts.length,
    childParts: childParts.length,
    existingInternalEdges: input.document.connections.length,
    freeParentConnectors: parentPorts.length,
    freeChildConnectors: childPorts.length,
    connectorPairingChecks: pairingChecks,
    axisCompatiblePairingSeeds,
    rejectedNonIntegralDeltaSeeds,
    duplicateDeltaSeeds,
    distinctGroupDeltas: deltas.length,
    ...mutable,
    accepted: candidates.length,
  };
  return deepFreeze({
    schemaVersion: RIGID_SUBASSEMBLY_RETURN_ENUMERATION_VERSION,
    sourceDocumentHash,
    childPartIds: childIds,
    workLimits: limits,
    counts,
    candidates,
  });
}
