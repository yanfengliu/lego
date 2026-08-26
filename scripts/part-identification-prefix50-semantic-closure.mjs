import { isDeepStrictEqual } from "node:util";

import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedString,
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import { canonicalSourceArtJson as canonicalJson } from "./part-identification-source-art-contribution.mjs";
import {
  PART_IDENTIFICATION_SOURCE_ART_SEMANTIC_REBOUND_SCHEMA,
  bytesFromVerifiedPartIdentificationSourceArtSemanticRebound,
  inspectVerifiedPartIdentificationSourceArtSemanticRebound,
  isVerifiedPartIdentificationSourceArtSemanticRebound,
} from "./part-identification-source-art-semantic-rebound.mjs";
import {
  authenticatePrefix50ClosureEvidence,
  enrichSafeSemanticRows,
} from "./part-identification-prefix50-semantic-closure-evidence.mjs";
import {
  CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS,
  PART_IDENTIFICATION_PREFIX50_SEMANTIC_CLOSURE_SCHEMA,
  PREFIX50_SEMANTIC_CLOSURE_AUTHORITY,
  PREFIX50_SEMANTIC_CLOSURE_MAX_ARTIFACT_BYTES,
  PREFIX50_STATIC_REVIEWED_MAP,
  assertGlobalPrefixConservation,
  assertExact,
  exactCommitment,
  tally,
} from "./part-identification-prefix50-semantic-closure-source.mjs";

const MAX_CALLOUT_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_INVENTORY_MANIFEST_BYTES = 512 * 1024;
const MAX_ELEMENT_RESOLUTION_BYTES = 128 * 1024;
const MAX_OFFICIAL_MODEL_BYTES = 2 * 1024 * 1024;
const MAX_REVIEW_BYTES = 128 * 1024;
const INPUT_KEYS = [
  "calloutManifestBytes",
  "calloutRoot",
  "elementResolutionBytes",
  "inventoryManifestBytes",
  "inventoryRoot",
  "officialModelBytes",
  "review3Bytes",
  "review57Bytes",
  "reviewOutcomesBytes",
  "source",
];
const VERIFY_KEYS = [...INPUT_KEYS, "artifactBytes"].sort();
const ROW_KEYS = [
  "elementId",
  "evidenceMethod",
  "identity",
  "officialDesignId",
  "pageNumber",
  "publishedColorId",
  "publishedPartNum",
  "quantity",
  "stepNumber",
];
const EVIDENCE_KEYS = [
  ...ROW_KEYS,
  "inventoryCropSha256",
  "reviewOutcome",
  "sourceCropSha256",
].sort();
const FORBIDDEN_KEYS = new Set([
  "brickRef",
  "brickUuid",
  "brickUUID",
  "phase",
  "phaseId",
  "assignment",
  "transform",
  "frame",
  "catalogPartId",
  "coverage",
  "actionLedger",
  "document",
  "replay",
  "placement",
  "acceptance",
  "completionAuthority",
]);

function byteRole(value, label, maximumBytes) {
  return snapshotBoundedUint8Array(value, { label, minimumBytes: 1, maximumBytes });
}

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPartIdentificationSourceArtSemanticRebound(roles.source)) {
    throw new TypeError(
      `${label}.source must be the opaque result of the exact source-art semantic verifier; parsed artifacts and lookalikes carry no semantic authority.`,
    );
  }
  return {
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: byteRole(
            roles.artifactBytes,
            "Prefix-50 semantic closure artifact bytes",
            PREFIX50_SEMANTIC_CLOSURE_MAX_ARTIFACT_BYTES,
          ),
        }
      : {}),
    calloutManifestBytes: byteRole(
      roles.calloutManifestBytes,
      "Prefix-50 callout manifest bytes",
      MAX_CALLOUT_MANIFEST_BYTES,
    ),
    calloutRoot: snapshotBoundedString(roles.calloutRoot, {
      label: "Prefix-50 callout root",
      minimumCharacters: 1,
      maximumCharacters: 1_024,
    }),
    elementResolutionBytes: byteRole(
      roles.elementResolutionBytes,
      "Prefix-50 element-resolution bytes",
      MAX_ELEMENT_RESOLUTION_BYTES,
    ),
    inventoryManifestBytes: byteRole(
      roles.inventoryManifestBytes,
      "Prefix-50 inventory manifest bytes",
      MAX_INVENTORY_MANIFEST_BYTES,
    ),
    inventoryRoot: snapshotBoundedString(roles.inventoryRoot, {
      label: "Prefix-50 inventory root",
      minimumCharacters: 1,
      maximumCharacters: 1_024,
    }),
    officialModelBytes: byteRole(
      roles.officialModelBytes,
      "Prefix-50 official model bytes",
      MAX_OFFICIAL_MODEL_BYTES,
    ),
    review3Bytes: byteRole(
      roles.review3Bytes,
      "Prefix-50 three-row review bytes",
      MAX_REVIEW_BYTES,
    ),
    review57Bytes: byteRole(roles.review57Bytes, "Prefix-50 57-row review bytes", MAX_REVIEW_BYTES),
    reviewOutcomesBytes: byteRole(
      roles.reviewOutcomesBytes,
      "Prefix-50 inspected review-outcomes bytes",
      MAX_REVIEW_BYTES,
    ),
    source: roles.source,
  };
}

function assertPinnedBytes(bytes, pin, label) {
  const digest = sha256Digest(bytes);
  if (bytes.length !== pin.bytes || digest !== pin.digest) {
    throw new Error(
      `${label} must be exact ${pin.bytes}-byte input at ${pin.digest}; received ${bytes.length} bytes at ${digest}.`,
    );
  }
}

function compareRows(left, right) {
  return (
    left.stepNumber - right.stepNumber ||
    left.pageNumber - right.pageNumber ||
    (left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0)
  );
}

function assertExactRowShape(rows, keys, label) {
  const keySignature = [...keys].sort().join("\0");
  for (const [index, row] of rows.entries()) {
    if (
      typeof row !== "object" ||
      row === null ||
      Array.isArray(row) ||
      Object.keys(row).sort().join("\0") !== keySignature
    ) {
      throw new Error(`${label} row ${index} has forbidden or missing fields.`);
    }
  }
}

function assertClosedAuthority(artifact) {
  if (!isDeepStrictEqual(artifact.authority, PREFIX50_SEMANTIC_CLOSURE_AUTHORITY)) {
    throw new Error("Prefix-50 semantic closure authority must remain exactly closed downstream.");
  }
  const visit = (value, path) => {
    if (typeof value !== "object" || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (path !== "artifact.authority" && FORBIDDEN_KEYS.has(key)) {
        throw new Error(`Prefix-50 semantic closure forbids ${path}.${key} authority.`);
      }
      visit(child, `${path}.${key}`);
    }
  };
  visit(artifact, "artifact");
  assertExactRowShape(artifact.semanticIdentity, ROW_KEYS, "Semantic identity");
  assertExactRowShape(artifact.manualEvidence, EVIDENCE_KEYS, "Manual evidence");
}

function validateClosureAgainstManifest(rows, manifest) {
  const byIdentity = new Map(manifest.callouts.map((row) => [row.identity, row]));
  const seen = new Set();
  for (const row of rows) {
    const source = byIdentity.get(row.identity);
    if (
      seen.has(row.identity) ||
      source?.evidenceKind !== "part-art" ||
      source.stepNumber > 50 ||
      source.pageNumber !== row.pageNumber ||
      source.stepNumber !== row.stepNumber ||
      source.quantity !== row.quantity
    ) {
      throw new Error(
        `Semantic closure row ${JSON.stringify(row.identity)} does not select one exact first-50 part-art source row.`,
      );
    }
    seen.add(row.identity);
  }
}

function assertResidualClosure(manualRows, residualRows) {
  const manualIdentities = new Set(manualRows.map(({ identity }) => identity));
  const residualIdentities = new Set(residualRows.map(({ identity }) => identity));
  if (
    manualRows.length !== 101 ||
    residualRows.length !== 101 ||
    manualIdentities.size !== 101 ||
    residualIdentities.size !== 101 ||
    [...manualIdentities].some((identity) => !residualIdentities.has(identity)) ||
    [...residualIdentities].some((identity) => !manualIdentities.has(identity))
  ) {
    throw new Error(
      "Manual semantic rows must be a complete disjoint reopening of all 101 source residual identities; missing, extra, or duplicate rows are forbidden.",
    );
  }
}

async function compileWithPins(input) {
  assertPinnedBytes(
    input.officialModelBytes,
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.officialModel,
    "Prefix-50 official model",
  );
  const sourceInspection = inspectVerifiedPartIdentificationSourceArtSemanticRebound(input.source);
  const sourceArtifactBytes = bytesFromVerifiedPartIdentificationSourceArtSemanticRebound(
    input.source,
  );
  if (
    sourceArtifactBytes.length !== CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.sourceArtifact.bytes ||
    sourceInspection.digest !== CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.sourceArtifact.digest ||
    sourceInspection.artifact.schemaVersion !==
      PART_IDENTIFICATION_SOURCE_ART_SEMANTIC_REBOUND_SCHEMA
  ) {
    throw new Error(
      "Prefix-50 semantic closure requires the exact pinned opaque source-art handle.",
    );
  }
  const sourceSafe = sourceInspection.artifact.rosters.safeIdentity;
  const sourceResidual = sourceInspection.artifact.rosters.residual;
  assertExact(tally(sourceSafe), { relations: 86, pieces: 147 }, "Source safe roster");
  assertExact(tally(sourceResidual), { relations: 101, pieces: 173 }, "Source residual roster");
  if (
    !isDeepStrictEqual(sourceInspection.artifact.sourceIndex, {
      ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedSourceIndex,
      cropBytesAuthenticated: "not-consumed-source-pdf-only",
    })
  ) {
    throw new Error("Opaque source-art handle no longer preserves the exact full 359-step index.");
  }

  const evidence = await authenticatePrefix50ClosureEvidence(input);
  assertResidualClosure(evidence.semanticRows, sourceResidual);
  const manualIdentities = new Set(evidence.semanticRows.map(({ identity }) => identity));
  const safe = enrichSafeSemanticRows(sourceSafe, evidence.resolution, evidence.officialDesign);
  const safeIdentities = new Set(safe.map(({ identity }) => identity));
  if (
    safeIdentities.size !== 86 ||
    [...manualIdentities].some((identity) => safeIdentities.has(identity))
  ) {
    throw new Error("Safe and manual semantic rosters must be exact and disjoint.");
  }
  const semanticIdentity = [...safe, ...evidence.semanticRows].sort(compareRows);
  const manualEvidence = [...evidence.evidenceRows].sort(compareRows);
  validateClosureAgainstManifest(semanticIdentity, evidence.manifest);
  const globalConservation = assertGlobalPrefixConservation(
    semanticIdentity,
    evidence.officialFirst320Sequence,
  );

  const accounting = {
    fullCalloutRows: evidence.manifest.callouts.length,
    expectedPrintedSteps: 359,
    prefixLastStep: 50,
    safeRelations: tally(safe).relations,
    safePieces: tally(safe).pieces,
    manualStaticRelations: tally(evidence.groupRows.static).relations,
    manualStaticPieces: tally(evidence.groupRows.static).pieces,
    manual57Relations: tally(evidence.groupRows.review57).relations,
    manual57Pieces: tally(evidence.groupRows.review57).pieces,
    manual3Relations: tally(evidence.groupRows.review3).relations,
    manual3Pieces: tally(evidence.groupRows.review3).pieces,
    manualRelations: tally(evidence.semanticRows).relations,
    manualPieces: tally(evidence.semanticRows).pieces,
    closureRelations: tally(semanticIdentity).relations,
    closurePieces: tally(semanticIdentity).pieces,
    officialPrefixElements: globalConservation.officialAggregate.length,
    officialPrefixPieces: evidence.officialFirst320Sequence.length,
    closureAggregateElements: globalConservation.semanticAggregate.length,
    closureAggregatePieces: tally(semanticIdentity).pieces,
    globalElementQuantityDiffs: globalConservation.diffs.length,
    sourceCropsAuthenticated: manualEvidence.length,
    inventoryCropsAuthenticated: manualEvidence.length,
  };
  assertExact(
    accounting,
    CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedAccounting,
    "Prefix-50 semantic closure accounting",
  );
  const commitments = {
    sourceSafe: sourceInspection.artifact.commitments.safeIdentity,
    sourceResidual: sourceInspection.artifact.commitments.residual,
    staticReviewedMap: exactCommitment(
      "lego.part-identification-prefix50-static-reviewed-map/1",
      PREFIX50_STATIC_REVIEWED_MAP,
    ),
    manualStatic: exactCommitment(
      "lego.part-identification-prefix50-manual-static/1",
      evidence.groupRows.static,
    ),
    manual57: exactCommitment(
      "lego.part-identification-prefix50-manual-57/1",
      evidence.groupRows.review57,
    ),
    manual3: exactCommitment(
      "lego.part-identification-prefix50-manual-3/1",
      evidence.groupRows.review3,
    ),
    manualEvidence: exactCommitment(
      "lego.part-identification-prefix50-manual-evidence/1",
      manualEvidence,
    ),
    semanticIdentity: exactCommitment(
      "lego.part-identification-prefix50-semantic-identity/1",
      semanticIdentity,
    ),
    officialFirst320Sequence: exactCommitment(
      "lego.part-identification-prefix50-official-element-sequence/1",
      evidence.officialFirst320Sequence,
    ),
    officialFirst320ElementAggregate: exactCommitment(
      "lego.part-identification-prefix50-official-element-aggregate/1",
      globalConservation.officialAggregate,
    ),
    semanticElementAggregate: exactCommitment(
      "lego.part-identification-prefix50-semantic-element-aggregate/1",
      globalConservation.semanticAggregate,
    ),
  };
  const artifact = {
    schemaVersion: PART_IDENTIFICATION_PREFIX50_SEMANTIC_CLOSURE_SCHEMA,
    authority: PREFIX50_SEMANTIC_CLOSURE_AUTHORITY,
    inputTrust: "exact-pinned-input-bytes-and-opaque-source-art-handle",
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      suffixStepsReconstructed: false,
      publication: "semantic-element-identity-only",
    },
    inputs: {
      calloutManifest: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.calloutManifest },
      inventoryManifest: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.inventoryManifest },
      elementResolution: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.elementResolution },
      officialModel: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.officialModel },
      review57: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review57 },
      review3: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.review3 },
      reviewOutcomes: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.reviewOutcomes },
      sourceArtifact: { ...CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.sourceArtifact },
    },
    sourceIndex: { ...sourceInspection.artifact.sourceIndex },
    accounting,
    commitments,
    semanticIdentity,
    manualEvidence,
  };
  assertClosedAuthority(artifact);
  return artifact;
}

export async function compilePartIdentificationPrefix50SemanticClosure(input) {
  const snapshot = snapshotInput(input, INPUT_KEYS, "Prefix-50 semantic closure compiler input");
  await Promise.resolve();
  return compileWithPins(snapshot);
}

export function encodePartIdentificationPrefix50SemanticClosure(value) {
  return Buffer.from(`${canonicalJson(value)}\n`);
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPartIdentificationPrefix50SemanticClosure(input) {
  const snapshot = snapshotInput(input, VERIFY_KEYS, "Prefix-50 semantic closure verifier input");
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(
    snapshot.artifactBytes,
    "Prefix-50 semantic closure artifact",
  );
  const expected = await compileWithPins(
    Object.fromEntries(INPUT_KEYS.map((key) => [key, snapshot[key]])),
  );
  const bytes = encodePartIdentificationPrefix50SemanticClosure(expected);
  const digest = sha256Digest(bytes);
  if (bytes.length > PREFIX50_SEMANTIC_CLOSURE_MAX_ARTIFACT_BYTES) {
    throw new Error(
      `Prefix-50 semantic closure is ${bytes.length} bytes, above the fixed ${PREFIX50_SEMANTIC_CLOSURE_MAX_ARTIFACT_BYTES}-byte ordinary-Git ceiling.`,
    );
  }
  if (
    bytes.length !== CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.bytes ||
    digest !== CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.digest
  ) {
    throw new Error(
      `Prefix-50 semantic closure independently derived ${bytes.length} bytes at ${digest}, not pinned ${CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.bytes} bytes at ${CURRENT_PREFIX50_SEMANTIC_CLOSURE_PINS.expectedArtifact.digest}.`,
    );
  }
  if (!supplied.bytes.equals(bytes)) {
    throw new Error(
      "Prefix-50 semantic closure does not independently reproduce from exact bounded snapshots and the opaque source handle.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(bytes),
    digest,
  });
  return verified;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new Error("Prefix-50 semantic closure requires its opaque independent verifier result.");
  }
  return record;
}

export function inspectVerifiedPartIdentificationPrefix50SemanticClosure(value) {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
}

export function bytesFromVerifiedPartIdentificationPrefix50SemanticClosure(value) {
  return Buffer.from(verifiedRecord(value).bytes);
}

export function isVerifiedPartIdentificationPrefix50SemanticClosure(value) {
  return typeof value === "object" && value !== null && verifiedArtifacts.has(value);
}

export const __testOnly = Object.freeze({
  assertClosedAuthority,
  assertResidualClosure,
  validateClosureAgainstManifest,
});
