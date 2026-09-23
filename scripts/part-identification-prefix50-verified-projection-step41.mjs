import { isDeepStrictEqual } from "node:util";

const SOURCE_PDF_DIGEST = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const ACTION_PREPARATION_DIGEST =
  "sha256:cc1163b91bcc3892137e73dd99ae51b9626589572ca683f55e74302bd4a2b267";
const OFFICIAL_MODEL_PHASE_DIGEST =
  "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e";
const STEP_ACTION_DIGEST =
  "sha256:60dabfb1bd11de1b0f78e4e4b3e8fa75403221679ce9951d109ce7ad7dff06f5";
const PHASE_SOURCE_DIGEST =
  "sha256:a4685cc8695811bdc25251f519ece53696901699e758ecfb371c59df0eb62d0a";
const CHILD_PATH = Object.freeze([
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
]);
const BUILDER_REFS = Object.freeze([
  "1260a44e-b125-411e-8552-596f22aa32e4",
  "a9aee720-9a6d-4d05-b1cb-2821d8101d03",
  "4287ddd1-1cc4-4cc5-ae50-acf1d543cb06",
  "8a6a770f-a0b9-430a-8802-8f057fbd748a",
]);

const deepFreeze = (value) => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export function projectPrefix50Step41ActionBinding(action) {
  const step = action.sourceSteps[40];
  const phase = step?.phases?.[0];
  const callout = step?.callouts?.[0];
  const members = phase?.members?.map((member) => ({
    occurrenceOrdinal: member.sourceBuilderIdentityOrdinal,
    phaseMemberOrdinal: member.phaseMemberOrdinal,
    builderBrickRef: member.builderBrickRef,
    officialDesignId: member.officialDesignId,
    designRevision: member.designRevision,
  }));
  const exactMembers = BUILDER_REFS.map((builderBrickRef, index) => ({
    occurrenceOrdinal: 270 + index,
    phaseMemberOrdinal: index + 1,
    builderBrickRef,
    officialDesignId: "35480",
    designRevision: "35480;K",
  }));
  if (
    action.digest !== ACTION_PREPARATION_DIGEST ||
    action.sourcePdfDigest !== SOURCE_PDF_DIGEST ||
    action.phaseDigest !== OFFICIAL_MODEL_PHASE_DIGEST ||
    action.steps[40]?.sourceActionDigest !== STEP_ACTION_DIGEST ||
    step?.stepNumber !== 41 ||
    step.printedPieces !== 4 ||
    step.printedPieceCursorBefore !== 269 ||
    step.printedPieceCursorAfter !== 273 ||
    step.phases.length !== 1 ||
    phase?.kind !== "direct" ||
    phase.sequence !== 67 ||
    phase.phaseId !== "direct:862c7cd5-226f-43a4-8d7b-a8da9cb94a9b:1" ||
    phase.sourceDigest !== PHASE_SOURCE_DIGEST ||
    phase.stepUuid !== "862c7cd5-226f-43a4-8d7b-a8da9cb94a9b" ||
    !isDeepStrictEqual(phase.subBuildPath, CHILD_PATH) ||
    !isDeepStrictEqual(members, exactMembers) ||
    step.callouts.length !== 1 ||
    callout?.identity !== "p44|q4|x80.989|y495.535" ||
    callout.pageNumber !== 44 ||
    callout.stepNumber !== 41 ||
    callout.quantity !== 4 ||
    callout.cropDigest !== "sha256:e9dbd7576685871145b9e6278d217fce619bd55d0def81f8438f401e65761072"
  ) {
    throw new TypeError(
      "Opaque action preparation no longer retains the exact reviewed step-41 page, crop, phase, path, and four 35480 Builder members.",
    );
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step41-action-binding/1",
    sourceSetId: "6651557",
    actionPreparationDigest: action.digest,
    officialModelPhaseDigest: action.phaseDigest,
    sourcePdfDigest: action.sourcePdfDigest,
    stepActionDigest: action.steps[40].sourceActionDigest,
    printedStepNumber: 41,
    phaseSequence: phase.sequence,
    phaseKind: phase.kind,
    phaseId: phase.phaseId,
    phaseSourceDigest: phase.sourceDigest,
    stepUuid: phase.stepUuid,
    subBuildPath: [...phase.subBuildPath],
    callout: {
      identity: callout.identity,
      pageNumber: callout.pageNumber,
      quantity: callout.quantity,
      cropDigest: callout.cropDigest,
    },
    members,
  });
}
