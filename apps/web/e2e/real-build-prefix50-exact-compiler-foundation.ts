import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import {
  composeRigidTransforms,
  deepFreeze,
  documentStructuralHash,
  rotateLduVector,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import {
  enumeratePlacements,
  enumeratePlacementsInPreparedWorld,
  PLACEMENT_ENUMERATION_VERSION,
  type PlacementEnumeration,
  type PreparedPlacementEnumerationWorld,
} from "../src/assembly/enumerate-placements";
import { BUILDER_STEP1_ORIGIN_POLICY } from "./real-build-builder-sources";
import {
  REAL_BUILD_PREFIX50_LAST_STEP,
  REAL_BUILD_PREFIX50_OCCURRENCE_COUNT,
  REAL_BUILD_PREFIX50_TRANSITION_STEP,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50StateCommitment,
  type RealBuildPrefix50TargetOccurrence,
  type RealBuildPrefix50WorldGaugeSourceRepair,
  type RealBuildPrefix50WorldGaugeSourceRepairProposal,
} from "./real-build-prefix50-exact-compiler-contract";

export function ownData(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

export function exactInputKeys(value: unknown, includeOccurrence30Proof: boolean): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Prefix-50 exact compiler input must be a data object.");
  }
  let keys: readonly string[];
  try {
    keys = Object.keys(value).sort();
  } catch {
    throw new TypeError("Prefix-50 exact compiler input could not be inspected safely.");
  }
  const expected = includeOccurrence30Proof
    ? ["documentSnapshot", "occurrence30SourceRepairProof", "projectionReader"]
    : ["documentSnapshot", "projectionReader"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new TypeError(
      `Prefix-50 exact compiler input accepts only ${expected.join(", ")}; caller-shaped actions, transforms, repairs, and witnesses cannot bypass enumeration.`,
    );
  }
}

export function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((value, index) => value === right.positionLdu[index])
  );
}

function inverseTransform(transform: RigidTransform): RigidTransform {
  const orientation = PROPER_ORIENTATIONS.find(({ id }) => id === transform.orientationId);
  if (orientation === undefined) {
    throw new TypeError(
      `Prefix-50 source-world orientation ${transform.orientationId} is outside the proper 24-orientation vocabulary.`,
    );
  }
  const matrix = orientation.matrix;
  const inverseMatrix = [
    matrix[0],
    matrix[3],
    matrix[6],
    matrix[1],
    matrix[4],
    matrix[7],
    matrix[2],
    matrix[5],
    matrix[8],
  ];
  const inverseOrientation = PROPER_ORIENTATIONS.find(({ matrix: candidate }) =>
    candidate.every((value, index) => value === inverseMatrix[index]),
  );
  if (inverseOrientation === undefined) {
    throw new TypeError("Prefix-50 proper-orientation vocabulary is not closed under inversion.");
  }
  const negated = transform.positionLdu.map((value) => -value) as [number, number, number];
  return {
    positionLdu: rotateLduVector(inverseOrientation.matrix, negated),
    orientationId: inverseOrientation.id,
  };
}

/** Rejects a malformed/truncated enumeration receipt before candidates are read. */
export function requireRealBuildPrefix50CompleteEnumeration(
  enumeration: PlacementEnumeration,
): PlacementEnumeration {
  if (
    enumeration.schemaVersion !== PLACEMENT_ENUMERATION_VERSION ||
    enumeration.counts.accepted !== enumeration.candidates.length ||
    enumeration.counts.accepted > enumeration.counts.distinctTransforms
  ) {
    throw new TypeError(
      "Prefix-50 placement enumeration is incomplete or internally inconsistent; candidates may never be silently truncated.",
    );
  }
  return enumeration;
}

export function enumerateFor(
  document: BrickDocumentV1,
  occurrence: RealBuildPrefix50TargetOccurrence | RealBuildPrefix50ProjectionOccurrence,
  allowDetachedBuildPlate: boolean,
  budget: RealBuildPrefix50SearchBudget,
  prepared?: PreparedPlacementEnumerationWorld,
): PlacementEnumeration {
  budget.enumerations += 1;
  if ("targetTransform" in occurrence) budget.orientationNarrowedEnumerations += 1;
  const options = {
    includeBuildPlate: allowDetachedBuildPlate,
    allowDetached: allowDetachedBuildPlate,
    maxDistinctTransforms: REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
    ...("targetTransform" in occurrence
      ? { orientationIds: [occurrence.targetTransform.orientationId] }
      : {}),
  };
  return requireRealBuildPrefix50CompleteEnumeration(
    prepared === undefined
      ? enumeratePlacements(document, occurrence.partIdentity.reconciledCatalogPartId, options)
      : enumeratePlacementsInPreparedWorld(
          prepared,
          occurrence.partIdentity.reconciledCatalogPartId,
          options,
        ),
  );
}

export function deriveGauge(
  base: BrickDocumentV1,
  first: RealBuildPrefix50ProjectionOccurrence,
  sourceWorldTransform: RigidTransform,
  budget: RealBuildPrefix50SearchBudget,
): RigidTransform {
  const enumeration = enumerateFor(base, first, true, budget);
  const anchor = enumeration.candidates[0];
  if (anchor === undefined || !anchor.restsOnBuildPlate) {
    throw new TypeError(
      "Prefix-50 world gauge requires the first verified occurrence to have an actual build-plate enumeration.",
    );
  }
  return deepFreeze(
    composeRigidTransforms(anchor.transform, inverseTransform(sourceWorldTransform)),
  );
}

function sameVector(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Retains the official full-model row as counterevidence while using the exact
 * project-authored step-1 anchor calibration for the computation gauge.
 */
export function proposeRealBuildPrefix50WorldGaugeSourceRepair(
  projection: RealBuildPrefix50VerifiedProjection,
): RealBuildPrefix50WorldGaugeSourceRepairProposal | null {
  requireRealBuildPrefix50VerifiedProjectionValue(projection);
  const first = projection.occurrences[0];
  if (projection.sourceSetId !== "6651557") return null;
  const identity = first?.partIdentity;
  if (
    first?.ordinal !== 1 ||
    first.printedStepNumber !== 1 ||
    first.colorId !== "builtin:black" ||
    identity?.publishedCatalogPartId !== "builtin:corner-plate-5x5-quarter-ring" ||
    identity.reconciledCatalogPartId !== "builtin:corner-plate-5x5-quarter-ring" ||
    identity.officialDesignId !== "80015" ||
    identity.officialDesignRevision !== "80015;E" ||
    identity.sourceLDrawPartId !== "80015" ||
    identity.catalogLDrawPartId !== "80015" ||
    identity.identityProofId !== null ||
    identity.basis !== "published-exact" ||
    first.sourceWorldTransform.orientationId !== "upright-yaw-0" ||
    !sameVector(first.sourceWorldTransform.positionLdu, [500, -4, -234]) ||
    BUILDER_STEP1_ORIGIN_POLICY.anchorBrickRef !== "76092bf0-3d72-474a-baf3-06b837082f6a" ||
    BUILDER_STEP1_ORIGIN_POLICY.protocol !== "first-ordered-direct-empty-enumeration/1" ||
    BUILDER_STEP1_ORIGIN_POLICY.expectedComposedTransform.orientationId !== "upright-yaw-0" ||
    !sameVector(BUILDER_STEP1_ORIGIN_POLICY.expectedComposedTransform.positionLdu, [560, -4, -194])
  ) {
    throw new TypeError(
      "Prefix-50 world-gauge source repair drifted from the exact set-6651557 occurrence-1 80015 row or project-authored step-1 anchor policy.",
    );
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair/1" as const,
    occurrenceOrdinal: 1 as const,
    catalogPartId: "builtin:corner-plate-5x5-quarter-ring" as const,
    sourceWorldTransform: first.sourceWorldTransform,
    repairedSourceWorldTransform: {
      positionLdu: [...BUILDER_STEP1_ORIGIN_POLICY.expectedComposedTransform.positionLdu],
      orientationId: BUILDER_STEP1_ORIGIN_POLICY.expectedComposedTransform.orientationId,
    },
    sourceResidualLdu: [60, 0, 40] as const,
    projectAnchorPolicy: BUILDER_STEP1_ORIGIN_POLICY.protocol,
    provisionalBasis: "occurrence-scoped-project-anchor-awaiting-complete-prefix-proof" as const,
  });
}

export function bindWorldGaugeSourceRepair(
  document: BrickDocumentV1,
  proposal: RealBuildPrefix50WorldGaugeSourceRepairProposal | null,
  gauge: RigidTransform,
  projection: RealBuildPrefix50VerifiedProjection,
  projectionCommitment: `sha256:${string}`,
  placementOrdinals: readonly number[],
  stateCommitments: readonly RealBuildPrefix50StateCommitment[],
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
): RealBuildPrefix50WorldGaugeSourceRepair | null {
  if (proposal === null) return null;
  const candidatePartId = partIdByOccurrenceOrdinal.get(proposal.occurrenceOrdinal);
  const candidate = document.parts.find(({ id }) => id === candidatePartId);
  const repairedTargetTransform = deepFreeze(
    composeRigidTransforms(gauge, proposal.repairedSourceWorldTransform),
  );
  const finalDocumentHash = documentStructuralHash(document);
  const exactOccurrenceOrder = projection.occurrences.every(
    ({ ordinal }, index) => ordinal === index + 1,
  );
  const exactPlacementRoster = [...placementOrdinals]
    .sort((left, right) => left - right)
    .every((ordinal, index) => ordinal === index + 1);
  const exactStepOrder = document.steps.every(({ index }, arrayIndex) => index === arrayIndex);
  const sourceSuffixOccurrenceCount = projection.occurrences.filter(
    ({ printedStepNumber }) => printedStepNumber > REAL_BUILD_PREFIX50_LAST_STEP,
  ).length;
  const exactStateOrder = stateCommitments.every(
    ({ completedPrintedStep }, index) => completedPrintedStep === index,
  );
  if (
    candidatePartId === undefined ||
    candidate?.catalogPartId !== proposal.catalogPartId ||
    !sameTransform(candidate.transform, repairedTargetTransform) ||
    projection.occurrences.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    !exactOccurrenceOrder ||
    sourceSuffixOccurrenceCount !== 0 ||
    placementOrdinals.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    new Set(placementOrdinals).size !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    !exactPlacementRoster ||
    document.parts.length !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    document.steps.length !== REAL_BUILD_PREFIX50_LAST_STEP ||
    !exactStepOrder ||
    document.steps[REAL_BUILD_PREFIX50_TRANSITION_STEP - 1]?.partIds.length !== 0 ||
    document.steps.some(({ index }) => index >= REAL_BUILD_PREFIX50_LAST_STEP) ||
    stateCommitments.length !== REAL_BUILD_PREFIX50_LAST_STEP + 1 ||
    !exactStateOrder ||
    stateCommitments.at(-1)?.completedPrintedStep !== REAL_BUILD_PREFIX50_LAST_STEP ||
    stateCommitments.at(-1)?.partCount !== REAL_BUILD_PREFIX50_OCCURRENCE_COUNT ||
    stateCommitments.at(-1)?.documentHash !== finalDocumentHash
  ) {
    throw new TypeError(
      "Prefix-50 world-gauge source repair did not survive the complete exact prefix as its occurrence-1 enumerated target.",
    );
  }
  const { provisionalBasis: _provisionalBasis, ...proven } = proposal;
  void _provisionalBasis;
  return deepFreeze({
    ...proven,
    schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair/2" as const,
    basis: "complete-prefix50-exact-enumeration" as const,
    repairedTargetTransform,
    candidatePartId,
    proof: {
      schemaVersion: "lego.real-build-prefix50-world-gauge-source-repair-proof/1" as const,
      projectionCommitment,
      completedPrintedStep: REAL_BUILD_PREFIX50_LAST_STEP,
      stepCount: document.steps.length,
      compiledPartCount: document.parts.length,
      occurrenceCount: projection.occurrences.length,
      occurrenceOrdinalOrder: "exact-indexed-1-through-320" as const,
      sourceSuffixOccurrenceCount: 0 as const,
      placementOrdinalCount: placementOrdinals.length,
      placementOrdinalRoster: "exact-unique-1-through-320" as const,
      stepIndexOrder: "exact-indexed-0-through-49" as const,
      zeroPieceStepNumber: REAL_BUILD_PREFIX50_TRANSITION_STEP,
      hasStep51Suffix: false as const,
      finalDocumentHash,
    },
  });
}
