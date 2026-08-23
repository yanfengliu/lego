import {
  deeplyFreezeGate0,
  gate0AuthorityAbsence,
  partIdentificationGate0Digest,
} from "./part-identification-gate0-foundation.mjs";
import { partIdentificationGate0ConservativeCharges } from "./part-identification-gate0-ledger.mjs";

export const PART_IDENTIFICATION_GATE0_PILOT_SLOT_SCHEMA =
  "lego.part-identification-gate0-global-pilot-launch-slot/1";

export function createPartIdentificationGate0PilotSlot(lineage, consumedAtMs) {
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_PILOT_SLOT_SCHEMA,
    purpose: lineage.proposal.purpose,
    admissionClass: lineage.admissionClass,
    proposalDigest: lineage.proposal.proposalDigest,
    authorizationDigest: lineage.authorization.authorizationDigest,
    reservationDigest: lineage.reservation.reservationDigest,
    requestDigest: lineage.proposal.request.requestDigest,
    requestArtifactDigest: lineage.proposal.request.artifactDigest,
    consumedAtMs,
    pilotLaunchOrdinal: 1,
    providerExecutionState: "unknown-conservatively-charged-after-global-durable-claim",
    conservativeCharges: partIdentificationGate0ConservativeCharges(lineage.proposal),
    authority: gate0AuthorityAbsence(),
  };
  return deeplyFreezeGate0({
    ...core,
    pilotSlotDigest: partIdentificationGate0Digest(core),
  });
}
