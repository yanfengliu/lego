import { Buffer } from "node:buffer";

import { sha256Digest } from "./part-identification-artifact-source.mjs";

export function prefix50Commitment(rows, project) {
  const ordered = [...rows]
    .sort((left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal)
    .map(project);
  return Object.freeze({
    algorithm: "sha256-json-array-v1",
    rowCount: ordered.length,
    order: "sourceBuilderIdentityOrdinal-ascending",
    digest: sha256Digest(Buffer.from(JSON.stringify(ordered))),
  });
}

export function prefix50OccurrenceProjection(row) {
  return {
    sourceBuilderIdentityOrdinal: row.sourceBuilderIdentityOrdinal,
    stepNumber: row.stepNumber,
    phaseSequence: row.phaseSequence,
    actionKind: row.actionKind,
    builderBrickRef: row.builderBrickRef,
    sourceBuilderBrickRef: row.sourceBuilderBrickRef,
    masterSubBuildRef: row.masterSubBuildRef,
    calloutIdentity: row.calloutIdentity,
    designRevision: row.designRevision,
    publishedCatalogPartId: row.publishedCatalogPartId,
    catalogPartId: row.catalogPartId,
    catalogBinding: row.catalogBinding,
    catalogColorId: row.catalogColorId,
    xmlRow: row.xmlRow,
    xmlPartRow: row.xmlPartRow,
    topLevelLdrawRow: row.topLevelLdrawRow,
    compositeLdrawRow: row.compositeLdrawRow,
    ldrawFilename: row.ldrawFilename,
    catalogLdrawFilename: row.catalogLdrawFilename,
    quarantineBasis: row.quarantineBasis,
  };
}

export function assertPrefix50ReconciliationAuthorityState(row) {
  if (row?.identityEquivalenceClaimed !== false || row?.documentLegalityClaimed !== false) {
    throw new TypeError(
      "Official-world reconciliation rows may not claim identity equivalence or document legality.",
    );
  }
  if (row.status === "reconciled") {
    const movedRoot = row.catalogBinding?.bindingKind === "identity-moved-root";
    if (
      row.frameApplied !== true ||
      typeof row.frameKey !== "string" ||
      row.frameKey.length === 0 ||
      row.catalogFrameEvidence === null ||
      row.catalogFrameEvidence === undefined ||
      row.catalogWorldTransform === null ||
      row.catalogWorldTransform === undefined ||
      row.quarantineBasis !== null ||
      (movedRoot &&
        (row.catalogIdentityProof?.proofId !== row.catalogBinding.movedRootProofId ||
          row.catalogIdentityProof?.globalAliasClaimed !== false)) ||
      (!movedRoot && row.catalogIdentityProof !== null)
    ) {
      throw new TypeError(
        "A reconciled official-world row requires one exact applied frame and world transform without quarantine authority.",
      );
    }
    return row;
  }
  if (row.status === "quarantined-unchanged") {
    if (
      row.frameApplied !== false ||
      row.frameKey !== null ||
      row.catalogFrameEvidence !== null ||
      row.catalogIdentityProof !== null ||
      row.catalogWorldTransform !== null ||
      typeof row.quarantineBasis !== "string" ||
      row.quarantineBasis.length === 0
    ) {
      throw new TypeError(
        "A quarantined official-world row must retain its reason while every frame and world-transform field stays null and unapplied.",
      );
    }
    return row;
  }
  throw new TypeError(
    `Official-world reconciliation row has unsupported status ${JSON.stringify(row?.status)}.`,
  );
}

export function prefix50WorldProjection(row) {
  assertPrefix50ReconciliationAuthorityState(row);
  return {
    sourceBuilderIdentityOrdinal: row.sourceBuilderIdentityOrdinal,
    status: row.status,
    frameKey: row.frameKey,
    frameApplied: row.frameApplied,
    identityEquivalenceClaimed: row.identityEquivalenceClaimed,
    sourceWorldProposal: row.sourceWorldProposal,
    catalogIdentityProof: row.catalogIdentityProof,
    catalogWorldTransform: row.catalogWorldTransform,
    documentLegalityClaimed: row.documentLegalityClaimed,
  };
}
