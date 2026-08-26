import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  canonicalDigest,
  canonicalStringify,
  connectorCapacityClaimKeys,
  describeConnectorCapacityClaimKey,
  getConnectorWorldFrame,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import {
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageId,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  snapshotRealBuildExactLineageIdentity as snapshotExactIdentity,
  type RealBuildExactLineageIdentity as ExactLineageIdentity,
} from "./real-build-exact-lineage-identity";
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
  readonly identity: RealBuildLineageIdentity | ExactLineageIdentity;
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
  readonly identity: RealBuildLineageIdentity | ExactLineageIdentity;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly byteLength: number;
}

const EXACT_IDENTITY_FIELDS = [
  "exactLineageId",
  "parentExactLineageId",
  "canonicalBytesHash",
  "canonicalByteLength",
] as const;
type PreparedCapacityPart = Parameters<typeof getConnectorWorldFrame>[0];
const witnessCapacityPart = (
  witness: RealBuildPreparedPlacementWitness,
  witnessIndex: number,
): PreparedCapacityPart => ({
  id: `prepared-witness:${witnessIndex}`,
  catalogPartId: witness.catalogPartId,
  transform: witness.transform,
});
const endpointCapacityClaims = (part: PreparedCapacityPart, portId: string): readonly string[] =>
  connectorCapacityClaimKeys(getConnectorWorldFrame(part, portId));
function snapshotParentIdentity(value: unknown): RealBuildLineageIdentity | ExactLineageIdentity {
  let exactFieldCount = 0;
  for (let index = 0; index < EXACT_IDENTITY_FIELDS.length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, EXACT_IDENTITY_FIELDS[index]!);
    } catch {
      throw new TypeError(
        "Prepared search parent identity exact fields could not be inspected safely.",
      );
    }
    if (descriptor !== undefined) exactFieldCount += 1;
  }
  if (exactFieldCount === 0) return snapshotRealBuildLineageIdentity(value);
  if (exactFieldCount !== EXACT_IDENTITY_FIELDS.length) {
    throw new TypeError(
      "Prepared search parent identity must provide either no exact fields or the complete exact lineage binding.",
    );
  }
  return snapshotExactIdentity(value);
}
function snapshotProposalPieces(
  planned: PlannedPreparedSearchChild,
  path: string,
  expected: readonly RealBuildPreparedAtomicPiece[],
  basePartsById: ReadonlyMap<string, PreparedCapacityPart>,
  parentCapacityClaims: ReadonlyMap<string, string>,
): readonly RealBuildPreparedPlacementWitness[] {
  const pieces: RealBuildPreparedPlacementWitness[] = [];
  const occupiedCapacityClaims = new Map(parentCapacityClaims);
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
    if (witness.connections.length === 0 && (basePartsById.size > 0 || index > 0)) {
      throw new TypeError(
        `${path}[${index}] is unconnected; only the first witness over an exact empty parent may use ground support without an attachment.`,
      );
    }
    for (const [connectionIndex, connection] of witness.connections.entries()) {
      let targetPart: PreparedCapacityPart;
      if (connection.target.kind === "base") {
        const retainedPart = basePartsById.get(connection.target.partId);
        if (retainedPart === undefined)
          throw new TypeError(
            `${path}[${index}] connection target ${JSON.stringify(connection.target.partId)} is not an exact part in the bound parent snapshot.`,
          );
        targetPart = retainedPart;
      } else {
        targetPart = witnessCapacityPart(
          pieces[connection.target.witnessIndex]!,
          connection.target.witnessIndex,
        );
      }
      const claims = [
        ...endpointCapacityClaims(targetPart, connection.targetPortId),
        ...endpointCapacityClaims(witnessCapacityPart(witness, index), connection.candidatePortId),
      ];
      const owner = `${path}[${index}].connections[${connectionIndex}]`;
      for (const claim of claims) {
        const priorOwner = occupiedCapacityClaims.get(claim);
        if (priorOwner !== undefined) {
          throw new TypeError(
            `${owner} consumes ${describeConnectorCapacityClaimKey(claim)}, already reserved by ${priorOwner}; choose a non-overlapping endpoint.`,
          );
        }
        occupiedCapacityClaims.set(claim, owner);
      }
    }
    pieces.push(witness);
  }
  return intrinsicRealBuildFreeze(pieces);
}
function validatePreparedSearchParents(
  preparedStep: RealBuildPreparedStepAuthority | RealBuildPreparedStepInspection,
  structural: RealBuildPreparedSearchPlan,
): readonly ValidatedPreparedSearchParent[] {
  const seenLineages = new Set<string>();
  const snapshotByCanonicalHash = new Map<Sha256Digest, RealBuildCandidateDocumentSnapshot>();
  const structuralBindings = new Map<
    string,
    {
      snapshot: RealBuildCandidateDocumentSnapshot;
      exactOnly: boolean;
      hasDistinctSnapshot: boolean;
    }
  >();
  const uniqueSnapshots = new Set<RealBuildCandidateDocumentSnapshot>();
  const validated: ValidatedPreparedSearchParent[] = [];
  let aggregateBytes = 0;
  for (let parentIndex = 0; parentIndex < structural.parentCount; parentIndex += 1) {
    const path = `Prepared search parents[${parentIndex}]`;
    const planned = structural.parents[parentIndex]!;
    const identity = snapshotParentIdentity(preparedSearchData(planned.row, "identity", path));
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
    const exactIdentity = "exactLineageId" in identity ? identity : null;
    if (
      exactIdentity !== null &&
      (exactIdentity.canonicalBytesHash !== documentSnapshot.canonicalBytesHash ||
        exactIdentity.canonicalByteLength !== documentSnapshot.canonicalByteLength)
    ) {
      throw new TypeError(
        `Prepared search parent ${identity.lineageId} exact identity does not bind its retained canonical document bytes.`,
      );
    }
    const structuralKey = `${identity.candidateId}\0${identity.documentHash}`;
    const structuralBinding = structuralBindings.get(structuralKey);
    if (structuralBinding === undefined) {
      structuralBindings.set(structuralKey, {
        snapshot: documentSnapshot,
        exactOnly: exactIdentity !== null,
        hasDistinctSnapshot: false,
      });
    } else if (structuralBinding.snapshot === documentSnapshot) {
      if (exactIdentity === null) {
        if (structuralBinding.hasDistinctSnapshot) {
          throw new TypeError(
            "Prepared search convergent candidate/hash parents must share the exact branded parent snapshot reference unless every distinct byte string has its own exact lineage binding.",
          );
        }
        structuralBinding.exactOnly = false;
      }
    } else if (!structuralBinding.exactOnly || exactIdentity === null) {
      throw new TypeError(
        "Prepared search convergent candidate/hash parents must share the exact branded parent snapshot reference unless every distinct byte string has its own exact lineage binding.",
      );
    } else {
      structuralBinding.hasDistinctSnapshot = true;
    }
    let measured = documentByteLengthCache.get(documentSnapshot);
    if (measured === undefined) {
      measured = intrinsicRealBuildFreeze({
        byteLength: preparedSearchUtf8ByteLength(
          documentSnapshot.canonicalBytes,
          MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES,
        ),
      });
      documentByteLengthCache.set(documentSnapshot, measured);
    }
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
    validated.push(
      intrinsicRealBuildFreeze({ path, planned, identity, documentSnapshot, ...measured }),
    );
  }
  return intrinsicRealBuildFreeze(validated);
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
      cached = intrinsicRealBuildFreeze({
        digest: deriveRealBuildPreparedSearchCanonicalDocumentDigest(
          documentSnapshot.canonicalBytesHash,
        ),
        canonicalBytesHash: documentSnapshot.canonicalBytesHash,
      });
      documentDigestCache.set(documentSnapshot, cached);
    }
    const canonicalDocumentDigest = cached.digest;
    const basePartsById = new Map(
      documentSnapshot.document.parts.map((part) => [
        part.id,
        { ...part, id: `prepared-base:${part.id}` },
      ]),
    );
    const parentCapacityClaims = new Map<string, string>();
    for (const connection of documentSnapshot.document.connections) {
      const owner = `Prepared search parent connection ${JSON.stringify(connection.id)}`;
      for (const { partId, portId } of [connection.a, connection.b]) {
        const part = basePartsById.get(partId);
        if (part === undefined)
          throw new TypeError(
            `Prepared search parent connection endpoint ${JSON.stringify(partId)} is absent.`,
          );
        for (const claim of endpointCapacityClaims(part, portId)) {
          const priorOwner = parentCapacityClaims.get(claim);
          if (priorOwner !== undefined) {
            throw new TypeError(
              `${owner} consumes ${describeConnectorCapacityClaimKey(claim)}, already reserved by ${priorOwner}; choose a non-overlapping endpoint.`,
            );
          }
          parentCapacityClaims.set(claim, owner);
        }
      }
    }
    const childCount = plannedParent.children.length;
    parentBindings.push(
      intrinsicRealBuildFreeze({
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
        basePartsById,
        parentCapacityClaims,
      );
      const requestKey = `${identity.lineageId}\0${canonicalStringify(pieces)}`;
      if (seenRequests.has(requestKey)) {
        throw new TypeError("Prepared search repeats an exact parent and witness sequence.");
      }
      seenRequests.add(requestKey);
      proposals.push(
        intrinsicRealBuildFreeze({
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
  return intrinsicRealBuildFreeze({
    preflightIdentity: canonicalDigest({
      schemaVersion: "lego.real-build-prepared-search-preflight/1",
      printedStepIdentity: preparedStep.printedStepIdentity,
      parents: parentRows,
      proposals,
    }),
    stepNumber: preparedStep.stepNumber,
    parentBindings: intrinsicRealBuildFreeze(parentBindings),
    expectedAtomicPieces: preparedStep.expectedAtomicPieces,
    proposals: intrinsicRealBuildFreeze(proposals),
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
  const inspection = intrinsicRealBuildFreeze({
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
