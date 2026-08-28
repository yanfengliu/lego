import { pathToFileURL } from "node:url";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import { writeContainedFile } from "./part-identification-io.mjs";
import {
  reproduceCurrentPrefix50OfficialWorldReconciliation,
  verifyCurrentPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation-current.mjs";
import {
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS,
} from "./part-identification-prefix50-official-world-reconciliation-source.mjs";

export async function runPrefix50OfficialWorldReconciliationCli() {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const digest = sha256Digest(reproduced.bytes);
  const expected = PREFIX50_OFFICIAL_WORLD_RECONCILIATION_PINS.expectedArtifact;
  if (expected === null) {
    throw new TypeError("Official-world reconciliation generation has no reviewed artifact pin.");
  }
  if (reproduced.bytes.length !== expected.bytes || digest !== expected.digest) {
    throw new TypeError(
      `Official-world reconciliation reproduced ${reproduced.bytes.length} bytes at ${digest}, not reviewed ${expected.bytes} bytes at ${expected.digest}; retained evidence was not overwritten.`,
    );
  }
  writeContainedFile(
    "output/real-build",
    "prefix50-official-world-reconciliation.json",
    reproduced.bytes,
    {
      label: "Official-world reconciliation",
      pathLabel: "Official-world reconciliation output path",
      maxBytes: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
    },
  );
  await verifyCurrentPrefix50OfficialWorldReconciliation();
  console.log(
    `wrote ${PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH}: ${reproduced.bytes.length} bytes at ${digest}`,
  );
  console.log(
    [
      `rows ${reproduced.artifact.accounting.occurrenceRows}`,
      `reconciled ${reproduced.artifact.accounting.reconciledRows}`,
      `quarantined ${reproduced.artifact.accounting.quarantinedRows}`,
      `first-eight components ${reproduced.artifact.firstEightConnectorTopology.components}`,
      "authority proposal-only",
    ].join(" | "),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50OfficialWorldReconciliationCli();
