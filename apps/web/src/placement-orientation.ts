import {
  STUD_PITCH_LDU,
  UPRIGHT_ORIENTATIONS,
  type LduVector3,
  type PartDefinition,
} from "@lego-studio/catalog";
import {
  getProperOrientation,
  rotateLduVector,
  transformLduPoint,
} from "@lego-studio/brick-kernel";

import { LATERAL_SNAP_LDU, type LduBox } from "./placement-types";

export interface WorldFootprint {
  /** Legacy nominal upright span, or actual non-upright body span, along world X. */
  readonly studsX: number;
  /** Legacy nominal upright span, or actual non-upright body span, along world Z. */
  readonly studsZ: number;
  /** Legacy nominal upright height, or actual non-upright body height. */
  readonly heightLdu: number;
  /** Actual body maximum Y relative to the part origin. */
  readonly undersideOffsetLdu: number;
  /** Legal world-origin residue modulo one stud pitch on each lateral axis. */
  readonly originOffsetX: number;
  readonly originOffsetZ: number;
}

export class PlacementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PlacementError";
  }
}

/** Resolves palette state when the user selects or re-selects a catalog part. */
export function placementOrientationIdForCatalogSelection(
  definition: PartDefinition,
  current: { readonly catalogPartId: string; readonly orientationId: string },
): string {
  const first = definition.legalOrientationIds[0];
  if (first === undefined) {
    throw new PlacementError(`Cannot select ${definition.id}: it has no legal orientations`);
  }
  return current.catalogPartId === definition.id &&
    definition.legalOrientationIds.includes(current.orientationId)
    ? current.orientationId
    : first;
}

/** Resolves one orientation under the selected part's own placement policy. */
function legalProperOrientation(definition: PartDefinition, orientationId: string) {
  if (!definition.legalOrientationIds.includes(orientationId)) {
    throw new PlacementError(
      `Cannot place ${definition.id} at illegal orientation ${orientationId}; the catalog allows ${definition.legalOrientationIds.join(", ")}`,
    );
  }
  return getProperOrientation(orientationId);
}

function rotatedBodyBounds(definition: PartDefinition, orientationId: string): LduBox {
  const { matrix } = legalProperOrientation(definition, orientationId);
  const { min, max } = definition.bodyBoundsLdu;
  const corners: LduVector3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        corners.push(rotateLduVector(matrix, [x, y, z]));
      }
    }
  }
  return {
    min: [
      Math.min(...corners.map(([x]) => x)),
      Math.min(...corners.map(([, y]) => y)),
      Math.min(...corners.map(([, , z]) => z)),
    ],
    max: [
      Math.max(...corners.map(([x]) => x)),
      Math.max(...corners.map(([, y]) => y)),
      Math.max(...corners.map(([, , z]) => z)),
    ],
  };
}

function bodyLatticeAnchor(min: number, max: number): number {
  const center = Math.round((min + max) / 2);
  const cells = Math.max(1, Math.round((max - min) / STUD_PITCH_LDU));
  return center - ((cells - 1) * STUD_PITCH_LDU) / 2;
}

function declaredConnectorGridCenter(definition: PartDefinition): readonly [number, number] {
  const center =
    definition.connectorGridCenterLdu ??
    (definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1"
      ? undefined
      : (definition.geometry.connectorGridCenterLdu ?? [0, 0]));
  if (center === undefined) {
    throw new PlacementError(
      `Cannot snap mesh-backed catalog part ${definition.id}: connectorGridCenterLdu is missing from its geometry-independent PartDefinition truth. Declare the catalog-local connector-grid centre; assuming [0, 0] can put its authored connectors off the shared stud lattice.`,
    );
  }
  if (center.length !== 2 || !center.every(Number.isSafeInteger)) {
    throw new PlacementError(
      `Cannot snap catalog part ${definition.id}: connectorGridCenterLdu must contain exactly two safe-integer LDU coordinates so snapping yields a serializable canonical transform; received [${center.join(", ")}].`,
    );
  }
  return center;
}

/** Maps actual connector and body truth into one deterministic world footprint. */
export function worldFootprint(definition: PartDefinition, orientationId: string): WorldFootprint {
  const { matrix } = legalProperOrientation(definition, orientationId);
  const connectorGridCenter = declaredConnectorGridCenter(definition);
  const bounds = rotatedBodyBounds(definition, orientationId);
  const upright = UPRIGHT_ORIENTATIONS.find(({ id }) => id === orientationId);

  let anchorX: number;
  let anchorZ: number;
  let targetResidue = LATERAL_SNAP_LDU;
  if (upright !== undefined) {
    // The four upright residues are serialized editor behavior. Preserve them
    // exactly while support and body spans come from actual transformed bounds.
    const localFirst: LduVector3 = [
      connectorGridCenter[0] - ((definition.dimensions.widthStuds - 1) * STUD_PITCH_LDU) / 2,
      0,
      connectorGridCenter[1] - ((definition.dimensions.lengthStuds - 1) * STUD_PITCH_LDU) / 2,
    ];
    const rotated = transformLduPoint({ positionLdu: [0, 0, 0], orientationId }, localFirst);
    [anchorX, anchorZ] = [rotated[0], rotated[2]];
  } else {
    const connectors = [...definition.connectors]
      .sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
      .map((connector) => ({
        connector,
        position: rotateLduVector(matrix, connector.positionLdu),
      }));
    const studLattice = connectors.filter(({ connector }) =>
      ["stud", "undersideClutch"].includes(connector.kind),
    );
    const technical = studLattice.length === 0 ? connectors[0] : undefined;
    anchorX =
      (studLattice.length > 0
        ? Math.min(...studLattice.map(({ position }) => position[0]))
        : undefined) ??
      technical?.position[0] ??
      bodyLatticeAnchor(bounds.min[0], bounds.max[0]);
    anchorZ =
      (studLattice.length > 0
        ? Math.min(...studLattice.map(({ position }) => position[2]))
        : undefined) ??
      technical?.position[2] ??
      bodyLatticeAnchor(bounds.min[2], bounds.max[2]);
    // Technical connectors share the 20n lattice. Stud/tube connectors retain
    // the 20n+10 lattice, and connector-less parts fall back to body parity.
    if (technical) targetResidue = 0;
  }

  const originOffset = (anchorCoordinate: number): number => {
    const residue =
      (((targetResidue - anchorCoordinate) % STUD_PITCH_LDU) + STUD_PITCH_LDU) % STUD_PITCH_LDU;
    return Math.abs(residue - STUD_PITCH_LDU) < 1e-9 ? 0 : residue;
  };
  return {
    studsX:
      upright === undefined
        ? (bounds.max[0] - bounds.min[0]) / STUD_PITCH_LDU
        : upright.quarterTurns % 2 === 1
          ? definition.dimensions.lengthStuds
          : definition.dimensions.widthStuds,
    studsZ:
      upright === undefined
        ? (bounds.max[2] - bounds.min[2]) / STUD_PITCH_LDU
        : upright.quarterTurns % 2 === 1
          ? definition.dimensions.widthStuds
          : definition.dimensions.lengthStuds,
    heightLdu:
      upright === undefined ? bounds.max[1] - bounds.min[1] : definition.dimensions.heightLdu,
    undersideOffsetLdu: bounds.max[1],
    originOffsetX: originOffset(anchorX),
    originOffsetZ: originOffset(anchorZ),
  };
}

/** Cycles the complete part-scoped legal list in deterministic catalog order. */
export function nextLegalOrientationId(definition: PartDefinition, orientationId: string): string {
  legalProperOrientation(definition, orientationId);
  const currentIndex = definition.legalOrientationIds.indexOf(orientationId);
  const next =
    definition.legalOrientationIds[(currentIndex + 1) % definition.legalOrientationIds.length];
  if (next === undefined) {
    throw new PlacementError(`Cannot rotate ${definition.id}: its legal orientation list is empty`);
  }
  return next;
}
