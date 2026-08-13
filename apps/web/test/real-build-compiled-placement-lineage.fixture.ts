import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
  normalizeBrickDocument,
} from "@lego-studio/brick-kernel";

import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "../e2e/real-build-candidate-lineage-identity";
import {
  deriveRealBuildCompiledSearchRequestPreflightIdentity,
  deriveRealBuildCompiledTransitionId,
} from "../e2e/real-build-compiled-placement-lineage-digest";
import type {
  RealBuildCompiledPlacementLineageEvidence,
  RealBuildCompiledPlacementTransitionEvidence,
  RealBuildCompiledValidationEvidence,
} from "../e2e/real-build-compiled-placement-lineage-types";
import {
  deriveRealBuildPreparedSearchCanonicalDocumentDigest,
  deriveRealBuildPreparedSearchProposalId,
} from "../e2e/real-build-prepared-search-digest";

const DIGEST_A = `sha256:${"a".repeat(64)}` as const;
const DIGEST_B = `sha256:${"b".repeat(64)}` as const;
const DIGEST_C = `sha256:${"c".repeat(64)}` as const;
const DIGEST_D = `sha256:${"d".repeat(64)}` as const;

export function compiledPlacementLineageFixture(): RealBuildCompiledPlacementLineageEvidence {
  const document = normalizeBrickDocument(
    createEmptyBrickDocument({ id: "compiled-lineage", name: "Compiled lineage" }),
  );
  const documentSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });
  const printedStep = {
    name: "Printed step 1",
    sourceActionDigest: DIGEST_A,
  };
  const compilerWitness = {
    catalogPartId: "builtin:brick-1x1",
    colorId: "builtin:red",
    transform: {
      positionLdu: [0, 0, 0] as const,
      orientationId: "upright-yaw-0",
    },
    connections: [],
  };
  const compilation = compileRealBuildAutomaticPlacement({
    documentSnapshot,
    printedStepNumber: 1,
    printedStep,
    witnesses: [compilerWitness],
  });
  if (!compilation.ok) throw new Error("Compiled lineage fixture placement unexpectedly failed.");
  const parentDocumentHash = documentSnapshot.documentHash;
  const childDocumentHash = documentStructuralHash(compilation.document);
  const childDocumentSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(compilation.document),
    expectedDocumentHash: childDocumentHash,
  });
  const roots = Array.from({ length: 8 }, (_, index) =>
    createRealBuildLineageIdentity({
      candidateId: realBuildDocumentCandidateId(parentDocumentHash),
      documentHash: parentDocumentHash,
      parent: null,
      throughStepNumber: 0,
      localIdentity: { kind: "evidence", id: `camera-root:${index}` },
    }),
  );
  const children = roots.map((parent, index) =>
    createRealBuildLineageIdentity({
      candidateId: realBuildDocumentCandidateId(childDocumentHash),
      documentHash: childDocumentHash,
      parent,
      throughStepNumber: 1,
      localIdentity: { kind: "decision", id: `compiled-step-1:${index}` },
    }),
  );
  const validation: RealBuildCompiledValidationEvidence = {
    targetDocumentHash: compilation.validationReport.targetDocumentHash as `sha256:${string}`,
    truthSnapshotHash: compilation.validationReport.truthSnapshotHash as `sha256:${string}`,
    validatorSetHash: compilation.validationReport.validatorSetHash as `sha256:${string}`,
    documentGloballyValid: true as const,
    blockingIssues: [] as const,
  };
  const pieces = [
    {
      identityKey: "step-1-part-1",
      ...compilerWitness,
    },
  ] as const;
  const transitionWithoutId: Omit<RealBuildCompiledPlacementTransitionEvidence, "transitionId"> = {
    parentCandidateId: realBuildDocumentCandidateId(parentDocumentHash),
    parentDocumentHash,
    childCandidateId: realBuildDocumentCandidateId(childDocumentHash),
    childDocumentHash,
    printedStep,
    pieces,
    receipt: {
      schemaVersion: "lego.real-build-automatic-placement-receipt/1",
      compilerSnapshotHash: compilation.automaticPlacement.compilerSnapshotHash,
      compilerInputDigest: compilation.automaticPlacement.program.compilerInputDigest,
      programHash: compilation.automaticPlacement.programHash,
      placementProgramHash: compilation.automaticPlacement.placementProgramHash,
      jobId: compilation.automaticPlacement.jobId,
      candidateId: realBuildDocumentCandidateId(childDocumentHash),
      baseCanonicalBytesHash: documentSnapshot.canonicalBytesHash,
      baseCanonicalByteLength: documentSnapshot.canonicalByteLength,
      baseDocumentHash: parentDocumentHash,
      printedStepNumber: 1,
      canonicalStepId: compilation.document.steps[0]!.id,
      finalDocumentHash: childDocumentHash,
      finalRevision: compilation.document.revision,
      validation,
    },
  };
  const transition = {
    transitionId: deriveRealBuildCompiledTransitionId(transitionWithoutId),
    ...transitionWithoutId,
  };
  const canonicalDocumentDigest = deriveRealBuildPreparedSearchCanonicalDocumentDigest(
    documentSnapshot.canonicalBytesHash,
  );
  const proposals = roots.map((root) => ({
    proposalId: deriveRealBuildPreparedSearchProposalId({
      printedStepIdentity: DIGEST_C,
      parentLineageId: root.lineageId,
      canonicalDocumentDigest,
      pieces,
    }),
    parentLineageId: root.lineageId,
    pieces,
    connectionCount: 0,
    programOperationCount: 1,
  }));
  const searchRequestWithoutIdentity = {
    parents: roots.map((root) => ({
      parentLineageId: root.lineageId,
      candidateId: realBuildDocumentCandidateId(parentDocumentHash),
      documentHash: parentDocumentHash,
      canonicalDocumentDigest,
      offeredLineages: 1,
    })),
    proposals,
    offeredLineages: 8,
    witnessCount: 8,
    connectionCount: 0,
    programOperationCount: 8,
  };
  return {
    schemaVersion: "lego.real-build-compiled-placement-lineage/1",
    status: "unresolved",
    throughStepNumber: 1,
    preparedStep: {
      preparedRunInputDigest: DIGEST_B,
      printedStepIdentity: DIGEST_C,
      actionEvidenceDigest: DIGEST_A,
      compilerMetadata: printedStep,
    },
    rootCandidates: [
      {
        candidateId: realBuildDocumentCandidateId(parentDocumentHash),
        documentHash: parentDocumentHash,
        identities: roots,
        canonicalBytes: documentSnapshot.canonicalBytes,
        canonicalBytesHash: documentSnapshot.canonicalBytesHash,
        canonicalByteLength: documentSnapshot.canonicalByteLength,
      },
    ],
    searchRequest: {
      preflightIdentity: deriveRealBuildCompiledSearchRequestPreflightIdentity({
        printedStepIdentity: DIGEST_C,
        request: searchRequestWithoutIdentity,
      }),
      ...searchRequestWithoutIdentity,
    },
    searchReservation: {
      budget: 8_192,
      reservedBefore: 0,
      requested: 8,
      reservedAfter: 8,
      reservationNumber: 1,
      admitted: true,
      refusal: null,
      terminalFailure: null,
    },
    terminalFailure: null,
    childCandidates: [
      {
        candidateId: realBuildDocumentCandidateId(childDocumentHash),
        documentHash: childDocumentHash,
        canonicalBytes: childDocumentSnapshot.canonicalBytes,
        canonicalBytesHash: childDocumentSnapshot.canonicalBytesHash,
        canonicalByteLength: childDocumentSnapshot.canonicalByteLength,
      },
    ],
    uniqueTransitions: [transition],
    lineageEdges: children.map((child, index) => ({
      parentLineageId: roots[index]!.lineageId,
      proposalId: proposals[index]!.proposalId,
      child,
      transitionId: transition.transitionId,
    })),
    observationBytes: null,
    observationRefs: [],
    selection: {
      status: "unresolved",
      decisionPanelStepNumber: null,
      selectedCandidateId: null,
      selectedLineageIds: [],
      bestScore: null,
      runnerUpScore: null,
      margin: null,
    },
    acceptedTransition: null,
    completionAuthority: {
      status: "absent",
      authorized: false,
      reason: "compiled-placement-lineage-is-inspection-only",
    },
  };
}

export function compiledPlacementLineageBytes(
  evidence: RealBuildCompiledPlacementLineageEvidence = compiledPlacementLineageFixture(),
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(evidence));
}

export const compiledPlacementMaskDigests = {
  role: DIGEST_D,
  source: DIGEST_B,
  candidate: DIGEST_C,
};
