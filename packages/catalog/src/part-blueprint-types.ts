import type {
  BodyArcFeature,
  ConnectorKind,
  ConnectorOrientationId,
  LduBounds,
  LduVector3,
  PartialOverhangClutchEvidence,
  PartFamily,
  SourceProvenance,
} from "./types.ts";

import type { ExactLduBoundsDeclaration } from "./exact-ldu.ts";

export interface PartBlueprint {
  readonly family: PartFamily;
  readonly widthStuds: number;
  readonly lengthStuds: number;
  /** LDraw part identifiers may carry a variant letter, so this is not numeric. */
  readonly ldrawId: `${string}.dat`;
  /** Maps raw LDraw-local coordinates into this catalog frame, with per-file provenance. */
  readonly ldrawFrame?: {
    readonly ldrawToCatalogOrientationId: string;
    readonly provenance: SourceProvenance;
  };
  readonly geometrySha256: string;
  /**
   * Stud centres in LDU from the part's centre. Omit for a stud on every cell,
   * which is what a plate or brick has.
   */
  readonly studOffsetsLdu?: readonly (readonly [x: number, z: number])[];
  /** Explicit underside clutch centres for an irregular footprint. */
  readonly clutchOffsetsLdu?: readonly (readonly [x: number, z: number])[];
  /** Integrity-bound exceptions for explicit seats that overhang a curved edge. */
  readonly partialOverhangClutchEvidence?: PartialOverhangClutchEvidence;
  /** Source-lattice centre when raw part coordinates are intentionally asymmetric. */
  readonly connectorGridCenterLdu?: readonly [x: number, z: number];
  /**
   * Slopes one vertical face away, turning the body from a box into a right
   * prism. Measured from the part's own LDraw file rather than guessed.
   */
  readonly bodyWedge?: {
    readonly cutNormalXZ: readonly [x: number, z: number];
    readonly cutOffsetLdu: number;
  };
  /**
   * Distinguishes parts that share a family and a footprint but not a shape —
   * a wedge plate comes in a left and a right that are not interchangeable.
   */
  readonly variant?: string;
  /**
   * Connectors the stud grid cannot express: a hole through a part, a shaft.
   * Positions are LDU from the part's centre, measured from its LDraw file.
   */
  readonly extraConnectors?: readonly {
    readonly id: string;
    readonly kind: ConnectorKind;
    readonly positionLdu: LduVector3;
    readonly normal: LduVector3;
    readonly orientationId: ConnectorOrientationId;
  }[];
  /**
   * Body extents in LDU, for a part the stud footprint does not describe. An
   * axle is 39 LDU long and 12 across; no width-by-length-by-family-height says
   * that.
   */
  readonly bodyBoundsLdu?: { readonly min: LduVector3; readonly max: LduVector3 };
  /**
   * The same declaration for a part whose measured extents are not float64:
   * canonical decimal text per axis, exactly as the audited LDraw closure
   * prints it. Mutually exclusive with `bodyBoundsLdu` — one part states its
   * body extents once.
   */
  readonly exactBodyBoundsLdu?: ExactLduBoundsDeclaration;
  /**
   * The solid as a union of boxes, for a part that is not one prism. See
   * `profileBoxes` for the staircase a slope or an arch becomes, and
   * `ParametricGeometryRecipe.bodyBoxesLdu` for why a staircase is the safe
   * approximation. Boxes must not overlap: mass and centre of mass sum them.
   */
  readonly bodyBoxesLdu?: readonly LduBounds[];
  /** Analytic circular plan source; collision is derived conservatively from it. */
  readonly bodyArc?: BodyArcFeature;
  /**
   * A height the family does not fix. A curved slope comes in a brick-height
   * form and a two-plate form, and both belong in one palette group, so the
   * family cannot own the number.
   */
  readonly heightLdu?: number;
  /** Suppresses the underside clutch grid, for a part that has no underside. */
  readonly withoutClutches?: boolean;
}
