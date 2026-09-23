import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { snapshotExactDataObject } from "./part-identification-bounded-snapshot.mjs";
import {
  bytesFromVerifiedPrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import {
  inspectVerifiedPrefix50OfficialWorldReconciliation,
  isVerifiedPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation-verification.mjs";
import {
  __testOnly as independentTransformLawTestOnly,
  INDEPENDENT_CATALOG_ORIENTATION_TRUTH,
  INDEPENDENT_TRANSFORM_CONTROL_COMMITMENT,
  independentlyComposeCatalogWorldTransform,
} from "./part-identification-prefix50-step42-independent-transform-law.mjs";
import {
  step42SourceGeometryStableDigest,
  verifyStep42SourceGeometryVerifierManifest,
} from "./part-identification-prefix50-step42-source-geometry-verifier-manifest-check.mjs";
import { STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST_COMMITMENT } from "./part-identification-prefix50-step42-source-geometry-verifier-manifest.mjs";
import { projectPrefix50Step42ActionBinding } from "./part-identification-prefix50-verified-projection-step42.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const LDRAW_ROOT = /^(\d+[a-z0-9]*)\.dat$/u;
const STEP42_ORDINALS = Object.freeze([274, 275, 276]);
const TEST_MODE = typeof process !== "undefined" && process.env?.NODE_ENV === "test";
const opaqueStep42GeometryByReader = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactInspections(actionPreparationVerified, officialWorldReconciliationVerified) {
  if (!isVerifiedPrefix50ActionPreparation(actionPreparationVerified)) {
    throw new TypeError(
      "Step-42 source geometry requires the opaque verified action preparation; caller-shaped action rows carry no geometry authority.",
    );
  }
  if (!isVerifiedPrefix50OfficialWorldReconciliation(officialWorldReconciliationVerified)) {
    throw new TypeError(
      "Step-42 source geometry requires the opaque verified official-world reconciliation; caller-shaped transforms carry no geometry authority.",
    );
  }
  const action = inspectVerifiedPrefix50ActionPreparation(actionPreparationVerified);
  const reconciliation = inspectVerifiedPrefix50OfficialWorldReconciliation(
    officialWorldReconciliationVerified,
  );
  const actionInput = reconciliation.artifact.inputs?.actionPreparation;
  if (
    actionInput?.schemaVersion !== action.artifact.schemaVersion ||
    actionInput.bytes !==
      bytesFromVerifiedPrefix50ActionPreparation(actionPreparationVerified).length ||
    actionInput.digest !== action.digest
  ) {
    throw new TypeError(
      "Step-42 source geometry requires one reconciliation bound to the same exact opaque action bytes.",
    );
  }
  return Object.freeze({ action, reconciliation });
}

function exactStep42ActionBinding(actionInspection) {
  const step = actionInspection.artifact.steps?.[41];
  const steps = [];
  steps[41] = {
    sourceActionDigest: step42SourceGeometryStableDigest({
      schemaVersion: "lego.real-build-prefix50-source-action/1",
      step,
    }),
  };
  return projectPrefix50Step42ActionBinding({
    digest: actionInspection.digest,
    phaseDigest: actionInspection.artifact.inputs?.officialModel?.phaseDigest,
    sourcePdfDigest: actionInspection.artifact.inputs?.sourcePdfDigest,
    sourceSteps: actionInspection.artifact.steps,
    steps,
  });
}

function exactTransform(value, label) {
  const row = snapshotExactDataObject(value, label, ["orientationId", "positionLdu"]);
  if (
    typeof row.orientationId !== "string" ||
    !PROPER_ORIENTATIONS.some(({ id }) => id === row.orientationId) ||
    !Array.isArray(row.positionLdu) ||
    row.positionLdu.length !== 3 ||
    row.positionLdu.some(
      (coordinate) =>
        typeof coordinate !== "number" ||
        !Number.isFinite(coordinate) ||
        Math.abs(coordinate) > 10_000 ||
        !Number.isInteger(coordinate * 2),
    )
  ) {
    throw new TypeError(`${label} must be one exact registered bounded half-LDU transform.`);
  }
  return deepFreeze({
    orientationId: row.orientationId,
    positionLdu: row.positionLdu.map((coordinate) => (Object.is(coordinate, -0) ? 0 : coordinate)),
  });
}

function exactSourceWorldProposal(value, ordinal) {
  const label = `Step-42 reconciliation occurrence ${ordinal} sourceWorldProposal`;
  const row = snapshotExactDataObject(value, label, [
    "orientationId",
    "positionLdu",
    "orientationResidual",
    "positionResidualLdu",
  ]);
  const transform = exactTransform(
    { orientationId: row.orientationId, positionLdu: row.positionLdu },
    label,
  );
  if (
    typeof row.orientationResidual !== "number" ||
    !Number.isFinite(row.orientationResidual) ||
    row.orientationResidual < 0 ||
    typeof row.positionResidualLdu !== "number" ||
    !Number.isFinite(row.positionResidualLdu) ||
    row.positionResidualLdu < 0
  ) {
    throw new TypeError(`${label} must retain finite non-negative snap residuals.`);
  }
  return deepFreeze({
    ...transform,
    orientationResidual: row.orientationResidual,
    positionResidualLdu: row.positionResidualLdu,
  });
}

function exactCatalogFrameEvidence(value, ordinal) {
  const label = `Step-42 reconciliation occurrence ${ordinal} catalogFrameEvidence`;
  const row = snapshotExactDataObject(value, label, ["orientationId", "translationLdu"]);
  if (
    typeof row.orientationId !== "string" ||
    !PROPER_ORIENTATIONS.some(({ id }) => id === row.orientationId) ||
    !Array.isArray(row.translationLdu) ||
    row.translationLdu.length !== 3 ||
    row.translationLdu.some(
      (coordinate) => !Number.isSafeInteger(coordinate) || Math.abs(coordinate) > 1_000,
    )
  ) {
    throw new TypeError(`${label} must be one exact registered bounded integer-LDU frame.`);
  }
  return deepFreeze({
    orientationId: row.orientationId,
    translationLdu: [...row.translationLdu],
  });
}

function exactCommitment(value, label) {
  const row = snapshotExactDataObject(value, label, ["algorithm", "rowCount", "order", "digest"]);
  if (
    row.algorithm !== "sha256-json-array-v1" ||
    row.rowCount !== 320 ||
    row.order !== "sourceBuilderIdentityOrdinal-ascending" ||
    !SHA256.test(row.digest)
  ) {
    throw new TypeError(`${label} must retain the exact 320-row ordered SHA-256 commitment.`);
  }
  return Object.freeze({
    algorithm: row.algorithm,
    rowCount: row.rowCount,
    order: row.order,
    digest: row.digest,
  });
}

function exactLdrawRoot(filename, ordinal, role) {
  const match = typeof filename === "string" ? LDRAW_ROOT.exec(filename) : null;
  if (match === null) {
    throw new TypeError(
      `Step-42 reconciliation occurrence ${ordinal} has invalid ${role} LDraw root ${JSON.stringify(filename)}.`,
    );
  }
  return match[1];
}

function exactStep42Row(row, actionMember, phase, callout) {
  const ordinal = actionMember.sourceBuilderIdentityOrdinal;
  const binding = row?.catalogBinding;
  if (
    callout === undefined ||
    row?.sourceBuilderIdentityOrdinal !== ordinal ||
    row.stepNumber !== 42 ||
    row.phaseSequence !== 68 ||
    row.actionKind !== "direct" ||
    row.builderBrickRef !== actionMember.builderBrickRef ||
    row.sourceBuilderBrickRef !== null ||
    row.masterSubBuildRef !== null ||
    row.calloutIdentity !== actionMember.calloutIdentity ||
    row.designRevision !== actionMember.designRevision ||
    row.publishedCatalogPartId !== callout.catalogPartId ||
    row.catalogColorId !== callout.publishedColorId ||
    row.status !== "reconciled" ||
    row.quarantineBasis !== null ||
    row.frameApplied !== true ||
    row.identityEquivalenceClaimed !== false ||
    row.documentLegalityClaimed !== false ||
    row.catalogIdentityProof !== null ||
    binding?.bindingKind !== "published-catalog-part" ||
    binding.occurrenceScoped !== false ||
    binding.identityBasis !== "published-catalog-part-with-closed-identity-relation" ||
    binding.priorQuarantineBasis !== null ||
    binding.movedRootProofId !== null ||
    binding.sourceBuilderIdentityOrdinal !== ordinal ||
    binding.stepNumber !== row.stepNumber ||
    binding.phaseSequence !== row.phaseSequence ||
    binding.builderBrickRef !== row.builderBrickRef ||
    binding.calloutIdentity !== row.calloutIdentity ||
    binding.designRevision !== row.designRevision ||
    binding.publishedCatalogPartId !== row.publishedCatalogPartId ||
    binding.catalogPartId !== row.catalogPartId ||
    binding.ldrawFilename !== row.ldrawFilename ||
    binding.catalogLdrawFilename !== row.catalogLdrawFilename ||
    row.catalogPartId !== row.publishedCatalogPartId ||
    phase.kind !== "direct"
  ) {
    throw new TypeError(
      `Step-42 reconciliation occurrence ${ordinal} contradicts its exact action/member and occurrence-scoped catalog identity.`,
    );
  }
  const sourceWorldProposal = exactSourceWorldProposal(row.sourceWorldProposal, ordinal);
  const catalogFrameEvidence = exactCatalogFrameEvidence(row.catalogFrameEvidence, ordinal);
  const suppliedCatalogWorldTransform = exactTransform(
    row.catalogWorldTransform,
    `Step-42 reconciliation occurrence ${ordinal} catalogWorldTransform`,
  );
  const recomputedCatalogWorldTransform = exactTransform(
    independentlyComposeCatalogWorldTransform(
      sourceWorldProposal,
      catalogFrameEvidence,
      INDEPENDENT_CATALOG_ORIENTATION_TRUTH,
    ),
    `Step-42 reconciliation occurrence ${ordinal} independently composed transform`,
  );
  if (!isDeepStrictEqual(suppliedCatalogWorldTransform, recomputedCatalogWorldTransform)) {
    throw new TypeError(
      `Step-42 reconciliation occurrence ${ordinal} changes its independently composed catalog-world transform.`,
    );
  }
  return deepFreeze({
    occurrenceOrdinal: ordinal,
    printedStepNumber: 42,
    phaseSequence: 68,
    phaseMemberOrdinal: actionMember.phaseMemberOrdinal,
    builderBrickRef: actionMember.builderBrickRef,
    partIdentity: {
      officialDesignId: actionMember.officialDesignId,
      officialDesignRevision: actionMember.designRevision,
      publishedCatalogPartId: row.publishedCatalogPartId,
      reconciledCatalogPartId: row.catalogPartId,
      sourceLDrawPartId: exactLdrawRoot(row.ldrawFilename, ordinal, "source"),
      catalogLDrawPartId: exactLdrawRoot(row.catalogLdrawFilename, ordinal, "catalog"),
      basis: "published-exact",
    },
    sourceWorldProposal,
    catalogFrameEvidence,
    catalogWorldTransform: recomputedCatalogWorldTransform,
  });
}

function createStep42SourceGeometryReceipt(inspections, selectedRows) {
  const verifierManifest = verifyStep42SourceGeometryVerifierManifest();
  const actionBinding = exactStep42ActionBinding(inspections.action);
  const step = inspections.action.artifact.steps[41];
  const phase = step.phases[0];
  const rowsByOrdinal = new Map(selectedRows.map((row) => [row.sourceBuilderIdentityOrdinal, row]));
  const rows = phase.members.map((member) => {
    const row = rowsByOrdinal.get(member.sourceBuilderIdentityOrdinal);
    const callout = step.callouts.find(({ identity }) => identity === member.calloutIdentity);
    return exactStep42Row(row, member, phase, callout);
  });
  if (
    rows.length !== 3 ||
    !isDeepStrictEqual(
      rows.map(({ occurrenceOrdinal }) => occurrenceOrdinal),
      STEP42_ORDINALS,
    )
  ) {
    throw new TypeError("Step-42 source geometry must close exact occurrence ordinals 274..276.");
  }
  const sourceModuleDigest = sha256Digest(
    readFileSync(
      new URL("./part-identification-prefix50-verified-projection-step42.mjs", import.meta.url),
    ),
  );
  const semanticGeometry = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-semantic-geometry/1",
    sourceSetId: actionBinding.sourceSetId,
    printedStepNumber: actionBinding.printedStepNumber,
    phaseSequence: actionBinding.phaseSequence,
    phaseId: actionBinding.phaseId,
    calloutIdentity: actionBinding.callout.identity,
    members: actionBinding.members.map((member, index) => ({
      occurrenceOrdinal: member.occurrenceOrdinal,
      phaseMemberOrdinal: member.phaseMemberOrdinal,
      builderBrickRef: member.builderBrickRef,
      officialDesignId: member.officialDesignId,
      designRevision: member.designRevision,
      catalogPartId: rows[index].partIdentity.reconciledCatalogPartId,
      catalogWorldTransform: rows[index].catalogWorldTransform,
    })),
  });
  const semanticGeometryCommitment = step42SourceGeometryStableDigest(semanticGeometry);
  const admittedBinding = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-source-geometry-binding/4",
    authority: "exact-step42-action-and-projection-binding",
    sourceSetId: actionBinding.sourceSetId,
    sourcePdfDigest: actionBinding.sourcePdfDigest,
    sourceModuleDigest,
    verifierManifestCommitment: STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST_COMMITMENT,
    semanticGeometryCommitment,
    actionPreparationDigest: actionBinding.actionPreparationDigest,
    officialModelPhaseDigest: actionBinding.officialModelPhaseDigest,
    stepActionDigest: actionBinding.stepActionDigest,
    phaseSourceDigest: actionBinding.phaseSourceDigest,
    independentCatalogOrientationTruth: {
      schemaVersion: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.schemaVersion,
      transformPolicyVersion: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.transformPolicyVersion,
      rosterDigest: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.rosterDigest,
      algebraControlCommitment: INDEPENDENT_TRANSFORM_CONTROL_COMMITMENT,
      compositionLaw: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.compositionLaw,
    },
    printedStepNumber: actionBinding.printedStepNumber,
    phaseSequence: actionBinding.phaseSequence,
    phaseKind: actionBinding.phaseKind,
    phaseId: actionBinding.phaseId,
    stepUuid: actionBinding.stepUuid,
    subBuildPath: [...actionBinding.subBuildPath],
    callout: actionBinding.callout,
    members: actionBinding.members.map((member, index) => ({
      ...member,
      catalogPartId: rows[index].partIdentity.reconciledCatalogPartId,
      catalogWorldTransform: rows[index].catalogWorldTransform,
    })),
  });
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-source-geometry-admission/2",
    authority: "offline-opaque-source-geometry-diagnostic",
    sourceSetId: actionBinding.sourceSetId,
    actionPreparationDigest: inspections.action.digest,
    officialWorldReconciliationDigest: inspections.reconciliation.digest,
    occurrenceCommitment: exactCommitment(
      inspections.reconciliation.artifact.occurrenceCommitment,
      "Step-42 source geometry occurrence commitment",
    ),
    worldTransformCommitment: exactCommitment(
      inspections.reconciliation.artifact.worldTransformCommitment,
      "Step-42 source geometry world-transform commitment",
    ),
    verifierManifest,
    verifierManifestCommitment: STEP42_SOURCE_GEOMETRY_VERIFIER_MANIFEST_COMMITMENT,
    semanticGeometryCommitment,
    independentCatalogOrientationTruth: {
      schemaVersion: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.schemaVersion,
      transformPolicyVersion: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.transformPolicyVersion,
      rosterDigest: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.rosterDigest,
      algebraControlCommitment: INDEPENDENT_TRANSFORM_CONTROL_COMMITMENT,
      compositionLaw: INDEPENDENT_CATALOG_ORIENTATION_TRUTH.compositionLaw,
    },
    admittedBinding,
    admittedBindingCommitment: step42SourceGeometryStableDigest(admittedBinding),
    rows,
    authorityLimits: {
      placement: false,
      documentLegality: false,
      acceptance: false,
      completion: false,
    },
  });
  return deepFreeze({
    ...body,
    receiptCommitment: step42SourceGeometryStableDigest(body),
  });
}

function selectedStep42Rows(reconciliationArtifact) {
  if (!Array.isArray(reconciliationArtifact.rows) || reconciliationArtifact.rows.length !== 320) {
    throw new TypeError(
      "Step-42 source geometry requires the exact verified 320-row reconciliation.",
    );
  }
  return STEP42_ORDINALS.map((ordinal) => reconciliationArtifact.rows[ordinal - 1]);
}

export function createOpaqueRealBuildPrefix50Step42SourceGeometryReader(value) {
  const input = snapshotExactDataObject(value, "Step-42 source geometry reader input", [
    "actionPreparationVerified",
    "officialWorldReconciliationVerified",
    "readVerifiedPrefix50Projection",
  ]);
  if (typeof input.readVerifiedPrefix50Projection !== "function") {
    throw new TypeError(
      "Step-42 source geometry reader requires one projection read function; its return value carries no source-geometry authority.",
    );
  }
  const inspections = exactInspections(
    input.actionPreparationVerified,
    input.officialWorldReconciliationVerified,
  );
  const receipt = createStep42SourceGeometryReceipt(
    inspections,
    selectedStep42Rows(inspections.reconciliation.artifact),
  );
  const reader = Object.freeze({
    readVerifiedPrefix50Projection: input.readVerifiedPrefix50Projection,
  });
  opaqueStep42GeometryByReader.set(reader, {
    actionBinding: exactStep42ActionBinding(inspections.action),
    receipt,
  });
  return reader;
}

function opaqueRecord(value, label) {
  const record =
    typeof value === "object" && value !== null
      ? opaqueStep42GeometryByReader.get(value)
      : undefined;
  if (record === undefined) {
    throw new TypeError(
      `${label} requires the opaque current prefix-50 reader; caller-shaped readers and receipts carry no source-geometry authority.`,
    );
  }
  return record;
}

export function readOpaqueRealBuildPrefix50Step42ActionBinding(value) {
  return opaqueRecord(value, "Step-42 action binding").actionBinding;
}

export function readOpaqueRealBuildPrefix50Step42SourceGeometryReceipt(value) {
  return opaqueRecord(value, "Step-42 source geometry receipt").receipt;
}

function rebuildWithCompositionDriftForTest(value) {
  if (!TEST_MODE) {
    throw new TypeError("Step-42 source geometry drift injection exists only in test mode.");
  }
  const input = snapshotExactDataObject(value, "Step-42 composition-drift test input", [
    "reader",
    "actionPreparationVerified",
    "officialWorldReconciliationVerified",
    "occurrenceOrdinal",
  ]);
  const record = opaqueRecord(input.reader, "Step-42 composition-drift test");
  const inspections = exactInspections(
    input.actionPreparationVerified,
    input.officialWorldReconciliationVerified,
  );
  if (!STEP42_ORDINALS.includes(input.occurrenceOrdinal)) {
    throw new TypeError("Step-42 composition-drift test accepts only ordinals 274..276.");
  }
  const rows = selectedStep42Rows(inspections.reconciliation.artifact).map((row) =>
    JSON.parse(JSON.stringify(row)),
  );
  const row = rows.find(
    ({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal === input.occurrenceOrdinal,
  );
  row.catalogWorldTransform.positionLdu[0] += 1;
  const receipt = createStep42SourceGeometryReceipt(inspections, rows);
  if (record.receipt === receipt) {
    throw new TypeError("Step-42 composition-drift test unexpectedly reused the opaque receipt.");
  }
  return receipt;
}

function requireCatalogOrientationMutationRefusalForTest() {
  if (!TEST_MODE) {
    throw new TypeError("Step-42 catalog orientation mutation exists only in test mode.");
  }
  if (independentTransformLawTestOnly === undefined) {
    throw new TypeError("Step-42 catalog orientation mutation support is unavailable.");
  }
  return independentTransformLawTestOnly.requireCatalogOrientationMutationRefusalForTest();
}

export const __testOnly = TEST_MODE
  ? Object.freeze({
      rebuildWithCompositionDriftForTest,
      requireCatalogOrientationMutationRefusalForTest,
    })
  : undefined;
