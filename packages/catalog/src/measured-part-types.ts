import type { PartFamily, PartialOverhangClutchEvidence } from "./types.ts";

import type { ExactLduBoundsDeclaration } from "./exact-ldu.ts";

/** The bundled root LDraw file, named so a reader can check the attribution. */
export interface MeasuredLdrawSource {
  readonly title: string;
  readonly author: string;
  readonly ldrawOrg: string;
  readonly licenseExpression: string;
  readonly rootSha256: `sha256:${string}`;
  /** Every file in the exact expanded closure, listed in ldraw-bundled-sources-6651557.ts. */
  readonly closureFileCount: number;
}

/** The LEGO Builder record and derived frame the connector set came from. */
export interface MeasuredBuilderSource {
  readonly revision: string;
  readonly recordSha256: `sha256:${string}`;
  /** SHA-256 over the canonical Builder-to-LDraw frame, binding design and matrix. */
  readonly frameSha256: `sha256:${string}`;
}

/**
 * The LDCad shadow library a connector set was composed from, pinned whole.
 *
 * A shadow file is metadata a third party wrote about a part it does not own,
 * inherited through the same type-1 matrix that places the geometry, so the
 * evidence is the walk rather than one file: the composition identifier says how
 * the walk was performed and `shadowFiles` names every file that contributed.
 * The library is CC BY-SA 4.0, which is why the commit and whole-tree manifest
 * digest are carried here rather than left in a report — attribution has to
 * travel with the derived data.
 */
export interface MeasuredLdcadShadowSource {
  readonly libraryId: string;
  readonly commit: string;
  /** SHA-256 over the sorted path/bytes/digest table of the whole checkout. */
  readonly manifestSha256: `sha256:${string}`;
  readonly compositionId: string;
  readonly shadowFiles: readonly string[];
}

/**
 * A part declared from measured source rather than from parameters.
 *
 * The four layers still come from one declaration, but each field states which
 * source measured it: the mesh and the collision decomposition are the expanded
 * LDraw surface, the bounds are the exact LDraw closure, and the female
 * connectors are an authored claim carried through a pinned frame — Builder's
 * `Custom2DField` where a record exists, the LDCad shadow library where it does
 * not. Nothing here is generated from a width and a length, so nothing here may
 * be inferred.
 *
 * `assetToCatalogFrame` is the explicit source-to-catalog frame a part whose
 * source frame is not centred must carry. It is a quarter turn about the
 * vertical axis and an integer LDU translation, applied exactly once, so the
 * raw source frame is preserved rather than silently recentred.
 */
export interface MeasuredPartBlueprint {
  /** The LDraw design number, which is this part's identity in every source. */
  readonly designId: string;
  readonly ldrawId: `${string}.dat`;
  readonly family: PartFamily;
  readonly widthStuds: number;
  readonly lengthStuds: number;
  readonly variant?: string;
  /** Nominal lattice height. The measured body may stand proud of it, never short. */
  readonly heightLdu: number;
  readonly meshAssetId: string;
  readonly assetToCatalogFrame: {
    readonly schemaVersion: "mesh-asset-to-catalog-frame/1";
    readonly orientationId: string;
    readonly translationLdu: readonly [x: number, y: number, z: number];
  };
  readonly connectorGridCenterLdu: readonly [x: number, z: number];
  /**
   * Body and visual extents as the exact decimal text the audited closure
   * prints. The float64 pair every consumer reads is derived from these rather
   * than authored beside them, so one part states its extents once and the two
   * cannot disagree.
   */
  readonly exactBodyBoundsLdu: ExactLduBoundsDeclaration;
  readonly exactBoundsLdu: ExactLduBoundsDeclaration;
  /**
   * One row per stud: the connector seat, then the measured radius and height of
   * the collision cylinder whose lower face is that seat. Connector and body
   * are the same feature, so they are declared once and expanded together.
   */
  readonly studsLdu: readonly (readonly [
    x: number,
    y: number,
    z: number,
    radiusLdu: number,
    heightLdu: number,
  ])[];
  /** Underside clutch seats from the declaration's one authored connector source. */
  readonly clutchesLdu: readonly (readonly [x: number, y: number, z: number])[];
  /**
   * The per-column height-field decomposition, flattened to
   * `[minX, minY, minZ, maxX, maxY, maxZ]` sextuples so a part with hundreds of
   * measured columns stays a table rather than hundreds of objects.
   */
  readonly bodyBoxesLdu: readonly number[];
  readonly ldrawSource: MeasuredLdrawSource;
  /**
   * Where the female connectors came from. Exactly one of these is present, and
   * the factory refuses a declaration carrying more or fewer: a clutch cell is
   * a physical claim, so the part has to name the authored source that made it.
   */
  readonly builderSource?: MeasuredBuilderSource;
  readonly builderConnectivitySource?: PartialOverhangClutchEvidence;
  readonly ldcadShadowSource?: MeasuredLdcadShadowSource;
}
