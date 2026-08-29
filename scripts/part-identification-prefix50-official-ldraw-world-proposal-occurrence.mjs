import { isDeepStrictEqual } from "node:util";

import { PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS } from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

const bindingByOrdinal = new Map(
  PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.map((row) => [row.sourceBuilderIdentityOrdinal, row]),
);

if (
  bindingByOrdinal.size !== PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.length ||
  PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.length !== 11
) {
  throw new TypeError(
    "Prefix-50 occurrence bindings must retain exactly eleven unique source identity ordinals.",
  );
}

const occurrenceBasis = ({ stepNumber, phaseSequence, member, callout, leaf }) => ({
  sourceBuilderIdentityOrdinal: member.sourceBuilderIdentityOrdinal,
  stepNumber,
  phaseSequence,
  builderBrickRef: member.builderBrickRef,
  calloutIdentity: member.calloutIdentity,
  designRevision: member.designRevision,
  publishedCatalogPartId: callout.catalogPartId,
  ldrawFilename: leaf.ldrawFilename,
});

const expectedOccurrenceBasis = (row) => ({
  sourceBuilderIdentityOrdinal: row.sourceBuilderIdentityOrdinal,
  stepNumber: row.stepNumber,
  phaseSequence: row.phaseSequence,
  builderBrickRef: row.builderBrickRef,
  calloutIdentity: row.calloutIdentity,
  designRevision: row.designRevision,
  publishedCatalogPartId: row.publishedCatalogPartId,
  ldrawFilename: row.ldrawFilename,
});

export function resolvePrefix50OccurrenceCatalogBinding(context) {
  const observed = occurrenceBasis(context);
  if (
    !Number.isSafeInteger(observed.sourceBuilderIdentityOrdinal) ||
    !Number.isSafeInteger(observed.stepNumber) ||
    observed.stepNumber < 1 ||
    observed.stepNumber > 50 ||
    !Number.isSafeInteger(observed.phaseSequence) ||
    typeof observed.publishedCatalogPartId !== "string"
  ) {
    throw new TypeError(
      `Prefix-50 occurrence ${JSON.stringify(observed.sourceBuilderIdentityOrdinal)} has an invalid bounded source basis.`,
    );
  }
  const expected = bindingByOrdinal.get(observed.sourceBuilderIdentityOrdinal);
  if (expected !== undefined) {
    if (!isDeepStrictEqual(observed, expectedOccurrenceBasis(expected))) {
      throw new TypeError(
        `Prefix-50 occurrence binding ${expected.sourceBuilderIdentityOrdinal} does not match its full step/phase/brick/callout/design/published-part/source-root basis.`,
      );
    }
    return expected;
  }
  return Object.freeze({
    ...observed,
    catalogPartId: observed.publishedCatalogPartId,
    catalogLdrawFilename: null,
    bindingKind: "published-catalog-part",
    occurrenceScoped: false,
    identityBasis: "published-catalog-part-with-closed-identity-relation",
    priorQuarantineBasis: null,
    movedRootProofId: null,
  });
}

export function closePrefix50OccurrenceCatalogBinding(binding, catalogLdrawFilename) {
  if (!/^\d+[a-z0-9]*\.dat$/u.test(catalogLdrawFilename)) {
    throw new TypeError(
      `Prefix-50 occurrence ${binding.sourceBuilderIdentityOrdinal} has invalid catalog LDraw root ${JSON.stringify(catalogLdrawFilename)}.`,
    );
  }
  if (
    binding.catalogLdrawFilename !== null &&
    binding.catalogLdrawFilename !== catalogLdrawFilename
  ) {
    throw new TypeError(
      `Prefix-50 occurrence ${binding.sourceBuilderIdentityOrdinal} requires catalog root ${binding.catalogLdrawFilename}, not ${catalogLdrawFilename}.`,
    );
  }
  return Object.freeze({ ...binding, catalogLdrawFilename });
}

const exactBindingProjection = (row) => ({
  sourceBuilderIdentityOrdinal: row.sourceBuilderIdentityOrdinal,
  stepNumber: row.stepNumber,
  phaseSequence: row.phaseSequence,
  builderBrickRef: row.builderBrickRef,
  calloutIdentity: row.calloutIdentity,
  designRevision: row.designRevision,
  publishedCatalogPartId: row.publishedCatalogPartId,
  catalogPartId: row.catalogPartId,
  ldrawFilename: row.ldrawFilename,
  catalogLdrawFilename: row.catalogFrame.catalogLdrawFilename,
  bindingKind: row.catalogBinding.bindingKind,
  occurrenceScoped: row.catalogBinding.occurrenceScoped,
  identityBasis: row.catalogBinding.identityBasis,
  priorQuarantineBasis: row.catalogBinding.priorQuarantineBasis,
  movedRootProofId: row.catalogBinding.movedRootProofId,
});

export function assertPrefix50OccurrenceCatalogBindings(rows) {
  const observed = rows
    .filter(({ catalogBinding }) => catalogBinding.occurrenceScoped)
    .map(exactBindingProjection)
    .sort((left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal);
  const expected = PREFIX50_OFFICIAL_LDRAW_OCCURRENCE_BINDINGS.map((row) => ({ ...row })).sort(
    (left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal,
  );
  if (!isDeepStrictEqual(observed, expected)) {
    throw new TypeError(
      `Prefix-50 occurrence-scoped catalog bindings drifted: ${JSON.stringify(observed)}.`,
    );
  }
  return rows;
}
