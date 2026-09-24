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
  ConnectorOrientationId,
  ConnectorPortDefinition,
  LduBounds,
  LduVector3,
  PartTubeFeature,
} from "./types.ts";

import {
  alternateClutchSeatIssues,
  resolveAlternateClutchSeats,
} from "./alternate-clutch-seats.ts";
import { GEOMETRY_EPSILON } from "./arc-plan.ts";
import { connectorBackingGeometry } from "./connector-backing-geometry.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import { offsetKey, partialOverhangOverridesByOffset } from "./partial-overhang-clutch-evidence.ts";

export {
  validatePartialOverhangClutchEvidence,
  validatePinnedClutchOffsets,
} from "./partial-overhang-clutch-evidence.ts";

/** A source-verified edge grip must still back most of the incoming stud circle. */
const MIN_PARTIAL_OVERHANG_BACKING_FRACTION = 0.75;

/** A port reads every implied field from the one connector-kind table. */
const makePort = (
  id: string,
  kind: Exclude<ConnectorKind, "blindAxleHole">,
  positionLdu: LduVector3,
  normal: LduVector3,
  orientationId: ConnectorOrientationId,
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
  /** The boxes actually drawn — the derived shell where there is one. */
  bodyBoxesLdu?: readonly LduBounds[] | undefined;
  /** The drawn underside tubes, which grip an interior clutch no wall reaches. */
  bodyTubes?: PartTubeFeature | undefined;
}

interface ConnectorFeatures {
  connectors: ConnectorPortDefinition[];
  primitives: CollisionPrimitive[];
  allowances: CollisionAllowance[];
  /**
   * True only when this part has clutches and every one of them was admitted by
   * a modelled cavity rather than by solid backing. It is the geometry's own
   * answer, so `undersideMode` cannot claim a cavity the body does not draw. A
   * part whose clutches are mixed reports false: half a modelled underside is
   * still an underside a from-below comparison would measure wrongly.
   */
  undersideIsModelled: boolean;
}

export const buildConnectorFeatures = ({
  blueprint,
  studded,
  topY,
  bottomY,
  bodyPrimitives,
  bodyBoxesLdu = blueprint.bodyBoxesLdu,
  bodyTubes,
}: ConnectorFeatureInput): ConnectorFeatures => {
  const { widthStuds, lengthStuds, studOffsetsLdu, clutchOffsetsLdu, bodyArc } = blueprint;
  const connectors: ConnectorPortDefinition[] = [];
  const primitives: CollisionPrimitive[] = [...bodyPrimitives];

  const { cellIsSolid, faceHoldsStud, cavityHoldsStud, partialOverhangBackingFraction } =
    connectorBackingGeometry({ blueprint, topY, bottomY, bodyBoxesLdu, bodyTubes });

  let clutchesAdmitted = 0;
  let clutchesHeldByCavity = 0;
  /**
   * The underside admission both clutch paths use, and the tally that decides
   * whether this part may claim a drawn underside.
   *
   * A part whose body is one filled prism, a wedge or an arc models no cavity,
   * so the cavity question cannot be put to it and solid backing is the only
   * answer available. That is not an exemption: those parts are exactly the ones
   * `body-is-hollow-where-it-clutches` reports in `part-standard.ts`, and this
   * second branch dies with the last of them.
   */
  const undersideHoldsStud = (x: number, z: number): boolean => {
    const cavity = cavityHoldsStud(x, z);
    if (!cavity.held && !faceHoldsStud("bottom", x, z)) return false;
    clutchesAdmitted += 1;
    if (cavity.held) clutchesHeldByCavity += 1;
    return true;
  };

  const partialOverhangOverrides = partialOverhangOverridesByOffset(blueprint);

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
      if (!undersideHoldsStud(x, z)) continue;
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

  // A seat between two cells is admitted by the cavity alone: the solid-backing
  // fallback exists for legacy filled grids, not for a seat added to a shell.
  for (const seat of resolveAlternateClutchSeats(blueprint, connectors)) {
    const { id, xLdu: x, zLdu: z } = seat;
    const cavity = cavityHoldsStud(x, z);
    if (!cavity.held) {
      throw new Error(
        `${blueprint.ldrawId} alternate clutch seat ${id} at [${x}, ${z}] is not held by the modelled cavity: ${cavity.reason}. Model a cavity that admits and grips a stud there, or drop the seat.`,
      );
    }
    clutchesAdmitted += 1;
    clutchesHeldByCavity += 1;
    seat.peerIndices.forEach((peer, side) => {
      connectors[peer] = {
        ...connectors[peer]!,
        sharedCapacityGroupIds: [seat.sharedCapacityGroupIds[side]!],
      };
    });
    connectors.push({
      ...makePort(id, "undersideClutch", [x, bottomY, z], [0, 1, 0], "connector-down"),
      sharedCapacityGroupIds: seat.sharedCapacityGroupIds,
    });
    allowances.push({
      id: seat.allowanceId,
      portId: id,
      portKind: "undersideClutch",
      incomingPrimitiveTag: "stud",
      centerLdu: [x, bottomY - STUD_HEIGHT_LDU / 2, z],
      radiusLdu: STUD_RADIUS_LDU,
      maxInsertionDepthLdu: STUD_HEIGHT_LDU,
      requiresValidatedConnection: true,
    });
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
      const cavity = cavityHoldsStud(x, z);
      const hasFullBacking = cavity.held || faceHoldsStud("bottom", x, z);
      const partialOverride = partialOverhangOverrides.get(offsetKey([x, z]));
      if (!hasFullBacking && partialOverride === undefined) {
        const cavityReason = cavity.held ? "" : cavity.reason;
        throw new Error(
          `${blueprint.ldrawId} underside clutch ${index} at [${x}, ${z}] is held by nothing: its modelled cavity does not hold a stud there (${cavityReason}), the bottom face is not backed by solid there either, and no source-verified partial-overhang evidence names it. Give the body a cavity whose wall or tube reaches the stud's ${STUD_RADIUS_LDU} LDU circle without crossing it, or drop the clutch.`,
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
      clutchesAdmitted += 1;
      if (cavity.held) clutchesHeldByCavity += 1;
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

  // Mesh admission's rule, so a parametric part cannot carry an off-grid clutch
  // or a shared-capacity claim that a measured part would be refused.
  const seatIssues = alternateClutchSeatIssues(
    { id: blueprint.ldrawId, dimensions: blueprint, connectors },
    blueprint.connectorGridCenterLdu ?? [0, 0],
  );
  if (seatIssues.length > 0) {
    throw new Error(
      `${blueprint.ldrawId} fails the alternate clutch seat rule: ${seatIssues.map(({ path, message }) => `${path}: ${message}`).join(" ")}`,
    );
  }

  return {
    connectors,
    primitives,
    allowances,
    undersideIsModelled: clutchesAdmitted > 0 && clutchesHeldByCavity === clutchesAdmitted,
  };
};
