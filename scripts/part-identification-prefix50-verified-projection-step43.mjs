import { isDeepStrictEqual } from "node:util";

const SOURCE_PDF_DIGEST = "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27";
const ACTION_PREPARATION_DIGEST =
  "sha256:cc1163b91bcc3892137e73dd99ae51b9626589572ca683f55e74302bd4a2b267";
const OFFICIAL_MODEL_PHASE_DIGEST =
  "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e";
const STEP_ACTION_DIGEST =
  "sha256:1183e81bf3933f7f49f6ec12d6684b48230606ffbbdbb2fd652223eded4bc46c";
const CHILD_PATH = Object.freeze([
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
]);
const EXACT_PHASES = Object.freeze([
  {
    sequence: 69,
    phaseId: "direct:483db8c6-8ca4-49a0-97c9-6ad196952c68:1",
    sourceDigest: "sha256:206fd092cd39ca47efd3a7a6ee8a15edf4447f6d6aa886662785389d5f255170",
    stepUuid: "483db8c6-8ca4-49a0-97c9-6ad196952c68",
    members: [
      {
        occurrenceOrdinal: 277,
        phaseMemberOrdinal: 1,
        builderBrickRef: "96119ba8-d86a-4489-aeda-1ce5b89c08fd",
        officialDesignId: "3710",
        designRevision: "3710;L",
      },
    ],
  },
  {
    sequence: 70,
    phaseId: "direct:a524d209-7e00-44e7-9213-afae9ead614e:1",
    sourceDigest: "sha256:a818a516af115530693b5009026a991d3b0d1a1e8aa318bf470ba1d22d63a779",
    stepUuid: "a524d209-7e00-44e7-9213-afae9ead614e",
    members: [
      {
        occurrenceOrdinal: 278,
        phaseMemberOrdinal: 1,
        builderBrickRef: "2c383df5-a0bc-4062-b660-8374f6529f10",
        officialDesignId: "3040",
        designRevision: "3040;F",
      },
      {
        occurrenceOrdinal: 279,
        phaseMemberOrdinal: 2,
        builderBrickRef: "ff6570cd-607c-4688-a1ad-a5cbaee772f9",
        officialDesignId: "3040",
        designRevision: "3040;F",
      },
    ],
  },
  {
    sequence: 71,
    phaseId: "direct:5022a8fa-954e-428f-bab6-5fa2fbf2b8e6:1",
    sourceDigest: "sha256:ec74c5d783b2f75cf2c01eba7fa5ae6e098272e4b26022737e846cbc12e4c89e",
    stepUuid: "5022a8fa-954e-428f-bab6-5fa2fbf2b8e6",
    members: [
      {
        occurrenceOrdinal: 280,
        phaseMemberOrdinal: 1,
        builderBrickRef: "7204a4de-9f79-45d5-9ee2-476472469378",
        officialDesignId: "3069",
        designRevision: "3069;Q",
      },
    ],
  },
]);
const EXACT_CALLOUTS = Object.freeze([
  {
    identity: "p44|q1|x404.189|y491.335",
    quantity: 1,
    catalogPartId: "builtin:tile-1x2",
    cropDigest: "sha256:33dec679457449a212fdb3f60ce9196662af4e1c444bf3724fd4dcde9dc2da9c",
  },
  {
    identity: "p44|q1|x443.424|y491.335",
    quantity: 1,
    catalogPartId: "builtin:plate-1x4",
    cropDigest: "sha256:7c11659b8932d0ebff783ca81ff62e5679d1661fc67eaa92eb6adef015fc3ccd",
  },
  {
    identity: "p44|q2|x499.460|y491.335",
    quantity: 2,
    catalogPartId: "builtin:slope-1x2-45",
    cropDigest: "sha256:8767244e717898c11168f2e809e6f152c7ae5ede4cfb60b0cd595952d829884e",
  },
]);
const EXACT_LATE_STEP42_CALLOUTS = Object.freeze([
  {
    identity: "p44|q1|x23.093|y227.599",
    quantity: 1,
    catalogPartId: "builtin:tile-1x2",
    cropDigest: "sha256:e36b9ab01afb0a3b0957c5d5bb4eafa9364ec4f609d2d9d6a22c32210204d1b2",
  },
  {
    identity: "p44|q1|x53.989|y227.599",
    quantity: 1,
    catalogPartId: "builtin:plate-1x4",
    cropDigest: "sha256:423a1d955c5941b3bba19f40f6bdbc37c59f21058fe8bc768e3b202c698e19da",
  },
]);

const deepFreeze = (value) => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export function projectPrefix50Step43ActionBinding(action) {
  const step42 = action.sourceSteps[41];
  const step = action.sourceSteps[42];
  const phases = step?.phases?.map((phase) => ({
    sequence: phase.sequence,
    phaseId: phase.phaseId,
    sourceDigest: phase.sourceDigest,
    stepUuid: phase.stepUuid,
    members: phase.members.map((member) => ({
      occurrenceOrdinal: member.sourceBuilderIdentityOrdinal,
      phaseMemberOrdinal: member.phaseMemberOrdinal,
      builderBrickRef: member.builderBrickRef,
      officialDesignId: member.officialDesignId,
      designRevision: member.designRevision,
    })),
  }));
  const callouts = step?.callouts?.map((callout) => ({
    identity: callout.identity,
    quantity: callout.quantity,
    catalogPartId: callout.catalogPartId,
    cropDigest: callout.cropDigest,
  }));
  const lateStep42Callouts = step42?.callouts?.slice(1).map((callout) => ({
    identity: callout.identity,
    quantity: callout.quantity,
    catalogPartId: callout.catalogPartId,
    cropDigest: callout.cropDigest,
  }));
  if (
    action.digest !== ACTION_PREPARATION_DIGEST ||
    action.sourcePdfDigest !== SOURCE_PDF_DIGEST ||
    action.phaseDigest !== OFFICIAL_MODEL_PHASE_DIGEST ||
    action.steps[42]?.sourceActionDigest !== STEP_ACTION_DIGEST ||
    step?.stepNumber !== 43 ||
    step42?.stepNumber !== 42 ||
    step42.printedPieceCursorBefore !== 273 ||
    step42.printedPieceCursorAfter !== 276 ||
    step42.callouts.length !== 3 ||
    !isDeepStrictEqual(lateStep42Callouts, EXACT_LATE_STEP42_CALLOUTS) ||
    step.printedPieces !== 4 ||
    step.printedPieceCursorBefore !== 276 ||
    step.printedPieceCursorAfter !== 280 ||
    step.phases.length !== 3 ||
    step.phases.some(
      (phase) => phase.kind !== "direct" || !isDeepStrictEqual(phase.subBuildPath, CHILD_PATH),
    ) ||
    !isDeepStrictEqual(phases, EXACT_PHASES) ||
    step.callouts.length !== 3 ||
    step.callouts.some((callout) => callout.pageNumber !== 44 || callout.stepNumber !== 43) ||
    !isDeepStrictEqual(callouts, EXACT_CALLOUTS)
  ) {
    throw new TypeError(
      "Opaque action preparation no longer retains the exact reviewed step-43 page, three callouts, phases 69..71, child path, and four Builder members.",
    );
  }
  return deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step43-action-binding/1",
    sourceSetId: "6651557",
    actionPreparationDigest: action.digest,
    officialModelPhaseDigest: action.phaseDigest,
    sourcePdfDigest: action.sourcePdfDigest,
    stepActionDigest: action.steps[42].sourceActionDigest,
    printedStepNumber: 43,
    lateStep42: {
      stepActionDigest: action.steps[41].sourceActionDigest,
      callouts: lateStep42Callouts,
    },
    subBuildPath: [...CHILD_PATH],
    phases,
    callouts,
  });
}
