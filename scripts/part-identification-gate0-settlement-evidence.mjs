import { inspectFinalizedPartIdentificationCallProof } from "./part-identification-call-proof.mjs";
import {
  failGate0,
  GATE0_MAX_FAILURE_BYTES,
  partIdentificationGate0BytesDigest,
  partIdentificationGate0JsonBytes,
  sameGate0Value,
} from "./part-identification-gate0-foundation.mjs";

const FAILURE_EVIDENCE_SCHEMA = "lego.part-identification-gate0-failure-evidence/1";
const bufferIsBuffer = Buffer.isBuffer;

export function partIdentificationGate0SuccessEvidence(lineage, finalizedProof) {
  const proof = inspectFinalizedPartIdentificationCallProof(finalizedProof);
  const expected = lineage.proposal.request;
  if (
    !bufferIsBuffer(proof.bytes) ||
    proof.byteLength !== proof.bytes.length ||
    proof.digest !== partIdentificationGate0BytesDigest(proof.bytes) ||
    proof.request.requestDigest !== expected.requestDigest ||
    proof.request.cardsDigest !== expected.cardsDigest ||
    proof.request.promptDigest !== expected.promptDigest ||
    !sameGate0Value(proof.request.instruction, expected.instruction) ||
    !sameGate0Value(proof.request.orderedCards, expected.orderedCards) ||
    !sameGate0Value(proof.request.modelIdentity, lineage.proposal.model)
  ) {
    failGate0("Finalized proof does not reproduce the exact authorized Gate-0 request.");
  }
  return {
    bytes: proof.bytes,
    result: {
      status: "success",
      proofDigest: proof.digest,
      proofByteLength: proof.byteLength,
      providerTurns: proof.providerTurns,
      inputTokens: proof.usage.inputTokens,
      outputTokens: proof.usage.outputTokens,
      costMicrousd: proof.usage.costMicrousd,
      elapsedMs: proof.elapsedMs,
    },
  };
}

export function partIdentificationGate0FailureEvidence(launch, category) {
  const value = {
    schemaVersion: FAILURE_EVIDENCE_SCHEMA,
    category,
    launchDigest: launch.launchDigest,
    providerExecutionState: "unknown-conservatively-charged",
  };
  const bytes = partIdentificationGate0JsonBytes(value);
  if (bytes.length < 1 || bytes.length > GATE0_MAX_FAILURE_BYTES) {
    failGate0("Gate-0 failure evidence exceeds its bounded retained record.");
  }
  return {
    bytes,
    result: {
      status: "failure",
      category,
      failureDigest: partIdentificationGate0BytesDigest(bytes),
      failureByteLength: bytes.length,
    },
  };
}
