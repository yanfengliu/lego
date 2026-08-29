import { basename } from "node:path";
import { pathToFileURL } from "node:url";

import { publishContainedArtifactWithoutOverwrite } from "./part-identification-counterevidence-archive.mjs";
import { reproduceCurrentPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation-current.mjs";
import { assertPublishedCounterevidenceBoundary } from "./part-identification-prefix50-action-preparation-publication-policy.mjs";
import {
  PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
  PREFIX50_ACTION_PREPARATION_OUTPUT_PATH,
} from "./part-identification-prefix50-action-preparation-source.mjs";
import {
  bytesFromVerifiedPrefix50ActionPreparation,
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
  verifyPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";

const OUTPUT_ROOT = "output/real-build";
const OUTPUT_FILE = basename(PREFIX50_ACTION_PREPARATION_OUTPUT_PATH);
function publishVerifiedActionPreparation(verified) {
  if (!isVerifiedPrefix50ActionPreparation(verified)) {
    throw new TypeError(
      "Prefix-50 action-preparation publication requires its opaque in-memory verifier result.",
    );
  }
  const verifiedBytes = bytesFromVerifiedPrefix50ActionPreparation(verified);
  const inspection = inspectVerifiedPrefix50ActionPreparation(verified);
  assertPublishedCounterevidenceBoundary(inspection.artifact);
  return publishContainedArtifactWithoutOverwrite({
    archiveNameStem: "action-preparation",
    currentFile: OUTPUT_FILE,
    label: "Prefix-50 action preparation",
    maxBytes: PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
    nextBytes: verifiedBytes,
    outputRoot: OUTPUT_ROOT,
  });
}

export async function runPrefix50ActionPreparationCli(argv = process.argv.slice(2), context = {}) {
  const stdout = context.stdout ?? console.log;
  if (argv.length !== 0) {
    throw new TypeError("Prefix-50 action-preparation generation accepts no caller arguments.");
  }
  const reproduced = await reproduceCurrentPrefix50ActionPreparation();
  const verified = await verifyPrefix50ActionPreparation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  if (!isVerifiedPrefix50ActionPreparation(verified)) {
    throw new TypeError(
      "Prefix-50 action-preparation verifier did not return its opaque authority object; retained evidence was not touched.",
    );
  }
  const verifiedBytes = bytesFromVerifiedPrefix50ActionPreparation(verified);
  if (!verifiedBytes.equals(reproduced.bytes)) {
    throw new TypeError(
      "Prefix-50 action-preparation verifier bytes differ from the fresh reproduction; retained evidence was not touched.",
    );
  }
  const inspection = inspectVerifiedPrefix50ActionPreparation(verified);
  const publication = publishVerifiedActionPreparation(verified);
  if (publication.state === "review-required") {
    throw new TypeError(
      `Prefix-50 action preparation retained differing current evidence at ${publication.currentPath}; verified replacement candidate is ${publication.candidate.path} at ${publication.digest}. Review and move the retained current file explicitly before rerunning; automation never overwrites an existing differing pathname.`,
    );
  }
  stdout(
    `${publication.state === "published-current" ? "wrote" : "verified"} ${PREFIX50_ACTION_PREPARATION_OUTPUT_PATH}: ${verifiedBytes.length} bytes at ${inspection.digest}`,
  );
  stdout(
    [
      `printed steps ${inspection.artifact.accounting.printedStepRows}`,
      `callouts ${inspection.artifact.accounting.calloutRows}`,
      `identities ${inspection.artifact.accounting.physicalIdentities}`,
      `phases ${inspection.artifact.accounting.builderPhases}`,
      "authority local-diagnostic-only",
    ].join(" | "),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50ActionPreparationCli();
