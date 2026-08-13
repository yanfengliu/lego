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
} from "./real-build-candidate-lineage-identity";
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
  const candidateIds = new Set<string>();
  const canonicalHashes = new Set<string>();
  let aggregateBytes = 0;
  for (const [groupIndex, group] of evidence.rootCandidates.entries()) {
    const path = `compiledLineage.rootCandidates[${groupIndex}]`;
    if (candidateIds.has(group.candidateId) || canonicalHashes.has(group.canonicalBytesHash)) {
      throw new TypeError(`${path} duplicates a root candidate or canonical byte payload group.`);
    }
    if (group.candidateId !== realBuildDocumentCandidateId(group.documentHash)) {
      throw new TypeError(`${path}.candidateId must equal its exact canonical document hash.`);
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
    for (const [identityIndex, identity] of group.identities.entries()) {
      const identityPath = `${path}.identities[${identityIndex}]`;
      if (
        identity.candidateId !== group.candidateId ||
        identity.documentHash !== group.documentHash ||
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
    candidateIds.add(group.candidateId);
    canonicalHashes.add(group.canonicalBytesHash);
  }
  return roots;
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
  for (const [index, row] of evidence.childCandidates.entries()) {
    const path = `compiledLineage.childCandidates[${index}]`;
    if (children.has(row.candidateId) || canonicalHashes.has(row.canonicalBytesHash)) {
      throw new TypeError(`${path} duplicates a child candidate or canonical byte payload group.`);
    }
    if (row.candidateId !== realBuildDocumentCandidateId(row.documentHash)) {
      throw new TypeError(`${path}.candidateId must equal its exact canonical document hash.`);
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
    children.set(row.candidateId, Object.freeze({ row, snapshot }));
    canonicalHashes.add(row.canonicalBytesHash);
  }
  return children;
}

function replayTransition(
  transition: RealBuildCompiledPlacementTransitionEvidence,
  index: number,
  evidence: RealBuildCompiledPlacementLineageEvidence,
  roots: ReadonlyMap<string, RootLineageBinding>,
  childCandidates: ReadonlyMap<string, ChildCandidateBinding>,
): void {
  const path = `compiledLineage.uniqueTransitions[${index}]`;
  const { transitionId, ...committed } = transition;
  if (transitionId !== deriveRealBuildCompiledTransitionId(committed)) {
    throw new TypeError(`${path}.transitionId does not commit its exact retained transition.`);
  }
  const parent = [...roots.values()].find(
    ({ identity }) => identity.candidateId === transition.parentCandidateId,
  );
  if (parent === undefined) {
    throw new TypeError(`${path}.parentCandidateId does not name a retained root candidate.`);
  }
  const retainedChild = childCandidates.get(transition.childCandidateId);
  if (retainedChild === undefined) {
    throw new TypeError(`${path}.childCandidateId does not name retained exact child bytes.`);
  }
  if (
    transition.parentCandidateId !== realBuildDocumentCandidateId(transition.parentDocumentHash) ||
    transition.childCandidateId !== realBuildDocumentCandidateId(transition.childDocumentHash) ||
    transition.parentDocumentHash !== parent.identity.documentHash ||
    transition.childDocumentHash !== retainedChild.row.documentHash ||
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
  const receipt = transition.receipt;
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
    replayedCanonicalBytes !== retainedChild.snapshot.canonicalBytes ||
    !sameValidation(receipt.validation, replay.validationReport)
  ) {
    throw new TypeError(`${path}.receipt does not exactly reproduce the current Node compiler.`);
  }
}

function validateEdges(
  evidence: RealBuildCompiledPlacementLineageEvidence,
  roots: ReadonlyMap<string, RootLineageBinding>,
  transitions: ReadonlyMap<
    RealBuildCompiledTransitionId,
    RealBuildCompiledPlacementTransitionEvidence
  >,
) {
  const edges = new Map<string, RealBuildCompiledLineageEdge>();
  const referenced = new Set<RealBuildCompiledTransitionId>();
  const proposalIds = new Set<string>();
  for (const [index, edge] of evidence.lineageEdges.entries()) {
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
    assertRealBuildLineageParent(edge.child, parent.identity);
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
  return edges;
}

export function validateRealBuildCompiledGraph(
  evidence: RealBuildCompiledPlacementLineageEvidence,
): RealBuildCompiledGraphIndex {
  const roots = validateRoots(evidence);
  validateReservation(evidence);
  const childCandidates = validateChildCandidates(evidence);
  const transitions = new Map<
    RealBuildCompiledTransitionId,
    RealBuildCompiledPlacementTransitionEvidence
  >();
  for (const [index, transition] of evidence.uniqueTransitions.entries()) {
    if (transitions.has(transition.transitionId)) {
      throw new TypeError(`compiledLineage.uniqueTransitions[${index}] repeats an ID.`);
    }
    replayTransition(transition, index, evidence, roots, childCandidates);
    transitions.set(transition.transitionId, transition);
  }
  if (!evidence.searchReservation.admitted && transitions.size > 0) {
    throw new TypeError("A refused compiledLineage search cannot retain transitions.");
  }
  const referencedChildren = new Set<string>(
    [...transitions.values()].map(({ childCandidateId }) => childCandidateId),
  );
  for (const candidateId of childCandidates.keys()) {
    if (!referencedChildren.has(candidateId)) {
      throw new TypeError(`compiledLineage.childCandidates contains orphan ${candidateId}.`);
    }
  }
  return Object.freeze({
    rootsByLineage: roots,
    transitionsById: transitions,
    edgesByChildLineage: validateEdges(evidence, roots, transitions),
  });
}
