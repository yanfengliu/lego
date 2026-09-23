import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";

import { sha256Digest } from "./part-identification-artifact-source.mjs";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const EXPECTED_STRUCTURAL_AUTHORITY = Object.freeze({
  kind: "local-diagnostic",
  authenticated: false,
  officialBuilderStructure: true,
  exactFirst50ActionBoundary: true,
  transitionClassificationCorroborativeOnly: true,
  sourceExecution: false,
  preparedRun: false,
  physicalFrame: false,
  connectionAuthority: false,
  actionAuthority: false,
  placement: false,
  documentLegality: false,
  documentMutation: false,
  replay: false,
  acceptedDocument: false,
  completion: false,
});
const EXPECTED_STRUCTURAL_ACCOUNTING = Object.freeze({
  actionPhases: 95,
  actionPhysicalIdentities: 320,
  zeroPiecePrintedRows: 1,
  structuralEvents: 1,
  subBuildCompletionEvents: 1,
  unauthenticatedJoinInterpretations: 1,
  suffixEvents: 0,
});
const EXPECTED_CURRENT_WINDOW = Object.freeze({
  childSubBuildUuid: "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
  parentSubBuildPath: Object.freeze(["7004cf0d-d97f-4b0d-8572-970e23815c05"]),
  firstOccurrenceOrdinal: 258,
  lastOccurrenceOrdinal: 280,
  entryPrintedStepNumber: 38,
  lastPhysicalPrintedStepNumber: 43,
  returnPrintedStepNumber: 44,
  precedingPhaseSequence: 71,
  followingPhaseSequence: 72,
});

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactMemberCommitment(members) {
  const bytes = Buffer.from(`${JSON.stringify(members)}\n`);
  return {
    schemaVersion: "lego.part-identification-prefix50-structural-member-commitment/1",
    rows: members.length,
    bytes: bytes.length,
    digest: sha256Digest(bytes),
  };
}

function exactActionBoundary(artifact, structuralRole, actionRole, action, expectedScope) {
  const expectedActionInput = {
    schemaVersion: action.schemaVersion,
    bytes: actionRole.bytes.length,
    digest: action.digest,
    phaseDigest: action.phaseDigest,
  };
  if (
    artifact.schemaVersion !== "lego.part-identification-prefix50-structural-events/1" ||
    !isDeepStrictEqual(artifact.authority, EXPECTED_STRUCTURAL_AUTHORITY) ||
    !isDeepStrictEqual(artifact.scope, expectedScope) ||
    !isDeepStrictEqual(artifact.accounting, EXPECTED_STRUCTURAL_ACCOUNTING) ||
    !isDeepStrictEqual(artifact.inputs?.actionPreparation, expectedActionInput) ||
    artifact.inputs?.sourcePdfDigest !== action.sourcePdfDigest ||
    artifact.inputs?.officialModel?.phaseDigest !== action.phaseDigest ||
    !SHA256.test(artifact.inputs?.officialModel?.structuralDigest) ||
    !SHA256.test(artifact.structuralDigest) ||
    structuralRole.inspection.digest !== sha256Digest(structuralRole.bytes) ||
    !Array.isArray(artifact.structuralEvents) ||
    artifact.structuralEvents.length !== 1
  ) {
    throw new TypeError(
      "Opaque structural events do not retain the same exact action bytes, scope, official phase boundary, and one source-bound return event as the prefix projection.",
    );
  }
}

function eventMembership(event, action) {
  const child = event.child;
  const parent = event.parent;
  const memberOrdinals = child?.sourceBuilderIdentityOrdinals;
  const members = child?.members;
  if (
    event.kind !== "sub-build-complete" ||
    event.sequence !== 1 ||
    !Number.isSafeInteger(event.sourceStructuralEventSequence) ||
    !SHA256.test(event.sourceDigest) ||
    !Array.isArray(event.addedSourceBuilderIdentityOrdinals) ||
    event.addedSourceBuilderIdentityOrdinals.length !== 0 ||
    !Array.isArray(event.phaseSequences) ||
    event.phaseSequences.length !== 0 ||
    event.printedPieceCursorBefore !== event.printedPieceCursorAfter ||
    event.documentLegalityClaimed !== false ||
    event.connectionProjection?.status !== "deferred" ||
    !Array.isArray(event.connectionProjection?.connections) ||
    event.connectionProjection.connections.length !== 0 ||
    event.buildStepConnectionTiming?.status !== "not-representable-by-current-build-step" ||
    event.unauthenticatedJoinInterpretation?.authorityUsed !== false ||
    !Array.isArray(parent?.subBuildPath) ||
    !Array.isArray(child?.subBuildPath) ||
    !Array.isArray(memberOrdinals) ||
    !Array.isArray(members) ||
    child.memberCount !== members.length ||
    memberOrdinals.length !== members.length ||
    !isDeepStrictEqual(child.memberCommitment, exactMemberCommitment(members))
  ) {
    throw new TypeError(
      "Opaque structural return event does not retain one authority-bounded zero-action child membership commitment.",
    );
  }

  const expectedChildPath = [...parent.subBuildPath, child.subBuildUuid];
  const pathMembers = [...action.occurrences.values()].filter(({ subBuildPath }) =>
    subBuildPath.includes(child.subBuildUuid),
  );
  for (const [index, ordinal] of memberOrdinals.entries()) {
    const source = action.occurrences.get(ordinal);
    const member = members[index];
    if (
      !Number.isSafeInteger(ordinal) ||
      source === undefined ||
      member?.sourceBuilderIdentityOrdinal !== ordinal ||
      member.actualBrickRef !== source.builderBrickRef ||
      !isDeepStrictEqual(source.subBuildPath, expectedChildPath)
    ) {
      throw new TypeError(
        `Opaque structural child member ${String(ordinal)} contradicts its exact action phase, Brick, or SubBuild path.`,
      );
    }
  }
  if (
    !isDeepStrictEqual(child.subBuildPath, expectedChildPath) ||
    pathMembers.length !== memberOrdinals.length ||
    pathMembers.some(
      ({ sourceBuilderIdentityOrdinal }, index) =>
        sourceBuilderIdentityOrdinal !== memberOrdinals[index],
    ) ||
    memberOrdinals.some((ordinal, index) =>
      index === 0 ? false : ordinal !== memberOrdinals[index - 1] + 1,
    )
  ) {
    throw new TypeError(
      "Opaque structural child membership is not the complete contiguous action-path window.",
    );
  }
  return { child, memberOrdinals, members, parent, pathMembers };
}

export function projectPrefix50ChildSubBuildWindow({
  structuralRole,
  actionRole,
  action,
  expectedScope,
}) {
  const { artifact, digest } = structuralRole.inspection;
  exactActionBoundary(artifact, structuralRole, actionRole, action, expectedScope);
  const event = artifact.structuralEvents[0];
  const { child, memberOrdinals, parent, pathMembers } = eventMembership(event, action);
  const first = pathMembers[0];
  const last = pathMembers.at(-1);
  const returnStep = action.sourceSteps[event.printedStepNumber - 1];
  const previousStep = action.sourceSteps[event.printedStepNumber - 2];
  const followingStep = action.sourceSteps[event.printedStepNumber];
  const derived = {
    childSubBuildUuid: child.subBuildUuid,
    parentSubBuildPath: [...parent.subBuildPath],
    firstOccurrenceOrdinal: memberOrdinals[0],
    lastOccurrenceOrdinal: memberOrdinals.at(-1),
    entryPrintedStepNumber: first?.stepNumber,
    lastPhysicalPrintedStepNumber: last?.stepNumber,
    returnPrintedStepNumber: event.printedStepNumber,
    precedingPhaseSequence: event.boundary?.precedingPhaseSequence,
    followingPhaseSequence: event.boundary?.followingPhaseSequence,
  };
  if (
    !isDeepStrictEqual(derived, EXPECTED_CURRENT_WINDOW) ||
    returnStep?.printedPieces !== 0 ||
    returnStep.printedPieceCursorBefore !== event.printedPieceCursorBefore ||
    returnStep.printedPieceCursorAfter !== event.printedPieceCursorAfter ||
    previousStep?.phaseSequences.at(-1) !== derived.precedingPhaseSequence ||
    followingStep?.phaseSequences[0] !== derived.followingPhaseSequence ||
    child.subBuildPath.at(-1) !== child.subBuildUuid
  ) {
    throw new TypeError(
      "Opaque structural events do not retain the exact source-bound 258..280 child window, step-38 entry, and zero-piece step-44 return.",
    );
  }
  return deepFreeze({
    digest,
    structuralDigest: artifact.structuralDigest,
    window: {
      schemaVersion: "lego.real-build-prefix50-child-subbuild-window/1",
      sourceStructuralEventSequence: event.sourceStructuralEventSequence,
      sourceStructuralEventDigest: event.sourceDigest,
      parentStepUuid: parent.stepUuid,
      parentSubBuildPath: derived.parentSubBuildPath,
      childSubBuildUuid: derived.childSubBuildUuid,
      childSubBuildPath: [...child.subBuildPath],
      entryPrintedStepNumber: derived.entryPrintedStepNumber,
      lastPhysicalPrintedStepNumber: derived.lastPhysicalPrintedStepNumber,
      returnPrintedStepNumber: derived.returnPrintedStepNumber,
      firstOccurrenceOrdinal: derived.firstOccurrenceOrdinal,
      lastOccurrenceOrdinal: derived.lastOccurrenceOrdinal,
      sourceBuilderIdentityOrdinals: [...memberOrdinals],
      precedingPhaseSequence: derived.precedingPhaseSequence,
      followingPhaseSequence: derived.followingPhaseSequence,
      memberCommitment: { ...child.memberCommitment },
    },
  });
}
