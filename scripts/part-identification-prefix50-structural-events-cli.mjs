import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { writeContainedFile } from "./part-identification-io.mjs";
import {
  reproduceCurrentPrefix50StructuralEvents,
  verifyCurrentPrefix50StructuralEvents,
} from "./part-identification-prefix50-structural-events-current.mjs";
import {
  PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES,
  PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH,
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS,
} from "./part-identification-prefix50-structural-events-source.mjs";

export async function runPartIdentificationPrefix50StructuralEventsCli() {
  const reproduced = await reproduceCurrentPrefix50StructuralEvents();
  const expected = CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.expectedArtifact;
  const digest = sha256Digest(reproduced.bytes);
  if (expected === null) {
    throw new Error("Prefix-50 structural-event generation has no reviewed artifact pin.");
  }
  if (reproduced.bytes.length !== expected.bytes || digest !== expected.digest) {
    throw new Error(
      `Prefix-50 structural-event generation reproduced ${reproduced.bytes.length} bytes at ${digest}, not reviewed ${expected.bytes} bytes at ${expected.digest}; retained evidence was not overwritten.`,
    );
  }
  const outputRoot = "output/real-build";
  mkdirSync(outputRoot, { recursive: true });
  writeContainedFile(outputRoot, "prefix50-structural-events.json", reproduced.bytes, {
    label: "Prefix-50 structural events",
    pathLabel: "Prefix-50 structural-event path",
    maxBytes: PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES,
  });
  const verified = await verifyCurrentPrefix50StructuralEvents();
  console.log(
    `wrote ${PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH}: ${verified.bytes.length} bytes at ${verified.inspection.digest}`,
  );
  return verified;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPartIdentificationPrefix50StructuralEventsCli();
