import { failGate0, gate0Digest } from "./part-identification-gate0-foundation.mjs";

const SHA256 = /^sha256:([0-9a-f]{64})$/u;

function digestKey(value, label) {
  const digest = gate0Digest(value, label);
  const match = SHA256.exec(digest);
  if (match === null) failGate0(`${label} is not a content-addressable SHA-256.`);
  return match[1];
}

export function reservationPath(authorizationDigest) {
  return `reservations/${digestKey(authorizationDigest, "authorizationDigest")}.json`;
}

export function gate0PilotSlotPath() {
  return "pilot-launch-slots/exact-six-card-gate0-v1.json";
}

export function gate0StorePaths(authorizationDigest, requestArtifactDigest) {
  const authorizationKey = digestKey(authorizationDigest, "authorizationDigest");
  const requestKey = digestKey(requestArtifactDigest, "requestArtifactDigest");
  return {
    request: `requests/${requestKey}.json`,
    reservation: `reservations/${authorizationKey}.json`,
    pilotSlot: gate0PilotSlotPath(),
    launch: `launches/${authorizationKey}.json`,
    evidence: `evidence/${authorizationKey}.json`,
    settlement: `settlements/${authorizationKey}.json`,
  };
}
