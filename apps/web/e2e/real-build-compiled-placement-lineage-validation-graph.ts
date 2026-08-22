import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  canonicalBrickDocument,
  canonicalDigest,
  canonicalSha256,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "./real-build-automatic-placement-compiler";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type { RealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  assertRealBuildLineageParent,
  realBuildDocumentCandidateId,
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import type { RealBuildExactLineageIdentity } from "./real-build-exact-lineage-identity";
import { deriveRealBuildCompiledTransitionId } from "./real-build-compiled-placement-lineage-digest";
import type {
  RealBuildCompiledLineageEdge,
  RealBuildCompiledLineageChildCandidate,
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledPlacementTransitionEvidence,
  RealBuildCompiledTransitionId,
  RealBuildCompiledValidationEvidence,
} from "./real-build-compiled-placement-lineage-types";
import { MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES } from "./real-build-prepared-search-boundary";
import {
  deriveRealBuildPreparedSearchCanonicalDocumentDigest,
  deriveRealBuildPreparedSearchProposalId,
} from "./real-build-prepared-search-digest";

interface RootLineageBinding {
  readonly snapshot: RealBuildCandidateDocumentSnapshot;
  readonly identity: RealBuildCompiledPlacementLineageEvidence["rootCandidates"][number]["identities"][number];
}

interface RootIndex {
  readonly byLineage: ReadonlyMap<string, RootLineageBinding>;
  readonly byCanonicalHash: ReadonlyMap<string, RootLineageBinding>;
}

export interface RealBuildCompiledGraphIndex {
  readonly rootsByLineage: ReadonlyMap<string, RootLineageBinding>;
  readonly transitionsById: ReadonlyMap<
    RealBuildCompiledTransitionId,
    RealBuildCompiledPlacementTransitionEvidence
  >;
  readonly edgesByChildLineage: ReadonlyMap<string, RealBuildCompiledLineageEdge>;
}

interface ChildCandidateBinding {
  readonly row: RealBuildCompiledLineageChildCandidate;
  readonly snapshot: RealBuildCandidateDocumentSnapshot;
}

function isExactIdentity(
  identity: RealBuildLineageIdentity,
): identity is RealBuildExactLineageIdentity {
  return (
    "exactLineageId" in identity &&
    "parentExactLineageId" in identity &&
    "canonicalBytesHash" in identity &&
    "canonicalByteLength" in identity
  );
}

function sameValidation(
  retained: RealBuildCompiledValidationEvidence,
  replayed: {
    readonly targetDocumentHash: string;
    readonly truthSnapshotHash: string;
    readonly validatorSetHash: string;
    readonly documentGloballyValid: boolean;
    readonly issues: readonly { readonly severity: string }[];
  },
): boolean {
  return (
    retained.targetDocumentHash === replayed.targetDocumentHash &&
    retained.truthSnapshotHash === replayed.truthSnapshotHash &&
    retained.validatorSetHash === replayed.validatorSetHash &&
    replayed.documentGloballyValid &&
    replayed.issues.every(({ severity }) => severity !== "blocking")
  );
}

function validateRoots(evidence: RealBuildCompiledPlacementLineageEvidence) {
  const roots = new Map<string, RootLineageBinding>();
  const rootsByCanonicalHash = new Map<string, RootLineageBinding>();
  const canonicalHashes = new Set<string>();
  let aggregateBytes = 0;
  for (let groupIndex = 0; groupIndex < evidence.rootCandidates.length; groupIndex += 1) {
    const group = evidence.rootCandidates[groupIndex]!;
    const path = `compiledLineage.rootCandidates[${groupIndex}]`;
    if (canonicalHashes.has(group.canonicalBytesHash)) {
      throw new TypeError(`${path} duplicates an exact root canonical byte payload group.`);
    }
    if (group.candidateId !== realBuildDocumentCandidateId(group.documentHash)) {
      throw new TypeError(`${path}.candidateId must equal its structural document hash.`);
    }
    const snapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: group.canonicalBytes,
      expectedDocumentHash: group.documentHash,
    });
    if (
      snapshot.canonicalBytesHash !== group.canonicalBytesHash ||
      snapshot.canonicalByteLength !== group.canonicalByteLength
    ) {
      throw new TypeError(`${path} canonical byte hash or UTF-8 length does not reproduce.`);
    }
    aggregateBytes += snapshot.canonicalByteLength;
    if (aggregateBytes > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES) {
      throw new RangeError(
        `compiledLineage unique root canonical bytes exceed ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES}.`,
      );
    }
    for (let identityIndex = 0; identityIndex < group.identities.length; identityIndex += 1) {
      const identity = group.identities[identityIndex]!;
      const identityPath = `${path}.identities[${identityIndex}]`;
      if (
        identity.candidateId !== group.candidateId ||
        identity.documentHash !== group.documentHash ||
        (isExactIdentity(identity) &&
          (identity.canonicalBytesHash !== group.canonicalBytesHash ||
            identity.canonicalByteLength !== group.canonicalByteLength)) ||
        identity.throughStepNumber !== evidence.throughStepNumber - 1
      ) {
        throw new TypeError(
          `${identityPath} must bind the grouped candidate and exact local-subgraph parent step.`,
        );
      }
      if (roots.has(identity.lineageId)) {
        throw new TypeError(`${identityPath}.lineageId duplicates an earlier root identity.`);
      }
      roots.set(identity.lineageId, { snapshot, identity });
    }
    rootsByCanonicalHash.set(group.canonicalBytesHash, {
      snapshot,
      identity: group.identities[0]!,
    });
    canonicalHashes.add(group.canonicalBytesHash);
  }
  return intrinsicRealBuildFreeze({ byLineage: roots, byCanonicalHash: rootsByCanonicalHash });
}

function validateReservation(evidence: RealBuildCompiledPlacementLineageEvidence): void {
  const reservation = evidence.searchReservation;
  if (reservation.reservedBefore > reservation.budget) {
    throw new RangeError("compiledLineage reservedBefore cannot exceed its search budget.");
  }
  const remaining = reservation.budget - reservation.reservedBefore;
  if (reservation.admitted) {
    if (
      reservation.refusal !== null ||
      reservation.terminalFailure !== null ||
      reservation.requested > remaining ||
      reservation.reservedAfter !== reservation.reservedBefore + reservation.requested ||
      (evidence.status !== "failed" && reservation.requested !== evidence.lineageEdges.length) ||
      (evidence.status === "failed" && reservation.requested < 1)
    ) {
      throw new TypeError(
        "An admitted compiledLineage reservation must atomically reserve exactly its retained edges within budget.",
      );
    }
  } else if (
    reservation.reservedAfter !== reservation.reservedBefore ||
    reservation.terminalFailure === null
  ) {
    throw new TypeError(
      "A refused compiledLineage reservation must leave aggregate reserved state unchanged and retain its original terminal failure.",
    );
  } else {
    const terminal = reservation.terminalFailure;
    const terminalRemaining = terminal.budget - terminal.reservedBefore;
    const exactCurrentFailure =
      terminal.preflightIdentity === evidence.searchRequest.preflightIdentity &&
      terminal.reservationNumber === reservation.reservationNumber &&
      terminal.reservedBefore === reservation.reservedBefore &&
      terminal.requested === reservation.requested &&
      terminal.budget === reservation.budget;
    const retainedOriginalFailure =
      /^sha256:[0-9a-f]{64}$/u.test(terminal.preflightIdentity) &&
      terminal.reservationNumber <= reservation.reservationNumber &&
      terminal.reservedBefore === reservation.reservedBefore &&
      terminal.budget === reservation.budget &&
      terminal.requested > terminalRemaining;
    if (
      terminal.reservationNumber < 1 ||
      terminal.reservedBefore > terminal.budget ||
      terminal.requested <= terminalRemaining ||
      (reservation.refusal === "budget-exceeded" && !exactCurrentFailure) ||
      (reservation.refusal === "ledger-already-refused" && !retainedOriginalFailure) ||
      reservation.refusal === null
    ) {
      throw new TypeError(
        "A refused compiledLineage reservation must exactly bind its current budget failure or the ledger's frozen original terminal failure.",
      );
    }
  }
}

function validateChildCandidates(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): ReadonlyMap<string, ChildCandidateBinding> {
  const children = new Map<string, ChildCandidateBinding>();
  const canonicalHashes = new Set<string>();
  let aggregateBytes = 0;
  for (let index = 0; index < evidence.childCandidates.length; index += 1) {
    const row = evidence.childCandidates[index]!;
    const path = `compiledLineage.childCandidates[${index}]`;
    if (canonicalHashes.has(row.canonicalBytesHash)) {
      throw new TypeError(`${path} duplicates an exact child canonical byte payload group.`);
    }
    if (row.candidateId !== realBuildDocumentCandidateId(row.documentHash)) {
      throw new TypeError(`${path}.candidateId must equal its structural document hash.`);
    }
    const snapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: row.canonicalBytes,
      expectedDocumentHash: row.documentHash,
    });
    if (
      snapshot.canonicalBytesHash !== row.canonicalBytesHash ||
      snapshot.canonicalByteLength !== row.canonicalByteLength
    ) {
      throw new TypeError(`${path} canonical byte hash or UTF-8 length does not reproduce.`);
    }
    aggregateBytes += snapshot.canonicalByteLength;
    if (aggregateBytes > MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES) {
      throw new RangeError(
        `compiledLineage unique child canonical bytes exceed ${MAXIMUM_REAL_BUILD_PREPARED_SEARCH_UNIQUE_DOCUMENT_BYTES}.`,
      );
    }
    children.set(row.canonicalBytesHash, intrinsicRealBuildFreeze({ row, snapshot }));
    canonicalHashes.add(row.canonicalBytesHash);
  }
  return children;
}

function replayTransition(
  transition: RealBuildCompiledPlacementTransitionEvidence,
  index: number,
  evidence: RealBuildCompiledPlacementLineageEvidence,
  rootsByCanonicalHash: ReadonlyMap<string, RootLineageBinding>,
  childCandidates: ReadonlyMap<string, ChildCandidateBinding>,
): Sha256Digest {
  const path = `compiledLineage.uniqueTransitions[${index}]`;
  const { transitionId, ...committed } = transition;
  if (transitionId !== deriveRealBuildCompiledTransitionId(committed)) {
    throw new TypeError(`${path}.transitionId does not commit its exact retained transition.`);
  }
  const receipt = transition.receipt;
  const parent = rootsByCanonicalHash.get(receipt.baseCanonicalBytesHash);
  if (parent === undefined) {
    throw new TypeError(`${path}.receipt does not name retained exact root canonical bytes.`);
  }
  if (
    transition.parentCandidateId !== realBuildDocumentCandidateId(transition.parentDocumentHash) ||
    transition.childCandidateId !== realBuildDocumentCandidateId(transition.childDocumentHash) ||
    transition.parentDocumentHash !== parent.identity.documentHash ||
    transition.printedStep.name !== evidence.preparedStep.compilerMetadata.name ||
    transition.printedStep.sourceActionDigest !== evidence.preparedStep.actionEvidenceDigest
  ) {
    throw new TypeError(`${path} does not bind its exact root, child, and prepared printed step.`);
  }
  const witnesses = transition.pieces.map(({ catalogPartId, colorId, transform, connections }) => ({
    catalogPartId,
    colorId,
    transform,
    connections,
  }));
  const replay = compileRealBuildAutomaticPlacement({
    documentSnapshot: parent.snapshot,
    printedStepNumber: evidence.throughStepNumber,
    printedStep: transition.printedStep,
    witnesses,
  });
  if (!replay.ok) throw new TypeError(`${path} does not reproduce a successful Node compilation.`);
  const compilerInputDigest = canonicalDigest({
    schemaVersion: "lego.real-build-automatic-placement-input/2",
    baseCanonicalBytesHash: parent.snapshot.canonicalBytesHash,
    baseCanonicalByteLength: parent.snapshot.canonicalByteLength,
    baseDocumentHash: parent.snapshot.documentHash,
    printedStepNumber: evidence.throughStepNumber,
    printedStep: transition.printedStep,
    witnesses,
  });
  const childDocumentHash = replay.validationReport.targetDocumentHash as Sha256Digest;
  const replayedCanonicalBytes = canonicalBrickDocument(replay.document);
  const replayedChild = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: replayedCanonicalBytes,
    expectedDocumentHash: childDocumentHash,
  });
  const retainedChild = childCandidates.get(replayedChild.canonicalBytesHash);
  if (retainedChild === undefined) {
    throw new TypeError(`${path} does not reproduce any retained exact child byte payload.`);
  }
  if (
    receipt.compilerSnapshotHash !== replay.automaticPlacement.compilerSnapshotHash ||
    receipt.compilerInputDigest !== compilerInputDigest ||
    receipt.programHash !== replay.automaticPlacement.programHash ||
    receipt.placementProgramHash !== replay.automaticPlacement.placementProgramHash ||
    receipt.jobId !== `real-build-job-${canonicalSha256({ compilerInputDigest }).slice(0, 24)}` ||
    receipt.candidateId !== transition.childCandidateId ||
    receipt.baseCanonicalBytesHash !== parent.snapshot.canonicalBytesHash ||
    receipt.baseCanonicalByteLength !== parent.snapshot.canonicalByteLength ||
    receipt.baseDocumentHash !== transition.parentDocumentHash ||
    receipt.printedStepNumber !== evidence.throughStepNumber ||
    receipt.canonicalStepId !== replay.document.steps[evidence.throughStepNumber - 1]?.id ||
    receipt.finalDocumentHash !== childDocumentHash ||
    receipt.finalRevision !== replay.document.revision ||
    transition.childDocumentHash !== childDocumentHash ||
    transition.childDocumentHash !== retainedChild.row.documentHash ||
    replayedCanonicalBytes !== retainedChild.snapshot.canonicalBytes ||
    !sameValidation(receipt.validation, replay.validationReport)
  ) {
    throw new TypeError(`${path}.receipt does not exactly reproduce the current Node compiler.`);
  }
  return replayedChild.canonicalBytesHash;
}

function validateEdges(
  evidence: RealBuildCompiledPlacementLineageEvidence,
  roots: ReadonlyMap<string, RootLineageBinding>,
  childCandidates: ReadonlyMap<string, ChildCandidateBinding>,
  transitions: ReadonlyMap<
    RealBuildCompiledTransitionId,
    RealBuildCompiledPlacementTransitionEvidence
  >,
  transitionChildCanonicalHashes: ReadonlyMap<RealBuildCompiledTransitionId, Sha256Digest>,
) {
  const edges = new Map<string, RealBuildCompiledLineageEdge>();
  const referenced = new Set<RealBuildCompiledTransitionId>();
  const referencedChildCanonicalHashes = new Set<string>();
  const proposalIds = new Set<string>();
  for (let index = 0; index < evidence.lineageEdges.length; index += 1) {
    const edge = evidence.lineageEdges[index]!;
    const path = `compiledLineage.lineageEdges[${index}]`;
    const parent = roots.get(edge.parentLineageId);
    const transition = transitions.get(edge.transitionId);
    if (parent === undefined) throw new TypeError(`${path}.parentLineageId is not a local root.`);
    if (transition === undefined) throw new TypeError(`${path}.transitionId is not retained.`);
    if (edges.has(edge.child.lineageId)) throw new TypeError(`${path}.child is duplicated.`);
    if (proposalIds.has(edge.proposalId)) {
      throw new TypeError(`${path}.proposalId duplicates an earlier lineage edge proposal.`);
    }
    if (edge.child.throughStepNumber !== evidence.throughStepNumber) {
      throw new TypeError(`${path}.child does not end at compiledLineage.throughStepNumber.`);
    }
    assertRealBuildLineageParent(
      snapshotRealBuildLineageIdentity(edge.child),
      snapshotRealBuildLineageIdentity(parent.identity),
    );
    if (isExactIdentity(edge.child) || isExactIdentity(parent.identity)) {
      if (
        !isExactIdentity(edge.child) ||
        !isExactIdentity(parent.identity) ||
        edge.child.parentExactLineageId !== parent.identity.exactLineageId
      ) {
        throw new TypeError(`${path}.child does not bind its exact canonical parent lineage.`);
      }
      const child = childCandidates.get(edge.child.canonicalBytesHash);
      if (
        child === undefined ||
        edge.child.canonicalBytesHash !== transitionChildCanonicalHashes.get(edge.transitionId) ||
        edge.child.canonicalByteLength !== child.row.canonicalByteLength ||
        edge.child.documentHash !== child.row.documentHash
      ) {
        throw new TypeError(
          `${path}.child does not bind the exact child bytes reproduced by its transition.`,
        );
      }
      referencedChildCanonicalHashes.add(edge.child.canonicalBytesHash);
    } else {
      const matches = [...childCandidates.entries()].filter(
        ([, child]) => child.row.candidateId === edge.child.candidateId,
      );
      if (matches.length !== 1) {
        throw new TypeError(`${path}.child does not uniquely name retained child bytes.`);
      }
      referencedChildCanonicalHashes.add(matches[0]![0]);
    }
    const expectedProposalId = deriveRealBuildPreparedSearchProposalId({
      printedStepIdentity: evidence.preparedStep.printedStepIdentity,
      parentLineageId: parent.identity.lineageId,
      canonicalDocumentDigest: deriveRealBuildPreparedSearchCanonicalDocumentDigest(
        parent.snapshot.canonicalBytesHash,
      ),
      pieces: transition.pieces,
    });
    if (edge.proposalId !== expectedProposalId) {
      throw new TypeError(
        `${path}.proposalId does not reproduce the exact prepared step, parent lineage, root canonical document, and transition pieces.`,
      );
    }
    if (
      transition.parentCandidateId !== parent.identity.candidateId ||
      transition.childCandidateId !== edge.child.candidateId ||
      transition.childDocumentHash !== edge.child.documentHash
    ) {
      throw new TypeError(`${path} does not bind its parent, transition, and child.`);
    }
    edges.set(edge.child.lineageId, edge);
    proposalIds.add(edge.proposalId);
    referenced.add(edge.transitionId);
  }
  for (const transitionId of transitions.keys()) {
    if (!referenced.has(transitionId)) {
      throw new TypeError(`compiledLineage.uniqueTransitions contains orphan ${transitionId}.`);
    }
  }
  return intrinsicRealBuildFreeze({ edges, referencedChildCanonicalHashes });
}

export function validateRealBuildCompiledGraph(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): RealBuildCompiledGraphIndex {
  const roots: RootIndex = validateRoots(evidence);
  validateReservation(evidence);
  const childCandidates = validateChildCandidates(evidence);
  const transitions = new Map<
    RealBuildCompiledTransitionId,
    RealBuildCompiledPlacementTransitionEvidence
  >();
  const transitionChildCanonicalHashes = new Map<RealBuildCompiledTransitionId, Sha256Digest>();
  for (let index = 0; index < evidence.uniqueTransitions.length; index += 1) {
    const transition = evidence.uniqueTransitions[index]!;
    if (transitions.has(transition.transitionId)) {
      throw new TypeError(`compiledLineage.uniqueTransitions[${index}] repeats an ID.`);
    }
    const childCanonicalBytesHash = replayTransition(
      transition,
      index,
      evidence,
      roots.byCanonicalHash,
      childCandidates,
    );
    transitions.set(transition.transitionId, transition);
    transitionChildCanonicalHashes.set(transition.transitionId, childCanonicalBytesHash);
  }
  if (!evidence.searchReservation.admitted && transitions.size > 0) {
    throw new TypeError("A refused compiledLineage search cannot retain transitions.");
  }
  const validatedEdges = validateEdges(
    evidence,
    roots.byLineage,
    childCandidates,
    transitions,
    transitionChildCanonicalHashes,
  );
  for (const canonicalBytesHash of childCandidates.keys()) {
    if (!validatedEdges.referencedChildCanonicalHashes.has(canonicalBytesHash)) {
      throw new TypeError(
        `compiledLineage.childCandidates contains orphan exact bytes ${canonicalBytesHash}.`,
      );
    }
  }
  return intrinsicRealBuildFreeze({
    rootsByLineage: roots.byLineage,
    transitionsById: transitions,
    edgesByChildLineage: validatedEdges.edges,
  });
}
