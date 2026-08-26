import { isDeepStrictEqual } from "node:util";

import {
  resolveElementPart,
  summarizeCatalogCoverage,
} from "../apps/web/src/assembly/element-catalog.ts";
import { canonicalDigest } from "../packages/brick-kernel/src/canonical.ts";
import {
  BUILTIN_CATALOG_VERSION,
  getCatalogSnapshotDigestInput,
} from "../packages/catalog/src/index.ts";
import {
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  assertV6CalloutManifest,
  jsonArtifactFromBytes,
} from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  inspectVerifiedPartIdentificationPrefix50SemanticClosure,
  isVerifiedPartIdentificationPrefix50SemanticClosure,
} from "./part-identification-prefix50-semantic-closure.mjs";

export const SEMANTIC_CATALOG_COVERAGE_SCHEMA = "lego.real-build-catalog-coverage/4";
export const PREFIX50_SEMANTIC_IDENTIFICATION_CONFIDENCE = "prefix50-semantic-closure";

const EXPECTED_PRINTED_STEPS = 359;
const MAXIMUM_LAST_STEP = 50;
const MAXIMUM_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAXIMUM_ELEMENT_RESOLUTION_BYTES = 128 * 1024;
const MAXIMUM_COVERAGE_BYTES = 2 * 1024 * 1024;
const COMPILE_KEYS = ["elementResolutionBytes", "lastStep", "manifestBytes", "semanticClosure"];
const VERIFY_KEYS = [...COMPILE_KEYS, "coverageBytes"].sort();

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPartIdentificationPrefix50SemanticClosure(roles.semanticClosure)) {
    throw new TypeError(
      `${label}.semanticClosure must be the opaque result of the independent prefix-50 semantic verifier. Parsed artifacts and caller-shaped lookalikes carry no coverage authority.`,
    );
  }
  if (
    !Number.isSafeInteger(roles.lastStep) ||
    roles.lastStep < 1 ||
    roles.lastStep > MAXIMUM_LAST_STEP
  ) {
    throw new TypeError(
      `${label}.lastStep must be a safe integer from 1 through ${MAXIMUM_LAST_STEP}; received ${JSON.stringify(roles.lastStep)}.`,
    );
  }
  return {
    ...(keys.includes("coverageBytes")
      ? {
          coverageBytes: snapshotBoundedUint8Array(roles.coverageBytes, {
            label: "Semantic catalog coverage bytes",
            minimumBytes: 1,
            maximumBytes: MAXIMUM_COVERAGE_BYTES,
          }),
        }
      : {}),
    elementResolutionBytes: snapshotBoundedUint8Array(roles.elementResolutionBytes, {
      label: "Semantic catalog coverage element-resolution bytes",
      minimumBytes: 1,
      maximumBytes: MAXIMUM_ELEMENT_RESOLUTION_BYTES,
    }),
    lastStep: roles.lastStep,
    manifestBytes: snapshotBoundedUint8Array(roles.manifestBytes, {
      label: "Semantic catalog coverage callout-manifest bytes",
      minimumBytes: 1,
      maximumBytes: MAXIMUM_MANIFEST_BYTES,
    }),
    semanticClosure: roles.semanticClosure,
  };
}

function exactElementResolution(bytes, inspected) {
  const artifact = jsonArtifactFromBytes(bytes, "Semantic catalog coverage element resolution");
  const expected = inspected.artifact.inputs.elementResolution;
  if (artifact.bytes.length !== expected.bytes || artifact.digest !== expected.digest) {
    throw new Error(
      `Semantic catalog coverage requires the exact element-resolution input ${expected.bytes} bytes at ${expected.digest}; received ${artifact.bytes.length} bytes at ${artifact.digest}.`,
    );
  }
  if (
    typeof artifact.value !== "object" ||
    artifact.value === null ||
    Array.isArray(artifact.value)
  ) {
    throw new Error(
      "Semantic catalog coverage element resolution must be an object by element id.",
    );
  }
  return artifact;
}

function exactManifest(bytes, inspected, expectation) {
  const artifact = jsonArtifactFromBytes(bytes, "Semantic catalog coverage callout manifest");
  const expected = inspected.artifact.inputs.calloutManifest;
  if (artifact.bytes.length !== expected.bytes || artifact.digest !== expected.digest) {
    throw new Error(
      `Semantic catalog coverage requires the exact full-booklet manifest ${expected.bytes} bytes at ${expected.digest}; received ${artifact.bytes.length} bytes at ${artifact.digest}.`,
    );
  }
  assertV6CalloutManifest(artifact.value, expectation);
  return artifact;
}

function requireElement(row, elements) {
  const element = elements[row.elementId];
  if (
    typeof element !== "object" ||
    element === null ||
    Array.isArray(element) ||
    element.partNum !== row.publishedPartNum ||
    element.colorId !== row.publishedColorId ||
    typeof element.name !== "string" ||
    element.name.length < 1 ||
    element.name.length > 512
  ) {
    throw new Error(
      `Verified semantic identity ${row.identity} does not reproduce its exact element ${row.elementId}, published part ${JSON.stringify(row.publishedPartNum)}, colour ${JSON.stringify(row.publishedColorId)}, and bounded name from element resolution.`,
    );
  }
  return element;
}

function projectVerifiedSemanticCoverage({
  semanticArtifact,
  semanticDigest,
  manifestArtifact,
  elementsArtifact,
  lastStep,
  expectedPartArtRows,
}) {
  const semanticRows = semanticArtifact.semanticIdentity;
  const semanticByIdentity = new Map(semanticRows.map((row) => [row.identity, row]));
  if (semanticByIdentity.size !== semanticRows.length) {
    throw new Error("Verified semantic coverage contains a duplicate callout identity.");
  }

  const byCallout = Object.create(null);
  const requirements = [];
  let usedSemanticRows = 0;
  let partArtRows = 0;
  for (const callout of manifestArtifact.value.callouts) {
    if (callout.evidenceKind !== "part-art") continue;
    partArtRows += 1;
    const binding = {
      identity: callout.identity,
      file: callout.file,
      pageNumber: callout.pageNumber,
      stepNumber: callout.stepNumber,
      quantity: callout.quantity,
      cropDigest: callout.sha256,
    };
    if (callout.stepNumber > lastStep) {
      byCallout[callout.identity] = {
        ...binding,
        inputDigest: manifestArtifact.digest,
        elementId: null,
        identificationConfidence: null,
        semanticEvidence: null,
        resolution: null,
        unidentifiedBecause: null,
      };
      continue;
    }
    const semantic = semanticByIdentity.get(callout.identity);
    if (
      semantic === undefined ||
      semantic.pageNumber !== callout.pageNumber ||
      semantic.stepNumber !== callout.stepNumber ||
      semantic.quantity !== callout.quantity
    ) {
      throw new Error(
        `Verified semantic closure does not bind exact first-${lastStep} callout ${callout.identity}; no coverage row can be manufactured for it.`,
      );
    }
    const element = requireElement(semantic, elementsArtifact.value);
    const resolution = resolveElementPart({
      elementId: semantic.elementId,
      partNum: semantic.publishedPartNum,
      name: element.name,
      colorId: semantic.publishedColorId,
    });
    byCallout[callout.identity] = {
      ...binding,
      inputDigest: semanticDigest,
      elementId: semantic.elementId,
      identificationConfidence: PREFIX50_SEMANTIC_IDENTIFICATION_CONFIDENCE,
      semanticEvidence: {
        evidenceMethod: semantic.evidenceMethod,
        officialDesignId: semantic.officialDesignId,
        publishedPartNum: semantic.publishedPartNum,
        publishedMatchesOfficialDesignId: semantic.publishedPartNum === semantic.officialDesignId,
      },
      resolution,
      unidentifiedBecause: null,
    };
    requirements.push({ stepNumber: callout.stepNumber, quantity: callout.quantity, resolution });
    usedSemanticRows += 1;
  }
  const expectedUsedRows = semanticRows.filter(({ stepNumber }) => stepNumber <= lastStep);
  if (
    partArtRows !== expectedPartArtRows ||
    usedSemanticRows !== expectedUsedRows.length ||
    expectedUsedRows.some(({ identity }) => byCallout[identity]?.elementId === null)
  ) {
    throw new Error(
      `Semantic coverage consumed ${usedSemanticRows}/${expectedUsedRows.length} requested identity rows across ${partArtRows}/${expectedPartArtRows} part-art source rows; expected one exact dense prefix projection.`,
    );
  }

  const catalogDigest = canonicalDigest(getCatalogSnapshotDigestInput());

  return {
    schemaVersion: SEMANTIC_CATALOG_COVERAGE_SCHEMA,
    inputDigests: {
      pdf: manifestArtifact.value.sourceHash,
      calloutManifest: manifestArtifact.digest,
      elementResolution: elementsArtifact.digest,
      prefix50SemanticClosure: semanticDigest,
      catalog: catalogDigest,
    },
    what: "Whether current catalog truth can place every semantically verified part-art callout in the requested opening prefix. The complete 359-step source index remains retained while no identity or action above the request is published.",
    identification: {
      source: "prefix50-semantic-closure",
      model: null,
      assignment: "exact-verified-semantic-identity",
    },
    catalog: {
      version: BUILTIN_CATALOG_VERSION,
      digest: catalogDigest,
    },
    expectedPrintedSteps: EXPECTED_PRINTED_STEPS,
    lastStep,
    suffixStepsReconstructed: false,
    calloutsConsidered: requirements.length,
    calloutsUnidentified: 0,
    coverage: summarizeCatalogCoverage(requirements),
    byCallout,
  };
}

function compileSnapshot(input, expectation = FULL_CALLOUT_MANIFEST_EXPECTATION) {
  const inspected = inspectVerifiedPartIdentificationPrefix50SemanticClosure(input.semanticClosure);
  const semanticArtifact = inspected.artifact;
  if (
    semanticArtifact.scope.firstPrintedStep !== 1 ||
    semanticArtifact.scope.lastPrintedStep !== 50 ||
    semanticArtifact.scope.expectedPrintedSteps !== EXPECTED_PRINTED_STEPS ||
    semanticArtifact.scope.suffixStepsReconstructed !== false ||
    semanticArtifact.accounting.closureRelations !== 187 ||
    semanticArtifact.accounting.closurePieces !== 320 ||
    semanticArtifact.sourceIndex.partArtRows !== 859 ||
    semanticArtifact.sourceIndex.prefixPartArtRows !== 187 ||
    semanticArtifact.sourceIndex.prefixPartArtPieces !== 320 ||
    semanticArtifact.sourceIndex.expectedPrintedSteps !== EXPECTED_PRINTED_STEPS ||
    semanticArtifact.sourceIndex.suffixStepsReconstructed !== false
  ) {
    throw new Error(
      "Semantic catalog coverage requires the exact verified 187-relation / 320-piece first-50 closure over the retained 859-row / 359-step source index.",
    );
  }
  return projectVerifiedSemanticCoverage({
    semanticArtifact,
    semanticDigest: inspected.digest,
    manifestArtifact: exactManifest(input.manifestBytes, inspected, expectation),
    elementsArtifact: exactElementResolution(input.elementResolutionBytes, inspected),
    lastStep: input.lastStep,
    expectedPartArtRows: 859,
  });
}

export function encodeSemanticBookletCatalogCoverage(value) {
  return Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
}

export async function compileSemanticBookletCatalogCoverage(input) {
  const snapshot = snapshotInput(input, COMPILE_KEYS, "Semantic catalog coverage compiler input");
  await Promise.resolve();
  return compileSnapshot(snapshot);
}

export async function verifySemanticBookletCatalogCoverage(input) {
  const snapshot = snapshotInput(input, VERIFY_KEYS, "Semantic catalog coverage verifier input");
  await Promise.resolve();
  const expected = compileSnapshot(snapshot);
  const bytes = encodeSemanticBookletCatalogCoverage(expected);
  if (!isDeepStrictEqual(Buffer.from(snapshot.coverageBytes), bytes)) {
    throw new Error(
      "Semantic catalog coverage bytes do not independently reproduce from the exact full-booklet manifest, element resolution, current catalog, and opaque prefix-50 semantic verifier result.",
    );
  }
  return expected;
}

export const __testOnly = Object.freeze({
  compileSnapshot: (input, expectation) => compileSnapshot(input, expectation),
  projectVerifiedSemanticCoverage,
});
