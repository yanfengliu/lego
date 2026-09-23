import {
  validateBrickDocumentV1,
  validateBuildOperation,
  type BrickDocumentV1,
  type BuildOperation,
} from "@lego-studio/protocol";

import { canonicalDigest } from "./canonical.ts";
import { normalizeBrickDocument } from "./document.ts";

export const BUILD_PLAYBACK_TRACE_SCHEMA_VERSION = "lego.build-playback-trace/1" as const;

export const BUILD_PLAYBACK_TRACE_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxTransitions: 500,
  maxOperationGroupsPerTransition: 32,
  maxOperationsPerTransition: 10_000,
  maxTotalOperations: 50_000,
} as const);

export interface BuildPlaybackTraceTransitionV1 {
  readonly stepIndex: number;
  readonly stepId: string;
  readonly stepName: string;
  readonly addedPartIds: readonly string[];
  readonly beforeDocumentHash: `sha256:${string}`;
  readonly afterDocumentHash: `sha256:${string}`;
  readonly beforeDocumentCanonicalDigest: `sha256:${string}`;
  readonly afterDocumentCanonicalDigest: `sha256:${string}`;
  /** Reducer call boundaries are retained because each call advances revision. */
  readonly operationGroups: readonly (readonly BuildOperation[])[];
  readonly transitionCommitment: `sha256:${string}`;
}

/**
 * An authority-free replay artifact beside an authored document. It records
 * how ordinary reducer operations reached each rendered step state; it never
 * replaces the final BrickDocument or grants permission to mutate it.
 */
export interface BuildPlaybackTraceV1 {
  readonly schemaVersion: typeof BUILD_PLAYBACK_TRACE_SCHEMA_VERSION;
  readonly authority: "none";
  readonly baseDocument: BrickDocumentV1;
  readonly baseDocumentHash: `sha256:${string}`;
  readonly targetDocumentHash: `sha256:${string}`;
  /** Full normalized target bytes except the deliberately cosmetic document name. */
  readonly targetPlaybackDigest: `sha256:${string}`;
  readonly transitions: readonly BuildPlaybackTraceTransitionV1[];
  readonly traceCommitment: `sha256:${string}`;
}

export class BuildPlaybackTraceError extends TypeError {
  public constructor(message: string) {
    super(message);
    this.name = "BuildPlaybackTraceError";
  }
}

export function comparePlaybackTraceStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function playbackTargetDigest(document: BrickDocumentV1): `sha256:${string}` {
  return canonicalDigest({ ...normalizeBrickDocument(document), name: "" });
}

export function requirePlaybackProtocolDocument(document: unknown, label: string): void {
  let valid = false;
  try {
    valid = validateBrickDocumentV1(document);
  } catch {
    // Hostile values fail closed behind the trace error boundary.
  }
  if (!valid) throw new BuildPlaybackTraceError(`${label} is not a valid BrickDocumentV1.`);
}

export function requirePlaybackProtocolOperations(
  operationGroups: readonly (readonly unknown[])[],
  label: string,
): void {
  for (const operations of operationGroups) {
    for (const operation of operations) {
      let valid = false;
      try {
        valid = validateBuildOperation(operation);
      } catch {
        // Hostile values fail closed behind the trace error boundary.
      }
      if (!valid) throw new BuildPlaybackTraceError(`${label} contains an invalid BuildOperation.`);
    }
  }
}

export function requireEmptyAuthoringBase(document: BrickDocumentV1): void {
  // BrickDocumentV1 represents an empty authoring graph with one empty root
  // submodel and one empty pending Step 1. Truth and global constraints stay
  // pinned across replay; operations may populate memberships but cannot alter
  // either policy surface.
  if (
    document.parts.length !== 0 ||
    document.connections.length !== 0 ||
    document.semanticRegions.length !== 0 ||
    document.submodels.length !== 1 ||
    document.submodels[0]?.partIds.length !== 0 ||
    document.steps.length !== 1 ||
    document.steps[0]?.index !== 0 ||
    document.steps[0].partIds.length !== 0
  ) {
    throw new BuildPlaybackTraceError(
      "Exact build playback requires the empty BrickDocument authoring root: zero parts, connections, and semantic regions, plus one empty root submodel and pending Step 1.",
    );
  }
}

export function requireStableGlobalPolicy(before: BrickDocumentV1, after: BrickDocumentV1): void {
  const normalizedBefore = normalizeBrickDocument(before);
  const normalizedAfter = normalizeBrickDocument(after);
  if (
    normalizedBefore.id !== normalizedAfter.id ||
    canonicalDigest(normalizedBefore.truth) !== canonicalDigest(normalizedAfter.truth) ||
    canonicalDigest(normalizedBefore.constraints) !==
      canonicalDigest(normalizedAfter.constraints) ||
    normalizedBefore.submodels.length !== normalizedAfter.submodels.length ||
    normalizedBefore.submodels.some((submodel, index) => {
      const next = normalizedAfter.submodels[index];
      return next === undefined || submodel.id !== next.id || submodel.name !== next.name;
    }) ||
    normalizedBefore.semanticRegions.length !== normalizedAfter.semanticRegions.length ||
    normalizedBefore.semanticRegions.some((region, index) => {
      const next = normalizedAfter.semanticRegions[index];
      return next === undefined || region.id !== next.id || region.label !== next.label;
    })
  ) {
    throw new BuildPlaybackTraceError(
      "Build playback operations changed document identity, pinned truth, global constraints, or region/submodel identity.",
    );
  }
}

export function requireFinalStepBijection(
  document: BrickDocumentV1,
  transitions: readonly BuildPlaybackTraceTransitionV1[],
): void {
  const steps = [...document.steps].sort(
    (left, right) => left.index - right.index || comparePlaybackTraceStrings(left.id, right.id),
  );
  if (
    transitions.length === 0 ||
    transitions.length !== steps.length ||
    steps.some(({ index }, position) => index !== position) ||
    transitions.some(
      (transition, position) =>
        transition.stepIndex !== position || transition.stepId !== steps[position]?.id,
    )
  ) {
    throw new BuildPlaybackTraceError(
      "Build playback transitions must bijectively cover the target's exact contiguous BuildStep roster.",
    );
  }
  const partIdsByStep = new Map<string, string[]>();
  for (const part of document.parts) {
    const bucket = partIdsByStep.get(part.stepId);
    if (bucket === undefined) partIdsByStep.set(part.stepId, [part.id]);
    else bucket.push(part.id);
  }
  for (const step of steps) {
    const actual = [...(partIdsByStep.get(step.id) ?? [])].sort(comparePlaybackTraceStrings);
    const declared = [...step.partIds].sort(comparePlaybackTraceStrings);
    if (
      actual.length !== declared.length ||
      actual.some((partId, index) => partId !== declared[index])
    ) {
      throw new BuildPlaybackTraceError(
        `Build playback target Step ${step.id} does not bijectively own its PartInstance roster.`,
      );
    }
  }
}
