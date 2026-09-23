import {
  composeRigidTransforms,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import { sameTransform } from "./real-build-prefix50-exact-compiler-foundation";
import {
  REAL_BUILD_PREFIX50_LAST_STEP,
  REAL_BUILD_PREFIX50_OCCURRENCE_COUNT,
  realBuildPrefix50ProjectionCommitment,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  requireRealBuildPrefix50Step42_43SourceRepairProposal,
  type RealBuildPrefix50Step42_43SourceRepairProposal,
} from "./real-build-prefix50-step42-43-source-repair-application";
import {
  requireRealBuildPrefix50Step42SourceRepairProposal,
  type RealBuildPrefix50Step42SourceRepairProposal,
} from "./real-build-prefix50-step42-source-repair-application";
import { requireRealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return-runtime";
import { requireRealBuildPrefix50TerminalDetachedState } from "./real-build-prefix50-suffix-state";

export interface RealBuildPrefix50BoundStep42SourceRepair extends Omit<
  RealBuildPrefix50Step42SourceRepairProposal,
  "basis" | "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-step42-source-repair/2";
  readonly basis: "opaque-panel-plus-physical-layer-plus-complete-prefix50-enumeration";
  readonly candidatePartId: string;
  readonly repairedDetachedTargetTransform: RigidTransform;
  readonly returnedTargetTransform: RigidTransform;
  readonly connectionIds: readonly [string, string, string, string];
  readonly proof: {
    readonly schemaVersion: "lego.real-build-prefix50-step42-source-repair-final-proof/1";
    readonly projectionCommitment: `sha256:${string}`;
    readonly selectedReturnCommitment: `sha256:${string}`;
    readonly terminalDetachedStateCommitment: `sha256:${string}`;
    readonly completedPrintedStep: 50;
    readonly compiledPartCount: 320;
    readonly exactReturnedPoseRetained: true;
    readonly distinctConnectionCount: 4;
    readonly finalDocumentCollisionCount: 0;
    readonly finalDocumentHash: `sha256:${string}`;
  };
}

export interface RealBuildPrefix50BoundStep42_43SourceRepairRow {
  readonly occurrenceOrdinal: number;
  readonly candidatePartId: string;
  readonly repairedDetachedTargetTransform: RigidTransform;
  readonly returnedTargetTransform: RigidTransform;
  readonly connectionIds: readonly string[];
}

export interface RealBuildPrefix50BoundStep42_43SourceRepair extends Omit<
  RealBuildPrefix50Step42_43SourceRepairProposal,
  "basis" | "schemaVersion"
> {
  readonly schemaVersion: "lego.real-build-prefix50-step42-43-source-repair/2";
  readonly basis: "opaque-panels-plus-exhaustive-terminal-window-plus-complete-prefix50-enumeration";
  readonly compiledRows: readonly RealBuildPrefix50BoundStep42_43SourceRepairRow[];
  readonly proof: {
    readonly schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-final-proof/1";
    readonly projectionCommitment: `sha256:${string}`;
    readonly selectedReturnCommitment: `sha256:${string}`;
    readonly terminalDetachedStateCommitment: `sha256:${string}`;
    readonly completedPrintedStep: 50;
    readonly compiledPartCount: 320;
    readonly exactReturnedPoseCount: 6;
    readonly distinctConnectionCount: 14;
    readonly finalDocumentCollisionCount: 0;
    readonly finalDocumentHash: `sha256:${string}`;
  };
}

function exactConnectionId(
  document: BrickDocumentV1,
  candidatePartId: string,
  candidatePortId: string,
  targetPartId: string,
  targetPortId: string,
  label: string,
): string {
  const matches = document.connections.filter(
    ({ kind, a, b }) =>
      kind === "stud-tube" &&
      ((a.partId === candidatePartId &&
        a.portId === candidatePortId &&
        b.partId === targetPartId &&
        b.portId === targetPortId) ||
        (b.partId === candidatePartId &&
          b.portId === candidatePortId &&
          a.partId === targetPartId &&
          a.portId === targetPortId)),
  );
  if (matches.length !== 1) {
    throw new TypeError(
      `${label} requires exactly one compiled reciprocal edge; found ${matches.length}.`,
    );
  }
  return matches[0]!.id;
}

function exactPartId(
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
  ordinal: number,
  label: string,
): string {
  const partId = partIdByOccurrenceOrdinal.get(ordinal);
  if (partId === undefined) throw new TypeError(`${label} lost occurrence ${ordinal}.`);
  return partId;
}

function requireCompletePrefix(
  document: BrickDocumentV1,
  placementOrdinals: readonly number[],
): void {
  const exactPlacementRoster = [...placementOrdinals]
    .sort((left, right) => left - right)
    .every((ordinal, index) => ordinal === index + 1);
  if (
    document.parts.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    document.steps.length !== REAL_BUILD_PREFIX50_LAST_STEP ||
    placementOrdinals.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    new Set(placementOrdinals).size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    !exactPlacementRoster
  ) {
    throw new TypeError(
      "Late Step-42/43 repairs require the exact 320-occurrence, 50-step compiled prefix and no suffix.",
    );
  }
}

function snapshotExactOccurrenceMap(
  document: BrickDocumentV1,
  projection: RealBuildPrefix50VerifiedProjection,
  value: ReadonlyMap<number, string>,
): ReadonlyMap<number, string> {
  let entries: readonly (readonly [number, string])[];
  try {
    entries = [...Map.prototype.entries.call(value)] as readonly (readonly [number, string])[];
  } catch {
    throw new TypeError("Late Step-42/43 repair binding requires an actual occurrence map.");
  }
  const snapshot = new Map(entries);
  const documentPartById = new Map(document.parts.map((part) => [part.id, part] as const));
  const mappedPartIds = [...snapshot.values()];
  if (
    projection.occurrences.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    entries.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    snapshot.size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    mappedPartIds.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    new Set(mappedPartIds).size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    documentPartById.size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT
  ) {
    throw new TypeError(
      "Late Step-42/43 repair binding requires an exact 1-through-320 occurrence-to-document-part bijection.",
    );
  }
  for (let index = 0; index < REAL_BUILD_PREFIX50_OCCURRENCE_COUNT; index += 1) {
    const ordinal = index + 1;
    const occurrence = projection.occurrences[index];
    const partId = snapshot.get(ordinal);
    const part = partId === undefined ? undefined : documentPartById.get(partId);
    const step =
      occurrence === undefined ? undefined : document.steps[occurrence.printedStepNumber - 1];
    if (
      occurrence?.ordinal !== ordinal ||
      part === undefined ||
      part.catalogPartId !== occurrence.partIdentity.reconciledCatalogPartId ||
      part.colorId !== occurrence.colorId ||
      part.stepId !== step?.id ||
      step.partIds.filter((candidatePartId) => candidatePartId === part.id).length !== 1
    ) {
      throw new TypeError(
        `Late Step-42/43 occurrence ${ordinal} lost its exact catalog, color, or BuildStep identity.`,
      );
    }
  }
  return snapshot;
}

export function bindRealBuildPrefix50LateSourceRepairs(input: {
  readonly document: BrickDocumentV1;
  readonly step42Proposal: RealBuildPrefix50Step42SourceRepairProposal;
  readonly step42_43Proposal: RealBuildPrefix50Step42_43SourceRepairProposal;
  readonly sourceProjection: RealBuildPrefix50VerifiedProjection;
  readonly gauge: RigidTransform;
  readonly selectedReturn: unknown;
  readonly terminalDetachedState: unknown;
  readonly placementOrdinals: readonly number[];
  readonly partIdByOccurrenceOrdinal: ReadonlyMap<number, string>;
}): {
  readonly step42SourceRepair: RealBuildPrefix50BoundStep42SourceRepair;
  readonly step42_43SourceRepair: RealBuildPrefix50BoundStep42_43SourceRepair;
} {
  const selectedReturn = requireRealBuildPrefix50SelectedSubBuildReturn(input.selectedReturn);
  const terminalDetachedState = requireRealBuildPrefix50TerminalDetachedState(
    input.terminalDetachedState,
  );
  const step42Proposal = requireRealBuildPrefix50Step42SourceRepairProposal(input.step42Proposal);
  const step42_43Proposal = requireRealBuildPrefix50Step42_43SourceRepairProposal(
    input.step42_43Proposal,
  );
  requireCompletePrefix(input.document, input.placementOrdinals);
  const partIdByOccurrenceOrdinal = snapshotExactOccurrenceMap(
    input.document,
    input.sourceProjection,
    input.partIdByOccurrenceOrdinal,
  );
  const finalDocumentHash = documentStructuralHash(input.document);
  const projectionCommitment = realBuildPrefix50ProjectionCommitment(input.sourceProjection);
  if (
    step42Proposal.sourceEvidence.projectionCommitment !== projectionCommitment ||
    step42Proposal.repairCommitment !== step42Proposal.sourceEvidence.repairCommitment ||
    step42_43Proposal.sourceEvidence.projectionCommitment !== projectionCommitment ||
    step42_43Proposal.sourceEvidence.step42RepairCommitment !== step42Proposal.repairCommitment ||
    step42_43Proposal.repairCommitment !== step42_43Proposal.sourceEvidence.repairCommitment ||
    selectedReturn.reviewedVisualBinding.projectionCommitment !== projectionCommitment ||
    selectedReturn.reviewedVisualBinding.step42_43RepairCommitment !==
      step42_43Proposal.repairCommitment ||
    terminalDetachedState.combinedDocumentHash !== finalDocumentHash ||
    terminalDetachedState.combinedPartCount !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    terminalDetachedState.parentPartCount !== 311 ||
    terminalDetachedState.childPartCount !== 9 ||
    terminalDetachedState.crossComponentConnectionCount !== 0 ||
    terminalDetachedState.combinedBlockingCodes.length !== 1 ||
    terminalDetachedState.combinedBlockingCodes[0] !== "DISCONNECTED_ASSEMBLY"
  ) {
    throw new TypeError(
      "Late Step-42/43 repair binding requires one exact reviewed projection/repair lineage and its branded terminal 311+9 boundary.",
    );
  }
  const finalCollisions = findCatalogCollisions(input.document.parts, input.document.connections);
  if (finalCollisions.length !== 0) {
    throw new TypeError(
      `Late Step-42/43 repairs require a collision-free exact prefix; found ${finalCollisions.length}.`,
    );
  }
  const step42PartId = exactPartId(
    partIdByOccurrenceOrdinal,
    step42Proposal.occurrenceOrdinal,
    "Step-42 repair",
  );
  const step42Part = input.document.parts.find(({ id }) => id === step42PartId);
  const step42DetachedTarget = deepFreeze(
    composeRigidTransforms(input.gauge, step42Proposal.sourceEvidence.repairedSourceTransform),
  );
  const step42ReturnedTarget = deepFreeze(
    composeRigidTransforms(selectedReturn.groupDelta, step42DetachedTarget),
  );
  if (step42Part === undefined || !sameTransform(step42Part.transform, step42ReturnedTarget)) {
    throw new TypeError(
      "Step-42 repaired occurrence 274 did not retain its exact enumerated pose through the reviewed Step-44 rigid return.",
    );
  }
  const step42ConnectionIds = step42Proposal.sourceEvidence.canonicalConnections.map(
    ({ receiverOrdinal, receiverPortId, candidatePortId }) =>
      exactConnectionId(
        input.document,
        step42PartId,
        candidatePortId,
        exactPartId(partIdByOccurrenceOrdinal, receiverOrdinal, "Step-42 repair receiver"),
        receiverPortId,
        `Step-42 repaired occurrence 274 ${candidatePortId} to occurrence ${receiverOrdinal} ${receiverPortId}`,
      ),
  );
  if (step42ConnectionIds.length !== 4 || new Set(step42ConnectionIds).size !== 4) {
    throw new TypeError(
      "Step-42 repaired occurrence 274 must retain four distinct reciprocal seats.",
    );
  }
  const step42SourceRepair = deepFreeze({
    ...step42Proposal,
    schemaVersion: "lego.real-build-prefix50-step42-source-repair/2" as const,
    basis: "opaque-panel-plus-physical-layer-plus-complete-prefix50-enumeration" as const,
    candidatePartId: step42PartId,
    repairedDetachedTargetTransform: step42DetachedTarget,
    returnedTargetTransform: step42ReturnedTarget,
    connectionIds: step42ConnectionIds as unknown as readonly [string, string, string, string],
    proof: {
      schemaVersion: "lego.real-build-prefix50-step42-source-repair-final-proof/1" as const,
      projectionCommitment,
      selectedReturnCommitment: selectedReturn.commitment,
      terminalDetachedStateCommitment: terminalDetachedState.commitment,
      completedPrintedStep: 50 as const,
      compiledPartCount: 320 as const,
      exactReturnedPoseRetained: true as const,
      distinctConnectionCount: 4 as const,
      finalDocumentCollisionCount: 0 as const,
      finalDocumentHash,
    },
  });

  const compiledRows = step42_43Proposal.sourceEvidence.rows.map((row) => {
    const partId = exactPartId(partIdByOccurrenceOrdinal, row.ordinal, "Step-42/43 repair");
    const part = input.document.parts.find(({ id }) => id === partId);
    const detachedTarget = deepFreeze(
      composeRigidTransforms(input.gauge, row.repairedSourceWorldTransform),
    );
    const returnedTarget = deepFreeze(
      composeRigidTransforms(selectedReturn.groupDelta, detachedTarget),
    );
    if (part === undefined || !sameTransform(part.transform, returnedTarget)) {
      throw new TypeError(
        `Late Step-42/43 repaired occurrence ${row.ordinal} did not retain its exact enumerated pose through the reviewed Step-44 rigid return.`,
      );
    }
    const connectionIds = row.selectedConnections.map(
      ({ targetOrdinal, targetPortId, candidatePortId }) =>
        exactConnectionId(
          input.document,
          partId,
          candidatePortId,
          exactPartId(partIdByOccurrenceOrdinal, targetOrdinal, "Step-42/43 repair target"),
          targetPortId,
          `Late Step-42/43 occurrence ${row.ordinal} ${candidatePortId} to occurrence ${targetOrdinal} ${targetPortId}`,
        ),
    );
    return deepFreeze({
      occurrenceOrdinal: row.ordinal,
      candidatePartId: partId,
      repairedDetachedTargetTransform: detachedTarget,
      returnedTargetTransform: returnedTarget,
      connectionIds,
    });
  });
  const lateConnectionIds = compiledRows.flatMap(({ connectionIds }) => connectionIds);
  const allRepairConnectionIds = [...step42ConnectionIds, ...lateConnectionIds];
  if (
    compiledRows.length !== 6 ||
    compiledRows.some(({ occurrenceOrdinal }, index) => occurrenceOrdinal !== index + 275) ||
    lateConnectionIds.length !== 14 ||
    new Set(lateConnectionIds).size !== 14 ||
    allRepairConnectionIds.length !== 18 ||
    new Set(allRepairConnectionIds).size !== 18
  ) {
    throw new TypeError(
      "Late Step-42/43 repairs must retain exact occurrences 275 through 280 and fourteen distinct reciprocal seats.",
    );
  }
  const step42_43SourceRepair = deepFreeze({
    ...step42_43Proposal,
    schemaVersion: "lego.real-build-prefix50-step42-43-source-repair/2" as const,
    basis:
      "opaque-panels-plus-exhaustive-terminal-window-plus-complete-prefix50-enumeration" as const,
    compiledRows,
    proof: {
      schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-final-proof/1" as const,
      projectionCommitment,
      selectedReturnCommitment: selectedReturn.commitment,
      terminalDetachedStateCommitment: terminalDetachedState.commitment,
      completedPrintedStep: 50 as const,
      compiledPartCount: 320 as const,
      exactReturnedPoseCount: 6 as const,
      distinctConnectionCount: 14 as const,
      finalDocumentCollisionCount: 0 as const,
      finalDocumentHash,
    },
  });
  return deepFreeze({ step42SourceRepair, step42_43SourceRepair });
}
