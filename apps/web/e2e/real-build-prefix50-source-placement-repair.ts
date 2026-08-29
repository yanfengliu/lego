import { deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import type {
  RealBuildPrefix50ProjectionOccurrence,
  RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import { requireRealBuildPrefix50VerifiedProjectionValue } from "./real-build-prefix50-projection";

const STEP45_AXLE_ORIENTATION = "proper-m-00pp000p0";

interface SourcePlacementRepairDefinition {
  readonly ordinal: number;
  readonly sourcePositionLdu: readonly [number, number, number];
  readonly repairedPositionLdu: readonly [number, number, number];
  readonly expectedReceiverOrdinal: number;
  readonly expectedReceiverCatalogPartId: string;
  readonly expectedReceiverColorId: string;
  readonly expectedReceiverOfficialDesignId: string;
  readonly expectedReceiverOfficialDesignRevision: string;
  readonly expectedReceiverSourceLDrawPartId: string;
  readonly expectedReceiverCatalogLDrawPartId: string;
  readonly expectedReceiverSourceWorldTransform: RigidTransform;
}

const SOURCE_PLACEMENT_REPAIRS: readonly SourcePlacementRepairDefinition[] = deepFreeze([
  {
    ordinal: 281,
    sourcePositionLdu: [410, -118, -96.5],
    repairedPositionLdu: [410, -118, -96],
    expectedReceiverOrdinal: 265,
    expectedReceiverCatalogPartId: "builtin:technic-brick-1x1-axle-hole",
    expectedReceiverColorId: "builtin:dark-azure",
    expectedReceiverOfficialDesignId: "73230",
    expectedReceiverOfficialDesignRevision: "73230;D",
    expectedReceiverSourceLDrawPartId: "73230",
    expectedReceiverCatalogLDrawPartId: "73230",
    expectedReceiverSourceWorldTransform: {
      positionLdu: [410, -98, -94],
      orientationId: "proper-m-00nn000p0",
    },
  },
  {
    ordinal: 282,
    sourcePositionLdu: [270, -118, -96.5],
    repairedPositionLdu: [270, -118, -96],
    expectedReceiverOrdinal: 261,
    expectedReceiverCatalogPartId: "builtin:technic-brick-1x1-axle-hole",
    expectedReceiverColorId: "builtin:dark-azure",
    expectedReceiverOfficialDesignId: "73230",
    expectedReceiverOfficialDesignRevision: "73230;D",
    expectedReceiverSourceLDrawPartId: "73230",
    expectedReceiverCatalogLDrawPartId: "73230",
    expectedReceiverSourceWorldTransform: {
      positionLdu: [270, -98, -94],
      orientationId: "proper-m-00nn000p0",
    },
  },
  {
    ordinal: 283,
    sourcePositionLdu: [340, -118, -96.5],
    repairedPositionLdu: [340, -118, -96],
    expectedReceiverOrdinal: 264,
    expectedReceiverCatalogPartId: "builtin:technic-brick-1x2-axle-hole",
    expectedReceiverColorId: "builtin:medium-azure",
    expectedReceiverOfficialDesignId: "32064",
    expectedReceiverOfficialDesignRevision: "32064;I",
    expectedReceiverSourceLDrawPartId: "32064a",
    expectedReceiverCatalogLDrawPartId: "32064",
    expectedReceiverSourceWorldTransform: {
      positionLdu: [340, -98, -94],
      orientationId: "proper-m-00pp000p0",
    },
  },
]);

const repairByOrdinal = new Map(SOURCE_PLACEMENT_REPAIRS.map((repair) => [repair.ordinal, repair]));

export interface RealBuildPrefix50SourcePlacementRepairProposal {
  readonly schemaVersion: "lego.real-build-prefix50-source-placement-repair/1";
  readonly occurrenceOrdinal: number;
  readonly printedStepNumber: 45;
  readonly catalogPartId: "builtin:axle-1x3";
  readonly sourceWorldTransform: RigidTransform;
  readonly repairedSourceWorldTransform: RigidTransform;
  readonly sourceResidualLdu: readonly [number, number, number];
  readonly expectedReceiverOrdinal: number;
  readonly expectedReceiverCatalogPartId: string;
  readonly expectedReceiverColorId: string;
  readonly expectedReceiverSourceWorldTransform: RigidTransform;
  readonly expectedReceiverPortId: "axleHole:0";
  readonly expectedCandidatePortId: "axle:2";
  readonly provisionalBasis: "occurrence-scoped-source-residual-awaiting-connector-proof";
}

export interface RealBuildPrefix50IntegralProjection {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly repairs: readonly RealBuildPrefix50SourcePlacementRepairProposal[];
}

function sameVector(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireExactRepairOccurrence(
  occurrence: RealBuildPrefix50ProjectionOccurrence,
  definition: SourcePlacementRepairDefinition,
): void {
  const identity = occurrence.partIdentity;
  if (
    occurrence.printedStepNumber !== 45 ||
    identity.reconciledCatalogPartId !== "builtin:axle-1x3" ||
    identity.publishedCatalogPartId !== "builtin:axle-1x3" ||
    identity.officialDesignId !== "4519" ||
    identity.officialDesignRevision !== "4519;E" ||
    identity.sourceLDrawPartId !== "4519" ||
    identity.catalogLDrawPartId !== "4519" ||
    identity.identityProofId !== null ||
    identity.basis !== "published-exact" ||
    occurrence.sourceWorldTransform.orientationId !== STEP45_AXLE_ORIENTATION ||
    !sameVector(occurrence.sourceWorldTransform.positionLdu, definition.sourcePositionLdu)
  ) {
    throw new TypeError(
      `Prefix-50 source-placement repair ${definition.ordinal} drifted from its exact step-45 4519 occurrence, source transform, or identity proof.`,
    );
  }
}

function requireExactRepairReceiver(
  projection: RealBuildPrefix50VerifiedProjection,
  definition: SourcePlacementRepairDefinition,
): RealBuildPrefix50ProjectionOccurrence {
  const receiver = projection.occurrences[definition.expectedReceiverOrdinal - 1];
  const identity = receiver?.partIdentity;
  if (
    receiver?.ordinal !== definition.expectedReceiverOrdinal ||
    receiver.printedStepNumber !== 39 ||
    receiver.colorId !== definition.expectedReceiverColorId ||
    identity?.publishedCatalogPartId !== definition.expectedReceiverCatalogPartId ||
    identity.reconciledCatalogPartId !== definition.expectedReceiverCatalogPartId ||
    identity.officialDesignId !== definition.expectedReceiverOfficialDesignId ||
    identity.officialDesignRevision !== definition.expectedReceiverOfficialDesignRevision ||
    identity.sourceLDrawPartId !== definition.expectedReceiverSourceLDrawPartId ||
    identity.catalogLDrawPartId !== definition.expectedReceiverCatalogLDrawPartId ||
    identity.identityProofId !== null ||
    identity.basis !== "published-exact" ||
    receiver.sourceWorldTransform.orientationId !==
      definition.expectedReceiverSourceWorldTransform.orientationId ||
    !sameVector(
      receiver.sourceWorldTransform.positionLdu,
      definition.expectedReceiverSourceWorldTransform.positionLdu,
    )
  ) {
    throw new TypeError(
      `Prefix-50 source-placement repair ${definition.ordinal} lost its exact step-39 receiver occurrence, identity, color, or source transform.`,
    );
  }
  return receiver;
}

/**
 * Produces the integral computation view consumed by the exact compiler while
 * retaining every repaired source transform as counterevidence.
 *
 * This is not coordinate rounding. Only the three pinned 4519 occurrences are
 * admitted, and the compiler must subsequently recover each repaired target
 * from complete connector enumeration and prove its exact axle-hole edge.
 */
export function proposeRealBuildPrefix50SourcePlacementRepairs(
  projection: RealBuildPrefix50VerifiedProjection,
): RealBuildPrefix50IntegralProjection {
  requireRealBuildPrefix50VerifiedProjectionValue(projection);
  const repairs: RealBuildPrefix50SourcePlacementRepairProposal[] = [];
  const repairedOccurrences = projection.occurrences.map((occurrence) => {
    const integral = occurrence.sourceWorldTransform.positionLdu.every(Number.isSafeInteger);
    const definition = repairByOrdinal.get(occurrence.ordinal);
    if (integral) {
      if (definition !== undefined && projection.sourceSetId === "6651557") {
        throw new TypeError(
          `Prefix-50 source-placement repair ${occurrence.ordinal} lost its pinned half-LDU counterevidence.`,
        );
      }
      return occurrence;
    }
    if (projection.sourceSetId !== "6651557" || definition === undefined) {
      throw new TypeError(
        `Prefix-50 occurrence ${occurrence.ordinal} has a non-integral source transform with no exact occurrence-scoped repair.`,
      );
    }
    requireExactRepairOccurrence(occurrence, definition);
    requireExactRepairReceiver(projection, definition);
    const repairedSourceWorldTransform: RigidTransform = deepFreeze({
      positionLdu: [...definition.repairedPositionLdu],
      orientationId: STEP45_AXLE_ORIENTATION,
    });
    repairs.push(
      deepFreeze({
        schemaVersion: "lego.real-build-prefix50-source-placement-repair/1" as const,
        occurrenceOrdinal: occurrence.ordinal,
        printedStepNumber: 45 as const,
        catalogPartId: "builtin:axle-1x3" as const,
        sourceWorldTransform: occurrence.sourceWorldTransform,
        repairedSourceWorldTransform,
        sourceResidualLdu: [0, 0, 0.5] as const,
        expectedReceiverOrdinal: definition.expectedReceiverOrdinal,
        expectedReceiverCatalogPartId: definition.expectedReceiverCatalogPartId,
        expectedReceiverColorId: definition.expectedReceiverColorId,
        expectedReceiverSourceWorldTransform: definition.expectedReceiverSourceWorldTransform,
        expectedReceiverPortId: "axleHole:0" as const,
        expectedCandidatePortId: "axle:2" as const,
        provisionalBasis: "occurrence-scoped-source-residual-awaiting-connector-proof" as const,
      }),
    );
    return deepFreeze({ ...occurrence, sourceWorldTransform: repairedSourceWorldTransform });
  });
  if (
    projection.sourceSetId === "6651557" &&
    (repairs.length !== SOURCE_PLACEMENT_REPAIRS.length ||
      repairs.some(
        (repair, index) => repair.occurrenceOrdinal !== SOURCE_PLACEMENT_REPAIRS[index]!.ordinal,
      ))
  ) {
    throw new TypeError(
      "Prefix-50 source-placement repair scope must remain exactly occurrences 281, 282, and 283.",
    );
  }
  return deepFreeze({
    projection: {
      ...projection,
      occurrences: repairedOccurrences,
    },
    repairs,
  });
}
