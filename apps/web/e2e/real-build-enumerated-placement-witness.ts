import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH,
  REAL_BUILD_AUTOMATIC_MAXIMUM_LDU,
  REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS,
  REAL_BUILD_AUTOMATIC_MINIMUM_LDU,
} from "./real-build-automatic-placement-step";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES,
  type RealBuildPreparedPlacementWitness,
} from "./real-build-prepared-search-boundary";

export interface RealBuildEnumeratedPlacementOffer {
  readonly catalogPartId: string;
  readonly transform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
  readonly connections: readonly {
    readonly targetPartId: string;
    readonly targetPortId: string;
    readonly candidatePortId: string;
  }[];
  readonly restsOnBuildPlate: boolean;
}

const placementOffers = new WeakSet<object>();

function data(value: unknown, key: string, path: string): unknown {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError(`${path} must be a data object with an own ${key} property.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${path}.${key} could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${path}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function denseLength(value: unknown, path: string, minimum: number, maximum: number): number {
  let array: boolean;
  let length: unknown;
  try {
    array = Array.isArray(value);
    length =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "length")?.value
        : undefined;
  } catch {
    throw new TypeError(`${path} could not be inspected safely.`);
  }
  if (
    !array ||
    !Number.isSafeInteger(length) ||
    (length as number) < minimum ||
    (length as number) > maximum
  ) {
    throw new RangeError(`${path} must contain ${minimum} through ${maximum} dense entries.`);
  }
  return length as number;
}

function entry(value: unknown, index: number, path: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, String(index))
        : undefined;
  } catch {
    throw new TypeError(`${path}[${index}] could not be inspected safely.`);
  }
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${path}[${index}] must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function identifier(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(value)
  ) {
    throw new TypeError(
      `${path} must be a protocol identifier of 1 through ${REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH} characters.`,
    );
  }
  return value;
}

function position(value: unknown, path: string): readonly [number, number, number] {
  if (denseLength(value, path, 3, 3) !== 3) {
    throw new TypeError(`${path} must contain exactly three LDU coordinates.`);
  }
  const result: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const coordinate = entry(value, index, path);
    if (
      !Number.isSafeInteger(coordinate) ||
      (coordinate as number) < REAL_BUILD_AUTOMATIC_MINIMUM_LDU ||
      (coordinate as number) > REAL_BUILD_AUTOMATIC_MAXIMUM_LDU
    ) {
      throw new RangeError(
        `${path}[${index}] must be a safe-integer LDU coordinate from ${REAL_BUILD_AUTOMATIC_MINIMUM_LDU} through ${REAL_BUILD_AUTOMATIC_MAXIMUM_LDU}.`,
      );
    }
    result.push(coordinate as number);
  }
  return intrinsicRealBuildFreeze(result) as unknown as readonly [number, number, number];
}

/**
 * Detaches one assembly-enumerator row before narrowing or provisional placement can mutate it.
 * The brand proves only immutable inspection, never placement or completion authority.
 */
export function snapshotRealBuildEnumeratedPlacementOffer(
  value: unknown,
): RealBuildEnumeratedPlacementOffer {
  const path = "Enumerated placement offer";
  const transform = data(value, "transform", path);
  const rows = data(value, "connections", path);
  const connectionCount = denseLength(
    rows,
    `${path}.connections`,
    0,
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  );
  const connections: RealBuildEnumeratedPlacementOffer["connections"][number][] = [];
  for (let index = 0; index < connectionCount; index += 1) {
    const rowPath = `${path}.connections[${index}]`;
    const row = entry(rows, index, `${path}.connections`);
    connections.push(
      intrinsicRealBuildFreeze({
        targetPartId: identifier(data(row, "targetPartId", rowPath), `${rowPath}.targetPartId`),
        targetPortId: identifier(data(row, "targetPortId", rowPath), `${rowPath}.targetPortId`),
        candidatePortId: identifier(
          data(row, "candidatePortId", rowPath),
          `${rowPath}.candidatePortId`,
        ),
      }),
    );
  }
  const orientationId = identifier(
    data(transform, "orientationId", `${path}.transform`),
    `${path}.transform.orientationId`,
  );
  if (!/^upright-yaw-(?:0|90|180|270)$/u.test(orientationId)) {
    throw new TypeError(
      `${path}.transform.orientationId must be an exact canonical upright quarter-turn.`,
    );
  }
  const restsOnBuildPlate = data(value, "restsOnBuildPlate", path);
  if (typeof restsOnBuildPlate !== "boolean") {
    throw new TypeError(`${path}.restsOnBuildPlate must be a boolean measured by the enumerator.`);
  }
  const result = intrinsicRealBuildFreeze({
    catalogPartId: identifier(data(value, "catalogPartId", path), `${path}.catalogPartId`),
    transform: intrinsicRealBuildFreeze({
      positionLdu: position(
        data(transform, "positionLdu", `${path}.transform`),
        `${path}.transform.positionLdu`,
      ),
      orientationId,
    }),
    connections: intrinsicRealBuildFreeze(connections),
    restsOnBuildPlate,
  });
  placementOffers.add(result);
  return result;
}

function requirePlacementOffer(value: unknown, index: number): RealBuildEnumeratedPlacementOffer {
  if (value === null || typeof value !== "object" || !placementOffers.has(value)) {
    throw new TypeError(
      `Whole-step candidate offeredCandidates[${index}] must be an exact immutable enumerator snapshot.`,
    );
  }
  return value as RealBuildEnumeratedPlacementOffer;
}

/**
 * Converts one complete provisional branch into deterministic compiler witnesses.
 * The provisional document is deliberately ignored; only exact base bytes, declared pieces,
 * returned part IDs, and detached enumerator facts participate.
 */
export function projectRealBuildEnumeratedPlacementWitnesses(
  input: unknown,
): readonly RealBuildPreparedPlacementWitness[] {
  const documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    data(input, "documentSnapshot", "Enumerated placement witness input"),
  );
  const declared = data(input, "pieces", "Enumerated placement witness input");
  const candidate = data(input, "candidate", "Enumerated placement witness input");
  const pieceCount = denseLength(
    declared,
    "Enumerated placement witness input.pieces",
    1,
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES,
  );
  const partIds = data(candidate, "partIds", "Enumerated placement witness input.candidate");
  const offers = data(
    candidate,
    "offeredCandidates",
    "Enumerated placement witness input.candidate",
  );
  denseLength(
    partIds,
    "Enumerated placement witness input.candidate.partIds",
    pieceCount,
    pieceCount,
  );
  denseLength(
    offers,
    "Enumerated placement witness input.candidate.offeredCandidates",
    pieceCount,
    pieceCount,
  );

  const retainedOffers: RealBuildEnumeratedPlacementOffer[] = [];
  let operationCount = pieceCount + REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS;
  for (let index = 0; index < pieceCount; index += 1) {
    const offer = requirePlacementOffer(
      entry(offers, index, "Enumerated placement witness input.candidate.offeredCandidates"),
      index,
    );
    operationCount += offer.connections.length;
    if (operationCount > REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS) {
      throw new RangeError(
        `Enumerated placement branch expands to ${operationCount} add-step, part, and connection operations above the ${REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS}-operation compiler limit.`,
      );
    }
    retainedOffers.push(offer);
  }

  const basePartIds = new Set(documentSnapshot.document.parts.map(({ id }) => id));
  const generatedIndex = new Map<string, number>();
  for (let index = 0; index < pieceCount; index += 1) {
    const partId = identifier(
      entry(partIds, index, "Enumerated placement witness input.candidate.partIds"),
      `Enumerated placement candidate partIds[${index}]`,
    );
    if (basePartIds.has(partId) || generatedIndex.has(partId)) {
      throw new TypeError(
        `Enumerated placement candidate partIds[${index}] ${JSON.stringify(partId)} is not unique outside the exact base document.`,
      );
    }
    generatedIndex.set(partId, index);
  }

  const witnesses: RealBuildPreparedPlacementWitness[] = [];
  for (let index = 0; index < pieceCount; index += 1) {
    const declaredPath = `Enumerated placement witness input.pieces[${index}]`;
    const piece = entry(declared, index, "Enumerated placement witness input.pieces");
    const identityKey = identifier(
      data(piece, "identityKey", declaredPath),
      `${declaredPath}.identityKey`,
    );
    const catalogPartId = identifier(
      data(piece, "catalogPartId", declaredPath),
      `${declaredPath}.catalogPartId`,
    );
    const colorId = identifier(data(piece, "colorId", declaredPath), `${declaredPath}.colorId`);
    const offer = retainedOffers[index]!;
    if (offer.catalogPartId !== catalogPartId) {
      throw new TypeError(
        `Enumerated placement offer ${index} names catalog part ${JSON.stringify(offer.catalogPartId)} instead of prepared piece ${JSON.stringify(catalogPartId)}.`,
      );
    }
    const connections = offer.connections.map((connection, connectionIndex) => {
      const priorWitness = generatedIndex.get(connection.targetPartId);
      if (priorWitness !== undefined && priorWitness >= index) {
        throw new TypeError(
          `Enumerated placement offer ${index} connection ${connectionIndex} targets future witness ${priorWitness}; connections may name only the exact base or an earlier witness.`,
        );
      }
      if (priorWitness === undefined && !basePartIds.has(connection.targetPartId)) {
        throw new TypeError(
          `Enumerated placement offer ${index} connection ${connectionIndex} targets unknown part ${JSON.stringify(connection.targetPartId)}; it must name the exact base or an earlier witness part ID.`,
        );
      }
      return intrinsicRealBuildFreeze({
        target:
          priorWitness === undefined
            ? intrinsicRealBuildFreeze({ kind: "base" as const, partId: connection.targetPartId })
            : intrinsicRealBuildFreeze({ kind: "witness" as const, witnessIndex: priorWitness }),
        targetPortId: connection.targetPortId,
        candidatePortId: connection.candidatePortId,
        connectionKind: "stud-tube" as const,
      });
    });
    if (connections.length === 0 && !offer.restsOnBuildPlate) {
      throw new TypeError(
        `Enumerated placement offer ${index} has neither a connection nor measured build-plate support; it cannot become an automatic placement witness.`,
      );
    }
    witnesses.push(
      intrinsicRealBuildFreeze({
        identityKey,
        catalogPartId,
        colorId,
        transform: offer.transform,
        connections: intrinsicRealBuildFreeze(connections),
      }),
    );
  }
  return intrinsicRealBuildFreeze(witnesses);
}

export type RealBuildEnumeratedPlacementWitnessInput = Readonly<{
  documentSnapshot: RealBuildCandidateDocumentSnapshot;
  pieces: readonly {
    readonly identityKey: string;
    readonly catalogPartId: string;
    readonly colorId: string;
  }[];
  candidate: Readonly<{
    readonly partIds: readonly string[];
    readonly offeredCandidates: readonly RealBuildEnumeratedPlacementOffer[];
  }>;
}>;
