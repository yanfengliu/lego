import { STUD_PITCH_LDU } from "./constants.ts";
import type { ConnectorPortDefinition } from "./types.ts";

import type { PartBlueprint } from "./part-blueprint-types.ts";

/**
 * An alternate clutch seat: an underside seat half a pitch off the primary
 * stud grid, between two grid clutches whose stud envelopes it overlaps.
 *
 * 99563 and 3245c (measured) and 15573 (parametric) grip a stud under their
 * middle as well as one under each cell, because no understud post stands in
 * the middle of their underside. A stud in the middle leaves no room for one
 * under either cell, so the seat and its two peers share capacity: the seat
 * claims two cells, each peer claims one of them, and a connection consumes
 * every cell its endpoints name (`ConnectorPortDefinition.sharedCapacityGroupIds`).
 *
 * `alternateClutchSeatIssues` is the one rule that admits such a seat, for mesh
 * admission and the parametric factory alike. `resolveAlternateClutchSeats` is
 * how a parametric blueprint's declared seat finds its peers and names its cells.
 */

type Connector = ConnectorPortDefinition;

export interface AlternateClutchSeatIssue {
  readonly path: string;
  readonly message: string;
}

function placementResidue(firstConnectorCoordinate: number): number {
  return (
    (((STUD_PITCH_LDU / 2 - firstConnectorCoordinate) % STUD_PITCH_LDU) + STUD_PITCH_LDU) %
    STUD_PITCH_LDU
  );
}

function onStudLattice(coordinate: number): boolean {
  return (
    (((coordinate - STUD_PITCH_LDU / 2) % STUD_PITCH_LDU) + STUD_PITCH_LDU) % STUD_PITCH_LDU === 0
  );
}

function declaredSharedCapacityGroups(connector: Connector): readonly string[] {
  return connector.sharedCapacityGroupIds ?? [];
}

/**
 * Every underside clutch off the primary grid must be an alternate seat exactly
 * half a pitch between one unambiguous pair of primary-grid peers, with two
 * shared capacity groups that correspond one to one to those peers, and every
 * group must bind exactly one such seat to exactly one peer.
 *
 * The caller has already checked that the dimensions, the grid centre and each
 * connector's representation are valid; this rule reads them as given.
 */
export function alternateClutchSeatIssues(
  part: {
    readonly id: string;
    readonly dimensions: { readonly widthStuds: number; readonly lengthStuds: number };
    readonly connectors: readonly Connector[];
  },
  gridCenter: readonly [number, number],
): readonly AlternateClutchSeatIssue[] {
  const issues: AlternateClutchSeatIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push(Object.freeze({ path, message }));
  };
  const { dimensions } = part;
  const firstX = gridCenter[0] - ((dimensions.widthStuds - 1) * STUD_PITCH_LDU) / 2;
  const firstZ = gridCenter[1] - ((dimensions.lengthStuds - 1) * STUD_PITCH_LDU) / 2;
  const originOffsetX = placementResidue(firstX);
  const originOffsetZ = placementResidue(firstZ);
  // The plan grid holds seats facing along Y. A seat facing X or Z sits on a
  // side face, whose lattice the plan grid fixes along only its one plan
  // tangent: 41682's flange-recess seats face +Z at x = -10 and 10.
  const facesAlongY = (connector: Connector): boolean => connector.normal[1] !== 0;
  const undersideClutches = part.connectors.filter(
    (connector) => connector.kind === "undersideClutch" && facesAlongY(connector),
  );
  const isOnPrimaryGrid = (connector: Connector): boolean =>
    onStudLattice(connector.positionLdu[0] + originOffsetX) &&
    onStudLattice(connector.positionLdu[2] + originOffsetZ);
  const calibratedSharedGroups = new Set<string>();
  for (let index = 0; index < part.connectors.length; index += 1) {
    const connector = part.connectors[index]!;
    if (connector.kind !== "undersideClutch") continue;
    if (!facesAlongY(connector)) {
      const planTangent = connector.normal[2] !== 0 ? 0 : 2;
      const onLattice = onStudLattice(
        connector.positionLdu[planTangent] + (planTangent === 0 ? originOffsetX : originOffsetZ),
      );
      if (!onLattice || declaredSharedCapacityGroups(connector).length > 0) {
        add(
          `/connectors/${index}/positionLdu`,
          `Part ${part.id} clutch connector ${connector.id} faces [${connector.normal.join(", ")}] at ${"xyz"[planTangent]}=${connector.positionLdu[planTangent]}; a seat facing sideways must sit on the stud lattice along its plan tangent (${onLattice ? "it does" : "it does not"}) and may not claim shared capacity cells (${declaredSharedCapacityGroups(connector).length} declared), since the alternate-seat rule reads only the plan grid.`,
        );
      }
      continue;
    }
    if (!isOnPrimaryGrid(connector)) {
      const [seatX, seatY, seatZ] = connector.positionLdu;
      const groups = declaredSharedCapacityGroups(connector);
      const peerPairs: (readonly [Connector, Connector])[] = [];
      for (let leftIndex = 0; leftIndex < undersideClutches.length; leftIndex += 1) {
        const left = undersideClutches[leftIndex]!;
        if (!isOnPrimaryGrid(left) || left.positionLdu[1] !== seatY) continue;
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < undersideClutches.length;
          rightIndex += 1
        ) {
          const right = undersideClutches[rightIndex]!;
          if (!isOnPrimaryGrid(right) || right.positionLdu[1] !== seatY) continue;
          const oppositeHalfPitch =
            left.positionLdu[0] + right.positionLdu[0] === 2 * seatX &&
            left.positionLdu[2] + right.positionLdu[2] === 2 * seatZ &&
            ((Math.abs(left.positionLdu[0] - seatX) === STUD_PITCH_LDU / 2 &&
              left.positionLdu[2] === seatZ &&
              right.positionLdu[2] === seatZ) ||
              (Math.abs(left.positionLdu[2] - seatZ) === STUD_PITCH_LDU / 2 &&
                left.positionLdu[0] === seatX &&
                right.positionLdu[0] === seatX));
          const leftGroups = declaredSharedCapacityGroups(left);
          const rightGroups = declaredSharedCapacityGroups(right);
          if (
            oppositeHalfPitch &&
            groups.length === 2 &&
            leftGroups.length === 1 &&
            rightGroups.length === 1 &&
            leftGroups[0] !== rightGroups[0] &&
            new Set([...leftGroups, ...rightGroups]).size === groups.length &&
            groups.every((groupId) => leftGroups.includes(groupId) || rightGroups.includes(groupId))
          ) {
            peerPairs.push([left, right]);
          }
        }
      }
      if (peerPairs.length === 1) {
        for (const groupId of groups) calibratedSharedGroups.add(groupId);
        continue;
      }
      add(
        `/connectors/${index}/positionLdu`,
        `Part ${part.id} underside connector ${connector.id} at [${connector.positionLdu[0]}, ${connector.positionLdu[2]}] is incompatible with connectorGridCenterLdu [${gridCenter.join(", ")}], ${dimensions.widthStuds}x${dimensions.lengthStuds} footprint parity, and the placement lattice. An alternate seat is admitted only exactly half-pitch between one unambiguous pair of primary-grid peers, with two shared capacity groups that correspond one-to-one to those peers; found ${peerPairs.length} calibrated peer pairs.`,
      );
    }
  }
  const groupMembers = new Map<string, number>();
  for (const connector of undersideClutches) {
    for (const groupId of declaredSharedCapacityGroups(connector)) {
      groupMembers.set(groupId, (groupMembers.get(groupId) ?? 0) + 1);
    }
  }
  for (const [groupId, memberCount] of groupMembers) {
    if (memberCount === 2 && calibratedSharedGroups.has(groupId)) continue;
    add(
      "/connectors",
      `Part ${part.id} shared connector-capacity group ${JSON.stringify(groupId)} has ${memberCount} member(s) and calibratedAlternate=${calibratedSharedGroups.has(groupId)}; each admitted group must bind exactly one off-grid half-pitch seat to exactly one primary-grid peer.`,
    );
  }
  return issues;
}

/** A parametric blueprint's declared alternate seat, placed among its grid clutches. */
export interface ResolvedAlternateClutchSeat {
  readonly id: string;
  readonly allowanceId: string;
  readonly xLdu: number;
  readonly zLdu: number;
  /** Connector-list indices of the peer at the lower and at the higher coordinate. */
  readonly peerIndices: readonly [negative: number, positive: number];
  /** The cell each peer claims, in the same order; the seat claims both. */
  readonly sharedCapacityGroupIds: readonly [negative: string, positive: string];
}

const SEAT_PORT_PREFIX = "undersideClutch:";

/**
 * Finds each declared seat's two peers among the grid clutches the factory has
 * already built, and names the two capacity cells the seat shares with them.
 *
 * The cells are derived from the geometry rather than declared, in the
 * `<design>:<side>-<axis>-half` form 99563 and 3245c use, so a blueprint cannot
 * name a claim its grid does not support. The factory then puts its finished
 * connector list through `alternateClutchSeatIssues`, the rule mesh admission
 * applies.
 */
export function resolveAlternateClutchSeats(
  blueprint: PartBlueprint,
  connectors: readonly Connector[],
): readonly ResolvedAlternateClutchSeat[] {
  const seats = blueprint.alternateClutchSeats ?? [];
  if (seats.length === 0) return [];
  if (blueprint.clutchOffsetsLdu !== undefined || blueprint.withoutClutches === true) {
    throw new Error(
      `${blueprint.ldrawId} declares alternate clutch seats [${seats.map(({ id }) => id).join(", ")}] but ${blueprint.withoutClutches === true ? "suppresses its underside with withoutClutches" : "lists explicit clutchOffsetsLdu"}, so it has no clutch grid for them to share capacity with. Declare alternate seats only on a part whose underside clutches come from its stud grid.`,
    );
  }
  const stem = blueprint.ldrawId.replace(/\.dat$/u, "");
  const half = STUD_PITCH_LDU / 2;
  const clutchAt = (x: number, z: number): number =>
    connectors.findIndex(
      ({ kind, positionLdu }) =>
        kind === "undersideClutch" && positionLdu[0] === x && positionLdu[2] === z,
    );
  const usedIds = new Set(connectors.map(({ id }) => id));
  const usedGroups = new Set<string>();
  const peerOwners = new Map<number, string>();
  return seats.map((seat): ResolvedAlternateClutchSeat => {
    const [x, z] = seat.positionLdu;
    const name = seat.id.slice(SEAT_PORT_PREFIX.length);
    if (!seat.id.startsWith(SEAT_PORT_PREFIX) || name.length === 0 || usedIds.has(seat.id)) {
      throw new Error(
        `${blueprint.ldrawId} alternate clutch seat id ${JSON.stringify(seat.id)} is not ${JSON.stringify(SEAT_PORT_PREFIX)} followed by a name no other connector on the part uses. Saved connections name the port by this id, so give it a new, stable one.`,
      );
    }
    usedIds.add(seat.id);
    const pairs = (["x", "z"] as const).flatMap((axis) => {
      const negative = axis === "x" ? clutchAt(x - half, z) : clutchAt(x, z - half);
      const positive = axis === "x" ? clutchAt(x + half, z) : clutchAt(x, z + half);
      return negative >= 0 && positive >= 0 ? [{ axis, negative, positive }] : [];
    });
    const [pair] = pairs;
    if (pair === undefined || pairs.length > 1) {
      throw new Error(
        `${blueprint.ldrawId} alternate clutch seat ${seat.id} at [${x}, ${z}] needs one pair of grid clutches exactly ${half} LDU either side of it along x or z; found ${pairs.length} among the clutches at ${connectors
          .filter(({ kind }) => kind === "undersideClutch")
          .map(({ positionLdu }) => `[${positionLdu[0]}, ${positionLdu[2]}]`)
          .join(", ")}. Move the seat to the midpoint of two neighbouring cells, or drop it.`,
      );
    }
    const sharedCapacityGroupIds = [
      `${stem}:negative-${pair.axis}-half`,
      `${stem}:positive-${pair.axis}-half`,
    ] as const;
    for (const peer of [pair.negative, pair.positive]) {
      const owner = peerOwners.get(peer);
      if (owner !== undefined) {
        throw new Error(
          `${blueprint.ldrawId} alternate clutch seats ${owner} and ${seat.id} both need grid clutch ${connectors[peer]!.id} as a peer; a grid clutch shares capacity with one alternate seat only, so drop one of the seats.`,
        );
      }
      peerOwners.set(peer, seat.id);
    }
    for (const groupId of sharedCapacityGroupIds) {
      if (usedGroups.has(groupId)) {
        throw new Error(
          `${blueprint.ldrawId} alternate clutch seat ${seat.id} would reuse capacity cell ${groupId}, which another seat along ${pair.axis} already names; cell names are derived per axis, so a part declares at most one alternate seat along each axis.`,
        );
      }
      usedGroups.add(groupId);
    }
    return {
      id: seat.id,
      allowanceId: `tubeSeat:${name}`,
      xLdu: x,
      zLdu: z,
      peerIndices: [pair.negative, pair.positive],
      sharedCapacityGroupIds,
    };
  });
}
