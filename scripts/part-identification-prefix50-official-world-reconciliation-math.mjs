export {
  assertPrefix50ReconciliationAuthorityState,
  prefix50Commitment,
  prefix50OccurrenceProjection,
  prefix50WorldProjection,
} from "./part-identification-prefix50-official-world-reconciliation-projection.mjs";

export function transposePrefix50Matrix(matrix) {
  return [
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
}

export function multiplyPrefix50Matrices(left, right) {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return [0, 1, 2].reduce(
      (sum, offset) => sum + left[row * 3 + offset] * right[offset * 3 + column],
      0,
    );
  });
}

export function transformPrefix50Vector(matrix, vector) {
  return [0, 1, 2].map((row) =>
    [0, 1, 2].reduce((sum, column) => sum + matrix[row * 3 + column] * vector[column], 0),
  );
}

function exactProperOrientations(catalog) {
  if (!Array.isArray(catalog.PROPER_ORIENTATIONS) || catalog.PROPER_ORIENTATIONS.length !== 24) {
    throw new TypeError("Official-world reconciliation requires exactly 24 proper orientations.");
  }
  const byId = new Map();
  const byMatrix = new Map();
  for (const orientation of catalog.PROPER_ORIENTATIONS) {
    const matrix = [...orientation.matrix];
    if (
      typeof orientation.id !== "string" ||
      matrix.length !== 9 ||
      matrix.some((value) => ![-1, 0, 1].includes(value))
    ) {
      throw new TypeError("Official-world reconciliation found a malformed proper orientation.");
    }
    const key = matrix.join(",");
    if (byId.has(orientation.id) || byMatrix.has(key)) {
      throw new TypeError("Official-world reconciliation found a duplicate proper orientation.");
    }
    const row = Object.freeze({ id: orientation.id, matrix: Object.freeze(matrix) });
    byId.set(row.id, row);
    byMatrix.set(key, row);
  }
  return Object.freeze({ byId, byMatrix });
}

function exactHalfLduPosition(position, label) {
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    position.some(
      (coordinate) =>
        !Number.isFinite(coordinate) ||
        Math.abs(coordinate) > 10_000 ||
        !Number.isInteger(coordinate * 2),
    )
  ) {
    throw new TypeError(`${label} must contain exactly three bounded half-LDU coordinates.`);
  }
  return Object.freeze(position.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)));
}

export function reconcilePrefix50WorldTransform(sourceWorld, frame, catalog) {
  const orientations = exactProperOrientations(catalog);
  const sourceOrientation = orientations.byId.get(sourceWorld?.orientationId);
  const sourceToCatalog = orientations.byId.get(frame?.orientationId);
  if (sourceOrientation === undefined || sourceToCatalog === undefined) {
    throw new TypeError(
      "Official-world reconciliation requires exact registered source and LDraw-to-catalog orientations.",
    );
  }
  const sourcePosition = exactHalfLduPosition(
    sourceWorld.positionLdu,
    "Official LDraw world position",
  );
  if (
    !Array.isArray(frame.translationLdu) ||
    frame.translationLdu.length !== 3 ||
    frame.translationLdu.some(
      (coordinate) => !Number.isSafeInteger(coordinate) || Math.abs(coordinate) > 1_000,
    )
  ) {
    throw new TypeError(
      "Official-world reconciliation requires an exact bounded integer LDraw-to-catalog translation.",
    );
  }
  const catalogWorldMatrix = multiplyPrefix50Matrices(
    sourceOrientation.matrix,
    transposePrefix50Matrix(sourceToCatalog.matrix),
  );
  const catalogOrientation = orientations.byMatrix.get(catalogWorldMatrix.join(","));
  if (catalogOrientation === undefined) {
    throw new TypeError(
      "Official-world reconciliation produced a transform outside the exact proper-orientation registry.",
    );
  }
  const translated = transformPrefix50Vector(catalogWorldMatrix, frame.translationLdu);
  const positionLdu = exactHalfLduPosition(
    sourcePosition.map((coordinate, axis) => coordinate - translated[axis]),
    "Reconciled catalog world position",
  );
  return Object.freeze({
    orientationId: catalogOrientation.id,
    positionLdu,
  });
}
