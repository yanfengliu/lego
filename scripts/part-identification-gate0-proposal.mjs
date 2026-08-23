import { estimatePartIdentificationProofReservation } from "./part-identification-proof-reservation.mjs";
import {
  isPinnedModelIdentity,
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
} from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_MCP_SCHEMA } from "./part-identification-mcp-server.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { PART_IDENTIFICATION_TRANSPORT_CONTRACT } from "./part-identification-transport-contract.mjs";
import {
  deeplyFreezeGate0,
  exactGate0Array,
  exactGate0Object,
  failGate0,
  GATE0_MAX_RECORD_BYTES,
  GATE0_MAX_TIMESTAMP_MS,
  gate0ArrayMap,
  gate0AuthorityAbsence,
  gate0Budgets,
  gate0Digest,
  gate0Integer,
  gate0ObjectKeys,
  gate0PolicyReview,
  gate0Scope,
  gate0TransportBinding,
  partIdentificationGate0Digest,
  PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS,
  PART_IDENTIFICATION_GATE0_AUTHORIZATION_SCHEMA,
  PART_IDENTIFICATION_GATE0_CARDS_DIGEST,
  PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT,
  PART_IDENTIFICATION_GATE0_INSTRUCTION,
  PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS,
  PART_IDENTIFICATION_GATE0_MAX_POLICY_AGE_MS,
  PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES,
  PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS,
  PART_IDENTIFICATION_GATE0_PILOT_CARDS,
  PART_IDENTIFICATION_GATE0_PROMPT_DIGEST,
  PART_IDENTIFICATION_GATE0_PROOF_RESERVATION_BYTES,
  PART_IDENTIFICATION_GATE0_PROPOSAL_SCHEMA,
  PART_IDENTIFICATION_GATE0_PURPOSE,
  PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT,
  PART_IDENTIFICATION_GATE0_REQUEST_DIGEST,
  sameGate0Value,
  snapshotGate0Request,
} from "./part-identification-gate0-foundation.mjs";

const bufferFrom = Buffer.from;

export function createPartIdentificationGate0PilotProposal(input) {
  exactGate0Object(
    input,
    ["request", "purpose", "proposedAtMs", "policyReview", "budgets"],
    "Proposal input",
  );
  const request = snapshotGate0Request(input.request);
  gate0Integer(input.proposedAtMs, 0, GATE0_MAX_TIMESTAMP_MS, "proposedAtMs");
  if (input.purpose !== PART_IDENTIFICATION_GATE0_PURPOSE)
    failGate0("Gate-0 proposal purpose is not the isolated six-card pilot.");
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_PROPOSAL_SCHEMA,
    purpose: input.purpose,
    proposedAtMs: input.proposedAtMs,
    request: request.binding,
    transport: gate0TransportBinding(),
    model: { ...PART_IDENTIFICATION_MODEL_IDENTITY },
    dataScope: gate0Scope(request.binding, request.aggregateBytes),
    policyReview: gate0PolicyReview(input.policyReview, input.proposedAtMs),
    budgets: gate0Budgets(
      input.budgets,
      estimatePartIdentificationProofReservation(request.canonical),
    ),
    authority: gate0AuthorityAbsence(),
  };
  return verifyPartIdentificationGate0PilotProposal(
    { ...core, proposalDigest: partIdentificationGate0Digest(core) },
    { request: request.canonical },
  );
}

export function verifyPartIdentificationGate0PilotProposal(value, options = {}) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "purpose",
      "proposedAtMs",
      "request",
      "transport",
      "model",
      "dataScope",
      "policyReview",
      "budgets",
      "authority",
      "proposalDigest",
    ],
    "Pilot proposal",
  );
  gate0Integer(value.proposedAtMs, 0, GATE0_MAX_TIMESTAMP_MS, "proposedAtMs");
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_PROPOSAL_SCHEMA ||
    value.purpose !== PART_IDENTIFICATION_GATE0_PURPOSE
  )
    failGate0("Pilot proposal schema or purpose is not current.");
  exactGate0Object(
    value.request,
    [
      "schemaVersion",
      "requestDigest",
      "artifactDigest",
      "artifactByteLength",
      "cardsDigest",
      "promptDigest",
      "instruction",
      "orderedCards",
    ],
    "Proposal request binding",
  );
  exactGate0Object(
    value.request.instruction,
    ["byteLength", "digest"],
    "Proposal instruction binding",
  );
  exactGate0Array(value.request.orderedCards, 6, "Proposal ordered cards");
  let aggregate = 0;
  const orderedCards = gate0ArrayMap(value.request.orderedCards, (card, index) => {
    exactGate0Object(card, ["cardId", "byteLength", "digest"], `Proposal card ${index}`);
    if (
      card.cardId !== PART_IDENTIFICATION_GATE0_PILOT_CARD_IDS[index] ||
      !sameGate0Value(card, PART_IDENTIFICATION_GATE0_PILOT_CARDS[index])
    )
      failGate0(`Proposal card ${index} is not the fixed pilot card.`);
    gate0Integer(
      card.byteLength,
      1,
      PART_IDENTIFICATION_TRANSPORT_CONTRACT.maxCardBytesPerCall,
      `Proposal card ${index} byteLength`,
    );
    gate0Digest(card.digest, `Proposal card ${index} digest`);
    aggregate += card.byteLength;
    return { cardId: card.cardId, byteLength: card.byteLength, digest: card.digest };
  });
  if (aggregate !== PART_IDENTIFICATION_GATE0_PILOT_CARD_BYTES)
    failGate0("Proposal card bytes do not equal the measured worst packet.");
  const digestFields = ["requestDigest", "artifactDigest", "cardsDigest", "promptDigest"];
  for (let index = 0; index < digestFields.length; index += 1) {
    const field = digestFields[index];
    gate0Digest(value.request[field], `Proposal ${field}`);
  }
  gate0Integer(
    value.request.artifactByteLength,
    1,
    24 * 1024 * 1024,
    "Proposal request artifactByteLength",
  );
  gate0Integer(
    value.request.instruction.byteLength,
    1,
    512 * 1024,
    "Proposal instruction byteLength",
  );
  gate0Digest(value.request.instruction.digest, "Proposal instruction digest");
  if (
    value.request.schemaVersion !== PART_IDENTIFICATION_MCP_SCHEMA ||
    value.request.requestDigest !== PART_IDENTIFICATION_GATE0_REQUEST_DIGEST ||
    value.request.cardsDigest !== PART_IDENTIFICATION_GATE0_CARDS_DIGEST ||
    value.request.promptDigest !== PART_IDENTIFICATION_GATE0_PROMPT_DIGEST ||
    !sameGate0Value(value.request.instruction, PART_IDENTIFICATION_GATE0_INSTRUCTION)
  ) {
    failGate0("Proposal request binding is not the exact fixed pilot request.");
  }
  const requestBinding = {
    schemaVersion: value.request.schemaVersion,
    requestDigest: value.request.requestDigest,
    artifactDigest: value.request.artifactDigest,
    artifactByteLength: value.request.artifactByteLength,
    cardsDigest: value.request.cardsDigest,
    promptDigest: value.request.promptDigest,
    instruction: {
      byteLength: value.request.instruction.byteLength,
      digest: value.request.instruction.digest,
    },
    orderedCards,
  };
  exactGate0Object(
    value.transport,
    ["schemaVersion", "contractDigest", "providerExecutionAuthenticated", "executableReplay"],
    "Proposal transport",
  );
  if (!sameGate0Value(value.transport, gate0TransportBinding()))
    failGate0("Proposal transport is not the current unauthenticated contract.");
  exactGate0Object(
    value.model,
    ["requestedModelId", "responseModelId", "canonicalModel", "provider"],
    "Proposal model",
  );
  if (
    value.model.requestedModelId !== PART_IDENTIFICATION_MODEL_ID ||
    !isPinnedModelIdentity(value.model, PART_IDENTIFICATION_MODEL_ID)
  )
    failGate0("Proposal model is not the pinned identity.");
  const expectedScope = gate0Scope(requestBinding, aggregate);
  exactGate0Object(value.dataScope, gate0ObjectKeys(expectedScope), "Proposal data scope");
  if (!sameGate0Value(value.dataScope, expectedScope))
    failGate0("Proposal data scope is not crop-only.");
  const heldBudgets = gate0Budgets(
    value.budgets,
    PART_IDENTIFICATION_GATE0_PROOF_RESERVATION_BYTES,
  );
  exactGate0Object(
    value.authority,
    ["providerExecutionAuthenticated", "repositoryOwnerIdentityAuthenticated"],
    "Proposal authority",
  );
  if (!sameGate0Value(value.authority, gate0AuthorityAbsence()))
    failGate0("Proposal may not claim provider or repository-owner identity authentication.");
  const core = {
    schemaVersion: value.schemaVersion,
    purpose: value.purpose,
    proposedAtMs: value.proposedAtMs,
    request: requestBinding,
    transport: gate0TransportBinding(),
    model: { ...PART_IDENTIFICATION_MODEL_IDENTITY },
    dataScope: expectedScope,
    policyReview: gate0PolicyReview(value.policyReview, value.proposedAtMs),
    budgets: heldBudgets,
    authority: gate0AuthorityAbsence(),
  };
  if (gate0Digest(value.proposalDigest, "proposalDigest") !== partIdentificationGate0Digest(core))
    failGate0("Pilot proposal digest does not reproduce its canonical core.");
  if (
    value.request.artifactDigest !== PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.digest ||
    value.request.artifactByteLength !== PART_IDENTIFICATION_GATE0_REQUEST_ARTIFACT.byteLength
  ) {
    failGate0("Pilot proposal requires the exact retained request artifact bytes.");
  }
  if (options.request !== undefined) {
    const request = snapshotGate0Request(options.request);
    if (
      !sameGate0Value(request.binding, requestBinding) ||
      heldBudgets.maxProofBytes !== estimatePartIdentificationProofReservation(request.canonical)
    )
      failGate0("Pilot proposal does not bind the supplied exact MCP request.");
  }
  return deeplyFreezeGate0({ ...core, proposalDigest: value.proposalDigest });
}

function exposureAcknowledgement(value) {
  exactGate0Object(
    value,
    gate0ObjectKeys(PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT),
    "Exposure acknowledgement",
  );
  const core = {
    consumerTraining: value.consumerTraining,
    consumerRetention: value.consumerRetention,
    consumerSafetyReview: value.consumerSafetyReview,
  };
  if (!sameGate0Value(core, PART_IDENTIFICATION_GATE0_EXPOSURE_ACKNOWLEDGEMENT))
    failGate0("Authorization must accept all three worst-case consumer exposures.");
  return core;
}

function authorizationCore(value, proposal, request, nowMs) {
  exactGate0Object(
    value,
    [
      "schemaVersion",
      "proposalDigest",
      "decision",
      "authorizationBasis",
      "repositoryOwnerIdentityAuthenticated",
      "exposureAcknowledgement",
      "authorizedAtMs",
      "notBeforeMs",
      "notAfterMs",
      "authorizationDigest",
    ],
    "Authorization record",
  );
  if (
    value.schemaVersion !== PART_IDENTIFICATION_GATE0_AUTHORIZATION_SCHEMA ||
    value.proposalDigest !== proposal.proposalDigest ||
    value.decision !== "approved" ||
    value.authorizationBasis !== PART_IDENTIFICATION_GATE0_AUTHORIZATION_BASIS ||
    value.repositoryOwnerIdentityAuthenticated !== false
  )
    failGate0(
      "Authorization is not the exact approved trusted-local-caller assertion with user-event and identity authentication absent.",
    );
  const heldExposure = exposureAcknowledgement(value.exposureAcknowledgement);
  gate0Integer(value.authorizedAtMs, 0, GATE0_MAX_TIMESTAMP_MS, "authorizedAtMs");
  gate0Integer(value.notBeforeMs, 0, GATE0_MAX_TIMESTAMP_MS, "notBeforeMs");
  gate0Integer(value.notAfterMs, 0, GATE0_MAX_TIMESTAMP_MS, "notAfterMs");
  gate0Integer(nowMs, 0, GATE0_MAX_TIMESTAMP_MS, "authorization verification time");
  if (
    value.authorizedAtMs < proposal.proposedAtMs ||
    value.authorizedAtMs >
      proposal.proposedAtMs + PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS ||
    value.notBeforeMs > value.authorizedAtMs ||
    value.authorizedAtMs > value.notAfterMs ||
    value.notAfterMs - value.notBeforeMs > PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS ||
    value.notAfterMs >
      proposal.proposedAtMs + PART_IDENTIFICATION_GATE0_MAX_AUTHORIZATION_WINDOW_MS ||
    nowMs < value.authorizedAtMs ||
    nowMs < value.notBeforeMs ||
    nowMs > value.notAfterMs
  )
    failGate0("Authorization is outside its short current proposal-bound window.");
  let stalePolicySource = false;
  for (let index = 0; index < proposal.policyReview.sources.length; index += 1) {
    if (
      nowMs - proposal.policyReview.sources[index].retrievedAtMs >
      PART_IDENTIFICATION_GATE0_MAX_POLICY_AGE_MS
    ) {
      stalePolicySource = true;
    }
  }
  if (
    nowMs - proposal.policyReview.reviewedAtMs > PART_IDENTIFICATION_GATE0_MAX_POLICY_AGE_MS ||
    stalePolicySource
  ) {
    failGate0("Authorization requires policy evidence still current within 24 hours.");
  }
  const core = {
    schemaVersion: value.schemaVersion,
    proposalDigest: value.proposalDigest,
    decision: value.decision,
    authorizationBasis: value.authorizationBasis,
    repositoryOwnerIdentityAuthenticated: value.repositoryOwnerIdentityAuthenticated,
    exposureAcknowledgement: heldExposure,
    authorizedAtMs: value.authorizedAtMs,
    notBeforeMs: value.notBeforeMs,
    notAfterMs: value.notAfterMs,
  };
  if (
    gate0Digest(value.authorizationDigest, "authorizationDigest") !==
    partIdentificationGate0Digest(core)
  )
    failGate0("Authorization digest does not reproduce its canonical core.");
  return core;
}

export function createPartIdentificationGate0Authorization(input) {
  exactGate0Object(
    input,
    [
      "proposal",
      "request",
      "decision",
      "authorizationBasis",
      "repositoryOwnerIdentityAuthenticated",
      "exposureAcknowledgement",
      "authorizedAtMs",
      "notBeforeMs",
      "notAfterMs",
      "nowMs",
    ],
    "Authorization input",
  );
  const proposal = verifyPartIdentificationGate0PilotProposal(input.proposal, {
    request: input.request,
  });
  const heldExposure = exposureAcknowledgement(input.exposureAcknowledgement);
  const core = {
    schemaVersion: PART_IDENTIFICATION_GATE0_AUTHORIZATION_SCHEMA,
    proposalDigest: proposal.proposalDigest,
    decision: input.decision,
    authorizationBasis: input.authorizationBasis,
    repositoryOwnerIdentityAuthenticated: input.repositoryOwnerIdentityAuthenticated,
    exposureAcknowledgement: heldExposure,
    authorizedAtMs: input.authorizedAtMs,
    notBeforeMs: input.notBeforeMs,
    notAfterMs: input.notAfterMs,
  };
  return verifyPartIdentificationGate0Authorization(
    { ...core, authorizationDigest: partIdentificationGate0Digest(core) },
    { proposal, request: input.request, nowMs: input.nowMs },
  );
}

export function verifyPartIdentificationGate0Authorization(
  value,
  { proposal: proposalInput, request, nowMs },
) {
  const proposal = verifyPartIdentificationGate0PilotProposal(proposalInput, { request });
  const core = authorizationCore(value, proposal, request, nowMs);
  return deeplyFreezeGate0({ ...core, authorizationDigest: value.authorizationDigest });
}

export function parsePartIdentificationGate0Authorization(bytesInput, context) {
  if (
    !(bytesInput instanceof Uint8Array) ||
    bytesInput.byteLength < 1 ||
    bytesInput.byteLength > GATE0_MAX_RECORD_BYTES
  )
    failGate0(`Authorization bytes must contain 1..${GATE0_MAX_RECORD_BYTES} bytes.`);
  let value;
  try {
    value = parseStrictJsonBytes(bufferFrom(bytesInput));
  } catch {
    failGate0("Authorization bytes are not fatal strict UTF-8 JSON.");
  }
  return verifyPartIdentificationGate0Authorization(value, context);
}
