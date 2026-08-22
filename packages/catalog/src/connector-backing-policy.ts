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
  ConnectorOrientationId,
  ConnectorPortDefinition,
  LduBounds,
  LduVector3,
  PartTubeFeature,
} from "./types.ts";

import { GEOMETRY_EPSILON } from "./arc-plan.ts";
import type { PartBlueprint } from "./part-blueprint-types.ts";
import { TUBE_OUTER_RADIUS_LDU } from "./part-shell.ts";

/**
 * What LDraw's integer tube primitive leaves between itself and the stud it
 * grips: 10 * sqrt(2) - 8 - 6 LDU.
 *
 * Computed rather than typed, from the half-pitch a tube sits on, the outer
 * radius `stud4.dat` line 24 gives it, and the stud radius `stud4.dat` line 23
 * shares with `stud.dat`. A real tube is 6.51 mm across and interferes with the
 * stud; the primitive is exactly 16 LDU across and clears it. This is the size
 * of that rounding and nothing else, and it applies only to a tube.
 */
const TUBE_LATTICE_CLEARANCE_LDU =
  (STUD_PITCH_LDU / 2) * Math.SQRT2 - TUBE_OUTER_RADIUS_LDU - STUD_RADIUS_LDU;

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

export const validatePinnedClutchOffsets = (
  ldrawId: string,
  clutchOffsetsLdu: readonly (readonly [number, number])[],
  partialOverhangClutchEvidence: NonNullable<PartBlueprint["partialOverhangClutchEvidence"]>,
): void => {
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
        `${ldrawId} partial-overhang evidence ${field} must be a lowercase ${algorithm} digest`,
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
      `${ldrawId} partial-overhang evidence must name both exact source identities and revisions`,
    );
  }
  const normalizedClutchOffsetsSha256 = normalizedOffsetSetSha256(clutchOffsetsLdu);
  if (
    normalizedClutchOffsetsSha256 !== partialOverhangClutchEvidence.normalizedClutchOffsetsSha256
  ) {
    throw new Error(
      `${ldrawId} explicit clutch offsets digest ${normalizedClutchOffsetsSha256} does not match source-extracted normalized digest ${partialOverhangClutchEvidence.normalizedClutchOffsetsSha256}`,
    );
  }
  const offsets = new Set(clutchOffsetsLdu.map(offsetKey));
  for (const [index, override] of partialOverhangClutchEvidence.overrides.entries()) {
    if (
      !override.positionLdu.every(Number.isFinite) ||
      !Number.isFinite(override.maximumOuterOverhangLdu) ||
      override.maximumOuterOverhangLdu <= 0
    ) {
      throw new Error(`${ldrawId} partial-overhang override ${index} has invalid geometry`);
    }
    if (!offsets.has(offsetKey(override.positionLdu))) {
      throw new Error(
        `${ldrawId} partial-overhang override ${index} names [${override.positionLdu.join(", ")}], which is not one of the ${clutchOffsetsLdu.length} pinned clutch offsets`,
      );
    }
  }
};

export const validatePartialOverhangClutchEvidence = (blueprint: PartBlueprint): void => {
  const { bodyArc, clutchOffsetsLdu, partialOverhangClutchEvidence } = blueprint;
  if (partialOverhangClutchEvidence === undefined) return;
  if (bodyArc === undefined || clutchOffsetsLdu === undefined) {
    throw new Error(
      `${blueprint.ldrawId} partial-overhang clutch evidence requires an analytic bodyArc and explicit clutchOffsetsLdu`,
    );
  }
  validatePinnedClutchOffsets(blueprint.ldrawId, clutchOffsetsLdu, partialOverhangClutchEvidence);
};

/** A port reads every implied field from the one connector-kind table. */
const makePort = (
  id: string,
  kind: ConnectorKind,
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
  const {
    widthStuds,
    lengthStuds,
    studOffsetsLdu,
    clutchOffsetsLdu,
    partialOverhangClutchEvidence,
    bodyWedge,
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
  /**
   * Whether a whole stud's worth of the named face is backed by solid.
   *
   * This is the STUD question and only the stud question: a stud is material
   * standing proud of the body, so it needs body behind it to stand on. Asking
   * it of the underside answers the opposite question by accident — see
   * `cavityHoldsStud` below.
   */
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
  /**
   * The cylinder an incoming stud sweeps as it enters this part's bottom face —
   * exactly the volume the `tubeSeat` allowance below already reserves for it.
   */
  const insertionCeilingY = bottomY - STUD_HEIGHT_LDU;
  /** Whether a box stands anywhere in the band the incoming stud passes through. */
  const spansInsertionBand = (box: LduBounds): boolean =>
    box.min[1] < bottomY - GEOMETRY_EPSILON && box.max[1] > insertionCeilingY + GEOMETRY_EPSILON;
  /**
   * Whether a box stands wholly above the fully inserted stud, so the stud stops
   * inside the part instead of passing through it.
   *
   * This asks about the whole solid above the band and not only about what
   * touches it, which is the difference between a plate and a brick. A plate's
   * ceiling is exactly the roof of its 4 LDU cavity, so either reading admits
   * it. A brick's cavity is 20 LDU deep and its ceiling sits 16 LDU clear of the
   * stud's 4 — nothing touches the band at all, and the stud still cannot pass
   * through the brick. The earlier form required a box to reach down to the
   * insertion ceiling and so was silently a plate-only rule.
   */
  const roofsInsertionBand = (box: LduBounds): boolean =>
    box.max[1] <= insertionCeilingY + GEOMETRY_EPSILON && box.max[1] > box.min[1];
  /** Distance from a clutch centre to the nearest point of a box's footprint, 0 inside it. */
  const footprintDistance = (box: LduBounds, x: number, z: number): number =>
    Math.hypot(
      Math.max(box.min[0] - x, 0, x - box.max[0]),
      Math.max(box.min[2] - z, 0, z - box.max[2]),
    );

  type CavityVerdict = { readonly held: true } | { readonly held: false; readonly reason: string };
  const CAVITY_HELD: CavityVerdict = { held: true };

  /**
   * What a CLUTCH is, as opposed to what a stud is.
   *
   * A clutch is not material, it is a hole. The incoming stud has to get in,
   * something has to grip it once it is in, and it has to stop somewhere. Solid
   * behind a clutch is not what holds it — solid behind a clutch is precisely
   * what makes it impossible, which is why `faceHoldsStud("bottom", …)` is the
   * wrong question to put to an underside and was silently answering it anyway.
   *
   * A modelled cavity holds a stud when all three are true:
   *
   *  - **clearance** — nothing in the body crosses the cylinder the stud sweeps;
   *  - **grip** — some wall or tube standing in that band reaches the stud's own
   *    circle;
   *  - **seat** — the cavity is closed above the stud, so it stops inside the
   *    part rather than passing through.
   *
   * A WALL's grip range is zero, not a chosen tolerance. LDraw's 3020 puts the
   * plate cavity's inner face at 16 LDU from centre (`box5` half-extent 16 on
   * line 21) with clutch centres on the 10 LDU half-pitch and a stud radius of
   * exactly 6: 16 - 10 = 6 is the stud radius to the LDU. A clutch is an
   * interference fit and the wall touches the stud, so anything looser there
   * would be a number nobody measured.
   *
   * A TUBE's is not zero, and the difference is measured rather than chosen.
   * A tube stands at the centre of a 2 x 2 block of cells, so its axis is one
   * lattice diagonal — 10 * sqrt(2) = 14.142136 LDU — from the clutch it grips,
   * against a stud radius of 6 and an outer tube radius of 8 (`stud4.dat` lines
   * 23-24). LDraw's integer primitives therefore leave 0.142136 LDU between the
   * two where the real part has an interference fit, because a real tube is
   * 6.51 mm across rather than exactly 16 LDU. `TUBE_LATTICE_CLEARANCE_LDU`
   * below is that residue, computed from the three measured numbers; refusing
   * every interior clutch on every plate wider than two studs would be refusing
   * a clutch that exists because a primitive was rounded.
   *
   * Only a union body can answer this at all — a filled prism, a wedge and an
   * arc model no cavity, so they have no underside to interrogate.
   */
  const cavityHoldsStud = (x: number, z: number): CavityVerdict => {
    if (bodyBoxesLdu === undefined) {
      return { held: false, reason: "the body is not a union of boxes, so it models no cavity" };
    }
    let gripping = 0;
    for (const box of bodyBoxesLdu) {
      if (!spansInsertionBand(box)) continue;
      const distance = footprintDistance(box, x, z);
      if (distance < STUD_RADIUS_LDU - GEOMETRY_EPSILON) {
        return {
          held: false,
          reason:
            `body box [${box.min.join(", ")}]..[${box.max.join(", ")}] stands ${distance.toFixed(6)} LDU ` +
            `from the centre, inside the ${STUD_RADIUS_LDU} LDU stud it would have to admit`,
        };
      }
      if (distance <= STUD_RADIUS_LDU + GEOMETRY_EPSILON) gripping += 1;
    }
    for (const [tubeX, tubeZ] of bodyTubes?.centersXZLdu ?? []) {
      const surfaceDistance = Math.hypot(tubeX - x, tubeZ - z) - bodyTubes!.outerRadiusLdu;
      if (surfaceDistance < STUD_RADIUS_LDU - GEOMETRY_EPSILON) {
        return {
          held: false,
          reason:
            `underside tube at [${tubeX}, ${tubeZ}] stands ${surfaceDistance.toFixed(6)} LDU from ` +
            `the centre, inside the ${STUD_RADIUS_LDU} LDU stud it would have to admit`,
        };
      }
      if (surfaceDistance <= STUD_RADIUS_LDU + TUBE_LATTICE_CLEARANCE_LDU + GEOMETRY_EPSILON) {
        gripping += 1;
      }
    }
    if (gripping === 0) {
      return {
        held: false,
        reason:
          `no body box or tube between y ${insertionCeilingY} and y ${bottomY} reaches the stud's ` +
          `own ${STUD_RADIUS_LDU} LDU circle, so the cavity is open there and nothing would grip`,
      };
    }
    for (let ix = 0; ix <= STUD_FOOTPRINT_SAMPLES; ix += 1) {
      for (let iz = 0; iz <= STUD_FOOTPRINT_SAMPLES; iz += 1) {
        const sx = x - STUD_RADIUS_LDU + (2 * STUD_RADIUS_LDU * ix) / STUD_FOOTPRINT_SAMPLES;
        const sz = z - STUD_RADIUS_LDU + (2 * STUD_RADIUS_LDU * iz) / STUD_FOOTPRINT_SAMPLES;
        if (
          !bodyBoxesLdu.some(
            (box) =>
              roofsInsertionBand(box) &&
              sx >= box.min[0] &&
              sx <= box.max[0] &&
              sz >= box.min[2] &&
              sz <= box.max[2],
          )
        ) {
          return {
            held: false,
            reason:
              `nothing roofs the cavity at [${sx}, ${sz}], so a stud entering here would pass ` +
              `through the part rather than bottoming out on its ceiling`,
          };
        }
      }
    }
    return CAVITY_HELD;
  };

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

  return {
    connectors,
    primitives,
    allowances,
    undersideIsModelled: clutchesAdmitted > 0 && clutchesHeldByCavity === clutchesAdmitted,
  };
};
