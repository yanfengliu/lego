import { PROPER_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import {
  canonicalDigest,
  deepFreeze,
  getProperOrientation,
  rotateLduVector,
} from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";
import {
  readRealBuildPrefix50Step41ActionBinding,
  readRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50Step41ActionBinding,
} from "./real-build-prefix50-projection";
import {
  diagnoseRealBuildPrefix50Step41Transform,
  enumerateRealBuildPrefix50Step41Seats,
  requireCompleteRealBuildPrefix50Step41SeatEnumeration,
  type RealBuildPrefix50Step41SeatCandidate,
  type RealBuildPrefix50Step41SeatEnumeration,
} from "./real-build-prefix50-step41-source-repair-enumeration";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step41-panel-face-fixture";
import {
  REAL_BUILD_PREFIX50_STEP41_CANONICAL_ORIENTATION as CANONICAL_ORIENTATION,
  REAL_BUILD_PREFIX50_STEP41_CHILD_PATH as CHILD_PATH,
  REAL_BUILD_PREFIX50_STEP41_EQUIVALENT_ORIENTATION as EQUIVALENT_ORIENTATION,
  REAL_BUILD_PREFIX50_STEP41_PAIRS as PAIRS,
  type RealBuildPrefix50Step41NormalizedConnection as NormalizedConnection,
  type RealBuildPrefix50Step41PairEvidence as PairEvidence,
  type RealBuildPrefix50Step41ReceiptMutation as ReceiptMutation,
  type RealBuildPrefix50Step41SourceRepairEvidence,
  type RealBuildPrefix50Step41SourceRepairInput,
  type RealBuildPrefix50Step41SourceRepairProof,
} from "./real-build-prefix50-step41-source-repair-contract";
import { requireExactRealBuildPrefix50Step41PanelFaceFixture } from "./real-build-prefix50-step41-source-repair-fixture";
import { proveRealBuildPrefix50Step41IsolatedCapacityAndCollision } from "./real-build-prefix50-step41-source-repair-isolated";

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";

const proofs = new WeakMap<object, RealBuildPrefix50Step41SourceRepairEvidence>();

function ownData(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function sameVector(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId && sameVector(left.positionLdu, right.positionLdu)
  );
}

function samePath(path: readonly string[]): boolean {
  return (
    path.length === CHILD_PATH.length && path.every((entry, index) => entry === CHILD_PATH[index])
  );
}

function requireActionBinding(
  binding: RealBuildPrefix50Step41ActionBinding,
  projectionStepDigest: string,
): void {
  const builderRefs = [
    "1260a44e-b125-411e-8552-596f22aa32e4",
    "a9aee720-9a6d-4d05-b1cb-2821d8101d03",
    "4287ddd1-1cc4-4cc5-ae50-acf1d543cb06",
    "8a6a770f-a0b9-430a-8802-8f057fbd748a",
  ] as const;
  const refs = PAIRS.map(({ candidateOrdinal }) =>
    binding.members.find(({ occurrenceOrdinal }) => occurrenceOrdinal === candidateOrdinal),
  );
  if (
    binding.schemaVersion !== "lego.real-build-prefix50-step41-action-binding/1" ||
    binding.sourceSetId !== "6651557" ||
    binding.actionPreparationDigest !==
      "sha256:cc1163b91bcc3892137e73dd99ae51b9626589572ca683f55e74302bd4a2b267" ||
    binding.officialModelPhaseDigest !==
      "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e" ||
    binding.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE.sourcePdfDigest ||
    binding.stepActionDigest !== projectionStepDigest ||
    binding.stepActionDigest !==
      "sha256:60dabfb1bd11de1b0f78e4e4b3e8fa75403221679ce9951d109ce7ad7dff06f5" ||
    binding.phaseSourceDigest !==
      "sha256:a4685cc8695811bdc25251f519ece53696901699e758ecfb371c59df0eb62d0a" ||
    binding.printedStepNumber !== 41 ||
    binding.phaseSequence !== 67 ||
    binding.phaseKind !== "direct" ||
    binding.phaseId !== "direct:862c7cd5-226f-43a4-8d7b-a8da9cb94a9b:1" ||
    binding.stepUuid !== "862c7cd5-226f-43a4-8d7b-a8da9cb94a9b" ||
    !samePath(binding.subBuildPath) ||
    binding.callout.pageNumber !== 44 ||
    binding.callout.quantity !== 4 ||
    binding.callout.identity !== REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE.calloutIdentity ||
    binding.callout.cropDigest !== REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE.cropDigest ||
    refs.some(
      (member, index) =>
        member === undefined ||
        member.phaseMemberOrdinal !== index + 1 ||
        member.builderBrickRef !== builderRefs[index] ||
        member.officialDesignId !== "35480" ||
        member.designRevision !== "35480;K",
    )
  ) {
    throw new TypeError(
      "Step-41 source repair requires the exact opaque page-44 action, phase-67 source digest, child path, and four Builder members.",
    );
  }
}

function requireSourceRows(
  unsafeRows: unknown,
  projectionRows: readonly RealBuildPrefix50ProjectionOccurrence[],
): readonly RealBuildPrefix50ProjectionOccurrence[] {
  if (!Array.isArray(unsafeRows) || unsafeRows.length !== 8) {
    throw new TypeError(
      "Step-41 source repair requires exact source rows 266..273 and no third body.",
    );
  }
  const expectedX = [240, 440, 380, 300, 440, 240, 300, 380] as const;
  for (const [index, row] of unsafeRows.entries()) {
    const ordinal = index + 266;
    const source = projectionRows[ordinal - 1];
    const receiver = ordinal <= 269;
    if (
      row !== source ||
      row.ordinal !== ordinal ||
      row.printedStepNumber !== (receiver ? 40 : 41) ||
      row.phaseSequence !== (receiver ? 66 : 67) ||
      row.phaseMemberOrdinal !== (receiver ? index + 1 : index - 3) ||
      !samePath(row.subBuildPath) ||
      row.colorId !== (receiver ? "builtin:black" : "builtin:medium-azure") ||
      row.partIdentity.reconciledCatalogPartId !==
        (receiver ? "builtin:bracket-2x2-1x2-vertical-studs" : "builtin:plate-1x2-round-end") ||
      row.partIdentity.publishedCatalogPartId !== row.partIdentity.reconciledCatalogPartId ||
      row.partIdentity.officialDesignId !== (receiver ? "41682" : "35480") ||
      row.partIdentity.officialDesignRevision !== (receiver ? "41682;H" : "35480;K") ||
      row.partIdentity.sourceLDrawPartId !== (receiver ? "41682" : "35480") ||
      row.partIdentity.catalogLDrawPartId !== (receiver ? "41682" : "35480") ||
      row.partIdentity.identityProofId !== null ||
      row.partIdentity.basis !== "published-exact" ||
      row.sourceWorldTransform.orientationId !==
        (receiver ? "proper-m-p0000n0p0" : "proper-m-00nn000p0") ||
      !sameVector(row.sourceWorldTransform.positionLdu, [
        expectedX[index]!,
        receiver ? -88 : -98,
        receiver ? -104 : -102,
      ])
    ) {
      throw new TypeError(
        `Step-41 source row ${ordinal} must be the exact projection identity, path, phase, and raw transform.`,
      );
    }
  }
  return unsafeRows;
}

function normalizeForward(candidate: RealBuildPrefix50Step41SeatCandidate): NormalizedConnection[] {
  return candidate.connections
    .map((connection) => ({
      receiverPortId: connection.targetPortId,
      candidatePortId: connection.candidatePortId,
      connectionKind: "stud-tube" as const,
    }))
    .sort(
      (left, right) =>
        left.receiverPortId.localeCompare(right.receiverPortId) ||
        left.candidatePortId.localeCompare(right.candidatePortId),
    );
}

function normalizeReverse(candidate: RealBuildPrefix50Step41SeatCandidate): NormalizedConnection[] {
  return candidate.connections
    .map((connection) => ({
      receiverPortId: connection.candidatePortId,
      candidatePortId: connection.targetPortId,
      connectionKind: "stud-tube" as const,
    }))
    .sort(
      (left, right) =>
        left.receiverPortId.localeCompare(right.receiverPortId) ||
        left.candidatePortId.localeCompare(right.candidatePortId),
    );
}

function exactPanelFaceCandidate(candidate: RealBuildPrefix50Step41SeatCandidate): boolean {
  if (candidate.connections.length !== 2) return false;
  const receiverDefinition = getPartDefinition("builtin:bracket-2x2-1x2-vertical-studs")!;
  const candidateDefinition = getPartDefinition("builtin:plate-1x2-round-end")!;
  const receiverStuds = receiverDefinition.connectors
    .filter(({ kind }) => kind === "stud")
    .map(({ id }) => id)
    .sort();
  const candidateClutches = candidateDefinition.connectors
    .filter(({ kind }) => kind === "undersideClutch")
    .map(({ id }) => id)
    .sort();
  return (
    candidate.connections
      .map(({ targetPortId }) => targetPortId)
      .sort()
      .join("|") === receiverStuds.join("|") &&
    candidate.connections
      .map(({ candidatePortId }) => candidatePortId)
      .sort()
      .join("|") === candidateClutches.join("|")
  );
}

function proveLongAxisChoice(
  raw: RigidTransform,
  canonical: RealBuildPrefix50Step41SeatCandidate,
  alternative: RealBuildPrefix50Step41SeatCandidate,
): void {
  const definition = getPartDefinition("builtin:plate-1x2-round-end")!;
  const studs = definition.connectors
    .filter(({ kind }) => kind === "stud")
    .sort(({ id: left }, { id: right }) => left.localeCompare(right));
  if (studs.length !== 2) throw new TypeError("Step-41 35480 must retain exactly two studs.");
  const localLongAxis = studs[1]!.positionLdu.map(
    (coordinate, index) => coordinate - studs[0]!.positionLdu[index]!,
  ) as [number, number, number];
  const direction = (orientationId: string) =>
    rotateLduVector(getProperOrientation(orientationId).matrix, localLongAxis);
  const rawDirection = direction(raw.orientationId);
  const reviewedDirection = rotateLduVector(
    REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE.sourceLongAxisToPanelFaceQuarterTurn,
    rawDirection,
  );
  const alternativeDirection = direction(alternative.transform.orientationId);
  if (
    !sameVector(rawDirection, reviewedDirection) ||
    !sameVector(direction(canonical.transform.orientationId), rawDirection) ||
    !sameVector(
      alternativeDirection,
      rawDirection.map((coordinate) => -coordinate),
    )
  ) {
    throw new TypeError(
      "Step-41 canonical symmetry label must preserve the reviewed raw long-axis direction.",
    );
  }
}

function repairedBaseRow(
  row: RealBuildPrefix50ProjectionOccurrence,
  transform: RigidTransform,
): RealBuildPrefix50ProjectionOccurrence {
  return deepFreeze({ ...row, sourceWorldTransform: transform });
}

function verifiedEnumeration(
  base: RealBuildPrefix50ProjectionOccurrence,
  candidate: RealBuildPrefix50ProjectionOccurrence,
  context: Parameters<ReceiptMutation>[1],
  mutate?: ReceiptMutation,
): RealBuildPrefix50Step41SeatEnumeration {
  const receipt = enumerateRealBuildPrefix50Step41Seats(base, candidate);
  return requireCompleteRealBuildPrefix50Step41SeatEnumeration(
    mutate?.(receipt, context) ?? receipt,
    base,
    candidate,
  );
}

function provePair(
  rows: readonly RealBuildPrefix50ProjectionOccurrence[],
  pair: (typeof PAIRS)[number],
  mutate?: ReceiptMutation,
): PairEvidence {
  const receiver = rows[pair.receiverOrdinal - 266]!;
  const candidate = rows[pair.candidateOrdinal - 266]!;
  const raw = diagnoseRealBuildPrefix50Step41Transform(
    receiver,
    candidate,
    candidate.sourceWorldTransform,
  );
  if (
    raw.connections.length !== 0 ||
    raw.collisionFindingCodes.join("|") !== "PART_BODY_COLLISION|PART_STUD_BODY_COLLISION"
  ) {
    throw new TypeError(
      `Step-41 raw occurrence ${pair.candidateOrdinal} must remain zero-seat collision counterevidence against ${pair.receiverOrdinal}.`,
    );
  }
  const forward = verifiedEnumeration(
    receiver,
    candidate,
    { direction: "forward", ...pair },
    mutate,
  );
  const faceCandidates = forward.candidates.filter(exactPanelFaceCandidate);
  const canonical = faceCandidates.find(
    ({ transform }) => transform.orientationId === CANONICAL_ORIENTATION,
  );
  const alternative = faceCandidates.find(
    ({ transform }) => transform.orientationId === EQUIVALENT_ORIENTATION,
  );
  const repairedTransform = {
    positionLdu: [pair.repairedX, -80, -108] as [number, number, number],
    orientationId: CANONICAL_ORIENTATION,
  };
  if (
    faceCandidates.length !== 2 ||
    canonical === undefined ||
    alternative === undefined ||
    !sameTransform(canonical.transform, repairedTransform) ||
    !sameVector(alternative.transform.positionLdu, repairedTransform.positionLdu) ||
    new Set(faceCandidates.map(({ occupancyKey }) => occupancyKey)).size !== 1
  ) {
    throw new TypeError(
      `Step-41 occurrence ${pair.candidateOrdinal} must derive one physical panel-face seat with exactly the reviewed two symmetry labels.`,
    );
  }
  proveLongAxisChoice(candidate.sourceWorldTransform, canonical, alternative);
  const repairedCandidate = repairedBaseRow(candidate, deepFreeze(repairedTransform));
  const reverse = verifiedEnumeration(
    repairedCandidate,
    receiver,
    { direction: "reverse", ...pair },
    mutate,
  );
  const reciprocal = reverse.candidates.filter((entry) =>
    sameTransform(entry.transform, receiver.sourceWorldTransform),
  );
  const canonicalConnections = normalizeForward(canonical);
  const alternativeConnections = normalizeForward(alternative);
  if (
    reciprocal.length !== 1 ||
    reciprocal[0]!.connections.length !== 2 ||
    canonicalDigest(normalizeReverse(reciprocal[0]!)) !== canonicalDigest(canonicalConnections) ||
    canonicalConnections.length !== 2 ||
    alternativeConnections.length !== 2
  ) {
    throw new TypeError(
      `Step-41 occurrence ${pair.candidateOrdinal} lacks one exact reciprocal two-edge seat against ${pair.receiverOrdinal}.`,
    );
  }
  return deepFreeze({
    receiverOrdinal: pair.receiverOrdinal,
    candidateOrdinal: pair.candidateOrdinal,
    rawSourceWorldTransform: candidate.sourceWorldTransform,
    repairedSourceWorldTransform: repairedTransform,
    rawConnectionCount: 0 as const,
    rawCollisionFindingCodes: raw.collisionFindingCodes as PairEvidence["rawCollisionFindingCodes"],
    equivalentOrientationIds: [CANONICAL_ORIENTATION, EQUIVALENT_ORIENTATION] as const,
    physicalOccupancyClassCount: 1 as const,
    canonicalOrientationBasis: "raw-long-axis-direction-preserved" as const,
    canonicalConnections,
    alternativeConnections,
    forwardCounts: forward.counts,
    reverseCounts: reverse.counts,
    reciprocalExactCandidateCount: 1 as const,
    connectedCollisionFindingCount: 0 as const,
  });
}

function verifyWithMutation(
  unsafeInput: RealBuildPrefix50Step41SourceRepairInput,
  mutate?: ReceiptMutation,
): RealBuildPrefix50Step41SourceRepairProof {
  exactKeys(
    unsafeInput,
    ["projectionReader", "reviewedPanelFaceFixture", "sourceRows"],
    "Step-41 source-repair input",
  );
  const reader = ownData(
    unsafeInput,
    "projectionReader",
    "Step-41 source-repair input",
  ) as RealBuildPrefix50Step41SourceRepairInput["projectionReader"];
  const projection = readRealBuildPrefix50VerifiedProjection(reader);
  const binding = readRealBuildPrefix50Step41ActionBinding(reader);
  const fixture = requireExactRealBuildPrefix50Step41PanelFaceFixture(
    ownData(unsafeInput, "reviewedPanelFaceFixture", "Step-41 source-repair input"),
  );
  if (projection.sourceSetId !== "6651557") {
    throw new TypeError("Step-41 source repair is scoped only to exact source set 6651557.");
  }
  requireActionBinding(binding, projection.steps[40]!.sourceActionDigest);
  if (PROPER_ORIENTATIONS.length !== 24) {
    throw new TypeError("Step-41 source repair requires the exact complete 24-orientation roster.");
  }
  const rows = requireSourceRows(
    ownData(unsafeInput, "sourceRows", "Step-41 source-repair input"),
    projection.occurrences,
  );
  const pairEvidence = PAIRS.map((pair) => provePair(rows, pair, mutate));
  const capacityClaimCount = proveRealBuildPrefix50Step41IsolatedCapacityAndCollision(
    rows,
    pairEvidence,
  );
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step41-source-repair-evidence/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    projectionCommitment: canonicalDigest(projection),
    actionBindingCommitment: canonicalDigest(binding),
    panelFaceFixtureCommitment: canonicalDigest(fixture),
    sourceRowsCommitment: canonicalDigest(rows),
    sourcePdfDigest: binding.sourcePdfDigest,
    panelPageNumber: 44 as const,
    panelCropDigest: binding.callout.cropDigest,
    stepActionDigest: binding.stepActionDigest,
    phaseSourceDigest: binding.phaseSourceDigest,
    printedStepNumber: 41 as const,
    phaseSequence: 67 as const,
    rawSourceTransformsPreserved: true as const,
    catalogTruthClaimed: false as const,
    placementAuthority: false as const,
    orientationEnumerationCountPerDirection: PROPER_ORIENTATIONS.length as 24,
    pairs: pairEvidence,
    totalReciprocalConnectionCount: 8 as const,
    collisionAndCapacityScope: "isolated-source-rows-266..273-eight-body" as const,
    isolatedConnectorCapacityEndpointClaimCount: capacityClaimCount,
    isolatedConnectedCollisionFindingCount: 0 as const,
  });
  const evidence = deepFreeze({ ...body, repairCommitment: canonicalDigest(body) });
  const proof = Object.freeze({
    schemaVersion: "lego.real-build-prefix50-step41-source-repair-proof/1" as const,
  });
  proofs.set(proof, evidence);
  return proof;
}

export function verifyRealBuildPrefix50Step41SourceRepair(
  input: RealBuildPrefix50Step41SourceRepairInput,
): RealBuildPrefix50Step41SourceRepairProof {
  return verifyWithMutation(input);
}

export function requireRealBuildPrefix50Step41SourceRepairProof(
  value: unknown,
): RealBuildPrefix50Step41SourceRepairEvidence {
  const evidence = value !== null && typeof value === "object" ? proofs.get(value) : undefined;
  if (evidence === undefined) {
    throw new TypeError(
      "Step-41 source repair requires the opaque proof minted from exact action, projection, panel, and reciprocal-seat evidence; caller clones carry no authority.",
    );
  }
  return evidence;
}

export const __testOnly: Readonly<{
  verifyWithEnumerationMutation?: typeof verifyWithMutation;
}> = deepFreeze(TEST_MODE ? { verifyWithEnumerationMutation: verifyWithMutation } : {});
