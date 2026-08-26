import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { writeContainedFile } from "./part-identification-io.mjs";
import {
  PREFIX50_SEMANTIC_CLOSURE_OUTPUT_PATH,
  verifyCurrentPrefix50SemanticClosure,
} from "./part-identification-prefix50-semantic-closure-current.mjs";

export async function runPartIdentificationPrefix50SemanticClosureCli() {
  const result = await verifyCurrentPrefix50SemanticClosure();
  const outputRoot = "output/part-identification";
  mkdirSync(outputRoot, { recursive: true });
  writeContainedFile(outputRoot, "prefix50-semantic-closure.json", result.bytes, {
    label: "Prefix-50 semantic closure",
    pathLabel: "Prefix-50 semantic closure path",
    maxBytes: 256 * 1024,
  });
  console.log(
    `wrote ${PREFIX50_SEMANTIC_CLOSURE_OUTPUT_PATH}: ${result.bytes.length} bytes at ${result.inspection.digest}`,
  );
  return result;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPartIdentificationPrefix50SemanticClosureCli();
