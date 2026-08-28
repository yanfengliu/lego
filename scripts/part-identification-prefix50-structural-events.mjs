import { jsonArtifactFromBytes, sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  snapshotBoundedUint8Array,
  snapshotExactDataObject,
} from "./part-identification-bounded-snapshot.mjs";
import {
  inspectVerifiedPrefix50ActionPreparation,
  isVerifiedPrefix50ActionPreparation,
} from "./part-identification-prefix50-action-preparation.mjs";
import {
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS,
  PREFIX50_STRUCTURAL_EVENTS_AUTHORITY,
  PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES,
  PREFIX50_STRUCTURAL_EVENTS_SCHEMA,
  PREFIX50_STRUCTURAL_MEMBER_COMMITMENT_SCHEMA,
} from "./part-identification-prefix50-structural-events-source.mjs";
import { authenticateStep31_32OfficialModel } from "./part-identification-step31-32-order-reconciliation-source.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const COMPILE_KEYS = ["actionPreparation", "officialModelBytes", "transitionClassificationBytes"];
const VERIFY_KEYS = [...COMPILE_KEYS, "artifactBytes"].sort();
const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

function snapshotInput(input, keys, label) {
  const roles = snapshotExactDataObject(input, label, keys);
  if (!isVerifiedPrefix50ActionPreparation(roles.actionPreparation)) {
    throw new TypeError(
      `${label}.actionPreparation must be the opaque current prefix-50 action-preparation verifier result. Parsed artifacts and caller-shaped schedules carry no structural-event authority.`,
    );
  }
  return {
    actionPreparation: roles.actionPreparation,
    officialModelBytes: snapshotBoundedUint8Array(roles.officialModelBytes, {
      label: "Prefix-50 structural-event official Builder XML",
      minimumBytes: 1,
      maximumBytes: 16 * 1024 * 1024,
    }),
    transitionClassificationBytes: snapshotBoundedUint8Array(roles.transitionClassificationBytes, {
      label: "Prefix-50 structural-event transition-classification bundle",
      minimumBytes: 1,
      maximumBytes: 2 * 1024 * 1024,
    }),
    ...(keys.includes("artifactBytes")
      ? {
          artifactBytes: snapshotBoundedUint8Array(roles.artifactBytes, {
            label: "Prefix-50 structural-event artifact",
            minimumBytes: 1,
            maximumBytes: PREFIX50_STRUCTURAL_EVENTS_MAX_ARTIFACT_BYTES,
          }),
        }
      : {}),
  };
}

function requirePin(artifact, pin, label) {
  if (
    artifact.bytes.length !== pin.bytes ||
    artifact.digest !== pin.digest ||
    (pin.schemaVersion !== undefined && artifact.value?.schemaVersion !== pin.schemaVersion)
  ) {
    throw new Error(
      `${label} must be the exact pinned ${pin.bytes}-byte input at ${pin.digest}; received ${artifact.bytes.length} bytes at ${artifact.digest}.`,
    );
  }
}

function onlyValue(values, label) {
  const unique = [...new Set(values)];
  if (unique.length !== 1) {
    throw new Error(`${label} must have exactly one value; received ${JSON.stringify(unique)}.`);
  }
  return unique[0];
}

function memberCommitment(members) {
  const bytes = Buffer.from(`${JSON.stringify(members)}\n`);
  return {
    schemaVersion: PREFIX50_STRUCTURAL_MEMBER_COMMITMENT_SCHEMA,
    rows: members.length,
    bytes: bytes.length,
    digest: sha256Digest(bytes),
  };
}

function actionMemberRows(action) {
  const rows = action.steps.flatMap((step) =>
    step.phases.flatMap((phase) =>
      phase.members.map((member) => ({
        stepNumber: step.stepNumber,
        phaseSequence: phase.sequence,
        subBuildPath: phase.subBuildPath,
        sourceBuilderIdentityOrdinal: member.sourceBuilderIdentityOrdinal,
        actualBrickRef: member.builderBrickRef,
      })),
    ),
  );
  if (
    rows.length !== 320 ||
    new Set(rows.map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal)).size !==
      rows.length ||
    new Set(rows.map(({ actualBrickRef }) => actualBrickRef)).size !== rows.length
  ) {
    throw new Error(
      "Prefix-50 structural events require 320 unique action ordinals and actual Builder BrickRefs.",
    );
  }
  return rows;
}

function pageBetweenPhysicalNeighbors(action, stepIndex) {
  const previous = action.steps[stepIndex - 1];
  const current = action.steps[stepIndex];
  const following = action.steps[stepIndex + 1];
  if (
    previous === undefined ||
    following === undefined ||
    current.stepNumber !== previous.stepNumber + 1 ||
    following.stepNumber !== current.stepNumber + 1 ||
    previous.phases.length < 1 ||
    following.phases.length < 1
  ) {
    throw new Error(
      `Zero-piece printed step ${current.stepNumber} is not bracketed by its two consecutive physical action rows.`,
    );
  }
  const previousPage = onlyValue(
    previous.callouts.map(({ pageNumber }) => pageNumber),
    `Printed step ${previous.stepNumber} callout page`,
  );
  const followingPage = onlyValue(
    following.callouts.map(({ pageNumber }) => pageNumber),
    `Printed step ${following.stepNumber} callout page`,
  );
  if (followingPage !== previousPage + 2) {
    throw new Error(
      `Zero-piece printed step ${current.stepNumber} is bracketed by booklet pages ${previousPage}/${followingPage}, not two consecutive neighboring pages.`,
    );
  }
  return { pageNumber: previousPage + 1, previous, following };
}

export function deriveSubBuildCompletionEvent({
  action,
  builderOrder,
  classification,
  zeroStep,
  stepIndex,
  members,
}) {
  const pageBoundary = pageBetweenPhysicalNeighbors(action, stepIndex);
  const precedingPhaseSequence = pageBoundary.previous.phaseSequences.at(-1);
  const followingPhaseSequence = pageBoundary.following.phaseSequences[0];
  const sourceEvents = builderOrder.structuralEvents.filter(
    (event) =>
      event.kind === "sub-build-complete" &&
      event.precedingPhaseSequence === precedingPhaseSequence &&
      event.followingPhaseSequence === followingPhaseSequence,
  );
  if (sourceEvents.length !== 1) {
    throw new Error(
      `Zero-piece printed step ${zeroStep.stepNumber} requires exactly one official sub-build completion between phases ${precedingPhaseSequence}/${followingPhaseSequence}; received ${sourceEvents.length}.`,
    );
  }
  const source = sourceEvents[0];
  const memberByRef = new Map(members.map((member) => [member.actualBrickRef, member]));
  const childMembers = source.physicalBrickRefs.map((actualBrickRef) => {
    const member = memberByRef.get(actualBrickRef);
    if (member === undefined || !member.subBuildPath.includes(source.childSubBuildUuid)) {
      throw new Error(
        `Official child SubBuild ${source.childSubBuildUuid} Brick ${actualBrickRef} is absent from its exact prefix-50 action path.`,
      );
    }
    return {
      sourceBuilderIdentityOrdinal: member.sourceBuilderIdentityOrdinal,
      actualBrickRef,
    };
  });
  childMembers.sort(
    (left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal,
  );
  const actionChildRefs = members
    .filter(({ subBuildPath }) => subBuildPath.includes(source.childSubBuildUuid))
    .map(({ actualBrickRef }) => actualBrickRef);
  if (
    source.physicalBrickRefs.length !== actionChildRefs.length ||
    source.physicalBrickRefs.some((brickRef) => !actionChildRefs.includes(brickRef))
  ) {
    throw new Error(
      `Official child SubBuild ${source.childSubBuildUuid} has ${source.physicalBrickRefs.length} members, but its exact prefix-50 action path has ${actionChildRefs.length}.`,
    );
  }
  const sourceBuilderIdentityOrdinals = childMembers.map(
    ({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal,
  );
  const corroboration = classification.byStep[zeroStep.stepNumber];
  if (
    corroboration !== undefined &&
    (corroboration.pageNumber !== pageBoundary.pageNumber ||
      corroboration.localClassification?.authenticated !== false)
  ) {
    throw new Error(
      `Printed step ${zeroStep.stepNumber} has malformed unauthenticated transition corroboration for derived booklet page ${pageBoundary.pageNumber}.`,
    );
  }
  return {
    kind: "sub-build-complete",
    sequence: 1,
    sourceStructuralEventSequence: source.sequence,
    sourceDigest: source.sourceDigest,
    printedStepNumber: zeroStep.stepNumber,
    pdfPageNumber: pageBoundary.pageNumber,
    printedPieceCursorBefore: zeroStep.printedPieceCursorBefore,
    printedPieceCursorAfter: zeroStep.printedPieceCursorAfter,
    addedSourceBuilderIdentityOrdinals: [...zeroStep.sourceBuilderIdentityOrdinals],
    phaseSequences: [...zeroStep.phaseSequences],
    boundary: {
      precedingPhaseSequence,
      followingPhaseSequence,
    },
    parent: {
      stepUuid: source.parentStepUuid,
      subBuildPath: [...source.parentSubBuildPath],
    },
    child: {
      subBuildUuid: source.childSubBuildUuid,
      subBuildPath: [...source.childSubBuildPath],
      memberCount: childMembers.length,
      sourceBuilderIdentityOrdinals,
      members: childMembers,
      memberCommitment: memberCommitment(childMembers),
    },
    connectionProjection: {
      status: "deferred",
      connections: [],
      reason:
        "Official Builder order proves the child completion/return boundary but does not enumerate catalog connection edges.",
    },
    buildStepConnectionTiming: {
      status: "not-representable-by-current-build-step",
      reason:
        "BuildStep records only partIds; deriveBuildSequence exposes document connections as soon as both endpoints exist, so it cannot prove that a connection edge first became active at this printed step.",
    },
    documentLegalityClaimed: false,
    unauthenticatedJoinInterpretation:
      corroboration === undefined
        ? {
            status: "absent",
            authorityUsed: false,
          }
        : {
            status: "reported-unauthenticated",
            authorityUsed: false,
            authenticated: false,
            transition: corroboration.transition,
            panelEvidenceDigest: corroboration.panelEvidenceDigest,
            evidenceDigest: corroboration.evidenceDigest,
            classifierClaimId: corroboration.localClassification.classifierClaimId,
          },
  };
}

async function compileSnapshot(input) {
  const actionInspection = inspectVerifiedPrefix50ActionPreparation(input.actionPreparation);
  const action = actionInspection.artifact;
  const pins = CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS;
  if (
    actionInspection.digest !== pins.actionPreparation.digest ||
    action.schemaVersion !== pins.actionPreparation.schemaVersion ||
    action.scope.firstPrintedStep !== 1 ||
    action.scope.lastPrintedStep !== 50 ||
    action.scope.expectedPrintedSteps !== 359 ||
    action.scope.suffixStepsReconstructed !== false ||
    action.inputs.officialModel.phaseDigest !== pins.officialPhaseDigest
  ) {
    throw new Error(
      "Prefix-50 structural events require the exact current first-50 action token and unchanged official phase digest.",
    );
  }
  const official = await authenticateStep31_32OfficialModel(input.officialModelBytes);
  if (official.builderOrder.structuralDigest !== pins.officialStructuralDigest) {
    throw new Error(
      `Official Builder structural order must reproduce ${pins.officialStructuralDigest}; received ${official.builderOrder.structuralDigest}.`,
    );
  }
  const transitionArtifact = jsonArtifactFromBytes(
    input.transitionClassificationBytes,
    "Prefix-50 transition-classification corroboration",
  );
  requirePin(
    transitionArtifact,
    pins.transitionClassifications,
    "Prefix-50 transition-classification corroboration",
  );
  const transitionModule = await importRepositoryTypeScript(
    moduleUrl("../apps/web/e2e/real-build-transition-classification.ts"),
  );
  const classification = transitionModule.readTransitionClassificationBundle(
    transitionArtifact.value,
    action.inputs.sourcePdfDigest,
  );
  if (classification.rejections.length > 0) {
    throw new Error(
      `Prefix-50 transition-classification corroboration was rejected: ${classification.rejections.join(" ")}`,
    );
  }
  const members = actionMemberRows(action);
  const zeroSteps = action.steps
    .map((step, stepIndex) => ({ step, stepIndex }))
    .filter(({ step }) => step.printedPieces === 0);
  if (zeroSteps.length !== 1) {
    throw new Error(
      `Prefix-50 structural events require one exact zero-piece printed row; received ${zeroSteps.length}.`,
    );
  }
  const structuralEvents = zeroSteps.map(({ step, stepIndex }) =>
    deriveSubBuildCompletionEvent({
      action,
      builderOrder: official.builderOrder,
      classification,
      zeroStep: step,
      stepIndex,
      members,
    }),
  );
  if (
    structuralEvents.some(({ printedStepNumber }) => printedStepNumber > 50) ||
    structuralEvents.some(
      ({ phaseSequences, addedSourceBuilderIdentityOrdinals }) =>
        phaseSequences.length !== 0 || addedSourceBuilderIdentityOrdinals.length !== 0,
    )
  ) {
    throw new Error(
      "Prefix-50 structural events may not publish a suffix event or fabricate a physical action phase.",
    );
  }
  const scope = {
    firstPrintedStep: 1,
    lastPrintedStep: 50,
    expectedPrintedSteps: 359,
    sourceIndexPreserved: true,
    suffixStepsReconstructed: false,
  };
  const structuralDigest = sha256Digest(
    Buffer.from(
      `${JSON.stringify({ schemaVersion: PREFIX50_STRUCTURAL_EVENTS_SCHEMA, scope, structuralEvents })}\n`,
    ),
  );
  return {
    schemaVersion: PREFIX50_STRUCTURAL_EVENTS_SCHEMA,
    authority: PREFIX50_STRUCTURAL_EVENTS_AUTHORITY,
    scope,
    inputs: {
      actionPreparation: {
        schemaVersion: action.schemaVersion,
        bytes: pins.actionPreparation.bytes,
        digest: actionInspection.digest,
        phaseDigest: action.inputs.officialModel.phaseDigest,
      },
      officialModel: {
        bytes: input.officialModelBytes.length,
        digest: official.digest,
        phaseDigest: official.builderOrder.phaseDigest,
        structuralDigest: official.builderOrder.structuralDigest,
      },
      transitionClassificationCorroboration: {
        schemaVersion: transitionArtifact.value.schemaVersion,
        bytes: transitionArtifact.bytes.length,
        digest: transitionArtifact.digest,
        authenticated: false,
        authorityUsed: false,
      },
      sourcePdfDigest: action.inputs.sourcePdfDigest,
    },
    accounting: {
      actionPhases: action.accounting.builderPhases,
      actionPhysicalIdentities: action.accounting.physicalIdentities,
      zeroPiecePrintedRows: zeroSteps.length,
      structuralEvents: structuralEvents.length,
      subBuildCompletionEvents: structuralEvents.filter(({ kind }) => kind === "sub-build-complete")
        .length,
      unauthenticatedJoinInterpretations: structuralEvents.filter(
        ({ unauthenticatedJoinInterpretation }) =>
          unauthenticatedJoinInterpretation.status === "reported-unauthenticated",
      ).length,
      suffixEvents: structuralEvents.filter(({ printedStepNumber }) => printedStepNumber > 50)
        .length,
    },
    structuralDigest,
    structuralEvents,
  };
}

export const encodePrefix50StructuralEvents = (artifact) =>
  Buffer.from(`${JSON.stringify(artifact, null, 1)}\n`);

export async function compilePrefix50StructuralEvents(input) {
  return compileSnapshot(
    snapshotInput(input, COMPILE_KEYS, "Prefix-50 structural-event compiler input"),
  );
}

const verifiedArtifacts = new WeakMap();

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export async function verifyPrefix50StructuralEvents(input) {
  const snapshot = snapshotInput(input, VERIFY_KEYS, "Prefix-50 structural-event verifier input");
  await Promise.resolve();
  const supplied = jsonArtifactFromBytes(
    snapshot.artifactBytes,
    "Prefix-50 structural-event artifact",
  );
  const expected = await compileSnapshot(snapshot);
  const expectedBytes = encodePrefix50StructuralEvents(expected);
  const expectedDigest = sha256Digest(expectedBytes);
  const pin = CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.expectedArtifact;
  if (pin === null) {
    throw new Error(
      `Prefix-50 structural events reproduced ${expectedBytes.length} bytes at ${expectedDigest}, but no reviewed artifact pin is installed.`,
    );
  }
  if (pin.bytes !== expectedBytes.length || pin.digest !== expectedDigest) {
    throw new Error(
      `Prefix-50 structural events reproduced ${expectedBytes.length} bytes at ${expectedDigest}, not reviewed ${pin.bytes} bytes at ${pin.digest}.`,
    );
  }
  if (!supplied.bytes.equals(expectedBytes)) {
    throw new Error(
      "Prefix-50 structural events do not exactly reproduce from the opaque first-50 action token, official Builder XML, and unauthenticated corroboration bundle.",
    );
  }
  const verified = Object.freeze({});
  verifiedArtifacts.set(verified, {
    artifact: deepFreeze(expected),
    bytes: Buffer.from(expectedBytes),
    digest: expectedDigest,
  });
  return verified;
}

function verifiedRecord(value) {
  const record = verifiedArtifacts.get(value);
  if (record === undefined) {
    throw new Error(
      "Prefix-50 structural-event inspection requires its opaque independent-verifier result.",
    );
  }
  return record;
}

export const isVerifiedPrefix50StructuralEvents = (value) =>
  typeof value === "object" && value !== null && verifiedArtifacts.has(value);
export const bytesFromVerifiedPrefix50StructuralEvents = (value) =>
  Buffer.from(verifiedRecord(value).bytes);
export const inspectVerifiedPrefix50StructuralEvents = (value) => {
  const record = verifiedRecord(value);
  return Object.freeze({ artifact: record.artifact, digest: record.digest });
};
