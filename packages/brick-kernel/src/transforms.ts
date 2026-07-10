import {
  UPRIGHT_ORIENTATIONS,
  getPartDefinition,
  type ConnectorPortDefinition,
  type LduVector3,
  type OrientationMatrix,
  type PartDefinition,
  type UprightOrientation,
} from "@lego-studio/catalog";
import { validateRigidTransform } from "@lego-studio/protocol";
import type { PartInstance, RigidTransform } from "@lego-studio/protocol";

export interface ConnectorWorldFrame {
  readonly partId: string;
  readonly portId: string;
  readonly kind: ConnectorPortDefinition["kind"];
  readonly positionLdu: LduVector3;
  readonly normal: LduVector3;
}

export class TransformPolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TransformPolicyError";
  }
}

export function getUprightOrientation(orientationId: string): UprightOrientation {
  const orientation = UPRIGHT_ORIENTATIONS.find(({ id }) => id === orientationId);
  if (!orientation) {
    throw new TransformPolicyError(`Unknown upright orientation: ${orientationId}`);
  }
  return orientation;
}

export function rotateLduVector(matrix: OrientationMatrix, [x, y, z]: LduVector3): LduVector3 {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

function multiplyOrientationMatrices(
  parent: OrientationMatrix,
  local: OrientationMatrix,
): OrientationMatrix {
  const product: OrientationMatrix = [
    parent[0] * local[0] + parent[1] * local[3] + parent[2] * local[6],
    parent[0] * local[1] + parent[1] * local[4] + parent[2] * local[7],
    parent[0] * local[2] + parent[1] * local[5] + parent[2] * local[8],
    parent[3] * local[0] + parent[4] * local[3] + parent[5] * local[6],
    parent[3] * local[1] + parent[4] * local[4] + parent[5] * local[7],
    parent[3] * local[2] + parent[4] * local[5] + parent[5] * local[8],
    parent[6] * local[0] + parent[7] * local[3] + parent[8] * local[6],
    parent[6] * local[1] + parent[7] * local[4] + parent[8] * local[7],
    parent[6] * local[2] + parent[7] * local[5] + parent[8] * local[8],
  ];
  if (!product.every(Number.isSafeInteger)) {
    throw new TransformPolicyError("Composed orientation matrix must remain integral");
  }
  return product;
}

function assertDataOnlyTransform(value: RigidTransform, label: string): void {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new TypeError("transform is not a record");
    }
    const transformDescriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(transformDescriptors).some(
        (key) => typeof key !== "string" || !("value" in transformDescriptors[key]!),
      )
    ) {
      throw new TypeError("transform contains accessors or symbol keys");
    }
    const position = transformDescriptors.positionLdu?.value;
    if (!Array.isArray(position)) throw new TypeError("position is not an array");
    const positionDescriptors = Object.getOwnPropertyDescriptors(position);
    if (
      Reflect.ownKeys(positionDescriptors).some(
        (key) => typeof key !== "string" || !("value" in positionDescriptors[key]!),
      )
    ) {
      throw new TypeError("position contains accessors or symbol keys");
    }
  } catch {
    throw new TransformPolicyError(`${label} transform must contain data properties only`);
  }
}

function requireRigidTransform(value: unknown, label: string): RigidTransform {
  if (!validateRigidTransform(value)) {
    throw new TransformPolicyError(`${label} transform violates the rigid-transform policy`);
  }
  const transform = value as RigidTransform;
  getUprightOrientation(transform.orientationId);
  return transform;
}

/**
 * Composes a parent/world transform with a local transform under the finite
 * upright orientation policy. The exact matrix product must resolve back to a
 * catalog orientation; arbitrary matrices and fractional coordinates are not
 * representable in the canonical document. Inputs are inert value records
 * (such as parsed JSON); active Proxy traps must be rejected at the caller's
 * trust boundary because JavaScript cannot inspect them without executing code.
 */
export function composeRigidTransforms(
  parentValue: RigidTransform,
  localValue: RigidTransform,
): RigidTransform {
  assertDataOnlyTransform(parentValue, "Parent");
  assertDataOnlyTransform(localValue, "Local");
  let detached: { readonly parent: unknown; readonly local: unknown };
  try {
    detached = structuredClone({ parent: parentValue, local: localValue });
  } catch {
    throw new TransformPolicyError("Transforms must be detached structured-cloneable data");
  }
  const parent = requireRigidTransform(detached.parent, "Parent");
  const local = requireRigidTransform(detached.local, "Local");
  const parentOrientation = getUprightOrientation(parent.orientationId);
  const localOrientation = getUprightOrientation(local.orientationId);
  const composedMatrix = multiplyOrientationMatrices(
    parentOrientation.matrix,
    localOrientation.matrix,
  );
  const composedOrientation = UPRIGHT_ORIENTATIONS.find(({ matrix }) =>
    matrix.every((value, index) => value === composedMatrix[index]),
  );
  if (!composedOrientation) {
    throw new TransformPolicyError(
      `Upright orientation policy is not closed for ${parent.orientationId} and ${local.orientationId}`,
    );
  }

  const rotatedLocalPosition = rotateLduVector(parentOrientation.matrix, local.positionLdu);
  const composed: RigidTransform = {
    positionLdu: [
      parent.positionLdu[0] + rotatedLocalPosition[0],
      parent.positionLdu[1] + rotatedLocalPosition[1],
      parent.positionLdu[2] + rotatedLocalPosition[2],
    ],
    orientationId: composedOrientation.id,
  };
  if (!validateRigidTransform(composed)) {
    throw new TransformPolicyError("Composed transform violates the rigid-transform policy");
  }
  return composed;
}

export function transformLduPoint(transform: RigidTransform, point: LduVector3): LduVector3 {
  const rotated = rotateLduVector(getUprightOrientation(transform.orientationId).matrix, point);
  return [
    transform.positionLdu[0] + rotated[0],
    transform.positionLdu[1] + rotated[1],
    transform.positionLdu[2] + rotated[2],
  ];
}

function requirePartDefinition(catalogPartId: string): PartDefinition {
  const definition = getPartDefinition(catalogPartId);
  if (!definition) {
    throw new TransformPolicyError(`Unknown catalog part: ${catalogPartId}`);
  }
  return definition;
}

function requirePort(definition: PartDefinition, portId: string): ConnectorPortDefinition {
  const port = definition.connectors.find(({ id }) => id === portId);
  if (!port) {
    throw new TransformPolicyError(`Unknown port ${portId} on ${definition.id}`);
  }
  return port;
}

export function getConnectorWorldFrame(
  part: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  portId: string,
): ConnectorWorldFrame {
  const definition = requirePartDefinition(part.catalogPartId);
  const port = requirePort(definition, portId);
  const orientation = getUprightOrientation(part.transform.orientationId);

  return {
    partId: part.id,
    portId,
    kind: port.kind,
    positionLdu: transformLduPoint(part.transform, port.positionLdu),
    normal: rotateLduVector(orientation.matrix, port.normal),
  };
}

export function createAttachedTransform(
  targetPart: Pick<PartInstance, "id" | "catalogPartId" | "transform">,
  targetPortId: string,
  attachedCatalogPartId: string,
  attachedPortId: string,
  orientationId: string,
): RigidTransform {
  const targetFrame = getConnectorWorldFrame(targetPart, targetPortId);
  const attachedDefinition = requirePartDefinition(attachedCatalogPartId);
  const attachedPort = requirePort(attachedDefinition, attachedPortId);
  const orientation = getUprightOrientation(orientationId);
  const attachedNormal = rotateLduVector(orientation.matrix, attachedPort.normal);

  if (
    targetFrame.kind === attachedPort.kind ||
    !attachedPort.compatibleKinds.includes(targetFrame.kind)
  ) {
    throw new TransformPolicyError(
      `Incompatible ports: ${targetFrame.kind} and ${attachedPort.kind}`,
    );
  }

  if (
    attachedNormal[0] !== -targetFrame.normal[0] ||
    attachedNormal[1] !== -targetFrame.normal[1] ||
    attachedNormal[2] !== -targetFrame.normal[2]
  ) {
    throw new TransformPolicyError("Attached connector normals must face one another");
  }

  const rotatedLocalPort = rotateLduVector(orientation.matrix, attachedPort.positionLdu);
  return {
    positionLdu: [
      targetFrame.positionLdu[0] - rotatedLocalPort[0],
      targetFrame.positionLdu[1] - rotatedLocalPort[1],
      targetFrame.positionLdu[2] - rotatedLocalPort[2],
    ],
    orientationId,
  };
}
