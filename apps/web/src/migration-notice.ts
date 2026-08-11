interface AppearanceInterpretationChange {
  readonly affectedCatalogPartIds: readonly string[];
}

/** Catalog appearances that changed and are actually instantiated by one model. */
export function modelAppearanceCatalogIds(
  modelCatalogPartIds: readonly string[],
  changes: readonly AppearanceInterpretationChange[],
): readonly string[] {
  const present = new Set(modelCatalogPartIds);
  return [
    ...new Set(
      changes
        .flatMap(({ affectedCatalogPartIds }) => affectedCatalogPartIds)
        .filter((catalogPartId) => present.has(catalogPartId)),
    ),
  ];
}
