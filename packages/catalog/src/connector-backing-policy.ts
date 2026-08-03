import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import {
  CONNECTOR_KIND_RULES,
  connectorAccepts,
  STUD_HEIGHT_LDU,
  STUD_PITCH_LDU,
  STUD_RADIUS_LDU,
} from "./constants.ts";
import type {
  CollisionAllowance,
  CollisionPrimitive,
  ConnectorKind,
  ConnectorPortDefinition,
  LduVector3,
} from "./types.ts";

import { GEOMETRY_EPSILON } from "./arc-plan.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";

/**
 * Divisions per axis when asking whether a stud's whole footprint is backed by
 * solid. Four is enough because every box here is axis-aligned and no smaller
 * than a half stud, so nothing can hide between samples.
 */
const STUD_FOOTPRINT_SAMPLES = 4;
/** A source-verified edge grip must still back most of the incoming stud circle. */
const MIN_PARTIAL_OVERHANG_BACKING_FRACTION = 0.75;

const circleIntersectionArea = (
  leftRadius: number,
  rightRadius: number,
  distance: number,
): number => {
  if (distance >= leftRadius + rightRadius) return 0;
  if (distance <= Math.abs(leftRadius - rightRadius)) {
    return Math.PI * Math.min(leftRadius, rightRadius) ** 2;
  }
  const leftAngle = Math.acos(
    (distance ** 2 + leftRadius ** 2 - rightRadius ** 2) / (2 * distance * leftRadius),
  );
  const rightAngle = Math.acos(
    (distance ** 2 + rightRadius ** 2 - leftRadius ** 2) / (2 * distance * rightRadius),
  );
  const lens = Math.sqrt(
    (-distance + leftRadius + rightRadius) *
      (distance + leftRadius - rightRadius) *
      (distance - leftRadius + rightRadius) *
      (distance + leftRadius + rightRadius),
  );
  return leftRadius ** 2 * leftAngle + rightRadius ** 2 * rightAngle - lens / 2;
};

const offsetKey = ([x, z]: readonly [number, number]): string => `${x},${z}`;
const hasPinnedDigest = (value: string, algorithm: "md5" | "sha256"): boolean =>
  new RegExp(`^${algorithm}:[0-9a-f]{${algorithm === "md5" ? 32 : 64}}$`).test(value);
const normalizedOffsetSetSha256 = (
  offsets: readonly (readonly [number, number])[],
): `sha256:${string}` => {
  const normalized = JSON.stringify(
    [...offsets].sort(([leftX, leftZ], [rightX, rightZ]) => leftX - rightX || leftZ - rightZ),
  );
  return `sha256:${bytesToHex(sha256(utf8ToBytes(normalized)))}`;
};

export const validatePartialOverhangClutchEvidence = (blueprint: PartBlueprint): void => {
  const { bodyArc, clutchOffsetsLdu, partialOverhangClutchEvidence } = blueprint;
  if (partialOverhangClutchEvidence === undefined) return;
  if (bodyArc === undefined || clutchOffsetsLdu === undefined) {
    throw new Error(
      `${blueprint.ldrawId} partial-overhang clutch evidence requires an analytic bodyArc and explicit clutchOffsetsLdu`,
    );
  }
  const digestChecks = [
    [partialOverhangClutchEvidence.manifestSha256, "sha256", "manifestSha256"],
    [partialOverhangClutchEvidence.manifestMd5, "md5", "manifestMd5"],
    [partialOverhangClutchEvidence.bundleSha256, "sha256", "bundleSha256"],
    [partialOverhangClutchEvidence.primitiveXmlSha256, "sha256", "primitiveXmlSha256"],
    [partialOverhangClutchEvidence.independentPartSha256, "sha256", "independentPartSha256"],
    [partialOverhangClutchEvidence.independentSubpartSha256, "sha256", "independentSubpartSha256"],
    [
      partialOverhangClutchEvidence.normalizedClutchOffsetsSha256,
      "sha256",
      "normalizedClutchOffsetsSha256",
    ],
  ] as const;
  for (const [value, algorithm, field] of digestChecks) {
    if (!hasPinnedDigest(value, algorithm)) {
      throw new Error(
        `${blueprint.ldrawId} partial-overhang evidence ${field} must be a lowercase ${algorithm} digest`,
      );
    }
  }
  if (
    partialOverhangClutchEvidence.sourceId.length === 0 ||
    partialOverhangClutchEvidence.sourceRevision.length === 0 ||
    partialOverhangClutchEvidence.independentSourceId.length === 0 ||
    partialOverhangClutchEvidence.independentSourceRevision.length === 0
  ) {
    throw new Error(
      `${blueprint.ldrawId} partial-overhang evidence must name both exact source identities and revisions`,
    );
  }
  const normalizedClutchOffsetsSha256 = normalizedOffsetSetSha256(clutchOffsetsLdu);
  if (
    normalizedClutchOffsetsSha256 !== partialOverhangClutchEvidence.normalizedClutchOffsetsSha256
  ) {
    throw new Error(
      `${blueprint.ldrawId} explicit clutch offsets digest ${normalizedClutchOffsetsSha256} does not match source-extracted normalized digest ${partialOverhangClutchEvidence.normalizedClutchOffsetsSha256}`,
    );
  }
};

/** A port reads every implied field from the one connector-kind table. */
const makePort = (
  id: string,
  kind: ConnectorKind,
  positionLdu: LduVector3,
  normal: LduVector3,
  orientationId: "connector-up" | "connector-down",
): ConnectorPortDefinition => {
  const rule = CONNECTOR_KIND_RULES[kind];
  return {
    id,
    kind,
    geometryRole: rule.geometryRole,
    profileId: rule.profileId,
    positionLdu,
    normal,
    orientationId,
    capacity: 1,
    compatibleKinds: connectorAccepts(kind),
    gender: rule.gender,
  };
};

interface ConnectorFeatureInput {
  blueprint: PartBlueprint;
  studded: boolean;
  topY: number;
  bottomY: number;
  bodyPrimitives: readonly CollisionPrimitive[];
}

interface ConnectorFeatures {
  connectors: ConnectorPortDefinition[];
  primitives: CollisionPrimitive[];
  allowances: CollisionAllowance[];
}

export const buildConnectorFeatures = ({
  blueprint,
  studded,
  topY,
  bottomY,
  bodyPrimitives,
}: ConnectorFeatureInput): ConnectorFeatures => {
  const {
    widthStuds,
    lengthStuds,
    studOffsetsLdu,
    clutchOffsetsLdu,
    partialOverhangClutchEvidence,
    bodyWedge,
    bodyBoxesLdu,
    bodyArc,
  } = blueprint;
  const connectors: ConnectorPortDefinition[] = [];
  const primitives: CollisionPrimitive[] = [...bodyPrimitives];

  /** A footprint cell whose centre lies inside the wedge half-plane. */
  const cellIsSolid = (x: number, z: number): boolean =>
    bodyWedge === undefined ||
    bodyWedge.cutNormalXZ[0] * x + bodyWedge.cutNormalXZ[1] * z <= bodyWedge.cutOffsetLdu;
  const footprintCorners = (x: number, z: number): readonly (readonly [number, number])[] => [
    [x - STUD_RADIUS_LDU, z - STUD_RADIUS_LDU],
    [x + STUD_RADIUS_LDU, z - STUD_RADIUS_LDU],
    [x + STUD_RADIUS_LDU, z + STUD_RADIUS_LDU],
    [x - STUD_RADIUS_LDU, z + STUD_RADIUS_LDU],
  ];
  const arcHoldsFootprint = (x: number, z: number): boolean => {
    if (bodyArc === undefined) return true;
    const minX = x - STUD_RADIUS_LDU;
    const maxX = x + STUD_RADIUS_LDU;
    const minZ = z - STUD_RADIUS_LDU;
    const maxZ = z + STUD_RADIUS_LDU;
    if (
      (bodyArc.capRectanglesLdu ?? []).some(
        (cap) =>
          minX >= cap.minXZLdu[0] &&
          maxX <= cap.maxXZLdu[0] &&
          minZ >= cap.minXZLdu[1] &&
          maxZ <= cap.maxXZLdu[1],
      )
    ) {
      return true;
    }

    const radians = Math.PI / 180;
    const start = bodyArc.startAngleDegrees * radians;
    const end = bodyArc.endAngleDegrees * radians;
    const startDirection: readonly [number, number] = [Math.cos(start), Math.sin(start)];
    const endDirection: readonly [number, number] = [Math.cos(end), Math.sin(end)];
    const relativeCorners = footprintCorners(x, z).map(
      ([cornerX, cornerZ]) =>
        [cornerX - bodyArc.centerXZLdu[0], cornerZ - bodyArc.centerXZLdu[1]] as const,
    );
    const insideSector = relativeCorners.every(
      ([cornerX, cornerZ]) =>
        startDirection[0] * cornerZ - startDirection[1] * cornerX >= -GEOMETRY_EPSILON &&
        cornerX * endDirection[1] - cornerZ * endDirection[0] >= -GEOMETRY_EPSILON,
    );
    const maxRadiusSquared = Math.max(
      ...relativeCorners.map(([cornerX, cornerZ]) => cornerX ** 2 + cornerZ ** 2),
    );
    const closestX =
      bodyArc.centerXZLdu[0] < minX
        ? minX - bodyArc.centerXZLdu[0]
        : bodyArc.centerXZLdu[0] > maxX
          ? bodyArc.centerXZLdu[0] - maxX
          : 0;
    const closestZ =
      bodyArc.centerXZLdu[1] < minZ
        ? minZ - bodyArc.centerXZLdu[1]
        : bodyArc.centerXZLdu[1] > maxZ
          ? bodyArc.centerXZLdu[1] - maxZ
          : 0;
    const minRadiusSquared = closestX ** 2 + closestZ ** 2;
    return (
      insideSector &&
      maxRadiusSquared <= bodyArc.outerRadiusLdu ** 2 + GEOMETRY_EPSILON &&
      minRadiusSquared + GEOMETRY_EPSILON >= bodyArc.innerRadiusLdu ** 2
    );
  };
  /** Whether a whole stud's worth of the named face is backed by solid. */
  const faceHoldsStud = (face: "top" | "bottom", x: number, z: number): boolean => {
    if (bodyArc !== undefined) return arcHoldsFootprint(x, z);
    if (bodyWedge !== undefined) {
      return footprintCorners(x, z).every(
        ([cornerX, cornerZ]) =>
          bodyWedge.cutNormalXZ[0] * cornerX + bodyWedge.cutNormalXZ[1] * cornerZ <=
          bodyWedge.cutOffsetLdu + GEOMETRY_EPSILON,
      );
    }
    if (bodyBoxesLdu === undefined) return true;
    const reaching = bodyBoxesLdu.filter((box) =>
      face === "top" ? box.min[1] <= topY : box.max[1] >= bottomY,
    );
    for (let ix = 0; ix <= STUD_FOOTPRINT_SAMPLES; ix += 1) {
      for (let iz = 0; iz <= STUD_FOOTPRINT_SAMPLES; iz += 1) {
        const sx = x - STUD_RADIUS_LDU + (2 * STUD_RADIUS_LDU * ix) / STUD_FOOTPRINT_SAMPLES;
        const sz = z - STUD_RADIUS_LDU + (2 * STUD_RADIUS_LDU * iz) / STUD_FOOTPRINT_SAMPLES;
        if (
          !reaching.some(
            (box) => sx >= box.min[0] && sx <= box.max[0] && sz >= box.min[2] && sz <= box.max[2],
          )
        ) {
          return false;
        }
      }
    }
    return true;
  };
  const partialOverhangBackingFraction = (x: number, z: number): number => {
    if (bodyArc === undefined) return 0;
    const relativeX = x - bodyArc.centerXZLdu[0];
    const relativeZ = z - bodyArc.centerXZLdu[1];
    const radians = Math.PI / 180;
    const start = bodyArc.startAngleDegrees * radians;
    const end = bodyArc.endAngleDegrees * radians;
    const startDirection: readonly [number, number] = [Math.cos(start), Math.sin(start)];
    const endDirection: readonly [number, number] = [Math.cos(end), Math.sin(end)];
    const diskStaysInsideSweep = footprintCorners(x, z).every(([cornerX, cornerZ]) => {
      const arcX = cornerX - bodyArc.centerXZLdu[0];
      const arcZ = cornerZ - bodyArc.centerXZLdu[1];
      return (
        startDirection[0] * arcZ - startDirection[1] * arcX >= -GEOMETRY_EPSILON &&
        arcX * endDirection[1] - arcZ * endDirection[0] >= -GEOMETRY_EPSILON
      );
    });
    const distance = Math.hypot(relativeX, relativeZ);
    if (
      !diskStaysInsideSweep ||
      distance - STUD_RADIUS_LDU < bodyArc.innerRadiusLdu - GEOMETRY_EPSILON ||
      distance > bodyArc.outerRadiusLdu + GEOMETRY_EPSILON ||
      distance + STUD_RADIUS_LDU <= bodyArc.outerRadiusLdu + GEOMETRY_EPSILON
    ) {
      return 0;
    }
    return (
      circleIntersectionArea(STUD_RADIUS_LDU, bodyArc.outerRadiusLdu, distance) /
      (Math.PI * STUD_RADIUS_LDU ** 2)
    );
  };
  const partialOverhangOverrides = new Map<
    string,
    NonNullable<PartBlueprint["partialOverhangClutchEvidence"]>["overrides"][number]
  >();
  if (partialOverhangClutchEvidence !== undefined && clutchOffsetsLdu !== undefined) {
    const clutchKeys = new Set(clutchOffsetsLdu.map(offsetKey));
    if (clutchKeys.size !== clutchOffsetsLdu.length) {
      throw new Error(
        `${blueprint.ldrawId} partial-overhang evidence requires unique explicit clutch offsets`,
      );
    }
    for (const override of partialOverhangClutchEvidence.overrides) {
      const key = offsetKey(override.positionLdu);
      if (partialOverhangOverrides.has(key)) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang evidence repeats clutch offset [${override.positionLdu.join(", ")}]`,
        );
      }
      if (!clutchKeys.has(key)) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang evidence names [${override.positionLdu.join(", ")}] but clutchOffsetsLdu does not`,
        );
      }
      if (
        !Number.isFinite(override.maximumOuterOverhangLdu) ||
        override.maximumOuterOverhangLdu <= 0
      ) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang maximum for [${override.positionLdu.join(", ")}] must be a positive finite LDU distance`,
        );
      }
      partialOverhangOverrides.set(key, override);
    }
  }

  const allowances: CollisionAllowance[] = [];
  const [connectorGridCenterX, connectorGridCenterZ] = blueprint.connectorGridCenterLdu ?? [0, 0];
  for (let xIndex = 0; xIndex < widthStuds; xIndex += 1) {
    for (let zIndex = 0; zIndex < lengthStuds; zIndex += 1) {
      const x = connectorGridCenterX + (xIndex - (widthStuds - 1) / 2) * STUD_PITCH_LDU;
      const z = connectorGridCenterZ + (zIndex - (lengthStuds - 1) / 2) * STUD_PITCH_LDU;

      if (!cellIsSolid(x, z)) continue;
      if (blueprint.withoutClutches) continue;

      if (studded && studOffsetsLdu === undefined && faceHoldsStud("top", x, z)) {
        connectors.push(
          makePort(`stud:${xIndex}:${zIndex}`, "stud", [x, topY, z], [0, -1, 0], "connector-up"),
        );
        primitives.push({
          id: `stud:${xIndex}:${zIndex}`,
          kind: "cylinder",
          tag: "stud",
          axis: "y",
          centerLdu: [x, topY - STUD_HEIGHT_LDU / 2, z],
          radiusLdu: STUD_RADIUS_LDU,
          heightLdu: STUD_HEIGHT_LDU,
        });
      }
      if (clutchOffsetsLdu !== undefined) continue;
      if (!faceHoldsStud("bottom", x, z)) continue;
      connectors.push(
        makePort(
          `undersideClutch:${xIndex}:${zIndex}`,
          "undersideClutch",
          [x, bottomY, z],
          [0, 1, 0],
          "connector-down",
        ),
      );
      allowances.push({
        id: `tubeSeat:${xIndex}:${zIndex}`,
        portId: `undersideClutch:${xIndex}:${zIndex}`,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, bottomY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        maxInsertionDepthLdu: STUD_HEIGHT_LDU,
        requiresValidatedConnection: true,
      });
    }
  }

  for (const extra of blueprint.extraConnectors ?? []) {
    connectors.push(
      makePort(extra.id, extra.kind, extra.positionLdu, extra.normal, extra.orientationId),
    );
  }

  if (studded && studOffsetsLdu !== undefined) {
    studOffsetsLdu.forEach(([x, z], index) => {
      if (!faceHoldsStud("top", x, z)) {
        throw new Error(`${blueprint.ldrawId} stud ${index} at [${x}, ${z}] has no body backing`);
      }
      connectors.push(makePort(`stud:${index}`, "stud", [x, topY, z], [0, -1, 0], "connector-up"));
      primitives.push({
        id: `stud:${index}`,
        kind: "cylinder",
        tag: "stud",
        axis: "y",
        centerLdu: [x, topY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        heightLdu: STUD_HEIGHT_LDU,
      });
    });
  }

  if (clutchOffsetsLdu !== undefined) {
    if (blueprint.withoutClutches) {
      throw new Error(`${blueprint.ldrawId} cannot declare clutches and suppress its underside`);
    }
    clutchOffsetsLdu.forEach(([x, z], index) => {
      const hasFullBacking = faceHoldsStud("bottom", x, z);
      const partialOverride = partialOverhangOverrides.get(offsetKey([x, z]));
      if (!hasFullBacking && partialOverride === undefined) {
        throw new Error(
          `${blueprint.ldrawId} underside clutch ${index} at [${x}, ${z}] lacks full body backing and has no source-verified partial-overhang evidence`,
        );
      }
      if (hasFullBacking && partialOverride !== undefined) {
        throw new Error(
          `${blueprint.ldrawId} partial-overhang evidence for clutch ${index} at [${x}, ${z}] is unused because the full footprint is already backed`,
        );
      }
      if (partialOverride !== undefined) {
        const backingFraction = partialOverhangBackingFraction(x, z);
        const distance = Math.hypot(x - bodyArc!.centerXZLdu[0], z - bodyArc!.centerXZLdu[1]);
        const outerOverhangLdu = distance + STUD_RADIUS_LDU - bodyArc!.outerRadiusLdu;
        if (
          backingFraction < MIN_PARTIAL_OVERHANG_BACKING_FRACTION ||
          outerOverhangLdu > partialOverride.maximumOuterOverhangLdu + GEOMETRY_EPSILON
        ) {
          throw new Error(
            `${blueprint.ldrawId} source-verified clutch ${index} at [${x}, ${z}] has backing fraction ${backingFraction.toFixed(6)} and outer overhang ${outerOverhangLdu.toFixed(6)} LDU; it requires at least ${MIN_PARTIAL_OVERHANG_BACKING_FRACTION} backing and at most ${partialOverride.maximumOuterOverhangLdu} LDU overhang`,
          );
        }
      }
      const portId = `undersideClutch:${index}`;
      connectors.push(
        makePort(portId, "undersideClutch", [x, bottomY, z], [0, 1, 0], "connector-down"),
      );
      allowances.push({
        id: `tubeSeat:${index}`,
        portId,
        portKind: "undersideClutch",
        incomingPrimitiveTag: "stud",
        centerLdu: [x, bottomY - STUD_HEIGHT_LDU / 2, z],
        radiusLdu: STUD_RADIUS_LDU,
        maxInsertionDepthLdu: STUD_HEIGHT_LDU,
        requiresValidatedConnection: true,
      });
    });
  }

  return { connectors, primitives, allowances };
};
