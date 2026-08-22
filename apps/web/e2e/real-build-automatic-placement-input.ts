import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH,
  REAL_BUILD_AUTOMATIC_MAXIMUM_LDU,
  REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER,
  REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS,
  REAL_BUILD_AUTOMATIC_MINIMUM_LDU,
  snapshotRealBuildAutomaticPrintedStepMetadata,
  type RealBuildAutomaticPrintedStepMetadata,
} from "./real-build-automatic-placement-step";

export type RealBuildAutomaticPlacementConnection = {
  readonly target:
    | { readonly kind: "base"; readonly partId: string }
    | { readonly kind: "witness"; readonly witnessIndex: number };
  readonly targetPortId: string;
  readonly candidatePortId: string;
  readonly connectionKind: "stud-tube";
};

export interface RealBuildAutomaticPlacementWitness {
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly transform: RigidTransform;
  readonly connections: readonly RealBuildAutomaticPlacementConnection[];
}

export interface RealBuildAutomaticPlacementInput {
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly printedStepNumber: number;
  readonly printedStep: Readonly<RealBuildAutomaticPrintedStepMetadata>;
  readonly witnesses: readonly RealBuildAutomaticPlacementWitness[];
}

function data(value: unknown, key: string, path: string): unknown {
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

function denseLength(value: unknown, path: string, maximum: number): number {
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
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximum
  ) {
    throw new RangeError(`${path} must be a dense array with at most ${maximum} entries.`);
  }
  return length;
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

function identifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > REAL_BUILD_AUTOMATIC_MAXIMUM_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(value)
  ) {
    throw new TypeError(`${label} must be a protocol Identifier.`);
  }
  return value;
}

function position(value: unknown, path: string): readonly [number, number, number] {
  if (denseLength(value, path, 3) !== 3) throw new TypeError(`${path} must have 3 entries.`);
  const result: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const coordinate = entry(value, index, path);
    if (
      !Number.isSafeInteger(coordinate) ||
      (coordinate as number) < REAL_BUILD_AUTOMATIC_MINIMUM_LDU ||
      (coordinate as number) > REAL_BUILD_AUTOMATIC_MAXIMUM_LDU
    ) {
      throw new TypeError(`${path}[${index}] must be a protocol LDU coordinate.`);
    }
    result.push(coordinate as number);
  }
  return intrinsicRealBuildFreeze(result) as unknown as readonly [number, number, number];
}

function snapshotConnection(
  value: unknown,
  witnessIndex: number,
  connectionIndex: number,
): RealBuildAutomaticPlacementConnection {
  const path = `Automatic placement witnesses[${witnessIndex}].connections[${connectionIndex}]`;
  const target = data(value, "target", path);
  const kind = data(target, "kind", `${path}.target`);
  const snappedTarget =
    kind === "base"
      ? intrinsicRealBuildFreeze({
          kind,
          partId: identifier(data(target, "partId", `${path}.target`), `${path}.target.partId`),
        })
      : kind === "witness"
        ? (() => {
            const targetIndex = data(target, "witnessIndex", `${path}.target`);
            if (!Number.isSafeInteger(targetIndex) || (targetIndex as number) < 0) {
              throw new TypeError(`${path}.target.witnessIndex must be a non-negative integer.`);
            }
            return intrinsicRealBuildFreeze({ kind, witnessIndex: targetIndex as number });
          })()
        : (() => {
            throw new TypeError(`${path}.target.kind must be base or witness.`);
          })();
  if (data(value, "connectionKind", path) !== "stud-tube") {
    throw new TypeError(`${path}.connectionKind must be stud-tube in protocol generation 1.`);
  }
  return intrinsicRealBuildFreeze({
    target: snappedTarget,
    targetPortId: identifier(data(value, "targetPortId", path), `${path}.targetPortId`),
    candidatePortId: identifier(data(value, "candidatePortId", path), `${path}.candidatePortId`),
    connectionKind: "stud-tube" as const,
  });
}

export function snapshotRealBuildAutomaticPlacementInput(
  unsafeInput: unknown,
): RealBuildAutomaticPlacementInput {
  const documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    data(unsafeInput, "documentSnapshot", "Automatic placement input"),
  );
  const printedStepNumber = data(unsafeInput, "printedStepNumber", "Automatic placement input");
  if (
    !Number.isSafeInteger(printedStepNumber) ||
    (printedStepNumber as number) < 1 ||
    (printedStepNumber as number) > REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER
  ) {
    throw new RangeError(
      `Automatic placement printedStepNumber must be 1 through ${REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER}.`,
    );
  }
  const printedStep = snapshotRealBuildAutomaticPrintedStepMetadata(
    data(unsafeInput, "printedStep", "Automatic placement input"),
  );
  const rows = data(unsafeInput, "witnesses", "Automatic placement input");
  const count = denseLength(
    rows,
    "Automatic placement witnesses",
    REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS -
      REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS,
  );
  if (count < 1) throw new RangeError("Automatic placement requires at least one witness.");
  const witnesses: RealBuildAutomaticPlacementWitness[] = [];
  let operationCount = count + REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_PREPARATION_OPERATIONS;
  for (let index = 0; index < count; index += 1) {
    const row = entry(rows, index, "Automatic placement witnesses");
    const transform = data(row, "transform", `Automatic placement witnesses[${index}]`);
    const connections = data(row, "connections", `Automatic placement witnesses[${index}]`);
    const connectionCount = denseLength(
      connections,
      `Automatic placement witnesses[${index}].connections`,
      REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS - operationCount,
    );
    operationCount += connectionCount;
    const snappedConnections: RealBuildAutomaticPlacementConnection[] = [];
    for (let connectionIndex = 0; connectionIndex < connectionCount; connectionIndex += 1) {
      snappedConnections.push(
        snapshotConnection(
          entry(connections, connectionIndex, "connections"),
          index,
          connectionIndex,
        ),
      );
    }
    witnesses.push(
      intrinsicRealBuildFreeze({
        catalogPartId: identifier(
          data(row, "catalogPartId", `Automatic placement witnesses[${index}]`),
          `Witness ${index} catalogPartId`,
        ),
        colorId: identifier(
          data(row, "colorId", `Automatic placement witnesses[${index}]`),
          `Witness ${index} colorId`,
        ),
        transform: intrinsicRealBuildFreeze({
          positionLdu: position(
            data(transform, "positionLdu", "transform"),
            `Witness ${index} positionLdu`,
          ),
          orientationId: identifier(
            data(transform, "orientationId", "transform"),
            `Witness ${index} orientationId`,
          ),
        }),
        connections: intrinsicRealBuildFreeze(snappedConnections),
      }),
    );
  }
  return intrinsicRealBuildFreeze({
    documentSnapshot,
    printedStepNumber: printedStepNumber as number,
    printedStep,
    witnesses: intrinsicRealBuildFreeze(witnesses),
  });
}
