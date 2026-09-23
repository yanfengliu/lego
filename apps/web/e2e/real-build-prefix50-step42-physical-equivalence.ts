import { getPartDefinition } from "@lego-studio/catalog";
import {
  canonicalDigest,
  getProperOrientation,
  rotateLduVector,
  transformLduPoint,
} from "@lego-studio/brick-kernel";
import type { LduVector3, PartDefinition } from "@lego-studio/catalog";
import type { RigidTransform } from "@lego-studio/protocol";

export interface RealBuildPrefix50PhysicalLayerCommitments {
  readonly connectors: `sha256:${string}`;
  readonly collision: `sha256:${string}`;
  readonly allowances: `sha256:${string}`;
  readonly geometry: `sha256:${string}`;
}

function vectorKey(vector: readonly number[]): string {
  return vector.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)).join(",");
}

function undirectedVector(vector: LduVector3): string {
  const forward = vectorKey(vector);
  const reverse = vectorKey(vector.map((coordinate) => -coordinate) as unknown as LduVector3);
  return forward.localeCompare(reverse) <= 0 ? forward : reverse;
}

function worldDirection(transform: RigidTransform, vector: LduVector3): LduVector3 {
  return rotateLduVector(getProperOrientation(transform.orientationId).matrix, vector);
}

function worldBounds(
  transform: RigidTransform,
  bounds: { readonly min: LduVector3; readonly max: LduVector3 },
) {
  const corners: LduVector3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push(transformLduPoint(transform, [x, y, z]));
      }
    }
  }
  return {
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((corner) => corner[axis]!))),
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((corner) => corner[axis]!))),
  };
}

function sortedDigest(values: readonly unknown[]): `sha256:${string}` {
  return canonicalDigest(
    [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  );
}

function connectorCommitment(
  definition: PartDefinition,
  transform: RigidTransform,
): `sha256:${string}` {
  return sortedDigest(
    definition.connectors.map((connector) => ({
      kind: connector.kind,
      geometryRole: connector.geometryRole,
      profileId: connector.profileId,
      gender: connector.gender,
      capacity: connector.capacity,
      compatibleKinds: [...connector.compatibleKinds].sort(),
      sharedCapacityGroupCount: connector.sharedCapacityGroupIds?.length ?? 0,
      positionLdu: transformLduPoint(transform, connector.positionLdu),
      normal: worldDirection(transform, connector.normal),
      axialSpan:
        connector.axialSpan === undefined
          ? null
          : {
              openEndLdu: transformLduPoint(transform, connector.axialSpan.openEndLdu),
              closedEndLdu: transformLduPoint(transform, connector.axialSpan.closedEndLdu),
              depthLdu: connector.axialSpan.depthLdu,
              sliding: connector.axialSpan.sliding,
            },
    })),
  );
}

function collisionCommitment(
  definition: PartDefinition,
  transform: RigidTransform,
): `sha256:${string}` {
  return sortedDigest(
    definition.collision.primitives.map((primitive) => {
      if (primitive.kind === "box") {
        return {
          kind: primitive.kind,
          tag: primitive.tag,
          ...worldBounds(transform, { min: primitive.minLdu, max: primitive.maxLdu }),
        };
      }
      if (primitive.kind === "cylinder") {
        const localAxis = {
          x: [1, 0, 0],
          y: [0, 1, 0],
          z: [0, 0, 1],
        }[primitive.axis] as unknown as LduVector3;
        return {
          kind: primitive.kind,
          tag: primitive.tag,
          centerLdu: transformLduPoint(transform, primitive.centerLdu),
          axis: undirectedVector(worldDirection(transform, localAxis)),
          radiusLdu: primitive.radiusLdu,
          heightLdu: primitive.heightLdu,
          validatedConnectionProfileRadiusLdu:
            primitive.validatedConnectionProfileRadiusLdu ?? null,
        };
      }
      throw new TypeError(
        `Step-42 exact physical equivalence does not silently approximate ${definition.id} ${primitive.kind} collision geometry.`,
      );
    }),
  );
}

function allowanceCommitment(
  definition: PartDefinition,
  transform: RigidTransform,
): `sha256:${string}` {
  const connectorById = new Map(
    definition.connectors.map((connector) => [connector.id, connector]),
  );
  const clutchAllowances = definition.collision.allowances.map((allowance) => {
    const connector = connectorById.get(allowance.portId);
    if (connector === undefined) {
      throw new TypeError(
        `Step-42 exact physical equivalence found allowance ${allowance.id} without connector ${allowance.portId}.`,
      );
    }
    return {
      schemaVersion: "collision-allowance/1",
      portKind: allowance.portKind,
      incomingPrimitiveTag: allowance.incomingPrimitiveTag,
      centerLdu: transformLduPoint(transform, allowance.centerLdu),
      insertionNormal: worldDirection(transform, connector.normal),
      radiusLdu: allowance.radiusLdu,
      maxInsertionDepthLdu: allowance.maxInsertionDepthLdu,
      requiresValidatedConnection: allowance.requiresValidatedConnection,
    };
  });
  const throughBores = (definition.collision.throughAxleBoreAllowances ?? []).map((allowance) => ({
    schemaVersion: allowance.schemaVersion,
    portKind: allowance.portKind,
    incomingPortKind: allowance.incomingPortKind,
    incomingPrimitiveTag: allowance.incomingPrimitiveTag,
    profileId: allowance.profileId,
    sourceSection: allowance.sourceSection,
    endpointsLdu: [
      transformLduPoint(transform, allowance.startLdu),
      transformLduPoint(transform, allowance.endLdu),
    ]
      .map(vectorKey)
      .sort(),
    radiusLdu: allowance.radiusLdu,
    segmentLengthLdu: allowance.segmentLengthLdu,
    caps: allowance.caps,
    sliding: allowance.sliding,
    requiresValidatedConnection: allowance.requiresValidatedConnection,
  }));
  return sortedDigest([...clutchAllowances, ...throughBores]);
}

function geometryCommitment(
  definition: PartDefinition,
  transform: RigidTransform,
): `sha256:${string}` {
  if (
    definition.geometry.generatorId !== "builtin:parametric-rectilinear-part/1" ||
    definition.geometry.bodyArc !== undefined
  ) {
    throw new TypeError(
      `Step-42 exact physical equivalence requires the exact rectilinear parametric geometry for ${definition.id}.`,
    );
  }
  const bodyPrimitives = definition.collision.primitives
    .filter(({ tag }) => tag === "body")
    .map((primitive) => {
      if (primitive.kind !== "box") {
        throw new TypeError(
          `Step-42 exact physical equivalence refuses non-box render body ${primitive.kind} for ${definition.id}.`,
        );
      }
      return {
        role: "body",
        ...worldBounds(transform, { min: primitive.minLdu, max: primitive.maxLdu }),
      };
    });
  const studs = definition.collision.primitives.flatMap((primitive) =>
    primitive.kind === "cylinder" && primitive.tag === "stud"
      ? [
          {
            role: "stud",
            centerLdu: transformLduPoint(transform, primitive.centerLdu),
            axis: undirectedVector(worldDirection(transform, [0, 1, 0])),
            radiusLdu: primitive.radiusLdu,
            heightLdu: primitive.heightLdu,
          },
        ]
      : [],
  );
  const bodyTubes = definition.geometry.bodyTubes;
  const tubes =
    bodyTubes === undefined
      ? []
      : bodyTubes.centersXZLdu.map(([x, z]) => ({
          role: "underside-tube",
          centerLdu: transformLduPoint(transform, [
            x,
            definition.bodyBoundsLdu.max[1] - bodyTubes.heightLdu / 2,
            z,
          ]),
          axis: undirectedVector(worldDirection(transform, [0, 1, 0])),
          innerRadiusLdu: bodyTubes.innerRadiusLdu,
          outerRadiusLdu: bodyTubes.outerRadiusLdu,
          heightLdu: bodyTubes.heightLdu,
        }));
  return sortedDigest([
    {
      role: "recipe",
      bodyMode: definition.geometry.bodyMode,
      studMode: definition.geometry.studMode,
      undersideMode: definition.geometry.undersideMode,
      bounds: worldBounds(transform, definition.boundsLdu),
    },
    ...bodyPrimitives,
    ...studs,
    ...tubes,
  ]);
}

/** Exact world-space physical layers used to justify one symmetry quotient. */
export function realBuildPrefix50PhysicalLayerCommitments(
  catalogPartId: string,
  transform: RigidTransform,
): RealBuildPrefix50PhysicalLayerCommitments {
  const definition = getPartDefinition(catalogPartId);
  if (definition === undefined) {
    throw new TypeError(`Step-42 exact physical equivalence names unknown part ${catalogPartId}.`);
  }
  return {
    connectors: connectorCommitment(definition, transform),
    collision: collisionCommitment(definition, transform),
    allowances: allowanceCommitment(definition, transform),
    geometry: geometryCommitment(definition, transform),
  };
}

export function sameRealBuildPrefix50PhysicalLayers(
  left: RealBuildPrefix50PhysicalLayerCommitments,
  right: RealBuildPrefix50PhysicalLayerCommitments,
): boolean {
  return (
    left.connectors === right.connectors &&
    left.collision === right.collision &&
    left.allowances === right.allowances &&
    left.geometry === right.geometry
  );
}
