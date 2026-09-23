import { Buffer } from "node:buffer";

import { PROPER_ORIENTATIONS, TRANSFORM_POLICY_VERSION } from "@lego-studio/catalog";

import { sha256Digest } from "./part-identification-artifact-source.mjs";

const CATALOG_ORIENTATION_ROSTER_DIGEST =
  "sha256:57446894cd2b917eb5463672655baa012d7c03539ba4147cd89e9c774a309201";
const TEST_MODE = typeof process !== "undefined" && process.env?.NODE_ENV === "test";

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

const stableDigest = (value) =>
  sha256Digest(Buffer.from(JSON.stringify(stableJson(value)), "utf8"));

const INDEPENDENT_TRANSFORM_ALGEBRA_CONTROLS = deepFreeze([
  {
    controlId: "identity-with-nonzero-translation",
    sourceMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    sourcePositionLdu: [13, 17, 19],
    sourceToCatalogMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    sourceToCatalogTranslationLdu: [5, 7, 11],
    expectedCatalogWorldMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    expectedCatalogPositionLdu: [8, 10, 8],
    expectedBasisImages: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  {
    controlId: "noncommuting-z-source-y-frame",
    sourceMatrix: [0, -1, 0, 1, 0, 0, 0, 0, 1],
    sourcePositionLdu: [17, -23, 31],
    sourceToCatalogMatrix: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    sourceToCatalogTranslationLdu: [5, 7, 11],
    expectedCatalogWorldMatrix: [0, -1, 0, 0, 0, -1, 1, 0, 0],
    expectedCatalogPositionLdu: [24, -12, 26],
    expectedBasisImages: [
      [0, 0, 1],
      [-1, 0, 0],
      [0, -1, 0],
    ],
  },
  {
    controlId: "noncommuting-x-source-z-frame",
    sourceMatrix: [1, 0, 0, 0, 0, -1, 0, 1, 0],
    sourcePositionLdu: [-9, 14, 27],
    sourceToCatalogMatrix: [0, -1, 0, 1, 0, 0, 0, 0, 1],
    sourceToCatalogTranslationLdu: [-3, 8, 5],
    expectedCatalogWorldMatrix: [0, 1, 0, 0, 0, -1, -1, 0, 0],
    expectedCatalogPositionLdu: [-17, 19, 24],
    expectedBasisImages: [
      [0, 0, -1],
      [1, 0, 0],
      [0, -1, 0],
    ],
  },
]);

const INDEPENDENT_TRANSFORM_ALGEBRA_CONTROL_COMMITMENT = stableDigest(
  INDEPENDENT_TRANSFORM_ALGEBRA_CONTROLS,
);

function determinant3(matrix) {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

function exactIndependentOrientationTruth(orientations = PROPER_ORIENTATIONS) {
  const roster = Array.isArray(orientations)
    ? orientations.map(({ id, matrix }) => ({ id, matrix: [...matrix] }))
    : [];
  const ids = new Set();
  const matrices = new Set();
  for (const row of roster) {
    const matrixKey = row.matrix.join(",");
    const signedPermutation = [0, 1, 2].every(
      (axis) =>
        row.matrix.slice(axis * 3, axis * 3 + 3).filter((entry) => entry !== 0).length === 1 &&
        [row.matrix[axis], row.matrix[axis + 3], row.matrix[axis + 6]].filter(
          (entry) => entry !== 0,
        ).length === 1,
    );
    if (
      typeof row.id !== "string" ||
      row.matrix.length !== 9 ||
      row.matrix.some((entry) => ![-1, 0, 1].includes(entry)) ||
      !signedPermutation ||
      determinant3(row.matrix) !== 1 ||
      ids.has(row.id) ||
      matrices.has(matrixKey)
    ) {
      throw new TypeError(
        "Step-42 independent catalog transform law requires 24 unique proper signed-permutation orientations.",
      );
    }
    ids.add(row.id);
    matrices.add(matrixKey);
  }
  const rosterDigest = stableDigest(roster);
  if (roster.length !== 24 || rosterDigest !== CATALOG_ORIENTATION_ROSTER_DIGEST) {
    throw new TypeError(
      `Step-42 independent catalog orientation truth drifted: rows=${roster.length}, digest=${rosterDigest}.`,
    );
  }
  return deepFreeze({
    schemaVersion: "lego.step42-independent-catalog-orientation-truth/1",
    transformPolicyVersion: TRANSFORM_POLICY_VERSION,
    rosterDigest,
    algebraControlCommitment: INDEPENDENT_TRANSFORM_ALGEBRA_CONTROL_COMMITMENT,
    compositionLaw:
      "catalog-world=source-world*transpose(source-to-catalog);position=source-position-catalog-world*frame-translation",
    roster,
  });
}

export const INDEPENDENT_CATALOG_ORIENTATION_TRUTH = exactIndependentOrientationTruth();

export function independentlyComposeCatalogWorldTransform(sourceWorld, frame, truth) {
  const orientationById = new Map(truth.roster.map((row) => [row.id, row]));
  const orientationByMatrix = new Map(truth.roster.map((row) => [row.matrix.join(","), row]));
  const source = orientationById.get(sourceWorld.orientationId);
  const sourceToCatalog = orientationById.get(frame.orientationId);
  if (source === undefined || sourceToCatalog === undefined) {
    throw new TypeError(
      "Step-42 independent transform law requires registered source and source-to-catalog orientations.",
    );
  }
  const catalogWorldMatrix = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) =>
        sum + source.matrix[row * 3 + offset] * sourceToCatalog.matrix[column * 3 + offset],
      0,
    );
  });
  const catalogWorld = orientationByMatrix.get(catalogWorldMatrix.join(","));
  if (catalogWorld === undefined) {
    throw new TypeError(
      "Step-42 independent transform law produced a matrix outside catalog orientation truth.",
    );
  }
  const translated = [0, 1, 2].map((row) =>
    [0, 1, 2].reduce(
      (sum, column) => sum + catalogWorldMatrix[row * 3 + column] * frame.translationLdu[column],
      0,
    ),
  );
  return {
    orientationId: catalogWorld.id,
    positionLdu: sourceWorld.positionLdu.map((coordinate, axis) => coordinate - translated[axis]),
  };
}

function applyLiteralMatrix(matrix, vector) {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ];
}

function assertIndependentTransformAlgebraControls(truth) {
  const orientationByMatrix = new Map(truth.roster.map((row) => [row.matrix.join(","), row]));
  for (const control of INDEPENDENT_TRANSFORM_ALGEBRA_CONTROLS) {
    const source = orientationByMatrix.get(control.sourceMatrix.join(","));
    const frame = orientationByMatrix.get(control.sourceToCatalogMatrix.join(","));
    const expected = orientationByMatrix.get(control.expectedCatalogWorldMatrix.join(","));
    if (source === undefined || frame === undefined || expected === undefined) {
      throw new TypeError(
        `Step-42 independent transform algebra control ${control.controlId} is absent from the exact orientation roster.`,
      );
    }
    const actual = independentlyComposeCatalogWorldTransform(
      { orientationId: source.id, positionLdu: control.sourcePositionLdu },
      {
        orientationId: frame.id,
        translationLdu: control.sourceToCatalogTranslationLdu,
      },
      truth,
    );
    const actualMatrix = orientationByMatrix.get(control.expectedCatalogWorldMatrix.join(","));
    const basisImages = [
      applyLiteralMatrix(control.expectedCatalogWorldMatrix, [1, 0, 0]),
      applyLiteralMatrix(control.expectedCatalogWorldMatrix, [0, 1, 0]),
      applyLiteralMatrix(control.expectedCatalogWorldMatrix, [0, 0, 1]),
    ];
    if (
      actual.orientationId !== expected.id ||
      actualMatrix?.id !== actual.orientationId ||
      JSON.stringify(actual.positionLdu) !== JSON.stringify(control.expectedCatalogPositionLdu) ||
      JSON.stringify(basisImages) !== JSON.stringify(control.expectedBasisImages)
    ) {
      throw new TypeError(
        `Step-42 independent transform algebra control ${control.controlId} detected sign, order, inverse, transpose, or translation drift.`,
      );
    }
  }
  return INDEPENDENT_TRANSFORM_ALGEBRA_CONTROL_COMMITMENT;
}

export const INDEPENDENT_TRANSFORM_CONTROL_COMMITMENT = assertIndependentTransformAlgebraControls(
  INDEPENDENT_CATALOG_ORIENTATION_TRUTH,
);

function requireCatalogOrientationMutationRefusalForTest() {
  const mutated = PROPER_ORIENTATIONS.map(({ id, matrix }) => ({ id, matrix: [...matrix] }));
  [mutated[0], mutated[1]] = [mutated[1], mutated[0]];
  return exactIndependentOrientationTruth(mutated);
}

export const __testOnly = TEST_MODE
  ? Object.freeze({ requireCatalogOrientationMutationRefusalForTest })
  : undefined;
