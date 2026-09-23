import {
  canonicalDigest,
  createEmptyBrickDocument,
  createPartInstance,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, PartInstance, RigidTransform } from "@lego-studio/protocol";

import {
  enumeratePlacements,
  type PlacementCandidate,
  type PlacementEnumeration,
  type PlacementEnumerationOptions,
} from "../src/assembly/enumerate-placements";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES,
  REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50TargetOccurrence,
} from "./real-build-prefix50-exact-compiler-contract";
import {
  requireRealBuildPrefix50CompleteEnumeration,
  sameTransform,
} from "./real-build-prefix50-exact-compiler-foundation";
import type { RealBuildPrefix50VerifiedProjection } from "./real-build-prefix50-projection";
import {
  normalizeRealBuildPrefix50SubBuildRootConnections,
  proveRealBuildPrefix50SubBuildRootCapacityAndCollision,
  type RealBuildPrefix50NormalizedRootConnection,
} from "./real-build-prefix50-subbuild-root-proof";
import {
  REAL_BUILD_PREFIX50_SUBBUILD_ROOT_ORDINALS,
  requireRealBuildPrefix50SubBuildRootInput,
  type RealBuildPrefix50SubBuildRootInput,
} from "./real-build-prefix50-subbuild-root-validation";

export type { RealBuildPrefix50NormalizedRootConnection } from "./real-build-prefix50-subbuild-root-proof";
export type { RealBuildPrefix50SubBuildRootInput } from "./real-build-prefix50-subbuild-root-validation";

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const results = new WeakSet<object>();

export interface RealBuildPrefix50AtomicSubBuildRoot {
  readonly schemaVersion: "lego.real-build-prefix50-atomic-subbuild-root/1";
  readonly authority: "none";
  readonly atomic: true;
  readonly sourceSetId: "6651557";
  readonly printedStepNumber: 38;
  readonly ordinals: readonly [258, 259];
  readonly witnesses: readonly [
    RealBuildAutomaticPlacementWitness,
    RealBuildAutomaticPlacementWitness,
  ];
  readonly proof: Readonly<{
    schemaVersion: "lego.real-build-prefix50-atomic-subbuild-root-proof/1";
    projectionCommitment: `sha256:${string}`;
    childSubBuildWindowCommitment: `sha256:${string}`;
    parentTruthDigest: `sha256:${string}`;
    rootRowsCommitment: `sha256:${string}`;
    sourceOrder: "258-then-259";
    reciprocalEnumeration: "complete-one-exact-candidate-each-direction";
    directions: readonly [
      RealBuildPrefix50SubBuildRootDirection,
      RealBuildPrefix50SubBuildRootDirection,
    ];
    normalizedConnections: readonly RealBuildPrefix50NormalizedRootConnection[];
    normalizedConnectionSetCommitment: `sha256:${string}`;
    capacityClaimCount: number;
    collisionFindingCount: 0;
  }>;
  readonly accounting: Readonly<{
    nodeDelta: 2;
    enumerationDelta: 2;
    orientationNarrowedEnumerationDelta: 2;
    nodesAfter: number;
    enumerationsAfter: number;
    orientationNarrowedEnumerationsAfter: number;
  }>;
  readonly commitment: `sha256:${string}`;
}

export interface RealBuildPrefix50SubBuildRootDirection {
  readonly baseOrdinal: 258 | 259;
  readonly candidateOrdinal: 258 | 259;
  readonly exactCandidateCount: 1;
  readonly counts: PlacementEnumeration["counts"];
}

export type RealBuildPrefix50SubBuildRootProbeEnumerator = (
  document: BrickDocumentV1,
  catalogPartId: string,
  options: PlacementEnumerationOptions,
) => PlacementEnumeration;

function probeDocument(
  parentTruthDigest: `sha256:${string}`,
  root: RealBuildPrefix50TargetOccurrence,
): { readonly document: BrickDocumentV1; readonly part: PartInstance } {
  const empty = createEmptyBrickDocument({
    id: `prefix50-subbuild-root-probe-${root.ordinal}`,
    name: `Prefix 50 isolated SubBuild root probe ${root.ordinal}`,
    maxParts: 2,
  });
  if (canonicalDigest(empty.truth) !== parentTruthDigest) {
    throw new TypeError(
      "Prefix-50 atomic SubBuild root parent draft does not retain the current exact truth snapshot.",
    );
  }
  const part = createPartInstance({
    id: `prefix50-subbuild-root-${root.ordinal}`,
    catalogPartId: root.partIdentity.reconciledCatalogPartId,
    colorId: root.colorId,
    transform: root.targetTransform,
    submodelId: empty.submodels[0]!.id,
    stepId: empty.steps[0]!.id,
    source: "ai",
    sourceId: `prefix50-occurrence-${root.ordinal}`,
  });
  return {
    part,
    document: intrinsicRealBuildFreeze({
      ...empty,
      parts: intrinsicRealBuildFreeze([part]),
      submodels: intrinsicRealBuildFreeze([
        intrinsicRealBuildFreeze({ ...empty.submodels[0]!, partIds: [part.id] }),
      ]),
      steps: intrinsicRealBuildFreeze([
        intrinsicRealBuildFreeze({ ...empty.steps[0]!, partIds: [part.id] }),
      ]),
    }),
  };
}

function accountEnumeration(
  budget: RealBuildPrefix50SearchBudget,
  occurrence: RealBuildPrefix50TargetOccurrence,
  enumeration: PlacementEnumeration,
  exactCandidateCount: number,
): void {
  const previous = budget.targetAttempts.get(occurrence.ordinal);
  budget.targetAttempts.set(occurrence.ordinal, {
    attempts: (previous?.attempts ?? 0) + 1,
    matches: (previous?.matches ?? 0) + exactCandidateCount,
    lastCounts: enumeration.counts,
  });
}

function enumerateExact(
  root: RealBuildPrefix50TargetOccurrence,
  candidate: RealBuildPrefix50TargetOccurrence,
  parentTruthDigest: `sha256:${string}`,
  budget: RealBuildPrefix50SearchBudget,
  enumerate: RealBuildPrefix50SubBuildRootProbeEnumerator,
): { readonly exact: PlacementCandidate; readonly enumeration: PlacementEnumeration } {
  budget.nodes += 1;
  if (budget.nodes > REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES) {
    throw new RangeError(
      `Prefix-50 atomic SubBuild root exceeded ${REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES} shared search nodes.`,
    );
  }
  budget.enumerations += 1;
  budget.orientationNarrowedEnumerations += 1;
  const { document, part } = probeDocument(parentTruthDigest, root);
  if (document.parts.length !== 1 || document.parts[0] !== part) {
    throw new TypeError("Prefix-50 atomic SubBuild root probe is not an isolated one-part world.");
  }
  const enumeration = requireRealBuildPrefix50CompleteEnumeration(
    enumerate(document, candidate.partIdentity.reconciledCatalogPartId, {
      orientationIds: [candidate.targetTransform.orientationId],
      includeBuildPlate: false,
      allowDetached: false,
      maxDistinctTransforms: REAL_BUILD_PREFIX50_MAXIMUM_DISTINCT_TRANSFORMS,
    }),
  );
  const exact = enumeration.candidates.filter(({ transform }) =>
    sameTransform(transform, candidate.targetTransform),
  );
  accountEnumeration(budget, candidate, enumeration, exact.length);
  if (exact.length !== 1) {
    throw new TypeError(
      `Prefix-50 atomic SubBuild root requires exactly one exact occurrence-${candidate.ordinal} candidate against isolated occurrence ${root.ordinal}; received ${exact.length}.`,
    );
  }
  if (
    exact[0]!.connections.length === 0 ||
    exact[0]!.connections.some(({ targetPartId }) => targetPartId !== part.id)
  ) {
    throw new TypeError(
      `Prefix-50 atomic SubBuild root occurrence ${candidate.ordinal} must connect only to isolated occurrence ${root.ordinal}; no edge or a third body is forbidden.`,
    );
  }
  return { exact: exact[0]!, enumeration };
}

function buildWitnesses(
  rows: readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence],
  connections: readonly RealBuildPrefix50NormalizedRootConnection[],
): readonly [RealBuildAutomaticPlacementWitness, RealBuildAutomaticPlacementWitness] {
  const frozenTransform = (transform: RigidTransform): RigidTransform =>
    intrinsicRealBuildFreeze({
      positionLdu: intrinsicRealBuildFreeze([...transform.positionLdu]) as readonly [
        number,
        number,
        number,
      ],
      orientationId: transform.orientationId,
    });
  return intrinsicRealBuildFreeze([
    intrinsicRealBuildFreeze({
      catalogPartId: rows[0].partIdentity.reconciledCatalogPartId,
      colorId: rows[0].colorId,
      transform: frozenTransform(rows[0].targetTransform),
      connections: intrinsicRealBuildFreeze([]),
    }),
    intrinsicRealBuildFreeze({
      catalogPartId: rows[1].partIdentity.reconciledCatalogPartId,
      colorId: rows[1].colorId,
      transform: frozenTransform(rows[1].targetTransform),
      connections: intrinsicRealBuildFreeze(
        connections.map((connection) =>
          intrinsicRealBuildFreeze({
            target: intrinsicRealBuildFreeze({ kind: "witness" as const, witnessIndex: 0 }),
            targetPortId: connection.occurrence258PortId,
            candidatePortId: connection.occurrence259PortId,
            connectionKind: connection.connectionKind,
          }),
        ),
      ),
    }),
  ]) as unknown as readonly [
    RealBuildAutomaticPlacementWitness,
    RealBuildAutomaticPlacementWitness,
  ];
}

function constructWithEnumerator(
  unsafeInput: RealBuildPrefix50SubBuildRootInput,
  enumerate: RealBuildPrefix50SubBuildRootProbeEnumerator,
): RealBuildPrefix50AtomicSubBuildRoot {
  const { projection, window, parentTruthDigest, rows, budget } =
    requireRealBuildPrefix50SubBuildRootInput(unsafeInput);
  const before = {
    nodes: budget.nodes,
    enumerations: budget.enumerations,
    orientationNarrowedEnumerations: budget.orientationNarrowedEnumerations,
  };
  const forward = enumerateExact(rows[0], rows[1], parentTruthDigest, budget, enumerate);
  const reverse = enumerateExact(rows[1], rows[0], parentTruthDigest, budget, enumerate);
  const forwardConnections = normalizeRealBuildPrefix50SubBuildRootConnections(
    258,
    259,
    forward.exact,
    rows,
  );
  const reverseConnections = normalizeRealBuildPrefix50SubBuildRootConnections(
    259,
    258,
    reverse.exact,
    rows,
  );
  if (
    forwardConnections.length === 0 ||
    new Set(forwardConnections.map((connection) => canonicalDigest(connection))).size !==
      forwardConnections.length ||
    canonicalDigest(forwardConnections) !== canonicalDigest(reverseConnections)
  ) {
    throw new TypeError(
      "Prefix-50 atomic SubBuild root requires identical nonempty reciprocal role/port/connection-kind endpoint sets.",
    );
  }
  const capacityClaimCount = proveRealBuildPrefix50SubBuildRootCapacityAndCollision(
    rows,
    forwardConnections,
  );
  const proof = makeProof(
    projection,
    window,
    rows,
    parentTruthDigest,
    forward,
    reverse,
    forwardConnections,
    capacityClaimCount,
  );
  if (
    budget.nodes !== before.nodes + 2 ||
    budget.enumerations !== before.enumerations + 2 ||
    budget.orientationNarrowedEnumerations !== before.orientationNarrowedEnumerations + 2
  ) {
    throw new TypeError("Prefix-50 atomic SubBuild root lost exact shared search accounting.");
  }
  const body = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-prefix50-atomic-subbuild-root/1" as const,
    authority: "none" as const,
    atomic: true as const,
    sourceSetId: "6651557" as const,
    printedStepNumber: 38 as const,
    ordinals: intrinsicRealBuildFreeze(REAL_BUILD_PREFIX50_SUBBUILD_ROOT_ORDINALS),
    witnesses: buildWitnesses(rows, forwardConnections),
    proof,
    accounting: intrinsicRealBuildFreeze({
      nodeDelta: 2 as const,
      enumerationDelta: 2 as const,
      orientationNarrowedEnumerationDelta: 2 as const,
      nodesAfter: budget.nodes,
      enumerationsAfter: budget.enumerations,
      orientationNarrowedEnumerationsAfter: budget.orientationNarrowedEnumerations,
    }),
  });
  const result = intrinsicRealBuildFreeze({ ...body, commitment: canonicalDigest(body) });
  results.add(result);
  return result;
}

function makeProof(
  projection: RealBuildPrefix50VerifiedProjection,
  window: NonNullable<RealBuildPrefix50VerifiedProjection["childSubBuildWindow"]>,
  rows: readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence],
  parentTruthDigest: `sha256:${string}`,
  forward: { readonly exact: PlacementCandidate; readonly enumeration: PlacementEnumeration },
  reverse: { readonly exact: PlacementCandidate; readonly enumeration: PlacementEnumeration },
  connections: readonly RealBuildPrefix50NormalizedRootConnection[],
  capacityClaimCount: number,
): RealBuildPrefix50AtomicSubBuildRoot["proof"] {
  const normalizedConnections = intrinsicRealBuildFreeze(
    connections.map((connection) => intrinsicRealBuildFreeze({ ...connection })),
  );
  const directions = intrinsicRealBuildFreeze([
    intrinsicRealBuildFreeze({
      baseOrdinal: 258 as const,
      candidateOrdinal: 259 as const,
      exactCandidateCount: 1 as const,
      counts: intrinsicRealBuildFreeze({ ...forward.enumeration.counts }),
    }),
    intrinsicRealBuildFreeze({
      baseOrdinal: 259 as const,
      candidateOrdinal: 258 as const,
      exactCandidateCount: 1 as const,
      counts: intrinsicRealBuildFreeze({ ...reverse.enumeration.counts }),
    }),
  ]) as unknown as readonly [
    RealBuildPrefix50SubBuildRootDirection,
    RealBuildPrefix50SubBuildRootDirection,
  ];
  return intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-prefix50-atomic-subbuild-root-proof/1" as const,
    projectionCommitment: canonicalDigest(projection),
    childSubBuildWindowCommitment: canonicalDigest(window),
    parentTruthDigest,
    rootRowsCommitment: canonicalDigest(rows),
    sourceOrder: "258-then-259" as const,
    reciprocalEnumeration: "complete-one-exact-candidate-each-direction" as const,
    directions,
    normalizedConnections,
    normalizedConnectionSetCommitment: canonicalDigest(normalizedConnections),
    capacityClaimCount,
    collisionFindingCount: 0 as const,
  });
}

export function constructRealBuildPrefix50AtomicSubBuildRoot(
  input: RealBuildPrefix50SubBuildRootInput,
): RealBuildPrefix50AtomicSubBuildRoot {
  return constructWithEnumerator(input, enumeratePlacements);
}

export function requireRealBuildPrefix50AtomicSubBuildRoot(
  value: unknown,
): RealBuildPrefix50AtomicSubBuildRoot {
  if (value === null || typeof value !== "object" || !results.has(value)) {
    throw new TypeError(
      "Prefix-50 atomic SubBuild root requires the exact branded frozen result; caller clones and witness forgeries carry no authority.",
    );
  }
  return value as RealBuildPrefix50AtomicSubBuildRoot;
}

export const __testOnly: Readonly<{
  constructWithEnumerator?: (
    input: RealBuildPrefix50SubBuildRootInput,
    enumerate: RealBuildPrefix50SubBuildRootProbeEnumerator,
  ) => RealBuildPrefix50AtomicSubBuildRoot;
}> = intrinsicRealBuildFreeze(TEST_MODE ? { constructWithEnumerator } : {});
