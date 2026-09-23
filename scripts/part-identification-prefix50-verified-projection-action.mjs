import { isDeepStrictEqual } from "node:util";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const EXPECTED_ACTION_ACCOUNTING = Object.freeze({
  printedStepRows: 50,
  partBearingStepRows: 49,
  zeroPieceStepRows: 1,
  calloutRows: 187,
  physicalIdentities: 320,
  builderPhases: 95,
  directPhases: 91,
  copyPhases: 4,
  directIdentities: 309,
  copyIdentities: 11,
  repeatRows: 2,
});

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function projectPrefix50Action({
  actionRole,
  expectedScope,
  sourcePdfDigest,
  stableDigest,
}) {
  const { artifact, digest } = actionRole.inspection;
  if (
    artifact.schemaVersion !== "lego.real-build-action-preparation/1" ||
    !isDeepStrictEqual(artifact.scope, expectedScope) ||
    !isDeepStrictEqual(artifact.accounting, EXPECTED_ACTION_ACCOUNTING) ||
    !Array.isArray(artifact.steps) ||
    artifact.steps.length !== 50 ||
    artifact.sourceIndex?.prefixPartArtPieces !== 320 ||
    artifact.sourceIndex?.expectedPrintedSteps !== 359 ||
    artifact.sourceIndex?.suffixStepsReconstructed !== false ||
    artifact.inputs?.sourcePdfDigest !== sourcePdfDigest ||
    !SHA256.test(artifact.inputs?.officialModel?.phaseDigest)
  ) {
    throw new TypeError(
      "Opaque action preparation does not retain the exact 1..50/320 prefix and 359-step index boundary.",
    );
  }
  const occurrences = new Map();
  const steps = [];
  let cursor = 0;
  for (const [index, step] of artifact.steps.entries()) {
    const stepNumber = index + 1;
    const callouts = new Map(step.callouts?.map((callout) => [callout.identity, callout]));
    const phaseOrdinals = [];
    if (
      step.stepNumber !== stepNumber ||
      step.printedPieceCursorBefore !== cursor ||
      step.printedPieceCursorAfter !== cursor + step.printedPieces ||
      !Array.isArray(step.sourceBuilderIdentityOrdinals) ||
      !Array.isArray(step.phaseSequences) ||
      !Array.isArray(step.phases) ||
      !isDeepStrictEqual(
        step.phaseSequences,
        step.phases.map(({ sequence }) => sequence),
      ) ||
      callouts.size !== step.callouts?.length
    ) {
      throw new TypeError(`Opaque action preparation printed step ${stepNumber} is not exact.`);
    }
    for (const phase of step.phases) {
      if (
        (phase.kind !== "direct" && phase.kind !== "multi-build-copy") ||
        !Number.isSafeInteger(phase.sequence) ||
        !Array.isArray(phase.subBuildPath) ||
        !phase.subBuildPath.every((entry) => typeof entry === "string") ||
        !Array.isArray(phase.members)
      ) {
        throw new TypeError(`Opaque action preparation step ${stepNumber} has an invalid phase.`);
      }
      for (const [phaseMemberIndex, member] of phase.members.entries()) {
        const callout = callouts.get(member.calloutIdentity);
        const ordinal = member.sourceBuilderIdentityOrdinal;
        if (
          !Number.isSafeInteger(ordinal) ||
          ordinal < 1 ||
          ordinal > 320 ||
          occurrences.has(ordinal) ||
          callout === undefined ||
          callout.officialDesignId !== member.officialDesignId ||
          member.phaseMemberOrdinal !== phaseMemberIndex + 1
        ) {
          throw new TypeError(
            `Opaque action preparation occurrence ${String(ordinal)} has no unique exact callout/member basis.`,
          );
        }
        phaseOrdinals.push(ordinal);
        occurrences.set(
          ordinal,
          deepFreeze({
            actionKind: phase.kind,
            builderBrickRef: member.builderBrickRef,
            calloutIdentity: member.calloutIdentity,
            catalogColorId: callout.publishedColorId,
            designRevision: member.designRevision,
            masterSubBuildRef: phase.kind === "multi-build-copy" ? phase.masterSubBuildRef : null,
            officialDesignId: member.officialDesignId,
            phaseMemberOrdinal: member.phaseMemberOrdinal,
            phaseSequence: phase.sequence,
            publishedCatalogPartId: callout.catalogPartId,
            sourceBuilderBrickRef:
              phase.kind === "multi-build-copy" ? member.sourceBuilderBrickRef : null,
            sourceBuilderIdentityOrdinal: ordinal,
            stepNumber,
            subBuildPath: [...phase.subBuildPath],
          }),
        );
      }
    }
    if (
      !isDeepStrictEqual(phaseOrdinals, step.sourceBuilderIdentityOrdinals) ||
      phaseOrdinals.length !== step.printedPieces ||
      (stepNumber === 44 ? step.printedPieces !== 0 : step.printedPieces < 1)
    ) {
      throw new TypeError(
        `Opaque action preparation step ${stepNumber} does not retain its exact printed occurrence row.`,
      );
    }
    steps.push(
      deepFreeze({
        printedStepNumber: stepNumber,
        name: `Printed step ${stepNumber}`,
        sourceActionDigest: stableDigest({
          schemaVersion: "lego.real-build-prefix50-source-action/1",
          step,
        }),
      }),
    );
    cursor = step.printedPieceCursorAfter;
  }
  if (
    cursor !== 320 ||
    occurrences.size !== 320 ||
    [...occurrences.keys()].sort((a, b) => a - b).some((ordinal, index) => ordinal !== index + 1)
  ) {
    throw new TypeError("Opaque action preparation does not close exact ordinals 1..320.");
  }
  return Object.freeze({
    digest,
    occurrences,
    phaseDigest: artifact.inputs.officialModel.phaseDigest,
    schemaVersion: artifact.schemaVersion,
    sourcePdfDigest: artifact.inputs.sourcePdfDigest,
    sourceSteps: artifact.steps,
    steps,
  });
}
