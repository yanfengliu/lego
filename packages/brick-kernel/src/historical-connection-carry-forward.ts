import type {
  CollisionCylinder,
  CollisionPrimitive,
  ConnectorKind,
  PartDefinition,
} from "@lego-studio/catalog";

import type {
  CarriedConnectionEndpoint,
  ReportedCatalogInterpretationChange,
} from "./catalog-interpretation-changes.ts";
import type { ConnectionSemanticsEndpointDelta } from "./connection-semantics-projection.ts";
import {
  connectionEndpointKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";

type Sha256Digest = `sha256:${string}`;

/**
 * The first of two reviewed classes of connector change that migration carries
 * an edge across instead of refusing it. Current truth adds shared-capacity groups to
 * a connector that already existed, and every other member of each added
 * group is a connector the source truth did not have. Nothing else about the
 * connector moves. A source-valid document cannot hold an edge on such a
 * member, because migration refuses an edge on a later connector, so the
 * carried edge fills the same capacity after migration as before it.
 *
 * `npm run migration-history:check` proves the class for every row that uses
 * it (`carriedEndpointDeltaProofFailures`), and migration re-checks the peers
 * against the row it reads (`carriedEndpointPeerFailure`).
 */
export const CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS =
  "capacity-cells-added-shared-only-with-endpoints-absent-from-source" as const;

/**
 * The second reviewed class. Current truth gives an existing stud the
 * `nominal-stud-tube/1` validated-connection profile, and nothing else about
 * the stud endpoint moves. The profile only lets a validated edge check its
 * clutch against a stud radius no larger than the measured one, so a saved
 * edge keeps its frame, capacity and compatibility and can only lose a
 * collision it had, never gain one.
 *
 * `npm run migration-history:check` proves the class for every row that uses
 * it (`carriedEndpointDeltaProofFailures`), and migration re-checks that the
 * live part still declares the profile (`carriedEndpointPeerFailure`).
 */
export const VALIDATED_STUD_PROFILE_ADDED =
  "validated-stud-profile-added-to-unchanged-stud" as const;

interface ReviewedCarriedEndpointDeltaBase extends ConnectionSemanticsEndpointDelta {
  readonly sourceDigest: Sha256Digest;
  readonly targetDigest: Sha256Digest;
  /** The catalog version whose connector-semantics interpretation row reports a carried edge. */
  readonly reportedUnderCatalogVersion: string;
}

/** One reviewed endpoint change, of a reviewed class, that migration carries an edge across. */
export type ReviewedCarriedEndpointDelta =
  | (ReviewedCarriedEndpointDeltaBase & {
      readonly deltaClass: typeof CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS;
      /** The shared-capacity group ids current truth adds to this connector. */
      readonly addedSharedCapacityGroupIds: readonly string[];
    })
  | (ReviewedCarriedEndpointDeltaBase & {
      readonly deltaClass: typeof VALIDATED_STUD_PROFILE_ADDED;
      /** The validated-connection stud profile current truth adds to the part. */
      readonly addedValidatedConnectionStudProfile: "nominal-stud-tube/1";
    });

/** A carried endpoint, before migration files it under its interpretation row. */
export type CarriedEndpointAssessment = CarriedConnectionEndpoint & {
  readonly reportedUnderCatalogVersion: string;
};

/** The class-specific fields a carried endpoint reports beside its identity. */
export function carriedEndpointClassFields(
  carried: ReviewedCarriedEndpointDelta,
):
  | Pick<
      Extract<
        ReviewedCarriedEndpointDelta,
        { deltaClass: typeof CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS }
      >,
      "deltaClass" | "addedSharedCapacityGroupIds"
    >
  | Pick<
      Extract<ReviewedCarriedEndpointDelta, { deltaClass: typeof VALIDATED_STUD_PROFILE_ADDED }>,
      "deltaClass" | "addedValidatedConnectionStudProfile"
    > {
  return carried.deltaClass === CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS
    ? {
        deltaClass: carried.deltaClass,
        addedSharedCapacityGroupIds: carried.addedSharedCapacityGroupIds,
      }
    : {
        deltaClass: carried.deltaClass,
        addedValidatedConnectionStudProfile: carried.addedValidatedConnectionStudProfile,
      };
}

interface CarryForwardConnector {
  readonly id: string;
  readonly kind?: string;
  readonly sharedCapacityGroupIds?: readonly string[];
}

interface CarryForwardCollision {
  readonly validatedConnectionStudProfile?: string;
}

const groupsOf = (connector: CarryForwardConnector): readonly string[] =>
  connector.sharedCapacityGroupIds ?? [];

/**
 * Why migration may not carry an edge on `carried`'s endpoint of `definition`
 * under a row whose endpoint changes are `endpointDeltas`, or undefined when
 * it may. It re-reads the peers from the live part, so a later group member
 * the review did not see stops the carry instead of riding along.
 */
export function carriedEndpointPeerFailure(
  carried: ReviewedCarriedEndpointDelta,
  delta: ConnectionSemanticsEndpointDelta,
  endpointDeltas: readonly ConnectionSemanticsEndpointDelta[],
  definition: {
    readonly id: string;
    readonly connectors: readonly CarryForwardConnector[];
    readonly collision?: CarryForwardCollision;
  },
): string | undefined {
  if (delta.sourceDigest !== carried.sourceDigest || delta.targetDigest !== carried.targetDigest) {
    return `the row changes it from ${String(delta.sourceDigest)} to ${String(delta.targetDigest)}, not the reviewed ${carried.sourceDigest} to ${carried.targetDigest}`;
  }
  const connector = definition.connectors.find(({ id }) => id === carried.portId);
  if (connector === undefined) return `current truth has no ${carried.portId}`;
  if (carried.deltaClass === VALIDATED_STUD_PROFILE_ADDED) {
    if (connector.kind !== "stud") return `current ${carried.portId} is not a stud`;
    const profile = definition.collision?.validatedConnectionStudProfile;
    return profile === carried.addedValidatedConnectionStudProfile
      ? undefined
      : `current ${definition.id} declares validated stud profile ${String(profile)}, not the reviewed ${carried.addedValidatedConnectionStudProfile}`;
  }
  const sourceDigests = new Map(
    endpointDeltas.map((entry) => [
      connectionEndpointKey(entry.partId, entry.portId),
      entry.sourceDigest,
    ]),
  );
  for (const groupId of carried.addedSharedCapacityGroupIds) {
    if (!groupsOf(connector).includes(groupId)) {
      return `current ${carried.portId} no longer joins capacity group ${groupId}`;
    }
    for (const peer of definition.connectors) {
      if (peer.id === carried.portId || !groupsOf(peer).includes(groupId)) continue;
      // An unchanged peer has no delta: it existed in the source as it is now.
      if (sourceDigests.get(connectionEndpointKey(definition.id, peer.id)) !== null) {
        return `${peer.id} shares capacity group ${groupId} and existed in the source truth, so a saved edge on it could already fill that cell`;
      }
    }
  }
  return undefined;
}

/**
 * Files each carried endpoint under the one reported interpretation row that
 * names its part's connector-semantics change in the version its review
 * names. A carried endpoint with no such row is a blocking reason: the
 * reviewed tables disagree, and an unreported carry is not allowed.
 */
export function reportCarriedEndpoints(
  changes: readonly ReportedCatalogInterpretationChange[],
  carried: readonly CarriedEndpointAssessment[],
): {
  readonly changes: readonly ReportedCatalogInterpretationChange[];
  readonly blockingReasons: readonly string[];
} {
  const filed = changes.map((): CarriedConnectionEndpoint[] => []);
  const blockingReasons: string[] = [];
  for (const { reportedUnderCatalogVersion, ...endpoint } of carried) {
    const rows = changes.flatMap((change, index) =>
      change.toCatalogVersion === reportedUnderCatalogVersion &&
      change.affectedCatalogPartIds.includes(endpoint.catalogPartId) &&
      change.changedFields.includes("connector-semantics")
        ? [index]
        : [],
    );
    if (rows.length !== 1) {
      blockingReasons.push(
        `Connection ${endpoint.connectionId} endpoint ${endpoint.partId}/${endpoint.portId} is carried by reviewed delta class ${endpoint.deltaClass}, but ${rows.length} reported interpretation rows name a ${reportedUnderCatalogVersion} connector-semantics change to ${endpoint.catalogPartId}, not one; fix REVIEWED_CATALOG_INTERPRETATION_CHANGES so the carried edge is reported`,
      );
      continue;
    }
    filed[rows[0]!]!.push(endpoint);
  }
  return {
    changes: changes.map((change, index) =>
      filed[index]!.length === 0
        ? change
        : { ...change, carriedConnectionEndpoints: filed[index]! },
    ),
    blockingReasons,
  };
}

interface ProofPairRule {
  readonly male: ConnectorKind;
  readonly female: ConnectorKind;
  readonly allowedRotation: "fixed" | "quarterTurns" | "continuous";
  readonly articulation: "rigid" | "revolute";
  readonly axisMatching?: "opposed" | "collinear";
}

/**
 * Every way `carried` fails to be its reviewed class for one row, as the
 * migration-history check derives that row: `endpointDeltas` from source
 * truth `sourceParts` to current `targetParts`, projected with `pairRules`
 * over the source's `semanticConnectorKinds`. A `VALIDATED_STUD_PROFILE_ADDED`
 * entry is proved by `studProfileAddedProofFailures`. A capacity-cell entry
 * yields nothing when every one of these holds:
 *
 * - the row changes the endpoint exactly as the entry says, and current
 *   truth still has the connector with every added group;
 * - the current connector minus its added groups digests to the source
 *   digest, so the groups are the whole change;
 * - every other member of each added group has a null source digest, and no
 *   source connector of the part carried the group.
 */
export function carriedEndpointDeltaProofFailures(input: {
  readonly truthHash: string;
  readonly carried: readonly ReviewedCarriedEndpointDelta[];
  readonly endpointDeltas: readonly ConnectionSemanticsEndpointDelta[];
  readonly sourceParts: readonly {
    readonly id: string;
    readonly connectors: readonly CarryForwardConnector[];
    readonly collision?: CarryForwardCollision;
  }[];
  readonly targetParts: readonly PartDefinition[];
  readonly pairRules: readonly ProofPairRule[];
  readonly semanticConnectorKinds: readonly ConnectorKind[];
}): readonly string[] {
  const failures: string[] = [];
  const deltas = new Map(
    input.endpointDeltas.map((delta) => [connectionEndpointKey(delta.partId, delta.portId), delta]),
  );
  for (const entry of input.carried) {
    const key = connectionEndpointKey(entry.partId, entry.portId);
    const fail = (reason: string) =>
      failures.push(`${input.truthHash} ${entry.partId}/${entry.portId}: ${reason}`);
    const deltaClass: string = entry.deltaClass;
    if (
      deltaClass !== CAPACITY_CELLS_ADDED_FOR_ABSENT_PEERS &&
      deltaClass !== VALIDATED_STUD_PROFILE_ADDED
    ) {
      fail(`names unknown delta class ${deltaClass}`);
      continue;
    }
    const delta = deltas.get(key);
    if (delta?.sourceDigest !== entry.sourceDigest || delta.targetDigest !== entry.targetDigest) {
      fail(
        `the derived change is ${delta === undefined ? "absent" : `${String(delta.sourceDigest)} -> ${String(delta.targetDigest)}`}, not the reviewed ${entry.sourceDigest} -> ${entry.targetDigest}`,
      );
      continue;
    }
    const part = input.targetParts.find(({ id }) => id === entry.partId);
    const connector = part?.connectors.find(({ id }) => id === entry.portId);
    if (part === undefined || connector === undefined) {
      fail("current truth has no such connector");
      continue;
    }
    const digestOf = (candidate: PartDefinition) =>
      projectConnectionSemantics([candidate], input.pairRules, "live-strict", {
        semanticConnectorKinds: input.semanticConnectorKinds,
      }).endpointDigests.get(key) ?? null;
    if (entry.deltaClass === VALIDATED_STUD_PROFILE_ADDED) {
      const sourcePart = input.sourceParts.find(({ id }) => id === entry.partId);
      for (const reason of studProfileAddedProofFailures(
        entry,
        delta,
        part,
        sourcePart,
        digestOf,
      )) {
        fail(reason);
      }
      continue;
    }
    const added = entry.addedSharedCapacityGroupIds;
    const groups = groupsOf(connector);
    if (
      added.length === 0 ||
      new Set(added).size !== added.length ||
      added.some((groupId) => !groups.includes(groupId))
    ) {
      fail(
        `added groups ${JSON.stringify(added)} are not distinct members of the current connector's groups ${JSON.stringify(groups)}`,
      );
      continue;
    }
    const control = digestOf(part);
    if (control !== delta.targetDigest) {
      fail(
        `projecting the part alone gives ${String(control)}, not the derived target ${delta.targetDigest}, so this proof cannot vouch for the change`,
      );
      continue;
    }
    const remaining = groups.filter((groupId) => !added.includes(groupId));
    const ungrouped = Object.fromEntries(
      Object.entries(connector).filter(([name]) => name !== "sharedCapacityGroupIds"),
    );
    const stripped = digestOf({
      ...part,
      connectors: part.connectors.map((candidate) =>
        candidate !== connector
          ? candidate
          : remaining.length === 0
            ? ungrouped
            : { ...ungrouped, sharedCapacityGroupIds: remaining },
      ),
    } as PartDefinition);
    if (stripped !== delta.sourceDigest) {
      fail(
        `current truth minus groups ${added.join(", ")} digests to ${String(stripped)}, not the source ${delta.sourceDigest}, so more than capacity cells changed`,
      );
    }
    const sourcePart = input.sourceParts.find(({ id }) => id === entry.partId);
    for (const groupId of added) {
      const peers = part.connectors.filter(
        (peer) => peer !== connector && groupsOf(peer).includes(groupId),
      );
      if (peers.length === 0) fail(`group ${groupId} has no other member, so it shares nothing`);
      for (const peer of peers) {
        const sourceDigest = deltas.get(connectionEndpointKey(part.id, peer.id))?.sourceDigest;
        if (sourceDigest !== null) {
          fail(
            `group ${groupId} member ${peer.id} existed in the source (${sourceDigest ?? "unchanged"}), so a saved edge on it could already fill the shared cell`,
          );
        }
      }
      if (sourcePart?.connectors.some((candidate) => groupsOf(candidate).includes(groupId))) {
        fail(`group ${groupId} already existed in the source part, so it was not added`);
      }
    }
  }
  return failures;
}

/**
 * Every way one stud endpoint fails to be the `VALIDATED_STUD_PROFILE_ADDED`
 * class: the source part declared no profile; current truth declares the
 * reviewed profile on a stud whose matching collision cylinders each carry a
 * profile radius no larger than their measured radius, so the profile can
 * only relax collision; and the current part minus that profile, both the
 * part-level name and each cylinder's profile radius, digests to the source.
 */
function studProfileAddedProofFailures(
  entry: Extract<ReviewedCarriedEndpointDelta, { deltaClass: typeof VALIDATED_STUD_PROFILE_ADDED }>,
  delta: ConnectionSemanticsEndpointDelta,
  part: PartDefinition,
  sourcePart: { readonly collision?: CarryForwardCollision } | undefined,
  digestOf: (candidate: PartDefinition) => string | null,
): readonly string[] {
  const connector = part.connectors.find(({ id }) => id === entry.portId);
  if (connector?.kind !== "stud") return [`current ${entry.portId} is not a stud`];
  if (sourcePart === undefined) return ["the source truth has no such part"];
  const failures: string[] = [];
  const sourceProfile = sourcePart.collision?.validatedConnectionStudProfile;
  if (sourceProfile !== undefined) {
    failures.push(`the source part already declared validated stud profile ${sourceProfile}`);
  }
  const profile = part.collision.validatedConnectionStudProfile;
  if (profile !== entry.addedValidatedConnectionStudProfile) {
    failures.push(
      `current truth declares validated stud profile ${String(profile)}, not the reviewed ${entry.addedValidatedConnectionStudProfile}`,
    );
  }
  const isMatchingStud = (primitive: CollisionPrimitive): primitive is CollisionCylinder =>
    primitive.kind === "cylinder" && primitive.tag === "stud" && primitive.id === entry.portId;
  const cylinders = part.collision.primitives.filter(isMatchingStud);
  if (cylinders.length === 0) failures.push("current truth has no stud cylinder for it");
  for (const { radiusLdu, validatedConnectionProfileRadiusLdu } of cylinders) {
    if (
      validatedConnectionProfileRadiusLdu === undefined ||
      validatedConnectionProfileRadiusLdu > radiusLdu
    ) {
      failures.push(
        `stud cylinder profile radius ${String(validatedConnectionProfileRadiusLdu)} is not at most its measured radius ${radiusLdu}, so the profile would not only relax collision`,
      );
    }
  }
  const control = digestOf(part);
  if (control !== delta.targetDigest) {
    failures.push(
      `projecting the part alone gives ${String(control)}, not the derived target ${String(delta.targetDigest)}, so this proof cannot vouch for the change`,
    );
    return failures;
  }
  const without = <T extends object>(value: T, field: string): T =>
    Object.fromEntries(Object.entries(value).filter(([name]) => name !== field)) as T;
  const stripped = digestOf({
    ...part,
    collision: {
      ...without(part.collision, "validatedConnectionStudProfile"),
      primitives: part.collision.primitives.map((primitive) =>
        isMatchingStud(primitive)
          ? without(primitive, "validatedConnectionProfileRadiusLdu")
          : primitive,
      ),
    },
  });
  if (stripped !== delta.sourceDigest) {
    failures.push(
      `current truth minus the ${String(profile)} profile digests to ${String(stripped)}, not the source ${String(delta.sourceDigest)}, so more than the profile changed`,
    );
  }
  return failures;
}
