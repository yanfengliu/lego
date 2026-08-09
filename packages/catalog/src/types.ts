export type LduVector3 = readonly [x: number, y: number, z: number];

/**
 * One LDU coordinate held exactly, as a signed integer count of 10^-9 LDU.
 *
 * Part geometry measured out of LDraw is not always a float64: composing
 * 93273's closure gives a bound of exactly -16.00016098, which no double holds.
 * The construction lattice is untouched by this — placements are integer LDU —
 * so exactness lives on the geometry side, where the fractions come from.
 *
 * The scale travels with the value rather than living only in a constant, so a
 * stored bound states what its own units mean and a later scale change cannot
 * be mistaken for the same number.
 */
export interface ExactLdu {
  readonly units: number;
  readonly scaleExponent: number;
}

export type ExactLduVector3 = readonly [x: ExactLdu, y: ExactLdu, z: ExactLdu];

export interface ExactLduBounds {
  readonly min: ExactLduVector3;
  readonly max: ExactLduVector3;
}

export type OrientationMatrix = readonly [
  m11: number,
  m12: number,
  m13: number,
  m21: number,
  m22: number,
  m23: number,
  m31: number,
  m32: number,
  m33: number,
];

/**
 * A jumper plate is plate-height with fewer studs than its footprint, and a
 * grille tile is tile-height with none; both are otherwise a rectangular prism,
 * so they differ from a plate or tile only in which studs they carry.
 */
export type PartFamily =
  | "brick"
  | "plate"
  | "tile"
  | "jumper-plate"
  | "grille-tile"
  | "wedge-plate"
  | "technic-brick"
  | "axle"
  | "wheel"
  | "arch"
  | "curved-slope"
  | "cheese-slope"
  | "corner-plate";
/**
 * The ways two parts can meet.
 *
 * Named after the feature rather than the shape, following LDCad, because a
 * shape does not say what may enter it: an axle and a pin are both round and
 * only one of them turns freely in a pin hole.
 */
export type ConnectorKind =
  | "stud"
  | "undersideClutch"
  | "axle"
  | "axleHole"
  | "pin"
  | "pinHole"
  | "bar"
  | "clip"
  | "hinge"
  | "hingeSocket";

export type ConnectorGeometryRole =
  | "stud"
  | "tubeSeat"
  | "axleShaft"
  | "axleBore"
  | "pinShaft"
  | "pinBore"
  | "barShaft"
  | "clipJaw"
  | "hingePin"
  | "hingeCup";

/** Which half of a pair a connector is. A pair needs one of each. */
export type ConnectorGender = "male" | "female";

/**
 * How two joined parts may turn relative to each other.
 *
 * A property of the pair, never of one connector: the same axle is rigid in an
 * axle hole, whose cross section it cannot slip round in, and free in a pin
 * hole, which is round. Asking a single connector how it articulates has no
 * answer.
 */
export type ConnectorRotation = "fixed" | "quarterTurns" | "continuous";

/** A joined pair is rigid unless the pair says it moves. */
export type ConnectorArticulation = "rigid" | "revolute";

/**
 * How the two connectors' axes have to line up.
 *
 * A stud enters a clutch from one side only, so the axes must oppose. A hole is
 * open at both ends and a shaft can pass in from either, so only the line
 * matters and not the direction — which is LDCad's `caps=none`.
 */
export type ConnectorAxisMatching = "opposed" | "collinear";
export type CatalogAliasNamespace = "human" | "ldraw";

export interface SourceProvenance {
  readonly sourceId: string;
  readonly sourceType:
    | "project-authored"
    | "interoperability-mapping"
    | "external-bundled-geometry"
    // Facts a third party authored about a part it does not own, admitted as
    // truth rather than bundled as files: the LDCad shadow library's clutch
    // cells are metadata, not geometry, so `externalGeometryBundled` stays false
    // while the licence and attribution are still the external source's.
    | "external-connector-metadata";
  readonly sourceVersion: string;
  readonly licenseExpression: string;
  readonly attribution: string;
  readonly runtimeRole:
    | "catalog-truth"
    | "parametric-runtime-geometry"
    | "render-mesh-asset"
    | "display-color"
    | "interchange-identifier-only"
    | "interchange-frame-measurement";
  readonly redistributionAllowed: boolean;
  readonly trainingUseAllowed: boolean;
  readonly externalGeometryBundled: boolean;
}

export interface CatalogAlias {
  readonly namespace: CatalogAliasNamespace;
  readonly value: string;
  readonly qualifiedValue: string;
  readonly provenance: SourceProvenance;
}

export interface PartDimensions {
  readonly widthStuds: number;
  readonly lengthStuds: number;
  readonly widthLdu: number;
  readonly lengthLdu: number;
  readonly heightLdu: number;
}

export interface LduBounds {
  readonly min: LduVector3;
  readonly max: LduVector3;
}

export interface UprightOrientation {
  readonly id: string;
  readonly quarterTurns: 0 | 1 | 2 | 3;
  readonly matrix: OrientationMatrix;
  readonly upAxis: readonly [0, -1, 0];
}

export interface ConnectorPortDefinition {
  readonly id: string;
  readonly kind: ConnectorKind;
  readonly geometryRole: ConnectorGeometryRole;
  readonly profileId: string;
  readonly gender: ConnectorGender;
  readonly positionLdu: LduVector3;
  readonly normal: LduVector3;
  readonly orientationId: "connector-up" | "connector-down";
  readonly capacity: 1;
  readonly compatibleKinds: readonly ConnectorKind[];
}

export interface CollisionBox {
  readonly id: string;
  readonly kind: "box";
  readonly tag: "body";
  readonly minLdu: LduVector3;
  readonly maxLdu: LduVector3;
}

/**
 * A right triangular prism: the box from min to max with one vertical face
 * sloped away, which is what a wedge plate, a slope and a cheese slope all are.
 *
 * The slope is given as a half-plane rather than a shape, because that is what
 * survives a quarter turn as a rotated normal and what makes the overlap test
 * exact. A union of axis-aligned boxes cannot express a diagonal at all, and
 * approximating one at stud resolution on a part two studs wide just
 * reproduces the bounding box.
 */
export interface CollisionWedge {
  readonly id: string;
  readonly kind: "wedge";
  readonly tag: "body";
  readonly minLdu: LduVector3;
  readonly maxLdu: LduVector3;
  /**
   * Outward normal of the sloped face in the horizontal plane. The solid is the
   * box where `cutNormalXZ[0] * x + cutNormalXZ[1] * z <= cutOffsetLdu`.
   */
  readonly cutNormalXZ: readonly [x: number, z: number];
  readonly cutOffsetLdu: number;
}

export interface CollisionCylinder {
  readonly id: string;
  readonly kind: "cylinder";
  /**
   * "stud" is a connector feature and may enter a matching clutch; "body" is
   * solid and may not. A wheel is a body cylinder — modelling it as a box would
   * stop it rolling.
   */
  readonly tag: "stud" | "body";
  /**
   * The axis the cylinder stands on. A stud is always vertical; a wheel lies on
   * its side. Declaring it wrong makes the bounding box wrong on two axes, and
   * short in one of them — which lets a real overlap go unreported.
   */
  readonly axis: "x" | "y" | "z";
  readonly centerLdu: LduVector3;
  readonly radiusLdu: number;
  readonly heightLdu: number;
}

/**
 * A vertical prism with a strictly convex, counter-clockwise plan polygon.
 *
 * Curved source features are conservatively decomposed into these for
 * collision and physics. The polygon is collision truth, not render geometry:
 * renderers use the source feature in `ParametricGeometryRecipe` so the
 * decomposition can never become a visible faceted approximation.
 */
export interface CollisionConvexPrism {
  readonly id: string;
  readonly kind: "convex-prism";
  readonly tag: "body";
  /** Three to eight finite, strictly convex vertices in counter-clockwise order. */
  readonly verticesXZLdu: readonly (readonly [x: number, z: number])[];
  readonly minYLdu: number;
  readonly maxYLdu: number;
}

export type CollisionPrimitive =
  CollisionBox | CollisionWedge | CollisionCylinder | CollisionConvexPrism;

export interface CollisionAllowance {
  readonly id: string;
  readonly portId: string;
  readonly portKind: "undersideClutch";
  readonly incomingPrimitiveTag: "stud";
  readonly centerLdu: LduVector3;
  readonly radiusLdu: number;
  readonly maxInsertionDepthLdu: number;
  readonly requiresValidatedConnection: true;
}

export interface PartCollisionDefinition {
  readonly modelVersion: string;
  readonly primitives: readonly CollisionPrimitive[];
  readonly allowances: readonly CollisionAllowance[];
}

/**
 * The underside tubes of one part: one profile, many axes.
 *
 * `stud4.dat` builds the tube from two coaxial cylinders and a ring between
 * them, so an annulus is what it is. Every tube on a part shares the profile
 * and differs only in where its axis stands, which is why the radii are stated
 * once rather than per tube.
 */
export interface PartTubeFeature {
  readonly innerRadiusLdu: number;
  readonly outerRadiusLdu: number;
  /** The cavity's depth: a tube spans it exactly, from the ceiling to the open face. */
  readonly heightLdu: number;
  readonly centersXZLdu: readonly (readonly [x: number, z: number])[];
}

export interface BodyArcCapRectangle {
  readonly minXZLdu: readonly [x: number, z: number];
  readonly maxXZLdu: readonly [x: number, z: number];
}

/**
 * One analytic circular-sector source feature in the part's horizontal plane.
 *
 * Angles increase counter-clockwise from +X. `innerRadiusLdu: 0` is a filled
 * sector; a positive inner radius is an annular sector. Cap rectangles are
 * explicit source material outside the sector and must have disjoint interiors.
 */
export interface BodyArcFeature {
  readonly centerXZLdu: readonly [x: number, z: number];
  readonly innerRadiusLdu: number;
  readonly outerRadiusLdu: number;
  readonly startAngleDegrees: number;
  readonly endAngleDegrees: number;
  readonly segmentCount: number;
  readonly capRectanglesLdu?: readonly BodyArcCapRectangle[];
}

/**
 * Integrity-bound evidence for explicit underside seats whose incoming stud
 * legitimately overhangs a curved body edge. These are never inferred: the
 * named source and extraction rule must enumerate every exceptional offset.
 */
export interface PartialOverhangClutchEvidence {
  readonly backingMode: "source-verified-partial-overhang";
  readonly sourceId: string;
  readonly sourceRevision: string;
  readonly manifestSha256: `sha256:${string}`;
  readonly manifestMd5: `md5:${string}`;
  readonly bundleSha256: `sha256:${string}`;
  readonly primitiveXmlSha256: `sha256:${string}`;
  readonly independentSourceId: string;
  readonly independentSourceRevision: string;
  readonly independentPartSha256: `sha256:${string}`;
  readonly independentSubpartSha256: `sha256:${string}`;
  readonly extractorId: "lego-builder-custom2dfield-type22-centres/1";
  /** SHA-256 of the lexicographically sorted JSON `[x,z][]` extracted from the source. */
  readonly normalizedClutchOffsetsSha256: `sha256:${string}`;
  readonly overrides: readonly {
    readonly positionLdu: readonly [x: number, z: number];
    readonly kind: "source-verified-partial-overhang";
    readonly maximumOuterOverhangLdu: number;
  }[];
}

export interface ParametricGeometryRecipe {
  readonly generatorId:
    "builtin:parametric-rectilinear-part/1" | "builtin:parametric-plan-feature-part/1";
  readonly digestInput: string;
  readonly contentHash: `sha256:${string}`;
  /**
   * "rectangular-prism" is one box over the whole footprint. "compound" is the
   * union of the body primitives in `collision`, which is what the renderer
   * draws — so a part's solid and its picture are the same statement.
   */
  readonly bodyMode: "rectangular-prism" | "compound" | "arc-prism";
  /**
   * "cylinder-grid" puts a stud at the centre of every cell of the footprint,
   * "cylinder-offsets" at the listed positions only, "none" at none.
   *
   * Offsets rather than cell indices, because a jumper plate's stud sits at the
   * centre of its footprint — half a pitch off the cells beneath it, which is
   * the whole point of the part — and no cell index can name that spot.
   */
  readonly studMode: "cylinder-grid" | "cylinder-offsets" | "none";
  /** Stud centres in LDU from the part's centre, for "cylinder-offsets" only. */
  readonly studOffsetsLdu?: readonly (readonly [x: number, z: number])[];
  /** Explicit underside clutch centres for an irregular footprint. */
  readonly clutchOffsetsLdu?: readonly (readonly [x: number, z: number])[];
  /** Source proof for explicit clutch circles that intentionally cross a body edge. */
  readonly partialOverhangClutchEvidence?: PartialOverhangClutchEvidence;
  /**
   * Centre of the source part's stud lattice when it is not the body-bounds
   * centre. This preserves a raw LDraw frame without inventing a recentering
   * transform at import/export boundaries.
   */
  readonly connectorGridCenterLdu?: readonly [x: number, z: number];
  /**
   * Body extents declared outright, for a part whose solid the stud footprint
   * does not describe. Present only when the part declares them.
   */
  readonly bodyBoundsLdu?: LduBounds;
  /**
   * The same extents held exactly, for a part whose measured coordinates fall
   * on a fraction float64 cannot carry. Present only when the part declares
   * them, so a part that never needed exact bounds hashes as it always did.
   */
  readonly exactBodyBoundsLdu?: ExactLduBounds;
  /**
   * The solid as a union of boxes, for a part that is not one prism: an arch is
   * two legs and a span with the void between them left uncovered, a corner
   * plate is an L, and a slope is a staircase because the collision model's
   * prisms are cut by vertical planes only and cannot fall away in elevation.
   *
   * Where the boxes approximate a curve they are each as tall as the highest
   * point of the measured profile over their own span, so the modelled solid
   * contains the real one — the approximation refuses placements a real part
   * would allow rather than admitting ones it would not.
   */
  readonly bodyBoxesLdu?: readonly LduBounds[];
  /**
   * The wall and ceiling the boxes above were cut to, present only on a part
   * whose body models its own cavity. It is a record of the rule, not an input:
   * the boxes are derived from it and from the part's footprint, and binding it
   * into the digest means a change to the rule re-hashes every part it reached.
   */
  readonly shellCavity?: {
    readonly wallThicknessLdu: number;
    readonly ceilingThicknessLdu: number;
  };
  /**
   * The underside tubes, as the annulus LDraw draws. The visible tube is this
   * feature; its collision primitive is the largest axis-aligned box inside the
   * same circle, whose corners meet that circle exactly in the four diagonal
   * directions the surrounding studs occupy. `part-factory.ts` states why a
   * cylinder cannot be used and what the box gives up.
   */
  readonly bodyTubes?: PartTubeFeature;
  /** Smooth plan source; collision prisms are a conservative derived artifact. */
  readonly bodyArc?: BodyArcFeature;
  /** Connectors the stud grid cannot express, such as a hole through a part. */
  readonly extraConnectors?: readonly {
    readonly id: string;
    readonly kind: ConnectorKind;
    readonly positionLdu: LduVector3;
    readonly normal: LduVector3;
    readonly orientationId: "connector-up" | "connector-down";
  }[];
  /**
   * `modelled-shell-cavity` means the underside is real geometry: the body union
   * above leaves a cavity whose walls hold every one of this part's clutches, so
   * a render from below draws it and can be compared against a printed underside
   * panel. The two `semantic-` modes mean the opposite — the tube seats exist for
   * the clutch solver and nothing draws them.
   *
   * The value is derived from the body union by the same predicate that admits
   * the clutches, never declared, so it cannot claim a cavity the part does not
   * have.
   */
  readonly undersideMode:
    "semantic-tube-seat-grid" | "semantic-tube-seat-offsets" | "modelled-shell-cavity" | "none";
  readonly studRadiusLdu: number;
  readonly studHeightLdu: number;
  readonly provenance: SourceProvenance;
}

/**
 * A rendering-only reference into the closed set of mesh data preloaded by the
 * application. The reference is deliberately not a path or URL: resolving it
 * must never read a filesystem or cross a network boundary.
 *
 * Mesh vertices use their immutable source asset-local LDU frame. The recipe's
 * explicit asset-to-catalog frame applies orientation and translation exactly
 * once. `PartDefinition.ldrawFrame` is independent interchange truth and is
 * never consulted by the mesh resolver. Collision, connectors, bounds, and
 * every other catalog-truth field remain independently authored.
 */
export interface MeshReferenceGeometryRecipe {
  readonly generatorId: "builtin:preloaded-mesh-reference/1";
  readonly assetId: string;
  readonly contentHash: `sha256:${string}`;
  /**
   * Integrity-bound normalization from the immutable asset-local coordinates
   * into catalog-local LDU. This is part of the catalog digest and is separate
   * from `PartDefinition.ldrawFrame`, which remains interchange-only truth.
   */
  readonly assetToCatalogFrame: {
    readonly schemaVersion: "mesh-asset-to-catalog-frame/1";
    readonly orientationId: string;
    readonly translationLdu: LduVector3;
  };
  readonly provenance: SourceProvenance;
}

export type PartGeometryRecipe = ParametricGeometryRecipe | MeshReferenceGeometryRecipe;

export interface InventoryMetadata {
  readonly availability: "builtin-unlimited";
  readonly knownMassGrams: null;
  readonly physicalAvailabilityClaimed: false;
}

export interface PartDefinition {
  readonly id: string;
  readonly family: PartFamily;
  readonly displayName: string;
  readonly aliases: readonly CatalogAlias[];
  /** Measured raw-LDraw-to-catalog frame correction and its file-level source. */
  readonly ldrawFrame?: {
    readonly ldrawToCatalogOrientationId: string;
    readonly provenance: SourceProvenance;
  };
  readonly dimensions: PartDimensions;
  /**
   * Catalog-local centre of the connector lattice when the part's authored
   * origin is off-centre. Geometry-independent truth for snapping; legacy
   * parametric parts may continue to carry it inside their recipe.
   */
  readonly connectorGridCenterLdu?: readonly [x: number, z: number];
  readonly bodyBoundsLdu: LduBounds;
  readonly boundsLdu: LduBounds;
  /**
   * The two bounds above, held exactly, for a part whose measured source needs
   * more precision than float64 carries. Both are present together or neither
   * is; the float64 pair stays the field every renderer, validator and
   * placement path reads, and never shrinks the exact solid.
   */
  readonly exactBodyBoundsLdu?: ExactLduBounds;
  readonly exactBoundsLdu?: ExactLduBounds;
  readonly geometry: PartGeometryRecipe;
  readonly connectors: readonly ConnectorPortDefinition[];
  readonly legalOrientationIds: readonly string[];
  readonly collision: PartCollisionDefinition;
  readonly availableColorIds: readonly string[];
  readonly substitutionGroupId: string;
  readonly inventory: InventoryMetadata;
  readonly provenance: SourceProvenance;
}

/** The existing feature-derived catalog declarations, narrowed for their factory. */
export type ParametricPartDefinition = Omit<PartDefinition, "geometry"> & {
  readonly geometry: ParametricGeometryRecipe;
};

export interface ColorDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly displayHex: `#${string}`;
  readonly ldrawCode: number;
  readonly provenance: SourceProvenance;
  readonly ldrawCodeProvenance: SourceProvenance;
}

export interface CatalogSnapshotDigestInput {
  readonly schemaVersion: "catalog-digest-input/1";
  readonly catalogVersion: string;
  readonly connectorTaxonomyVersion: string;
  readonly collisionModelVersion: string;
  readonly transformPolicyVersion: string;
  readonly coordinateSystem: {
    readonly upAxis: "-Y";
    readonly unit: "LDU";
    readonly studPitchLdu: number;
  };
  readonly provenanceLayers: readonly SourceProvenance[];
  readonly orientations: readonly UprightOrientation[];
  readonly colors: readonly ColorDefinition[];
  readonly parts: readonly PartDefinition[];
}
