import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readBoundedFile, writeContainedFile } from "./part-identification-io.mjs";
import {
  compilePartIdentificationSourceArtRebound,
  inspectVerifiedPartIdentificationSourceArtRebound,
  verifyPartIdentificationSourceArtReboundClosure,
} from "./part-identification-source-art-rebound.mjs";

const PDF_PATH = "recipes/6651557.pdf";
const MANIFEST_PATH = "output/callout-thumbnails/manifest.json";
const OUTPUT_ROOT = "output/part-identification";
const OUTPUT_FILE = "source-art-rebound.json";
const MAX_PDF_BYTES = 80 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 256 * 1024;

function requireInput(path, recovery) {
  if (!existsSync(path)) throw new Error(`Missing ${path}. ${recovery}`);
}

export async function runPartIdentificationSourceArtReboundCli() {
  requireInput(
    PDF_PATH,
    "Restore the exact authenticated instruction booklet before compiling source-art evidence.",
  );
  requireInput(
    MANIFEST_PATH,
    "Regenerate the complete v6 callout manifest before compiling source-art evidence.",
  );
  const pdfBytes = readBoundedFile(PDF_PATH, {
    label: "Source-art rebound instruction-booklet PDF",
    maxBytes: MAX_PDF_BYTES,
  });
  const manifestBytes = readBoundedFile(MANIFEST_PATH, {
    label: "Source-art rebound callout manifest",
    maxBytes: MAX_MANIFEST_BYTES,
  });
  const artifactBytes = await compilePartIdentificationSourceArtRebound({
    manifestBytes,
    pdfBytes,
  });
  const verified = await verifyPartIdentificationSourceArtReboundClosure({
    artifactBytes,
    manifestBytes,
    pdfBytes,
  });
  const projection = inspectVerifiedPartIdentificationSourceArtRebound(verified);
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  writeContainedFile(OUTPUT_ROOT, OUTPUT_FILE, artifactBytes, {
    label: "Source-art rebound artifact",
    maxBytes: MAX_ARTIFACT_BYTES,
  });
  console.log(
    `wrote ${OUTPUT_ROOT}/${OUTPUT_FILE} | ${artifactBytes.length} bytes | ${projection.artifactSha256}`,
  );
  return projection;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await runPartIdentificationSourceArtReboundCli();
}
