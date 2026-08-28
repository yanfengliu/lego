import { isDeepStrictEqual } from "node:util";

import { PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS } from "./part-identification-prefix50-ldraw-catalog-frames-source.mjs";

export function exactAliasGroups(proposal) {
  const groups = new Map();
  for (const row of proposal.rows) {
    if (!Number.isSafeInteger(row.stepNumber) || row.stepNumber < 1 || row.stepNumber > 50) {
      throw new TypeError(
        `Frame registry refuses proposal row ${row.sourceBuilderIdentityOrdinal} outside printed steps 1..50.`,
      );
    }
    const existing = groups.get(row.designRevision) ?? [];
    existing.push(row);
    groups.set(row.designRevision, existing);
  }
  return [...groups]
    .map(([designRevision, occurrences]) => {
      const first = occurrences[0];
      const identity = {
        catalogPartId: first.catalogPartId,
        ldrawFilename: first.ldrawFilename,
        catalogLdrawFilename: first.catalogFrame.catalogLdrawFilename,
      };
      if (
        !/^\d+;[A-Z0-9]+$/u.test(designRevision) ||
        !/^\d+[a-z0-9]*\.dat$/u.test(identity.ldrawFilename) ||
        !/^\d+[a-z0-9]*\.dat$/u.test(identity.catalogLdrawFilename) ||
        occurrences.some(
          (row) =>
            row.catalogPartId !== identity.catalogPartId ||
            row.ldrawFilename !== identity.ldrawFilename ||
            row.catalogFrame.catalogLdrawFilename !== identity.catalogLdrawFilename,
        )
      ) {
        throw new TypeError(
          `Frame registry alias ${designRevision} does not retain one exact proposal identity tuple.`,
        );
      }
      return {
        ...identity,
        designRevision,
        frameKey: `${designRevision}|${identity.catalogPartId}|${identity.catalogLdrawFilename}`,
        occurrenceCount: occurrences.length,
        projectableOccurrenceCount: occurrences.filter(
          ({ identityRelation }) => identityRelation.state === "projectable",
        ).length,
        quarantinedOccurrenceCount: occurrences.filter(
          ({ identityRelation }) => identityRelation.state === "quarantined",
        ).length,
      };
    })
    .sort((left, right) => left.designRevision.localeCompare(right.designRevision));
}

export function catalogLdrawFilename(definition) {
  const values = definition.aliases
    .filter(({ namespace }) => namespace === "ldraw")
    .map(({ value }) => value);
  if (values.length !== 1 || !/^\d+[a-z0-9]*\.dat$/u.test(values[0])) {
    throw new TypeError(
      `Catalog ${definition.id} must retain exactly one numeric LDraw filename; received ${JSON.stringify(values)}.`,
    );
  }
  return values[0];
}

export function meshFrame(definition, identity) {
  const geometry = definition.geometry;
  const frame = geometry.assetToCatalogFrame;
  if (
    geometry.generatorId !== "builtin:preloaded-mesh-reference/1" ||
    frame?.schemaVersion !== "mesh-asset-to-catalog-frame/1" ||
    geometry.assetId !== `ldraw:official:${identity.catalogLdrawFilename}` ||
    !Array.isArray(frame.translationLdu) ||
    frame.translationLdu.length !== 3 ||
    frame.translationLdu.some((value) => !Number.isSafeInteger(value))
  ) {
    throw new TypeError(
      `Catalog mesh ${definition.id} does not expose one exact official asset-to-catalog frame for ${identity.catalogLdrawFilename}.`,
    );
  }
  return {
    derivationKind: "catalog-mesh-asset-to-catalog-frame",
    frame: {
      orientationId: frame.orientationId,
      translationLdu: [...frame.translationLdu],
    },
    evidence: {
      assetId: geometry.assetId,
      assetToCatalogFrameSchemaVersion: frame.schemaVersion,
      geometryContentHash: geometry.contentHash,
    },
  };
}

export function assertNewExpectation(row) {
  const expected = PREFIX50_LDRAW_CATALOG_NEW_PARAMETRIC_EXPECTATIONS.find(
    ({ designRevision }) => designRevision === row.designRevision,
  );
  if (expected === undefined) return false;
  const observed = {
    designRevision: row.designRevision,
    catalogPartId: row.catalogPartId,
    ldrawFilename: row.ldrawFilename,
    catalogLdrawFilename: row.catalogLdrawFilename,
    occurrenceCount: row.occurrenceCount,
    frame: row.frame,
    archive: {
      closureFileCount: row.evidence.closureFileCount,
      expandedTriangleCount: row.evidence.expandedTriangleCount,
      bounds: row.evidence.bounds,
    },
    candidateCount: row.evidence.candidateCount,
    candidateSelfSymmetryClassCount: row.evidence.candidateSelfSymmetryClassCount,
  };
  if (!isDeepStrictEqual(observed, expected)) {
    throw new TypeError(
      `${row.designRevision} independently derived archive frame drifted: ${JSON.stringify(observed)}.`,
    );
  }
  return true;
}
