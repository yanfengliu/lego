import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { writeContainedFileAtomic } from "./part-identification-contained-write.mjs";
import {
  createPartIdentificationGate0Authorization,
  createPartIdentificationGate0PilotProposal,
  verifyPartIdentificationGate0Authorization,
  verifyPartIdentificationGate0PilotProposal,
} from "./part-identification-gate0-proposal.mjs";
import {
  deeplyFreezeGate0,
  exactGate0Object,
  failGate0,
  gate0AuthorityAbsence,
  gate0Digest,
  gate0Integer,
  partIdentificationGate0BytesDigest,
  partIdentificationGate0Digest,
  partIdentificationGate0JsonBytes,
  PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS,
  PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT,
  PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS,
  PART_IDENTIFICATION_GATE0_MAX_INPUT_TOKENS,
  PART_IDENTIFICATION_GATE0_MAX_OUTPUT_TOKENS,
  PART_IDENTIFICATION_GATE0_PURPOSE,
  sameGate0Value,
} from "./part-identification-gate0-foundation.mjs";
import {
  retrievePartIdentificationGate0PolicyEvidence,
  verifyRetainedPartIdentificationGate0PolicyEvidence,
} from "./part-identification-gate0-policy.mjs";
import { reconstructRetainedPartIdentificationGate0Request } from "./part-identification-gate0-request.mjs";
import { readContainedFile } from "./part-identification-io.mjs";
import { partIdentificationMcpVerifiedRequestArtifact } from "./part-identification-mcp-server.mjs";
import { estimatePartIdentificationProofReservation } from "./part-identification-proof-reservation.mjs";
import { PART_IDENTIFICATION_GATE0_DEFAULT_ROOT } from "./part-identification-gate0-root.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { PART_IDENTIFICATION_TRANSPORT_CONTRACT } from "./part-identification-transport-contract.mjs";

export const PART_IDENTIFICATION_GATE0_PROPOSAL_ENVELOPE_SCHEMA =
  "lego.part-identification-gate0-proposal-envelope/1";
export const PART_IDENTIFICATION_GATE0_APPROVAL_CLAIM_SCHEMA =
  "lego.part-identification-gate0-approval-claim/1";
export const PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE = "approve-exact-six-card-gate0-v1";
export const PART_IDENTIFICATION_GATE0_PRODUCTION_PREPARATION_CLASS =
  "canonical-request-and-configured-policy-fetch/1";
export const PART_IDENTIFICATION_GATE0_TEST_PREPARATION_CLASS =
  "test-only-injected-request-or-policy/1";
export { PART_IDENTIFICATION_GATE0_DEFAULT_ROOT };
const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
const MAX_RECORD_BYTES = 256 * 1024;
const SHA256 = /^sha256:([0-9a-f]{64})$/u;
const dateNow = Date.now.bind(Date);
const bufferEquals = Function.call.bind(Buffer.prototype.equals);

function digestKey(value, label) {
  const digest = gate0Digest(value, label);
  const match = SHA256.exec(digest);
  if (match === null) failGate0(`${label} is not a content-addressable SHA-256.`);
  return match[1];
}

function requestPath(digest) {
  return `requests/${digestKey(digest, "Request artifact digest")}.json`;
}

function proposalPath(digest) {
  return `proposals/${digestKey(digest, "Proposal digest")}.json`;
}

function approvalPath(digest) {
  return `approval-claims/${digestKey(digest, "Proposal digest")}.json`;
}

function publishContentAddressed(root, path, bytes, maxBytes, label) {
  try {
    writeContainedFileAtomic(root, path, bytes, {
      exclusive: true,
      label,
      pathLabel: `${label} path`,
      rootLabel: "Gate-0 local state root",
    });
  } catch (error) {
    if (!existsSync(resolve(root, ...path.split("/")))) throw error;
    const retained = readContainedFile(root, path, { maxBytes, label });
    if (!bufferEquals(retained, bytes)) {
      failGate0(`${label} path exists with bytes different from its content address.`);
    }
  }
}

function proposalEnvelope(proposal, requestArtifact, policyEvidence, preparationClass) {
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_PROPOSAL_ENVELOPE_SCHEMA,
    preparationClass,
    proposal,
    requestArtifact,
    policyEvidence,
    authority: gate0AuthorityAbsence(),
  };
  return deeplyFreezeGate0({ ...core, envelopeDigest: partIdentificationGate0Digest(core) });
}

function verifyProposalEnvelope(value, request, root, nowMs, requiredPreparationClass) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "preparationClass",
      "proposal",
      "requestArtifact",
      "policyEvidence",
      "authority",
      "envelopeDigest",
    ],
    "Gate-0 proposal envelope",
  );
  exactGate0Object(value.requestArtifact, ["path", "digest", "byteLength"], "Request artifact");
  gate0Integer(value.requestArtifact.byteLength, 1, MAX_REQUEST_BYTES, "Request artifact bytes");
  const artifact = partIdentificationMcpVerifiedRequestArtifact(request);
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_PROPOSAL_ENVELOPE_SCHEMA ||
    value.preparationClass !== requiredPreparationClass ||
    value.requestArtifact.path !== requestPath(artifact.digest) ||
    value.requestArtifact.digest !== artifact.digest ||
    value.requestArtifact.byteLength !== artifact.byteLength ||
    !sameGate0Value(value.authority, gate0AuthorityAbsence())
  ) {
    failGate0("Gate-0 proposal envelope does not bind its exact retained request artifact.");
  }
  const proposal = verifyPartIdentificationGate0PilotProposal(value.proposal, { request });
  const policyReview = verifyRetainedPartIdentificationGate0PolicyEvidence(
    value.policyEvidence,
    proposal.proposedAtMs,
    { root },
  );
  if (!sameGate0Value(policyReview, proposal.policyReview))
    failGate0("Gate-0 proposal policy review does not equal its retained evidence.");
  const expected = proposalEnvelope(
    proposal,
    value.requestArtifact,
    value.policyEvidence,
    value.preparationClass,
  );
  if (
    value.envelopeDigest !== expected.envelopeDigest ||
    !sameGate0Value(value, expected) ||
    nowMs < proposal.proposedAtMs
  ) {
    failGate0("Gate-0 proposal envelope is not its canonical current retained lineage.");
  }
  return expected;
}

function openProposal(proposalDigest, root, nowMs, preparationClass) {
  const path = proposalPath(proposalDigest);
  const envelopeBytes = readContainedFile(root, path, {
    maxBytes: MAX_RECORD_BYTES,
    label: "Gate-0 proposal envelope",
  });
  const parsed = parseStrictJsonBytes(envelopeBytes);
  exactGate0Object(
    parsed,
    [
      "schemaVersion",
      "preparationClass",
      "proposal",
      "requestArtifact",
      "policyEvidence",
      "authority",
      "envelopeDigest",
    ],
    "Gate-0 proposal envelope",
  );
  if (parsed.proposal.proposalDigest !== proposalDigest)
    failGate0("Gate-0 proposal path digest does not equal its retained proposal digest.");
  const heldRequest = parsed.requestArtifact;
  exactGate0Object(heldRequest, ["path", "digest", "byteLength"], "Request artifact");
  if (heldRequest.path !== requestPath(heldRequest.digest))
    failGate0("Gate-0 proposal request path is not derived from its content digest.");
  const requestBytes = readContainedFile(root, heldRequest.path, {
    maxBytes: MAX_REQUEST_BYTES,
    label: "Gate-0 exact request artifact",
  });
  const request = parseStrictJsonBytes(requestBytes);
  const observedArtifact = partIdentificationMcpVerifiedRequestArtifact(request);
  if (
    requestBytes.length !== heldRequest.byteLength ||
    observedArtifact.byteLength !== heldRequest.byteLength ||
    observedArtifact.digest !== heldRequest.digest ||
    !bufferEquals(observedArtifact.bytes, requestBytes)
  ) {
    failGate0("Gate-0 exact retained request artifact changed.");
  }
  const envelope = verifyProposalEnvelope(parsed, request, root, nowMs, preparationClass);
  return {
    request,
    envelope,
    proposalReference: {
      path,
      digest: envelope.proposal.proposalDigest,
      byteLength: envelopeBytes.length,
    },
  };
}

function approvalClaim(proposal, authorization, reservationNonceDigest, claimedAtMs) {
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_APPROVAL_CLAIM_SCHEMA,
    proposalDigest: proposal.proposalDigest,
    requestDigest: proposal.request.requestDigest,
    authorization,
    reservationNonceDigest,
    claimedAtMs,
    state: "approval-consumed-before-reservation",
    authority: gate0AuthorityAbsence(),
  };
  return deeplyFreezeGate0({ ...core, claimDigest: partIdentificationGate0Digest(core) });
}

function verifyApprovalClaim(value, proposal, request, nowMs) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "proposalDigest",
      "requestDigest",
      "authorization",
      "reservationNonceDigest",
      "claimedAtMs",
      "state",
      "authority",
      "claimDigest",
    ],
    "Gate-0 approval claim",
  );
  gate0Integer(value.claimedAtMs, proposal.proposedAtMs, nowMs, "Approval claimedAtMs");
  gate0Digest(value.reservationNonceDigest, "Approval reservationNonceDigest");
  const authorization = verifyPartIdentificationGate0Authorization(value.authorization, {
    proposal,
    request,
    nowMs,
  });
  const expected = approvalClaim(
    proposal,
    authorization,
    value.reservationNonceDigest,
    value.claimedAtMs,
  );
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_APPROVAL_CLAIM_SCHEMA ||
    value.proposalDigest !== proposal.proposalDigest ||
    value.requestDigest !== proposal.request.requestDigest ||
    value.state !== "approval-consumed-before-reservation" ||
    !sameGate0Value(value.authority, gate0AuthorityAbsence()) ||
    value.claimDigest !== expected.claimDigest ||
    !sameGate0Value(value, expected)
  ) {
    failGate0("Gate-0 approval claim does not reproduce its exact proposal-bound authority.");
  }
  return expected;
}

function approvalLineage(proposalDigest, root, nowMs, preparationClass) {
  const prepared = openProposal(proposalDigest, root, nowMs, preparationClass);
  const path = approvalPath(proposalDigest);
  const bytes = readContainedFile(root, path, {
    maxBytes: MAX_RECORD_BYTES,
    label: "Gate-0 approval claim",
  });
  const claim = verifyApprovalClaim(
    parseStrictJsonBytes(bytes),
    prepared.envelope.proposal,
    prepared.request,
    nowMs,
  );
  return deeplyFreezeGate0({
    request: prepared.request,
    proposal: prepared.envelope.proposal,
    authorization: claim.authorization,
    reservationNonceDigest: claim.reservationNonceDigest,
    preparationClass,
    proposalReference: prepared.proposalReference,
    approvalReference: { path, digest: claim.claimDigest, byteLength: bytes.length },
  });
}

function persistPreparedProposal(input, root, preparationClass) {
  exactGate0Object(input, ["request", "proposal", "policyEvidence"], "Prepared proposal input");
  const artifact = partIdentificationMcpVerifiedRequestArtifact(input.request);
  const requestArtifact = {
    path: requestPath(artifact.digest),
    digest: artifact.digest,
    byteLength: artifact.byteLength,
  };
  publishContentAddressed(
    root,
    requestArtifact.path,
    artifact.bytes,
    MAX_REQUEST_BYTES,
    "Gate-0 exact request artifact",
  );
  const envelope = proposalEnvelope(
    input.proposal,
    requestArtifact,
    input.policyEvidence,
    preparationClass,
  );
  verifyProposalEnvelope(envelope, input.request, root, dateNow(), preparationClass);
  const bytes = partIdentificationGate0JsonBytes(envelope);
  const path = proposalPath(envelope.proposal.proposalDigest);
  publishContentAddressed(root, path, bytes, MAX_RECORD_BYTES, "Gate-0 proposal envelope");
  return deeplyFreezeGate0({
    proposal: envelope.proposal,
    reference: { path, digest: envelope.proposal.proposalDigest, byteLength: bytes.length },
  });
}

async function prepareProposal({ out, root, request, fetchImpl, preparationClass }) {
  const heldRequest = request ?? reconstructRetainedPartIdentificationGate0Request(out);
  const policy = await retrievePartIdentificationGate0PolicyEvidence({
    root,
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });
  const proposal = createPartIdentificationGate0PilotProposal({
    request: heldRequest,
    purpose: PART_IDENTIFICATION_GATE0_PURPOSE,
    proposedAtMs: dateNow(),
    policyReview: policy.policyReview,
    budgets: {
      maxModelLaunches: 1,
      maxExecutablePreflights: 1,
      maxCards: 6,
      maxProviderTurns: PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxTurns,
      maxInputTokens: PART_IDENTIFICATION_GATE0_MAX_INPUT_TOKENS,
      maxOutputTokens: PART_IDENTIFICATION_GATE0_MAX_OUTPUT_TOKENS,
      maxCostMicrousd: PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxCostMicrousd,
      maxElapsedMs: PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxWallTimeMs,
      maxProofBytes: estimatePartIdentificationProofReservation(heldRequest),
    },
  });
  return persistPreparedProposal(
    { request: heldRequest, proposal, policyEvidence: policy.reference },
    root,
    preparationClass,
  );
}

export function prepareProductionPartIdentificationGate0Proposal(
  out = "output/part-identification",
) {
  return prepareProposal({
    out,
    root: PART_IDENTIFICATION_GATE0_DEFAULT_ROOT,
    request: null,
    fetchImpl: undefined,
    preparationClass: PART_IDENTIFICATION_GATE0_PRODUCTION_PREPARATION_CLASS,
  });
}

export function claimPreparedPartIdentificationGate0Approval(input, options = {}) {
  exactGate0Object(input, ["proposalDigest", "approval"], "Gate-0 approval input");
  if (input.approval !== PART_IDENTIFICATION_GATE0_APPROVAL_PHRASE)
    failGate0("Gate-0 authorization requires the exact trusted-local-caller assertion phrase.");
  const root = resolve(options.root ?? PART_IDENTIFICATION_GATE0_DEFAULT_ROOT);
  const nowMs = dateNow();
  const prepared = openProposal(input.proposalDigest, root, nowMs, options.preparationClass);
  const path = approvalPath(prepared.envelope.proposal.proposalDigest);
  if (!existsSync(resolve(root, ...path.split("/")))) {
    const notAfterMs = Math.min(
      nowMs + 5 * 60 * 1_000,
      prepared.envelope.proposal.proposedAtMs +
        PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS,
    );
    const authorization = createPartIdentificationGate0Authorization({
      proposal: prepared.envelope.proposal,
      request: prepared.request,
      decision: "approved",
      authorizationBasis: PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS,
      repositoryOwnerIdentityAuthenticated: false,
      exposureAcknowledgement: { ...PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT },
      authorizedAtMs: nowMs,
      notBeforeMs: nowMs,
      notAfterMs,
      nowMs,
    });
    const claim = approvalClaim(
      prepared.envelope.proposal,
      authorization,
      partIdentificationGate0BytesDigest(randomBytes(32)),
      nowMs,
    );
    writeContainedFileAtomic(root, path, partIdentificationGate0JsonBytes(claim), {
      exclusive: true,
      label: "Gate-0 approval claim",
      pathLabel: "Gate-0 approval claim path",
      rootLabel: "Gate-0 local state root",
    });
  }
  return approvalLineage(input.proposalDigest, root, dateNow(), options.preparationClass);
}

export function openPreparedPartIdentificationGate0Approval(input, options = {}) {
  exactGate0Object(
    input,
    ["proposalDigest", "authorizationDigest"],
    "Gate-0 retained approval input",
  );
  const root = resolve(options.root ?? PART_IDENTIFICATION_GATE0_DEFAULT_ROOT);
  const lineage = approvalLineage(input.proposalDigest, root, dateNow(), options.preparationClass);
  if (lineage.authorization.authorizationDigest !== input.authorizationDigest)
    failGate0("Gate-0 retained approval does not equal the requested authorization digest.");
  return lineage;
}

export const __testOnly = Object.freeze({
  approvalPath,
  proposalPath,
  requestPath,
  prepare(options) {
    return prepareProposal({
      out: options.out ?? "output/part-identification",
      root: resolve(options.root),
      request: options.request,
      fetchImpl: options.fetchImpl,
      preparationClass: PART_IDENTIFICATION_GATE0_TEST_PREPARATION_CLASS,
    });
  },
});
