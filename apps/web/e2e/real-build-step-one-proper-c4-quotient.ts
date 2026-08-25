import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  projectRealBuildEnumeratedPlacementWitnesses,
  snapshotRealBuildEnumeratedPlacementOffer,
  type RealBuildEnumeratedPlacementOffer,
} from "./real-build-enumerated-placement-witness";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RealBuildPreparedPlacementWitness } from "./real-build-prepared-search-boundary";
import {
  requireRealBuildPreparedStepInspection,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import {
  requireRealBuildStepOneProperC4DataContainer,
  snapshotRealBuildStepOneProperC4DataArray as snapshotDenseDataArray,
  snapshotRealBuildStepOneProperC4DataObject as snapshotExactDataObject,
} from "./real-build-step-one-proper-c4-data-snapshot";

export const MAXIMUM_REAL_BUILD_STEP_ONE_PROPER_C4_ORBITS = 128;
const MAXIMUM_RAW_CANDIDATES = 1_024;
const QUARTER_TURNS = [0, 90, 180, 270] as const;
type QuarterTurn = (typeof QUARTER_TURNS)[number];
type Pair<T> = readonly [T, T];
type Quartet<T> = readonly [T, T, T, T];

export interface RealBuildStepOneProperC4RawCandidate {
  readonly rawIndex: number;
  readonly partIds: Pair<string>;
  readonly offeredCandidates: Pair<RealBuildEnumeratedPlacementOffer>;
  readonly projectedWitnesses: Pair<RealBuildPreparedPlacementWitness>;
}

export interface RealBuildStepOneProperC4InverseMember {
  readonly rawIndex: number;
  readonly turnDegrees: QuarterTurn;
  readonly partIds: Pair<string>;
  readonly rawConnectionTargetIds: Pair<readonly string[]>;
  readonly restsOnBuildPlate: Pair<boolean>;
}

export interface RealBuildStepOneProperC4Orbit {
  readonly orbitIndex: number;
  readonly representative: RealBuildStepOneProperC4RawCandidate;
  readonly members: Quartet<RealBuildStepOneProperC4InverseMember>;
}

export interface RealBuildStepOneProperC4InverseMapEntry {
  readonly rawIndex: number;
  readonly orbitIndex: number;
  readonly memberIndex: number;
  readonly turnDegrees: QuarterTurn;
}

export type RealBuildStepOneProperC4QuotientInspection = Readonly<{
  schemaVersion: "lego.real-build-step-one-proper-c4-quotient/1";
  rootDocumentHash: Sha256Digest;
  rootCanonicalBytesHash: Sha256Digest;
  preparedRunInputDigest: Sha256Digest;
  printedStepIdentity: Sha256Digest;
  rawCandidateCount: number;
  orbitCount: number;
  rawRoster: readonly RealBuildStepOneProperC4RawCandidate[];
  orbits: readonly RealBuildStepOneProperC4Orbit[];
  inverseMap: readonly RealBuildStepOneProperC4InverseMapEntry[];
  inverseExpandedRawRoster: readonly RealBuildStepOneProperC4RawCandidate[];
  rawRosterDigest: Sha256Digest;
  quotientDigest: Sha256Digest;
  branchAccounting: Readonly<{
    rootsPerCandidate: 8;
    camerasPerRoot: 8;
    rawRootEdges: number;
    quotientRootEdges: number;
    rawLogicalCameraBranches: number;
    quotientLogicalCameraBranches: number;
  }>;
  acceptedDocument: null;
  physicalFrameAuthority: "absent";
  placementAuthority: "absent";
  completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
  authority: "absent";
}>;

interface InternalRow extends RealBuildStepOneProperC4RawCandidate {
  readonly canonicalOrbitBytes: string;
  readonly turnDegrees: QuarterTurn;
}

const inspections = new WeakSet<object>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

function exactEmptyRoot(snapshot: RealBuildCandidateDocumentSnapshot): void {
  const document = snapshot.document;
  const bootstrap = document.steps[0];
  if (
    document.parts.length !== 0 ||
    document.connections.length !== 0 ||
    document.semanticRegions.length !== 0 ||
    document.steps.length !== 1 ||
    bootstrap?.id !== "step-1" ||
    bootstrap.index !== 0 ||
    bootstrap.name !== "Step 1" ||
    bootstrap.partIds.length !== 0 ||
    document.submodels.some(({ partIds }) => partIds.length !== 0)
  ) {
    throw new TypeError(
      "Proper-C4 quotient requires the exact branded empty step-1 bootstrap document.",
    );
  }
}

function rotatePosition(
  position: readonly [number, number, number],
  turn: QuarterTurn,
): readonly [number, number, number] {
  const [x, y, z] = position;
  const rotated =
    turn === 0 ? [x, y, z] : turn === 90 ? [z, y, -x] : turn === 180 ? [-x, y, -z] : [-z, y, x];
  return intrinsicRealBuildFreeze(
    rotated.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)),
  ) as unknown as readonly [number, number, number];
}

function rotateOrientation(orientationId: string, turn: QuarterTurn): string {
  const yaw = Number(orientationId.slice("upright-yaw-".length));
  return `upright-yaw-${(yaw + turn) % 360}`;
}

function rotateWitnesses(
  witnesses: readonly RealBuildPreparedPlacementWitness[],
  turn: QuarterTurn,
): readonly unknown[] {
  return witnesses.map((witness) => ({
    identityKey: witness.identityKey,
    catalogPartId: witness.catalogPartId,
    colorId: witness.colorId,
    transform: {
      positionLdu: rotatePosition(witness.transform.positionLdu, turn),
      orientationId: rotateOrientation(witness.transform.orientationId, turn),
    },
    connections: witness.connections,
  }));
}

function supports(row: RealBuildStepOneProperC4RawCandidate): Pair<boolean> {
  return intrinsicRealBuildFreeze([
    row.offeredCandidates[0].restsOnBuildPlate,
    row.offeredCandidates[1].restsOnBuildPlate,
  ]) as unknown as Pair<boolean>;
}

function orbitView(row: RealBuildStepOneProperC4RawCandidate, turn: QuarterTurn): unknown {
  return {
    projectedWitnesses: rotateWitnesses(row.projectedWitnesses, turn),
    restsOnBuildPlate: supports(row),
  };
}

function snapshotRawRoster(
  rawCandidates: unknown,
  documentSnapshot: RealBuildCandidateDocumentSnapshot,
  preparedStep: RealBuildPreparedStepInspection,
): readonly InternalRow[] {
  const rows = snapshotDenseDataArray(
    rawCandidates,
    "Proper-C4 raw candidates",
    MAXIMUM_RAW_CANDIDATES,
  );
  if (rows.length < 4) {
    throw new RangeError("Proper-C4 raw candidates must contain at least four rows.");
  }
  const mutableContainers = new WeakSet<object>();
  const retained: InternalRow[] = [];
  const uniqueContainer = (value: unknown, label: string): void => {
    requireRealBuildStepOneProperC4DataContainer(value, label);
    if (mutableContainers.has(value)) {
      throw new TypeError(`${label} is a shared mutable container alias.`);
    }
    mutableContainers.add(value);
  };
  for (let rawIndex = 0; rawIndex < rows.length; rawIndex += 1) {
    const source = rows[rawIndex];
    uniqueContainer(source, `Proper-C4 raw candidate ${rawIndex}`);
    const candidate = snapshotExactDataObject(source, `Proper-C4 raw candidate ${rawIndex}`, [
      "partIds",
      "offeredCandidates",
    ]);
    uniqueContainer(candidate.partIds, `Proper-C4 raw candidate ${rawIndex}.partIds`);
    uniqueContainer(
      candidate.offeredCandidates,
      `Proper-C4 raw candidate ${rawIndex}.offeredCandidates`,
    );
    const partIdValues = snapshotDenseDataArray(
      candidate.partIds,
      `Proper-C4 raw candidate ${rawIndex}.partIds`,
      2,
    );
    const offerValues = snapshotDenseDataArray(
      candidate.offeredCandidates,
      `Proper-C4 raw candidate ${rawIndex}.offeredCandidates`,
      2,
    );
    if (partIdValues.length !== 2 || offerValues.length !== 2) {
      throw new TypeError(`Proper-C4 raw candidate ${rawIndex} must contain exactly two pieces.`);
    }
    const partIds = intrinsicRealBuildFreeze([...partIdValues]) as unknown as Pair<string>;
    const offeredCandidates = intrinsicRealBuildFreeze([
      ...offerValues,
    ]) as unknown as Pair<RealBuildEnumeratedPlacementOffer>;
    const projected = projectRealBuildEnumeratedPlacementWitnesses({
      documentSnapshot,
      pieces: preparedStep.expectedAtomicPieces,
      candidate: { partIds, offeredCandidates },
    });
    if (
      projected.some(({ transform }) =>
        transform.positionLdu.some((coordinate) => Object.is(coordinate, -0)),
      )
    ) {
      throw new TypeError(
        `Proper-C4 raw candidate ${rawIndex} contains non-canonical negative zero.`,
      );
    }
    const projectedWitnesses = projected as Pair<RealBuildPreparedPlacementWitness>;
    const base = intrinsicRealBuildFreeze({
      rawIndex,
      partIds,
      offeredCandidates,
      projectedWitnesses,
    });
    const variants = QUARTER_TURNS.map((turn) => ({
      turn,
      bytes: canonicalStringify(orbitView(base, turn)),
    }));
    variants.sort((left, right) => left.bytes.localeCompare(right.bytes));
    if (variants[0]!.bytes === variants[1]!.bytes) {
      throw new TypeError(
        `Proper-C4 raw candidate ${rawIndex} has an ambiguous rotational stabilizer instead of one exact four-member orbit.`,
      );
    }
    retained.push(
      intrinsicRealBuildFreeze({
        ...base,
        canonicalOrbitBytes: variants[0]!.bytes,
        turnDegrees: ((360 - variants[0]!.turn) % 360) as QuarterTurn,
      }),
    );
  }
  return intrinsicRealBuildFreeze(retained);
}

function inverseMember(row: InternalRow): RealBuildStepOneProperC4InverseMember {
  const targetIds = row.offeredCandidates.map((offer) =>
    intrinsicRealBuildFreeze(offer.connections.map(({ targetPartId }) => targetPartId)),
  );
  return intrinsicRealBuildFreeze({
    rawIndex: row.rawIndex,
    turnDegrees: row.turnDegrees,
    partIds: row.partIds,
    rawConnectionTargetIds: intrinsicRealBuildFreeze(targetIds) as unknown as Pair<
      readonly string[]
    >,
    restsOnBuildPlate: supports(row),
  });
}

function reconstructRawCandidate(
  representative: RealBuildStepOneProperC4RawCandidate,
  member: RealBuildStepOneProperC4InverseMember,
  documentSnapshot: RealBuildCandidateDocumentSnapshot,
  preparedStep: RealBuildPreparedStepInspection,
): RealBuildStepOneProperC4RawCandidate {
  const offeredCandidates = representative.offeredCandidates.map((offer, pieceIndex) =>
    snapshotRealBuildEnumeratedPlacementOffer({
      catalogPartId: offer.catalogPartId,
      transform: {
        positionLdu: rotatePosition(offer.transform.positionLdu, member.turnDegrees),
        orientationId: rotateOrientation(offer.transform.orientationId, member.turnDegrees),
      },
      connections: offer.connections.map((connection, connectionIndex) => ({
        targetPartId: member.rawConnectionTargetIds[pieceIndex]![connectionIndex],
        targetPortId: connection.targetPortId,
        candidatePortId: connection.candidatePortId,
      })),
      restsOnBuildPlate: member.restsOnBuildPlate[pieceIndex],
    }),
  ) as unknown as Pair<RealBuildEnumeratedPlacementOffer>;
  const projectedWitnesses = projectRealBuildEnumeratedPlacementWitnesses({
    documentSnapshot,
    pieces: preparedStep.expectedAtomicPieces,
    candidate: { partIds: member.partIds, offeredCandidates },
  }) as Pair<RealBuildPreparedPlacementWitness>;
  return intrinsicRealBuildFreeze({
    rawIndex: member.rawIndex,
    partIds: member.partIds,
    offeredCandidates: intrinsicRealBuildFreeze([
      ...offeredCandidates,
    ]) as unknown as Pair<RealBuildEnumeratedPlacementOffer>,
    projectedWitnesses,
  });
}

export function inspectRealBuildStepOneProperC4Quotient(
  input: unknown,
): RealBuildStepOneProperC4QuotientInspection {
  const exactInput = snapshotExactDataObject(input, "Proper-C4 quotient input", [
    "rootDocumentSnapshot",
    "preparedStep",
    "rawCandidates",
  ]);
  const documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    exactInput.rootDocumentSnapshot,
  );
  exactEmptyRoot(documentSnapshot);
  const preparedStep = requireRealBuildPreparedStepInspection(exactInput.preparedStep);
  if (preparedStep.stepNumber !== 1 || preparedStep.expectedAtomicPieces.length !== 2) {
    throw new TypeError(
      "Proper-C4 quotient requires exact prepared declarations for two step-1 pieces.",
    );
  }
  const rows = snapshotRawRoster(exactInput.rawCandidates, documentSnapshot, preparedStep);
  const grouped = new Map<string, InternalRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.canonicalOrbitBytes) ?? [];
    group.push(row);
    grouped.set(row.canonicalOrbitBytes, group);
  }
  if (grouped.size > MAXIMUM_REAL_BUILD_STEP_ONE_PROPER_C4_ORBITS) {
    throw new RangeError(
      `Proper-C4 quotient formed ${grouped.size} groups above ${MAXIMUM_REAL_BUILD_STEP_ONE_PROPER_C4_ORBITS}.`,
    );
  }
  const orderedGroups = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  const orbitDrafts = orderedGroups.map(([canonicalOrbitBytes, members], orbitIndex) => {
    members.sort((left, right) => left.turnDegrees - right.turnDegrees);
    if (
      members.length !== 4 ||
      members.some((member, index) => member.turnDegrees !== QUARTER_TURNS[index])
    ) {
      throw new TypeError(
        `Proper-C4 orbit ${orbitIndex} must contain exactly one member at q=0/90/180/270; found ${members.map(({ turnDegrees }) => turnDegrees).join(",")}.`,
      );
    }
    const representative = members[0]!;
    for (const member of members) {
      const expected = canonicalStringify(orbitView(representative, member.turnDegrees));
      const actual = canonicalStringify(orbitView(member, 0));
      if (expected !== actual) {
        throw new TypeError(
          `Proper-C4 orbit ${orbitIndex} member ${member.rawIndex} drifts in provenance, connection, support, or proper-yaw reconstruction.`,
        );
      }
    }
    return {
      canonicalOrbitBytes,
      orbitIndex,
      representative,
      members: members.map(inverseMember),
    };
  });
  const inverseMap: RealBuildStepOneProperC4InverseMapEntry[] = new Array(rows.length);
  const inverseExpanded: RealBuildStepOneProperC4RawCandidate[] = new Array(rows.length);
  const rawRoster = rows.map(({ rawIndex, partIds, offeredCandidates, projectedWitnesses }) =>
    intrinsicRealBuildFreeze({ rawIndex, partIds, offeredCandidates, projectedWitnesses }),
  );
  const orbits = orbitDrafts.map((draft) => {
    const members = draft.members as unknown as RealBuildStepOneProperC4Orbit["members"];
    for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
      const member = members[memberIndex]!;
      inverseMap[member.rawIndex] = intrinsicRealBuildFreeze({
        rawIndex: member.rawIndex,
        orbitIndex: draft.orbitIndex,
        memberIndex,
        turnDegrees: member.turnDegrees,
      });
      inverseExpanded[member.rawIndex] = reconstructRawCandidate(
        draft.representative,
        member,
        documentSnapshot,
        preparedStep,
      );
    }
    return intrinsicRealBuildFreeze({
      orbitIndex: draft.orbitIndex,
      representative: rawRoster[draft.representative.rawIndex]!,
      members: intrinsicRealBuildFreeze([...members]) as unknown as typeof members,
    });
  });
  if (canonicalStringify(rawRoster) !== canonicalStringify(inverseExpanded)) {
    throw new TypeError(
      "Proper-C4 inverse expansion does not exactly reconstruct every snapshotted raw row.",
    );
  }
  const rawRosterDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-raw-roster/1",
    rows: rawRoster,
  });
  const branchAccounting = intrinsicRealBuildFreeze({
    rootsPerCandidate: 8 as const,
    camerasPerRoot: 8 as const,
    rawRootEdges: rows.length * 8,
    quotientRootEdges: orbits.length * 8,
    rawLogicalCameraBranches: rows.length * 64,
    quotientLogicalCameraBranches: orbits.length * 64,
  });
  const quotientDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-quotient/1",
    rootCanonicalBytesHash: documentSnapshot.canonicalBytesHash,
    rootDocumentHash: documentSnapshot.documentHash,
    preparedRunInputDigest: preparedStep.preparedRunInputDigest,
    printedStepIdentity: preparedStep.printedStepIdentity,
    rawRosterDigest,
    orbits,
    inverseMap,
    branchAccounting,
  });
  const result = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-step-one-proper-c4-quotient/1" as const,
    rootDocumentHash: documentSnapshot.documentHash,
    rootCanonicalBytesHash: documentSnapshot.canonicalBytesHash,
    preparedRunInputDigest: preparedStep.preparedRunInputDigest,
    printedStepIdentity: preparedStep.printedStepIdentity,
    rawCandidateCount: rows.length,
    orbitCount: orbits.length,
    rawRoster: intrinsicRealBuildFreeze(rawRoster),
    orbits: intrinsicRealBuildFreeze(orbits),
    inverseMap: intrinsicRealBuildFreeze(inverseMap),
    inverseExpandedRawRoster: intrinsicRealBuildFreeze(inverseExpanded),
    rawRosterDigest,
    quotientDigest,
    branchAccounting,
    acceptedDocument: null,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: intrinsicRealBuildFreeze({ status: "absent" as const, authorized: false }),
    authority: "absent" as const,
  }) as unknown as RealBuildStepOneProperC4QuotientInspection;
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, inspections, [result]);
  return result;
}

export function requireRealBuildStepOneProperC4QuotientInspection(
  value: unknown,
): RealBuildStepOneProperC4QuotientInspection {
  if (
    value === null ||
    typeof value !== "object" ||
    !(SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, inspections, [value]) as boolean)
  ) {
    throw new TypeError(
      "Proper-C4 quotient requires the exact frozen inspection from this module.",
    );
  }
  return value as RealBuildStepOneProperC4QuotientInspection;
}
