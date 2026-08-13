export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS = 8_192;
export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CHILDREN = 8_192;
export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES = 32_768;
export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES = 1_024;
export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS = 1_023;
export const MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_PREPARED_SEARCH_ID_LENGTH = 256;

export interface RealBuildPreparedPlacementWitness {
  readonly identityKey: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: {
    readonly positionLdu: readonly [number, number, number];
    readonly orientationId: string;
  };
  readonly connections: readonly RealBuildPreparedPlacementConnection[];
}

export interface RealBuildPreparedPlacementConnection {
  readonly target:
    | { readonly kind: "base"; readonly partId: string }
    | { readonly kind: "witness"; readonly witnessIndex: number };
  readonly targetPortId: string;
  readonly candidatePortId: string;
  readonly connectionKind: "stud-tube";
}

export function preparedSearchUtf8ByteLength(value: string, stopAfter: number): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > stopAfter) return bytes;
  }
  return bytes;
}

export function preparedSearchData(value: unknown, key: string, path: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a data object.`);
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

export function preparedSearchArrayLength(
  value: unknown,
  path: string,
  maximum: number,
  minimum = 1,
): number {
  let isArray: boolean;
  let length: unknown;
  try {
    isArray = Array.isArray(value);
    length =
      value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "length")?.value
        : undefined;
  } catch {
    throw new TypeError(`${path} could not be inspected safely.`);
  }
  if (
    !isArray ||
    !Number.isSafeInteger(length) ||
    (length as number) < minimum ||
    (length as number) > maximum
  ) {
    throw new RangeError(`${path} must contain ${minimum} through ${maximum} dense entries.`);
  }
  return length as number;
}

export function preparedSearchArrayEntry(value: unknown, index: number, path: string): unknown {
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

function boundedString(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAXIMUM_PREPARED_SEARCH_ID_LENGTH ||
    value.includes("\0")
  ) {
    throw new TypeError(
      `${path} must contain 1 through ${MAXIMUM_PREPARED_SEARCH_ID_LENGTH} non-NUL characters.`,
    );
  }
  return value;
}

function snapshotPosition(value: unknown, path: string): readonly [number, number, number] {
  if (preparedSearchArrayLength(value, path, 3) !== 3) {
    throw new TypeError(`${path} requires exactly 3 coordinates.`);
  }
  const coordinates: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const coordinate = preparedSearchArrayEntry(value, index, path);
    if (!Number.isSafeInteger(coordinate)) {
      throw new TypeError(`${path}[${index}] must be a safe-integer LDU coordinate.`);
    }
    coordinates.push(coordinate as number);
  }
  return Object.freeze(coordinates) as unknown as readonly [number, number, number];
}

function snapshotConnection(
  value: unknown,
  path: string,
  witnessIndex: number,
): RealBuildPreparedPlacementConnection {
  const target = preparedSearchData(value, "target", path);
  const targetKind = preparedSearchData(target, "kind", `${path}.target`);
  let detachedTarget: RealBuildPreparedPlacementConnection["target"];
  if (targetKind === "base") {
    detachedTarget = Object.freeze({
      kind: "base" as const,
      partId: boundedString(
        preparedSearchData(target, "partId", `${path}.target`),
        `${path}.target.partId`,
      ),
    });
  } else if (targetKind === "witness") {
    const targetIndex = preparedSearchData(target, "witnessIndex", `${path}.target`);
    if (
      !Number.isSafeInteger(targetIndex) ||
      (targetIndex as number) < 0 ||
      (targetIndex as number) >= witnessIndex
    ) {
      throw new TypeError(
        `${path}.target.witnessIndex must name an earlier witness from 0 through ${witnessIndex - 1}.`,
      );
    }
    detachedTarget = Object.freeze({
      kind: "witness" as const,
      witnessIndex: targetIndex as number,
    });
  } else {
    throw new TypeError(`${path}.target.kind must be "base" or "witness".`);
  }
  if (preparedSearchData(value, "connectionKind", path) !== "stud-tube") {
    throw new TypeError(`${path}.connectionKind must be "stud-tube".`);
  }
  return Object.freeze({
    target: detachedTarget,
    targetPortId: boundedString(
      preparedSearchData(value, "targetPortId", path),
      `${path}.targetPortId`,
    ),
    candidatePortId: boundedString(
      preparedSearchData(value, "candidatePortId", path),
      `${path}.candidatePortId`,
    ),
    connectionKind: "stud-tube",
  });
}

export function snapshotPreparedPlacementWitness(
  value: unknown,
  path: string,
  witnessIndex: number,
  plannedConnections?: readonly unknown[],
): RealBuildPreparedPlacementWitness {
  const transform = preparedSearchData(value, "transform", path);
  const orientationId = boundedString(
    preparedSearchData(transform, "orientationId", `${path}.transform`),
    `${path}.transform.orientationId`,
  );
  if (!/^upright-yaw-(?:0|90|180|270)$/u.test(orientationId)) {
    throw new TypeError(
      `${path}.transform.orientationId must be an exact canonical upright quarter-turn.`,
    );
  }
  const suppliedConnections =
    plannedConnections === undefined ? preparedSearchData(value, "connections", path) : null;
  const connectionCount =
    plannedConnections?.length ??
    preparedSearchArrayLength(
      suppliedConnections,
      `${path}.connections`,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
      0,
    );
  const connections: RealBuildPreparedPlacementConnection[] = [];
  for (let index = 0; index < connectionCount; index += 1) {
    connections.push(
      snapshotConnection(
        plannedConnections?.[index] ??
          preparedSearchArrayEntry(suppliedConnections, index, `${path}.connections`),
        `${path}.connections[${index}]`,
        witnessIndex,
      ),
    );
  }
  return Object.freeze({
    identityKey: boundedString(
      preparedSearchData(value, "identityKey", path),
      `${path}.identityKey`,
    ),
    catalogPartId: boundedString(
      preparedSearchData(value, "catalogPartId", path),
      `${path}.catalogPartId`,
    ),
    colorId: boundedString(preparedSearchData(value, "colorId", path), `${path}.colorId`),
    transform: Object.freeze({
      positionLdu: snapshotPosition(
        preparedSearchData(transform, "positionLdu", `${path}.transform`),
        `${path}.transform.positionLdu`,
      ),
      orientationId,
    }),
    connections: Object.freeze(connections),
  });
}
