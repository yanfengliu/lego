import { option } from "./part-identification-cli-option.mjs";
import {
  deeplyFreezeGate0,
  partIdentificationGate0JsonBytes,
} from "./part-identification-gate0-foundation.mjs";
import {
  PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE,
  prepareProductionPartIdentificationGate0Proposal,
} from "./part-identification-gate0-prepared.mjs";
import { authorizePreparedPartIdentificationGate0Admission } from "./part-identification-gate0-store.mjs";

export { PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE };

export async function preparePartIdentificationGate0Proposal(out = "output/part-identification") {
  return prepareProductionPartIdentificationGate0Proposal(out);
}

export async function commandGate0Propose(argv) {
  const prepared = await preparePartIdentificationGate0Proposal(
    option(argv, "out", "output/part-identification"),
  );
  console.log(
    partIdentificationGate0JsonBytes({
      status: "proposal-only/no-authorization/no-claude-executable-or-model-launch",
      proposalDigest: prepared.proposal.proposalDigest,
      proposedAtMs: prepared.proposal.proposedAtMs,
      request: prepared.proposal.request,
      model: prepared.proposal.model,
      dataScope: prepared.proposal.dataScope,
      budgets: prepared.proposal.budgets,
      policyReview: prepared.proposal.policyReview,
      authority: prepared.proposal.authority,
    }).toString("utf8"),
  );
}

export function commandGate0Authorize(argv) {
  const authorized = authorizePreparedPartIdentificationGate0Admission({
    proposalDigest: option(argv, "proposal"),
    approval: option(argv, "approval"),
  });
  console.log(partIdentificationGate0JsonBytes(deeplyFreezeGate0(authorized)).toString("utf8"));
}
