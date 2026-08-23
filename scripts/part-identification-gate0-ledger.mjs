import { estimatePartIdentificationProofReservation } from "./part-identification-proof-reservation.mjs";
import {
  deeplyFreezeGate0,
  exactGate0Object,
  failGate0,
  GATE0_MAX_FAILURE_BYTES,
  GATE0_MAX_TIMESTAMP_MS,
  gate0Budgets,
  gate0Digest,
  gate0Integer,
  partIdentificationGate0Digest,
  PartIdentificationGate0Error,
  PART_IDENTIFICATION_GATE0_RESERVATION_SCHEMA,
  PART_IDENTIFICATION_GATE0_SETTLEMENT_SCHEMA,
  sameGate0Value,
  snapshotGate0Request,
} from "./part-identification-gate0-foundation.mjs";
import {
  verifyPartIdentificationGate0Authorization,
  verifyPartIdentificationGate0PilotProposal,
} from "./part-identification-gate0-proposal.mjs";
import { isOrdinaryObject } from "./part-identification-safe-shape.mjs";

const FAILURE_CATEGORIES = Object.freeze([
  "runtime-preflight",
  "provider-launch",
  "provider-stream",
  "provider-terminal",
  "proof-finalization",
  "cleanup",
  "unknown",
]);
const getDescriptors = Object.getOwnPropertyDescriptors;
const arrayIncludes = Function.call.bind(Array.prototype.includes);

export function partIdentificationGate0ConservativeCharges(proposal) {
  const value = proposal.budgets;
  return {
    modelLaunches: value.maxModelLaunches,
    executablePreflights: value.maxExecutablePreflights,
    cards: value.maxCards,
    providerTurns: value.maxProviderTurns,
    inputTokens: value.maxInputTokens,
    outputTokens: value.maxOutputTokens,
    costMicrousd: value.maxCostMicrousd,
    elapsedMs: value.maxElapsedMs,
    proofBytes: value.maxProofBytes,
  };
}

/** Pure canonical record construction only; durable one-use admission belongs to the Gate-0 store. */
export function createPartIdentificationGate0LaunchReservation(input) {
  exactGate0Object(
    input,
    ["proposal", "authorization", "request", "reservationNonceDigest", "reservedAtMs"],
    "Reservation input",
  );
  const proposal = verifyPartIdentificationGate0PilotProposal(input.proposal, {
    request: input.request,
  });
  const authorization = verifyPartIdentificationGate0Authorization(input.authorization, {
    proposal,
    request: input.request,
    nowMs: input.reservedAtMs,
  });
  gate0Digest(input.reservationNonceDigest, "reservationNonceDigest");
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_RESERVATION_SCHEMA,
    proposalDigest: proposal.proposalDigest,
    authorizationDigest: authorization.authorizationDigest,
    requestDigest: proposal.request.requestDigest,
    requestArtifactDigest: proposal.request.artifactDigest,
    budgets: gate0Budgets(proposal.budgets),
    reservationNonceDigest: input.reservationNonceDigest,
    reservedAtMs: input.reservedAtMs,
  };
  return verifyPartIdentificationGate0LaunchReservation(
    { ...core, reservationDigest: partIdentificationGate0Digest(core) },
    { proposal, authorization, request: input.request },
  );
}

export function verifyPartIdentificationGate0LaunchReservation(
  value,
  { proposal: proposalInput, authorization: authorizationInput, request },
) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "proposalDigest",
      "authorizationDigest",
      "requestDigest",
      "requestArtifactDigest",
      "budgets",
      "reservationNonceDigest",
      "reservedAtMs",
      "reservationDigest",
    ],
    "Launch reservation",
  );
  gate0Integer(value.reservedAtMs, 0, GATE0_MAX_TIMESTAMP_MS, "reservedAtMs");
  const proposal = verifyPartIdentificationGate0PilotProposal(proposalInput, { request });
  const authorization = verifyPartIdentificationGate0Authorization(authorizationInput, {
    proposal,
    request,
    nowMs: value.reservedAtMs,
  });
  const heldBudgets = gate0Budgets(
    value.budgets,
    estimatePartIdentificationProofReservation(snapshotGate0Request(request).canonical),
  );
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_RESERVATION_SCHEMA ||
    value.proposalDigest !== proposal.proposalDigest ||
    value.authorizationDigest !== authorization.authorizationDigest ||
    value.requestDigest !== proposal.request.requestDigest ||
    value.requestArtifactDigest !== proposal.request.artifactDigest ||
    !sameGate0Value(heldBudgets, proposal.budgets)
  )
    failGate0(
      "Launch reservation does not bind the exact proposal, authorization, MCP request, and budgets.",
    );
  gate0Digest(value.reservationNonceDigest, "reservationNonceDigest");
  const core = {
    schemaVersion: value.schemaVersion,
    proposalDigest: value.proposalDigest,
    authorizationDigest: value.authorizationDigest,
    requestDigest: value.requestDigest,
    requestArtifactDigest: value.requestArtifactDigest,
    budgets: heldBudgets,
    reservationNonceDigest: value.reservationNonceDigest,
    reservedAtMs: value.reservedAtMs,
  };
  if (
    gate0Digest(value.reservationDigest, "reservationDigest") !==
    partIdentificationGate0Digest(core)
  )
    failGate0("Launch reservation digest does not reproduce its canonical core.");
  return deeplyFreezeGate0({ ...core, reservationDigest: value.reservationDigest });
}

function successEvidence(value, budget) {
  exactGate0Object(
    value,
    [
      "status",
      "proofDigest",
      "proofByteLength",
      "providerTurns",
      "inputTokens",
      "outputTokens",
      "costMicrousd",
      "elapsedMs",
    ],
    "Success settlement input",
  );
  if (value.status !== "success") failGate0("Success settlement status is invalid.");
  gate0Digest(value.proofDigest, "proofDigest");
  gate0Integer(value.proofByteLength, 1, budget.maxProofBytes, "proofByteLength");
  gate0Integer(value.providerTurns, 1, budget.maxProviderTurns, "providerTurns");
  gate0Integer(value.inputTokens, 0, budget.maxInputTokens, "inputTokens");
  gate0Integer(value.outputTokens, 0, budget.maxOutputTokens, "outputTokens");
  gate0Integer(value.costMicrousd, 0, budget.maxCostMicrousd, "costMicrousd");
  gate0Integer(value.elapsedMs, 0, budget.maxElapsedMs, "elapsedMs");
  return {
    proofDigest: value.proofDigest,
    proofByteLength: value.proofByteLength,
    providerTurns: value.providerTurns,
    inputTokens: value.inputTokens,
    outputTokens: value.outputTokens,
    costMicrousd: value.costMicrousd,
    elapsedMs: value.elapsedMs,
    usageAuthentication: "bound-to-proof-digest/not-verified-by-gate0",
  };
}

function failureEvidence(value) {
  exactGate0Object(
    value,
    ["status", "category", "failureDigest", "failureByteLength"],
    "Failure settlement input",
  );
  if (value.status !== "failure" || !arrayIncludes(FAILURE_CATEGORIES, value.category))
    failGate0("Failure settlement category is not bounded.");
  gate0Digest(value.failureDigest, "failureDigest");
  gate0Integer(value.failureByteLength, 1, GATE0_MAX_FAILURE_BYTES, "failureByteLength");
  return {
    category: value.category,
    failureDigest: value.failureDigest,
    failureByteLength: value.failureByteLength,
    providerExecutionState: "unknown-conservatively-charged",
  };
}

function settlementResultStatus(value) {
  try {
    if (!isOrdinaryObject(value)) failGate0("Settlement result must be an ordinary object.");
    const descriptor = getDescriptors(value).status;
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      failGate0("Settlement result status must be an enumerable data property.");
    }
    return descriptor.value;
  } catch (error) {
    if (error instanceof PartIdentificationGate0Error) throw error;
    failGate0("Settlement result rejected hostile object structure.");
  }
}

/** Pure canonical record construction only; durable terminal uniqueness belongs to the Gate-0 store. */
export function createPartIdentificationGate0Settlement(input) {
  exactGate0Object(
    input,
    ["proposal", "authorization", "reservation", "request", "settledAtMs", "result"],
    "Settlement input",
  );
  const reservation = verifyPartIdentificationGate0LaunchReservation(input.reservation, {
    proposal: input.proposal,
    authorization: input.authorization,
    request: input.request,
  });
  const proposal = verifyPartIdentificationGate0PilotProposal(input.proposal, {
    request: input.request,
  });
  const resultStatus = settlementResultStatus(input.result);
  const success =
    resultStatus === "success" ? successEvidence(input.result, proposal.budgets) : null;
  const failure = resultStatus === "failure" ? failureEvidence(input.result) : null;
  if ((success === null) === (failure === null))
    failGate0("Settlement requires exactly one success or failure result.");
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_SETTLEMENT_SCHEMA,
    proposalDigest: proposal.proposalDigest,
    authorizationDigest: reservation.authorizationDigest,
    reservationDigest: reservation.reservationDigest,
    requestDigest: reservation.requestDigest,
    requestArtifactDigest: reservation.requestArtifactDigest,
    settledAtMs: input.settledAtMs,
    outcome: success === null ? "failure" : "success",
    charges: partIdentificationGate0ConservativeCharges(proposal),
    success,
    failure,
    evidenceLevel: "local-lineage-only/provider-and-user-identity-not-authenticated",
  };
  return verifyPartIdentificationGate0Settlement(
    { ...core, settlementDigest: partIdentificationGate0Digest(core) },
    { proposal, authorization: input.authorization, reservation, request: input.request },
  );
}

export function verifyPartIdentificationGate0Settlement(
  value,
  { proposal: proposalInput, authorization, reservation: reservationInput, request },
) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "proposalDigest",
      "authorizationDigest",
      "reservationDigest",
      "requestDigest",
      "requestArtifactDigest",
      "settledAtMs",
      "outcome",
      "charges",
      "success",
      "failure",
      "evidenceLevel",
      "settlementDigest",
    ],
    "Launch settlement",
  );
  const proposal = verifyPartIdentificationGate0PilotProposal(proposalInput, { request });
  const reservation = verifyPartIdentificationGate0LaunchReservation(reservationInput, {
    proposal,
    authorization,
    request,
  });
  gate0Integer(value.settledAtMs, reservation.reservedAtMs, GATE0_MAX_TIMESTAMP_MS, "settledAtMs");
  exactGate0Object(
    value.charges,
    [
      "modelLaunches",
      "executablePreflights",
      "cards",
      "providerTurns",
      "inputTokens",
      "outputTokens",
      "costMicrousd",
      "elapsedMs",
      "proofBytes",
    ],
    "Settlement charges",
  );
  const heldCharges = {
    modelLaunches: value.charges.modelLaunches,
    executablePreflights: value.charges.executablePreflights,
    cards: value.charges.cards,
    providerTurns: value.charges.providerTurns,
    inputTokens: value.charges.inputTokens,
    outputTokens: value.charges.outputTokens,
    costMicrousd: value.charges.costMicrousd,
    elapsedMs: value.charges.elapsedMs,
    proofBytes: value.charges.proofBytes,
  };
  if (!sameGate0Value(heldCharges, partIdentificationGate0ConservativeCharges(proposal)))
    failGate0("Settlement must conservatively charge every reserved maximum.");
  let success = null;
  let failure = null;
  if (value.outcome === "success" && value.failure === null) {
    exactGate0Object(
      value.success,
      [
        "proofDigest",
        "proofByteLength",
        "providerTurns",
        "inputTokens",
        "outputTokens",
        "costMicrousd",
        "elapsedMs",
        "usageAuthentication",
      ],
      "Settlement success",
    );
    success = successEvidence(
      {
        status: "success",
        proofDigest: value.success.proofDigest,
        proofByteLength: value.success.proofByteLength,
        providerTurns: value.success.providerTurns,
        inputTokens: value.success.inputTokens,
        outputTokens: value.success.outputTokens,
        costMicrousd: value.success.costMicrousd,
        elapsedMs: value.success.elapsedMs,
      },
      proposal.budgets,
    );
    if (
      value.success.usageAuthentication !== success.usageAuthentication ||
      value.settledAtMs - reservation.reservedAtMs < success.elapsedMs
    )
      failGate0("Settlement success usage is not its bounded proof-linked observation.");
  } else if (value.outcome === "failure" && value.success === null) {
    exactGate0Object(
      value.failure,
      ["category", "failureDigest", "failureByteLength", "providerExecutionState"],
      "Settlement failure",
    );
    failure = failureEvidence({
      status: "failure",
      category: value.failure.category,
      failureDigest: value.failure.failureDigest,
      failureByteLength: value.failure.failureByteLength,
    });
    if (value.failure.providerExecutionState !== failure.providerExecutionState)
      failGate0("Settlement failure must conservatively leave provider execution unknown.");
  } else failGate0("Settlement outcome must select exactly one evidence branch.");
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_SETTLEMENT_SCHEMA ||
    value.proposalDigest !== proposal.proposalDigest ||
    value.authorizationDigest !== reservation.authorizationDigest ||
    value.reservationDigest !== reservation.reservationDigest ||
    value.requestDigest !== reservation.requestDigest ||
    value.requestArtifactDigest !== reservation.requestArtifactDigest ||
    value.evidenceLevel !== "local-lineage-only/provider-and-user-identity-not-authenticated"
  )
    failGate0(
      "Settlement does not bind its exact request/reservation lineage or absent authority.",
    );
  const core = {
    schemaVersion: value.schemaVersion,
    proposalDigest: value.proposalDigest,
    authorizationDigest: value.authorizationDigest,
    reservationDigest: value.reservationDigest,
    requestDigest: value.requestDigest,
    requestArtifactDigest: value.requestArtifactDigest,
    settledAtMs: value.settledAtMs,
    outcome: value.outcome,
    charges: heldCharges,
    success,
    failure,
    evidenceLevel: value.evidenceLevel,
  };
  if (
    gate0Digest(value.settlementDigest, "settlementDigest") !== partIdentificationGate0Digest(core)
  )
    failGate0("Settlement digest does not reproduce its canonical core.");
  return deeplyFreezeGate0({ ...core, settlementDigest: value.settlementDigest });
}
