import {
  UPRIGHT_ORIENTATIONS,
  getPartDefinition,
  type ConnectorPortDefinition,
  type LduVector3,
  type OrientationMatrix,
  type PartDefinition,
  type UprightOrientation,
} from "@lego-studio/catalog";
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
