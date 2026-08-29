import { isDeepStrictEqual } from "node:util";

import { reconcilePrefix50WorldTransform } from "./part-identification-prefix50-official-world-reconciliation-math.mjs";

export function prefix50FrameLookup(frameRegistry) {
  if (!Array.isArray(frameRegistry.frames) || frameRegistry.frames.length !== 66) {
    throw new TypeError("Official-world reconciliation requires the exact 66-row frame registry.");
  }
  const rows = new Map();
  for (const row of frameRegistry.frames) {
    const key = `${row.designRevision}|${row.catalogPartId}|${row.catalogLdrawFilename}`;
    if (key !== row.frameKey || rows.has(key)) {
      throw new TypeError(
        `Frame registry key ${JSON.stringify(row.frameKey)} is not exact and unique.`,
      );
    }
    rows.set(key, row);
  }
  return rows;
}

const occurrenceBasis = (row) => ({
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

function exactRegistryOccurrence(registry, proposalRow) {
  if (registry === undefined || !Array.isArray(registry.occurrences)) return null;
  const matches = registry.occurrences.filter(
    ({ sourceBuilderIdentityOrdinal }) =>
      sourceBuilderIdentityOrdinal === proposalRow.sourceBuilderIdentityOrdinal,
  );
  if (matches.length !== 1 || !isDeepStrictEqual(matches[0], occurrenceBasis(proposalRow))) {
    return null;
  }
  return matches[0];
}

export function reconcilePrefix50Occurrence(proposalRow, actionByOrdinal, registryByKey, catalog) {
  const action = actionByOrdinal.get(proposalRow.sourceBuilderIdentityOrdinal);
  if (
    action === undefined ||
    action.builderBrickRef !== proposalRow.builderBrickRef ||
    action.stepNumber !== proposalRow.stepNumber ||
    action.phaseSequence !== proposalRow.phaseSequence
  ) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} does not match its opaque action-preparation identity and phase.`,
    );
  }
  const frameKey = `${proposalRow.designRevision}|${proposalRow.catalogPartId}|${proposalRow.catalogFrame.catalogLdrawFilename}`;
  const registry = registryByKey.get(frameKey);
  const registryOccurrence = exactRegistryOccurrence(registry, proposalRow);
  const projectable = proposalRow.identityRelation.state === "projectable";
  const quarantined = proposalRow.identityRelation.state === "quarantined";
  if (projectable === quarantined || proposalRow.documentLegalityClaimed !== false) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} has an invalid proposal authority state.`,
    );
  }
  if (
    projectable &&
    (registry === undefined ||
      registryOccurrence === null ||
      registry.ldrawFilename !== proposalRow.ldrawFilename ||
      registry.designRevision !== proposalRow.designRevision ||
      registry.publishedCatalogPartId !== proposalRow.publishedCatalogPartId ||
      registry.catalogPartId !== proposalRow.catalogPartId ||
      registry.catalogLdrawFilename !== proposalRow.catalogFrame.catalogLdrawFilename)
  ) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} has no exact occurrence-bound catalog frame ${frameKey}.`,
    );
  }
  if (quarantined && registry !== undefined) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} is quarantined and must not acquire a catalog frame through identity widening.`,
    );
  }
  const movedRoot = proposalRow.catalogBinding.bindingKind === "identity-moved-root";
  if (
    projectable &&
    ((movedRoot &&
      (registry.identityProof?.proofId !== proposalRow.catalogBinding.movedRootProofId ||
        registry.identityProof.globalAliasClaimed !== false)) ||
      (!movedRoot && registry.identityProof !== null))
  ) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} does not retain its exact occurrence-scoped moved-root proof boundary.`,
    );
  }
  return Object.freeze({
    stepNumber: proposalRow.stepNumber,
    phaseSequence: proposalRow.phaseSequence,
    sourceBuilderIdentityOrdinal: proposalRow.sourceBuilderIdentityOrdinal,
    actionKind: action.actionKind,
    builderBrickRef: proposalRow.builderBrickRef,
    sourceBuilderBrickRef: action.sourceBuilderBrickRef,
    masterSubBuildRef: action.masterSubBuildRef,
    calloutIdentity: proposalRow.calloutIdentity,
    designRevision: proposalRow.designRevision,
    publishedCatalogPartId: proposalRow.publishedCatalogPartId,
    catalogPartId: proposalRow.catalogPartId,
    catalogBinding: proposalRow.catalogBinding,
    catalogColorId: proposalRow.catalogColorId,
    xmlRow: proposalRow.xmlRow,
    xmlPartRow: 1,
    topLevelLdrawRow: proposalRow.topLevelLdrawRow,
    compositeLdrawRow: null,
    ldrawFilename: proposalRow.ldrawFilename,
    catalogLdrawFilename: proposalRow.catalogFrame.catalogLdrawFilename,
    status: projectable ? "reconciled" : "quarantined-unchanged",
    quarantineBasis: quarantined ? proposalRow.identityRelation.basis : null,
    frameKey: projectable ? registry.frameKey : null,
    catalogFrameEvidence: projectable ? registry.frame : null,
    catalogIdentityProof: projectable ? registry.identityProof : null,
    frameApplied: projectable,
    identityEquivalenceClaimed: false,
    sourceWorldProposal: Object.freeze({
      ...proposalRow.sourceWorldProposal,
      positionLdu: Object.freeze([...proposalRow.sourceWorldProposal.positionLdu]),
    }),
    catalogWorldTransform: projectable
      ? reconcilePrefix50WorldTransform(proposalRow.sourceWorldProposal, registry.frame, catalog)
      : null,
    documentLegalityClaimed: false,
  });
}
