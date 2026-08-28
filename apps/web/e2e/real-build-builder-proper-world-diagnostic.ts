import { createHash } from "node:crypto";

import { PROPER_ORIENTATIONS, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import { consumeBuilder2453DiagnosticRegistryRoute } from "../../../scripts/part-identification-2453-builder-registry-route.mjs";

import {
  applyBuilderCanonicalCalibrationForProperWorldDiagnostic,
  composeBuilderProperTransforms,
  resolveBuilderBoneProperTransform,
  type BuilderCanonicalCalibration,
} from "./real-build-builder-calibration";
import {
  parseOfficialModelIndex,
  type LedgerTransform,
  type OfficialModelIndex,
} from "./real-build-official";

export const BUILDER_PROPER_WORLD_DIAGNOSTIC_SCHEMA =
  "lego.builder-proper-world-diagnostic/1" as const;

export const BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT =
  "sha256:559d808d9fe3980f1f3be73718db2305b1e341cd4d40b5811e2e4d2c3d507d6a" as const;

interface PrefixRow {
  readonly stepNumber: number;
  readonly sourceBuilderIdentityOrdinal: number;
  readonly builderBrickRef: string;
  readonly designRevision: string;
}

export interface BuilderProperWorldDiagnosticRow extends PrefixRow {
  readonly catalogPartId: string;
  readonly diagnosticProperTransform: LedgerTransform;
  readonly canonicalTransform: LedgerTransform | null;
  readonly classification: "authorable-upright" | "diagnostic-proper-only";
}

export interface BuilderProperWorldDiagnostic {
  readonly schemaVersion: typeof BUILDER_PROPER_WORLD_DIAGNOSTIC_SCHEMA;
  readonly officialModelDigest: string;
  readonly calibrationDigest: string;
  readonly builderGeometryDigest: string;
  readonly calibrationSchemaVersion: string;
  readonly sourceRowsCommitment: typeof BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT;
  readonly properOrientationRosterDigest: `sha256:${string}`;
  readonly documentOrientationPolicy: "unchanged-four-upright";
  readonly counts: {
    readonly requestedRows: number;
    readonly localFrameRows: number;
    readonly authorableUprightRows: number;
    readonly diagnosticProperOnlyRows: number;
    readonly missingLocalFrameRows: number;
  };
  readonly diagnosticOnlyOrientationCounts: Readonly<Record<string, number>>;
  readonly originOffsetLdu: readonly [number, number, number];
  readonly rows: readonly BuilderProperWorldDiagnosticRow[];
  readonly authority: {
    readonly sourceExecution: false;
    readonly physicalFrame: false;
    readonly assignment: false;
    readonly canonicalTransform: false;
    readonly documentTransform: false;
    readonly placement: false;
    readonly replay: false;
    readonly mutation: false;
    readonly completion: false;
  };
}

const digest = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const properOrientationRosterDigest = (): `sha256:${string}` =>
  digest(
    JSON.stringify(
      PROPER_ORIENTATIONS.map(({ id, matrix }) => ({
        id,
        matrix,
      })),
    ),
  );

function determinant(matrix: readonly number[]): number {
  return (
    matrix[0]! * (matrix[4]! * matrix[8]! - matrix[5]! * matrix[7]!) -
    matrix[1]! * (matrix[3]! * matrix[8]! - matrix[5]! * matrix[6]!) +
    matrix[2]! * (matrix[3]! * matrix[7]! - matrix[4]! * matrix[6]!)
  );
}

function assertProperOrientation(orientationId: string): void {
  const orientation = PROPER_ORIENTATIONS.find(({ id }) => id === orientationId);
  if (
    orientation === undefined ||
    determinant(orientation.matrix) !== 1 ||
    orientation.matrix.some((value) => value !== -1 && value !== 0 && value !== 1) ||
    [0, 1, 2].some(
      (axis) =>
        orientation.matrix.slice(axis * 3, axis * 3 + 3).filter((value) => value !== 0).length !==
          1 ||
        [
          orientation.matrix[axis],
          orientation.matrix[axis + 3],
          orientation.matrix[axis + 6],
        ].filter((value) => value !== 0).length !== 1,
    )
  ) {
    throw new TypeError(
      `Diagnostic orientation ${JSON.stringify(orientationId)} is not an exact determinant-positive ` +
        `signed-permutation rotation; reflections and arbitrary rotations are forbidden.`,
    );
  }
}

function addOffset(
  transform: LedgerTransform,
  offset: readonly [number, number, number],
): LedgerTransform {
  const positionLdu = transform.positionLdu.map(
    (coordinate, axis) => coordinate + offset[axis]!,
  ) as unknown as LedgerTransform["positionLdu"];
  if (!positionLdu.every(Number.isSafeInteger)) {
    throw new TypeError(
      `Diagnostic proper transform position [${positionLdu.join(",")}] is not an exact safe-integer ` +
        `LDraw-unit coordinate.`,
    );
  }
  assertProperOrientation(transform.orientationId);
  return { positionLdu, orientationId: transform.orientationId };
}

const sameTransform = (left: LedgerTransform, right: LedgerTransform): boolean =>
  left.orientationId === right.orientationId &&
  left.positionLdu.every((coordinate, axis) => coordinate === right.positionLdu[axis]);

/**
 * Derives exact proper world transforms without widening the canonical document policy.
 *
 * All output is diagnostic and explicitly authority-absent. A non-upright row keeps
 * `canonicalTransform: null`; rendering may consume the separate diagnostic transform, while
 * catalog legality, compiler validation, placement, and manual-editor authoring remain upright-only.
 */
export async function createBuilderProperWorldDiagnostic(input: {
  readonly rows: readonly PrefixRow[];
  readonly official: OfficialModelIndex;
  readonly calibrated: OfficialModelIndex;
  readonly calibration: BuilderCanonicalCalibration;
  readonly officialXmlBytes: Uint8Array;
  readonly calibrationBytes: Uint8Array;
  readonly builderGeometryBundleBytes: Uint8Array;
  readonly builder2453IdentityToken: unknown;
}): Promise<BuilderProperWorldDiagnostic> {
  const {
    rows,
    official: suppliedOfficial,
    calibrated: suppliedCalibrated,
    calibration: suppliedCalibration,
    officialXmlBytes,
    calibrationBytes,
    builderGeometryBundleBytes,
    builder2453IdentityToken,
  } = input;
  const diagnostic2453RouteAccess =
    await consumeBuilder2453DiagnosticRegistryRoute(builder2453IdentityToken);
  const official = parseOfficialModelIndex(officialXmlBytes);
  const calibrationDigest = digest(calibrationBytes);
  const builderGeometryBundleDigest = digest(builderGeometryBundleBytes);
  const calibrated = applyBuilderCanonicalCalibrationForProperWorldDiagnostic(
    official,
    calibrationBytes,
    calibrationDigest,
    builderGeometryBundleBytes,
    builderGeometryBundleDigest,
    diagnostic2453RouteAccess,
  );
  const calibration = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(calibrationBytes),
  ) as BuilderCanonicalCalibration;
  if (
    suppliedOfficial.digest !== official.digest ||
    suppliedCalibrated.digest !== calibrated.digest ||
    suppliedCalibrated.calibrationDigest !== calibrated.calibrationDigest ||
    suppliedCalibrated.builderGeometryDigest !== calibrated.builderGeometryDigest ||
    JSON.stringify(suppliedCalibration) !== JSON.stringify(calibration) ||
    calibration.officialModelDigest !== official.digest ||
    calibrationDigest !== calibrated.calibrationDigest ||
    builderGeometryBundleDigest !== calibrated.builderGeometryDigest ||
    builderGeometryBundleDigest !== calibration.geometryBundle.digest
  ) {
    throw new TypeError(
      "Builder proper-world diagnostic requires caller payloads content-bound to independently " +
        "reparsed official XML bytes and independently reapplied calibration/geometry bytes.",
    );
  }
  const frameByRevision = new Map(
    calibration.designFrames.map((frame) => [frame.designRevision, frame]),
  );
  if (frameByRevision.size !== calibration.designFrames.length) {
    throw new TypeError("Builder calibration repeats a design revision.");
  }
  const anchorBrick = official.bricks[calibration.originPolicy.anchorBrickRef];
  const anchorFrame =
    anchorBrick === undefined ? undefined : frameByRevision.get(anchorBrick.designRevision);
  if (
    anchorBrick?.builderTransform === null ||
    anchorBrick?.builderTransform === undefined ||
    anchorFrame === undefined ||
    anchorBrick.builderTransform.sourceDigest !==
      calibration.originPolicy.anchorBuilderTransformationDigest
  ) {
    throw new TypeError(
      `Builder calibration origin anchor ${calibration.originPolicy.anchorBrickRef} does not ` +
        "exact-match its digest-bound official Brick, Bone transform, and design frame.",
    );
  }
  const resolvedAnchor = resolveBuilderBoneProperTransform(anchorBrick.builderTransform);
  const composedAnchor =
    resolvedAnchor.transform === null
      ? null
      : composeBuilderProperTransforms(
          resolvedAnchor.transform,
          anchorFrame.catalogToBuilderLocalTransform,
        );
  if (
    composedAnchor === null ||
    !sameTransform(composedAnchor, calibration.originPolicy.expectedComposedTransform)
  ) {
    throw new TypeError(
      `Builder calibration origin anchor ${calibration.originPolicy.anchorBrickRef} does not ` +
        "independently reproduce its digest-bound expected composed transform.",
    );
  }
  const originOffsetLdu =
    calibration.originPolicy.expectedEmptyEnumerationTransform.positionLdu.map(
      (coordinate, axis) =>
        coordinate - calibration.originPolicy.expectedComposedTransform.positionLdu[axis]!,
    ) as unknown as readonly [number, number, number];
  if (
    !originOffsetLdu.every(Number.isSafeInteger) ||
    calibration.originPolicy.expectedEmptyEnumerationTransform.orientationId !==
      calibration.originPolicy.expectedComposedTransform.orientationId
  ) {
    throw new TypeError(
      "Builder calibration origin policy does not define one exact safe-integer translation.",
    );
  }
  const orderedRows = [...rows].sort(
    (left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal,
  );
  const sourceRowsCommitment = digest(
    JSON.stringify(
      orderedRows.map(
        ({ stepNumber, sourceBuilderIdentityOrdinal, builderBrickRef, designRevision }) => ({
          stepNumber,
          sourceBuilderIdentityOrdinal,
          builderBrickRef,
          designRevision,
        }),
      ),
    ),
  );
  if (
    orderedRows.length !== 320 ||
    sourceRowsCommitment !== BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT
  ) {
    throw new TypeError(
      "Builder proper-world diagnostic requires the exact current 320-row action/source roster " +
        `commitment ${BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT}; received ${orderedRows.length} ` +
        `rows with ${sourceRowsCommitment}.`,
    );
  }
  const ordinals = new Set<number>();
  const brickRefs = new Set<string>();
  const local = orderedRows.flatMap((row) => {
    if (
      !Number.isSafeInteger(row.stepNumber) ||
      row.stepNumber < 1 ||
      row.stepNumber > 50 ||
      !Number.isSafeInteger(row.sourceBuilderIdentityOrdinal) ||
      row.sourceBuilderIdentityOrdinal < 1 ||
      row.sourceBuilderIdentityOrdinal > 320 ||
      ordinals.has(row.sourceBuilderIdentityOrdinal) ||
      brickRefs.has(row.builderBrickRef)
    ) {
      throw new TypeError(
        `Builder prefix row ${JSON.stringify(row)} has an out-of-range or repeated identity.`,
      );
    }
    ordinals.add(row.sourceBuilderIdentityOrdinal);
    brickRefs.add(row.builderBrickRef);
    const sourceBrick = official.bricks[row.builderBrickRef];
    const calibratedBrick = calibrated.bricks[row.builderBrickRef];
    const suppliedSourceBrick = suppliedOfficial.bricks[row.builderBrickRef];
    const suppliedCalibratedBrick = suppliedCalibrated.bricks[row.builderBrickRef];
    if (
      sourceBrick === undefined ||
      calibratedBrick === undefined ||
      sourceBrick.designRevision !== row.designRevision ||
      calibratedBrick.designRevision !== row.designRevision
    ) {
      throw new TypeError(
        `Builder prefix row ${row.sourceBuilderIdentityOrdinal}/${row.builderBrickRef} does not exact-match ` +
          `one official Brick and design revision ${row.designRevision}.`,
      );
    }
    if (
      JSON.stringify(suppliedSourceBrick) !== JSON.stringify(sourceBrick) ||
      JSON.stringify(suppliedCalibratedBrick) !== JSON.stringify(calibratedBrick)
    ) {
      throw new TypeError(
        `Builder prefix row ${row.sourceBuilderIdentityOrdinal}/${row.builderBrickRef} caller payload ` +
          "disagrees with independently reparsed official XML or independently derived digest-bound " +
          "calibration output.",
      );
    }
    const frame = frameByRevision.get(row.designRevision);
    if (frame === undefined) return [];
    if (sourceBrick.builderTransform === null) {
      throw new TypeError(
        `Locally framed Builder Brick ${row.builderBrickRef}/${row.designRevision} has no rigid Bone transform.`,
      );
    }
    const world = resolveBuilderBoneProperTransform(sourceBrick.builderTransform);
    const composed =
      world.transform === null
        ? null
        : composeBuilderProperTransforms(world.transform, frame.catalogToBuilderLocalTransform);
    if (composed === null) {
      throw new TypeError(
        `Locally framed Builder Brick ${row.builderBrickRef}/${row.designRevision} has no exact proper ` +
          `world transform: ${world.failure ?? "proper registry is not closed"}.`,
      );
    }
    assertProperOrientation(composed.orientationId);
    return [{ row, frame, calibratedBrick, composed }];
  });

  const outputRows = local.map(({ row, frame, calibratedBrick, composed }) => {
    const diagnosticProperTransform = addOffset(composed, originOffsetLdu);
    const canonicalTransform = calibratedBrick.canonicalTransform;
    const authorable = canonicalTransform !== null;
    if (authorable) {
      if (
        calibratedBrick.calibratedCatalogPartId !== frame.catalogPartId ||
        !UPRIGHT_ORIENTATIONS.some(({ id }) => id === diagnosticProperTransform.orientationId) ||
        !sameTransform(canonicalTransform, diagnosticProperTransform)
      ) {
        throw new TypeError(
          `Builder Brick ${row.builderBrickRef} canonical transform disagrees with the independently ` +
            `derived digest-bound calibration output.`,
        );
      }
    } else if (
      UPRIGHT_ORIENTATIONS.some(({ id }) => id === diagnosticProperTransform.orientationId) ||
      !calibratedBrick.canonicalTransformFailure?.includes(
        "cannot be expressed by the current canonical upright",
      ) ||
      calibratedBrick.calibratedCatalogPartId !== null
    ) {
      throw new TypeError(
        `Builder Brick ${row.builderBrickRef} may be diagnostic-only only when the unchanged canonical ` +
          `upright boundary refused it before catalog assignment.`,
      );
    }
    return {
      stepNumber: row.stepNumber,
      sourceBuilderIdentityOrdinal: row.sourceBuilderIdentityOrdinal,
      builderBrickRef: row.builderBrickRef,
      designRevision: row.designRevision,
      catalogPartId: frame.catalogPartId,
      diagnosticProperTransform,
      canonicalTransform:
        canonicalTransform === null
          ? null
          : {
              positionLdu: [...canonicalTransform.positionLdu] as LedgerTransform["positionLdu"],
              orientationId: canonicalTransform.orientationId,
            },
      classification: authorable
        ? ("authorable-upright" as const)
        : ("diagnostic-proper-only" as const),
    };
  });
  const diagnosticOnly = outputRows.filter(
    ({ classification }) => classification === "diagnostic-proper-only",
  );
  const diagnosticOnlyOrientationCounts = Object.fromEntries(
    [
      ...new Set(
        diagnosticOnly.map(
          ({ diagnosticProperTransform }) => diagnosticProperTransform.orientationId,
        ),
      ),
    ]
      .sort()
      .map((orientationId) => [
        orientationId,
        diagnosticOnly.filter(
          ({ diagnosticProperTransform }) =>
            diagnosticProperTransform.orientationId === orientationId,
        ).length,
      ]),
  );
  return {
    schemaVersion: BUILDER_PROPER_WORLD_DIAGNOSTIC_SCHEMA,
    officialModelDigest: official.digest,
    calibrationDigest: calibrated.calibrationDigest,
    builderGeometryDigest: calibrated.builderGeometryDigest,
    calibrationSchemaVersion: calibration.schemaVersion,
    sourceRowsCommitment,
    properOrientationRosterDigest: properOrientationRosterDigest(),
    documentOrientationPolicy: "unchanged-four-upright",
    counts: {
      requestedRows: orderedRows.length,
      localFrameRows: outputRows.length,
      authorableUprightRows: outputRows.length - diagnosticOnly.length,
      diagnosticProperOnlyRows: diagnosticOnly.length,
      missingLocalFrameRows: orderedRows.length - outputRows.length,
    },
    diagnosticOnlyOrientationCounts,
    originOffsetLdu,
    rows: outputRows,
    authority: {
      sourceExecution: false,
      physicalFrame: false,
      assignment: false,
      canonicalTransform: false,
      documentTransform: false,
      placement: false,
      replay: false,
      mutation: false,
      completion: false,
    },
  };
}
