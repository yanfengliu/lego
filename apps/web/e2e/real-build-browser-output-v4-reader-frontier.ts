import {
  canonicalBrickDocument,
  canonicalStringify,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";

import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  bindRealBuildExactRootLineageIdentity,
  deriveRealBuildExactLineageIdentity,
  type RealBuildExactLineageIdentity,
} from "./real-build-exact-lineage-identity";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type {
  RealBuildCompiledAutomaticReceiptEvidence,
  RealBuildCompiledPlacementTransitionEvidence,
} from "./real-build-compiled-placement-lineage-types";
import type { RealBuildPreparedPlacementWitness } from "./real-build-prepared-search-boundary";
import type { RealBuildBrowserBranchDetailedStepInspection } from "./real-build-browser-output-v4-semantic";
import {
  createRealBuildBrowserOutputV4TransitionFrontier,
  requireRealBuildBrowserOutputV4TransitionFrontier,
  type RealBuildBrowserOutputV4TransitionFrontier,
} from "./real-build-browser-output-v4-transition-frontier";

export const REAL_BUILD_BROWSER_OUTPUT_V4_ROOT_LOCAL_ID =
  "browser-output-v4-canonical-empty-root" as const;

export type RealBuildBrowserOutputV4PlacementAdvance =
  | Readonly<{
      status: "selected";
      frontier: RealBuildBrowserOutputV4TransitionFrontier;
      selectedCandidateId: string;
      witnesses: readonly RealBuildPreparedPlacementWitness[];
      receipt: RealBuildCompiledAutomaticReceiptEvidence;
    }>
  | Readonly<{
      status: "terminal";
      frontier: RealBuildBrowserOutputV4TransitionFrontier;
      reason: "failed" | "budget-refused" | "unresolved" | "unverified-failure" | "closure-absent";
    }>;

function publicIdentity(identity: RealBuildLineageIdentity) {
  return {
    candidateId: identity.candidateId,
    documentHash: identity.documentHash,
    lineageId: identity.lineageId,
    lineageOrigin: identity.lineageOrigin,
    localIdentity: identity.localIdentity,
    originLineageId: identity.originLineageId,
    parentLineageId: identity.parentLineageId,
    throughStepNumber: identity.throughStepNumber,
  };
}

function samePublicIdentity(
  left: RealBuildLineageIdentity,
  right: RealBuildLineageIdentity,
): boolean {
  return canonicalStringify(publicIdentity(left)) === canonicalStringify(publicIdentity(right));
}

export function createInitialRealBuildBrowserOutputV4Frontier(
  maxParts: number,
): RealBuildBrowserOutputV4TransitionFrontier {
  const document = createEmptyBrickDocument({
    id: "real-build",
    name: "Real booklet rebuild",
    maxParts,
  });
  const documentHash = documentStructuralHash(document);
  const documentSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentHash,
  });
  const identity = bindRealBuildExactRootLineageIdentity({
    documentSnapshot,
    identity: createRealBuildLineageIdentity({
      candidateId: realBuildDocumentCandidateId(documentHash),
      documentHash,
      parent: null,
      throughStepNumber: 0,
      localIdentity: { kind: "evidence", id: REAL_BUILD_BROWSER_OUTPUT_V4_ROOT_LOCAL_ID },
    }),
  });
  return createRealBuildBrowserOutputV4TransitionFrontier({
    throughStepNumber: 0,
    documentSnapshot,
    identities: [identity],
  });
}

/** Requires the compiled one-step graph to start at the exact current bytes and lineages. */
export function bindRealBuildBrowserOutputV4PlacementRoots(
  frontierValue: unknown,
  step: RealBuildBrowserBranchDetailedStepInspection,
): RealBuildBrowserOutputV4TransitionFrontier {
  const frontier = requireRealBuildBrowserOutputV4TransitionFrontier(frontierValue);
  const lineage = step.lineageInspection.evidence;
  if (step.stepNumber !== frontier.throughStepNumber + 1) {
    throw new TypeError(
      `Browser branch step ${step.stepNumber} does not immediately follow exact frontier step ${frontier.throughStepNumber}.`,
    );
  }
  if (lineage.rootCandidates.length !== 1) {
    throw new TypeError(
      `Browser branch step ${step.stepNumber} retains ${lineage.rootCandidates.length} root documents; one selected prefix requires exactly one exact root document.`,
    );
  }
  const root = lineage.rootCandidates[0]!;
  if (
    root.candidateId !== realBuildDocumentCandidateId(frontier.documentSnapshot.documentHash) ||
    root.documentHash !== frontier.documentSnapshot.documentHash ||
    root.canonicalBytes !== frontier.documentSnapshot.canonicalBytes ||
    root.canonicalBytesHash !== frontier.documentSnapshot.canonicalBytesHash ||
    root.canonicalByteLength !== frontier.documentSnapshot.canonicalByteLength
  ) {
    throw new TypeError(
      `Browser branch step ${step.stepNumber} root does not equal the exact current document bytes, hash, and lineage count.`,
    );
  }
  if (frontier.throughStepNumber === 0 && step.stepNumber === 1) {
    const exactRoots = root.identities.map((identity, index) => {
      if (identity.lineageOrigin !== "root" || identity.throughStepNumber !== 0) {
        throw new TypeError(
          `Browser branch step 1 root lineage ${index} is not an exact empty-prefix root.`,
        );
      }
      return bindRealBuildExactRootLineageIdentity({
        identity,
        documentSnapshot: frontier.documentSnapshot,
      });
    });
    return createRealBuildBrowserOutputV4TransitionFrontier({
      throughStepNumber: 0,
      documentSnapshot: frontier.documentSnapshot,
      identities: exactRoots,
    });
  }
  if (root.identities.length !== frontier.identities.length) {
    throw new TypeError(
      `Browser branch step ${step.stepNumber} root lineage count does not equal the exact current frontier.`,
    );
  }
  for (let index = 0; index < root.identities.length; index += 1) {
    if (!samePublicIdentity(root.identities[index]!, frontier.identities[index]!)) {
      throw new TypeError(
        `Browser branch step ${step.stepNumber} root lineage ${index} does not continue the exact current lineage.`,
      );
    }
  }
  return frontier;
}

function equivalentTransition(
  left: RealBuildCompiledPlacementTransitionEvidence,
  right: RealBuildCompiledPlacementTransitionEvidence,
): boolean {
  return (
    left.childCandidateId === right.childCandidateId &&
    left.childDocumentHash === right.childDocumentHash &&
    canonicalStringify(left.pieces) === canonicalStringify(right.pieces) &&
    canonicalStringify(left.receipt.validation) === canonicalStringify(right.receipt.validation) &&
    left.receipt.canonicalStepId === right.receipt.canonicalStepId
  );
}

function terminalReason(
  step: RealBuildBrowserBranchDetailedStepInspection,
): Exclude<RealBuildBrowserOutputV4PlacementAdvance, { status: "selected" }>["reason"] {
  const lineage = step.lineageInspection.evidence;
  if (lineage.status === "failed" || lineage.status === "budget-refused") return lineage.status;
  if (step.observation === null) return "closure-absent";
  return step.observation.closure.selection.status === "unverified-failure"
    ? "unverified-failure"
    : "unresolved";
}

export function advanceRealBuildBrowserOutputV4PlacementFrontier(input: {
  readonly frontier: unknown;
  readonly step: RealBuildBrowserBranchDetailedStepInspection;
}): RealBuildBrowserOutputV4PlacementAdvance {
  const frontier = bindRealBuildBrowserOutputV4PlacementRoots(input.frontier, input.step);
  const lineage = input.step.lineageInspection.evidence;
  const closure = input.step.observation?.closure ?? null;
  if (closure === null || closure.selection.status !== "selected") {
    return intrinsicRealBuildFreeze({
      status: "terminal" as const,
      frontier,
      reason: terminalReason(input.step),
    });
  }
  const accepted = closure.acceptedTransition;
  if (
    accepted === null ||
    accepted.candidateId !== closure.selection.selectedCandidateId ||
    accepted.lineageIds.length !== closure.selection.selectedLineageIds.length ||
    accepted.lineageIds.some((id, index) => id !== closure.selection.selectedLineageIds[index])
  ) {
    throw new TypeError(
      `Browser branch step ${input.step.stepNumber} selected closure does not retain one exact accepted transition.`,
    );
  }
  const child = lineage.childCandidates.find(
    (candidate) => candidate.candidateId === accepted.candidateId,
  );
  if (child === undefined || child.documentHash !== accepted.documentHash) {
    throw new TypeError(
      `Browser branch step ${input.step.stepNumber} selected candidate has no exact canonical child bytes.`,
    );
  }
  const documentSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: child.canonicalBytes,
    expectedDocumentHash: child.documentHash,
  });
  const parents = new Map(frontier.identities.map((identity) => [identity.lineageId, identity]));
  const transitions = new Map(
    lineage.uniqueTransitions.map((transition) => [transition.transitionId, transition]),
  );
  const exactChildren: RealBuildExactLineageIdentity[] = [];
  const selectedTransitions: RealBuildCompiledPlacementTransitionEvidence[] = [];
  for (const lineageId of closure.selection.selectedLineageIds) {
    const matchingEdges = lineage.lineageEdges.filter((edge) => edge.child.lineageId === lineageId);
    if (matchingEdges.length !== 1) {
      throw new TypeError(
        `Browser branch step ${input.step.stepNumber} selected lineage ${lineageId} must have one exact edge.`,
      );
    }
    const edge = matchingEdges[0]!;
    const parent = parents.get(edge.parentLineageId);
    const transition = transitions.get(edge.transitionId);
    if (parent === undefined || transition === undefined) {
      throw new TypeError(
        `Browser branch step ${input.step.stepNumber} selected edge has no exact current parent or replayed transition.`,
      );
    }
    const exactChild = deriveRealBuildExactLineageIdentity({
      candidateId: child.candidateId,
      documentHash: child.documentHash,
      documentSnapshot,
      parent,
      throughStepNumber: input.step.stepNumber,
      localIdentity: edge.child.localIdentity,
    });
    if (!samePublicIdentity(exactChild, edge.child)) {
      throw new TypeError(
        `Browser branch step ${input.step.stepNumber} selected child does not derive from its exact parent.`,
      );
    }
    exactChildren.push(exactChild);
    selectedTransitions.push(transition);
  }
  const representative = selectedTransitions[0];
  if (
    representative === undefined ||
    selectedTransitions.some((transition) => !equivalentTransition(representative, transition))
  ) {
    throw new TypeError(
      `Browser branch step ${input.step.stepNumber} convergent selected lineages do not share one physical transition and validation.`,
    );
  }
  const next = createRealBuildBrowserOutputV4TransitionFrontier({
    throughStepNumber: input.step.stepNumber,
    documentSnapshot,
    identities: exactChildren,
  });
  return intrinsicRealBuildFreeze({
    status: "selected" as const,
    frontier: next,
    selectedCandidateId: accepted.candidateId,
    witnesses: representative.pieces,
    receipt: representative.receipt,
  });
}
