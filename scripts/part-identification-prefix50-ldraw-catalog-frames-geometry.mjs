const normalizeZero = (value) => (Object.is(value, -0) ? 0 : value);

const point = (orientation, translation, value) =>
  [0, 1, 2].map((row) =>
    normalizeZero(
      translation[row] +
        [0, 1, 2].reduce(
          (sum, column) => sum + orientation.matrix[row * 3 + column] * value[column],
          0,
        ),
    ),
  );

function boundsOf(points) {
  return {
    min: [0, 1, 2].map((axis) => Math.min(...points.map((value) => value[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((value) => value[axis]))),
  };
}

function transformedBounds(bounds, orientation, translation) {
  const corners = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push(point(orientation, translation, [x, y, z]));
      }
    }
  }
  return boundsOf(corners);
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function inverseTransform(transform, orientations) {
  const orientation = orientations.find(({ id }) => id === transform.orientationId);
  const inverse = orientations.find(
    ({ quarterTurns }) => quarterTurns === (4 - orientation.quarterTurns) % 4,
  );
  const translation = point(inverse, [0, 0, 0], transform.positionLdu).map((value) =>
    normalizeZero(-value),
  );
  return { orientationId: inverse.id, positionLdu: translation };
}

function residualTransform(left, right, orientations) {
  const inverse = inverseTransform(left, orientations);
  const inverseOrientation = orientations.find(({ id }) => id === inverse.orientationId);
  const rightOrientation = orientations.find(({ id }) => id === right.orientationId);
  const orientation = orientations.find(
    ({ quarterTurns }) =>
      quarterTurns === (inverseOrientation.quarterTurns + rightOrientation.quarterTurns) % 4,
  );
  return {
    orientationId: orientation.id,
    positionLdu: point(inverseOrientation, inverse.positionLdu, right.positionLdu),
  };
}

function symmetryClasses(definition, candidates, orientations, isSelfSymmetry) {
  const classes = [];
  for (const candidate of candidates) {
    const found = classes.find((representative) =>
      isSelfSymmetry(definition, residualTransform(representative, candidate, orientations)),
    );
    if (found === undefined) classes.push(candidate);
  }
  return classes;
}

/** Derive first; a retained expectation may compare the result but cannot choose it. */
export function deriveExactParametricLdrawCatalogFrame({
  definition,
  expanded,
  isSelfSymmetry,
  orientations,
}) {
  if (
    definition.geometry.generatorId === "builtin:preloaded-mesh-reference/1" ||
    !Array.isArray(orientations) ||
    orientations.length !== 4
  ) {
    throw new TypeError(
      `Parametric frame derivation for ${definition.id} requires one non-mesh definition and the exact four upright orientations.`,
    );
  }
  const candidates = [];
  for (const orientation of orientations) {
    const rotated = transformedBounds(expanded.bounds, orientation, [0, 0, 0]);
    const translation = [0, 1, 2].map(
      (axis) =>
        (definition.boundsLdu.min[axis] +
          definition.boundsLdu.max[axis] -
          rotated.min[axis] -
          rotated.max[axis]) /
        2,
    );
    if (!translation.every(Number.isSafeInteger)) continue;
    if (same(transformedBounds(expanded.bounds, orientation, translation), definition.boundsLdu)) {
      candidates.push({ orientationId: orientation.id, positionLdu: translation });
    }
  }
  candidates.sort((left, right) => {
    const turn = (id) => orientations.find((orientation) => orientation.id === id).quarterTurns;
    return (
      turn(left.orientationId) - turn(right.orientationId) ||
      left.positionLdu[0] - right.positionLdu[0] ||
      left.positionLdu[1] - right.positionLdu[1] ||
      left.positionLdu[2] - right.positionLdu[2]
    );
  });
  const classes = symmetryClasses(definition, candidates, orientations, isSelfSymmetry);
  if (classes.length !== 1) {
    throw new TypeError(
      `${definition.id} leaves ${candidates.length} exact bounds candidates in ${classes.length} ` +
        "catalog self-symmetry classes; no static LDraw-to-catalog frame may select one.",
    );
  }
  const selected = candidates[0];
  return Object.freeze({
    candidateCount: candidates.length,
    candidateSelfSymmetryClassCount: classes.length,
    frame: Object.freeze({
      orientationId: selected.orientationId,
      translationLdu: Object.freeze([...selected.positionLdu]),
    }),
  });
}
