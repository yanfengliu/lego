import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageId,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  requireRealBuildCandidateDocumentSnapshot,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  requireRealBuildPreparedStepAuthority,
  requireRealBuildPreparedStepInspection,
  type RealBuildPreparedAtomicPiece,
  type RealBuildPreparedStepAuthority,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import {
  MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
  preparedSearchData,
  preparedSearchUtf8ByteLength,
  snapshotPreparedPlacementWitness,
  type RealBuildPreparedPlacementWitness,
} from "./real-build-prepared-search-boundary";
import {
  deriveRealBuildPreparedSearchCanonicalDocumentDigest,
  deriveRealBuildPreparedSearchProposalId,
} from "./real-build-prepared-search-digest";
import {
  planRealBuildPreparedSearchStructure,
  type PlannedPreparedSearchChild,
  type PlannedPreparedSearchParent,
  type RealBuildPreparedSearchPlan,
} from "./real-build-prepared-search-plan";

export { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_AGGREGATE_OPERATIONS } from "./real-build-prepared-search-plan";

declare const preparedSearchPreflightType: unique symbol;
declare const preparedSearchBatchAuthorityType: unique symbol;

export interface RealBuildPreparedSearchParentBinding {
  readonly parentLineageId: RealBuildLineageId;
  readonly identity: RealBuildLineageIdentity;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly canonicalDocumentDigest: Sha256Digest;
  readonly offeredLineages: number;
}

export interface RealBuildPreparedSearchProposal {
  readonly proposalId: Sha256Digest;
  readonly parentLineageId: RealBuildLineageId;
  readonly pieces: readonly RealBuildPreparedPlacementWitness[];
  readonly connectionCount: number;
  readonly programOperationCount: number;
}

interface RealBuildPreparedSearchPreflightFields {
  readonly preflightIdentity: Sha256Digest;
  readonly stepNumber: number;
  readonly parentBindings: readonly RealBuildPreparedSearchParentBinding[];
  readonly expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  readonly proposals: readonly RealBuildPreparedSearchProposal[];
  readonly offeredLineages: number;
  readonly witnessCount: number;
  readonly connectionCount: number;
  readonly programOperationCount: number;
}

export interface RealBuildPreparedSearchBatchPreflight extends RealBuildPreparedSearchPreflightFields {
  readonly [preparedSearchPreflightType]: true;
}

export interface RealBuildPreparedSearchBatchInspection extends RealBuildPreparedSearchPreflightFields {
  readonly authority: "absent";
  readonly refusal: "automatic-compiled-placement-authority-unavailable";
}

export interface RealBuildPreparedSearchBatchAuthority {
  readonly batchAuthorityIdentity: Sha256Digest;
  readonly stepNumber: number;
  readonly parentBindings: readonly RealBuildPreparedSearchParentBinding[];
  readonly expectedAtomicPieces: readonly RealBuildPreparedAtomicPiece[];
  readonly narrowing: Readonly<{ status: "not-performed"; renders: 0 }>;
  readonly offeredLineages: number;
  readonly carriedLineages: number;
  readonly transitionBatch: unknown;
  readonly [preparedSearchBatchAuthorityType]: true;
}

const preflights = new WeakSet<object>();
const batchAuthorities = new WeakSet<object>();
const inspections = new WeakSet<object>();
const documentByteLengthCache = new WeakMap<object, Readonly<{ byteLength: number }>>();
const documentDigestCache = new WeakMap<
  object,
  Readonly<{ digest: Sha256Digest; canonicalBytesHash: Sha256Digest }>
>();

interface ValidatedPreparedSearchParent {
  readonly path: string;
  readonly planned: PlannedPreparedSearchParent;
  readonly identity: RealBuildLineageIdentity;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly byteLength: number;
}

function snapshotProposalPieces(
  planned: PlannedPreparedSearchChild,
  path: string,
  expected: readonly RealBuildPreparedAtomicPiece[],
  basePartIds: ReadonlySet<string>,
): readonly RealBuildPreparedPlacementWitness[] {
  const pieces: RealBuildPreparedPlacementWitness[] = [];
  const occupiedEndpoints = new Set<string>();
  for (let index = 0; index < expected.length; index += 1) {
    const witness = snapshotPreparedPlacementWitness(
      planned.witnesses[index]!.value,
      `${path}[${index}]`,
      index,
      planned.witnesses[index]!.connections,
    );
    const declared = expected[index]!;
    if (
      witness.identityKey !== declared.identityKey ||
      witness.catalogPartId !== declared.catalogPartId ||
      witness.colorId !== declared.colorId
    ) {
      throw new TypeError(
        `${path}[${index}] does not match prepared identity/catalog/color ${JSON.stringify(declared.identityKey)}/${JSON.stringify(declared.catalogPartId)}/${JSON.stringify(declared.colorId)}.`,
      );
    }
    if (witness.connections.length === 0 && (basePartIds.size > 0 || index > 0)) {
      throw new TypeError(
        `${path}[${index}] is unconnected; only the first witness over an exact empty parent may use ground support without an attachment.`,
      );
    }
    for (const connection of witness.connections) {
      if (connection.target.kind === "base" && !basePartIds.has(connection.target.partId)) {
        throw new TypeError(
          `${path}[${index}] connection target ${JSON.stringify(connection.target.partId)} is not an exact part in the bound parent snapshot.`,
        );
      }
      const targetKey =
        connection.target.kind === "base"
          ? `base:${connection.target.partId}:${connection.targetPortId}`
          : `witness:${connection.target.witnessIndex}:${connection.targetPortId}`;
      const candidateKey = `witness:${index}:${connection.candidatePortId}`;
      if (occupiedEndpoints.has(targetKey) || occupiedEndpoints.has(candidateKey)) {
        throw new TypeError(
          `${path}[${index}] reuses an occupied connection port; one retained or candidate port may bind once.`,
        );
      }
      occupiedEndpoints.add(targetKey);
      occupiedEndpoints.add(candidateKey);
    }
    pieces.push(witness);
  }
  return Object.freeze(pieces);
}

function validatePreparedSearchParents(
  preparedStep: RealBuildPreparedStepAuthority | RealBuildPreparedStepInspection,
  structural: RealBuildPreparedSearchPlan,
): readonly ValidatedPreparedSearchParent[] {
  const seenLineages = new Set<string>();
  const snapshotByCandidate = new Map<string, RealBuildCandidateDocumentSnapshot>();
  const snapshotByCanonicalHash = new Map<Sha256Digest, RealBuildCandidateDocumentSnapshot>();
  const uniqueSnapshots = new Set<RealBuildCandidateDocumentSnapshot>();
  const validated: ValidatedPreparedSearchParent[] = [];
  let aggregateBytes = 0;
  for (let parentIndex = 0; parentIndex < structural.parentCount; parentIndex += 1) {
    const path = `Prepared search parents[${parentIndex}]`;
    const planned = structural.parents[parentIndex]!;
    const identity = snapshotRealBuildLineageIdentity(
      preparedSearchData(planned.row, "identity", path),
    );
    if (identity.throughStepNumber + 1 !== preparedStep.stepNumber) {
      throw new RangeError(
        `Prepared search parent ${identity.lineageId} ends at step ${identity.throughStepNumber}; required exact prefix step ${preparedStep.stepNumber - 1}.`,
      );
    }
    if (seenLineages.has(identity.lineageId)) {
      throw new TypeError(`Prepared search repeats parent lineage ${identity.lineageId}.`);
    }
    seenLineages.add(identity.lineageId);
    const documentSnapshot = requireRealBuildCandidateDocumentSnapshot(
      preparedSearchData(planned.row, "documentSnapshot", path),
      identity,
    );
    let measured = documentByteLengthCache.get(documentSnapshot);
    if (measured === undefined) {
      measured = Object.freeze({
        byteLength: preparedSearchUtf8ByteLength(
          documentSnapshot.canonicalBytes,
          MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
        ),
      });
      documentByteLengthCache.set(documentSnapshot, measured);
    }
    const candidateKey = `${identity.candidateId}\0${identity.documentHash}`;
    const priorCandidateSnapshot = snapshotByCandidate.get(candidateKey);
    if (priorCandidateSnapshot !== undefined && priorCandidateSnapshot !== documentSnapshot) {
      throw new TypeError(
        `Prepared search candidate ${identity.candidateId}/${identity.documentHash} is bound through more than one snapshot object; convergent lineages must share the exact branded parent snapshot reference.`,
      );
    }
    snapshotByCandidate.set(candidateKey, documentSnapshot);
    const priorHashSnapshot = snapshotByCanonicalHash.get(documentSnapshot.canonicalBytesHash);
    if (priorHashSnapshot !== undefined && priorHashSnapshot !== documentSnapshot) {
      throw new TypeError(
        `Prepared search canonical hash ${documentSnapshot.canonicalBytesHash} is carried by distinct snapshot objects; collision/alias handling refuses without rescanning their bytes.`,
      );
    }
    snapshotByCanonicalHash.set(documentSnapshot.canonicalBytesHash, documentSnapshot);
    if (!uniqueSnapshots.has(documentSnapshot)) {
      uniqueSnapshots.add(documentSnapshot);
      aggregateBytes += measured.byteLength;
      if (aggregateBytes > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES) {
        throw new RangeError(
          `Prepared search unique parent canonical bytes exceed ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES}; no canonical parent digest, proposal replay, or ledger reservation occurred.`,
        );
      }
    }
    validated.push(Object.freeze({ path, planned, identity, documentSnapshot, ...measured }));
  }
  return Object.freeze(validated);
}

function snapshotPreflight(
  preparedStep: RealBuildPreparedStepAuthority | RealBuildPreparedStepInspection,
  parents: unknown,
): RealBuildPreparedSearchPreflightFields {
  const structural = planRealBuildPreparedSearchStructure(
    parents,
    preparedStep.expectedAtomicPieces.length,
  );
  const validatedParents = validatePreparedSearchParents(preparedStep, structural);
  const seenRequests = new Set<string>();
  const parentBindings: RealBuildPreparedSearchParentBinding[] = [];
  const proposals: RealBuildPreparedSearchProposal[] = [];
  for (const { path, planned: plannedParent, identity, documentSnapshot } of validatedParents) {
    let cached = documentDigestCache.get(documentSnapshot);
    if (cached === undefined) {
      cached = Object.freeze({
        digest: deriveRealBuildPreparedSearchCanonicalDocumentDigest(
          documentSnapshot.canonicalBytesHash,
        ),
        canonicalBytesHash: documentSnapshot.canonicalBytesHash,
      });
      documentDigestCache.set(documentSnapshot, cached);
    }
    const canonicalDocumentDigest = cached.digest;
    const basePartIds = new Set(documentSnapshot.document.parts.map(({ id }) => id));
    const childCount = plannedParent.children.length;
    parentBindings.push(
      Object.freeze({
        parentLineageId: identity.lineageId,
        identity,
        documentSnapshot,
        canonicalDocumentDigest,
        offeredLineages: childCount,
      }),
    );
    for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
      const childPath = `${path}.children[${childIndex}]`;
      const plannedChild = plannedParent.children[childIndex]!;
      const pieces = snapshotProposalPieces(
        plannedChild,
        `${childPath}.pieces`,
        preparedStep.expectedAtomicPieces,
        basePartIds,
      );
      const requestKey = `${identity.lineageId}\0${canonicalStringify(pieces)}`;
      if (seenRequests.has(requestKey)) {
        throw new TypeError("Prepared search repeats an exact parent and witness sequence.");
      }
      seenRequests.add(requestKey);
      proposals.push(
        Object.freeze({
          proposalId: deriveRealBuildPreparedSearchProposalId({
            printedStepIdentity: preparedStep.printedStepIdentity,
            parentLineageId: identity.lineageId,
            canonicalDocumentDigest,
            pieces,
          }),
          parentLineageId: identity.lineageId,
          pieces,
          connectionCount: plannedChild.connectionCount,
          programOperationCount: plannedChild.programOperationCount,
        }),
      );
    }
  }
  const parentRows = parentBindings.map(
    ({ identity, canonicalDocumentDigest, offeredLineages }) => ({
      candidateId: identity.candidateId,
      documentHash: identity.documentHash,
      lineageId: identity.lineageId,
      canonicalDocumentDigest,
      offeredLineages,
    }),
  );
  return Object.freeze({
    preflightIdentity: canonicalDigest({
      schemaVersion: "lego.real-build-prepared-search-preflight/1",
      printedStepIdentity: preparedStep.printedStepIdentity,
      parents: parentRows,
      proposals,
    }),
    stepNumber: preparedStep.stepNumber,
    parentBindings: Object.freeze(parentBindings),
    expectedAtomicPieces: preparedStep.expectedAtomicPieces,
    proposals: Object.freeze(proposals),
    offeredLineages: structural.childCount,
    witnessCount: structural.witnessCount,
    connectionCount: structural.connectionCount,
    programOperationCount: structural.programOperationCount,
  });
}

function inputFields(input: unknown): {
  readonly preparedStep: unknown;
  readonly parents: unknown;
} {
  return {
    preparedStep: preparedSearchData(input, "preparedStep", "Prepared search input"),
    parents: preparedSearchData(input, "parents", "Prepared search input"),
  };
}

/** Non-authoritative visibility into bounded proposal shape and exact parent bindings. */
export function inspectRealBuildPreparedSearchBatch(
  input: unknown,
): RealBuildPreparedSearchBatchInspection {
  const fields = inputFields(input);
  const preparedStep = requireRealBuildPreparedStepInspection(fields.preparedStep);
  const snapshot = snapshotPreflight(preparedStep, fields.parents);
  const inspection = Object.freeze({
    ...snapshot,
    authority: "absent" as const,
    refusal: "automatic-compiled-placement-authority-unavailable" as const,
  });
  inspections.add(inspection);
  return inspection;
}

/**
 * Future automatic compiler entry point. It cannot succeed until a trusted
 * prepared-run producer can supply the currently unissuable step authority.
 */
export function createRealBuildPreparedSearchBatchPreflight(
  input: unknown,
): RealBuildPreparedSearchBatchPreflight {
  const fields = inputFields(input);
  requireRealBuildPreparedStepAuthority(fields.preparedStep);
  void fields.parents;
  throw new TypeError(
    "Prepared search preflight remains unavailable until the live runner supplies a nonforgeable execution-chain authority proving each parent document was produced by the exact preceding printed-step transition; digest-valid lineage identities are inspection-only.",
  );
}

export function requireRealBuildPreparedSearchBatchPreflight(
  value: unknown,
): RealBuildPreparedSearchBatchPreflight {
  if (value === null || typeof value !== "object" || !preflights.has(value)) {
    throw new TypeError(
      "Prepared search preflight must derive from an exact trusted prepared-step authority.",
    );
  }
  return value as RealBuildPreparedSearchBatchPreflight;
}

export function requireRealBuildPreparedSearchBatchInspection(
  value: unknown,
): RealBuildPreparedSearchBatchInspection {
  if (value === null || typeof value !== "object" || !inspections.has(value)) {
    throw new TypeError("Prepared search inspection must be an exact non-authoritative snapshot.");
  }
  return value as RealBuildPreparedSearchBatchInspection;
}

export function requireRealBuildPreparedSearchBatchAuthority(
  value: unknown,
): RealBuildPreparedSearchBatchAuthority {
  if (value === null || typeof value !== "object" || !batchAuthorities.has(value)) {
    throw new TypeError(
      "Prepared search batch authority is unavailable until automatic compiled-patch replay is implemented.",
    );
  }
  return value as RealBuildPreparedSearchBatchAuthority;
}
