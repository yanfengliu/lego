import {
  canonicalBrickDocument,
  canonicalDigest,
  composeRigidTransforms,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
} from "@lego-studio/brick-kernel";
import type {
  AddPartOperation,
  BrickDocumentV1,
  PlacePartInstruction,
  RigidTransform,
} from "@lego-studio/protocol";

import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  REAL_BUILD_PREFIX50_LAST_STEP,
  REAL_BUILD_PREFIX50_OCCURRENCE_COUNT,
  readRealBuildPrefix50Occurrence30ActionBinding,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Occurrence30SourceRepairEvidence } from "./real-build-prefix50-occurrence30-source-repair";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";
import {
  type RealBuildPrefix50BoundOccurrence30SourceRepair,
  type RealBuildPrefix50BoundPlacementRepair,
  type RealBuildPrefix50Occurrence30SourceRepairProposal,
  type RealBuildPrefix50TargetOccurrence,
  type RealBuildPrefix50WorldGaugeSourceRepairProposal,
} from "./real-build-prefix50-exact-compiler-contract";
import { sameTransform } from "./real-build-prefix50-exact-compiler-foundation";

export function proposeRealBuildPrefix50Occurrence30SourceRepair(
  projection: RealBuildPrefix50VerifiedProjection,
  sourceEvidence: RealBuildPrefix50Occurrence30SourceRepairEvidence,
  actionBinding: ReturnType<typeof readRealBuildPrefix50Occurrence30ActionBinding>,
): RealBuildPrefix50Occurrence30SourceRepairProposal {
  requireRealBuildPrefix50VerifiedProjectionValue(projection);
  const occurrence = projection.occurrences[29];
  const identity = occurrence?.partIdentity;
  if (
    projection.sourceSetId !== "6651557" ||
    occurrence?.ordinal !== 30 ||
    occurrence.printedStepNumber !== 14 ||
    occurrence.colorId !== "builtin:black" ||
    identity?.publishedCatalogPartId !== "builtin:corner-plate-3x3" ||
    identity.reconciledCatalogPartId !== "builtin:corner-plate-3x3" ||
    identity.officialDesignId !== "77844" ||
    identity.officialDesignRevision !== "77844;B" ||
    identity.sourceLDrawPartId !== "77844" ||
    identity.catalogLDrawPartId !== "77844" ||
    identity.identityProofId !== null ||
    identity.basis !== "published-exact" ||
    !sameTransform(occurrence.sourceWorldTransform, {
      positionLdu: [30, -4, -364],
      orientationId: "upright-yaw-0",
    }) ||
    actionBinding.occurrenceOrdinal !== 30 ||
    actionBinding.printedStepNumber !== 14 ||
    actionBinding.phaseSequence !== 18 ||
    actionBinding.actionKind !== "direct" ||
    actionBinding.calloutIdentity !== "p18|q1|x29.480|y468.911" ||
    actionBinding.builderBrickRef !== sourceEvidence.brickRef ||
    actionBinding.officialDesignId !== "77844" ||
    actionBinding.designRevision !== sourceEvidence.designRevision ||
    sourceEvidence.occurrenceOrdinal !== 30 ||
    sourceEvidence.printedStepNumber !== 14 ||
    sourceEvidence.catalogPartId !== "builtin:corner-plate-3x3" ||
    !sameTransform(sourceEvidence.repairedSourceWorldTransform, {
      positionLdu: [10, -4, -344],
      orientationId: "upright-yaw-0",
    })
  ) {
    throw new TypeError(
      "Occurrence-30 repair drifted from the opaque step-14 direct action binding, exact 77844;B identity, retained official-world counterevidence, or verified Builder source proof.",
    );
  }
  const repairCommitment = occurrence30RepairCommitment(projection, actionBinding, sourceEvidence);
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair/1" as const,
    occurrenceOrdinal: 30 as const,
    expectedReceiverOrdinal: 31 as const,
    futureCollisionControlOrdinal: 147 as const,
    catalogPartId: "builtin:corner-plate-3x3" as const,
    sourceWorldTransform: occurrence.sourceWorldTransform,
    repairedSourceWorldTransform: sourceEvidence.repairedSourceWorldTransform,
    sourceResidualLdu: [-20, 0, 20] as const,
    sourceEvidence,
    repairCommitment,
    provisionalBasis: "opaque-builder-source-awaiting-complete-prefix-proof" as const,
  });
}

export function occurrence30RepairCommitment(
  projection: Pick<RealBuildPrefix50VerifiedProjection, "sourceSetId" | "occurrences">,
  actionBinding: ReturnType<typeof readRealBuildPrefix50Occurrence30ActionBinding>,
  sourceEvidence: RealBuildPrefix50Occurrence30SourceRepairEvidence,
): `sha256:${string}` {
  const occurrence = projection.occurrences[29];
  if (occurrence === undefined || occurrence.ordinal !== 30) {
    throw new TypeError("Occurrence-30 repair commitment requires ordinal 30 at index 29.");
  }
  return canonicalDigest(
    deepFreeze({
      schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-commitment/1" as const,
      sourceSetId: projection.sourceSetId,
      occurrence: {
        ordinal: occurrence.ordinal,
        printedStepNumber: occurrence.printedStepNumber,
        colorId: occurrence.colorId,
        partIdentity: occurrence.partIdentity,
        retainedSourceWorldTransform: occurrence.sourceWorldTransform,
      },
      actionBinding,
      sourceEvidence,
      repairedSourceWorldTransform: sourceEvidence.repairedSourceWorldTransform,
      sourceResidualLdu: [-20, 0, 20] as const,
    }),
  );
}

export function snapshot(document: BrickDocumentV1) {
  return createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });
}

export function verifyStepResult(
  before: BrickDocumentV1,
  after: BrickDocumentV1,
  targets: readonly RealBuildPrefix50TargetOccurrence[],
  placementOrdinals: readonly number[],
  placements: readonly PlacePartInstruction[],
  compiledParts: readonly AddPartOperation[],
  printedStepNumber: number,
): readonly (readonly [occurrenceOrdinal: number, partId: string])[] {
  const added = after.parts.filter(({ id }) => !before.parts.some((part) => part.id === id));
  const addedById = new Map(added.map((part) => [part.id, part] as const));
  const targetByOrdinal = new Map(targets.map((target) => [target.ordinal, target] as const));
  const assignments: (readonly [number, string])[] = [];
  for (const [index, ordinal] of placementOrdinals.entries()) {
    const target = targetByOrdinal.get(ordinal);
    const placement = placements[index];
    const compiledPart = compiledParts[index]?.part;
    const part = compiledPart === undefined ? undefined : addedById.get(compiledPart.id);
    if (
      target === undefined ||
      placement === undefined ||
      compiledPart === undefined ||
      part === undefined ||
      placement.catalogPartId !== target.partIdentity.reconciledCatalogPartId ||
      placement.colorId !== target.colorId ||
      !sameTransform(placement.transform, target.targetTransform) ||
      compiledPart.catalogPartId !== placement.catalogPartId ||
      compiledPart.colorId !== placement.colorId ||
      !sameTransform(compiledPart.transform, placement.transform) ||
      canonicalDigest(part) !== canonicalDigest(compiledPart)
    ) {
      throw new TypeError(
        `Prefix-50 compiled step ${printedStepNumber} did not retain exact program lineage for enumerated target occurrence ${ordinal}.`,
      );
    }
    assignments.push([ordinal, part.id]);
    addedById.delete(part.id);
  }
  const step = after.steps[printedStepNumber - 1];
  if (
    added.length !== targets.length ||
    placements.length !== targets.length ||
    compiledParts.length !== targets.length ||
    placementOrdinals.length !== targets.length ||
    new Set(placementOrdinals).size !== targets.length ||
    targetByOrdinal.size !== targets.length ||
    addedById.size !== 0 ||
    step?.index !== printedStepNumber - 1 ||
    step.partIds.length !== targets.length ||
    step.partIds.some((partId) => !assignments.some(([, assigned]) => assigned === partId)) ||
    added.some(({ stepId }) => stepId !== step.id)
  ) {
    throw new TypeError(
      `Prefix-50 compiled step ${printedStepNumber} changed the exact occurrence or BuildStep boundary.`,
    );
  }
  return assignments;
}

export function requireUniqueExactPlacementRepairEdge(
  document: BrickDocumentV1,
  occurrenceOrdinal: number,
  candidatePartId: string,
  receiverPartId: string,
  expectedCandidatePortId: string,
  expectedReceiverPortId: string,
) {
  const edges = document.connections.filter((edge) => {
    const candidateIsA = edge.a.partId === candidatePartId;
    const candidateIsB = edge.b.partId === candidatePartId;
    return (
      edge.kind === "stud-tube" &&
      ((candidateIsA &&
        edge.a.portId === expectedCandidatePortId &&
        edge.b.partId === receiverPartId &&
        edge.b.portId === expectedReceiverPortId) ||
        (candidateIsB &&
          edge.b.portId === expectedCandidatePortId &&
          edge.a.partId === receiverPartId &&
          edge.a.portId === expectedReceiverPortId))
    );
  });
  if (edges.length !== 1) {
    throw new TypeError(
      `Prefix-50 source-placement repair ${occurrenceOrdinal} requires exactly one axle:2 to axleHole:0 compiled edge; found ${edges.length}.`,
    );
  }
  return edges[0]!;
}

export function bindPlacementRepairs(
  document: BrickDocumentV1,
  repairs: readonly RealBuildPrefix50SourcePlacementRepairProposal[],
  gauge: RigidTransform,
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
): readonly RealBuildPrefix50BoundPlacementRepair[] {
  return repairs.map((repair) => {
    const candidatePartId = partIdByOccurrenceOrdinal.get(repair.occurrenceOrdinal);
    const receiverPartId = partIdByOccurrenceOrdinal.get(repair.expectedReceiverOrdinal);
    if (candidatePartId === undefined || receiverPartId === undefined) {
      throw new TypeError(
        `Prefix-50 source-placement repair ${repair.occurrenceOrdinal} lost its compiled candidate or receiver occurrence.`,
      );
    }
    const candidate = document.parts.find(({ id }) => id === candidatePartId);
    const receiver = document.parts.find(({ id }) => id === receiverPartId);
    const repairedTargetTransform = deepFreeze(
      composeRigidTransforms(gauge, repair.repairedSourceWorldTransform),
    );
    if (
      candidate === undefined ||
      receiver?.catalogPartId !== repair.expectedReceiverCatalogPartId ||
      !sameTransform(candidate.transform, repairedTargetTransform)
    ) {
      throw new TypeError(
        `Prefix-50 source-placement repair ${repair.occurrenceOrdinal} did not retain its exact enumerated target and receiver identity.`,
      );
    }
    const edge = requireUniqueExactPlacementRepairEdge(
      document,
      repair.occurrenceOrdinal,
      candidatePartId,
      receiverPartId,
      repair.expectedCandidatePortId,
      repair.expectedReceiverPortId,
    );
    return deepFreeze({
      ...repair,
      basis: "unique-exact-catalog-connector-seat" as const,
      repairedTargetTransform,
      candidatePartId,
      receiverPartId,
      connectionId: edge.id,
    });
  });
}

const OCCURRENCE30_CONNECTION_PORTS = deepFreeze([
  ["stud:0", "undersideClutch:0:5"],
  ["stud:1", "undersideClutch:1:5"],
  ["stud:2", "undersideClutch:2:5"],
  ["stud:3", "undersideClutch:0:4"],
  ["stud:4", "undersideClutch:0:3"],
] as const);

export function bindOccurrence30SourceRepair(
  document: BrickDocumentV1,
  proposal: RealBuildPrefix50Occurrence30SourceRepairProposal,
  gauge: RigidTransform,
  projection: RealBuildPrefix50VerifiedProjection,
  projectionCommitment: `sha256:${string}`,
  placementOrdinals: readonly number[],
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
): RealBuildPrefix50BoundOccurrence30SourceRepair {
  const candidatePartId = partIdByOccurrenceOrdinal.get(proposal.occurrenceOrdinal);
  const receiverPartId = partIdByOccurrenceOrdinal.get(proposal.expectedReceiverOrdinal);
  const futureCollisionControlPartId = partIdByOccurrenceOrdinal.get(
    proposal.futureCollisionControlOrdinal,
  );
  const candidate = document.parts.find(({ id }) => id === candidatePartId);
  const receiver = document.parts.find(({ id }) => id === receiverPartId);
  const futureCollisionControl = document.parts.find(
    ({ id }) => id === futureCollisionControlPartId,
  );
  const repairedTargetTransform = deepFreeze(
    composeRigidTransforms(gauge, proposal.repairedSourceWorldTransform),
  );
  const receiverTargetTransform = composeRigidTransforms(
    gauge,
    projection.occurrences[proposal.expectedReceiverOrdinal - 1]!.sourceWorldTransform,
  );
  const futureTargetTransform = composeRigidTransforms(
    gauge,
    projection.occurrences[proposal.futureCollisionControlOrdinal - 1]!.sourceWorldTransform,
  );
  if (
    candidatePartId === undefined ||
    receiverPartId === undefined ||
    futureCollisionControlPartId === undefined ||
    candidate?.catalogPartId !== proposal.catalogPartId ||
    receiver?.catalogPartId !== "builtin:plate-4x6" ||
    futureCollisionControl?.catalogPartId !== "builtin:bracket-1x2-1x4-rounded-corners" ||
    !sameTransform(candidate.transform, repairedTargetTransform) ||
    !sameTransform(repairedTargetTransform, {
      positionLdu: [-550, 8, -150],
      orientationId: "upright-yaw-0",
    }) ||
    !sameTransform(receiver.transform, receiverTargetTransform) ||
    !sameTransform(futureCollisionControl.transform, futureTargetTransform)
  ) {
    throw new TypeError(
      "Occurrence-30 repair did not retain its exact enumerated pose, occurrence-31 receiver, or fixed occurrence-147 collision control.",
    );
  }
  const connectionIds = OCCURRENCE30_CONNECTION_PORTS.map(([candidatePortId, receiverPortId]) => {
    const matches = document.connections.filter(
      ({ kind, a, b }) =>
        kind === "stud-tube" &&
        ((a.partId === candidatePartId &&
          a.portId === candidatePortId &&
          b.partId === receiverPartId &&
          b.portId === receiverPortId) ||
          (b.partId === candidatePartId &&
            b.portId === candidatePortId &&
            a.partId === receiverPartId &&
            a.portId === receiverPortId)),
    );
    if (matches.length !== 1) {
      throw new TypeError(
        `Occurrence-30 repair requires exactly one ${candidatePortId} to occurrence-31 ${receiverPortId} edge; found ${matches.length}.`,
      );
    }
    return matches[0]!.id;
  }) as unknown as [string, string, string, string, string];
  if (new Set(connectionIds).size !== 5) {
    throw new TypeError("Occurrence-30 repair requires five distinct compiled connection edges.");
  }
  const finalCollisions = findCatalogCollisions(document.parts, document.connections);
  const futureControlCollisions = findCatalogCollisions([candidate, futureCollisionControl], []);
  const exactPlacementRoster = [...placementOrdinals]
    .sort((left, right) => left - right)
    .every((ordinal, index) => ordinal === index + 1);
  const finalDocumentHash = documentStructuralHash(document);
  if (
    finalCollisions.length !== 0 ||
    futureControlCollisions.length !== 0 ||
    projection.occurrences.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    placementOrdinals.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    new Set(placementOrdinals).size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    !exactPlacementRoster ||
    document.parts.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    document.steps.length !== REAL_BUILD_PREFIX50_LAST_STEP
  ) {
    throw new TypeError(
      `Occurrence-30 repair did not survive complete exact compilation with five seats and zero collisions; final/future-control collisions=${finalCollisions.length}/${futureControlCollisions.length}.`,
    );
  }
  const { provisionalBasis: _provisionalBasis, ...proven } = proposal;
  void _provisionalBasis;
  return deepFreeze({
    ...proven,
    schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair/2" as const,
    basis: "opaque-source-plus-complete-prefix50-exact-enumeration" as const,
    repairedTargetTransform,
    candidatePartId,
    receiverPartId,
    connectionIds,
    futureCollisionControlPartId,
    proof: {
      schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-final-proof/1" as const,
      projectionCommitment,
      completedPrintedStep: REAL_BUILD_PREFIX50_LAST_STEP,
      compiledPartCount: document.parts.length,
      occurrenceOrdinalRoster: "exact-unique-1-through-320" as const,
      exactEnumeratedPoseRetained: true as const,
      distinctCandidatePortCount: 5 as const,
      distinctReceiverPortCount: 5 as const,
      finalDocumentCollisionCount: 0 as const,
      occurrence30To147CollisionCount: 0 as const,
      finalDocumentHash,
    },
  });
}

export function targetsFor(
  projection: RealBuildPrefix50VerifiedProjection,
  gauge: RigidTransform,
  printedStepNumber: number,
  worldGaugeSourceRepair: RealBuildPrefix50WorldGaugeSourceRepairProposal | null,
  occurrence30SourceRepair: RealBuildPrefix50Occurrence30SourceRepairProposal | null,
): readonly RealBuildPrefix50TargetOccurrence[] {
  return projection.occurrences
    .filter((occurrence) => occurrence.printedStepNumber === printedStepNumber)
    .map((occurrence) =>
      deepFreeze({
        ...occurrence,
        targetTransform: composeRigidTransforms(
          gauge,
          occurrence.ordinal === worldGaugeSourceRepair?.occurrenceOrdinal
            ? worldGaugeSourceRepair.repairedSourceWorldTransform
            : occurrence.ordinal === occurrence30SourceRepair?.occurrenceOrdinal
              ? occurrence30SourceRepair.repairedSourceWorldTransform
              : occurrence.sourceWorldTransform,
        ),
      }),
    );
}
