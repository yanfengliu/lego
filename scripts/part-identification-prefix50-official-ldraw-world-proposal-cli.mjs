import { pathToFileURL } from "node:url";

import { writeContainedFile } from "./part-identification-io.mjs";
import { sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  reproduceCurrentPrefix50OfficialLdrawWorldProposal,
  verifyCurrentPrefix50OfficialLdrawWorldProposal,
} from "./part-identification-prefix50-official-ldraw-world-proposal-current.mjs";
import {
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

export async function runPrefix50OfficialLdrawWorldProposalCli() {
  const reproduced = await reproduceCurrentPrefix50OfficialLdrawWorldProposal();
  writeContainedFile(
    "output/real-build",
    "prefix50-official-ldraw-world-proposal.json",
    reproduced.bytes,
    {
      label: "Official XML/LDraw world proposal",
      pathLabel: "Official XML/LDraw world-proposal path",
      maxBytes: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
    },
  );
  const digest = sha256Digest(reproduced.bytes);
  if (PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_PINS.expectedArtifact !== null) {
    await verifyCurrentPrefix50OfficialLdrawWorldProposal();
  }
  console.log(
    `wrote ${PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH}: ${reproduced.bytes.length} bytes at ${digest}`,
  );
  console.log(
    [
      `actions ${reproduced.artifact.accounting.actionRows}`,
      `projectable ${reproduced.artifact.accounting.projectableActionRows}`,
      `quarantined ${reproduced.artifact.accounting.quarantinedActionRows}`,
      `flattened leaves ${reproduced.artifact.accounting.flattenedLeafRows}`,
      "authority local-diagnostic-proposal-only",
    ].join(" | "),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50OfficialLdrawWorldProposalCli();
