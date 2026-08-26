import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedString,
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  authenticateLegacyRecutInputs,
  sha256Digest,
} from "./part-identification-legacy-recut-source.mjs";
import {
  inspectVerifiedPartIdentificationLegacyRecut,
  verifyPartIdentificationLegacyRecut,
} from "./part-identification-legacy-recut.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES,
  assertPinnedSemanticResult,
  classifySemanticRelations,
  deriveOfficialPrefixCut,
} from "./part-identification-legacy-recut-semantic-source.mjs";

export { CURRENT_LEGACY_RECUT_SEMANTIC_PINS } from "./part-identification-legacy-recut-semantic-source.mjs";

export const PART_IDENTIFICATION_LEGACY_RECUT_SEMANTIC_SCHEMA =
  "lego.part-identification-legacy-recut-semantic/1";
export const LEGACY_RECUT_SEMANTIC_MAX_ARTIFACT_BYTES = 256 * 1024;

const COMPILE_INPUT_KEYS = [
  "calloutRoot",
  "currentManifestBytes",
  "legacyManifestBytes",
  "legacyRecutArtifactBytes",
  "officialModelBytes",
  "truthBytes",
];
const VERIFY_INPUT_KEYS = [...COMPILE_INPUT_KEYS, "artifactBytes"].sort();

const SEMANTIC_ROW_KEYS = [
  "comparisonMethod",
  "currentCropSha256",
  "elementId",
  "identity",
  "legacyCropSha256",
  "n",
  "officialDesignId",
  "officialStepElementQuantity",
  "pageNumber",
  "quantity",
  "relationGroupClaimedQuantity",
  "stepNumber",
];
const QUARANTINE_ROW_KEYS = [
  "comparisonMethod",
  "currentCropSha256",
  "elementId",
  "identity",
  "legacyCropSha256",
  "legacyRefusalReason",
  "maximumChannelDelta",
  "n",
  "officialStepElementQuantity",
  "pageNumber",
  "quantity",
  "quarantineReason",
  "relationGroupClaimedQuantity",
  "retainedDifferingPixels",
  "stepNumber",
];

const AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  answerArtifactsConsumed: false,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  semanticIdentity: true,
  coverageTrust: false,
  coveragePublication: false,
  catalogAdmission: false,
  assignmentAuthority: false,
  documentMutation: false,
  placement: false,
  acceptedDocument: false,
  completion: false,
});

function byteRole(value, label, maximumBytes) {
  return snapshotBoundedUint8Array(value, {
    label,
    minimumBytes: 1,
    maximumBytes,
  });
}

function snapshotInput(input, expectedKeys, label) {
  const roles = snapshotExactDataObject(input, label, expectedKeys);
  return {
    ...(expectedKeys.includes("artifactBytes")
      ? {
          artifactBytes: byteRole(
            roles.artifactBytes,
            "Legacy-recut semantic artifact bytes",
            LEGACY_RECUT_SEMANTIC_MAX_ARTIFACT_BYTES,
          ),
        }
      : {}),
    calloutRoot: snapshotBoundedString(roles.calloutRoot, {
      label: "Legacy-recut semantic callout root",
      minimumCharacters: 1,
      maximumCharacters: 512,
    }),
    currentManifestBytes: byteRole(
      roles.currentManifestBytes,
      "Current /6 callout manifest bytes",
      CURRENT_LEGACY_RECUT_PINS.currentManifest.bytes,
    ),
    legacyManifestBytes: byteRole(
      roles.legacyManifestBytes,
      "Legacy /5 callout manifest bytes",
      CURRENT_LEGACY_RECUT_PINS.legacyManifest.bytes,
    ),
    legacyRecutArtifactBytes: byteRole(
      roles.legacyRecutArtifactBytes,
      "Verified legacy-recut artifact bytes",
      CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.bytes,
    ),
    officialModelBytes: byteRole(
      roles.officialModelBytes,
      "Official model XML bytes",
      LEGACY_RECUT_SEMANTIC_MAX_OFFICIAL_XML_BYTES,
    ),
    truthBytes: byteRole(
      roles.truthBytes,
      "Pair-judged truth bytes",
      CURRENT_LEGACY_RECUT_PINS.truth.bytes,
    ),
  };
}

function tally(rows) {
  return {
    relations: rows.length,
    pieces: rows.reduce((total, row) => total + row.quantity, 0),
  };
}

function accountingFor(recut, officialCut, classification) {
  const semantic = tally(classification.semanticRelations);
  const semanticExact = tally(
    classification.semanticRelations.filter((row) => row.comparisonMethod === "exact-png-bytes"),
  );
  const semanticRecut = tally(
    classification.semanticRelations.filter(
      (row) => row.comparisonMethod === "exact-bottom-background-recut",
    ),
  );
  const conflicts = tally(
    classification.quarantinedSameRelations.filter(
      (row) => row.quarantineReason === "official-step-element-capacity-insufficient",
    ),
  );
  const conflictExact = tally(
    classification.quarantinedSameRelations.filter(
      (row) =>
        row.quarantineReason === "official-step-element-capacity-insufficient" &&
        row.comparisonMethod === "exact-png-bytes",
    ),
  );
  const conflictRecut = tally(
    classification.quarantinedSameRelations.filter(
      (row) =>
        row.quarantineReason === "official-step-element-capacity-insufficient" &&
        row.comparisonMethod === "exact-bottom-background-recut",
    ),
  );
  const refused = tally(
    classification.quarantinedSameRelations.filter(
      (row) => row.quarantineReason === "legacy-recut-comparison-refused",
    ),
  );
  return {
    sourcePartArtRelations: officialCut.sourceRelations,
    sourcePartArtPieces: officialCut.sourcePieces,
    officialInventoryBricks: officialCut.officialInventoryBricks,
    officialSequencedIdentities: officialCut.officialSequencedIdentities,
    officialPrefixPieces: officialCut.officialPrefixPieces,
    legacyAcceptedSameRelations: recut.accounting.acceptedSameRelations,
    legacyAcceptedSamePieces: recut.accounting.acceptedSamePieces,
    semanticIdentityRelations: semantic.relations,
    semanticIdentityPieces: semantic.pieces,
    semanticExactPngRelations: semanticExact.relations,
    semanticExactPngPieces: semanticExact.pieces,
    semanticBottomRecutRelations: semanticRecut.relations,
    semanticBottomRecutPieces: semanticRecut.pieces,
    officialConflictRelations: conflicts.relations,
    officialConflictPieces: conflicts.pieces,
    officialConflictExactPngRelations: conflictExact.relations,
    officialConflictExactPngPieces: conflictExact.pieces,
    officialConflictBottomRecutRelations: conflictRecut.relations,
    officialConflictBottomRecutPieces: conflictRecut.pieces,
    legacyRefusedSameRelations: refused.relations,
    legacyRefusedSamePieces: refused.pieces,
    retainedDifferentRelations: recut.accounting.retainedDifferentRelations,
    retainedDifferentPieces: recut.accounting.retainedDifferentPieces,
    retainedUnjudgeableRelations: recut.accounting.unjudgeableRelations,
    retainedUnjudgeablePieces: recut.accounting.unjudgeablePieces,
  };
}

function perCompileWorkFor(recut, officialCut) {
  return {
    legacyRecutCropImages: recut.accounting.perCompileSelectedCropImages,
    legacyRecutDecodePixels: recut.accounting.perCompileDecodePixels,
    legacyRecutDecodePixelLimit: recut.accounting.perCompileDecodePixelLimit,
    officialModelIndexCalls: officialCut.officialModelIndexCalls,
    officialModelInputBytes: officialCut.officialModelInputBytes,
    officialModelInputByteLimit: officialCut.officialModelInputByteLimit,
    officialXmlFullDecodes: officialCut.officialXmlFullDecodes,
    officialXmlDecodedBytes: officialCut.officialXmlDecodedBytes,
    officialXmlDecodeByteLimit: officialCut.officialXmlDecodeByteLimit,
  };
}

function assertExactRowKeys(rows, expectedKeys, label) {
  for (const [index, row] of rows.entries()) {
    if (Object.keys(row).sort().join(",") !== expectedKeys.join(",")) {
      throw new Error(
        `${label} ${index} must contain exactly ${expectedKeys.join(", ")}; assignment, transform, catalog, and document fields are forbidden.`,
      );
    }
  }
}

function assertExactPublishedShape(artifact) {
  if (!isDeepStrictEqual(artifact.authority, AUTHORITY)) {
    throw new Error(
      "Legacy-recut semantic authority must exactly retain its closed authority object.",
    );
  }
  const officialCutKeys = [
    "assignmentPublished",
    "commitment",
    "firstPrintedStep",
    "lastPrintedStep",
    "prefixPieces",
  ];
  if (Object.keys(artifact.officialCut).sort().join(",") !== officialCutKeys.join(",")) {
    throw new Error(
      `Legacy-recut semantic officialCut must contain exactly ${officialCutKeys.join(", ")}.`,
    );
  }
  assertExactRowKeys(artifact.semanticIdentityRelations, SEMANTIC_ROW_KEYS, "Semantic row");
  assertExactRowKeys(
    artifact.quarantinedSameRelations,
    QUARANTINE_ROW_KEYS,
    "Quarantined same row",
  );
}

function assertLegacyRecutInput(bytes, inspection, pins) {
  const digest = sha256Digest(bytes);
  if (
    bytes.length !== pins.legacyRecut.bytes ||
    digest !== pins.legacyRecut.digest ||
    inspection.digest !== pins.legacyRecut.digest ||
    inspection.artifact.schemaVersion !== pins.legacyRecut.schemaVersion
  ) {
    throw new Error(
      `Legacy-recut semantic input must be ${pins.legacyRecut.bytes} bytes at ${pins.legacyRecut.digest} with schema ${pins.legacyRecut.schemaVersion}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
  if (
    inspection.artifact.authority.semanticIdentity !== false ||
    inspection.artifact.authority.assignmentAuthority !== false ||
    inspection.artifact.authority.placement !== false
  ) {
    throw new Error(
      "Legacy-recut semantic input must retain its source artifact's absent identity, assignment, and placement authority.",
    );
  }
}

async function compileWithPins(input, pins) {
  const recutHandle = verifyPartIdentificationLegacyRecut({
    calloutRoot: input.calloutRoot,
    currentManifestBytes: input.currentManifestBytes,
    legacyManifestBytes: input.legacyManifestBytes,
    truthBytes: input.truthBytes,
    artifactBytes: input.legacyRecutArtifactBytes,
  });
  const recutInspection = inspectVerifiedPartIdentificationLegacyRecut(recutHandle);
  assertLegacyRecutInput(input.legacyRecutArtifactBytes, recutInspection, pins);
  const authenticatedSource = authenticateLegacyRecutInputs(
    {
      currentManifestBytes: input.currentManifestBytes,
      legacyManifestBytes: input.legacyManifestBytes,
      truthBytes: input.truthBytes,
    },
    CURRENT_LEGACY_RECUT_PINS,
  );
  const officialCut = await deriveOfficialPrefixCut(
    authenticatedSource.currentRows,
    input.officialModelBytes,
    pins,
  );
  const classification = classifySemanticRelations(
    recutInspection.artifact,
    officialCut.availability,
    pins.lastStep,
  );
  const accounting = accountingFor(recutInspection.artifact, officialCut, classification);
  const perCompileWork = perCompileWorkFor(recutInspection.artifact, officialCut);
  const result = {
    accounting,
    perCompileWork,
    officialCutCommitment: officialCut.officialCutCommitment,
    semanticCommitment: classification.semanticCommitment,
    quarantineCommitment: classification.quarantineCommitment,
  };
  assertPinnedSemanticResult(result, pins);
  const artifact = {
    schemaVersion: PART_IDENTIFICATION_LEGACY_RECUT_SEMANTIC_SCHEMA,
    authority: AUTHORITY,
    inputTrust: "module-owned-current-pins",
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: pins.lastStep,
      expectedPrintedSteps: pins.expectedPrintedSteps,
      identityPublication: "listed-compatible-relations-only",
      suffixStepsReconstructed: false,
    },
    inputs: {
      legacyRecut: { ...pins.legacyRecut },
      currentManifest: { ...CURRENT_LEGACY_RECUT_PINS.currentManifest },
      officialModel: { ...pins.officialModel },
    },
    sourceIndex: recutInspection.artifact.sourceIndex,
    accounting,
    perCompileWork,
    officialCut: {
      firstPrintedStep: 1,
      lastPrintedStep: pins.lastStep,
      prefixPieces: officialCut.officialPrefixPieces,
      assignmentPublished: false,
      commitment: officialCut.officialCutCommitment,
    },
    legacyCounterevidence: {
      relationCommitment: recutInspection.artifact.relationCommitment,
      retainedDifferentRelations: recutInspection.artifact.accounting.retainedDifferentRelations,
      retainedDifferentPieces: recutInspection.artifact.accounting.retainedDifferentPieces,
      retainedUnjudgeableRelations: recutInspection.artifact.accounting.unjudgeableRelations,
      retainedUnjudgeablePieces: recutInspection.artifact.accounting.unjudgeablePieces,
    },
    semanticCommitment: classification.semanticCommitment,
    quarantineCommitment: classification.quarantineCommitment,
    semanticIdentityRelations: classification.semanticRelations,
    quarantinedSameRelations: classification.quarantinedSameRelations,
  };
  assertExactPublishedShape(artifact);
  return artifact;
}

export async function compilePartIdentificationLegacyRecutSemantic(input) {
  const snapshot = snapshotInput(input, COMPILE_INPUT_KEYS, "Legacy-recut semantic compiler input");
  await Promise.resolve();
  return compileWithPins(snapshot, CURRENT_LEGACY_RECUT_SEMANTIC_PINS);
}

export function encodePartIdentificationLegacyRecutSemantic(value) {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPartIdentificationLegacyRecutSemantic(input) {
  const snapshot = snapshotInput(input, VERIFY_INPUT_KEYS, "Legacy-recut semantic verifier input");
  await Promise.resolve();
  const artifact = jsonArtifactFromBytes(snapshot.artifactBytes, "Legacy-recut semantic artifact");
  const compileInput = Object.fromEntries(COMPILE_INPUT_KEYS.map((key) => [key, snapshot[key]]));
  const expected = await compileWithPins(compileInput, CURRENT_LEGACY_RECUT_SEMANTIC_PINS);
  const expectedBytes = encodePartIdentificationLegacyRecutSemantic(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  const pin = CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedArtifact;
  if (pin !== null && (expectedBytes.length !== pin.bytes || expectedDigest !== pin.digest)) {
    throw new Error(
      `Legacy-recut semantic verifier derived ${expectedBytes.length} bytes at ${expectedDigest}, but production pins require ${pin.bytes} bytes at ${pin.digest}. Review and repin the complete artifact rather than accepting equal counts.`,
    );
  }
  if (!artifact.bytes.equals(expectedBytes)) {
    throw new Error(
      "Legacy-recut semantic artifact does not exactly reproduce from the verified recut, current 359-step source index, and exact official model cut. Regenerate it; edited identity or authority fields are not accepted.",
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

export function isVerifiedPartIdentificationLegacyRecutSemantic(value) {
  return typeof value === "object" && value !== null && verifiedArtifacts.has(value);
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new Error(
      "Legacy-recut semantic publication requires the opaque result of its module-owned independent verifier.",
    );
  }
  return record;
}

export function bytesFromVerifiedPartIdentificationLegacyRecutSemantic(value) {
  return Buffer.from(verifiedRecord(value).bytes);
}

export function inspectVerifiedPartIdentificationLegacyRecutSemantic(value) {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
}

export const __testOnly = Object.freeze({ classifySemanticRelations });
