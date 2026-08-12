import {
  BUILTIN_CATALOG_VERSION,
  UPRIGHT_ORIENTATIONS,
  getPartDefinition,
  type LduVector3,
  type OrientationMatrix,
} from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  applyFramePoint as apply,
  composeFrameTransforms,
  frameTransformKey as frameKey,
  invertFrameTransform,
  rigidTransformToFrameTransform,
  rotateFramePoint,
  type FrameTransform,
} from "./real-build-catalog-frame";
import {
  inferSemanticContactKeys,
  type SemanticContactPlacement,
} from "./real-build-target-contacts";
import {
  createTargetRealizationCache,
  type TargetRealizationCache,
} from "./real-build-target-realization-cache";

const MAXIMUM_TARGET_EQUIVALENCE_PLACEMENTS = 1_464;

export interface TargetEquivalencePlacementSide {
  readonly designId: string;
  readonly materialId: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: RigidTransform;
}

export interface TargetEquivalencePlacement {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly expected: TargetEquivalencePlacementSide;
  readonly actual: TargetEquivalencePlacementSide & {
    readonly partId: string;
    readonly stepNumber: number;
  };
}

export interface TargetEquivalenceMismatch {
  readonly identityKey: string;
  readonly stepNumber: number;
  readonly expectedTransform: RigidTransform;
  readonly actualTransform: RigidTransform;
  readonly witness: string;
}

export interface TargetEquivalenceImproperFrame {
  readonly kind:
    "x-reflection" | "xz-diagonal-reflection" | "z-reflection" | "negative-xz-diagonal-reflection";
  readonly determinant: -1;
  readonly positionLdu: LduVector3;
  /** Placements whose connector/collision/allowance/bounds realization reflects exactly. */
  readonly matchedPlacements: number;
  /** Compatible connector pairs inferred from geometry; not document connection annotations. */
  readonly inferredCompatibleContacts: number;
  /** Exact flat triangle+normal topology is independent from the physical realization layers. */
  readonly exactRenderTriangleMatchedPlacements: number;
  readonly firstExactRenderTriangleMismatch: string | null;
}

export interface RealBuildTargetEquivalenceAudit {
  readonly schemaVersion: "lego.real-build-target-equivalence-audit/1";
  readonly catalogVersion: typeof BUILTIN_CATALOG_VERSION;
  readonly status: "proper" | "improper" | "mismatch" | "binding-invalid";
  readonly properFrames: readonly RigidTransform[];
  /** Canonical diagnostic representative only; never input to placement search or scoring. */
  readonly properFrame: RigidTransform | null;
  readonly firstMismatch: TargetEquivalenceMismatch | null;
  readonly improperFrame: TargetEquivalenceImproperFrame | null;
  readonly bindingFailure: string | null;
}

interface PlacementGroup {
  readonly key: string;
  readonly stepNumber: number;
  readonly placements: readonly TargetEquivalencePlacement[];
}

const IDENTITY_FRAME: FrameTransform = {
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  translationLdu: [0, 0, 0],
};

const REFLECTIONS: readonly {
  readonly kind: TargetEquivalenceImproperFrame["kind"];
  readonly matrix: OrientationMatrix;
}[] = [
  { kind: "x-reflection", matrix: [-1, 0, 0, 0, 1, 0, 0, 0, 1] },
  { kind: "xz-diagonal-reflection", matrix: [0, 0, 1, 0, 1, 0, 1, 0, 0] },
  { kind: "z-reflection", matrix: [1, 0, 0, 0, 1, 0, 0, 0, -1] },
  {
    kind: "negative-xz-diagonal-reflection",
    matrix: [0, 0, -1, 0, 1, 0, -1, 0, 0],
  },
];

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

function rotate(matrix: OrientationMatrix, point: LduVector3): LduVector3 {
  return rotateFramePoint({ matrix, translationLdu: [0, 0, 0] }, point);
}

function rigidFrame(frame: FrameTransform): RigidTransform {
  const orientation = UPRIGHT_ORIENTATIONS.find(({ matrix }) =>
    matrix.every((coordinate, index) => coordinate === frame.matrix[index]),
  );
  if (orientation === undefined) {
    throw new TypeError(
      "A proper target-equivalence frame did not resolve to an upright orientation.",
    );
  }
  return { positionLdu: frame.translationLdu, orientationId: orientation.id };
}

function exactMetadata(
  expected: TargetEquivalencePlacementSide,
  actual: TargetEquivalencePlacementSide,
): boolean {
  return (
    expected.designId === actual.designId &&
    expected.materialId === actual.materialId &&
    expected.catalogPartId === actual.catalogPartId &&
    expected.colorId === actual.colorId
  );
}

function validTransform(transform: RigidTransform): boolean {
  return (
    Array.isArray(transform.positionLdu) &&
    transform.positionLdu.length === 3 &&
    transform.positionLdu.every(Number.isSafeInteger) &&
    UPRIGHT_ORIENTATIONS.some(({ id }) => id === transform.orientationId)
  );
}

function bindingFailure(placements: readonly TargetEquivalencePlacement[]): string | null {
  if (placements.length < 1 || placements.length > MAXIMUM_TARGET_EQUIVALENCE_PLACEMENTS) {
    return `Target equivalence needs 1..${MAXIMUM_TARGET_EQUIVALENCE_PLACEMENTS} placements; received ${placements.length}.`;
  }
  const identities = new Set<string>();
  const parts = new Set<string>();
  for (const placement of placements) {
    if (
      placement.identityKey.length < 1 ||
      identities.has(placement.identityKey) ||
      placement.actual.partId.length < 1 ||
      parts.has(placement.actual.partId)
    ) {
      return `Target-equivalence identity ${JSON.stringify(placement.identityKey)} and canonical part ${JSON.stringify(placement.actual.partId)} must each be non-empty and unique.`;
    }
    identities.add(placement.identityKey);
    parts.add(placement.actual.partId);
    if (
      !Number.isSafeInteger(placement.stepNumber) ||
      placement.stepNumber < 1 ||
      placement.actual.stepNumber !== placement.stepNumber
    ) {
      return `Target-equivalence identity ${placement.identityKey} does not retain one positive printed-step owner on both sides.`;
    }
    if (!exactMetadata(placement.expected, placement.actual)) {
      return `Target-equivalence identity ${placement.identityKey} changes design, material, catalog part, or color across the expected/actual boundary.`;
    }
    if (getPartDefinition(placement.expected.catalogPartId) === undefined) {
      return `Target-equivalence identity ${placement.identityKey} names unknown catalog part ${placement.expected.catalogPartId}.`;
    }
    if (
      !validTransform(placement.expected.transform) ||
      !validTransform(placement.actual.transform)
    ) {
      return `Target-equivalence identity ${placement.identityKey} carries a non-upright or non-integral transform.`;
    }
  }
  return null;
}

function placementGroups(placements: readonly TargetEquivalencePlacement[]): PlacementGroup[] {
  const grouped = new Map<string, TargetEquivalencePlacement[]>();
  for (const placement of placements) {
    const key = JSON.stringify([
      placement.stepNumber,
      placement.expected.designId,
      placement.expected.materialId,
      placement.expected.catalogPartId,
      placement.expected.colorId,
    ]);
    const members = grouped.get(key) ?? [];
    members.push(placement);
    grouped.set(key, members);
  }
  return [...grouped.entries()]
    .map(([key, members]) => ({
      key,
      stepNumber: members[0]!.stepNumber,
      placements: members.sort((left, right) => left.identityKey.localeCompare(right.identityKey)),
    }))
    .sort((left, right) => left.stepNumber - right.stepNumber || left.key.localeCompare(right.key));
}

function candidateFrames(first: PlacementGroup, cache: TargetRealizationCache): FrameTransform[] {
  const anchor = first.placements[0]!;
  const definition = getPartDefinition(anchor.expected.catalogPartId)!;
  const expected = rigidTransformToFrameTransform(anchor.expected.transform);
  const symmetries = cache.selfSymmetries(definition);
  const found = new Map<string, FrameTransform>();
  for (const actualPlacement of first.placements) {
    const actual = rigidTransformToFrameTransform(actualPlacement.actual.transform);
    for (const symmetry of symmetries) {
      const equivalentExpected = composeFrameTransforms(
        expected,
        rigidTransformToFrameTransform(symmetry),
      );
      const frame = composeFrameTransforms(actual, invertFrameTransform(equivalentExpected));
      found.set(frameKey(frame), frame);
    }
  }
  return [...found.values()].sort((left, right) => frameKey(left).localeCompare(frameKey(right)));
}

interface GroupMatch {
  readonly matches: boolean;
  readonly deficientExpected: TargetEquivalencePlacement | null;
  readonly surplusActual: TargetEquivalencePlacement | null;
  readonly witness: string;
}

interface OrbitMember {
  readonly orbitKey: string;
  readonly placement: TargetEquivalencePlacement;
}

const compareCodePoints = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareOrbitMember = (left: OrbitMember, right: OrbitMember): number =>
  compareCodePoints(left.orbitKey, right.orbitKey) ||
  compareCodePoints(left.placement.identityKey, right.placement.identityKey);

function groupMatches(
  group: PlacementGroup,
  frame: FrameTransform,
  cache: TargetRealizationCache,
): GroupMatch {
  const definition = getPartDefinition(group.placements[0]!.expected.catalogPartId)!;
  const expectedMembers: OrbitMember[] = [];
  const actualMembers: OrbitMember[] = [];
  for (const placement of group.placements) {
    const actualKey = cache.properOrbitKey(
      definition,
      rigidTransformToFrameTransform(placement.actual.transform),
    );
    const expectedWorld = composeFrameTransforms(
      frame,
      rigidTransformToFrameTransform(placement.expected.transform),
    );
    const expectedKey = cache.properOrbitKey(definition, expectedWorld);
    if (actualKey === null || expectedKey === null) {
      return {
        matches: false,
        deficientExpected: placement,
        surplusActual: placement,
        witness: `catalog part ${definition.id} has no completely proven upright self-symmetry, so its identity realization cannot authorize a proper target frame`,
      };
    }
    expectedMembers.push({ orbitKey: expectedKey, placement });
    actualMembers.push({ orbitKey: actualKey, placement });
  }
  expectedMembers.sort(compareOrbitMember);
  actualMembers.sort(compareOrbitMember);
  let expectedIndex = 0;
  let actualIndex = 0;
  let deficientExpected: OrbitMember | null = null;
  let surplusActual: OrbitMember | null = null;
  while (expectedIndex < expectedMembers.length && actualIndex < actualMembers.length) {
    const expected = expectedMembers[expectedIndex]!;
    const actual = actualMembers[actualIndex]!;
    const order = compareCodePoints(expected.orbitKey, actual.orbitKey);
    if (order === 0) {
      expectedIndex += 1;
      actualIndex += 1;
      continue;
    }
    if (order < 0) {
      deficientExpected ??= expected;
      expectedIndex += 1;
    } else {
      surplusActual ??= actual;
      actualIndex += 1;
    }
  }
  deficientExpected ??= expectedMembers[expectedIndex] ?? null;
  surplusActual ??= actualMembers[actualIndex] ?? null;
  if (deficientExpected === null && surplusActual === null) {
    return { matches: true, deficientExpected: null, surplusActual: null, witness: "" };
  }
  return {
    matches: false,
    deficientExpected: deficientExpected?.placement ?? null,
    surplusActual: surplusActual?.placement ?? null,
    witness:
      `proper catalog-realization multiset for group ${group.key} is deficient at ` +
      `${deficientExpected?.orbitKey ?? "<none>"}/${deficientExpected?.placement.identityKey ?? "<none>"} ` +
      `and surplus at ${surplusActual?.orbitKey ?? "<none>"}/${surplusActual?.placement.identityKey ?? "<none>"}`,
  };
}

function contactPlacements(
  placements: readonly TargetEquivalencePlacement[],
  side: "expected" | "actual",
): SemanticContactPlacement[] {
  return placements.map((placement) => ({
    identityKey: placement.identityKey,
    stepNumber: placement.stepNumber,
    catalogPartId: placement.expected.catalogPartId,
    transform: placement[side].transform,
  }));
}

function improperDiagnostic(
  placements: readonly TargetEquivalencePlacement[],
  cache: TargetRealizationCache,
): TargetEquivalenceImproperFrame | null {
  const first = placements[0]!;
  const actualContacts = inferSemanticContactKeys({
    placements: contactPlacements(placements, "actual"),
    globalFrame: IDENTITY_FRAME,
  });
  if (!actualContacts.supported) return null;
  for (const reflection of REFLECTIONS) {
    const rotated = rotate(reflection.matrix, first.expected.transform.positionLdu);
    const translation: LduVector3 = [
      normalizeZero(first.actual.transform.positionLdu[0] - rotated[0]),
      normalizeZero(first.actual.transform.positionLdu[1] - rotated[1]),
      normalizeZero(first.actual.transform.positionLdu[2] - rotated[2]),
    ];
    const frame: FrameTransform = { matrix: reflection.matrix, translationLdu: translation };
    if (
      placements.some(
        (placement) =>
          !apply(frame, placement.expected.transform.positionLdu).every(
            (coordinate, axis) => coordinate === placement.actual.transform.positionLdu[axis],
          ),
      )
    ) {
      continue;
    }
    let exactRenderTriangleMatchedPlacements = 0;
    let firstExactRenderTriangleMismatch: string | null = null;
    const structurallyReflected = placements.every((placement) => {
      const expectedWorld = composeFrameTransforms(
        frame,
        rigidTransformToFrameTransform(placement.expected.transform),
      );
      const actualWorld = rigidTransformToFrameTransform(placement.actual.transform);
      const comparison = cache.compare(
        getPartDefinition(placement.expected.catalogPartId)!,
        expectedWorld,
        actualWorld,
      );
      const physicalLayers = [
        comparison.layers.connectors,
        comparison.layers.collision,
        comparison.layers.allowances,
        comparison.layers.bounds,
      ];
      if (physicalLayers.some(({ supported, matches }) => !supported || !matches)) return false;
      if (comparison.layers.render.supported && comparison.layers.render.matches) {
        exactRenderTriangleMatchedPlacements += 1;
      } else if (firstExactRenderTriangleMismatch === null) {
        firstExactRenderTriangleMismatch =
          `${placement.identityKey} at printed step ${placement.stepNumber}: ` +
          `${comparison.layers.render.witness ?? "render realization did not match"}`;
      }
      return true;
    });
    if (!structurallyReflected) continue;
    const expectedContacts = inferSemanticContactKeys({
      placements: contactPlacements(placements, "expected"),
      globalFrame: frame,
    });
    if (
      !expectedContacts.supported ||
      expectedContacts.keys.length !== actualContacts.keys.length ||
      expectedContacts.keys.some((key, index) => key !== actualContacts.keys[index]) ||
      (placements.length > 1 && expectedContacts.keys.length === 0)
    ) {
      continue;
    }
    return {
      kind: reflection.kind,
      determinant: -1,
      positionLdu: translation,
      matchedPlacements: placements.length,
      inferredCompatibleContacts: actualContacts.keys.length,
      exactRenderTriangleMatchedPlacements,
      firstExactRenderTriangleMismatch,
    };
  }
  return null;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/** Detaches every caller-owned transform/position before recursively freezing the result. */
const immutable = <T>(value: T): T => deepFreeze(structuredClone(value));

/**
 * Audits selected visual-search placements against official target facts after
 * search has finished. Only a complete catalog-realization match under one
 * proper upright yaw plus translation authorizes target equivalence. A D4
 * reflection can explain an origin/contact pattern, but is retained only as a
 * refusal diagnostic and can never become a proper frame.
 */
export function auditRealBuildTargetEquivalence(input: {
  readonly placements: readonly TargetEquivalencePlacement[];
}): RealBuildTargetEquivalenceAudit {
  const invalid = bindingFailure(input.placements);
  const base = {
    schemaVersion: "lego.real-build-target-equivalence-audit/1" as const,
    catalogVersion: BUILTIN_CATALOG_VERSION,
  };
  if (invalid !== null) {
    return immutable({
      ...base,
      status: "binding-invalid" as const,
      properFrames: [],
      properFrame: null,
      firstMismatch: null,
      improperFrame: null,
      bindingFailure: invalid,
    });
  }

  const cache = createTargetRealizationCache();
  const groups = placementGroups(input.placements);
  let frontier = candidateFrames(groups[0]!, cache);
  let firstMismatch: TargetEquivalenceMismatch | null = null;
  for (const group of groups) {
    const prior = frontier;
    frontier = frontier.filter((frame) => groupMatches(group, frame, cache).matches);
    if (frontier.length > 0 || firstMismatch !== null) continue;
    const frame = prior[0];
    const comparison = frame === undefined ? null : groupMatches(group, frame, cache);
    const expectedPlacement = comparison?.deficientExpected ?? group.placements[0]!;
    const actualPlacement = comparison?.surplusActual ?? group.placements[0]!;
    const expectedTransform =
      frame === undefined
        ? expectedPlacement.expected.transform
        : rigidFrame(
            composeFrameTransforms(
              frame,
              rigidTransformToFrameTransform(expectedPlacement.expected.transform),
            ),
          );
    firstMismatch = {
      identityKey: actualPlacement.identityKey,
      stepNumber: actualPlacement.stepNumber,
      expectedTransform,
      actualTransform: actualPlacement.actual.transform,
      witness: comparison?.witness ?? "no proper upright frame realizes the first placement group",
    };
  }

  const properFrames = frontier.map(rigidFrame);
  if (properFrames.length > 0) {
    return immutable({
      ...base,
      status: "proper" as const,
      properFrames,
      properFrame: properFrames[0]!,
      firstMismatch: null,
      improperFrame: null,
      bindingFailure: null,
    });
  }
  const improperFrame = improperDiagnostic(input.placements, cache);
  return immutable({
    ...base,
    status: improperFrame === null ? ("mismatch" as const) : ("improper" as const),
    properFrames: [],
    properFrame: null,
    firstMismatch,
    improperFrame,
    bindingFailure: null,
  });
}
