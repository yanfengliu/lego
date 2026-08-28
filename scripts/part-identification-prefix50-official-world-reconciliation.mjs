import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
import { prefix50ActionOccurrenceMap } from "./part-identification-prefix50-official-world-reconciliation-action.mjs";
import {
  bytesFromVerifiedPrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import {
  bytesFromVerifiedPrefix50LdrawCatalogFrames,
  inspectVerifiedPrefix50LdrawCatalogFrames,
  isVerifiedPrefix50LdrawCatalogFrames,
} from "./part-identification-prefix50-ldraw-catalog-frames.mjs";
import {
  bytesFromVerifiedPrefix50OfficialLdrawWorldProposal,
  inspectVerifiedPrefix50OfficialLdrawWorldProposal,
  isVerifiedPrefix50OfficialLdrawWorldProposal,
} from "./part-identification-prefix50-official-ldraw-world-proposal.mjs";
import {
  prefix50Commitment,
  prefix50OccurrenceProjection,
  prefix50WorldProjection,
  reconcilePrefix50WorldTransform,
} from "./part-identification-prefix50-official-world-reconciliation-math.mjs";
import {
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_SCHEMA,
} from "./part-identification-prefix50-official-world-reconciliation-source.mjs";
import { measurePrefix50FirstEightConnectorTopology } from "./part-identification-prefix50-official-world-reconciliation-topology.mjs";

const COMPILE_KEYS = ["actionPreparation", "frameRegistry", "proposal"];
const VERIFY_KEYS = [...COMPILE_KEYS, "artifactBytes"].sort();
const CATALOG_URL = new URL("../packages/catalog/src/index.ts", import.meta.url).href;

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPrefix50OfficialLdrawWorldProposal(roles.proposal)) {
    throw new TypeError(
      `${label}.proposal must be the opaque verified current 500,895-byte official-world proposal. Parsed JSON and caller-shaped lookalikes carry no occurrence or transform authority.`,
    );
  }
  if (!isVerifiedPrefix50LdrawCatalogFrames(roles.frameRegistry)) {
    throw new TypeError(
      `${label}.frameRegistry must be the opaque verified exact first-50 LDraw-to-catalog frame registry. Parsed JSON and caller-shaped lookalikes carry no frame authority.`,
    );
  }
  if (!isVerifiedPrefix50ActionPreparation(roles.actionPreparation)) {
    throw new TypeError(
      `${label}.actionPreparation must be the opaque verified current first-50 action preparation. Parsed schedules and caller-shaped lookalikes carry no direct/MultiBuild occurrence authority.`,
    );
  }
  return {
    proposal: roles.proposal,
    frameRegistry: roles.frameRegistry,
    actionPreparation: roles.actionPreparation,
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: snapshotBoundedUint8Array(roles.artifactBytes, {
            label: "Official-world reconciliation artifact bytes",
            minimumBytes: 1,
            maximumBytes: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
          }),
        }
      : {}),
  };
}

function requireOpaqueInput(value, bytes, expected, label) {
  if (
    value.digest !== expected?.digest ||
    bytes.length !== expected?.bytes ||
    value.artifact.schemaVersion !== expected?.schemaVersion
  ) {
    throw new TypeError(
      `${label} must be the exact reviewed ${expected?.bytes ?? "missing"}-byte opaque input at ${expected?.digest ?? "missing pin"}.`,
    );
  }
}

function exactProposalScope(proposal) {
  const ordinals = [...proposal.rows]
    .map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal)
    .sort((left, right) => left - right);
  if (
    proposal.scope.firstPrintedStep !== 1 ||
    proposal.scope.lastPrintedStep !== 50 ||
    proposal.scope.expectedPrintedSteps !== 359 ||
    proposal.scope.sourceIndexPreserved !== true ||
    proposal.scope.suffixStepsReconstructed !== false ||
    proposal.sourceIndex.expectedPrintedSteps !== 359 ||
    proposal.sourceIndex.prefixLastStep !== 50 ||
    proposal.accounting.actionRows !== 320 ||
    proposal.accounting.projectableActionRows !== 309 ||
    proposal.accounting.quarantinedActionRows !== 11 ||
    proposal.rows.length !== 320 ||
    !isDeepStrictEqual(
      ordinals,
      Array.from({ length: 320 }, (_, index) => index + 1),
    ) ||
    new Set(proposal.rows.map(({ builderBrickRef }) => builderBrickRef)).size !== 320
  ) {
    throw new TypeError(
      "Official-world reconciliation requires all and only exact action ordinals 1..320 through printed step 50 while retaining the 359-step index.",
    );
  }
}

function frameLookup(frameRegistry) {
  if (!Array.isArray(frameRegistry.frames) || frameRegistry.frames.length !== 62) {
    throw new TypeError("Official-world reconciliation requires the exact 62-row frame registry.");
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

function reconcileRow(proposalRow, actionByOrdinal, registryByKey, catalog) {
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
      registry.ldrawFilename !== proposalRow.ldrawFilename ||
      registry.designRevision !== proposalRow.designRevision ||
      registry.catalogPartId !== proposalRow.catalogPartId ||
      registry.catalogLdrawFilename !== proposalRow.catalogFrame.catalogLdrawFilename)
  ) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} has no exact triple-bound catalog frame ${frameKey}.`,
    );
  }
  if (quarantined && registry !== undefined) {
    throw new TypeError(
      `Official occurrence ${proposalRow.sourceBuilderIdentityOrdinal} is quarantined and must not acquire a catalog frame through identity widening.`,
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
    catalogPartId: proposalRow.catalogPartId,
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

function accounting(rows) {
  const reconciled = rows.filter(({ status }) => status === "reconciled");
  const quarantined = rows.filter(({ status }) => status === "quarantined-unchanged");
  const copies = rows.filter(({ actionKind }) => actionKind === "multi-build-copy");
  const direct = rows.filter(({ actionKind }) => actionKind === "direct");
  return {
    occurrenceRows: rows.length,
    reconciledRows: reconciled.length,
    quarantinedRows: quarantined.length,
    directRows: direct.length,
    multiBuildCopyRows: copies.length,
    reconciledDirectRows: reconciled.filter(({ actionKind }) => actionKind === "direct").length,
    reconciledMultiBuildCopyRows: reconciled.filter(
      ({ actionKind }) => actionKind === "multi-build-copy",
    ).length,
    quarantinedDirectRows: quarantined.filter(({ actionKind }) => actionKind === "direct").length,
    uniqueBuilderBrickRefs: new Set(rows.map(({ builderBrickRef }) => builderBrickRef)).size,
    uniqueXmlRows: new Set(rows.map(({ xmlRow }) => xmlRow)).size,
    uniqueTopLevelLdrawRows: new Set(rows.map(({ topLevelLdrawRow }) => topLevelLdrawRow)).size,
    halfLduRows: rows.filter(({ catalogWorldTransform }) =>
      catalogWorldTransform?.positionLdu.some((coordinate) => !Number.isInteger(coordinate)),
    ).length,
  };
}

async function compileSnapshot(input) {
  const proposalInspection = inspectVerifiedPrefix50OfficialLdrawWorldProposal(input.proposal);
  const proposalBytes = bytesFromVerifiedPrefix50OfficialLdrawWorldProposal(input.proposal);
  const frameInspection = inspectVerifiedPrefix50LdrawCatalogFrames(input.frameRegistry);
  const frameBytes = bytesFromVerifiedPrefix50LdrawCatalogFrames(input.frameRegistry);
  const actionInspection = inspectVerifiedPrefix50ActionPreparation(input.actionPreparation);
  const actionBytes = bytesFromVerifiedPrefix50ActionPreparation(input.actionPreparation);
  requireOpaqueInput(
    proposalInspection,
    proposalBytes,
    PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.proposal,
    "Official-world proposal",
  );
  requireOpaqueInput(
    frameInspection,
    frameBytes,
    PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.frameRegistry,
    "LDraw-to-catalog frame registry",
  );
  requireOpaqueInput(
    actionInspection,
    actionBytes,
    PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.actionPreparation,
    "Prefix-50 action preparation",
  );
  const proposal = proposalInspection.artifact;
  exactProposalScope(proposal);
  const actionByOrdinal = prefix50ActionOccurrenceMap(actionInspection.artifact);
  const catalog = await importRepositoryTypeScript(CATALOG_URL);
  if (
    catalog.BUILTIN_CATALOG_VERSION !== PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.catalogVersion
  ) {
    throw new TypeError(
      `Official-world reconciliation requires catalog ${PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.catalogVersion}; received ${catalog.BUILTIN_CATALOG_VERSION}.`,
    );
  }
  const registryByKey = frameLookup(frameInspection.artifact);
  const rows = [...proposal.rows]
    .sort((left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal)
    .map((row) => reconcileRow(row, actionByOrdinal, registryByKey, catalog));
  const measuredAccounting = accounting(rows);
  if (
    !isDeepStrictEqual(
      measuredAccounting,
      PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedAccounting,
    )
  ) {
    throw new TypeError(
      `Official-world reconciliation accounting drifted: ${JSON.stringify(measuredAccounting)}.`,
    );
  }
  const halfLduOrdinals = rows
    .filter(({ catalogWorldTransform }) =>
      catalogWorldTransform?.positionLdu.some((coordinate) => !Number.isInteger(coordinate)),
    )
    .map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal);
  if (!isDeepStrictEqual(halfLduOrdinals, [281, 282, 283])) {
    throw new TypeError(
      `Official-world reconciliation half-LDU occurrence scope drifted: ${JSON.stringify(halfLduOrdinals)}.`,
    );
  }
  return {
    schemaVersion: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_SCHEMA,
    authority: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY,
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixStepsReconstructed: false,
      scopeBasis: "opaque-action-ordinals-and-actual-builder-brickrefs-never-xml-prefix",
    },
    inputs: {
      proposal: {
        schemaVersion: proposal.schemaVersion,
        bytes: proposalBytes.length,
        digest: proposalInspection.digest,
      },
      frameRegistry: {
        schemaVersion: frameInspection.artifact.schemaVersion,
        bytes: frameBytes.length,
        digest: frameInspection.digest,
      },
      actionPreparation: {
        schemaVersion: actionInspection.artifact.schemaVersion,
        bytes: actionBytes.length,
        digest: actionInspection.digest,
      },
      catalogVersion: catalog.BUILTIN_CATALOG_VERSION,
      properOrientationRegistryDigest: sha256Digest(
        Buffer.from(
          JSON.stringify(
            catalog.PROPER_ORIENTATIONS.map(({ id, matrix }) => ({ id, matrix: [...matrix] })),
          ),
        ),
      ),
    },
    accounting: measuredAccounting,
    occurrenceCommitment: prefix50Commitment(rows, prefix50OccurrenceProjection),
    worldTransformCommitment: prefix50Commitment(rows, prefix50WorldProjection),
    firstEightConnectorTopology: measurePrefix50FirstEightConnectorTopology(rows, catalog),
    rows,
  };
}

export const encodePrefix50OfficialWorldReconciliation = (artifact) =>
  Buffer.from(`${JSON.stringify(artifact, null, 1)}\n`);

export async function compilePrefix50OfficialWorldReconciliation(input) {
  const snapshot = snapshotInput(
    input,
    COMPILE_KEYS,
    "Official-world reconciliation compiler input",
  );
  await Promise.resolve();
  return compileSnapshot(snapshot);
}

function validateSuppliedArtifact(supplied, expected) {
  if (!Array.isArray(supplied.rows) || supplied.rows.length !== expected.rows.length) {
    throw new TypeError("Supplied official-world reconciliation must retain exactly 320 rows.");
  }
  for (const [index, expectedRow] of expected.rows.entries()) {
    const row = supplied.rows[index];
    if (row?.stepNumber > 50) {
      throw new TypeError(
        `Supplied official-world reconciliation injects out-of-scope step ${row.stepNumber}.`,
      );
    }
    if (
      expectedRow.actionKind === "multi-build-copy" &&
      row?.builderBrickRef === expectedRow.sourceBuilderBrickRef
    ) {
      throw new TypeError(
        `Supplied MultiBuild ordinal ${expectedRow.sourceBuilderIdentityOrdinal} substitutes source ${expectedRow.sourceBuilderBrickRef} for actual occurrence ${expectedRow.builderBrickRef}.`,
      );
    }
    if (
      !isDeepStrictEqual(
        prefix50OccurrenceProjection(row),
        prefix50OccurrenceProjection(expectedRow),
      )
    ) {
      throw new TypeError(
        `Supplied occurrence ordinal ${expectedRow.sourceBuilderIdentityOrdinal} does not retain its exact official occurrence identity.`,
      );
    }
    if (
      row.ldrawFilename !== expectedRow.ldrawFilename ||
      row.catalogLdrawFilename !== expectedRow.catalogLdrawFilename ||
      row.status !== expectedRow.status ||
      row.quarantineBasis !== expectedRow.quarantineBasis
    ) {
      throw new TypeError(
        `Supplied occurrence ordinal ${expectedRow.sourceBuilderIdentityOrdinal} widens an exact alias or quarantine boundary.`,
      );
    }
    if (!isDeepStrictEqual(prefix50WorldProjection(row), prefix50WorldProjection(expectedRow))) {
      throw new TypeError(
        `Supplied occurrence ordinal ${expectedRow.sourceBuilderIdentityOrdinal} changes its exact reconciled world transform.`,
      );
    }
  }
  if (
    !isDeepStrictEqual(supplied.occurrenceCommitment, expected.occurrenceCommitment) ||
    !isDeepStrictEqual(supplied.worldTransformCommitment, expected.worldTransformCommitment)
  ) {
    throw new TypeError("Supplied official-world reconciliation commitments do not reproduce.");
  }
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPrefix50OfficialWorldReconciliation(input) {
  const snapshot = snapshotInput(
    input,
    VERIFY_KEYS,
    "Official-world reconciliation verifier input",
  );
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(snapshot.artifactBytes, "Official-world reconciliation");
  const expected = await compileSnapshot(snapshot);
  validateSuppliedArtifact(supplied.value, expected);
  const expectedBytes = encodePrefix50OfficialWorldReconciliation(expected);
  const digest = sha256Digest(expectedBytes);
  const pin = PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedArtifact;
  if (pin === null) {
    throw new TypeError(
      `Official-world reconciliation reproduced ${expectedBytes.length} bytes at ${digest}, but no reviewed artifact pin is installed.`,
    );
  }
  if (expectedBytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `Official-world reconciliation reproduced ${expectedBytes.length} bytes at ${digest}, not its reviewed ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  if (!supplied.bytes.equals(expectedBytes)) {
    throw new TypeError(
      "Official-world reconciliation does not exactly reproduce from its three opaque current inputs.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest,
  });
  return verified;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new TypeError(
      "Official-world reconciliation inspection requires its opaque independent-verifier result.",
    );
  }
  return record;
}

export const isVerifiedPrefix50OfficialWorldReconciliation = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);
export const inspectVerifiedPrefix50OfficialWorldReconciliation = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};
export const bytesFromVerifiedPrefix50OfficialWorldReconciliation = (value) =>
  Buffer.from(verifiedRecord(value).bytes);
