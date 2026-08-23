import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  deeplyFreezeGate0,
  exactGate0Object,
  failGate0,
  GATE0_MAX_TIMESTAMP_MS,
  gate0AuthorityAbsence,
  gate0Digest,
  gate0Integer,
  partIdentificationGate0BytesDigest,
  partIdentificationGate0Digest,
  partIdentificationGate0JsonBytes,
  sameGate0Value,
} from "./part-identification-gate0-foundation.mjs";
import {
  createPartIdentificationGate0LaunchReservation,
  createPartIdentificationGate0Settlement,
  partIdentificationGate0ConservativeCharges,
} from "./part-identification-gate0-ledger.mjs";
import { verifyPartIdentificationGate0Authorization } from "./part-identification-gate0-proposal.mjs";
import { createPartIdentificationGate0PilotSlot } from "./part-identification-gate0-pilot-slot.mjs";
import {
  createGate0AdmissionCapability,
  createGate0LaunchTicket,
  gate0AdmissionCapabilityState,
  gate0LaunchTicketState,
  markGate0AdmissionCapabilityConsumed,
} from "./part-identification-gate0-store-capabilities.mjs";
import {
  publishContentAddressedGate0State as publishContentAddressed,
  publishExclusiveGate0State as publishExclusive,
  readExactGate0State as readExact,
  readExactGate0LaunchState as readHeldLaunchState,
} from "./part-identification-gate0-store-io.mjs";
import {
  claimPreparedPartIdentificationGate0Approval,
  openPreparedPartIdentificationGate0Approval,
  PART_IDENTIFICATION_GATE0_DEFAULT_ROOT,
  PART_IDENTIFICATION_GATE0_PRODUCTION_PREPARATION_CLASS,
  PART_IDENTIFICATION_GATE0_TEST_PREPARATION_CLASS,
} from "./part-identification-gate0-prepared.mjs";
import {
  gate0StorePaths as statePaths,
  reservationPath,
} from "./part-identification-gate0-store-paths.mjs";
import {
  createGate0StoreReservationBundle as reservationBundle,
  PART_IDENTIFICATION_GATE0_PRODUCTION_ADMISSION_CLASS as PRODUCTION_ADMISSION_CLASS,
  PART_IDENTIFICATION_GATE0_STORE_SCHEMA,
  PART_IDENTIFICATION_GATE0_TEST_ADMISSION_CLASS as TEST_ADMISSION_CLASS,
  verifyGate0StoreLineage as verifiedLineage,
  verifyGate0StoreReservationBundle as verifyBundle,
  withGate0StoreReservation,
} from "./part-identification-gate0-store-records.mjs";
import {
  partIdentificationGate0FailureEvidence,
  partIdentificationGate0SuccessEvidence,
} from "./part-identification-gate0-settlement-evidence.mjs";
import { readContainedFile } from "./part-identification-io.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";

export { PART_IDENTIFICATION_GATE0_STORE_SCHEMA };
export const PART_IDENTIFICATION_GATE0_LAUNCH_SCHEMA =
  "lego.part-identification-gate0-launch-start/1";
export const PART_IDENTIFICATION_GATE0_TERMINAL_SCHEMA =
  "lego.part-identification-gate0-terminal-envelope/1";
const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
const MAX_RECORD_BYTES = 256 * 1024;
const dateNow = Date.now.bind(Date);
const TEST_CLOCK = Symbol("Gate-0 test clock");
function trustedClock(options) {
  return typeof options?.[TEST_CLOCK] === "function" ? options[TEST_CLOCK] : dateNow;
}
function clockNow(clock, label) {
  return gate0Integer(clock(), 0, GATE0_MAX_TIMESTAMP_MS, label);
}
function capabilityFor(root, paths, lineage, bundle, clock, production) {
  return createGate0AdmissionCapability({
    root,
    paths,
    lineage,
    bundleBytes: partIdentificationGate0JsonBytes(bundle),
    clock,
    production,
    consumed: false,
  });
}

function reserveAdmission(input, options) {
  exactGate0Object(
    input,
    ["request", "proposal", "authorization", "reservationNonceDigest"],
    "Gate-0 store reservation input",
  );
  gate0Digest(input.reservationNonceDigest, "reservationNonceDigest");
  const root = resolve(options.root);
  const clock = options.clock ?? trustedClock(options);
  const nowMs = clockNow(clock, "Gate-0 reservation time");
  const base = verifiedLineage(input, nowMs);
  const reservation = createPartIdentificationGate0LaunchReservation({
    proposal: base.proposal,
    authorization: base.authorization,
    request: base.request,
    reservationNonceDigest: input.reservationNonceDigest,
    reservedAtMs: nowMs,
  });
  const lineage = withGate0StoreReservation(
    base,
    reservation,
    options.approval,
    options.admissionClass,
  );
  const paths = statePaths(
    lineage.authorization.authorizationDigest,
    lineage.proposal.request.artifactDigest,
  );
  const bundle = reservationBundle(lineage);
  publishContentAddressed(
    root,
    paths.request,
    lineage.requestBytes,
    MAX_REQUEST_BYTES,
    "Gate-0 exact request artifact",
  );
  publishExclusive(
    root,
    paths.reservation,
    partIdentificationGate0JsonBytes(bundle),
    "Gate-0 launch reservation bundle",
  );
  return capabilityFor(root, paths, lineage, bundle, clock, options.production === true);
}

function authorizedSummary(lineage) {
  return deeplyFreezeGate0({
    proposalDigest: lineage.proposal.proposalDigest,
    authorizationDigest: lineage.authorization.authorizationDigest,
    notAfterMs: lineage.authorization.notAfterMs,
    authority: gate0AuthorityAbsence(),
  });
}

function approvalOptions(approved) {
  return {
    proposal: approved.proposalReference,
    claim: approved.approvalReference,
  };
}

function authorizePrepared(input, options) {
  const root = resolve(options.root);
  const approved = claimPreparedPartIdentificationGate0Approval(input, {
    root,
    preparationClass: options.preparationClass,
  });
  const reservation = reservationPath(approved.authorization.authorizationDigest);
  if (existsSync(resolve(root, ...reservation.split("/")))) {
    openAdmission(
      { authorizationDigest: approved.authorization.authorizationDigest },
      {
        root,
        clock: options.clock,
        production: options.production,
        admissionClass: options.admissionClass,
        requireApproval: true,
      },
    );
  } else {
    reserveAdmission(
      {
        request: approved.request,
        proposal: approved.proposal,
        authorization: approved.authorization,
        reservationNonceDigest: approved.reservationNonceDigest,
      },
      {
        root,
        clock: options.clock,
        production: options.production,
        admissionClass: options.admissionClass,
        approval: approvalOptions(approved),
      },
    );
  }
  return authorizedSummary(approved);
}

export function authorizePreparedPartIdentificationGate0Admission(input) {
  return authorizePrepared(input, {
    root: PART_IDENTIFICATION_GATE0_DEFAULT_ROOT,
    clock: dateNow,
    production: true,
    admissionClass: PRODUCTION_ADMISSION_CLASS,
    preparationClass: PART_IDENTIFICATION_GATE0_PRODUCTION_PREPARATION_CLASS,
  });
}

function verifyRetainedApproval(lineage, root) {
  if (lineage.approval === null)
    failGate0("Production Gate-0 admission has no retained proposal-keyed approval binding.");
  const approved = openPreparedPartIdentificationGate0Approval(
    {
      proposalDigest: lineage.proposal.proposalDigest,
      authorizationDigest: lineage.authorization.authorizationDigest,
    },
    {
      root,
      preparationClass:
        lineage.admissionClass === PRODUCTION_ADMISSION_CLASS
          ? PART_IDENTIFICATION_GATE0_PRODUCTION_PREPARATION_CLASS
          : PART_IDENTIFICATION_GATE0_TEST_PREPARATION_CLASS,
    },
  );
  if (
    !sameGate0Value(approved.request, lineage.request) ||
    !sameGate0Value(approved.proposal, lineage.proposal) ||
    !sameGate0Value(approved.authorization, lineage.authorization) ||
    approved.reservationNonceDigest !== lineage.reservation.reservationNonceDigest ||
    !sameGate0Value(approvalOptions(approved), lineage.approval)
  ) {
    failGate0("Production Gate-0 admission does not reproduce its retained approval lineage.");
  }
}

function openAdmission(input, options) {
  exactGate0Object(input, ["authorizationDigest"], "Gate-0 store open input");
  const root = resolve(options.root);
  const clock = options.clock ?? trustedClock(options);
  const nowMs = clockNow(clock, "Gate-0 reopen time");
  const heldBundleBytes = readContainedFile(root, reservationPath(input.authorizationDigest), {
    maxBytes: MAX_RECORD_BYTES,
    label: "Gate-0 launch reservation bundle",
  });
  const parsedBundle = parseStrictJsonBytes(heldBundleBytes);
  exactGate0Object(
    parsedBundle,
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
  exactGate0Object(parsedBundle.requestArtifact, ["digest", "byteLength"], "requestArtifact");
  const requestPath = statePaths(
    input.authorizationDigest,
    parsedBundle.requestArtifact.digest,
  ).request;
  const requestBytes = readContainedFile(root, requestPath, {
    maxBytes: MAX_REQUEST_BYTES,
    label: "Gate-0 exact request artifact",
  });
  const { lineage, bundle } = verifyBundle(parsedBundle, parseStrictJsonBytes(requestBytes), nowMs);
  if (lineage.admissionClass !== options.admissionClass)
    failGate0("Gate-0 reservation admission class is not valid for this open boundary.");
  if (input.authorizationDigest !== lineage.authorization.authorizationDigest)
    failGate0("Gate-0 reservation path digest does not equal the verified authorization digest.");
  if (options.requireApproval === true) verifyRetainedApproval(lineage, root);
  const paths = statePaths(input.authorizationDigest, lineage.proposal.request.artifactDigest);
  readExact(
    root,
    paths.request,
    lineage.requestBytes,
    MAX_REQUEST_BYTES,
    "Gate-0 exact request artifact",
  );
  readExact(
    root,
    paths.reservation,
    partIdentificationGate0JsonBytes(bundle),
    MAX_RECORD_BYTES,
    "Gate-0 launch reservation bundle",
  );
  if (existsSync(resolve(root, ...paths.launch.split("/")))) {
    failGate0("Gate-0 admission already has a durable conservatively charged launch record.");
  }
  return capabilityFor(root, paths, lineage, bundle, clock, options.production === true);
}

export function openPartIdentificationGate0Admission(input) {
  return openAdmission(input, {
    root: PART_IDENTIFICATION_GATE0_DEFAULT_ROOT,
    clock: dateNow,
    production: true,
    admissionClass: PRODUCTION_ADMISSION_CLASS,
    requireApproval: true,
  });
}

export function assertPartIdentificationGate0AdmissionCapability(capability) {
  const state = gate0AdmissionCapabilityState(capability);
  if (state.production !== true)
    failGate0("Production Gate-0 admission rejects test-root or raw capabilities.");
  return capability;
}

export function consumePartIdentificationGate0Admission(capability) {
  const state = gate0AdmissionCapabilityState(capability);
  const consumedAtMs = clockNow(state.clock, "Gate-0 consumption time");
  if (state.production === true) verifyRetainedApproval(state.lineage, state.root);
  verifyPartIdentificationGate0Authorization(state.lineage.authorization, {
    proposal: state.lineage.proposal,
    request: state.lineage.request,
    nowMs: consumedAtMs,
  });
  readExact(
    state.root,
    state.paths.request,
    state.lineage.requestBytes,
    MAX_REQUEST_BYTES,
    "Gate-0 exact request artifact",
  );
  readExact(
    state.root,
    state.paths.reservation,
    state.bundleBytes,
    MAX_RECORD_BYTES,
    "Gate-0 launch reservation bundle",
  );
  const pilotSlot =
    state.lineage.approval === null
      ? null
      : createPartIdentificationGate0PilotSlot(state.lineage, consumedAtMs);
  const pilotSlotBytes = pilotSlot === null ? null : partIdentificationGate0JsonBytes(pilotSlot);
  if (pilotSlot !== null) {
    publishExclusive(
      state.root,
      state.paths.pilotSlot,
      pilotSlotBytes,
      "Gate-0 global pilot launch slot",
    );
  }
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_LAUNCH_SCHEMA,
    proposalDigest: state.lineage.proposal.proposalDigest,
    authorizationDigest: state.lineage.authorization.authorizationDigest,
    reservationDigest: state.lineage.reservation.reservationDigest,
    requestDigest: state.lineage.proposal.request.requestDigest,
    requestArtifactDigest: state.lineage.proposal.request.artifactDigest,
    pilotSlotDigest: pilotSlot?.pilotSlotDigest ?? null,
    consumedAtMs,
    launchOrdinal: 1,
    providerExecutionState: "unknown-conservatively-charged-after-durable-claim",
    conservativeCharges: partIdentificationGate0ConservativeCharges(state.lineage.proposal),
    authority: gate0AuthorityAbsence(),
  };
  const launch = deeplyFreezeGate0({ ...core, launchDigest: partIdentificationGate0Digest(core) });
  const launchBytes = partIdentificationGate0JsonBytes(launch);
  publishExclusive(state.root, state.paths.launch, launchBytes, "Gate-0 launch-start record");
  markGate0AdmissionCapabilityConsumed(state);
  return createGate0LaunchTicket({
    ...state,
    pilotSlot,
    pilotSlotBytes,
    launch,
    launchBytes,
    claimed: false,
    settled: false,
  });
}

export function claimPartIdentificationGate0Launch(ticket) {
  const state = gate0LaunchTicketState(ticket);
  if (state.claimed) failGate0("Gate-0 launch ticket was already claimed.");
  readHeldLaunchState(state, MAX_RECORD_BYTES);
  state.claimed = true;
  return deeplyFreezeGate0({
    request: state.lineage.request,
    proposal: state.lineage.proposal,
    authorization: state.lineage.authorization,
    reservation: state.lineage.reservation,
    pilotSlot: state.pilotSlot,
    launch: state.launch,
  });
}

export function revalidatePartIdentificationGate0Launch(ticket) {
  const state = gate0LaunchTicketState(ticket);
  if (!state.claimed) failGate0("Gate-0 launch ticket must be claimed before revalidation.");
  if (state.settled) failGate0("Gate-0 launch ticket already has a terminal settlement.");
  readHeldLaunchState(state, MAX_RECORD_BYTES);
  return ticket;
}

export function settlePartIdentificationGate0Launch(ticket, settlementInput) {
  const state = gate0LaunchTicketState(ticket);
  if (!state.claimed) failGate0("Gate-0 launch ticket must be claimed before settlement.");
  if (state.settled) failGate0("Gate-0 launch ticket already has a terminal settlement.");
  exactGate0Object(settlementInput, ["status", "evidence"], "Gate-0 settlement evidence");
  const held =
    settlementInput.status === "success"
      ? partIdentificationGate0SuccessEvidence(state.lineage, settlementInput.evidence)
      : settlementInput.status === "failure"
        ? partIdentificationGate0FailureEvidence(state.launch, settlementInput.evidence)
        : failGate0("Gate-0 settlement status must be success or failure.");
  const settledAtMs = clockNow(state.clock, "Gate-0 settlement time");
  readExact(
    state.root,
    state.paths.request,
    state.lineage.requestBytes,
    MAX_REQUEST_BYTES,
    "Gate-0 exact request artifact",
  );
  readExact(
    state.root,
    state.paths.reservation,
    state.bundleBytes,
    MAX_RECORD_BYTES,
    "Gate-0 launch reservation bundle",
  );
  readHeldLaunchState(state, MAX_RECORD_BYTES);
  const evidenceDigest = partIdentificationGate0BytesDigest(held.bytes);
  const settlement = createPartIdentificationGate0Settlement({
    proposal: state.lineage.proposal,
    authorization: state.lineage.authorization,
    reservation: state.lineage.reservation,
    request: state.lineage.request,
    settledAtMs,
    result: held.result,
  });
  publishContentAddressed(
    state.root,
    state.paths.evidence,
    held.bytes,
    state.lineage.proposal.budgets.maxProofBytes,
    "Gate-0 exact terminal evidence",
  );
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_TERMINAL_SCHEMA,
    launchDigest: state.launch.launchDigest,
    pilotSlotDigest: state.launch.pilotSlotDigest,
    consumedAtMs: state.launch.consumedAtMs,
    launchOrdinal: state.launch.launchOrdinal,
    evidence: {
      path: state.paths.evidence,
      digest: evidenceDigest,
      byteLength: held.bytes.length,
    },
    settlement,
  };
  const terminal = deeplyFreezeGate0({
    ...core,
    terminalDigest: partIdentificationGate0Digest(core),
  });
  publishExclusive(
    state.root,
    state.paths.settlement,
    partIdentificationGate0JsonBytes(terminal),
    "Gate-0 terminal settlement",
  );
  state.settled = true;
  return terminal;
}

export const __testOnly = Object.freeze({
  statePaths,
  reserveRaw(input, options) {
    return reserveAdmission(input, {
      root: resolve(options.root),
      clock: trustedClock(options),
      production: false,
      admissionClass: TEST_ADMISSION_CLASS,
      preparationClass: PART_IDENTIFICATION_GATE0_TEST_PREPARATION_CLASS,
      approval: null,
    });
  },
  openRaw(input, options) {
    return openAdmission(input, {
      root: resolve(options.root),
      clock: trustedClock(options),
      production: false,
      admissionClass: TEST_ADMISSION_CLASS,
      requireApproval: false,
    });
  },
  authorizePrepared(input, options) {
    return authorizePrepared(input, {
      root: resolve(options.root),
      clock: dateNow,
      production: false,
      admissionClass: TEST_ADMISSION_CLASS,
      preparationClass: PART_IDENTIFICATION_GATE0_TEST_PREPARATION_CLASS,
    });
  },
  clockOptions(root, clock) {
    return { root, [TEST_CLOCK]: clock };
  },
});
