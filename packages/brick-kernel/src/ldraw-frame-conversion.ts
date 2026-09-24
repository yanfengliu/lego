import {
  PART_DEFINITIONS,
  PROPER_ORIENTATIONS,
  getPartDefinition,
  type LduVector3,
  type OrientationMatrix,
} from "@lego-studio/catalog";

export type LDrawInterchangeErrorCode =
  | "LIMIT_EXCEEDED"
  | "MALFORMED_INPUT"
  | "UNSUPPORTED_LINE"
  | "UNSUPPORTED_METADATA"
  | "UNSUPPORTED_REFERENCE"
  | "UNSUPPORTED_COLOR"
  | "UNSUPPORTED_MATRIX"
  | "CONNECTION_MISMATCH"
  | "UNSUPPORTED_DOCUMENT";

export class LDrawInterchangeError extends Error {
  readonly code: LDrawInterchangeErrorCode;
  readonly lineNumber: number | undefined;

  constructor(code: LDrawInterchangeErrorCode, message: string, lineNumber?: number) {
    super(lineNumber === undefined ? message : `Line ${lineNumber}: ${message}`);
    this.name = "LDrawInterchangeError";
    this.code = code;
    this.lineNumber = lineNumber;
  }
}

function fail(code: LDrawInterchangeErrorCode, message: string, lineNumber?: number): never {
  throw new LDrawInterchangeError(code, message, lineNumber);
}

const ldrawAliasByPartId = new Map(
  PART_DEFINITIONS.map((part) => {
    const alias = part.aliases.find(({ namespace }) => namespace === "ldraw");
    if (!alias) throw new Error(`Catalog part ${part.id} has no LDraw identifier alias`);
    return [part.id, alias.value] as const;
  }),
);

const partIdByLdrawAlias = new Map(
  [...ldrawAliasByPartId].map(([partId, alias]) => [alias, partId] as const),
);
const orientationByMatrix = new Map(
  PROPER_ORIENTATIONS.map((orientation) => [orientation.matrix.join(" "), orientation] as const),
);
const orientationById = new Map(
  PROPER_ORIENTATIONS.map((orientation) => [orientation.id, orientation] as const),
);

const multiplyOrientationMatrices = (
  left: OrientationMatrix,
  right: OrientationMatrix,
): OrientationMatrix => [
  left[0] * right[0] + left[1] * right[3] + left[2] * right[6],
  left[0] * right[1] + left[1] * right[4] + left[2] * right[7],
  left[0] * right[2] + left[1] * right[5] + left[2] * right[8],
  left[3] * right[0] + left[4] * right[3] + left[5] * right[6],
  left[3] * right[1] + left[4] * right[4] + left[5] * right[7],
  left[3] * right[2] + left[4] * right[5] + left[5] * right[8],
  left[6] * right[0] + left[7] * right[3] + left[8] * right[6],
  left[6] * right[1] + left[7] * right[4] + left[8] * right[7],
  left[6] * right[2] + left[7] * right[5] + left[8] * right[8],
];

const inverseOrientationMatrix = (matrix: OrientationMatrix): OrientationMatrix => [
  matrix[0],
  matrix[3],
  matrix[6],
  matrix[1],
  matrix[4],
  matrix[7],
  matrix[2],
  matrix[5],
  matrix[8],
];

export const ldrawAliasForCatalogPart = (catalogPartId: string): string | undefined =>
  ldrawAliasByPartId.get(catalogPartId);

export const catalogPartIdForLDrawAlias = (alias: string): string | undefined =>
  partIdByLdrawAlias.get(alias);

export function requireProperOrientation(orientationId: string) {
  const orientation = orientationById.get(orientationId);
  if (!orientation)
    fail("UNSUPPORTED_MATRIX", `Unknown proper catalog orientation ${orientationId}`);
  return orientation;
}

export function requireLDrawOrientationMatrix(matrixToken: string, lineNumber?: number) {
  const orientation = orientationByMatrix.get(matrixToken);
  if (!orientation) {
    fail("UNSUPPORTED_MATRIX", "Matrix is not a supported proper signed permutation", lineNumber);
  }
  return orientation.matrix;
}

/**
 * The LDraw subset formats this kernel reads. `/2` places every part through
 * its catalog LDraw frame; `/1` files were written when a parametric part's
 * frame was only a turn (none but the 2 x 14 plate's, a quarter turn) with a
 * zero offset, so they are read back through that frame and keep the catalog
 * positions they were written from.
 *
 * Bound: that holds for the frames of /29, which real /1 files written by
 * commit 982634d pin (`ldraw-subset-v1-fixtures.test.ts`). A /1 file written
 * before a part's mesh promotion (/12, /13) wrote that part through its old
 * parametric frame, but is read through today's mesh frame.
 */
export type LDrawSubsetFormat = "lego.ldraw-subset/1" | "lego.ldraw-subset/2";

/** The parametric turns `lego.ldraw-subset/1` wrote with; every other parametric part used none. */
const LEGACY_V1_PARAMETRIC_ORIENTATION_IDS: Readonly<Record<string, string>> = Object.freeze({
  "builtin:plate-2x14": "upright-yaw-90",
});

const sameVector = (left: readonly number[], right: readonly number[]) =>
  left.length === right.length && left.every((value, axis) => value === right[axis]);

/**
 * The frame between a part's LDraw file and its catalog part:
 * catalog = O * ldraw + translationLdu. A mesh part's is its asset frame; a
 * parametric part's is its measured `ldrawFrame`. Under the legacy `/1`
 * format a parametric part gets the turn-only frame that format was written
 * with.
 */
export function ldrawToCatalogFrame(
  catalogPartId: string,
  format: LDrawSubsetFormat = "lego.ldraw-subset/2",
): {
  readonly orientation: (typeof PROPER_ORIENTATIONS)[number];
  readonly translationLdu: LduVector3;
} {
  const definition = getPartDefinition(catalogPartId);
  const alias = ldrawAliasByPartId.get(catalogPartId);
  const meshFrame =
    definition?.geometry.generatorId === "builtin:preloaded-mesh-reference/1"
      ? definition.geometry.assetToCatalogFrame
      : null;
  if (
    definition?.geometry.generatorId === "builtin:preloaded-mesh-reference/1" &&
    definition.geometry.assetId !== `ldraw:official:${alias}`
  ) {
    fail(
      "UNSUPPORTED_DOCUMENT",
      `Catalog part ${catalogPartId} mesh asset ${definition.geometry.assetId} is not its exact LDraw alias ${alias}`,
    );
  }
  const declared = definition?.ldrawFrame;
  if (
    meshFrame !== null &&
    declared !== undefined &&
    (declared.ldrawToCatalogOrientationId !== meshFrame.orientationId ||
      !sameVector(declared.translationLdu, meshFrame.translationLdu))
  ) {
    fail(
      "UNSUPPORTED_DOCUMENT",
      `Catalog part ${catalogPartId} declares LDraw frame ${declared.ldrawToCatalogOrientationId} [${declared.translationLdu.join(", ")}] but its mesh asset frame is ${meshFrame.orientationId} [${meshFrame.translationLdu.join(", ")}]; the two must be one frame`,
    );
  }
  if (!definition) {
    fail("UNSUPPORTED_DOCUMENT", `Catalog part ${catalogPartId} is not in the builtin catalog`);
  }
  const frame =
    meshFrame !== null
      ? { orientationId: meshFrame.orientationId, translationLdu: meshFrame.translationLdu }
      : format === "lego.ldraw-subset/1"
        ? {
            orientationId: LEGACY_V1_PARAMETRIC_ORIENTATION_IDS[catalogPartId] ?? "upright-yaw-0",
            translationLdu: [0, 0, 0] as const,
          }
        : declared === undefined
          ? undefined
          : {
              orientationId: declared.ldrawToCatalogOrientationId,
              translationLdu: declared.translationLdu,
            };
  if (frame === undefined) {
    fail(
      "UNSUPPORTED_DOCUMENT",
      `Catalog part ${catalogPartId} declares no LDraw-to-catalog frame, so its LDraw position and turn cannot be converted; derive one with scripts/derive-ldraw-catalog-frames.mjs`,
    );
  }
  const orientation = orientationById.get(frame.orientationId);
  if (!orientation) {
    fail(
      "UNSUPPORTED_DOCUMENT",
      `Catalog part ${catalogPartId} names LDraw-to-catalog orientation ${frame.orientationId}, which is not a proper orientation`,
    );
  }
  const translationLdu = [...frame.translationLdu] as unknown as LduVector3;
  if (!translationLdu.every(Number.isSafeInteger)) {
    fail(
      "UNSUPPORTED_DOCUMENT",
      `Catalog part ${catalogPartId} has a non-integral LDraw-to-catalog frame translation`,
    );
  }
  return { orientation, translationLdu };
}

/** Exact catalog-instance orientation to the type-1 matrix written around its local LDraw frame. */
export function catalogOrientationToLDrawMatrix(
  catalogPartId: string,
  orientationId: string,
  format: LDrawSubsetFormat = "lego.ldraw-subset/2",
): OrientationMatrix {
  const orientation = requireProperOrientation(orientationId);
  const frameCorrection = ldrawToCatalogFrame(catalogPartId, format);
  return multiplyOrientationMatrices(orientation.matrix, frameCorrection.orientation.matrix);
}

/** Inverse of `catalogOrientationToLDrawMatrix`; catalog placement legality is checked elsewhere. */
export function ldrawMatrixToCatalogOrientationId(
  catalogPartId: string,
  matrix: OrientationMatrix,
  lineNumber?: number,
  format: LDrawSubsetFormat = "lego.ldraw-subset/2",
): string {
  const ldrawOrientation = orientationByMatrix.get(matrix.join(" "));
  if (!ldrawOrientation) {
    fail("UNSUPPORTED_MATRIX", "Matrix is not a supported proper signed permutation", lineNumber);
  }
  const frameCorrection = ldrawToCatalogFrame(catalogPartId, format);
  const catalogMatrix = multiplyOrientationMatrices(
    ldrawOrientation.matrix,
    inverseOrientationMatrix(frameCorrection.orientation.matrix),
  );
  const orientation = orientationByMatrix.get(catalogMatrix.join(" "));
  if (!orientation) {
    fail(
      "UNSUPPORTED_MATRIX",
      `LDraw matrix for ${catalogPartId} does not resolve to a supported proper catalog orientation after its local-frame correction`,
      lineNumber,
    );
  }
  return orientation.id;
}
