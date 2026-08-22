import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
} from "./real-build-prepared-search-boundary";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "./real-build-prepared-search-plan";
import { parseCompiledPlacementPieces } from "./real-build-compiled-placement-lineage-parser-components";
import {
  compiledEvidenceArray,
  compiledEvidenceCandidateId,
  compiledEvidenceDigest,
  compiledEvidenceInteger,
  compiledEvidenceLineageId,
  compiledEvidenceRecord,
} from "./real-build-compiled-placement-lineage-parse-primitives";
import type {
  RealBuildCompiledSearchRequest,
  RealBuildCompiledSearchRequestParent,
  RealBuildCompiledSearchRequestProposal,
} from "./real-build-compiled-placement-lineage-types";

const MAXIMUM_PROPOSALS = 8_192;
const MAXIMUM_PROPOSAL_OPERATIONS = 1_024;

function parseParent(value: unknown, index: number): RealBuildCompiledSearchRequestParent {
  const path = `compiledLineage.searchRequest.parents[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "parentLineageId",
    "candidateId",
    "documentHash",
    "canonicalDocumentDigest",
    "offeredLineages",
  ]);
  return intrinsicRealBuildFreeze({
    parentLineageId: compiledEvidenceLineageId(row.parentLineageId, `${path}.parentLineageId`),
    candidateId: compiledEvidenceCandidateId(row.candidateId, `${path}.candidateId`),
    documentHash: compiledEvidenceDigest(row.documentHash, `${path}.documentHash`),
    canonicalDocumentDigest: compiledEvidenceDigest(
      row.canonicalDocumentDigest,
      `${path}.canonicalDocumentDigest`,
    ),
    offeredLineages: compiledEvidenceInteger(
      row.offeredLineages,
      `${path}.offeredLineages`,
      1,
      MAXIMUM_PROPOSALS,
    ),
  });
}

function parseProposal(value: unknown, index: number): RealBuildCompiledSearchRequestProposal {
  const path = `compiledLineage.searchRequest.proposals[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "proposalId",
    "parentLineageId",
    "pieces",
    "connectionCount",
    "programOperationCount",
  ]);
  return intrinsicRealBuildFreeze({
    proposalId: compiledEvidenceDigest(row.proposalId, `${path}.proposalId`),
    parentLineageId: compiledEvidenceLineageId(row.parentLineageId, `${path}.parentLineageId`),
    pieces: parseCompiledPlacementPieces(row.pieces, `${path}.pieces`),
    connectionCount: compiledEvidenceInteger(
      row.connectionCount,
      `${path}.connectionCount`,
      0,
      MAXIMUM_PROPOSAL_OPERATIONS - 1,
    ),
    programOperationCount: compiledEvidenceInteger(
      row.programOperationCount,
      `${path}.programOperationCount`,
      1,
      MAXIMUM_PROPOSAL_OPERATIONS,
    ),
  });
}

export function parseCompiledSearchRequest(value: unknown): RealBuildCompiledSearchRequest {
  const path = "compiledLineage.searchRequest";
  const row = compiledEvidenceRecord(value, path, [
    "preflightIdentity",
    "parents",
    "proposals",
    "offeredLineages",
    "witnessCount",
    "connectionCount",
    "programOperationCount",
  ]);
  return intrinsicRealBuildFreeze({
    preflightIdentity: compiledEvidenceDigest(row.preflightIdentity, `${path}.preflightIdentity`),
    parents: intrinsicRealBuildFreeze(
      compiledEvidenceArray(
        row.parents,
        `${path}.parents`,
        MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PARENTS,
        1,
      ).map(parseParent),
    ),
    proposals: intrinsicRealBuildFreeze(
      compiledEvidenceArray(row.proposals, `${path}.proposals`, MAXIMUM_PROPOSALS, 1).map(
        parseProposal,
      ),
    ),
    offeredLineages: compiledEvidenceInteger(
      row.offeredLineages,
      `${path}.offeredLineages`,
      1,
      MAXIMUM_PROPOSALS,
    ),
    witnessCount: compiledEvidenceInteger(
      row.witnessCount,
      `${path}.witnessCount`,
      1,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_WITNESSES,
    ),
    connectionCount: compiledEvidenceInteger(
      row.connectionCount,
      `${path}.connectionCount`,
      0,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
    ),
    programOperationCount: compiledEvidenceInteger(
      row.programOperationCount,
      `${path}.programOperationCount`,
      1,
      MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS,
    ),
  });
}
