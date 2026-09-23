import type { BrickDocumentV1, BuildOperation, ValidationReportV1 } from "@lego-studio/protocol";

import { canonicalDigest, deepFreeze } from "./canonical.ts";
import { documentStructuralHash } from "./document.ts";
import { applyBuildOperations } from "./operations.ts";
import type { BuildSequence, BuildSequenceState } from "./build-sequence.ts";
import { validateBrickDocument } from "./validation.ts";
import {
  BUILD_PLAYBACK_TRACE_LIMITS,
  BUILD_PLAYBACK_TRACE_SCHEMA_VERSION,
  BuildPlaybackTraceError,
  comparePlaybackTraceStrings as compareStrings,
  playbackTargetDigest,
  requireEmptyAuthoringBase,
  requireFinalStepBijection,
  requirePlaybackProtocolDocument,
  requirePlaybackProtocolOperations,
  requireStableGlobalPolicy,
  type BuildPlaybackTraceTransitionV1,
  type BuildPlaybackTraceV1,
} from "./build-playback-trace-contract.ts";

export {
  BUILD_PLAYBACK_TRACE_LIMITS,
  BUILD_PLAYBACK_TRACE_SCHEMA_VERSION,
  BuildPlaybackTraceError,
  type BuildPlaybackTraceTransitionV1,
  type BuildPlaybackTraceV1,
} from "./build-playback-trace-contract.ts";

const EXPECTED_INTERMEDIATE_CODES: ReadonlySet<string> = new Set(["DISCONNECTED_ASSEMBLY"]);
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BuildPlaybackTraceError(`${label} must be a detached data object.`);
  }
  const keys = Object.keys(value).sort(compareStrings);
  const wanted = [...expected].sort(compareStrings);
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new BuildPlaybackTraceError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function transitionBody(
  transition: Omit<BuildPlaybackTraceTransitionV1, "transitionCommitment">,
): Omit<BuildPlaybackTraceTransitionV1, "transitionCommitment"> {
  return transition;
}

function traceBody(
  trace: Omit<BuildPlaybackTraceV1, "traceCommitment">,
): Omit<BuildPlaybackTraceV1, "traceCommitment"> {
  return trace;
}

function exactTransitionStep(
  before: BrickDocumentV1,
  after: BrickDocumentV1,
  transitionPosition: number,
): BrickDocumentV1["steps"][number] {
  const initialAfterStep = after.steps[0];
  if (
    transitionPosition === 1 &&
    before.steps.length === 1 &&
    after.steps.length === 1 &&
    before.steps[0]?.index === 0 &&
    before.steps[0].partIds.length === 0 &&
    initialAfterStep?.index === 0 &&
    initialAfterStep.partIds.length === after.parts.length
  ) {
    return initialAfterStep;
  }
  if (after.steps.length !== before.steps.length + 1) {
    throw new BuildPlaybackTraceError(
      `Playback transition ${transitionPosition} must append exactly one BuildStep; step counts changed ${before.steps.length} -> ${after.steps.length}.`,
    );
  }
  const beforeById = new Map(before.steps.map((step) => [step.id, step] as const));
  const added = after.steps.filter(({ id }) => !beforeById.has(id));
  if (added.length !== 1) {
    throw new BuildPlaybackTraceError(
      `Playback transition ${transitionPosition} must introduce one exact BuildStep ID; found ${added.length}.`,
    );
  }
  for (const step of before.steps) {
    const retained = after.steps.find(({ id }) => id === step.id);
    if (retained === undefined || canonicalDigest(retained) !== canonicalDigest(step)) {
      throw new BuildPlaybackTraceError(
        `Playback transition ${transitionPosition} changed prior BuildStep ${step.id}.`,
      );
    }
  }
  const step = added[0]!;
  if (step.index !== before.steps.length) {
    throw new BuildPlaybackTraceError(
      `Playback transition ${transitionPosition} appended BuildStep index ${step.index}; expected contiguous index ${before.steps.length}.`,
    );
  }
  return step;
}

function addedPartIds(before: BrickDocumentV1, after: BrickDocumentV1): readonly string[] {
  const beforeIds = new Set(before.parts.map(({ id }) => id));
  return after.parts
    .filter(({ id }) => !beforeIds.has(id))
    .map(({ id }) => id)
    .sort(compareStrings);
}

function requireStepMembership(
  before: BrickDocumentV1,
  after: BrickDocumentV1,
  step: BrickDocumentV1["steps"][number],
  addedIds: readonly string[],
  transitionPosition: number,
): void {
  const declared = [...step.partIds].sort(compareStrings);
  if (
    declared.length !== addedIds.length ||
    declared.some((partId, index) => partId !== addedIds[index])
  ) {
    throw new BuildPlaybackTraceError(
      `Playback transition ${transitionPosition} BuildStep ${step.id} membership does not equal its exact added-part roster.`,
    );
  }
  const beforeIds = new Set(before.parts.map(({ id }) => id));
  if (
    after.parts.some(
      (part) =>
        (beforeIds.has(part.id) && part.stepId === step.id) ||
        (!beforeIds.has(part.id) && part.stepId !== step.id),
    )
  ) {
    throw new BuildPlaybackTraceError(
      `Playback transition ${transitionPosition} changed prior step ownership or assigned a new part outside ${step.id}.`,
    );
  }
}

function blockingState(input: {
  readonly document: BrickDocumentV1;
  readonly stepIndex: number;
  readonly stepId: string | null;
  readonly stepName: string;
  readonly addedPartIds: readonly string[];
}): BuildSequenceState {
  const report: ValidationReportV1 = validateBrickDocument(input.document);
  const blockingCodes = [
    ...new Set(
      report.issues.filter(({ severity }) => severity === "blocking").map(({ code }) => code),
    ),
  ].sort(compareStrings);
  return {
    ...input,
    cumulativePartCount: input.document.parts.length,
    report,
    buildable: blockingCodes.every((code) => EXPECTED_INTERMEDIATE_CODES.has(code)),
    connected: !blockingCodes.includes("DISCONNECTED_ASSEMBLY"),
    blockingCodes,
  };
}

function requireBoundedJsonEnvelope(value: unknown): void {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new BuildPlaybackTraceError("Build playback trace must be finite JSON-compatible data.");
  }
  if (new TextEncoder().encode(json).byteLength > BUILD_PLAYBACK_TRACE_LIMITS.maxBytes) {
    throw new BuildPlaybackTraceError(
      `Build playback trace exceeds the ${BUILD_PLAYBACK_TRACE_LIMITS.maxBytes}-byte envelope limit.`,
    );
  }
}

function detachTrace(value: unknown): unknown {
  let detached: unknown;
  try {
    detached = structuredClone(value);
  } catch {
    throw new BuildPlaybackTraceError(
      "Build playback trace must be detached structured-cloneable data.",
    );
  }
  requireBoundedJsonEnvelope(detached);
  return detached;
}

/** Creates a commitment-bound trace by applying the ordinary kernel reducer. */
export function createBuildPlaybackTrace(
  baseDocument: BrickDocumentV1,
  transitionOperationGroups: readonly (readonly (readonly BuildOperation[])[])[],
): BuildPlaybackTraceV1 {
  requirePlaybackProtocolDocument(baseDocument, "Build playback base document");
  requireEmptyAuthoringBase(baseDocument);
  if (transitionOperationGroups.length > BUILD_PLAYBACK_TRACE_LIMITS.maxTransitions) {
    throw new BuildPlaybackTraceError("Build playback trace exceeds the transition limit.");
  }
  let totalOperations = 0;
  let current = structuredClone(baseDocument);
  const transitions: BuildPlaybackTraceTransitionV1[] = [];
  for (const [position, rawGroups] of transitionOperationGroups.entries()) {
    if (
      rawGroups.length < 1 ||
      rawGroups.length > BUILD_PLAYBACK_TRACE_LIMITS.maxOperationGroupsPerTransition
    ) {
      throw new BuildPlaybackTraceError(
        `Playback transition ${position + 1} reducer-group count is outside 1..${BUILD_PLAYBACK_TRACE_LIMITS.maxOperationGroupsPerTransition}.`,
      );
    }
    const operationGroups = structuredClone(rawGroups);
    requirePlaybackProtocolOperations(operationGroups, `Playback transition ${position + 1}`);
    if (
      operationGroups.some(
        (operations) =>
          operations.length < 1 ||
          operations.length > BUILD_PLAYBACK_TRACE_LIMITS.maxOperationsPerTransition,
      )
    ) {
      throw new BuildPlaybackTraceError(
        `Playback transition ${position + 1} contains an empty or oversized reducer group.`,
      );
    }
    totalOperations += operationGroups.reduce((total, operations) => total + operations.length, 0);
    if (totalOperations > BUILD_PLAYBACK_TRACE_LIMITS.maxTotalOperations) {
      throw new BuildPlaybackTraceError("Build playback trace exceeds the total operation limit.");
    }
    const before = current;
    let after = before;
    for (const operations of operationGroups) after = applyBuildOperations(after, operations);
    requireStableGlobalPolicy(before, after);
    const step = exactTransitionStep(before, after, position + 1);
    const addedIds = addedPartIds(before, after);
    requireStepMembership(before, after, step, addedIds, position + 1);
    const body = transitionBody({
      stepIndex: step.index,
      stepId: step.id,
      stepName: step.name,
      addedPartIds: addedIds,
      beforeDocumentHash: documentStructuralHash(before),
      afterDocumentHash: documentStructuralHash(after),
      beforeDocumentCanonicalDigest: canonicalDigest(before),
      afterDocumentCanonicalDigest: canonicalDigest(after),
      operationGroups,
    });
    transitions.push({ ...body, transitionCommitment: canonicalDigest(body) });
    current = after;
  }
  requireFinalStepBijection(current, transitions);
  const body = traceBody({
    schemaVersion: BUILD_PLAYBACK_TRACE_SCHEMA_VERSION,
    authority: "none",
    baseDocument: structuredClone(baseDocument),
    baseDocumentHash: documentStructuralHash(baseDocument),
    targetDocumentHash: documentStructuralHash(current),
    targetPlaybackDigest: playbackTargetDigest(current),
    transitions,
  });
  const trace = deepFreeze({ ...body, traceCommitment: canonicalDigest(body) });
  requireBoundedJsonEnvelope(trace);
  return trace;
}

/**
 * Replays and verifies untrusted trace data against the authored final graph.
 * The returned sequence is exact only because every transition commitment and
 * the final document commitment have been reproduced locally.
 */
function deriveBuildSequenceFromTraceUnchecked(
  targetDocument: BrickDocumentV1,
  unsafeTrace: unknown,
): BuildSequence {
  requirePlaybackProtocolDocument(targetDocument, "Authored playback target document");
  const detached = detachTrace(unsafeTrace);
  exactKeys(
    detached,
    [
      "authority",
      "baseDocument",
      "baseDocumentHash",
      "schemaVersion",
      "targetDocumentHash",
      "targetPlaybackDigest",
      "traceCommitment",
      "transitions",
    ],
    "Build playback trace",
  );
  const trace = detached as BuildPlaybackTraceV1;
  if (
    trace.schemaVersion !== BUILD_PLAYBACK_TRACE_SCHEMA_VERSION ||
    trace.authority !== "none" ||
    !HASH_PATTERN.test(trace.baseDocumentHash) ||
    !HASH_PATTERN.test(trace.targetDocumentHash) ||
    !HASH_PATTERN.test(trace.targetPlaybackDigest) ||
    !HASH_PATTERN.test(trace.traceCommitment) ||
    !Array.isArray(trace.transitions) ||
    trace.transitions.length > BUILD_PLAYBACK_TRACE_LIMITS.maxTransitions
  ) {
    throw new BuildPlaybackTraceError("Build playback trace identity or bounds are invalid.");
  }
  requirePlaybackProtocolDocument(trace.baseDocument, "Build playback trace base document");
  if (documentStructuralHash(trace.baseDocument) !== trace.baseDocumentHash) {
    throw new BuildPlaybackTraceError("Build playback trace base document hash does not match.");
  }
  requireEmptyAuthoringBase(trace.baseDocument);
  let totalOperations = 0;
  let current = trace.baseDocument;
  const states: BuildSequenceState[] = [
    blockingState({
      document: current,
      stepIndex: -1,
      stepId: null,
      stepName: "Empty base",
      addedPartIds: [],
    }),
  ];
  for (const [position, transitionValue] of trace.transitions.entries()) {
    exactKeys(
      transitionValue,
      [
        "addedPartIds",
        "afterDocumentHash",
        "afterDocumentCanonicalDigest",
        "beforeDocumentHash",
        "beforeDocumentCanonicalDigest",
        "operationGroups",
        "stepId",
        "stepIndex",
        "stepName",
        "transitionCommitment",
      ],
      `Build playback transition ${position + 1}`,
    );
    const transition = transitionValue as BuildPlaybackTraceTransitionV1;
    if (
      !Array.isArray(transition.operationGroups) ||
      transition.operationGroups.length < 1 ||
      transition.operationGroups.length >
        BUILD_PLAYBACK_TRACE_LIMITS.maxOperationGroupsPerTransition ||
      transition.operationGroups.some(
        (operations) =>
          !Array.isArray(operations) ||
          operations.length < 1 ||
          operations.length > BUILD_PLAYBACK_TRACE_LIMITS.maxOperationsPerTransition,
      ) ||
      !Array.isArray(transition.addedPartIds) ||
      !HASH_PATTERN.test(transition.beforeDocumentHash) ||
      !HASH_PATTERN.test(transition.afterDocumentHash) ||
      !HASH_PATTERN.test(transition.beforeDocumentCanonicalDigest) ||
      !HASH_PATTERN.test(transition.afterDocumentCanonicalDigest) ||
      !HASH_PATTERN.test(transition.transitionCommitment)
    ) {
      throw new BuildPlaybackTraceError(
        `Build playback transition ${position + 1} identity or bounds are invalid.`,
      );
    }
    requirePlaybackProtocolOperations(
      transition.operationGroups,
      `Playback transition ${position + 1}`,
    );
    totalOperations += transition.operationGroups.reduce(
      (total, operations) => total + operations.length,
      0,
    );
    if (totalOperations > BUILD_PLAYBACK_TRACE_LIMITS.maxTotalOperations) {
      throw new BuildPlaybackTraceError("Build playback trace exceeds the total operation limit.");
    }
    const body: Record<string, unknown> = { ...transition };
    delete body.transitionCommitment;
    if (canonicalDigest(body) !== transition.transitionCommitment) {
      throw new BuildPlaybackTraceError(
        `Build playback transition ${position + 1} commitment does not match its content.`,
      );
    }
    if (
      documentStructuralHash(current) !== transition.beforeDocumentHash ||
      canonicalDigest(current) !== transition.beforeDocumentCanonicalDigest
    ) {
      throw new BuildPlaybackTraceError(
        `Build playback transition ${position + 1} before-document commitment does not match.`,
      );
    }
    let after = current;
    for (const operations of transition.operationGroups) {
      after = applyBuildOperations(after, operations);
    }
    requireStableGlobalPolicy(current, after);
    const step = exactTransitionStep(current, after, position + 1);
    const addedIds = addedPartIds(current, after);
    requireStepMembership(current, after, step, addedIds, position + 1);
    if (
      transition.stepIndex !== step.index ||
      transition.stepId !== step.id ||
      transition.stepName !== step.name ||
      transition.afterDocumentHash !== documentStructuralHash(after) ||
      transition.afterDocumentCanonicalDigest !== canonicalDigest(after) ||
      transition.addedPartIds.length !== addedIds.length ||
      transition.addedPartIds.some((partId, index) => partId !== addedIds[index])
    ) {
      throw new BuildPlaybackTraceError(
        `Build playback transition ${position + 1} does not match its replayed step state.`,
      );
    }
    states.push(
      blockingState({
        document: after,
        stepIndex: step.index,
        stepId: step.id,
        stepName: step.name,
        addedPartIds: addedIds,
      }),
    );
    current = after;
  }
  const body: Record<string, unknown> = { ...trace };
  delete body.traceCommitment;
  if (canonicalDigest(body) !== trace.traceCommitment) {
    throw new BuildPlaybackTraceError(
      "Build playback trace commitment does not match its content.",
    );
  }
  const replayedHash = documentStructuralHash(current);
  const authoredHash = documentStructuralHash(targetDocument);
  const replayedPlaybackDigest = playbackTargetDigest(current);
  const authoredPlaybackDigest = playbackTargetDigest(targetDocument);
  if (
    replayedHash !== trace.targetDocumentHash ||
    authoredHash !== trace.targetDocumentHash ||
    replayedPlaybackDigest !== trace.targetPlaybackDigest ||
    authoredPlaybackDigest !== trace.targetPlaybackDigest
  ) {
    throw new BuildPlaybackTraceError(
      `Build playback trace target commitments do not match replay/authored documents (structural ${replayedHash}/${authoredHash}, playback ${replayedPlaybackDigest}/${authoredPlaybackDigest}).`,
    );
  }
  requireFinalStepBijection(current, trace.transitions);
  const firstUnbuildable = states.find(({ buildable }) => !buildable);
  return deepFreeze({
    schemaVersion: "lego.build-sequence/1" as const,
    mode: "operation-trace-exact" as const,
    exact: true as const,
    traceCommitment: trace.traceCommitment,
    documentHash: authoredHash,
    states,
    buildable: firstUnbuildable === undefined,
    firstUnbuildableStepIndex: firstUnbuildable?.stepIndex ?? null,
  });
}

export function deriveBuildSequenceFromTrace(
  targetDocument: BrickDocumentV1,
  unsafeTrace: unknown,
): BuildSequence {
  try {
    return deriveBuildSequenceFromTraceUnchecked(targetDocument, unsafeTrace);
  } catch (error) {
    if (error instanceof BuildPlaybackTraceError) throw error;
    throw new BuildPlaybackTraceError(
      `Build playback trace failed local schema or operation replay: ${
        error instanceof Error ? error.message : "unreadable input"
      }`,
    );
  }
}
