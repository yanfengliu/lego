import { basename } from "node:path";
import { pathToFileURL } from "node:url";

import { publishContainedArtifactWithoutOverwrite } from "./part-identification-counterevidence-archive.mjs";
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "./part-identification-prefix50-official-world-reconciliation-current.mjs";
import {
  bytesFromVerifiedPrefix50OfficialWorldReconciliation,
  inspectVerifiedPrefix50OfficialWorldReconciliation,
  isVerifiedPrefix50OfficialWorldReconciliation,
  verifyPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation.mjs";
import {
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH,
} from "./part-identification-prefix50-official-world-reconciliation-source.mjs";

const OUTPUT_ROOT = "output/real-build";
const OUTPUT_FILE = basename(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH);

function publishVerifiedReconciliation(verified) {
  if (!isVerifiedPrefix50OfficialWorldReconciliation(verified)) {
    throw new TypeError(
      "Official-world reconciliation publication requires its opaque in-memory verifier result.",
    );
  }
  return publishContainedArtifactWithoutOverwrite({
    archiveNameStem: "prefix50-official-world-reconciliation",
    currentFile: OUTPUT_FILE,
    label: "Official-world reconciliation",
    maxBytes: PREFIX50_OFFICIAL_WORLD_RECONCILIATION_MAX_ARTIFACT_BYTES,
    nextBytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(verified),
    outputRoot: OUTPUT_ROOT,
  });
}

export async function runPrefix50OfficialWorldReconciliationCli(
  argv = process.argv.slice(2),
  context = {},
) {
  const stdout = context.stdout ?? console.log;
  if (argv.length !== 0) {
    throw new TypeError("Official-world reconciliation generation accepts no caller arguments.");
  }
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const verified = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  if (!isVerifiedPrefix50OfficialWorldReconciliation(verified)) {
    throw new TypeError(
      "Official-world reconciliation verifier did not return its opaque authority object; retained evidence was not touched.",
    );
  }
  const verifiedBytes = bytesFromVerifiedPrefix50OfficialWorldReconciliation(verified);
  if (!verifiedBytes.equals(reproduced.bytes)) {
    throw new TypeError(
      "Official-world reconciliation verifier bytes differ from the fresh reproduction; retained evidence was not touched.",
    );
  }
  const inspection = inspectVerifiedPrefix50OfficialWorldReconciliation(verified);
  const publication = publishVerifiedReconciliation(verified);
  if (publication.state === "review-required") {
    throw new TypeError(
      `Official-world reconciliation retained differing current evidence at ${publication.currentPath}; verified replacement candidate is ${publication.candidate.path} at ${publication.digest}. Review and move the retained current file explicitly before rerunning; automation never overwrites an existing differing pathname.`,
    );
  }
  stdout(
    `${publication.state === "published-current" ? "wrote" : "verified"} ${PREFIX50_OFFICIAL_WORLD_RECONCILIATION_OUTPUT_PATH}: ${verifiedBytes.length} bytes at ${inspection.digest}`,
  );
  stdout(
    [
      `rows ${inspection.artifact.accounting.occurrenceRows}`,
      `reconciled ${inspection.artifact.accounting.reconciledRows}`,
      `quarantined ${inspection.artifact.accounting.quarantinedRows}`,
      `first-eight components ${inspection.artifact.firstEightConnectorTopology.components}`,
      "authority proposal-only",
    ].join(" | "),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50OfficialWorldReconciliationCli();
