import {
  deeplyFreezeGate0,
  exactGate0Object,
  failGate0,
  gate0AuthorityAbsence,
  gate0Digest,
  gate0Integer,
  partIdentificationGate0Digest,
  sameGate0Value,
  snapshotGate0Request,
} from "./part-identification-gate0-foundation.mjs";
import { verifyPartIdentificationGate0LaunchReservation } from "./part-identification-gate0-ledger.mjs";
import {
  verifyPartIdentificationGate0Authorization,
  verifyPartIdentificationGate0PilotProposal,
} from "./part-identification-gate0-proposal.mjs";
import { partIdentificationMcpVerifiedRequestArtifact } from "./part-identification-mcp-server.mjs";

export const PART_IDENTIFICATION_GATE0_STORE_SCHEMA =
  "lego.part-identification-gate0-local-store/1";
export const PART_IDENTIFICATION_GATE0_PRODUCTION_ADMISSION_CLASS =
  "canonical-prepared-default-root/1";
export const PART_IDENTIFICATION_GATE0_TEST_ADMISSION_CLASS = "test-only-nonpublishable/1";
const MAX_RECORD_BYTES = 256 * 1024;

export function verifyGate0StoreLineage(
  { request: requestInput, proposal: proposalInput, authorization },
  nowMs,
) {
  const request = snapshotGate0Request(requestInput);
  const proposal = verifyPartIdentificationGate0PilotProposal(proposalInput, {
    request: request.canonical,
  });
  const heldAuthorization = verifyPartIdentificationGate0Authorization(authorization, {
    proposal,
    request: request.canonical,
    nowMs,
  });
  const artifact = partIdentificationMcpVerifiedRequestArtifact(request.canonical);
  if (
    artifact.byteLength !== proposal.request.artifactByteLength ||
    artifact.digest !== proposal.request.artifactDigest
  ) {
    failGate0("Gate-0 store request bytes do not reproduce the proposal artifact binding.");
  }
  return {
    request: request.canonical,
    requestBytes: artifact.bytes,
    proposal,
    authorization: heldAuthorization,
  };
}

export function gate0ApprovalBinding(value) {
  if (value === null) return null;
  exactGate0Object(value, ["proposal", "claim"], "Gate-0 approval binding");
  const reference = (held, label) => {
    exactGate0Object(held, ["path", "digest", "byteLength"], label);
    if (typeof held.path !== "string" || held.path.length < 1 || held.path.length > 4_096)
      failGate0(`${label} path is not bounded.`);
    gate0Digest(held.digest, `${label} digest`);
    gate0Integer(held.byteLength, 1, MAX_RECORD_BYTES, `${label} byteLength`);
    return { path: held.path, digest: held.digest, byteLength: held.byteLength };
  };
  return {
    proposal: reference(value.proposal, "Gate-0 proposal reference"),
    claim: reference(value.claim, "Gate-0 approval-claim reference"),
  };
}

export function withGate0StoreReservation(lineage, reservation, approval, admissionClass) {
  const held = verifyPartIdentificationGate0LaunchReservation(reservation, {
    proposal: lineage.proposal,
    authorization: lineage.authorization,
    request: lineage.request,
  });
  return {
    ...lineage,
    reservation: held,
    approval: gate0ApprovalBinding(approval),
    admissionClass,
  };
}

export function createGate0StoreReservationBundle(lineage) {
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_STORE_SCHEMA,
    admissionClass: lineage.admissionClass,
    requestArtifact: {
      digest: lineage.proposal.request.artifactDigest,
      byteLength: lineage.proposal.request.artifactByteLength,
    },
    proposal: lineage.proposal,
    authorization: lineage.authorization,
    reservation: lineage.reservation,
    approval: lineage.approval,
    authority: gate0AuthorityAbsence(),
  };
  return deeplyFreezeGate0({ ...core, bundleDigest: partIdentificationGate0Digest(core) });
}

export function verifyGate0StoreReservationBundle(value, request, nowMs) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "admissionClass",
      "requestArtifact",
      "proposal",
      "authorization",
      "reservation",
      "approval",
      "authority",
      "bundleDigest",
    ],
    "Gate-0 reservation bundle",
  );
  exactGate0Object(value.requestArtifact, ["digest", "byteLength"], "requestArtifact");
  const base = verifyGate0StoreLineage(
    { request, proposal: value.proposal, authorization: value.authorization },
    nowMs,
  );
  const lineage = withGate0StoreReservation(
    base,
    value.reservation,
    value.approval,
    value.admissionClass,
  );
  const expected = createGate0StoreReservationBundle(lineage);
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_STORE_SCHEMA ||
    (value.admissionClass !== PART_IDENTIFICATION_GATE0_PRODUCTION_ADMISSION_CLASS &&
      value.admissionClass !== PART_IDENTIFICATION_GATE0_TEST_ADMISSION_CLASS) ||
    !sameGate0Value(value.requestArtifact, expected.requestArtifact) ||
    !sameGate0Value(value.authority, gate0AuthorityAbsence()) ||
    gate0Digest(value.bundleDigest, "bundleDigest") !== expected.bundleDigest ||
    !sameGate0Value(value, expected)
  ) {
    failGate0("Gate-0 reservation bundle does not reproduce its exact retained lineage.");
  }
  return { lineage, bundle: expected };
}
