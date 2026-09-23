if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") {
  throw new TypeError("Step-42 source geometry test support may load only under NODE_ENV=test.");
}

const [{ loadCurrentPrefix50VerifiedProjectionFixture }, geometry] = await Promise.all([
  import("./part-identification-prefix50-verified-projection-test-support.mjs"),
  import("./part-identification-prefix50-verified-projection-step42-source-geometry.mjs"),
]);

if (geometry.__testOnly === undefined) {
  throw new TypeError("Step-42 source geometry drift injection is unavailable outside test mode.");
}

export async function loadCurrentPrefix50Step42SourceGeometryFixture() {
  const fixture = await loadCurrentPrefix50VerifiedProjectionFixture();
  return Object.freeze({
    reader: fixture.reader,
    actionPreparationVerified: fixture.action.verified,
    officialWorldReconciliationVerified: fixture.reconciliation.verified,
  });
}

export function rebuildStep42SourceGeometryWithCompositionDriftForTest(fixture, occurrenceOrdinal) {
  return geometry.__testOnly.rebuildWithCompositionDriftForTest({
    reader: fixture.reader,
    actionPreparationVerified: fixture.actionPreparationVerified,
    officialWorldReconciliationVerified: fixture.officialWorldReconciliationVerified,
    occurrenceOrdinal,
  });
}

export function requireStep42CatalogOrientationMutationRefusalForTest() {
  return geometry.__testOnly.requireCatalogOrientationMutationRefusalForTest();
}
