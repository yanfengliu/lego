interface CatalogInterpretationChange {
  readonly affectedCatalogPartIds: readonly string[];
  readonly changedFields: readonly string[];
}

export interface ModelCatalogInterpretationSummary {
  readonly catalogPartIds: readonly string[];
  readonly changedFields: readonly string[];
}

/** Catalog interpretations that changed and are actually instantiated by one model. */
export function summarizeModelCatalogInterpretations(
  modelCatalogPartIds: readonly string[],
  changes: readonly CatalogInterpretationChange[],
): ModelCatalogInterpretationSummary {
  const present = new Set(modelCatalogPartIds);
  const relevant = changes.filter(({ affectedCatalogPartIds }) =>
    affectedCatalogPartIds.some((catalogPartId) => present.has(catalogPartId)),
  );
  return {
    catalogPartIds: [
      ...new Set(
        relevant
          .flatMap(({ affectedCatalogPartIds }) => affectedCatalogPartIds)
          .filter((catalogPartId) => present.has(catalogPartId)),
      ),
    ],
    changedFields: [...new Set(relevant.flatMap(({ changedFields }) => changedFields))],
  };
}
