import { getPartDefinition } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  canonicalDigest,
  createEmptyBrickDocument,
  createPartInstance,
  deepFreeze,
  documentStructuralHash,
  findCatalogCollisions,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import {
  enumeratePlacements,
  type PlacementCandidate,
  type PlacementEnumeration,
  type PlacementEnumerationOptions,
} from "../src/assembly/enumerate-placements";
import { protocolConnectionKindForCatalogPorts } from "../src/assembly/placement-connection-kind";
import { capacityEndpointForConnector, reserveConnectorCapacity } from "../src/connector-capacity";
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
import { realBuildPrefix50ProjectionCommitment } from "./real-build-prefix50-projection";
import {
  REAL_BUILD_PREFIX50_STEP50_ROOT_ORDINALS,
  requireRealBuildPrefix50Step50AtomicRootInput,
  type RealBuildPrefix50Step50AtomicRootInput,
} from "./real-build-prefix50-suffix-root-validation";
import {
  prefix50TemporaryOperations,
  prefix50TemporaryPartId,
} from "./real-build-prefix50-temporary-placement";

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const results = new WeakSet<object>();

export interface RealBuildPrefix50Step50RootConnection {
  readonly occurrence312PortId: string;
  readonly occurrence313PortId: string;
  readonly connectionKind: "stud-tube";
}

export interface RealBuildPrefix50Step50RootDirection {
  readonly baseOrdinal: 312 | 313;
  readonly candidateOrdinal: 312 | 313;
  readonly exactCandidateCount: 1;
  readonly counts: PlacementEnumeration["counts"];
}

export interface RealBuildPrefix50Step50AtomicRoot {
  readonly schemaVersion: "lego.real-build-prefix50-step50-atomic-root/1";
  readonly authority: "none";
  readonly completionAuthority: false;
  readonly atomic: true;
  readonly sourceSetId: "6651557";
  readonly printedStepNumber: 50;
  readonly step51Inspected: false;
  readonly ordinals: readonly [312, 313];
  readonly witnesses: readonly [
    RealBuildAutomaticPlacementWitness,
    RealBuildAutomaticPlacementWitness,
  ];
  readonly childSearchDocument: BrickDocumentV1;
  readonly childSearchDocumentHash: `sha256:${string}`;
  readonly proof: Readonly<{
    readonly schemaVersion: "lego.real-build-prefix50-step50-atomic-root-proof/1";
    readonly projectionCommitment: `sha256:${string}`;
    readonly suffixPlanCommitment: `sha256:${string}`;
    readonly parentDocumentHash: `sha256:${string}`;
    readonly parentTruthDigest: `sha256:${string}`;
    readonly rootRowsCommitment: `sha256:${string}`;
    readonly sourceOrder: "312-then-313";
    readonly reciprocalEnumeration: "complete-one-exact-candidate-each-direction";
    readonly directions: readonly [
      RealBuildPrefix50Step50RootDirection,
      RealBuildPrefix50Step50RootDirection,
    ];
    readonly normalizedConnections: readonly RealBuildPrefix50Step50RootConnection[];
    readonly normalizedConnectionSetCommitment: `sha256:${string}`;
    readonly capacityClaimCount: number;
    readonly collisionFindingCount: 0;
  }>;
  readonly accounting: Readonly<{
    readonly nodeDelta: 2;
    readonly enumerationDelta: 2;
    readonly orientationNarrowedEnumerationDelta: 2;
    readonly nodesAfter: number;
    readonly enumerationsAfter: number;
    readonly orientationNarrowedEnumerationsAfter: number;
  }>;
  readonly commitment: `sha256:${string}`;
}

export type RealBuildPrefix50Step50RootProbeEnumerator = (
  document: BrickDocumentV1,
  catalogPartId: string,
  options: PlacementEnumerationOptions,
) => PlacementEnumeration;

function probeDocument(
  parentTruthDigest: `sha256:${string}`,
  root: RealBuildPrefix50TargetOccurrence,
): { readonly document: BrickDocumentV1; readonly part: PartInstance } {
  const empty = createEmptyBrickDocument({
    id: `prefix50-step50-root-probe-${root.ordinal}`,
    name: `Prefix 50 Step 50 isolated root probe ${root.ordinal}`,
    maxParts: 9,
  });
  if (canonicalDigest(empty.truth) !== parentTruthDigest) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root probe does not retain the Step-49 parent truth snapshot.",
    );
  }
  const part = createPartInstance({
    id: prefix50TemporaryPartId(root.ordinal),
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
  enumerate: RealBuildPrefix50Step50RootProbeEnumerator,
): { readonly exact: PlacementCandidate; readonly enumeration: PlacementEnumeration } {
  budget.nodes += 1;
  if (budget.nodes > REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES) {
    throw new RangeError(
      `Prefix-50 Step-50 atomic root exceeded ${REAL_BUILD_PREFIX50_MAXIMUM_CUMULATIVE_SEARCH_NODES} shared search nodes.`,
    );
  }
  budget.enumerations += 1;
  budget.orientationNarrowedEnumerations += 1;
  const { document, part } = probeDocument(parentTruthDigest, root);
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
      `Prefix-50 Step-50 atomic root requires exactly one exact occurrence-${candidate.ordinal} candidate against isolated occurrence ${root.ordinal}; received ${exact.length}.`,
    );
  }
  if (
    exact[0]!.connections.length === 0 ||
    exact[0]!.connections.some(({ targetPartId }) => targetPartId !== part.id)
  ) {
    throw new TypeError(
      `Prefix-50 Step-50 atomic root occurrence ${candidate.ordinal} must connect only to isolated occurrence ${root.ordinal}.`,
    );
  }
  return { exact: exact[0]!, enumeration };
}

function normalizeConnections(
  baseOrdinal: 312 | 313,
  candidate: PlacementCandidate,
  rows: RealBuildPrefix50Step50AtomicRootInput["rootRows"],
): RealBuildPrefix50Step50RootConnection[] {
  const [row312, row313] = rows;
  const base = baseOrdinal === 312 ? row312 : row313;
  const added = baseOrdinal === 312 ? row313 : row312;
  return candidate.connections
    .map((connection) => {
      const kind = protocolConnectionKindForCatalogPorts(
        base.partIdentity.reconciledCatalogPartId,
        connection.targetPortId,
        added.partIdentity.reconciledCatalogPartId,
        connection.candidatePortId,
      );
      if (kind !== "stud-tube") {
        throw new TypeError(
          `Prefix-50 Step-50 atomic root requires stud-tube reciprocal edges, not ${kind}.`,
        );
      }
      return baseOrdinal === 312
        ? {
            occurrence312PortId: connection.targetPortId,
            occurrence313PortId: connection.candidatePortId,
            connectionKind: kind,
          }
        : {
            occurrence312PortId: connection.candidatePortId,
            occurrence313PortId: connection.targetPortId,
            connectionKind: kind,
          };
    })
    .sort(
      (left, right) =>
        left.occurrence312PortId.localeCompare(right.occurrence312PortId) ||
        left.occurrence313PortId.localeCompare(right.occurrence313PortId),
    );
}

function proveCapacityAndCollision(
  rows: RealBuildPrefix50Step50AtomicRootInput["rootRows"],
  connections: readonly RealBuildPrefix50Step50RootConnection[],
): number {
  const parts = rows.map((row) =>
    createPartInstance({
      id: prefix50TemporaryPartId(row.ordinal),
      catalogPartId: row.partIdentity.reconciledCatalogPartId,
      colorId: row.colorId,
      transform: row.targetTransform,
      source: "ai",
      sourceId: `prefix50-occurrence-${row.ordinal}`,
    }),
  ) as [PartInstance, PartInstance];
  const occupied = new Set<string>();
  const edges: ConnectionEdge[] = [];
  for (const [index, connection] of connections.entries()) {
    const connectors = [
      getPartDefinition(parts[0].catalogPartId)?.connectors.find(
        ({ id }) => id === connection.occurrence312PortId,
      ),
      getPartDefinition(parts[1].catalogPartId)?.connectors.find(
        ({ id }) => id === connection.occurrence313PortId,
      ),
    ] as const;
    if (
      connectors[0] === undefined ||
      connectors[1] === undefined ||
      !reserveConnectorCapacity(
        [
          capacityEndpointForConnector(parts[0].id, connectors[0]),
          capacityEndpointForConnector(parts[1].id, connectors[1]),
        ],
        occupied,
      )
    ) {
      throw new TypeError(
        "Prefix-50 Step-50 atomic root reciprocal edges exceed exact connector capacity.",
      );
    }
    edges.push({
      id: `prefix50-step50-root-edge-${index + 1}`,
      kind: connection.connectionKind,
      a: { partId: parts[0].id, portId: connection.occurrence312PortId },
      b: { partId: parts[1].id, portId: connection.occurrence313PortId },
      provenance: { source: "ai", sourceId: "prefix50-step50-root" },
    });
  }
  const findings = findCatalogCollisions(parts, edges);
  if (findings.length !== 0) {
    throw new TypeError(
      `Prefix-50 Step-50 atomic root has ${findings.length} exact root-pair collision findings.`,
    );
  }
  return occupied.size;
}

function witnesses(
  rows: RealBuildPrefix50Step50AtomicRootInput["rootRows"],
  connections: readonly RealBuildPrefix50Step50RootConnection[],
): RealBuildPrefix50Step50AtomicRoot["witnesses"] {
  return intrinsicRealBuildFreeze([
    intrinsicRealBuildFreeze({
      catalogPartId: rows[0].partIdentity.reconciledCatalogPartId,
      colorId: rows[0].colorId,
      transform: rows[0].targetTransform,
      connections: intrinsicRealBuildFreeze([]),
    }),
    intrinsicRealBuildFreeze({
      catalogPartId: rows[1].partIdentity.reconciledCatalogPartId,
      colorId: rows[1].colorId,
      transform: rows[1].targetTransform,
      connections: intrinsicRealBuildFreeze(
        connections.map((connection) =>
          intrinsicRealBuildFreeze({
            target: intrinsicRealBuildFreeze({ kind: "witness" as const, witnessIndex: 0 }),
            targetPortId: connection.occurrence312PortId,
            candidatePortId: connection.occurrence313PortId,
            connectionKind: connection.connectionKind,
          }),
        ),
      ),
    }),
  ]) as unknown as RealBuildPrefix50Step50AtomicRoot["witnesses"];
}

function constructWithEnumerator(
  unsafeInput: RealBuildPrefix50Step50AtomicRootInput,
  enumerate: RealBuildPrefix50Step50RootProbeEnumerator,
): RealBuildPrefix50Step50AtomicRoot {
  const { projection, plan, parentDocumentHash, parentTruthDigest, rows, budget } =
    requireRealBuildPrefix50Step50AtomicRootInput(unsafeInput);
  const before = {
    nodes: budget.nodes,
    enumerations: budget.enumerations,
    orientationNarrowedEnumerations: budget.orientationNarrowedEnumerations,
  };
  const forward = enumerateExact(rows[0], rows[1], parentTruthDigest, budget, enumerate);
  const reverse = enumerateExact(rows[1], rows[0], parentTruthDigest, budget, enumerate);
  const forwardConnections = normalizeConnections(312, forward.exact, rows);
  const reverseConnections = normalizeConnections(313, reverse.exact, rows);
  if (
    forwardConnections.length === 0 ||
    new Set(forwardConnections.map((connection) => canonicalDigest(connection))).size !==
      forwardConnections.length ||
    canonicalDigest(forwardConnections) !== canonicalDigest(reverseConnections)
  ) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root requires identical nonempty reciprocal endpoint sets.",
    );
  }
  const capacityClaimCount = proveCapacityAndCollision(rows, forwardConnections);
  const rootWitnesses = witnesses(rows, forwardConnections);
  const rootProbe = probeDocument(parentTruthDigest, rows[0]).document;
  const childSearchDocument = deepFreeze(
    applyBuildOperations(rootProbe, prefix50TemporaryOperations(rootProbe, rows[1], forward.exact)),
  );
  const childReport = validateBrickDocument(childSearchDocument);
  if (
    childSearchDocument.parts.length !== 2 ||
    childSearchDocument.connections.length !== forwardConnections.length ||
    !childReport.documentGloballyValid ||
    childReport.issues.some(({ severity }) => severity === "blocking")
  ) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root search world must be the exact connected hard-valid two-part phase-90 root.",
    );
  }
  if (
    budget.nodes !== before.nodes + 2 ||
    budget.enumerations !== before.enumerations + 2 ||
    budget.orientationNarrowedEnumerations !== before.orientationNarrowedEnumerations + 2
  ) {
    throw new TypeError("Prefix-50 Step-50 atomic root lost exact shared search accounting.");
  }
  const normalizedConnections = intrinsicRealBuildFreeze(
    forwardConnections.map((connection) => intrinsicRealBuildFreeze({ ...connection })),
  );
  const proof = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-prefix50-step50-atomic-root-proof/1" as const,
    projectionCommitment: realBuildPrefix50ProjectionCommitment(projection),
    suffixPlanCommitment: plan.commitment,
    parentDocumentHash,
    parentTruthDigest,
    rootRowsCommitment: canonicalDigest(rows),
    sourceOrder: "312-then-313" as const,
    reciprocalEnumeration: "complete-one-exact-candidate-each-direction" as const,
    directions: intrinsicRealBuildFreeze([
      intrinsicRealBuildFreeze({
        baseOrdinal: 312 as const,
        candidateOrdinal: 313 as const,
        exactCandidateCount: 1 as const,
        counts: intrinsicRealBuildFreeze({ ...forward.enumeration.counts }),
      }),
      intrinsicRealBuildFreeze({
        baseOrdinal: 313 as const,
        candidateOrdinal: 312 as const,
        exactCandidateCount: 1 as const,
        counts: intrinsicRealBuildFreeze({ ...reverse.enumeration.counts }),
      }),
    ]) as unknown as RealBuildPrefix50Step50AtomicRoot["proof"]["directions"],
    normalizedConnections,
    normalizedConnectionSetCommitment: canonicalDigest(normalizedConnections),
    capacityClaimCount,
    collisionFindingCount: 0 as const,
  });
  const body = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-prefix50-step50-atomic-root/1" as const,
    authority: "none" as const,
    completionAuthority: false as const,
    atomic: true as const,
    sourceSetId: "6651557" as const,
    printedStepNumber: 50 as const,
    step51Inspected: false as const,
    ordinals: intrinsicRealBuildFreeze(REAL_BUILD_PREFIX50_STEP50_ROOT_ORDINALS),
    witnesses: rootWitnesses,
    childSearchDocument,
    childSearchDocumentHash: documentStructuralHash(childSearchDocument),
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

export function constructRealBuildPrefix50Step50AtomicRoot(
  input: RealBuildPrefix50Step50AtomicRootInput,
): RealBuildPrefix50Step50AtomicRoot {
  return constructWithEnumerator(input, enumeratePlacements);
}

export function requireRealBuildPrefix50Step50AtomicRoot(
  value: unknown,
): RealBuildPrefix50Step50AtomicRoot {
  if (value === null || typeof value !== "object" || !results.has(value)) {
    throw new TypeError(
      "Prefix-50 Step-50 atomic root requires its exact branded authority-free result.",
    );
  }
  return value as RealBuildPrefix50Step50AtomicRoot;
}

export const __testOnly: Readonly<{
  constructWithEnumerator?: (
    input: RealBuildPrefix50Step50AtomicRootInput,
    enumerate: RealBuildPrefix50Step50RootProbeEnumerator,
  ) => RealBuildPrefix50Step50AtomicRoot;
}> = intrinsicRealBuildFreeze(TEST_MODE ? { constructWithEnumerator } : {});
