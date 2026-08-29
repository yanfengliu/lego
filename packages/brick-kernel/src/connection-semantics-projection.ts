import type { ConnectorKind, PartDefinition } from "@lego-studio/catalog";

import { canonicalDigest, canonicalStringify } from "./canonical.ts";

type Sha256Digest = `sha256:${string}`;

interface HistoricalConnectorPairRule {
  readonly male: ConnectorKind;
  readonly female: ConnectorKind;
  readonly allowedRotation: "fixed" | "quarterTurns" | "continuous";
  readonly articulation: "rigid" | "revolute";
  readonly axisMatching?: "opposed" | "collinear";
}

interface HistoricalPartDefinition {
  readonly id: string;
  readonly connectors: readonly {
    readonly id: string;
    readonly kind: ConnectorKind;
    readonly geometryRole: string;
    readonly profileId: string;
    readonly gender?: "male" | "female";
    readonly positionLdu: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
    readonly orientationId: string;
    readonly capacity: 1;
    readonly compatibleKinds: readonly ConnectorKind[];
  }[];
  readonly collision: {
    readonly validatedConnectionStudProfile?: string;
    readonly primitives: readonly Record<string, unknown>[];
    readonly allowances: readonly (Record<string, unknown> & { readonly portId: string })[];
    readonly throughAxleBoreAllowances?: readonly (Record<string, unknown> & {
      readonly portId: string;
    })[];
  };
}

export interface ConnectionSemanticsEndpointDelta {
  readonly partId: string;
  readonly portId: string;
  readonly sourceDigest: Sha256Digest | null;
  readonly targetDigest: Sha256Digest | null;
}

export interface ConnectionSemanticsPairDelta {
  readonly male: ConnectorKind;
  readonly female: ConnectorKind;
  readonly sourceDigest: Sha256Digest | null;
  readonly targetDigest: Sha256Digest | null;
}

export interface ProjectedConnectionSemantics {
  readonly endpointCount: number;
  readonly endpointMapDigest: Sha256Digest;
  readonly endpointDigests: ReadonlyMap<string, Sha256Digest>;
  readonly pairCount: number;
  readonly pairMapDigest: Sha256Digest;
  readonly pairDigests: ReadonlyMap<string, Sha256Digest>;
}

export interface ConnectionSemanticsProjectionOptions {
  readonly semanticConnectorKinds?: readonly ConnectorKind[];
}

const GENDER_BY_KIND: Readonly<Record<ConnectorKind, "male" | "female">> = Object.freeze({
  stud: "male",
  undersideClutch: "female",
  axle: "male",
  axleHole: "female",
  blindAxleHole: "female",
  pin: "male",
  pinHole: "female",
  bar: "male",
  clip: "female",
  hinge: "male",
  hingeSocket: "female",
});

const LEGACY_STUD_CLUTCH_RULE = Object.freeze({
  male: "stud",
  female: "undersideClutch",
  allowedRotation: "quarterTurns",
  articulation: "rigid",
  axisMatching: "opposed",
} as const);

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedCanonical<T>(values: readonly T[]): readonly T[] {
  return [...values].sort((left, right) =>
    compareStrings(canonicalStringify(left), canonicalStringify(right)),
  );
}

function normalizePairRules(
  pairRules: readonly HistoricalConnectorPairRule[] | undefined,
  mode: "live-strict" | "reviewed-historical",
): readonly {
  readonly male: ConnectorKind;
  readonly female: ConnectorKind;
  readonly allowedRotation: "fixed" | "quarterTurns" | "continuous";
  readonly articulation: "rigid" | "revolute";
  readonly axisMatching: "opposed" | "collinear" | null;
}[] {
  const declared =
    pairRules === undefined || pairRules.length === 0 ? [LEGACY_STUD_CLUTCH_RULE] : pairRules;
  return sortedCanonical(
    declared.map((rule) => ({
      // Retain every own field so a future runtime-semantic addition moves the
      // reviewed root instead of falling outside this projection unnoticed.
      ...rule,
      male: rule.male,
      female: rule.female,
      allowedRotation: rule.allowedRotation,
      articulation: rule.articulation,
      // Before axisMatching was serialized, the validator required opposing
      // axes. Only the reviewed historical projection may normalize that old
      // representation; a missing live field must move the target root.
      axisMatching: rule.axisMatching ?? (mode === "reviewed-historical" ? "opposed" : null),
    })),
  );
}

export function connectionEndpointKey(partId: string, portId: string): string {
  return `${partId}\0${portId}`;
}

export function connectionPairKey(male: ConnectorKind, female: ConnectorKind): string {
  return `${male}\0${female}`;
}

export function projectConnectionSemantics(
  parts: readonly HistoricalPartDefinition[] | readonly PartDefinition[],
  pairRules: readonly HistoricalConnectorPairRule[] | undefined,
  mode: "live-strict" | "reviewed-historical",
  options: ConnectionSemanticsProjectionOptions = {},
): ProjectedConnectionSemantics {
  const connectorKinds = new Set<ConnectorKind>();
  for (const part of parts) {
    for (const connector of part.connectors) connectorKinds.add(connector.kind);
  }
  const effectivePairRules = normalizePairRules(pairRules, mode);
  const semanticConnectorKinds = new Set(
    mode === "reviewed-historical"
      ? connectorKinds
      : (options.semanticConnectorKinds ?? [...connectorKinds]),
  );
  const endpointPairRules =
    mode === "reviewed-historical"
      ? effectivePairRules
      : effectivePairRules.filter(
          ({ male, female }) =>
            semanticConnectorKinds.has(male) && semanticConnectorKinds.has(female),
        );
  const reachablePairRules = endpointPairRules.filter(
    ({ male, female }) => connectorKinds.has(male) && connectorKinds.has(female),
  );
  const endpointEntries: [string, Sha256Digest][] = [];

  for (const part of parts) {
    for (const connector of part.connectors) {
      const matchingStudPrimitives =
        connector.kind === "stud"
          ? part.collision.primitives.filter(
              (primitive) => primitive.tag === "stud" && primitive.id === connector.id,
            )
          : [];
      const allowances =
        connector.kind === "undersideClutch"
          ? part.collision.allowances.filter(({ portId }) => portId === connector.id)
          : [];
      const throughAxleBoreAllowances =
        connector.kind === "axleHole"
          ? part.collision.throughAxleBoreAllowances?.filter(
              ({ portId }) => portId === connector.id,
            )
          : undefined;
      const endpoint = {
        connector: {
          // Retain every own field for the same fail-closed reason as pair
          // rules, then normalize the fields whose historical encoding differs.
          ...connector,
          id: connector.id,
          kind: connector.kind,
          geometryRole: connector.geometryRole,
          profileId: connector.profileId,
          gender:
            connector.gender ??
            (mode === "reviewed-historical" ? GENDER_BY_KIND[connector.kind] : null),
          positionLdu: connector.positionLdu,
          normal: connector.normal,
          orientationId: connector.orientationId,
          capacity: connector.capacity,
          // Reviewed historical rows preserve the imported source projection
          // exactly. Live target projections are scoped to the source roster,
          // so a future connector kind absent from that roster cannot silently
          // reinterpret an old endpoint during migration.
          compatibleKinds:
            mode === "reviewed-historical"
              ? [...connector.compatibleKinds].sort(compareStrings)
              : connector.compatibleKinds
                  .filter((kind) => semanticConnectorKinds.has(kind))
                  .sort(compareStrings),
        },
        pairRules: endpointPairRules.filter(
          ({ male, female }) => male === connector.kind || female === connector.kind,
        ),
        allowances: sortedCanonical(allowances),
        ...(throughAxleBoreAllowances === undefined
          ? {}
          : { throughAxleBoreAllowances: sortedCanonical(throughAxleBoreAllowances) }),
        matchingStudPrimitives: sortedCanonical(matchingStudPrimitives),
        ...(connector.kind === "stud" && part.collision.validatedConnectionStudProfile !== undefined
          ? {
              validatedConnectionStudProfile: part.collision.validatedConnectionStudProfile,
            }
          : {}),
      };
      endpointEntries.push([
        connectionEndpointKey(part.id, connector.id),
        canonicalDigest(endpoint),
      ]);
    }
  }
  endpointEntries.sort(([left], [right]) => compareStrings(left, right));

  const pairEntries: [string, Sha256Digest][] = reachablePairRules.map((rule) => [
    connectionPairKey(rule.male, rule.female),
    canonicalDigest(rule),
  ]);
  pairEntries.sort(([left], [right]) => compareStrings(left, right));

  return {
    endpointCount: endpointEntries.length,
    endpointMapDigest: canonicalDigest(endpointEntries),
    endpointDigests: new Map(endpointEntries),
    pairCount: pairEntries.length,
    pairMapDigest: canonicalDigest(pairEntries),
    pairDigests: new Map(pairEntries),
  };
}

export function diffConnectionPairs(
  source: ProjectedConnectionSemantics,
  target: ProjectedConnectionSemantics,
): readonly ConnectionSemanticsPairDelta[] {
  const keys = new Set([...source.pairDigests.keys(), ...target.pairDigests.keys()]);
  const deltas: ConnectionSemanticsPairDelta[] = [];
  for (const key of [...keys].sort(compareStrings)) {
    const sourceDigest = source.pairDigests.get(key) ?? null;
    const targetDigest = target.pairDigests.get(key) ?? null;
    if (sourceDigest === targetDigest) continue;
    const separator = key.indexOf("\0");
    deltas.push({
      male: key.slice(0, separator) as ConnectorKind,
      female: key.slice(separator + 1) as ConnectorKind,
      sourceDigest,
      targetDigest,
    });
  }
  return deltas;
}

export function diffConnectionSemantics(
  source: ProjectedConnectionSemantics,
  target: ProjectedConnectionSemantics,
): readonly ConnectionSemanticsEndpointDelta[] {
  const keys = new Set([...source.endpointDigests.keys(), ...target.endpointDigests.keys()]);
  const deltas: ConnectionSemanticsEndpointDelta[] = [];
  for (const key of [...keys].sort(compareStrings)) {
    const sourceDigest = source.endpointDigests.get(key) ?? null;
    const targetDigest = target.endpointDigests.get(key) ?? null;
    if (sourceDigest === targetDigest) continue;
    const separator = key.indexOf("\0");
    deltas.push({
      partId: key.slice(0, separator),
      portId: key.slice(separator + 1),
      sourceDigest,
      targetDigest,
    });
  }
  return deltas;
}
