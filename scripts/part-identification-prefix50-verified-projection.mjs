import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  bytesFromVerifiedPrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import {
  bytesFromVerifiedPrefix50OfficialWorldReconciliation,
  inspectVerifiedPrefix50OfficialWorldReconciliation,
  isVerifiedPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation.mjs";

const MAXIMUM_ARTIFACT_BYTES = 2 * 1024 * 1024;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const LDRAW_ROOT = /^(\d+[a-z0-9]*)\.dat$/u;
const SET_6651557_SOURCE_PDF_DIGEST =
  "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const EXPECTED_SCOPE = Object.freeze({
  firstPrintedStep: 1,
  lastPrintedStep: 50,
  expectedPrintedSteps: 359,
  sourceIndexPreserved: true,
  suffixStepsReconstructed: false,
});
const EXPECTED_ACTION_ACCOUNTING = Object.freeze({
  printedStepRows: 50,
  partBearingStepRows: 49,
  zeroPieceStepRows: 1,
  calloutRows: 187,
  physicalIdentities: 320,
  builderPhases: 95,
  directPhases: 91,
  copyPhases: 4,
  directIdentities: 309,
  copyIdentities: 11,
  repeatRows: 2,
});
const OCCURRENCE_CORRECTIONS = new Set([139, 147, 178, 183, 185, 190, 191, 192, 193]);
const MOVED_ROOTS = new Set([25, 39]);
const verifiedProjectionReaders = new WeakMap();
const syntheticProjectionReaders = new WeakMap();
const TEST_MODE = typeof process !== "undefined" && process.env?.NODE_ENV === "test";

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

const stableDigest = (value) =>
  sha256Digest(Buffer.from(JSON.stringify(stableJson(value)), "utf8"));

function verifiedRole(value, kind) {
  const label = `Prefix-50 ${kind.label} projection source`;
  const role = snapshotExactDataObject(value, label, ["bytes", "verified"]);
  if (!kind.isVerified(role.verified)) {
    throw new TypeError(
      `${label}.verified must be the opaque independent-verifier result; parsed JSON and caller-shaped lookalikes carry no projection authority.`,
    );
  }
  const suppliedBytes = snapshotBoundedUint8Array(role.bytes, {
    label: `${label}.bytes`,
    minimumBytes: 1,
    maximumBytes: MAXIMUM_ARTIFACT_BYTES,
  });
  const verifiedBytes = kind.bytesFromVerified(role.verified);
  const inspection = kind.inspect(role.verified);
  if (
    !suppliedBytes.equals(verifiedBytes) ||
    suppliedBytes.length !== verifiedBytes.length ||
    sha256Digest(suppliedBytes) !== inspection.digest
  ) {
    throw new TypeError(
      `${label}.bytes must exactly equal the fresh bytes bound to its opaque verifier result.`,
    );
  }
  return Object.freeze({ bytes: suppliedBytes, inspection, verified: role.verified });
}

function actionProjection(actionRole) {
  const { artifact, digest } = actionRole.inspection;
  if (
    artifact.schemaVersion !== "lego.real-build-action-preparation/1" ||
    !isDeepStrictEqual(artifact.scope, EXPECTED_SCOPE) ||
    !isDeepStrictEqual(artifact.accounting, EXPECTED_ACTION_ACCOUNTING) ||
    !Array.isArray(artifact.steps) ||
    artifact.steps.length !== 50 ||
    artifact.sourceIndex?.prefixPartArtPieces !== 320 ||
    artifact.sourceIndex?.expectedPrintedSteps !== 359 ||
    artifact.sourceIndex?.suffixStepsReconstructed !== false ||
    artifact.inputs?.sourcePdfDigest !== SET_6651557_SOURCE_PDF_DIGEST
  ) {
    throw new TypeError(
      "Opaque action preparation does not retain the exact 1..50/320 prefix and 359-step index boundary.",
    );
  }
  const occurrences = new Map();
  const steps = [];
  let cursor = 0;
  for (const [index, step] of artifact.steps.entries()) {
    const stepNumber = index + 1;
    const callouts = new Map(step.callouts?.map((callout) => [callout.identity, callout]));
    const phaseOrdinals = [];
    if (
      step.stepNumber !== stepNumber ||
      step.printedPieceCursorBefore !== cursor ||
      step.printedPieceCursorAfter !== cursor + step.printedPieces ||
      !Array.isArray(step.sourceBuilderIdentityOrdinals) ||
      !Array.isArray(step.phaseSequences) ||
      !Array.isArray(step.phases) ||
      callouts.size !== step.callouts?.length
    ) {
      throw new TypeError(`Opaque action preparation printed step ${stepNumber} is not exact.`);
    }
    for (const phase of step.phases) {
      if (
        (phase.kind !== "direct" && phase.kind !== "multi-build-copy") ||
        !step.phaseSequences.includes(phase.sequence) ||
        !Array.isArray(phase.members)
      ) {
        throw new TypeError(`Opaque action preparation step ${stepNumber} has an invalid phase.`);
      }
      for (const member of phase.members) {
        const callout = callouts.get(member.calloutIdentity);
        const ordinal = member.sourceBuilderIdentityOrdinal;
        if (
          !Number.isSafeInteger(ordinal) ||
          ordinal < 1 ||
          ordinal > 320 ||
          occurrences.has(ordinal) ||
          callout === undefined ||
          callout.officialDesignId !== member.officialDesignId
        ) {
          throw new TypeError(
            `Opaque action preparation occurrence ${String(ordinal)} has no unique exact callout/member basis.`,
          );
        }
        phaseOrdinals.push(ordinal);
        occurrences.set(
          ordinal,
          Object.freeze({
            actionKind: phase.kind,
            builderBrickRef: member.builderBrickRef,
            calloutIdentity: member.calloutIdentity,
            catalogColorId: callout.publishedColorId,
            designRevision: member.designRevision,
            masterSubBuildRef: phase.kind === "multi-build-copy" ? phase.masterSubBuildRef : null,
            officialDesignId: member.officialDesignId,
            phaseSequence: phase.sequence,
            publishedCatalogPartId: callout.catalogPartId,
            sourceBuilderBrickRef:
              phase.kind === "multi-build-copy" ? member.sourceBuilderBrickRef : null,
            stepNumber,
          }),
        );
      }
    }
    if (
      !isDeepStrictEqual(phaseOrdinals, step.sourceBuilderIdentityOrdinals) ||
      phaseOrdinals.length !== step.printedPieces ||
      (stepNumber === 44 ? step.printedPieces !== 0 : step.printedPieces < 1)
    ) {
      throw new TypeError(
        `Opaque action preparation step ${stepNumber} does not retain its exact printed occurrence row.`,
      );
    }
    steps.push(
      deepFreeze({
        printedStepNumber: stepNumber,
        name: `Printed step ${stepNumber}`,
        sourceActionDigest: stableDigest({
          schemaVersion: "lego.real-build-prefix50-source-action/1",
          step,
        }),
      }),
    );
    cursor = step.printedPieceCursorAfter;
  }
  if (
    cursor !== 320 ||
    occurrences.size !== 320 ||
    [...occurrences.keys()].sort((a, b) => a - b).some((ordinal, index) => ordinal !== index + 1)
  ) {
    throw new TypeError("Opaque action preparation does not close exact ordinals 1..320.");
  }
  return Object.freeze({ digest, occurrences, schemaVersion: artifact.schemaVersion, steps });
}

function exactWorldTransform(value, ordinal) {
  if (
    value === null ||
    typeof value !== "object" ||
    !Array.isArray(value.positionLdu) ||
    value.positionLdu.length !== 3 ||
    !value.positionLdu.every(
      (coordinate) =>
        typeof coordinate === "number" &&
        Number.isFinite(coordinate) &&
        Number.isSafeInteger(coordinate * 2),
    ) ||
    typeof value.orientationId !== "string"
  ) {
    throw new TypeError(
      `Opaque reconciliation occurrence ${ordinal} has no bounded exact integer/half-LDU catalog-world transform.`,
    );
  }
  return deepFreeze({
    positionLdu: [...value.positionLdu],
    orientationId: value.orientationId,
  });
}

function ldrawPartId(filename, ordinal, role) {
  const match = typeof filename === "string" ? LDRAW_ROOT.exec(filename) : null;
  if (match === null) {
    throw new TypeError(
      `Opaque reconciliation occurrence ${ordinal} has invalid ${role} LDraw root ${JSON.stringify(filename)}.`,
    );
  }
  return match[1];
}

function partIdentity(row, action, ordinal) {
  const binding = row.catalogBinding;
  const sourceLDrawPartId = ldrawPartId(row.ldrawFilename, ordinal, "source");
  const catalogLDrawPartId = ldrawPartId(row.catalogLdrawFilename, ordinal, "catalog");
  const published = row.publishedCatalogPartId;
  const reconciled = row.catalogPartId;
  if (
    binding?.sourceBuilderIdentityOrdinal !== ordinal ||
    binding.stepNumber !== row.stepNumber ||
    binding.phaseSequence !== row.phaseSequence ||
    binding.builderBrickRef !== row.builderBrickRef ||
    binding.calloutIdentity !== row.calloutIdentity ||
    binding.designRevision !== row.designRevision ||
    binding.publishedCatalogPartId !== published ||
    binding.catalogPartId !== reconciled ||
    binding.ldrawFilename !== row.ldrawFilename ||
    binding.catalogLdrawFilename !== row.catalogLdrawFilename
  ) {
    throw new TypeError(
      `Opaque reconciliation occurrence ${ordinal} does not retain its full occurrence-bound catalog commitment.`,
    );
  }
  let basis;
  let identityProofId = null;
  if (binding?.bindingKind === "published-catalog-part") {
    basis = "published-exact";
    if (
      binding.occurrenceScoped !== false ||
      binding.identityBasis !== "published-catalog-part-with-closed-identity-relation" ||
      binding.priorQuarantineBasis !== null ||
      binding.movedRootProofId !== null ||
      published !== reconciled ||
      row.catalogIdentityProof !== null
    ) {
      throw new TypeError(
        `Opaque reconciliation occurrence ${ordinal} widens a published identity.`,
      );
    }
  } else if (binding?.bindingKind === "resolved-catalog-part-correction") {
    basis = "official-member-revision";
    if (
      binding.occurrenceScoped !== true ||
      binding.identityBasis !== "exact-source-root-after-reviewed-catalog-part-correction" ||
      typeof binding.priorQuarantineBasis !== "string" ||
      binding.movedRootProofId !== null ||
      !OCCURRENCE_CORRECTIONS.has(ordinal) ||
      published === reconciled ||
      sourceLDrawPartId !== catalogLDrawPartId ||
      row.catalogIdentityProof !== null
    ) {
      throw new TypeError(
        `Opaque reconciliation occurrence ${ordinal} loses its member correction.`,
      );
    }
  } else if (binding?.bindingKind === "identity-moved-root") {
    basis = "official-archive-identity-moved-root";
    identityProofId = binding.movedRootProofId;
    const proof = row.catalogIdentityProof;
    if (
      binding.occurrenceScoped !== true ||
      binding.identityBasis !== "official-archive-identity-moved-root-same-hand" ||
      typeof binding.priorQuarantineBasis !== "string" ||
      !MOVED_ROOTS.has(ordinal) ||
      published !== reconciled ||
      sourceLDrawPartId === catalogLDrawPartId ||
      identityProofId !== `${row.ldrawFilename}->${row.catalogLdrawFilename}` ||
      proof?.proofKind !== "official-archive-one-hop-identity-moved-root" ||
      proof.proofId !== identityProofId ||
      proof.sameExpandedGeometry !== true ||
      proof.globalAliasClaimed !== false
    ) {
      throw new TypeError(
        `Opaque reconciliation occurrence ${ordinal} loses its moved-root proof.`,
      );
    }
  } else {
    throw new TypeError(
      `Opaque reconciliation occurrence ${ordinal} has unsupported binding ${JSON.stringify(binding?.bindingKind)}.`,
    );
  }
  return deepFreeze({
    publishedCatalogPartId: published,
    reconciledCatalogPartId: reconciled,
    officialDesignId: action.officialDesignId,
    officialDesignRevision: row.designRevision,
    sourceLDrawPartId,
    catalogLDrawPartId,
    identityProofId,
    basis,
  });
}

function reconciliationProjection(reconciliationRole, actionRole, action) {
  const { artifact, digest } = reconciliationRole.inspection;
  const expectedActionInput = {
    schemaVersion: action.schemaVersion,
    bytes: actionRole.bytes.length,
    digest: action.digest,
  };
  const scopedBindings = { corrections: 0, movedRoots: 0 };
  if (
    artifact.schemaVersion !== "lego.prefix50-official-world-reconciliation/2" ||
    artifact.inputs?.catalogVersion !== "builtin.basic-parts/29" ||
    !isDeepStrictEqual(
      {
        firstPrintedStep: artifact.scope?.firstPrintedStep,
        lastPrintedStep: artifact.scope?.lastPrintedStep,
        expectedPrintedSteps: artifact.scope?.expectedPrintedSteps,
        sourceIndexPreserved: artifact.scope?.sourceIndexPreserved,
        suffixStepsReconstructed: artifact.scope?.suffixStepsReconstructed,
      },
      EXPECTED_SCOPE,
    ) ||
    !isDeepStrictEqual(artifact.inputs?.actionPreparation, expectedActionInput) ||
    artifact.accounting?.occurrenceRows !== 320 ||
    artifact.accounting?.reconciledRows !== 320 ||
    artifact.accounting?.quarantinedRows !== 0 ||
    artifact.occurrenceCommitment?.rowCount !== 320 ||
    artifact.worldTransformCommitment?.rowCount !== 320 ||
    !SHA256.test(artifact.occurrenceCommitment?.digest) ||
    !SHA256.test(artifact.worldTransformCommitment?.digest) ||
    !Array.isArray(artifact.rows) ||
    artifact.rows.length !== 320
  ) {
    throw new TypeError(
      "Opaque official-world reconciliation does not retain its exact action commitment and 1..50/320 closed scope.",
    );
  }
  const occurrences = artifact.rows.map((row, index) => {
    const ordinal = index + 1;
    const source = action.occurrences.get(ordinal);
    if (
      source === undefined ||
      row.sourceBuilderIdentityOrdinal !== ordinal ||
      row.stepNumber !== source.stepNumber ||
      row.phaseSequence !== source.phaseSequence ||
      row.actionKind !== source.actionKind ||
      row.builderBrickRef !== source.builderBrickRef ||
      row.sourceBuilderBrickRef !== source.sourceBuilderBrickRef ||
      row.masterSubBuildRef !== source.masterSubBuildRef ||
      row.calloutIdentity !== source.calloutIdentity ||
      row.designRevision !== source.designRevision ||
      row.publishedCatalogPartId !== source.publishedCatalogPartId ||
      row.catalogColorId !== source.catalogColorId ||
      row.status !== "reconciled" ||
      row.quarantineBasis !== null ||
      row.frameApplied !== true ||
      row.catalogFrameEvidence === null ||
      row.documentLegalityClaimed !== false
    ) {
      throw new TypeError(
        `Opaque official-world occurrence ${ordinal} contradicts its exact action/member commitment.`,
      );
    }
    if (row.catalogBinding?.bindingKind === "resolved-catalog-part-correction") {
      scopedBindings.corrections += 1;
    } else if (row.catalogBinding?.bindingKind === "identity-moved-root") {
      scopedBindings.movedRoots += 1;
    }
    return deepFreeze({
      ordinal,
      printedStepNumber: row.stepNumber,
      colorId: row.catalogColorId,
      partIdentity: partIdentity(row, source, ordinal),
      sourceWorldTransform: exactWorldTransform(row.catalogWorldTransform, ordinal),
    });
  });
  if (scopedBindings.corrections !== 9 || scopedBindings.movedRoots !== 2) {
    throw new TypeError(
      `Opaque reconciliation must retain nine member corrections and two moved roots; received ${scopedBindings.corrections}/${scopedBindings.movedRoots}.`,
    );
  }
  return Object.freeze({
    digest,
    occurrenceCommitment: artifact.occurrenceCommitment,
    occurrences,
    worldTransformCommitment: artifact.worldTransformCommitment,
  });
}

export function createRealBuildPrefix50VerifiedProjectionReader(value) {
  const input = snapshotExactDataObject(value, "Prefix-50 verified-projection adapter input", [
    "actionPreparation",
    "officialWorldReconciliation",
  ]);
  const actionRole = verifiedRole(input.actionPreparation, {
    label: "action-preparation",
    isVerified: isVerifiedPrefix50ActionPreparation,
    bytesFromVerified: bytesFromVerifiedPrefix50ActionPreparation,
    inspect: inspectVerifiedPrefix50ActionPreparation,
  });
  const reconciliationRole = verifiedRole(input.officialWorldReconciliation, {
    label: "official-world-reconciliation",
    isVerified: isVerifiedPrefix50OfficialWorldReconciliation,
    bytesFromVerified: bytesFromVerifiedPrefix50OfficialWorldReconciliation,
    inspect: inspectVerifiedPrefix50OfficialWorldReconciliation,
  });
  const action = actionProjection(actionRole);
  const reconciliation = reconciliationProjection(reconciliationRole, actionRole, action);
  const sourceArtifactDigest = stableDigest({
    schemaVersion: "lego.real-build-prefix50-verified-source-commitment/1",
    actionPreparationDigest: action.digest,
    officialWorldReconciliationDigest: reconciliation.digest,
    occurrenceCommitment: reconciliation.occurrenceCommitment,
    worldTransformCommitment: reconciliation.worldTransformCommitment,
  });
  const projection = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-verified-projection/1",
    sourceSetId: "6651557",
    sourceArtifactDigest,
    steps: action.steps,
    occurrences: reconciliation.occurrences,
  });
  const readVerifiedPrefix50Projection = Object.freeze(() => projection);
  const reader = Object.freeze({ readVerifiedPrefix50Projection });
  const occurrence30 = action.occurrences.get(30);
  if (
    occurrence30?.stepNumber !== 14 ||
    occurrence30.phaseSequence !== 18 ||
    occurrence30.actionKind !== "direct" ||
    occurrence30.calloutIdentity !== "p18|q1|x29.480|y468.911" ||
    occurrence30.builderBrickRef !== "40304bdc-7c5b-46cf-bdcc-61a53aeae2c4" ||
    occurrence30.officialDesignId !== "77844" ||
    occurrence30.designRevision !== "77844;B"
  ) {
    throw new TypeError(
      "Opaque action preparation occurrence 30 no longer retains its exact step-14 direct phase, callout, Brick, and 77844;B identity.",
    );
  }
  const occurrence30ActionBinding = deepFreeze({
    occurrenceOrdinal: 30,
    printedStepNumber: occurrence30.stepNumber,
    phaseSequence: occurrence30.phaseSequence,
    actionKind: occurrence30.actionKind,
    calloutIdentity: occurrence30.calloutIdentity,
    builderBrickRef: occurrence30.builderBrickRef,
    officialDesignId: occurrence30.officialDesignId,
    designRevision: occurrence30.designRevision,
  });
  verifiedProjectionReaders.set(reader, { occurrence30ActionBinding, projection });
  return reader;
}

export function readOpaqueRealBuildPrefix50VerifiedProjection(value) {
  const record =
    typeof value === "object" && value !== null ? verifiedProjectionReaders.get(value) : undefined;
  if (record === undefined) {
    throw new TypeError(
      "Prefix-50 exact compilation requires a reader minted from the opaque current action and official-world verifiers; frozen caller lookalikes carry no placement authority.",
    );
  }
  return record.projection;
}

export function readOpaqueRealBuildPrefix50Occurrence30ActionBinding(value) {
  const record =
    typeof value === "object" && value !== null ? verifiedProjectionReaders.get(value) : undefined;
  if (record === undefined) {
    throw new TypeError(
      "Occurrence-30 action binding requires the opaque current prefix-50 projection reader; caller-shaped action rows carry no repair authority.",
    );
  }
  return record.occurrence30ActionBinding;
}

export function readSyntheticRealBuildPrefix50ProjectionForTest(value) {
  if (!TEST_MODE) {
    throw new TypeError("Synthetic prefix-50 projection readers exist only in the test runtime.");
  }
  const projection =
    typeof value === "object" && value !== null ? syntheticProjectionReaders.get(value) : undefined;
  if (projection === undefined) {
    throw new TypeError(
      "Synthetic prefix-50 diagnostic compilation requires its dedicated test-only reader.",
    );
  }
  return projection;
}

function createSyntheticProjectionReaderForTest(projection) {
  if (!TEST_MODE) {
    throw new TypeError("Synthetic prefix-50 projection readers exist only in the test runtime.");
  }
  const readVerifiedPrefix50Projection = Object.freeze(() => projection);
  const reader = Object.freeze({ readVerifiedPrefix50Projection });
  syntheticProjectionReaders.set(reader, projection);
  return reader;
}

export const __testOnly = Object.freeze({ createSyntheticProjectionReaderForTest });
