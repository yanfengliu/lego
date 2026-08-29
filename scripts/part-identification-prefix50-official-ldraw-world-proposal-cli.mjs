import { basename } from "node:path";
import { pathToFileURL } from "node:url";

import { publishContainedArtifactWithoutOverwrite } from "./part-identification-counterevidence-archive.mjs";
import { reproduceCurrentPrefix50OfficialLdrawWorldProposal } from "./part-identification-prefix50-official-ldraw-world-proposal-current.mjs";
import {
  bytesFromVerifiedPrefix50OfficialLdrawWorldProposal,
  inspectVerifiedPrefix50OfficialLdrawWorldProposal,
  isVerifiedPrefix50OfficialLdrawWorldProposal,
  verifyPrefix50OfficialLdrawWorldProposal,
} from "./part-identification-prefix50-official-ldraw-world-proposal.mjs";
import {
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
  PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH,
} from "./part-identification-prefix50-official-ldraw-world-proposal-source.mjs";

const OUTPUT_ROOT = "output/real-build";
const OUTPUT_FILE = basename(PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH);

function publishVerifiedProposal(verified) {
  if (!isVerifiedPrefix50OfficialLdrawWorldProposal(verified)) {
    throw new TypeError(
      "Official XML/LDraw world-proposal publication requires its opaque in-memory verifier result.",
    );
  }
  return publishContainedArtifactWithoutOverwrite({
    archiveNameStem: "prefix50-official-ldraw-world-proposal",
    currentFile: OUTPUT_FILE,
    label: "Official XML/LDraw world proposal",
    maxBytes: PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_MAX_ARTIFACT_BYTES,
    nextBytes: bytesFromVerifiedPrefix50OfficialLdrawWorldProposal(verified),
    outputRoot: OUTPUT_ROOT,
  });
}

export async function runPrefix50OfficialLdrawWorldProposalCli(
  argv = process.argv.slice(2),
  context = {},
) {
  const stdout = context.stdout ?? console.log;
  if (argv.length !== 0) {
    throw new TypeError(
      "Official XML/LDraw world-proposal generation accepts no caller arguments.",
    );
  }
  const reproduced = await reproduceCurrentPrefix50OfficialLdrawWorldProposal();
  const verified = await verifyPrefix50OfficialLdrawWorldProposal({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  if (!isVerifiedPrefix50OfficialLdrawWorldProposal(verified)) {
    throw new TypeError(
      "Official XML/LDraw world-proposal verifier did not return its opaque authority object; retained evidence was not touched.",
    );
  }
  const verifiedBytes = bytesFromVerifiedPrefix50OfficialLdrawWorldProposal(verified);
  if (!verifiedBytes.equals(reproduced.bytes)) {
    throw new TypeError(
      "Official XML/LDraw world-proposal verifier bytes differ from the fresh reproduction; retained evidence was not touched.",
    );
  }
  const inspection = inspectVerifiedPrefix50OfficialLdrawWorldProposal(verified);
  const publication = publishVerifiedProposal(verified);
  if (publication.state === "review-required") {
    throw new TypeError(
      `Official XML/LDraw world proposal retained differing current evidence at ${publication.currentPath}; verified replacement candidate is ${publication.candidate.path} at ${publication.digest}. Review and move the retained current file explicitly before rerunning; automation never overwrites an existing differing pathname.`,
    );
  }
  stdout(
    `${publication.state === "published-current" ? "wrote" : "verified"} ${PREFIX50_OFFICIAL_LDRAW_WORLD_PROPOSAL_OUTPUT_PATH}: ${verifiedBytes.length} bytes at ${inspection.digest}`,
  );
  stdout(
    [
      `actions ${inspection.artifact.accounting.actionRows}`,
      `projectable ${inspection.artifact.accounting.projectableActionRows}`,
      `quarantined ${inspection.artifact.accounting.quarantinedActionRows}`,
      `flattened leaves ${inspection.artifact.accounting.flattenedLeafRows}`,
      "authority local-diagnostic-proposal-only",
    ].join(" | "),
  );
  return reproduced;
}

const directInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) await runPrefix50OfficialLdrawWorldProposalCli();
