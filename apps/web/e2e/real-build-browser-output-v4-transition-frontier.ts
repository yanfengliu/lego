import {
  applyBuildOperations,
  canonicalBrickDocument,
  canonicalDigest,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import { realBuildDocumentCandidateId } from "./real-build-candidate-lineage-identity";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import {
  deriveRealBuildExactLineageIdentity,
  requireRealBuildExactLineageIdentity,
  type RealBuildExactLineageIdentity,
} from "./real-build-exact-lineage-identity";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  requireRealBuildPreparedPanelInspection,
  requireRealBuildPreparedPanelResolvedPrerequisites,
  type RealBuildPreparedPanelInspection,
} from "./real-build-prepared-step-authority";
import { requireRealBuildBrowserOutputV4TransitionEvidenceRow } from "./real-build-browser-output-v4-transition-frontier-evidence";
import {
  REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_FRONTIER_SCHEMA,
  type RealBuildBrowserOutputV4ExactDocumentBinding,
  type RealBuildBrowserOutputV4TransitionDelta,
  type RealBuildBrowserOutputV4TransitionEvidenceRow,
  type RealBuildBrowserOutputV4TransitionFrontier,
} from "./real-build-browser-output-v4-transition-frontier-types";
import {
  realBuildBrowserOutputV4TransitionData as ownData,
  realBuildBrowserOutputV4TransitionDenseArray,
  realBuildBrowserOutputV4TransitionSetAdd,
  realBuildBrowserOutputV4TransitionSetHas,
  realBuildBrowserOutputV4TransitionWeakSetAdd,
  realBuildBrowserOutputV4TransitionWeakSetHas,
} from "./real-build-browser-output-v4-transition-primitives";

const MAXIMUM_FRONTIER_IDENTITIES = 8_192;
const frontiers = new WeakSet<object>();
const SAFE_SET = Set;

const NO_COMPLETION_AUTHORITY = intrinsicRealBuildFreeze({
  status: "absent" as const,
  authorized: false as const,
  reason: "transition-frontier-cannot-authorize-completion" as const,
});

function snapshotBinding(
  snapshot: RealBuildCandidateDocumentSnapshot,
): RealBuildBrowserOutputV4ExactDocumentBinding {
  return intrinsicRealBuildFreeze({
    documentHash: snapshot.documentHash,
    canonicalBytesHash: snapshot.canonicalBytesHash,
    canonicalByteLength: snapshot.canonicalByteLength,
  });
}

function sameBinding(
  left: RealBuildBrowserOutputV4ExactDocumentBinding,
  right: RealBuildBrowserOutputV4ExactDocumentBinding,
): boolean {
  return (
    left.documentHash === right.documentHash &&
    left.canonicalBytesHash === right.canonicalBytesHash &&
    left.canonicalByteLength === right.canonicalByteLength
  );
}

function closeFrontier(input: {
  readonly throughStepNumber: number;
  readonly documentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly identities: readonly RealBuildExactLineageIdentity[];
  readonly lastTransition: RealBuildBrowserOutputV4TransitionDelta | null;
}): RealBuildBrowserOutputV4TransitionFrontier {
  const frontier = intrinsicRealBuildFreeze({
    schemaVersion: REAL_BUILD_BROWSER_OUTPUT_V4_TRANSITION_FRONTIER_SCHEMA,
    throughStepNumber: input.throughStepNumber,
    documentSnapshot: input.documentSnapshot,
    identities: intrinsicRealBuildFreeze([...input.identities]),
    lastTransition: input.lastTransition,
    completionAuthority: NO_COMPLETION_AUTHORITY,
  });
  realBuildBrowserOutputV4TransitionWeakSetAdd(frontiers, frontier);
  return frontier;
}

/** Groups exact same-document lineages into one bounded, authority-free ordered frontier. */
export function createRealBuildBrowserOutputV4TransitionFrontier(input: unknown) {
  const path = "Transition frontier input";
  const throughStepNumber = ownData(input, "throughStepNumber", path);
  if (
    !Number.isSafeInteger(throughStepNumber) ||
    (throughStepNumber as number) < 0 ||
    (throughStepNumber as number) > 359
  ) {
    throw new RangeError(`${path}.throughStepNumber must be a safe integer from 0 through 359.`);
  }
  const documentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    ownData(input, "documentSnapshot", path),
  );
  const identityValues = realBuildBrowserOutputV4TransitionDenseArray(
    ownData(input, "identities", path),
    `${path}.identities`,
    1,
    MAXIMUM_FRONTIER_IDENTITIES,
  );
  const identities: RealBuildExactLineageIdentity[] = [];
  const seen = new SAFE_SET<string>();
  for (let index = 0; index < identityValues.length; index += 1) {
    const identity = requireRealBuildExactLineageIdentity(identityValues[index]);
    if (
      identity.throughStepNumber !== throughStepNumber ||
      identity.documentHash !== documentSnapshot.documentHash ||
      identity.canonicalBytesHash !== documentSnapshot.canonicalBytesHash ||
      identity.canonicalByteLength !== documentSnapshot.canonicalByteLength
    ) {
      throw new TypeError(
        `${path}.identities[${index}] does not bind the exact frontier step, hash, bytes, and length.`,
      );
    }
    if (realBuildBrowserOutputV4TransitionSetHas(seen, identity.exactLineageId)) {
      throw new TypeError(`${path}.identities contains duplicate exact lineage IDs.`);
    }
    realBuildBrowserOutputV4TransitionSetAdd(seen, identity.exactLineageId);
    identities.push(identity);
  }
  return closeFrontier({
    throughStepNumber: throughStepNumber as number,
    documentSnapshot,
    identities,
    lastTransition: null,
  });
}

export function requireRealBuildBrowserOutputV4TransitionFrontier(
  value: unknown,
): RealBuildBrowserOutputV4TransitionFrontier {
  if (
    value === null ||
    typeof value !== "object" ||
    !realBuildBrowserOutputV4TransitionWeakSetHas(frontiers, value)
  ) {
    throw new TypeError("Transition frontier must be the exact branded result of this module.");
  }
  return value as RealBuildBrowserOutputV4TransitionFrontier;
}

function requirePreparedTransition(
  preparedPanel: RealBuildPreparedPanelInspection,
  row: RealBuildBrowserOutputV4TransitionEvidenceRow,
): void {
  const prepared = requireRealBuildPreparedPanelResolvedPrerequisites(preparedPanel);
  let action: unknown;
  try {
    action = JSON.parse(prepared.actionCanonicalJson);
  } catch {
    throw new TypeError("Prepared transition action is not inert canonical JSON.");
  }
  if (
    prepared.stepNumber !== row.stepNumber ||
    prepared.pageNumber !== row.pageNumber ||
    prepared.preparedPanelIdentity !== row.preparedPanelIdentity ||
    prepared.actionKind !== "transition" ||
    prepared.assembledPieces !== 0 ||
    prepared.expectedAtomicPieces.length !== 0 ||
    prepared.actionEvidenceDigest !== row.actionEvidenceDigest ||
    prepared.panelEvidenceDigest !== row.action.panelEvidenceDigest ||
    canonicalDigest(action) !== canonicalDigest(row.action)
  ) {
    throw new TypeError(
      "Transition row action, step, page, or panel does not match the exact prepared panel.",
    );
  }
}

/**
 * Replays one exact addStep delta. It retains only the new snapshot and child identities,
 * never a second copy of the historical source document.
 */
export function advanceRealBuildBrowserOutputV4TransitionFrontier(input: {
  readonly frontier: RealBuildBrowserOutputV4TransitionFrontier;
  readonly preparedPanel: RealBuildPreparedPanelInspection;
  readonly row: RealBuildBrowserOutputV4TransitionEvidenceRow;
}): RealBuildBrowserOutputV4TransitionFrontier {
  const path = "Transition frontier advance input";
  const frontier = requireRealBuildBrowserOutputV4TransitionFrontier(
    ownData(input, "frontier", path),
  );
  const row = requireRealBuildBrowserOutputV4TransitionEvidenceRow(ownData(input, "row", path));
  const preparedPanel = requireRealBuildPreparedPanelInspection(
    ownData(input, "preparedPanel", path),
  );
  requirePreparedTransition(preparedPanel, row);
  if (row.stepNumber !== frontier.throughStepNumber + 1) {
    throw new TypeError(
      `Transition step ${row.stepNumber} does not immediately follow frontier step ${frontier.throughStepNumber}.`,
    );
  }
  const sourceBinding = snapshotBinding(frontier.documentSnapshot);
  if (!sameBinding(sourceBinding, row.source)) {
    throw new TypeError(
      "Transition row source hash, canonical byte digest, or byte length does not match the current frontier.",
    );
  }
  const stepId = `real-build-step-${row.stepNumber}`;
  const stepIndex = row.stepNumber - 1;
  const existingIndex = frontier.documentSnapshot.document.steps.find(
    ({ index }) => index === stepIndex,
  );
  const existingId = frontier.documentSnapshot.document.steps.find(({ id }) => id === stepId);
  const bootstrap = frontier.documentSnapshot.document.steps[0];
  const replacesExactEmptyBootstrap =
    row.stepNumber === 1 &&
    frontier.documentSnapshot.document.steps.length === 1 &&
    bootstrap?.id === "step-1" &&
    bootstrap.index === 0 &&
    bootstrap.name === "Step 1" &&
    bootstrap.partIds.length === 0 &&
    frontier.documentSnapshot.document.parts.length === 0 &&
    frontier.documentSnapshot.document.connections.length === 0 &&
    frontier.documentSnapshot.document.semanticRegions.length === 0 &&
    frontier.documentSnapshot.document.submodels.every(({ partIds }) => partIds.length === 0);
  if ((existingIndex !== undefined || existingId !== undefined) && !replacesExactEmptyBootstrap) {
    throw new TypeError(
      `Transition step ${row.stepNumber} collides with an existing canonical step; replay requires exactly one new addStep.`,
    );
  }
  const operationId = `real-build-transition-${row.stepNumber}`;
  const semanticName =
    `Step ${row.stepNumber} [transition:${row.action.transition};` +
    `panel=${row.action.panelEvidenceDigest}]`;
  const targetDocument = applyBuildOperations(frontier.documentSnapshot.document, [
    ...(replacesExactEmptyBootstrap
      ? [
          {
            kind: "removeStep" as const,
            operationId: "remove-empty-root-bootstrap-step",
            step: bootstrap!,
          },
        ]
      : []),
    {
      kind: "addStep",
      operationId,
      step: { id: stepId, index: stepIndex, name: semanticName, partIds: [] },
    },
  ]);
  if (targetDocument.parts.length !== frontier.documentSnapshot.document.parts.length) {
    throw new TypeError("Transition replay changed the document part count.");
  }
  const report = validateBrickDocument(targetDocument);
  const blockingIssues = report.issues.filter(({ severity }) => severity === "blocking");
  if (!report.documentGloballyValid || blockingIssues.length !== 0) {
    throw new TypeError(
      `Transition target failed independent validation with ${blockingIssues.length} blocking issue(s).`,
    );
  }
  const measuredHash = documentStructuralHash(targetDocument);
  const targetSnapshot = createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(targetDocument),
    expectedDocumentHash: measuredHash,
  });
  const targetBinding = snapshotBinding(targetSnapshot);
  if (!sameBinding(targetBinding, row.target)) {
    throw new TypeError(
      "Transition row target hash, canonical byte digest, or byte length does not match exact replay.",
    );
  }
  if (
    row.canonicalStepId !== stepId ||
    row.documentParts !== targetDocument.parts.length ||
    row.validation.targetDocumentHash !== report.targetDocumentHash ||
    row.validation.targetDocumentHash !== measuredHash ||
    row.validation.truthSnapshotHash !== report.truthSnapshotHash ||
    row.validation.validatorSetHash !== report.validatorSetHash ||
    row.validation.documentGloballyValid !== report.documentGloballyValid ||
    row.validation.blockingIssues.length !== blockingIssues.length ||
    row.validation.failure !== null
  ) {
    throw new TypeError(
      "Transition row report validation fields do not reproduce the independently validated target.",
    );
  }
  const localIdentity = intrinsicRealBuildFreeze({
    kind: "evidence" as const,
    id: `v4-transition:${row.rowDigest}`,
  });
  const children = frontier.identities.map((parent) =>
    deriveRealBuildExactLineageIdentity({
      candidateId: realBuildDocumentCandidateId(measuredHash),
      documentHash: measuredHash,
      documentSnapshot: targetSnapshot,
      parent,
      throughStepNumber: row.stepNumber,
      localIdentity,
    }),
  );
  const delta = intrinsicRealBuildFreeze({
    rowDigest: row.rowDigest,
    operationId,
    canonicalStepId: stepId,
    source: row.source,
    target: row.target,
    localIdentity,
    orderedParentExactLineageIds: intrinsicRealBuildFreeze(
      frontier.identities.map(({ exactLineageId }) => exactLineageId),
    ),
  });
  return closeFrontier({
    throughStepNumber: row.stepNumber,
    documentSnapshot: targetSnapshot,
    identities: children,
    lastTransition: delta,
  });
}

export type {
  RealBuildBrowserOutputV4ExactDocumentBinding,
  RealBuildBrowserOutputV4TransitionDelta,
  RealBuildBrowserOutputV4TransitionEvidenceManifest,
  RealBuildBrowserOutputV4TransitionEvidenceRow,
  RealBuildBrowserOutputV4TransitionFrontier,
} from "./real-build-browser-output-v4-transition-frontier-types";

export {
  createRealBuildBrowserOutputV4TransitionEvidenceManifest,
  createRealBuildBrowserOutputV4TransitionEvidenceRow,
  readRealBuildBrowserOutputV4TransitionEvidenceManifest,
  requireRealBuildBrowserOutputV4TransitionEvidenceManifest,
  requireRealBuildBrowserOutputV4TransitionEvidenceRow,
  serializeRealBuildBrowserOutputV4TransitionEvidenceManifest,
} from "./real-build-browser-output-v4-transition-frontier-evidence";
