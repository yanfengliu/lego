import { sha256Hex } from "@lego-studio/brick-kernel";

import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationId,
  deriveRealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import type {
  RealBuildCompiledObservation,
  RealBuildCompiledObservationCameraCommitment,
  RealBuildCompiledObservationCameraId,
  RealBuildCompiledObservationClosure,
  RealBuildCompiledObservationSelection,
  RealBuildCompiledObservationSourceCommitment,
  RealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-types";
import { deriveRealBuildCompiledSearchRequestPreflightIdentity } from "../e2e/real-build-compiled-placement-lineage-digest";
import type { RealBuildCompiledPlacementLineageEvidence } from "../e2e/real-build-compiled-placement-lineage-types";
import {
  inspectRealBuildPreparedObservationPolicy,
  inspectRealBuildPreparedRunInput,
  inspectRealBuildPreparedStepFromRunInput,
} from "../e2e/real-build-prepared-step-authority";
import { inspectRealBuildBrowserBranchSemanticEvidence } from "../e2e/real-build-browser-output-v4-semantic";
import { deriveRealBuildPreparedSearchProposalId } from "../e2e/real-build-prepared-search-digest";
import {
  compiledObservationClosureFixture,
  encodeCompiledObservationClosure,
} from "./real-build-compiled-observation-closure.fixture";
import {
  compiledPlacementLineageBytes,
  compiledPlacementLineageFixture,
  compiledPlacementMaskDigests,
} from "./real-build-compiled-placement-lineage.fixture";
import { preparedSearchOptions } from "./real-build-prepared-search.fixture";

const encoder = new TextEncoder();
const ACTION_DIGEST = `sha256:${"a".repeat(64)}` as const;
export const DIFFERENT_PRINTED_STEP_IDENTITY = `sha256:${"f".repeat(64)}` as const;

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${sha256Hex(bytes)}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function preparedRunBytes(minimumScore = 0.6): Uint8Array {
  const options = preparedSearchOptions(1, 1);
  const panels = [...options.panels];
  const panel = panels[0]!;
  if (panel.action.kind !== "place-callouts") {
    throw new TypeError("Semantic fixture step 1 must be a direct placement panel.");
  }
  panels[0] = {
    ...panel,
    action: { ...panel.action, evidenceDigest: ACTION_DIGEST },
    pieces: panel.pieces.map((piece, index) =>
      index === 0
        ? {
            ...piece,
            identityKey: "step-1-part-1",
            catalogPartId: "builtin:brick-1x1",
            colorId: "builtin:red",
          }
        : piece,
    ),
  };
  return jsonBytes({ ...options, minimumDeferredAgreement: minimumScore, panels });
}

export function bindLineageToPreparedRun(
  preparedBytes: Uint8Array,
  source: RealBuildCompiledPlacementLineageEvidence = compiledPlacementLineageFixture(),
  printedStepIdentityOverride?: `sha256:${string}`,
): RealBuildCompiledPlacementLineageEvidence {
  const run = inspectRealBuildPreparedRunInput(preparedBytes);
  const prepared = inspectRealBuildPreparedStepFromRunInput(run, 1);
  const printedStepIdentity = printedStepIdentityOverride ?? prepared.printedStepIdentity;
  const proposals = source.searchRequest.proposals.map((proposal) => ({
    ...proposal,
    proposalId: deriveRealBuildPreparedSearchProposalId({
      printedStepIdentity,
      parentLineageId: proposal.parentLineageId,
      canonicalDocumentDigest: source.searchRequest.parents.find(
        ({ parentLineageId }) => parentLineageId === proposal.parentLineageId,
      )!.canonicalDocumentDigest,
      pieces: proposal.pieces,
    }),
  }));
  const requestWithoutIdentity = {
    parents: source.searchRequest.parents,
    proposals,
    offeredLineages: source.searchRequest.offeredLineages,
    witnessCount: source.searchRequest.witnessCount,
    connectionCount: source.searchRequest.connectionCount,
    programOperationCount: source.searchRequest.programOperationCount,
  };
  return {
    ...source,
    preparedStep: {
      preparedRunInputDigest: prepared.preparedRunInputDigest,
      printedStepIdentity,
      actionEvidenceDigest: prepared.compilerMetadata.sourceActionDigest,
      compilerMetadata: prepared.compilerMetadata,
    },
    searchRequest: {
      preflightIdentity: deriveRealBuildCompiledSearchRequestPreflightIdentity({
        printedStepIdentity,
        request: requestWithoutIdentity,
      }),
      ...requestWithoutIdentity,
    },
    lineageEdges: source.lineageEdges.map((edge, index) => ({
      ...edge,
      proposalId: proposals[index]!.proposalId,
    })),
  };
}

export function legacySelectedLineage(
  source: RealBuildCompiledPlacementLineageEvidence,
): RealBuildCompiledPlacementLineageEvidence {
  const transition = source.uniqueTransitions[0]!;
  const lineageIds = source.lineageEdges.map(({ child }) => child.lineageId);
  const mask = (offset: number, maskDigest: `sha256:${string}`) => ({
    role: "branch-observation-bytes" as const,
    offset,
    bytes: 1,
    digest: maskDigest,
    encoding: "packed-binary-mask-msb/1" as const,
    widthPx: 1,
    heightPx: 1,
  });
  const parentRevision = (
    JSON.parse(source.rootCandidates[0]!.canonicalBytes) as { revision: string }
  ).revision;
  return {
    ...source,
    status: "selected",
    observationBytes: {
      role: "branch-observation-bytes",
      bytes: 2,
      digest: compiledPlacementMaskDigests.role,
    },
    observationRefs: lineageIds.map((lineageId, index) => ({
      observationId: `legacy-observation-${index}`,
      lineageId,
      sourceEvidenceId: "legacy-source",
      cameraEvidenceId: `legacy-camera-${index}`,
      registrationPanelStepNumber: 2,
      status: "scored",
      score: 0.9,
      sourceMask: mask(0, compiledPlacementMaskDigests.source),
      candidateMask: mask(1, compiledPlacementMaskDigests.candidate),
      excludedMask: null,
    })),
    selection: {
      status: "selected",
      decisionPanelStepNumber: 2,
      selectedCandidateId: transition.childCandidateId,
      selectedLineageIds: lineageIds,
      bestScore: 0.9,
      runnerUpScore: null,
      margin: null,
    },
    acceptedTransition: {
      candidateId: transition.childCandidateId,
      documentHash: transition.childDocumentHash,
      lineageIds,
      transitionIds: [transition.transitionId],
      beforeRevision: parentRevision,
      afterRevision: transition.receipt.finalRevision,
      canonicalStepId: transition.receipt.canonicalStepId,
      placedPieces: transition.pieces.length,
      validation: transition.receipt.validation,
    },
  };
}

export function rebindObservationClosure(
  preparedBytes: Uint8Array,
  mode: "selected" | "raw-empty" | "failed" = "selected",
): {
  readonly lineageBytes: Uint8Array;
  readonly closureBytes: Uint8Array;
  readonly roleBytes: Uint8Array;
} {
  const lineage = bindLineageToPreparedRun(preparedBytes);
  const lineageBytes = compiledPlacementLineageBytes(lineage);
  return rebindObservationClosureForLineage(preparedBytes, lineage, lineageBytes, mode);
}

export function rebindObservationClosureForLineage(
  preparedBytes: Uint8Array,
  lineage: RealBuildCompiledPlacementLineageEvidence,
  lineageBytes: Uint8Array,
  mode: "selected" | "raw-empty" | "failed" = "selected",
): {
  readonly lineageBytes: Uint8Array;
  readonly closureBytes: Uint8Array;
  readonly roleBytes: Uint8Array;
} {
  const raw = compiledObservationClosureFixture(
    mode,
    inspectRealBuildPreparedObservationPolicy(preparedBytes),
  );
  const sourceIds = new Map<string, RealBuildCompiledObservationSourceId>();
  const sources: RealBuildCompiledObservationSourceCommitment[] = raw.closure.sources.map(
    (source) => {
      const { sourceId, ...rest } = source;
      const committed: Omit<RealBuildCompiledObservationSourceCommitment, "sourceId"> = {
        ...rest,
        preparedRunInputDigest: lineage.preparedStep.preparedRunInputDigest,
        preparedStepIdentity: lineage.preparedStep.printedStepIdentity,
        compiledThroughStepNumber: lineage.throughStepNumber,
        registrationPanelStepNumber: lineage.throughStepNumber,
      };
      const rebound = {
        sourceId: deriveRealBuildCompiledObservationSourceId(committed),
        ...committed,
      };
      sourceIds.set(sourceId, rebound.sourceId);
      return rebound;
    },
  );
  const cameraIds = new Map<string, RealBuildCompiledObservationCameraId>();
  const cameras: RealBuildCompiledObservationCameraCommitment[] = raw.closure.cameras.map(
    (camera) => {
      const { cameraId, ...rest } = camera;
      const child = lineage.childCandidates[0];
      if (child === undefined) {
        throw new TypeError("Semantic observation fixture requires one compiled child.");
      }
      const committed: Omit<RealBuildCompiledObservationCameraCommitment, "cameraId"> = {
        ...rest,
        sourceId: sourceIds.get(camera.sourceId)!,
        candidateId: child.candidateId,
        documentHash: child.documentHash,
      };
      const rebound = {
        cameraId: deriveRealBuildCompiledObservationCameraId(committed),
        ...committed,
      };
      cameraIds.set(cameraId, rebound.cameraId);
      return rebound;
    },
  );
  const observations: RealBuildCompiledObservation[] = lineage.lineageEdges.map((edge, index) => {
    const observation = raw.closure.observations[index % raw.closure.observations.length];
    if (observation === undefined) {
      throw new TypeError("Semantic observation fixture lacks an observation row template.");
    }
    const { observationId, ...rest } = observation;
    void observationId;
    const committed: Omit<RealBuildCompiledObservation, "observationId"> = {
      ...rest,
      lineageId: edge.child.lineageId,
      sourceId: rest.sourceId === null ? null : sourceIds.get(rest.sourceId)!,
      cameraId: rest.cameraId === null ? null : cameraIds.get(rest.cameraId)!,
    };
    return { observationId: deriveRealBuildCompiledObservationId(committed), ...committed };
  });
  const selection: RealBuildCompiledObservationSelection = {
    ...raw.closure.selection,
    decisionSourceId:
      raw.closure.selection.decisionSourceId === null
        ? null
        : sourceIds.get(raw.closure.selection.decisionSourceId)!,
    selectedCameraId:
      raw.closure.selection.selectedCameraId === null
        ? null
        : cameraIds.get(raw.closure.selection.selectedCameraId)!,
    selectedCandidateId:
      raw.closure.selection.status === "selected" ? lineage.childCandidates[0]!.candidateId : null,
    selectedLineageIds:
      raw.closure.selection.status === "selected"
        ? lineage.lineageEdges.map(({ child }) => child.lineageId)
        : [],
  };
  const acceptedTransition =
    selection.status === "selected"
      ? (() => {
          const transitionById = new Map(
            lineage.uniqueTransitions.map((transition) => [transition.transitionId, transition]),
          );
          const transitionIds = [
            ...new Set(lineage.lineageEdges.map(({ transitionId }) => transitionId)),
          ];
          const first = transitionById.get(transitionIds[0]!);
          if (first === undefined) {
            throw new TypeError("Semantic observation fixture lacks a selected transition.");
          }
          return {
            candidateId: first.childCandidateId,
            documentHash: first.childDocumentHash,
            lineageIds: selection.selectedLineageIds,
            transitionIds,
            canonicalStepId: first.receipt.canonicalStepId,
            placedPieces: first.pieces.length,
          };
        })()
      : null;
  const closure: RealBuildCompiledObservationClosure = {
    ...raw.closure,
    compiledLineageBytesDigest: digest(lineageBytes),
    sources,
    cameras,
    observations,
    selection,
    acceptedTransition,
  };
  return {
    lineageBytes,
    closureBytes: encodeCompiledObservationClosure(closure),
    roleBytes: raw.roleBytes ?? new Uint8Array(),
  };
}

export interface BranchStepFixtureInput {
  readonly indexedStep?: number;
  readonly lineageBytes: Uint8Array;
  readonly closureBytes?: Uint8Array;
  readonly roleBytes?: Uint8Array;
}

export function branchFixtures(inputs: readonly BranchStepFixtureInput[]) {
  const compiledParts: Uint8Array[] = [];
  const roleParts: Uint8Array[] = [];
  const steps = [];
  let compiledOffset = 0;
  let roleOffset = 0;
  for (const [index, input] of inputs.entries()) {
    const indexedStep = input.indexedStep ?? index + 1;
    const closureBytes = input.closureBytes ?? null;
    const roleBytes = input.roleBytes ?? new Uint8Array();
    const lineageOffset = compiledOffset;
    compiledParts.push(input.lineageBytes);
    compiledOffset += input.lineageBytes.length;
    const closureReference =
      closureBytes === null
        ? null
        : {
            role: "compiled-branch-evidence-bytes" as const,
            offset: compiledOffset,
            bytes: closureBytes.length,
            digest: digest(closureBytes),
            encoding: "utf8-json/1" as const,
          };
    if (closureBytes !== null) {
      compiledParts.push(closureBytes);
      compiledOffset += closureBytes.length;
    }
    const observationReference =
      closureBytes === null || roleBytes.length === 0
        ? null
        : {
            role: "branch-observation-bytes" as const,
            offset: roleOffset,
            bytes: roleBytes.length,
            digest: digest(roleBytes),
            encoding: "raw-bytes/1" as const,
          };
    if (roleBytes.length > 0) {
      roleParts.push(roleBytes);
      roleOffset += roleBytes.length;
    }
    steps.push({
      stepNumber: indexedStep,
      compiledLineage: {
        role: "compiled-branch-evidence-bytes" as const,
        offset: lineageOffset,
        bytes: input.lineageBytes.length,
        digest: digest(input.lineageBytes),
        encoding: "utf8-json/1" as const,
      },
      observationClosure: closureReference,
      observations: observationReference,
    });
  }
  const compiled = concat(...compiledParts);
  const roleBytes = concat(...roleParts);
  return {
    indexBytes: jsonBytes({
      schemaVersion: "lego.real-build-browser-branch-evidence/1",
      compiledBranchRole: {
        role: "compiled-branch-evidence-bytes",
        bytes: compiled.length,
        digest: digest(compiled),
      },
      observationRole: {
        role: "branch-observation-bytes",
        bytes: roleBytes.length,
        digest: digest(roleBytes),
      },
      steps,
    }),
    compiled,
    roleBytes,
  };
}

export function branchFixture(input: BranchStepFixtureInput) {
  return branchFixtures([input]);
}

export function inspect(
  branch: ReturnType<typeof branchFixture>,
  preparedBytes = preparedRunBytes(),
) {
  return inspectRealBuildBrowserBranchSemanticEvidence(
    branch.indexBytes,
    branch.compiled,
    branch.roleBytes,
    preparedBytes,
  );
}
