import { isDeepStrictEqual } from "node:util";

const SOURCE_PDF_DIGEST = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const ACTION_PREPARATION_DIGEST =
  "sha256:cc1163b91bcc3892137e73dd99ae51b9626589572ca683f55e74302bd4a2b267";
const OFFICIAL_MODEL_PHASE_DIGEST =
  "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e";
const STEP_ACTION_DIGEST =
  "sha256:21a075a8a05ced0e42ad7acb10e0cad752fe812826fa8b6a4e38ca874a49eb0d";
const PHASE_SOURCE_DIGEST =
  "sha256:aed22188ce55f7bf14d36903b11da202c5c0afec8e1f844474380c6fad5a9c99";
const CHILD_PATH = Object.freeze([
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
]);
const EXACT_MEMBERS = Object.freeze([
  {
    occurrenceOrdinal: 274,
    phaseMemberOrdinal: 1,
    builderBrickRef: "27fedc66-8b4f-4c03-87d7-27a53abd009e",
    officialDesignId: "6636",
    designRevision: "6636;N",
  },
  {
    occurrenceOrdinal: 275,
    phaseMemberOrdinal: 2,
    builderBrickRef: "c415d8f1-20b7-491c-824e-f498b2d10759",
    officialDesignId: "3069",
    designRevision: "3069;Q",
  },
  {
    occurrenceOrdinal: 276,
    phaseMemberOrdinal: 3,
    builderBrickRef: "4ad443a5-76cf-4ceb-9d45-c07a8b542dea",
    officialDesignId: "3710",
    designRevision: "3710;L",
  },
]);

const deepFreeze = (value) => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export function projectPrefix50Step42ActionBinding(action) {
  const step = action.sourceSteps[41];
  const phase = step?.phases?.[0];
  const callout = step?.callouts?.[0];
  const members = phase?.members?.map((member) => ({
    occurrenceOrdinal: member.sourceBuilderIdentityOrdinal,
    phaseMemberOrdinal: member.phaseMemberOrdinal,
    builderBrickRef: member.builderBrickRef,
    officialDesignId: member.officialDesignId,
    designRevision: member.designRevision,
  }));
  if (
    action.digest !== ACTION_PREPARATION_DIGEST ||
    action.sourcePdfDigest !== SOURCE_PDF_DIGEST ||
    action.phaseDigest !== OFFICIAL_MODEL_PHASE_DIGEST ||
    action.steps[41]?.sourceActionDigest !== STEP_ACTION_DIGEST ||
    step?.stepNumber !== 42 ||
    step.printedPieces !== 3 ||
    step.printedPieceCursorBefore !== 273 ||
    step.printedPieceCursorAfter !== 276 ||
    step.phases.length !== 1 ||
    phase?.kind !== "direct" ||
    phase.sequence !== 68 ||
    phase.phaseId !== "direct:f6e6a500-90fd-4af9-bd0b-9cd1bc62e058:1" ||
    phase.sourceDigest !== PHASE_SOURCE_DIGEST ||
    phase.stepUuid !== "f6e6a500-90fd-4af9-bd0b-9cd1bc62e058" ||
    !isDeepStrictEqual(phase.subBuildPath, CHILD_PATH) ||
    !isDeepStrictEqual(members, EXACT_MEMBERS) ||
    step.callouts.length !== 3 ||
    callout?.identity !== "p44|q1|x101.684|y227.599" ||
    callout.pageNumber !== 44 ||
    callout.stepNumber !== 42 ||
    callout.quantity !== 1 ||
    callout.catalogPartId !== "builtin:tile-1x6" ||
    callout.cropDigest !== "sha256:66fda118c6cbad71c6058ac3cf7b4f5e69161fd0ad026a19389edf96687bc888"
  ) {
    throw new TypeError(
      "Opaque action preparation no longer retains the exact reviewed step-42 page, tile-1x6 crop, phase, path, and three Builder members.",
    );
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-action-binding/1",
    sourceSetId: "6651557",
    actionPreparationDigest: action.digest,
    officialModelPhaseDigest: action.phaseDigest,
    sourcePdfDigest: action.sourcePdfDigest,
    stepActionDigest: action.steps[41].sourceActionDigest,
    printedStepNumber: 42,
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
