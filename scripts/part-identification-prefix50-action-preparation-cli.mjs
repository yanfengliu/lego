import { pathToFileURL } from "node:url";

import { writeContainedFile } from "./part-identification-io.mjs";
import { reproduceCurrentPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation-current.mjs";
import {
  PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
  PREFIX50_ACTION_PREPARATION_OUTPUT_PATH,
} from "./part-identification-prefix50-action-preparation-source.mjs";
import {
  inspectVerifiedPrefix50ActionPreparation,
  verifyPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";

export async function runPrefix50ActionPreparationCli() {
  const reproduced = await reproduceCurrentPrefix50ActionPreparation();
  const verified = await verifyPrefix50ActionPreparation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  const inspection = inspectVerifiedPrefix50ActionPreparation(verified);
  writeContainedFile("output/real-build", "action-preparation.json", reproduced.bytes, {
    label: "Prefix-50 action preparation",
    pathLabel: "Prefix-50 action-preparation path",
    maxBytes: PREFIX50_ACTION_PREPARATION_MAX_ARTIFACT_BYTES,
  });
  console.log(
    `wrote ${PREFIX50_ACTION_PREPARATION_OUTPUT_PATH}: ${reproduced.bytes.length} bytes at ${inspection.digest}`,
  );
  console.log(
    [
      `printed steps ${reproduced.artifact.accounting.printedStepRows}`,
      `callouts ${reproduced.artifact.accounting.calloutRows}`,
      `identities ${reproduced.artifact.accounting.physicalIdentities}`,
      `phases ${reproduced.artifact.accounting.builderPhases}`,
      "authority local-diagnostic-only",
    ].join(" | "),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50ActionPreparationCli();
