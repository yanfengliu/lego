import { isDeepStrictEqual } from "node:util";

import {
  SEMANTIC_CATALOG_COVERAGE_SCHEMA,
  verifySemanticBookletCatalogCoverage,
} from "./booklet-catalog-coverage-semantic.mjs";
import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  inspectVerifiedPartIdentificationPrefix50SemanticClosure,
  isVerifiedPartIdentificationPrefix50SemanticClosure,
} from "./part-identification-prefix50-semantic-closure.mjs";
import {
  inspectVerifiedStep31_32OrderReconciliation,
  isVerifiedStep31_32OrderReconciliation,
} from "./part-identification-step31-32-order-reconciliation.mjs";
import {
  authenticateStep31_32Manifest,
  authenticateStep31_32OfficialModel,
} from "./part-identification-step31-32-order-reconciliation-source.mjs";
import {
  CURRENT_PREFIX50_ACTION_PREPARATION_PINS,
  PREFIX50_ACTION_PREPARATION_AUTHORITY,
  PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
  PREFIX50_ACTION_PREPARATION_SCHEMA,
} from "./part-identification-prefix50-action-preparation-source.mjs";
import {
  derivePrefix50ActionPreparationSteps,
  prefix50ActionPreparationAccounting,
} from "./part-identification-prefix50-action-preparation-derive.mjs";

const MAXIMUM_COVERAGE_BYTES = 2 * 1024 * 1024;
const MAXIMUM_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAXIMUM_OFFICIAL_MODEL_BYTES = 16 * 1024 * 1024;
const COMPILE_KEYS = [
  "coverageBytes",
  "elementResolutionBytes",
  "manifestBytes",
  "officialModelBytes",
  "orderReconciliation",
  "semanticClosure",
];
const VERIFY_KEYS = [...COMPILE_KEYS, "artifactBytes"].sort();

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPartIdentificationPrefix50SemanticClosure(roles.semanticClosure)) {
    throw new TypeError(
      `${label}.semanticClosure must be the opaque current prefix-50 semantic verifier result. Parsed artifacts and caller-shaped lookalikes carry no preparation authority.`,
    );
  }
  if (!isVerifiedStep31_32OrderReconciliation(roles.orderReconciliation)) {
    throw new TypeError(
      `${label}.orderReconciliation must be the opaque step-31/32 order verifier result. A caller-authored phase partition is forbidden.`,
    );
  }
  return {
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: snapshotBoundedUint8Array(roles.artifactBytes, {
            label: "Prefix-50 action-preparation artifact bytes",
            minimumBytes: 1,
            maximumBytes: PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
          }),
        }
      : {}),
    coverageBytes: snapshotBoundedUint8Array(roles.coverageBytes, {
      label: "Prefix-50 action-preparation semantic coverage bytes",
      minimumBytes: 1,
      maximumBytes: MAXIMUM_COVERAGE_BYTES,
    }),
    elementResolutionBytes: snapshotBoundedUint8Array(roles.elementResolutionBytes, {
      label: "Prefix-50 action-preparation element-resolution bytes",
      minimumBytes: 1,
      maximumBytes: 128 * 1024,
    }),
    manifestBytes: snapshotBoundedUint8Array(roles.manifestBytes, {
      label: "Prefix-50 action-preparation callout manifest bytes",
      minimumBytes: 1,
      maximumBytes: MAXIMUM_MANIFEST_BYTES,
    }),
    officialModelBytes: snapshotBoundedUint8Array(roles.officialModelBytes, {
      label: "Prefix-50 action-preparation official model bytes",
      minimumBytes: 1,
      maximumBytes: MAXIMUM_OFFICIAL_MODEL_BYTES,
    }),
    orderReconciliation: roles.orderReconciliation,
    semanticClosure: roles.semanticClosure,
  };
}

function requirePin(artifact, pin, label) {
  if (
    artifact.bytes.length !== pin.bytes ||
    artifact.digest !== pin.digest ||
    (pin.schemaVersion !== undefined && artifact.value?.schemaVersion !== pin.schemaVersion)
  ) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${artifact.bytes.length} bytes at ${artifact.digest}.`,
    );
  }
}

async function compileSnapshot(input) {
  const semantic = inspectVerifiedPartIdentificationPrefix50SemanticClosure(input.semanticClosure);
  const proof = inspectVerifiedStep31_32OrderReconciliation(input.orderReconciliation);
  const coverageArtifact = jsonArtifactFromBytes(input.coverageBytes, "Semantic coverage /4");
  requirePin(
    coverageArtifact,
    CURRENT_PREFIX50_ACTION_PREPARATION_PINS.semanticCoverage,
    "Semantic coverage /4",
  );
  if (
    semantic.digest !== CURRENT_PREFIX50_ACTION_PREPARATION_PINS.semanticClosure.digest ||
    proof.digest !== CURRENT_PREFIX50_ACTION_PREPARATION_PINS.orderReconciliation.digest
  ) {
    throw new Error(
      "Prefix-50 action preparation requires the exact current semantic and order tokens.",
    );
  }
  const manifestArtifact = jsonArtifactFromBytes(input.manifestBytes, "Full callout manifest");
  requirePin(
    manifestArtifact,
    CURRENT_PREFIX50_ACTION_PREPARATION_PINS.calloutManifest,
    "Full callout manifest",
  );
  const manifestEvidence = authenticateStep31_32Manifest(input.manifestBytes);
  const official = await authenticateStep31_32OfficialModel(input.officialModelBytes);
  const coverage = await verifySemanticBookletCatalogCoverage({
    coverageBytes: input.coverageBytes,
    elementResolutionBytes: input.elementResolutionBytes,
    lastStep: 50,
    manifestBytes: input.manifestBytes,
    semanticClosure: input.semanticClosure,
  });
  if (coverage.schemaVersion !== SEMANTIC_CATALOG_COVERAGE_SCHEMA || coverage.lastStep !== 50) {
    throw new Error(
      "Prefix-50 action preparation requires exact current semantic coverage /4 through 50.",
    );
  }
  const sourceIndex = {
    ...manifestEvidence.sourceIndex,
    suffixPartArtRows:
      manifestEvidence.sourceIndex.partArtRows - manifestEvidence.sourceIndex.prefixPartArtRows,
  };
  const expectedSource = CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedSourceIndex;
  if (
    Object.entries(expectedSource).some(([key, value]) => sourceIndex[key] !== value) ||
    semantic.artifact.scope.expectedPrintedSteps !== 359 ||
    semantic.artifact.scope.suffixStepsReconstructed !== false
  ) {
    throw new Error(
      "Prefix-50 action preparation did not retain the exact 359-step source/index contract.",
    );
  }
  const steps = derivePrefix50ActionPreparationSteps(manifestEvidence, coverage, official, proof);
  const accounting = prefix50ActionPreparationAccounting(steps);
  if (!isDeepStrictEqual(accounting, CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedAccounting)) {
    throw new Error(`Prefix-50 action accounting drifted: received ${JSON.stringify(accounting)}.`);
  }
  return {
    schemaVersion: PREFIX50_ACTION_PREPARATION_SCHEMA,
    authority: PREFIX50_ACTION_PREPARATION_AUTHORITY,
    scope: {
      firstPrintedStep: 1,
      lastPrintedStep: 50,
      expectedPrintedSteps: 359,
      sourceIndexPreserved: true,
      suffixStepsReconstructed: false,
    },
    inputs: {
      semanticCoverage: {
        schemaVersion: coverage.schemaVersion,
        bytes: coverageArtifact.bytes.length,
        digest: coverageArtifact.digest,
      },
      prefix50SemanticClosure: {
        schemaVersion: semantic.artifact.schemaVersion,
        bytes: CURRENT_PREFIX50_ACTION_PREPARATION_PINS.semanticClosure.bytes,
        digest: semantic.digest,
      },
      calloutManifest: {
        schemaVersion: manifestArtifact.value.schemaVersion,
        bytes: manifestArtifact.bytes.length,
        digest: manifestArtifact.digest,
      },
      officialModel: {
        bytes: input.officialModelBytes.length,
        digest: official.digest,
        phaseDigest: official.builderOrder.phaseDigest,
      },
      step31_32OrderReconciliation: {
        schemaVersion: proof.artifact.schemaVersion,
        bytes: CURRENT_PREFIX50_ACTION_PREPARATION_PINS.orderReconciliation.bytes,
        digest: proof.digest,
      },
      catalogDigest: coverage.catalog.digest,
      sourcePdfDigest: coverage.inputDigests.pdf,
    },
    sourceIndex,
    accounting,
    steps,
  };
}

export const encodePrefix50ActionPreparation = (artifact) =>
  Buffer.from(`${JSON.stringify(artifact, null, 1)}\n`);

export async function compilePrefix50ActionPreparation(input) {
  const snapshot = snapshotInput(
    input,
    COMPILE_KEYS,
    "Prefix-50 action-preparation compiler input",
  );
  await Promise.resolve();
  return compileSnapshot(snapshot);
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPrefix50ActionPreparation(input) {
  const snapshot = snapshotInput(input, VERIFY_KEYS, "Prefix-50 action-preparation verifier input");
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(
    snapshot.artifactBytes,
    "Prefix-50 action-preparation artifact",
  );
  const expected = await compileSnapshot(snapshot);
  const expectedBytes = encodePrefix50ActionPreparation(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  const pin = CURRENT_PREFIX50_ACTION_PREPARATION_PINS.expectedArtifact;
  if (pin === null) {
    throw new Error(
      `Prefix-50 action preparation reproduced ${expectedBytes.length} bytes at ${expectedDigest}, but no reviewed artifact pin is installed.`,
    );
  }
  if (pin.bytes !== expectedBytes.length || pin.digest !== expectedDigest) {
    throw new Error(
      `Prefix-50 action preparation reproduced ${expectedBytes.length} bytes at ${expectedDigest}, not its reviewed ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  if (!supplied.bytes.equals(expectedBytes)) {
    throw new Error(
      "Prefix-50 action preparation does not exactly reproduce from authenticated semantic coverage, frozen Builder order, and the opaque step-31/32 proof.",
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
    throw new Error(
      "Prefix-50 action-preparation inspection requires its opaque independent-verifier result.",
    );
  }
  return record;
}

export const isVerifiedPrefix50ActionPreparation = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);
export const bytesFromVerifiedPrefix50ActionPreparation = (value) =>
  Buffer.from(verifiedRecord(value).bytes);
export const inspectVerifiedPrefix50ActionPreparation = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};
