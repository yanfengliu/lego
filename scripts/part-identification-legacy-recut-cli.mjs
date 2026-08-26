import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readBoundedFile, writeContainedFile } from "./part-identification-io.mjs";
import {
  CURRENT_LEGACY_RECUT_PINS,
  bytesFromVerifiedPartIdentificationLegacyRecut,
  compilePartIdentificationLegacyRecut,
  encodePartIdentificationLegacyRecut,
  inspectVerifiedPartIdentificationLegacyRecut,
  isVerifiedPartIdentificationLegacyRecut,
  verifyPartIdentificationLegacyRecut,
} from "./part-identification-legacy-recut.mjs";

const CALLOUT_ROOT = "output/callout-thumbnails";
const OUTPUT_ROOT = "output/part-identification";
const OUTPUT_FILE = "legacy-recut.json";
const MAX_OUTPUT_BYTES = 512 * 1024;
const WORKFLOW_COMPILE_PASSES = 3;

export function summarizeLegacyRecutCliWorkflow(accounting) {
  const perCompileImages = accounting.perCompileSelectedCropImages;
  const perCompilePixels = accounting.perCompileDecodePixels;
  const perCompileLimit = accounting.perCompileDecodePixelLimit;
  if (
    ![perCompileImages, perCompilePixels, perCompileLimit].every(Number.isSafeInteger) ||
    perCompileImages < 1 ||
    perCompilePixels < 1 ||
    perCompileLimit < perCompilePixels
  ) {
    throw new Error(
      `Legacy-recut CLI received malformed per-compile decode accounting ${JSON.stringify({ perCompileImages, perCompilePixels, perCompileLimit })}.`,
    );
  }
  return Object.freeze({
    compilePasses: WORKFLOW_COMPILE_PASSES,
    cropImages: perCompileImages * WORKFLOW_COMPILE_PASSES,
    decodePixels: perCompilePixels * WORKFLOW_COMPILE_PASSES,
    decodePixelLimit: perCompileLimit * WORKFLOW_COMPILE_PASSES,
  });
}

function inputBytes() {
  return {
    legacyManifestBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.legacyManifest.path, {
      label: "Pinned legacy /5 callout manifest",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.legacyManifest.bytes,
    }),
    currentManifestBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.currentManifest.path, {
      label: "Pinned current /6 callout manifest",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.currentManifest.bytes,
    }),
    truthBytes: readBoundedFile(CURRENT_LEGACY_RECUT_PINS.truth.path, {
      label: "Pinned pair-judged truth/3",
      maxBytes: CURRENT_LEGACY_RECUT_PINS.truth.bytes,
    }),
    calloutRoot: CALLOUT_ROOT,
  };
}

export function main() {
  const compiledBytes = encodePartIdentificationLegacyRecut(
    compilePartIdentificationLegacyRecut(inputBytes()),
  );
  if (compiledBytes.length > MAX_OUTPUT_BYTES) {
    throw new Error(
      `Legacy-recut artifact is ${compiledBytes.length} bytes, above the fixed ${MAX_OUTPUT_BYTES}-byte publication limit. Narrow the diagnostic payload before publishing it.`,
    );
  }
  const verified = verifyPartIdentificationLegacyRecut({
    ...inputBytes(),
    artifactBytes: compiledBytes,
  });
  if (!isVerifiedPartIdentificationLegacyRecut(verified)) {
    throw new Error("Legacy-recut publication requires its module-owned independent verifier.");
  }
  writeContainedFile(
    OUTPUT_ROOT,
    OUTPUT_FILE,
    bytesFromVerifiedPartIdentificationLegacyRecut(verified),
    {
      label: "Legacy-recut diagnostic artifact",
      maxBytes: MAX_OUTPUT_BYTES,
    },
  );
  const rebound = verifyPartIdentificationLegacyRecut({
    ...inputBytes(),
    artifactBytes: readBoundedFile(`${OUTPUT_ROOT}/${OUTPUT_FILE}`, {
      label: "Published legacy-recut diagnostic artifact",
      maxBytes: MAX_OUTPUT_BYTES,
    }),
  });
  const reboundInspection = inspectVerifiedPartIdentificationLegacyRecut(rebound);
  console.log(
    JSON.stringify({
      file: `${OUTPUT_ROOT}/${OUTPUT_FILE}`,
      bytes: bytesFromVerifiedPartIdentificationLegacyRecut(rebound).length,
      digest: reboundInspection.digest,
      sourceIndex: reboundInspection.artifact.sourceIndex,
      accounting: reboundInspection.artifact.accounting,
      workflowDecode: summarizeLegacyRecutCliWorkflow(reboundInspection.artifact.accounting),
      authority: reboundInspection.artifact.authority,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
