export type LduVector3 = readonly [x: number, y: number, z: number];

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
export type PartFamily = "brick" | "plate" | "tile" | "jumper-plate" | "grille-tile";
export type ConnectorKind = "stud" | "undersideClutch";
export type ConnectorGeometryRole = "stud" | "tubeSeat";
export type CatalogAliasNamespace = "human" | "ldraw";

export interface SourceProvenance {
  readonly sourceId: string;
  readonly sourceType: "project-authored" | "interoperability-mapping";
  readonly sourceVersion: string;
  readonly licenseExpression: string;
  readonly attribution: string;
  readonly runtimeRole:
    | "catalog-truth"
    | "parametric-runtime-geometry"
    | "display-color"
    | "interchange-identifier-only";
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
  readonly profileId: "stud-tube/1";
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

export interface CollisionCylinder {
  readonly id: string;
  readonly kind: "cylinder";
  readonly tag: "stud";
  readonly axis: "y";
  readonly centerLdu: LduVector3;
  readonly radiusLdu: number;
  readonly heightLdu: number;
}

export type CollisionPrimitive = CollisionBox | CollisionCylinder;

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

export interface ParametricGeometryRecipe {
  readonly generatorId: "builtin:parametric-rectilinear-part/1";
  readonly digestInput: string;
  readonly contentHash: `sha256:${string}`;
  readonly bodyMode: "rectangular-prism";
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
  readonly undersideMode: "semantic-tube-seat-grid";
  readonly studRadiusLdu: number;
  readonly studHeightLdu: number;
  readonly provenance: SourceProvenance;
}

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
  readonly dimensions: PartDimensions;
  readonly bodyBoundsLdu: LduBounds;
  readonly boundsLdu: LduBounds;
  readonly geometry: ParametricGeometryRecipe;
  readonly connectors: readonly ConnectorPortDefinition[];
  readonly legalOrientationIds: readonly string[];
  readonly collision: PartCollisionDefinition;
  readonly availableColorIds: readonly string[];
  readonly substitutionGroupId: string;
  readonly inventory: InventoryMetadata;
  readonly provenance: SourceProvenance;
}

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
