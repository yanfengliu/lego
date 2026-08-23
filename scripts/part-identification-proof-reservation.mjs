import { PartIdentificationClaudeTransportError } from "./part-identification-claude-error.mjs";
import { partIdentificationGate0CanonicalJsonBytes } from "./part-identification-gate0-json.mjs";
import {
  partIdentificationEvidenceContent,
  verifyPartIdentificationMcpRequest,
} from "./part-identification-mcp-server.mjs";
import {
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
  PART_IDENTIFICATION_MAX_RESULT_BYTES,
} from "./part-identification-transport-contract.mjs";

export function estimatePartIdentificationProofReservation(requestInput) {
  const request = verifyPartIdentificationMcpRequest(requestInput);
  const contentBytes = partIdentificationGate0CanonicalJsonBytes(
    partIdentificationEvidenceContent(request),
  ).length;
  const reservation = contentBytes + PART_IDENTIFICATION_MAX_RESULT_BYTES + 256 * 1024;
  if (reservation > PART_IDENTIFICATION_MAX_PROOF_BYTES) {
    throw new PartIdentificationClaudeTransportError(
      `Exact card content reserves ${reservation} proof bytes above ${PART_IDENTIFICATION_MAX_PROOF_BYTES}; reduce the batch before provider launch.`,
    );
  }
  return reservation;
}
