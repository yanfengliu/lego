import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { snapshotExactDataObject } from "./part-identification-bounded-snapshot.mjs";
import { readBoundedFile, writeContainedFile } from "./part-identification-io.mjs";
import { CURRENT_LEGACY_RECUT_PINS } from "./part-identification-legacy-recut.mjs";
import {
  CURRENT_LEGACY_RECUT_SEMANTIC_PINS,
  bytesFromVerifiedPartIdentificationLegacyRecutSemantic,
  compilePartIdentificationLegacyRecutSemantic,
  encodePartIdentificationLegacyRecutSemantic,
  inspectVerifiedPartIdentificationLegacyRecutSemantic,
  isVerifiedPartIdentificationLegacyRecutSemantic,
  verifyPartIdentificationLegacyRecutSemantic,
} from "./part-identification-legacy-recut-semantic.mjs";

const CALLOUT_ROOT = "output/callout-thumbnails";
const OUTPUT_ROOT = "output/part-identification";
const OUTPUT_FILE = "legacy-recut-semantic.json";
const MAX_OUTPUT_BYTES = 256 * 1024;
const WORKFLOW_STAGES = Object.freeze(["compile", "verify", "published-byte-rebound"]);
const MAX_WORKFLOW_CROP_IMAGES = 510;
const MAX_WORKFLOW_DECODE_PIXELS = 50_331_648;
const MAX_WORKFLOW_OFFICIAL_MODEL_INDEX_CALLS = 3;
const MAX_WORKFLOW_OFFICIAL_MODEL_INPUT_BYTES = 6_291_456;
const MAX_WORKFLOW_OFFICIAL_XML_FULL_DECODES = 6;
const MAX_WORKFLOW_OFFICIAL_XML_DECODED_BYTES = 12_582_912;
const PER_COMPILE_WORK_KEYS = [
  "legacyRecutCropImages",
  "legacyRecutDecodePixelLimit",
  "legacyRecutDecodePixels",
  "officialModelIndexCalls",
  "officialModelInputByteLimit",
  "officialModelInputBytes",
  "officialXmlDecodeByteLimit",
  "officialXmlDecodedBytes",
  "officialXmlFullDecodes",
];

function snapshotPerCompileWork(perCompileWork) {
  const work = snapshotExactDataObject(
    perCompileWork,
    "Legacy-recut semantic per-compile work",
    PER_COMPILE_WORK_KEYS,
  );
  const values = PER_COMPILE_WORK_KEYS.map((key) => work[key]);
  if (
    values.some((value) => typeof value !== "number" || !Number.isSafeInteger(value)) ||
    work.legacyRecutCropImages < 1 ||
    work.legacyRecutDecodePixels < 1 ||
    work.legacyRecutDecodePixelLimit < work.legacyRecutDecodePixels ||
    work.officialModelIndexCalls !== 1 ||
    work.officialModelInputBytes < 1 ||
    work.officialModelInputByteLimit < work.officialModelInputBytes ||
    work.officialXmlFullDecodes !== 2 ||
    work.officialXmlDecodedBytes !== work.officialModelInputBytes * work.officialXmlFullDecodes ||
    work.officialXmlDecodeByteLimit < work.officialXmlDecodedBytes
  ) {
    throw new Error(
      `Legacy-recut semantic CLI received malformed per-compile work ${JSON.stringify(work)}.`,
    );
  }
  return work;
}

function workflowReport(work, compilePasses) {
  const observed = {
    compilePasses,
    cropImages: work.legacyRecutCropImages * compilePasses,
    cropImageLimit: MAX_WORKFLOW_CROP_IMAGES,
    decodePixels: work.legacyRecutDecodePixels * compilePasses,
    decodePixelLimit: MAX_WORKFLOW_DECODE_PIXELS,
    officialModelIndexCalls: work.officialModelIndexCalls * compilePasses,
    officialModelIndexCallLimit: MAX_WORKFLOW_OFFICIAL_MODEL_INDEX_CALLS,
    officialModelInputBytes: work.officialModelInputBytes * compilePasses,
    officialModelInputByteLimit: MAX_WORKFLOW_OFFICIAL_MODEL_INPUT_BYTES,
    officialXmlFullDecodes: work.officialXmlFullDecodes * compilePasses,
    officialXmlFullDecodeLimit: MAX_WORKFLOW_OFFICIAL_XML_FULL_DECODES,
    officialXmlDecodedBytes: work.officialXmlDecodedBytes * compilePasses,
    officialXmlDecodeByteLimit: MAX_WORKFLOW_OFFICIAL_XML_DECODED_BYTES,
  };
  if (
    !Object.values(observed).every(Number.isSafeInteger) ||
    observed.cropImages > observed.cropImageLimit ||
    work.legacyRecutDecodePixelLimit * compilePasses > observed.decodePixelLimit ||
    observed.decodePixels > observed.decodePixelLimit ||
    observed.officialModelIndexCalls > observed.officialModelIndexCallLimit ||
    work.officialModelInputByteLimit * compilePasses > observed.officialModelInputByteLimit ||
    observed.officialModelInputBytes > observed.officialModelInputByteLimit ||
    observed.officialXmlFullDecodes > observed.officialXmlFullDecodeLimit ||
    work.officialXmlDecodeByteLimit * compilePasses > observed.officialXmlDecodeByteLimit ||
    observed.officialXmlDecodedBytes > observed.officialXmlDecodeByteLimit
  ) {
    throw new Error(
      `Legacy-recut semantic CLI workflow ${JSON.stringify(observed)} exceeds its fixed crop, decoded-pixel, model-index, XML-input, or full-decode cap. Reduce work or reservations; do not raise the limits.`,
    );
  }
  return Object.freeze(observed);
}

export function createLegacyRecutSemanticCliWorkflowLedger(perCompileWork) {
  const work = snapshotPerCompileWork(perCompileWork);
  workflowReport(work, WORKFLOW_STAGES.length);
  const reservations = [];
  return Object.freeze({
    async run(stage, operation) {
      const expected = WORKFLOW_STAGES[reservations.length];
      if (stage !== expected || typeof operation !== "function") {
        throw new Error(
          `Legacy-recut semantic CLI reservation ${reservations.length + 1} must be ${JSON.stringify(expected ?? "none; workflow already complete")}; received ${JSON.stringify(stage)}. A fourth protected operation is forbidden before it can read inputs or do work.`,
        );
      }
      reservations.push(stage);
      return operation();
    },
    report() {
      if (reservations.length !== WORKFLOW_STAGES.length) {
        throw new Error(
          `Legacy-recut semantic CLI completed ${reservations.length} of ${WORKFLOW_STAGES.length} required protected operations.`,
        );
      }
      return workflowReport(work, reservations.length);
    },
  });
}

function inputBytes() {
  return {
    calloutRoot: CALLOUT_ROOT,
    currentManifestBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.currentManifest.path, {
      label: "Pinned current /6 callout manifest",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.currentManifest.bytes,
    }),
    legacyManifestBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path, {
      label: "Pinned legacy /5 callout manifest",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.legacyManifest.bytes,
    }),
    legacyRecutArtifactBytes: readBoundedFile(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.path, {
      label: "Pinned verified legacy-recut artifact",
      maxBytes: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.legacyRecut.bytes,
    }),
    officialModelBytes: readBoundedFile(CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.path, {
      label: "Pinned official model XML",
      maxBytes: CURRENT_LEGACY_RECUT_SEMANTIC_PINS.officialModel.bytes,
    }),
    truthBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.truth.path, {
      label: "Pinned pair-judged truth/3",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.truth.bytes,
    }),
  };
}

function writePublishedBytes(bytes) {
  writeContainedFile(OUTPUT_ROOT, OUTPUT_FILE, bytes, {
    label: "Legacy-recut semantic diagnostic artifact",
    maxBytes: MAX_OUTPUT_BYTES,
  });
}

function readPublishedBytes() {
  return readBoundedFile(`${OUTPUT_ROOT}/${OUTPUT_FILE}`, {
    label: "Published legacy-recut semantic diagnostic artifact",
    maxBytes: MAX_OUTPUT_BYTES,
  });
}

const PRODUCTION_DEPENDENCIES = Object.freeze({
  inputBytes,
  compile: compilePartIdentificationLegacyRecutSemantic,
  encode: encodePartIdentificationLegacyRecutSemantic,
  verify: verifyPartIdentificationLegacyRecutSemantic,
  isVerified: isVerifiedPartIdentificationLegacyRecutSemantic,
  verifiedBytes: bytesFromVerifiedPartIdentificationLegacyRecutSemantic,
  inspect: inspectVerifiedPartIdentificationLegacyRecutSemantic,
  writePublishedBytes,
  readPublishedBytes,
});

export async function runLegacyRecutSemanticCliWorkflow(dependencies = PRODUCTION_DEPENDENCIES) {
  const ledger = createLegacyRecutSemanticCliWorkflowLedger(
    CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
  );
  const compiledBytes = await ledger.run("compile", async () =>
    dependencies.encode(await dependencies.compile(dependencies.inputBytes())),
  );
  if (compiledBytes.length > MAX_OUTPUT_BYTES) {
    throw new Error(
      `Legacy-recut semantic artifact is ${compiledBytes.length} bytes, above the fixed ${MAX_OUTPUT_BYTES}-byte publication limit. Narrow the diagnostic payload before publishing it.`,
    );
  }
  const verified = await ledger.run("verify", () =>
    dependencies.verify({
      ...dependencies.inputBytes(),
      artifactBytes: compiledBytes,
    }),
  );
  if (!dependencies.isVerified(verified)) {
    throw new Error(
      "Legacy-recut semantic publication requires its module-owned independent verifier.",
    );
  }
  dependencies.writePublishedBytes(dependencies.verifiedBytes(verified));
  const rebound = await ledger.run("published-byte-rebound", () =>
    dependencies.verify({
      ...dependencies.inputBytes(),
      artifactBytes: dependencies.readPublishedBytes(),
    }),
  );
  const inspection = dependencies.inspect(rebound);
  if (
    !isDeepStrictEqual(
      inspection.artifact.perCompileWork,
      CURRENT_LEGACY_RECUT_SEMANTIC_PINS.expectedPerCompileWork,
    )
  ) {
    throw new Error(
      "Legacy-recut semantic CLI observed work differs from its pre-work three-pass disclosure.",
    );
  }
  return Object.freeze({
    inspection,
    publishedBytes: dependencies.verifiedBytes(rebound),
    workflow: ledger.report(),
  });
}

export async function main() {
  const result = await runLegacyRecutSemanticCliWorkflow();
  const inspection = result.inspection;
  console.log(
    JSON.stringify({
      file: `${OUTPUT_ROOT}/${OUTPUT_FILE}`,
      bytes: result.publishedBytes.length,
      digest: inspection.digest,
      sourceIndex: inspection.artifact.sourceIndex,
      accounting: inspection.artifact.accounting,
      workflow: result.workflow,
      quarantine: inspection.artifact.quarantinedSameRelations.map((row) => ({
        n: row.n,
        identity: row.identity,
        stepNumber: row.stepNumber,
        quantity: row.quantity,
        elementId: row.elementId,
        reason: row.quarantineReason,
      })),
      authority: inspection.artifact.authority,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
