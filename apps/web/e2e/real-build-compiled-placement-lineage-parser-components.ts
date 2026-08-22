import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES,
  snapshotPreparedPlacementWitness,
} from "./real-build-prepared-search-boundary";
import {
  compiledEvidenceArray,
  compiledEvidenceCandidateId,
  compiledEvidenceDigest,
  compiledEvidenceInteger,
  compiledEvidenceLineageIdentity,
  compiledEvidenceLineageId,
  compiledEvidenceRecord,
  compiledEvidenceString,
  compiledEvidenceTransitionId,
} from "./real-build-compiled-placement-lineage-parse-primitives";
import type {
  RealBuildCompiledAcceptedTransition,
  RealBuildCompiledAutomaticReceiptEvidence,
  RealBuildCompiledLineageEdge,
  RealBuildCompiledLineageChildCandidate,
  RealBuildCompiledLineageRootCandidate,
  RealBuildCompiledPlacementTransitionEvidence,
  RealBuildCompiledPreparedStepEvidence,
  RealBuildCompiledSearchReservation,
  RealBuildCompiledValidationEvidence,
} from "./real-build-compiled-placement-lineage-types";

function parseCompiledCandidateBytes(
  value: unknown,
  path: string,
): Omit<RealBuildCompiledLineageChildCandidate, "candidateId" | "documentHash"> {
  const row = value as Record<string, unknown>;
  return intrinsicRealBuildFreeze({
    canonicalBytes: compiledEvidenceString(
      row.canonicalBytes,
      `${path}.canonicalBytes`,
      16 * 1024 * 1024,
    ),
    canonicalBytesHash: compiledEvidenceDigest(
      row.canonicalBytesHash,
      `${path}.canonicalBytesHash`,
    ),
    canonicalByteLength: compiledEvidenceInteger(
      row.canonicalByteLength,
      `${path}.canonicalByteLength`,
      2,
      16 * 1024 * 1024,
    ),
  });
}

export function parseCompiledPreparedStep(value: unknown): RealBuildCompiledPreparedStepEvidence {
  const row = compiledEvidenceRecord(value, "compiledLineage.preparedStep", [
    "preparedRunInputDigest",
    "printedStepIdentity",
    "actionEvidenceDigest",
    "compilerMetadata",
  ]);
  const compilerMetadata = compiledEvidenceRecord(
    row.compilerMetadata,
    "compiledLineage.preparedStep.compilerMetadata",
    ["name", "sourceActionDigest"],
  );
  return intrinsicRealBuildFreeze({
    preparedRunInputDigest: compiledEvidenceDigest(
      row.preparedRunInputDigest,
      "compiledLineage.preparedStep.preparedRunInputDigest",
    ),
    printedStepIdentity: compiledEvidenceDigest(
      row.printedStepIdentity,
      "compiledLineage.preparedStep.printedStepIdentity",
    ),
    actionEvidenceDigest: compiledEvidenceDigest(
      row.actionEvidenceDigest,
      "compiledLineage.preparedStep.actionEvidenceDigest",
    ),
    compilerMetadata: intrinsicRealBuildFreeze({
      name: compiledEvidenceString(
        compilerMetadata.name,
        "compiledLineage.preparedStep.compilerMetadata.name",
        256,
      ),
      sourceActionDigest: compiledEvidenceDigest(
        compilerMetadata.sourceActionDigest,
        "compiledLineage.preparedStep.compilerMetadata.sourceActionDigest",
      ),
    }),
  });
}

export function parseCompiledRootCandidate(
  value: unknown,
  index: number,
): RealBuildCompiledLineageRootCandidate {
  const path = `compiledLineage.rootCandidates[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "candidateId",
    "documentHash",
    "identities",
    "canonicalBytes",
    "canonicalBytesHash",
    "canonicalByteLength",
  ]);
  return intrinsicRealBuildFreeze({
    candidateId: compiledEvidenceCandidateId(row.candidateId, `${path}.candidateId`),
    documentHash: compiledEvidenceDigest(row.documentHash, `${path}.documentHash`),
    identities: intrinsicRealBuildFreeze(
      compiledEvidenceArray(row.identities, `${path}.identities`, 8_192, 1).map(
        (identity, identityIndex) =>
          compiledEvidenceLineageIdentity(identity, `${path}.identities[${identityIndex}]`),
      ),
    ),
    ...parseCompiledCandidateBytes(row, path),
  });
}

export function parseCompiledChildCandidate(
  value: unknown,
  index: number,
): RealBuildCompiledLineageChildCandidate {
  const path = `compiledLineage.childCandidates[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "candidateId",
    "documentHash",
    "canonicalBytes",
    "canonicalBytesHash",
    "canonicalByteLength",
  ]);
  return intrinsicRealBuildFreeze({
    candidateId: compiledEvidenceCandidateId(row.candidateId, `${path}.candidateId`),
    documentHash: compiledEvidenceDigest(row.documentHash, `${path}.documentHash`),
    ...parseCompiledCandidateBytes(row, path),
  });
}

export function parseCompiledReservation(value: unknown): RealBuildCompiledSearchReservation {
  const path = "compiledLineage.searchReservation";
  const row = compiledEvidenceRecord(value, path, [
    "budget",
    "reservedBefore",
    "requested",
    "reservedAfter",
    "reservationNumber",
    "admitted",
    "refusal",
    "terminalFailure",
  ]);
  if (typeof row.admitted !== "boolean") throw new TypeError(`${path}.admitted must be boolean.`);
  if (
    row.refusal !== null &&
    row.refusal !== "budget-exceeded" &&
    row.refusal !== "ledger-already-refused"
  ) {
    throw new TypeError(
      `${path}.refusal must be null, budget-exceeded, or ledger-already-refused.`,
    );
  }
  let terminalFailure: RealBuildCompiledSearchReservation["terminalFailure"] = null;
  if (row.terminalFailure !== null) {
    const failurePath = `${path}.terminalFailure`;
    const failure = compiledEvidenceRecord(row.terminalFailure, failurePath, [
      "preflightIdentity",
      "reservationNumber",
      "reservedBefore",
      "requested",
      "budget",
    ]);
    terminalFailure = intrinsicRealBuildFreeze({
      preflightIdentity: compiledEvidenceDigest(
        failure.preflightIdentity,
        `${failurePath}.preflightIdentity`,
      ),
      reservationNumber: compiledEvidenceInteger(
        failure.reservationNumber,
        `${failurePath}.reservationNumber`,
        1,
        8_192,
      ),
      reservedBefore: compiledEvidenceInteger(
        failure.reservedBefore,
        `${failurePath}.reservedBefore`,
        0,
        8_192,
      ),
      requested: compiledEvidenceInteger(failure.requested, `${failurePath}.requested`, 0, 8_192),
      budget: compiledEvidenceInteger(failure.budget, `${failurePath}.budget`, 0, 8_192),
    });
  }
  return intrinsicRealBuildFreeze({
    budget: compiledEvidenceInteger(row.budget, `${path}.budget`, 0, 8_192),
    reservedBefore: compiledEvidenceInteger(row.reservedBefore, `${path}.reservedBefore`, 0, 8_192),
    requested: compiledEvidenceInteger(row.requested, `${path}.requested`, 0, 8_192),
    reservedAfter: compiledEvidenceInteger(row.reservedAfter, `${path}.reservedAfter`, 0, 8_192),
    reservationNumber: compiledEvidenceInteger(
      row.reservationNumber,
      `${path}.reservationNumber`,
      1,
      8_192,
    ),
    admitted: row.admitted,
    refusal: row.refusal,
    terminalFailure,
  });
}

function exactWitnessShape(value: unknown, path: string, witnessIndex: number): void {
  const row = compiledEvidenceRecord(value, path, [
    "identityKey",
    "catalogPartId",
    "colorId",
    "transform",
    "connections",
  ]);
  compiledEvidenceRecord(row.transform, `${path}.transform`, ["positionLdu", "orientationId"]);
  const connections = compiledEvidenceArray(
    row.connections,
    `${path}.connections`,
    MAXIMUM_REAL_BUILD_PREPARED_SEARCH_CONNECTIONS,
  );
  connections.forEach((connection, connectionIndex) => {
    const connectionPath = `${path}.connections[${connectionIndex}]`;
    const connectionRow = compiledEvidenceRecord(connection, connectionPath, [
      "target",
      "targetPortId",
      "candidatePortId",
      "connectionKind",
    ]);
    if (
      connectionRow.target === null ||
      typeof connectionRow.target !== "object" ||
      Array.isArray(connectionRow.target)
    ) {
      throw new TypeError(`${connectionPath}.target must be a base or witness object.`);
    }
    const kind = (connectionRow.target as Record<string, unknown>).kind;
    if (kind === "base") {
      compiledEvidenceRecord(connectionRow.target, `${connectionPath}.target`, ["kind", "partId"]);
    } else if (kind === "witness") {
      compiledEvidenceRecord(connectionRow.target, `${connectionPath}.target`, [
        "kind",
        "witnessIndex",
      ]);
      void witnessIndex;
    } else {
      throw new TypeError(`${connectionPath}.target.kind must be base or witness.`);
    }
  });
}

export function parseCompiledPlacementPieces(value: unknown, path: string) {
  return intrinsicRealBuildFreeze(
    compiledEvidenceArray(value, path, MAXIMUM_REAL_BUILD_PREPARED_SEARCH_PIECES, 1).map(
      (piece, pieceIndex) => {
        const piecePath = `${path}[${pieceIndex}]`;
        exactWitnessShape(piece, piecePath, pieceIndex);
        return snapshotPreparedPlacementWitness(piece, piecePath, pieceIndex);
      },
    ),
  );
}

function parseCompiledValidation(
  value: unknown,
  path: string,
): RealBuildCompiledValidationEvidence {
  const row = compiledEvidenceRecord(value, path, [
    "targetDocumentHash",
    "truthSnapshotHash",
    "validatorSetHash",
    "documentGloballyValid",
    "blockingIssues",
  ]);
  if (row.documentGloballyValid !== true) {
    throw new TypeError(
      `${path}.documentGloballyValid must be true for a compiled success receipt.`,
    );
  }
  compiledEvidenceArray(row.blockingIssues, `${path}.blockingIssues`, 0);
  return intrinsicRealBuildFreeze({
    targetDocumentHash: compiledEvidenceDigest(
      row.targetDocumentHash,
      `${path}.targetDocumentHash`,
    ),
    truthSnapshotHash: compiledEvidenceDigest(row.truthSnapshotHash, `${path}.truthSnapshotHash`),
    validatorSetHash: compiledEvidenceDigest(row.validatorSetHash, `${path}.validatorSetHash`),
    documentGloballyValid: true,
    blockingIssues: intrinsicRealBuildFreeze([]) as readonly [],
  });
}

function parseCompiledReceipt(
  value: unknown,
  path: string,
): RealBuildCompiledAutomaticReceiptEvidence {
  const row = compiledEvidenceRecord(value, path, [
    "schemaVersion",
    "compilerSnapshotHash",
    "compilerInputDigest",
    "programHash",
    "placementProgramHash",
    "jobId",
    "candidateId",
    "baseCanonicalBytesHash",
    "baseCanonicalByteLength",
    "baseDocumentHash",
    "printedStepNumber",
    "canonicalStepId",
    "finalDocumentHash",
    "finalRevision",
    "validation",
  ]);
  if (row.schemaVersion !== "lego.real-build-automatic-placement-receipt/1") {
    throw new TypeError(`${path}.schemaVersion must be automatic-placement-receipt/1.`);
  }
  return intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-automatic-placement-receipt/1",
    compilerSnapshotHash: compiledEvidenceDigest(
      row.compilerSnapshotHash,
      `${path}.compilerSnapshotHash`,
    ),
    compilerInputDigest: compiledEvidenceDigest(
      row.compilerInputDigest,
      `${path}.compilerInputDigest`,
    ),
    programHash: compiledEvidenceDigest(row.programHash, `${path}.programHash`),
    placementProgramHash: compiledEvidenceDigest(
      row.placementProgramHash,
      `${path}.placementProgramHash`,
    ),
    jobId: compiledEvidenceString(row.jobId, `${path}.jobId`, 128),
    candidateId: compiledEvidenceCandidateId(row.candidateId, `${path}.candidateId`),
    baseCanonicalBytesHash: compiledEvidenceDigest(
      row.baseCanonicalBytesHash,
      `${path}.baseCanonicalBytesHash`,
    ),
    baseCanonicalByteLength: compiledEvidenceInteger(
      row.baseCanonicalByteLength,
      `${path}.baseCanonicalByteLength`,
      2,
      16 * 1024 * 1024,
    ),
    baseDocumentHash: compiledEvidenceDigest(row.baseDocumentHash, `${path}.baseDocumentHash`),
    printedStepNumber: compiledEvidenceInteger(
      row.printedStepNumber,
      `${path}.printedStepNumber`,
      1,
      359,
    ),
    canonicalStepId: compiledEvidenceString(row.canonicalStepId, `${path}.canonicalStepId`, 128),
    finalDocumentHash: compiledEvidenceDigest(row.finalDocumentHash, `${path}.finalDocumentHash`),
    finalRevision: compiledEvidenceString(row.finalRevision, `${path}.finalRevision`, 128),
    validation: parseCompiledValidation(row.validation, `${path}.validation`),
  });
}

export function parseCompiledTransition(
  value: unknown,
  index: number,
): RealBuildCompiledPlacementTransitionEvidence {
  const path = `compiledLineage.uniqueTransitions[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "transitionId",
    "parentCandidateId",
    "parentDocumentHash",
    "childCandidateId",
    "childDocumentHash",
    "printedStep",
    "pieces",
    "receipt",
  ]);
  const printedStep = compiledEvidenceRecord(row.printedStep, `${path}.printedStep`, [
    "name",
    "sourceActionDigest",
  ]);
  const pieces = parseCompiledPlacementPieces(row.pieces, `${path}.pieces`);
  return intrinsicRealBuildFreeze({
    transitionId: compiledEvidenceTransitionId(row.transitionId, `${path}.transitionId`),
    parentCandidateId: compiledEvidenceCandidateId(
      row.parentCandidateId,
      `${path}.parentCandidateId`,
    ),
    parentDocumentHash: compiledEvidenceDigest(
      row.parentDocumentHash,
      `${path}.parentDocumentHash`,
    ),
    childCandidateId: compiledEvidenceCandidateId(row.childCandidateId, `${path}.childCandidateId`),
    childDocumentHash: compiledEvidenceDigest(row.childDocumentHash, `${path}.childDocumentHash`),
    printedStep: intrinsicRealBuildFreeze({
      name: compiledEvidenceString(printedStep.name, `${path}.printedStep.name`, 256),
      sourceActionDigest: compiledEvidenceDigest(
        printedStep.sourceActionDigest,
        `${path}.printedStep.sourceActionDigest`,
      ),
    }),
    pieces,
    receipt: parseCompiledReceipt(row.receipt, `${path}.receipt`),
  });
}

export function parseCompiledLineageEdge(
  value: unknown,
  index: number,
): RealBuildCompiledLineageEdge {
  const path = `compiledLineage.lineageEdges[${index}]`;
  const row = compiledEvidenceRecord(value, path, [
    "parentLineageId",
    "proposalId",
    "child",
    "transitionId",
  ]);
  return intrinsicRealBuildFreeze({
    parentLineageId: compiledEvidenceLineageId(row.parentLineageId, `${path}.parentLineageId`),
    proposalId: compiledEvidenceDigest(row.proposalId, `${path}.proposalId`),
    child: compiledEvidenceLineageIdentity(row.child, `${path}.child`),
    transitionId: compiledEvidenceTransitionId(row.transitionId, `${path}.transitionId`),
  });
}

export function parseCompiledAcceptedTransition(
  value: unknown,
): RealBuildCompiledAcceptedTransition | null {
  if (value === null) return null;
  const path = "compiledLineage.acceptedTransition";
  const row = compiledEvidenceRecord(value, path, [
    "candidateId",
    "documentHash",
    "lineageIds",
    "transitionIds",
    "beforeRevision",
    "afterRevision",
    "canonicalStepId",
    "placedPieces",
    "validation",
  ]);
  return intrinsicRealBuildFreeze({
    candidateId: compiledEvidenceCandidateId(row.candidateId, `${path}.candidateId`),
    documentHash: compiledEvidenceDigest(row.documentHash, `${path}.documentHash`),
    lineageIds: intrinsicRealBuildFreeze(
      compiledEvidenceArray(row.lineageIds, `${path}.lineageIds`, 8_192, 1).map((id, index) =>
        compiledEvidenceLineageId(id, `${path}.lineageIds[${index}]`),
      ),
    ),
    transitionIds: intrinsicRealBuildFreeze(
      compiledEvidenceArray(row.transitionIds, `${path}.transitionIds`, 8_192, 1).map((id, index) =>
        compiledEvidenceTransitionId(id, `${path}.transitionIds[${index}]`),
      ),
    ),
    beforeRevision: compiledEvidenceString(row.beforeRevision, `${path}.beforeRevision`, 128),
    afterRevision: compiledEvidenceString(row.afterRevision, `${path}.afterRevision`, 128),
    canonicalStepId: compiledEvidenceString(row.canonicalStepId, `${path}.canonicalStepId`, 128),
    placedPieces: compiledEvidenceInteger(row.placedPieces, `${path}.placedPieces`, 1, 1_024),
    validation: parseCompiledValidation(row.validation, `${path}.validation`),
  });
}
