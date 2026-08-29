import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  bytesFromVerifiedPrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
import {
  parsePrefix50OfficialLdraw,
  parsePrefix50OfficialXml,
  reconcilePrefix50OfficialXmlLdraw,
} from "./part-identification-prefix50-official-ldraw-world-proposal-parser.mjs";
import {
  catalogFrame,
  catalogWorldProposal,
  connectorSeatProposals,
  identityRelation,
} from "./part-identification-prefix50-official-ldraw-world-proposal-catalog.mjs";
import {
  snapPrefix50HalfLduPosition,
  snapPrefix50ProperWorldOrientation,
} from "./part-identification-prefix50-official-ldraw-world-proposal-math.mjs";
import {
  PREFIX50_OFFICIAL_LDRAW_RETIRED_QUARANTINES,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_AUTHORITY,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_SCHEMA,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";
import {
  assertPrefix50OccurrenceCatalogBindings,
  closePrefix50OccurrenceCatalogBinding,
  resolvePrefix50OccurrenceCatalogBinding,
} from "./part-identification-prefix50-official-ldraw-world-proposal-occurrence.mjs";

const COMPILE_KEYS = ["actionPreparation", "officialLdrawBytes", "officialXmlBytes"];
const VERIFY_KEYS = [...COMPILE_KEYS, "artifactBytes"].sort();
const CATALOG_URL = new URL("../packages/catalog/src/index.ts", import.meta.url).href;

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPrefix50ActionPreparation(roles.actionPreparation)) {
    throw new TypeError(
      `${label}.actionPreparation must be the opaque current action-preparation verifier result. Parsed JSON and caller-shaped lookalikes carry no proposal authority.`,
    );
  }
  return {
    actionPreparation: roles.actionPreparation,
    officialLdrawBytes: snapshotBoundedUint8Array(roles.officialLdrawBytes, {
      label: "Official LDraw bytes",
      minimumBytes: 1,
      maximumBytes: 256 * 1024,
    }),
    officialXmlBytes: snapshotBoundedUint8Array(roles.officialXmlBytes, {
      label: "Official XML bytes",
      minimumBytes: 1,
      maximumBytes: 2 * 1024 * 1024,
    }),
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: snapshotBoundedUint8Array(roles.artifactBytes, {
            label: "Official XML/LDraw proposal artifact bytes",
            minimumBytes: 1,
            maximumBytes: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
          }),
        }
      : {}),
  };
}

function requirePinnedBytes(bytes, pin, label) {
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new TypeError(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  return digest;
}

async function compileSnapshot(input) {
  const pins = PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS;
  const xmlDigest = requirePinnedBytes(input.officialXmlBytes, pins.officialXml, "Official XML");
  const ldrawDigest = requirePinnedBytes(
    input.officialLdrawBytes,
    pins.officialLdraw,
    "Official LDraw MPD",
  );
  const actionInspection = inspectVerifiedPrefix50ActionPreparation(input.actionPreparation);
  const actionBytes = bytesFromVerifiedPrefix50ActionPreparation(input.actionPreparation);
  if (
    actionInspection.digest !== pins.actionPreparation.digest ||
    actionBytes.length !== pins.actionPreparation.bytes ||
    actionInspection.artifact.schemaVersion !== pins.actionPreparation.schemaVersion
  ) {
    throw new TypeError("Official XML/LDraw proposal requires the exact current action token.");
  }
  const action = actionInspection.artifact;
  if (action.authority.exactOccurrenceIdentity !== false) {
    throw new TypeError(
      "Official XML/LDraw proposal requires action preparation to disclaim exact occurrence identity; the proposal must establish that identity from its independent XML/LDraw correspondence.",
    );
  }
  if (
    action.scope.expectedPrintedSteps !== 359 ||
    action.scope.lastPrintedStep !== 50 ||
    action.scope.suffixStepsReconstructed !== false ||
    action.sourceIndex.calloutRows !== 881 ||
    action.sourceIndex.partArtRows !== 859 ||
    action.sourceIndex.suffixPartArtRows !== 672
  ) {
    throw new TypeError(
      "Official XML/LDraw proposal did not retain the full 359-step source/index scope.",
    );
  }
  const xmlBricks = parsePrefix50OfficialXml(input.officialXmlBytes);
  const ldraw = parsePrefix50OfficialLdraw(input.officialLdrawBytes);
  const reconciliation = reconcilePrefix50OfficialXmlLdraw(xmlBricks, ldraw);
  const catalog = await importRepositoryTypeScript(CATALOG_URL);
  if (catalog.BUILTIN_CATALOG_VERSION !== pins.catalogVersion) {
    throw new TypeError(
      `Official XML/LDraw proposal requires catalog ${pins.catalogVersion}; received ${catalog.BUILTIN_CATALOG_VERSION}.`,
    );
  }
  const properOrientations = catalog.PROPER_ORIENTATIONS.map(({ id, matrix }) => ({
    id,
    matrix: [...matrix],
  }));
  const orientationById = new Map(properOrientations.map((row) => [row.id, row]));
  const colorByCode = new Map(catalog.COLOR_DEFINITIONS.map((color) => [color.ldrawCode, color]));
  const rows = [];
  let maximumWorldOrientationResidual = 0;
  let maximumWorldPositionResidualLdu = 0;
  let maximumCatalogOrientationResidual = 0;
  let maximumCatalogPositionResidualLdu = 0;
  for (const step of action.steps) {
    const calloutByIdentity = new Map(step.callouts.map((callout) => [callout.identity, callout]));
    for (const phase of step.phases) {
      for (const member of phase.members) {
        const leaf = reconciliation.leafByBrickRef.get(member.builderBrickRef);
        const callout = calloutByIdentity.get(member.calloutIdentity);
        if (
          leaf === undefined ||
          callout === undefined ||
          leaf.designRevision !== member.designRevision ||
          leaf.xmlPartRow !== 1
        ) {
          throw new TypeError(
            `Action ordinal ${member.sourceBuilderIdentityOrdinal} does not bind one exact XML/LDraw leaf.`,
          );
        }
        const openBinding = resolvePrefix50OccurrenceCatalogBinding({
          stepNumber: step.stepNumber,
          phaseSequence: phase.sequence,
          member,
          callout,
          leaf,
        });
        const definition = catalog.getPartDefinition(openBinding.catalogPartId);
        const color = catalog.getColorDefinition(callout.publishedColorId);
        if (definition === undefined || color === undefined) {
          throw new TypeError(
            `Action ordinal ${member.sourceBuilderIdentityOrdinal} names an absent catalog part or color.`,
          );
        }
        const ldrawColor = colorByCode.get(leaf.ldrawColorCode) ?? null;
        const frame = catalogFrame(definition, orientationById);
        const binding = closePrefix50OccurrenceCatalogBinding(
          openBinding,
          frame.catalogLdrawFilename,
        );
        const relation = identityRelation(leaf, frame, binding);
        const sourceOrientation = snapPrefix50ProperWorldOrientation(
          leaf.ldrawWorldMatrix,
          properOrientations,
        );
        const sourcePosition = snapPrefix50HalfLduPosition(leaf.ldrawWorldPositionLdu);
        maximumWorldOrientationResidual = Math.max(
          maximumWorldOrientationResidual,
          sourceOrientation.residual,
        );
        maximumWorldPositionResidualLdu = Math.max(
          maximumWorldPositionResidualLdu,
          sourcePosition.residual,
        );
        const proposed =
          relation.state === "projectable"
            ? catalogWorldProposal(leaf, frame, properOrientations, orientationById)
            : null;
        if (proposed !== null) {
          maximumCatalogOrientationResidual = Math.max(
            maximumCatalogOrientationResidual,
            proposed.orientationResidual,
          );
          maximumCatalogPositionResidualLdu = Math.max(
            maximumCatalogPositionResidualLdu,
            proposed.positionResidualLdu,
          );
        }
        rows.push(
          Object.freeze({
            stepNumber: step.stepNumber,
            phaseSequence: phase.sequence,
            sourceBuilderIdentityOrdinal: member.sourceBuilderIdentityOrdinal,
            builderBrickRef: member.builderBrickRef,
            calloutIdentity: member.calloutIdentity,
            designRevision: member.designRevision,
            publishedCatalogPartId: callout.catalogPartId,
            catalogPartId: binding.catalogPartId,
            catalogColorId: callout.publishedColorId,
            ldrawCatalogColorId: ldrawColor?.id ?? null,
            semanticColorMatchesLdraw: ldrawColor === null ? null : color.id === ldrawColor.id,
            xmlRow: leaf.xmlRow,
            topLevelLdrawRow: leaf.topLevelLdrawRow,
            ldrawFilename: leaf.ldrawFilename,
            ldrawColorCode: leaf.ldrawColorCode,
            catalogFrame: frame,
            catalogBinding: binding,
            identityRelation: relation,
            sourceWorldProposal: Object.freeze({
              orientationId: sourceOrientation.orientationId,
              positionLdu: sourcePosition.positionLdu,
              orientationResidual: sourceOrientation.residual,
              positionResidualLdu: sourcePosition.residual,
            }),
            catalogWorldProposal: proposed,
            catalogConnectorSeatProposals: connectorSeatProposals(
              definition,
              proposed,
              orientationById,
            ),
            documentLegalityClaimed: false,
          }),
        );
      }
    }
  }
  const ordinals = [...rows]
    .map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal)
    .sort((left, right) => left - right);
  if (
    rows.length !== 320 ||
    !isDeepStrictEqual(
      ordinals,
      Array.from({ length: 320 }, (_, index) => index + 1),
    ) ||
    new Set(rows.map(({ builderBrickRef }) => builderBrickRef)).size !== 320
  ) {
    throw new TypeError(
      "Official XML/LDraw proposal requires exactly the 320 unique prefix action rows.",
    );
  }
  assertPrefix50OccurrenceCatalogBindings(rows);
  const resolvedPriorQuarantines = PREFIX50_OFFICIAL_LDRAW_RETIRED_QUARANTINES.map((expected) => ({
    ...expected,
    count: rows.filter(
      (row) =>
        row.designRevision === expected.designRevision &&
        row.ldrawFilename === expected.ldrawFilename &&
        row.catalogBinding.priorQuarantineBasis === expected.reason,
    ).length,
  }));
  if (!isDeepStrictEqual(resolvedPriorQuarantines, PREFIX50_OFFICIAL_LDRAW_RETIRED_QUARANTINES)) {
    throw new TypeError(
      `Official XML/LDraw resolved quarantine counterevidence drifted: ${JSON.stringify(resolvedPriorQuarantines)}.`,
    );
  }
  const accounting = {
    xmlBrickRows: xmlBricks.length,
    topLevelLdrawRows: ldraw.top.length,
    compositeXmlRow: 1_440,
    compositeTopLevelLdrawRow: 1_465,
    compositeLeafRows: ldraw.composite.length,
    flattenedLeafRows: reconciliation.leaves.length,
    identityGroups: reconciliation.localTransformGroups.length,
    colorBindings: reconciliation.colorBindings.length,
    actionRows: rows.length,
    projectableActionRows: rows.filter(
      ({ identityRelation }) => identityRelation.state === "projectable",
    ).length,
    quarantinedActionRows: rows.filter(
      ({ identityRelation }) => identityRelation.state === "quarantined",
    ).length,
    properSourceWorldRows: rows.filter(({ sourceWorldProposal }) => sourceWorldProposal !== null)
      .length,
    properCatalogWorldRows: rows.filter(({ catalogWorldProposal }) => catalogWorldProposal !== null)
      .length,
    halfLduSourceWorldRows: rows.filter(({ sourceWorldProposal }) =>
      sourceWorldProposal.positionLdu.some((coordinate) => !Number.isInteger(coordinate)),
    ).length,
    semanticColorMatches: rows.filter(
      ({ semanticColorMatchesLdraw }) => semanticColorMatchesLdraw === true,
    ).length,
    ldrawColorsWithoutCatalogMapping: rows.filter(
      ({ semanticColorMatchesLdraw }) => semanticColorMatchesLdraw === null,
    ).length,
    semanticColorContradictions: rows.filter(
      ({ semanticColorMatchesLdraw }) => semanticColorMatchesLdraw === false,
    ).length,
  };
  if (!isDeepStrictEqual(accounting, pins.expectedAccounting)) {
    throw new TypeError(
      `Official XML/LDraw proposal accounting drifted: ${JSON.stringify(accounting)}.`,
    );
  }
  return {
    schemaVersion: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_SCHEMA,
    authority: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_AUTHORITY,
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixStepsReconstructed: false,
    },
    inputs: {
      actionPreparation: {
        schemaVersion: action.schemaVersion,
        bytes: actionBytes.length,
        digest: actionInspection.digest,
      },
      officialXml: { bytes: input.officialXmlBytes.length, digest: xmlDigest },
      officialLdraw: { bytes: input.officialLdrawBytes.length, digest: ldrawDigest },
      catalogVersion: catalog.BUILTIN_CATALOG_VERSION,
      publishedCatalogDigest: action.inputs.catalogDigest,
      properOrientationRegistryDigest: sha256Digest(
        Buffer.from(JSON.stringify(properOrientations)),
      ),
    },
    sourceIndex: action.sourceIndex,
    accounting,
    permutation: {
      identityXmlRows: [1, 1_439],
      compositeXmlRow: 1_440,
      compositeTopLevelLdrawRow: 1_465,
      shiftedXmlRows: [1_441, 1_465],
      shiftedTopLevelLdrawRows: [1_440, 1_464],
    },
    colorBindings: reconciliation.colorBindings,
    exactIdentityAliases: reconciliation.exactIdentityAliases,
    localTransformGroups: reconciliation.localTransformGroups,
    quarantines: [],
    resolvedPriorQuarantines,
    measurements: {
      ...reconciliation.measurements,
      maximumWorldOrientationResidual,
      maximumWorldPositionResidualLdu,
      maximumCatalogOrientationResidual,
      maximumCatalogPositionResidualLdu,
    },
    rows,
  };
}

export const encodePrefix50OfficialLdrawWorldProposal = (artifact) =>
  Buffer.from(`${JSON.stringify(artifact, null, 1)}\n`);

export async function compilePrefix50OfficialLdrawWorldProposal(input) {
  const snapshot = snapshotInput(
    input,
    COMPILE_KEYS,
    "Official XML/LDraw world-proposal compiler input",
  );
  await Promise.resolve();
  return compileSnapshot(snapshot);
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPrefix50OfficialLdrawWorldProposal(input) {
  const snapshot = snapshotInput(
    input,
    VERIFY_KEYS,
    "Official XML/LDraw world-proposal verifier input",
  );
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(
    snapshot.artifactBytes,
    "Official XML/LDraw world proposal",
  );
  const expected = await compileSnapshot(snapshot);
  const expectedBytes = encodePrefix50OfficialLdrawWorldProposal(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  const pin = PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.expectedArtifact;
  if (pin === null) {
    throw new TypeError(
      `Official XML/LDraw world proposal reproduced ${expectedBytes.length} bytes at ${expectedDigest}, but no reviewed artifact pin is installed.`,
    );
  }
  if (pin.bytes !== expectedBytes.length || pin.digest !== expectedDigest) {
    throw new TypeError(
      `Official XML/LDraw world proposal reproduced ${expectedBytes.length} bytes at ${expectedDigest}, not its reviewed ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  if (!supplied.bytes.equals(expectedBytes)) {
    throw new TypeError(
      "Official XML/LDraw world proposal does not exactly reproduce from current inputs.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest: expectedDigest,
  });
  return verified;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new TypeError(
      "Official XML/LDraw proposal inspection requires its opaque verifier result.",
    );
  }
  return record;
}

export const isVerifiedPrefix50OfficialLdrawWorldProposal = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);
export const inspectVerifiedPrefix50OfficialLdrawWorldProposal = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};
export const bytesFromVerifiedPrefix50OfficialLdrawWorldProposal = (value) =>
  Buffer.from(verifiedRecord(value).bytes);
